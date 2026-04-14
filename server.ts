import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(cookieParser());

// Google OAuth Configuration
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.APP_URL}/auth/callback`
);

// API Routes
app.get('/api/auth/url', (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/drive.metadata.readonly'
    ],
    prompt: 'consent'
  });
  res.json({ url });
});

app.get('/auth/callback', async (req, res) => {
  const { code } = req.query;
  try {
    const { tokens } = await oauth2Client.getToken(code as string);
    // In a real app, you'd store this in a secure session or database linked to the user
    // For this demo, we'll send it back to the client via postMessage
    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'GOOGLE_AUTH_SUCCESS', tokens: ${JSON.stringify(tokens)} }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p>Autentifikacija uspješna. Ovaj prozor će se automatski zatvoriti.</p>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Error exchanging code for tokens:', error);
    res.status(500).send('Authentication failed');
  }
});

// Proxy for Google Drive API to avoid CORS and keep secrets safe
app.post('/api/drive/list', async (req, res) => {
  const { tokens, folderId } = req.body;
  if (!tokens) return res.status(401).json({ error: 'No tokens provided' });

  const auth = new google.auth.OAuth2();
  auth.setCredentials(tokens);
  const drive = google.drive({ version: 'v3', auth });

  try {
    const targetFolderId = folderId || '1l2fl7Q44qUD9XrLSeazYE1RVZt_2_uxY';
    const response = await drive.files.list({
      q: `'${targetFolderId}' in parents and trashed = false`,
      fields: 'files(id, name, mimeType, thumbnailLink, webViewLink, iconLink)',
    });
    
    // If the specific folder is empty or inaccessible, fallback to root or folders
    if (response.data.files?.length === 0 && !folderId) {
      const fallbackResponse = await drive.files.list({
        q: "mimeType != 'application/vnd.google-apps.folder' and trashed = false",
        fields: 'files(id, name, mimeType, thumbnailLink, webViewLink, iconLink)',
        pageSize: 20
      });
      return res.json(fallbackResponse.data.files);
    }

    res.json(response.data.files);
  } catch (error) {
    console.error('Drive API error:', error);
    res.status(500).json({ error: 'Failed to fetch files' });
  }
});

app.post('/api/drive/file', async (req, res) => {
  const { tokens, fileId } = req.body;
  if (!tokens) return res.status(401).json({ error: 'No tokens provided' });

  const auth = new google.auth.OAuth2();
  auth.setCredentials(tokens);
  const drive = google.drive({ version: 'v3', auth });

  try {
    const response = await drive.files.get({
      fileId,
      alt: 'media',
    }, { responseType: 'arraybuffer' });
    
    // Get metadata too
    const metadata = await drive.files.get({
      fileId,
      fields: 'name, mimeType',
    });

    res.set('Content-Type', metadata.data.mimeType || 'application/octet-stream');
    res.send(Buffer.from(response.data as ArrayBuffer));
  } catch (error) {
    console.error('Drive API error:', error);
    res.status(500).json({ error: 'Failed to fetch file' });
  }
});

// Vite middleware
if (process.env.NODE_ENV !== 'production') {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  const distPath = path.join(process.cwd(), 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

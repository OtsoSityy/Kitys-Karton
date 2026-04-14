/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  FileText, 
  Upload, 
  LogOut, 
  Folder, 
  ChevronRight, 
  Loader2, 
  AlertCircle,
  Database,
  Users,
  ShieldAlert,
  SearchCode,
  ArrowLeft,
  LayoutDashboard,
  Stethoscope,
  Pill,
  ClipboardList,
  Moon,
  Sun,
  Send,
  MessageSquare,
  X,
  Cat,
  PawPrint,
  Trash2,
  History,
  Activity,
  Plus,
  RefreshCw,
  Music,
  Volume2,
  VolumeX,
  Coffee,
  Image as ImageIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User
} from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  deleteDoc,
  doc,
  serverTimestamp,
  orderBy,
  limit,
  getDocs,
  writeBatch
} from 'firebase/firestore';
import ReactMarkdown from 'react-markdown';
import { auth, db } from './firebase';
import { cn } from './lib/utils';
import { processMedicalDocument, extractAllergies, chatWithAI } from './lib/gemini';
import CatCafeGame from './components/CatCafeGame';

// Types
interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  thumbnailLink?: string;
  webViewLink?: string;
}

interface ProcessedDoc {
  id: string;
  name: string;
  driveFileId: string;
  extractedData: string;
  processedAt: any;
}

interface Allergy {
  id: string;
  name: string;
  reaction: string;
  severity: string;
  explanation: string;
  sourceDocId: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: any;
}

type Tab = 'pocetna' | 'rodjenje' | 'trombofilija' | 'infekcije' | 'alergologija' | 'dijagnostika' | 'pravna_borba' | 'historija' | 'galerija' | 'nefrologija' | 'laboratorija' | 'genetika' | 'prepiska';

const LOFI_SOURCE = "https://stream.zeno.fm/0r0xa792kwzuv";
const SECRET_SOURCE = "https://ia801602.us.archive.org/11/items/nfs-underground-ost/01%20-%20The%20Crystal%20Method%20-%20Born%20Too%20Slow.mp3";

export default function App() {

  const [user, setUser] = useState<User | null>(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [driveTokens, setDriveTokens] = useState<any>(null);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [processedDocs, setProcessedDocs] = useState<ProcessedDoc[]>([]);
  const [allergies, setAllergies] = useState<Allergy[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('pocetna');
  const [selectedDoc, setSelectedDoc] = useState<ProcessedDoc | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [sendingChat, setSendingChat] = useState(false);
  const [selectedAllergy, setSelectedAllergy] = useState<Allergy | null>(null);
  const [selectedFile, setSelectedFile] = useState<DriveFile | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSecretUnlocked, setIsSecretUnlocked] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Local gallery data from screenshots
  const localImages = [
    { 
      id: 'cat-doc-1', 
      name: 'Maca Dokument 1', 
      url: 'https://drive.google.com/file/d/1j6JOyBrCkmrIX2c-cvXx0vwBpOREpmAM/view?usp=sharing',
      icon: 'cookie'
    },
    { 
      id: 'cat-doc-2', 
      name: 'Maca Dokument 2', 
      url: 'https://drive.google.com/file/d/15VDiSBjbat8f9Om95nJjxtk274Oce86a/view?usp=sharing',
      icon: 'coffee'
    },
    { 
      id: 'cat-doc-3', 
      name: 'Maca Dokument 3', 
      url: 'https://drive.google.com/file/d/1j6JOyBrCkmrIX2c-cvXx0vwBpOREpmAM/view?usp=sharing',
      icon: 'cat'
    }
  ];

  // --- SIMPLE AUDIO SYSTEM ---
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [musicVolume, setMusicVolume] = useState(0.15);
  const [audioSource, setAudioSource] = useState(LOFI_SOURCE);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Theme Listener
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // 1. Sync Volume
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = musicVolume;
  }, [musicVolume]);

  // 2. Sync Source & Playback
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.src !== audioSource) {
      audio.src = audioSource;
      audio.load();
    }

    if (isMusicPlaying) {
      audio.play().catch(() => setIsMusicPlaying(false));
    } else {
      audio.pause();
    }
  }, [audioSource, isMusicPlaying]);
  // ----------------------------

  // Firestore Listeners
  useEffect(() => {
    if (!user) return;
    
    // Documents
    const qDocs = query(collection(db, 'documents'), where('userId', '==', user.uid));
    const unsubDocs = onSnapshot(qDocs, (snapshot) => {
      setProcessedDocs(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ProcessedDoc)));
    });

    // Allergies
    const qAllergies = query(collection(db, 'allergies'), where('userId', '==', user.uid));
    const unsubAllergies = onSnapshot(qAllergies, (snapshot) => {
      setAllergies(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Allergy)));
    });

    // Chat History
    const qChat = query(
      collection(db, 'chats', user.uid, 'messages'), 
      orderBy('timestamp', 'asc'),
      limit(50)
    );
    const unsubChat = onSnapshot(qChat, (snapshot) => {
      setChatMessages(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ChatMessage)));
    });

    return () => {
      unsubDocs();
      unsubAllergies();
      unsubChat();
    };
  }, [user]);

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isChatOpen]);

  // Handle Google Drive Auth Message
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'GOOGLE_AUTH_SUCCESS') {
        setDriveTokens(event.data.tokens);
        fetchDriveFiles(event.data.tokens);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const login = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      setError('Prijava nije uspjela.');
    }
  };

  const logout = () => signOut(auth);

  const connectDrive = async () => {
    try {
      const res = await fetch('/api/auth/url');
      const { url } = await res.json();
      window.open(url, 'google_auth', 'width=600,height=700');
    } catch (err) {
      setError('Greška pri povezivanju sa Drive-om.');
    }
  };

  const fetchDriveFiles = async (tokens: any) => {
    try {
      const res = await fetch('/api/drive/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokens })
      });
      const data = await res.json();
      setFiles(data);
    } catch (err) {
      setError('Greška pri učitavanju datoteka.');
    }
  };

  const processFile = async (file: DriveFile) => {
    if (!driveTokens || !user) return;
    setProcessing(true);
    setError(null);
    try {
      const res = await fetch('/api/drive/file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokens: driveTokens, fileId: file.id })
      });
      const blob = await res.blob();
      
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64Data = (reader.result as string).split(',')[1];
        
        // 1. Full details extraction
        const result = await processMedicalDocument(base64Data, file.mimeType, "Izvuci sve moguće detalje.");
        
        // 2. Allergy extraction
        const extractedAllergies = await extractAllergies(base64Data, file.mimeType);
        
        // 3. Save Document
        const docRef = await addDoc(collection(db, 'documents'), {
          userId: user.uid,
          driveFileId: file.id,
          name: file.name,
          extractedData: result,
          processedAt: serverTimestamp()
        });

        // 4. Save Allergies
        for (const allergy of extractedAllergies) {
          await addDoc(collection(db, 'allergies'), {
            ...allergy,
            userId: user.uid,
            sourceDocId: docRef.id
          });
        }
        
        setProcessing(false);
        setSelectedFile(null);
      };
    } catch (err) {
      setError('Greška pri obradi dokumenta.');
      setProcessing(false);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent, customMessage?: string) => {
    if (e) e.preventDefault();
    const message = customMessage || chatInput;
    if (!message.trim() || !user || sendingChat) return;

    setChatInput('');
    setSendingChat(true);

    try {
      // Save user message
      await addDoc(collection(db, 'chats', user.uid, 'messages'), {
        role: 'user',
        content: message,
        timestamp: serverTimestamp()
      });

      // Get context from processed docs
      const context = processedDocs.map(d => `Dokument: ${d.name}\nSadržaj: ${d.extractedData}`).join('\n\n');
      
      // Get AI response
      const history = chatMessages.map(m => ({ role: m.role, content: m.content }));
      const { text: aiResponse, functionCalls } = await chatWithAI(history, message, context);

      // Handle function calls
      if (functionCalls) {
        for (const call of functionCalls) {
          if (call.name === 'switchTab') {
            const { tabId } = call.args as { tabId: Tab };
            setActiveTab(tabId);
          }
        }
      }

      // Save AI message
      await addDoc(collection(db, 'chats', user.uid, 'messages'), {
        role: 'model',
        content: aiResponse || "Razumijem, prebacujem vas...",
        timestamp: serverTimestamp()
      });
    } catch (err) {
      setError('Greška u AI chatu.');
    } finally {
      setSendingChat(false);
    }
  };

  const deleteMessage = async (msgId: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'chats', user.uid, 'messages', msgId));
    } catch (err) {
      setError('Greška pri brisanju poruke.');
    }
  };

  const clearHistory = async () => {
    if (!user) return;
    try {
      const q = query(collection(db, 'chats', user.uid, 'messages'));
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      snapshot.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    } catch (err) {
      setError('Greška pri brisanju historije.');
    }
  };

  const checkPin = () => {
    if (pinInput === '03041921') {
      setIsAuthorized(true);
    } else {
      setError('Pogrešan kod za pristup.');
      setPinInput('');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-app)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-beige-600" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[var(--bg-app)] flex flex-col items-center justify-center p-6 text-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-[var(--bg-card)] p-10 rounded-[2.5rem] shadow-2xl border border-[var(--border-color)]"
        >
          <div className="w-24 h-24 bg-beige-200 rounded-3xl flex items-center justify-center mx-auto mb-8">
            <PawPrint className="w-12 h-12 text-beige-700" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4 font-serif">Kitys Karton</h1>
          <p className="text-gray-600 mb-10 leading-relaxed">
            Vaša digitalna arhiva zdravlja. Sigurno, pregledno i uz pomoć vještačke inteligencije.
          </p>
          <button 
            onClick={login}
            className="w-full py-4 px-6 bg-beige-800 text-white rounded-2xl font-bold hover:bg-beige-900 transition-all flex items-center justify-center gap-3 shadow-xl shadow-beige-900/20"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-6 h-6 bg-white rounded-full p-1" alt="Google" />
            Prijavi se sa Google-om
          </button>
        </motion.div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-[var(--bg-app)] flex flex-col items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-sm w-full bg-[var(--bg-card)] p-10 rounded-[2.5rem] shadow-2xl border border-[var(--border-color)] text-center"
        >
          <PawPrint className="w-12 h-12 text-beige-800 mx-auto mb-6" />
          <h2 className="text-2xl font-bold mb-6 font-serif">Unesite kod za pristup</h2>
          <input 
            type="password"
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && checkPin()}
            placeholder="••••••••"
            className="w-full text-center text-2xl tracking-[0.5em] py-4 bg-beige-50 dark:bg-white/5 border border-beige-200 rounded-2xl mb-6 focus:ring-2 focus:ring-beige-800 outline-none"
          />
          <button 
            onClick={checkPin}
            className="w-full py-4 bg-beige-800 text-white rounded-2xl font-bold hover:bg-beige-900 transition-all"
          >
            Pristupi
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-main)] flex overflow-hidden">
      {/* Sidebar */}
      <aside className="w-72 bg-[var(--bg-card)] border-r border-[var(--border-color)] flex flex-col z-30">
        <div className="p-8">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 bg-beige-800 rounded-xl flex items-center justify-center">
              <PawPrint className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold font-serif">Kitys Karton</h1>
          </div>

          <nav className="space-y-1">
            {[
              { id: 'pocetna', icon: LayoutDashboard, label: 'Početna' },
              { id: 'rodjenje', icon: Users, label: 'Rođenje i Trauma' },
              { id: 'trombofilija', icon: Database, label: 'Trombofilija' },
              { id: 'infekcije', icon: ShieldAlert, label: 'Infekcije i Virusi' },
              { id: 'alergologija', icon: Activity, label: 'Alergologija' },
              { id: 'dijagnostika', icon: Stethoscope, label: 'Dijagnostika' },
              { id: 'pravna_borba', icon: ClipboardList, label: 'Pravna Borba' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => { setActiveTab(t.id as Tab); setSelectedAllergy(null); }}
                className={cn(
                  "w-full flex items-center gap-4 px-5 py-3.5 rounded-2xl transition-all font-medium",
                  activeTab === t.id 
                    ? "bg-beige-800 text-white shadow-lg shadow-beige-800/20" 
                    : "text-gray-500 hover:bg-beige-50 dark:hover:bg-white/5"
                )}
              >
                <t.icon className="w-5 h-5" />
                {t.label}
              </button>
            ))}

            <div className="pt-6 pb-2 px-5">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Sistem i Arhiva</p>
            </div>

            {[
              { id: 'galerija', icon: ImageIcon, label: 'Galerija Nalaza' },
              { id: 'historija', icon: History, label: 'Historija Chata' }
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => { setActiveTab(t.id as Tab); setSelectedAllergy(null); }}
                className={cn(
                  "w-full flex items-center gap-4 px-5 py-3.5 rounded-2xl transition-all font-medium",
                  activeTab === t.id 
                    ? "bg-beige-800 text-white shadow-lg shadow-beige-800/20" 
                    : "text-gray-500 hover:bg-beige-50 dark:hover:bg-white/5"
                )}
              >
                <t.icon className="w-5 h-5" />
                {t.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-auto p-8 border-t border-[var(--border-color)] space-y-4">
          <div className="flex items-center gap-3 px-2">
            <img src={user.photoURL || ''} className="w-10 h-10 rounded-full border-2 border-beige-200" alt="" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">{user.displayName}</p>
              <button onClick={logout} className="text-[10px] text-red-500 font-bold uppercase tracking-wider hover:underline">Odjavi se</button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative">
        <audio ref={audioRef} loop crossOrigin="anonymous" />
        {/* Top Bar with Theme Toggle & Music */}
        <div className="absolute top-6 right-6 z-40 flex items-center gap-4">
          {/* Lofi Button (The Note) */}
          <button 
            onClick={() => {
              if (audioSource !== LOFI_SOURCE) {
                setAudioSource(LOFI_SOURCE);
                setIsMusicPlaying(true);
              } else {
                setIsMusicPlaying(!isMusicPlaying);
              }
            }}
            className="p-2 bg-[#5D4037] text-white rounded-full shadow-lg hover:bg-[#4E342E] transition-all"
            title="Toggle Lofi"
          >
            <Music className={cn("w-5 h-5", isMusicPlaying && audioSource === LOFI_SOURCE && "animate-pulse")} />
          </button>

          {/* Secret Button (The Cat) - REMOVED per user request, moved to Coffee Mug logo */}

          {/* Volume Slider */}
          <div className="flex items-center gap-2 bg-white/80 dark:bg-black/40 backdrop-blur-sm px-4 py-2 rounded-full border border-beige-200 shadow-sm">
            <Volume2 className="w-4 h-4 text-[#5D4037]" />
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.01" 
              value={musicVolume}
              onChange={(e) => setMusicVolume(parseFloat(e.target.value))}
              className="w-24 h-1 bg-beige-200 rounded-lg appearance-none cursor-pointer accent-[#5D4037]"
            />
          </div>

          <button 
            onClick={() => setDarkMode(!darkMode)}
            className="p-3 bg-white/80 dark:bg-black/40 backdrop-blur-sm rounded-full border border-beige-200 shadow-sm text-beige-800 dark:text-beige-200 hover:bg-beige-50 transition-all"
          >
            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>
        <div className="max-w-5xl mx-auto p-10">
          <AnimatePresence mode="wait">
            {activeTab === 'pocetna' && (
              <motion.div 
                key="home"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-10"
              >
                <div className="space-y-4">
                  <h2 className="text-4xl font-bold font-serif">Zdravo, {user.displayName?.split(' ')[0]}</h2>
                  <p className="text-gray-500 text-lg">Dobrodošli u vaš digitalni medicinski karton. Šta želite uraditi danas?</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <button 
                    onClick={() => setActiveTab('rodjenje')}
                    className="bg-white dark:bg-white/5 p-6 rounded-[2rem] border border-beige-200 hover:shadow-xl transition-all text-left group"
                  >
                    <div className="w-12 h-12 bg-red-50 dark:bg-red-900/20 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-red-600 group-hover:text-white transition-colors">
                      <Users className="w-6 h-6 text-red-600 group-hover:text-white" />
                    </div>
                    <h3 className="text-lg font-bold mb-1">Rođenje</h3>
                    <p className="text-xs text-gray-400 line-clamp-2">Porođaj, trauma ključne kosti i rani nalazi.</p>
                  </button>

                  <button 
                    onClick={() => setActiveTab('trombofilija')}
                    className="bg-white dark:bg-white/5 p-6 rounded-[2rem] border border-beige-200 hover:shadow-xl transition-all text-left group"
                  >
                    <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      <Database className="w-6 h-6 text-blue-600 group-hover:text-white" />
                    </div>
                    <h3 className="text-lg font-bold mb-1">Trombofilija</h3>
                    <p className="text-xs text-gray-400 line-clamp-2">VCI tromboza, kalcifikacije i terapija.</p>
                  </button>

                  <button 
                    onClick={() => setActiveTab('infekcije')}
                    className="bg-white dark:bg-white/5 p-6 rounded-[2rem] border border-beige-200 hover:shadow-xl transition-all text-left group"
                  >
                    <div className="w-12 h-12 bg-amber-50 dark:bg-amber-900/20 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                      <ShieldAlert className="w-6 h-6 text-amber-600 group-hover:text-white" />
                    </div>
                    <h3 className="text-lg font-bold mb-1">Infekcije</h3>
                    <p className="text-xs text-gray-400 line-clamp-2">MRSA, Staph aureus i veliki kašalj.</p>
                  </button>

                  <button 
                    onClick={() => setActiveTab('nefrologija')}
                    className="bg-white dark:bg-white/5 p-6 rounded-[2rem] border border-beige-200 hover:shadow-xl transition-all text-left group"
                  >
                    <div className="w-12 h-12 bg-purple-50 dark:bg-purple-900/20 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                      <Activity className="w-6 h-6 text-purple-600 group-hover:text-white" />
                    </div>
                    <h3 className="text-lg font-bold mb-1">Nefrologija</h3>
                    <p className="text-xs text-gray-400 line-clamp-2">Scintigrafija i funkcija bubrega.</p>
                  </button>

                  <button 
                    onClick={() => setActiveTab('laboratorija')}
                    className="bg-white dark:bg-white/5 p-6 rounded-[2rem] border border-beige-200 hover:shadow-xl transition-all text-left group"
                  >
                    <div className="w-12 h-12 bg-green-50 dark:bg-green-900/20 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-green-600 group-hover:text-white transition-colors">
                      <ClipboardList className="w-6 h-6 text-green-600 group-hover:text-white" />
                    </div>
                    <h3 className="text-lg font-bold mb-1">Laboratorija</h3>
                    <p className="text-xs text-gray-400 line-clamp-2">Hronološki pregled svih krvnih nalaza.</p>
                  </button>

                  <button 
                    onClick={() => setActiveTab('genetika')}
                    className="bg-white dark:bg-white/5 p-6 rounded-[2rem] border border-beige-200 hover:shadow-xl transition-all text-left group"
                  >
                    <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                      <SearchCode className="w-6 h-6 text-indigo-600 group-hover:text-white" />
                    </div>
                    <h3 className="text-lg font-bold mb-1">Genetika</h3>
                    <p className="text-xs text-gray-400 line-clamp-2">Kariotip 46,XY i MTHFR mutacije.</p>
                  </button>

                  <button 
                    onClick={() => setActiveTab('prepiska')}
                    className="bg-white dark:bg-white/5 p-6 rounded-[2rem] border border-beige-200 hover:shadow-xl transition-all text-left group"
                  >
                    <div className="w-12 h-12 bg-gray-50 dark:bg-gray-900/20 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-gray-600 group-hover:text-white transition-colors">
                      <MessageSquare className="w-6 h-6 text-gray-600 group-hover:text-white" />
                    </div>
                    <h3 className="text-lg font-bold mb-1">Prepiska</h3>
                    <p className="text-xs text-gray-400 line-clamp-2">Pisma roditelja i bankovna molba.</p>
                  </button>

                  <button 
                    onClick={() => setActiveTab('galerija')}
                    className="bg-white dark:bg-white/5 p-6 rounded-[2rem] border border-beige-200 hover:shadow-xl transition-all text-left group"
                  >
                    <div className="w-12 h-12 bg-pink-50 dark:bg-pink-900/20 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-pink-600 group-hover:text-white transition-colors">
                      <ImageIcon className="w-6 h-6 text-pink-600 group-hover:text-white" />
                    </div>
                    <h3 className="text-lg font-bold mb-1">Galerija</h3>
                    <p className="text-xs text-gray-400 line-clamp-2">Svi skenirani dokumenti i slike.</p>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-beige-800 text-white p-10 rounded-[3rem] shadow-2xl relative overflow-hidden flex-1 group">
                    <div className="relative z-10 space-y-6 max-w-md">
                      <div className="space-y-2">
                        <h3 className="text-3xl font-bold font-serif">Medicinski Rezime</h3>
                        <p className="opacity-80 leading-relaxed">
                          Vaš digitalni karton sadrži <strong>{processedDocs.length}</strong> analiziranih dokumenata. 
                          Svi podaci su sintetizovani iz vaših medicinskih fajlova.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <button 
                          onClick={() => setActiveTab('dijagnostika')}
                          className="px-6 py-3 bg-white text-beige-800 rounded-2xl font-bold hover:bg-beige-50 transition-all shadow-lg"
                        >
                          Svi nalazi
                        </button>
                        <button 
                          onClick={() => setActiveTab('pravna_borba')}
                          className="px-6 py-3 bg-beige-700 text-white border border-beige-600 rounded-2xl font-bold hover:bg-beige-600 transition-all"
                        >
                          Pravna borba
                        </button>
                      </div>
                    </div>
                    <Activity className="absolute -right-10 -bottom-10 w-64 h-64 opacity-10 rotate-12 group-hover:scale-110 transition-transform duration-700" />
                  </div>

                  <div className="bg-white dark:bg-white/5 p-10 rounded-[3rem] border border-beige-200 shadow-xl flex-1">
                    <h3 className="text-xl font-bold mb-6 flex items-center gap-3">
                      <ClipboardList className="w-5 h-5 text-beige-800" />
                      Zadnje aktivnosti
                    </h3>
                    <div className="space-y-4">
                      {processedDocs.slice(0, 3).map(doc => (
                        <div 
                          key={doc.id} 
                          onClick={() => setSelectedDoc(doc)}
                          className="flex items-center gap-4 p-3 rounded-2xl hover:bg-beige-50 dark:hover:bg-white/5 transition-all cursor-pointer group"
                        >
                          <div className="w-10 h-10 bg-beige-100 dark:bg-white/10 rounded-xl flex items-center justify-center group-hover:bg-beige-800 transition-colors">
                            <FileText className="w-5 h-5 text-beige-600 group-hover:text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold truncate">{doc.name}</p>
                            <p className="text-[10px] text-gray-400">Klikni za detalje</p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-gray-300" />
                        </div>
                      ))}
                      {processedDocs.length === 0 && (
                        <p className="text-sm text-gray-400 text-center py-4">Nema nedavnih aktivnosti.</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="max-w-3xl mx-auto">
                  <CatCafeGame 
                    isSecretUnlocked={isSecretUnlocked}
                    onScoreUpdate={(score) => {
                      if (score >= 1000 && !isSecretUnlocked) {
                        setIsSecretUnlocked(true);
                      }
                    }} 
                  />
                </div>
              </motion.div>
            )}

            {activeTab === 'rodjenje' && (
              <motion.div 
                key="rodjenje"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-10"
              >
                <div className="bg-white dark:bg-white/5 p-10 rounded-[3rem] border border-beige-200 shadow-xl">
                  <div className="prose prose-lg dark:prose-invert max-w-none">
                    <h1 className="text-4xl font-bold font-serif mb-8">Rođenje i Rana Trauma (03.04.2011)</h1>
                    <p className="text-xl leading-relaxed text-gray-600 dark:text-gray-300">
                      Emel Čuturić je rođen 03.04.2011. godine u 12:15h u porodilištu Jezero (KCU Sarajevo). 
                      Porođaj je bio prirodan, ali je bio praćen ozbiljnim komplikacijama i traumama koje su obilježile rani period života.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 my-10">
                      <div className="bg-beige-50 dark:bg-white/5 p-6 rounded-2xl border border-beige-100">
                        <h3 className="text-beige-800 font-bold mb-2">Ključni podaci:</h3>
                        <ul className="list-none p-0 space-y-2">
                          <li><strong>Težina:</strong> 3200g (PM 3360g u 10. danu)</li>
                          <li><strong>Dužina:</strong> 51cm</li>
                          <li><strong>Vrijeme:</strong> 12:15h</li>
                          <li><strong>Krvna grupa:</strong> A Rh D(-) neg (Majka), B Rh D(-) neg (Beba)</li>
                        </ul>
                      </div>
                      <div className="bg-red-50 dark:bg-red-900/10 p-6 rounded-2xl border border-red-100">
                        <h3 className="text-red-800 font-bold mb-2">Glavne dijagnoze:</h3>
                        <ul className="list-none p-0 space-y-2">
                          <li>Fractura claviculae dex (Prelom desne ključne kosti)</li>
                          <li>Paresis plexus brachialis dex (Oštećenje nerava desne ruke)</li>
                          <li>Hyperbilirubinaemia neonatorum (Novorođenačka žutica)</li>
                          <li>Pyodermia (Staphylodermia) - MRSA infekcija</li>
                        </ul>
                      </div>
                    </div>

                    <h2 className="text-2xl font-bold mt-10 mb-4">Medicinske komplikacije</h2>
                    <div className="space-y-6">
                      <div className="border-l-4 border-red-500 pl-6 py-2">
                        <h4 className="font-bold text-lg">Fractura claviculae lat. dex (Prelom desne ključne kosti)</h4>
                        <p>Prilikom porođaja došlo je do preloma desne ključne kosti. Nana je u pratnji navela oslabljenu pokretljivost desne ruke u prvim danima života. Rtg snimak torakalnih organa u AP poziciji potvrdio je frakturu.</p>
                      </div>
                      <div className="border-l-4 border-amber-500 pl-6 py-2">
                        <h4 className="font-bold text-lg">Paresis plexus brachialis dex</h4>
                        <p>Kao posljedica traume, došlo je do oštećenja nerava desne ruke. Ruka je bila nepomična i bolno je reagovala na dodir. Uočeno je spontano propuzavanje i prohodavanje uz kontrolu neurofizijatra (Dr. Sadjak Azijada).</p>
                      </div>
                      <div className="border-l-4 border-blue-500 pl-6 py-2">
                        <h4 className="font-bold text-lg">Produžena žutica (Icterus prolongatus)</h4>
                        <p>Zabilježena neonatalna hiperbilirubinemija. Ukupni bilirubin je iznosio 219.3 (direktni 15.9, indirektni 203.4) u 10. danu života. Kasnije (10.05.2011) bilirubin je bio 123.6.</p>
                      </div>
                      <div className="border-l-4 border-green-500 pl-6 py-2">
                        <h4 className="font-bold text-lg">MRSA i Stafilodermija</h4>
                        <p>U brisu pustule izolovana MRSA, pa E.coli, a u nosu Staphylococcus aureus. Dijagnostikovana Pyodermia (Staphylodermia). Provedena antistafilokokna toaleta kože (Hibibos, Plivasept, Bivacin prah).</p>
                      </div>
                    </div>

                    <div className="bg-amber-50 dark:bg-amber-900/10 p-8 rounded-3xl border border-amber-200 my-10">
                      <h3 className="text-amber-800 font-bold mb-4">Upute za toaletu kože (2011):</h3>
                      <ul className="space-y-2 text-sm">
                        <li>• Mehanički skinuti pojedinačne pustule.</li>
                        <li>• Okupati dijete sa šamponom.</li>
                        <li>• Rastvor Hibibosa G (10ml na 1L vode) posuti po koži.</li>
                        <li>• Posušene pustule posuti Bivacinom (prah).</li>
                        <li>• Promijeniti posteljinu nakon kupanja.</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'trombofilija' && (
              <motion.div 
                key="trombofilija"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-10"
              >
                <div className="bg-white dark:bg-white/5 p-10 rounded-[3rem] border border-beige-200 shadow-xl">
                  <div className="prose prose-lg dark:prose-invert max-w-none">
                    <h1 className="text-4xl font-bold font-serif mb-8">Trombofilija i Venska Tromboza</h1>
                    <p className="text-xl leading-relaxed text-gray-600 dark:text-gray-300">
                      Jedno od najkompleksnijih stanja je reaktivna trombofilija sa razvojem venske tromboze u ranoj dobi.
                    </p>

                    <div className="bg-red-800 text-white p-8 rounded-3xl my-10">
                      <h3 className="text-white font-bold mb-4">Genetski Profil (INGEB):</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <p className="text-sm opacity-80 uppercase font-bold">MTHFR Polimorfizam</p>
                          <p className="text-2xl font-bold">Heterozigot (677CT)</p>
                          <p className="text-xs opacity-70 mt-1">Rizik od VTE je 2-4 puta viši nego kod normalnog genotipa.</p>
                        </div>
                        <div>
                          <p className="text-sm opacity-80 uppercase font-bold">F5 Leiden / F2</p>
                          <p className="text-2xl font-bold">Wildtype (1691GG / 2021GG)</p>
                          <p className="text-xs opacity-70 mt-1">Ne povećava rizik od tromboze.</p>
                        </div>
                      </div>
                    </div>

                    <h2 className="text-2xl font-bold mt-10 mb-4">Hronična Venska Tromboza (VCI)</h2>
                    <p>Incidentno pronađena tromboza segmentalnog dijela donje šuplje vene (VCI) između jetre i renalnih vena.</p>
                    <ul className="space-y-2">
                      <li><strong>Vena cava inferior (VCI):</strong> Okludirana materijalom sa jakom primjesom kalcifikata.</li>
                      <li><strong>Vena renalis lat. dex:</strong> Kalcifikacija u desnoj renalnoj veni (14.05.2012).</li>
                      <li><strong>Vena iliaca interna lat. sin:</strong> Kalcifikacija u unutrašnjoj ilijačnoj veni.</li>
                    </ul>

                    <div className="bg-beige-50 dark:bg-white/5 p-8 rounded-3xl border border-beige-200 my-10">
                      <h3 className="font-bold mb-4">Evolucija Kalcifikata (UZ & CT):</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-4 bg-white dark:bg-white/10 rounded-xl shadow-sm">
                          <p className="text-xs font-bold text-gray-400">20.05.2011 (CT)</p>
                          <p className="text-lg font-bold">27 x 11 mm</p>
                        </div>
                        <div className="p-4 bg-white dark:bg-white/10 rounded-xl shadow-sm">
                          <p className="text-xs font-bold text-gray-400">17.06.2011 (UZ)</p>
                          <p className="text-lg font-bold">19 x 7 mm</p>
                        </div>
                        <div className="p-4 bg-white dark:bg-white/10 rounded-xl shadow-sm">
                          <p className="text-xs font-bold text-gray-400">14.05.2012 (UZ)</p>
                          <p className="text-lg font-bold">18 x 7 mm</p>
                        </div>
                      </div>
                      <p className="mt-4 text-sm italic">Krvotok je uspostavljen alternativnim putevima (v. azygos, v. hemiazygos i ascendentne lumbalne vene).</p>
                    </div>

                    <h2 className="text-2xl font-bold mt-10 mb-4">Hemostatski nalazi (11.07.2011)</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="p-6 bg-red-50 dark:bg-red-900/10 rounded-2xl border border-red-100">
                        <h4 className="font-bold text-red-800">Sniženi parametri:</h4>
                        <ul className="text-sm space-y-1">
                          <li>Protein C aktivnost: **0.22** (Ref: 0.64-1.28)</li>
                          <li>Antitrombin III: **0.64** (Ref: 0.70-1.26)</li>
                        </ul>
                      </div>
                      <div className="p-6 bg-green-50 dark:bg-green-900/10 rounded-2xl border border-green-100">
                        <h4 className="font-bold text-green-800">Uredni parametri:</h4>
                        <p className="text-sm">Protein S, Fibrinogen (1.79 g/L), PT (0.99), INR (1.01).</p>
                      </div>
                    </div>

                    <h2 className="text-2xl font-bold mt-10 mb-4">Terapija</h2>
                    <p>Dugotrajna terapija niskomolekularnim heparinom (**Clivarin**). Preporuka vaskularnog hirurga (Prof. Dr. Solaković) je nastavak tretmana bez indikacija za hirurški zahvat.</p>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'infekcije' && (
              <motion.div 
                key="infekcije"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-10"
              >
                <div className="bg-white dark:bg-white/5 p-10 rounded-[3rem] border border-beige-200 shadow-xl">
                  <div className="prose prose-lg dark:prose-invert max-w-none">
                    <h1 className="text-4xl font-bold font-serif mb-8">Infekcije i Virusologija</h1>
                    
                    <div className="space-y-12">
                      <section>
                        <h2 className="text-2xl font-bold text-amber-700 mb-4">MRSA (Bolnička infekcija)</h2>
                        <p>Neposredno nakon rođenja (07.04.2011), kod Emela je potvrđena infekcija **MRSA (Methicillin-resistant Staphylococcus aureus)**. Bakterija je izolovana iz pustula na koži. Dijagnostikovana je i **Pyodermia (Staphylodermia)**.</p>
                        <div className="bg-amber-50 dark:bg-amber-900/10 p-6 rounded-2xl border border-amber-100 mt-4">
                          <p className="text-sm font-bold text-amber-800">Mikrobiološki nalaz (287595):</p>
                          <p className="italic">"MRSA pozitivan u brisu pustule. Rezistentan na većinu standardnih antibiotika."</p>
                        </div>
                      </section>

                      <section>
                        <h2 className="text-2xl font-bold text-blue-700 mb-4">Pertusis (Veliki kašalj)</h2>
                        <p>U avgustu 2017. godine, Emel je dijagnostikovan sa **Pertusisom**. Serološki nalaz na Bordetella pertussis je bio pozitivan u obje frakcije.</p>
                        <div className="bg-blue-50 dark:bg-blue-900/10 p-6 rounded-2xl border border-blue-100 mt-4">
                          <p className="text-sm font-bold text-blue-800">Terapija:</p>
                          <p>Provedena terapija Sumamedom. Klinička slika je uključivala intenzivan kašalj i povraćanje.</p>
                        </div>
                      </section>

                      <section>
                        <h2 className="text-2xl font-bold text-purple-700 mb-4">Virusološka Serologija</h2>
                        <p>Tokom 2017. godine rađena je opsežna serološka obrada na viruse (TORCH panel i EBV).</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                          <div className="p-6 bg-purple-50 dark:bg-purple-900/10 rounded-2xl border border-purple-100">
                            <h4 className="font-bold mb-2">Epstein-Barr Virus (EBV)</h4>
                            <p className="text-sm">EBNA IgG: **POZITIVAN**</p>
                            <p className="text-sm">VCA IgG: **POZITIVAN**</p>
                            <p className="text-xs text-gray-500 mt-2">Ukazuje na preležanu infekciju (10.03.2017).</p>
                          </div>
                          <div className="p-6 bg-purple-50 dark:bg-purple-900/10 rounded-2xl border border-purple-100">
                            <h4 className="font-bold mb-2">Cytomegalovirus (CMV)</h4>
                            <p className="text-sm">CMV IgG: **REAKTIVAN** (24.03.2017)</p>
                            <p className="text-sm">CMV IgM: **NONREACTIVE**</p>
                          </div>
                          <div className="p-6 bg-purple-50 dark:bg-purple-900/10 rounded-2xl border border-purple-100">
                            <h4 className="font-bold mb-2">Herpes Simplex (HSV)</h4>
                            <p className="text-sm">HSV I i II IgG: **REAKTIVAN** (24.03.2017)</p>
                          </div>
                          <div className="p-6 bg-purple-50 dark:bg-purple-900/10 rounded-2xl border border-purple-100">
                            <h4 className="font-bold mb-2">Rubella</h4>
                            <p className="text-sm">Rubella IgG: **NONREACTIVE** (24.03.2017)</p>
                            <p className="text-sm text-xs text-red-500 mt-2">Napomena: Za ELISA test na Rubella IgG nije bilo reagensa (15.03.2017).</p>
                          </div>
                        </div>
                      </section>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'nefrologija' && (
              <motion.div 
                key="nefrologija"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-10"
              >
                <div className="bg-white dark:bg-white/5 p-10 rounded-[3rem] border border-beige-200 shadow-xl">
                  <div className="prose prose-lg dark:prose-invert max-w-none">
                    <h1 className="text-4xl font-bold font-serif mb-8">Nefrologija i Bubrezi</h1>
                    
                    <section className="mb-12">
                      <h2 className="text-2xl font-bold text-purple-700 mb-4">Dinamička scintigrafija (17.06.2011)</h2>
                      <p>Urađena je dinamička scintigrafija bubrega sa **Tc-DTPA** radi procjene funkcije i drenaže.</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 my-6">
                        <div className="p-6 bg-purple-50 dark:bg-purple-900/10 rounded-2xl border border-purple-100">
                          <h4 className="font-bold">Lijevi bubreg:</h4>
                          <p className="text-3xl font-bold text-purple-800">56.4%</p>
                          <p className="text-sm mt-2">Znaci dilatacije kanalnog sistema. Moguća slaba hidriranost pacijenta.</p>
                        </div>
                        <div className="p-6 bg-purple-50 dark:bg-purple-900/10 rounded-2xl border border-purple-100">
                          <h4 className="font-bold">Desni bubreg:</h4>
                          <p className="text-3xl font-bold text-purple-800">43.6%</p>
                          <p className="text-sm mt-2">Uredan tranzit radiofarmaka bez znakova dilatacije i opstrukcije.</p>
                        </div>
                      </div>
                    </section>

                    <section className="mb-12">
                      <h2 className="text-2xl font-bold mb-4">Ultrazvučni nalazi (EHO)</h2>
                      <div className="space-y-4">
                        <div className="p-6 bg-white dark:bg-white/5 rounded-2xl border border-beige-100">
                          <h4 className="font-bold">14.05.2012:</h4>
                          <p className="text-sm">Oba bubrega primjerenog položaja, oblika i veličine. Desni: 70mm, Lijevi: 67mm.</p>
                        </div>
                        <div className="p-6 bg-white dark:bg-white/5 rounded-2xl border border-beige-100">
                          <h4 className="font-bold">22.07.2016:</h4>
                          <p className="text-sm">Oba bubrega primjerenog smještaja, veličine i širine parenhima. Uredni kanalni sistemi.</p>
                        </div>
                      </div>
                    </section>

                    <section>
                      <h2 className="text-2xl font-bold mb-4">Laboratorijski nadzor</h2>
                      <p>Preporučene redovne kontrole u nefrološkom savjetovalištu:</p>
                      <ul className="list-disc pl-6 space-y-2">
                        <li>Kontrola uree, kreatinina i statusa elektrolita.</li>
                        <li>ABS (Acidobazni status).</li>
                        <li>Serija urina i urinokultura (izolovana Proteus mirabilis 10^5 u 2012).</li>
                      </ul>
                    </section>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'laboratorija' && (
              <motion.div 
                key="laboratorija"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-10"
              >
                <div className="bg-white dark:bg-white/5 p-10 rounded-[3rem] border border-beige-200 shadow-xl">
                  <div className="prose prose-lg dark:prose-invert max-w-none">
                    <h1 className="text-4xl font-bold font-serif mb-8">Laboratorijski Nalazi (2011 - 2021)</h1>
                    
                    <div className="space-y-8">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                          <thead className="bg-beige-50 dark:bg-white/5 text-beige-800">
                            <tr>
                              <th className="p-4 rounded-tl-xl">Parametar</th>
                              <th className="p-4">2011</th>
                              <th className="p-4">2012</th>
                              <th className="p-4">2017</th>
                              <th className="p-4">2019</th>
                              <th className="p-4 rounded-tr-xl">2021</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-beige-100">
                            <tr>
                              <td className="p-4 font-bold">Leukociti (WBC)</td>
                              <td className="p-4">6.14</td>
                              <td className="p-4">8.9</td>
                              <td className="p-4">9.4</td>
                              <td className="p-4">9.72</td>
                              <td className="p-4">5.3</td>
                            </tr>
                            <tr>
                              <td className="p-4 font-bold">Eritrociti (RBC)</td>
                              <td className="p-4">3.12</td>
                              <td className="p-4">4.8</td>
                              <td className="p-4">4.92</td>
                              <td className="p-4">4.92</td>
                              <td className="p-4">4.52</td>
                            </tr>
                            <tr>
                              <td className="p-4 font-bold">Hemoglobin (HGB)</td>
                              <td className="p-4">8.43</td>
                              <td className="p-4">130</td>
                              <td className="p-4">13.2</td>
                              <td className="p-4">13.7</td>
                              <td className="p-4">12.8</td>
                            </tr>
                            <tr>
                              <td className="p-4 font-bold">Trombociti (PLT)</td>
                              <td className="p-4">384</td>
                              <td className="p-4">413</td>
                              <td className="p-4">348</td>
                              <td className="p-4">319</td>
                              <td className="p-4">331</td>
                            </tr>
                            <tr>
                              <td className="p-4 font-bold">CRP</td>
                              <td className="p-4">0.23</td>
                              <td className="p-4">10.6</td>
                              <td className="p-4">1.0</td>
                              <td className="p-4">-</td>
                              <td className="p-4">-</td>
                            </tr>
                            <tr>
                              <td className="p-4 font-bold">INR</td>
                              <td className="p-4">1.01</td>
                              <td className="p-4">1.24</td>
                              <td className="p-4">1.16</td>
                              <td className="p-4">0.99</td>
                              <td className="p-4">1.27</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                        <div className="p-6 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-100">
                          <h4 className="font-bold text-amber-800">Biohemija (2019):</h4>
                          <ul className="text-sm space-y-1">
                            <li>Glukoza: **3.82 LO** (Ref: 3.90-6.20)</li>
                            <li>Urea: 3.9</li>
                            <li>Kreatinin: **15 LO** (Ref: 58-110)</li>
                            <li>Zeljezo: 17.8</li>
                          </ul>
                        </div>
                        <div className="p-6 bg-blue-50 dark:bg-blue-900/10 rounded-2xl border border-blue-100">
                          <h4 className="font-bold text-blue-800">Koagulacija (2021):</h4>
                          <ul className="text-sm space-y-1">
                            <li>APTT: 31.90 sec</li>
                            <li>Fibrinogen: 1.6 g/l</li>
                            <li>D-Dimer: 390 µg/l</li>
                            <li>Trombinsko vrijeme: 20.4 sec</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'genetika' && (
              <motion.div 
                key="genetika"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-10"
              >
                <div className="bg-white dark:bg-white/5 p-10 rounded-[3rem] border border-beige-200 shadow-xl">
                  <div className="prose prose-lg dark:prose-invert max-w-none">
                    <h1 className="text-4xl font-bold font-serif mb-8">Genetika i Kariotip</h1>
                    
                    <section className="mb-12">
                      <h2 className="text-2xl font-bold text-indigo-700 mb-4">Citogenetski nalaz (05.03.2014)</h2>
                      <div className="p-8 bg-indigo-50 dark:bg-indigo-900/10 rounded-3xl border border-indigo-100">
                        <p className="text-sm uppercase font-bold text-indigo-600 mb-2">Rezultat:</p>
                        <p className="text-5xl font-bold text-indigo-800">46,XY</p>
                        <p className="text-xl font-bold mt-4">Normalan muški kariotip</p>
                        <p className="text-sm mt-4 text-gray-500 italic">Analiza urađena na uzorku periferne krvi (20 mitoza, rezolucija 300).</p>
                      </div>
                    </section>

                    <section>
                      <h2 className="text-2xl font-bold text-red-700 mb-4">Molekularna dijagnostika (MTHFR)</h2>
                      <div className="p-8 bg-red-50 dark:bg-red-900/10 rounded-3xl border border-red-100">
                        <h4 className="font-bold mb-4">MTHFR Polimorfizam (667CT):</h4>
                        <p className="text-lg font-bold text-red-800">HETEROZIGOT</p>
                        <p className="mt-4">Ovaj genotip povećava rizik od razvoja tromboze vena **2-4 puta** u odnosu na normalni wildtype genotip (667CC).</p>
                        <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
                          <div className="p-4 bg-white dark:bg-white/5 rounded-xl">
                            <p className="font-bold">F5 Leiden:</p>
                            <p>Normalan genotip (homozigot)</p>
                          </div>
                          <div className="p-4 bg-white dark:bg-white/5 rounded-xl">
                            <p className="font-bold">F2 (Protrombin):</p>
                            <p>Normalan genotip (homozigot)</p>
                          </div>
                        </div>
                      </div>
                    </section>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'prepiska' && (
              <motion.div 
                key="prepiska"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-10"
              >
                <div className="bg-white dark:bg-white/5 p-10 rounded-[3rem] border border-beige-200 shadow-xl">
                  <div className="prose prose-lg dark:prose-invert max-w-none">
                    <h1 className="text-4xl font-bold font-serif mb-8">Dokumentacija i Prepiska</h1>
                    
                    <div className="space-y-12">
                      <section>
                        <h2 className="text-2xl font-bold mb-4">Upit o vakcinaciji</h2>
                        <div className="p-8 bg-gray-50 dark:bg-white/5 rounded-3xl border border-gray-200 italic">
                          <p>"Želim da mi pismeno odgovorite da li zbog gore navedenog moje dijete smije primiti ostali set vakcina koje ga sljeduju, koje vakcine, do kada da primi te iste vakcine, i šta dalje u nastavku njegovog života s vakcinama?"</p>
                          <p className="mt-4 font-bold not-italic">— Karić Suada & Čuturić Nermin</p>
                        </div>
                      </section>

                      <section>
                        <h2 className="text-2xl font-bold mb-4">Molba banci (28.10.2020)</h2>
                        <div className="p-8 bg-gray-50 dark:bg-white/5 rounded-3xl border border-gray-200">
                          <p className="font-bold mb-2">Predmet: MOLBA</p>
                          <p>Molba Intesa Sanpaolo Banci za informaciju o statusu izvršenja (broj: 650 i 687 614 18 i). Upit o realizaciji uplate glavnog duga i zateznih kamata po presudi Kantonalnog suda (65 0 RS 383867 15 Rsž).</p>
                        </div>
                      </section>

                      <section>
                        <h2 className="text-2xl font-bold mb-4">Pravna napomena</h2>
                        <div className="p-6 bg-red-50 dark:bg-red-900/10 rounded-2xl border border-red-100 text-red-800 font-bold">
                          <p>"Još jednom napominjem da mi namjera nije tužba."</p>
                        </div>
                      </section>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
            {activeTab === 'alergologija' && (
              <motion.div 
                key="alergologija"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-10"
              >
                <div className="bg-white dark:bg-white/5 p-10 rounded-[3rem] border border-beige-200 shadow-xl">
                  <div className="prose prose-lg dark:prose-invert max-w-none">
                    <h1 className="text-4xl font-bold font-serif mb-8">Alergološki Profil</h1>
                    <p className="text-xl text-gray-600 dark:text-gray-300">
                      Sveobuhvatna analiza alergija obuhvata kožne testove, serološke analize (IgE) i Western Blot metodu.
                    </p>

                    <div className="space-y-12 my-10">
                      <section>
                        <h2 className="text-2xl font-bold mb-6">Inhalatorni Alergeni (Western Blot)</h2>
                        <div className="bg-beige-50 dark:bg-white/5 p-8 rounded-3xl border border-beige-200">
                          <p className="text-sm text-gray-500 mb-4">Nalaz od 10.03.2017:</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {[
                              'Trava (g6)', 'Kultivirana raž (g12)', 'Crna joha (t2)', 'Bijela breza (t3)',
                              'Lijeska (t4)', 'Mugwort pelin (w6)', 'Maslačak (w8)', 'Bokvica (w9)',
                              'Der.pteronyssinus (d1)', 'Der. farinae (d2)', 'Mačka (e1)', 'Pas (e2)',
                              'Konj (e3)', 'Zamorac (e6)', 'Zec (e82)', 'Hrčak (e84)',
                              'Penicilium notatum (m1)', 'Cladosporimu her. (m2)', 'Aspergilus fum. (m3)', 'Altenaria alt. (m6)'
                            ].map(item => (
                              <div key={item} className="flex justify-between items-center border-b border-beige-100 py-2">
                                <span className="text-sm">{item}</span>
                                <span className="text-xs font-bold text-green-600">NEGATIVAN (0)</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </section>

                      <section>
                        <h2 className="text-2xl font-bold mb-6">Nutritivni Alergeni (Euroline Food 1)</h2>
                        <div className="bg-beige-50 dark:bg-white/5 p-8 rounded-3xl border border-beige-200">
                          <p className="text-sm text-gray-500 mb-4">Nalaz od 07.01.2020:</p>
                          <div className="space-y-4">
                            <div className="flex justify-between items-center p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200">
                              <span className="font-bold">Shellfish mix 1 (fs10)</span>
                              <span className="font-bold text-amber-700">KLASA 1 (0.35 kU/l)</span>
                            </div>
                            <p className="text-xs text-gray-400 italic">Svi ostali nutritivni alergeni (jaje, mlijeko, kikiriki, soja, pšenica, lješnjak, itd.) su bili negativni (&lt; 0.35 kU/l).</p>
                          </div>
                        </div>
                      </section>

                      <section>
                        <h2 className="text-2xl font-bold mb-6">Skin Prick Test (Kožni testovi)</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div className="p-8 bg-white dark:bg-white/5 rounded-3xl border border-beige-200 shadow-sm">
                            <h4 className="font-bold mb-4">Test 03.03.2014:</h4>
                            <ul className="space-y-2 text-sm">
                              <li className="flex justify-between"><span>Histamin (Kontrola)</span> <span className="font-bold">4/4 mm</span></li>
                              <li className="flex justify-between"><span>Kućna prašina</span> <span className="text-green-600">0 mm</span></li>
                              <li className="flex justify-between"><span>Polen stabla</span> <span className="text-green-600">0 mm</span></li>
                              <li className="flex justify-between"><span>Duhan</span> <span className="text-green-600">0 mm</span></li>
                            </ul>
                          </div>
                          <div className="p-8 bg-white dark:bg-white/5 rounded-3xl border border-beige-200 shadow-sm">
                            <h4 className="font-bold mb-4">Test 23.01.2020:</h4>
                            <ul className="space-y-2 text-sm">
                              <li className="flex justify-between"><span>Histamin (Kontrola)</span> <span className="font-bold">6 mm</span></li>
                              <li className="flex justify-between"><span>Nutritivni mix</span> <span className="text-green-600">NEGATIVAN</span></li>
                              <li className="flex justify-between"><span>Inhalatorni mix</span> <span className="text-green-600">NEGATIVAN</span></li>
                            </ul>
                          </div>
                        </div>
                      </section>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'dijagnostika' && (
              <motion.div 
                key="dijagnostika"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-10"
              >
                <div className="bg-white dark:bg-white/5 p-10 rounded-[3rem] border border-beige-200 shadow-xl">
                  <div className="prose prose-lg dark:prose-invert max-w-none">
                    <h1 className="text-4xl font-bold font-serif mb-8">Laboratorija i Dijagnostika</h1>
                    
                    <div className="space-y-10">
                      <section>
                        <h2 className="text-2xl font-bold mb-4">Radiološki nalazi (CT & MR Angiografija)</h2>
                        <p>Višestruki CT i MR pregledi abdomena fokusirani na vaskularni sistem i jetru.</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="bg-blue-50 dark:bg-blue-900/10 p-6 rounded-2xl border border-blue-100">
                            <h4 className="font-bold">CT Angiografija (20.05.2011):</h4>
                            <p className="text-sm">Potvrđena tromboza VCI sa kalcifikatom dimenzija 27x11 mm. Jetra i slezena uredne veličine.</p>
                          </div>
                          <div className="bg-blue-50 dark:bg-blue-900/10 p-6 rounded-2xl border border-blue-100">
                            <h4 className="font-bold">MR Angiografija (18.07.2012):</h4>
                            <p className="text-sm">Pregled rađen na aparatu Avanto 1.5 Tesla. Potvrđena hronična tromboza VCI sa izraženom kolateralnom cirkulacijom (v. azygos i hemiazygos).</p>
                          </div>
                        </div>
                      </section>

                      <section>
                        <h2 className="text-2xl font-bold mb-4">Nuklearna medicina</h2>
                        <div className="bg-purple-50 dark:bg-purple-900/10 p-6 rounded-2xl border border-purple-100">
                          <h4 className="font-bold">Dinamska scintigrafija bubrega (17.06.2011):</h4>
                          <p className="text-sm mb-4">Urađena bazalna dinamska studija bubrega (Tc-99m-DTPA).</p>
                          <ul className="text-sm space-y-2">
                            <li><strong>Lijevi bubreg:</strong> Pokazuje znake dilatacije (moguća slaba hidriranost). Udio u funkciji: **56.4%**.</li>
                            <li><strong>Desni bubreg:</strong> Bez znakova dilatacije i opstrukcije. Udio u funkciji: **43.6%**.</li>
                          </ul>
                        </div>
                      </section>

                      <section>
                        <h2 className="text-2xl font-bold mb-4">Laboratorijski Nalazi</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="bg-green-50 dark:bg-green-900/10 p-6 rounded-2xl border border-green-100">
                            <h4 className="font-bold">Hematologija (03.10.2017):</h4>
                            <ul className="text-sm space-y-1">
                              <li>WBC: 8.50</li>
                              <li>RBC: 5.04</li>
                              <li>HGB: 134</li>
                              <li>PLT: **424** (Visoko)</li>
                            </ul>
                          </div>
                          <div className="bg-green-50 dark:bg-green-900/10 p-6 rounded-2xl border border-green-100">
                            <h4 className="font-bold">Biohemija:</h4>
                            <p className="text-sm">Total HCY2 (Homocistein): **5.34 umol/L** (Nisko).</p>
                            <p className="text-sm">Protein C i S: Uredne vrijednosti za dječiju dob.</p>
                          </div>
                        </div>
                      </section>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'pravna_borba' && (
              <motion.div 
                key="pravna_borba"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-10"
              >
                <div className="bg-white dark:bg-white/5 p-10 rounded-[3rem] border border-beige-200 shadow-xl">
                  <div className="prose prose-lg dark:prose-invert max-w-none">
                    <h1 className="text-4xl font-bold font-serif mb-8">Pravna Borba i Žalbe</h1>
                    <p className="text-xl text-gray-600 dark:text-gray-300">
                      Roditelji Emela Čuturića su godinama vodili pravnu borbu protiv zdravstvenih institucija zbog propusta prilikom porođaja i liječenja.
                    </p>

                    <div className="space-y-8 my-10">
                      <div className="p-8 bg-red-50 dark:bg-red-900/10 rounded-3xl border border-red-200">
                        <h3 className="text-red-800 font-bold text-xl mb-4">Glavne optužbe:</h3>
                        <ul className="space-y-4">
                          <li><strong>Zataškavanje traume:</strong> Prelom ključne kosti i pareza ruke nisu odmah uneseni u zvaničnu dokumentaciju.</li>
                          <li><strong>Bolnička infekcija:</strong> Dijete je zaraženo MRSA bakterijom u prvim danima života, što je dovelo do Pyodermije.</li>
                          <li><strong>Nestručan porođaj:</strong> Optužbe za nestručno vođenje porođaja koje je dovelo do fizičkih povreda djeteta i fenomena "ping pong loptice".</li>
                        </ul>
                      </div>

                      <div className="p-8 bg-beige-50 dark:bg-white/5 rounded-3xl border border-beige-200">
                        <h3 className="font-bold text-xl mb-4">Mišljenje eksperta (Dr. Robert Loncar, Njemačka):</h3>
                        <p className="italic text-sm mb-4">"Na osnovu onoga što je navedeno u dokumentaciji, Protein C, Protein S i Antithrombin imaju vrijednosti koje odgovaraju dječijoj dobi, a ne odraslima, što je dovelo do pogrešnog tumačenja rezultata..."</p>
                        <p className="text-sm">Dr. Loncar je istakao da je ključno pitanje da li je dijete zaista imalo trombozu ili ne, te da li je terapija antikoagulansima bila neophodna u tom obimu.</p>
                      </div>

                      <div className="p-8 bg-white dark:bg-white/5 rounded-3xl border border-beige-200 shadow-sm">
                        <h3 className="font-bold text-xl mb-4">Pismo roditelja:</h3>
                        <p className="text-sm leading-relaxed text-gray-600 italic">
                          "Noćna mora i agonija se produžavaju i idu u nedogled... Zašto dijete od poroda ima modrice na repu stražnjice? Zašto bebe sa MRSA-om nisu usmjerene na infektivnu kliniku? Zašto je moja beba morala na ultrazvuk privatno? Zašto nije nigdje upisano da modri oko usta?"
                        </p>
                        <p className="text-xs text-gray-400 mt-4">— Izvod iz pisma roditelja upućenog nadležnim institucijama.</p>
                      </div>

                      <div className="p-8 bg-beige-50 dark:bg-white/5 rounded-3xl border border-beige-200">
                        <h3 className="font-bold text-xl mb-4">Ključni dokumenti:</h3>
                        <ul className="space-y-2">
                          <li>Žalba Kantonalnoj zdravstvenoj inspekciji (04.10.2011).</li>
                          <li>Molba Kantonalnoj komisiji za vakcinaciju zbog specifičnosti bolesti.</li>
                          <li>Izjava Suade Karić o toku porođaja i propustima osoblja.</li>
                          <li>Prepiska sa klinikom u Njemačkoj (Dr. Robert Loncar).</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
            {activeTab === 'galerija' && (
              <motion.div 
                key="galerija"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-10"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-3xl font-bold font-serif">Galerija Nalaza</h2>
                  <p className="text-sm text-gray-500">{files.filter(f => f.mimeType.startsWith('image/')).length + localImages.length} slika pronađeno</p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {/* Local Icons with Links */}
                  {localImages.map((img) => (
                    <motion.div 
                      key={img.id}
                      whileHover={{ scale: 1.02 }}
                      onClick={() => window.open(img.url, '_blank')}
                      className="group cursor-pointer bg-white dark:bg-white/5 rounded-3xl border border-beige-200 overflow-hidden shadow-sm hover:shadow-xl transition-all"
                    >
                      <div className="aspect-[3/4] relative flex items-center justify-center bg-beige-50 dark:bg-white/5">
                        {img.icon === 'cookie' ? (
                          <div className="relative">
                            <div className="w-16 h-16 bg-[#A1887F] rounded-full flex items-center justify-center shadow-lg">
                              <div className="grid grid-cols-2 gap-1">
                                <div className="w-1.5 h-1.5 bg-[#5D4037] rounded-full" />
                                <div className="w-1.5 h-1.5 bg-[#5D4037] rounded-full" />
                                <div className="w-1.5 h-1.5 bg-[#5D4037] rounded-full" />
                                <div className="w-1.5 h-1.5 bg-[#5D4037] rounded-full" />
                              </div>
                            </div>
                          </div>
                        ) : img.icon === 'coffee' ? (
                          <Coffee className="w-16 h-16 text-[#A1887F] transition-colors" />
                        ) : (
                          <Cat className="w-16 h-16 text-[#A1887F] transition-colors" />
                        )}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <FileText className="w-8 h-8 text-white" />
                        </div>
                      </div>
                      <div className="p-4 bg-white dark:bg-white/5 border-t border-beige-100">
                        <p className="text-xs font-bold truncate text-gray-700 dark:text-gray-300">{img.name}</p>
                      </div>
                    </motion.div>
                  ))}

                  {/* Drive Images */}
                  {files.filter(f => f.mimeType.startsWith('image/')).map((file) => (
                    <motion.div 
                      key={file.id}
                      whileHover={{ scale: 1.02 }}
                      onClick={() => setSelectedFile(file)}
                      className="group cursor-pointer bg-white dark:bg-white/5 rounded-3xl border border-beige-200 overflow-hidden shadow-sm hover:shadow-xl transition-all"
                    >
                      <div className="aspect-[3/4] relative">
                        <img 
                          src={file.thumbnailLink?.replace('=s220', '=s600')} 
                          className="w-full h-full object-cover"
                          alt={file.name}
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <ImageIcon className="w-8 h-8 text-white" />
                        </div>
                      </div>
                      <div className="p-4 bg-white dark:bg-white/5 border-t border-beige-100">
                        <p className="text-xs font-bold truncate text-gray-700 dark:text-gray-300">{file.name}</p>
                      </div>
                    </motion.div>
                  ))}
                  {files.filter(f => f.mimeType.startsWith('image/')).length === 0 && localImages.length === 0 && (
                    <div className="col-span-full py-20 text-center bg-white dark:bg-white/5 rounded-[3rem] border border-dashed border-beige-300">
                      <ImageIcon className="w-16 h-16 text-beige-200 mx-auto mb-4" />
                      <p className="text-beige-600 font-medium">Nema slika u arhivi.</p>
                      <button onClick={connectDrive} className="mt-4 text-sm font-bold text-beige-800 underline">Poveži se ponovo</button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'historija' && (
              <motion.div 
                key="history"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-3xl font-bold font-serif">Historija Razgovora</h2>
                  <button 
                    onClick={clearHistory}
                    className="flex items-center gap-2 px-4 py-2 text-red-500 font-bold hover:bg-red-50 rounded-xl transition-all"
                  >
                    <Trash2 className="w-4 h-4" /> Obriši sve
                  </button>
                </div>
                <div className="bg-white dark:bg-white/5 rounded-[2.5rem] border border-beige-200 overflow-hidden">
                  <div className="p-8 space-y-6 max-h-[600px] overflow-y-auto">
                    {chatMessages.map((msg) => (
                      <div 
                        key={msg.id}
                        className={cn(
                          "flex flex-col max-w-[80%] group",
                          msg.role === 'user' ? "ml-auto items-end" : "items-start"
                        )}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          {msg.role === 'user' && (
                            <button onClick={() => deleteMessage(msg.id)} className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-red-500 transition-all">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                          <span className="text-[10px] text-gray-400">
                            {msg.timestamp?.toDate().toLocaleString('bs')}
                          </span>
                          {msg.role === 'model' && (
                            <button onClick={() => deleteMessage(msg.id)} className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-red-500 transition-all">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        <div className={cn(
                          "p-5 rounded-3xl text-sm leading-relaxed shadow-sm",
                          msg.role === 'user' 
                            ? "bg-beige-800 text-white rounded-tr-none" 
                            : "bg-beige-50 dark:bg-white/10 text-[var(--text-main)] rounded-tl-none border border-beige-200"
                        )}>
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      </div>
                    ))}
                    {chatMessages.length === 0 && (
                      <div className="text-center py-20">
                        <MessageSquare className="w-16 h-16 text-beige-200 mx-auto mb-4" />
                        <p className="text-beige-600 font-medium">Još uvijek nemate historiju razgovora.</p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Cat Paw AI Trigger */}
        <div className="fixed top-1/2 -translate-y-1/2 right-0 z-50">
          <motion.button
            whileHover="hover"
            variants={{
              hover: { x: 420 }
            }}
            initial={{ x: 500 }}
            animate={{ x: 440 }}
            onClick={() => setIsChatOpen(true)}
            className="flex items-center group cursor-pointer"
          >
            <div className="bg-[#5D4037] text-white px-4 py-2 rounded-full text-xs font-bold mr-2 opacity-0 group-hover:opacity-100 transition-all duration-300 whitespace-nowrap shadow-xl translate-x-4 group-hover:translate-x-0">
              Pitaj me bilo šta!
            </div>
            
            <div className="relative">
              {/* The Cat Paw Container - Extended length and chocolatey caramel color */}
              <div className="w-[500px] h-24 bg-[#8D6E63] rounded-l-[2.5rem] flex items-center justify-start pl-6 border-l-4 border-[#795548] shadow-2xl relative">
                
                {/* Claws (pop out on hover) */}
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    variants={{
                      hover: { opacity: 1, x: -6 }
                    }}
                    initial={{ opacity: 0, x: 0 }}
                    className="absolute w-2.5 h-1 bg-beige-100 rounded-full"
                    style={{ 
                      top: `${30 + i * 20}%`, 
                      left: '-1px',
                      transform: `rotate(${i === 0 ? -25 : i === 2 ? 25 : 0}deg)`
                    }}
                  />
                ))}

                {/* Paw Pads (Beige Details) - Facing Left */}
                <div className="flex flex-row items-center gap-2">
                  <div className="flex flex-col gap-1.5">
                    <div className="w-3.5 h-4.5 bg-[#D7CCC8] rounded-full shadow-inner" />
                    <div className="w-3.5 h-4.5 bg-[#D7CCC8] rounded-full shadow-inner" />
                    <div className="w-3.5 h-4.5 bg-[#D7CCC8] rounded-full shadow-inner" />
                  </div>
                  <div className="w-9 h-8 bg-[#D7CCC8] rounded-[1.2rem] shadow-inner" />
                </div>
              </div>
            </div>
          </motion.button>
        </div>

        {/* Document Detail View with Chat Bar */}
        <AnimatePresence>
          {selectedDoc && (
            <motion.div 
              initial={{ opacity: 0, x: '100%' }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 1, x: '100%' }}
              className="fixed inset-0 bg-[var(--bg-app)] z-[80] flex flex-col"
            >
              <div className="p-6 border-b border-[var(--border-color)] bg-[var(--bg-card)] flex items-center justify-between">
                <button onClick={() => setSelectedDoc(null)} className="flex items-center gap-2 font-bold text-beige-800">
                  <ArrowLeft className="w-5 h-5" /> Nazad
                </button>
                <h2 className="text-xl font-bold font-serif">{selectedDoc.name}</h2>
                <button 
                  onClick={() => {
                    const file = files.find(f => f.id === selectedDoc.driveFileId);
                    if (file) {
                      setSelectedFile(file);
                      setSelectedDoc(null);
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-beige-100 dark:bg-white/5 text-beige-800 rounded-xl font-bold text-xs hover:bg-beige-200 transition-all"
                >
                  <RefreshCw className="w-3 h-3" /> Ponovo analiziraj
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-10">
                <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10">
                  <div className="space-y-8">
                    <div className="bg-[var(--bg-card)] p-8 rounded-[2.5rem] border border-beige-200 shadow-sm">
                      <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-6">Ekstraktovani Podaci</h3>
                      <div className="prose dark:prose-invert max-w-none">
                        <ReactMarkdown>{selectedDoc.extractedData}</ReactMarkdown>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-8">
                    <div className="bg-[var(--bg-card)] p-8 rounded-[2.5rem] border border-beige-200 shadow-sm sticky top-0">
                      <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-6">Originalni Dokument</h3>
                      {files.find(f => f.id === selectedDoc.driveFileId)?.thumbnailLink ? (
                        <div className="rounded-2xl overflow-hidden border border-beige-100">
                          <img 
                            src={files.find(f => f.id === selectedDoc.driveFileId)?.thumbnailLink?.replace('=s220', '=s1200')} 
                            className="w-full h-auto" 
                            alt="Original"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      ) : (
                        <div className="aspect-video bg-beige-50 rounded-2xl flex items-center justify-center">
                          <FileText className="w-16 h-16 text-beige-200" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Chat Bar for specific document */}
              <div className="p-6 bg-[var(--bg-card)] border-t border-[var(--border-color)]">
                <div className="max-w-4xl mx-auto flex gap-4 items-center">
                  <div className="w-10 h-10 bg-beige-800 rounded-full flex items-center justify-center flex-shrink-0">
                    <Cat className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 relative">
                    <input 
                      type="text"
                      placeholder={`Pitaj me bilo šta o dokumentu "${selectedDoc.name}"...`}
                      className="w-full py-4 pl-6 pr-14 bg-beige-50 dark:bg-white/5 rounded-2xl border-none focus:ring-2 focus:ring-beige-800"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleSendMessage(undefined, `U vezi dokumenta "${selectedDoc.name}": ${e.currentTarget.value}`);
                          e.currentTarget.value = '';
                          setIsChatOpen(true);
                        }
                      }}
                    />
                    <button className="absolute right-2 top-1/2 -translate-y-1/2 p-3 text-beige-800">
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {isChatOpen && (
            <motion.div 
              initial={{ opacity: 0, x: 100, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 100, scale: 0.9 }}
              className="fixed bottom-10 right-10 w-[450px] h-[650px] bg-[var(--bg-card)] rounded-[2.5rem] shadow-2xl border border-beige-300 z-[60] flex flex-col overflow-hidden"
            >
              <div className="p-6 bg-beige-800 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Cat className="w-6 h-6" />
                  <h3 className="font-bold font-serif">AI Medicinski Asistent</h3>
                </div>
                <button onClick={() => setIsChatOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-beige-50/50 dark:bg-black/20">
                {chatMessages.length === 0 && (
                  <div className="text-center py-10 space-y-4">
                    <MessageSquare className="w-12 h-12 text-beige-200 mx-auto" />
                    <p className="text-beige-600 font-medium">Zdravo! Ja sam tvoj AI asistent. Pitaj me bilo šta o tvojim nalazima.</p>
                  </div>
                )}
                {chatMessages.map((msg) => (
                  <div 
                    key={msg.id}
                    className={cn(
                      "flex flex-col max-w-[85%]",
                      msg.role === 'user' ? "ml-auto items-end" : "items-start"
                    )}
                  >
                    <div className={cn(
                      "p-4 rounded-2xl text-sm leading-relaxed",
                      msg.role === 'user' 
                        ? "bg-beige-800 text-white rounded-tr-none shadow-md" 
                        : "bg-white dark:bg-white/10 text-[var(--text-main)] rounded-tl-none border border-beige-200 shadow-sm"
                    )}>
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                    <span className="text-[10px] text-gray-400 mt-1 px-1">
                      {msg.timestamp?.toDate().toLocaleTimeString('bs', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
                {sendingChat && (
                  <div className="flex items-start gap-3">
                    <div className="bg-white dark:bg-white/10 p-4 rounded-2xl rounded-tl-none border border-beige-200">
                      <Loader2 className="w-4 h-4 animate-spin text-beige-600" />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <form onSubmit={handleSendMessage} className="p-6 bg-white dark:bg-white/5 border-t border-beige-200">
                <div className="relative">
                  <input 
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Pitaj me o alergijama, nalazima..."
                    className="w-full pl-6 pr-14 py-4 bg-beige-50 dark:bg-white/5 border-none rounded-2xl focus:ring-2 focus:ring-beige-800 transition-all"
                  />
                  <button 
                    type="submit"
                    disabled={!chatInput.trim() || sendingChat}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-3 bg-beige-800 text-white rounded-xl hover:bg-beige-900 disabled:opacity-50 transition-all"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* File Processing Modal */}
        <AnimatePresence>
          {selectedFile && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[70] flex items-center justify-center p-6">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="max-w-lg w-full bg-[var(--bg-card)] rounded-[2.5rem] shadow-2xl overflow-hidden"
              >
                <div className="aspect-video bg-beige-50 dark:bg-white/5 relative overflow-hidden">
                  {selectedFile.thumbnailLink ? (
                    <img src={selectedFile.thumbnailLink.replace('=s220', '=s800')} className="w-full h-full object-contain" alt="" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <FileText className="w-20 h-20 text-beige-200" />
                    </div>
                  )}
                  {processing && (
                    <div className="absolute inset-0 bg-beige-800/60 backdrop-blur-sm flex flex-col items-center justify-center text-white p-10 text-center">
                      <Loader2 className="w-12 h-12 animate-spin mb-4" />
                      <h3 className="text-xl font-bold mb-2">Analiziram dokument...</h3>
                      <p className="text-sm opacity-80">Vještačka inteligencija izvlači sve detalje, uključujući alergije i kontakte.</p>
                    </div>
                  )}
                </div>
                
                <div className="p-10">
                  <h3 className="text-2xl font-bold mb-2 font-serif">{selectedFile.name}</h3>
                  <p className="text-gray-500 mb-8">Odaberite opciju za nastavak.</p>
                  
                  <div className="flex gap-4">
                    <button 
                      onClick={() => setSelectedFile(null)}
                      className="flex-1 py-4 px-6 border border-beige-300 rounded-2xl font-bold hover:bg-beige-50 transition-all"
                    >
                      Otkaži
                    </button>
                    <button 
                      onClick={() => processFile(selectedFile)}
                      disabled={processing}
                      className="flex-1 py-4 px-6 bg-beige-800 text-white rounded-2xl font-bold hover:bg-beige-900 transition-all shadow-lg shadow-beige-900/20"
                    >
                      Analiziraj
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Error Toast */}
        <AnimatePresence>
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-red-600 text-white px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-4 z-[100]"
            >
              <AlertCircle className="w-6 h-6" />
              <span className="font-bold">{error}</span>
              <button onClick={() => setError(null)} className="ml-4 hover:opacity-70">
                <X className="w-5 h-5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

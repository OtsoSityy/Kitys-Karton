import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function processMedicalDocument(fileData: string, mimeType: string, prompt: string) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [
          {
            inlineData: {
              data: fileData,
              mimeType: mimeType
            }
          },
          {
            text: `Ti si vrhunski medicinski vještak i stručnjak za dokumentaciju. Analiziraj ovaj dokument i izvuci APSOLUTNO SVAKU informaciju koju vidiš. 
            
            Korisnik zahtijeva EKSTREMAN NIVO DETALJA:
            - SVI DATUMI: Datum izdavanja, datum pregleda, datum laboratorijske obrade, datum rođenja.
            - STAROST: Izračunaj ili izvuci starost pacijenta u trenutku svakog nalaza.
            - SVA IMENA: Puna imena doktora, potpisnika, asistenata, medicinskih sestara.
            - USTANOVE: Tačni nazivi klinika, odjela, instituta, laboratorija (uključujući adrese i brojeve telefona ako pišu).
            - DIJAGNOZE I ŠIFRE: Svaka dijagnoza, sumnja (susp.), kontrolni pregled, MKB-10 šifre.
            - LABORATORIJA: Svaki parametar (npr. HCY2, CRP, Le, Er, Hgb), vrijednost, jedinica mjere, zastavice (LOW/HIGH), referentni intervali.
            - TERAPIJA (Th:): Svaki lijek, mast, sirup, injekcija, tačna doza, učestalost i trajanje.
            - ANAMNEZA I STATUS: Kompletan tekst anamneze i objektivnog statusa.
            - PREPORUKE: Svaki savjet, zakazana kontrola, uputa za druge specijaliste.
            
            Pitanje korisnika: ${prompt}
            
            Odgovori na BOSANSKOM jeziku. Koristi Markdown sa jasnim naslovima, tabelama za laboratoriju i podebljanim tekstom za ključne pojmove. Ne smiješ ništa izostaviti ili pojednostaviti.`
          }
        ]
      }
    ]
  });

  return response.text;
}

export async function extractAllergies(fileData: string, mimeType: string) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [
          { inlineData: { data: fileData, mimeType: mimeType } },
          { text: "Izvuci sve alergije spomenute u ovom dokumentu. Za svaku alergiju navedi: naziv, reakciju, ozbiljnost i kratko objašnjenje. Odgovori isključivo u JSON formatu." }
        ]
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            reaction: { type: Type.STRING },
            severity: { type: Type.STRING },
            explanation: { type: Type.STRING }
          },
          required: ["name"]
        }
      }
    }
  });

  try {
    return JSON.parse(response.text);
  } catch (e) {
    console.error("Failed to parse allergies JSON", e);
    return [];
  }
}

const switchTabTool: FunctionDeclaration = {
  name: "switchTab",
  description: "Prebaci korisnika na određeni tab u aplikaciji (početna, dokumenti, alergije, nalazi, recepti, historija).",
  parameters: {
    type: Type.OBJECT,
    properties: {
      tabId: {
        type: Type.STRING,
        description: "ID taba na koji treba prebaciti (pocetna, dokumenti, alergije, nalazi, recepti, historija)",
        enum: ["pocetna", "dokumenti", "alergije", "nalazi", "recepti", "historija"]
      }
    },
    required: ["tabId"]
  }
};

export async function chatWithAI(history: { role: "user" | "model", content: string }[], message: string, context: string) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      ...history.map(h => ({ role: h.role, parts: [{ text: h.content }] })),
      { role: "user", parts: [{ text: message }] }
    ],
    config: {
      systemInstruction: `Ti si vrhunski medicinski asistent za aplikaciju "Kitys Karton". 
      Tvoj zadatak je da pomažeš korisniku analizirajući njegove medicinske dokumente sa maksimalnom preciznošću.
      Odgovaraj isključivo na bosanskom jeziku.
      Budi izuzetno detaljan. Korisnik ne želi pojednostavljene odgovore, već pune medicinske detalje.
      
      Posebno obrati pažnju na sljedeće ključne aspekte iz korisnikove historije:
      - MRSA infekcija (zabilježena nakon rođenja).
      - Trombofilija (heterozigot za MTHFR polimorfizam, venska tromboza v.cave inf, renalis l. dex i v. iliaca interne l. sin).
      - Pertusis (Veliki kašalj).
      - Dermatitis (Atopijski dermatitis, impetigo).
      - Laboratorijski nalazi poput HCY2 (Homocistein).
      
      Uvijek koristi dostupni kontekst iz dokumenata da odgovoriš na pitanja. Ako nešto nije u dokumentima, reci da nemaš tu informaciju.
      
      Možeš kontrolisati aplikaciju koristeći alat switchTab. Ako korisnik kaže "pokaži mi alergije", pozovi switchTab sa tabId="alergije".
      
      Kontekst dokumenata:
      ${context}`,
      tools: [{ functionDeclarations: [switchTabTool] }]
    }
  });

  return {
    text: response.text,
    functionCalls: response.functionCalls
  };
}

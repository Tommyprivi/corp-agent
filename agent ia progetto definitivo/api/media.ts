/**
 * `media` — voce, immagini e lettura delle foto, in un solo posto.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * PERCHÉ TRE COSE IN UNA FUNZIONE
 * ─────────────────────────────────────────────────────────────────────────
 * Erano `tts.ts`, `images.ts` e `ocr.ts`, tre file separati. Il 2 Agosto 2026
 * il deploy ha smesso di funzionare:
 *
 *   "No more than 12 Serverless Functions can be added to a Deployment
 *    on the Hobby plan"
 *
 * Eravamo a tredici. Le alternative erano pagare il piano Pro o unire del
 * codice, e queste tre erano le candidate ovvie: fanno la stessa cosa — parlare
 * con un modello che produce o legge un media — hanno bisogno dello stesso
 * tempo massimo, e nessuna ha stato proprio.
 *
 * Unirle porta a undici funzioni, con due di margine per crescere.
 *
 * Il campo `kind` dice quale delle tre serve. Il frontend chiama sempre
 * `/api/media`, quindi aggiungere una quarta operazione domani non consumerà
 * un'altra funzione.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * DOVE STANNO LE CHIAVI
 * ─────────────────────────────────────────────────────────────────────────
 * Voce → ElevenLabs. Immagini → OpenAI (non passa da OpenRouter, come annotato
 * in docs/CHIAVI.md dal primo giorno). Lettura foto → un modello di visione via
 * OpenRouter. Tre chiavi diverse, tutte solo qui sul server.
 */

import { currentUser } from "./_lib/auth.js";
import { fetchCatalog } from "./_lib/openrouter.js";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

/**
 * La voce predefinita del catalogo ElevenLabs ("Rachel"), col modello
 * multilingua che parla un italiano naturale. Quando arriverà il voice-clone
 * aziendale (Fase 8, riga 85) questo diventerà un campo per utente.
 */
const VOICE_ID = "21m00Tcm4TlvDq8ikWAM";
const VOICE_MODEL = "eleven_multilingual_v2";
const MAX_SPEECH = 2_500;

/** I modelli che sanno guardare un'immagine, in ordine di preferenza. */
const READERS = ["google/gemini-3.6-flash", "openai/gpt-5.6-terra", "anthropic/claude-sonnet-5"];
const MAX_IMAGE = 8 * 1024 * 1024;

const OCR_INSTRUCTIONS = [
  "Trascrivi tutto il testo che vedi in questa immagine, in italiano.",
  "",
  "È il documento di un'attività commerciale: un menù, un listino prezzi, un tariffario,",
  "un cartello con gli orari. Serve a un assistente che risponderà ai clienti, quindi la",
  "precisione sui numeri è la cosa più importante di tutte.",
  "",
  "REGOLE",
  "Tieni ogni voce sulla sua riga, con il suo prezzo accanto: 'Margherita  7,50 €'.",
  "Mantieni i titoli delle sezioni come li vedi (ANTIPASTI, PIZZE, BEVANDE) su righe a sé,",
  "con una riga vuota prima.",
  "Riporta i prezzi esattamente come sono scritti: non arrotondare, non convertire, non",
  "aggiungere decimali che non ci sono.",
  "Se un numero è illeggibile o incerto, scrivi la voce e al posto del prezzo metti",
  "[illeggibile]. Non indovinare mai un prezzo: un prezzo sbagliato qui diventa un prezzo",
  "sbagliato detto a un cliente.",
  "",
  "Non aggiungere commenti, introduzioni o spiegazioni: solo il testo del documento.",
].join("\n");

interface Body {
  kind?: "speech" | "image" | "ocr";
  /** Per `speech`: il testo da leggere. */
  text?: string;
  /** Per `image`: cosa disegnare. */
  prompt?: string;
  /** Per `ocr`: la foto come data URL. */
  image?: string;
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") {
      return json({ error: "Serve una richiesta POST." }, 405);
    }

    // L'accesso è obbligatorio per tutte e tre: ogni operazione qui consuma
    // soldi veri, e un indirizzo aperto al mondo li brucia in una notte.
    let user;
    try {
      user = await currentUser(request);
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : String(error) }, 503);
    }
    if (!user) return json({ error: "Devi entrare prima." }, 401);

    let body: Body;
    try {
      body = (await request.json()) as Body;
    } catch {
      return json({ error: "Richiesta non leggibile." }, 400);
    }

    if (body.kind === "speech") return speech(body);
    if (body.kind === "image") return picture(body);
    if (body.kind === "ocr") return readPicture(body);

    return json({ error: "Non so cosa fare: manca 'kind'." }, 400);
  },
};

// ─────────────────────────────────────────────────────────────────────────
// VOCE (ElevenLabs)
// ─────────────────────────────────────────────────────────────────────────

async function speech(body: Body): Promise<Response> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return json(
      {
        error:
          "ELEVENLABS_API_KEY non configurata. Mettila in .env.local per lo sviluppo e " +
          "nelle Environment Variables di Vercel per il sito pubblicato.",
      },
      503
    );
  }

  const text = typeof body.text === "string" ? body.text.trim().slice(0, MAX_SPEECH) : "";
  if (!text) return json({ error: "Serve un testo da leggere." }, 400);

  const upstream = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream?output_format=mp3_44100_96`,
    {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ text, model_id: VOICE_MODEL }),
    }
  );

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    return json({ error: `ElevenLabs ha risposto ${upstream.status}`, detail }, 502);
  }

  return new Response(upstream.body, {
    headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
  });
}

// ─────────────────────────────────────────────────────────────────────────
// IMMAGINI (OpenAI)
// ─────────────────────────────────────────────────────────────────────────

async function picture(body: Body): Promise<Response> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return json({ error: "OPENAI_API_KEY non configurata." }, 503);

  const prompt = typeof body.prompt === "string" ? body.prompt.trim().slice(0, 2000) : "";
  if (!prompt) return json({ error: "Descrivi l'immagine che vuoi." }, 400);

  const upstream = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt,
      size: "1024x1024",
      // "medium" e non "high": un'immagine costa 4 centesimi invece di 17, e
      // per un post social o una locandina la differenza non si vede.
      quality: "medium",
      n: 1,
    }),
  });

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    return json({ error: `OpenAI ha risposto ${upstream.status}`, detail }, 502);
  }

  const result = (await upstream.json()) as { data?: Array<{ b64_json?: string }> };
  const b64 = result.data?.[0]?.b64_json;
  if (!b64) return json({ error: "OpenAI non ha restituito nessuna immagine." }, 502);

  return json({ dataUrl: `data:image/png;base64,${b64}` }, 200);
}

// ─────────────────────────────────────────────────────────────────────────
// LEGGERE UNA FOTO (modello di visione via OpenRouter)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Riga 15 della Fase 2, e la strada più vicina all'obiettivo "zero documenti":
 * si fotografa il menù appeso al muro e finisce lì.
 *
 * Un modello di visione invece di una libreria di OCR: Tesseract sarebbero due
 * megabyte da scaricare a ogni visita, e su un menù scritto a mano o
 * fotografato di sbieco sbaglia i numeri — che in un listino sono l'unica cosa
 * che conta.
 */
async function readPicture(body: Body): Promise<Response> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return json({ error: "OPENROUTER_API_KEY non configurata." }, 503);

  const image = typeof body.image === "string" ? body.image : "";
  if (!image.startsWith("data:image/")) return json({ error: "Serve un'immagine." }, 400);
  if (image.length > MAX_IMAGE) {
    return json({ error: "La foto è troppo grande. Riprovala a risoluzione più bassa." }, 413);
  }

  let modelId: string;
  try {
    const ids = new Set((await fetchCatalog()).map((m) => m.id));
    const found = READERS.find((r) => ids.has(r));
    if (!found) {
      return json(
        {
          error:
            "Nessun modello capace di leggere immagini è disponibile in questo momento. " +
            "Prova a incollare il testo invece di fotografarlo.",
        },
        503
      );
    }
    modelId = found;
  } catch (error) {
    return json(
      { error: "Non riesco a leggere il catalogo dei modelli.", detail: String(error) },
      502
    );
  }

  const upstream = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-Title": "CorpAgent",
    },
    body: JSON.stringify({
      model: modelId,
      stream: false,
      // Il tetto esplicito serve anche qui: senza, con un limite di spesa sulla
      // chiave OpenRouter rifiuta la richiesta in anticipo. Vedi api/chat.ts.
      max_tokens: 4000,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: OCR_INSTRUCTIONS },
            { type: "image_url", image_url: { url: image } },
          ],
        },
      ],
    }),
  });

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    return json({ error: `Il modello ha risposto ${upstream.status}`, detail }, 502);
  }

  const result = (await upstream.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = result.choices?.[0]?.message?.content?.trim() ?? "";

  if (!text) {
    return json(
      { error: "Non ho letto niente in questa foto. Provane una più a fuoco o più vicina." },
      422
    );
  }

  return new Response(JSON.stringify({ text }), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Model-Used": modelId,
    },
  });
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

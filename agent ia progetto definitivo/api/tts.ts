/**
 * `tts` — la voce dell'agente (ElevenLabs).
 *
 * Anticipata dalla Fase 8 alla V1 per decisione di Tommaso del 2 Agosto 2026.
 * Riceve un testo, restituisce l'audio in streaming: il browser lo suona
 * mentre arriva, senza aspettare la fine.
 *
 * Come per la chat: senza accesso non si genera niente, perché ogni carattere
 * convertito consuma la quota ElevenLabs. La chiave vive solo qui, sul server.
 */

import { currentUser } from "./_lib/auth.js";

/**
 * La voce predefinita del catalogo ElevenLabs ("Rachel"), col modello
 * multilingua che parla un italiano naturale. Quando arriverà il voice-clone
 * aziendale (Fase 8, riga 85) questo diventerà un campo per utente.
 */
const VOICE_ID = "21m00Tcm4TlvDq8ikWAM";
const MODEL_ID = "eleven_multilingual_v2";

/** Oltre non si va: un testo lungo brucia la quota e l'utente non lo ascolta. */
const MAX_CHARS = 2_500;

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") {
      return json({ error: "Serve una richiesta POST." }, 405);
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return json(
        {
          error:
            "ELEVENLABS_API_KEY non configurata. Mettila in .env.local per lo sviluppo " +
            "e nelle Environment Variables di Vercel per il sito pubblicato.",
        },
        503
      );
    }

    let user;
    try {
      user = await currentUser(request);
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : String(error) }, 503);
    }
    if (!user) return json({ error: "Devi entrare prima." }, 401);

    let body: { text?: string };
    try {
      body = (await request.json()) as { text?: string };
    } catch {
      return json({ error: "Richiesta non leggibile." }, 400);
    }

    const text = typeof body.text === "string" ? body.text.trim().slice(0, MAX_CHARS) : "";
    if (!text) return json({ error: "Serve un testo da leggere." }, 400);

    const upstream = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream?output_format=mp3_44100_96`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text, model_id: MODEL_ID }),
      }
    );

    if (!upstream.ok || !upstream.body) {
      const detail = await upstream.text().catch(() => "");
      return json({ error: `ElevenLabs ha risposto ${upstream.status}`, detail }, 502);
    }

    return new Response(upstream.body, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  },
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

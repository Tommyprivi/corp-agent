/**
 * `images` — la generazione di immagini (OpenAI, gpt-image-1).
 *
 * Anticipata dalla Fase 8 alla V1 per decisione di Tommaso del 2 Agosto 2026.
 * Non passa da OpenRouter: le immagini si generano direttamente con la chiave
 * OpenAI, come annotato da sempre in docs/CHIAVI.md.
 *
 * Qualità "medium" di proposito: un'immagine costa circa 4 centesimi invece
 * dei 17 della qualità alta, e per un menù o un post social basta e avanza.
 * L'accesso è obbligatorio per lo stesso motivo della chat: ogni immagine
 * sono soldi veri.
 */

import { currentUser } from "./_lib/auth.js";

const MAX_PROMPT = 2_000;

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") {
      return json({ error: "Serve una richiesta POST." }, 405);
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return json(
        {
          error:
            "OPENAI_API_KEY non configurata. Mettila in .env.local per lo sviluppo " +
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

    let body: { prompt?: string };
    try {
      body = (await request.json()) as { prompt?: string };
    } catch {
      return json({ error: "Richiesta non leggibile." }, 400);
    }

    const prompt = typeof body.prompt === "string" ? body.prompt.trim().slice(0, MAX_PROMPT) : "";
    if (!prompt) return json({ error: "Descrivi l'immagine che vuoi." }, 400);

    const upstream = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt,
        size: "1024x1024",
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

    // Come data URL: il browser la mostra subito, senza un altro giro di rete.
    // Quando ci sarà lo storage dei documenti (Fase 2) si salverà anche lì.
    return json({ dataUrl: `data:image/png;base64,${b64}` }, 200);
  },
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

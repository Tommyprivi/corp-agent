/**
 * `chat` — il cervello di CorpAgent.
 *
 * Righe 3, 4, 5, 6 e 9 della Fase 1 del PERCORSO, in un solo posto perché sono
 * la stessa conversazione: rispondere davvero, scegliere il modello giusto,
 * avvisare se costa, contare quanto è costato, salvare tutto.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * DOVE STA LA CHIAVE
 * ─────────────────────────────────────────────────────────────────────────
 * Questo file gira sul server di Vercel, non nel browser. È l'unico punto del
 * sistema che conosce la chiave di OpenRouter: il frontend chiama questa
 * funzione, questa funzione chiama OpenRouter. La chiave non arriva mai al
 * browser di nessuno, e non è scritta qui — si legge dall'ambiente.
 */

import { currentUser } from "./_lib/auth.js";
import { withUser } from "./_lib/db.js";
import {
  chooseModel,
  costEur,
  estimateLoad,
  fetchCatalog,
  heavyWarning,
  type CatalogModel,
} from "./_lib/openrouter.js";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

interface IncomingMessage {
  role: "user" | "agent" | "assistant" | "system";
  content: string;
}

interface Body {
  messages?: IncomingMessage[];
  systemPrompt?: string;
  /** `"auto"` o assente = lo scegliamo noi in base alla difficoltà. */
  modelSlug?: string;
  /** Dove salvare la conversazione. Assente = si risponde ma non si archivia. */
  projectId?: string;
  /** L'utente ha visto l'avviso costi e ha detto di procedere. */
  confirmHeavy?: boolean;
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") {
      return json({ error: "Serve una richiesta POST." }, 405);
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return json(
        {
          error:
            "OPENROUTER_API_KEY non configurata. Mettila in .env.local per lo sviluppo e " +
            "nelle Environment Variables di Vercel per il sito pubblicato. " +
            "Istruzioni: docs/SETUP-OPENROUTER.md",
        },
        503
      );
    }

    // Chi sta chiedendo. Senza accesso non si risponde: ogni risposta costa
    // soldi veri, e un indirizzo aperto al mondo li brucia in una notte.
    let user: { id: string; email: string | null } | null;
    try {
      user = await currentUser(request);
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : String(error) }, 503);
    }
    if (!user) {
      return json({ error: "Devi entrare prima di poter chattare." }, 401);
    }

    let body: Body;
    try {
      body = (await request.json()) as Body;
    } catch {
      return json({ error: "Richiesta non leggibile." }, 400);
    }

    const messages = body.messages ?? [];
    if (messages.length === 0) {
      return json({ error: "Serve almeno un messaggio." }, 400);
    }

    const lastUserText = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";

    // ── Riga 4: la scelta automatica del modello ──────────────────────
    let catalog: CatalogModel[];
    try {
      catalog = await fetchCatalog();
    } catch (error) {
      return json(
        { error: "Non riesco a leggere il catalogo dei modelli di OpenRouter.", detail: String(error) },
        502
      );
    }

    const load = estimateLoad(lastUserText);
    const asked = body.modelSlug && body.modelSlug !== "auto" ? body.modelSlug : null;
    const model =
      (asked ? catalog.find((m) => m.id === asked) : undefined) ?? chooseModel(load, catalog);

    // ── Riga 5: l'avviso prima di una richiesta dispendiosa ───────────
    // Si avvisa PRIMA di chiamare OpenRouter: se l'utente dice no, non ha speso
    // niente. Un avviso che arriva a spesa fatta non serve a nulla.
    const warning = heavyWarning(model, load, lastUserText.length);
    if (warning && !body.confirmHeavy) {
      return json({ needsConfirmation: true, warning }, 200);
    }

    const upstream = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        // OpenRouter li usa per le sue statistiche pubbliche: non obbligatori.
        "HTTP-Referer": "https://corpagent.app",
        "X-Title": "CorpAgent",
      },
      body: JSON.stringify({
        model: model.id,
        stream: true,
        // Chiediamo il conteggio dei token nell'ultimo pezzo dello stream:
        // è quello che alimenta il Contatore Risparmio e il pannello admin.
        usage: { include: true },
        messages: [
          ...(body.systemPrompt ? [{ role: "system", content: body.systemPrompt }] : []),
          ...messages.map((m) => ({
            role: m.role === "agent" ? "assistant" : m.role,
            content: m.content,
          })),
        ],
      }),
    });

    if (!upstream.ok || !upstream.body) {
      const detail = await upstream.text().catch(() => "");
      return json({ error: `OpenRouter ha risposto ${upstream.status}`, detail }, 502);
    }

    // ── Righe 3, 6 e 9: streaming, conteggio, salvataggio ─────────────
    // La risposta passa al browser parola per parola senza aspettare, e nello
    // stesso momento la leggiamo per contare i token. Alla fine si salva.
    const accounting = accountingStream(async (answer, usage) => {
      const tokensIn = usage?.in ?? Math.ceil((body.systemPrompt?.length ?? 0) / 4 + lastUserText.length / 4);
      const tokensOut = usage?.out ?? Math.ceil(answer.length / 4);
      const cost = costEur(model, tokensIn, tokensOut);

      await persist({
        userId: user.id,
        projectId: body.projectId,
        question: lastUserText,
        answer,
        modelSlug: model.id,
        tokensIn,
        tokensOut,
        cost,
      });
    });

    return new Response(upstream.body.pipeThrough(accounting), {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        // Così l'interfaccia può dire quale modello ha risposto e quanto pesava.
        "X-Model-Used": model.id,
        "X-Load": load,
      },
    });
  },
};

/**
 * Passa i byte al browser così come arrivano e intanto li legge per contare.
 *
 * Il salvataggio non deve mai rovinare la risposta: se il database è giù,
 * l'utente vede comunque il suo messaggio e noi perdiamo una riga di statistica.
 * L'ordine di importanza è quello, non il contrario.
 */
function accountingStream(
  onDone: (answer: string, usage: { in: number; out: number } | null) => Promise<void>
): TransformStream<Uint8Array, Uint8Array> {
  const decoder = new TextDecoder();
  let buffer = "";
  let answer = "";
  let usage: { in: number; out: number } | null = null;

  return new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      controller.enqueue(chunk);

      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === "" || payload === "[DONE]") continue;

        try {
          const parsed = JSON.parse(payload) as {
            choices?: Array<{ delta?: { content?: string } }>;
            usage?: { prompt_tokens?: number; completion_tokens?: number };
          };
          const delta = parsed.choices?.[0]?.delta?.content;
          if (typeof delta === "string") answer += delta;
          if (parsed.usage) {
            usage = {
              in: parsed.usage.prompt_tokens ?? 0,
              out: parsed.usage.completion_tokens ?? 0,
            };
          }
        } catch {
          // Pezzo di JSON spezzato a metà: arriverà completo col prossimo chunk.
        }
      }
    },

    async flush() {
      try {
        await onDone(answer, usage);
      } catch (error) {
        console.error("Risposta consegnata, salvataggio fallito:", error);
      }
    },
  });
}

/** Salva la domanda, la risposta e il consumo. Tutto dentro una transazione. */
async function persist(row: {
  userId: string;
  projectId?: string;
  question: string;
  answer: string;
  modelSlug: string;
  tokensIn: number;
  tokensOut: number;
  cost: number;
}): Promise<void> {
  await withUser(row.userId, async (client) => {
    if (row.projectId) {
      await client.query(
        `insert into public.messages (user_id, project_id, role, content, model_slug)
         values ($1, $2, 'user', $3, null)`,
        [row.userId, row.projectId, row.question]
      );
      await client.query(
        `insert into public.messages
           (user_id, project_id, role, content, model_slug, tokens_in, tokens_out, cost_eur)
         values ($1, $2, 'agent', $3, $4, $5, $6, $7)`,
        [row.userId, row.projectId, row.answer, row.modelSlug, row.tokensIn, row.tokensOut, row.cost]
      );
    }

    // Il consumo si conta sempre, anche fuori da un progetto: è quello che
    // alimenta il Contatore Risparmio e, più avanti, il tuo pannello admin.
    await client.query(
      `insert into public.usage (user_id, day, messages_handled, tokens_total, cost_eur)
       values ($1, current_date, 1, $2, $3)
       on conflict (user_id, day) do update set
         messages_handled = public.usage.messages_handled + 1,
         tokens_total     = public.usage.tokens_total + excluded.tokens_total,
         cost_eur         = public.usage.cost_eur + excluded.cost_eur`,
      [row.userId, row.tokensIn + row.tokensOut, row.cost]
    );
  });
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

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
import { spendCredits, userApiKey, withUser } from "./_lib/db.js";
import {
  conflictingSources,
  embeddingConfigured,
  knowledgePrompt,
  search,
  type Passage,
} from "./_lib/embed.js";
import {
  chooseModel,
  classifyLoad,
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
  /**
   * Falso per non cercare nei documenti. Serve al Master Builder, che sta
   * costruendo la squadra e non deve rispondere come un agente operativo.
   */
  useKnowledge?: boolean;
}


export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") {
      return json({ error: "Serve una richiesta POST." }, 405);
    }

    // ⚠️ La chiave si sceglie DOPO aver saputo chi sta chiedendo (riga 31):
    // se l'utente ne ha messa una sua, i consumi li paga lui. Qui si controlla
    // solo che almeno una delle due esista, per dare l'errore giusto subito.
    if (!process.env.OPENROUTER_API_KEY) {
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

    // ── Riga 31: BYOK ──────────────────────────────────────────────────
    // Se l'utente ha messo la sua chiave di OpenRouter, i consumi li paga lui
    // e noi guadagniamo solo sull'abbonamento. `own` viaggia fino in fondo
    // perche' chi paga di tasca sua non deve consumare crediti nostri.
    const credenziali = await userApiKey(user.id);
    if (!credenziali) {
      return json({ error: "Nessuna chiave OpenRouter disponibile." }, 503);
    }
    const apiKey = credenziali.key;

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

    const asked = body.modelSlug && body.modelSlug !== "auto" ? body.modelSlug : null;

    // Se l'utente ha scelto il modello a mano non si classifica niente: sarebbe
    // una chiamata pagata per un'informazione che non useremo.
    const { load, classified } = asked
      ? { load: estimateLoad(lastUserText), classified: false }
      : await classifyLoad(lastUserText, catalog, apiKey);

    const model =
      (asked ? catalog.find((m) => m.id === asked) : undefined) ?? chooseModel(load, catalog);

    // ── Riga 5: l'avviso prima di una richiesta dispendiosa ───────────
    // Si avvisa PRIMA di chiamare OpenRouter: se l'utente dice no, non ha speso
    // niente. Un avviso che arriva a spesa fatta non serve a nulla.
    const warning = heavyWarning(model, load, lastUserText.length);
    if (warning && !body.confirmHeavy) {
      return json({ needsConfirmation: true, warning }, 200);
    }

    // ── Righe 12 e 13: pescare dai documenti prima di rispondere ───────
    // Si cerca solo se ha senso: il Master Builder sta costruendo la squadra e
    // non deve rispondere come un agente operativo, quindi manda
    // useKnowledge: false. Se la chiave OpenAI manca, la chat funziona come
    // prima — senza memoria, ma funziona.
    let passages: Passage[] = [];
    if (body.useKnowledge !== false && embeddingConfigured() && lastUserText.length > 2) {
      try {
        passages = await withUser(user.id, (client) => search(client, user.id, lastUserText));
      } catch (error) {
        // Una ricerca che non riesce non deve impedire di rispondere: si
        // risponde senza memoria, come faceva prima della Fase 2.
        console.error("Ricerca nei documenti fallita, rispondo senza:", error);
      }
    }

    const knowledge = passages.length > 0 ? knowledgePrompt(passages) : null;
    const conflicts = conflictingSources(passages);

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
        /**
         * ⚠️ Un tetto esplicito, e non è un dettaglio.
         *
         * Senza questo campo OpenRouter chiede al modello il suo massimo — per
         * Claude Opus sono 65.536 token. Trovato il 2 Agosto 2026: appena
         * Tommaso ha messo un limite di spesa sulla chiave, **ogni richiesta
         * impegnativa ha cominciato a fallire con 402**, perché OpenRouter
         * verifica in anticipo di poter pagare il caso peggiore:
         *
         *   "You requested up to 65536 tokens, but can only afford 27371"
         *
         * Cioè: mettere il tetto di spesa — la cosa giusta da fare — rompeva
         * il prodotto. Nessuna risposta in chat ha bisogno di 65.000 token:
         * sono quaranta pagine. Il tetto per peso è generoso e limita anche il
         * costo massimo di un singolo messaggio, che è l'altra metà del motivo.
         */
        max_tokens: load === "heavy" ? 4000 : load === "standard" ? 2000 : 1000,
        // Chiediamo il conteggio dei token nell'ultimo pezzo dello stream:
        // è quello che alimenta il Contatore Risparmio e il pannello admin.
        usage: { include: true },
        messages: [
          ...(body.systemPrompt ? [{ role: "system", content: body.systemPrompt }] : []),
          // La conoscenza va DOPO le istruzioni dell'agente e PRIMA della
          // conversazione: così il "non inventare" è l'ultima regola che il
          // modello legge prima di sentire la domanda del cliente.
          ...(knowledge ? [{ role: "system", content: knowledge }] : []),
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
        own: credenziali.own,
        projectId: body.projectId,
        question: lastUserText,
        answer,
        modelSlug: model.id,
        tokensIn,
        tokensOut,
        cost,
      });

      // ── La domanda rimasta senza risposta ─────────────────────────────
      // Se l'agente ha dovuto passare la parola al titolare, quella domanda
      // va registrata: un avviso non salvato è un avviso perso. Se il cliente
      // scrive alle 23 e il titolare guarda il telefono la mattina, la
      // domanda deve essere ancora lì.
      if (knowledge && looksUnanswered(answer)) {
        await recordOpenQuestion(user.id, lastUserText, answer).catch((error) => {
          console.error("Domanda aperta non registrata:", error);
        });
      }
    });

    const headers = new Headers({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      // Così l'interfaccia può dire quale modello ha risposto e quanto pesava.
      "X-Model-Used": model.id,
      "X-Load": load,
      // "vero" = deciso da un modello, "stima" = euristica o corsia veloce.
      // Serve a capire, guardando le richieste, se la classificazione lavora.
      "X-Load-Source": classified ? "vero" : "stima",
    });

    // Le fonti viaggiano nelle intestazioni, non nel testo: il cliente legge
    // una risposta pulita, il titolare le vede nel pannello. È la decisione
    // di Tommaso sulla citazione, ed è anche il modo più semplice — non
    // sporca lo stream, che deve restare puro testo.
    if (passages.length > 0) {
      headers.set(
        "X-Sources",
        encodeURIComponent(
          JSON.stringify(
            passages.map((p) => ({
              name: p.documentName,
              heading: p.heading,
              ordinal: p.ordinal,
              similarity: Math.round(p.similarity * 100) / 100,
            }))
          )
        )
      );
    }
    if (conflicts.length > 0) {
      headers.set("X-Source-Conflict", encodeURIComponent(JSON.stringify(conflicts)));
    }

    return new Response(upstream.body.pipeThrough(accounting), { headers });
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
  /** Riga 31: true se ha pagato con la sua chiave, e quindi non consuma crediti. */
  own: boolean;
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

  // ── Righe 30 e 33: i crediti ─────────────────────────────────────────
  // ⚠️ Non blocca mai la risposta, nemmeno a saldo zero: si va sotto, lo si
  // dice e si offre la ricarica. Un agente che smette di rispondere ai clienti
  // a meta' giornata e' un danno per il titolare e una disdetta per noi.
  await spendCredits(
    row.userId,
    row.tokensIn + row.tokensOut,
    row.projectId ?? "chat",
    row.own
  ).catch(() => {
    // Il conteggio dei crediti non deve mai far fallire una risposta gia' data.
  });
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Riconosce se l'agente ha passato la parola al titolare invece di rispondere.
 *
 * ⚠️ È una euristica, e va detto: non c'è modo affidabile di sapere se una
 * risposta in italiano è un "non lo so" senza chiedere a un altro modello, e
 * spendere una seconda chiamata per ogni messaggio non ha senso.
 *
 * Quindi si guardano le frasi che il prompt gli dice di usare in quel caso —
 * "devo far verificare", "le rispondiamo a breve" — e si sbaglia **verso il
 * registrare troppo**: una domanda aperta in più nel pannello è una seccatura,
 * una domanda persa è un cliente che aspetta per sempre.
 */
function looksUnanswered(answer: string): boolean {
  const a = answer.toLowerCase();
  return (
    /far\s+verificare|faccio\s+verificare|devo\s+verificare|chiedo\s+al\s+titolare/.test(a) ||
    /non\s+(ho|dispongo\s+di|trovo)\s+(questa|l')?\s*informazion/.test(a) ||
    /non\s+(ho|dispongo\s+di)\s+(il|i|questo|questi)\s+dat/.test(a) ||
    /le\s+(rispondiamo|facciamo\s+sapere)\s+a\s+breve/.test(a)
  );
}

/**
 * Salva una domanda a cui l'agente non ha saputo rispondere.
 *
 * La stessa domanda non si registra due volte in un giorno: un cliente
 * insistente che riscrive tre volte non deve produrre tre righe identiche nel
 * pannello del titolare.
 */
async function recordOpenQuestion(
  userId: string,
  question: string,
  holdingReply: string
): Promise<void> {
  await withUser(userId, async (client) => {
    const existing = await client.query(
      `select 1 from public.open_questions
        where user_id = $1 and status = 'open' and lower(question) = lower($2)
          and created_at > now() - interval '1 day'
        limit 1`,
      [userId, question]
    );
    if (existing.rows.length > 0) return;

    await client.query(
      `insert into public.open_questions (user_id, channel, question, holding_reply)
       values ($1, 'chat', $2, $3)`,
      [userId, question.slice(0, 2000), holdingReply.slice(0, 2000)]
    );
  });
}

/**
 * `whatsapp` — il canale. Righe 19, 20 e 21 della Fase 3.
 *
 * È il pezzo che trasforma CorpAgent da «un sito dove parli con un'IA» in
 * «i tuoi clienti scrivono al tuo numero e trovano risposta a mezzanotte».
 *
 *   GET  → la stretta di mano con cui Meta verifica l'indirizzo
 *   POST → arriva un messaggio, l'agente risponde
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ⚠️ QUESTO È L'UNICO INDIRIZZO PUBBLICO DEL SISTEMA
 * ─────────────────────────────────────────────────────────────────────────
 * Tutti gli altri chiedono di essere entrati. Questo no: Meta deve poterlo
 * chiamare senza cookie e senza sessione. Il che significa che **chiunque
 * conosca l'indirizzo può chiamarlo** — e senza controlli farebbe rispondere
 * l'agente di Tommaso a spese sue, all'infinito.
 *
 * Da qui le tre difese, in ordine:
 *   1. la FIRMA — Meta firma ogni richiesta con l'App Secret. Senza firma
 *      valida non si legge nemmeno il corpo.
 *   2. il CANALE — il `phone_number_id` deve corrispondere a un canale
 *      registrato. Un messaggio per un numero che non conosciamo si scarta.
 *   3. l'IDEMPOTENZA — Meta **ripete** i messaggi se non rispondiamo in
 *      fretta. Senza il controllo sull'identificativo, un cliente riceverebbe
 *      la stessa risposta tre volte e noi la pagheremmo tre volte.
 */

import { withUser, getPool } from "./_lib/db.js";
import {
  embeddingConfigured,
  knowledgePrompt,
  search,
  type Passage,
} from "./_lib/embed.js";
import { chooseModel, classifyLoad, costEur, fetchCatalog } from "./_lib/openrouter.js";
import { createHmac, timingSafeEqual } from "node:crypto";

const GRAPH = "https://graph.facebook.com/v21.0";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

/** Un messaggio WhatsApp lungo non si legge: è una chat, non una mail. */
const MAX_REPLY_TOKENS = 700;

export default {
  async fetch(request: Request): Promise<Response> {
    // ── La stretta di mano ─────────────────────────────────────────────
    // Meta chiama una volta con questi tre parametri per controllare che
    // l'indirizzo sia davvero nostro. Si risponde con la sfida in chiaro.
    if (request.method === "GET") {
      const url = new URL(request.url);
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");

      const expected = process.env.WHATSAPP_VERIFY_TOKEN;
      if (!expected) return new Response("WHATSAPP_VERIFY_TOKEN non configurato", { status: 503 });

      if (mode === "subscribe" && token === expected && challenge) {
        // ⚠️ Testo puro, non JSON: Meta confronta il corpo carattere per
        // carattere con la sfida che ha mandato. Un `Content-Type` sbagliato
        // o delle virgolette intorno fanno fallire la verifica.
        return new Response(challenge, {
          status: 200,
          headers: { "Content-Type": "text/plain" },
        });
      }
      return new Response("Verifica fallita", { status: 403 });
    }

    if (request.method !== "POST") {
      return new Response("Metodo non ammesso", { status: 405 });
    }

    // ── Difesa 1: la firma ─────────────────────────────────────────────
    const raw = await request.text();
    const secret = process.env.META_APP_SECRET;

    if (!secret) {
      // Senza App Secret non si può verificare niente. Si rifiuta invece di
      // fidarsi: un canale aperto al mondo è peggio di un canale spento.
      console.error("META_APP_SECRET non configurato: rifiuto il webhook.");
      return new Response("Non configurato", { status: 503 });
    }
    if (!validSignature(raw, request.headers.get("x-hub-signature-256"), secret)) {
      return new Response("Firma non valida", { status: 401 });
    }

    let payload: WebhookPayload;
    try {
      payload = JSON.parse(raw) as WebhookPayload;
    } catch {
      return new Response("Corpo non leggibile", { status: 400 });
    }

    // ⚠️ Da qui in poi si risponde SEMPRE 200, qualunque cosa succeda.
    // Meta interpreta un errore come "non ricevuto" e **ripete** la consegna,
    // per ore. Un nostro guasto diventerebbe una tempesta di duplicati che si
    // ferma solo disattivando il webhook a mano.
    try {
      await handle(payload);
    } catch (error) {
      console.error("Webhook WhatsApp: errore nel trattare il messaggio", error);
    }
    return new Response("EVENT_RECEIVED", { status: 200 });
  },
};

// ─────────────────────────────────────────────────────────────────────────
// LA FIRMA
// ─────────────────────────────────────────────────────────────────────────

/**
 * Meta firma il corpo con HMAC-SHA256 usando l'App Secret.
 *
 * ⚠️ Si firma il corpo **grezzo**, non l'oggetto ri-serializzato: un
 * `JSON.parse` seguito da `JSON.stringify` cambia gli spazi e l'ordine delle
 * chiavi, e la firma non combacia più. È il motivo per cui sopra si legge
 * `request.text()` e si fa il parse solo dopo.
 *
 * Il confronto usa `timingSafeEqual`: confrontare due firme con `===` impiega
 * un tempo diverso a seconda di quanti caratteri iniziali combaciano, e da
 * quella differenza si può indovinare la firma un carattere per volta.
 */
function validSignature(raw: string, header: string | null, secret: string): boolean {
  if (!header?.startsWith("sha256=")) return false;

  const expected = createHmac("sha256", secret).update(raw, "utf8").digest("hex");
  const received = header.slice("sha256=".length);

  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(received, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// ─────────────────────────────────────────────────────────────────────────
// IL MESSAGGIO
// ─────────────────────────────────────────────────────────────────────────

interface WebhookPayload {
  entry?: Array<{
    changes?: Array<{
      field?: string;
      value?: {
        metadata?: { phone_number_id?: string };
        contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>;
        messages?: Array<{
          id?: string;
          from?: string;
          type?: string;
          text?: { body?: string };
        }>;
        statuses?: Array<{ id?: string; status?: string }>;
      };
    }>;
  }>;
}

async function handle(payload: WebhookPayload): Promise<void> {
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      if (!value) continue;

      // Le notifiche di consegna ("letto", "consegnato") arrivano allo stesso
      // indirizzo: si ignorano, non sono messaggi di nessuno.
      if (!value.messages?.length) continue;

      const phoneNumberId = value.metadata?.phone_number_id;
      if (!phoneNumberId) continue;

      // ── Difesa 2: il canale ────────────────────────────────────────
      const channel = await findChannel(phoneNumberId);
      if (!channel) {
        console.warn(`Messaggio per un numero sconosciuto (${phoneNumberId}): scartato.`);
        continue;
      }

      const contactName = value.contacts?.[0]?.profile?.name ?? null;

      for (const message of value.messages) {
        if (!message.id || !message.from) continue;

        // Per ora solo testo. Le note vocali sono la Fase 8 (riga 83), le
        // immagini la 90: quando arriveranno passeranno da qui.
        const text = message.type === "text" ? (message.text?.body ?? "").trim() : "";

        await handleOne({
          channel,
          waMessageId: message.id,
          from: message.from,
          contactName,
          text,
          unsupported: message.type !== "text" ? (message.type ?? "sconosciuto") : null,
        });
      }
    }
  }
}

interface Channel {
  id: string;
  userId: string;
  agentId: string | null;
  handoff: boolean;
}

/**
 * Trova il canale dal `phone_number_id`.
 *
 * ⚠️ Passa da una funzione del database, non da una `select`, e la ragione è
 * un difetto vero trovato eseguendo il 2 Agosto 2026: il webhook riceveva il
 * messaggio, rispondeva 200 e **non salvava niente**. Nessun errore, nessuna
 * traccia — il messaggio spariva.
 *
 * `channels` ha la sicurezza per riga, che confronta `user_id` con
 * `app.user_id`. Ma qui l'utente è proprio quello che stiamo cercando: fuori
 * da `withUser()` quella variabile non è impostata, e la query restituisce
 * zero righe come se il canale non esistesse.
 *
 * `resolve_wa_channel` è la porta stretta: gira coi permessi del proprietario
 * e restituisce **solo** la riga che corrisponde all'identificativo dato. È la
 * stessa soluzione che la migrazione 0002 aveva già adottato per gli scanner —
 * stessa malattia, stessa medicina.
 */
async function findChannel(phoneNumberId: string): Promise<Channel | null> {
  const client = await getPool().connect();
  try {
    const result = await client.query<{
      id: string;
      user_id: string;
      agent_id: string | null;
      handoff: boolean;
    }>("select * from public.resolve_wa_channel($1)", [phoneNumberId]);
    const row = result.rows[0];
    return row
      ? { id: row.id, userId: row.user_id, agentId: row.agent_id, handoff: row.handoff }
      : null;
  } finally {
    client.release();
  }
}

async function handleOne(input: {
  channel: Channel;
  waMessageId: string;
  from: string;
  contactName: string | null;
  text: string;
  unsupported: string | null;
}): Promise<void> {
  const { channel, waMessageId, from, contactName, text } = input;
  const userId = channel.userId;

  const conversationId = await withUser(userId, async (client) => {
    // ── Difesa 3: l'idempotenza ────────────────────────────────────────
    // Meta ripete la consegna se non rispondiamo in fretta. Senza questo
    // controllo il cliente riceverebbe la stessa risposta tre volte, e noi
    // la pagheremmo tre volte.
    const seen = await client.query(
      "select 1 from public.wa_messages where user_id = $1 and wa_message_id = $2 limit 1",
      [userId, waMessageId]
    );
    if (seen.rows.length > 0) return null;

    // Una conversazione per cliente, creata al primo messaggio.
    const convo = await client.query<{ id: string }>(
      `insert into public.wa_conversations
         (user_id, channel_id, customer_wa, customer_name, last_message_at)
       values ($1, $2, $3, $4, now())
       on conflict (channel_id, customer_wa) do update
         set last_message_at = now(),
             customer_name = coalesce(excluded.customer_name, wa_conversations.customer_name)
       returning id`,
      [userId, channel.id, from, contactName]
    );
    const id = convo.rows[0].id;

    await client.query(
      `insert into public.wa_messages
         (user_id, conversation_id, direction, wa_message_id, body, status)
       values ($1, $2, 'in', $3, $4, 'received')`,
      [userId, id, waMessageId, text || `[${input.unsupported}]`]
    );

    return id;
  });

  // Già visto: era una ripetizione di Meta. Niente da fare.
  if (!conversationId) return;

  // ── Riga 21: l'interruttore "passa la parola all'umano" ─────────────
  // Quando è acceso l'agente riceve e registra ma non risponde: il titolare
  // sta gestendo di persona quel cliente e una risposta automatica in mezzo
  // farebbe danno.
  if (channel.handoff) return;

  if (!text) {
    // Una nota vocale o una foto: si dice la verità invece di tacere.
    await send(
      from,
      "Per ora leggo solo i messaggi scritti. Se mi scrive a parole le rispondo subito."
    );
    return;
  }

  const reply = await generate(userId, conversationId, text);
  if (!reply) return;

  const sentId = await send(from, reply.text);

  await withUser(userId, async (client) => {
    await client.query(
      `insert into public.wa_messages
         (user_id, conversation_id, direction, wa_message_id, body, answered_by,
          model_slug, tokens_in, tokens_out, cost_eur, status)
       values ($1, $2, 'out', $3, $4, 'agent', $5, $6, $7, $8, $9)`,
      [
        userId,
        conversationId,
        sentId,
        reply.text,
        reply.model,
        reply.tokensIn,
        reply.tokensOut,
        reply.cost,
        // ⚠️ "failed", non "error": la tabella accetta solo i sei stati
        // elencati nella migrazione 0002. Una parola fuori elenco fa saltare il
        // vincolo, l'eccezione risale fino al `catch` del webhook, e la
        // risposta dell'agente **sparisce senza lasciare traccia**. È il
        // secondo difetto trovato provando l'8 Agosto 2026, nascosto dietro il
        // primo: finché il canale non si trovava, questa riga non girava mai.
        sentId ? "sent" : "failed",
      ]
    );

    // Il Contatore Risparmio, con dati veri invece che con una stima: questo
    // messaggio il titolare non l'ha scritto lui.
    await client.query(
      `insert into public.usage (user_id, day, messages_handled, tokens_total, cost_eur)
       values ($1, current_date, 1, $2, $3)
       on conflict (user_id, day) do update
         set messages_handled = usage.messages_handled + 1,
             tokens_total = usage.tokens_total + excluded.tokens_total,
             cost_eur = usage.cost_eur + excluded.cost_eur`,
      [userId, reply.tokensIn + reply.tokensOut, reply.cost]
    );
  });
}

// ─────────────────────────────────────────────────────────────────────────
// LA RISPOSTA
// ─────────────────────────────────────────────────────────────────────────

interface Reply {
  text: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  cost: number;
}

/**
 * Genera la risposta per il cliente.
 *
 * Stesso cervello della chat — scelta del modello per difficoltà, ricerca nei
 * documenti, divieto di inventare — ma **senza streaming**: WhatsApp riceve un
 * messaggio intero, non parola per parola.
 */
async function generate(
  userId: string,
  conversationId: string,
  question: string
): Promise<Reply | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error("OPENROUTER_API_KEY non configurata: non posso rispondere.");
    return null;
  }

  const catalog = await fetchCatalog();
  const { load } = await classifyLoad(question, catalog, apiKey);
  const model = chooseModel(load, catalog);

  // Le istruzioni dell'agente e le ultime battute della conversazione.
  const { instructions, history } = await withUser(userId, async (client) => {
    const agent = await client.query<{ system_prompt: string | null }>(
      `select system_prompt from public.agents
        where user_id = $1 and active = true
        order by created_at
        limit 1`,
      [userId]
    );

    // Solo le ultime battute: ogni messaggio rispedito indietro si ripaga.
    const past = await client.query<{ direction: string; body: string }>(
      `select direction, body from public.wa_messages
        where conversation_id = $1 and body is not null
        order by created_at desc
        limit 10`,
      [conversationId]
    );

    return {
      instructions: agent.rows[0]?.system_prompt ?? null,
      history: past.rows.reverse(),
    };
  });

  let passages: Passage[] = [];
  if (embeddingConfigured()) {
    try {
      passages = await withUser(userId, (client) => search(client, userId, question));
    } catch (error) {
      console.error("Ricerca nei documenti fallita, rispondo senza:", error);
    }
  }

  const upstream = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-Title": "CorpAgent",
    },
    body: JSON.stringify({
      model: model.id,
      stream: false,
      // Corto di proposito: un messaggio WhatsApp lungo non si legge. È anche
      // il tetto che serve a non far fallire la richiesta quando la chiave ha
      // un limite di spesa (vedi il commento in api/chat.ts).
      max_tokens: MAX_REPLY_TOKENS,
      usage: { include: true },
      messages: [
        {
          role: "system",
          content:
            (instructions ??
              "Sei l'assistente di un'attività italiana e rispondi ai clienti su WhatsApp.") +
            "\n\nSTAI SCRIVENDO SU WHATSAPP\n" +
            "Frasi brevi, niente elenchi puntati, niente formattazione. Due o tre righe al " +
            "massimo: chi legge è su un telefono, spesso in piedi. Vai al punto subito.",
        },
        ...(passages.length > 0 ? [{ role: "system", content: knowledgePrompt(passages) }] : []),
        ...history.map((m) => ({
          role: m.direction === "in" ? "user" : "assistant",
          content: m.body,
        })),
        { role: "user", content: question },
      ],
    }),
  });

  if (!upstream.ok) {
    console.error("OpenRouter ha risposto", upstream.status, await upstream.text().catch(() => ""));
    return null;
  }

  const result = (await upstream.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const text = result.choices?.[0]?.message?.content?.trim();
  if (!text) return null;

  const tokensIn = result.usage?.prompt_tokens ?? Math.ceil(question.length / 4);
  const tokensOut = result.usage?.completion_tokens ?? Math.ceil(text.length / 4);

  return {
    text,
    model: model.id,
    tokensIn,
    tokensOut,
    cost: costEur(model, tokensIn, tokensOut),
  };
}

/** Manda il messaggio al cliente. Restituisce l'identificativo di Meta. */
async function send(to: string, body: string): Promise<string | null> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  if (!token || !phoneId) {
    console.error("WHATSAPP_TOKEN o WHATSAPP_PHONE_ID non configurati.");
    return null;
  }

  const response = await fetch(`${GRAPH}/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: body.slice(0, 4000) },
    }),
  });

  const result = (await response.json()) as {
    messages?: Array<{ id?: string }>;
    error?: { message?: string; code?: number };
  };

  if (!response.ok || result.error) {
    console.error("Invio WhatsApp fallito:", result.error?.message ?? response.status);
    return null;
  }
  return result.messages?.[0]?.id ?? null;
}

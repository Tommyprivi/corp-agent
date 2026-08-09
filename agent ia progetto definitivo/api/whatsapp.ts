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

import { spendCredits, userApiKey, withUser, getPool } from "./_lib/db.js";
import {
  DISTILL_EVERY,
  flushQueue,
  notifyOwner,
  rememberWaConversation,
  sendDailyPulse,
  sendWhatsApp,
  watchdog,
} from "./_lib/whatsapp.js";
import {
  embeddingConfigured,
  knowledgePrompt,
  search,
  type Passage,
} from "./_lib/embed.js";
import { chooseModel, classifyLoad, costEur, fetchCatalog } from "./_lib/openrouter.js";
import { createHmac, timingSafeEqual } from "node:crypto";

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

      // ── Riga 27: il riepilogo serale ─────────────────────────────────
      // ⚠️ Sta attaccato a questo indirizzo e non a un file suo, e la ragione
      // e' la stessa di sempre: Vercel Hobby ammette 12 funzioni e ne abbiamo
      // 12. Il lavoro programmato in `vercel.json` chiama questo indirizzo
      // ogni sera alle 20:00.
      //
      // ⚠️ IL SEGRETO NON STA NELL'INDIRIZZO, e questo e' un errore che ho
      // fatto e corretto nello stesso minuto: avevo scritto il gettone dentro
      // il percorso in `vercel.json`, che e' un file **versionato su GitHub**.
      // Un segreto in un file pubblico non e' un segreto.
      //
      // Vercel firma le chiamate programmate con `Authorization: Bearer
      // $CRON_SECRET`, che vive tra le variabili d'ambiente come tutte le
      // altre chiavi. L'indirizzo puo' essere pubblico quanto vuole: senza
      // quella riga si prende 403.
      const pulse = url.searchParams.get("pulse");
      if (pulse !== null) {
        const atteso = process.env.CRON_SECRET;
        const dato = request.headers.get("authorization");
        if (!atteso || dato !== `Bearer ${atteso}`) {
          return new Response("Non autorizzato", { status: 403 });
        }
        // Il giorno lo decide chi chiama, o e' oggi. Poterlo passare serve a
        // rimandare il riepilogo di ieri se il lavoro non e' partito.
        const giorno = url.searchParams.get("giorno") ?? new Date().toISOString().slice(0, 10);
        try {
          const esito = await sendDailyPulse(giorno);
          return new Response(JSON.stringify({ giorno, ...esito }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          console.error("Riepilogo serale fallito:", error);
          return new Response("Riepilogo non riuscito", { status: 500 });
        }
      }

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

      // ── Riga 25: la coda intelligente ────────────────────────────
      // Se prima la rete era giu', qualche risposta e' rimasta ferma. Riparte
      // adesso, prima di trattare il messaggio nuovo: i clienti devono
      // ricevere le cose nell'ordine in cui sono state scritte.
      try {
        const ripartiti = await flushQueue(channel.userId);
        if (ripartiti > 0) console.log(`Coda: ${ripartiti} messaggi ripartiti.`);
      } catch (error) {
        console.error("La coda non e' ripartita:", error);
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
  /** Riga 22: l'agente prepara la risposta ma non la manda finche' non approvi. */
  ghost: boolean;
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
      ghost: boolean;
    }>("select * from public.resolve_wa_channel($1)", [phoneNumberId]);
    const row = result.rows[0];
    return row
      ? {
          id: row.id,
          userId: row.user_id,
          agentId: row.agent_id,
          handoff: row.handoff,
          ghost: row.ghost,
        }
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

  const conversation = await withUser(userId, async (client) => {
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
    //
    // ⚠️ `read_at = null` a ogni messaggio nuovo: la conversazione torna "non
    // letta" appena il cliente riscrive, anche se il titolare l'aveva già
    // aperta ieri. È l'unico comportamento che non fa perdere messaggi.
    const convo = await client.query<{ id: string; status: string }>(
      `insert into public.wa_conversations
         (user_id, channel_id, customer_wa, customer_name, last_message_at)
       values ($1, $2, $3, $4, now())
       on conflict (channel_id, customer_wa) do update
         set last_message_at = now(),
             read_at = null,
             customer_name = coalesce(excluded.customer_name, wa_conversations.customer_name)
       returning id, status`,
      [userId, channel.id, from, contactName]
    );
    const id = convo.rows[0].id;

    await client.query(
      `insert into public.wa_messages
         (user_id, conversation_id, direction, wa_message_id, body, status)
       values ($1, $2, 'in', $3, $4, 'received')`,
      [userId, id, waMessageId, text || `[${input.unsupported}]`]
    );

    // Quanti messaggi del cliente ha questa conversazione: serve a decidere se
    // è il momento di mandarla in memoria (uno su DISTILL_EVERY).
    const conta = await client.query<{ n: string }>(
      `select count(*)::text as n from public.wa_messages
        where conversation_id = $1 and user_id = $2 and direction = 'in'`,
      [id, userId]
    );

    return { id, status: convo.rows[0].status, inbound: Number(conta.rows[0].n) };
  });

  // Già visto: era una ripetizione di Meta. Niente da fare.
  if (!conversation) return;
  const conversationId = conversation.id;

  // ── Riga 21: l'interruttore "rispondo io" ───────────────────────────
  // Quando è acceso l'agente riceve e registra ma non risponde: il titolare
  // sta gestendo di persona e una risposta automatica in mezzo farebbe danno.
  //
  // ⚠️ Due livelli, e servono tutti e due. `channel.handoff` spegne l'agente
  // su **tutto il numero** — «stasera rispondo io a tutti». `status = 'human'`
  // lo spegne su **un cliente solo** — «questo me lo prendo in mano io», che è
  // come ragiona davvero chi risponde: non si spegne il centralino per parlare
  // con una persona. Il secondo lo accende la casella di posta sul sito.
  if (channel.handoff || conversation.status === "human" || conversation.status === "closed") {
    return;
  }

  if (!text) {
    // Una nota vocale o una foto: si dice la verità invece di tacere.
    await sendWhatsApp(
      from,
      "Per ora leggo solo i messaggi scritti. Se mi scrive a parole le rispondo subito."
    );
    return;
  }

  const reply = await generate(userId, conversationId, text);

  // ── Riga 25: il modello non risponde ────────────────────────────────
  // Non e' un guasto nostro, ma per il cliente lo e' lo stesso. Si dice la
  // verita' in una riga e non si finge niente: il messaggio e' arrivato, la
  // risposta arriva appena si puo'.
  if (!reply) {
    await sendWhatsApp(
      from,
      "Ho ricevuto il suo messaggio ma in questo momento non riesco a rispondere. " +
        "Le rispondiamo appena possibile."
    );
    await notifyOwner(
      userId,
      `⚠️ CorpAgent non e' riuscito a rispondere a ${contactName ?? from}. ` +
        "Il messaggio e' salvato, ma il modello non ha risposto."
    );
    return;
  }

  // ── Riga 26: la lingua del cliente ──────────────────────────────────
  if (reply.lang) {
    await withUser(userId, (client) =>
      client.query(
        "update public.wa_conversations set locale = $2 where id = $1 and locale is distinct from $2",
        [conversationId, reply.lang]
      )
    );
  }

  // ── Riga 23: il guardiano ───────────────────────────────────────────
  const verdetto = await watchdog(reply.text, reply.knowledge, process.env.OPENROUTER_API_KEY ?? null);

  // ── Riga 22: la modalita' Ghost ─────────────────────────────────────
  // Sono due cose diverse e vanno tenute separate: Ghost e' una scelta del
  // titolare («voglio leggere tutto»), il guardiano e' un allarme («questa
  // stava per costarti dei soldi»). Il messaggio si ferma in tutti e due i
  // casi, ma quello che il titolare legge nella posta e' diverso.
  const fermato = !verdetto.ok ? "watchdog" : channel.ghost ? "ghost" : null;

  const sentId = fermato ? null : await sendWhatsApp(from, reply.text);

  // ⚠️ Se non e' partito e non l'abbiamo fermato noi, e' colpa della rete: va
  // in coda e riparte da solo (riga 25). Non e' la stessa cosa di un messaggio
  // che aspetta una persona.
  const motivo = fermato ?? (sentId ? null : "offline");

  await withUser(userId, async (client) => {
    await client.query(
      `insert into public.wa_messages
         (user_id, conversation_id, direction, wa_message_id, body, answered_by,
          model_slug, tokens_in, tokens_out, cost_eur, status)
       values ($1, $2, 'out', $3, $4, 'agent', $5, $6, $7, $8, $9)
       returning id`,
      [
        userId,
        conversationId,
        sentId,
        reply.text,
        reply.model,
        reply.tokensIn,
        reply.tokensOut,
        reply.cost,
        // ⚠️ "failed"/"queued", mai "error": la tabella accetta solo i sei
        // stati elencati nella migrazione 0002. Una parola fuori elenco fa
        // saltare il vincolo, l'eccezione risale fino al `catch` del webhook, e
        // la risposta dell'agente **sparisce senza lasciare traccia**. È il
        // secondo difetto trovato provando l'8 Agosto 2026, nascosto dietro il
        // primo: finché il canale non si trovava, questa riga non girava mai.
        sentId ? "sent" : "queued",
      ]
    );

    if (motivo) {
      await client.query(
        `update public.wa_messages
            set hold_reason = $2, hold_note = $3
          where conversation_id = $1 and wa_message_id is null
            and hold_reason is null and direction = 'out'`,
        [conversationId, motivo, verdetto.nota ?? null]
      );
    }

    // Il Contatore Risparmio, con dati veri invece che con una stima: questo
    // messaggio il titolare non l'ha scritto lui.
    //
    // ⚠️ Si conta anche quando il messaggio e' fermo, ed e' voluto: il modello
    // e' stato chiamato e quei soldi sono stati spesi davvero. Il contatore
    // dice quanto e' costato lavorare, non quanto e' partito.
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

  // ── Righe 30 e 33: i crediti, e l'avviso quando finiscono ───────────
  // ⚠️ L'avviso arriva UNA volta sola: `low_credit_warned_at` lo segna. Un
  // avviso che arriva a ogni messaggio viene silenziato, e il giorno che i
  // crediti finiscono davvero il titolare non se ne accorge.
  const crediti = await spendCredits(
    userId,
    reply.tokensIn + reply.tokensOut,
    conversationId,
    reply.own
  ).catch(() => null);

  if (crediti?.low) {
    const daAvvisare = await withUser(userId, async (client) => {
      const row = await client.query<{ ok: boolean }>(
        `update public.subscriptions
            set low_credit_warned_at = now()
          where user_id = $1
            and (low_credit_warned_at is null or low_credit_warned_at < now() - interval '3 days')
          returning true as ok`,
        [userId]
      );
      return row.rows.length > 0;
    });
    if (daAvvisare) {
      await notifyOwner(
        userId,
        `⚡ I crediti di CorpAgent stanno finendo (ne restano ${crediti.balance.toLocaleString("it-IT")}).\n\n` +
          "L'agente continua a rispondere lo stesso — non si ferma. Quando puoi, " +
          "fai una ricarica dal sito."
      );
    }
  }

  // ── Riga 24: avvisare il titolare ───────────────────────────────────
  // Solo quando c'e' davvero qualcosa da fare per lui. Un avviso a ogni
  // messaggio diventa rumore, e il rumore si silenzia — che e' il modo piu'
  // sicuro di non far arrivare quello importante.
  if (motivo === "watchdog") {
    await notifyOwner(
      userId,
      `🛑 Ho fermato una risposta a ${contactName ?? from}.\n` +
        `${verdetto.nota ?? ""}\n\n` +
        "L'ho lasciata nella posta di CorpAgent: leggila e decidi tu."
    );
  } else if (motivo === "ghost") {
    await notifyOwner(
      userId,
      `✍️ Risposta pronta per ${contactName ?? from}, aspetta il tuo via libera su CorpAgent.`
    );
  }

  // ── «Deve essere tutto collegato» ───────────────────────────────────
  // Ogni DISTILL_EVERY messaggi del cliente, la conversazione viene riletta e
  // quello che vale domani finisce nella stessa memoria della chat del sito.
  // Da qui in poi non conta più dove una cosa è stata detta: se il signor
  // Rossi dice su WhatsApp che ritira sempre il giovedì, l'agente lo sa anche
  // quando gli scrivi dal computer.
  //
  // ⚠️ Sta DOPO l'invio, di proposito: costa qualche secondo, e quei secondi
  // li deve aspettare il nostro server, mai il cliente. Se fallisce non
  // succede niente di grave — si riprova fra sei messaggi.
  if (conversation.inbound > 0 && conversation.inbound % DISTILL_EVERY === 0) {
    try {
      const esito = await rememberWaConversation(userId, conversationId);
      if (esito.saved) {
        console.log(`Conversazione ${conversationId}: ${esito.chunks} pezzi in memoria.`);
      }
    } catch (error) {
      console.error("Non sono riuscito a mandare la conversazione in memoria:", error);
    }
  }
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
  /** Cosa aveva in mano l'agente: serve al guardiano per capire se ha inventato. */
  knowledge: string | null;
  /** Riga 26: la lingua in cui scrive il cliente, riconosciuta dal classificatore. */
  lang: string | null;
  /** Riga 31: true se ha risposto con la chiave del titolare, non con la nostra. */
  own: boolean;
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
  // ── Riga 31: BYOK ────────────────────────────────────────────────────
  // Anche qui vale la chiave dell'utente, se ne ha messa una sua: il cliente
  // che scrive su WhatsApp non deve consumare crediti nostri se il titolare
  // sta gia' pagando OpenRouter di tasca sua.
  const credenziali = await userApiKey(userId);
  if (!credenziali) {
    console.error("Nessuna chiave OpenRouter disponibile: non posso rispondere.");
    return null;
  }
  const apiKey = credenziali.key;

  const catalog = await fetchCatalog();
  const { load, lang } = await classifyLoad(question, catalog, apiKey);
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

  const knowledge = passages.length > 0 ? knowledgePrompt(passages) : null;

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
            "massimo: chi legge è su un telefono, spesso in piedi. Vai al punto subito.\n\n" +
            // ⚠️ Difetto vero, visto l'8 Agosto 2026 nella prima conversazione
            // reale: alla domanda «con chi parlo» l'agente ha risposto «l'assistenza
            // di [nome attività]». Un segnaposto tra parentesi quadre mandato a un
            // cliente vero fa sembrare l'azienda un esperimento mal riuscito, e
            // basta quello per non ricevere il secondo messaggio.
            // ── Riga 26 ──────────────────────────────────────────────
            // Il modello di solito risponde nella lingua della domanda da se',
            // ma "di solito" non basta: se il cliente scrive in tedesco e i
            // documenti del titolare sono in italiano, senza questa riga
            // l'agente scivola in italiano a meta' conversazione.
            (lang && lang !== "it"
              ? `RISPONDI IN LINGUA "${lang}"\nIl cliente ti ha scritto in questa lingua: rispondigli nella sua, ` +
                "anche se i documenti dell'attività sono in italiano. Traduci i contenuti, " +
                "non i nomi propri e non i prezzi.\n\n"
              : "") +
            "NON SCRIVERE MAI SEGNAPOSTO\n" +
            "Niente [nome attività], [orario], [indirizzo] o simili tra parentesi quadre. " +
            "Se non sai come si chiama l'attività, non nominarla: di' «siamo qui» o " +
            "«ci pensiamo noi» e vai avanti. Meglio una frase senza nome che una frase " +
            "con un buco dentro.",
        },
        ...(knowledge ? [{ role: "system", content: knowledge }] : []),
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
    knowledge,
    lang,
    own: credenziali.own,
  };
}



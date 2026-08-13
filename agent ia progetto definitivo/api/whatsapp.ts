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
import { eseguiStrumento, istruzioniStrumenti, strumentiPer } from "./_lib/tools.js";
import {
  ascolta,
  guarda,
  passaAlPonte,
  rifiutaChiamata,
  rispondiAVoce,
  rispostaAllaChiamata,
  DISTILL_EVERY,
  flushQueue,
  notifyOwner,
  rememberWaConversation,
  sendDailyPulse,
  sendWhatsApp,
  watchdog,
} from "./_lib/whatsapp.js";
import { generaReportSerale } from "./_lib/azienda.js";
import { scaricaPostaTutte } from "./_lib/posta.js";
import {
  embeddingConfigured,
  indexText,
  knowledgePrompt,
  search,
  type Passage,
} from "./_lib/embed.js";
import {
  chooseModel,
  classifyLoad,
  costEur,
  fetchCatalog,
  searchModel,
} from "./_lib/openrouter.js";
import { createHmac, timingSafeEqual } from "node:crypto";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

/**
 * Due numeri sono lo stesso numero?
 *
 * ⚠️ Serve perché nessuno scrive il proprio numero come lo scrive Meta. Il
 * titolare mette «+39 331 4039051» nelle impostazioni, Meta manda
 * «393314039051», e un confronto diretto direbbe che sono due persone diverse
 * — quindi il capo verrebbe trattato come un cliente qualunque.
 */
function soloCifre(n: string): string {
  return n.replace(/[^0-9]/g, "").replace(/^00/, "");
}

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
          // ── Il report di direzione dell'area azienda ────────────────────
          // Stesso battito delle 20:00: mentre il pulse WhatsApp parte, si
          // prepara anche il riepilogo del cruscotto di ogni azienda, così il
          // titolare la sera lo trova già scritto invece di generarlo aprendo.
          // ⚠️ Non deve poter far fallire il pulse: se il modello è giù, si
          // segna e basta.
          let report: { azienda: string; fatto: boolean }[] = [];
          try {
            report = await generaReportSerale();
          } catch (e) {
            console.error("Report serale azienda fallito:", e);
          }
          // ── La posta delle aziende ──────────────────────────────────────
          // Stesso giro: si controllano le caselle collegate e si portano
          // dentro le bolle/mail arrivate in giornata. ⚠️ Vercel Hobby ammette
          // solo lavori giornalieri: chi vuole prima usa «Controlla adesso».
          let postaEsiti: { azienda: string; nuovi: number; errore: string | null }[] = [];
          try {
            postaEsiti = await scaricaPostaTutte();
          } catch (e) {
            console.error("Scarico posta serale fallito:", e);
          }
          return new Response(JSON.stringify({ giorno, ...esito, report, posta: postaEsiti }), {
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

    // ── Quello che vi siete detti al telefono ──────────────────────────
    // Il ponte vocale, a chiamata finita, rimanda qui le battute. Da questo
    // momento una telefonata non e' piu' una cosa che sparisce: e' una
    // conversazione che si legge nella posta, e che diventa memoria come
    // tutte le altre.
    //
    // ⚠️ Non passa dalla firma di Meta ma dal segreto del ponte: chi scrive
    // qui e' un pezzo nostro, non Meta.
    if (new URL(request.url).searchParams.get("trascrizione") !== null) {
      const atteso = process.env.BRIDGE_SECRET;
      if (!atteso || request.headers.get("authorization") !== `Bearer ${atteso}`) {
        return new Response("Non autorizzato", { status: 403 });
      }
      try {
        const corpo = (await request.json()) as {
          callId?: string;
          battute?: Array<{ chi?: string; testo?: string }>;
          durataSecondi?: number;
        };
        await salvaTelefonata(corpo);
      } catch (error) {
        console.error("Trascrizione non salvata:", error);
      }
      // Sempre 200: il ponte non deve riprovare, e una trascrizione persa non
      // vale un processo che insiste.
      return new Response("ok", { status: 200 });
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
          // Gli allegati. `voice` e `audio` sono due cose diverse per Meta: il
          // primo e' il vocale registrato col microfono, il secondo un file
          // audio allegato. Per noi si ascoltano allo stesso modo.
          image?: { id?: string; caption?: string };
          voice?: { id?: string };
          audio?: { id?: string };
          document?: { id?: string; filename?: string; caption?: string };
          video?: { id?: string; caption?: string };
          sticker?: { id?: string };
        }>;
        statuses?: Array<{ id?: string; status?: string }>;
        /** Le chiamate: arrivano sullo stesso indirizzo, campo `calls`. */
        calls?: Array<{
          id?: string;
          from?: string;
          to?: string;
          /** 'connect' = sta squillando · 'terminate' = e' finita. */
          event?: string;
          direction?: string;
          status?: string;
          duration?: number;
          /** La proposta tecnica di connessione: serve al ponte vocale. */
          session?: { sdp_type?: string; sdp?: string };
        }>;
      };
    }>;
  }>;
}

async function handle(payload: WebhookPayload): Promise<void> {
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      if (!value) continue;

      const phoneNumberId = value.metadata?.phone_number_id;
      if (!phoneNumberId) continue;

      // ── Le chiamate ──────────────────────────────────────────────
      // Arrivano sullo stesso indirizzo dei messaggi, campo `calls`.
      if (value.calls?.length) {
        const canale = await findChannel(phoneNumberId);
        if (canale) {
          for (const chiamata of value.calls) {
            await handleCall(canale, chiamata, value.contacts?.[0]?.profile?.name ?? null);
          }
        }
        continue;
      }

      // Le notifiche di consegna ("letto", "consegnato") arrivano allo stesso
      // indirizzo: si ignorano, non sono messaggi di nessuno.
      if (!value.messages?.length) continue;

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

        // ── Chi sta scrivendo ──────────────────────────────────────
        // ⚠️ Il titolare e un cliente vogliono due comportamenti opposti. Se
        // il capo fotografa il listino nuovo, quella foto va LETTA e messa in
        // memoria; rispondergli «Buongiorno, come possiamo aiutarla?» mentre
        // sta lavorando e' il modo piu' veloce di fargli chiudere l'app.
        const daltitolare =
          channel.ownerWa !== null && soloCifre(message.from) === soloCifre(channel.ownerWa);

        // ── Righe 83 e 90 anticipate: vocali e foto ────────────────
        // «L'imprenditore registra un vocale mentre guida», «punta la
        // fotocamera su una pila di scontrini». Un idraulico non apre un sito
        // per caricare un PDF: fotografa.
        let text = message.type === "text" ? (message.text?.body ?? "").trim() : "";
        let unsupported: string | null = null;
        let allegato: "voce" | "foto" | null = null;

        if (message.type === "voice" || message.type === "audio") {
          const id = message.voice?.id ?? message.audio?.id;
          const trascritto = id ? await ascolta(id) : null;
          if (trascritto) {
            text = trascritto;
            allegato = "voce";
          } else {
            unsupported = "vocale illeggibile";
          }
        } else if (message.type === "image") {
          const id = message.image?.id;
          const letto = id ? await guarda(id, daltitolare ? "scanner" : "cliente") : null;
          if (letto) {
            const didascalia = (message.image?.caption ?? "").trim();
            text = daltitolare
              ? letto
              : [didascalia, `[foto mandata dal cliente] ${letto}`].filter(Boolean).join("\n\n");
            allegato = "foto";
          } else {
            unsupported = "foto illeggibile";
          }
        } else if (message.type && message.type !== "text") {
          unsupported = message.type;
        }

        // ── Quando il titolare sta INSEGNANDO, e quando sta PROVANDO ──
        //
        // ⚠️ Difetto d'uso trovato subito, il 9 Agosto 2026: appena registrato
        // il numero del titolare, ogni sua parola finiva in memoria — e con un
        // numero di prova che accetta 5 destinatari, il suo e' l'unico da cui
        // si puo' provare. Cioe' aveva perso il modo di parlare col proprio
        // agente come farebbe un cliente.
        //
        // La regola adesso e' esplicita e si spiega in una riga:
        //   · una FOTO dal titolare  → e' uno scontrino, un menu': in memoria
        //   · «segnati che...»       → sta dettando: in memoria
        //   · qualunque altra cosa   → sta provando: gli si risponde da agente
        //
        // Indovinare sarebbe stato peggio: un sistema che a volte ti risponde
        // e a volte si segna quello che dici, senza che tu sappia quando, e'
        // un sistema di cui non ti fidi.
        const staInsegnando =
          daltitolare && (allegato === "foto" || /^\s*(segnati|ricorda|annota|memorizza|aggiungi|nota)\b/i.test(text));

        await handleOne({
          channel,
          waMessageId: message.id,
          from: message.from,
          contactName,
          text,
          unsupported,
          allegato,
          staInsegnando,
        });
      }
    }
  }
}

/**
 * Salva quello che ci si e' detti al telefono.
 *
 * ⚠️ Si riattacca alla conversazione **gia' esistente** con quel cliente, non
 * ne apre una nuova: per il titolare «Marco» e' una persona sola, che a volte
 * scrive e a volte chiama. Due elenchi separati sarebbero due Marco.
 */
async function salvaTelefonata(corpo: {
  callId?: string;
  battute?: Array<{ chi?: string; testo?: string }>;
  durataSecondi?: number;
}): Promise<void> {
  const { callId, battute } = corpo;
  if (!callId || !battute?.length) return;

  // La chiamata era gia' stata registrata quando e' arrivata: da li' si risale
  // a chi e' l'utente e a quale conversazione appartiene.
  const client = await getPool().connect();
  let userId: string | null = null;
  let conversationId: string | null = null;
  try {
    const trovato = await client.query<{ user_id: string; conversation_id: string }>(
      "select user_id, conversation_id from public.wa_messages where wa_message_id = $1 limit 1",
      [callId]
    );
    userId = trovato.rows[0]?.user_id ?? null;
    conversationId = trovato.rows[0]?.conversation_id ?? null;
  } finally {
    client.release();
  }
  if (!userId || !conversationId) {
    console.warn(`Trascrizione della chiamata ${callId}: non so a chi appartiene.`);
    return;
  }

  await withUser(userId, async (c) => {
    for (const [i, b] of battute.entries()) {
      if (!b.testo) continue;
      await c.query(
        `insert into public.wa_messages
           (user_id, conversation_id, direction, wa_message_id, body, answered_by,
            media_kind, status)
         values ($1, $2, $3, $4, $5, $6, 'audio', 'delivered')
         on conflict (wa_message_id) do nothing`,
        [
          userId,
          conversationId,
          b.chi === "cliente" ? "in" : "out",
          `${callId}:${i}`,
          b.testo,
          b.chi === "cliente" ? null : "agent",
        ]
      );
    }
    await c.query(
      `update public.wa_conversations set last_message_at = now(), read_at = null
        where id = $1`,
      [conversationId]
    );
  });

  const durata = corpo.durataSecondi ?? 0;
  console.log(`Chiamata ${callId}: ${battute.length} battute salvate (${durata}s).`);

  // Una telefonata e' il posto dove si prendono gli accordi veri: se ci sono
  // fatti che valgono domani, finiscono in memoria come per le chat.
  try {
    await rememberWaConversation(userId, conversationId);
  } catch (error) {
    console.error("Telefonata non mandata in memoria:", error);
  }
}

/**
 * Le istruzioni per l'agente al telefono: chi e', e cosa sa dell'attivita'.
 *
 * ⚠️ Al telefono la conoscenza va messa DENTRO le istruzioni, non cercata a
 * ogni domanda: una ricerca nei documenti costa un secondo, e un secondo di
 * silenzio in mezzo a una frase al telefono fa dire «pronto?». Si prende il
 * meglio di quello che c'e' e glielo si mette in testa prima di rispondere.
 */
async function istruzioniTelefoniche(
  userId: string,
  from: string,
  contactName: string | null
): Promise<string> {
  const dati = await withUser(userId, async (client) => {
    const agente = await client.query<{ name: string; system_prompt: string | null }>(
      `select name, system_prompt from public.agents
        where user_id = $1 and active = true order by created_at limit 1`,
      [userId]
    );

    // ⚠️ Chi sta chiamando l'ha gia' fatto? Questa e' la differenza fra un
    // centralino e «il mio agente». Un cliente che ieri ha scritto «vi ho
    // lasciato il pacco» e oggi chiama non deve ricominciare da capo: se
    // ricomincia da capo, non e' il tuo assistente — e' un risponditore.
    const passato = await client.query<{ direction: string; body: string }>(
      `select m.direction, m.body
         from public.wa_messages m
         join public.wa_conversations v on v.id = m.conversation_id
        where v.user_id = $1 and v.customer_wa = $2 and m.body is not null
        order by m.created_at desc
        limit 12`,
      [userId, from]
    );

    return {
      nome: agente.rows[0]?.name ?? null,
      prompt: agente.rows[0]?.system_prompt ?? null,
      storia: passato.rows.reverse(),
    };
  });

  // ── Tutto quello che sa, in testa prima di rispondere ────────────────
  //
  // ⚠️ QUI NON SI CERCA: SI CARICA TUTTO.
  // Nella chat si fa una ricerca per significato a ogni domanda, e va bene:
  // un secondo di attesa mentre l'utente guarda lo schermo non si nota.
  // Al telefono quel secondo e' silenzio in mezzo a una frase, e chi ascolta
  // dice «pronto?». Peggio ancora: la ricerca si fa sulla domanda, e al
  // telefono la domanda arriva DOPO che la conversazione e' gia' cominciata.
  //
  // Quindi si prende quello che il titolare ha caricato e glielo si mette in
  // testa prima che squilli. Per un negozio o un ristorante sono un menu', un
  // listino e due regole: ci stanno comodamente. Il tetto serve solo a non far
  // esplodere le istruzioni se qualcuno ha caricato un'enciclopedia.
  const sapere = await withUser(userId, async (client) => {
    const pezzi = await client.query<{ nome: string; contenuto: string }>(
      `select d.name as nome, k.content as contenuto
         from public.chunks k
         join public.documents d on d.id = k.document_id
        where k.user_id = $1 and d.archived_at is null
        order by d.updated_at desc, k.ordinal
        limit 120`,
      [userId]
    );
    if (pezzi.rows.length === 0) return "";

    const righe: string[] = [];
    let quanto = 0;
    let ultimo = "";
    for (const p of pezzi.rows) {
      if (quanto + p.contenuto.length > 9000) break;
      if (p.nome !== ultimo) {
        righe.push("", `── ${p.nome} ──`);
        ultimo = p.nome;
      }
      righe.push(p.contenuto);
      quanto += p.contenuto.length;
    }

    return [
      "",
      "─────────────────────────────────────────",
      "QUELLO CHE SAI DI QUESTA ATTIVITÀ",
      "─────────────────────────────────────────",
      "È la tua unica fonte di verità su prezzi, orari, prodotti e condizioni.",
      "Se una cosa è scritta qui, rispondila con sicurezza, senza dire «devo",
      "verificare»: verificare quello che già sai fa perdere tempo al cliente e",
      "ti fa sembrare un centralino.",
      ...righe,
    ].join("\n");
  }).catch((error) => {
    console.error("Non sono riuscito a preparare la conoscenza per la chiamata:", error);
    return "";
  });

  const chi = contactName?.split(" ")[0] ?? null;

  const conversazionePassata =
    dati.storia.length > 0
      ? [
          "",
          "─────────────────────────────────────────",
          `CI SIETE GIA' PARLATI${chi ? `, LUI SI CHIAMA ${chi.toUpperCase()}` : ""}`,
          "─────────────────────────────────────────",
          "Ecco le ultime cose che vi siete detti su WhatsApp. Usale: se sta",
          "chiamando per la stessa cosa, riprendi da li' senza fargli ripetere tutto.",
          "",
          ...dati.storia.map(
            (m) => `${m.direction === "in" ? (chi ?? "CLIENTE") : "TU"}: ${m.body.slice(0, 300)}`
          ),
        ].join("\n")
      : "";

  return [
    dati.prompt ?? "Sei l'assistente di un'attività italiana.",
    "",
    "─────────────────────────────────────────",
    "STAI RISPONDENDO AL TELEFONO",
    "─────────────────────────────────────────",
    dati.nome ? `Ti chiami ${dati.nome}. Se te lo chiedono, dillo.` : "",
    "",
    "Parla come una persona al telefono, non come un messaggio letto ad alta voce.",
    "Frasi corte. Una cosa per volta. Mai più di due opzioni a voce: chi ascolta",
    "non può rileggere. Se serve un elenco, di' che lo mandi per messaggio.",
    "",
    "Puoi usare gli intercalari di chi parla davvero — «allora», «certo»,",
    "«un attimo che controllo» — ma senza esagerare. Niente elenchi puntati,",
    "niente formattazione, niente emoji: si sentono, non si leggono.",
    "",
    chi ? `Chi ti sta chiamando si chiama ${chi}: chiamalo per nome.` : "",
    "",
    "⚠️ Non inventare MAI prezzi, orari o disponibilità che non sai. Se non lo",
    "sai, dillo con semplicità: «questo devo farmelo confermare, le faccio",
    "richiamare» — e vai avanti. Un prezzo sbagliato detto al telefono è una",
    "promessa, e le promesse si pagano.",
    conversazionePassata,
    sapere ? "\n" + sapere : "",
  ]
    .filter((r) => r !== "")
    .join("\n");
}

/**
 * Qualcuno ha premuto la cornetta.
 *
 * ⚠️ Si risponde in tre secondi, e l'ordine conta: prima si **rifiuta** (il
 * telefono del cliente smette di squillare a vuoto), poi si scrive. Chi sente
 * venti squilli senza risposta pensa «non c'e' nessuno» e riattacca arrabbiato;
 * chi ne sente due e riceve subito un vocale capisce che dall'altra parte
 * qualcuno c'e'.
 */
async function handleCall(
  channel: Channel,
  chiamata: {
    id?: string;
    from?: string;
    event?: string;
    status?: string;
    duration?: number;
    session?: { sdp_type?: string; sdp?: string };
  },
  contactName: string | null
): Promise<void> {
  const from = chiamata.from;
  if (!from || !chiamata.id) return;

  // La fine di una chiamata non richiede niente: era gia' stata trattata
  // quando e' arrivata. Serve solo a non rispondere due volte.
  if (chiamata.event === "terminate") return;

  const userId = channel.userId;

  // ── Rispondere davvero ──────────────────────────────────────────────
  // Se il ponte vocale e' acceso, la chiamata si ACCETTA e l'agente parla al
  // telefono. Se non c'e', o non risponde in otto secondi, si torna al piano
  // B: si rifiuta e parte un vocale. Meglio un vocale in tre secondi che venti
  // squilli nel vuoto.
  if (chiamata.session?.sdp) {
    const istruzioni = await istruzioniTelefoniche(userId, from, contactName);
    const collegata = await passaAlPonte({
      callId: chiamata.id,
      sdp: chiamata.session.sdp,
      istruzioni,
      // Dove rimandare quello che vi siete detti, a chiamata finita.
      ritorno: {
        url: `${process.env.BETTER_AUTH_URL ?? "https://corpagent.vercel.app"}/api/whatsapp?trascrizione=1`,
        segreto: process.env.BRIDGE_SECRET ?? "",
      },
      saluto:
        "Saluta come farebbe chi risponde al telefono di questa attività, e chiedi " +
        "come puoi aiutare. Una frase sola.",
    });

    if (collegata) {
      await withUser(userId, async (client) => {
        const convo = await client.query<{ id: string }>(
          `insert into public.wa_conversations
             (user_id, channel_id, customer_wa, customer_name, last_message_at)
           values ($1, $2, $3, $4, now())
           on conflict (channel_id, customer_wa) do update
             set last_message_at = now(), read_at = null
           returning id`,
          [userId, channel.id, from, contactName]
        );
        await client.query(
          `insert into public.wa_messages
             (user_id, conversation_id, direction, wa_message_id, body, status)
           values ($1, $2, 'in', $3, $4, 'received')`,
          [userId, convo.rows[0].id, chiamata.id, "📞 Chiamata: ha risposto l'agente"]
        );
      });
      console.log(`Chiamata ${chiamata.id} passata al ponte vocale.`);
      return;
    }
  }

  await rifiutaChiamata(chiamata.id);

  const conversationId = await withUser(userId, async (client) => {
    const gia = await client.query(
      "select 1 from public.wa_messages where user_id = $1 and wa_message_id = $2 limit 1",
      [userId, chiamata.id]
    );
    if (gia.rows.length > 0) return null;

    const convo = await client.query<{ id: string }>(
      `insert into public.wa_conversations
         (user_id, channel_id, customer_wa, customer_name, last_message_at)
       values ($1, $2, $3, $4, now())
       on conflict (channel_id, customer_wa) do update
         set last_message_at = now(), read_at = null,
             customer_name = coalesce(excluded.customer_name, wa_conversations.customer_name)
       returning id`,
      [userId, channel.id, from, contactName]
    );
    const id = convo.rows[0].id;

    // Nella posta si deve vedere che quella era una chiamata, non un messaggio:
    // il titolare che scorre l'elenco capisce subito chi ha provato a sentirlo.
    await client.query(
      `insert into public.wa_messages
         (user_id, conversation_id, direction, wa_message_id, body, status)
       values ($1, $2, 'in', $3, $4, 'received')`,
      [userId, id, chiamata.id, "📞 Ti ha chiamato"]
    );
    return id;
  });

  if (!conversationId) return; // Meta l'aveva gia' mandata.

  const testo = rispostaAllaChiamata(contactName);

  // Prima la voce: chi ha chiamato voleva parlare, non leggere. Se la voce
  // non parte resta lo scritto — meglio scritto che niente.
  const sentId = (await rispondiAVoce(from, testo)) ?? (await sendWhatsApp(from, testo));

  await withUser(userId, (client) =>
    client.query(
      `insert into public.wa_messages
         (user_id, conversation_id, direction, wa_message_id, body, answered_by, status)
       values ($1, $2, 'out', $3, $4, 'agent', $5)`,
      [userId, conversationId, sentId, testo, sentId ? "sent" : "queued"]
    )
  );

  await notifyOwner(
    userId,
    `📞 ${contactName ?? from} ti ha chiamato su WhatsApp.\n\n` +
      "Non potevo rispondere al telefono, gli ho mandato un vocale che lo invita a scrivere. " +
      "Se vuoi richiamarlo, il numero è questo."
  );
}

interface Channel {
  id: string;
  userId: string;
  agentId: string | null;
  handoff: boolean;
  /** Riga 22: l'agente prepara la risposta ma non la manda finche' non approvi. */
  ghost: boolean;
  /** Il numero personale del titolare: se scrive lui, non e' un cliente. */
  ownerWa: string | null;
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
      owner_wa: string | null;
    }>("select * from public.resolve_wa_channel($1)", [phoneNumberId]);
    const row = result.rows[0];
    return row
      ? {
          id: row.id,
          userId: row.user_id,
          agentId: row.agent_id,
          handoff: row.handoff,
          ghost: row.ghost,
          ownerWa: row.owner_wa,
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
  /** Com'e' arrivato: a voce, in foto, o scritto. Decide come si risponde. */
  allegato: "voce" | "foto" | null;
  /** Il titolare sta dettando qualcosa da ricordare, non provando l'agente. */
  staInsegnando: boolean;
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
         (user_id, conversation_id, direction, wa_message_id, body, media_kind, status)
       values ($1, $2, 'in', $3, $4, $5, 'received')`,
      [
        userId,
        id,
        waMessageId,
        text || `[${input.unsupported}]`,
        // Nella posta si deve vedere che quello era un vocale, non uno scritto:
        // il testo e' la trascrizione, e leggerlo come se l'avessero digitato
        // fa sembrare il cliente piu' formale di com'e'.
        input.allegato === "voce" ? "audio" : input.allegato === "foto" ? "image" : null,
      ]
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

  // ── Lo scanner (dal documento: «lo scanna su WhatsApp») ─────────────
  // Il titolare fotografa uno scontrino, il menù nuovo, un listino del
  // fornitore — o lo racconta a voce mentre chiude. Quel testo non e' una
  // conversazione: e' conoscenza, e va dritta in memoria.
  if (input.staInsegnando && text) {
    // ⚠️ Il nome dice come e' arrivato, e deve essere vero: la prima versione
    // chiamava «detto a voce» anche un messaggio scritto, e nell'elenco della
    // memoria non si capiva piu' cosa fosse cosa.
    const nome =
      input.allegato === "foto"
        ? "Foto da WhatsApp"
        : input.allegato === "voce"
          ? "Detto a voce su WhatsApp"
          : "Dettato su WhatsApp";
    try {
      const messo = await indexText(userId, {
        name: `${nome} — ${new Date().toLocaleDateString("it-IT")}`,
        text,
        source: input.allegato === "foto" ? "photo" : "paste",
      });
      await sendWhatsApp(
        from,
        messo
          ? `✅ Fatto, me lo sono segnato (${messo.chunks} ${messo.chunks === 1 ? "cosa" : "cose"}).\n\n` +
              `Da adesso lo uso per rispondere ai clienti.\n\n_${text.slice(0, 300)}${text.length > 300 ? "…" : ""}_`
          : "Ho letto ma non ho trovato niente da segnarmi. Riprova con una foto più a fuoco."
      );
    } catch (error) {
      console.error("Scanner del titolare fallito:", error);
      await sendWhatsApp(from, "Ho ricevuto ma non sono riuscito a segnarmelo. Riprova fra poco.");
    }
    return;
  }

  if (!text) {
    // Un file che non sappiamo leggere: si dice la verità invece di tacere.
    await sendWhatsApp(
      from,
      input.unsupported === "document"
        ? "Ho ricevuto il documento ma non riesco ancora ad aprirlo da qui. " +
            "Se me lo scrive a parole, o me ne manda una foto, le rispondo subito."
        : "Ho ricevuto ma non sono riuscito a leggerlo. Può riprovare o scrivermelo?"
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

  // ── Chi parla, si sente rispondere ──────────────────────────────────
  // «Invece di mandarti un papiro di testo da leggere, l'agente ti risponde
  // con un altro messaggio vocale.» Chi manda un vocale quasi sempre non ha le
  // mani libere: rispondergli con tre righe da leggere e' ridargli il problema
  // che stava evitando.
  //
  // ⚠️ Se la voce non parte si manda il testo. Meglio una risposta scritta che
  // nessuna risposta — e succede: ElevenLabs puo' essere lento o senza credito.
  const sentId = fermato
    ? null
    : input.allegato === "voce"
      ? ((await rispondiAVoce(from, reply.text)) ?? (await sendWhatsApp(from, reply.text)))
      : await sendWhatsApp(from, reply.text);

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

/** Quello che risponde OpenRouter, con o senza strumenti. */
interface Risposta {
  choices: Array<{
    message: {
      content?: string;
      tool_calls?: Array<{ id: string; function?: { name?: string; arguments?: string } }>;
    };
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

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
  const { load, lang, fresh } = await classifyLoad(question, catalog, apiKey);

  // ── Riga 42: la ricerca web ─────────────────────────────────────────
  // ⚠️ Solo quando serve davvero. Un modello che cerca costa dieci volte uno
  // che non cerca, e «a che ora aprite?» non ha bisogno di internet: la
  // risposta e' nei documenti del titolare. Se il cercatore non c'e' nel
  // catalogo si va avanti col modello normale — che dira' onestamente di non
  // saperlo, invece di inventare.
  const cercatore = fresh ? searchModel(catalog) : null;
  const model = cercatore ?? chooseModel(load, catalog);

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

  // ── Riga 40 e 41: gli strumenti, anche da WhatsApp ───────────────────
  // ⚠️ Compaiono SOLO se quell'utente ha collegato qualcosa. Dire a un agente
  // «puoi controllare le ferie» quando Fluida non c'e' produce un «controllo
  // subito» seguito dal nulla: il modello non sa cosa non ha, e bisogna non
  // dirglielo.
  const strumenti = await strumentiPer(userId).catch(() => []);

  const messaggi = [
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
            // ── Riga 42: quando ha cercato, deve dirlo ──────────────
            // Chi legge deve poter distinguere «questo lo so perche' me l'hai
            // detto tu» da «questo l'ho trovato adesso su internet». Sono due
            // gradi di affidabilita' diversi, e confonderli e' come dire un
            // prezzo letto su un forum come se fosse il proprio listino.
            (cercatore
              ? "HAI CERCATO SU INTERNET\nQuesta risposta viene dal web, non dai documenti " +
                "del titolare. Dillo in modo naturale («ho controllato adesso», «da quello " +
                "che risulta online») e non spacciarla per un'informazione dell'attività.\n\n"
              : "") +
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
        ...(istruzioniStrumenti(strumenti)
          ? [{ role: "system", content: istruzioniStrumenti(strumenti) as string }]
          : []),
        ...history.map((m) => ({
          role: m.direction === "in" ? "user" : "assistant",
          content: m.body,
        })),
        { role: "user", content: question },
      ];

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
      messages: messaggi,
      ...(strumenti.length > 0 ? { tools: strumenti } : {}),
    }),
  });

  if (!upstream.ok) {
    console.error("OpenRouter ha risposto", upstream.status, await upstream.text().catch(() => ""));
    return null;
  }

  let result = (await upstream.json()) as Risposta;

  // ── Riga 40: l'agente usa i connettori ───────────────────────────────
  // Se ha chiesto uno strumento, glielo si esegue e gli si ridà la parola con
  // il risultato in mano.
  //
  // ⚠️ Un solo giro, non un ciclo aperto. Un modello che può richiamare
  // strumenti all'infinito, su un canale dove il cliente aspetta, e' un conto
  // che cresce mentre qualcuno guarda il telefono. Un giro basta a rispondere
  // «Mario è in ferie fino al 18»; per le catene lunghe c'è la chat del sito.
  const chiamate = result.choices?.[0]?.message?.tool_calls ?? [];
  if (chiamate.length > 0) {
    const risultati: Array<{ role: "tool"; tool_call_id: string; content: string }> = [];
    for (const c of chiamate.slice(0, 3)) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(c.function?.arguments ?? "{}") as Record<string, unknown>;
      } catch {
        /* argomenti storti: si esegue lo stesso con quello che c'e' */
      }
      const esito = await eseguiStrumento(userId, c.function?.name ?? "", args);
      console.log(`Strumento ${c.function?.name}: ${esito.slice(0, 120)}`);
      risultati.push({ role: "tool", tool_call_id: c.id, content: esito });
    }

    const secondo = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-Title": "CorpAgent",
      },
      body: JSON.stringify({
        model: model.id,
        stream: false,
        max_tokens: MAX_REPLY_TOKENS,
        usage: { include: true },
        messages: [...messaggi, result.choices[0].message, ...risultati],
      }),
    });
    if (secondo.ok) {
      const dopo = (await secondo.json()) as Risposta;
      // I token del primo giro non si buttano: li ha spesi il titolare.
      const primi = result.usage;
      result = dopo;
      if (result.usage && primi) {
        result.usage.prompt_tokens = (result.usage.prompt_tokens ?? 0) + (primi.prompt_tokens ?? 0);
        result.usage.completion_tokens =
          (result.usage.completion_tokens ?? 0) + (primi.completion_tokens ?? 0);
      }
    }
  }

  let text = result.choices?.[0]?.message?.content?.trim();
  if (!text) return null;

  // ⚠️ I modelli che cercano sul web mettono i rimandi alle fonti come [8][10].
  // Sul sito diventerebbero link; su WhatsApp restano numerini fra parentesi
  // che non portano da nessuna parte e fanno sembrare la risposta copiata da
  // un compito. Si tolgono, insieme agli spazi doppi che lasciano dietro.
  if (cercatore) {
    text = text
      .replace(/\s*\[\d+\]/g, "")
      .replace(/[ \t]{2,}/g, " ")
      .trim();
  }

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



/**
 * Quello che WhatsApp e il sito devono saper fare tutti e due.
 *
 * Nato l'8 Agosto 2026 dalla richiesta di Tommaso: «nel sito devi mettere la
 * possibilità di ricordarsi le chat anche su WhatsApp, deve essere tutto
 * collegato». Da quel momento due file diversi devono poter mandare un
 * messaggio a un cliente — il webhook quando risponde l'agente, e la casella
 * di posta quando risponde il titolare in persona — e tutti e due devono poter
 * trasformare una conversazione in memoria.
 *
 * Scriverlo due volte avrebbe voluto dire due modi di parlare col cliente e
 * due memorie che divergono. Sta qui una volta sola.
 */

import { withUser } from "./db.js";
import { indexText } from "./embed.js";
import { distill } from "./openrouter.js";

const GRAPH = "https://graph.facebook.com/v21.0";

/** WhatsApp taglia i messaggi lunghi: meglio tagliarli noi con criterio. */
const MAX_BODY = 4000;

/**
 * Manda il messaggio al cliente. Restituisce l'identificativo che assegna Meta,
 * o `null` se l'invio non è riuscito.
 *
 * ⚠️ Non solleva mai un'eccezione. Chi chiama sta quasi sempre dentro il
 * webhook, dove un errore non gestito significa che Meta considera il
 * messaggio non consegnato e lo **ripete** per ore.
 */
export async function sendWhatsApp(to: string, body: string): Promise<string | null> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  if (!token || !phoneId) {
    console.error("WHATSAPP_TOKEN o WHATSAPP_PHONE_ID non configurati.");
    return null;
  }

  try {
    const response = await fetch(`${GRAPH}/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: body.slice(0, MAX_BODY) },
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
  } catch (error) {
    console.error("Invio WhatsApp fallito:", error);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// DA CONVERSAZIONE A MEMORIA
// ─────────────────────────────────────────────────────────────────────────

/**
 * Ogni quanti messaggi del cliente vale la pena rileggere la conversazione.
 *
 * ⚠️ Non a ogni messaggio, e la ragione è doppia. Costa una chiamata a un
 * modello, e soprattutto il webhook deve rispondere in fretta: Meta ripete la
 * consegna se ci mettiamo troppo. Uno su sei significa che il ritardo si paga
 * una volta ogni sei messaggi, e su quel messaggio la risposta al cliente è
 * già partita — l'attesa la subisce il nostro server, non il cliente.
 */
export const DISTILL_EVERY = 6;

/** Sotto questa soglia una conversazione non ha ancora niente da dire. */
const MIN_MESSAGES = 4;

/**
 * Legge una conversazione WhatsApp e ne tiene **solo i fatti che valgono
 * domani** — «il signor Rossi ritira sempre il giovedì», «gli ho promesso il
 * 10% sul prossimo ordine» — buttando i saluti e le domande già risposte.
 *
 * È la stessa distillazione della chat del sito, con lo stesso prompt: da qui
 * in poi non conta più dove una cosa è stata detta. Se un cliente la dice su
 * WhatsApp, l'agente la sa anche quando gli scrivi dal sito, e viceversa.
 *
 * L'identificativo `wa:<conversazione>` fa sì che ogni distillazione
 * **sostituisca** la precedente invece di accumularsi: resta un ricordo solo
 * per cliente, che si aggiorna man mano che vi parlate.
 *
 * Restituisce cosa è successo, perché la casella di posta lo mostra al
 * titolare: nascondere che l'agente ha imparato qualcosa sul suo cliente
 * sarebbe la cosa sbagliata da fare.
 */
export async function rememberWaConversation(
  userId: string,
  conversationId: string
): Promise<{ saved: true; chunks: number } | { saved: false; reason: string }> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return { saved: false, reason: "OPENROUTER_API_KEY non configurata" };

  const conversation = await withUser(userId, async (client) => {
    const info = await client.query<{ customer_name: string | null; customer_wa: string }>(
      `select customer_name, customer_wa from public.wa_conversations
        where id = $1 and user_id = $2`,
      [conversationId, userId]
    );
    if (info.rows.length === 0) return null;

    const rows = await client.query<{ direction: string; body: string }>(
      `select direction, body from public.wa_messages
        where conversation_id = $1 and user_id = $2 and body is not null
        order by created_at
        limit 200`,
      [conversationId, userId]
    );
    return { ...info.rows[0], messages: rows.rows };
  });

  if (!conversation) return { saved: false, reason: "conversazione non trovata" };
  if (conversation.messages.length < MIN_MESSAGES) {
    return { saved: false, reason: "conversazione troppo breve" };
  }

  const chi = conversation.customer_name ?? conversation.customer_wa;
  const transcript = conversation.messages
    .map((m) => `${m.direction === "in" ? `CLIENTE (${chi})` : "ASSISTENTE"}: ${m.body}`)
    .join("\n");

  const distilled = await distill(transcript, apiKey);

  // NIENTE è la risposta prevista quando non c'è nulla da ricordare, ed è il
  // caso più frequente: una conversazione su tre è «a che ora aprite» e basta.
  if (!distilled || distilled.trim().toUpperCase() === "NIENTE") {
    return { saved: false, reason: "nessun fatto da ricordare" };
  }

  const indexed = await indexText(userId, {
    name: `WhatsApp — ${chi}`,
    text: distilled,
    source: "paste",
    externalId: `wa:${conversationId}`,
  });

  return indexed
    ? { saved: true, chunks: indexed.chunks }
    : { saved: false, reason: "niente da indicizzare" };
}

// ─────────────────────────────────────────────────────────────────────────
// RIGA 23 — IL GUARDIANO
// ─────────────────────────────────────────────────────────────────────────

/**
 * Le frasi che un agente non deve mandare a un cliente senza che il titolare
 * le abbia lette.
 *
 * ⚠️ Il controllo è **deterministico e gratuito**, e questa è la scelta che
 * conta. Far leggere ogni risposta a un secondo modello raddoppierebbe costo e
 * attesa su **tutte** le risposte, per fermarne una su mille. Qui invece le
 * espressioni pericolose si riconoscono con delle regole; il modello viene
 * chiamato **solo** quando una regola scatta, per evitare il falso allarme.
 *
 * Sono tutte cose che costano soldi veri se dette per sbaglio: uno sconto
 * promesso è uno sconto dovuto, un rimborso promesso è un rimborso dovuto.
 */
const RISCHI: Array<{ prova: RegExp; cosa: string }> = [
  { prova: /\b\d{1,3}\s?%\s*(di\s*)?sconto|sconto\s*(del\s*)?\d{1,3}\s?%/i, cosa: "promette uno sconto in percentuale" },
  { prova: /\bgratis\b|\bgratuit[ao]\b|\bomaggio\b|\bin regalo\b/i, cosa: "promette qualcosa in omaggio" },
  { prova: /\brimborso (totale|completo|integrale)\b|\bti rimbors|\ble rimbors/i, cosa: "promette un rimborso" },
  { prova: /\bgarantisco\b|\ble garantisco\b|\bti garantisco\b|\bal 100%\b/i, cosa: "dà una garanzia" },
  { prova: /\bentro (oggi|domani|un'?ora|due ore|stasera)\b/i, cosa: "promette una consegna a tempo" },
  { prova: /\bannull(o|iamo) (l'ordine|la prenotazione)\b|\bcancell(o|iamo) tutto\b/i, cosa: "annulla un ordine" },
];

export interface Verdetto {
  /** `true` = la risposta può partire. */
  ok: boolean;
  /** Cosa non andava, in italiano, da mostrare al titolare. */
  nota?: string;
}

/**
 * Controlla la risposta prima che parta (riga 23).
 *
 * Due passaggi. Il primo è una lettura di regole: costa zero e nel caso normale
 * finisce qui con un via libera. Il secondo scatta solo se una regola ha
 * suonato, e serve a **non** bloccare una risposta legittima: «ai clienti
 * abituali facciamo il 10%» è una regola che il titolare ha scritto lui nei
 * suoi documenti, e ripeterla non è una fesseria — è il lavoro dell'agente.
 *
 * Il modello vede quindi anche quello che l'agente aveva in mano: se la
 * promessa sta nei documenti, passa. Se se l'è inventata, si ferma.
 */
export async function watchdog(
  reply: string,
  knowledge: string | null,
  apiKey: string | null
): Promise<Verdetto> {
  const scattate = RISCHI.filter((r) => r.prova.test(reply));
  if (scattate.length === 0) return { ok: true };

  const cosa = scattate.map((r) => r.cosa).join(", ");

  // Senza chiave non si può chiedere conferma: si sceglie la strada prudente e
  // si ferma. Un messaggio in attesa è un fastidio, una promessa sbagliata è
  // un danno.
  if (!apiKey) return { ok: false, nota: `La risposta ${cosa}.` };

  try {
    const { chooseModel, fetchCatalog } = await import("./openrouter.js");
    const catalog = await fetchCatalog();
    const cheap = chooseModel("light", catalog);

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-Title": "CorpAgent",
      },
      body: JSON.stringify({
        model: cheap.id,
        stream: false,
        max_tokens: 30,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "verdetto",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["autorizzata"],
              properties: {
                autorizzata: {
                  type: "boolean",
                  description:
                    "true se quello che la risposta promette risulta dalle regole dell'attività qui sotto; " +
                    "false se l'assistente se l'è inventato o l'ha dedotto.",
                },
              },
            },
          },
        },
        messages: [
          {
            role: "system",
            content:
              "Un assistente sta per mandare questa risposta a un cliente, e contiene una promessa " +
              "(sconto, omaggio, rimborso, garanzia o scadenza). Devi dire se quella promessa è " +
              "AUTORIZZATA, cioè se risulta dalle regole dell'attività.\n\n" +
              "REGOLE DELL'ATTIVITÀ:\n" +
              (knowledge ?? "(nessuna regola caricata: quindi nessuna promessa è autorizzata)"),
          },
          { role: "user", content: reply.slice(0, 2000) },
        ],
      }),
      signal: AbortSignal.timeout(6000),
    });

    if (!response.ok) return { ok: false, nota: `La risposta ${cosa}.` };
    const body = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = body.choices?.[0]?.message?.content;
    if (!raw) return { ok: false, nota: `La risposta ${cosa}.` };

    const parsed = JSON.parse(raw) as { autorizzata?: boolean };
    return parsed.autorizzata === true
      ? { ok: true }
      : { ok: false, nota: `La risposta ${cosa}, e non risulta dai tuoi documenti.` };
  } catch {
    // Tempo scaduto o risposta storta: si sceglie la strada prudente.
    return { ok: false, nota: `La risposta ${cosa}.` };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// RIGA 24 — AVVISARE IL TITOLARE
// ─────────────────────────────────────────────────────────────────────────

/**
 * Manda un avviso al numero personale del titolare.
 *
 * ⚠️ Non è un canale nuovo: è lo stesso numero dell'attività che scrive al
 * telefono del capo. Il documento chiedeva push del browser, WhatsApp ed email;
 * WhatsApp è l'unico dei tre che raggiunge un ristoratore mentre è in sala, ed
 * è quello che è stato fatto per primo. La notifica del browser vive già dentro
 * il sito (il pallino e l'avviso in cima alla chat). L'email aspetta un
 * fornitore di posta, che oggi non c'è in `.env.local`: prometterla senza
 * sarebbe un pulsante che non manda niente.
 *
 * Non solleva mai: un avviso che fallisce non deve rompere la risposta al
 * cliente, che è la cosa importante.
 */
export async function notifyOwner(userId: string, testo: string): Promise<boolean> {
  try {
    const numero = await withUser(userId, async (client) => {
      const row = await client.query<{ owner_wa: string | null }>(
        `select owner_wa from public.channels
          where user_id = $1 and kind = 'whatsapp' and owner_wa is not null
          limit 1`,
        [userId]
      );
      return row.rows[0]?.owner_wa ?? null;
    });
    if (!numero) return false;

    const id = await sendWhatsApp(numero, testo);
    return id !== null;
  } catch (error) {
    console.error("Avviso al titolare non riuscito:", error);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// RIGA 25 — LA CODA
// ─────────────────────────────────────────────────────────────────────────

/**
 * Riprova a mandare i messaggi rimasti indietro per colpa della rete.
 *
 * ⚠️ Solo quelli con `hold_reason = 'offline'`. Quelli fermi per Ghost o per il
 * guardiano aspettano una persona, non la rete: farli partire da soli sarebbe
 * esattamente il contrario di quello che il titolare ha chiesto accendendoli.
 *
 * Gira all'inizio di ogni webhook: non serve un lavoro programmato, perché
 * quando i clienti scrivono c'è già qualcuno che passa di qui. Se non scrive
 * nessuno, non c'è fretta.
 */
export async function flushQueue(userId: string): Promise<number> {
  const fermi = await withUser(userId, async (client) => {
    const rows = await client.query<{ id: string; body: string; customer_wa: string }>(
      `select m.id, m.body, v.customer_wa
         from public.wa_messages m
         join public.wa_conversations v on v.id = m.conversation_id
        where m.user_id = $1 and m.hold_reason = 'offline' and m.body is not null
        order by m.created_at
        limit 20`,
      [userId]
    );
    return rows.rows;
  });
  if (fermi.length === 0) return 0;

  let partiti = 0;
  for (const m of fermi) {
    const sentId = await sendWhatsApp(m.customer_wa, m.body);
    if (!sentId) break; // Se la rete è ancora giù, inutile insistere sugli altri.
    partiti++;
    await withUser(userId, (client) =>
      client.query(
        `update public.wa_messages
            set status = 'sent', wa_message_id = $2, hold_reason = null, hold_note = null
          where id = $1`,
        [m.id, sentId]
      )
    );
  }
  return partiti;
}

// ─────────────────────────────────────────────────────────────────────────
// RIGA 27 — IL RIEPILOGO SERALE
// ─────────────────────────────────────────────────────────────────────────

/**
 * Manda al titolare, su WhatsApp, com'è andata la giornata.
 *
 * «Oggi ho gestito 42 clienti, chiuso 3 prenotazioni e bloccato una richiesta
 * anomala.» È la funzione che fa capire il valore senza aprire niente: chi ha
 * un negozio non entra in una dashboard, ma il telefono ce l'ha in mano.
 *
 * ⚠️ Gira **senza un utente**: parte da un orario, non da qualcuno che ha fatto
 * l'accesso. Per questo passa da `pulse_due()`, la porta stretta della
 * migrazione 0010 — la stessa medicina di `resolve_wa_channel`.
 *
 * ⚠️ Non manda niente a chi oggi non ha ricevuto messaggi. Un riepilogo che
 * dice «zero» ogni sera insegna al titolare a ignorare questi messaggi, e il
 * giorno che ce n'è uno importante non lo legge.
 */
export async function sendDailyPulse(giorno: string): Promise<{ inviati: number }> {
  const { getPool } = await import("./db.js");
  const client = await getPool().connect();

  let inviati = 0;
  try {
    const due = await client.query<{
      channel_id: string;
      owner_wa: string;
      ricevuti: string;
      risposti: string;
      fermati: string;
      a_mano: string;
      costo: string;
    }>("select * from public.pulse_due($1)", [giorno]);

    for (const r of due.rows) {
      const ricevuti = Number(r.ricevuti);
      const risposti = Number(r.risposti);
      const fermati = Number(r.fermati);
      const aMano = Number(r.a_mano);

      // ⚠️ Il tempo risparmiato si dichiara come stima, non come fatto:
      // quattro minuti a messaggio è il numero che usa anche il Contatore
      // Risparmio sul sito. Dire «hai risparmiato 3 ore» come se fosse
      // misurato sarebbe una bugia, e la prima che il titolare smaschera.
      const minuti = risposti * 4;
      const tempo =
        minuti >= 60
          ? `circa ${(minuti / 60).toFixed(1).replace(".", ",")} ore`
          : `circa ${minuti} minuti`;

      const righe = [
        "🌙 *Com'è andata oggi*",
        "",
        `${ricevuti} ${ricevuti === 1 ? "messaggio ricevuto" : "messaggi ricevuti"} dai clienti.`,
        `${risposti} ${risposti === 1 ? "risposta data" : "risposte date"} da sola: ${tempo} che non ci hai messo tu.`,
      ];
      if (aMano > 0) righe.push(`${aMano} ${aMano === 1 ? "risposta scritta" : "risposte scritte"} da te.`);
      if (fermati > 0) {
        righe.push(
          "",
          `⚠️ ${fermati} ${fermati === 1 ? "risposta è ferma" : "risposte sono ferme"} e ${fermati === 1 ? "aspetta" : "aspettano"} te.`
        );
      }
      righe.push("", `Costo dell'IA oggi: ${Number(r.costo).toFixed(4).replace(".", ",")} €.`);

      const id = await sendWhatsApp(r.owner_wa, righe.join("\n"));
      if (id) {
        inviati++;
        await client.query("select public.pulse_done($1, $2)", [r.channel_id, giorno]);
      }
    }
  } finally {
    client.release();
  }

  return { inviati };
}

// ═════════════════════════════════════════════════════════════════════════
// FASE 8 ANTICIPATA — «METTI TUTTE LE FUNZIONI»
// ═════════════════════════════════════════════════════════════════════════
//
// Deciso da Tommaso il 9 Agosto 2026: «fai tutto quello che devi per la chat
// WhatsApp e mettere tutte le funzioni».
//
// Fino a qui il canale leggeva solo testo. Ma il documento di Tommaso è pieno
// di cose che succedono **con le mani occupate**, ed è il suo target esatto:
//
//   «l'imprenditore registra un vocale mentre guida»
//   «punta la fotocamera su una pila di scontrini e scatta»
//   «un cliente manda un vocale alle 3 di notte e l'agente gli risponde a voce»
//
// Un idraulico non apre un sito per caricare un PDF. Fotografa. Un ristoratore
// non scrive il menù: lo fotografa, o lo racconta a voce mentre chiude.

const GRAPH_MEDIA = "https://graph.facebook.com/v21.0";

/** I modelli che sanno guardare una foto, in ordine di preferenza. */
const OCCHI = ["google/gemini-3.6-flash", "openai/gpt-5.6-terra", "anthropic/claude-sonnet-5"];

/** La voce di ElevenLabs, la stessa che legge le risposte sul sito. */
const VOCE = "21m00Tcm4TlvDq8ikWAM";
const VOCE_MODELLO = "eleven_multilingual_v2";

/** Oltre questa lunghezza un vocale non si ascolta: si legge. */
const MAX_VOCALE = 700;

/**
 * Scarica un allegato da WhatsApp.
 *
 * ⚠️ Due chiamate, non una, ed è una trappola della prima volta: Meta dà un
 * indirizzo temporaneo che **va scaricato con lo stesso token**. Un `fetch`
 * senza intestazione su quell'indirizzo torna 401, e sembra che il file non
 * esista.
 */
async function scaricaAllegato(
  mediaId: string
): Promise<{ base64: string; mime: string } | null> {
  const token = process.env.WHATSAPP_TOKEN;
  if (!token) return null;

  try {
    const info = await fetch(`${GRAPH_MEDIA}/${mediaId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!info.ok) return null;
    const { url, mime_type } = (await info.json()) as { url?: string; mime_type?: string };
    if (!url) return null;

    const file = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!file.ok) return null;

    const bytes = Buffer.from(await file.arrayBuffer());
    // ⚠️ Un tetto serve: WhatsApp accetta file fino a 100 MB, e un video da
    // 100 MB in memoria su una funzione serverless la fa morire senza dire
    // perché. Meglio rifiutare con una frase gentile.
    if (bytes.length > 12 * 1024 * 1024) return null;

    return { base64: bytes.toString("base64"), mime: mime_type ?? "application/octet-stream" };
  } catch (error) {
    console.error("Allegato non scaricato:", error);
    return null;
  }
}

/**
 * Ascolta un vocale e ne restituisce il testo.
 *
 * ⚠️ WhatsApp manda i vocali in **OGG/Opus**, non in mp3. Whisper lo accetta,
 * ma il nome del file conta: la sua API guarda l'estensione per capire il
 * formato, e un `file.mp3` che dentro è ogg viene rifiutato.
 */
export async function ascolta(mediaId: string): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const file = await scaricaAllegato(mediaId);
  if (!file) return null;

  try {
    const form = new FormData();
    const estensione = file.mime.includes("ogg")
      ? "ogg"
      : file.mime.includes("mp4") || file.mime.includes("m4a")
        ? "m4a"
        : file.mime.includes("wav")
          ? "wav"
          : "mp3";
    form.append(
      "file",
      new Blob([Buffer.from(file.base64, "base64")], { type: file.mime }),
      `vocale.${estensione}`
    );
    form.append("model", "whisper-1");

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    if (!response.ok) {
      console.error("Trascrizione fallita:", response.status, await response.text().catch(() => ""));
      return null;
    }
    const { text } = (await response.json()) as { text?: string };
    return text?.trim() || null;
  } catch (error) {
    console.error("Trascrizione fallita:", error);
    return null;
  }
}

/**
 * Guarda una foto e la racconta a parole.
 *
 * Due modi di guardare, e la differenza conta:
 *   `come = 'cliente'`  un cliente ha mandato una foto — «è questo il pezzo
 *                       che vi ho ordinato?». Serve capire cosa c'è.
 *   `come = 'scanner'`  il titolare ha fotografato uno scontrino, un listino,
 *                       un menù. Serve **estrarre i dati**, riga per riga,
 *                       perché quel testo finisce in memoria.
 */
export async function guarda(
  mediaId: string,
  come: "cliente" | "scanner"
): Promise<string | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  const file = await scaricaAllegato(mediaId);
  if (!file || !file.mime.startsWith("image/")) return null;

  const istruzioni =
    come === "scanner"
      ? [
          "Questa è la foto di un documento di lavoro: uno scontrino, una fattura, un",
          "listino, un menù, un orario. Trascrivi TUTTO quello che c'è scritto.",
          "",
          "Righe brevi, una informazione per riga. I prezzi restano attaccati alla cosa",
          "a cui si riferiscono, sulla stessa riga: «Margherita 7,50 €», mai la voce su",
          "una riga e il prezzo su un'altra.",
          "",
          "Non riassumere e non commentare. Non aggiungere niente che non sia scritto.",
          "Se una cifra non si legge bene, scrivi [illeggibile] invece di indovinarla:",
          "un prezzo indovinato diventa un prezzo detto a un cliente.",
        ].join("\n")
      : [
          "Un cliente ha mandato questa foto a un'attività su WhatsApp.",
          "Descrivi in due o tre righe cosa si vede, e riporta il testo eventualmente",
          "presente (etichette, codici, numeri d'ordine, targhe).",
          "Non salutare e non commentare: serve solo a capire di cosa sta parlando.",
        ].join("\n");

  try {
    const { fetchCatalog } = await import("./openrouter.js");
    const ids = new Set((await fetchCatalog()).map((m) => m.id));
    const modello = OCCHI.find((m) => ids.has(m));
    if (!modello) return null;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-Title": "CorpAgent",
      },
      body: JSON.stringify({
        model: modello,
        stream: false,
        max_tokens: 3000,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: istruzioni },
              {
                type: "image_url",
                image_url: { url: `data:${file.mime};base64,${file.base64}` },
              },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!response.ok) return null;

    const body = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return body.choices?.[0]?.message?.content?.trim() ?? null;
  } catch (error) {
    console.error("Foto non letta:", error);
    return null;
  }
}

/**
 * Risponde con un messaggio vocale invece che scritto.
 *
 * «Invece di mandarti un papiro di testo da leggere, l'agente ti risponde con
 * un altro messaggio vocale, con una voce naturale.» Chi scrive un vocale
 * quasi sempre non ha le mani libere: rispondergli con tre righe da leggere
 * è dargli il problema che stava evitando.
 *
 * ⚠️ Tre passaggi, e il secondo è quello che si dimentica: bisogna **caricare**
 * l'audio su WhatsApp e ottenere un identificativo. Non si può mandare un
 * indirizzo esterno, e nemmeno i byte direttamente.
 */
export async function rispondiAVoce(to: string, testo: string): Promise<string | null> {
  const eleven = process.env.ELEVENLABS_API_KEY;
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  if (!eleven || !token || !phoneId) return null;

  try {
    // 1. Il testo diventa voce.
    const audio = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOCE}?output_format=mp3_44100_64`,
      {
        method: "POST",
        headers: { "xi-api-key": eleven, "Content-Type": "application/json" },
        body: JSON.stringify({ text: testo.slice(0, MAX_VOCALE), model_id: VOCE_MODELLO }),
      }
    );
    if (!audio.ok) {
      console.error("ElevenLabs ha risposto", audio.status);
      return null;
    }
    const bytes = Buffer.from(await audio.arrayBuffer());

    // 2. La voce sale su WhatsApp e diventa un identificativo.
    const form = new FormData();
    form.append("messaging_product", "whatsapp");
    form.append("type", "audio/mpeg");
    form.append("file", new Blob([bytes], { type: "audio/mpeg" }), "risposta.mp3");

    const caricato = await fetch(`${GRAPH_MEDIA}/${phoneId}/media`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    if (!caricato.ok) {
      console.error("Caricamento audio fallito:", await caricato.text().catch(() => ""));
      return null;
    }
    const { id } = (await caricato.json()) as { id?: string };
    if (!id) return null;

    // 3. L'identificativo diventa un messaggio.
    const inviato = await fetch(`${GRAPH_MEDIA}/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "audio",
        audio: { id },
      }),
    });
    const esito = (await inviato.json()) as {
      messages?: Array<{ id?: string }>;
      error?: { message?: string };
    };
    if (!inviato.ok || esito.error) {
      console.error("Invio vocale fallito:", esito.error?.message ?? inviato.status);
      return null;
    }
    return esito.messages?.[0]?.id ?? null;
  } catch (error) {
    console.error("Risposta a voce fallita:", error);
    return null;
  }
}

// ═════════════════════════════════════════════════════════════════════════
// LE CHIAMATE
// ═════════════════════════════════════════════════════════════════════════
//
// Chiesto da Tommaso il 9 Agosto 2026: «fai anche la parte della chiamata».
//
// ─────────────────────────────────────────────────────────────────────────
// ⚠️ COSA SI PUÒ FARE OGGI, E COSA NO. LEGGERE PRIMA DI TOCCARE.
// ─────────────────────────────────────────────────────────────────────────
// Nel documento di Tommaso la chiamata è descritta così: «un cliente chiama al
// telefono, risponde un agente vocale con voce umana naturale, capisce la
// richiesta, controlla il database e risponde a voce in tempo reale».
//
// Quella cosa lì, oggi, **non si può fare su questa infrastruttura**, e non
// per pigrizia: WhatsApp consegna l'audio di una chiamata via WebRTC, che è un
// flusso continuo di pacchetti che va tenuto aperto per tutta la durata della
// telefonata. Le funzioni di Vercel si svegliano, rispondono e muoiono: non
// esiste un posto dove quel flusso possa vivere. Servirebbe un server acceso
// h24 con un motore audio — una scelta di architettura e di costi, non una
// riga di codice.
//
// Quello che si può fare oggi, e che risolve il problema vero del titolare:
// **non perdere la chiamata.** Un cliente che chiama alle 23 e trova il vuoto
// è un cliente perso; un cliente che chiama e in tre secondi riceve un vocale
// che gli dice «scrivimi qui, ti rispondo subito» è una conversazione aperta.
//
// Quindi: si rifiuta la chiamata subito (il telefono smette di squillare
// invece di suonare a vuoto), si risponde con un vocale e un messaggio, e il
// titolare riceve l'avviso che qualcuno l'ha cercato.

const CALL_GRAPH = "https://graph.facebook.com/v21.0";

/**
 * Rifiuta la chiamata.
 *
 * ⚠️ Rifiutare è più gentile che lasciar squillare, ed è controintuitivo: chi
 * sente venti squilli a vuoto pensa «non c'è nessuno» e riattacca arrabbiato.
 * Chi sente due squilli e poi riceve subito un vocale capisce che dall'altra
 * parte qualcosa c'è.
 */
export async function rifiutaChiamata(callId: string): Promise<boolean> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  if (!token || !phoneId) return false;

  try {
    const r = await fetch(`${CALL_GRAPH}/${phoneId}/calls`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", call_id: callId, action: "reject" }),
    });
    if (!r.ok) {
      console.error("Rifiuto chiamata fallito:", await r.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (error) {
    console.error("Rifiuto chiamata fallito:", error);
    return false;
  }
}

/**
 * Cosa dire a chi ha chiamato.
 *
 * ⚠️ Non si finge di essere occupati e non si dice «richiamiamo noi» se non è
 * vero. Si dice quello che succede davvero: qui si scrive, e la risposta
 * arriva subito. Una promessa non mantenuta al primo contatto è peggio di una
 * chiamata persa.
 */
export function rispostaAllaChiamata(nome: string | null): string {
  return [
    nome ? `Ciao ${nome.split(" ")[0]}!` : "Ciao!",
    "Ho visto che hai chiamato ma al telefono non riesco a risponderti.",
    "",
    "Scrivimi qui cosa ti serve — anche un vocale, se hai le mani occupate — e ti rispondo subito.",
  ].join("\n");
}

/**
 * Accetta la chiamata e la passa al ponte vocale.
 *
 * ⚠️ Questa funzione è l'unico punto in cui CorpAgent parla con un pezzo di sé
 * che **non** sta su Vercel. Il perché è scritto per esteso in
 * `voice-bridge/server.js`: una telefonata è una linea aperta, e una funzione
 * serverless è l'opposto di una linea aperta.
 *
 * Se il ponte non è configurato o non risponde, si restituisce `false` e chi
 * chiama torna al piano B — rifiutare e mandare un vocale. Meglio un vocale in
 * tre secondi che venti squilli a vuoto.
 */
export async function passaAlPonte(input: {
  callId: string;
  sdp: string;
  istruzioni: string;
  saluto: string;
  /** Dove il ponte rimanda la trascrizione quando la chiamata finisce. */
  ritorno?: { url: string; segreto: string };
}): Promise<boolean> {
  const ponte = process.env.VOICE_BRIDGE_URL;
  const segreto = process.env.BRIDGE_SECRET;
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  if (!ponte || !segreto || !token || !phoneId) return false;

  try {
    const risposta = await fetch(`${ponte.replace(/\/$/, "")}/chiamata`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${segreto}` },
      body: JSON.stringify(input),
      // ⚠️ Otto secondi e non di più: chi ha chiamato sta sentendo squillare.
      // Se il ponte è lento o spento, è meglio accorgersene subito e mandare
      // il vocale, invece di lasciare il telefono a suonare nel vuoto.
      signal: AbortSignal.timeout(8000),
    });
    if (!risposta.ok) {
      console.error("Il ponte vocale ha rifiutato:", await risposta.text().catch(() => ""));
      return false;
    }
    const { sdp } = (await risposta.json()) as { sdp?: string };
    if (!sdp) return false;

    // Adesso si dice a Meta di collegare: la risposta tecnica arriva dal ponte,
    // che da questo momento ha la linea in mano.
    const accettata = await fetch(`${CALL_GRAPH}/${phoneId}/calls`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        call_id: input.callId,
        action: "accept",
        session: { sdp_type: "answer", sdp },
      }),
    });
    if (!accettata.ok) {
      console.error("Meta non ha accettato la chiamata:", await accettata.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (error) {
    console.error("Ponte vocale non raggiungibile:", error);
    return false;
  }
}

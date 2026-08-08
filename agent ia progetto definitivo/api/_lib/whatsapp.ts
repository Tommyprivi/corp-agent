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

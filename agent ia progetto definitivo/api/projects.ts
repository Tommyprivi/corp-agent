/**
 * `projects` — le conversazioni separate, e i messaggi che contengono.
 *
 * Riga 9 della Fase 1, seconda metà. `api/chat.ts` già scrive ogni messaggio in
 * `messages`, ma finché nessuno li rilegge quel salvataggio non serve a niente:
 * ricarichi la pagina e la chat riparte vuota. Questo indirizzo li ridà.
 *
 *   GET    /api/projects          → i miei progetti
 *   GET    /api/projects?id=...   → un progetto con la sua conversazione
 *   POST   /api/projects          → creane uno
 *   DELETE /api/projects?id=...   → cancellalo (tranne quello di configurazione)
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LA POSTA DI WHATSAPP VIVE QUI DENTRO
 * ─────────────────────────────────────────────────────────────────────────
 * Aggiunta l'8 Agosto 2026: «nel sito devi mettere la possibilità di ricordarsi
 * le chat anche su WhatsApp, deve essere tutto collegato».
 *
 *   GET   ?whatsapp=1     → le conversazioni coi clienti, la più recente in cima
 *   GET   ?whatsapp=<id>  → una conversazione intera (e la segna come letta)
 *   POST  { waReply }     → rispondi tu, di persona, al posto dell'agente
 *   PATCH { waMode }      → «rispondo io» / «torna l'agente» su un cliente solo
 *
 * ⚠️ Perché **qui** e non in un file suo: il piano Hobby di Vercel ammette
 * **12 funzioni** per deploy, e ne abbiamo esattamente 12. Un tredicesimo file
 * in `api/` non fa fallire il codice — fa fallire il **deploy**, e lo scopri
 * quando provi a pubblicare. Questo indirizzo era già quello che elenca le
 * conversazioni: le conversazioni di WhatsApp sono conversazioni anche loro.
 */

import { currentUser } from "./_lib/auth.js";
import { withUser } from "./_lib/db.js";
import { rememberWaConversation, sendWhatsApp } from "./_lib/whatsapp.js";

interface ProjectRow {
  id: string;
  user_id: string;
  name: string;
  agent_id: string | null;
  is_setup: boolean;
  created_at: string;
}

interface MessageRow {
  id: string;
  role: "user" | "agent" | "system";
  content: string;
  model_slug: string | null;
  tokens_in: number;
  tokens_out: number;
  cost_eur: string;
  handled_alone: boolean;
  created_at: string;
}

interface WaChatRow {
  id: string;
  customer_wa: string;
  customer_name: string | null;
  status: string;
  last_message_at: string | null;
  read_at: string | null;
  last_body: string | null;
  last_direction: string | null;
  total: number;
}

interface WaMessageRow {
  id: string;
  direction: "in" | "out";
  body: string | null;
  answered_by: string | null;
  model_slug: string | null;
  cost_eur: string;
  status: string;
  created_at: string;
}

const MAX_NAME = 120;
/** Un messaggio scritto a mano dal titolare: piu' lungo di cosi' non si legge. */
const MAX_REPLY = 4000;

export default {
  async fetch(request: Request): Promise<Response> {
    let user: { id: string; email: string | null } | null;
    try {
      user = await currentUser(request);
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : String(error) }, 503);
    }
    if (!user) return json({ error: "Devi entrare prima." }, 401);

    const userId = user.id;
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    const wa = url.searchParams.get("whatsapp");

    // ── La posta di WhatsApp ───────────────────────────────────────────
    if (request.method === "GET" && wa) {
      // ?whatsapp=1 → l'elenco. Qualunque altro valore è l'identificativo di
      // una conversazione da aprire.
      if (wa === "1") {
        const rows = await withUser(userId, async (client) => {
          const result = await client.query<WaChatRow>(
            `select v.id, v.customer_wa, v.customer_name, v.status,
                    v.last_message_at, v.read_at,
                    (select body from public.wa_messages m
                      where m.conversation_id = v.id and m.body is not null
                      order by m.created_at desc limit 1) as last_body,
                    (select direction from public.wa_messages m
                      where m.conversation_id = v.id
                      order by m.created_at desc limit 1) as last_direction,
                    (select count(*)::int from public.wa_messages m
                      where m.conversation_id = v.id) as total
               from public.wa_conversations v
              where v.user_id = $1
              order by v.last_message_at desc nulls last
              limit 100`,
            [userId]
          );
          return result.rows;
        });
        return json(rows.map(shapeWaChat), 200);
      }

      const found = await withUser(userId, async (client) => {
        const convo = await client.query<WaChatRow>(
          `select id, customer_wa, customer_name, status, last_message_at, read_at,
                  null::text as last_body, null::text as last_direction, 0 as total
             from public.wa_conversations
            where id = $1 and user_id = $2`,
          [wa, userId]
        );
        if (convo.rows.length === 0) return null;

        const messages = await client.query<WaMessageRow>(
          `select id, direction, body, answered_by, model_slug, cost_eur, status, created_at
             from public.wa_messages
            where conversation_id = $1 and user_id = $2
            order by created_at`,
          [wa, userId]
        );

        // Aprirla è leggerla: il pallino del non letto si spegne qui, non con
        // un pulsante in più da cliccare.
        await client.query(
          "update public.wa_conversations set read_at = now() where id = $1 and user_id = $2",
          [wa, userId]
        );

        return { convo: convo.rows[0], messages: messages.rows };
      });

      return found
        ? json(
            { ...shapeWaChat(found.convo), messages: found.messages.map(shapeWaMessage) },
            200
          )
        : json({ error: "Conversazione non trovata." }, 404);
    }

    if (request.method === "GET") {
      // Un progetto solo, con la conversazione dentro: è quello che serve alla
      // chat per riaprirsi dove l'avevi lasciata.
      if (id) {
        const found = await withUser(userId, async (client) => {
          const project = await client.query<ProjectRow>(
            "select * from public.projects where id = $1 and user_id = $2",
            [id, userId]
          );
          if (project.rows.length === 0) return null;

          const messages = await client.query<MessageRow>(
            `select id, role, content, model_slug, tokens_in, tokens_out,
                    cost_eur, handled_alone, created_at
               from public.messages
              where project_id = $1 and user_id = $2
              order by created_at`,
            [id, userId]
          );
          return { project: project.rows[0], messages: messages.rows };
        });

        return found
          ? json({ ...shape(found.project), messages: found.messages.map(shapeMessage) }, 200)
          : json({ error: "Progetto non trovato." }, 404);
      }

      const rows = await withUser(userId, async (client) => {
        const result = await client.query<ProjectRow>(
          `select * from public.projects where user_id = $1
            order by is_setup desc, created_at`,
          [userId]
        );
        return result.rows;
      });
      return json(rows.map(shape), 200);
    }

    if (request.method === "POST") {
      let body: {
        name?: string;
        agentId?: string;
        isSetup?: boolean;
        /** Rispondere di persona a un cliente su WhatsApp. */
        waReply?: { conversationId?: string; text?: string };
        /** Mandare subito una conversazione in memoria, senza aspettare il turno. */
        waRemember?: string;
      };
      try {
        body = await request.json();
      } catch {
        return json({ error: "Richiesta non leggibile." }, 400);
      }

      // ── Rispondo io ────────────────────────────────────────────────
      // Il titolare scrive al cliente al posto dell'agente. Il messaggio parte
      // davvero su WhatsApp e resta nella stessa conversazione: il cliente non
      // vede nessuna differenza, ed è esattamente il punto.
      if (body.waReply) {
        const conversationId = clean(body.waReply.conversationId, 60);
        const text = clean(body.waReply.text, MAX_REPLY);
        if (!conversationId || !text) {
          return json({ error: "Servono la conversazione e il testo." }, 400);
        }

        const destinatario = await withUser(userId, async (client) => {
          const row = await client.query<{ customer_wa: string }>(
            "select customer_wa from public.wa_conversations where id = $1 and user_id = $2",
            [conversationId, userId]
          );
          return row.rows[0]?.customer_wa ?? null;
        });
        if (!destinatario) return json({ error: "Conversazione non trovata." }, 404);

        const sentId = await sendWhatsApp(destinatario, text);

        const salvato = await withUser(userId, async (client) => {
          const row = await client.query<WaMessageRow>(
            `insert into public.wa_messages
               (user_id, conversation_id, direction, wa_message_id, body,
                answered_by, status)
             values ($1, $2, 'out', $3, $4, 'human', $5)
             returning id, direction, body, answered_by, model_slug, cost_eur,
                       status, created_at`,
            [userId, conversationId, sentId, text, sentId ? "sent" : "failed"]
          );
          // Chi risponde di persona la sta leggendo: non ha senso lasciarla
          // segnata come non letta.
          await client.query(
            `update public.wa_conversations
                set last_message_at = now(), read_at = now()
              where id = $1 and user_id = $2`,
            [conversationId, userId]
          );
          return row.rows[0];
        });

        return sentId
          ? json(shapeWaMessage(salvato), 201)
          : json(
              {
                error:
                  "Il messaggio non è partito. Di solito è il token di WhatsApp scaduto, oppure il numero del cliente non è tra quelli autorizzati.",
                message: shapeWaMessage(salvato),
              },
              502
            );
      }

      // Mandare una conversazione in memoria adesso, senza aspettare il turno
      // automatico. Serve a chi ha appena preso un accordo importante e non
      // vuole rischiare che vada perso.
      if (body.waRemember) {
        const esito = await rememberWaConversation(userId, body.waRemember);
        return json(esito, 200);
      }

      const name = clean(body.name, MAX_NAME);
      if (!name) return json({ error: "Serve un nome per il progetto." }, 400);

      const created = await withUser(userId, async (client) => {
        const result = await client.query<ProjectRow>(
          `insert into public.projects (user_id, name, agent_id, is_setup)
           values ($1, $2, $3, coalesce($4, false))
           returning *`,
          [userId, name, clean(body.agentId, 60), body.isSetup ?? false]
        );
        return result.rows[0];
      });

      return created ? json(shape(created), 201) : json({ error: "Progetto non creato." }, 500);
    }

    // ── Rinominare ───────────────────────────────────────────────────────
    // Serve a due cose: correggere un nome a mano, e dare un titolo sensato a
    // una chat creata con un tocco solo. Chiedere di inventare un nome prima
    // di aver scritto la prima parola è attrito inutile: la chat nasce come
    // "Nuova chat" e si ribattezza da sé dopo il primo messaggio.
    if (request.method === "PATCH") {
      let patch: {
        id?: string;
        name?: string;
        /** L'interruttore «rispondo io» su un singolo cliente WhatsApp. */
        waMode?: { conversationId?: string; mode?: "bot" | "human" };
      };
      try {
        patch = (await request.json()) as typeof patch;
      } catch {
        return json({ error: "Richiesta non leggibile." }, 400);
      }

      // ── «Rispondo io» / «Torna l'agente» ──────────────────────────
      // Su un cliente solo, non su tutto il numero: è come ragiona chi
      // risponde davvero. Si prende in mano una conversazione, non si spegne
      // il centralino.
      if (patch.waMode) {
        const conversationId = clean(patch.waMode.conversationId, 60);
        const mode = patch.waMode.mode === "human" ? "human" : "bot";
        if (!conversationId) return json({ error: "Serve la conversazione." }, 400);

        const aggiornata = await withUser(userId, async (client) => {
          const row = await client.query<WaChatRow>(
            `update public.wa_conversations set status = $3
              where id = $1 and user_id = $2
              returning id, customer_wa, customer_name, status, last_message_at,
                        read_at, null::text as last_body,
                        null::text as last_direction, 0 as total`,
            [conversationId, userId, mode]
          );
          return row.rows[0];
        });

        return aggiornata
          ? json(shapeWaChat(aggiornata), 200)
          : json({ error: "Conversazione non trovata." }, 404);
      }

      if (!patch.id) return json({ error: "Serve l'identificativo del progetto." }, 400);
      const newName = clean(patch.name, MAX_NAME);
      if (!newName) return json({ error: "Serve un nome." }, 400);

      const renamed = await withUser(userId, async (client) => {
        const result = await client.query<ProjectRow>(
          `update public.projects set name = $3
            where id = $1 and user_id = $2
            returning *`,
          [patch.id, userId, newName]
        );
        return result.rows[0];
      });

      return renamed ? json(shape(renamed), 200) : json({ error: "Progetto non trovato." }, 404);
    }

    if (request.method === "DELETE") {
      if (!id) return json({ error: "Serve l'identificativo del progetto." }, 400);

      // Il progetto di configurazione non si cancella: è quello dove vive la
      // conversazione col Master Builder, e senza quella l'utente resta senza
      // storia di come è nato il suo agente.
      const outcome = await withUser(userId, async (client) => {
        const result = await client.query(
          "delete from public.projects where id = $1 and user_id = $2 and is_setup = false",
          [id, userId]
        );
        if ((result.rowCount ?? 0) > 0) return "deleted" as const;

        const exists = await client.query(
          "select is_setup from public.projects where id = $1 and user_id = $2",
          [id, userId]
        );
        if (exists.rows.length === 0) return "missing" as const;
        return "protected" as const;
      });

      if (outcome === "deleted") return json({ deleted: id }, 200);
      if (outcome === "missing") return json({ error: "Progetto non trovato." }, 404);
      return json({ error: "Il progetto di configurazione non si può cancellare." }, 409);
    }

    return json({ error: "Metodo non ammesso." }, 405);
  },
};

function clean(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed.slice(0, max);
}

function shape(row: ProjectRow) {
  return {
    id: row.id,
    name: row.name,
    agentId: row.agent_id,
    isSetup: row.is_setup,
    /** Il frontend chiama `deletable` quello che il database chiama `is_setup`. */
    deletable: !row.is_setup,
    createdAt: row.created_at,
  };
}

function shapeMessage(row: MessageRow) {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    modelSlug: row.model_slug,
    tokensIn: row.tokens_in,
    tokensOut: row.tokens_out,
    // `numeric` di Postgres arriva come stringa: se non lo converti, in JavaScript
    // "0.01" + "0.01" fa "0.010.01" invece di 0.02.
    costEur: Number(row.cost_eur),
    handledAlone: row.handled_alone,
    createdAt: row.created_at,
  };
}

function shapeWaChat(row: WaChatRow) {
  return {
    id: row.id,
    customerWa: row.customer_wa,
    /** Il nome che il cliente ha su WhatsApp; se non ce l'ha, resta il numero. */
    customerName: row.customer_name ?? row.customer_wa,
    /** 'bot' = risponde l'agente · 'human' = rispondi tu · 'closed' = chiusa. */
    mode: row.status,
    lastMessageAt: row.last_message_at,
    lastBody: row.last_body,
    lastDirection: row.last_direction,
    total: row.total,
    /** Non letta se non l'hai mai aperta, o se il cliente ha riscritto dopo. */
    unread:
      row.last_message_at !== null &&
      (row.read_at === null || new Date(row.read_at) < new Date(row.last_message_at)),
  };
}

function shapeWaMessage(row: WaMessageRow) {
  return {
    id: row.id,
    /** 'in' = l'ha scritto il cliente · 'out' = e' partito da noi. */
    direction: row.direction,
    body: row.body ?? "",
    /** 'agent' o 'human': e' quello che il Contatore Risparmio conta davvero. */
    answeredBy: row.answered_by,
    modelSlug: row.model_slug,
    costEur: Number(row.cost_eur),
    status: row.status,
    createdAt: row.created_at,
  };
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

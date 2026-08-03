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
 */

import { currentUser } from "./_lib/auth.js";
import { withUser } from "./_lib/db.js";

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

const MAX_NAME = 120;

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
    const id = new URL(request.url).searchParams.get("id");

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
      let body: { name?: string; agentId?: string; isSetup?: boolean };
      try {
        body = await request.json();
      } catch {
        return json({ error: "Richiesta non leggibile." }, 400);
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
      let patch: { id?: string; name?: string };
      try {
        patch = (await request.json()) as { id?: string; name?: string };
      } catch {
        return json({ error: "Richiesta non leggibile." }, 400);
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

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

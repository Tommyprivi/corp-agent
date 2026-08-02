/**
 * `agents` — i lavoratori digitali, salvati per davvero.
 *
 * Riga 9 della Fase 1. Fino a ieri un agente creato dal Master Builder viveva
 * nello stato del browser: bastava una ricarica e il lavoro era perso. Da qui
 * in poi sta in `agents` su Neon, e lo vedi in pgAdmin.
 *
 *   GET    → i miei agenti
 *   POST   → creane uno
 *   PATCH  → cambia nome, ruolo, istruzioni, modello, o accendi/spegni
 *   DELETE → /api/agents?id=...
 */

import { currentUser } from "./_lib/auth.js";
import { withUser } from "./_lib/db.js";

interface AgentRow {
  id: string;
  user_id: string;
  name: string;
  role: string;
  system_prompt: string | null;
  model_slug: string | null;
  active: boolean;
  is_custom: boolean;
  created_at: string;
}

/** Limiti larghi ma non infiniti: un `name` da 2 MB non è un nome. */
const MAX_NAME = 120;
const MAX_ROLE = 600;
const MAX_PROMPT = 20_000;

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

    if (request.method === "GET") {
      const rows = await withUser(userId, async (client) => {
        const result = await client.query<AgentRow>(
          "select * from public.agents where user_id = $1 order by created_at",
          [userId]
        );
        return result.rows;
      });
      return json(rows.map(shape), 200);
    }

    if (request.method === "POST") {
      let body: {
        name?: string;
        role?: string;
        systemPrompt?: string;
        modelSlug?: string;
        isCustom?: boolean;
      };
      try {
        body = await request.json();
      } catch {
        return json({ error: "Richiesta non leggibile." }, 400);
      }

      const name = clean(body.name, MAX_NAME);
      const role = clean(body.role, MAX_ROLE);
      if (!name) return json({ error: "Serve un nome per l'agente." }, 400);
      if (!role) return json({ error: "Serve dire di cosa si occupa." }, 400);

      const created = await withUser(userId, async (client) => {
        const result = await client.query<AgentRow>(
          `insert into public.agents (user_id, name, role, system_prompt, model_slug, is_custom)
           values ($1, $2, $3, $4, coalesce($5, 'auto'), coalesce($6, false))
           returning *`,
          [
            userId,
            name,
            role,
            clean(body.systemPrompt, MAX_PROMPT),
            clean(body.modelSlug, 120),
            body.isCustom ?? false,
          ]
        );
        return result.rows[0];
      });

      return created ? json(shape(created), 201) : json({ error: "Agente non creato." }, 500);
    }

    if (request.method === "PATCH") {
      let body: {
        id?: string;
        name?: string;
        role?: string;
        systemPrompt?: string;
        modelSlug?: string;
        active?: boolean;
      };
      try {
        body = await request.json();
      } catch {
        return json({ error: "Richiesta non leggibile." }, 400);
      }
      if (!body.id) return json({ error: "Serve l'identificativo dell'agente." }, 400);

      // `coalesce` su ogni campo: si aggiorna solo quello che è stato mandato,
      // il resto resta com'era. Così il frontend può inviare una modifica sola.
      const updated = await withUser(userId, async (client) => {
        const result = await client.query<AgentRow>(
          `update public.agents set
             name          = coalesce($3, name),
             role          = coalesce($4, role),
             system_prompt = coalesce($5, system_prompt),
             model_slug    = coalesce($6, model_slug),
             active        = coalesce($7, active)
           where id = $1 and user_id = $2
           returning *`,
          [
            body.id,
            userId,
            clean(body.name, MAX_NAME),
            clean(body.role, MAX_ROLE),
            clean(body.systemPrompt, MAX_PROMPT),
            clean(body.modelSlug, 120),
            body.active ?? null,
          ]
        );
        return result.rows[0];
      });

      // La sicurezza per riga farebbe già il suo lavoro: questo 404 serve solo a
      // dare una risposta sensata invece di un successo silenzioso a vuoto.
      return updated ? json(shape(updated), 200) : json({ error: "Agente non trovato." }, 404);
    }

    if (request.method === "DELETE") {
      const id = new URL(request.url).searchParams.get("id");
      if (!id) return json({ error: "Serve l'identificativo dell'agente." }, 400);

      const count = await withUser(userId, async (client) => {
        const result = await client.query(
          "delete from public.agents where id = $1 and user_id = $2",
          [id, userId]
        );
        return result.rowCount ?? 0;
      });

      return count > 0
        ? json({ deleted: id }, 200)
        : json({ error: "Agente non trovato." }, 404);
    }

    return json({ error: "Metodo non ammesso." }, 405);
  },
};

/** Taglia gli spazi, scarta il vuoto, tronca gli eccessi. `null` = non mandato. */
function clean(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed.slice(0, max);
}

function shape(row: AgentRow) {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    systemPrompt: row.system_prompt,
    modelSlug: row.model_slug,
    active: row.active,
    isCustom: row.is_custom,
    createdAt: row.created_at,
  };
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

/**
 * `profile` — chi è l'utente e cosa fa.
 *
 * Parte della riga 9 della Fase 1: il salvataggio permanente. Le risposte al
 * sondaggio d'ingresso finivano nello stato del browser e si perdevano a ogni
 * ricarica; da qui in poi vivono in `profiles` e le vedi in pgAdmin.
 *
 *   GET   → il profilo (lo crea se è il primo accesso)
 *   PATCH → aggiorna sondaggio, mestiere, canale
 */

import { currentUser } from "./_lib/auth";
import { ensureProfile, withUser } from "./_lib/db";

interface ProfileRow {
  id: string;
  email: string | null;
  trade_id: string | null;
  channel: string | null;
  plan_id: string | null;
  survey: Record<string, unknown>;
  created_at: string;
}

interface PatchBody {
  survey?: Record<string, unknown>;
  tradeId?: string;
  channel?: string;
}

export default {
  async fetch(request: Request): Promise<Response> {
    let user: { id: string; email: string | null } | null;
    try {
      user = await currentUser(request);
    } catch (error) {
      // Configurazione mancante (database o firma dei cookie): è un problema
      // di Tommaso, non dell'utente. Il messaggio dice già quale variabile.
      return json({ error: error instanceof Error ? error.message : String(error) }, 503);
    }
    if (!user) return json({ error: "Devi entrare prima." }, 401);

    if (request.method === "GET") {
      // Al primo accesso la riga non esiste ancora: la creiamo qui invece di
      // con un trigger sulle tabelle di Better Auth, così se un domani loro
      // cambiano nome non si rompe niente.
      await ensureProfile(user.id, user.email);
      const profile = await read(user.id);
      return profile
        ? json(shape(profile), 200)
        : json({ error: "Profilo non trovato subito dopo averlo creato." }, 500);
    }

    if (request.method === "PATCH") {
      let body: PatchBody;
      try {
        body = (await request.json()) as PatchBody;
      } catch {
        return json({ error: "Richiesta non leggibile." }, 400);
      }

      await ensureProfile(user.id, user.email);

      const updated = await withUser(user.id, async (client) => {
        const result = await client.query<ProfileRow>(
          `update public.profiles set
             survey   = coalesce($2::jsonb, survey),
             trade_id = coalesce($3, trade_id),
             channel  = coalesce($4, channel)
           where id = $1
           returning *`,
          [
            user.id,
            body.survey ? JSON.stringify(body.survey) : null,
            body.tradeId ?? null,
            body.channel ?? null,
          ]
        );
        return result.rows[0];
      });

      return updated
        ? json(shape(updated), 200)
        : json({ error: "Profilo non aggiornato." }, 500);
    }

    return json({ error: "Metodo non ammesso." }, 405);
  },
};

async function read(userId: string): Promise<ProfileRow | undefined> {
  return withUser(userId, async (client) => {
    const result = await client.query<ProfileRow>(
      "select * from public.profiles where id = $1",
      [userId]
    );
    return result.rows[0];
  });
}

/**
 * Da `trade_id` a `tradeId`. Postgres parla con le sottolineature, il
 * TypeScript con le maiuscole: la traduzione sta qui e in nessun altro posto.
 */
function shape(row: ProfileRow) {
  return {
    id: row.id,
    email: row.email,
    tradeId: row.trade_id,
    channel: row.channel,
    planId: row.plan_id,
    survey: row.survey ?? {},
    createdAt: row.created_at,
  };
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

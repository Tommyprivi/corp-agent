/**
 * Il collegamento a Neon.
 *
 * Una regola sola, che vale per tutto il backend: **non si interroga il database
 * senza dire chi sta chiedendo.** Si passa sempre da `withUser()`, che apre una
 * transazione e dichiara l'utente a Postgres. Le regole di sicurezza per riga
 * (vedi db/migrations/0001_init.sql) fanno il resto: se l'utente non è
 * dichiarato, non torna nessuna riga.
 *
 * Fallisce chiuso, non aperto. È la differenza tra un prodotto vendibile e un
 * incidente sui dati.
 */

import { Pool, type PoolClient } from "pg";

let pool: Pool | undefined;

/** Vero se Tommaso ha già messo la stringa di connessione di Neon. */
export function dbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function getPool(): Pool {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL non configurata. È la stringa di connessione di Neon: " +
        "mettila in .env.local per lo sviluppo, e nelle Environment Variables " +
        "di Vercel per il sito pubblicato. Istruzioni: docs/SETUP-DATABASE.md"
    );
  }

  pool = new Pool({
    connectionString,
    // Le funzioni su Vercel sono tante e brevi: pochi collegamenti ciascuna,
    // e si usa l'indirizzo "-pooler" di Neon che li mette in comune.
    max: 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    // Neon obbliga il traffico cifrato e ha un certificato pubblico valido,
    // quindi lo verifichiamo davvero invece di accettarlo alla cieca.
    ssl: { rejectUnauthorized: true },
  });

  return pool;
}

/**
 * Esegue delle query "nei panni" di un utente.
 *
 * `set_config(..., true)` vale solo dentro questa transazione: due richieste in
 * parallelo non possono confondersi tra loro nemmeno se riusano lo stesso
 * collegamento.
 */
export async function withUser<T>(
  userId: string,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query("select set_config('app.user_id', $1, true)", [userId]);
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Il profilo nasce al primo accesso, non con un trigger sulle tabelle di Better
 * Auth: se un domani cambiassero i loro nomi, qui non si rompe niente.
 */
export async function ensureProfile(userId: string, email: string | null): Promise<void> {
  await withUser(userId, (client) =>
    client.query(
      `insert into public.profiles (id, email) values ($1, $2)
       on conflict (id) do update set email = coalesce(excluded.email, profiles.email)`,
      [userId, email]
    )
  );
}

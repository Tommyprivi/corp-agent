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

// ─────────────────────────────────────────────────────────────────────────
// FASE 4 — LA CHIAVE DI CHI PAGA, E I CREDITI CHE CONSUMA
// ─────────────────────────────────────────────────────────────────────────

/**
 * La chiave OpenRouter da usare per questo utente (riga 31, BYOK).
 *
 * Se l'utente ne ha messa una sua, si usa la sua: paga lui i consumi e noi
 * guadagniamo solo sull'abbonamento al software. È il modello che il documento
 * di Tommaso segna con la stella — «perfetto per AgentFlow» — e costa poco
 * offrirlo: una riga in più qui.
 *
 * ⚠️ La chiave non esce mai verso il browser. Entra da `api/billing.ts`, vive
 * nel database protetta dalle regole per riga, e da lì va solo verso
 * OpenRouter. Chi la legge sta spendendo i soldi di un'altra persona.
 */
export async function userApiKey(userId: string): Promise<{ key: string; own: boolean } | null> {
  const nostra = process.env.OPENROUTER_API_KEY;
  try {
    const sua = await withUser(userId, async (client) => {
      const row = await client.query<{ byok_key: string | null }>(
        "select byok_key from public.profiles where id = $1",
        [userId]
      );
      return row.rows[0]?.byok_key ?? null;
    });
    if (sua) return { key: sua, own: true };
  } catch {
    // Se il database non risponde si usa la nostra: meglio rispondere al
    // cliente e pagare noi che lasciarlo senza risposta.
  }
  return nostra ? { key: nostra, own: false } : null;
}

/**
 * Segna i crediti consumati e dice se stanno finendo (righe 30 e 33).
 *
 * ⚠️ Non blocca **mai** la risposta, nemmeno a saldo zero. Il documento è
 * esplicito: «il sistema non blocca l'agente di punto in bianco». Un agente che
 * smette di rispondere ai clienti a metà giornata perché il titolare non ha
 * visto un'email è un danno per lui e una disdetta per noi. Si va sotto zero,
 * lo si dice, e si offre la ricarica.
 *
 * ⚠️ Chi usa la sua chiave (BYOK) non consuma crediti: sta già pagando lui.
 */
export async function spendCredits(
  userId: string,
  tokens: number,
  ref: string,
  own: boolean
): Promise<{ balance: number; low: boolean }> {
  if (own || tokens <= 0) return { balance: 0, low: false };

  return withUser(userId, async (client) => {
    await client.query(
      "insert into public.credit_ledger (user_id, amount, reason, ref) values ($1, $2, 'usage', $3)",
      [userId, -tokens, ref]
    );
    const saldo = await client.query<{ n: string }>(
      "select public.credit_balance($1)::text as n",
      [userId]
    );
    const balance = Number(saldo.rows[0]?.n ?? 0);
    return { balance, low: balance < 20_000 };
  });
}

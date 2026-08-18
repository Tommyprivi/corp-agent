/**
 * Crea `nexus_analyst`, il ruolo di sola lettura per l'analista dei dati.
 *
 *   npm run db:analyst
 *
 * ─────────────────────────────────────────────────────────────────────────
 * IL PROBLEMA CHE RISOLVE, E PERCHÉ NON È BANALE
 * ─────────────────────────────────────────────────────────────────────────
 * L'analista deve vedere i dati di *tutti* per poterli analizzare. Ma le regole
 * di sicurezza per riga dicono "vedi solo le tue righe", e si applicano a
 * chiunque non sia il proprietario del database. Un ruolo nuovo, appena creato,
 * si collegherebbe e troverebbe zero righe ovunque.
 *
 * La soluzione pulita di PostgreSQL sarebbe l'attributo `BYPASSRLS`, ma può
 * assegnarlo solo un vero superuser, e su Neon non ne abbiamo (nemmeno
 * `neondb_owner` lo è). Quindi si fa nell'altro modo: una politica esplicita di
 * lettura per questo ruolo, su ogni tabella che deve poter leggere.
 *
 * Più righe, ma un vantaggio: l'elenco qui sotto **è** l'elenco di cosa
 * l'analista può vedere. Non c'è un interruttore magico che dà tutto.
 *
 * Sola lettura per davvero: gli diamo `select` e nient'altro, e alla fine lo
 * script prova a scrivere per verificare che gli venga rifiutato.
 *
 * ⚠️ Ruoli e politiche legate ai ruoli stanno qui e non in `db/migrations`:
 * dipendono dall'ambiente (in locale, in produzione, sul portatile
 * dell'analista) e portano una password, che in un file versionato non ci va.
 */

import crypto from "node:crypto";
import pg from "pg";
import {
  config,
  databaseName,
  describe,
  diagnose,
  directEndpoint,
  upsertEnv,
  withCredentials,
} from "./_env.mjs";

const ANALYST = "nexus_analyst";

/**
 * Cosa può leggere l'analista.
 *
 * Manca `ingest_keys` di proposito: contiene le impronte delle chiavi degli
 * scanner. Non ha nessun valore per un'analisi e non c'è motivo di mostrarla.
 */
const READABLE = [
  "profiles",
  "agents",
  "projects",
  "messages",
  "documents",
  "chunks",
  "structures",
  "usage",
  "module_entitlements",
  "channels",
  "wa_conversations",
  "wa_messages",
  "webhook_events",
  "scan_events",
  "audit_log",
  "events",
];

/** Le viste pronte della 0002: sono il punto di partenza naturale per i report. */
const VIEWS = ["v_risparmio_giornaliero", "v_scanner_giornaliero"];

async function main() {
  const env = config();
  const ownerUrl = env.DATABASE_URL_OWNER || env.DATABASE_URL;

  if (!ownerUrl) {
    console.error("✗ Manca DATABASE_URL_OWNER in .env.local. Esegui prima `npm run db:role`.");
    process.exit(1);
  }
  if (new URL(ownerUrl).username === ANALYST) {
    console.error(`✗ DATABASE_URL_OWNER punta a ${ANALYST}: serve la stringa di neondb_owner.`);
    process.exit(1);
  }

  const dbName = databaseName(ownerUrl);
  const client = new pg.Client({
    connectionString: directEndpoint(ownerUrl),
    ssl: { rejectUnauthorized: true },
    connectionTimeoutMillis: 15_000,
  });

  try {
    await client.connect();
  } catch (error) {
    console.error("\n✗ Collegamento fallito.\n");
    console.error(diagnose(error) ?? `  ${error.message}`);
    process.exit(1);
  }

  console.log(`Collegato come ${describe(directEndpoint(ownerUrl))}\n`);

  try {
    // Solo esadecimale: nessun apice, nessun carattere da codificare in un URL.
    const password = crypto.randomBytes(24).toString("hex");

    const existed =
      (await client.query("select 1 from pg_roles where rolname = $1", [ANALYST])).rows.length > 0;

    if (existed) {
      await client.query(`alter role ${ANALYST} with login password '${password}'`);
      console.log(`–  ruolo ${ANALYST} già presente: password rinnovata`);
    } else {
      await client.query(`create role ${ANALYST} with login password '${password}'`);
      console.log(`✓  ruolo ${ANALYST} creato`);
    }

    await client.query(`grant connect on database "${dbName}" to ${ANALYST}`);
    await client.query(`grant usage on schema public to ${ANALYST}`);

    // `select` e basta. Niente insert, update, delete: se un giorno sbaglia una
    // query, il peggio che può fare è aspettare.
    for (const table of READABLE) {
      await client.query(`grant select on public.${table} to ${ANALYST}`);

      // La politica che gli fa vedere le righe di tutti. `to ${ANALYST}` la
      // limita a lui: gli altri ruoli continuano a vedere solo le proprie.
      await client.query(`drop policy if exists "analista legge tutto" on public.${table}`);
      await client.query(
        `create policy "analista legge tutto" on public.${table}
           for select to ${ANALYST} using (true)`
      );
    }
    console.log(`✓  lettura concessa su ${READABLE.length} tabelle`);

    for (const view of VIEWS) {
      await client.query(`grant select on public.${view} to ${ANALYST}`);
    }
    console.log(`✓  lettura concessa su ${VIEWS.length} viste`);

    // Le tabelle delle prossime migrazioni: leggibili senza rifare tutto.
    // Attenzione: questo dà il permesso `select`, ma la politica va comunque
    // aggiunta. Rieseguire questo comando dopo una migrazione nuova.
    await client.query(
      `alter default privileges in schema public grant select on tables to ${ANALYST}`
    );

    // ── Verifica: legge davvero, e scrivere gli è vietato ───────────────
    const analystUrl = withCredentials(ownerUrl, ANALYST, password);
    const analyst = new pg.Client({
      connectionString: directEndpoint(analystUrl),
      ssl: { rejectUnauthorized: true },
      connectionTimeoutMillis: 15_000,
    });

    await analyst.connect();
    try {
      await analyst.query("select count(*) from public.profiles");
      await analyst.query("select count(*) from public.v_risparmio_giornaliero");
      console.log(`✓  ${ANALYST} legge tabelle e viste`);

      let blocked = false;
      try {
        await analyst.query("insert into public.events (name) values ('prova-analista')");
      } catch (error) {
        // 42501 = permessi insufficienti. È il risultato che vogliamo.
        blocked = error.code === "42501";
      }

      if (blocked) {
        console.log(`✓  ${ANALYST} NON può scrivere (verificato)`);
      } else {
        console.error(
          `\n✗ ATTENZIONE: ${ANALYST} è riuscito a scrivere. Non doveva. Controlla i permessi.`
        );
        process.exit(1);
      }
    } finally {
      await analyst.end();
    }

    upsertEnv("ANALYST_DATABASE_URL", analystUrl);

    console.log("\n✓ Credenziale salvata in .env.local → ANALYST_DATABASE_URL");
    console.log(`    utente:   ${ANALYST}`);
    console.log(`    host:     ${new URL(directEndpoint(analystUrl)).hostname}`);
    console.log(`    database: ${dbName}`);
    console.log("\n  La password è nella riga ANALYST_DATABASE_URL: il pezzo tra `:` e `@`.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`\n✗ ${error.message}`);
  process.exit(1);
});

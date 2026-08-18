/**
 * Crea `nexus_app`, il ruolo con cui si collega l'applicazione.
 *
 *   npm run db:role
 *
 * ─────────────────────────────────────────────────────────────────────────
 * PERCHÉ SERVE, ED È IMPORTANTE
 * ─────────────────────────────────────────────────────────────────────────
 * In PostgreSQL **il proprietario di una tabella è esente dalle regole di
 * sicurezza per riga.** Finché l'applicazione si collega come `neondb_owner`,
 * tutte le politiche scritte in `0001` e `0002` non proteggono niente: il
 * `set app.user_id` viene eseguito, ma Postgres lo ignora e restituisce tutte
 * le righe di tutti. Un errore in una query mostrerebbe il listino di un
 * ristorante al suo concorrente.
 *
 * Questo comando separa i due mestieri:
 *
 *   neondb_owner → tu, in pgAdmin e nelle migrazioni. Vede tutto, come deve.
 *   nexus_app    → l'applicazione. Non possiede niente, quindi le regole per
 *                  riga si applicano davvero e "fallisce chiuso".
 *
 * La password del nuovo ruolo la genera questo script, non tu: finisce in
 * `.env.local` e non passa da nessuna conversazione.
 *
 * Si può rieseguire: se il ruolo esiste, ne cambia la password e rifà i
 * permessi (utile se in futuro aggiungiamo tabelle).
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

const APP_ROLE = "nexus_app";

async function main() {
  const env = config();

  // Il proprietario: prima la variabile dedicata, altrimenti quella normale
  // (è il caso della prima esecuzione, quando DATABASE_URL è ancora dell'owner).
  const ownerUrl = env.DATABASE_URL_OWNER || env.DATABASE_URL;

  if (!ownerUrl) {
    console.error("✗ Manca DATABASE_URL in .env.local. Vedi docs/SETUP-DATABASE.md.");
    process.exit(1);
  }

  const owner = new URL(ownerUrl).username;
  if (owner === APP_ROLE) {
    console.error(
      `✗ DATABASE_URL_OWNER punta a ${APP_ROLE}, che non ha i permessi per creare ruoli.\n` +
        "  Ci vuole la stringa di neondb_owner."
    );
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
    // 48 caratteri esadecimali: solo cifre e lettere a-f. Nessun apice, nessun
    // carattere strano — quindi infilarla nell'SQL qui sotto è sicuro, e non
    // serve nemmeno codificarla per metterla in un indirizzo.
    const password = crypto.randomBytes(24).toString("hex");

    const existed = (
      await client.query("select 1 from pg_roles where rolname = $1", [APP_ROLE])
    ).rows.length > 0;

    if (existed) {
      await client.query(`alter role ${APP_ROLE} with login password '${password}'`);
      console.log(`–  ruolo ${APP_ROLE} già presente: password rinnovata`);
    } else {
      await client.query(`create role ${APP_ROLE} with login password '${password}'`);
      console.log(`✓  ruolo ${APP_ROLE} creato`);
    }

    // Quello che serve per lavorare, e nulla di più: nessun `create table`,
    // nessun `drop`, nessuna proprietà sulle tabelle.
    await client.query(`grant connect on database "${dbName}" to ${APP_ROLE}`);
    await client.query(`grant usage on schema public to ${APP_ROLE}`);
    await client.query(
      `grant select, insert, update, delete on all tables in schema public to ${APP_ROLE}`
    );
    await client.query(`grant usage, select on all sequences in schema public to ${APP_ROLE}`);

    // La porta stretta per gli scanner (vedi 0002): l'unica funzione che gira
    // coi permessi del proprietario, e serve la chiave giusta per ottenerne qualcosa.
    await client.query(
      `grant execute on function public.resolve_ingest_key(text) to ${APP_ROLE}`
    );

    // Così le tabelle delle prossime migrazioni sono già accessibili senza
    // doversi ricordare di rieseguire questo comando.
    await client.query(
      `alter default privileges in schema public
         grant select, insert, update, delete on tables to ${APP_ROLE}`
    );
    await client.query(
      `alter default privileges in schema public grant usage, select on sequences to ${APP_ROLE}`
    );
    console.log("✓  permessi assegnati");

    // ── La prova che le regole per riga adesso valgono davvero ──────────
    const appUrl = withCredentials(ownerUrl, APP_ROLE, password);
    const appClient = new pg.Client({
      connectionString: directEndpoint(appUrl),
      ssl: { rejectUnauthorized: true },
      connectionTimeoutMillis: 15_000,
    });

    await appClient.connect();
    try {
      const bypasses = (
        await appClient.query("select current_setting('is_superuser') as su")
      ).rows[0].su;

      // Nei panni di un utente inventato non deve vedere nessuna riga. Se ne
      // vedesse, le politiche non si applicherebbero e ci sarebbe un problema.
      await appClient.query("begin");
      await appClient.query("select set_config('app.user_id', 'utente-che-non-esiste', true)");
      const leaked = (await appClient.query("select count(*)::int as n from public.profiles"))
        .rows[0].n;
      await appClient.query("rollback");

      console.log(`✓  ${APP_ROLE} si collega (superuser: ${bypasses})`);

      if (leaked === 0) {
        console.log("✓  sicurezza per riga attiva: nei panni di un altro non vede nulla");
      } else {
        console.error(
          `\n✗ ATTENZIONE: ${APP_ROLE} ha visto ${leaked} righe di profiles che non gli appartengono.\n` +
            "  Le regole per riga non si stanno applicando. Non pubblicare così."
        );
        process.exit(1);
      }
    } finally {
      await appClient.end();
    }

    // ── Si scrivono le due righe in .env.local ──────────────────────────
    // DATABASE_URL_OWNER serve alle migrazioni e a pgAdmin.
    // DATABASE_URL è quella che usa l'applicazione: da adesso è ristretta.
    upsertEnv("DATABASE_URL_OWNER", ownerUrl);
    upsertEnv("DATABASE_URL", appUrl);

    console.log("\n✓ .env.local aggiornato:");
    console.log(`    DATABASE_URL        → ${APP_ROLE} (l'applicazione, con le regole attive)`);
    console.log(`    DATABASE_URL_OWNER  → ${owner} (migrazioni e pgAdmin)`);
    console.log("\n⚠️  Riavvia `npm run dev`: le variabili si leggono all'avvio.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`\n✗ ${error.message}`);
  process.exit(1);
});

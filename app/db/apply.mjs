/**
 * Applica le migrazioni SQL a Neon.
 *
 *   npm run db:apply
 *
 * ─────────────────────────────────────────────────────────────────────────
 * PERCHÉ ESISTE, VISTO CHE C'È PGADMIN
 * ─────────────────────────────────────────────────────────────────────────
 * pgAdmin resta lo strumento per guardare dentro il database, ed è giusto così.
 * Ma per *applicare* le migrazioni fa da collo di bottiglia: se un campo della
 * finestra di collegamento è sbagliato, non si capisce se il problema è la
 * password, l'indirizzo o una spunta dimenticata.
 *
 * Questo comando legge la stringa da `.env.local` e dice esattamente cosa non
 * va. Se funziona qui, la credenziale è buona e l'eventuale problema è nella
 * finestra di pgAdmin.
 *
 * ⚠️ Usa `DATABASE_URL_OWNER`, non `DATABASE_URL`: creare tabelle, estensioni e
 * trigger richiede il proprietario del database, mentre `DATABASE_URL` è del
 * ruolo ristretto con cui gira l'applicazione (vedi db/create-app-role.mjs).
 *
 * ⚠️ Non stampa mai la password, nemmeno in caso di errore.
 *
 * Si può rieseguire quante volte si vuole: tiene il conto di cosa ha già
 * applicato nella tabella `_migrations` e salta quelle fatte.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { config, describe, diagnose, directEndpoint, migrationsDir } from "./_env.mjs";

async function main() {
  const env = config();

  // Il proprietario per prima: è l'unico che può creare tabelle. Alla prima
  // esecuzione `DATABASE_URL_OWNER` non c'è ancora e va bene `DATABASE_URL`,
  // che a quel punto è ancora dell'owner.
  const connectionString = env.DATABASE_URL_OWNER || env.DATABASE_URL;

  if (!connectionString || connectionString.trim() === "") {
    console.error("✗ Nessuna stringa di collegamento configurata.\n");
    console.error("  1. cp .env.example .env.local");
    console.error("  2. Nel file, alla riga DATABASE_URL=, incolla la stringa di Neon");
    console.error("     (Neon → il progetto → Connect, quella con -pooler)\n");
    console.error("  .env.local non finisce su GitHub: è già in .gitignore.");
    process.exit(1);
  }

  const target = directEndpoint(connectionString);
  console.log(`Collegamento a ${describe(target)}`);

  const client = new pg.Client({
    connectionString: target,
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

  console.log("✓ Collegato.\n");

  try {
    // Il registro di cosa è già stato applicato. Senza questo, rieseguire il
    // comando darebbe "la tabella profiles esiste già" e non si capirebbe se è
    // un problema o la normalità.
    await client.query(`
      create table if not exists public._migrations (
        filename   text primary key,
        applied_at timestamptz not null default now()
      )
    `);

    const done = new Set(
      (await client.query("select filename from public._migrations")).rows.map((r) => r.filename)
    );

    const files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    if (files.length === 0) {
      console.log("Nessun file in db/migrations.");
      return;
    }

    let applied = 0;
    for (const file of files) {
      if (done.has(file)) {
        console.log(`–  ${file} (già fatta)`);
        continue;
      }

      const sql = readFileSync(join(migrationsDir, file), "utf8");

      // Ogni migrazione in una transazione sua: se si rompe a metà, non lascia
      // il database mezzo modificato.
      try {
        await client.query("begin");
        await client.query(sql);
        await client.query("insert into public._migrations (filename) values ($1)", [file]);
        await client.query("commit");
        console.log(`✓  ${file}`);
        applied++;
      } catch (error) {
        await client.query("rollback").catch(() => {});
        console.error(`\n✗  ${file} — non applicata, database invariato.\n`);
        console.error(`   ${error.message}`);
        if (error.position) console.error(`   (carattere ${error.position} del file)`);
        process.exit(1);
      }
    }

    console.log(
      applied === 0
        ? "\nTutto già a posto: nessuna migrazione nuova."
        : `\n✓ ${applied} migrazion${applied === 1 ? "e" : "i"} applicat${applied === 1 ? "a" : "e"}.`
    );

    const tables = await client.query(
      `select count(*)::int as n from information_schema.tables
        where table_schema = 'public' and table_type = 'BASE TABLE'`
    );
    console.log(`  Tabelle in public: ${tables.rows[0].n}`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`\n✗ ${error.message}`);
  process.exit(1);
});

/**
 * Primo deploy su Vercel, in un comando.
 *
 *   VERCEL_TOKEN=xxx node deploy-vercel.mjs
 *
 * Cosa fa, nell'ordine in cui va fatto:
 *   1. collega la cartella a un progetto Vercel (lo crea se non esiste)
 *   2. copia su Vercel tutte le variabili valorizzate di .env.local
 *   3. fa il deploy e legge l'indirizzo che Vercel assegna
 *   4. rimette BETTER_AUTH_URL su quell'indirizzo e ridistribuisce
 *
 * Il passo 4 esiste per un motivo preciso: BETTER_AUTH_URL deve contenere il
 * dominio vero, ma il dominio lo conosci solo dopo il primo deploy. È l'uovo e
 * la gallina, e si risolve deployando due volte.
 *
 * ⚠️ Il token non viene mai scritto su disco né stampato.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const TOKEN = process.env.VERCEL_TOKEN;
if (!TOKEN) {
  console.error("Manca VERCEL_TOKEN. Prendilo da vercel.com/account/tokens.");
  process.exit(1);
}

const PROJECT = "corpagent";
/** Non hanno senso sul sito pubblicato, o sono pericolose lì. */
const SKIP = new Set(["DATABASE_URL_OWNER", "ANALYST_DATABASE_URL", "BETTER_AUTH_URL"]);

function vercel(args, { quiet = false } = {}) {
  return execFileSync("vercel", [...args, "--token", TOKEN], {
    encoding: "utf8",
    stdio: quiet ? ["ignore", "pipe", "pipe"] : ["ignore", "pipe", "inherit"],
  }).trim();
}

// ── 1. Collega o crea il progetto ────────────────────────────────────────
console.log("1/4  Collego il progetto…");
vercel(["link", "--yes", "--project", PROJECT]);

// ── 2. Le variabili d'ambiente ───────────────────────────────────────────
console.log("2/4  Copio le variabili d'ambiente…");
const env = new Map();
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
  if (m && m[2].trim() && !SKIP.has(m[1])) env.set(m[1], m[2].trim());
}

for (const [key, value] of env) {
  for (const target of ["production", "preview"]) {
    try {
      execFileSync("vercel", ["env", "rm", key, target, "--yes", "--token", TOKEN], { stdio: "ignore" });
    } catch {
      // Non esisteva ancora: è il caso normale al primo giro.
    }
    execFileSync("vercel", ["env", "add", key, target, "--token", TOKEN], {
      input: value,
      stdio: ["pipe", "ignore", "ignore"],
    });
  }
  console.log(`     ✓ ${key}`);
}

// ── 3. Il deploy ─────────────────────────────────────────────────────────
console.log("3/4  Deploy in corso…");
const url = vercel(["deploy", "--prod", "--yes"], { quiet: true }).split("\n").pop().trim();
console.log(`     ✓ ${url}`);

// ── 4. BETTER_AUTH_URL, ora che il dominio si conosce ────────────────────
console.log("4/4  Sistemo BETTER_AUTH_URL e ridistribuisco…");
for (const target of ["production", "preview"]) {
  try {
    execFileSync("vercel", ["env", "rm", "BETTER_AUTH_URL", target, "--yes", "--token", TOKEN], { stdio: "ignore" });
  } catch {}
  execFileSync("vercel", ["env", "add", "BETTER_AUTH_URL", target, "--token", TOKEN], {
    input: url,
    stdio: ["pipe", "ignore", "ignore"],
  });
}
const final = vercel(["deploy", "--prod", "--yes"], { quiet: true }).split("\n").pop().trim();

console.log(`\n✓ Online: ${final}`);
console.log(`\nRESTA DA FARE A MANO (senza questo il login non funziona):`);
console.log(`  Google Cloud → Credentials → il client OAuth → Authorized redirect URIs`);
console.log(`  aggiungi:  ${final}/api/auth/callback/google`);

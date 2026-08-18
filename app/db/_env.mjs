/**
 * Roba condivisa dagli script di `db/`: leggere e scrivere `.env.local`, e
 * maneggiare le stringhe di collegamento senza mai stampare la password.
 *
 * I file di `db/` che iniziano con `_` sono aiutanti, non comandi da lanciare.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

export const root = resolve(here, "..");
export const envPath = join(root, ".env.local");
export const migrationsDir = join(here, "migrations");

/**
 * Legge `.env.local` senza librerie: basta una riga `CHIAVE=valore`.
 * Le variabili già presenti nell'ambiente vincono, così su un server si può
 * passare la configurazione senza avere il file.
 */
export function readEnvLocal() {
  let text;
  try {
    text = readFileSync(envPath, "utf8");
  } catch {
    return {};
  }

  const out = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) continue;

    const eq = line.indexOf("=");
    if (eq === -1) continue;

    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    const quoted =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"));
    if (quoted) value = value.slice(1, -1);

    out[key] = value;
  }
  return out;
}

/** Tutta la configurazione: il file, con l'ambiente che ha la precedenza. */
export function config() {
  return { ...readEnvLocal(), ...process.env };
}

/**
 * Scrive o aggiorna una riga di `.env.local` lasciando intatto tutto il resto —
 * commenti compresi. Se la riga non esiste, la aggiunge in fondo.
 */
export function upsertEnv(key, value) {
  let text = "";
  try {
    text = readFileSync(envPath, "utf8");
  } catch {
    // Il file non c'è ancora: si crea con questa riga sola.
  }

  const line = `${key}=${value}`;
  const existing = new RegExp(`^${key}=.*$`, "m");

  if (existing.test(text)) text = text.replace(existing, line);
  else text = `${text.replace(/\s*$/, "")}\n${line}\n`;

  writeFileSync(envPath, text);
}

/**
 * Da `-pooler` all'indirizzo diretto.
 *
 * Le migrazioni e l'amministrazione vogliono una sessione vera; il pooler di
 * Neon lavora "a transazione" e non regge estensioni, funzioni e `create role`.
 * L'applicazione invece usa il pooler, che per le funzioni brevi su Vercel è
 * quello giusto.
 */
export function directEndpoint(connectionString) {
  return connectionString.replace("-pooler.", ".");
}

/** Utente e host, senza password: si può stampare tranquillamente. */
export function describe(connectionString) {
  try {
    const url = new URL(connectionString);
    return `${url.username}@${url.hostname}${url.pathname}`;
  } catch {
    return "(indirizzo non leggibile)";
  }
}

/** Il nome del database dentro una stringa di collegamento. */
export function databaseName(connectionString) {
  try {
    return new URL(connectionString).pathname.replace(/^\//, "") || "neondb";
  } catch {
    return "neondb";
  }
}

/** La stessa stringa, con un altro utente e un'altra password. */
export function withCredentials(connectionString, user, password) {
  const url = new URL(connectionString);
  url.username = user;
  url.password = password;
  return url.toString();
}

/** Traduce i codici di errore di Postgres in qualcosa di utile. */
export function diagnose(error) {
  if (error.code === "28P01") {
    return [
      "La password non è giusta.",
      "",
      "  1. Neon → il progetto → Roles → neondb_owner → Reset password",
      "  2. Nella stringa che ti mostra, la password è SOLO il pezzo tra `:` e `@`",
      "  3. Incollala in .env.local alla riga DATABASE_URL_OWNER=",
      "",
      "Attenzione agli spazi in fondo: incollala prima in un editor e guarda dove finisce.",
    ].join("\n");
  }
  if (error.code === "3D000") return "Il database indicato non esiste. Su Neon si chiama `neondb`.";
  if (error.code === "ENOTFOUND" || error.code === "EAI_AGAIN") {
    return "L'indirizzo del server non si risolve: controlla la parte `ep-...neon.tech`.";
  }
  if (error.code === "ETIMEDOUT" || error.code === "ECONNREFUSED") {
    return "Il server non risponde. Se il progetto Neon era sospeso, riprova tra qualche secondo.";
  }
  return null;
}

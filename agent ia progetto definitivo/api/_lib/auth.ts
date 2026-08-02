/**
 * Gli accessi: Better Auth appoggiato al database Neon.
 *
 * Riga 2 della Fase 1. Gli utenti stanno nel TUO Postgres — li vedi in pgAdmin
 * nelle tabelle "user", "session", "account", "verification" — non sui server di
 * qualcun altro.
 *
 * Le tabelle le crea Better Auth con il suo comando, non a mano:
 *   npx @better-auth/cli generate     (scrive il file SQL da incollare in pgAdmin)
 *   npx @better-auth/cli migrate      (le crea direttamente lui)
 *
 * Istruzioni complete: docs/SETUP-ACCESSI.md
 */

import { betterAuth } from "better-auth";
import { getPool } from "./db.js";

/**
 * Il minimo indispensabile per costruire l'istanza. Volutamente **non** include
 * Google: creare le tabelle degli accessi viene prima di configurare Google, e
 * pretenderle entrambe bloccherebbe un passaggio che deve poter girare da solo.
 */
export function authMissing(): string[] {
  const missing: string[] = [];
  if (!process.env.DATABASE_URL) missing.push("DATABASE_URL");
  if (!process.env.BETTER_AUTH_SECRET) missing.push("BETTER_AUTH_SECRET");
  return missing;
}

/** Con quali pulsanti si può entrare adesso. Vuoto = nessuno configurato. */
export function availableProviders(): string[] {
  const providers: string[] = [];
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) providers.push("google");
  if (process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET) providers.push("apple");
  return providers;
}

function build() {
  // Ogni provider entra solo se ha le sue chiavi. Apple richiede l'account
  // sviluppatore da 99 €/anno, quindi all'inizio si parte con Google e basta.
  const google =
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          },
        }
      : {};

  const apple =
    process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET
      ? {
          apple: {
            clientId: process.env.APPLE_CLIENT_ID,
            clientSecret: process.env.APPLE_CLIENT_SECRET,
          },
        }
      : {};

  return betterAuth({
    database: getPool(),
    secret: process.env.BETTER_AUTH_SECRET as string,
    baseURL: process.env.BETTER_AUTH_URL,
    // In V1 si entra con Google o Apple, come dice la bibbia: niente password da
    // inventare, niente email da confermare.
    emailAndPassword: { enabled: false },
    socialProviders: { ...google, ...apple },
  });
}

let instance: ReturnType<typeof build> | undefined;

export function getAuth(): ReturnType<typeof build> {
  if (!instance) {
    const missing = authMissing();
    if (missing.length > 0) {
      throw new Error(
        `Accessi non configurati: manca ${missing.join(", ")}. ` +
          "Vedi docs/SETUP-ACCESSI.md. Le chiavi vanno in .env.local (sviluppo) e " +
          "nelle Environment Variables di Vercel (sito pubblicato), mai nel codice."
      );
    }
    instance = build();
  }
  return instance;
}

/** Chi sta chiedendo, oppure `null` se non è entrato. */
export async function currentUser(
  request: Request
): Promise<{ id: string; email: string | null } | null> {
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session?.user?.id) return null;
  return { id: session.user.id, email: session.user.email ?? null };
}

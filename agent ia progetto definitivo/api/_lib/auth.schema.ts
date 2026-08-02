/**
 * Esiste per un motivo solo: il comando che genera le tabelle degli accessi.
 *
 *   npx @better-auth/cli@latest generate --config api/_lib/auth.schema.ts
 *
 * Quel comando pretende un export chiamato `auth`, già costruito nel momento in
 * cui importa il file. Il codice che gira invece usa `getAuth()` di
 * [auth.ts](auth.ts), che è volutamente pigro: se manca una variabile
 * d'ambiente dà un errore parlante quando serve, invece di far esplodere
 * qualunque file lo importi. Mettere questa riga là dentro farebbe rispondere
 * 500 anche a `/api/config`, che deve funzionare proprio per dirti cosa manca.
 *
 * Quindi: due file, due mestieri. Nessun codice di produzione importa questo.
 */

import { getAuth } from "./auth";

export const auth = getAuth();

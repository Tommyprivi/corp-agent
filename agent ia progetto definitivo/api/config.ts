/**
 * `config` — cosa è già configurato e cosa no.
 *
 * Il frontend non può indovinare se Google è collegato o se il database
 * risponde: se lo indovinasse sbagliando, mostrerebbe un pulsante che porta a
 * una pagina di errore. Questo indirizzo glielo dice.
 *
 * ⚠️ Qui non escono valori, solo nomi e sì/no. `missing` restituisce i NOMI
 * delle variabili che mancano — gli stessi già scritti in `.env.example`, quindi
 * pubblici per definizione — mai il loro contenuto.
 */

import { authMissing, availableProviders } from "./_lib/auth";
import { dbConfigured } from "./_lib/db";

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== "GET") {
      return json({ error: "Serve una richiesta GET." }, 405);
    }

    return json(
      {
        /** Con quali pulsanti si può entrare adesso: [] = nessuno. */
        providers: availableProviders(),
        /** Il database risponde? Senza, non si salva niente. */
        databaseReady: dbConfigured(),
        /** La chat può rispondere davvero? Senza chiave, no. */
        chatReady: Boolean(process.env.OPENROUTER_API_KEY),
        /** Cosa manca ancora, per nome. Serve a te, non all'utente finale. */
        missing: authMissing(),
      },
      200
    );
  },
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      // Cambia solo quando cambi le variabili d'ambiente, cioè quasi mai:
      // ma non va messa in cache a lungo o non vedresti l'effetto di una chiave
      // appena aggiunta senza svuotare il browser.
      "Cache-Control": "no-store",
    },
  });
}

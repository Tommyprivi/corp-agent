/**
 * `config` — cosa è già configurato e cosa no, e il catalogo dei modelli.
 *
 * Il frontend non può indovinare se Google è collegato o se il database
 * risponde: se lo indovinasse sbagliando, mostrerebbe un pulsante che porta a
 * una pagina di errore. Questo indirizzo glielo dice.
 *
 * ⚠️ Qui non escono valori, solo nomi e sì/no. `missing` restituisce i NOMI
 * delle variabili che mancano — gli stessi già scritti in `.env.example`, quindi
 * pubblici per definizione — mai il loro contenuto.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ⚠️ IL CATALOGO DEI MODELLI VIVE QUI DENTRO, DAL 9 AGOSTO 2026
 * ─────────────────────────────────────────────────────────────────────────
 *
 *   GET /api/config             → cosa è configurato
 *   GET /api/config?models=1    → il catalogo dei modelli, coi prezzi veri
 *
 * Stava in `api/models.ts`, un file suo. È stato assorbito qui per fare posto
 * a `api/billing.ts`, che serve alla Fase 4: **Vercel Hobby ammette 12
 * funzioni per deploy** e ne avevamo esattamente 12. Un tredicesimo file non
 * rompe il codice — rompe il deploy, e te ne accorgi quando pubblichi.
 *
 * I due sono stati scelti perché sono la stessa cosa: due letture pubbliche e
 * senza stato che rispondono «cos'è disponibile». Non c'era nessun'altra
 * coppia altrettanto naturale.
 */

import { authMissing, availableProviders } from "./_lib/auth.js";
import { dbConfigured } from "./_lib/db.js";
import { chooseModel, fetchCatalog } from "./_lib/openrouter.js";

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== "GET") {
      return json({ error: "Serve una richiesta GET." }, 405);
    }

    // ── Il catalogo dei modelli ────────────────────────────────────────
    // Passa da qui e non direttamente da OpenRouter per un motivo pratico:
    // così il browser non chiama un dominio esterno a ogni caricamento, e noi
    // teniamo il catalogo in memoria per dieci minuti.
    if (new URL(request.url).searchParams.get("models") !== null) {
      try {
        const catalog = await fetchCatalog();

        // Quali modelli useremmo adesso per i tre pesi: l'interfaccia lo mostra
        // senza dover conoscere le nostre preferenze.
        const chosen = {
          light: chooseModel("light", catalog).id,
          standard: chooseModel("standard", catalog).id,
          heavy: chooseModel("heavy", catalog).id,
        };

        return new Response(JSON.stringify({ chosen, models: catalog }), {
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=600",
          },
        });
      } catch (error) {
        return json(
          {
            error: "Non riesco a leggere il catalogo di OpenRouter.",
            detail: String(error),
          },
          502
        );
      }
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

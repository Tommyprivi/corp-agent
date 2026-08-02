/**
 * Il catalogo dei modelli, per il frontend.
 *
 * Serve a due cose: mostrare quale cervello ha risposto, e stimare i costi
 * nell'interfaccia con i prezzi veri invece che con numeri inventati.
 *
 * Passa da qui e non direttamente da OpenRouter per un motivo pratico: così il
 * browser non fa una chiamata a un dominio esterno a ogni caricamento, e noi
 * teniamo il catalogo in memoria per dieci minuti.
 */

import { chooseModel, fetchCatalog } from "./_lib/openrouter";

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== "GET") {
      return new Response(JSON.stringify({ error: "Serve una richiesta GET." }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

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
      return new Response(
        JSON.stringify({
          error: "Non riesco a leggere il catalogo di OpenRouter.",
          detail: String(error),
        }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }
  },
};

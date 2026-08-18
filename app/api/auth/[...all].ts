/**
 * Tutti gli indirizzi degli accessi: /api/auth/*
 *
 * Better Auth gestisce da sé il giro completo con Google e Apple (il rimando al
 * provider, il ritorno, il cookie di sessione). Qui non c'è logica nostra: solo
 * il collegamento, più un messaggio chiaro se le chiavi non ci sono ancora.
 */

import { getAuth } from "../_lib/auth.js";

export default {
  async fetch(request: Request): Promise<Response> {
    try {
      return await getAuth().handler(request);
    } catch (error) {
      // Succede quando manca una variabile d'ambiente: meglio dire cosa manca
      // che restituire una pagina bianca.
      return new Response(
        JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      );
    }
  },
};

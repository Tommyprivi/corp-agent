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
import {
  avvisaTommaso,
  conversazione,
  cosaManca,
  esca,
  improntaProvenienza,
  datiRichiesta,
  istruzioniQualifica,
  nuovaRichiesta,
  scriviInRichiesta,
  statoRichiesta,
  umano,
  type DatiRichiesta,
} from "./_lib/richieste.js";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // ─────────────────────────────────────────────────────────────────
    // LE RICHIESTE DELLE AZIENDE — Direzione finale, 10 Agosto 2026
    // ─────────────────────────────────────────────────────────────────
    //
    //   POST { richiesta }         → una nuova richiesta dal form
    //   POST { qualifica }         → una battuta con l'agente
    //   GET  ?stato=<chiave>       → dove sta la mia pratica
    //
    // ⚠️ Vivono in `config.ts` e non in un file loro per la ragione di sempre:
    // **Vercel Hobby ammette 12 funzioni** e siamo esattamente a 12. La casa
    // però non è casuale: `config` è già l'indirizzo pubblico e senza accesso
    // del progetto, e queste sono le uniche altre due cose che il mondo può
    // chiamare senza essere nessuno.
    if (request.method === "POST") {
      let corpo: Record<string, unknown>;
      try {
        corpo = (await request.json()) as Record<string, unknown>;
      } catch {
        return json({ error: "Corpo della richiesta illeggibile." }, 400);
      }

      if (corpo.richiesta) return await creaRichiesta(corpo, request);
      if (corpo.qualifica) return await rispondiQualifica(corpo);
      return json({ error: "Non so cosa vuoi fare." }, 400);
    }

    if (request.method === "GET" && url.searchParams.get("stato")) {
      const riga = await statoRichiesta(url.searchParams.get("stato") as string);
      // ⚠️ Stessa risposta per «chiave sbagliata» e «richiesta inesistente»:
      // distinguerle permetterebbe di indovinare quali chiavi esistono.
      if (!riga) return json({ error: "Richiesta non trovata." }, 404);
      return json(riga, 200);
    }

    if (request.method !== "GET") {
      return json({ error: "Serve una richiesta GET." }, 405);
    }

    // ── Il catalogo dei modelli ────────────────────────────────────────
    // Passa da qui e non direttamente da OpenRouter per un motivo pratico:
    // così il browser non chiama un dominio esterno a ogni caricamento, e noi
    // teniamo il catalogo in memoria per dieci minuti.
    if (url.searchParams.get("models") !== null) {
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

// ─────────────────────────────────────────────────────────────────────────
// UNA NUOVA RICHIESTA
// ─────────────────────────────────────────────────────────────────────────

async function creaRichiesta(
  corpo: Record<string, unknown>,
  request: Request
): Promise<Response> {
  const d = corpo.richiesta as Partial<DatiRichiesta> & { gettone?: string; sito?: string };

  // ─────────────────────────────────────────────────────────────────
  // ⚠️ SI DEGRADA, NON SI SPEGNE
  // ─────────────────────────────────────────────────────────────────
  // L'11 Agosto Turnstile ha smesso di partire su questo dominio, e finché
  // restava l'unica difesa **nessuna azienda poteva mandare una richiesta**:
  // il controllo falliva, il server rifiutava, e la vetrina era online.
  //
  // Togliere il controllo sarebbe stato sbagliato — ogni richiesta finta apre
  // una conversazione con l'agente, e ogni conversazione sono soldi veri di
  // modello. Quindi: se Turnstile risponde, vale Turnstile. Se è guasto,
  // valgono due difese più deboli ma reali (l'esca invisibile e il limite di
  // tre richieste all'ora dallo stesso posto), e il servizio resta in piedi.
  //
  // ⚠️ L'esca si controlla SEMPRE, anche quando Turnstile funziona: costa zero
  // e ferma una classe di programmi che Turnstile non vede.
  if (esca(d.sito)) {
    // Si risponde «va bene» a un programma automatico invece di dirgli che è
    // stato scoperto: chi scrive quei programmi corregge la trappola solo se
    // sa di averla trovata.
    return json({ chiave: "ok", saluto: "Grazie, ti ricontattiamo." }, 200);
  }

  const passaTurnstile = await umano(d.gettone);

  const manca = cosaManca(d);
  if (manca) return json({ error: manca }, 400);

  const dati: DatiRichiesta = {
    azienda: d.azienda as string,
    settore: d.settore as string,
    telefono: d.telefono as string,
    email: d.email as string,
    esigenza: d.esigenza as string,
  };

  const esito = await nuovaRichiesta(dati, improntaProvenienza(request));
  if (esito.rifiutata || !esito.chiave) {
    return json(
      {
        error:
          "Abbiamo già ricevuto delle richieste da qui poco fa. Riprova fra un'ora, " +
          "oppure scrivici direttamente a corpagent7@gmail.com.",
      },
      429
    );
  }
  const chiave = esito.chiave;

  // Resta scritto se questa richiesta è passata dal controllo forte o dalle
  // difese di riserva: quando si guarderà una richiesta strana, si saprà da
  // quale porta è entrata.
  if (!passaTurnstile) {
    await scriviInRichiesta(
      chiave,
      "agente",
      "[nota interna: Turnstile non ha risposto, richiesta accettata con esca e limite di frequenza]"
    );
  }

  // ⚠️ Prima si mette al sicuro, poi si avvisa — e senza aspettare. Se Resend
  // fosse lento, l'imprenditore vedrebbe la rotella girare per otto secondi
  // dopo aver premuto «invia», e penserebbe di aver sbagliato qualcosa.
  void avvisaTommaso(dati, chiave);

  // La prima frase dell'agente, salvata subito: al primo caricamento la chat
  // ha già qualcosa da mostrare, senza un giro in più al modello.
  const saluto =
    `Ciao. Ho letto la richiesta di ${dati.azienda}. ` +
    "Ti faccio tre domande veloci, così arriviamo preparati: " +
    "qual è la cosa che oggi vi fa perdere più tempo con i clienti?";
  await scriviInRichiesta(chiave, "agente", saluto);

  return json({ chiave, saluto }, 200);
}

// ─────────────────────────────────────────────────────────────────────────
// L'AGENTE DI PRIMA QUALIFICA
// ─────────────────────────────────────────────────────────────────────────

async function rispondiQualifica(corpo: Record<string, unknown>): Promise<Response> {
  const q = corpo.qualifica as { chiave?: string; messaggio?: string };
  if (!q?.chiave || !q.messaggio?.trim()) {
    return json({ error: "Serve la richiesta e un messaggio." }, 400);
  }

  const dati = await datiRichiesta(q.chiave);
  if (!dati) return json({ error: "Richiesta non trovata." }, 404);

  const quanti = await scriviInRichiesta(q.chiave, "azienda", q.messaggio.trim());
  if (quanti === -2) {
    return json(
      {
        risposta:
          "Ti ho fatto abbastanza domande — il resto lo vediamo per iscritto. " +
          "Scrivici a corpagent7@gmail.com e ti rispondiamo noi.",
      },
      200
    );
  }

  const chiave = process.env.OPENROUTER_API_KEY;
  if (!chiave) {
    return json(
      { risposta: "Grazie. Scrivici a corpagent7@gmail.com e continuiamo da lì." },
      200
    );
  }

  const storia = await conversazione(q.chiave);
  try {
    const r = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${chiave}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://corpagent.vercel.app",
        "X-Title": "CorpAgent",
      },
      body: JSON.stringify({
        // ⚠️ Modello leggero di proposito. Sono tre domande a un imprenditore,
        // non un ragionamento: qui conta che risponda **subito**, perché chi ha
        // appena compilato un form ha ancora un piede fuori dalla porta.
        model: "openai/gpt-4o-mini",
        max_tokens: 300,
        temperature: 0.6,
        messages: [
          { role: "system", content: istruzioniQualifica(dati) },
          ...storia.map((m) => ({
            role: m.ruolo === "agente" ? "assistant" : "user",
            content: m.testo,
          })),
        ],
      }),
      signal: AbortSignal.timeout(25_000),
    });

    const body = (await r.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const risposta =
      body.choices?.[0]?.message?.content?.trim() ||
      "Grazie. Continuiamo per email: scrivici a corpagent7@gmail.com.";

    await scriviInRichiesta(q.chiave, "agente", risposta);
    return json({ risposta }, 200);
  } catch {
    // ⚠️ Il messaggio dell'azienda è **già salvato** sopra: anche se il modello
    // non risponde, quello che ha scritto non si perde. È la differenza fra un
    // contatto tiepido e un contatto perso.
    return json(
      {
        risposta:
          "Scusa, ho avuto un problema tecnico. Ma la tua richiesta è arrivata: " +
          "scrivici a corpagent7@gmail.com e riprendiamo da lì.",
      },
      200
    );
  }
}

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
import * as az from "./_lib/azienda.js";
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
      // ⚠️ Rete di sicurezza: un id malformato (un UUID non valido, un campo
      // storto) fa alzare un'eccezione al database. Senza questo, il browser
      // riceverebbe un 500 nudo di Vercel; così riceve un errore pulito e
      // l'area non «si rompe» sotto le mani di chi la usa.
      if (typeof corpo.az === "string") {
        try {
          return await areaAzienda(corpo, request);
        } catch {
          return json({ error: "Qualcosa non ha funzionato. Riprova." }, 500);
        }
      }
      return json({ error: "Non so cosa vuoi fare." }, 400);
    }

    if (request.method === "GET" && url.searchParams.get("az")) {
      try {
        return await leggiAzienda(request, url);
      } catch {
        return json({ error: "Qualcosa non ha funzionato. Riprova." }, 500);
      }
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

/** Un numero pulito, o null. Un «40» scritto a mano arriva come stringa. */
function numero(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

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
  const d = corpo.richiesta as Partial<DatiRichiesta> & { sito?: string };

  // ─────────────────────────────────────────────────────────────────
  // ⚠️ IL CONTROLLO ANTI-ROBOT È STATO TOLTO — Tommaso, 11 Agosto 2026
  // ─────────────────────────────────────────────────────────────────
  // «Togli il controllo antirobot.» Deciso da lui, e il motivo pratico gli dà
  // ragione: su questo dominio Turnstile restituiva la pagina d'errore di
  // Cloudflare, quindi il suo primo effetto era impedire alle aziende vere di
  // scrivere. Un controllo che ferma i clienti e non i programmi è peggio di
  // nessun controllo.
  //
  // ⚠️ COSA RESTA, e perché non è «niente»:
  //   1. l'esca — un campo che una persona non vede e non compila mai
  //   2. tre richieste all'ora dallo stesso posto (migrazione 0017)
  //   3. quaranta messaggi per richiesta, tetto in SQL (migrazione 0015)
  //   4. campi tagliati alla lunghezza dal database
  //
  // Sono difese invisibili a chi compila in buona fede e più debole di
  // Turnstile. Il rischio consapevole: ogni richiesta finta che passa apre una
  // conversazione con l'agente, e ogni conversazione è costo di modello vero.
  // Se un giorno arrivasse spam, la strada è **rimettere Turnstile con
  // l'hostname configurato bene** — non inventare una difesa nuova.
  if (esca(d.sito)) {
    // Si risponde «va bene» a un programma automatico invece di dirgli che è
    // stato scoperto: chi scrive quei programmi corregge la trappola solo se
    // sa di averla trovata.
    return json({ chiave: "ok", saluto: "Grazie, ti ricontattiamo." }, 200);
  }

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

// ═════════════════════════════════════════════════════════════════════════
// L'AREA DI UN'AZIENDA CLIENTE — 12 Agosto 2026
// ═════════════════════════════════════════════════════════════════════════
//
//   POST { az: "entra"|"profilo"|"chat"|"cliente"|... }
//   GET  ?az=stato|chat|...   con l'intestazione x-azienda-sessione: <gettone>
//
// ⚠️ Anche questa vive dentro `config.ts` per la ragione di sempre: **Vercel
// Hobby ammette 12 funzioni** e siamo esattamente a 12. Un tredicesimo file non
// rompe il codice, rompe il deploy — e te ne accorgi quando pubblichi.
//
// ⚠️ IL CONTROLLO DI CHI STA CHIEDENDO È QUI, e da nessun'altra parte. Le
// funzioni del database eseguono e basta: chiunque le chiami, rispondono. Se
// una delle righe `soloTitolare` qui sotto sparisse, un magazziniere vedrebbe
// l'elenco delle persone e potrebbe promuoversi da solo.

/**
 * Il gettone di sessione.
 *
 * ⚠️ Sulle POST arriva nel corpo, sulle GET **nell'intestazione**, mai nella
 * query. Un gettone nella query finisce nei log di Vercel e in quelli di ogni
 * proxy in mezzo: è una credenziale valida tre mesi scritta in chiaro in un
 * registro che non si cancella. Nell'intestazione no.
 */
function gettone(request: Request | null, corpo?: Record<string, unknown>): string {
  if (corpo && typeof corpo.t === "string") return corpo.t;
  if (request) return request.headers.get("x-azienda-sessione") ?? "";
  return "";
}

async function leggiAzienda(request: Request, url: URL): Promise<Response> {
  const chi = await az.sessione(gettone(request));
  if (!chi) return json({ error: "sessione" }, 401);

  const cosa = url.searchParams.get("az");
  const titolare = chi.ruolo_vero === "titolare";
  // ⚠️ Un operatore che chiede il cruscotto non riceve 403 ma «non esiste»: un
  // «vietato» conferma che la cosa esiste, e invita a insistere.
  const soloTitolare = () => json({ error: "Non trovato." }, 404);

  switch (cosa) {
    case "stato":
      return json(
        {
          persona: {
            nome: chi.nome,
            email: chi.email,
            ruolo: chi.ruolo_vero,
            ruoloScelto: chi.ruolo_scelto,
            reparto: chi.reparto,
            foto: chi.foto,
          },
          postazioni: az.AZIENDE[chi.azienda]?.postazioni.map((p) => ({
            id: p.id,
            nome: p.nome,
            cosa: p.cosa,
          })),
          // Senza chiave OpenRouter l'agente non può rispondere, e il browser
          // deve saperlo prima che qualcuno scriva e resti ad aspettare.
          agenteVivo: Boolean(process.env.OPENROUTER_API_KEY),
        },
        200
      );

    case "chat": {
      const p = url.searchParams.get("p") ?? "traffico";
      return json({ messaggi: await az.conversazione(chi.azienda, chi.persona, p) }, 200);
    }

    case "clienti":
      return json({ clienti: await az.clienti(chi.azienda, url.searchParams.get("q") ?? "") }, 200);

    case "documenti":
      return json({ documenti: await az.documenti(chi.azienda) }, 200);

    case "mezzi":
      // La lista dei mezzi serve a chiunque registra un carico: tutti la leggono.
      return json({ mezzi: await az.mezzi(chi.azienda) }, 200);

    case "banchina": {
      // Il posto di lavoro del magazzino: i numeri di oggi, il registro dei
      // movimenti e i ritiri in arrivo prenotati dal traffico. Lo vede chiunque
      // sia dentro — è il dato operativo condiviso della banchina, non una
      // chat. Le conversazioni restano private.
      const [mag, movimenti, ritiri] = await Promise.all([
        az.magazzino(chi.azienda),
        az.movimentiOggi(chi.azienda, "Magazzino"),
        az.ritiri(chi.azienda),
      ]);
      return json({ magazzino: mag, movimenti, ritiri }, 200);
    }

    case "ufficio": {
      // Il posto di lavoro del traffico: i numeri, il registro del giorno e i
      // ritiri ancora da fare. Stessa filosofia della banchina.
      const [num, movimenti, ritiri] = await Promise.all([
        az.traffico(chi.azienda),
        az.movimentiOggi(chi.azienda, "Traffico"),
        az.ritiri(chi.azienda),
      ]);
      return json({ traffico: num, movimenti, ritiri }, 200);
    }

    case "reparto": {
      // ⚠️ Il capo vede SOLO il suo reparto: la postazione è calcolata dal suo
      // reparto, non presa dalla richiesta. Un capo del magazzino non può
      // chiedere «fammi vedere il traffico» cambiando un parametro. Il titolare
      // può guardarne uno qualsiasi (per il cruscotto generale).
      const titolareVede = titolare && url.searchParams.get("reparto");
      const reparto = titolareVede ? String(url.searchParams.get("reparto")) : chi.reparto;
      if (chi.ruolo_vero !== "capo" && !titolare) return soloTitolare();
      if (chi.ruolo_vero === "capo" && !chi.reparto) {
        return json({ reparto: "", uso: [], magazzino: null, controlli: [] }, 200);
      }
      const postazione = az.postazioneDiReparto(reparto);
      const [uso, controlli, mag] = await Promise.all([
        postazione ? az.repartoUso(chi.azienda, postazione) : Promise.resolve([]),
        az.daControllare(chi.azienda, reparto),
        reparto === "Magazzino" ? az.magazzino(chi.azienda) : Promise.resolve(null),
      ]);
      return json({ reparto, uso, controlli, magazzino: mag }, 200);
    }

    case "persone":
      if (!titolare) return soloTitolare();
      return json({ persone: await az.persone(chi.azienda) }, 200);

    case "cruscotto":
      if (!titolare) return soloTitolare();
      return json({ cruscotto: await az.cruscotto(chi.azienda) }, 200);

    case "riepilogo":
      if (!titolare) return soloTitolare();
      return await riepilogoGiornata(chi);

    default:
      return json({ error: "Non trovato." }, 404);
  }
}

/**
 * L'IA che guarda tutta l'azienda insieme e racconta com'è andata.
 *
 * ⚠️ Passa i numeri VERI del cruscotto al modello e basta. Non ha accesso a
 * fatturato o spedizioni, quindi non può inventarli: gli si dà solo ciò che è
 * contato, e le istruzioni gli vietano di aggiungere il resto.
 */
async function riepilogoGiornata(chi: az.Persona): Promise<Response> {
  const dati = await az.cruscotto(chi.azienda);
  const chiave = process.env.OPENROUTER_API_KEY;
  if (!chiave) {
    return json(
      { testo: "L'agente di direzione è momentaneamente spento. Riprova più tardi." },
      200
    );
  }
  const nome = (chi.nome || "").split(" ")[0];
  try {
    const r = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${chiave}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://corpagent.vercel.app",
        "X-Title": "CorpAgent · Speed Trasporti",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        max_tokens: 260,
        temperature: 0.5,
        messages: [
          { role: "system", content: az.istruzioniRiepilogo(nome) },
          // ⚠️ I numeri già in italiano, non il JSON grezzo: così «1038
          // millisecondi» non diventa «1.038 ore».
          { role: "user", content: "I numeri di oggi e della settimana:\n" + az.riassuntoDati(dati) },
        ],
      }),
      signal: AbortSignal.timeout(25_000),
    });
    const body = (await r.json()) as { choices?: { message?: { content?: string } }[] };
    const testo = body.choices?.[0]?.message?.content?.trim();
    if (!testo) throw new Error("vuoto");
    return json({ testo }, 200);
  } catch {
    return json(
      { testo: "Non riesco a fare il punto in questo momento. I numeri qui sotto sono comunque aggiornati." },
      200
    );
  }
}

async function areaAzienda(
  corpo: Record<string, unknown>,
  request: Request
): Promise<Response> {
  const cosa = corpo.az as string;

  // ── Entrare è l'unica cosa che si fa senza essere già nessuno ────────
  if (cosa === "entra") {
    const azienda = String(corpo.azienda ?? "speed");
    const email = String(corpo.email ?? "").trim();
    const password = String(corpo.password ?? "");
    if (!az.AZIENDE[azienda]) return json({ error: "Azienda sconosciuta." }, 404);
    if (!email.includes("@") || password.length < 4) {
      return json({ error: "Email o password non corrispondono." }, 400);
    }
    // ⚠️ La stessa impronta salata del form pubblico (0017): serve al freno
    // anti-forza-bruta della migrazione 0019, mai a sapere chi è.
    const esito = await az.entra(azienda, email, password, improntaProvenienza(request));
    if ("errore" in esito) return json({ error: esito.errore }, 401);
    return json(
      {
        t: esito.token,
        persona: {
          nome: esito.persona.nome,
          email: esito.persona.email,
          ruolo: esito.persona.ruolo_vero,
          ruoloScelto: esito.persona.ruolo_scelto,
          reparto: esito.persona.reparto,
          foto: esito.persona.foto,
        },
      },
      200
    );
  }

  const chi = await az.sessione(gettone(null, corpo));
  if (!chi) return json({ error: "sessione" }, 401);
  const titolare = chi.ruolo_vero === "titolare";

  // ⚠️ I PERMESSI DI SCRITTURA, e vivono QUI perché le funzioni SQL eseguono
  // per chiunque le chiami. Senza queste righe un «osservatore» — quello che si
  // presenta come «guardo, non tocco» — potrebbe cancellare tutti i clienti, e
  // un operatore qualsiasi svuotare la memoria dell'agente. Due soglie:
  //   • scrivente: chiunque tranne l'osservatore (può gestire i clienti)
  //   • gestore:   solo chi guida (titolare, amministrazione, capo) tocca la
  //                memoria dell'agente — cancellare un documento gli toglie
  //                quello che sa, ed è troppo per una postazione qualunque.
  const scrivente = chi.ruolo_vero !== "osservatore";
  const gestore = ["titolare", "amministratore", "capo"].includes(chi.ruolo_vero);
  // Come per le sezioni riservate: a chi non ha il permesso si risponde «non
  // trovato», non «vietato». Un «vietato» conferma che la cosa esiste.
  const negato = () => json({ error: "Non trovato." }, 404);

  switch (cosa) {
    case "esci":
      await az.esci(String(corpo.t));
      return json({ ok: true }, 200);

    case "profilo":
      await az.salvaProfilo(chi.persona, {
        nome: String(corpo.nome ?? "").trim(),
        // ⚠️ Si salva come **ruolo dichiarato**, non come ruolo vero: il ruolo
        // vero lo cambia solo il titolare, dal caso "ruolo" qui sotto. Se
        // questa riga scrivesse `ruolo_vero`, chiunque si dichiarerebbe
        // titolare e vedrebbe tutto.
        ruolo: String(corpo.ruolo ?? "operatore"),
        reparto: String(corpo.reparto ?? ""),
        foto: typeof corpo.foto === "string" ? corpo.foto : null,
      });
      return json({ ok: true }, 200);

    case "cliente": {
      if (!scrivente) return negato();
      const id = await az.salvaCliente(chi.azienda, chi.persona, corpo.cliente as Record<string, unknown>);
      if (!id) return json({ error: "Non sono riuscito a salvare." }, 400);
      return json({ id }, 200);
    }

    case "cliente-elimina":
      if (!scrivente) return negato();
      await az.eliminaCliente(chi.azienda, String(corpo.id));
      return json({ ok: true }, 200);

    case "documento":
      if (!gestore) return negato();
      await az.salvaDocumento(
        chi.azienda,
        chi.persona,
        String(corpo.titolo ?? "Senza titolo").trim(),
        String(corpo.testo ?? "").trim()
      );
      return json({ ok: true }, 200);

    case "documento-elimina":
      if (!gestore) return negato();
      await az.eliminaDocumento(chi.azienda, String(corpo.id));
      return json({ ok: true }, 200);

    // ── IL MAGAZZINO ─────────────────────────────────────────────────
    case "movimento": {
      // Registra un carico/scarico/differenza/problema. Lo può fare chiunque
      // lavori (non l'osservatore). Il reparto è quello della persona.
      if (!scrivente) return negato();
      const d = corpo.movimento as az.DatiMovimento;
      const tipiValidi = ["carico", "scarico", "differenza", "problema", "ritiro", "reclamo"];
      if (!d || !tipiValidi.includes(d.tipo)) {
        return json({ error: "Movimento non valido." }, 400);
      }
      // Il reparto è quello della persona; se non l'ha detto, si deduce dal
      // tipo: ritiri e reclami nascono in Traffico, la merce in Magazzino.
      const reparto =
        chi.reparto ||
        (d.tipo === "ritiro" || d.tipo === "reclamo" ? "Traffico" : "Magazzino");
      // Il «quando» di un ritiro: una data vera o niente. Una data storta non
      // deve far fallire la prenotazione — arriva senza data e si vede lo stesso.
      let previsto: string | null = null;
      if (d.tipo === "ritiro" && typeof d.previsto === "string" && d.previsto) {
        const dt = new Date(d.previsto);
        if (!Number.isNaN(dt.getTime())) previsto = dt.toISOString();
      }
      await az.registraMovimento(chi.azienda, reparto, chi.persona, {
        tipo: d.tipo,
        colli: numero(d.colli),
        atteso: numero(d.atteso),
        contato: numero(d.contato),
        mezzo: String(d.mezzo ?? ""),
        controparte: String(d.controparte ?? ""),
        testo: String(d.testo ?? ""),
        previsto,
      });
      // ⚠️ Se è una cosa da controllare (problema o differenza) si avvisa —
      // oggi solo il pallino nell'app, il WhatsApp arriva col numero. Senza
      // aspettare: l'avviso non deve rallentare chi ha appena registrato.
      if (["problema", "differenza", "reclamo"].includes(d.tipo)) void az.avvisaSegnalazione();
      return json({ ok: true }, 200);
    }

    case "ritiro-fatto":
      // Un ritiro lo chiude chi lo fa: operatore compreso. (I reclami no:
      // quelli restano del capo, e questa porta chiude SOLO i ritiri.)
      if (!scrivente) return negato();
      await az.chiudiRitiro(chi.azienda, String(corpo.id));
      return json({ ok: true }, 200);

    case "controllo-chiudi":
      // Segnare risolto un problema o una differenza: lo fa chi guida il reparto.
      if (!gestore) return negato();
      await az.chiudiControllo(chi.azienda, String(corpo.id));
      return json({ ok: true }, 200);

    case "mezzo": {
      // I mezzi li gestisce chi guida (titolare, amministrazione, capo).
      if (!gestore) return negato();
      const id = await az.salvaMezzo(
        chi.azienda,
        (corpo.id as string) || null,
        String(corpo.nome ?? "").trim(),
        String(corpo.targa ?? "").trim()
      );
      return json({ id }, 200);
    }

    case "mezzo-elimina":
      if (!gestore) return negato();
      await az.eliminaMezzo(chi.azienda, String(corpo.id));
      return json({ ok: true }, 200);

    case "ruolo": {
      if (!titolare) return json({ error: "Non trovato." }, 404);
      // ⚠️ Non ci si può togliere il titolo da soli: un'azienda senza nessuno
      // che possa promuovere gli altri è un'azienda da riparare a mano nel
      // database, e succederebbe con un clic distratto.
      if (String(corpo.persona) === chi.persona) {
        return json({ error: "Non puoi cambiare il tuo stesso ruolo." }, 400);
      }
      await az.cambiaRuolo(
        chi.azienda,
        String(corpo.persona),
        String(corpo.ruolo),
        corpo.attiva !== false
      );
      return json({ ok: true }, 200);
    }

    case "chat":
      return await parlaConAgente(chi, corpo);

    default:
      return json({ error: "Non so cosa vuoi fare." }, 400);
  }
}

/**
 * Una battuta con l'agente di una postazione.
 *
 * ⚠️ Il messaggio della persona si salva **prima** di chiamare il modello. Se
 * OpenRouter è lento o giù, quello che il magazziniere ha scritto non si perde
 * e resta nella conversazione. Perdere il messaggio è il modo più veloce per
 * far smettere qualcuno di usare un programma.
 */
async function parlaConAgente(
  chi: az.Persona,
  corpo: Record<string, unknown>
): Promise<Response> {
  const testo = String(corpo.testo ?? "").trim();
  if (!testo) return json({ error: "Serve un messaggio." }, 400);

  const azienda = az.AZIENDE[chi.azienda];
  const postazione =
    azienda?.postazioni.find((p) => p.id === corpo.postazione) ?? azienda?.postazioni[0];
  if (!postazione) return json({ error: "Postazione sconosciuta." }, 404);

  await az.scrivi(chi.azienda, chi.persona, postazione.id, "persona", testo);

  const chiave = process.env.OPENROUTER_API_KEY;
  if (!chiave) {
    const muto =
      "[PASSO] Non riesco a raggiungere il modello in questo momento. " +
      "Il tuo messaggio è salvato: appena torno te lo riprendo da qui.";
    await az.scrivi(chi.azienda, chi.persona, postazione.id, "agente", muto.slice(8).trim(), true);
    return json({ risposta: muto.slice(8).trim(), passato: true }, 200);
  }

  const [memoria, elenco, storia] = await Promise.all([
    az.documenti(chi.azienda),
    az.clienti(chi.azienda, ""),
    az.conversazione(chi.azienda, chi.persona, postazione.id),
  ]);

  const partito = Date.now();
  try {
    const r = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${chiave}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://corpagent.vercel.app",
        "X-Title": "CorpAgent · Speed Trasporti",
      },
      body: JSON.stringify({
        // ⚠️ Modello leggero: sono risposte operative a chi ha le mani
        // occupate. Qui conta arrivare in due secondi, non ragionare.
        model: "openai/gpt-4o-mini",
        max_tokens: 420,
        temperature: 0.4,
        messages: [
          {
            role: "system",
            content: az.istruzioni(
              postazione,
              chi,
              (memoria as { titolo: string; testo: string }[]).slice(0, 12),
              (elenco as { nome: string }[]).map((c) => c.nome)
            ),
          },
          ...storia.map((m) => ({
            role: m.ruolo === "agente" ? "assistant" : "user",
            content: m.testo,
          })),
        ],
      }),
      signal: AbortSignal.timeout(25_000),
    });

    const body = (await r.json()) as { choices?: { message?: { content?: string } }[] };
    let risposta = body.choices?.[0]?.message?.content?.trim() ?? "";
    if (!risposta) throw new Error("risposta vuota");

    // ⚠️ Il marcatore si toglie prima di mostrarlo — nessuno deve leggere
    // «[PASSO]» — ma quello che lascia dietro è il numero più onesto del
    // cruscotto: quante volte l'agente ha ammesso di non sapere.
    const passato = risposta.startsWith("[PASSO]");
    if (passato) risposta = risposta.slice(7).trim();

    await az.scrivi(
      chi.azienda,
      chi.persona,
      postazione.id,
      "agente",
      risposta,
      passato,
      Date.now() - partito
    );
    return json({ risposta, passato }, 200);
  } catch {
    const scusa =
      "Ho avuto un problema tecnico e non riesco a risponderti adesso. " +
      "Quello che hai scritto è salvato e lo giro a una persona.";
    await az.scrivi(chi.azienda, chi.persona, postazione.id, "agente", scusa, true);
    return json({ risposta: scusa, passato: true }, 200);
  }
}

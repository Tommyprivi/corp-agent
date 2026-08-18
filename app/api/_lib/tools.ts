/**
 * Gli strumenti in mano all'agente — riga 40 della Fase 5.
 *
 * Voluto da Tommaso il 9 Agosto 2026: *«dovrà andare ANCHE SU WHATSAPP: se
 * gli chiedi, lui si collega ai connettori»*.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * PERCHÉ QUESTO PEZZO È QUELLO CHE CONTA
 * ─────────────────────────────────────────────────────────────────────────
 * Un connettore collegato ma che l'agente non sa usare è **una spia verde che
 * non accende niente**. Fin qui abbiamo costruito la cassaforte (chi ha
 * collegato cosa, cifrato, per utente); questo è il pezzo che la apre al
 * momento giusto.
 *
 * ⚠️ L'agente NON riceve le credenziali. Riceve un elenco di cose che può
 * chiedere — «quante persone lavorano qui», «chi manca oggi», «quanto dista
 * Milano» — e quando ne chiede una siamo noi a fare la chiamata, col permesso
 * di quell'utente. È la differenza fra dare le chiavi di casa e aprire la
 * porta quando bussano.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * GLI STRUMENTI COMPAIONO SOLO SE IL CONNETTORE È COLLEGATO
 * ─────────────────────────────────────────────────────────────────────────
 * Un agente a cui dici «puoi controllare le ferie» quando Fluida non è
 * collegato risponderà «controllo subito» e poi non controllerà niente. Il
 * modello non sa cosa non ha: bisogna non dirglielo.
 */

import { credenziali, collegamenti, segnalaGuasto } from "./connectors.js";

/** La forma che vuole OpenRouter (la stessa di OpenAI). */
export interface Strumento {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

const FLUIDA = "https://api.fluida.io/api/v1";

/**
 * Cosa può fare questo utente, adesso.
 *
 * Restituisce elenco vuoto se non ha collegato niente — e in quel caso il
 * modello non riceve nemmeno il campo `tools`, quindi non gli viene in mente
 * di promettere cose che non può fare.
 */
export async function strumentiPer(userId: string): Promise<Strumento[]> {
  const strumenti: Strumento[] = [];

  // ⚠️ Una sola lettura, non una per connettore. Ogni `credenziali()` apre una
  // connessione a Neon: due andate valevano un secondo e mezzo di attesa prima
  // ancora di aver chiamato il modello, e in chat quel secondo si vede.
  const collegati = new Set((await collegamenti(userId).catch(() => [])).map((c) => c.kind));

  if (collegati.has("fluida")) {
    strumenti.push(
      {
        type: "function",
        function: {
          name: "personale_elenco",
          description:
            "L'elenco delle persone che lavorano in questa azienda, con nome e cognome. " +
            "Usalo quando ti chiedono chi lavora qui, quanti sono, o per trovare una persona.",
          parameters: { type: "object", properties: {}, required: [] },
        },
      },
      {
        type: "function",
        function: {
          name: "personale_assenze",
          description:
            "Chi è assente (ferie, permesso, malattia) in una certa data, e chi invece c'è. " +
            "Usalo per «Marco c'è oggi?», «chi è in ferie domani?», «chi lavora lunedì?».",
          parameters: {
            type: "object",
            additionalProperties: false,
            properties: {
              data: {
                type: "string",
                description:
                  "Il giorno da controllare in formato AAAA-MM-GG. Se il cliente dice " +
                  "«oggi» o non specifica, usa la data di oggi.",
              },
            },
            required: ["data"],
          },
        },
      }
    );
  }

  if (collegati.has("maps")) {
    strumenti.push({
      type: "function",
      function: {
        name: "distanza_e_tempo",
        description:
          "Quanti chilometri e quanto tempo ci vuole fra due indirizzi, in auto. " +
          "Usalo per preventivi di consegna, tempi di arrivo, «siete lontani da...?».",
        parameters: {
          type: "object",
          additionalProperties: false,
          properties: {
            partenza: { type: "string", description: "Indirizzo o città di partenza." },
            arrivo: { type: "string", description: "Indirizzo o città di arrivo." },
          },
          required: ["partenza", "arrivo"],
        },
      },
    });
  }

  return strumenti;
}

/**
 * Esegue quello che l'agente ha chiesto, e restituisce **testo per il modello**.
 *
 * ⚠️ Non JSON grezzo: righe brevi in italiano. Un modello che riceve
 * `{"total_entries":1,"data":[{...40 campi...}]}` spreca metà del suo lavoro a
 * capire la forma invece del contenuto, e su WhatsApp ogni token in più è
 * ritardo che il cliente sente.
 *
 * ⚠️ Non solleva mai: un errore torna come frase. Se lo strumento fallisce
 * l'agente deve poterlo dire («non riesco a controllare adesso»), non tacere.
 */
export async function eseguiStrumento(
  userId: string,
  nome: string,
  argomenti: Record<string, unknown>
): Promise<string> {
  try {
    if (nome === "personale_elenco" || nome === "personale_assenze") {
      const c = await credenziali(userId, "fluida");
      if (!c?.secret) return "Fluida non è collegato: non posso controllare il personale.";

      const companyId = String(c.meta.companyId ?? "");
      const H = { "x-fluida-app-uuid": c.secret, Accept: "application/json" };

      if (nome === "personale_elenco") {
        const r = await fetch(`${FLUIDA}/users/by_company/${companyId}`, {
          headers: H,
          signal: AbortSignal.timeout(12_000),
        });
        if (!r.ok) {
          await segnalaGuasto(userId, "fluida", `users ${r.status}`);
          return `Fluida non risponde (${r.status}).`;
        }
        const corpo = (await r.json()) as {
          data?: Array<{ firstname?: string; lastname?: string; email?: string }>;
        };
        const persone = corpo.data ?? [];
        if (persone.length === 0) return "Nell'azienda non risulta nessuna persona.";
        return [
          `${persone.length} ${persone.length === 1 ? "persona" : "persone"} in azienda:`,
          ...persone.map(
            (p) => `- ${[p.firstname, p.lastname].filter(Boolean).join(" ") || p.email || "senza nome"}`
          ),
        ].join("\n");
      }

      // ── Chi c'è e chi non c'è, in una data ──────────────────────────
      const data = String(argomenti.data ?? "").slice(0, 10) || new Date().toISOString().slice(0, 10);
      const r = await fetch(
        `${FLUIDA}/calendar/company/${companyId}/light?from_date=${data}&to_date=${data}`,
        { headers: H, signal: AbortSignal.timeout(12_000) }
      );
      if (!r.ok) {
        await segnalaGuasto(userId, "fluida", `calendar ${r.status}`);
        return `Fluida non risponde (${r.status}).`;
      }
      const corpo = (await r.json()) as {
        data?: {
          entries?: Array<{
            firstname?: string;
            lastname?: string;
            calendar?: Array<{ justifications?: unknown[]; day_type?: string; date?: string }>;
          }>;
        };
      };
      const righe = corpo.data?.entries ?? [];
      if (righe.length === 0) return `Per il ${data} non risulta nessuna persona in calendario.`;

      const presenti: string[] = [];
      const assenti: string[] = [];
      for (const e of righe) {
        const chi = [e.firstname, e.lastname].filter(Boolean).join(" ") || "senza nome";
        // ⚠️ Una giustificazione sul giorno = assenza (ferie, permesso, malattia).
        // Il calendario vuoto NON vuol dire assente: vuol dire che quel giorno
        // non c'è niente di segnato, cioè che lavora normalmente.
        const giustificato = (e.calendar ?? []).some(
          (g) => Array.isArray(g.justifications) && g.justifications.length > 0
        );
        (giustificato ? assenti : presenti).push(chi);
      }

      return [
        `Situazione del ${data}:`,
        assenti.length > 0 ? `- assenti: ${assenti.join(", ")}` : "- nessun assente",
        presenti.length > 0 ? `- al lavoro: ${presenti.join(", ")}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    }

    if (nome === "distanza_e_tempo") {
      const c = await credenziali(userId, "maps");
      if (!c?.secret) return "Google Maps non è collegato: non posso calcolare le distanze.";

      const da = String(argomenti.partenza ?? "");
      const a = String(argomenti.arrivo ?? "");
      if (!da || !a) return "Mi servono partenza e arrivo.";

      const r = await fetch(
        "https://maps.googleapis.com/maps/api/distancematrix/json?" +
          new URLSearchParams({
            origins: da,
            destinations: a,
            key: c.secret,
            language: "it",
            units: "metric",
          }),
        { signal: AbortSignal.timeout(12_000) }
      );
      const corpo = (await r.json()) as {
        status?: string;
        error_message?: string;
        rows?: Array<{
          elements?: Array<{
            status?: string;
            distance?: { text?: string };
            duration?: { text?: string };
          }>;
        }>;
      };
      if (corpo.status !== "OK") {
        await segnalaGuasto(userId, "maps", corpo.error_message ?? String(corpo.status));
        return `Google Maps non risponde (${corpo.status}).`;
      }
      const e = corpo.rows?.[0]?.elements?.[0];
      if (e?.status !== "OK") {
        return `Non trovo un percorso fra «${da}» e «${a}». Forse un indirizzo non è chiaro.`;
      }
      return `Da ${da} a ${a}: ${e.distance?.text}, circa ${e.duration?.text} in auto.`;
    }

    return `Non conosco lo strumento «${nome}».`;
  } catch (error) {
    return `Non sono riuscito a controllare adesso (${String(error).slice(0, 80)}).`;
  }
}

/**
 * La riga che dice al modello che gli strumenti vengono **prima** del
 * «devo far verificare».
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ⚠️ IL DIFETTO CHE QUESTA FUNZIONE RIPARA, TROVATO PROVANDO
 * ─────────────────────────────────────────────────────────────────────────
 * Alla domanda «quanto dista via Etnea 100 da piazza Duomo a Messina?» l'agente
 * rispondeva *«su questo devo far verificare al titolare»* — con Google Maps
 * collegato e lo strumento in mano.
 *
 * La colpa era di una regola giusta applicata troppo alla lettera: la memoria
 * dei documenti gli dice «se la risposta non è qui dentro, non inventarla, di'
 * che fai verificare». Il modello ubbidiva, e restava zitto anche quando aveva
 * il modo di scoprirlo davvero.
 *
 * Le due regole vanno messe in ordine, non in conflitto: **prima si guarda, e
 * solo se nemmeno lo strumento sa rispondere si chiede al titolare.**
 */
export function istruzioniStrumenti(strumenti: Strumento[]): string | null {
  if (strumenti.length === 0) return null;
  return [
    "─────────────────────────────────────────",
    "PUOI CONTROLLARE DA SOLO",
    "─────────────────────────────────────────",
    "Hai degli strumenti collegati:",
    ...strumenti.map((s) => `- ${s.function.name}: ${s.function.description.split(".")[0]}.`),
    "",
    "⚠️ USALI PRIMA di dire «devo far verificare al titolare». Quella frase serve",
    "per le cose che nessuno ti ha detto e che non puoi scoprire — non per quelle",
    "che uno strumento ti direbbe in un secondo.",
    "",
    "Se lo strumento risponde, riporta il dato con sicurezza. Se lo strumento non",
    "sa o non risponde, allora sì: dillo e proponi di far verificare.",
  ].join("\n");
}

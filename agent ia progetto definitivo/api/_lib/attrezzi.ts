/**
 * Gli attrezzi dell'agente di Speed Trasporti — il function calling dell'area
 * azienda. Deciso da Tommaso il 12 agosto: *«sì, tutto: l'agente legge
 * ritiri, movimenti e clienti dal database E chiama Maps»*.
 *
 * È il gemello di `tools.ts` (che serve gli utenti CorpAgent coi LORO
 * connettori): qui gli strumenti servono i dipendenti di un'azienda cliente,
 * e leggono il registro di QUELLA azienda dalle porte strette di sempre.
 *
 * ⚠️ PERCHÉ CAMBIA TUTTO: prima l'agente a «quanti colli oggi?» rispondeva
 * «lo giro a una persona» — con il numero scritto nel database a dieci
 * centimetri. Un agente che non guarda dove può guardare non è prudente,
 * è inutile. Ora guarda, e passa a una persona solo quello che DAVVERO
 * non può sapere (K-Master, fatture: i collegamenti che non ci sono ancora).
 *
 * ⚠️ La chiave di Maps è quella di piattaforma (`GOOGLE_MAPS_API_KEY`), non
 * un collegamento del cliente: per l'area azienda il conto delle chiamate è
 * nostro, come il modello. Quando Speed avrà i suoi connettori (QCSNET,
 * email), quelli sì saranno suoi.
 */

import type { Strumento } from "./tools.js";
import * as az from "./azienda.js";

export function attrezziAzienda(): Strumento[] {
  const attrezzi: Strumento[] = [
    {
      type: "function",
      function: {
        name: "registro_oggi",
        description:
          "Il registro di oggi dell'azienda: carichi, scarichi, differenze, problemi, " +
          "ritiri e reclami registrati, con chi e a che ora. Usalo per «quanti colli " +
          "sono entrati?», «cosa è successo oggi?», «chi ha registrato...?».",
        parameters: { type: "object", properties: {}, required: [] },
      },
    },
    {
      type: "function",
      function: {
        name: "ritiri_da_fare",
        description:
          "I ritiri prenotati e non ancora fatti: cliente, colli, quando, note. " +
          "Usalo per «cosa arriva domani?», «quanti ritiri abbiamo?», «quando passiamo da...?».",
        parameters: { type: "object", properties: {}, required: [] },
      },
    },
    {
      type: "function",
      function: {
        name: "scheda_cliente",
        description:
          "Cerca un cliente in anagrafica per nome e restituisce la scheda: referente, " +
          "telefono, zona, note. Usalo per «che numero ha...?», «dove sta...?», «chi è il referente di...?».",
        parameters: {
          type: "object",
          additionalProperties: false,
          properties: {
            nome: { type: "string", description: "Il nome (anche parziale) del cliente da cercare." },
          },
          required: ["nome"],
        },
      },
    },
  ];

  if (process.env.GOOGLE_MAPS_API_KEY) {
    attrezzi.push({
      type: "function",
      function: {
        name: "distanza_e_tempo",
        description:
          "Quanti chilometri e quanto tempo ci vuole fra due indirizzi, in auto/camion. " +
          "Usalo per tempi di consegna, preventivi di tratta, «quanto ci mettiamo fino a...?».",
        parameters: {
          type: "object",
          additionalProperties: false,
          properties: {
            partenza: { type: "string", description: "Indirizzo o città di partenza. Se non detto, usa Torino (la sede)." },
            arrivo: { type: "string", description: "Indirizzo o città di arrivo." },
          },
          required: ["partenza", "arrivo"],
        },
      },
    });
  }

  return attrezzi;
}

/**
 * Esegue e risponde **in italiano piano**, mai JSON grezzo: il modello che
 * riceve quaranta campi spreca il lavoro a capire la forma invece del contenuto.
 * Non solleva mai: un errore torna come frase, così l'agente può dirlo.
 */
export async function eseguiAttrezzo(
  azienda: string,
  nome: string,
  argomenti: Record<string, unknown>
): Promise<string> {
  try {
    if (nome === "registro_oggi") {
      const [movimenti, mag] = await Promise.all([
        az.movimentiOggi(azienda, null),
        az.magazzino(azienda),
      ]);
      const m = mag as { entrati: number; usciti: number; differenze: number } | null;
      const righe: string[] = [];
      if (m) {
        righe.push(
          `Magazzino oggi: ${m.entrati} colli entrati, ${m.usciti} usciti, ${m.differenze} differenze.`
        );
      }
      const mv = movimenti as {
        tipo: string;
        colli: number | null;
        atteso: number | null;
        contato: number | null;
        controparte: string;
        testo: string;
        stato: string;
        chi: string;
        creato: string;
      }[];
      if (mv.length === 0) {
        righe.push("Nessuna registrazione oggi, finora.");
      } else {
        righe.push(`Registrazioni di oggi (${mv.length}):`);
        for (const r of mv.slice(0, 20)) {
          const ora = new Date(r.creato).toLocaleTimeString("it-IT", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "Europe/Rome",
          });
          if (r.tipo === "carico") righe.push(`- ${ora} carico: ${r.colli ?? "?"} colli${r.controparte ? ` da ${r.controparte}` : ""} (${r.chi})`);
          else if (r.tipo === "scarico") righe.push(`- ${ora} scarico: ${r.colli ?? "?"} colli${r.controparte ? ` per ${r.controparte}` : ""} (${r.chi})`);
          else if (r.tipo === "differenza") righe.push(`- ${ora} differenza: attesi ${r.atteso}, contati ${r.contato} — ${r.stato} (${r.chi})`);
          else if (r.tipo === "ritiro") righe.push(`- ${ora} ritiro prenotato da ${r.controparte}${r.colli ? `, ${r.colli} colli` : ""} (${r.chi})`);
          else if (r.tipo === "reclamo") righe.push(`- ${ora} reclamo di ${r.controparte}: ${r.testo} — ${r.stato} (${r.chi})`);
          else righe.push(`- ${ora} problema: ${r.testo || "segnalazione"} — ${r.stato} (${r.chi})`);
        }
      }
      return righe.join("\n");
    }

    if (nome === "ritiri_da_fare") {
      const righe = (await az.ritiri(azienda)) as {
        controparte: string;
        colli: number | null;
        testo: string;
        previsto: string | null;
        chi: string;
      }[];
      if (righe.length === 0) return "Nessun ritiro in coda: sono tutti fatti.";
      return [
        `Ritiri da fare (${righe.length}):`,
        ...righe.slice(0, 15).map((r) => {
          const quando = r.previsto
            ? new Date(r.previsto).toLocaleString("it-IT", {
                weekday: "short",
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "Europe/Rome",
              })
            : "senza orario";
          return `- ${r.controparte}${r.colli ? `, ${r.colli} colli` : ""} — ${quando}${r.testo ? ` (${r.testo})` : ""}`;
        }),
      ].join("\n");
    }

    if (nome === "scheda_cliente") {
      const cerca = String(argomenti.nome ?? "").trim();
      if (!cerca) return "Mi serve il nome del cliente da cercare.";
      const trovati = (await az.clienti(azienda, cerca)) as {
        nome: string;
        referente: string;
        telefono: string;
        email: string;
        zona: string;
        note: string;
      }[];
      if (trovati.length === 0) return `Nessun cliente in anagrafica con «${cerca}».`;
      return trovati
        .slice(0, 3)
        .map((c) =>
          [
            `${c.nome}:`,
            c.referente ? `- referente: ${c.referente}` : "",
            c.telefono ? `- telefono: ${c.telefono}` : "",
            c.email ? `- email: ${c.email}` : "",
            c.zona ? `- zona: ${c.zona}` : "",
            c.note ? `- note: ${c.note}` : "",
          ]
            .filter(Boolean)
            .join("\n")
        )
        .join("\n\n");
    }

    if (nome === "distanza_e_tempo") {
      const chiave = process.env.GOOGLE_MAPS_API_KEY;
      if (!chiave) return "Il calcolo delle distanze non è disponibile adesso.";
      const da = String(argomenti.partenza ?? "").trim() || "Torino";
      const a = String(argomenti.arrivo ?? "").trim();
      if (!a) return "Mi serve l'indirizzo di arrivo.";
      const r = await fetch(
        "https://maps.googleapis.com/maps/api/distancematrix/json?" +
          new URLSearchParams({
            origins: da,
            destinations: a,
            key: chiave,
            language: "it",
            units: "metric",
          }),
        { signal: AbortSignal.timeout(12_000) }
      );
      const corpo = (await r.json()) as {
        status?: string;
        rows?: Array<{
          elements?: Array<{
            status?: string;
            distance?: { text?: string };
            duration?: { text?: string };
          }>;
        }>;
      };
      if (corpo.status !== "OK") return `Google Maps non risponde (${corpo.status}).`;
      const e = corpo.rows?.[0]?.elements?.[0];
      if (e?.status !== "OK") return `Non trovo un percorso fra «${da}» e «${a}».`;
      return `Da ${da} a ${a}: ${e.distance?.text}, circa ${e.duration?.text} in auto.`;
    }

    return `Non conosco lo strumento «${nome}».`;
  } catch (error) {
    return `Non sono riuscito a controllare adesso (${String(error).slice(0, 80)}).`;
  }
}

/**
 * Il sito su misura di un'azienda — template, ordine, densità, minimal.
 *
 * Voluto da Tommaso: *«se sei il capo puoi decidere tu come vuoi il sito,
 * scegliendo dei template, e tutto il modo di disporre le cose»*. Fase C2.
 *
 * ⚠️ IL DEFAULT VIVE QUI, non nel database. Un salvataggio vecchio che non
 * conosce una voce nuova non si rompe: `unisci()` prende il default e ci
 * sovrascrive solo quello che il capo ha davvero cambiato. Aggiungere un blocco
 * domani è aggiungere una riga qui, non una migrazione.
 */

// ── I pezzi ordinabili ──────────────────────────────────────────────────

/** Le voci della barra in alto, nell'ordine di default. */
export const VOCI_DEF = [
  "cruscotto",
  "traffico",
  "magazzino",
  "autisti",
  "ammin",
  "clienti",
  "mezzi",
  "persone",
  "attivita",
  "documenti",
] as const;

/** I blocchi del cruscotto, nell'ordine di default. */
export const BLOCCHI_DEF = [
  "direzione", // l'agente di direzione
  "guadagni", // i soldi (in attesa del gestionale)
  "oggi", // i 4 numeri dell'agente oggi
  "giornata", // barre ora per ora
  "settimana", // la linea + postazioni
  "aspetta", // aspetta te
  "magazzino", // registrato dai magazzinieri
  "attesa", // le fasce in attesa dei collegamenti
] as const;

export const NOMI_BLOCCO: Record<string, string> = {
  direzione: "Agente di direzione",
  guadagni: "I guadagni",
  oggi: "I numeri dell'agente, oggi",
  giornata: "La giornata ora per ora",
  settimana: "La settimana e le postazioni",
  aspetta: "Aspetta te",
  magazzino: "Il magazzino di oggi",
  attesa: "In attesa dei collegamenti",
};

/**
 * I tool della banchina (magazzino), nell'ordine di default.
 * ⚠️ L'agente è PRIMO: Tommaso vuole che aprendo la postazione compaia lui.
 * Il capo può riordinare, ma di serie il primo tocco è la chat.
 */
export const TOOL_MAGAZZINO_DEF = [
  "agente",
  "scansioni",
  "registro",
  "carico",
  "scarico",
  "differenza",
  "problema",
  "arrivi",
];

/** I tool dell'ufficio (traffico), nell'ordine di default. L'agente è primo. */
export const TOOL_TRAFFICO_DEF = [
  "agente",
  "ritiri",
  "prenota",
  "reclamo",
  "registro",
  "dove",
  "preventivo",
];

export type Densita = "compatto" | "comodo";
export type Minimal =
  | "spiegazioni" // spiegazioni → tooltip
  | "fitto" // righe più fitte, font più piccoli
  | "saluti" // via saluti e frasi di cortesia
  | "tastiSoloMobile"; // tasti grossi solo su telefono

export interface Sito {
  template: string;
  densita: Densita;
  minimal: Minimal[];
  voci: string[];
  vociNascoste: string[];
  blocchi: string[];
  blocchiNascosti: string[];
  toolMagazzino: string[];
  toolTraffico: string[];
}

export const SITO_DEF: Sito = {
  template: "operativo",
  densita: "comodo",
  minimal: [],
  voci: [...VOCI_DEF],
  vociNascoste: [],
  blocchi: [...BLOCCHI_DEF],
  blocchiNascosti: [],
  toolMagazzino: [...TOOL_MAGAZZINO_DEF],
  toolTraffico: [...TOOL_TRAFFICO_DEF],
};

// ── I tre template ──────────────────────────────────────────────────────

/**
 * Un template è solo un punto di partenza: dopo averlo scelto, il capo sposta
 * quello che vuole. ⚠️ Non tocca i permessi — cambia solo cosa si vede e in
 * che ordine.
 */
export const TEMPLATE: Record<string, { nome: string; sotto: string; sito: Partial<Sito> }> = {
  direzione: {
    nome: "Direzione",
    sotto: "Prima i numeri e i grafici. Per chi guarda come sta andando.",
    sito: {
      template: "direzione",
      densita: "comodo",
      blocchi: ["oggi", "guadagni", "giornata", "settimana", "direzione", "aspetta", "magazzino", "attesa"],
    },
  },
  operativo: {
    nome: "Operativo",
    sotto: "Prima i registri e i tasti. Per chi lavora tutto il giorno.",
    sito: {
      template: "operativo",
      densita: "compatto",
      minimal: ["saluti"],
      blocchi: ["aspetta", "direzione", "oggi", "magazzino", "giornata", "settimana", "guadagni", "attesa"],
    },
  },
  essenziale: {
    nome: "Essenziale",
    sotto: "Solo l'indispensabile, niente fronzoli. Il minimo che serve.",
    sito: {
      template: "essenziale",
      densita: "compatto",
      minimal: ["saluti", "spiegazioni", "fitto"],
      blocchi: ["oggi", "aspetta", "magazzino"],
      blocchiNascosti: ["direzione", "guadagni", "giornata", "settimana", "attesa"],
      vociNascoste: ["mezzi", "attivita"],
    },
  },
};

// ── Fondere salvato e default, senza rompersi ───────────────────────────

/**
 * Prende il default e ci sovrascrive quello che è stato salvato — e per gli
 * elenchi (voci, blocchi, tool) tiene l'ORDINE salvato ma aggiunge in coda le
 * voci nuove che quel salvataggio non conosceva. Così un aggiornamento del
 * prodotto non fa sparire un tool a chi aveva già personalizzato.
 */
export function unisci(salvato: Partial<Sito> | null | undefined): Sito {
  const s = salvato ?? {};
  return {
    template: s.template ?? SITO_DEF.template,
    densita: s.densita === "compatto" || s.densita === "comodo" ? s.densita : SITO_DEF.densita,
    minimal: Array.isArray(s.minimal) ? (s.minimal as Minimal[]) : [],
    voci: fondiOrdine(s.voci, VOCI_DEF),
    vociNascoste: Array.isArray(s.vociNascoste) ? s.vociNascoste : [],
    blocchi: fondiOrdine(s.blocchi, BLOCCHI_DEF),
    blocchiNascosti: Array.isArray(s.blocchiNascosti) ? s.blocchiNascosti : [],
    toolMagazzino: fondiOrdine(s.toolMagazzino, TOOL_MAGAZZINO_DEF),
    toolTraffico: fondiOrdine(s.toolTraffico, TOOL_TRAFFICO_DEF),
  };
}

function fondiOrdine(salvato: string[] | undefined, def: readonly string[]): string[] {
  if (!Array.isArray(salvato) || salvato.length === 0) return [...def];
  // Tiene l'ordine salvato (solo le voci ancora valide), poi accoda le nuove.
  const validi = salvato.filter((v) => def.includes(v));
  const mancanti = def.filter((v) => !validi.includes(v));
  return [...validi, ...mancanti];
}

/**
 * Applica densità e minimal alla radice del documento, come i temi: un
 * attributo, e tutto il CSS reagisce senza che i componenti sappiano niente.
 */
export function applicaSito(sito: Sito): void {
  if (typeof document === "undefined") return;
  const r = document.documentElement;
  r.setAttribute("data-densita", sito.densita);
  r.setAttribute("data-minimal", sito.minimal.join(" "));
}

/** Sposta un elemento di un elenco su (−1) o giù (+1), senza uscire dai bordi. */
export function sposta<T>(lista: T[], indice: number, verso: -1 | 1): T[] {
  const j = indice + verso;
  if (j < 0 || j >= lista.length) return lista;
  const copia = [...lista];
  [copia[indice], copia[j]] = [copia[j], copia[indice]];
  return copia;
}

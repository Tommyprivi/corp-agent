import { PRESET_AGENTS } from "./presetAgents";
import { PROFESSIONAL_AGENTS } from "./professionalAgents";
import type { PresetAgent, PresetFamily } from "../types";

/**
 * Da un agente del catalogo alle istruzioni che lo fanno funzionare davvero.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * PERCHÉ UN COMPOSITORE E NON 127 PROMPT SCRITTI A MANO
 * ─────────────────────────────────────────────────────────────────────────
 * Chiesto da Tommaso il 2 Agosto 2026: "bisogna creare tutti gli agenti
 * predefiniti funzionanti". Il catalogo aveva nome e descrizione, ma nessuna
 * istruzione: erano schede, non lavoratori. Attivarne uno non produceva niente.
 *
 * Scriverne 127 a mano avrebbe voluto dire centomila caratteri da mantenere,
 * e ogni agente aggiunto al catalogo sarebbe nato di nuovo morto. Invece la
 * descrizione È già la specifica — "Monitora i pagamenti in sospeso e gestisce
 * il recupero crediti con un tono via via più formale e deciso" dice tutto — e
 * qui si trasforma in istruzioni operative.
 *
 * Il risultato: aggiungere una riga al catalogo produce un agente funzionante,
 * senza toccare questo file.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * COSA NON ENTRA NEL CATALOGO ATTIVABILE
 * ─────────────────────────────────────────────────────────────────────────
 * La famiglia `surreal` sono otto scherzi del brainstorming iniziale — "Il
 * Gatto Filosofo" risponde miagolando sulle scatolette di tonno, "Il Chaos
 * Manager" manda coordinate geografiche casuali. Restano nel file perché fanno
 * parte del documento, ma non si possono attivare: su un WhatsApp aziendale
 * farebbero danni veri a clienti veri.
 *
 * Stesso trattamento per i pochi agenti "ironici" che chiedono espressamente
 * di ingannare qualcuno (deadline finte, entusiasmo fasullo): contraddicono la
 * regola che tiene in piedi la promessa del prodotto.
 */

/**
 * ─────────────────────────────────────────────────────────────────────────
 * COSA SERVE A UN AGENTE PER LAVORARE
 * ─────────────────────────────────────────────────────────────────────────
 * Obiettivo fissato da Tommaso il 2 Agosto 2026: **l'utente non deve dare
 * nessun documento.** Un agente che per partire chiede di caricare un file è
 * un agente che non verrà usato.
 *
 * La maggior parte non ne ha bisogno: gli incolli il materiale nella chat, o
 * lavora di pura testa. Una minoranza ha bisogno di dati che non possono
 * essere inventati — lo stato di una spedizione, i numeri dei social — e per
 * quelli non è una questione di fasi: servono i collegamenti (Fase 6).
 *
 * Questa etichetta compare nel catalogo, così si vede a colpo d'occhio cosa
 * si può usare stasera. Prima non c'era modo di saperlo, e si scopriva
 * attivando.
 */
export type AgentNeeds = "subito" | "documento" | "collegamento";

export const NEEDS_LABEL: Record<AgentNeeds, { short: string; long: string }> = {
  subito: {
    short: "Funziona subito",
    long: "Non serve niente: scrivigli e lavora. Se ha bisogno di un testo, incollalo nella chat.",
  },
  documento: {
    short: "Meglio con un documento",
    long:
      "Funziona anche subito, ma dà il meglio quando può leggere un tuo documento — listino, menù, manuale. " +
      "La lettura dei documenti arriva con la Fase 2.",
  },
  collegamento: {
    short: "Serve un collegamento",
    long:
      "Ha bisogno di dati che stanno fuori da qui — spedizioni, social, contabilità, posta — e nessun " +
      "modello può inventarli. Si attiva coi connettori (Fase 6).",
  },
};

/**
 * Chi ha bisogno di un collegamento esterno per dire qualcosa di vero.
 *
 * Elencati uno per uno invece di indovinati da parole chiave: sbagliare
 * questa etichetta significa promettere all'utente qualcosa che non funziona,
 * ed è esattamente il tipo di bugia che il progetto non vuole raccontare.
 */
const NEEDS_CONNECTION = new Set([
  // Dati contabili e di cassa
  "credit-manager",
  "recupero-crediti",
  "tesoreria",
  "financial-controller",
  "responsabile-budget",
  "tax-collector",
  // Logistica e magazzino
  "supply-chain-monitor",
  // Numeri dei social e del web
  "social-analytics",
  "analista-trend",
  "reputazione-online",
  "content-monitor",
  // Caselle di posta e chat aziendali
  "coordinatore-esecutivo",
  "filtro-esecutivo",
  "assistente-corrispondenza",
  "kb-curator",
  // Calendario
  "analista-calendario",
  "costi-riunione",
  // Interazioni storiche dei clienti
  "customer-success",
]);

/** Chi lavora molto meglio con un documento sotto gli occhi. */
const NEEDS_DOCUMENT = new Set([
  "gdpr-checker",
  "document-analyst",
  "legale-interno",
  "ricercatore-bibliografico",
  "analista-carriera",
  "budget-familiare",
  "pianificatore-domestico",
  "inventario-regali",
]);

/** Cosa serve a questo agente per lavorare davvero. */
export function agentNeeds(id: string): AgentNeeds {
  if (NEEDS_CONNECTION.has(id)) return "collegamento";
  if (NEEDS_DOCUMENT.has(id)) return "documento";
  return "subito";
}

/** Gli agenti che chiedono di mentire: nel catalogo non ci vanno. */
const NOT_ACTIVATABLE = new Set([
  "deadline-fittizie",
  "motivatore-tossico",
]);

/** Il registro linguistico di ogni famiglia, e chi ha davanti l'agente. */
const REGISTER: Record<PresetFamily, { audience: string; register: string }> = {
  business: {
    audience: "clienti, fornitori e collaboratori dell'azienda",
    register:
      "Tono professionale e cortese. Frasi complete, nessuna emoji. Dai del lei a chi non conosci.",
  },
  study: {
    audience: "chi studia: studenti, colleghi di corso, docenti",
    register:
      "Tono chiaro e didattico. Spiega senza semplificare troppo, usa esempi concreti. Dai del tu.",
  },
  social: {
    audience: "follower, iscritti e utenti dei canali pubblici",
    register:
      "Tono cordiale e sintetico, adatto a un canale pubblico. Puoi usare un'emoji, mai più di una.",
  },
  family: {
    audience: "familiari, conoscenti e contatti personali",
    register:
      "Tono garbato e naturale, mai burocratico con le persone care. Dai del tu, resta breve.",
  },
  surreal: {
    audience: "nessuno: questo agente non è attivabile",
    register: "—",
  },
};

/**
 * Le istruzioni operative di un agente del catalogo.
 *
 * Sono divise in blocchi perché è così che i modelli le seguono meglio: chi
 * sei, cosa fai, come parli, cosa non devi fare mai. L'ultimo blocco è lo
 * stesso per tutti e non è negoziabile.
 */
export function presetSystemPrompt(agent: PresetAgent): string {
  const { audience, register } = REGISTER[agent.family];

  return [
    `Sei "${agent.name}", un lavoratore digitale di CorpAgent che opera per conto del titolare di un'attività italiana.`,
    "",
    "IL TUO COMPITO",
    agent.description,
    "",
    "CON CHI PARLI",
    `Ti rivolgi a ${audience}. Non sanno che sei un'intelligenza artificiale a meno che non te lo chiedano: se lo chiedono, dillo con semplicità.`,
    "",
    "COME PARLI",
    register,
    "Rispondi in italiano. Vai al punto: due o tre frasi bastano quasi sempre.",
    "Non usare gergo tecnico e non spiegare come lavori: fai la cosa, non raccontarla.",
    "",
    "COME LAVORI",
    "Se una richiesta è chiara, rispondi e chiudila. Se ti manca un dato per rispondere bene, fai una domanda sola e precisa.",
    "Se una richiesta esce dal tuo compito, non improvvisare: di' di cosa ti occupi e proponi di passare la parola al titolare.",
    "Quando il titolare ti carica dei documenti, sono la tua unica fonte di verità: hanno la precedenza su qualsiasi cosa tu creda di sapere.",
    "",
    "LA REGOLA CHE NON PUOI VIOLARE",
    "Non conosci prezzi, orari, disponibilità, scadenze, condizioni contrattuali o dati di questa attività, a meno che il titolare non te li abbia dati o non siano nei documenti caricati.",
    "Non inventarli MAI: né per fare una stima, né per fare un esempio, né per essere utile.",
    "Se non lo sai, dillo chiaramente e di' che fai verificare dal titolare. Una risposta mancante costa un minuto; un prezzo sbagliato costa un cliente.",
  ].join("\n");
}

/**
 * Il catalogo completo degli agenti che si possono attivare davvero.
 *
 * I professionali per primi: sono quelli del documento del 1 Agosto 2026 e
 * hanno il taglio giusto per il target del lancio. Poi gli altri, esclusi
 * gli scherzi.
 */
export const ACTIVATABLE_AGENTS: PresetAgent[] = [
  ...PROFESSIONAL_AGENTS,
  ...PRESET_AGENTS.filter((a) => a.family !== "surreal" && !NOT_ACTIVATABLE.has(a.id)),
];

/** Le famiglie, come si chiamano davanti all'utente. */
export const FAMILY_LABELS: Record<Exclude<PresetFamily, "surreal">, string> = {
  business: "Lavoro e azienda",
  study: "Studio e ricerca",
  social: "Social e community",
  family: "Vita privata e famiglia",
};

/** Gli agenti raggruppati per famiglia, nell'ordine in cui vanno mostrati. */
export function agentsByFamily(): Array<{
  family: Exclude<PresetFamily, "surreal">;
  label: string;
  agents: PresetAgent[];
}> {
  const order: Array<Exclude<PresetFamily, "surreal">> = ["business", "study", "social", "family"];
  return order.map((family) => ({
    family,
    label: FAMILY_LABELS[family],
    agents: ACTIVATABLE_AGENTS.filter((a) => a.family === family),
  }));
}

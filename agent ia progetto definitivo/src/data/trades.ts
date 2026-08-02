import type { DataHome, HomeCard, Trade, TradeId, VolumeId } from "../types";

/**
 * I mestieri del target V1: negozi, ristoranti e PMI italiane che lavorano su WhatsApp.
 * Ogni mestiere decide che agente nasce, quali carte compaiono in Home e cosa propone
 * il motore di raccomandazione a tre livelli (agente, connettore, piano).
 */
export const TRADES: Trade[] = [
  {
    id: "ristorante",
    label: "Ristorante o bar",
    examples: "pizzeria, trattoria, caffetteria",
    knowledgeName: "il menù",
    timeSinks: [
      { label: "Rispondere a chi chiede orari e prezzi", intent: "assistenza" },
      { label: "Prendere prenotazioni al telefono", intent: "prenotazioni" },
      { label: "Ripetere sempre le stesse informazioni", intent: "assistenza" },
    ],
    dataHome: "calendario",
    agentName: "Addetto Sala",
    agentRole: "Risponde ai clienti su prezzi, orari e prenotazioni, senza sbagliare il menù",
  },
  {
    id: "negozio",
    label: "Negozio",
    examples: "abbigliamento, ferramenta, alimentari",
    knowledgeName: "il listino",
    timeSinks: [
      { label: "Rispondere a chi chiede se un prodotto è disponibile", intent: "assistenza" },
      { label: "Ripetere prezzi e orari di apertura", intent: "assistenza" },
      { label: "Gestire ordini e trattative sul prezzo", intent: "vendite" },
    ],
    dataHome: "ecommerce",
    agentName: "Addetto Vendite",
    agentRole: "Risponde su disponibilità e prezzi dei prodotti leggendo il tuo listino",
  },
  {
    id: "servizi",
    label: "Servizi alla persona",
    examples: "parrucchiere, estetista, palestra",
    knowledgeName: "il listino trattamenti",
    timeSinks: [
      { label: "Fissare e spostare appuntamenti", intent: "prenotazioni" },
      { label: "Rispondere a chi chiede quanto costa un trattamento", intent: "assistenza" },
      { label: "Ricordare gli appuntamenti ai clienti", intent: "prenotazioni" },
    ],
    dataHome: "calendario",
    agentName: "Addetto Appuntamenti",
    agentRole: "Fissa e sposta appuntamenti e risponde sui prezzi dei trattamenti",
  },
  {
    id: "studio",
    label: "Studio professionale",
    examples: "commercialista, avvocato, tecnico",
    knowledgeName: "il tariffario",
    timeSinks: [
      { label: "Filtrare le richieste dei nuovi clienti", intent: "assistenza" },
      { label: "Rispondere a domande ripetitive", intent: "assistenza" },
      { label: "Fissare i primi appuntamenti", intent: "prenotazioni" },
    ],
    dataHome: "calendario",
    agentName: "Segreteria",
    agentRole: "Filtra le richieste in arrivo e risponde alle domande ripetitive",
  },
  {
    id: "altro",
    label: "Altro",
    examples: "raccontami tu di cosa ti occupi",
    knowledgeName: "i tuoi documenti",
    timeSinks: [
      { label: "Rispondere sempre alle stesse domande", intent: "assistenza" },
      { label: "Gestire richieste fuori orario", intent: "assistenza" },
      { label: "Fissare appuntamenti", intent: "prenotazioni" },
    ],
    dataHome: "chat",
    agentName: "Assistente",
    agentRole: "Risponde ai clienti al posto tuo, con le informazioni che gli dai",
  },
];

/** Quanto traffico genera di solito ogni mestiere: guida il piano consigliato. */
export const VOLUME_BY_TRADE: Record<TradeId, VolumeId> = {
  ristorante: "alto",
  negozio: "medio",
  servizi: "medio",
  studio: "basso",
  altro: "basso",
};

/** Come si chiama il "posto" dove vivono i dati, in una frase per l'utente. */
export const DATA_HOME_LABELS: Record<DataHome, string> = {
  chat: "nella chat stessa",
  ecommerce: "nel tuo gestionale o e-commerce",
  calendario: "nel calendario o CRM",
  documenti: "nei tuoi documenti",
};

export const CHANNELS = ["WhatsApp", "Instagram", "Telefono", "Email"];

export function tradeById(id: TradeId): Trade {
  return TRADES.find((t) => t.id === id) ?? TRADES[TRADES.length - 1];
}

/**
 * Come si chiamano le "classi" che l'utente crea parlando, mestiere per mestiere.
 * È lo stesso meccanismo per tutti: cambia solo il vocabolario, così ognuno riconosce
 * il proprio lavoro invece di leggere la parola "entità".
 */
export const STRUCTURE_BY_TRADE: Record<
  TradeId,
  { plural: string; singular: string; question: string; examples: string }
> = {
  ristorante: {
    plural: "le sale",
    singular: "sala",
    question: "Come sono divisi i tuoi tavoli?",
    examples: "sala interna, veranda, dehors",
  },
  negozio: {
    plural: "i reparti",
    singular: "reparto",
    question: "Come è diviso il tuo negozio?",
    examples: "uomo, donna, accessori",
  },
  servizi: {
    plural: "i servizi",
    singular: "servizio",
    question: "Quali servizi offri?",
    examples: "taglio, colore, piega",
  },
  studio: {
    plural: "le aree",
    singular: "area",
    question: "Di cosa ti occupi, per aree?",
    examples: "contabilità, fiscale, contenzioso",
  },
  altro: {
    plural: "le categorie",
    singular: "categoria",
    question: "Come è organizzato il tuo lavoro?",
    examples: "scrivile come le chiami tu",
  },
};

/**
 * Le carte della Home. Solo quelle utili al mestiere scelto: è il principio 1 della bibbia.
 * L'ordine conta — la prima cosa che vede l'utente deve essere quella che gli manca.
 */
export function buildHomeCards(trade: Trade, channel: string): HomeCard[] {
  return [
    {
      id: "agent",
      title: "Il tuo dipendente IA",
      body: trade.agentRole,
      action: "Parla con lui",
    },
    {
      id: "knowledge",
      title: `Carica ${trade.knowledgeName}`,
      body: `Senza questo l'agente può sbagliare i prezzi. Con questo, mai.`,
      action: "Carica un file",
    },
    {
      id: "channel",
      title: `Collega ${channel}`,
      body: `I clienti ti scrivono su ${channel}: l'agente risponde lì, 24 ore su 24.`,
      action: "Collega",
    },
    {
      id: "structure",
      title: `Definisci ${STRUCTURE_BY_TRADE[trade.id].plural}`,
      body: "Raccontalo a parole: l'agente impara come è organizzato il tuo lavoro.",
      action: "Configura parlando",
    },
    {
      id: "savings",
      title: "Quanto stai risparmiando",
      body: "Ore e euro che ti tornano indietro ogni settimana.",
      action: "Vedi il conto",
    },
  ];
}

/**
 * Le voci di navigazione sono tre (Home, Chat, Impostazioni Avanzate), come vuole la
 * bibbia. Conoscenza, Struttura e Risparmio sono schermate raggiunte dalle carte della
 * Home: esistono, ma non affollano la barra laterale.
 */
export type NavKey =
  | "home"
  | "chat"
  | "advanced"
  | "knowledge"
  | "structure"
  | "savings";

/**
 * Un progetto: una conversazione separata. Il primo è la configurazione degli agenti,
 * gli altri li crea l'utente per pianificare quello che gli serve, come un chatbot normale.
 */
export interface Project {
  id: string;
  name: string;
  /** Il progetto di configurazione non si può chiudere. */
  deletable: boolean;
}

/** Un kit pronto: la squadra completa che l'IA propone dopo una sola domanda. */
export interface Kit {
  headline: string;
  agents: Array<{ name: string; role: string }>;
  connectors: Array<{ name: string; why: string }>;
  knowledge: string;
  planId: PlanId;
  planWhy: string;
}

/** Le risposte al sondaggio d'ingresso, prima del Master Builder. */
export interface SurveyAnswers {
  source?: string;
  teamSize?: string;
  workplace?: string;
}

// ─── Master Builder e Home su misura ──────────────────────────────────

export type TradeId = "ristorante" | "negozio" | "servizi" | "studio" | "altro";

/** Che tipo di problema porta più via tempo: guida la scelta dell'agente. */
export type Intent = "assistenza" | "prenotazioni" | "vendite";

/** Dove vivono le informazioni che servono all'agente per lavorare da solo. */
export type DataHome = "chat" | "ecommerce" | "calendario" | "documenti";

export interface TimeSink {
  label: string;
  intent: Intent;
}

/** Quanti messaggi al giorno: guida la scelta del piano. */
export type VolumeId = "basso" | "medio" | "alto" | "altissimo";

/** Il tono con cui l'agente parla ai clienti. */
export type ToneId = "accogliente" | "deciso" | "formale";

/** Un mestiere del target V1: decide che agente nasce e cosa compare in Home. */
export interface Trade {
  id: TradeId;
  label: string;
  examples: string;
  /** Come si chiama il documento che gli serve caricare: "il menù", "il listino"... */
  knowledgeName: string;
  timeSinks: TimeSink[];
  dataHome: DataHome;
  agentName: string;
  agentRole: string;
}

/** Il consiglio strutturato su tre livelli che chiude il Master Builder. */
export interface Recommendation {
  agent: { name: string; role: string; why: string };
  connector: { id: string; name: string; why: string };
  plan: { id: PlanId; name: string; price: string; why: string };
}

export interface HomeCard {
  id: "agent" | "knowledge" | "channel" | "structure" | "savings";
  title: string;
  body: string;
  action: string;
}

// ─── Canale WhatsApp ──────────────────────────────────────────────────

export type ChannelStatus = "disconnected" | "connecting" | "connected";

// ─── Base di conoscenza ───────────────────────────────────────────────

export interface KnowledgeDoc {
  id: string;
  name: string;
  size: number;
}

// ─── Configurazione guidata (la struttura che l'utente crea parlando) ──

/**
 * Una "classe" che l'utente definisce conversando: le sale di un ristorante, i reparti di
 * un negozio, i turni del personale, i corsi di una palestra. Il nome del tipo lo decide
 * il mestiere, il contenuto lo decide l'utente.
 */
export interface StructureClass {
  id: string;
  name: string;
  /** Dettagli liberi che l'utente ha dettato: "20 coperti", "solo la sera". */
  details: string[];
}

/** Una regola operativa che l'agente deve rispettare. */
export interface StructureRule {
  id: string;
  text: string;
}

/** Tutta la configurazione costruita parlando, salvabile e rileggibile. */
export interface Structure {
  classes: StructureClass[];
  rules: StructureRule[];
}

/** Cosa ha risposto l'utente al Master Builder. */
export interface BuilderProfile {
  tradeId: TradeId;
  timeSink: string;
  channel: string;
}

// ─── Modelli ──────────────────────────────────────────────────────────

export type ModelCategory =
  | "reasoning"
  | "opensource"
  | "websearch"
  | "lightweight"
  | "router"
  | "image"
  | "music"
  | "video"
  | "voice"
  | "coding"
  | "webagent"
  | "science"
  | "math"
  | "translation"
  | "gaming"
  | "vision"
  | "predictive"
  | "computeruse"
  | "monitoring";

/** Come si raggiunge un modello. */
export type ModelAccess =
  | "openrouter"
  | "media"
  | "direct"
  | "integration"
  | "selfhost";

/** Quanto pesa una chiamata: serve per la scelta automatica e per l'avviso costi. */
export type ModelWeight = "light" | "standard" | "heavy";

export interface ModelDefinition {
  id: string;
  name: string;
  provider: string;
  category: ModelCategory;
  tagline: string;
  access: ModelAccess;
  weight: ModelWeight;
  /** Identificativo OpenRouter. Da leggere dall'API nel Passaggio 6, non a memoria. */
  slug?: string;
}

export const CATEGORY_LABELS: Record<ModelCategory, string> = {
  reasoning: "Logica, ragionamento e coding",
  opensource: "Open-source ad alta velocità",
  websearch: "Ricerca web in tempo reale",
  lightweight: "Leggeri e di settore",
  router: "Meta-router universale",
  image: "Immagini e grafica",
  music: "Musica e audio",
  video: "Video",
  voice: "Voce, sintesi e cloni vocali",
  coding: "Coding e sviluppo software",
  webagent: "Agenti web autonomi",
  science: "Scienza e biologia",
  math: "Matematica e dimostrazione formale",
  translation: "Traduzione e multilingua",
  gaming: "Gaming, RL e simulazione",
  vision: "Computer vision e analisi visiva",
  predictive: "Predittivi e time-series",
  computeruse: "Computer-use e navigazione GUI",
  monitoring: "Monitoraggio di sistema e log",
};

export const ACCESS_LABELS: Record<ModelAccess, string> = {
  openrouter: "OpenRouter",
  media: "Gateway media",
  direct: "API dedicata",
  integration: "Integrazione",
  selfhost: "Da ospitare",
};

/** Spiega all'utente cosa comporta ogni modalità di accesso. */
export const ACCESS_NOTES: Record<ModelAccess, string> = {
  openrouter: "Raggiungibile con la tua chiave OpenRouter, senza altri account.",
  media: "Passa dal gateway per immagini, video e audio.",
  direct: "Richiede un account e una chiave del provider.",
  integration: "È un prodotto da collegare, non un modello di chat.",
  selfhost: "È una libreria da far girare su un tuo server.",
};

// ─── Connettori ───────────────────────────────────────────────────────

export type ConnectorFamily =
  | "messaging"
  | "email"
  | "web"
  | "files"
  | "calendar"
  | "business"
  | "automation";

export interface ConnectorDefinition {
  id: string;
  name: string;
  family: ConnectorFamily;
  description: string;
  connected: boolean;
}

export const CONNECTOR_FAMILY_LABELS: Record<ConnectorFamily, string> = {
  messaging: "Messaggistica e chat",
  email: "Email",
  web: "Web e ricerca",
  files: "File, documenti e database",
  calendar: "Calendario e progetti",
  business: "Business e pagamenti",
  automation: "Automazione e sviluppo",
};

// ─── Agenti ───────────────────────────────────────────────────────────

/** Le cinque famiglie di agenti preimpostati. */
export type PresetFamily = "business" | "study" | "social" | "family" | "surreal";

/** Un agente pronto all'uso, scelto dal catalogo. */
export interface PresetAgent {
  id: string;
  name: string;
  family: PresetFamily;
  description: string;
}

/** Un agente è un ruolo configurato dall'utente, servito da un modello. */
export interface RoleAgent {
  id: string;
  name: string;
  role: string;
  modelId: string;
  active: boolean;
  /** Vero se l'utente lo ha creato descrivendolo a parole. */
  custom?: boolean;
}

// ─── Chat ─────────────────────────────────────────────────────────────

export type ChatRole = "user" | "agent";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  pending?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  agentId: string;
  messages: ChatMessage[];
  /** `"auto"` sceglie il modello in base alla difficoltà della richiesta. */
  modelId: string | "auto";
}

export interface AutomationFlow {
  id: string;
  name: string;
  steps: string[];
  active: boolean;
}

// ─── Piani ────────────────────────────────────────────────────────────

export type PlanId = "free" | "starter" | "business" | "pro" | "byok" | "enterprise";

export interface Plan {
  id: PlanId;
  name: string;
  price: string;
  cadence: string;
  pitch: string;
  features: string[];
  /** Peso massimo di richiesta consentito dal piano. */
  maxWeight: ModelWeight;
}

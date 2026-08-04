/**
 * Il ponte tra quello che si vede e quello che gira sul server.
 *
 * Finora l'interfaccia viveva di stato locale e risposte simulate, mentre in
 * `api/` c'era un backend completo che nessuno chiamava. Questo file è l'unico
 * punto in cui il browser parla col server: se un giorno cambia un indirizzo o
 * il formato di una risposta, si corregge qui e non in dieci componenti.
 *
 * Nessuna chiave passa da qui. Il browser conosce solo `/api/...`; le chiavi
 * vivono nelle funzioni su Vercel, come dice CLAUDE.md.
 */

import { createAuthClient } from "better-auth/react";

// ─────────────────────────────────────────────────────────────────────────
// ACCESSI
// ─────────────────────────────────────────────────────────────────────────

/**
 * Il client di Better Auth. Parla con `api/auth/[...all].ts`, che gira sullo
 * stesso indirizzo del sito: per questo non serve configurare nessun URL.
 *
 * Uso tipico:
 *   const { data: session, isPending } = authClient.useSession();
 *   authClient.signIn.social({ provider: "google", callbackURL: "/" });
 *   authClient.signOut();
 */
export const authClient = createAuthClient();

// ─────────────────────────────────────────────────────────────────────────
// ERRORI
// ─────────────────────────────────────────────────────────────────────────

/**
 * Un errore che sa già cosa dire all'utente.
 *
 * Il backend risponde con messaggi in italiano e già comprensibili (per
 * esempio "Devi entrare prima di poter chattare", oppure quale variabile
 * d'ambiente manca). Li mostriamo così come sono invece di sostituirli con un
 * "qualcosa è andato storto" che non aiuta nessuno.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly detail?: string;

  constructor(status: number, message: string, detail?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }

  /** Vero quando serve entrare: l'interfaccia deve riportare al login. */
  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  /**
   * Vero quando manca una chiave o il database non è collegato. Non è colpa
   * dell'utente: è configurazione che manca a Tommaso.
   */
  get isNotConfigured(): boolean {
    return this.status === 503;
  }
}

async function readError(response: Response): Promise<ApiError> {
  let message = `Il server ha risposto ${response.status}.`;
  let detail: string | undefined;

  try {
    const body = (await response.json()) as { error?: string; detail?: string };
    if (body.error) message = body.error;
    detail = body.detail;
  } catch {
    // Risposta non in JSON: teniamo il messaggio generico.
  }

  return new ApiError(response.status, message, detail);
}

// ─────────────────────────────────────────────────────────────────────────
// CHAT
// ─────────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: "user" | "agent";
  content: string;
}

/** L'avviso costi della riga 5: arriva PRIMA che si sia speso qualcosa. */
export interface HeavyWarning {
  model: string;
  estimatedEur: number;
  message: string;
}

/**
 * Cosa succede durante una risposta. La chat consuma questi eventi in ordine:
 *
 *   warning → la richiesta è impegnativa, chiedi conferma e fermati qui
 *   model   → quale modello ha preso in carico la domanda
 *   delta   → un pezzo di risposta, da aggiungere a quello che si vede
 *   done    → finita
 */
export type ChatEvent =
  | { kind: "warning"; warning: HeavyWarning }
  | { kind: "model"; model: string; load: string }
  | { kind: "delta"; text: string }
  | { kind: "done" };

export interface StreamChatOptions {
  messages: ChatMessage[];
  systemPrompt?: string;
  /** Assente o `"auto"` = lo sceglie il server in base alla difficoltà. */
  modelSlug?: string;
  /** Dove archiviare la conversazione. Assente = si risponde ma non si salva. */
  projectId?: string;
  /** L'utente ha visto l'avviso costi e ha detto di procedere. */
  confirmHeavy?: boolean;
  /** Per fermare la risposta a metà, col pulsante "interrompi". */
  signal?: AbortSignal;
}

/**
 * Chiede una risposta e la restituisce a pezzi, mentre arriva.
 *
 * Si usa con `for await`, che è il modo più semplice di far comparire il testo
 * parola per parola:
 *
 *   for await (const event of streamChat({ messages })) {
 *     if (event.kind === "warning") { chiediConferma(event.warning); break; }
 *     if (event.kind === "delta")   setTesto((t) => t + event.text);
 *   }
 *
 * L'avviso costi non è un errore: è una domanda. Quando arriva, la risposta
 * non è ancora stata generata e non è stato speso niente. Per procedere si
 * richiama questa funzione con `confirmHeavy: true`.
 */
export async function* streamChat(options: StreamChatOptions): AsyncGenerator<ChatEvent> {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // I cookie di sessione devono viaggiare: senza, il server non sa chi siamo
    // e risponde 401. Stesso indirizzo, quindi basta "same-origin".
    credentials: "same-origin",
    signal: options.signal,
    body: JSON.stringify({
      messages: options.messages,
      systemPrompt: options.systemPrompt,
      modelSlug: options.modelSlug,
      projectId: options.projectId,
      confirmHeavy: options.confirmHeavy,
    }),
  });

  if (!response.ok) throw await readError(response);

  // Due risposte diverse dallo stesso indirizzo: l'avviso costi arriva in JSON,
  // la risposta vera arriva come flusso. Si distinguono dal tipo di contenuto.
  const contentType = response.headers.get("Content-Type") ?? "";
  if (contentType.includes("application/json")) {
    const body = (await response.json()) as {
      needsConfirmation?: boolean;
      warning?: HeavyWarning;
    };
    if (body.needsConfirmation && body.warning) {
      yield { kind: "warning", warning: body.warning };
      return;
    }
    throw new ApiError(response.status, "Risposta del server inattesa.");
  }

  yield {
    kind: "model",
    model: response.headers.get("X-Model-Used") ?? "sconosciuto",
    load: response.headers.get("X-Load") ?? "standard",
  };

  if (!response.body) throw new ApiError(502, "Il server non ha inviato nessuna risposta.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Le righe arrivano spezzate a metà: si tiene da parte l'ultima, che è
      // incompleta, e si elabora tutto il resto.
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();

        // Righe che non iniziano con "data:" sono commenti di servizio:
        // OpenRouter manda ": OPENROUTER PROCESSING" per tenere aperta la
        // connessione durante le attese. Si ignorano.
        if (!trimmed.startsWith("data:")) continue;

        const payload = trimmed.slice(5).trim();
        if (payload === "" || payload === "[DONE]") continue;

        let parsed: { choices?: Array<{ delta?: { content?: string } }> };
        try {
          parsed = JSON.parse(payload);
        } catch {
          // JSON tagliato a metà da un chunk: arriverà completo col prossimo.
          continue;
        }

        const text = parsed.choices?.[0]?.delta?.content;
        if (typeof text === "string" && text.length > 0) {
          yield { kind: "delta", text };
        }
      }
    }
  } finally {
    // Se chi consuma esce dal ciclo prima della fine (pulsante "interrompi",
    // o un errore nel componente), il collegamento va chiuso comunque:
    // altrimenti resta appeso e conta come richiesta in corso.
    reader.cancel().catch(() => {});
  }

  yield { kind: "done" };
}

/**
 * Raccoglie una risposta intera invece di mostrarla mentre arriva.
 *
 * Serve dove lo streaming non aggiunge niente — per esempio quando il Master
 * Builder ragiona in sottofondo e all'utente interessa solo il risultato.
 * Se il server chiede conferma per i costi, la restituisce invece del testo.
 */
export async function askChat(
  options: StreamChatOptions
): Promise<{ text: string; model: string } | { warning: HeavyWarning }> {
  let text = "";
  let model = "sconosciuto";

  for await (const event of streamChat(options)) {
    if (event.kind === "warning") return { warning: event.warning };
    if (event.kind === "model") model = event.model;
    if (event.kind === "delta") text += event.text;
  }

  return { text, model };
}

// ─────────────────────────────────────────────────────────────────────────
// IL MASTER BUILDER (riga 7 della Fase 1)
// ─────────────────────────────────────────────────────────────────────────

/** I toni che l'agente può usare coi clienti finali. */
export type AgentTone = "cordiale" | "neutro" | "formale" | "come-parlo-io";

export interface ProposedAgent {
  name: string;
  role: string;
  /** Le istruzioni operative: nascoste dietro "vedi le istruzioni". */
  instructions: string;
  tone: AgentTone;
}

/**
 * Cosa risponde il Master Builder.
 *
 * Due forme, perché si comporta come un consulente: prima fa due o tre
 * domande, poi propone. Il frontend guarda `kind` e sa cosa disegnare.
 */
export type BuildResult =
  | { kind: "question"; message: string; question: string }
  | { kind: "proposal"; message: string; agents: ProposedAgent[] };

/**
 * Chiede al Master Builder di leggere la conversazione e generare gli agenti.
 *
 * Non è streaming: all'utente non serve vedere un JSON che si scrive, gli
 * serve la carta pronta da confermare. Ci vogliono 3-8 secondi.
 */
export async function buildAgent(options: {
  messages: ChatMessage[];
  /** Quanti agenti ha già: serve per l'avviso sul limite del piano Free. */
  agentCount?: number;
}): Promise<BuildResult> {
  const response = await fetch("/api/build-agent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(options),
  });
  if (!response.ok) throw await readError(response);
  return (await response.json()) as BuildResult;
}

// ─────────────────────────────────────────────────────────────────────────
// PROGETTI E CONVERSAZIONI (riga 9 della Fase 1)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Un progetto come lo restituisce il server.
 *
 * Ha in più `isSetup`: è il progetto di configurazione, quello dove vive la
 * conversazione col Master Builder. Non si può cancellare, e ce n'è uno solo
 * per utente. `deletable` è il suo contrario, ed esiste perché l'interfaccia
 * ragiona in termini di "questo si può chiudere".
 */
export interface StoredProject {
  id: string;
  name: string;
  agentId: string | null;
  isSetup: boolean;
  deletable: boolean;
  createdAt: string;
}

/** Un messaggio salvato, con quanto è costato. */
export interface StoredMessage {
  id: string;
  role: "user" | "agent" | "system";
  content: string;
  modelSlug: string | null;
  tokensIn: number;
  tokensOut: number;
  costEur: number;
  handledAlone: boolean;
  createdAt: string;
}

export interface StoredProjectWithMessages extends StoredProject {
  messages: StoredMessage[];
}

export async function listProjects(): Promise<StoredProject[]> {
  const response = await fetch("/api/projects", { credentials: "same-origin" });
  if (!response.ok) throw await readError(response);
  return (await response.json()) as StoredProject[];
}

/** Un progetto con dentro tutta la sua conversazione: serve a riaprirla dov'era. */
export async function getProject(id: string): Promise<StoredProjectWithMessages> {
  const response = await fetch(`/api/projects?id=${encodeURIComponent(id)}`, {
    credentials: "same-origin",
  });
  if (!response.ok) throw await readError(response);
  return (await response.json()) as StoredProjectWithMessages;
}

export async function createProject(input: {
  name: string;
  agentId?: string;
  isSetup?: boolean;
}): Promise<StoredProject> {
  const response = await fetch("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(input),
  });
  if (!response.ok) throw await readError(response);
  return (await response.json()) as StoredProject;
}

/**
 * Cambia il nome di una chat.
 *
 * Serve soprattutto al battesimo automatico: una chat nasce come "Nuova chat"
 * con un tocco solo, e prende il suo nome dalle prime parole che ci scrivi.
 * Chiedere di inventare un titolo prima di aver scritto niente è il tipo di
 * attrito che fa smettere di creare chat nuove.
 */
export async function renameProject(id: string, name: string): Promise<StoredProject> {
  const response = await fetch("/api/projects", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ id, name }),
  });
  if (!response.ok) throw await readError(response);
  return (await response.json()) as StoredProject;
}

export async function deleteProject(id: string): Promise<void> {
  const response = await fetch(`/api/projects?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "same-origin",
  });
  if (!response.ok) throw await readError(response);
}

// ─────────────────────────────────────────────────────────────────────────
// AGENTI
// ─────────────────────────────────────────────────────────────────────────

export interface StoredAgent {
  id: string;
  name: string;
  role: string;
  systemPrompt: string | null;
  modelSlug: string | null;
  active: boolean;
  isCustom: boolean;
  createdAt: string;
}

export async function listAgents(): Promise<StoredAgent[]> {
  const response = await fetch("/api/agents", { credentials: "same-origin" });
  if (!response.ok) throw await readError(response);
  return (await response.json()) as StoredAgent[];
}

export async function createAgent(input: {
  name: string;
  role: string;
  systemPrompt?: string;
  modelSlug?: string;
  isCustom?: boolean;
}): Promise<StoredAgent> {
  const response = await fetch("/api/agents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(input),
  });
  if (!response.ok) throw await readError(response);
  return (await response.json()) as StoredAgent;
}

/**
 * Cambia un agente. Si manda **solo** quello che cambia: il server usa
 * `coalesce` su ogni campo, quindi accendere un interruttore è
 * `updateAgent({ id, active: false })` e nient'altro.
 */
export async function updateAgent(patch: {
  id: string;
  name?: string;
  role?: string;
  systemPrompt?: string;
  modelSlug?: string;
  active?: boolean;
}): Promise<StoredAgent> {
  const response = await fetch("/api/agents", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(patch),
  });
  if (!response.ok) throw await readError(response);
  return (await response.json()) as StoredAgent;
}

export async function deleteAgent(id: string): Promise<void> {
  const response = await fetch(`/api/agents?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "same-origin",
  });
  if (!response.ok) throw await readError(response);
}

// ─────────────────────────────────────────────────────────────────────────
// LA MEMORIA: I DOCUMENTI (Fase 2)
// ─────────────────────────────────────────────────────────────────────────

/** Come è entrato un documento nella memoria dell'agente. */
export type DocumentSource = "upload" | "paste" | "photo" | "drive";

export interface StoredDocument {
  id: string;
  name: string;
  source: DocumentSource;
  sizeBytes: number | null;
  status: "pending" | "indexed" | "error";
  /** In quanti pezzi è stato diviso: è la misura di quanto ne sa l'agente. */
  chunkCount: number;
  error: string | null;
  updatedAt: string;
  createdAt: string;
}

export async function listDocuments(): Promise<StoredDocument[]> {
  const response = await fetch("/api/documents", { credentials: "same-origin" });
  if (!response.ok) throw await readError(response);
  return (await response.json()) as StoredDocument[];
}

/**
 * Manda un documento alla memoria dell'agente.
 *
 * ⚠️ Arriva **testo**, non un file. L'estrazione da PDF e Word avviene nel
 * browser (`src/lib/extract.ts`), per due motivi: le librerie stanno già lì, e
 * una funzione su Vercel ha un tempo massimo che un PDF di cento pagine
 * supererebbe.
 *
 * `externalId` serve ai documenti che vengono da fuori (Google Drive): lo
 * stesso file aggiornato sostituisce il precedente invece di duplicarlo.
 */
export async function addDocument(input: {
  name: string;
  text: string;
  source: DocumentSource;
  externalId?: string;
  /**
   * Vero quando il testo e parlato o scritto di fretta: il server lo fa mettere
   * in ordine da un modello prima di indicizzarlo (riga 8 del PERCORSO).
   * "Ho tre sale, dentro 40, la veranda 20 ma solo d'estate" diventa un elenco
   * con le sue sezioni, e le eccezioni non si perdono.
   */
  organise?: boolean;
}): Promise<StoredDocument> {
  const response = await fetch("/api/documents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(input),
  });
  if (!response.ok) throw await readError(response);
  return (await response.json()) as StoredDocument;
}

export async function deleteDocument(id: string): Promise<void> {
  const response = await fetch(`/api/documents?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "same-origin",
  });
  if (!response.ok) throw await readError(response);
}

/**
 * Legge il testo da una foto, con un modello che vede.
 *
 * È la strada più vicina all'obiettivo "zero documenti": nessun file da
 * preparare, si fotografa il menù appeso al muro. Gira sul server perché è lì
 * che vivono le chiavi, e usa un modello di visione invece di una libreria di
 * OCR — più preciso su un menù scritto a mano, e due megabyte in meno da
 * scaricare a ogni visita.
 */
export async function readPhoto(dataUrl: string): Promise<{ text: string }> {
  const response = await fetch("/api/media", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ kind: "ocr", image: dataUrl }),
  });
  if (!response.ok) throw await readError(response);
  return (await response.json()) as { text: string };
}

/** Da dove l'agente ha preso l'informazione. La vede solo il titolare. */
export interface AnswerSource {
  name: string;
  heading: string | null;
  ordinal: number;
  /** Da 0 a 1: quanto il pezzo somigliava alla domanda. */
  similarity: number;
}

// ─────────────────────────────────────────────────────────────────────────
// LE DOMANDE RIMASTE APERTE
// ─────────────────────────────────────────────────────────────────────────

export interface OpenQuestion {
  id: string;
  channel: "chat" | "whatsapp" | "web";
  question: string;
  holdingReply: string | null;
  status: "open" | "answered" | "dismissed";
  answer: string | null;
  createdAt: string;
}

export async function listOpenQuestions(): Promise<OpenQuestion[]> {
  const response = await fetch("/api/questions", { credentials: "same-origin" });
  if (!response.ok) throw await readError(response);
  return (await response.json()) as OpenQuestion[];
}

/**
 * Rispondi a una domanda rimasta aperta.
 *
 * La risposta non chiude solo quella riga: diventa **memoria permanente**, così
 * la stessa domanda non tornerà mai più senza risposta. È il meccanismo che fa
 * crescere l'agente usandolo, senza caricare niente.
 */
export async function answerQuestion(id: string, answer: string): Promise<OpenQuestion> {
  const response = await fetch("/api/questions", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ id, answer }),
  });
  if (!response.ok) throw await readError(response);
  return (await response.json()) as OpenQuestion;
}

export async function dismissQuestion(id: string): Promise<void> {
  const response = await fetch("/api/questions", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ id, dismiss: true }),
  });
  if (!response.ok) throw await readError(response);
}

// ─────────────────────────────────────────────────────────────────────────
// MODELLI
// ─────────────────────────────────────────────────────────────────────────

/** Un modello del catalogo OpenRouter, coi prezzi veri. */
export interface CatalogModelInfo {
  id: string;
  name: string;
  promptUsd: number;
  completionUsd: number;
  context: number;
}

export interface ModelsResponse {
  /** Cosa sceglierebbe il server, adesso, per i tre pesi di richiesta. */
  chosen: { light: string; standard: string; heavy: string };
  models: CatalogModelInfo[];
}

/**
 * Il catalogo vero, dal server (che lo tiene in memoria dieci minuti).
 * È quello che alimenta il selettore dei modelli nella chat.
 */
export async function getModels(): Promise<ModelsResponse> {
  const response = await fetch("/api/models", { credentials: "same-origin" });
  if (!response.ok) throw await readError(response);
  return (await response.json()) as ModelsResponse;
}

// ─────────────────────────────────────────────────────────────────────────
// IMMAGINI E VOCE
// ─────────────────────────────────────────────────────────────────────────

/** Genera un'immagine con OpenAI. Ci mette 15-40 secondi: mostrare l'attesa. */
export async function generateImage(prompt: string): Promise<{ dataUrl: string }> {
  const response = await fetch("/api/media", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ kind: "image", prompt }),
  });
  if (!response.ok) throw await readError(response);
  return (await response.json()) as { dataUrl: string };
}

/**
 * Fa leggere un testo alla voce dell'agente (ElevenLabs) e lo suona.
 * Restituisce l'elemento audio, così chi chiama può fermarlo.
 */
export async function speak(text: string): Promise<HTMLAudioElement> {
  const response = await fetch("/api/media", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ kind: "speech", text }),
  });
  if (!response.ok) throw await readError(response);

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  // L'URL temporaneo va liberato quando l'audio finisce, o resta in memoria.
  audio.addEventListener("ended", () => URL.revokeObjectURL(url), { once: true });
  await audio.play();
  return audio;
}

// ─────────────────────────────────────────────────────────────────────────
// CONFIGURAZIONE E PROFILO
// ─────────────────────────────────────────────────────────────────────────

/** Cosa è collegato adesso. Nessun valore di chiave, solo nomi e sì/no. */
export interface PublicConfig {
  /** Con quali pulsanti si può entrare: vuoto = nessuno configurato. */
  providers: string[];
  databaseReady: boolean;
  chatReady: boolean;
  /** I NOMI delle variabili che mancano, per capire cosa sistemare. */
  missing: string[];
}

export async function getConfig(): Promise<PublicConfig> {
  const response = await fetch("/api/config", { credentials: "same-origin" });
  if (!response.ok) throw await readError(response);
  return (await response.json()) as PublicConfig;
}

/**
 * Fa verificare al server il gettone di Cloudflare Turnstile (riga 10).
 *
 * `configured: false` significa che la chiave segreta non c'e ancora: si passa
 * comunque, ed e voluto. Un cancello che nessuno puo aprire e peggio di nessun
 * cancello, e l'interfaccia lo dichiara invece di far credere a una protezione
 * che non esiste.
 */
export async function verifyHuman(
  token: string
): Promise<{ ok: boolean; configured: boolean; unverified?: boolean }> {
  const response = await fetch("/api/profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ token }),
  });
  if (!response.ok) throw await readError(response);
  return (await response.json()) as { ok: boolean; configured: boolean; unverified?: boolean };
}

export interface Profile {
  id: string;
  email: string | null;
  tradeId: string | null;
  channel: string | null;
  planId: string | null;
  survey: { source?: string; teamSize?: string; workplace?: string };
  createdAt: string;
}

export async function getProfile(): Promise<Profile> {
  const response = await fetch("/api/profile", { credentials: "same-origin" });
  if (!response.ok) throw await readError(response);
  return (await response.json()) as Profile;
}

/** Vero quando l'utente ha già risposto alle tre domande d'ingresso. */
export function surveyComplete(profile: Profile | null): boolean {
  const survey = profile?.survey;
  return Boolean(survey?.source && survey.teamSize && survey.workplace);
}

export async function saveProfile(patch: {
  survey?: Record<string, unknown>;
  tradeId?: string;
  channel?: string;
}): Promise<Profile> {
  const response = await fetch("/api/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(patch),
  });
  if (!response.ok) throw await readError(response);
  return (await response.json()) as Profile;
}

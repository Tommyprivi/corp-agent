import { useEffect, useRef, useState } from "react";
import Logo, { LogoMark } from "./Logo";
import {
  ArrowUpIcon,
  ChatSparkIcon,
  CheckIcon,
  ChevronDownIcon,
  CloseIcon,
  GearIcon,
  ImageIcon,
  MenuIcon,
  MicIcon,
  MoonIcon,
  PaperclipIcon,
  PencilIcon,
  PlusIcon,
  SparkleIcon,
  SpeakerIcon,
  StopIcon,
  SunIcon,
} from "./Icons";
import BrandTile from "./BrandTile";
import AgentProposal from "./AgentProposal";
import Savings from "./Savings";
import { WhatsAppInbox } from "./views/WhatsAppInbox";
import { TRADES, tradeById } from "../data/trades";
import { KITS } from "../data/kits";
import { planById } from "../data/plans";
import {
  ApiError,
  buildAgent,
  createAgent,
  createProject as apiCreateProject,
  deleteProject as apiDeleteProject,
  generateImage,
  getModels,
  getProject,
  listOpenQuestions,
  listProjects,
  getSavings,
  listWhatsAppChats,
  rememberConversation,
  renameProject,
  speak,
  streamChat,
  type CatalogModelInfo,
  type ChatMessage,
  type HeavyWarning,
  type ProposedAgent,
  type Savings as SavingsData,
  type WhatsAppChat,
} from "../lib/api";
import { useNotify } from "../lib/notify";
import { useTheme } from "../lib/theme";
import type { KnowledgeDoc, Project, SurveyAnswers, TradeId } from "../types";

interface MasterChatProps {
  surveyAnswers?: SurveyAnswers;
  onOpenAdvanced: () => void;
}

/** Ogni riga della conversazione: testo, un'immagine, oppure una carta che si può usare. */
type Entry =
  | { kind: "master"; text: string; model?: string }
  | { kind: "user"; text: string }
  | { kind: "image"; url: string; prompt: string }
  | { kind: "trades" }
  | { kind: "kit"; tradeId: TradeId }
  | { kind: "whatsapp" }
  | { kind: "knowledge" }
  | { kind: "recap" }
  /** Un agente generato dal Master Builder, da confermare o rifiutare (riga 7). */
  | { kind: "proposal"; agent: ProposedAgent }
  /** L'avviso costi: la richiesta è impegnativa, si chiede il permesso prima di spendere. */
  | { kind: "warning"; warning: HeavyWarning };

let seq = 0;
const nid = () => `e-${++seq}`;

const SETUP_ID = "setup";

/**
 * Il nome che porta una chat appena creata, finche non ne prende uno dalla
 * prima frase che ci si scrive. E anche il segnale che dice "questa non l'ha
 * ancora battezzata nessuno": se il nome e diverso, l'ha scelto l'utente e
 * non si tocca.
 */
const NEW_CHAT_NAME = "Nuova chat";

/**
 * I fornitori che compaiono nel selettore, nell'ordine del documento di
 * Tommaso. Il catalogo vero arriva da OpenRouter: qui c'è solo come
 * raggrupparlo e con che nome. Un fornitore che non è in questa lista non
 * compare — 337 modelli in un menu non aiutano nessuno.
 */
const PROVIDERS: Array<{ prefix: string; label: string }> = [
  { prefix: "openai/", label: "OpenAI" },
  { prefix: "anthropic/", label: "Anthropic" },
  { prefix: "google/", label: "Google" },
  { prefix: "deepseek/", label: "DeepSeek" },
  { prefix: "meta-llama/", label: "Meta" },
  { prefix: "mistralai/", label: "Mistral AI" },
  { prefix: "qwen/", label: "Qwen (Alibaba)" },
  { prefix: "perplexity/", label: "Perplexity" },
  { prefix: "x-ai/", label: "xAI (Grok)" },
  { prefix: "microsoft/", label: "Microsoft" },
  { prefix: "cohere/", label: "Cohere" },
];

/**
 * I quattro punti di partenza dell'apertura.
 *
 * Davanti a una casella vuota nessuno sa cosa scrivere: sono le domande che
 * fa davvero chi apre CorpAgent per la prima volta, e servono a far capire
 * in un colpo d'occhio cosa sa fare l'agente.
 */
const STARTERS: Array<{ icon: React.ReactNode; title: string; hint: string; text: string }> = [
  {
    icon: <SparkleIcon size={15} />,
    title: "Ho un ristorante",
    hint: "prenotazioni e menù su WhatsApp",
    text: "Ho un ristorante e i clienti mi scrivono su WhatsApp tutto il giorno per prenotare e chiedere il menù. Cosa puoi fare per me?",
  },
  {
    icon: <ChatSparkIcon size={15} />,
    title: "Cosa sai fare?",
    hint: "in due righe, senza giri",
    text: "Spiegami in due righe cosa sai fare concretamente per la mia attività.",
  },
  {
    icon: <ImageIcon size={15} />,
    title: "Creami un'immagine",
    hint: "per un post o una locandina",
    text: "Vorrei un'immagine per un post social della mia attività. Come funziona?",
  },
  {
    icon: <PaperclipIcon size={15} />,
    title: "Ho un listino da caricare",
    hint: "così non sbagli i prezzi",
    text: "Ho un listino prezzi da caricare. Come faccio a fartelo leggere così non sbagli mai un prezzo?",
  },
];

/** Il riconoscimento vocale del browser, dove c'è (Chrome ed Edge sì, Firefox no). */
type Recognition = {
  lang: string;
  interimResults: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};
function speechRecognition(): Recognition | null {
  const w = window as unknown as { webkitSpeechRecognition?: new () => Recognition };
  return w.webkitSpeechRecognition ? new w.webkitSpeechRecognition() : null;
}

/**
 * Il prodotto: sidebar scura con progetti e squadra, chat al centro.
 * Il Master Builder guida l'utente dall'inizio alla fine dentro la
 * conversazione — consiglia gli agenti, propone i connettori, chiede i
 * documenti — senza mai mandarlo in un pannello di configurazione.
 */
export default function MasterChat({ surveyAnswers, onOpenAdvanced }: MasterChatProps) {
  const [projects, setProjects] = useState<Project[]>([
    { id: SETUP_ID, name: "I miei agenti", deletable: false },
  ]);
  const [activeProject, setActiveProject] = useState(SETUP_ID);

  /** Una conversazione per progetto: cambiare progetto cambia solo quello che si vede. */
  const [threads, setThreads] = useState<Record<string, Array<Entry & { id: string }>>>({
    [SETUP_ID]: [
      {
        id: nid(),
        kind: "master",
        text: "Ciao. Dimmi di cosa ti occupi e ti metto in piedi tutto io: gli agenti, i canali, il piano.",
      },
      { id: nid(), kind: "trades" },
    ],
  });

  const entries = threads[activeProject] ?? [];
  const setEntries = (
    updater: (prev: Array<Entry & { id: string }>) => Array<Entry & { id: string }>
  ) => setThreads((prev) => ({ ...prev, [activeProject]: updater(prev[activeProject] ?? []) }));

  /**
   * Vero quando i progetti arrivano davvero dal database (riga 9).
   *
   * Se resta falso — database giù, sessione scaduta — la chat continua a
   * funzionare con lo stato locale come faceva prima: si risponde, ma non si
   * archivia. È la stessa scelta di `api/chat.ts`: prima consegnare la
   * risposta, poi provare a salvarla. Un salvataggio che non riesce non deve
   * impedire di lavorare.
   */
  const [serverReady, setServerReady] = useState(false);

  /**
   * L identificativo del progetto di configurazione.
   *
   * Prima era la costante "setup" scritta a mano. Ora è un UUID vero che
   * arriva da Neon: SETUP_ID resta solo come valore di partenza, per il
   * mezzo secondo prima che la lettura dal database finisca.
   */
  const setupId = projects.find((p) => !p.deletable)?.id ?? SETUP_ID;

  const [tradeId, setTradeId] = useState<TradeId | null>(null);
  const [agents, setAgents] = useState<string[]>([]);
  const [whatsAppConnected, setWhatsAppConnected] = useState(false);
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  /** Vero mentre l'agente sta rispondendo: si evita di sovrapporre due richieste. */
  const [streaming, setStreaming] = useState(false);

  /** Il selettore dei modelli: "auto" = decide il server in base alla difficoltà. */
  const [models, setModels] = useState<CatalogModelInfo[]>([]);
  const [modelSlug, setModelSlug] = useState("auto");

  /** Voce: il microfono che ascolta, e l'audio che sta parlando. */
  const [listening, setListening] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const recognitionRef = useRef<Recognition | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [micAvailable] = useState(() => speechRecognition() !== null);

  /** Immagini: vero mentre OpenAI disegna (15-40 secondi). */
  const [imageBusy, setImageBusy] = useState(false);

  /** L identificativo della carta che sta salvando, per non premere due volte. */
  const [creatingAgent, setCreatingAgent] = useState<string | null>(null);

  /**
   * A quale numero di messaggi risale l'ultima distillazione, per conversazione.
   *
   * Serve a diradare: la memoria contestuale (riga 17) costa una chiamata a un
   * modello, e farla a ogni messaggio sarebbe uno spreco — la maggior parte
   * degli scambi non aggiunge nessun fatto che valga domani.
   */
  const distilledAt = useRef<Record<string, number>>({});

  /** Chiaro o scuro: parte scuro, la scelta resta sul dispositivo. */
  const { theme, toggle: toggleTheme } = useTheme();
  const notify = useNotify();

  /**
   * Quanti clienti stanno aspettando una risposta da te.
   *
   * ⚠️ Prima questo numero esisteva solo dentro Impostazioni Avanzate ->
   * Memoria -> Domande aperte: tre clic dentro un menu che nessuno apre. Un
   * cliente che ha fatto una domanda a cui l'agente non ha saputo rispondere
   * restava ad aspettare per sempre, e il titolare non lo sapeva.
   *
   * Ora si vede dove si lavora.
   */
  const [waiting, setWaiting] = useState(0);

  /**
   * L'elenco delle chat, sul telefono.
   *
   * Su schermo grande la sidebar e sempre li. Sotto md non c'era affatto:
   * chi apriva CorpAgent dal telefono non aveva alcun modo di creare o
   * cambiare chat, perche l'unico posto da cui si fa era `hidden md:flex`.
   * Qui diventa un pannello che si apre da sopra il contenuto.
   */
  const [chatsOpen, setChatsOpen] = useState(false);

  // ── La posta di WhatsApp ─────────────────────────────────────────────
  // Le conversazioni coi clienti veri, quelle che arrivano dal telefono.
  // `activeWa` non sostituisce `activeProject`: la chat del sito resta dov'e',
  // montata e con il suo stato — si passa da una all'altra senza perdere niente.
  const [waChats, setWaChats] = useState<WhatsAppChat[]>([]);
  /**
   * Riga 28: il Contatore Risparmio coi messaggi veri.
   *
   * ⚠️ Prima questo numero veniva contato **nel browser**, sulle risposte della
   * chat aperta: spariva ricaricando la pagina e ignorava del tutto i clienti
   * su WhatsApp — cioe' proprio il lavoro che il prodotto promette di togliere.
   * Adesso arriva dal database e comprende tutti e due i canali.
   */
  const [savings, setSavings] = useState<SavingsData | null>(null);
  const [activeWa, setActiveWa] = useState<string | null>(null);

  /** Ricarica l'elenco. Silenzioso di proposito: gira anche da solo. */
  function refreshWa() {
    getSavings()
      .then(setSavings)
      .catch(() => {
        // Il contatore e' una cosa in piu': se non arriva, non si dice niente.
      });
    listWhatsAppChats()
      .then(setWaChats)
      .catch(() => {
        // Un errore qui non deve disturbare: la posta e' una cosa in piu',
        // non il motivo per cui uno ha aperto il sito.
      });
  }

  // ⚠️ Si ricontrolla ogni venti secondi. Non e' elegante quanto una connessione
  // sempre aperta, ma una connessione sempre aperta su Vercel Hobby vuol dire
  // una funzione che non si spegne mai — e il conto lo paga Tommaso. Venti
  // secondi e' il compromesso: chi guarda la posta vede arrivare i messaggi,
  // chi non la guarda non costa niente.
  useEffect(() => {
    refreshWa();
    const t = setInterval(refreshWa, 20_000);
    return () => clearInterval(t);
  }, []);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  /**
   * Le domande in attesa. Si ricontrollano ogni due minuti: le nuove arrivano
   * mentre il titolare fa altro, e un numero che si aggiorna solo alla ricarica
   * non e un avviso.
   */
  useEffect(() => {
    let alive = true;
    const check = () =>
      listOpenQuestions()
        .then((rows) => {
          if (alive) setWaiting(rows.filter((q) => q.status === "open").length);
        })
        .catch(() => {});
    void check();
    const timer = window.setInterval(check, 120_000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  /** Il catalogo si carica una volta: alimenta il selettore in fondo. */
  useEffect(() => {
    getModels()
      .then((r) => setModels(r.models))
      .catch(() => {
        // Senza catalogo il selettore mostra solo "Automatico": la chat
        // funziona lo stesso, sceglie il server.
      });
  }, []);

  /**
   * L'apertura vera (riga 9): i progetti si leggono da Neon.
   *
   * Il progetto di configurazione è quello con `isSetup`: ce n'è uno solo per
   * utente ed è dove vive la conversazione col Master Builder. Al primo
   * ingresso non esiste ancora, quindi lo creiamo qui — è l'unico posto in cui
   * viene creato, e per questo non possono nascerne due.
   */
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const list = await listProjects();
        let setup = list.find((p) => p.isSetup);
        if (!setup) {
          setup = await apiCreateProject({ name: "I miei agenti", isSetup: true });
        }
        if (!alive) return;

        // Il progetto di configurazione per primo, come li ordina il server.
        const ordered = [setup, ...list.filter((p) => p.id !== setup.id)];
        setProjects(ordered.map((p) => ({ id: p.id, name: p.name, deletable: p.deletable })));
        setActiveProject(setup.id);
        setServerReady(true);
        await openThread(setup.id, true);
      } catch {
        // Si resta sullo stato locale: `serverReady` non diventa vero e la
        // chat lavora come prima, senza archiviare.
      }
    })();

    return () => {
      alive = false;
    };
    // Una volta sola, all'ingresso: le dipendenze qui sarebbero funzioni
    // ricreate a ogni render e rifarebbero il giro in continuazione.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Quanti caratteri ci sono in tutta la conversazione.
   *
   * ⚠️ Serve solo come dipendenza dello scorrimento, ed è la riga che ha
   * risolto il difetto più fastidioso del prodotto. Prima lo scorrimento
   * dipendeva da `entries.length`, che **non cambia mentre una risposta
   * cresce**: la riga è già lì, si allunga soltanto. Risultato: il testo
   * scorreva sotto il bordo dello schermo e sembrava che l'agente non
   * finisse le frasi. Erano finite: stavano fuori vista.
   */
  const streamedChars = entries.reduce(
    (n, e) => n + (e.kind === "master" || e.kind === "user" ? e.text.length : 0),
    0
  );

  /** Scorrimento automatico: la conversazione si segue da sola. */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    // Se l'utente è scorso su per rileggere qualcosa, non lo si strappa in
    // fondo a ogni parola che arriva: si segue solo chi era già in fondo.
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom > 220) return;

    // Mentre il testo arriva lo scorrimento è istantaneo: "smooth" a ogni
    // pezzo si accavalla con sé stesso e produce un tremolio.
    el.scrollTo({ top: el.scrollHeight, behavior: streaming ? "auto" : "smooth" });
  }, [entries.length, streamedChars, typing, imageBusy, streaming]);

  /**
   * Apre una conversazione leggendo i messaggi salvati (riga 9).
   *
   * Si legge una volta sola per progetto: `threads` fa da memoria, e passare
   * da un progetto all'altro non rifà il giro di rete. `force` serve
   * all'apertura, quando la memoria contiene ancora il segnaposto locale.
   *
   * Il saluto e le carte dei mestieri non sono messaggi: sono impalcatura
   * dell'interfaccia. Per questo si rimettono a mano quando la conversazione
   * risulta vuota, invece di salvarli nel database — dove sporcherebbero la
   * cronologia e verrebbero rimandati al modello a ogni domanda.
   */
  async function openThread(projectId: string, force = false) {
    if (!force && threads[projectId]) return;

    try {
      const project = await getProject(projectId);
      const restored: Array<Entry & { id: string }> = project.messages
        .filter((m) => m.role === "user" || m.role === "agent")
        .map((m) =>
          m.role === "user"
            ? { id: `m-${m.id}`, kind: "user" as const, text: m.content }
            : {
                id: `m-${m.id}`,
                kind: "master" as const,
                text: m.content,
                model: m.modelSlug ?? undefined,
              }
        );

      if (restored.length === 0) {
        setThreads((prev) => ({
          ...prev,
          [projectId]: project.isSetup
            ? [
                {
                  id: nid(),
                  kind: "master",
                  text: "Ciao. Dimmi di cosa ti occupi e ti metto in piedi tutto io: gli agenti, i canali, il piano.",
                },
                { id: nid(), kind: "trades" },
              ]
            : [
                {
                  id: nid(),
                  kind: "master",
                  text: `"${project.name}". Raccontami cosa vuoi fare e lo pianifichiamo insieme.`,
                },
              ],
        }));
        return;
      }

      setThreads((prev) => ({ ...prev, [projectId]: restored }));
    } catch {
      // Non si riesce a rileggere: si lascia quello che c'è già in memoria.
    }
  }

  function add(...items: Entry[]) {
    setEntries((prev) => [...prev, ...items.map((i) => ({ ...i, id: nid() }))]);
  }

  /** Come `add`, ma restituisce l'identificativo: serve per far crescere una riga. */
  function push(item: Entry): string {
    const id = nid();
    setEntries((prev) => [...prev, { ...item, id }]);
    return id;
  }

  /** Aggiunge un pezzo di risposta a una riga già visibile, mentre arriva. */
  function grow(id: string, chunk: string) {
    setEntries((prev) =>
      prev.map((e) => (e.id === id && e.kind === "master" ? { ...e, text: e.text + chunk } : e))
    );
  }

  /**
   * Un progetto nuovo. Nasce nel database, non nello stato del browser: così
   * l'identificativo è quello vero e i messaggi finiscono nel posto giusto.
   */
  /**
   * Una chat nuova con un tocco.
   *
   * Il nome non si chiede: nasce "Nuova chat" e si ribattezza da se dopo il
   * primo messaggio (vedi `send`). Fermare qualcuno davanti a un campo di
   * testo per farsi dire come si chiamera una conversazione che non e ancora
   * cominciata e il modo migliore per fargli smettere di crearne.
   */
  async function createProject(name: string) {
    if (serverReady) {
      try {
        const created = await apiCreateProject({ name });
        setProjects((prev) => [...prev, { id: created.id, name: created.name, deletable: true }]);
        setThreads((prev) => ({
          ...prev,
          [created.id]: [
            {
              id: nid(),
              kind: "master",
              text: `"${created.name}". Raccontami cosa vuoi fare e lo pianifichiamo insieme.`,
            },
          ],
        }));
        setActiveProject(created.id);
        return;
      } catch (error) {
        notifyError(notify, error);
        return;
      }
    }

    // Senza database si lavora in locale, come prima.
    const id = nid();
    setProjects((prev) => [...prev, { id, name, deletable: true }]);
    setThreads((prev) => ({
      ...prev,
      [id]: [
        {
          id: nid(),
          kind: "master",
          text: `"${name}". Raccontami cosa vuoi fare e lo pianifichiamo insieme.`,
        },
      ],
    }));
    setActiveProject(id);
  }

  async function deleteProject(id: string) {
    // Si toglie prima dallo schermo: l'utente ha premuto "chiudi" e deve
    // vedere il progetto sparire subito, non dopo il giro di rete.
    const previous = projects;
    setProjects((prev) => prev.filter((p) => p.id !== id));
    setThreads((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    if (activeProject === id) setActiveProject(setupId);

    if (!serverReady) return;
    try {
      await apiDeleteProject(id);
    } catch (error) {
      // Non si è cancellato davvero: rimetterlo è meno peggio che far credere
      // di averlo chiuso e ritrovarlo alla prossima ricarica.
      setProjects(previous);
      notifyError(notify, error);
    }
  }

  /** Apre un progetto e ne carica la conversazione se non è già in memoria. */
  function switchProject(id: string) {
    setActiveProject(id);
    setChatsOpen(false);
    void openThread(id);
  }

  /** Il master "pensa" un attimo prima di rispondere: rende la guida credibile. */
  function master(text: string, then?: Entry[], delay = 700) {
    setTyping(true);
    window.setTimeout(() => {
      setTyping(false);
      add({ kind: "master", text }, ...(then ?? []));
    }, delay);
  }

  function pickTrade(id: TradeId) {
    const trade = tradeById(id);
    setTradeId(id);
    setEntries((prev) => prev.filter((e) => e.kind !== "trades"));
    add({ kind: "user", text: trade.label });
    master(`${KITS[id].headline}. Guarda se ti torna, poi attivo tutto io.`, [
      { kind: "kit", tradeId: id },
    ]);
  }

  function activateKit() {
    if (!tradeId) return;
    const kit = KITS[tradeId];
    setAgents(kit.agents.map((a) => a.name));
    setEntries((prev) => prev.filter((e) => e.kind !== "kit"));
    add({ kind: "user", text: "Attiva tutto" });
    master(
      `Fatto: ${kit.agents.length} agenti al lavoro. Ora colleghiamo WhatsApp, così i tuoi clienti trovano risposta anche a mezzanotte.`,
      [{ kind: "whatsapp" }],
      900
    );
  }

  function connectWhatsApp() {
    setWhatsAppConnected(true);
    setEntries((prev) => prev.filter((e) => e.kind !== "whatsapp"));
    add({ kind: "user", text: "WhatsApp collegato" });
    const kit = tradeId ? KITS[tradeId] : null;
    master(
      `Perfetto. Ultima cosa e sei operativo: caricami ${kit?.knowledge ?? "i tuoi documenti"}. Senza questo posso sbagliare un prezzo, con questo mai.`,
      [{ kind: "knowledge" }]
    );
  }

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!picked.length) return;
    setDocs((prev) => [
      ...prev,
      ...picked.map((f) => ({ id: nid(), name: f.name, size: f.size })),
    ]);
    setEntries((prev) => prev.filter((en) => en.kind !== "knowledge"));
    add({ kind: "user", text: picked.map((f) => f.name).join(", ") });
    master("Ricevuto. Da adesso rispondo solo con quello che c'è lì dentro.", [
      { kind: "recap" },
    ]);
  }

  /**
   * Le istruzioni che l'agente riceve prima di ogni risposta.
   *
   * L'ultima riga è la più importante di tutto il file: **vietato inventare
   * prezzi.** La promessa venduta al ristoratore è "non sbaglia mai i prezzi", e
   * finché la lettura dei documenti non c'è, il modo di mantenerla è dire di non
   * saperlo invece di indovinare. Un agente che inventa un prezzo fa perdere un
   * cliente vero.
   */
  function systemPrompt(): string {
    const trade = tradeId ? tradeById(tradeId) : null;
    const parts = [
      "Sei il Master Builder di CorpAgent: aiuti chi lavora a mettere in piedi i suoi agenti IA.",
      "Rispondi in italiano, con frasi brevi e concrete. Niente gergo tecnico, niente elenchi lunghi.",
    ];

    if (trade) parts.push(`L'utente gestisce: ${trade.label} (${trade.examples}).`);
    if (surveyAnswers?.workplace) parts.push(`Si è descritto come: ${surveyAnswers.workplace}.`);
    if (agents.length > 0) parts.push(`Agenti già attivi: ${agents.join(", ")}.`);
    parts.push(
      whatsAppConnected ? "WhatsApp risulta collegato." : "WhatsApp non è ancora collegato."
    );

    if (docs.length > 0) {
      parts.push(
        `L'utente ha caricato questi documenti: ${docs.map((d) => d.name).join(", ")}. ` +
          "Non ne conosci ancora il contenuto: la lettura dei documenti è il passo successivo."
      );
    }

    parts.push(
      "Non conosci prezzi, orari, disponibilità o politiche di questa attività. " +
        "Non inventarli mai: se te li chiedono, dì chiaramente che ti serve il documento e chiedi di caricarlo."
    );

    return parts.join("\n");
  }

  /** La conversazione come la vede il modello. Solo testo: le carte non sono messaggi. */
  function history(list: Array<Entry & { id: string }>): ChatMessage[] {
    const out: ChatMessage[] = [];
    for (const entry of list) {
      if (entry.kind === "user") out.push({ role: "user", content: entry.text });
      else if (entry.kind === "master") out.push({ role: "agent", content: entry.text });
    }
    // Solo le ultime battute: ogni messaggio rispedito indietro si paga di nuovo.
    return out.slice(-20);
  }

  async function ask(messages: ChatMessage[], confirmHeavy = false) {
    setEntries((prev) => prev.filter((e) => e.kind !== "warning"));
    setTyping(true);
    setStreaming(true);

    // Resta `null` finché non arriva il primo pezzo: così i puntini di attesa
    // restano visibili fino all'ultimo istante, invece di lasciare una bolla vuota.
    let replyId: string | null = null;
    let modelUsed: string | undefined;

    try {
      for await (const event of streamChat({
        messages,
        systemPrompt: systemPrompt(),
        modelSlug,
        confirmHeavy,
        // ⚠️ LA RIGA 9. Senza questo il server risponde e non archivia: era
        // il motivo per cui una ricarica azzerava tutte le conversazioni.
        // Si manda solo se i progetti vengono davvero dal database, altrimenti
        // sarebbe un identificativo inventato e il salvataggio fallirebbe.
        projectId: serverReady ? activeProject : undefined,
      })) {
        if (event.kind === "warning") {
          setTyping(false);
          add({ kind: "warning", warning: event.warning });
          return;
        }
        if (event.kind === "model") {
          modelUsed = event.model;
        }
        if (event.kind === "delta") {
          if (!replyId) {
            setTyping(false);
            replyId = push({ kind: "master", text: "", model: modelUsed });
          }
          grow(replyId, event.text);
        }
      }

      if (!replyId) {
        add({ kind: "master", text: "Non è arrivato niente. Riprova tra un istante." });
      }
    } catch (error) {
      setTyping(false);
      notifyError(notify, error);
    } finally {
      setTyping(false);
      setStreaming(false);
    }
  }

  /**
   * Il Master Builder vero (riga 7): legge la conversazione e genera l'agente.
   *
   * Si usa **solo dentro il progetto di configurazione**, che è il posto dove
   * si costruisce la squadra. Negli altri progetti la chat resta una chat
   * normale: proporre un agente mentre uno pianifica il menù di primavera
   * sarebbe fuori posto. È la stessa distinzione che fa il database con
   * `is_setup`.
   */
  async function askMaster(messages: ChatMessage[]) {
    setTyping(true);
    setStreaming(true);
    try {
      const result = await buildAgent({ messages, agentCount: agents.length });
      setTyping(false);

      if (result.kind === "question") {
        // Messaggio e domanda arrivano separati: se il modello ripete la
        // domanda dentro il messaggio si leggerebbe due volte.
        const same = result.question.trim() === result.message.trim();
        add({
          kind: "master",
          text: same ? result.message : `${result.message}\n\n${result.question}`,
        });
        return;
      }

      add({ kind: "master", text: result.message });
      // Una carta per agente: si confermano uno alla volta, così chi ne vuole
      // due su tre non è costretto a prendere tutto o niente.
      for (const proposed of result.agents) add({ kind: "proposal", agent: proposed });
    } catch (error) {
      setTyping(false);
      notifyError(notify, error);
    } finally {
      setTyping(false);
      setStreaming(false);
    }
  }

  /**
   * L'agente proposto diventa un agente vero, salvato su Neon.
   *
   * Poi parte la sequenza decisa da Tommaso: prima lo provi in chat, poi i
   * documenti, poi WhatsApp. In quest'ordine perché toccare con mano che
   * funziona è quello che convince — i collegamenti vengono dopo.
   */
  async function confirmAgent(entryId: string, proposed: ProposedAgent) {
    setCreatingAgent(entryId);
    try {
      const created = await createAgent({
        name: proposed.name,
        role: proposed.role,
        systemPrompt: agentSystemPrompt(proposed, entries),
        modelSlug: "auto",
        isCustom: true,
      });

      setAgents((prev) => [...prev, created.name]);
      setEntries((prev) => prev.filter((e) => e.id !== entryId));

      const total = agents.length + 1;
      master(
        `${created.name} è attivo. Lo provi subito: scriva qui sotto come se fosse un suo cliente, ` +
          "e vedrà come risponde." +
          (total >= 3
            ? "\n\nUna nota: con questo arriva a tre agenti, il limite del piano gratuito. " +
              "Gli abbonamenti arrivano tra poco e la avviserò."
            : ""),
        [{ kind: "knowledge" }],
        800
      );
    } catch (error) {
      notifyError(notify, error);
    } finally {
      setCreatingAgent(null);
    }
  }

  /**
   * Da' un nome alla chat prendendolo dalla prima cosa che ci hai scritto.
   * Si fa una volta sola, e solo se il nome e ancora quello predefinito: se
   * l'utente l'ha rinominata a mano, la sua scelta vince.
   */
  function baptize(text: string) {
    if (!serverReady || isSetup) return;
    const current = projects.find((p) => p.id === activeProject);
    if (!current || current.name !== NEW_CHAT_NAME) return;

    const title = text.replace(/\s+/g, " ").trim().slice(0, 48);
    const name = text.length > 48 ? `${title}...` : title;
    setProjects((prev) => prev.map((p) => (p.id === activeProject ? { ...p, name } : p)));
    void renameProject(activeProject, name).catch(() => {
      // Il nome resta quello di prima: e cosmetica, non vale un errore in faccia.
    });
  }

  /**
   * La memoria contestuale (riga 17): ogni sei scambi la conversazione viene
   * distillata nei fatti che valgono domani.
   *
   * Gira in sottofondo e non blocca niente: se fallisce, l'unica conseguenza e
   * che l'agente non si ricordera di un accordo — spiacevole, non grave. Per
   * questo non produce nemmeno un avviso: interrompere chi sta lavorando per
   * dirgli che una cosa che non aveva chiesto non e riuscita e peggio del
   * problema.
   */
  function rememberIfDue() {
    if (!serverReady) return;
    const exchanges = entries.filter((e) => e.kind === "user").length;
    const last = distilledAt.current[activeProject] ?? 0;
    if (exchanges - last < 6) return;

    distilledAt.current[activeProject] = exchanges;
    const name = isSetup
      ? "Cosa mi hai detto finora"
      : `Accordi — ${projects.find((p) => p.id === activeProject)?.name ?? "conversazione"}`;
    void rememberConversation(activeProject, name).catch(() => {});
  }

  function send(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || streaming) return;
    setDraft("");
    baptize(text);
    rememberIfDue();
    add({ kind: "user", text });
    const conversation = [...history(entries), { role: "user" as const, content: text }];

    // Nel progetto di configurazione parla il Master Builder, che costruisce.
    // Negli altri è una chat normale: la squadra si monta in un posto solo.
    if (isSetup) void askMaster(conversation);
    else void ask(conversation);
  }

  /** Il microfono: detta il messaggio invece di scriverlo. */
  function toggleMic() {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const recognition = speechRecognition();
    if (!recognition) return;
    recognition.lang = "it-IT";
    recognition.interimResults = false;
    recognition.onresult = (e) => {
      const heard = Array.from({ length: e.results.length }, (_, i) => e.results[i][0].transcript)
        .join(" ")
        .trim();
      if (heard) setDraft((prev) => (prev ? `${prev} ${heard}` : heard));
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }

  /** L'altoparlante su una risposta: la voce di ElevenLabs la legge. */
  async function toggleSpeak(id: string, text: string) {
    // Se sta già parlando, si ferma — anche se era un'altra risposta.
    audioRef.current?.pause();
    if (speakingId === id) {
      setSpeakingId(null);
      return;
    }
    setSpeakingId(id);
    try {
      const audio = await speak(text);
      audioRef.current = audio;
      audio.addEventListener("ended", () => setSpeakingId(null), { once: true });
    } catch (error) {
      setSpeakingId(null);
      notifyError(notify, error);
    }
  }

  /** Il pennello: quello che c'è nella casella diventa un'immagine. */
  async function makeImage() {
    const prompt = draft.trim();
    if (!prompt || imageBusy || streaming) return;
    setDraft("");
    add({ kind: "user", text: prompt });
    setImageBusy(true);
    try {
      const { dataUrl } = await generateImage(prompt);
      add({ kind: "image", url: dataUrl, prompt });
    } catch (error) {
      notifyError(notify, error);
    } finally {
      setImageBusy(false);
    }
  }

  const kit = tradeId ? KITS[tradeId] : null;
  const plan = kit ? planById(kit.planId) : null;
  const teamNote = surveyAnswers?.teamSize?.toLowerCase().includes("team")
    ? " Lavorando in team ti serve anche per condividere gli agenti con i tuoi."
    : "";

  const activeName = projects.find((p) => p.id === activeProject)?.name ?? "";

  /**
   * Le ore risparmiate, in barra di stato.
   *
   * Il calcolo è quello dichiarato in tutta la documentazione — circa 3 minuti
   * per ogni messaggio gestito senza di te — e si conta solo quello che
   * l'agente ha davvero risposto in questa conversazione. Quando arriverà il
   * conteggio vero dal database (`public.usage`) questa riga leggerà da lì.
   */
  // Quanti messaggi ha gestito l'agente in questa conversazione. Il calcolo
  // delle ore e del valore sta dentro <Savings>, in un posto solo.
  // ⚠️ Il numero del server vince su quello contato qui: quello locale resta
  // solo come ripiego finche' la prima chiamata non torna, se no all'apertura
  // della pagina il contatore lampeggerebbe a zero.
  const handledAlone =
    savings?.handled ?? entries.filter((e) => e.kind === "master" && e.text.length > 0).length;

  /** Conversazione appena aperta: nessuno ha ancora scritto niente. */
  const isSetup = activeProject === SETUP_ID;
  const isFresh = !entries.some((e) => e.kind === "user");

  return (
    <div className="flex h-full w-full bg-[var(--bg-app)]">
      {/* ───────────────────────── SIDEBAR ─────────────────────────
          Riorganizzata il 2 Agosto 2026. Tre zone separate da spazio, non da
          righe: in alto chi sei e cosa crei, al centro dove lavori, in basso
          lo stato del canale e le impostazioni. Prima era un elenco unico e
          non si capiva cosa fosse cosa. */}
      {/* Il velo scuro dietro il pannello, solo sul telefono: chiude toccando fuori. */}
      {chatsOpen && (
        <button
          aria-label="Chiudi l'elenco delle chat"
          onClick={() => setChatsOpen(false)}
          className="animate-rise fixed inset-0 z-30 bg-black/50 md:hidden"
        />
      )}

      <aside
        className={`on-dark side-scroll flex-col overflow-y-auto bg-[var(--side-bg)] text-[var(--side-text)] md:relative md:flex md:w-[268px] md:shrink-0 md:translate-x-0 ${
          chatsOpen
            ? "fixed inset-y-0 left-0 z-40 flex w-[280px] shadow-[var(--shadow-3)]"
            : "hidden"
        }`}
      >
        <div aria-hidden className="orb orb-violet absolute left-[-40%] top-[-60px] h-[240px] w-[240px] opacity-30" />

        <div className="relative flex items-center px-5 pb-2 pt-5 text-white [&_*]:text-white">
          <Logo size={22} />
        </div>

        <div className="relative px-3 pt-4">
          <NewProjectButton onCreate={(name) => void createProject(name)} />
        </div>

        <nav className="relative flex-1 px-3 pb-4">
          <div className="t-label px-2 pb-1.5 pt-6 text-[var(--side-text-dim)]">
            Conversazioni
          </div>
          {projects.map((p) => {
            const active = p.id === activeProject;
            return (
              <div
                key={p.id}
                className={`group flex items-center rounded-xl transition-colors duration-[var(--fast)] ${
                  active ? "bg-[var(--side-active)]" : "hover:bg-[var(--side-bg-raised)]"
                }`}
              >
                <button
                  onClick={() => switchProject(p.id)}
                  className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2.5 text-left"
                >
                  <span
                    className="h-[6px] w-[6px] shrink-0 rounded-full"
                    style={{
                      background: active ? "var(--side-accent)" : "var(--side-text-dim)",
                    }}
                  />
                  <span
                    className={`t-small truncate ${active ? "text-white" : "text-[var(--side-text)]"}`}
                  >
                    {p.name}
                  </span>
                </button>
                {p.deletable && (
                  <button
                    onClick={() => void deleteProject(p.id)}
                    aria-label={`Chiudi ${p.name}`}
                    className="mr-1.5 hidden rounded-md p-1 text-[var(--side-text-dim)] hover:text-white group-hover:block"
                  >
                    <CloseIcon size={13} />
                  </button>
                )}
              </div>
            );
          })}

          {/* ── La posta di WhatsApp ────────────────────────────────
              I clienti veri, quelli che scrivono al numero. Stanno accanto
              alle chat del sito e non in una quarta voce di menu, perche'
              sono conversazioni anche loro: cambia solo da dove arrivano. */}
          {waChats.length > 0 && (
            <>
              <div className="t-label flex items-center justify-between px-2 pb-1.5 pt-7 text-[var(--side-text-dim)]">
                <span>WhatsApp</span>
                {waChats.some((c) => c.unread) && (
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold tracking-normal"
                    style={{ background: "var(--side-positive)", color: "#04120b" }}
                  >
                    {waChats.filter((c) => c.unread).length}
                  </span>
                )}
              </div>
              {waChats.map((c, i) => {
                const active = c.id === activeWa;
                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      setActiveWa(c.id);
                      setChatsOpen(false);
                    }}
                    className={`animate-rise flex w-full min-w-0 items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-colors duration-[var(--fast)] ${
                      active ? "bg-[var(--side-active)]" : "hover:bg-[var(--side-bg-raised)]"
                    }`}
                    style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white/8 text-[10px] font-semibold text-white">
                      {c.customerName.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={`t-small block truncate ${active ? "text-white" : "text-[var(--side-text)]"}`}
                      >
                        {c.customerName}
                      </span>
                      {c.lastBody && (
                        <span className="block truncate text-[11.5px] text-[var(--side-text-dim)]">
                          {c.lastDirection === "out" ? "Tu: " : ""}
                          {c.lastBody}
                        </span>
                      )}
                    </span>
                    {/* Due segnali diversi, e non vanno confusi: il pallino
                        verde vuol dire "non l'hai ancora letto"; il pallino
                        vuoto vuol dire "qui rispondi tu, l'agente e' fermo". */}
                    {c.unread ? (
                      <span
                        className="h-[7px] w-[7px] shrink-0 rounded-full"
                        style={{ background: "var(--side-positive)" }}
                        title="Non ancora letto"
                      />
                    ) : c.mode === "human" ? (
                      <span
                        className="h-[7px] w-[7px] shrink-0 rounded-full border border-[var(--side-text-dim)]"
                        title="Qui rispondi tu"
                      />
                    ) : null}
                  </button>
                );
              })}
            </>
          )}

          {agents.length > 0 && (
            <>
              <div className="t-label flex items-center justify-between px-2 pb-1.5 pt-7 text-[var(--side-text-dim)]">
                <span>La tua squadra</span>
                <span className="rounded-full bg-white/8 px-1.5 py-0.5 text-[10px] tracking-normal">
                  {agents.length}
                </span>
              </div>
              {agents.map((name, i) => (
                <div
                  key={name}
                  className="animate-rise flex items-center gap-2.5 rounded-xl px-3 py-2 transition-colors hover:bg-[var(--side-bg-raised)]"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white/8 text-[10px] font-semibold text-white">
                    {name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="t-small truncate text-[var(--side-text)]">{name}</span>
                  <span className="ml-auto h-[6px] w-[6px] shrink-0 rounded-full bg-[var(--positive)]" />
                </div>
              ))}
            </>
          )}
        </nav>

        {/* Lo stato del canale: la cosa che il titolare vuole vedere a colpo
            d'occhio senza aprire niente. */}
        <div className="relative border-t border-[var(--side-border)] px-3 py-3">
          <div className="mb-1.5 flex items-center gap-2.5 rounded-xl bg-[var(--side-bg-raised)] px-3 py-2.5">
            <span
              className="h-[7px] w-[7px] shrink-0 rounded-full"
              style={{
                background: whatsAppConnected ? "var(--side-positive)" : "var(--side-text-dim)",
                boxShadow: whatsAppConnected ? "0 0 8px var(--side-positive)" : "none",
              }}
            />
            <span className="t-small min-w-0 flex-1 truncate text-[var(--side-text)]">WhatsApp</span>
            <span
              className="text-[11.5px] font-medium"
              style={{ color: whatsAppConnected ? "var(--side-positive)" : "var(--side-text-dim)" }}
            >
              {whatsAppConnected ? "attivo" : "da collegare"}
            </span>
          </div>
          <button
            onClick={onOpenAdvanced}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[var(--side-text)] transition-colors duration-[var(--fast)] hover:bg-[var(--side-bg-raised)] hover:text-white"
          >
            <GearIcon size={17} />
            <span className="t-small flex-1">Impostazioni Avanzate</span>
            {waiting > 0 && (
              <span
                className="animate-waiting h-[7px] w-[7px] rounded-full"
                style={{ background: "var(--side-positive)" }}
                title={`${waiting} in attesa di una risposta`}
              />
            )}
          </button>
        </div>
      </aside>

      {/* ───────────────────────── LA POSTA ─────────────────────────
          ⚠️ La chat del sito NON viene smontata: si nasconde. Smontarla
          vorrebbe dire perdere quello che uno stava scrivendo ogni volta che
          da' un'occhiata a un cliente — e uno l'occhiata la da' spesso. */}
      {activeWa && (
        <WhatsAppInbox
          chatId={activeWa}
          onClose={() => setActiveWa(null)}
          onChanged={refreshWa}
        />
      )}

      {/* ───────────────────────── CHAT ───────────────────────── */}
      <div className={`min-w-0 flex-1 flex-col ${activeWa ? "hidden" : "flex"}`}>
        {/* La testata mobile: sotto md la sidebar non c'è, il minimo resta qui. */}
        <header className="flex shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--bg-card)] px-5 py-3 md:hidden">
          <div className="flex min-w-0 items-center gap-2">
            <button
              onClick={() => setChatsOpen(true)}
              aria-label="Le tue chat"
              className="-ml-1 rounded-lg p-2 text-[var(--text-secondary)] hover:bg-[var(--fill-quiet)] hover:text-[var(--text-primary)]"
            >
              <MenuIcon size={19} />
            </button>
            <span className="truncate text-[14.5px] font-semibold text-[var(--text-primary)]">
              {activeName}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <ThemeButton theme={theme} onToggle={toggleTheme} />
            <button
              onClick={onOpenAdvanced}
              aria-label="Impostazioni avanzate"
              className="rounded-lg p-2 text-[var(--text-secondary)] hover:bg-[var(--fill-quiet)]"
            >
              <GearIcon size={18} />
            </button>
          </div>
        </header>

        {/* La barra di stato: nome del progetto a sinistra, e a destra i numeri
            che dicono che è uno strumento vero — quanto ha fatto risparmiare,
            quale cervello sta usando. Prima qui non c'era niente. */}
        <header className="hidden shrink-0 items-center justify-between gap-4 border-b border-[var(--border)] bg-[var(--bg-card)] px-7 py-3 md:flex">
          <div className="flex min-w-0 items-center gap-3">
            <span className="truncate text-[15px] font-semibold tracking-[-0.012em] text-[var(--text-primary)]">
              {activeName}
            </span>
            {agents.length > 0 && (
              <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--positive-soft)] px-2.5 py-1 text-[11.5px] font-medium text-[var(--positive)]">
                <span className="h-[5px] w-[5px] rounded-full bg-[var(--positive)]" />
                {agents.length} al lavoro
              </span>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <Savings handled={handledAlone} onClick={onOpenAdvanced} />
            <span className="mx-1 h-4 w-px bg-[var(--border)]" />
            <span className="hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] text-[var(--text-secondary)] lg:flex">
              <SparkleIcon size={13} />
              <span className="max-w-[150px] truncate">
                {modelSlug === "auto" ? "Automatico" : modelName(models, modelSlug)}
              </span>
            </span>
            <ThemeButton theme={theme} onToggle={toggleTheme} />
          </div>
        </header>

        {/* ── Chi sta aspettando una tua risposta ──────────────────────
            Sta sopra la conversazione, dentro il flusso di lavoro. Prima
            questo numero viveva solo dentro Impostazioni Avanzate: un cliente
            senza risposta restava ad aspettare e nessuno lo sapeva. */}
        {waiting > 0 && (
          <button
            onClick={onOpenAdvanced}
            className="animate-card flex shrink-0 items-center gap-2.5 border-b border-[var(--border)] bg-[var(--bg-card)] px-5 py-2.5 text-left transition-colors hover:bg-[var(--fill-quiet)] md:px-8"
          >
            <span
              className="animate-waiting h-[7px] w-[7px] shrink-0 rounded-full"
              style={{ background: "var(--accent)" }}
            />
            <span className="min-w-0 flex-1 text-[13.5px] text-[var(--text-primary)]">
              <strong className="font-semibold">
                {waiting === 1 ? "Un cliente aspetta" : `${waiting} clienti aspettano`}
              </strong>{" "}
              <span className="text-[var(--text-secondary)]">
                una tua risposta: l'agente non ha voluto inventare.
              </span>
            </span>
            <span className="shrink-0 text-[12.5px] font-medium text-[var(--text-primary)] underline-offset-2 hover:underline">
              Rispondi
            </span>
          </button>
        )}

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 md:px-8">
          <div className="mx-auto flex max-w-[760px] flex-col gap-5 py-8">
            {/* L'apertura. Prima qui c'era una riga di testo su fondo bianco e
                sembrava una pagina non finita. Adesso c'è il marchio, la frase
                che spiega cosa succede, e quattro cose da cui partire: davanti
                a una casella vuota nessuno sa cosa scrivere. */}
            {isFresh && (
              <div className="animate-rise flex flex-col items-center pb-2 pt-10 text-center">
                <span className="ring-grad flex h-14 w-14 items-center justify-center rounded-2xl text-[var(--text-primary)] shadow-[var(--shadow-2)]">
                  <LogoMark size={26} />
                </span>
                <h2 className="mt-5 text-[26px] font-semibold tracking-[-0.024em] text-[var(--text-primary)]">
                  {isSetup ? "Costruiamo il tuo agente" : activeName}
                </h2>
                <p className="mt-2 max-w-[420px] text-[14.5px] leading-relaxed text-[var(--text-secondary)]">
                  {isSetup
                    ? "Dimmi di cosa ti occupi e monto io tutto: gli agenti, il canale, il piano. Ci vogliono trenta secondi."
                    : "Raccontami cosa vuoi fare e lo pianifichiamo insieme."}
                </p>

                <div className="mt-7 grid w-full max-w-[540px] grid-cols-1 gap-2 sm:grid-cols-2">
                  {STARTERS.map((s, i) => (
                    <button
                      key={s.text}
                      onClick={() => {
                        add({ kind: "user", text: s.text });
                        void ask([...history(entries), { role: "user", content: s.text }]);
                      }}
                      className="animate-card group flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3.5 py-3 text-left transition-all duration-[var(--fast)] hover:-translate-y-px hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-2)]"
                      style={{ animationDelay: `${120 + i * 60}ms` }}
                    >
                      <span className="mt-0.5 shrink-0 text-[var(--text-tertiary)] transition-colors group-hover:text-[var(--text-primary)]">
                        {s.icon}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[13.5px] font-medium text-[var(--text-primary)]">
                          {s.title}
                        </span>
                        <span className="block text-[12.5px] leading-snug text-[var(--text-secondary)]">
                          {s.hint}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {entries.map((entry) => {
              if (entry.kind === "master" || entry.kind === "user") {
                const mine = entry.kind === "user";
                if (mine) {
                  return (
                    <div key={entry.id} className="animate-msg flex justify-end">
                      <div
                        className="t-body max-w-[80%] whitespace-pre-wrap rounded-[20px] rounded-br-md px-4.5 py-2.5"
                        style={{ background: "var(--grad-primary)", color: "var(--on-primary)" }}
                      >
                        {entry.text}
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={entry.id} className="animate-msg group flex gap-3.5">
                    <span className="ring-grad mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--accent)]">
                      <LogoMark size={16} />
                    </span>
                    <div className="min-w-0 flex-1 pt-1">
                      <div className="t-body whitespace-pre-wrap text-[var(--text-primary)]">
                        {entry.text}
                      </div>
                      {entry.text && (
                        <div className="mt-1.5 flex items-center gap-2 opacity-0 transition-opacity duration-[var(--fast)] group-hover:opacity-100">
                          <button
                            onClick={() => void toggleSpeak(entry.id, entry.text)}
                            aria-label={speakingId === entry.id ? "Ferma la voce" : "Leggi ad alta voce"}
                            title={speakingId === entry.id ? "Ferma la voce" : "Leggi ad alta voce"}
                            className={`rounded-md p-1 transition-colors ${
                              speakingId === entry.id
                                ? "text-[var(--accent)]"
                                : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                            }`}
                          >
                            {speakingId === entry.id ? <StopIcon size={15} /> : <SpeakerIcon size={15} />}
                          </button>
                          {entry.model && (
                            <span className="text-[11.5px] text-[var(--text-tertiary)]">
                              {shortModel(entry.model)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              }

              if (entry.kind === "image") {
                return (
                  <div key={entry.id} className="animate-rise flex gap-3.5">
                    <span className="ring-grad mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--accent)]">
                      <ImageIcon size={15} />
                    </span>
                    <figure className="min-w-0">
                      <img
                        src={entry.url}
                        alt={entry.prompt}
                        className="max-w-full rounded-2xl border border-[var(--border)] shadow-[var(--shadow-2)] sm:max-w-[420px]"
                      />
                      <figcaption className="mt-1.5 text-[12px] text-[var(--text-tertiary)]">
                        {entry.prompt}
                      </figcaption>
                    </figure>
                  </div>
                );
              }

              if (entry.kind === "trades") {
                return (
                  <div key={entry.id} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {TRADES.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => pickTrade(t.id)}
                        className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3.5 text-left shadow-[var(--shadow-1)] transition-all duration-[var(--fast)] hover:-translate-y-px hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:shadow-[var(--shadow-2)]"
                      >
                        <span className="block font-medium text-[var(--text-primary)]">
                          {t.label}
                        </span>
                        <span className="t-small mt-0.5 block text-[var(--text-secondary)]">
                          {t.examples}
                        </span>
                      </button>
                    ))}
                  </div>
                );
              }

              if (entry.kind === "kit" && kit && plan) {
                return (
                  <div
                    key={entry.id}
                    className="animate-rise overflow-hidden rounded-[20px] border border-[var(--border)] bg-[var(--bg-card)] shadow-[var(--shadow-2)]"
                  >
                    <Block title={`${kit.agents.length} agenti`}>
                      {kit.agents.map((a) => (
                        <Line key={a.name} strong={a.name} rest={a.role} />
                      ))}
                    </Block>
                    <Block title="Da collegare">
                      {kit.connectors.map((c) => (
                        <div key={c.name} className="flex items-center gap-3 py-1">
                          <BrandTile service={c.name} size={36} />
                          <div className="min-w-0 flex-1 text-[13.5px] leading-relaxed">
                            <span className="font-medium text-[var(--text-primary)]">
                              Connetti {c.name}
                            </span>
                            <span className="block text-[var(--text-secondary)]">{c.why}</span>
                          </div>
                        </div>
                      ))}
                    </Block>
                    <Block title="Piano" last>
                      <Line
                        strong={`${plan.name} — ${plan.price} ${plan.cadence}`}
                        rest={kit.planWhy + teamNote}
                      />
                    </Block>
                    <div className="border-t border-[var(--border)] p-3.5">
                      <button
                        onClick={activateKit}
                        className="btn-grad flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-[15px] font-medium"
                      >
                        <CheckIcon size={17} />
                        Attiva tutto
                      </button>
                      <button
                        onClick={() => {
                          setTradeId(null);
                          setEntries((prev) => prev.filter((e) => e.kind !== "kit"));
                          master("Nessun problema. Di cosa ti occupi?", [{ kind: "trades" }], 400);
                        }}
                        className="mt-1.5 w-full py-2 text-[13px] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
                      >
                        Non è il mio caso
                      </button>
                    </div>
                  </div>
                );
              }

              if (entry.kind === "whatsapp") {
                return (
                  <ActionCard
                    key={entry.id}
                    service="WhatsApp"
                    title="Connetti WhatsApp"
                    body="Come WhatsApp Web: inquadri un QR col telefono del locale e in dieci secondi è attivo."
                    cta="Mostra il QR"
                    onClick={connectWhatsApp}
                    note="In questa versione il collegamento è simulato: serve la WhatsApp Business API."
                  />
                );
              }

              if (entry.kind === "knowledge") {
                return (
                  <ActionCard
                    key={entry.id}
                    title={`Carica ${kit?.knowledge ?? "i documenti"}`}
                    body="PDF, Word, Excel o anche solo una foto. Legge quello e non inventa niente."
                    cta="Scegli un file"
                    onClick={() => fileRef.current?.click()}
                  />
                );
              }

              if (entry.kind === "recap") {
                return (
                  <div
                    key={entry.id}
                    className="animate-rise rounded-[20px] border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-[var(--shadow-2)]"
                  >
                    <div className="t-label text-grad inline-block">Sei operativo</div>
                    <div className="mt-2.5 flex flex-col gap-1.5 text-[13.5px]">
                      <Line strong={`${agents.length} agenti`} rest="al lavoro adesso" />
                      <Line
                        strong={whatsAppConnected ? "WhatsApp attivo" : "WhatsApp da collegare"}
                        rest={whatsAppConnected ? "i clienti ti scrivono e trovano risposta" : "resta l'ultimo passo"}
                      />
                      <Line
                        strong={`${docs.length} document${docs.length === 1 ? "o" : "i"}`}
                        rest="è quello che sa, e non va oltre"
                      />
                    </div>
                    <div className="mt-4">
                      <Savings handled={handledAlone} variant="full" />
                    </div>
                    <p className="mt-3 text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
                      Cresce da qui: ogni messaggio che gestisco da solo è tempo che torna a te.
                      Da ora puoi chiedermi qualsiasi cosa qui sotto.
                    </p>
                  </div>
                );
              }

              if (entry.kind === "proposal") {
                return (
                  <AgentProposal
                    key={entry.id}
                    agent={entry.agent}
                    busy={creatingAgent === entry.id}
                    onCreate={(edited) => void confirmAgent(entry.id, edited)}
                    onReject={() => {
                      setEntries((prev) => prev.filter((e) => e.id !== entry.id));
                      master(
                        "Nessun problema. Mi dica cosa non torna e lo rifaccio: può essere il nome, " +
                          "quello di cui si occupa, o tutto quanto.",
                        undefined,
                        400
                      );
                    }}
                    note={
                      agents.length >= 3
                        ? "Sul piano gratuito gli agenti sono tre. Gliene creo comunque altri: gli abbonamenti arrivano tra poco."
                        : undefined
                    }
                  />
                );
              }

              if (entry.kind === "warning") {
                return (
                  <div
                    key={entry.id}
                    className="animate-rise rounded-[20px] border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-[var(--shadow-2)]"
                  >
                    <div className="t-label text-grad inline-block">Richiesta impegnativa</div>
                    <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--text-primary)]">
                      {entry.warning.message}
                    </p>
                    <div className="mt-3.5 flex gap-2">
                      <button
                        onClick={() => void ask(history(entries), true)}
                        className="btn-grad flex-1 rounded-xl py-3 text-[14.5px] font-medium"
                      >
                        Procedi
                      </button>
                      <button
                        onClick={() => setEntries((prev) => prev.filter((e) => e.id !== entry.id))}
                        className="rounded-xl border border-[var(--border)] px-4 py-3 text-[14.5px] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
                      >
                        Lascia stare
                      </button>
                    </div>
                    <p className="mt-2.5 text-[12px] leading-relaxed text-[var(--text-secondary)]">
                      Non hai ancora speso niente: la risposta non è stata generata.
                    </p>
                  </div>
                );
              }

              return null;
            })}

            {typing && (
              <div className="animate-rise flex gap-3.5" aria-label="Sto scrivendo">
                <span className="ring-grad mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--accent)]">
                  <LogoMark size={16} />
                </span>
                <span className="flex items-center gap-1.5 py-2">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="animate-breathe h-[7px] w-[7px] rounded-full bg-[var(--text-tertiary)]"
                      style={{ animationDelay: `${i * 0.16}s` }}
                    />
                  ))}
                </span>
              </div>
            )}

            {imageBusy && (
              <div className="animate-rise flex gap-3.5" aria-label="Sto creando l'immagine">
                <span className="ring-grad mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--accent)]">
                  <ImageIcon size={15} />
                </span>
                <span className="t-small flex items-center gap-2 py-2 text-[var(--text-secondary)]">
                  <span className="animate-breathe inline-block h-[7px] w-[7px] rounded-full bg-[var(--accent)]" />
                  Creo l'immagine… ci vuole fino a mezzo minuto.
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ───────────────────────── COMPOSER ───────────────────────── */}
        <div className="shrink-0 px-5 pb-6 pt-2 md:px-8">
          <form onSubmit={send} className="mx-auto max-w-[760px]">
            <div className="glass rounded-[22px] border border-[var(--border)] shadow-[var(--shadow-2)] transition-shadow duration-[var(--fast)] focus-within:border-[var(--accent)] focus-within:shadow-[0_0_0_4px_var(--accent-ring)]">
              <div className="flex items-center gap-2 py-2.5 pl-5 pr-2.5">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  disabled={streaming}
                  placeholder={
                    listening
                      ? "Ti ascolto…"
                      : streaming
                        ? "Sto rispondendo..."
                        : tradeId
                          ? "Scrivi quello che ti serve..."
                          : "Oppure scrivimelo tu"
                  }
                  className="t-body min-w-0 flex-1 bg-transparent py-1.5 text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)] disabled:opacity-60"
                />
                <button
                  type="submit"
                  aria-label="Invia"
                  disabled={!draft.trim() || streaming}
                  className="btn-grad flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all duration-[var(--fast)] disabled:scale-90 disabled:opacity-25"
                >
                  <ArrowUpIcon />
                </button>
              </div>

              {/* La barra degli strumenti: modello, voce, immagini. */}
              <div className="flex items-center gap-1 border-t border-[var(--border)] px-3 py-1.5">
                <label className="relative flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1.5 text-[12.5px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--fill-quiet)] hover:text-[var(--text-primary)]">
                  <SparkleIcon size={13} />
                  <span className="max-w-[180px] truncate">
                    {modelSlug === "auto" ? "Automatico" : modelName(models, modelSlug)}
                  </span>
                  <ChevronDownIcon size={12} />
                  <select
                    value={modelSlug}
                    onChange={(e) => setModelSlug(e.target.value)}
                    aria-label="Scegli il modello IA"
                    className="absolute inset-0 cursor-pointer opacity-0"
                  >
                    <option value="auto">Automatico (consigliato)</option>
                    {PROVIDERS.map(({ prefix, label }) => {
                      const group = models
                        .filter((m) => m.id.startsWith(prefix))
                        .sort((a, b) => a.name.localeCompare(b.name));
                      if (group.length === 0) return null;
                      return (
                        <optgroup key={prefix} label={label}>
                          {group.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                        </optgroup>
                      );
                    })}
                  </select>
                </label>

                {micAvailable && (
                  <button
                    type="button"
                    onClick={toggleMic}
                    aria-label={listening ? "Smetti di ascoltare" : "Detta col microfono"}
                    title={listening ? "Smetti di ascoltare" : "Detta col microfono"}
                    className={`rounded-lg p-2 transition-colors ${
                      listening
                        ? "animate-listening bg-[var(--accent-soft)] text-[var(--accent)]"
                        : "text-[var(--text-secondary)] hover:bg-[var(--fill-quiet)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    <MicIcon size={16} />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => void makeImage()}
                  disabled={!draft.trim() || imageBusy || streaming}
                  aria-label="Crea un'immagine da quello che hai scritto"
                  title="Crea un'immagine da quello che hai scritto"
                  className="rounded-lg p-2 text-[var(--text-secondary)] transition-colors hover:bg-[var(--fill-quiet)] hover:text-[var(--text-primary)] disabled:opacity-30"
                >
                  <ImageIcon size={16} />
                </button>

                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  aria-label="Allega un documento"
                  title="Allega un documento (menù, listino, tariffario)"
                  className="rounded-lg p-2 text-[var(--text-secondary)] transition-colors hover:bg-[var(--fill-quiet)] hover:text-[var(--text-primary)]"
                >
                  <PaperclipIcon size={16} />
                </button>

                <span className="ml-auto hidden items-center gap-1.5 pr-1 text-[12px] text-[var(--text-tertiary)] sm:flex">
                  {imageBusy ? (
                    "Immagine in corso…"
                  ) : listening ? (
                    "Ti ascolto"
                  ) : (
                    <>
                      <kbd className="rounded border border-[var(--border)] bg-[var(--bg-app)] px-1.5 py-0.5 font-sans text-[10.5px] text-[var(--text-secondary)]">
                        Invio
                      </kbd>
                      per mandare
                    </>
                  )}
                </span>
              </div>
            </div>
          </form>
        </div>

        <input
          ref={fileRef}
          type="file"
          multiple
          accept=".pdf,.txt,.csv,.doc,.docx,.xlsx,.png,.jpg"
          onChange={handleFiles}
          className="hidden"
        />
      </div>
    </div>
  );
}

/**
 * L'interruttore chiaro/scuro.
 *
 * L'icona mostra **dove si va**, non dove si è: al buio si vede il sole,
 * perché il sole è quello che ottieni premendo. Mostrare lo stato attuale è
 * l'errore che fa esitare tutti davanti a questo pulsante.
 */
function ThemeButton({ theme, onToggle }: { theme: string; onToggle: () => void }) {
  const goingToLight = theme === "dark";
  return (
    <button
      onClick={onToggle}
      aria-label={goingToLight ? "Passa al tema chiaro" : "Passa al tema scuro"}
      title={goingToLight ? "Tema chiaro" : "Tema scuro"}
      className="rounded-lg p-2 text-[var(--text-secondary)] transition-colors hover:bg-[var(--fill-quiet)] hover:text-[var(--text-primary)]"
    >
      {goingToLight ? <SunIcon size={17} /> : <MoonIcon size={17} />}
    </button>
  );
}

/**
 * Le istruzioni definitive dell'agente, quelle che finiscono su Neon.
 *
 * Prende quello che ha generato il Master Builder e ci aggiunge due cose che
 * il modello non può sapere da solo:
 *
 *   1. **il tono scelto dall'utente** sulla carta. Il generatore ne suggerisce
 *      uno in base al settore, ma la decisione finale è di chi vende, non
 *      dell'IA: un ristoratore può volere il formale e un notaio il cordiale.
 *   2. **il divieto di inventare**, ripetuto qui anche se il generatore lo ha
 *      già messo. È l'unica regola che non può mancare: la promessa venduta è
 *      "non sbaglia mai i prezzi", e la ripetizione costa due righe mentre un
 *      prezzo inventato costa un cliente.
 */
function agentSystemPrompt(
  agent: ProposedAgent,
  conversation: Array<Entry & { id: string }>
): string {
  const parts = [agent.instructions.trim(), "", "COME PARLI CON I CLIENTI"];

  if (agent.tone === "cordiale") {
    parts.push(
      "Tono cordiale e amichevole: dai del tu, frasi calde e brevi. Puoi usare un'emoji, mai più di una."
    );
  } else if (agent.tone === "formale") {
    parts.push(
      "Tono formale: dai del lei, frasi complete e curate, nessuna emoji, nessuna abbreviazione."
    );
  } else if (agent.tone === "come-parlo-io") {
    // Il tono "come parlo io" si costruisce dai messaggi veri dell'utente: è
    // l'unico modo di imitare un modo di scrivere senza chiederglielo a parole.
    const mine = conversation
      .filter((e) => e.kind === "user")
      .map((e) => (e.kind === "user" ? e.text : ""))
      .filter((t) => t.length > 12)
      .slice(-6);

    parts.push(
      "Imita il modo di scrivere del titolare: stessa lunghezza delle frasi, stesso livello di " +
        "formalità, stesse espressioni tipiche. Non imitare eventuali errori di battitura."
    );
    if (mine.length > 0) {
      parts.push("", "Esempi di come scrive il titolare:", ...mine.map((t) => `— ${t}`));
    } else {
      // Senza esempi non si può imitare niente: meglio dirlo che fingere.
      parts.push(
        "(Non ci sono ancora abbastanza messaggi del titolare per imitarne lo stile: " +
          "usa un tono neutro e naturale finché non ne avrai.)"
      );
    }
  } else {
    parts.push("Tono neutro e professionale: chiaro, gentile, senza fronzoli e senza emoji.");
  }

  parts.push(
    "",
    "LA REGOLA CHE NON PUOI VIOLARE",
    "Non conosci prezzi, orari, disponibilità o condizioni di questa attività se non te li ha dati " +
      "il titolare o non li trovi nei documenti caricati. Non inventarli MAI, nemmeno per fare una " +
      "stima o un esempio. Se non lo sai, dillo con semplicità e di' che fai verificare dal titolare."
  );

  return parts.join("\n");
}

/** Il nome leggibile di un modello, o lo slug se il catalogo non è arrivato. */
function modelName(models: CatalogModelInfo[], slug: string): string {
  return models.find((m) => m.id === slug)?.name ?? slug;
}

/** "anthropic/claude-sonnet-5" → "claude-sonnet-5": basta per la didascalia. */
function shortModel(slug: string): string {
  return slug.split("/").pop() ?? slug;
}

/** Il campo nuovo progetto nella sidebar: si apre, si scrive, si conferma. */
function NewProjectButton({ onCreate }: { onCreate: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  if (!open) {
    return (
      <div className="flex gap-1.5">
        {/* Un tocco e la chat esiste: il nome arriva dopo, dalla prima frase. */}
        <button
          onClick={() => onCreate(NEW_CHAT_NAME)}
          className="btn-side flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-[13.5px] font-medium"
        >
          <PlusIcon size={15} />
          Nuova chat
        </button>
        {/* Per chi il titolo lo ha gia in testa. */}
        <button
          onClick={() => setOpen(true)}
          aria-label="Nuova chat con un nome scelto da te"
          title="Dai un nome tu"
          className="rounded-xl border border-[var(--side-border)] px-2.5 text-[var(--side-text-dim)] transition-colors hover:text-white"
        >
          <PencilIcon size={15} />
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const value = name.trim();
        if (!value) return;
        onCreate(value);
        setName("");
        setOpen(false);
      }}
      className="flex items-center gap-1.5 rounded-xl bg-[var(--side-bg-raised)] px-2.5 py-1.5"
    >
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setName("");
            setOpen(false);
          }
        }}
        placeholder="Nome del progetto"
        className="t-small min-w-0 flex-1 bg-transparent py-1 text-white outline-none placeholder:text-[var(--side-text-dim)]"
      />
      <button type="submit" aria-label="Crea" className="p-1 text-white">
        <CheckIcon size={15} />
      </button>
      <button
        type="button"
        aria-label="Annulla"
        onClick={() => {
          setName("");
          setOpen(false);
        }}
        className="p-1 text-[var(--side-text-dim)] hover:text-white"
      >
        <CloseIcon size={14} />
      </button>
    </form>
  );
}

/**
 * Manda un errore alle notifiche, con la frase giusta.
 *
 * Il backend risponde già in italiano e dice cosa manca — per esempio quale
 * variabile d'ambiente non è configurata. Quel messaggio si mostra così com'è:
 * sostituirlo con "qualcosa è andato storto" non aiuterebbe nessuno.
 *
 * Il dettaglio tecnico va nel secondo campo, che nella notifica sta chiuso: a
 * un ristoratore non serve, a chi deve capire cosa è rotto è l'unica cosa utile.
 */
function notifyError(notify: ReturnType<typeof useNotify>, error: unknown): void {
  if (error instanceof ApiError) {
    if (error.isUnauthorized) {
      notify.error("La sessione è scaduta. Ricarica la pagina e rientra.");
      return;
    }
    notify.error(error.message, error.detail);
    return;
  }
  notify.error(error instanceof Error ? error.message : String(error));
}

function ActionCard({
  title,
  body,
  cta,
  onClick,
  note,
  service,
}: {
  title: string;
  body: string;
  cta: string;
  onClick: () => void;
  note?: string;
  service?: string;
}) {
  return (
    <div className="animate-rise rounded-[20px] border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-[var(--shadow-2)]">
      <div className="flex items-start gap-3">
        {service && <BrandTile service={service} size={40} />}
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-medium text-[var(--text-primary)]">{title}</div>
          <p className="mt-1 text-[13.5px] leading-relaxed text-[var(--text-secondary)]">{body}</p>
        </div>
      </div>
      <button
        onClick={onClick}
        className="btn-grad mt-3.5 w-full rounded-xl py-3 text-[14.5px] font-medium"
      >
        {cta}
      </button>
      {note && (
        <p className="mt-2.5 text-[12px] leading-relaxed text-[var(--text-secondary)]">{note}</p>
      )}
    </div>
  );
}

function Block({
  title,
  children,
  last,
}: {
  title: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div className={last ? "px-4 py-3.5" : "border-b border-[var(--border)] px-4 py-3.5"}>
      <div className="t-label text-grad inline-block">{title}</div>
      <div className="mt-2 flex flex-col gap-1.5">{children}</div>
    </div>
  );
}

function Line({ strong, rest }: { strong: string; rest: string }) {
  return (
    <div className="text-[13.5px] leading-relaxed">
      <span className="font-medium text-[var(--text-primary)]">{strong}</span>
      <span className="text-[var(--text-secondary)]"> — {rest}</span>
    </div>
  );
}

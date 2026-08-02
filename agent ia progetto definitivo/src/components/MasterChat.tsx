import { useEffect, useRef, useState } from "react";
import Logo from "./Logo";
import { ArrowUpIcon, CheckIcon, GearIcon } from "./Icons";
import BrandTile from "./BrandTile";
import ProjectBar from "./ProjectBar";
import { TRADES, tradeById } from "../data/trades";
import { KITS } from "../data/kits";
import { planById } from "../data/plans";
import { ApiError, streamChat, type ChatMessage, type HeavyWarning } from "../lib/api";
import type { KnowledgeDoc, Project, SurveyAnswers, TradeId } from "../types";

interface MasterChatProps {
  surveyAnswers?: SurveyAnswers;
  onOpenAdvanced: () => void;
}

/** Ogni riga della conversazione: testo, oppure una carta che si può usare. */
type Entry =
  | { kind: "master"; text: string }
  | { kind: "user"; text: string }
  | { kind: "trades" }
  | { kind: "kit"; tradeId: TradeId }
  | { kind: "whatsapp" }
  | { kind: "knowledge" }
  | { kind: "recap" }
  /** L'avviso costi: la richiesta è impegnativa, si chiede il permesso prima di spendere. */
  | { kind: "warning"; warning: HeavyWarning };

let seq = 0;
const nid = () => `e-${++seq}`;

/**
 * L'unica schermata del prodotto: una chat a tutto schermo che guida l'utente dall'inizio
 * alla fine. Consiglia gli agenti, propone i connettori, chiede i documenti, apre WhatsApp
 * — tutto dentro la conversazione, senza mai mandarlo in un pannello di configurazione.
 */
const SETUP_ID = "setup";

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

  const [tradeId, setTradeId] = useState<TradeId | null>(null);
  const [agents, setAgents] = useState<string[]>([]);
  const [whatsAppConnected, setWhatsAppConnected] = useState(false);
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  /** Vero mentre l'agente sta rispondendo: si evita di sovrapporre due richieste. */
  const [streaming, setStreaming] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  /** Scorrimento automatico: la conversazione si segue da sola. */
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [entries.length, typing]);

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

  function createProject(name: string) {
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

  function deleteProject(id: string) {
    setProjects((prev) => prev.filter((p) => p.id !== id));
    setThreads((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    if (activeProject === id) setActiveProject(SETUP_ID);
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

    try {
      for await (const event of streamChat({
        messages,
        systemPrompt: systemPrompt(),
        confirmHeavy,
      })) {
        if (event.kind === "warning") {
          setTyping(false);
          add({ kind: "warning", warning: event.warning });
          return;
        }
        if (event.kind === "delta") {
          if (!replyId) {
            setTyping(false);
            replyId = push({ kind: "master", text: "" });
          }
          grow(replyId, event.text);
        }
      }

      if (!replyId) {
        add({ kind: "master", text: "Non è arrivato niente. Riprova tra un istante." });
      }
    } catch (error) {
      setTyping(false);
      add({ kind: "master", text: explain(error) });
    } finally {
      setTyping(false);
      setStreaming(false);
    }
  }

  function send(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || streaming) return;
    setDraft("");
    add({ kind: "user", text });
    void ask([...history(entries), { role: "user", content: text }]);
  }

  const kit = tradeId ? KITS[tradeId] : null;
  const plan = kit ? planById(kit.planId) : null;
  const teamNote = surveyAnswers?.teamSize?.toLowerCase().includes("team")
    ? " Lavorando in team ti serve anche per condividere gli agenti con i tuoi."
    : "";

  return (
    <div className="flex h-full w-full flex-col bg-[var(--bg-app)]">
      <header className="flex shrink-0 items-center justify-between px-5 py-4">
        <Logo size={24} />
        <div className="flex items-center gap-3">
          {agents.length > 0 && (
            <span className="t-small hidden items-center gap-2 text-[var(--text-secondary)] sm:flex">
              {/* Verde, non blu: "è acceso e funziona" non è la stessa cosa di
                  "qui si può premere". Prima erano lo stesso colore. */}
              <span
                className="h-[7px] w-[7px] rounded-full"
                style={{
                  background: whatsAppConnected ? "var(--positive)" : "var(--border-strong)",
                }}
              />
              {agents.length} agenti · {whatsAppConnected ? "WhatsApp attivo" : "WhatsApp da collegare"}
            </span>
          )}
          <button
            onClick={onOpenAdvanced}
            aria-label="Impostazioni avanzate"
            title="Impostazioni avanzate"
            className="rounded-lg p-2 text-[var(--text-secondary)] transition-colors hover:bg-[var(--fill-quiet)] hover:text-[var(--text-primary)]"
          >
            <GearIcon size={18} />
          </button>
        </div>
      </header>

      <ProjectBar
        projects={projects}
        activeId={activeProject}
        onSwitch={setActiveProject}
        onCreate={createProject}
        onDelete={deleteProject}
      />

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5">
        <div className="mx-auto flex max-w-[680px] flex-col gap-5 pb-10">
          {entries.map((entry) => {
            if (entry.kind === "master" || entry.kind === "user") {
              const mine = entry.kind === "user";
              return (
                <div
                  key={entry.id}
                  className={`animate-rise flex ${mine ? "justify-end" : "justify-start"}`}
                >
                  {mine ? (
                    <div className="t-body max-w-[80%] whitespace-pre-wrap rounded-[20px] bg-[var(--accent)] px-4 py-2.5 text-white">
                      {entry.text}
                    </div>
                  ) : (
                    /* L'agente non parla dentro una bolla: il suo testo È il
                       contenuto della pagina. Una bolla grigia intorno a ogni
                       risposta fa sembrare il prodotto un giocattolo per
                       chattare, e a schermo pieno spreca metà larghezza. */
                    <div className="t-body max-w-[95%] whitespace-pre-wrap text-[var(--text-primary)]">
                      {entry.text}
                    </div>
                  )}
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
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] py-3.5 text-[15px] font-medium text-white transition-colors hover:bg-[var(--accent-hover)]"
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
              const hours = ((docs.length + agents.length) * 3) / 60;
              return (
                <div
                  key={entry.id}
                  className="animate-rise rounded-[20px] border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-[var(--shadow-2)]"
                >
                  <div className="t-label text-[var(--accent)]">
                    Sei operativo
                  </div>
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
                  <p className="mt-3.5 border-t border-[var(--border)] pt-3 text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
                    Ogni messaggio che gestisco da solo ti vale circa 3 minuti. Il contatore
                    parte da {hours < 1 ? "zero" : `${hours.toFixed(1)} ore`}: cresce da qui.
                    Da ora puoi chiedermi qualsiasi cosa qui sotto.
                  </p>
                </div>
              );
            }

            if (entry.kind === "warning") {
              return (
                <div
                  key={entry.id}
                  className="animate-rise rounded-[20px] border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-[var(--shadow-2)]"
                >
                  <div className="t-label text-[var(--accent)]">
                    Richiesta impegnativa
                  </div>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--text-primary)]">
                    {entry.warning.message}
                  </p>
                  <div className="mt-3.5 flex gap-2">
                    <button
                      onClick={() => void ask(history(entries), true)}
                      className="flex-1 rounded-xl bg-[var(--accent)] py-3 text-[14.5px] font-medium text-white transition-colors hover:bg-[var(--accent-hover)]"
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
            /* Niente bolla nemmeno qui, per coerenza con le risposte: solo tre
               punti che respirano dove comparirà il testo. */
            <div className="animate-rise flex justify-start" aria-label="Sto scrivendo">
              <span className="flex items-center gap-1.5 py-1">
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
        </div>
      </div>

      <div className="shrink-0 px-5 pb-6 pt-2">
        <form onSubmit={send} className="mx-auto max-w-[680px]">
          {/* L'anello di messa a fuoco invece del solo bordo più scuro: si vede
              dove stai scrivendo senza dover cercare. */}
          <div className="flex items-center gap-2 rounded-[22px] border border-[var(--border)] bg-[var(--bg-card)] py-2.5 pl-5 pr-2.5 shadow-[var(--shadow-2)] transition-shadow duration-[var(--fast)] focus-within:border-[var(--accent)] focus-within:shadow-[0_0_0_4px_var(--accent-ring)]">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={streaming}
              placeholder={
                streaming
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
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-white transition-all duration-[var(--fast)] hover:bg-[var(--accent-hover)] disabled:scale-90 disabled:opacity-25"
            >
              <ArrowUpIcon />
            </button>
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
  );
}

/**
 * Trasforma un errore in una frase leggibile.
 *
 * Il backend risponde già in italiano e dice cosa manca — per esempio quale
 * variabile d'ambiente non è configurata. Quei messaggi si mostrano così come
 * sono: sostituirli con "qualcosa è andato storto" non aiuterebbe nessuno.
 */
function explain(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.isUnauthorized) return "La sessione è scaduta. Ricarica la pagina e rientra.";
    return error.message;
  }
  return error instanceof Error ? error.message : String(error);
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
        className="mt-3.5 w-full rounded-xl bg-[var(--accent)] py-3 text-[14.5px] font-medium text-white transition-colors hover:bg-[var(--accent-hover)]"
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
      <div className="t-label text-[var(--accent)]">
        {title}
      </div>
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

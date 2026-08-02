import { useEffect, useRef, useState } from "react";
import { ArrowUpIcon, CheckIcon, CloseIcon } from "./Icons";
import { STRUCTURE_BY_TRADE, tradeById } from "../data/trades";
import type { Structure, StructureClass, StructureRule, TradeId } from "../types";

interface StructureBuilderProps {
  tradeId: TradeId;
  structure: Structure;
  onSave: (structure: Structure) => void;
  onClose: () => void;
}

type Turn = { from: "master" | "user"; text: string };
type Phase = "classes" | "details" | "rules" | "done";

let seq = 0;
const nid = (p: string) => `${p}-${++seq}`;

/**
 * La configurazione guidata: l'utente descrive a parole come è organizzato il suo lavoro e
 * il sistema costruisce una struttura dati salvabile. È il punto di forza del prodotto —
 * nessun modulo, nessuna tabella da compilare.
 *
 * Oggi l'interpretazione del linguaggio è deterministica (separa per virgole, riconosce
 * "e", ignora il rumore). Col backend passerà a un modello via OpenRouter con structured
 * output, ma la struttura dati che produce è già quella definitiva.
 */
export default function StructureBuilder({
  tradeId,
  structure,
  onSave,
  onClose,
}: StructureBuilderProps) {
  const trade = tradeById(tradeId);
  const vocab = STRUCTURE_BY_TRADE[tradeId];

  const [turns, setTurns] = useState<Turn[]>([
    {
      from: "master",
      text: `${vocab.question} Scrivimele separate da una virgola — per esempio: ${vocab.examples}.`,
    },
  ]);
  const [phase, setPhase] = useState<Phase>(structure.classes.length ? "rules" : "classes");
  const [draft, setDraft] = useState("");
  const [classes, setClasses] = useState<StructureClass[]>(structure.classes);
  const [rules, setRules] = useState<StructureRule[]>(structure.rules);
  const [detailIndex, setDetailIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns.length]);

  function push(userText: string, masterText: string) {
    setTurns((prev) => [
      ...prev,
      { from: "user", text: userText },
      { from: "master", text: masterText },
    ]);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft("");

    if (phase === "classes") {
      const names = splitList(text);
      if (!names.length) {
        push(text, "Non ho capito. Prova a elencarle separate da una virgola.");
        return;
      }
      const created = names.map((n) => ({ id: nid("cls"), name: n, details: [] }));
      setClasses(created);
      setDetailIndex(0);
      setPhase("details");
      push(
        text,
        `Ho creato ${created.length} ${created.length === 1 ? vocab.singular : vocab.plural.replace(/^(le|i) /, "")}. Dimmi qualcosa su "${created[0].name}": quello che un cliente potrebbe chiederti. Se non serve, scrivi "salta".`
      );
      return;
    }

    if (phase === "details") {
      const current = classes[detailIndex];
      const skip = /^(salta|niente|no|nulla)$/i.test(text);
      if (!skip) {
        setClasses((prev) =>
          prev.map((c, i) =>
            i === detailIndex ? { ...c, details: [...c.details, text] } : c
          )
        );
      }
      const next = detailIndex + 1;
      if (next < classes.length) {
        setDetailIndex(next);
        push(
          text,
          skip
            ? `Ok. E su "${classes[next].name}"?`
            : `Segnato su "${current.name}". E su "${classes[next].name}"?`
        );
      } else {
        setPhase("rules");
        push(
          text,
          "Ultima cosa: c'è una regola che l'agente non deve mai violare? Per esempio un limite, un orario, uno sconto massimo. Scrivi \"basta\" quando hai finito."
        );
      }
      return;
    }

    if (phase === "rules") {
      if (/^(basta|finito|fine|stop|no)$/i.test(text)) {
        setPhase("done");
        push(text, "Perfetto. Ecco la configurazione: controllala e salvala.");
        return;
      }
      setRules((prev) => [...prev, { id: nid("rule"), text }]);
      push(text, "Regola aggiunta. Un'altra? Scrivi \"basta\" se hai finito.");
    }
  }

  const placeholder =
    phase === "classes"
      ? vocab.examples
      : phase === "details"
      ? `Su "${classes[detailIndex]?.name ?? ""}"...`
      : phase === "rules"
      ? "Es. non accettare gruppi oltre 10 persone senza chiamarmi"
      : "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(16,17,30,0.4)] p-4">
      <div className="flex h-full max-h-[640px] w-full max-w-[560px] flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-card)]">
        <header className="flex items-center gap-3 border-b border-[var(--border)] px-5 py-3.5">
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--text-primary)]">
              Configura {vocab.plural}
            </h2>
            <p className="truncate text-[12.5px] text-[var(--text-secondary)]">
              {trade.agentName} imparerà come è organizzato il tuo lavoro
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Chiudi"
            className="shrink-0 rounded-lg p-1.5 text-[var(--text-secondary)] transition-colors hover:bg-[var(--fill-quiet)] hover:text-[var(--text-primary)]"
          >
            <CloseIcon />
          </button>
        </header>

        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {turns.map((t, i) => (
            <div key={i} className={`flex ${t.from === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[14px] leading-relaxed ${
                  t.from === "user"
                    ? "bg-[var(--accent)] text-white"
                    : "bg-[var(--bg-app)] text-[var(--text-primary)]"
                }`}
              >
                {t.text}
              </div>
            </div>
          ))}

          {phase === "done" && (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-app)] p-4">
              <div className="text-[12px] font-medium uppercase tracking-wide text-[var(--accent)]">
                Configurazione creata
              </div>
              <div className="mt-3 flex flex-col gap-2.5">
                {classes.map((c) => (
                  <div key={c.id} className="text-[13.5px]">
                    <span className="font-medium text-[var(--text-primary)]">{c.name}</span>
                    {c.details.length > 0 && (
                      <span className="text-[var(--text-secondary)]">
                        {" — "}
                        {c.details.join("; ")}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              {rules.length > 0 && (
                <>
                  <div className="mt-4 text-[12px] font-medium uppercase tracking-wide text-[var(--text-secondary)]">
                    Regole
                  </div>
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {rules.map((r) => (
                      <li key={r.id} className="text-[13.5px] text-[var(--text-primary)]">
                        · {r.text}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <button
                onClick={() => onSave({ classes, rules })}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] py-3 text-[14.5px] font-medium text-white transition-colors hover:bg-[var(--accent-hover)]"
              >
                <CheckIcon size={16} />
                Salva la configurazione
              </button>
            </div>
          )}
        </div>

        {phase !== "done" && (
          <form onSubmit={handleSubmit} className="border-t border-[var(--border)] p-3">
            <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-app)] py-1.5 pl-3.5 pr-1.5 focus-within:border-[var(--border-strong)]">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={placeholder}
                autoFocus
                className="min-w-0 flex-1 bg-transparent py-1.5 text-[14px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-secondary)]"
              />
              <button
                type="submit"
                aria-label="Invia"
                disabled={!draft.trim()}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-white transition-opacity hover:bg-[var(--accent-hover)] disabled:opacity-25"
              >
                <ArrowUpIcon />
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

/** Separa un elenco dettato a voce o scritto di fretta: virgole, "e", punti e virgola. */
function splitList(text: string): string[] {
  return text
    .split(/,|;|\be\b|\n/gi)
    .map((s) => s.trim().replace(/^(la|le|il|i|lo|gli|un|una)\s+/i, ""))
    .filter((s) => s.length > 1)
    .map((s) => s[0].toUpperCase() + s.slice(1));
}

import { useEffect, useRef, useState } from "react";
import Logo from "./Logo";
import { CheckIcon } from "./Icons";
import { TRADES, tradeById } from "../data/trades";
import { KITS } from "../data/kits";
import { planById } from "../data/plans";
import type { BuilderProfile, SurveyAnswers, TradeId } from "../types";

interface MasterBuilderProps {
  onReady: (profile: BuilderProfile, agentNames: string[]) => void;
  surveyAnswers?: SurveyAnswers;
}

type Turn = { from: "master" | "user"; text: string };

/**
 * Una domanda sola: "di cosa ti occupi?". Poi il Master Builder propone tutto insieme —
 * la squadra di agenti, i canali da collegare, il piano — e con un clic è fatto.
 * Niente carte da spuntare una per una: è l'IA che guida, non l'utente che configura.
 */
export default function MasterBuilder({ onReady, surveyAnswers }: MasterBuilderProps) {
  const [turns, setTurns] = useState<Turn[]>([
    {
      from: "master",
      text: "Ciao. Dimmi solo di cosa ti occupi e ti metto in piedi tutto io: gli agenti, i canali, il piano.",
    },
  ]);
  const [tradeId, setTradeId] = useState<TradeId | null>(null);
  const [building, setBuilding] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [turns.length, tradeId]);

  function pickTrade(id: TradeId) {
    const trade = tradeById(id);
    const kit = KITS[id];
    setTurns((prev) => [
      ...prev,
      { from: "user", text: trade.label },
      { from: "master", text: `${kit.headline}. Guarda se ti torna, poi la attivo.` },
    ]);
    setTradeId(id);
  }

  function activate() {
    if (!tradeId) return;
    setBuilding(true);
    const kit = KITS[tradeId];
    window.setTimeout(() => {
      onReady(
        { tradeId, timeSink: "", channel: "WhatsApp" },
        kit.agents.map((a) => a.name)
      );
    }, 900);
  }

  const kit = tradeId ? KITS[tradeId] : null;
  const plan = kit ? planById(kit.planId) : null;

  // Chi lavora in team ha più bisogno di postazioni: lo diciamo nella riga del piano.
  const teamNote = surveyAnswers?.teamSize?.toLowerCase().includes("team")
    ? " Lavorando in team, ti serve anche per condividere gli agenti con i tuoi."
    : "";

  return (
    <div className="flex h-full w-full flex-col bg-[var(--bg-app)]">
      <header className="flex shrink-0 justify-center py-7">
        <Logo size={26} />
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6">
        <div className="mx-auto flex max-w-[560px] flex-col gap-3 pb-8">
          {turns.map((t, i) => (
            <div key={i} className={`flex ${t.from === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed ${
                  t.from === "user"
                    ? "[background:var(--grad-primary)] [color:var(--on-primary)]"
                    : "bg-[var(--bg-card)] text-[var(--text-primary)] shadow-[0_1px_2px_rgba(16,17,30,0.04)]"
                }`}
              >
                {t.text}
              </div>
            </div>
          ))}

          {kit && plan && (
            <div className="mt-2 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-card)]">
              <Block title={`${kit.agents.length} agenti`}>
                {kit.agents.map((a) => (
                  <Line key={a.name} strong={a.name} rest={a.role} />
                ))}
              </Block>

              <Block title="Canali da collegare">
                {kit.connectors.map((c) => (
                  <Line key={c.name} strong={c.name} rest={c.why} />
                ))}
              </Block>

              <Block title="Cosa gli serve sapere">
                <Line strong={kit.knowledge} rest="lo carichi dopo, in dieci secondi" />
              </Block>

              <Block title="Piano" last>
                <Line
                  strong={`${plan.name} — ${plan.price} ${plan.cadence}`}
                  rest={kit.planWhy + teamNote}
                />
              </Block>

              <div className="border-t border-[var(--border)] p-4">
                <button
                  onClick={activate}
                  disabled={building}
                  className="flex w-full items-center justify-center gap-2 rounded-xl btn-grad py-3.5 text-[15px] font-medium disabled:opacity-60"
                >
                  {building ? (
                    "Sto costruendo la tua squadra..."
                  ) : (
                    <>
                      <CheckIcon size={17} />
                      Attiva tutto
                    </>
                  )}
                </button>
                <button
                  onClick={() => setTradeId(null)}
                  disabled={building}
                  className="mt-2 w-full py-2 text-[13.5px] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] disabled:opacity-40"
                >
                  Non è il mio caso, cambio settore
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {!tradeId && (
        <div className="shrink-0 px-6 pb-8">
          <div className="mx-auto grid max-w-[560px] grid-cols-1 gap-2 sm:grid-cols-2">
            {TRADES.map((t) => (
              <button
                key={t.id}
                onClick={() => pickTrade(t.id)}
                className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3.5 text-left transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]"
              >
                <span className="block text-[14.5px] font-medium text-[var(--text-primary)]">
                  {t.label}
                </span>
                <span className="mt-0.5 block text-[12.5px] text-[var(--text-secondary)]">
                  {t.examples}
                </span>
              </button>
            ))}
          </div>
        </div>
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
      <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--accent)]">
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

import { ChevronRightIcon } from "../Icons";
import { buildHomeCards, tradeById } from "../../data/trades";
import type { BuilderProfile, HomeCard } from "../../types";

interface HomeProps {
  profile: BuilderProfile;
  knowledgeFiles: string[];
  channelConnected: boolean;
  hoursSaved: number;
  structureDone: boolean;
  onCardAction: (cardId: HomeCard["id"]) => void;
}

export default function Home({
  profile,
  knowledgeFiles,
  channelConnected,
  hoursSaved,
  structureDone,
  onCardAction,
}: HomeProps) {
  const trade = tradeById(profile.tradeId);
  const cards = buildHomeCards(trade, profile.channel);

  /** Cosa è già a posto: serve a mostrare all'utente quanto gli manca. */
  const done: Record<HomeCard["id"], boolean> = {
    agent: true,
    knowledge: knowledgeFiles.length > 0,
    channel: channelConnected,
    structure: structureDone,
    savings: hoursSaved > 0,
  };
  const todo = cards.filter((c) => !done[c.id]);

  return (
    <div className="mx-auto max-w-[620px] px-6 py-10 md:px-10 md:py-14">
      <h1 className="text-[28px] font-semibold tracking-[-0.025em] text-[var(--text-primary)] md:text-[32px]">
        {trade.agentName} è al lavoro
      </h1>
      <p className="mt-2 text-[14.5px] text-[var(--text-secondary)]">
        {todo.length === 0
          ? "Tutto pronto. Puoi startene tranquillo."
          : todo.length === 1
          ? "Manca una cosa sola."
          : `Mancano ${todo.length} cose per farlo lavorare al meglio.`}
      </p>

      <div className="mt-9 flex flex-col gap-3">
        {cards.map((card) => (
          <button
            key={card.id}
            onClick={() => onCardAction(card.id)}
            className="flex items-center gap-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 text-left transition-colors hover:border-[var(--border-strong)]"
          >
            <span
              aria-hidden="true"
              className="mt-0.5 h-[7px] w-[7px] shrink-0 self-start rounded-full"
              style={{
                background: done[card.id] ? "var(--accent)" : "var(--border-strong)",
              }}
            />
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-medium text-[var(--text-primary)]">
                {card.title}
              </span>
              <span className="mt-0.5 block text-[13.5px] leading-relaxed text-[var(--text-secondary)]">
                {detailFor(card, { knowledgeFiles, channelConnected, hoursSaved })}
              </span>
            </span>
            <span className="shrink-0 text-[var(--text-secondary)]">
              <ChevronRightIcon size={16} />
            </span>
          </button>
        ))}
      </div>

      <p className="mt-8 text-center text-[12.5px] text-[var(--text-secondary)]">
        Ti serve altro? Chiedilo in chat, oppure guarda in Impostazioni Avanzate.
      </p>
    </div>
  );
}

function detailFor(
  card: HomeCard,
  state: { knowledgeFiles: string[]; channelConnected: boolean; hoursSaved: number }
) {
  if (card.id === "knowledge" && state.knowledgeFiles.length > 0) {
    return `Sa quello che c'è in ${state.knowledgeFiles.length} document${
      state.knowledgeFiles.length === 1 ? "o" : "i"
    }: ${state.knowledgeFiles.join(", ")}.`;
  }
  if (card.id === "channel" && state.channelConnected) {
    return "Collegato. Risponde ai clienti anche quando hai chiuso.";
  }
  if (card.id === "savings") {
    return state.hoursSaved > 0
      ? `${state.hoursSaved} ore risparmiate questa settimana, circa ${Math.round(
          state.hoursSaved * 15
        )} €.`
      : card.body;
  }
  return card.body;
}

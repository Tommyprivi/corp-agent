import { CloseIcon } from "../Icons";
import { STRUCTURE_BY_TRADE, tradeById } from "../../data/trades";
import type { Structure as StructureData, TradeId } from "../../types";

interface StructureProps {
  tradeId: TradeId;
  structure: StructureData;
  onConfigure: () => void;
  onRemoveClass: (id: string) => void;
  onRemoveRule: (id: string) => void;
}

/** Mostra la configurazione costruita parlando, e permette di rimetterci mano. */
export default function Structure({
  tradeId,
  structure,
  onConfigure,
  onRemoveClass,
  onRemoveRule,
}: StructureProps) {
  const trade = tradeById(tradeId);
  const vocab = STRUCTURE_BY_TRADE[tradeId];
  const empty = structure.classes.length === 0 && structure.rules.length === 0;

  return (
    <div className="mx-auto max-w-[640px] px-6 py-10 md:px-10 md:py-14">
      <h1 className="text-[28px] font-semibold tracking-[-0.025em] text-[var(--text-primary)] md:text-[32px]">
        Come è organizzato il tuo lavoro
      </h1>
      <p className="mt-2 text-[14.5px] leading-relaxed text-[var(--text-secondary)]">
        {empty
          ? `Racconta a ${trade.agentName} com'è diviso il tuo lavoro. Lo fai parlando: niente tabelle da compilare.`
          : `${trade.agentName} usa questa configurazione per rispondere ai clienti.`}
      </p>

      <button
        onClick={onConfigure}
        className="mt-7 w-full rounded-xl bg-[var(--accent)] py-3.5 text-[15px] font-medium text-white transition-colors hover:bg-[var(--accent-hover)]"
      >
        {empty ? `Configura ${vocab.plural} parlando` : "Continua la configurazione"}
      </button>

      {structure.classes.length > 0 && (
        <section className="mt-9">
          <h2 className="mb-3 px-1 text-[13px] font-medium capitalize text-[var(--text-secondary)]">
            {vocab.plural}
          </h2>
          <div className="divide-y divide-[var(--border)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-card)]">
            {structure.classes.map((c) => (
              <div key={c.id} className="flex items-start gap-3 px-4 py-3.5">
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-medium text-[var(--text-primary)]">
                    {c.name}
                  </div>
                  {c.details.length > 0 && (
                    <div className="mt-0.5 text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
                      {c.details.join(" · ")}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => onRemoveClass(c.id)}
                  aria-label={`Rimuovi ${c.name}`}
                  className="shrink-0 rounded-lg p-1.5 text-[var(--text-secondary)] transition-colors hover:bg-[var(--fill-quiet)] hover:text-[var(--text-primary)]"
                >
                  <CloseIcon />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {structure.rules.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 px-1 text-[13px] font-medium text-[var(--text-secondary)]">
            Regole che non deve violare
          </h2>
          <div className="divide-y divide-[var(--border)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-card)]">
            {structure.rules.map((r) => (
              <div key={r.id} className="flex items-start gap-3 px-4 py-3.5">
                <span className="min-w-0 flex-1 text-[14px] leading-relaxed text-[var(--text-primary)]">
                  {r.text}
                </span>
                <button
                  onClick={() => onRemoveRule(r.id)}
                  aria-label="Rimuovi regola"
                  className="shrink-0 rounded-lg p-1.5 text-[var(--text-secondary)] transition-colors hover:bg-[var(--fill-quiet)] hover:text-[var(--text-primary)]"
                >
                  <CloseIcon />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {!empty && (
        <p className="mt-6 rounded-xl bg-[var(--bg-app)] px-4 py-3 text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
          Questa configurazione è salvata solo in questa sessione del browser. Col backend
          diventerà permanente e WhatsApp la leggerà in tempo reale.
        </p>
      )}
    </div>
  );
}

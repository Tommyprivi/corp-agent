import { CheckIcon, CloseIcon } from "../Icons";
import { tradeById } from "../../data/trades";
import type { BuilderProfile, KnowledgeDoc } from "../../types";

interface KnowledgeProps {
  profile: BuilderProfile;
  docs: KnowledgeDoc[];
  onPickFiles: () => void;
  onRemove: (id: string) => void;
}

/**
 * La base di conoscenza: è ciò che rende vera la promessa "non sbaglia mai i prezzi".
 * L'indicizzazione vettoriale arriva col backend (Passo 6): qui si gestiscono i documenti
 * e si dichiara apertamente cosa è già attivo e cosa no.
 */
export default function Knowledge({ profile, docs, onPickFiles, onRemove }: KnowledgeProps) {
  const trade = tradeById(profile.tradeId);

  return (
    <div className="mx-auto max-w-[640px] px-6 py-10 md:px-10 md:py-14">
      <h1 className="text-[28px] font-semibold tracking-[-0.025em] text-[var(--text-primary)] md:text-[32px]">
        Cosa sa {trade.agentName}
      </h1>
      <p className="mt-2 text-[14.5px] leading-relaxed text-[var(--text-secondary)]">
        Carica {trade.knowledgeName}, gli orari, le regole sui resi. L'agente risponde solo
        con quello che trova qui dentro: è così che non inventa prezzi.
      </p>

      <button
        onClick={onPickFiles}
        className="mt-7 w-full rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--bg-app)] px-6 py-8 text-center transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]"
      >
        <span className="block text-[15px] font-medium text-[var(--text-primary)]">
          Carica un documento
        </span>
        <span className="mt-1 block text-[13px] text-[var(--text-secondary)]">
          PDF, Word, Excel, CSV o una foto del menù
        </span>
      </button>

      {docs.length > 0 && (
        <section className="mt-9">
          <div className="mb-3 flex items-baseline justify-between px-1">
            <h2 className="text-[13px] font-medium text-[var(--text-secondary)]">
              Documenti caricati
            </h2>
            <span className="text-[12px] text-[var(--text-secondary)]">
              {docs.length} {docs.length === 1 ? "documento" : "documenti"}
            </span>
          </div>
          <div className="divide-y divide-[var(--border)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-card)]">
            {docs.map((doc) => (
              <div key={doc.id} className="flex items-center gap-3 px-4 py-3.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]">
                  <CheckIcon size={15} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-medium text-[var(--text-primary)]">
                    {doc.name}
                  </div>
                  <div className="text-[12.5px] text-[var(--text-secondary)]">
                    {formatSize(doc.size)} · in attesa di indicizzazione
                  </div>
                </div>
                <button
                  onClick={() => onRemove(doc.id)}
                  aria-label={`Rimuovi ${doc.name}`}
                  className="shrink-0 rounded-lg p-1.5 text-[var(--text-secondary)] transition-colors hover:bg-[var(--fill-quiet)] hover:text-[var(--text-primary)]"
                >
                  <CloseIcon />
                </button>
              </div>
            ))}
          </div>

          <p className="mt-4 rounded-xl bg-[var(--bg-app)] px-4 py-3 text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
            I file sono salvati solo in questa sessione del browser. L'indicizzazione che
            permette all'agente di leggerli davvero arriva col backend: finché non c'è, non
            promettiamo che l'agente li abbia letti.
          </p>
        </section>
      )}
    </div>
  );
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

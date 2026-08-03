import { useMemo, useState } from "react";
import { CheckIcon, PlusIcon, SearchIcon } from "../Icons";
import { agentsByFamily, presetSystemPrompt } from "../../data/agentPrompts";
import type { PresetAgent, PresetFamily } from "../../types";

/**
 * Il catalogo degli agenti pronti, dentro Impostazioni Avanzate.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * PERCHÉ STA QUI E NON ALL'INGRESSO
 * ─────────────────────────────────────────────────────────────────────────
 * La bibbia è netta: "l'utente non deve vedere 100 funzioni all'ingresso" e
 * "il Master Builder ne genera uno su misura, non si sfogliano elenchi".
 * Centoventisette carte in faccia a un ristoratore appena entrato sono
 * esattamente ciò che il progetto vuole evitare.
 *
 * Ma chi sa già cosa vuole non deve essere costretto a raccontarlo per
 * ottenerlo: qui, dietro le impostazioni, l'elenco c'è. Due strade per lo
 * stesso posto, come per le carte dei mestieri.
 *
 * Attivare un agente non è una spunta locale: chiama `createAgent` e finisce
 * su Neon con le istruzioni composte da `presetSystemPrompt`. È la differenza
 * tra un catalogo e una vetrina di cartone — fino a ieri erano schede senza
 * istruzioni, e attivarne una non produceva niente.
 */

interface AgentCatalogProps {
  /** I nomi già attivi: per non proporre due volte lo stesso. */
  activeNames: string[];
  onActivate: (agent: PresetAgent, systemPrompt: string) => Promise<void> | void;
}

export default function AgentCatalog({ activeNames, onActivate }: AgentCatalogProps) {
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState<PresetFamily | "all">("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [doneIds, setDoneIds] = useState<string[]>([]);

  const groups = useMemo(() => agentsByFamily(), []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return groups
      .filter((g) => family === "all" || g.family === family)
      .map((g) => ({
        ...g,
        agents: needle
          ? g.agents.filter(
              (a) =>
                a.name.toLowerCase().includes(needle) ||
                a.description.toLowerCase().includes(needle)
            )
          : g.agents,
      }))
      .filter((g) => g.agents.length > 0);
  }, [groups, query, family]);

  const total = groups.reduce((n, g) => n + g.agents.length, 0);
  const shown = filtered.reduce((n, g) => n + g.agents.length, 0);

  async function activate(agent: PresetAgent) {
    setBusyId(agent.id);
    try {
      await onActivate(agent, presetSystemPrompt(agent));
      setDoneIds((prev) => [...prev, agent.id]);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-[760px] px-6 py-10 md:px-10 md:py-12">
      <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
        Agenti pronti
      </h1>
      <p className="mt-2 text-[14.5px] leading-relaxed text-[var(--text-secondary)]">
        {total} lavoratori digitali già configurati. Attivane uno e comincia a usarlo subito —
        oppure raccontа al Master Builder cosa ti serve e te ne costruisce uno su misura.
      </p>

      {/* Ricerca e filtri: con 127 voci, scorrere non è un modo di trovare. */}
      <div className="mt-7 flex flex-col gap-3">
        <div className="flex items-center gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3.5 py-2.5 transition-colors focus-within:border-[var(--accent)]">
          <span className="text-[var(--text-tertiary)]">
            <SearchIcon size={16} />
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca: crediti, prenotazioni, recensioni, scadenze…"
            className="min-w-0 flex-1 bg-transparent text-[14px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)]"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="text-[12.5px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              Azzera
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Chip label="Tutti" active={family === "all"} onClick={() => setFamily("all")} />
          {groups.map((g) => (
            <Chip
              key={g.family}
              label={g.label}
              active={family === g.family}
              onClick={() => setFamily(g.family)}
            />
          ))}
        </div>

        {query && (
          <p className="text-[12.5px] text-[var(--text-secondary)]">
            {shown === 0 ? "Nessun agente per questa ricerca." : `${shown} su ${total}`}
          </p>
        )}
      </div>

      <div className="mt-8 flex flex-col gap-8">
        {filtered.map((group) => (
          <section key={group.family}>
            <h2 className="t-label text-[var(--text-tertiary)]">
              {group.label} · {group.agents.length}
            </h2>
            <div className="mt-3 flex flex-col gap-2">
              {group.agents.map((agent) => {
                const already = activeNames.includes(agent.name) || doneIds.includes(agent.id);
                return (
                  <div
                    key={agent.id}
                    className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3.5 transition-all duration-[var(--fast)] hover:border-[var(--border-strong)]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-[14.5px] font-medium text-[var(--text-primary)]">
                        {agent.name}
                      </div>
                      <p className="mt-0.5 text-[13px] leading-relaxed text-[var(--text-secondary)]">
                        {agent.description}
                      </p>
                    </div>
                    <button
                      onClick={() => void activate(agent)}
                      disabled={already || busyId === agent.id}
                      className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-[var(--fast)] ${
                        already
                          ? "cursor-default text-[var(--positive)]"
                          : "btn-grad disabled:opacity-50"
                      }`}
                    >
                      {already ? (
                        <>
                          <CheckIcon size={14} />
                          Attivo
                        </>
                      ) : busyId === agent.id ? (
                        "Attivo…"
                      ) : (
                        <>
                          <PlusIcon size={14} />
                          Attiva
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-[12.5px] transition-all duration-[var(--fast)] ${
        active
          ? "border-[var(--accent)] bg-[var(--accent-soft)] font-medium text-[var(--text-primary)]"
          : "border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
      }`}
    >
      {label}
    </button>
  );
}

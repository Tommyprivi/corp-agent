import { useMemo, useState } from "react";
import { CheckIcon, PlusIcon, SearchIcon } from "../Icons";
import {
  NEEDS_LABEL,
  agentNeeds,
  agentsByFamily,
  presetSystemPrompt,
  type AgentNeeds,
} from "../../data/agentPrompts";
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
  /**
   * Il filtro che conta davvero.
   *
   * Obiettivo di Tommaso: zero documenti. Chi apre il catalogo vuole sapere
   * cosa puo usare stasera, non leggersi 125 schede per scoprire che tre
   * hanno bisogno di un collegamento che non esiste ancora.
   */
  const [onlyReady, setOnlyReady] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [doneIds, setDoneIds] = useState<string[]>([]);

  const groups = useMemo(() => agentsByFamily(), []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return groups
      .filter((g) => family === "all" || g.family === family)
      .map((g) => ({
        ...g,
        agents: g.agents
          .filter((a) => !onlyReady || agentNeeds(a.id) === "subito")
          .filter(
            (a) =>
              !needle ||
              a.name.toLowerCase().includes(needle) ||
              a.description.toLowerCase().includes(needle)
          ),
      }))
      .filter((g) => g.agents.length > 0);
  }, [groups, query, family, onlyReady]);

  const total = groups.reduce((n, g) => n + g.agents.length, 0);
  const readyCount = groups.reduce(
    (n, g) => n + g.agents.filter((a) => agentNeeds(a.id) === "subito").length,
    0
  );
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
        oppure racconta al Master Builder cosa ti serve e te ne costruisce uno su misura.
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

        {/* Il filtro che risponde alla domanda vera: cosa posso usare stasera? */}
        <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3.5 py-3">
          <input
            type="checkbox"
            checked={onlyReady}
            onChange={(e) => setOnlyReady(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
          />
          <span className="min-w-0">
            <span className="block text-[13.5px] font-medium text-[var(--text-primary)]">
              Solo quelli che funzionano subito
            </span>
            <span className="block text-[12.5px] leading-snug text-[var(--text-secondary)]">
              {readyCount} su {total} non hanno bisogno di niente: gli scrivi e lavorano.
            </span>
          </span>
        </label>

        {(query || onlyReady) && (
          <p className="text-[12.5px] text-[var(--text-secondary)]">
            {shown === 0 ? "Nessun agente con questi filtri." : `${shown} su ${total}`}
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
                      <NeedsBadge needs={agentNeeds(agent.id)} />
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

/**
 * Cosa serve a questo agente, detto in faccia.
 *
 * Il verde non e decorazione: e lunica informazione che qualcuno cerca
 * davvero in questo elenco. "Serve un collegamento" e scritto in chiaro
 * perche scoprirlo dopo aver attivato e la cosa che fa perdere fiducia.
 */
function NeedsBadge({ needs }: { needs: AgentNeeds }) {
  const label = NEEDS_LABEL[needs];
  const style =
    needs === "subito"
      ? { color: "var(--positive)", background: "var(--positive-soft)" }
      : { color: "var(--text-secondary)", background: "var(--fill-quiet)" };

  return (
    <span
      className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11.5px] font-medium"
      style={style}
      title={label.long}
    >
      {needs === "subito" && (
        <span className="h-[5px] w-[5px] rounded-full" style={{ background: "var(--positive)" }} />
      )}
      {label.short}
    </span>
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

import { useState } from "react";
import MyAgents from "./MyAgents";
import AgentCatalog from "./AgentCatalog";
import { PLANS } from "../../data/plans";
import type { PresetAgent, RoleAgent } from "../../types";

interface AdvancedProps {
  agents: RoleAgent[];
  onToggleAgent: (agentId: string) => void;
  onStartChat: (agentId: string) => void;
  onCreateAgent: (description: string) => void;
  /** Attiva un agente del catalogo: lo salva su Neon con le sue istruzioni. */
  onActivatePreset: (agent: PresetAgent, systemPrompt: string) => Promise<void> | void;
}

type Tab = "agents" | "catalog" | "account";

/**
 * Impostazioni Avanzate: dove sta tutto quello che non serve all'ingresso.
 * Principio 1 della bibbia — l'utente non deve vedere 100 funzioni appena entra.
 */
export default function Advanced({
  agents,
  onToggleAgent,
  onStartChat,
  onCreateAgent,
  onActivatePreset,
}: AdvancedProps) {
  const [tab, setTab] = useState<Tab>("agents");

  return (
    <div>
      <div className="border-b border-[var(--border)] px-6 pt-8 md:px-10">
        <div className="mx-auto max-w-[640px]">
          <div className="flex gap-1">
            <Tab label="I miei agenti" active={tab === "agents"} onClick={() => setTab("agents")} />
            <Tab label="Agenti pronti" active={tab === "catalog"} onClick={() => setTab("catalog")} />
            <Tab label="Account e piano" active={tab === "account"} onClick={() => setTab("account")} />
          </div>
        </div>
      </div>

      {tab === "agents" && (
        <MyAgents
          agents={agents}
          onToggleAgent={onToggleAgent}
          onStartChat={onStartChat}
          onCreateAgent={onCreateAgent}
        />
      )}
      {tab === "catalog" && (
        <AgentCatalog
          activeNames={agents.map((a) => a.name)}
          onActivate={onActivatePreset}
        />
      )}
      {tab === "account" && <Account />}
    </div>
  );
}

function Tab({
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
      className={`-mb-px border-b-2 px-3 py-2.5 text-[13.5px] transition-colors ${
        active
          ? "border-[var(--accent)] font-medium text-[var(--text-primary)]"
          : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
      }`}
    >
      {label}
    </button>
  );
}

function Account() {
  return (
    <div className="mx-auto max-w-[640px] px-6 py-10 md:px-10 md:py-14">
      <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
        Account e piano
      </h1>
      <p className="mt-2 text-[14.5px] text-[var(--text-secondary)]">
        Stai usando CorpAgent in prova, senza account. L'accesso e i pagamenti arrivano prima
        della beta di Novembre.
      </p>

      <div className="mt-8 flex flex-col gap-3">
        {PLANS.filter((p) => p.id !== "enterprise").map((plan) => (
          <div
            key={plan.id}
            className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[15px] font-medium text-[var(--text-primary)]">
                {plan.name}
              </span>
              <span className="text-[13px] text-[var(--text-secondary)]">
                {plan.price} {plan.cadence}
              </span>
            </div>
            <p className="mt-1 text-[13.5px] text-[var(--text-secondary)]">{plan.pitch}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

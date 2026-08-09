import { useState } from "react";
import MyAgents from "./MyAgents";
import AgentCatalog from "./AgentCatalog";
import Knowledge from "./Knowledge";
import WhatsAppSettings from "./WhatsAppSettings";
import Billing from "./Billing";
import type { PresetAgent, RoleAgent } from "../../types";

interface AdvancedProps {
  agents: RoleAgent[];
  onToggleAgent: (agentId: string) => void;
  onStartChat: (agentId: string) => void;
  onCreateAgent: (description: string) => void;
  /** Attiva un agente del catalogo: lo salva su Neon con le sue istruzioni. */
  onActivatePreset: (agent: PresetAgent, systemPrompt: string) => Promise<void> | void;
}

type Tab = "agents" | "catalog" | "memory" | "whatsapp" | "account";

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
            <Tab label="Memoria" active={tab === "memory"} onClick={() => setTab("memory")} />
            <Tab label="WhatsApp" active={tab === "whatsapp"} onClick={() => setTab("whatsapp")} />
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
      {tab === "memory" && <Knowledge />}
      {tab === "whatsapp" && <WhatsAppSettings />}
      {tab === "account" && <Billing />}
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


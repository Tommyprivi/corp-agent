import { useState } from "react";
import MyAgents from "./MyAgents";
import AgentCatalog from "./AgentCatalog";
import Knowledge from "./Knowledge";
import WhatsAppSettings from "./WhatsAppSettings";
import Connectors from "./Connectors";
import Richieste from "./Richieste";
import Billing from "./Billing";
import type { PresetAgent, RoleAgent } from "../../types";

interface AdvancedProps {
  agents: RoleAgent[];
  onToggleAgent: (agentId: string) => void;
  onStartChat: (agentId: string) => void;
  onCreateAgent: (description: string) => void;
  /** Attiva un agente del catalogo: lo salva su Neon con le sue istruzioni. */
  onActivatePreset: (agent: PresetAgent, systemPrompt: string) => Promise<void> | void;
  /**
   * Vero solo per chi è in `ADMIN_EMAILS`. ⚠️ La scheda «Richieste» non si
   * disegna affatto, invece di disegnarla e negare l'accesso: una voce di menu
   * che c'è e non funziona dice a chiunque che esiste una parte riservata.
   * Il vero controllo però è sul server — questo è solo per non mostrarla.
   */
  admin?: boolean;
}

type Tab = "agents" | "catalog" | "memory" | "connectors" | "whatsapp" | "account" | "richieste";

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
  admin,
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
            <Tab label="Connettori" active={tab === "connectors"} onClick={() => setTab("connectors")} />
            <Tab label="WhatsApp" active={tab === "whatsapp"} onClick={() => setTab("whatsapp")} />
            <Tab label="Account e piano" active={tab === "account"} onClick={() => setTab("account")} />
            {admin && (
              <Tab
                label="Richieste"
                active={tab === "richieste"}
                onClick={() => setTab("richieste")}
              />
            )}
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
      {tab === "connectors" && <Connectors />}
      {tab === "whatsapp" && <WhatsAppSettings />}
      {tab === "account" && <Billing />}
      {tab === "richieste" && admin && <Richieste />}
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


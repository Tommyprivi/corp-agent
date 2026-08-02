import { useState } from "react";
import Switch from "../Switch";
import { ArrowUpIcon } from "../Icons";
import type { RoleAgent } from "../../types";

interface MyAgentsProps {
  agents: RoleAgent[];
  onToggleAgent: (agentId: string) => void;
  onStartChat: (agentId: string) => void;
  onCreateAgent: (description: string) => void;
}

export default function MyAgents({
  agents,
  onToggleAgent,
  onStartChat,
  onCreateAgent,
}: MyAgentsProps) {
  const [draft, setDraft] = useState("");

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    onCreateAgent(text);
    setDraft("");
  }

  return (
    <div className="mx-auto max-w-[640px] px-6 py-10 md:px-10 md:py-14">
      <h1 className="text-[28px] font-semibold tracking-[-0.025em] text-[var(--text-primary)] md:text-[32px]">
        I Miei Agenti
      </h1>
      <p className="mt-2 text-[14.5px] text-[var(--text-secondary)]">
        Qui stanno solo i tuoi agenti. Il modello e i connettori te li propone CorpAgent
        mentre chatti, quando servono.
      </p>

      <div className="mt-9 divide-y divide-[var(--border)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-card)]">
        {agents.map((agent) => (
          <div key={agent.id} className="flex items-center gap-3 px-4 py-3.5">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-[14px] font-medium text-[var(--text-primary)]">
                  {agent.name}
                </span>
                {agent.custom && (
                  <span className="shrink-0 rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[10.5px] font-medium text-[var(--accent)]">
                    tuo
                  </span>
                )}
              </div>
              <div className="truncate text-[12.5px] text-[var(--text-secondary)]">
                {agent.role}
              </div>
            </div>
            <button
              onClick={() => onStartChat(agent.id)}
              className="shrink-0 rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium text-[var(--accent)] transition-colors hover:bg-[var(--accent-soft)]"
            >
              Apri chat
            </button>
            <Switch
              checked={agent.active}
              onChange={() => onToggleAgent(agent.id)}
              label={`Attiva ${agent.name}`}
            />
          </div>
        ))}
      </div>

      <section className="mt-10">
        <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">
          Crea un agente
        </h2>
        <p className="mt-1 text-[13.5px] text-[var(--text-secondary)]">
          Descrivi che lavoro deve fare, con le tue parole. Al resto pensa CorpAgent.
        </p>
        <form onSubmit={handleCreate} className="mt-4">
          <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-app)] py-1.5 pl-3.5 pr-1.5 focus-within:border-[var(--border-strong)]">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Es. risponde ai clienti che chiedono lo sconto senza cedere"
              className="min-w-0 flex-1 bg-transparent py-1.5 text-[13.5px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-secondary)]"
            />
            <button
              type="submit"
              aria-label="Crea l'agente"
              disabled={!draft.trim()}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-white transition-opacity hover:bg-[var(--accent-hover)] disabled:opacity-25"
            >
              <ArrowUpIcon />
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

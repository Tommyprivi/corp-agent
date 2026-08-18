import { useState } from "react";
import { CheckIcon, CloseIcon } from "./Icons";
import type { Project } from "../types";

interface ProjectBarProps {
  projects: Project[];
  activeId: string;
  onSwitch: (id: string) => void;
  onCreate: (name: string) => void;
  onDelete: (id: string) => void;
}

/**
 * La barra dei progetti. Oltre a far configurare gli agenti, CorpAgent si usa come un
 * normale chatbot: apri un progetto per pianificare una cosa e resta separato dal resto,
 * con la sua conversazione.
 */
export default function ProjectBar({
  projects,
  activeId,
  onSwitch,
  onCreate,
  onDelete,
}: ProjectBarProps) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = name.trim();
    if (!value) return;
    onCreate(value);
    setName("");
    setAdding(false);
  }

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto px-5 pb-2">
      {projects.map((p) => {
        const active = p.id === activeId;
        return (
          <div
            key={p.id}
            className={`group flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 transition-colors ${
              active
                ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                : "border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--border-strong)]"
            }`}
          >
            <button
              onClick={() => onSwitch(p.id)}
              className={`text-[13px] ${
                active
                  ? "font-medium text-[var(--accent)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {p.name}
            </button>
            {p.deletable && (
              <button
                onClick={() => onDelete(p.id)}
                aria-label={`Chiudi ${p.name}`}
                className="rounded-full p-0.5 text-[var(--text-faint,var(--text-secondary))] opacity-0 transition-opacity hover:text-[var(--text-primary)] group-hover:opacity-100"
              >
                <CloseIcon size={12} />
              </button>
            )}
          </div>
        );
      })}

      {adding ? (
        <form onSubmit={submit} className="flex shrink-0 items-center gap-1">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome del progetto"
            autoFocus
            onBlur={() => !name.trim() && setAdding(false)}
            className="w-[150px] rounded-full border border-[var(--accent)] bg-[var(--bg-card)] px-3 py-1.5 text-[13px] text-[var(--text-primary)] outline-none"
          />
          <button
            type="submit"
            aria-label="Crea progetto"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--on-primary)]"
          >
            <CheckIcon size={13} />
          </button>
        </form>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="shrink-0 rounded-full border border-dashed border-[var(--border-strong)] px-3 py-1.5 text-[13px] text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          + Nuovo progetto
        </button>
      )}
    </div>
  );
}

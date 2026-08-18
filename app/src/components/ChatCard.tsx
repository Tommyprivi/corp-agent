import { useEffect, useRef, useState } from "react";
import { ArrowUpIcon, CloseIcon, DuplicateIcon } from "./Icons";
import type { ChatSession, RoleAgent } from "../types";

interface ChatCardProps {
  session: ChatSession;
  agent?: RoleAgent;
  canClose: boolean;
  onSend: (sessionId: string, text: string) => void;
  onDuplicate: (sessionId: string) => void;
  onClose: (sessionId: string) => void;
}

export default function ChatCard({
  session,
  agent,
  canClose,
  onSend,
  onDuplicate,
  onClose,
}: ChatCardProps) {
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [session.messages.length]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    onSend(session.id, text);
    setDraft("");
  }

  return (
    <div className="@container flex h-[500px] flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-card)]">
      <header className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[14px] font-semibold tracking-[-0.01em] text-[var(--text-primary)]">
            {session.title}
          </h2>
          {agent && (
            <p className="truncate text-[12px] text-[var(--text-secondary)]">{agent.name}</p>
          )}
        </div>

        <button
          onClick={() => onDuplicate(session.id)}
          aria-label="Duplica Chatbot"
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-[12.5px] text-[var(--text-secondary)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
        >
          <DuplicateIcon />
          <span className="hidden @min-[430px]:inline">Duplica Chatbot</span>
        </button>

        {canClose && (
          <button
            onClick={() => onClose(session.id)}
            aria-label="Chiudi questa chat"
            className="shrink-0 rounded-lg p-1.5 text-[var(--text-secondary)] transition-colors hover:bg-[var(--fill-quiet)] hover:text-[var(--text-primary)]"
          >
            <CloseIcon />
          </button>
        )}
      </header>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {session.messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-relaxed ${
                m.role === "user"
                  ? "[background:var(--grad-primary)] [color:var(--on-primary)]"
                  : "bg-[var(--bg-app)] text-[var(--text-primary)]"
              } ${m.pending ? "text-[var(--text-secondary)]" : ""}`}
            >
              {m.content}
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="px-3 pb-3">
        <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-app)] py-1.5 pl-3.5 pr-1.5 focus-within:border-[var(--border-strong)]">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Chiedi all'agente..."
            className="min-w-0 flex-1 bg-transparent py-1.5 text-[13.5px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-secondary)]"
          />
          <button
            type="submit"
            aria-label="Invia messaggio"
            disabled={!draft.trim()}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full btn-grad transition-opacity disabled:opacity-25"
          >
            <ArrowUpIcon />
          </button>
        </div>
      </form>
    </div>
  );
}

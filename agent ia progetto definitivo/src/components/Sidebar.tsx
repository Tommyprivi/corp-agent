import Logo from "./Logo";
import { AgentsIcon, ChatSparkIcon, GearIcon } from "./Icons";
import type { NavKey } from "../types";

const NAV_ITEMS: Array<{ key: NavKey; label: string; icon: React.ReactNode }> = [
  { key: "home", label: "Home", icon: <AgentsIcon /> },
  { key: "chat", label: "Chat", icon: <ChatSparkIcon /> },
  { key: "advanced", label: "Impostazioni Avanzate", icon: <GearIcon /> },
];

interface SidebarProps {
  active: NavKey;
  onNavigate: (key: NavKey) => void;
  agentName: string;
}

export default function Sidebar({ active, onNavigate, agentName }: SidebarProps) {
  return (
    <aside className="flex h-full w-[68px] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--bg-app)] px-3 py-6 md:w-[248px] md:px-5">
      <div className="mb-9 flex justify-center md:justify-start md:pl-1">
        <span className="md:hidden">
          <Logo size={24} showWordmark={false} />
        </span>
        <span className="hidden md:inline-flex">
          <Logo size={25} />
        </span>
      </div>

      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const isActive = active === item.key;
          return (
            <button
              key={item.key}
              onClick={() => onNavigate(item.key)}
              aria-current={isActive ? "page" : undefined}
              title={item.label}
              className={`flex items-center gap-3 rounded-[10px] px-2.5 py-2.5 text-left transition-colors md:px-3 ${
                isActive
                  ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--fill-quiet)] hover:text-[var(--text-primary)]"
              }`}
            >
              <span className="mx-auto shrink-0 md:mx-0">{item.icon}</span>
              <span
                className={`hidden truncate text-[13.5px] md:inline ${
                  isActive ? "font-medium" : ""
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      <div className="mt-auto flex items-center gap-2.5 border-t border-[var(--border)] pt-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[11px] font-medium text-[var(--on-primary)]">
          IA
        </div>
        <div className="hidden min-w-0 flex-1 md:block">
          <div className="truncate text-[13px] font-medium text-[var(--text-primary)]">
            {agentName}
          </div>
          <div className="truncate text-[11.5px] text-[var(--text-secondary)]">Al lavoro</div>
        </div>
      </div>
    </aside>
  );
}

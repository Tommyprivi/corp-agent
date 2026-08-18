import ChatCard from "../ChatCard";
import type { ChatSession, RoleAgent } from "../../types";

interface ControlCenterProps {
  agents: RoleAgent[];
  sessions: ChatSession[];
  onStartChat: (agentId: string) => void;
  onSend: (sessionId: string, text: string) => void;
  onDuplicate: (sessionId: string) => void;
  onCloseSession: (sessionId: string) => void;
}

/** La chat. È il centro del prodotto: niente pannelli di configurazione attorno. */
export default function ControlCenter({
  agents,
  sessions,
  onSend,
  onDuplicate,
  onCloseSession,
}: ControlCenterProps) {
  return (
    <div className="mx-auto max-w-[900px] px-6 py-10 md:px-10 md:py-14">
      <div
        className="grid min-w-0 gap-5"
        style={{
          gridTemplateColumns:
            sessions.length > 1 ? "repeat(auto-fit, minmax(320px, 1fr))" : "1fr",
        }}
      >
        {sessions.map((session) => (
          <ChatCard
            key={session.id}
            session={session}
            agent={agents.find((a) => a.id === session.agentId)}
            canClose={sessions.length > 1}
            onSend={onSend}
            onDuplicate={onDuplicate}
            onClose={onCloseSession}
          />
        ))}
      </div>
    </div>
  );
}

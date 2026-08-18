import { useState } from "react";
import { CheckIcon, ChevronDownIcon, SparkleIcon } from "./Icons";
import type { AgentTone, ProposedAgent } from "../lib/api";

/**
 * La carta di un agente proposto dal Master Builder, prima di crearlo.
 *
 * Tommaso ha deciso (2 Agosto 2026) che si può metterci mano: nome e compito
 * sono campi veri, il tono si scegli, e le istruzioni si possono leggere se
 * uno vuole controllare. Ma stanno **chiuse** per default: sono mille caratteri
 * di testo che a un ristoratore non dicono niente e lo spaventano.
 *
 * Perché i campi e non solo "correggilo parlando": un nome sbagliato si
 * corregge in due secondi scrivendoci sopra, mentre spiegare a parole quale
 * parola cambiare è più lento e non sempre viene capito.
 */

interface AgentProposalProps {
  agent: ProposedAgent;
  /** Vero mentre si sta salvando: si evita il doppio clic. */
  busy?: boolean;
  onCreate: (agent: ProposedAgent) => void;
  onReject: () => void;
  /** Mostrato sotto la carta: l'avviso sul limite del piano Free. */
  note?: string;
}

const TONES: Array<{ id: AgentTone; label: string; example: string }> = [
  {
    id: "cordiale",
    label: "Cordiale",
    example: "Ciao! Sì, alle 21 abbiamo posto. Per quanti siete?",
  },
  {
    id: "neutro",
    label: "Neutro",
    example: "Sì, alle 21 abbiamo posto. Per quante persone?",
  },
  {
    id: "formale",
    label: "Formale",
    example: "Buongiorno, confermo la disponibilità per le 21.",
  },
  {
    id: "come-parlo-io",
    label: "Come parlo io",
    example: "Imita il suo modo di scrivere, leggendo i messaggi di questa conversazione.",
  },
];

export default function AgentProposal({
  agent,
  busy,
  onCreate,
  onReject,
  note,
}: AgentProposalProps) {
  const [name, setName] = useState(agent.name);
  const [role, setRole] = useState(agent.role);
  const [tone, setTone] = useState<AgentTone>(agent.tone);
  const [instructions, setInstructions] = useState(agent.instructions);
  const [openInstructions, setOpenInstructions] = useState(false);

  const valid = name.trim().length > 0 && role.trim().length > 0;

  return (
    <div className="animate-msg overflow-hidden rounded-[20px] border border-[var(--border)] bg-[var(--bg-card)] shadow-[var(--shadow-2)]">
      <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-2.5">
        <span className="text-[var(--text-tertiary)]">
          <SparkleIcon size={14} />
        </span>
        <span className="t-label text-[var(--text-secondary)]">Agente su misura</span>
      </div>

      <div className="flex flex-col gap-4 p-4">
        <Field label="Nome">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-app)] px-3 py-2 text-[14.5px] font-medium text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent)]"
          />
        </Field>

        <Field label="Di cosa si occupa">
          <textarea
            value={role}
            onChange={(e) => setRole(e.target.value)}
            maxLength={120}
            rows={2}
            className="w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--bg-app)] px-3 py-2 text-[13.5px] leading-relaxed text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent)]"
          />
        </Field>

        <Field label="Come parla ai tuoi clienti">
          <div className="grid grid-cols-2 gap-1.5">
            {TONES.map((t) => {
              const active = tone === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTone(t.id)}
                  title={t.example}
                  className={`rounded-lg border px-3 py-2 text-left text-[13px] transition-all duration-[var(--fast)] ${
                    active
                      ? "border-[var(--accent)] bg-[var(--accent-soft)] font-medium text-[var(--text-primary)]"
                      : "border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
          {/* L'esempio del tono scelto: si capisce cosa cambia senza provare. */}
          <p className="mt-2 text-[12.5px] italic leading-relaxed text-[var(--text-secondary)]">
            {TONES.find((t) => t.id === tone)?.example}
          </p>
        </Field>

        {/* Le istruzioni: chiuse per default, aperte per chi vuole controllare. */}
        <div>
          <button
            onClick={() => setOpenInstructions((o) => !o)}
            className="flex items-center gap-1.5 text-[12.5px] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
          >
            <span
              className="inline-block transition-transform duration-[var(--fast)]"
              style={{ transform: openInstructions ? "rotate(0deg)" : "rotate(-90deg)" }}
            >
              <ChevronDownIcon size={13} />
            </span>
            {openInstructions ? "Nascondi le istruzioni" : "Vedi le istruzioni complete"}
          </button>

          {openInstructions && (
            <div className="animate-rise mt-2.5">
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                rows={9}
                className="w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--bg-app)] px-3 py-2.5 text-[12.5px] leading-relaxed text-[var(--text-secondary)] outline-none transition-colors focus:border-[var(--accent)]"
              />
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-[var(--text-tertiary)]">
                Sono le regole che l'agente segue a ogni risposta. Puoi cambiarle, ma non
                togliere la parte che gli vieta di inventare prezzi e disponibilità: è quella
                che mantiene la promessa fatta ai tuoi clienti.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-[var(--border)] p-3.5">
        <button
          onClick={() => onCreate({ name: name.trim(), role: role.trim(), instructions, tone })}
          disabled={busy || !valid}
          className="btn-grad flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-[15px] font-medium disabled:opacity-40"
        >
          <CheckIcon size={17} />
          {busy ? "Lo sto creando..." : "Crea agente"}
        </button>
        <button
          onClick={onReject}
          disabled={busy}
          className="mt-1.5 w-full py-2 text-[13px] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] disabled:opacity-40"
        >
          Non è quello che mi serve
        </button>
        {note && (
          <p className="mt-2 text-center text-[12px] leading-relaxed text-[var(--text-secondary)]">
            {note}
          </p>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="t-label mb-1.5 block text-[var(--text-tertiary)]">{label}</span>
      {children}
    </label>
  );
}

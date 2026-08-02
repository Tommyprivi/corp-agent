import { useState } from "react";
import { CheckIcon } from "./Icons";

interface WhatsAppConnectProps {
  agentName: string;
  onClose: () => void;
  onConnected: () => void;
}

/**
 * Il collegamento WhatsApp deve essere a zero attrito: un QR code, come WhatsApp Web.
 * Niente API di Meta in faccia all'utente, niente moduli. Come descritto nella bibbia:
 * "in 10 secondi il canale è attivo".
 */
export default function WhatsAppConnect({ agentName, onClose, onConnected }: WhatsAppConnectProps) {
  const [status, setStatus] = useState<"idle" | "connecting" | "done">("idle");

  function simulateScan() {
    setStatus("connecting");
    window.setTimeout(() => {
      setStatus("done");
      window.setTimeout(onConnected, 900);
    }, 1400);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-6">
      <div className="w-full max-w-[380px] rounded-2xl bg-[var(--bg-card)] p-6 text-center shadow-xl">
        {status !== "done" ? (
          <>
            <h2 className="text-[17px] font-semibold text-[var(--text-primary)]">
              Colleghiamo il tuo WhatsApp
            </h2>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-[var(--text-secondary)]">
              Così {agentName} può rispondere ai tuoi clienti 24 ore su 24. Inquadra il codice
              con il telefono del locale, come per WhatsApp Web.
            </p>

            <div className="my-6 flex justify-center">
              <QrPlaceholder pulsing={status === "connecting"} />
            </div>

            {status === "connecting" ? (
              <p className="text-[13.5px] font-medium text-[var(--accent)]">Connessione in corso...</p>
            ) : (
              <button
                onClick={simulateScan}
                className="btn-grad w-full rounded-xl py-3 text-[14.5px] font-medium"
              >
                Ho scansionato il codice
              </button>
            )}

            <button
              onClick={onClose}
              className="mt-3 w-full py-2 text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              Annulla
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full" style={{ background: "var(--grad-primary)", color: "var(--on-primary)" }}>
              <CheckIcon size={22} />
            </div>
            <h2 className="text-[17px] font-semibold text-[var(--text-primary)]">
              WhatsApp collegato
            </h2>
            <p className="text-[13.5px] text-[var(--text-secondary)]">
              {agentName} è già al lavoro sul tuo numero.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function QrPlaceholder({ pulsing }: { pulsing: boolean }) {
  // Un reticolo puramente decorativo: la scansione vera arriva con l'API di WhatsApp
  // Business nel Passo 6. Qui serve solo a comunicare "funziona come WhatsApp Web".
  const cells = Array.from({ length: 49 }, (_, i) => (i * 37) % 5 === 0 || (i * 13) % 7 === 0);
  return (
    <div
      className={`grid grid-cols-7 gap-1 rounded-xl border border-[var(--border)] bg-white p-4 ${
        pulsing ? "animate-pulse" : ""
      }`}
      style={{ width: 168, height: 168 }}
      aria-hidden="true"
    >
      {cells.map((on, i) => (
        <div
          key={i}
          className="rounded-[2px]"
          style={{ background: on ? "var(--text-primary)" : "transparent" }}
        />
      ))}
    </div>
  );
}

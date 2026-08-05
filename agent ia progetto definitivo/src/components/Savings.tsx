import { useEffect, useRef, useState } from "react";
import { ClockIcon } from "./Icons";

/**
 * Il Contatore Risparmio.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * PERCHÉ MERITA DI ESSERE GRANDE
 * ─────────────────────────────────────────────────────────────────────────
 * È uno dei **quattro pilastri della V1** secondo la bibbia — insieme al Master
 * Builder, a WhatsApp e alla memoria. Ma fino al 2 Agosto 2026 era una scrittina
 * grigia in alto a destra: «⏱ 2.4 h», della stessa dimensione del nome del
 * modello.
 *
 * È l'unica cosa nel prodotto che risponde alla domanda che il ristoratore si
 * fa davvero — *«mi conviene?»*. Non è decorazione: è la ragione per cui uno
 * rinnova l'abbonamento a Gennaio.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * IL CALCOLO È DICHIARATO, NON GONFIATO
 * ─────────────────────────────────────────────────────────────────────────
 * Tre minuti per ogni messaggio gestito senza di te, e 20 €/ora come valore del
 * tempo di chi ha un'attività. Sono numeri **dichiarati sotto il contatore**,
 * non nascosti.
 *
 * La tentazione sarebbe metterne di più generosi: 5 minuti a messaggio fa un
 * numero doppio, e nessuno lo verificherebbe. Ma un ristoratore che legge «hai
 * risparmiato 40 ore» sapendo di aver ricevuto trenta messaggi capisce subito
 * che gli si sta raccontando una storia, e da quel momento non crede più a
 * niente — nemmeno ai prezzi.
 */

/** Minuti che ti costerebbe rispondere a mano a un messaggio. */
const MINUTES_PER_MESSAGE = 3;
/** Quanto vale un'ora del tempo di chi ha un'attività, in euro. */
const HOURLY_VALUE = 20;

interface SavingsProps {
  /** Messaggi a cui l'agente ha risposto da solo. */
  handled: number;
  /** `compact` per la barra di stato, `full` per il pannello. */
  variant?: "compact" | "full";
  onClick?: () => void;
}

export default function Savings({ handled, variant = "compact", onClick }: SavingsProps) {
  const hours = (handled * MINUTES_PER_MESSAGE) / 60;
  const value = hours * HOURLY_VALUE;

  if (variant === "compact") {
    return (
      <button
        onClick={onClick}
        title={`${handled} messaggi gestiti senza di te · circa ${MINUTES_PER_MESSAGE} minuti l'uno`}
        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] transition-colors hover:bg-[var(--fill-quiet)]"
      >
        <span className="text-[var(--text-tertiary)]">
          <ClockIcon size={13} />
        </span>
        <Counter value={hours} suffix=" h" decimals={1} className="font-semibold text-[var(--text-primary)]" />
        <span className="hidden text-[var(--text-secondary)] xl:inline">risparmiate</span>
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-[var(--shadow-1)]">
      <div className="t-label text-[var(--text-tertiary)]">Il tuo tempo, restituito</div>

      <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <Counter
          value={hours}
          suffix=" ore"
          decimals={1}
          className="text-[34px] font-semibold leading-none tracking-[-0.03em] text-[var(--text-primary)]"
        />
        <span className="text-[15px] text-[var(--text-secondary)]">
          ≈{" "}
          <Counter value={value} suffix=" €" decimals={0} className="font-medium" /> di tempo tuo
        </span>
      </div>

      {/* La barra: cresce fino a un traguardo di quaranta ore, che è circa una
          settimana di lavoro. Un numero senza scala non dice se è tanto. */}
      <div className="mt-4 h-[6px] w-full overflow-hidden rounded-full bg-[var(--fill-quiet)]">
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-out"
          style={{
            width: `${Math.min(100, (hours / 40) * 100)}%`,
            background: "var(--grad-primary)",
          }}
        />
      </div>

      <p className="mt-3 text-[13px] leading-relaxed text-[var(--text-secondary)]">
        <strong className="font-semibold text-[var(--text-primary)]">
          {handled} {handled === 1 ? "messaggio" : "messaggi"}
        </strong>{" "}
        gestiti senza di te.
      </p>

      {/* Il calcolo si dichiara. Chi vuole controllarlo deve poterlo fare, e
          chi non gli crede deve poter vedere che non c'è trucco. */}
      <p className="mt-2 border-t border-[var(--border)] pt-2.5 text-[11.5px] leading-relaxed text-[var(--text-tertiary)]">
        Il conto: {MINUTES_PER_MESSAGE} minuti per messaggio, {HOURLY_VALUE} € l'ora. Sono
        stime dichiarate, non misurate — preferiamo un numero verificabile a uno
        impressionante.
      </p>
    </div>
  );
}

/**
 * Un numero che sale invece di scattare.
 *
 * Non è vezzo: vedere il numero **muoversi** è quello che fa capire che è
 * cresciuto. Uno che scatta da 12,1 a 12,4 non si nota, e il contatore perde
 * la sua unica ragione di esistere.
 *
 * Parte da dove era, non da zero: rianimare da zero a ogni render farebbe
 * sembrare che il risparmio si azzeri ogni volta che apri la pagina.
 */
function Counter({
  value,
  suffix,
  decimals,
  className,
}: {
  value: number;
  suffix?: string;
  decimals: number;
  className?: string;
}) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);

  useEffect(() => {
    const start = from.current;
    if (start === value) return;

    const DURATION = 700;
    const t0 = performance.now();
    let frame = 0;

    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / DURATION);
      // Frenata morbida in coda: un numero che arriva a velocità costante
      // sembra un contatore del gas.
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(start + (value - start) * eased);
      if (p < 1) frame = requestAnimationFrame(step);
      else from.current = value;
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return (
    <span className={className}>
      {shown.toLocaleString("it-IT", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  );
}

import { tradeById } from "../../data/trades";
import type { BuilderProfile } from "../../types";

interface SavingsProps {
  profile: BuilderProfile;
  /** Messaggi che l'agente ha gestito da solo. Oggi conta quelli della chat interna. */
  handledMessages: number;
  channelConnected: boolean;
}

/** Minuti risparmiati per ogni messaggio gestito senza intervento umano. */
const MINUTES_PER_MESSAGE = 3;
/** Costo orario di riferimento per un'ora di lavoro di un titolare o di un addetto. */
const HOURLY_RATE = 15;

/**
 * Il Contatore Risparmio: è il quarto pilastro della V1, quello che fa rinnovare
 * l'abbonamento. Mostra numeri veri, calcolati sull'attività reale: se non c'è ancora
 * attività, lo dice invece di inventare 42 ore risparmiate.
 */
export default function Savings({ profile, handledMessages, channelConnected }: SavingsProps) {
  const trade = tradeById(profile.tradeId);
  const minutes = handledMessages * MINUTES_PER_MESSAGE;
  const hours = minutes / 60;
  const euro = hours * HOURLY_RATE;

  const hasData = handledMessages > 0;

  return (
    <div className="mx-auto max-w-[640px] px-6 py-10 md:px-10 md:py-14">
      <h1 className="text-[28px] font-semibold tracking-[-0.025em] text-[var(--text-primary)] md:text-[32px]">
        Quanto stai risparmiando
      </h1>
      <p className="mt-2 text-[14.5px] text-[var(--text-secondary)]">
        {hasData
          ? `Ecco cosa ti ha già tolto dalle mani ${trade.agentName}.`
          : `Appena ${trade.agentName} inizia a rispondere, qui compaiono i numeri veri.`}
      </p>

      <div className="mt-9 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Metric
          value={hasData ? formatHours(hours) : "—"}
          label="Ore risparmiate"
          highlight
        />
        <Metric value={hasData ? `${Math.round(euro)} €` : "—"} label="Valore del tempo" />
        <Metric value={String(handledMessages)} label="Messaggi gestiti da solo" />
      </div>

      {!hasData && (
        <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--bg-app)] p-5">
          <div className="text-[14px] font-medium text-[var(--text-primary)]">
            Come si accende questo contatore
          </div>
          <ol className="mt-3 flex flex-col gap-2 text-[13.5px] leading-relaxed text-[var(--text-secondary)]">
            <li>
              1. Carica {trade.knowledgeName}, così l'agente sa cosa rispondere.
            </li>
            <li>
              2. {channelConnected
                ? `${profile.channel} è già collegato: i clienti possono scrivere.`
                : `Collega ${profile.channel}, così i clienti arrivano all'agente.`}
            </li>
            <li>3. Ogni messaggio a cui risponde da solo vale circa 3 minuti tuoi.</li>
          </ol>
        </div>
      )}

      <p className="mt-6 text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
        Il calcolo è dichiarato, non magico: {MINUTES_PER_MESSAGE} minuti risparmiati per
        ogni messaggio gestito senza di te, valorizzati a {HOURLY_RATE} € l'ora. Quando
        WhatsApp sarà collegato davvero, questi numeri arriveranno dai messaggi reali dei
        clienti invece che dalla chat interna.
      </p>
    </div>
  );
}

function Metric({
  value,
  label,
  highlight,
}: {
  value: string;
  label: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
      <div
        className="text-[26px] font-semibold tracking-[-0.02em]"
        style={{ color: highlight ? "var(--accent)" : "var(--text-primary)" }}
      >
        {value}
      </div>
      <div className="mt-0.5 text-[12.5px] text-[var(--text-secondary)]">{label}</div>
    </div>
  );
}

function formatHours(hours: number) {
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  return `${hours.toFixed(1).replace(".0", "")} h`;
}

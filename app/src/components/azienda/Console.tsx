/**
 * I pezzi della console di Speed Trasporti — lo stile «Assistant».
 *
 * Voluto da Tommaso il 12 agosto: *«lo stile deve essere più quello di
 * Assistant: professionale, minimale, con molti tool da imparare»*. Il modello
 * è il loro gestionale (Assistant Evolution di QCSNET): bianco, righe sottili,
 * tabelle fitte, iconcine monocromatiche, una barra di strumenti in alto.
 *
 * ⚠️ NON è la vetrina pubblica. Quella resta nera e animata perché deve
 * vendere. Questa la aprono per lavorarci otto ore: sembra un software da
 * ufficio perché LO È, e un software da ufficio che sembra un'app giocattolo
 * non lo prende sul serio nessuno.
 *
 * Le icone sono tratti sottili scritti a mano, mai emoji: un emoji colorato in
 * mezzo a un gestionale bianco è la prima cosa che tradisce «app fatta in
 * fretta». Un tratto grigio no.
 */

import type { ReactNode } from "react";

// ─────────────────────────────────────────────────────────────────────────
// LE ICONE — tratto sottile, monocromatiche, 20×20
// ─────────────────────────────────────────────────────────────────────────

type IconaNome =
  | "cruscotto"
  | "traffico"
  | "magazzino"
  | "autisti"
  | "ammin"
  | "clienti"
  | "persone"
  | "documenti"
  | "mezzi"
  | "carico"
  | "scarico"
  | "differenza"
  | "problema"
  | "ritiro"
  | "reclamo"
  | "cerca"
  | "agente"
  | "piu"
  | "spunta"
  | "esci"
  | "menu"
  | "micro"
  | "campanella"
  | "attivita"
  | "esporta"
  | "impostazioni"
  | "supporto"
  | "su"
  | "giu"
  | "occhio"
  | "occhioNo"
  | "sole"
  | "luna"
  | "barcode"
  | "stampa";

const TRATTI: Record<IconaNome, ReactNode> = {
  cruscotto: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="4" rx="1" />
      <rect x="14" y="10" width="7" height="7" rx="1" />
      <rect x="3" y="13" width="7" height="4" rx="1" />
    </>
  ),
  traffico: (
    <>
      <path d="M4 7h9v8H4z" />
      <path d="M13 10h4l3 3v2h-7z" />
      <circle cx="7" cy="17" r="1.6" />
      <circle cx="17" cy="17" r="1.6" />
    </>
  ),
  magazzino: (
    <>
      <path d="M3 9l9-5 9 5v10H3z" />
      <path d="M8 19v-5h8v5" />
    </>
  ),
  autisti: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="2.2" />
      <path d="M12 4v3M12 17v3M4 12h3M17 12h3" />
    </>
  ),
  ammin: (
    <>
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M14 3v4h4M9 12h7M9 16h7" />
    </>
  ),
  clienti: (
    <>
      <circle cx="8" cy="9" r="3" />
      <path d="M3 19c0-3 2.5-5 5-5s5 2 5 5" />
      <path d="M15 7a3 3 0 0 1 0 6M21 19c0-2.5-1.5-4.2-3.5-4.7" />
    </>
  ),
  persone: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8" cy="11" r="2.2" />
      <path d="M4.5 17c.5-2 2-3 3.5-3s3 1 3.5 3M14 10h4M14 14h4" />
    </>
  ),
  documenti: (
    <>
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M14 3v4h4M10 12h6M10 16h6" />
    </>
  ),
  mezzi: (
    <>
      <path d="M2 7h11v9H2z" />
      <path d="M13 10h4l3 3v3h-7z" />
      <circle cx="6" cy="18" r="1.6" />
      <circle cx="17" cy="18" r="1.6" />
    </>
  ),
  carico: (
    <>
      <path d="M12 3v9m0 0l-3.5-3.5M12 12l3.5-3.5" />
      <path d="M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" />
    </>
  ),
  scarico: (
    <>
      <path d="M12 12V3m0 0L8.5 6.5M12 3l3.5 3.5" />
      <path d="M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" />
    </>
  ),
  differenza: (
    <>
      <path d="M12 4l9 15H3z" />
      <path d="M12 10v4M12 16.5v.2" />
    </>
  ),
  problema: (
    <>
      <path d="M14 6a3.5 3.5 0 0 0-4.8 4.5L4 15.7 6.3 18l5.2-5.2A3.5 3.5 0 0 0 16 8l-2 2-2-2z" />
    </>
  ),
  ritiro: (
    <>
      <rect x="6" y="4" width="12" height="16" rx="1.5" />
      <path d="M9 4V3h6v1M9 10h6M9 14h4" />
    </>
  ),
  reclamo: (
    <>
      <path d="M4 9v4l9 4V5z" />
      <path d="M4 9H3v4h1M16 8a4 4 0 0 1 0 6" />
    </>
  ),
  cerca: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="M20 20l-4.5-4.5" />
    </>
  ),
  agente: (
    <>
      <path d="M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8z" />
      <path d="M18 15l.9 2.1L21 18l-2.1.9L18 21l-.9-2.1L15 18l2.1-.9z" />
    </>
  ),
  piu: <path d="M12 5v14M5 12h14" />,
  spunta: <path d="M5 12l4.5 4.5L19 7" />,
  esci: (
    <>
      <path d="M14 4H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h8" />
      <path d="M14 12H9M14 12l-3-3M14 12l-3 3" />
    </>
  ),
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  micro: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M6 11a6 6 0 0 0 12 0M12 17v3" />
    </>
  ),
  campanella: (
    <>
      <path d="M6 16v-6a6 6 0 0 1 12 0v6l1.5 2.5H4.5z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </>
  ),
  attivita: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  esporta: (
    <>
      <path d="M12 3v10m0 0l-3.5-3.5M12 13l3.5-3.5" />
      <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
    </>
  ),
  impostazioni: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1" />
    </>
  ),
  supporto: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1.8-1.1 1.8M12 17v.2" />
    </>
  ),
  su: <path d="M12 19V5M6 11l6-6 6 6" />,
  giu: <path d="M12 5v14M6 13l6 6 6-6" />,
  occhio: (
    <>
      <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  occhioNo: (
    <>
      <path d="M4 4l16 16M9.5 9.5a2.5 2.5 0 0 0 3 3M6.5 6.7C3.9 8.2 2 12 2 12s3.5 6.5 10 6.5c1.6 0 3-.4 4.2-1M12 5.5c6 0 10 6.5 10 6.5s-.8 1.5-2.3 3" />
    </>
  ),
  sole: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
    </>
  ),
  luna: <path d="M20 14.5A8 8 0 0 1 9.5 4a7 7 0 1 0 10.5 10.5z" />,
  barcode: (
    <>
      <path d="M4 6v12M7 6v12M10 6v12M13.5 6v12M17 6v12M20 6v12" />
    </>
  ),
  stampa: (
    <>
      <path d="M6 9V3h12v6" />
      <path d="M6 18H4a1 1 0 0 1-1-1v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a1 1 0 0 1-1 1h-2" />
      <path d="M7 15h10v6H7z" />
    </>
  ),
};

export function Icona({
  nome,
  size = 18,
  className,
}: {
  nome: IconaNome;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {TRATTI[nome]}
    </svg>
  );
}

export type { IconaNome };

// ─────────────────────────────────────────────────────────────────────────
// LA BARRA STRUMENTI — la fila di tool in cima a ogni sezione
// ─────────────────────────────────────────────────────────────────────────

export interface Strumento {
  id: string;
  nome: string;
  icona: IconaNome;
  /** Un pallino sull'icona: qualcosa aspetta qui (es. controlli aperti). */
  badge?: number;
}

/**
 * La riga di strumenti sotto il titolo di una sezione — come la barra di icone
 * di Assistant (`+ ↻ ▤ ✎`). Ogni reparto ha i suoi.
 */
export function BarraStrumenti({
  strumenti,
  attivo,
  onScegli,
}: {
  strumenti: Strumento[];
  attivo: string;
  onScegli: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-0.5 overflow-x-auto border-b border-[var(--border)] px-2">
      {strumenti.map((s) => {
        const on = s.id === attivo;
        return (
          <button
            key={s.id}
            onClick={() => onScegli(s.id)}
            className={`relative flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-[12.5px] font-medium transition-colors ${
              on
                ? "border-[var(--accent)] text-[var(--text-primary)]"
                : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            <Icona nome={s.icona} size={16} />
            <span className="whitespace-nowrap">{s.nome}</span>
            {s.badge ? (
              <span
                className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-[var(--on-primary)]"
                style={{ background: "var(--accent)" }}
              >
                {s.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// LA TABELLA — righe fitte, righello sottile, intestazione minuscola
// ─────────────────────────────────────────────────────────────────────────

export function Tabella({
  colonne,
  children,
}: {
  colonne: { nome: string; larghezza?: string; destra?: boolean }[];
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-md border border-[var(--border)] bg-[var(--bg-card)]">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-[var(--border)]">
            {colonne.map((c, i) => (
              <th
                key={i}
                className={`px-3 py-2 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[var(--text-secondary)] ${
                  c.destra ? "text-right" : "text-left"
                }`}
                style={c.larghezza ? { width: c.larghezza } : undefined}
              >
                {c.nome}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Riga({ children }: { children: ReactNode }) {
  return (
    <tr className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--fill-quiet)]">
      {children}
    </tr>
  );
}

export function Cella({
  children,
  destra,
  tenue,
  className,
}: {
  children: ReactNode;
  destra?: boolean;
  tenue?: boolean;
  className?: string;
}) {
  return (
    <td
      className={`px-3 py-2 align-middle ${destra ? "text-right" : "text-left"} ${
        tenue ? "text-[var(--text-secondary)]" : ""
      } ${className ?? ""}`}
    >
      {children}
    </td>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// I NUMERI IN CIMA — striscia compatta, non schede grandi
// ─────────────────────────────────────────────────────────────────────────

/**
 * La striscia di numeri di una sezione: fitta, incolonnata, con il righello
 * fra un dato e l'altro. È il contrario delle schede grandi — qui i numeri
 * stanno vicini così l'occhio li confronta.
 */
export function Striscia({
  dati,
}: {
  dati: { valore: string; etichetta: string; forte?: boolean }[];
}) {
  return (
    <div className="flex flex-wrap divide-x divide-[var(--border)] rounded-md border border-[var(--border)] bg-[var(--bg-card)]">
      {dati.map((d, i) => (
        <div key={i} className="min-w-[130px] flex-1 px-4 py-3">
          <p
            className={`tabular-nums leading-none tracking-[-0.02em] ${
              d.forte ? "text-[24px] font-semibold" : "text-[22px] font-medium"
            }`}
          >
            {d.valore}
          </p>
          <p className="mt-1.5 text-[11.5px] text-[var(--text-secondary)]">{d.etichetta}</p>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// LO SPAZIO VUOTO — sobrio, senza emoji
// ─────────────────────────────────────────────────────────────────────────

export function Niente({ titolo, testo }: { titolo: string; testo: string }) {
  return (
    <div className="rounded-md border border-dashed border-[var(--border)] px-6 py-8 text-center">
      <p className="text-[13.5px] font-medium">{titolo}</p>
      <p className="mx-auto mt-1.5 max-w-[52ch] text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
        {testo}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// UN BOTTONE-STRUMENTO GROSSO — solo dove serve (guanti, guida)
// ─────────────────────────────────────────────────────────────────────────

/**
 * ⚠️ Anche nella console professionale certi tasti restano grossi: il
 * magazziniere coi guanti e l'autista alla guida non premono una voce di
 * tabella. Ma sobri — icona di tratto e testo, non emoji colorato.
 */
export function Tasto({
  icona,
  nome,
  sotto,
  attivo,
  onClick,
}: {
  icona: IconaNome;
  nome: string;
  sotto?: string;
  attivo?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      // ⚠️ `data-tasto` è l'aggancio del minimal «tasti grossi solo su
      // telefono»: il CSS in index.css su desktop abbassa questi tasti a righe
      // sobrie. Senza il marcatore, quell'impostazione non avrebbe presa.
      data-tasto
      className={`flex min-h-[76px] cursor-pointer flex-col items-start justify-center gap-1 rounded-md border px-4 py-3 text-left transition-colors ${
        attivo
          ? "border-[var(--accent)] bg-[var(--accent-soft)]"
          : "border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--accent)]"
      }`}
    >
      <Icona nome={icona} size={22} className="text-[var(--text-primary)]" />
      <span className="mt-1 text-[14px] font-semibold leading-tight">{nome}</span>
      {sotto && (
        <span data-tasto-sotto className="text-[11.5px] text-[var(--text-secondary)]">
          {sotto}
        </span>
      )}
    </button>
  );
}

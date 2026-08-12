import { useId, useState } from "react";

/**
 * I grafici del cruscotto — scritti a mano, nessuna libreria.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LE REGOLE CHE VALGONO PER TUTTI, E PERCHÉ
 * ─────────────────────────────────────────────────────────────────────────
 * 1. **Un asse solo.** Mai due scale verticali nello stesso grafico: allinearle
 *    è una scelta arbitraria, e il grafico finisce per inventare un legame che
 *    nei dati non c'è. Due misure diverse = due grafici.
 * 2. **Segni sottili, griglia che sparisce.** Le linee della griglia sono
 *    continue e di un tono appena diverso dal fondo. Tratteggiate no: il
 *    tratteggio significa «previsione» o «soglia», e qui è solo una griglia.
 * 3. **Un colore per serie, sempre lo stesso.** Il verde è «l'agente ha
 *    risposto», il grigio è «è passata a una persona». Non cambiano mai posto,
 *    nemmeno quando una delle due è a zero.
 * 4. **Niente numero su ogni punto.** Un valore accanto a ogni barra è caos e
 *    non lo legge nessuno: c'è l'asse, e c'è il passaggio del mouse.
 *
 * ⚠️ Il verde è `#008E33`, letto dai pixel del logo di Speed Trasporti. È stato
 * verificato: sta dentro la banda di luminosità, ha contrasto sufficiente sul
 * fondo chiaro, e resta distinguibile dal grigio anche per chi non vede i
 * colori — che è il motivo per cui la seconda serie è grigia e non oro. L'oro
 * del marchio su bianco ha un contrasto di 1,55:1: come dato sarebbe invisibile.
 * Resta dov'è utile — un filo, un accento — non dove porta un numero.
 */

const VERDE = "#008E33";

// ─────────────────────────────────────────────────────────────────────────
// LA CORNICE
// ─────────────────────────────────────────────────────────────────────────

export function Cornice({
  titolo,
  sotto,
  destra,
  children,
}: {
  titolo: string;
  sotto?: string;
  destra?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <h3 className="text-[13.5px] font-medium tracking-[-0.01em]">{titolo}</h3>
          {sotto && (
            <p className="mt-0.5 text-[12px] text-[var(--text-secondary)]">{sotto}</p>
          )}
        </div>
        {destra}
      </div>
      {children}
    </div>
  );
}

/** Il quadratino di colore accanto a un nome di serie. */
export function Voce({ colore, nome }: { colore: string; nome: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[11.5px] text-[var(--text-secondary)]">
      <span aria-hidden className="h-2 w-2 rounded-[2px]" style={{ background: colore }} />
      {nome}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// LE BARRE
// ─────────────────────────────────────────────────────────────────────────

/**
 * Un grafico a barre verticali.
 *
 * ⚠️ Le barre sono `<div>` e non SVG di proposito: si allargano da sole con la
 * finestra e l'angolo arrotondato in cima resta nitido a qualsiasi larghezza.
 * Un SVG che scala deforma i raggi, e su un telefono si vede.
 */
export function Barre({
  dati,
  altezza = 168,
  unita = "",
}: {
  dati: { etichetta: string; sotto?: string; valore: number }[];
  altezza?: number;
  unita?: string;
}) {
  const [sopra, setSopra] = useState<number | null>(null);
  const massimo = Math.max(1, ...dati.map((d) => d.valore));
  // Una scala che finisce esattamente sul valore più alto fa toccare il bordo
  // alla barra più alta: si arrotonda in su, sempre.
  const cima = arrotondaInSu(massimo);
  const tacche = [cima, cima / 2, 0];

  return (
    <div className="relative">
      <div className="flex">
        {/* ── L'asse, l'unico ────────────────────────────────────────── */}
        <div
          className="flex w-8 shrink-0 flex-col justify-between pr-1.5 text-right text-[10.5px] tabular-nums text-[var(--text-secondary)]"
          style={{ height: altezza }}
        >
          {tacche.map((t) => (
            <span key={t} className="leading-none">
              {corto(t)}
            </span>
          ))}
        </div>

        <div className="relative min-w-0 flex-1" style={{ height: altezza }}>
          {/* Griglia continua, un tono più chiara del bordo: c'è quando la
              cerchi e sparisce quando guardi i dati. */}
          {tacche.map((t) => (
            <span
              key={t}
              aria-hidden
              className="absolute inset-x-0 border-t border-[var(--border)]"
              style={{ bottom: `${(t / cima) * 100}%`, opacity: t === 0 ? 1 : 0.55 }}
            />
          ))}

          <div className="absolute inset-0 flex items-end gap-[2px]">
            {dati.map((d, i) => (
              <button
                key={i}
                onMouseEnter={() => setSopra(i)}
                onMouseLeave={() => setSopra(null)}
                onFocus={() => setSopra(i)}
                onBlur={() => setSopra(null)}
                // ⚠️ Il bersaglio del mouse è tutta la colonna, non la barra:
                // una barra da 2 pixel a mezzogiorno non si prende col dito.
                className="group relative flex h-full min-w-0 flex-1 cursor-default items-end"
                aria-label={`${d.etichetta}: ${d.valore}${unita ? " " + unita : ""}`}
              >
                <span
                  aria-hidden
                  className="absolute inset-0 rounded-[3px] opacity-0 transition-opacity group-hover:opacity-100"
                  style={{ background: "var(--fill-quiet)" }}
                />
                <span
                  aria-hidden
                  className="relative w-full rounded-t-[4px] transition-[height]"
                  style={{
                    height: `${Math.max(d.valore > 0 ? 2 : 0, (d.valore / cima) * 100)}%`,
                    background: VERDE,
                    opacity: sopra === null || sopra === i ? 1 : 0.45,
                  }}
                />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Le etichette sotto ─────────────────────────────────────────── */}
      <div className="mt-1.5 flex pl-8">
        {dati.map((d, i) => (
          <span
            key={i}
            className="min-w-0 flex-1 text-center text-[10px] leading-tight text-[var(--text-secondary)]"
          >
            {/* Su 24 ore non ci stanno 24 numeri: se ne scrive uno ogni tre. */}
            {dati.length > 12 ? (i % 3 === 0 ? d.etichetta : "") : d.etichetta}
          </span>
        ))}
      </div>

      {sopra !== null && (
        <p className="mt-2 text-[12px] text-[var(--text-secondary)]">
          <span className="font-medium text-[var(--text-primary)]">
            {dati[sopra].valore}
            {unita ? ` ${unita}` : ""}
          </span>{" "}
          · {dati[sopra].sotto ?? dati[sopra].etichetta}
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// LA LINEA
// ─────────────────────────────────────────────────────────────────────────

/**
 * L'andamento nel tempo, una o due serie.
 *
 * ⚠️ Se le serie sono due, la legenda c'è sempre. Non è una gentilezza: senza,
 * l'identità di una serie starebbe solo nel colore, e chi non distingue verde e
 * grigio non ha nessun altro modo di sapere quale linea sta guardando.
 */
export function Linea({
  punti,
  serie,
  altezza = 180,
}: {
  punti: { etichetta: string; sotto?: string; valori: number[] }[];
  serie: { nome: string; colore: string }[];
  altezza?: number;
}) {
  const [sopra, setSopra] = useState<number | null>(null);
  const id = useId();
  const L = 720;
  const A = 200;
  const bordo = { s: 34, d: 8, a: 12, b: 26 };

  const massimo = Math.max(1, ...punti.flatMap((p) => p.valori));
  const cima = arrotondaInSu(massimo);
  const larghezza = L - bordo.s - bordo.d;
  const altezzaUtile = A - bordo.a - bordo.b;

  const x = (i: number) =>
    bordo.s + (punti.length === 1 ? larghezza / 2 : (i / (punti.length - 1)) * larghezza);
  const y = (v: number) => bordo.a + altezzaUtile - (v / cima) * altezzaUtile;

  const tacche = [cima, cima / 2, 0];

  return (
    <div>
      <svg
        viewBox={`0 0 ${L} ${A}`}
        className="w-full"
        style={{ height: altezza }}
        role="img"
        aria-label={serie.map((s) => s.nome).join(" e ")}
      >
        {/* Griglia e asse: continui, sottili, un tono sopra il fondo. */}
        {tacche.map((t) => (
          <g key={t}>
            <line
              x1={bordo.s}
              x2={L - bordo.d}
              y1={y(t)}
              y2={y(t)}
              stroke="var(--border)"
              strokeWidth={1}
              opacity={t === 0 ? 1 : 0.55}
            />
            <text
              x={bordo.s - 6}
              y={y(t) + 3.5}
              textAnchor="end"
              className="fill-[var(--text-secondary)]"
              style={{ fontSize: 10.5 }}
            >
              {corto(t)}
            </text>
          </g>
        ))}

        {serie.map((s, iS) => {
          const d = punti
            .map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.valori[iS] ?? 0)}`)
            .join(" ");
          return (
            <g key={s.nome}>
              <path d={d} fill="none" stroke={s.colore} strokeWidth={2} strokeLinecap="round" />
              {punti.map((p, i) => (
                <circle
                  key={i}
                  cx={x(i)}
                  cy={y(p.valori[iS] ?? 0)}
                  r={sopra === i ? 5.5 : 4}
                  fill={s.colore}
                  // ⚠️ L'anello è del colore della superficie, non un bordo
                  // scuro: due punti che si toccano si separano senza che
                  // compaia una terza linea che non significa niente.
                  stroke="var(--bg-card)"
                  strokeWidth={2}
                />
              ))}
            </g>
          );
        })}

        {/* Le zone sensibili al mouse: invisibili, larghe quanto serve. */}
        {punti.map((_, i) => (
          <rect
            key={`${id}-${i}`}
            x={x(i) - larghezza / (punti.length * 2)}
            y={0}
            width={larghezza / punti.length}
            height={A}
            fill="transparent"
            onMouseEnter={() => setSopra(i)}
            onMouseLeave={() => setSopra(null)}
          />
        ))}

        {punti.map((p, i) => (
          <text
            key={`e-${i}`}
            x={x(i)}
            y={A - 8}
            textAnchor="middle"
            className="fill-[var(--text-secondary)]"
            style={{ fontSize: 10.5, fontWeight: sopra === i ? 600 : 400 }}
          >
            {p.etichetta}
          </text>
        ))}
      </svg>

      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
        {serie.length > 1 && serie.map((s) => <Voce key={s.nome} colore={s.colore} nome={s.nome} />)}
        {sopra !== null && (
          <span className="text-[12px] text-[var(--text-secondary)]">
            {punti[sopra].sotto ?? punti[sopra].etichetta}:{" "}
            {serie
              .map((s, i) => `${punti[sopra].valori[i] ?? 0} ${s.nome.toLowerCase()}`)
              .join(" · ")}
          </span>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// LE BARRE ORIZZONTALI
// ─────────────────────────────────────────────────────────────────────────

/** Poche voci con un nome lungo: si sdraiano, e il nome si legge per intero. */
export function Sdraiate({ dati }: { dati: { nome: string; valore: number }[] }) {
  const cima = Math.max(1, ...dati.map((d) => d.valore));
  return (
    <div className="space-y-2.5">
      {dati.map((d) => (
        <div key={d.nome} className="flex items-center gap-3">
          <span className="w-[92px] shrink-0 truncate text-[12.5px] text-[var(--text-secondary)]">
            {d.nome}
          </span>
          <span className="h-3 min-w-0 flex-1 overflow-hidden rounded-[3px] bg-[var(--fill-quiet)]">
            <span
              aria-hidden
              className="block h-full rounded-[3px]"
              style={{ width: `${Math.max(2, (d.valore / cima) * 100)}%`, background: VERDE }}
            />
          </span>
          {/* Qui il numero diretto ci sta: sono quattro righe, non ventiquattro. */}
          <span className="w-7 shrink-0 text-right text-[12.5px] tabular-nums">{d.valore}</span>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// LA CORNICE VUOTA
// ─────────────────────────────────────────────────────────────────────────

/**
 * Un grafico che esiste ma non ha ancora i dati.
 *
 * ⚠️ Si disegnano gli assi e la griglia e **non si disegna nessuna barra**.
 * Non è decorazione: fa vedere che quel posto è pronto e aspetta un
 * collegamento, invece di mostrare uno zero. Uno zero è una bugia involontaria
 * — fa credere che il dato sia stato letto e valga zero.
 */
export function Attesa({ da, altezza = 168 }: { da: string; altezza?: number }) {
  return (
    <div className="relative" style={{ height: altezza }}>
      <div className="absolute inset-0 flex">
        <div className="w-8 shrink-0" />
        <div className="relative flex-1">
          {[100, 50, 0].map((t) => (
            <span
              key={t}
              aria-hidden
              className="absolute inset-x-0 border-t border-[var(--border)]"
              style={{ bottom: `${t}%`, opacity: t === 0 ? 1 : 0.55 }}
            />
          ))}
        </div>
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
        <p className="text-[12.5px] font-medium">In attesa del collegamento</p>
        <p className="mt-1 max-w-[34ch] text-[11.5px] leading-relaxed text-[var(--text-secondary)]">
          Questo numero vive dentro {da}. Si riempie nel momento esatto in cui
          colleghiamo il vostro programma, e non prima.
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────

/** 7 → 10, 43 → 50, 380 → 400. Perché la barra più alta non tocchi il bordo. */
function arrotondaInSu(n: number): number {
  if (n <= 4) return 4;
  const scala = Math.pow(10, Math.floor(Math.log10(n)));
  return Math.ceil(n / (scala / 2)) * (scala / 2);
}

function corto(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return String(Math.round(n));
}

import { useEffect, useRef, useState } from "react";
import { suonoClick, suonoSfiora } from "../../lib/suoni";

/**
 * I tre movimenti della vetrina, scelti da Tommaso l'11 Agosto 2026.
 *
 * ⚠️ Ognuno di questi tre si spegne da solo se chi guarda ha chiesto meno
 * movimento (`prefers-reduced-motion`). Non è una gentilezza: per chi soffre di
 * chinetosi o vertigini un elemento che insegue il puntatore non è un effetto,
 * è un malessere fisico. E il contenuto resta esattamente lo stesso — sparisce
 * lo spettacolo, non l'informazione.
 */

function calmo(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// ─────────────────────────────────────────────────────────────────────────
// 1. COMPARE QUANDO LO RAGGIUNGI
// ─────────────────────────────────────────────────────────────────────────

/**
 * ⚠️ Sostituisce le comparse a tempo, ed era un difetto vero: partendo dal
 * caricamento, chi scorreva veloce — o chi apriva da telefono, dove metà pagina
 * sta sotto la piega — trovava le sezioni **già comparse**, senza aver visto
 * niente. L'animazione c'era e non la vedeva nessuno.
 */
export function Compare({
  children,
  ritardo = 0,
  className,
}: {
  children: React.ReactNode;
  ritardo?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [dentro, setDentro] = useState(false);

  useEffect(() => {
    if (calmo()) return setDentro(true);
    const el = ref.current;
    if (!el) return;

    const oss = new IntersectionObserver(
      ([voce]) => {
        // Una volta sola: un blocco che scompare risalendo e ricompare
        // riscendendo è nauseante dopo il secondo giro.
        if (voce.isIntersecting) {
          window.setTimeout(() => setDentro(true), ritardo);
          oss.disconnect();
        }
      },
      // `-12%` dal basso: parte **prima** che il blocco tocchi il bordo, così
      // quando arriva sotto gli occhi il movimento è già cominciato.
      { threshold: 0.12, rootMargin: "0px 0px -12% 0px" }
    );
    oss.observe(el);
    return () => oss.disconnect();
  }, [ritardo]);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: dentro ? 1 : 0,
        transform: dentro ? "none" : "translateY(14px)",
        transition: "opacity 560ms cubic-bezier(.16,1,.3,1), transform 560ms cubic-bezier(.16,1,.3,1)",
      }}
    >
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 2. I NUMERI CHE SALGONO DA ZERO
// ─────────────────────────────────────────────────────────────────────────

/**
 * ⚠️ I numeri che mostriamo devono essere **veri e verificabili**, e su una
 * vetrina è una regola di sostanza, non di stile: gonfiare una cifra su una
 * pagina che vende è la cosa che poi tocca disinnescare al primo scambio di
 * email. Quelli usati qui sono misurati (il tempo di risposta) o sono fatti
 * (le ore, i canali).
 */
export function Numero({
  fino,
  suffisso = "",
  etichetta,
}: {
  fino: number;
  suffisso?: string;
  etichetta: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [n, setN] = useState(0);

  useEffect(() => {
    if (calmo()) return setN(fino);
    const el = ref.current;
    if (!el) return;

    const oss = new IntersectionObserver(
      ([voce]) => {
        if (!voce.isIntersecting) return;
        oss.disconnect();
        const inizio = performance.now();
        const durata = 1100;
        const passo = (ora: number) => {
          const t = Math.min((ora - inizio) / durata, 1);
          // Rallenta verso la fine: un conteggio lineare sembra un contatore
          // rotto, questo sembra qualcosa che si ferma.
          setN(fino * (1 - Math.pow(1 - t, 3)));
          if (t < 1) requestAnimationFrame(passo);
        };
        requestAnimationFrame(passo);
      },
      { threshold: 0.5 }
    );
    oss.observe(el);
    return () => oss.disconnect();
  }, [fino]);

  // Una cifra decimale solo se il traguardo ne ha una: «1.5 secondi» sì,
  // «24.0 ore» no.
  const mostrato = Number.isInteger(fino) ? Math.round(n) : n.toFixed(1);

  return (
    <div ref={ref}>
      <div className="text-[26px] font-semibold tracking-[-0.02em] tabular-nums text-white sm:text-[30px]">
        {mostrato}
        <span className="text-white/50">{suffisso}</span>
      </div>
      <div className="mt-0.5 text-[12.5px] text-white/55">{etichetta}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 3. IL PULSANTE MAGNETICO CON L'ONDA
// ─────────────────────────────────────────────────────────────────────────

interface OndaViva {
  id: number;
  x: number;
  y: number;
}

/**
 * Si sposta verso il puntatore, e al clic emette un'onda dal punto premuto.
 *
 * ⚠️ Il magnetismo vale solo dove c'è un puntatore fine: **un dito non ha un
 * puntatore da inseguire**, e su telefono resta solo l'onda — che parte
 * comunque dal punto toccato, quindi l'effetto non si perde, si semplifica.
 *
 * ⚠️ Lo spostamento massimo è 5px. Sopra, il pulsante «scappa» e chi ha una
 * mano meno ferma lo manca: un effetto che rende più difficile premere il
 * pulsante più importante della pagina è un danno travestito da cura.
 */
export function PulsanteMagnetico({
  children,
  onClick,
  disabled,
  className = "",
  style,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [spostamento, setSpostamento] = useState({ x: 0, y: 0 });
  const [onde, setOnde] = useState<OndaViva[]>([]);
  const prossima = useRef(0);

  function insegui(e: React.MouseEvent) {
    if (disabled || calmo()) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    setSpostamento({
      x: ((e.clientX - (r.left + r.width / 2)) / r.width) * 10,
      y: ((e.clientY - (r.top + r.height / 2)) / r.height) * 10,
    });
  }

  function premi(e: React.MouseEvent) {
    if (disabled) return;
    const r = ref.current?.getBoundingClientRect();
    if (r && !calmo()) {
      const id = prossima.current++;
      setOnde((o) => [...o, { id, x: e.clientX - r.left, y: e.clientY - r.top }]);
      // 620ms = la durata dell'animazione. Se non si togliessero, dopo venti
      // clic ci sarebbero venti elementi invisibili ancora nel documento.
      window.setTimeout(() => setOnde((o) => o.filter((x) => x.id !== id)), 620);
    }
    suonoClick();
    onClick();
  }

  return (
    <button
      ref={ref}
      onMouseMove={insegui}
      onMouseEnter={() => !disabled && suonoSfiora()}
      onMouseLeave={() => setSpostamento({ x: 0, y: 0 })}
      onClick={premi}
      disabled={disabled}
      className={`relative overflow-hidden ${className}`}
      style={{
        ...style,
        transform: `translate(${spostamento.x}px, ${spostamento.y}px)`,
        transition: "transform 220ms cubic-bezier(.16,1,.3,1), filter 200ms, opacity 200ms",
      }}
    >
      {onde.map((o) => (
        <span
          key={o.id}
          aria-hidden
          className="pointer-events-none absolute rounded-full"
          style={{
            left: o.x,
            top: o.y,
            width: 12,
            height: 12,
            marginLeft: -6,
            marginTop: -6,
            background: "rgba(255,255,255,0.65)",
            animation: "onda 620ms cubic-bezier(.16,1,.3,1) forwards",
          }}
        />
      ))}
      <span className="relative">{children}</span>
    </button>
  );
}

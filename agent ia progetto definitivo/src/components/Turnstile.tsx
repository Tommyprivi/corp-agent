import { useEffect, useRef, useState } from "react";
import { ShieldIcon } from "./Icons";

/**
 * La verifica anti-bot di Cloudflare Turnstile — riga 10 della Fase 1.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * PERCHÉ TURNSTILE E NON IL CAPTCHA DI GOOGLE
 * ─────────────────────────────────────────────────────────────────────────
 * È gratuito e senza limiti, e nella maggior parte dei casi **l'utente non
 * deve cliccare niente**: guarda come si comporta il browser e decide da sé.
 * Un ristoratore che deve indovinare quali riquadri contengono un semaforo è
 * un ristoratore che chiude la pagina.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * SENZA CHIAVE SI PASSA COMUNQUE, E LO SI DICE
 * ─────────────────────────────────────────────────────────────────────────
 * `VITE_TURNSTILE_SITE_KEY` può non esserci: in sviluppo, o finché la chiave
 * non è stata presa. In quel caso compare un riquadro che dichiara di essere
 * un segnaposto e lascia passare.
 *
 * L'alternativa — bloccare l'ingresso — vorrebbe dire un prodotto che non si
 * può provare senza aver prima configurato un servizio esterno. E far credere
 * che ci sia una protezione quando non c'è è la bugia che questo progetto
 * evita per principio.
 *
 * ⚠️ La SITE KEY è pubblica per progetto, ed è per questo che porta il prefisso
 * `VITE_`: arriva al browser di proposito. La SECRET non deve mai averlo —
 * quella vive solo sul server, in `api/profile.ts`.
 */

/** Quello che lo script di Cloudflare attacca alla finestra. */
interface TurnstileApi {
  render: (
    element: HTMLElement,
    options: {
      sitekey: string;
      theme?: "light" | "dark" | "auto";
      language?: string;
      callback: (token: string) => void;
      "error-callback"?: () => void;
      "expired-callback"?: () => void;
    }
  ) => string;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/**
 * Carica lo script di Cloudflare una volta sola.
 *
 * Se due componenti lo chiedessero insieme partirebbero due `<script>` e il
 * secondo sovrascriverebbe `window.turnstile` a metà del lavoro del primo. La
 * promessa in cache fa sì che tutti aspettino lo stesso caricamento.
 */
let loading: Promise<void> | null = null;
function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (loading) return loading;

  loading = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loading = null;
      reject(new Error("Non riesco a caricare la verifica di Cloudflare."));
    };
    document.head.appendChild(script);
  });
  return loading;
}

interface TurnstileProps {
  /** Chiamata col gettone quando la verifica è passata. */
  onVerified: (token: string) => void;
  /** Vero mentre il server sta controllando il gettone. */
  busy?: boolean;
  theme?: "light" | "dark";
}

export default function Turnstile({ onVerified, busy, theme }: TurnstileProps) {
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
  const holder = useRef<HTMLDivElement>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!siteKey || !holder.current) return;

    let widgetId: string | undefined;
    let alive = true;
    const element = holder.current;

    void loadScript()
      .then(() => {
        if (!alive || !window.turnstile) return;
        setProblem(null);
        widgetId = window.turnstile.render(element, {
          sitekey: siteKey,
          theme: theme ?? "auto",
          language: "it",
          callback: (token) => {
            setExpired(false);
            onVerified(token);
          },
          "error-callback": () =>
            setProblem("La verifica non è riuscita. Ricarica la pagina e riprova."),
          // I gettoni scadono dopo cinque minuti: se uno resta fermo sulla
          // pagina, va detto invece di lasciarlo premere a vuoto.
          "expired-callback": () => setExpired(true),
        });
      })
      .catch((error: Error) => {
        if (alive) setProblem(error.message);
      });

    return () => {
      alive = false;
      // Smontare il widget serve: senza, tornando su questo passo Cloudflare
      // ne disegna un secondo sotto il primo.
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
    // `onVerified` cambia a ogni render del genitore: metterlo tra le
    // dipendenze farebbe ridisegnare il widget in continuazione.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey, theme]);

  // ── Senza chiave: segnaposto dichiarato ────────────────────────────────
  if (!siteKey) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
        <div className="flex items-center gap-3">
          <span className="text-[var(--text-secondary)]">
            <ShieldIcon size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-medium text-[var(--text-primary)]">
              Verifica non configurata
            </div>
            <div className="text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
              Manca <code>VITE_TURNSTILE_SITE_KEY</code>. Si entra comunque: la protezione
              anti-bot si accende quando la chiave c'è.
            </div>
          </div>
        </div>
        <button
          onClick={() => onVerified("")}
          disabled={busy}
          className="btn-grad mt-4 w-full rounded-xl py-3 text-[14.5px] font-medium disabled:opacity-50"
        >
          {busy ? "Un istante…" : "Continua"}
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Cloudflare disegna qui dentro. Altezza minima riservata: senza, la
          pagina sobbalza quando il widget compare. */}
      <div ref={holder} className="flex min-h-[68px] items-center justify-center" />

      {expired && (
        <p className="mt-2 text-center text-[12.5px] text-[var(--text-secondary)]">
          La verifica è scaduta. Rifalla qui sopra.
        </p>
      )}
      {problem && (
        <p className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3 text-[13px] leading-relaxed text-[var(--text-secondary)]">
          {problem}
        </p>
      )}
      {busy && (
        <p className="mt-2 flex items-center justify-center gap-2 text-[12.5px] text-[var(--text-secondary)]">
          <span className="animate-breathe inline-block h-[6px] w-[6px] rounded-full bg-[var(--accent)]" />
          Sto controllando…
        </p>
      )}
    </div>
  );
}

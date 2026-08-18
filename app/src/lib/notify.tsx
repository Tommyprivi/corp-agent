import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { CheckIcon, CloseIcon, ShieldIcon } from "../components/Icons";

/**
 * Le notifiche — un avviso che compare in alto a destra e se ne va da solo.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * PERCHÉ SERVIVANO
 * ─────────────────────────────────────────────────────────────────────────
 * Fino al 2 Agosto 2026 gli errori comparivano **come messaggi dell'agente**:
 *
 *   ◯ OPENAI_API_KEY non configurata: senza quella non posso leggere…
 *
 * Con l'avatar, nella bolla, in mezzo alla conversazione. Sembrava che l'IA
 * parlasse di sé stessa e delle proprie variabili d'ambiente — che per un
 * ristoratore non vuol dire niente, e per chiunque è confondente.
 *
 * Un errore non è una cosa che l'agente dice: è una cosa che il **prodotto**
 * dice. Vanno in due posti diversi.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * PERCHÉ UN CONTESTO E NON UNO STATO PER COMPONENTE
 * ─────────────────────────────────────────────────────────────────────────
 * Le notifiche arrivano da posti lontanissimi tra loro — la chat, il catalogo,
 * la memoria, l'ingresso — e devono comparire tutte nello stesso angolo. Farlo
 * con lo stato locale vorrebbe dire passare una funzione attraverso sei livelli
 * di componenti, e ognuno disegnerebbe il suo angolo.
 */

export type NoticeKind = "error" | "success" | "info";

interface Notice {
  id: number;
  kind: NoticeKind;
  text: string;
  /** Il dettaglio tecnico: si apre solo se uno lo chiede. */
  detail?: string;
}

interface NotifyApi {
  error: (text: string, detail?: string) => void;
  success: (text: string) => void;
  info: (text: string) => void;
}

const NotifyContext = createContext<NotifyApi | null>(null);

/**
 * Quanto resta a schermo.
 *
 * Gli errori durano il doppio: chi ha appena visto qualcosa andare storto ha
 * bisogno di tempo per leggere, mentre "fatto" si capisce in un istante.
 */
const LIFETIME: Record<NoticeKind, number> = {
  error: 8000,
  success: 3500,
  info: 5000,
};

let sequence = 0;

export function NotifyProvider({ children }: { children: React.ReactNode }) {
  const [notices, setNotices] = useState<Notice[]>([]);

  const push = useCallback((kind: NoticeKind, text: string, detail?: string) => {
    const id = ++sequence;
    // Tre alla volta al massimo: una colonna di avvisi che copre lo schermo è
    // peggio del problema che segnala.
    setNotices((prev) => [...prev.slice(-2), { id, kind, text, detail }]);
    window.setTimeout(() => {
      setNotices((prev) => prev.filter((n) => n.id !== id));
    }, LIFETIME[kind]);
  }, []);

  const api: NotifyApi = {
    error: (text, detail) => push("error", text, detail),
    success: (text) => push("success", text),
    info: (text) => push("info", text),
  };

  return (
    <NotifyContext.Provider value={api}>
      {children}
      <div
        // `aria-live` fa leggere l'avviso agli screen reader appena compare:
        // senza, chi non vede lo schermo non saprebbe mai che è andato storto.
        aria-live="polite"
        className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[calc(100vw-2rem)] max-w-[380px] flex-col gap-2"
      >
        {notices.map((notice) => (
          <NoticeCard
            key={notice.id}
            notice={notice}
            onClose={() => setNotices((prev) => prev.filter((n) => n.id !== notice.id))}
          />
        ))}
      </div>
    </NotifyContext.Provider>
  );
}

/**
 * Come si mandano gli avvisi.
 *
 *   const notify = useNotify();
 *   notify.error("Non riesco a leggere il file.", String(error));
 *
 * Fuori dal provider restituisce un oggetto che non fa niente invece di
 * lanciare: un componente riusato in un posto senza provider non deve
 * schiantarsi per un avviso che non è riuscito a mostrare.
 */
export function useNotify(): NotifyApi {
  const api = useContext(NotifyContext);
  if (api) return api;
  return {
    error: (text) => console.error("[avviso]", text),
    success: (text) => console.info("[avviso]", text),
    info: (text) => console.info("[avviso]", text),
  };
}

function NoticeCard({ notice, onClose }: { notice: Notice; onClose: () => void }) {
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);

  // L'uscita animata: si sposta a destra e sfuma prima di sparire davvero.
  useEffect(() => {
    const timer = window.setTimeout(() => setLeaving(true), LIFETIME[notice.kind] - 400);
    return () => window.clearTimeout(timer);
  }, [notice.kind]);

  const icon =
    notice.kind === "success" ? <CheckIcon size={15} /> : <ShieldIcon size={15} />;

  const tone =
    notice.kind === "error"
      ? { color: "var(--text-primary)", accent: "var(--text-primary)" }
      : notice.kind === "success"
        ? { color: "var(--positive)", accent: "var(--positive)" }
        : { color: "var(--text-secondary)", accent: "var(--text-secondary)" };

  return (
    <div
      className={`glass pointer-events-auto overflow-hidden rounded-xl border border-[var(--border)] shadow-[var(--shadow-3)] transition-all duration-300 ${
        leaving ? "translate-x-3 opacity-0" : "animate-notice"
      }`}
    >
      <div className="flex items-start gap-2.5 p-3.5">
        <span className="mt-0.5 shrink-0" style={{ color: tone.accent }}>
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] leading-snug" style={{ color: tone.color }}>
            {notice.text}
          </p>

          {/* Il dettaglio tecnico è quasi sempre inutile all'utente, ma è
              l'unica cosa utile a chi deve capire cosa è andato storto. Sta
              chiuso, e si apre solo se serve. */}
          {notice.detail && (
            <>
              <button
                onClick={() => setOpen((o) => !o)}
                className="mt-1 text-[11.5px] text-[var(--text-tertiary)] underline-offset-2 hover:underline"
              >
                {open ? "Nascondi i dettagli" : "Dettagli tecnici"}
              </button>
              {open && (
                <pre className="mt-1.5 max-h-[140px] overflow-auto whitespace-pre-wrap break-words rounded-lg bg-[var(--bg-app)] p-2 text-[11px] leading-relaxed text-[var(--text-secondary)]">
                  {notice.detail}
                </pre>
              )}
            </>
          )}
        </div>
        <button
          onClick={onClose}
          aria-label="Chiudi l'avviso"
          className="shrink-0 rounded-md p-1 text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-primary)]"
        >
          <CloseIcon size={13} />
        </button>
      </div>
    </div>
  );
}

/**
 * La posta di WhatsApp: le conversazioni coi clienti, dentro il sito.
 *
 * Voluta da Tommaso l'8 Agosto 2026: «nel sito devi mettere la possibilità di
 * ricordarsi le chat anche su WhatsApp, deve essere tutto collegato».
 *
 * ─────────────────────────────────────────────────────────────────────────
 * COSA RISOLVE
 * ─────────────────────────────────────────────────────────────────────────
 * Fino a ieri i clienti scrivevano al numero e l'agente rispondeva, ma il
 * titolare non vedeva niente: le conversazioni esistevano solo nel database.
 * Un prodotto che promette «risponde ai clienti al posto tuo» e poi non ti fa
 * leggere cosa ha risposto chiede una fiducia che nessuno dà.
 *
 * Qui si legge tutto, si vede **chi** ha risposto (l'agente o tu), si prende in
 * mano una conversazione quando serve, e si vede cosa l'agente ha imparato.
 *
 * ⚠️ Non è una quarta voce di navigazione: la bibbia ne ammette tre — Home,
 * Chat, Impostazioni Avanzate. Questa vive **dentro la Chat**, perché è
 * esattamente quello che è: le conversazioni, quelle che arrivano dal telefono
 * invece che dalla tastiera.
 */

import { useEffect, useRef, useState } from "react";
import {
  openWhatsAppChat,
  rememberWhatsAppChat,
  replyOnWhatsApp,
  setWhatsAppMode,
  type WhatsAppChat,
  type WhatsAppMessage,
} from "../../lib/api";
import { useNotify } from "../../lib/notify";
import { ArrowUpIcon, CloseIcon, SparkleIcon } from "../Icons";

export function WhatsAppInbox({
  chatId,
  onClose,
  onChanged,
}: {
  chatId: string;
  /** Torna alla chat del sito. */
  onClose: () => void;
  /** Avvisa la sidebar che qualcosa è cambiato (letto, modo, nuovo messaggio). */
  onChanged: () => void;
}) {
  const notify = useNotify();
  const [chat, setChat] = useState<(WhatsAppChat & { messages: WhatsAppMessage[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [remembering, setRemembering] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    openWhatsAppChat(chatId)
      .then((c) => {
        if (!alive) return;
        setChat(c);
        // L'apertura l'ha già segnata come letta sul server: la sidebar deve
        // spegnere il pallino, se no resta acceso su una cosa appena letta.
        onChanged();
      })
      .catch((error) => notify.error("Non riesco ad aprire la conversazione.", String(error)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  // In fondo, sempre: in una conversazione conta l'ultimo messaggio.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat?.messages.length]);

  async function cambiaModo(mode: "bot" | "human") {
    if (!chat) return;
    try {
      const aggiornata = await setWhatsAppMode(chat.id, mode);
      setChat({ ...chat, mode: aggiornata.mode });
      onChanged();
      notify.success(
        mode === "human"
          ? "Da adesso rispondi tu a questo cliente."
          : "L'agente ha ripreso a rispondere a questo cliente."
      );
    } catch (error) {
      notify.error("Non riesco a cambiare chi risponde.", String(error));
    }
  }

  async function invia() {
    const testo = draft.trim();
    if (!chat || !testo || sending) return;
    setSending(true);
    try {
      const messaggio = await replyOnWhatsApp(chat.id, testo);
      setChat({ ...chat, messages: [...chat.messages, messaggio] });
      setDraft("");
      onChanged();
    } catch (error) {
      // ⚠️ Il messaggio **è** stato salvato anche quando l'invio fallisce: il
      // server risponde 502 con dentro la riga. Dire "non è partito" e basta
      // farebbe riscrivere lo stesso messaggio due volte.
      notify.error("Il messaggio non è partito al cliente.", String(error));
    } finally {
      setSending(false);
    }
  }

  async function mandaInMemoria() {
    if (!chat || remembering) return;
    setRemembering(true);
    try {
      const esito = await rememberWhatsAppChat(chat.id);
      if (esito.saved) {
        notify.success(
          `Fatto: l'agente si ricorderà questa conversazione (${esito.chunks} ${
            esito.chunks === 1 ? "cosa" : "cose"
          }).`
        );
      } else {
        // Non è un errore: la maggior parte delle conversazioni non contiene
        // niente che valga domani, ed è giusto non riempire la memoria.
        notify.info(`Non c'era niente da ricordare qui: ${esito.reason}.`);
      }
    } catch (error) {
      notify.error("Non riesco a mandarla in memoria.", String(error));
    } finally {
      setRemembering(false);
    }
  }

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col bg-[var(--bg-app)]">
      {/* ── Chi è, e chi gli sta rispondendo ─────────────────────────── */}
      <header className="flex shrink-0 items-center gap-3 border-b border-[var(--border)] bg-[var(--bg-card)] px-5 py-3 md:px-7">
        <button
          onClick={onClose}
          aria-label="Torna alla chat"
          className="-ml-1 shrink-0 rounded-lg p-2 text-[var(--text-secondary)] transition-colors hover:bg-[var(--fill-quiet)] hover:text-[var(--text-primary)]"
        >
          <CloseIcon size={15} />
        </button>

        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--fill-quiet)] text-[12px] font-semibold text-[var(--text-primary)]">
          {(chat?.customerName ?? "?").slice(0, 1).toUpperCase()}
        </span>

        <div className="min-w-0 flex-1">
          <div className="truncate text-[14.5px] font-semibold text-[var(--text-primary)]">
            {chat?.customerName ?? "…"}
          </div>
          <div className="truncate text-[12px] text-[var(--text-secondary)]">
            WhatsApp · {chat?.customerWa ?? ""}
          </div>
        </div>

        {/* L'interruttore. Una parola sola, e dice cosa succede adesso — non
            cosa succederebbe se lo premi: quella è la confusione classica. */}
        {chat && (
          <button
            onClick={() => void cambiaModo(chat.mode === "human" ? "bot" : "human")}
            className={`shrink-0 rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors ${
              chat.mode === "human"
                ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                : "bg-[var(--positive-soft)] text-[var(--positive)]"
            }`}
            title={
              chat.mode === "human"
                ? "Adesso rispondi tu. Premi per ridare la parola all'agente."
                : "Adesso risponde l'agente. Premi per prendere in mano tu questo cliente."
            }
          >
            {chat.mode === "human" ? "Rispondi tu" : "Risponde l'agente"}
          </button>
        )}
      </header>

      {/* ── La conversazione ─────────────────────────────────────────── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 md:px-8">
        <div className="mx-auto flex max-w-[720px] flex-col gap-3 py-7">
          {loading && (
            <div className="py-16 text-center text-[13.5px] text-[var(--text-secondary)]">
              Sto aprendo la conversazione…
            </div>
          )}

          {chat?.messages.map((m, i) => (
            <div
              key={m.id}
              className={`animate-card flex ${m.direction === "in" ? "justify-start" : "justify-end"}`}
              style={{ animationDelay: `${Math.min(i, 12) * 22}ms` }}
            >
              <div className="max-w-[80%] min-w-0">
                <div
                  className={`whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed ${
                    m.direction === "in"
                      ? "bg-[var(--bg-card)] text-[var(--text-primary)] shadow-[var(--shadow-1)]"
                      : "bg-[var(--grad-primary)] text-[var(--on-primary)]"
                  }`}
                >
                  {m.body}
                </div>

                {/* Sotto ogni risposta: chi l'ha scritta. È la cosa che il
                    titolare guarda per primo nelle prime settimane. */}
                <div
                  className={`mt-1 flex items-center gap-1.5 px-1 text-[11px] text-[var(--text-secondary)] ${
                    m.direction === "in" ? "" : "justify-end"
                  }`}
                >
                  <span>{ora(m.createdAt)}</span>
                  {m.direction === "out" && (
                    <>
                      <span aria-hidden>·</span>
                      <span>{m.answeredBy === "human" ? "l'hai scritto tu" : "l'agente"}</span>
                      {m.status === "failed" && (
                        <>
                          <span aria-hidden>·</span>
                          <span className="font-medium text-[var(--accent)]">non consegnato</span>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}

          {chat && chat.messages.length === 0 && !loading && (
            <div className="py-16 text-center text-[13.5px] text-[var(--text-secondary)]">
              Ancora nessun messaggio in questa conversazione.
            </div>
          )}
        </div>
      </div>

      {/* ── Rispondere di persona ────────────────────────────────────── */}
      <div className="shrink-0 border-t border-[var(--border)] bg-[var(--bg-card)] px-5 py-3 md:px-8">
        <div className="mx-auto flex max-w-[720px] flex-col gap-2">
          <div className="flex items-end gap-2">
            <textarea
              rows={1}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void invia();
                }
              }}
              placeholder={
                chat?.mode === "human"
                  ? "Scrivi al cliente…"
                  : "Scrivi al cliente (l'agente continua a rispondere alle altre)…"
              }
              className="max-h-32 min-h-[42px] flex-1 resize-none rounded-xl border border-[var(--border)] bg-[var(--bg-app)] px-3.5 py-2.5 text-[14px] text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--text-secondary)] placeholder:text-[var(--text-secondary)]"
            />
            <button
              onClick={() => void invia()}
              disabled={!draft.trim() || sending}
              aria-label="Manda il messaggio al cliente"
              className="btn-grad flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl disabled:opacity-40"
            >
              <ArrowUpIcon size={16} />
            </button>
          </div>

          <button
            onClick={() => void mandaInMemoria()}
            disabled={remembering}
            className="flex items-center gap-1.5 self-start rounded-lg px-1 py-1 text-[12px] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] disabled:opacity-50"
            title="Rilegge la conversazione e tiene solo quello che vale domani: accordi, sconti, abitudini. Succede da sé ogni sei messaggi."
          >
            <SparkleIcon size={13} />
            {remembering ? "Sto leggendo…" : "Ricordati questa conversazione"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Solo l'ora se è di oggi, giorno e ora se è più vecchia. */
function ora(iso: string): string {
  const d = new Date(iso);
  const oggi = new Date();
  const stessoGiorno =
    d.getDate() === oggi.getDate() &&
    d.getMonth() === oggi.getMonth() &&
    d.getFullYear() === oggi.getFullYear();
  return stessoGiorno
    ? d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("it-IT", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
}

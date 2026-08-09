/**
 * Gli interruttori del canale WhatsApp — righe 22 e 24 della Fase 3.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * PERCHÉ QUESTA SCHERMATA È FATTA DI DUE INTERRUTTORI E NON DI VENTI
 * ─────────────────────────────────────────────────────────────────────────
 * Il problema vero, quello che il documento di Tommaso chiama per nome, è
 * **la paura**: «il titolare ha paura che il bot faccia errori». Nessuno lascia
 * i propri clienti a un'IA il primo giorno, e ha ragione.
 *
 * Quindi il prodotto non chiede fiducia — la costruisce a scalini:
 *
 *   1. Ghost acceso     l'agente scrive, tu leggi tutto, tu mandi.
 *   2. Ghost spento     l'agente risponde da solo, ma il guardiano lo ferma
 *                       se sta per promettere qualcosa che non può.
 *   3. Pilota automatico e il riepilogo della sera che ti dice com'è andata.
 *
 * Si scende di scalino quando ci si fida, non quando lo decide il software.
 */

import { useEffect, useState } from "react";
import { getWhatsAppSettings, setWhatsAppSettings } from "../../lib/api";
import { useNotify } from "../../lib/notify";

export default function WhatsAppSettings() {
  const notify = useNotify();
  const [ghost, setGhost] = useState(false);
  const [ownerWa, setOwnerWa] = useState("");
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getWhatsAppSettings()
      .then((s) => {
        setGhost(s.ghost);
        setOwnerWa(s.ownerWa ?? "");
        setConnected(s.connected);
      })
      .catch(() => {
        // Nessun canale collegato: la schermata lo dice da sé, senza allarmi.
      })
      .finally(() => setLoading(false));
  }, []);

  async function cambiaGhost(valore: boolean) {
    setGhost(valore); // Si muove subito: un interruttore che aspetta il server sembra rotto.
    try {
      await setWhatsAppSettings({ ghost: valore });
      notify.success(
        valore
          ? "Da adesso leggi tu ogni risposta prima che parta."
          : "L'agente risponde da solo. Il guardiano resta acceso."
      );
    } catch (error) {
      setGhost(!valore);
      notify.error("Non riesco a cambiare l'impostazione.", String(error));
    }
  }

  async function salvaNumero() {
    setSaving(true);
    try {
      const salvato = await setWhatsAppSettings({ ownerWa: ownerWa.trim() || null });
      setOwnerWa(salvato.ownerWa ?? "");
      notify.success(
        salvato.ownerWa
          ? "Fatto: gli avvisi arrivano su questo numero."
          : "Avvisi disattivati."
      );
    } catch (error) {
      notify.error("Non riesco a salvare il numero.", String(error));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="px-6 py-10 text-center text-[13.5px] text-[var(--text-secondary)] md:px-10">
        Un attimo…
      </div>
    );
  }

  return (
    <div className="px-6 py-8 md:px-10">
      <div className="mx-auto flex max-w-[640px] flex-col gap-4">
        {!connected && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3 text-[13.5px] text-[var(--text-secondary)]">
            Nessun numero WhatsApp collegato: queste impostazioni si accendono quando lo colleghi.
          </div>
        )}

        {/* ── Riga 22: Ghost ──────────────────────────────────────────── */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[15px] font-semibold text-[var(--text-primary)]">
                Leggi tu prima che parta
              </div>
              <p className="mt-1 text-[13.5px] leading-relaxed text-[var(--text-secondary)]">
                L'agente prepara la risposta ma non la manda: la trovi nella posta con
                «Approva e invia», e puoi correggerla prima. Tienilo acceso le prime
                settimane; quando vedi che non sbaglia un colpo, spegnilo.
              </p>
            </div>
            <Switch on={ghost} onChange={(v) => void cambiaGhost(v)} label="Leggi tu prima che parta" />
          </div>

          {!ghost && (
            <div className="mt-3 border-t border-[var(--border)] pt-3 text-[12.5px] text-[var(--text-secondary)]">
              Anche a interruttore spento l'agente <strong className="font-semibold">non</strong> è
              lasciato solo: se sta per promettere uno sconto, un omaggio, un rimborso o una
              consegna a tempo che non risultano dai tuoi documenti, la risposta si ferma
              lo stesso e ti avvisa.
            </div>
          )}
        </div>

        {/* ── Riga 24: dove avvisarti ─────────────────────────────────── */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
          <div className="text-[15px] font-semibold text-[var(--text-primary)]">
            Dove ti avviso
          </div>
          <p className="mt-1 text-[13.5px] leading-relaxed text-[var(--text-secondary)]">
            Il <strong className="font-semibold">tuo</strong> numero personale, non quello
            dell'attività: ci arrivano gli avvisi quando una risposta si ferma, e il riepilogo
            della sera con com'è andata la giornata.
          </p>

          <div className="mt-3 flex gap-2">
            <input
              value={ownerWa}
              onChange={(e) => setOwnerWa(e.target.value)}
              placeholder="+39 333 1234567"
              inputMode="tel"
              className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--bg-app)] px-3.5 py-2.5 text-[14px] text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--text-secondary)] placeholder:text-[var(--text-tertiary)]"
            />
            <button
              onClick={() => void salvaNumero()}
              disabled={saving}
              className="btn-grad shrink-0 rounded-xl px-4 py-2.5 text-[13.5px] font-medium disabled:opacity-50"
            >
              {saving ? "Salvo…" : "Salva"}
            </button>
          </div>
          <div className="mt-2 text-[12px] text-[var(--text-tertiary)]">
            Scrivilo come ti viene: col +, con gli spazi o senza. Ci pensiamo noi.
            Lascialo vuoto per non ricevere nessun avviso.
          </div>
        </div>
      </div>
    </div>
  );
}

/** Un interruttore che si vede da lontano: acceso è verde, spento è grigio. */
function Switch({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className="relative h-[26px] w-[46px] shrink-0 rounded-full transition-colors duration-[var(--fast)]"
      style={{ background: on ? "var(--positive)" : "var(--fill-quiet)" }}
    >
      <span
        className="absolute top-[3px] h-[20px] w-[20px] rounded-full bg-white shadow-[var(--shadow-1)] transition-all duration-[var(--fast)]"
        style={{ left: on ? "23px" : "3px" }}
      />
    </button>
  );
}

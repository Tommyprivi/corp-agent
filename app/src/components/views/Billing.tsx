/**
 * Account e piano — righe 29, 30, 31 e 33 della Fase 4.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * COSA VEDE CHI APRE QUESTA SCHERMATA
 * ─────────────────────────────────────────────────────────────────────────
 * In ordine, e l'ordine è la scelta:
 *   1. cosa hai adesso e quando si rinnova
 *   2. quanti crediti ti restano, e la ricarica se stanno finendo
 *   3. i piani, per cambiare
 *   4. la tua chiave, per chi preferisce pagare OpenRouter di suo
 *
 * Un imprenditore che apre la pagina dei pagamenti ha una domanda sola in
 * testa: «quanto sto spendendo e cosa succede se finisco?». Mettere per primi
 * i piani da comprare — che è la tentazione — risponde alla domanda di chi
 * vende, non a quella di chi paga.
 *
 * ⚠️ Le carte non passano mai da qui. Si va su Stripe e si torna: significa
 * che questo codice non vede mai un numero di carta, e non deve difenderlo.
 */

import { useEffect, useState } from "react";
import {
  getBilling,
  openBillingPortal,
  saveByokKey,
  startCheckout,
  startTopup,
  type BillingState,
} from "../../lib/api";
import { useNotify } from "../../lib/notify";
import { PLANS } from "../../data/plans";
import { SparkleIcon } from "../Icons";

export default function Billing() {
  const notify = useNotify();
  const [stato, setStato] = useState<BillingState | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [inCorso, setInCorso] = useState<string | null>(null);
  const [chiave, setChiave] = useState("");

  function ricarica() {
    getBilling()
      .then((s) => {
        setStato(s);
        setErrore(null);
      })
      .catch((e) => setErrore(String(e)));
  }

  useEffect(ricarica, []);

  // Si torna da Stripe con `?pagamento=ok`. Il webhook può metterci un istante:
  // si ricontrolla dopo due secondi invece di mostrare un piano vecchio.
  useEffect(() => {
    const esito = new URLSearchParams(window.location.search).get("pagamento");
    if (!esito) return;
    if (esito === "ok") {
      notify.success("Pagamento ricevuto. Sto aggiornando il tuo piano…");
      const t = setTimeout(ricarica, 2500);
      return () => clearTimeout(t);
    }
    if (esito === "annullato") notify.info("Pagamento annullato: non è stato addebitato nulla.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function vai(azione: string, chiamata: () => Promise<{ url: string }>) {
    setInCorso(azione);
    try {
      const { url } = await chiamata();
      window.location.href = url;
    } catch (error) {
      notify.error("Non riesco ad aprire il pagamento.", String(error));
      setInCorso(null);
    }
  }

  async function salvaChiave(valore: string | null) {
    setInCorso("byok");
    try {
      const esito = await saveByokKey(valore);
      setStato((s) => (s ? { ...s, byokLast4: esito.byokLast4 } : s));
      setChiave("");
      notify.success(
        esito.byokLast4
          ? "Fatto: da adesso i consumi li paghi tu direttamente a OpenRouter."
          : "Chiave rimossa: torni a consumare i crediti del tuo piano."
      );
    } catch (error) {
      notify.error("Chiave non accettata.", String(error));
    } finally {
      setInCorso(null);
    }
  }

  if (errore) {
    return (
      <div className="mx-auto max-w-[640px] px-6 py-10 md:px-10">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
          <div className="text-[15px] font-semibold text-[var(--text-primary)]">
            I pagamenti non sono ancora attivi
          </div>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-[var(--text-secondary)]">
            Manca la configurazione di Stripe. Finché non c'è, CorpAgent funziona
            normalmente: cambia solo che non si può pagare.
          </p>
        </div>
      </div>
    );
  }

  if (!stato) {
    return (
      <div className="px-6 py-10 text-center text-[13.5px] text-[var(--text-secondary)]">
        Un attimo…
      </div>
    );
  }

  const pianoAttuale = PLANS.find((p) => p.id === stato.planId);

  /**
   * Quale piano proporre col bagliore: **il passo successivo**, non il più caro.
   *
   * Puntare all'Enterprise a chi è sul Free è il modo più veloce di far
   * chiudere la pagina. Chi è già al massimo non vede nessun bagliore: non c'è
   * niente da consigliargli, e fingere il contrario si nota.
   */
  const scala = ["free", "starter", "business", "pro", "enterprise"];
  const prossimoPasso = scala[Math.min(scala.indexOf(stato.planId) + 1, scala.length - 1)];

  return (
    <div className="mx-auto flex max-w-[640px] flex-col gap-4 px-6 py-10 md:px-10">
      {/* ── 1. Cosa hai adesso ────────────────────────────────────────── */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[12px] font-medium uppercase tracking-wide text-[var(--text-secondary)]">
              Il tuo piano
            </div>
            <div className="mt-1 text-[22px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
              {pianoAttuale?.name ?? "Free"}
            </div>
            <div className="mt-1 text-[13.5px] text-[var(--text-secondary)]">
              {stato.active
                ? stato.endingAtPeriodEnd
                  ? `Attivo fino al ${data(stato.renewsOn)}, poi si ferma.`
                  : stato.renewsOn
                    ? `Si rinnova il ${data(stato.renewsOn)}.`
                    : "Attivo."
                : "Nessun abbonamento attivo."}
            </div>
          </div>
          <span
            className="shrink-0 rounded-full px-2.5 py-1 text-[11.5px] font-medium"
            style={{
              background: stato.active ? "var(--positive-soft)" : "var(--fill-quiet)",
              color: stato.active ? "var(--positive)" : "var(--text-secondary)",
            }}
          >
            {stato.status === "past_due" ? "pagamento in sospeso" : stato.active ? "attivo" : "spento"}
          </span>
        </div>

        {stato.status === "past_due" && (
          <div className="mt-3 rounded-xl bg-[var(--fill-quiet)] px-3.5 py-2.5 text-[13px] text-[var(--text-secondary)]">
            L'ultimo pagamento non è andato a buon fine. <strong className="font-semibold">Il
            servizio resta acceso</strong> e la banca riprova da sola nei prossimi giorni; se non
            passa, aggiorna la carta qui sotto.
          </div>
        )}

        {stato.planId !== "free" && (
          <button
            onClick={() => void vai("portal", openBillingPortal)}
            disabled={inCorso === "portal"}
            className="mt-4 rounded-xl border border-[var(--border)] px-4 py-2 text-[13.5px] font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--fill-quiet)] disabled:opacity-50"
          >
            {inCorso === "portal" ? "Apro…" : "Carta, fatture e disdetta"}
          </button>
        )}
      </div>

      {/* ── 2. I crediti ──────────────────────────────────────────────── */}
      <div
        className={`rounded-2xl border bg-[var(--bg-card)] p-5 ${
          stato.lowCredits && !stato.byokLast4 ? "glow-warn" : "border-[var(--border)]"
        }`}
      >
        <div className="flex items-baseline justify-between gap-3">
          <div className="text-[12px] font-medium uppercase tracking-wide text-[var(--text-secondary)]">
            Crediti
          </div>
          <div
            className="text-[20px] font-semibold tabular-nums"
            style={{ color: stato.lowCredits ? "var(--accent)" : "var(--text-primary)" }}
          >
            {stato.credits.toLocaleString("it-IT")}
          </div>
        </div>

        {stato.byokLast4 ? (
          <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--text-secondary)]">
            Stai usando la tua chiave di OpenRouter: i consumi li paghi direttamente tu, i
            crediti qui non si consumano.
          </p>
        ) : (
          <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--text-secondary)]">
            {stato.lowCredits
              ? "Stanno finendo. "
              : "Si consumano quando l'agente risponde. "}
            <strong className="font-semibold text-[var(--text-primary)]">
              L'agente non si ferma quando finiscono
            </strong>{" "}
            — continua a rispondere ai tuoi clienti e te lo dice, così ricarichi con
            calma.
          </p>
        )}

        {!stato.byokLast4 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {stato.topups.map((t) => (
              <button
                key={t.id}
                onClick={() => void vai(t.id, () => startTopup(t.id))}
                disabled={inCorso === t.id}
                className="rounded-xl border border-[var(--border)] px-3.5 py-2 text-[13px] text-[var(--text-primary)] transition-colors hover:bg-[var(--fill-quiet)] disabled:opacity-50"
              >
                <span className="font-medium">{t.priceEur} €</span>
                <span className="text-[var(--text-secondary)]">
                  {" · "}
                  {(t.credits / 1000).toFixed(0)}k crediti
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── 3. Cambiare piano ─────────────────────────────────────────── */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
        <div className="text-[12px] font-medium uppercase tracking-wide text-[var(--text-secondary)]">
          {stato.planId === "free" ? "Scegli un piano" : "Cambia piano"}
        </div>
        <div className="mt-3 flex flex-col gap-2">
          {stato.plans.map((p) => {
            const attuale = p.id === stato.planId && stato.active;
            const dettagli = PLANS.find((x) => x.id === p.id);
            // ⚠️ Uno solo brilla. Se brillassero tutti non brillerebbe
            // nessuno: il bagliore e' un dito puntato, e un dito che punta
            // ovunque non indica niente. E' quello subito sopra il tuo — il
            // passo successivo, non il piu' caro.
            const consigliato = !attuale && p.id === prossimoPasso;
            return (
              <div
                key={p.id}
                className={`flex items-center gap-3 rounded-xl border p-3.5 transition-colors ${
                  attuale
                    ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                    : consigliato
                      ? "glow-offer bg-[var(--bg-card)]"
                      : "border-[var(--border)]"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[14.5px] font-medium text-[var(--text-primary)]">
                    {dettagli?.name ?? p.name}
                    {consigliato && (
                      <span className="rounded-full bg-[#6366f1] px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-white">
                        consigliato
                      </span>
                    )}
                    <span className="ml-2 text-[13px] font-normal text-[var(--text-secondary)]">
                      {p.priceEur} € al mese
                    </span>
                  </div>
                  <div className="mt-0.5 truncate text-[12.5px] text-[var(--text-secondary)]">
                    {dettagli?.pitch ?? `${(p.credits / 1000).toFixed(0)}k crediti al mese`}
                  </div>
                </div>
                {attuale ? (
                  <span className="shrink-0 text-[12.5px] font-medium text-[var(--accent)]">
                    il tuo
                  </span>
                ) : (
                  <button
                    onClick={() => void vai(p.id, () => startCheckout(p.id))}
                    disabled={inCorso === p.id}
                    className="btn-grad shrink-0 rounded-xl px-3.5 py-2 text-[13px] font-medium disabled:opacity-50"
                  >
                    {inCorso === p.id ? "Apro…" : "Scegli"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 4. Riga 31: la tua chiave ─────────────────────────────────── */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
        <div className="flex items-center gap-1.5 text-[12px] font-medium uppercase tracking-wide text-[var(--text-secondary)]">
          <SparkleIcon size={13} />
          Uso la mia chiave
        </div>
        <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--text-secondary)]">
          Se hai già un account OpenRouter puoi metterci la tua chiave: i consumi dell'IA
          li paghi direttamente tu al centesimo, e a noi paghi solo il software. Conviene
          a chi ha volumi alti.
        </p>

        {stato.byokLast4 ? (
          <div className="mt-3 flex items-center gap-3">
            <code className="rounded-lg bg-[var(--fill-quiet)] px-2.5 py-1.5 text-[13px] text-[var(--text-primary)]">
              sk-or-••••{stato.byokLast4}
            </code>
            <button
              onClick={() => void salvaChiave(null)}
              disabled={inCorso === "byok"}
              className="text-[13px] text-[var(--text-secondary)] underline-offset-2 hover:text-[var(--text-primary)] hover:underline disabled:opacity-50"
            >
              Togli
            </button>
          </div>
        ) : (
          <div className="mt-3 flex gap-2">
            <input
              value={chiave}
              onChange={(e) => setChiave(e.target.value)}
              placeholder="sk-or-v1-…"
              autoComplete="off"
              spellCheck={false}
              className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--bg-app)] px-3.5 py-2.5 font-mono text-[13px] text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--text-secondary)] placeholder:text-[var(--text-tertiary)]"
            />
            <button
              onClick={() => void salvaChiave(chiave)}
              disabled={!chiave.trim() || inCorso === "byok"}
              className="shrink-0 rounded-xl border border-[var(--border)] px-4 py-2.5 text-[13.5px] font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--fill-quiet)] disabled:opacity-40"
            >
              {inCorso === "byok" ? "Provo…" : "Salva"}
            </button>
          </div>
        )}
        <div className="mt-2 text-[12px] text-[var(--text-tertiary)]">
          La proviamo prima di salvarla: una chiave sbagliata farebbe smettere di
          rispondere l'agente senza che nessuno capisca perché.
        </div>
      </div>
    </div>
  );
}

/** «12 settembre 2026», che è come lo direbbe una persona. */
function data(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

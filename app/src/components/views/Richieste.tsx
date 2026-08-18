import { useCallback, useEffect, useState } from "react";
import {
  aggiornaPratica,
  listMessaggiPratica,
  listPratiche,
  type Pratica,
} from "../../lib/api";
import { useNotify } from "../../lib/notify";

/**
 * La scrivania delle richieste — priorità 2 della Direzione finale.
 *
 * *«Vedo tutte le richieste con dati form più risposte dell'agente. Le richieste
 * chiuse vanno in un archivio separato da quelle attive.»* — Tommaso,
 * 10 Agosto 2026.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * A COSA SERVE DAVVERO, E PERCHÉ NON È UNA TABELLA
 * ─────────────────────────────────────────────────────────────────────────
 * Il contatto commerciale è manuale. Questa schermata non serve a «consultare
 * dati»: serve a decidere **a chi scrivere adesso**. Per questo l'ordine è per
 * ultima modifica, per questo il telefono e l'email si copiano con un clic, e
 * per questo la conversazione con l'agente si apre qui dentro invece di stare
 * in un'altra pagina — sono le parole con cui l'imprenditore ha spiegato il suo
 * problema, e vanno lette **prima** di scrivergli, non dopo.
 *
 * ⚠️ Non c'è nessuna cancellazione. Una richiesta sbagliata si chiude con un
 * esito; un contatto commerciale cancellato per errore non si recupera, e il
 * pulsante che lo permetterebbe non porta abbastanza valore per esistere.
 */

const STATI: { valore: Pratica["stato"]; nome: string; cosa: string }[] = [
  { valore: "nuova", nome: "Nuova", cosa: "Appena arrivata" },
  { valore: "qualificata", nome: "Qualificata", cosa: "L'agente ha fatto le domande" },
  { valore: "in_lavoro", nome: "In lavoro", cosa: "Stai preparando la sua versione" },
  { valore: "consegnata", nome: "Consegnata", cosa: "Gliel'hai mostrata" },
  { valore: "chiusa", nome: "Chiusa", cosa: "Va in archivio" },
];

export default function Richieste() {
  const notify = useNotify();
  const [archivio, setArchivio] = useState(false);
  const [pratiche, setPratiche] = useState<Pratica[] | null>(null);
  const [aperta, setAperta] = useState<string | null>(null);

  const ricarica = useCallback(async () => {
    setPratiche(null);
    try {
      setPratiche(await listPratiche(archivio));
    } catch (error) {
      setPratiche([]);
      notify.error(
        "Non riesco a leggere le richieste.",
        error instanceof Error ? error.message : String(error)
      );
    }
  }, [archivio, notify]);

  useEffect(() => {
    void ricarica();
  }, [ricarica]);

  return (
    <div className="px-5 py-8 md:px-10">
      <div className="mx-auto max-w-[760px]">
        <h2 className="text-[19px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
          Richieste delle aziende
        </h2>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-[var(--text-secondary)]">
          Chi ha compilato il form, cosa ha raccontato all'agente, e a che punto sei.
          Il contatto lo fai tu, da corpagent7@gmail.com.
        </p>

        {/* ⚠️ Due schede e non un filtro a tendina: «attive» e «archivio» sono
            due modi diversi di lavorare, non due valori dello stesso elenco.
            Una tendina le farebbe sembrare interscambiabili. */}
        <div className="mt-6 flex gap-1 border-b border-[var(--border)]">
          <Scheda attiva={!archivio} onClick={() => setArchivio(false)}>
            Attive
          </Scheda>
          <Scheda attiva={archivio} onClick={() => setArchivio(true)}>
            Archivio
          </Scheda>
        </div>

        {pratiche === null && (
          <p className="mt-8 text-[13.5px] text-[var(--text-secondary)]">Un attimo…</p>
        )}

        {pratiche?.length === 0 && (
          <div className="mt-8 rounded-xl border border-dashed border-[var(--border)] p-8 text-center">
            <p className="text-[14px] text-[var(--text-primary)]">
              {archivio ? "Nessuna richiesta in archivio." : "Ancora nessuna richiesta."}
            </p>
            {!archivio && (
              <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--text-secondary)]">
                Quando un'azienda compila il form la trovi qui, e ti arriva un'email.
              </p>
            )}
          </div>
        )}

        <div className="mt-5 space-y-2.5">
          {pratiche?.map((p) => (
            <Riga
              key={p.id}
              p={p}
              apertaQui={aperta === p.id}
              onApri={() => setAperta(aperta === p.id ? null : p.id)}
              onCambiata={ricarica}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function Scheda({
  attiva,
  onClick,
  children,
}: {
  attiva: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`-mb-px cursor-pointer border-b-2 px-3 py-2.5 text-[13.5px] transition-colors ${
        attiva
          ? "border-[var(--accent)] font-medium text-[var(--text-primary)]"
          : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
      }`}
    >
      {children}
    </button>
  );
}

function Riga({
  p,
  apertaQui,
  onApri,
  onCambiata,
}: {
  p: Pratica;
  apertaQui: boolean;
  onApri: () => void;
  onCambiata: () => void;
}) {
  const notify = useNotify();
  const [messaggi, setMessaggi] = useState<
    { ruolo: "agente" | "azienda"; testo: string; creato_il: string }[] | null
  >(null);
  const [note, setNote] = useState(p.note ?? "");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!apertaQui || messaggi) return;
    listMessaggiPratica(p.id).then(setMessaggi).catch(() => setMessaggi([]));
  }, [apertaQui, messaggi, p.id]);

  async function sposta(stato: Pratica["stato"]) {
    try {
      await aggiornaPratica({ id: p.id, stato });
      notify.success(
        stato === "chiusa" ? `${p.azienda} è in archivio.` : `${p.azienda}: ${stato}.`
      );
      onCambiata();
    } catch (error) {
      notify.error(
        "Non riesco a spostarla.",
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  async function salvaNote() {
    setSalvando(true);
    try {
      await aggiornaPratica({ id: p.id, note });
      notify.success("Appunti salvati.");
    } catch (error) {
      notify.error("Non riesco a salvare.", error instanceof Error ? error.message : String(error));
    } finally {
      setSalvando(false);
    }
  }

  const stato = STATI.find((s) => s.valore === p.stato);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)]">
      <button
        onClick={onApri}
        className="flex w-full cursor-pointer items-start justify-between gap-4 p-4 text-left"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[14.5px] font-medium text-[var(--text-primary)]">
              {p.azienda}
            </span>
            <span
              className="rounded-full px-2 py-0.5 text-[11px]"
              style={{
                background: "var(--fill-quiet)",
                color: "var(--text-secondary)",
              }}
            >
              {stato?.nome ?? p.stato}
            </span>
            {Number(p.messaggi) > 1 && (
              <span className="text-[11.5px] text-[var(--text-secondary)]">
                {p.messaggi} messaggi
              </span>
            )}
          </div>
          <p className="mt-1 text-[13px] text-[var(--text-secondary)]">{p.settore}</p>
          {/* Due righe della sua esigenza: quanto basta a decidere se aprire. */}
          <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-[var(--text-secondary)]">
            {p.esigenza}
          </p>
        </div>
        <span className="shrink-0 text-[11.5px] text-[var(--text-secondary)]">
          {new Date(p.creata_il).toLocaleDateString("it-IT", { day: "numeric", month: "short" })}
        </span>
      </button>

      {apertaQui && (
        <div className="space-y-5 border-t border-[var(--border)] p-4">
          {/* ── I contatti, copiabili con un clic ─────────────────────── */}
          <div className="flex flex-wrap gap-2">
            <Copia etichetta="Email" valore={p.email} />
            <Copia etichetta="Telefono" valore={p.telefono} />
            <a
              href={`mailto:${p.email}?subject=${encodeURIComponent(`CorpAgent per ${p.azienda}`)}`}
              className="btn-grad cursor-pointer rounded-lg px-3.5 py-1.5 text-[12.5px] font-medium"
            >
              Scrivi
            </a>
          </div>

          {/* ── Cosa ha scritto nel form, per intero ──────────────────── */}
          <div>
            <p className="text-[11.5px] uppercase tracking-[0.06em] text-[var(--text-secondary)]">
              Nel form
            </p>
            <p className="mt-1.5 whitespace-pre-wrap text-[13.5px] leading-relaxed text-[var(--text-primary)]">
              {p.esigenza}
            </p>
          </div>

          {/* ── La conversazione con l'agente ─────────────────────────── */}
          <div>
            <p className="text-[11.5px] uppercase tracking-[0.06em] text-[var(--text-secondary)]">
              Con l'agente
            </p>
            {messaggi === null && (
              <p className="mt-1.5 text-[13px] text-[var(--text-secondary)]">…</p>
            )}
            {messaggi?.length === 0 && (
              <p className="mt-1.5 text-[13px] text-[var(--text-secondary)]">
                Non ha risposto alle domande.
              </p>
            )}
            <div className="mt-2 space-y-2">
              {messaggi?.map((m, i) => (
                <div
                  key={i}
                  className={`rounded-lg px-3 py-2 text-[13px] leading-relaxed ${
                    m.ruolo === "azienda"
                      ? "bg-[var(--accent-soft)] text-[var(--text-primary)]"
                      : "bg-[var(--fill-quiet)] text-[var(--text-secondary)]"
                  }`}
                >
                  <span className="mr-1.5 text-[11px] uppercase tracking-[0.05em] opacity-55">
                    {m.ruolo === "azienda" ? "loro" : "agente"}
                  </span>
                  {m.testo}
                </div>
              ))}
            </div>
          </div>

          {/* ── I tuoi appunti ───────────────────────────────────────── */}
          <div>
            <p className="text-[11.5px] uppercase tracking-[0.06em] text-[var(--text-secondary)]">
              Appunti tuoi
            </p>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Cosa vi siete detti, il prezzo concordato, cosa manca…"
              className="mt-1.5 w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--bg-app)] px-3 py-2 text-[13.5px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
            />
            {/* ⚠️ Questi appunti non escono mai verso l'azienda: la pagina di
                stato legge solo `stato`, e `note` non passa da lì. */}
            <div className="mt-2 flex items-center gap-3">
              <button
                onClick={() => void salvaNote()}
                disabled={salvando || note === (p.note ?? "")}
                className="cursor-pointer rounded-lg border border-[var(--border)] px-3 py-1.5 text-[12.5px] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] disabled:opacity-40"
              >
                {salvando ? "Salvo…" : "Salva appunti"}
              </button>
              <span className="text-[11.5px] text-[var(--text-secondary)]">
                Solo per te, l'azienda non li vede
              </span>
            </div>
          </div>

          {/* ── Dove sta la pratica ──────────────────────────────────── */}
          <div>
            <p className="text-[11.5px] uppercase tracking-[0.06em] text-[var(--text-secondary)]">
              Sposta
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {STATI.filter((s) => s.valore !== p.stato).map((s) => (
                <button
                  key={s.valore}
                  onClick={() => void sposta(s.valore)}
                  title={s.cosa}
                  className="cursor-pointer rounded-lg border border-[var(--border)] px-3 py-1.5 text-[12.5px] text-[var(--text-secondary)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
                >
                  {s.nome}
                </button>
              ))}
            </div>
          </div>

          {/* ── Il link che l'azienda usa per seguire la pratica ─────── */}
          <Copia
            etichetta="Link per l'azienda"
            valore={`${window.location.origin}/richiesta/${p.chiave}`}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Un valore che si copia con un clic.
 *
 * ⚠️ `navigator.clipboard` non esiste su connessioni non sicure e in qualche
 * browser vecchio. Se manca, si mostra il valore selezionabile invece di un
 * pulsante che non fa niente: un pulsante muto è peggio di nessun pulsante.
 */
function Copia({ etichetta, valore }: { etichetta: string; valore: string }) {
  const notify = useNotify();
  const [copiato, setCopiato] = useState(false);

  if (typeof navigator === "undefined" || !navigator.clipboard) {
    return (
      <span className="select-all rounded-lg bg-[var(--fill-quiet)] px-3 py-1.5 text-[12.5px] text-[var(--text-primary)]">
        {valore}
      </span>
    );
  }

  return (
    <button
      onClick={() => {
        navigator.clipboard
          .writeText(valore)
          .then(() => {
            setCopiato(true);
            window.setTimeout(() => setCopiato(false), 1600);
          })
          .catch(() => notify.error("Non riesco a copiare."));
      }}
      title={`Copia ${etichetta.toLowerCase()}`}
      className="cursor-pointer rounded-lg bg-[var(--fill-quiet)] px-3 py-1.5 text-[12.5px] text-[var(--text-primary)] transition-colors hover:bg-[var(--accent-soft)]"
    >
      <span className="opacity-55">{etichetta}: </span>
      {copiato ? "copiato ✓" : valore}
    </button>
  );
}

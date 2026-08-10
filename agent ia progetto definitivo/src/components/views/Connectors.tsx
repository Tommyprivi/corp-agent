import { useCallback, useEffect, useState } from "react";
import {
  connectWithKey,
  connectorLoginUrl,
  disconnectConnector,
  listConnectors,
  type Connessione,
  type ConnectorKind,
} from "../../lib/api";
import { useNotify } from "../../lib/notify";

/**
 * «Connettori» — dove il cliente collega i suoi servizi.
 *
 * Voluto da Tommaso il 9 Agosto 2026:
 *
 *   «quando colleghi il connettore fai l'accesso con il tuo account e hai le
 *    tue cose, ma questo vale per tutto»
 *
 * ─────────────────────────────────────────────────────────────────────────
 * PERCHÉ L'ACCESSO STA DAVANTI E LA CHIAVE DIETRO UN LINK
 * ─────────────────────────────────────────────────────────────────────────
 * Fin qui i connettori esistevano davvero — cifrati, per utente, usati
 * dall'agente — ma si comandavano solo dal codice. Cioè: **funzionavano per
 * noi e per nessun altro.** Un ristoratore non ha una riga di comando.
 *
 * La gerarchia visiva non è estetica, è una scelta di prodotto. «Fai l'accesso»
 * è un pulsante; «oppure incolla una chiave» è un link piccolo che apre un
 * campo. Chi sa cos'è una chiave API la trova; tutti gli altri non devono
 * nemmeno sapere che esiste — e soprattutto non devono pensare che serva.
 *
 * ⚠️ Un connettore rotto in silenzio è peggio di uno mai collegato: l'agente
 * continua a rispondere come se sapesse. Per questo lo stato non è un pallino
 * e basta: quando qualcosa non va, si legge **cosa** non va.
 */

interface Definizione {
  kind: ConnectorKind;
  nome: string;
  /** Cosa ci fa l'agente, detto come lo direbbe il titolare. */
  cosaFa: string;
  /** `login` = OAuth. `chiave` = si incolla. `entrambi` = si può scegliere. */
  come: "login" | "chiave" | "entrambi";
  /** Campi in più che servono oltre al segreto (Fluida vuole l'azienda). */
  extra?: { campo: string; etichetta: string; aiuto: string }[];
  aiutoChiave?: string;
}

const CONNETTORI: Definizione[] = [
  {
    kind: "fluida",
    nome: "Fluida",
    cosaFa: "Chi lavora qui, chi è in ferie oggi, chi c'è lunedì.",
    come: "entrambi",
    extra: [
      {
        campo: "companyId",
        etichetta: "ID azienda",
        aiuto: "Lo trovi in Fluida, nelle impostazioni dell'azienda.",
      },
    ],
    aiutoChiave: "La chiave API di Fluida, dalle impostazioni del tuo account.",
  },
  {
    kind: "microsoft",
    nome: "Microsoft 365",
    cosaFa: "Legge la posta di Outlook e fissa appuntamenti sul calendario.",
    come: "login",
  },
  {
    kind: "google",
    nome: "Google",
    cosaFa: "Legge Gmail e mette gli appuntamenti su Google Calendar.",
    come: "login",
  },
  {
    kind: "maps",
    nome: "Google Maps",
    cosaFa: "Quanti chilometri e quanto tempo fra due indirizzi, in auto.",
    come: "chiave",
    aiutoChiave: "Una chiave API di Google Cloud con «Distance Matrix» attivo.",
  },
];

export default function Connectors() {
  const notify = useNotify();
  const [collegati, setCollegati] = useState<Connessione[] | null>(null);
  const [aperto, setAperto] = useState<ConnectorKind | null>(null);

  const ricarica = useCallback(async () => {
    try {
      setCollegati(await listConnectors());
    } catch (error) {
      setCollegati([]);
      notify.error(
        "Non riesco a leggere i collegamenti.",
        error instanceof Error ? error.message : String(error)
      );
    }
  }, [notify]);

  useEffect(() => {
    void ricarica();
  }, [ricarica]);

  // ⚠️ Dopo l'accesso il server rimanda qui con `?connettore=…&esito=…`. Senza
  // questo pezzo l'utente tornerebbe su una pagina identica a prima, senza
  // sapere se ha funzionato: il momento peggiore per lasciare qualcuno nel
  // dubbio è **subito dopo** che ha dato fiducia a un permesso.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const quale = p.get("connettore");
    const esito = p.get("esito");
    if (!quale || !esito) return;

    const nome = CONNETTORI.find((c) => c.kind === quale)?.nome ?? quale;
    if (esito === "ok") notify.success(`${nome} è collegato.`);
    else if (esito === "annullato") notify.info(`Hai annullato il collegamento a ${nome}.`);
    else notify.error(`${nome} non si è collegato.`, esito);

    window.history.replaceState({}, "", window.location.pathname);
    void ricarica();
  }, [notify, ricarica]);

  return (
    <div className="px-6 py-8 md:px-10">
      <div className="mx-auto max-w-[640px]">
        <h2 className="text-[19px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
          Connettori
        </h2>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-[var(--text-secondary)]">
          Collega i servizi che usi già. L'agente li userà per rispondere con dati veri
          invece di dire «devo far verificare» — sul sito e su WhatsApp.
        </p>

        <p className="mt-4 rounded-lg bg-[var(--fill-quiet)] px-3.5 py-2.5 text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
          Entri con il <strong className="font-medium text-[var(--text-primary)]">tuo</strong>{" "}
          account e vedi le <strong className="font-medium text-[var(--text-primary)]">tue</strong>{" "}
          cose. Le credenziali restano cifrate sul nostro server e non escono mai:
          non le vediamo nemmeno noi.
        </p>

        <div className="mt-6 space-y-2.5">
          {CONNETTORI.map((def) => (
            <Riga
              key={def.kind}
              def={def}
              stato={collegati?.find((c) => c.kind === def.kind) ?? null}
              caricando={collegati === null}
              apertoQui={aperto === def.kind}
              onApri={() => setAperto(aperto === def.kind ? null : def.kind)}
              onCambiato={() => {
                setAperto(null);
                void ricarica();
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function Riga({
  def,
  stato,
  caricando,
  apertoQui,
  onApri,
  onCambiato,
}: {
  def: Definizione;
  stato: Connessione | null;
  caricando: boolean;
  apertoQui: boolean;
  onApri: () => void;
  onCambiato: () => void;
}) {
  const notify = useNotify();
  const [attesa, setAttesa] = useState(false);
  const collegato = stato?.status === "connected";
  const guasto = stato != null && stato.status !== "connected";

  async function vaiAllAccesso() {
    setAttesa(true);
    try {
      // ⚠️ Stessa scheda, non una finestra nuova: al ritorno serve il cookie di
      // sessione, e un pop-up che si chiude da solo lascia la pagina di partenza
      // ferma su uno stato vecchio.
      window.location.href = await connectorLoginUrl(def.kind);
    } catch (error) {
      setAttesa(false);
      notify.error(
        `Non riesco ad aprire l'accesso a ${def.nome}.`,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  async function stacca() {
    setAttesa(true);
    try {
      await disconnectConnector(def.kind);
      notify.success(`${def.nome} è staccato.`);
      onCambiato();
    } catch (error) {
      notify.error(
        `Non riesco a staccare ${def.nome}.`,
        error instanceof Error ? error.message : String(error)
      );
    } finally {
      setAttesa(false);
    }
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[14.5px] font-medium text-[var(--text-primary)]">
              {def.nome}
            </span>
            {collegato && <Pallino tono="ok" testo="collegato" />}
            {guasto && <Pallino tono="ko" testo={etichettaStato(stato.status)} />}
          </div>
          <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-secondary)]">
            {def.cosaFa}
          </p>
          {guasto && stato.lastError && (
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--danger,#dc2626)]">
              {stato.lastError}
            </p>
          )}
        </div>

        <div className="shrink-0">
          {caricando ? (
            <span className="text-[12.5px] text-[var(--text-secondary)]">…</span>
          ) : collegato ? (
            <button
              onClick={() => void stacca()}
              disabled={attesa}
              className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-[12.5px] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] disabled:opacity-50"
            >
              Stacca
            </button>
          ) : def.come === "chiave" ? (
            <button
              onClick={onApri}
              className="btn-grad rounded-lg px-3.5 py-1.5 text-[12.5px] font-medium"
            >
              Collega
            </button>
          ) : (
            <button
              onClick={() => void vaiAllAccesso()}
              disabled={attesa}
              className="btn-grad rounded-lg px-3.5 py-1.5 text-[12.5px] font-medium disabled:opacity-50"
            >
              {attesa ? "Apro…" : `Accedi con ${def.nome}`}
            </button>
          )}
        </div>
      </div>

      {/* La chiave incollata: possibile, ma non la strada principale. */}
      {!collegato && !caricando && def.come === "entrambi" && !apertoQui && (
        <button
          onClick={onApri}
          className="mt-2.5 text-[12.5px] text-[var(--text-secondary)] underline underline-offset-2 transition-colors hover:text-[var(--text-primary)]"
        >
          oppure incolla una chiave
        </button>
      )}

      {!collegato && apertoQui && (
        <FormChiave def={def} onFatto={onCambiato} onAnnulla={onApri} />
      )}
    </div>
  );
}

function FormChiave({
  def,
  onFatto,
  onAnnulla,
}: {
  def: Definizione;
  onFatto: () => void;
  onAnnulla: () => void;
}) {
  const notify = useNotify();
  const [segreto, setSegreto] = useState("");
  const [extra, setExtra] = useState<Record<string, string>>({});
  const [attesa, setAttesa] = useState(false);

  async function salva() {
    if (!segreto.trim()) return;
    setAttesa(true);
    try {
      // ⚠️ Il server **prova la chiave prima di salvarla**: una credenziale
      // rotta messa in cassaforte produce un agente muto che nessuno collega
      // alla causa. Se qui arriva un errore, è perché la prova è fallita.
      await connectWithKey({
        kind: def.kind,
        secret: segreto.trim(),
        meta: Object.fromEntries(
          Object.entries(extra).map(([k, v]) => [k, v.trim()])
        ),
      });
      notify.success(`${def.nome} è collegato.`);
      onFatto();
    } catch (error) {
      notify.error(
        `${def.nome} non ha accettato la chiave.`,
        error instanceof Error ? error.message : String(error)
      );
    } finally {
      setAttesa(false);
    }
  }

  return (
    <div className="mt-3.5 space-y-2.5 border-t border-[var(--border)] pt-3.5">
      <label className="block">
        <span className="text-[12.5px] text-[var(--text-secondary)]">Chiave API</span>
        <input
          type="password"
          autoComplete="off"
          value={segreto}
          onChange={(e) => setSegreto(e.target.value)}
          placeholder="incolla qui"
          className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-app)] px-3 py-2 text-[13.5px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
        />
        {def.aiutoChiave && (
          <span className="mt-1 block text-[12px] text-[var(--text-secondary)]">
            {def.aiutoChiave}
          </span>
        )}
      </label>

      {def.extra?.map((campo) => (
        <label key={campo.campo} className="block">
          <span className="text-[12.5px] text-[var(--text-secondary)]">{campo.etichetta}</span>
          <input
            value={extra[campo.campo] ?? ""}
            onChange={(e) => setExtra({ ...extra, [campo.campo]: e.target.value })}
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-app)] px-3 py-2 text-[13.5px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
          />
          <span className="mt-1 block text-[12px] text-[var(--text-secondary)]">
            {campo.aiuto}
          </span>
        </label>
      ))}

      <div className="flex gap-2 pt-0.5">
        <button
          onClick={() => void salva()}
          disabled={attesa || !segreto.trim()}
          className="btn-grad rounded-lg px-3.5 py-1.5 text-[12.5px] font-medium disabled:opacity-50"
        >
          {attesa ? "Provo la chiave…" : "Collega"}
        </button>
        <button
          onClick={onAnnulla}
          className="rounded-lg px-3 py-1.5 text-[12.5px] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
        >
          Annulla
        </button>
      </div>
    </div>
  );
}

function etichettaStato(status: Connessione["status"]): string {
  if (status === "expired") return "scaduto";
  if (status === "revoked") return "revocato";
  return "non risponde";
}

function Pallino({ tono, testo }: { tono: "ok" | "ko"; testo: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-secondary)]">
      <span
        aria-hidden
        className={`h-1.5 w-1.5 rounded-full ${
          tono === "ok" ? "bg-[var(--positive,#16a34a)]" : "bg-[var(--danger,#dc2626)]"
        }`}
      />
      {testo}
    </span>
  );
}

import { useEffect, useRef, useState } from "react";
import {
  ChatSparkIcon,
  CheckIcon,
  CloseIcon,
  ImageIcon,
  PaperclipIcon,
  SparkleIcon,
} from "../Icons";
import {
  addDocument,
  answerQuestion,
  archiveDocument,
  dismissQuestion,
  listDocuments,
  listOpenQuestions,
  restoreDocument,
  type OpenQuestion,
  type StoredDocument,
} from "../../lib/api";
import { filesFromDrop, indexAll, type BatchProgress } from "../../lib/batch";
import { useNotify } from "../../lib/notify";

/**
 * Cosa sa il tuo agente.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * TRE STRADE PER LA STESSA COSA
 * ─────────────────────────────────────────────────────────────────────────
 * Obiettivo fissato da Tommaso: **zero documenti**. Nessun file da preparare.
 * Quindi non c'è un solo pulsante "carica" ma tre modi, in ordine di attrito:
 *
 *   1. INCOLLA   — copi il menù da dove sta e lo butti qui. Nessun file.
 *   2. FOTOGRAFA — inquadri il menù appeso al muro. Nessun file, nessuna copia.
 *   3. CARICA    — se un file c'è già: PDF, Word, Excel, testo.
 *
 * L'ordine sullo schermo è questo di proposito: il primo è quello che non
 * chiede niente a nessuno.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LE DOMANDE APERTE SONO LA QUARTA STRADA, E LA MIGLIORE
 * ─────────────────────────────────────────────────────────────────────────
 * Quando l'agente non sa una cosa non la inventa: la gira al titolare.
 * Rispondendo qui, quella risposta diventa memoria permanente. L'agente impara
 * usandolo, una domanda per volta, senza che nessuno prepari niente.
 */

type Tab = "memoria" | "domande" | "archivio";

export default function Knowledge() {
  const [tab, setTab] = useState<Tab>("memoria");
  const [docs, setDocs] = useState<StoredDocument[]>([]);
  const [questions, setQuestions] = useState<OpenQuestion[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void Promise.all([
      listDocuments()
        .then(setDocs)
        .catch(() => {}),
      listOpenQuestions()
        .then(setQuestions)
        .catch(() => {}),
    ]).finally(() => setLoaded(true));
  }, []);

  const openCount = questions.filter((q) => q.status === "open").length;

  return (
    <div className="mx-auto max-w-[720px] px-6 py-10 md:px-10 md:py-12">
      <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
        Cosa sa il tuo agente
      </h1>
      <p className="mt-2 text-[14.5px] leading-relaxed text-[var(--text-secondary)]">
        Quello che metti qui è la sua unica fonte di verità su prezzi, orari e condizioni.
        Fuori da qui non inventa: dice che non lo sa e lo gira a te.
      </p>

      <div className="mt-7 flex gap-1 border-b border-[var(--border)]">
        <TabButton
          label="Memoria"
          count={docs.length}
          active={tab === "memoria"}
          onClick={() => setTab("memoria")}
        />
        <TabButton
          label="Domande aperte"
          count={openCount}
          highlight={openCount > 0}
          active={tab === "domande"}
          onClick={() => setTab("domande")}
        />
        <TabButton
          label="Archivio"
          count={0}
          active={tab === "archivio"}
          onClick={() => setTab("archivio")}
        />
      </div>

      {tab === "memoria" && <Memory docs={docs} setDocs={setDocs} loaded={loaded} />}
      {tab === "domande" && (
        <Questions
          questions={questions}
          setQuestions={setQuestions}
          loaded={loaded}
          onLearned={() => void listDocuments().then(setDocs).catch(() => {})}
        />
      )}
      {tab === "archivio" && (
        <Archive onRestored={() => void listDocuments().then(setDocs).catch(() => {})} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// LA MEMORIA
// ─────────────────────────────────────────────────────────────────────────

function Memory({
  docs,
  setDocs,
  loaded,
}: {
  docs: StoredDocument[];
  setDocs: React.Dispatch<React.SetStateAction<StoredDocument[]>>;
  loaded: boolean;
}) {
  /** `"paste"` = testo gia in ordine · `"tell"` = raccontato, da sistemare. */
  const [writing, setWriting] = useState<"paste" | "tell" | null>(null);
  const [pasted, setPasted] = useState("");
  const [pasteName, setPasteName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  /** L'avanzamento del caricamento in blocco (riga 16). */
  const [batch, setBatch] = useState<BatchProgress | null>(null);
  /** Vero mentre qualcosa e sospeso sopra la finestra. */
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const notify = useNotify();

  async function save(
    name: string,
    text: string,
    source: "paste" | "upload" | "photo",
    organise = false
  ) {
    setProblem(null);
    setBusy(name);
    try {
      const created = await addDocument({ name, text, source, organise });
      // Se è lo stesso documento di prima il server lo aggiorna invece di
      // duplicarlo: qui si sostituisce la riga corrispondente.
      setDocs((prev) => [created, ...prev.filter((d) => d.id !== created.id)]);
      // Il numero di pezzi non è un dettaglio tecnico: è la prova che il
      // documento è stato letto davvero e non solo caricato.
      notify.success(
        `${created.name} è in memoria — ${created.chunkCount} ${
          created.chunkCount === 1 ? "pezzo" : "pezzi"
        }.`
      );
    } catch (error) {
      setProblem(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  }

  /**
   * Legge e indicizza una pila di file, in parallelo (riga 16).
   *
   * ⚠️ Prima era un ciclo in serie: leggi, salva, leggi, salva. Con 500 PDF
   * erano 500 attese di rete una dopo l'altra, e se il numero 7 era corrotto
   * tutto si fermava li — i 493 dopo non entravano mai.
   */
  async function handleFiles(files: File[]) {
    if (files.length === 0) return;
    setProblem(null);

    // Un file solo non merita una barra di avanzamento: si comporta come prima.
    if (files.length === 1) {
      setBusy(files[0].name);
      const result = await indexAll(files, () => {});
      setBusy(null);
      const item = result.items[0];
      if (item.status === "fatto" && item.document) {
        setDocs((prev) => [item.document!, ...prev.filter((d) => d.id !== item.document!.id)]);
        notify.success(
          `${item.document.name} è in memoria — ${item.document.chunkCount} ${
            item.document.chunkCount === 1 ? "pezzo" : "pezzi"
          }.`
        );
      } else {
        notify.error(item.problem ?? "Non ho potuto leggere il file.");
      }
      return;
    }

    const result = await indexAll(files, setBatch);

    // Si rilegge l'elenco dal server invece di ricostruirlo dai pezzi: con
    // centinaia di file, alcuni sostituiscono documenti che c'erano già e
    // indovinare l'ordine a mano e un modo di sbagliarlo.
    await listDocuments().then(setDocs).catch(() => {});

    if (result.failed === 0) {
      notify.success(
        `${result.done} ${result.done === 1 ? "documento" : "documenti"} in memoria.`
      );
      setBatch(null);
    } else {
      notify.error(
        `${result.done} su ${result.total} sono entrati. ${result.failed} no: guarda l'elenco qui sotto.`
      );
      // Il riepilogo resta a schermo: e l'unico posto dove si vede QUALI file
      // non sono entrati, e senza quello l'utente non sa cosa ricaricare.
    }
  }

  return (
    <div
      // ⚠️ `onDragOver` deve chiamare preventDefault, altrimenti il browser
      // apre il file invece di lasciarlo cadere qui — e l'utente si ritrova un
      // PDF a tutto schermo al posto del suo lavoro.
      onDragOver={(e) => {
        e.preventDefault();
        if (!dragging) setDragging(true);
      }}
      onDragLeave={(e) => {
        // Solo quando esce davvero dalla zona, non passando sopra un figlio.
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        void filesFromDrop(e.dataTransfer).then(handleFiles);
      }}
      className="relative"
    >
      {/* Il velo che compare mentre trascini: senza, non si capisce che si
          può lasciare qui e si torna al pulsante. */}
      {dragging && (
        <div className="animate-rise pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-2xl border-2 border-dashed border-[var(--accent)] bg-[var(--bg-app)]/90">
          <div className="text-center">
            <p className="text-[16px] font-semibold text-[var(--text-primary)]">
              Lascia qui
            </p>
            <p className="mt-1 text-[13.5px] text-[var(--text-secondary)]">
              Anche una cartella intera. PDF, Word, Excel, foto.
            </p>
          </div>
        </div>
      )}

      {/* Le quattro strade, in ordine di attrito crescente. */}
      <div className="mt-7 grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Way
          icon={<ChatSparkIcon size={17} />}
          title="Racconta"
          delay={0}
          hint="scrivi come parli"
          onClick={() => setWriting((w) => (w === "tell" ? null : "tell"))}
          primary
        />
        <Way
          icon={<SparkleIcon size={17} />}
          title="Incolla"
          delay={60}
          hint="menù o listino"
          onClick={() => setWriting((w) => (w === "paste" ? null : "paste"))}
        />
        <Way
          icon={<ImageIcon size={17} />}
          title="Fotografa"
          delay={120}
          hint="il menù al muro"
          onClick={() => photoRef.current?.click()}
        />
        <Way
          icon={<PaperclipIcon size={17} />}
          title="Carica"
          delay={180}
          hint="anche 500 insieme"
          onClick={() => fileRef.current?.click()}
        />
      </div>

      {writing && (
        <div className="animate-rise mt-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
          <input
            value={pasteName}
            onChange={(e) => setPasteName(e.target.value)}
            placeholder={
              writing === "tell"
                ? "Di cosa parla? (es. Sale e capienza)"
                : "Come si chiama? (es. Menù estate 2026)"
            }
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-app)] px-3 py-2 text-[14px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
          />
          <textarea
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            rows={9}
            placeholder={
              writing === "tell"
                ? "Racconta come viene, senza pensarci troppo.\n\nEs. «ho tre sale, dentro ci stanno 40 persone, la veranda 20 ma solo d'estate, e il giardino lo apro solo per gli eventi»\n\nCi penso io a metterlo in ordine."
                : "Incolla qui il menù, il listino, gli orari…\n\nMargherita  7,50 €\nMarinara  6,00 €"
            }
            className="mt-2 w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--bg-app)] px-3 py-2.5 text-[13.5px] leading-relaxed text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
          />
          <div className="mt-2.5 flex gap-2">
            <button
              onClick={async () => {
                const text = pasted.trim();
                if (!text) return;
                await save(
                  pasteName.trim() || (writing === "tell" ? "Come funziona la mia attività" : "Testo incollato"),
                  text,
                  "paste",
                  writing === "tell"
                );
                setPasted("");
                setPasteName("");
                setWriting(null);
              }}
              disabled={!pasted.trim() || busy !== null}
              className="btn-grad flex-1 rounded-xl py-2.5 text-[14px] font-medium disabled:opacity-40"
            >
              {busy
                ? writing === "tell"
                  ? "Lo sto mettendo in ordine…"
                  : "Lo sto leggendo…"
                : "Mettilo in memoria"}
            </button>
            <button
              onClick={() => setWriting(null)}
              className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-[13.5px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              Annulla
            </button>
          </div>
        </div>
      )}

      {batch && <BatchPanel batch={batch} onClose={() => setBatch(null)} />}

      {busy && !writing && (
        <p className="mt-4 flex items-center gap-2 text-[13.5px] text-[var(--text-secondary)]">
          <span className="animate-breathe inline-block h-[7px] w-[7px] rounded-full bg-[var(--accent)]" />
          Sto leggendo {busy}…
        </p>
      )}

      {problem && (
        <p className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3 text-[13px] leading-relaxed text-[var(--text-secondary)]">
          {problem}
        </p>
      )}

      <div className="mt-8">
        {!loaded ? (
          <p className="text-[13.5px] text-[var(--text-secondary)]">Un istante…</p>
        ) : docs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--border-strong)] px-5 py-10 text-center">
            <p className="text-[14.5px] font-medium text-[var(--text-primary)]">
              La memoria è vuota
            </p>
            <p className="mx-auto mt-1.5 max-w-[380px] text-[13.5px] leading-relaxed text-[var(--text-secondary)]">
              Adesso il tuo agente risponde solo con quello che gli scrivi in chat. Dagli il
              menù o il listino e non sbaglierà più un prezzo.
            </p>
          </div>
        ) : (
          <>
            <h2 className="t-label text-[var(--text-tertiary)]">In memoria · {docs.length}</h2>
            <div className="mt-3 flex flex-col gap-2">
              {docs.map((doc, i) => (
                <div
                  key={doc.id}
                  className="animate-card flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3.5"
                  style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-medium text-[var(--text-primary)]">
                      {doc.name}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12.5px] text-[var(--text-secondary)]">
                      <span>{SOURCE_LABEL[doc.source] ?? doc.source}</span>
                      <span className="text-[var(--text-tertiary)]">·</span>
                      <span>
                        {doc.chunkCount} {doc.chunkCount === 1 ? "pezzo" : "pezzi"}
                      </span>
                      {doc.status === "indexed" && (
                        <>
                          <span className="text-[var(--text-tertiary)]">·</span>
                          <span className="flex items-center gap-1 text-[var(--positive)]">
                            <CheckIcon size={12} />
                            letto
                          </span>
                        </>
                      )}
                      {doc.error && (
                        <span className="text-[var(--text-secondary)]">{doc.error}</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      const before = docs;
                      setDocs((prev) => prev.filter((d) => d.id !== doc.id));
                      try {
                        await archiveDocument(doc.id);
                      } catch (error) {
                        // La riga torna al suo posto. Senza l'avviso l'utente
                        // vedrebbe il documento riapparire da solo e non
                        // saprebbe se ha sbagliato lui.
                        setDocs(before);
                        notify.error(
                          `Non ho potuto togliere ${doc.name} dalla memoria.`,
                          error instanceof Error ? error.message : String(error)
                        );
                      }
                    }}
                    aria-label={`Togli ${doc.name} dalla memoria`}
                    title="Togli dalla memoria — resta nell'archivio, si può ripristinare"
                    className="shrink-0 rounded-lg p-2 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--fill-quiet)] hover:text-[var(--text-primary)]"
                  >
                    <CloseIcon size={15} />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        multiple
        accept=".pdf,.doc,.docx,.txt,.md,.csv,.tsv,.rtf,.png,.jpg,.jpeg,.webp"
        onChange={(e) => {
          void handleFiles(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
        className="hidden"
      />
      {/* `capture="environment"` apre la fotocamera posteriore sul telefono
          invece della galleria: è la differenza tra fotografare il menù e
          dover prima scattare, poi cercare il file. */}
      <input
        ref={photoRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => {
          void handleFiles(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
        className="hidden"
      />
    </div>
  );
}

const SOURCE_LABEL: Record<string, string> = {
  paste: "incollato",
  upload: "caricato",
  photo: "fotografato",
  drive: "da Google Drive",
};

// ─────────────────────────────────────────────────────────────────────────
// L'ARCHIVIO — la time-machine (riga 18)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Quello che è uscito dalla memoria, e che si può riportare dentro.
 *
 * Dal documento di Tommaso: «riavvolgere la memoria a una certa data, utile se
 * per errore sono stati caricati documenti sbagliati».
 *
 * La parola che comanda è **«per errore»**: chi sbaglia lo scopre dopo. Per
 * questo togliere un documento non lo cancella — l'agente smette di pescarlo
 * subito, ma la riga resta qui. Se fosse una cancellazione vera, questo pannello
 * non avrebbe niente da mostrare e la time-machine sarebbe un pulsante finto.
 */
function Archive({ onRestored }: { onRestored: () => void }) {
  const [docs, setDocs] = useState<StoredDocument[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const notify = useNotify();

  useEffect(() => {
    listDocuments(true)
      .then(setDocs)
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded) {
    return <p className="mt-8 text-[13.5px] text-[var(--text-secondary)]">Un istante…</p>;
  }

  return (
    <div className="mt-7">
      <p className="text-[13.5px] leading-relaxed text-[var(--text-secondary)]">
        Quello che hai tolto dalla memoria non è stato cancellato: l'agente non lo usa più, ma
        sta qui.{" "}
        <strong className="font-medium text-[var(--text-primary)]">
          Se hai caricato il documento sbagliato, lo rimetti a posto da qui.
        </strong>
      </p>

      {docs.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-[var(--border-strong)] px-5 py-10 text-center">
          <p className="text-[14.5px] font-medium text-[var(--text-primary)]">
            L'archivio è vuoto
          </p>
          <p className="mt-1.5 text-[13.5px] text-[var(--text-secondary)]">
            Non hai ancora tolto niente dalla memoria.
          </p>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-2">
          {docs.map((doc, i) => (
            <div
              key={doc.id}
              className="animate-card flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3.5"
              style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-medium text-[var(--text-primary)]">
                  {doc.name}
                </div>
                <div className="mt-0.5 text-[12.5px] text-[var(--text-secondary)]">
                  Tolto{" "}
                  {doc.archivedAt
                    ? new Date(doc.archivedAt).toLocaleDateString("it-IT", {
                        day: "numeric",
                        month: "long",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "—"}
                  {doc.archivedReason === "sostituito" && " · sostituita da una versione più recente"}
                  {" · "}
                  {doc.chunkCount} {doc.chunkCount === 1 ? "pezzo" : "pezzi"} ancora qui
                </div>
              </div>

              <button
                onClick={async () => {
                  setBusy(doc.id);
                  try {
                    await restoreDocument(doc.id);
                    setDocs((prev) => prev.filter((d) => d.id !== doc.id));
                    onRestored();
                    notify.success(`${doc.name} è tornato in memoria.`);
                  } catch (error) {
                    notify.error(
                      `Non ho potuto ripristinare ${doc.name}.`,
                      error instanceof Error ? error.message : String(error)
                    );
                  } finally {
                    setBusy(null);
                  }
                }}
                disabled={busy === doc.id}
                className="btn-grad shrink-0 rounded-lg px-3 py-2 text-[13px] font-medium disabled:opacity-40"
              >
                {busy === doc.id ? "…" : "Rimetti in memoria"}
              </button>

              <button
                onClick={async () => {
                  // La cancellazione vera esiste, ma sta qui dentro e non nella
                  // memoria: chi arriva a svuotare il cestino sa cosa sta facendo.
                  setBusy(doc.id);
                  try {
                    await archiveDocument(doc.id, true);
                    setDocs((prev) => prev.filter((d) => d.id !== doc.id));
                  } catch (error) {
                    notify.error(
                      "Non ho potuto cancellarlo.",
                      error instanceof Error ? error.message : String(error)
                    );
                  } finally {
                    setBusy(null);
                  }
                }}
                disabled={busy === doc.id}
                title="Cancella per sempre: da qui non si torna"
                aria-label={`Cancella ${doc.name} per sempre`}
                className="shrink-0 rounded-lg p-2 text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-primary)]"
              >
                <CloseIcon size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// LE DOMANDE APERTE
// ─────────────────────────────────────────────────────────────────────────

function Questions({
  questions,
  setQuestions,
  loaded,
  onLearned,
}: {
  questions: OpenQuestion[];
  setQuestions: React.Dispatch<React.SetStateAction<OpenQuestion[]>>;
  loaded: boolean;
  onLearned: () => void;
}) {
  const [answering, setAnswering] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const notify = useNotify();

  const open = questions.filter((q) => q.status === "open");
  const closed = questions.filter((q) => q.status !== "open");

  if (!loaded) {
    return <p className="mt-8 text-[13.5px] text-[var(--text-secondary)]">Un istante…</p>;
  }

  return (
    <div className="mt-7">
      <p className="text-[13.5px] leading-relaxed text-[var(--text-secondary)]">
        Quando un cliente chiede una cosa che l'agente non sa, non la inventa: la gira a te.
        Rispondi qui e{" "}
        <strong className="font-medium text-[var(--text-primary)]">
          la risposta entra in memoria per sempre
        </strong>{" "}
        — la stessa domanda non tornerà più.
      </p>

      {open.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-[var(--border-strong)] px-5 py-10 text-center">
          <p className="text-[14.5px] font-medium text-[var(--text-primary)]">
            Nessuna domanda in attesa
          </p>
          <p className="mt-1.5 text-[13.5px] text-[var(--text-secondary)]">
            L'agente ha saputo rispondere a tutto.
          </p>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-2">
          {open.map((q, i) => (
            <div
              key={q.id}
              className="animate-card rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4"
              style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}
            >
              <div className="text-[14px] font-medium text-[var(--text-primary)]">
                {q.question}
              </div>
              {q.holdingReply && (
                <p className="mt-1.5 text-[12.5px] italic leading-relaxed text-[var(--text-secondary)]">
                  L'agente ha risposto: «{q.holdingReply}»
                </p>
              )}

              {answering === q.id ? (
                <div className="mt-3">
                  <textarea
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={3}
                    placeholder="La risposta giusta, come la darebbe tu a un cliente"
                    className="w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--bg-app)] px-3 py-2 text-[13.5px] leading-relaxed text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={async () => {
                        const answer = draft.trim();
                        if (!answer) return;
                        setBusy(true);
                        try {
                          const updated = await answerQuestion(q.id, answer);
                          setQuestions((prev) =>
                            prev.map((x) => (x.id === q.id ? updated : x))
                          );
                          setAnswering(null);
                          setDraft("");
                          onLearned();
                          notify.success("Imparato. La stessa domanda non tornerà più.");
                        } finally {
                          setBusy(false);
                        }
                      }}
                      disabled={!draft.trim() || busy}
                      className="btn-grad flex-1 rounded-lg py-2.5 text-[13.5px] font-medium disabled:opacity-40"
                    >
                      {busy ? "La sto imparando…" : "Rispondi e ricorda"}
                    </button>
                    <button
                      onClick={() => {
                        setAnswering(null);
                        setDraft("");
                      }}
                      className="rounded-lg border border-[var(--border)] px-3.5 py-2.5 text-[13px] text-[var(--text-secondary)]"
                    >
                      Annulla
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => {
                      setAnswering(q.id);
                      setDraft("");
                    }}
                    className="btn-grad rounded-lg px-3.5 py-2 text-[13px] font-medium"
                  >
                    Rispondi
                  </button>
                  <button
                    onClick={async () => {
                      setQuestions((prev) =>
                        prev.map((x) =>
                          x.id === q.id ? { ...x, status: "dismissed" as const } : x
                        )
                      );
                      await dismissQuestion(q.id).catch(() => {});
                    }}
                    className="rounded-lg px-3 py-2 text-[13px] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
                  >
                    Non serve
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {closed.length > 0 && (
        <div className="mt-8">
          <h2 className="t-label text-[var(--text-tertiary)]">Già sistemate · {closed.length}</h2>
          <div className="mt-3 flex flex-col gap-1.5">
            {closed.slice(0, 20).map((q) => (
              <div key={q.id} className="rounded-lg px-3 py-2 text-[13px]">
                <span className="text-[var(--text-secondary)]">{q.question}</span>
                {q.answer && (
                  <span className="mt-0.5 block text-[12.5px] text-[var(--text-tertiary)]">
                    → {q.answer}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────

/**
 * L'avanzamento del caricamento in blocco.
 *
 * Con 500 file la cosa che serve non e una rotellina: e sapere **quanti** sono
 * entrati, quanti mancano, e soprattutto QUALI non ce l'hanno fatta. Un
 * "caricamento fallito" generico su cinquecento file e inutilizzabile: nessuno
 * ricaricherebbe tutto per trovare i tre corrotti.
 */
function BatchPanel({ batch, onClose }: { batch: BatchProgress; onClose: () => void }) {
  const failed = batch.items.filter((i) => i.status === "errore" || i.status === "saltato");
  const percent = Math.round(((batch.done + failed.length) / batch.total) * 100);

  return (
    <div className="animate-card mt-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[14px] font-medium text-[var(--text-primary)]">
          {batch.running
            ? `Sto leggendo… ${batch.done + failed.length} di ${batch.total}`
            : `${batch.done} di ${batch.total} in memoria`}
        </span>
        {!batch.running && (
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
            aria-label="Chiudi il riepilogo"
          >
            <CloseIcon size={14} />
          </button>
        )}
      </div>

      <div className="mt-2.5 h-[6px] w-full overflow-hidden rounded-full bg-[var(--fill-quiet)]">
        <div
          className="h-full rounded-full transition-[width] duration-300 ease-out"
          style={{ width: `${percent}%`, background: "var(--grad-primary)" }}
        />
      </div>

      {batch.running && (
        <p className="mt-2 text-[12.5px] text-[var(--text-secondary)]">
          Tre alla volta, per non bloccare la pagina. Puoi continuare a lavorare.
        </p>
      )}

      {failed.length > 0 && (
        <div className="mt-3.5 border-t border-[var(--border)] pt-3">
          <div className="t-label text-[var(--text-tertiary)]">
            Non sono entrati · {failed.length}
          </div>
          <div className="mt-2 flex max-h-[180px] flex-col gap-1.5 overflow-y-auto">
            {failed.map((item) => (
              <div key={item.file.name} className="text-[12.5px] leading-snug">
                <span className="font-medium text-[var(--text-primary)]">{item.file.name}</span>
                <span className="block text-[var(--text-secondary)]">{item.problem}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Way({
  icon,
  title,
  hint,
  onClick,
  primary,
  delay = 0,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  onClick: () => void;
  primary?: boolean;
  delay?: number;
}) {
  return (
    <button
      onClick={onClick}
      style={{ animationDelay: `${delay}ms` }}
      className={`animate-card flex flex-col items-start gap-1 rounded-xl border p-3.5 text-left transition-all duration-[var(--fast)] hover:-translate-y-px hover:shadow-[var(--shadow-2)] ${
        primary
          ? "border-[var(--accent)] bg-[var(--accent-soft)]"
          : "border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--border-strong)]"
      }`}
    >
      <span className="text-[var(--text-primary)]">{icon}</span>
      <span className="text-[14px] font-medium text-[var(--text-primary)]">{title}</span>
      <span className="text-[12.5px] text-[var(--text-secondary)]">{hint}</span>
    </button>
  );
}

function TabButton({
  label,
  count,
  active,
  onClick,
  highlight,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  highlight?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`-mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 text-[13.5px] transition-colors ${
        active
          ? "border-[var(--accent)] font-medium text-[var(--text-primary)]"
          : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
      }`}
    >
      {label}
      {count > 0 && (
        <span
          className="rounded-full px-1.5 py-0.5 text-[11px] font-semibold"
          style={
            highlight
              ? { background: "var(--positive-soft)", color: "var(--positive)" }
              : { background: "var(--fill-quiet)", color: "var(--text-secondary)" }
          }
        >
          {count}
        </span>
      )}
    </button>
  );
}

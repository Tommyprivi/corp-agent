import { useEffect, useRef, useState } from "react";
import { CheckIcon, CloseIcon, ImageIcon, PaperclipIcon, SparkleIcon } from "../Icons";
import {
  addDocument,
  answerQuestion,
  deleteDocument,
  dismissQuestion,
  listDocuments,
  listOpenQuestions,
  type OpenQuestion,
  type StoredDocument,
} from "../../lib/api";
import { extract, isSupported } from "../../lib/extract";

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

type Tab = "memoria" | "domande";

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
      </div>

      {tab === "memoria" ? (
        <Memory docs={docs} setDocs={setDocs} loaded={loaded} />
      ) : (
        <Questions
          questions={questions}
          setQuestions={setQuestions}
          loaded={loaded}
          onLearned={() => void listDocuments().then(setDocs).catch(() => {})}
        />
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
  const [pasting, setPasting] = useState(false);
  const [pasted, setPasted] = useState("");
  const [pasteName, setPasteName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  async function save(name: string, text: string, source: "paste" | "upload" | "photo") {
    setProblem(null);
    setBusy(name);
    try {
      const created = await addDocument({ name, text, source });
      // Se è lo stesso documento di prima il server lo aggiorna invece di
      // duplicarlo: qui si sostituisce la riga corrispondente.
      setDocs((prev) => [created, ...prev.filter((d) => d.id !== created.id)]);
    } catch (error) {
      setProblem(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  }

  async function handleFiles(files: FileList | null, kind: "upload" | "photo") {
    const picked = Array.from(files ?? []);
    if (picked.length === 0) return;
    setProblem(null);

    for (const file of picked) {
      if (!isSupported(file)) {
        setProblem(
          `Non so leggere ${file.name}. Posso leggere PDF, Word, Excel, CSV, testo e foto.`
        );
        continue;
      }
      setBusy(file.name);
      try {
        const { text, source } = await extract(file);
        await save(file.name, text, kind === "photo" ? "photo" : source);
      } catch (error) {
        setProblem(error instanceof Error ? error.message : String(error));
        setBusy(null);
      }
    }
  }

  return (
    <>
      {/* Le tre strade, in ordine di attrito crescente. */}
      <div className="mt-7 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Way
          icon={<SparkleIcon size={17} />}
          title="Incolla"
          hint="il modo più veloce"
          onClick={() => setPasting((p) => !p)}
          primary
        />
        <Way
          icon={<ImageIcon size={17} />}
          title="Fotografa"
          hint="il menù appeso al muro"
          onClick={() => photoRef.current?.click()}
        />
        <Way
          icon={<PaperclipIcon size={17} />}
          title="Carica"
          hint="PDF, Word, Excel"
          onClick={() => fileRef.current?.click()}
        />
      </div>

      {pasting && (
        <div className="animate-rise mt-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
          <input
            value={pasteName}
            onChange={(e) => setPasteName(e.target.value)}
            placeholder="Come si chiama? (es. Menù estate 2026)"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-app)] px-3 py-2 text-[14px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
          />
          <textarea
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            rows={9}
            placeholder={
              "Incolla qui il menù, il listino, gli orari…\n\nMargherita  7,50 €\nMarinara  6,00 €"
            }
            className="mt-2 w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--bg-app)] px-3 py-2.5 text-[13.5px] leading-relaxed text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
          />
          <div className="mt-2.5 flex gap-2">
            <button
              onClick={async () => {
                const text = pasted.trim();
                if (!text) return;
                await save(pasteName.trim() || "Testo incollato", text, "paste");
                setPasted("");
                setPasteName("");
                setPasting(false);
              }}
              disabled={!pasted.trim() || busy !== null}
              className="btn-grad flex-1 rounded-xl py-2.5 text-[14px] font-medium disabled:opacity-40"
            >
              {busy ? "Lo sto leggendo…" : "Mettilo in memoria"}
            </button>
            <button
              onClick={() => setPasting(false)}
              className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-[13.5px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              Annulla
            </button>
          </div>
        </div>
      )}

      {busy && !pasting && (
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
              {docs.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3.5"
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
                        await deleteDocument(doc.id);
                      } catch {
                        setDocs(before);
                      }
                    }}
                    aria-label={`Togli ${doc.name} dalla memoria`}
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
        accept=".pdf,.doc,.docx,.txt,.md,.csv,.tsv,.rtf"
        onChange={(e) => {
          void handleFiles(e.target.files, "upload");
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
          void handleFiles(e.target.files, "photo");
          e.target.value = "";
        }}
        className="hidden"
      />
    </>
  );
}

const SOURCE_LABEL: Record<string, string> = {
  paste: "incollato",
  upload: "caricato",
  photo: "fotografato",
  drive: "da Google Drive",
};

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
          {open.map((q) => (
            <div
              key={q.id}
              className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4"
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

function Way({
  icon,
  title,
  hint,
  onClick,
  primary,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-start gap-1 rounded-xl border p-3.5 text-left transition-all duration-[var(--fast)] hover:-translate-y-px hover:shadow-[var(--shadow-2)] ${
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

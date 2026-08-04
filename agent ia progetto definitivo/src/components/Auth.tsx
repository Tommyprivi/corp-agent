import { useEffect, useState } from "react";
import Logo from "./Logo";
import {
  AiIcon,
  AppleGlyph,
  CheckIcon,
  GoogleGlyph,
  PeopleIcon,
  SearchIcon,
  SinglePersonIcon,
  SocialIcon,
  TeamIcon,
} from "./Icons";
import Turnstile from "./Turnstile";
import { authClient, getConfig, saveProfile, verifyHuman, type PublicConfig } from "../lib/api";
import type { SurveyAnswers } from "../types";

interface AuthProps {
  onDone: (answers: SurveyAnswers) => void;
}

const SOURCES = [
  { label: "Social media", hint: "Instagram, TikTok", icon: <SocialIcon /> },
  { label: "Motori di ricerca e pubblicità", hint: "Google, Ads", icon: <SearchIcon /> },
  { label: "Passaparola", hint: "colleghi, amici, lavoro", icon: <PeopleIcon /> },
  { label: "Canali IA", hint: "ChatGPT, Claude", icon: <AiIcon /> },
];

const TEAM_SIZES = [
  { label: "Lavoro da solo", hint: "", icon: <SinglePersonIcon /> },
  { label: "Lavoro in team", hint: "", icon: <TeamIcon /> },
];

const WORKPLACES = [
  "Lavoratore dipendente / Impiegato",
  "Libero professionista / Partita IVA",
  "Manager / Dirigente d'azienda",
  "Imprenditore / Founder di startup",
  "Consulente / Freelance",
  "Studente / Ricercatore",
  "Altro / Non specificato",
];

type Step = "login" | "captcha" | "source" | "team" | "workplace";

/** Le quattro tappe mostrate nella colonna sinistra. Il login non è una tappa: è la porta. */
const STAGES: Array<{ key: Step; label: string; hint: string }> = [
  { key: "captcha", label: "Verifica", hint: "dieci secondi, serve a tenere fuori i bot" },
  { key: "source", label: "Come ci hai conosciuto", hint: "per capire dove ci trovano" },
  { key: "team", label: "Solo o in team", hint: "cambia cosa ti propone il Master Builder" },
  { key: "workplace", label: "Che lavoro fai", hint: "l'ultima, poi sei dentro" },
];

/**
 * Il percorso d'ingresso: accesso con Google o Apple, verifica anti-bot, poi tre
 * domande di cui le prime due con icone e la terza senza.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * PERCHÉ LE DOMANDE VENGONO DOPO IL LOGIN, E NON PRIMA
 * ─────────────────────────────────────────────────────────────────────────
 * Con Google vero il browser **lascia il sito**, va su accounts.google.com e
 * torna. Tutto quello che era nello stato di React durante il tragitto viene
 * perso. Quindi le tre domande non possono stare prima: si parte dal login, e
 * al ritorno — riconosciuto dalla sessione che intanto è comparsa — si riprende
 * dalla verifica e si arriva alle domande.
 *
 * Le risposte finiscono in `profiles.survey` su Neon, non nello stato del
 * browser: dopo una ricarica sono ancora lì.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * L'ORGANIZZAZIONE, RIFATTA IL 2 AGOSTO 2026
 * ─────────────────────────────────────────────────────────────────────────
 * Prima era una colonna sola al centro, e non si capiva mai quanto mancasse.
 * Adesso sono due: a sinistra il pannello scuro con le tappe — dove sei, cosa
 * hai già fatto, quanto resta — a destra solo la domanda del momento. Sapere
 * che le tappe sono quattro e brevi è ciò che impedisce di abbandonare.
 */
export default function Auth({ onDone }: AuthProps) {
  const { data: session, isPending } = authClient.useSession();
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [step, setStep] = useState<Step>("login");
  const [answers, setAnswers] = useState<SurveyAnswers>({});
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  /** Vero mentre il server controlla il gettone di Turnstile. */
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    getConfig()
      .then(setConfig)
      .catch((error: unknown) =>
        setProblem(error instanceof Error ? error.message : String(error))
      );
  }, []);

  // Il ritorno da Google: la sessione compare, il login è già fatto.
  useEffect(() => {
    if (session && step === "login") setStep("captcha");
  }, [session, step]);

  async function enter(provider: "google" | "apple") {
    setBusy(true);
    setProblem(null);
    try {
      // Questa chiamata porta via dal sito: se va a buon fine, il codice qui
      // sotto non viene mai eseguito. Per questo `busy` si spegne solo in caso
      // di errore.
      await authClient.signIn.social({ provider, callbackURL: window.location.origin });
    } catch (error) {
      setProblem(error instanceof Error ? error.message : String(error));
      setBusy(false);
    }
  }

  /**
   * Il gettone passa dal server, che e l'unico a conoscere la chiave segreta.
   *
   * Verificarlo nel browser non avrebbe senso: chiunque puo dire "sono umano"
   * a un pezzo di codice che gira sul suo computer. Il controllo vero lo fa
   * Cloudflare, e solo il server puo chiederglielo.
   *
   * Se la verifica non riesce per un problema nostro — Cloudflare non
   * raggiungibile, chiave mancante — si entra comunque: il server risponde
   * "passato" e lo annota. Bloccare l'ingresso per un guasto che non e
   * dell'utente costa un cliente, non ferma un bot.
   */
  async function passCaptcha(token: string) {
    setVerifying(true);
    setProblem(null);
    try {
      await verifyHuman(token);
      setStep("source");
    } catch (error) {
      setProblem(error instanceof Error ? error.message : String(error));
    } finally {
      setVerifying(false);
    }
  }

  function pickSource(label: string) {
    setAnswers((a) => ({ ...a, source: label }));
    setStep("team");
  }

  function pickTeam(label: string) {
    setAnswers((a) => ({ ...a, teamSize: label }));
    setStep("workplace");
  }

  async function pickWorkplace(label: string) {
    const final = { ...answers, workplace: label };
    setAnswers(final);
    setBusy(true);

    try {
      await saveProfile({ survey: final });
    } catch (error) {
      // Il sondaggio non è un cancello: se il salvataggio non riesce, si entra
      // comunque e si perde una riga di statistica. Ma lo diciamo, invece di
      // far finta che sia andato bene.
      setProblem(
        `Le risposte non si sono salvate: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    setBusy(false);
    onDone(final);
  }

  const stageIndex = STAGES.findIndex((s) => s.key === step);

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* ── Colonna sinistra: il marchio e le tappe ─────────────────── */}
      <aside
        className="on-dark relative hidden w-[42%] max-w-[520px] shrink-0 flex-col justify-between overflow-hidden p-12 lg:flex"
        style={{ background: "var(--hero-bg)" }}
      >
        <div aria-hidden className="orb orb-violet animate-aurora left-[-15%] top-[-60px] h-[380px] w-[380px]" />
        <div aria-hidden className="orb orb-cyan animate-aurora bottom-[-90px] right-[-12%] h-[340px] w-[340px]" style={{ animationDelay: "-5s" }} />

        <div className="relative text-white [&_*]:text-white">
          <Logo size={26} />
        </div>

        <div className="relative">
          <h2
            className="text-[30px] font-semibold leading-[1.15] tracking-[-0.028em]"
            style={{ color: "var(--hero-text)" }}
          >
            Mancano <span className="text-grad">quattro passaggi</span> al tuo primo agente
          </h2>
          <p className="mt-3 text-[14.5px] leading-relaxed" style={{ color: "var(--hero-text-dim)" }}>
            Sono domande brevi, e servono davvero: da queste il Master Builder capisce che
            lavoro fai e ti monta l'agente giusto senza farti configurare niente.
          </p>

          <ol className="mt-9 flex flex-col gap-1">
            {STAGES.map((stage, i) => {
              const done = stageIndex > i;
              const current = stageIndex === i;
              return (
                <li
                  key={stage.key}
                  className="flex items-start gap-3.5 rounded-xl px-3 py-2.5 transition-colors duration-[var(--normal)]"
                  style={{ background: current ? "rgba(255,255,255,0.06)" : "transparent" }}
                >
                  <span
                    className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11.5px] font-semibold transition-all duration-[var(--normal)]"
                    style={
                      done
                        ? { background: "var(--positive)", color: "#fff" }
                        : current
                          ? { background: "var(--grad-primary)", color: "#fff" }
                          : { background: "rgba(255,255,255,0.08)", color: "var(--hero-text-dim)" }
                    }
                  >
                    {done ? <CheckIcon size={13} /> : i + 1}
                  </span>
                  <span className="min-w-0">
                    <span
                      className="block text-[14px] font-medium"
                      style={{ color: current || done ? "var(--hero-text)" : "var(--hero-text-dim)" }}
                    >
                      {stage.label}
                    </span>
                    {current && (
                      <span className="block text-[12.5px]" style={{ color: "var(--hero-text-dim)" }}>
                        {stage.hint}
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>

        <p className="relative text-[12.5px]" style={{ color: "var(--hero-text-dim)" }}>
          Nessuna carta di credito. Puoi cancellare l'account quando vuoi.
        </p>
      </aside>

      {/* ── Colonna destra: solo la domanda del momento ─────────────── */}
      <div className="relative flex flex-1 items-center justify-center overflow-y-auto bg-[var(--bg-app)] px-6 py-10">
        <div className="w-full max-w-[440px]">
          {/* Sotto lg la colonna scura sparisce: il logo torna qui */}
          <div className="mb-9 flex justify-center lg:hidden">
            <Logo size={26} />
          </div>

          {step === "login" && (
            <div className="animate-rise">
              <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.024em] text-[var(--text-primary)]">
                Accedi a CorpAgent
              </h1>
              <p className="mt-2.5 text-[15px] leading-relaxed text-[var(--text-secondary)]">
                Nessun modulo da compilare, nessuna password da inventare. Scegli un account
                e sei dentro.
              </p>

              <div className="mt-9">
                {isPending || !config ? (
                  <p className="text-[13.5px] text-[var(--text-secondary)]">Un istante...</p>
                ) : (
                  <LoginButtons config={config} busy={busy} onEnter={enter} />
                )}
              </div>

              <p className="mt-6 text-[12.5px] leading-relaxed text-[var(--text-tertiary)]">
                Continuando accetti i Termini di servizio e la Privacy. Usiamo il tuo account
                solo per farti entrare: non pubblichiamo niente e non scriviamo a nessuno.
              </p>
            </div>
          )}

          {step === "captcha" && (
            <div className="animate-rise">
              <StepBadge index={1} />
              <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.022em] text-[var(--text-primary)]">
                Sei tu, vero?
              </h1>
              <p className="mt-2.5 text-[14.5px] leading-relaxed text-[var(--text-secondary)]">
                Una conferma veloce, serve solo a tenere fuori i bot.
              </p>
              {/* Riga 10: la verifica vera. Il widget si disegna da sé e nella
                  maggior parte dei casi passa senza che l'utente clicchi
                  niente. Senza la chiave dichiara di essere un segnaposto e
                  lascia entrare, invece di bloccare chi sta provando. */}
              <div className="mt-7">
                <Turnstile
                  busy={verifying}
                  theme={document.documentElement.dataset.theme === "light" ? "light" : "dark"}
                  onVerified={(token) => void passCaptcha(token)}
                />
              </div>
            </div>
          )}

          {step === "source" && (
            <Question
              index={2}
              title="Come ci hai conosciuto?"
              sub="Ci aiuta a capire dove ci trovano quelli come te."
              options={SOURCES}
              onPick={pickSource}
            />
          )}

          {step === "team" && (
            <Question
              index={3}
              title="Lavori da solo o in team?"
              sub="Cambia gli agenti che il Master Builder ti propone."
              options={TEAM_SIZES}
              onPick={pickTeam}
            />
          )}

          {step === "workplace" && (
            <div className="animate-rise">
              <StepBadge index={4} />
              <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.022em] text-[var(--text-primary)]">
                Che lavoro fai?
              </h1>
              <p className="mt-2.5 text-[14.5px] leading-relaxed text-[var(--text-secondary)]">
                L'ultima, poi entri.
              </p>
              <div className="mt-7 flex flex-col gap-2">
                {WORKPLACES.map((w, i) => (
                  <button
                    key={w}
                    disabled={busy}
                    onClick={() => pickWorkplace(w)}
                    className="animate-rise rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3.5 text-left text-[14.5px] text-[var(--text-primary)] transition-all duration-[var(--fast)] hover:-translate-y-px hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:shadow-[var(--shadow-1)] disabled:opacity-50"
                    style={{ animationDelay: `${i * 40}ms` }}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>
          )}

          {problem && (
            <p className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3 text-[13px] leading-relaxed text-[var(--text-secondary)]">
              {problem}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/** "Passaggio 2 di 4" con la barra: sotto lg è l'unico indicatore che resta. */
function StepBadge({ index }: { index: number }) {
  return (
    <div className="mb-6">
      <div className="mb-2.5 flex items-center justify-between">
        <span className="t-label text-grad">Passaggio {index} di 4</span>
        <span className="text-[12px] text-[var(--text-tertiary)]">
          {4 - index === 0 ? "ultimo" : `ne mancano ${4 - index}`}
        </span>
      </div>
      <div className="h-[3px] w-full overflow-hidden rounded-full bg-[var(--border)]">
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-[var(--ease-out)]"
          style={{ width: `${(index / 4) * 100}%`, background: "var(--grad-primary)" }}
        />
      </div>
    </div>
  );
}

/**
 * I pulsanti d'accesso, oppure la spiegazione di cosa manca.
 *
 * Un pulsante che porta a una pagina di errore è peggio di nessun pulsante:
 * finché Google non è configurato si dice quale variabile manca e dove sta
 * scritto come sistemarla, invece di lasciar premere a vuoto.
 */
function LoginButtons({
  config,
  busy,
  onEnter,
}: {
  config: PublicConfig;
  busy: boolean;
  onEnter: (provider: "google" | "apple") => void;
}) {
  if (!config.databaseReady) {
    return (
      <Notice
        title="Il database non è collegato"
        body="Manca DATABASE_URL in .env.local. Gli accessi vivono dentro Neon, quindi senza database non si entra. Istruzioni in docs/SETUP-DATABASE.md."
      />
    );
  }

  if (config.providers.length === 0) {
    return (
      <Notice
        title="Gli accessi non sono ancora configurati"
        body={
          config.missing.length > 0
            ? `Mancano: ${config.missing.join(", ")}. Poi servono GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET. Istruzioni in docs/SETUP-ACCESSI.md.`
            : "Mancano GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET in .env.local. Istruzioni in docs/SETUP-ACCESSI.md."
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {config.providers.includes("google") && (
        <button
          disabled={busy}
          onClick={() => onEnter("google")}
          className="flex h-13 items-center justify-center gap-2.5 rounded-xl border border-[var(--border-strong)] bg-white py-3.5 text-[14.5px] font-medium text-[var(--text-primary)] shadow-[var(--shadow-1)] transition-all duration-[var(--fast)] hover:-translate-y-px hover:shadow-[var(--shadow-2)] disabled:opacity-50"
        >
          <GoogleGlyph />
          {busy ? "Ti sto portando su Google..." : "Continua con Google"}
        </button>
      )}

      {/* Apple compare solo con l'account sviluppatore (99 €/anno) configurato:
          finché manca, il pulsante non c'è e niente si rompe. */}
      {config.providers.includes("apple") && (
        <button
          disabled={busy}
          onClick={() => onEnter("apple")}
          className="flex items-center justify-center gap-2.5 rounded-xl bg-[var(--text-primary)] py-3.5 text-[14.5px] font-medium text-[var(--bg-card)] transition-all duration-[var(--fast)] hover:-translate-y-px hover:opacity-90 disabled:opacity-50"
        >
          <AppleGlyph />
          Continua con Apple
        </button>
      )}
    </div>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
      <div className="text-[14px] font-medium text-[var(--text-primary)]">{title}</div>
      <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--text-secondary)]">{body}</p>
    </div>
  );
}

function Question({
  index,
  title,
  sub,
  options,
  onPick,
}: {
  index: number;
  title: string;
  sub: string;
  options: Array<{ label: string; hint: string; icon: React.ReactNode }>;
  onPick: (label: string) => void;
}) {
  return (
    <div className="animate-rise">
      <StepBadge index={index} />
      <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.022em] text-[var(--text-primary)]">
        {title}
      </h1>
      <p className="mt-2.5 text-[14.5px] leading-relaxed text-[var(--text-secondary)]">{sub}</p>
      <div className="mt-7 flex flex-col gap-2">
        {options.map((o, i) => (
          <button
            key={o.label}
            onClick={() => onPick(o.label)}
            className="animate-rise group flex items-center gap-3.5 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3.5 text-left transition-all duration-[var(--fast)] hover:-translate-y-px hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:shadow-[var(--shadow-1)]"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <span className="shrink-0 text-[var(--text-tertiary)] transition-colors group-hover:text-[var(--accent)]">
              {o.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14.5px] text-[var(--text-primary)]">{o.label}</span>
              {o.hint && (
                <span className="block text-[12.5px] text-[var(--text-secondary)]">{o.hint}</span>
              )}
            </span>
            <span className="shrink-0 text-[var(--text-tertiary)] opacity-0 transition-opacity group-hover:opacity-100">
              →
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

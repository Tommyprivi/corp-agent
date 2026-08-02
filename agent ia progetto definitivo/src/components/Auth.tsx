import { useEffect, useState } from "react";
import Logo from "./Logo";
import {
  AiIcon,
  AppleGlyph,
  GoogleGlyph,
  PeopleIcon,
  SearchIcon,
  ShieldIcon,
  SinglePersonIcon,
  SocialIcon,
  TeamIcon,
} from "./Icons";
import { authClient, getConfig, saveProfile, type PublicConfig } from "../lib/api";
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
 */
export default function Auth({ onDone }: AuthProps) {
  const { data: session, isPending } = authClient.useSession();
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [step, setStep] = useState<Step>("login");
  const [answers, setAnswers] = useState<SurveyAnswers>({});
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

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

  return (
    <div className="flex h-full w-full items-center justify-center overflow-y-auto bg-[var(--bg-app)] px-6 py-10">
      <div className="w-full max-w-[440px]">
        <div className="mb-10 flex justify-center">
          <Logo size={28} />
        </div>

        {step === "login" && (
          <div>
            <h1 className="text-center text-[26px] font-semibold leading-tight tracking-[-0.02em] text-[var(--text-primary)]">
              Accedi a CorpAgent
            </h1>
            <p className="mt-2.5 text-center text-[14.5px] text-[var(--text-secondary)]">
              Nessun modulo da compilare. Scegli un account e sei dentro.
            </p>

            <div className="mt-9">
              {isPending || !config ? (
                <p className="text-center text-[13.5px] text-[var(--text-secondary)]">
                  Un istante...
                </p>
              ) : (
                <LoginButtons config={config} busy={busy} onEnter={enter} />
              )}
            </div>
          </div>
        )}

        {step === "captcha" && (
          <div>
            <h1 className="text-center text-[24px] font-semibold leading-tight tracking-[-0.02em] text-[var(--text-primary)]">
              Verifica di sicurezza
            </h1>
            <p className="mt-2.5 text-center text-[14.5px] text-[var(--text-secondary)]">
              Serve solo a tenere fuori i bot.
            </p>
            <div className="mt-8 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
              <div className="flex items-center gap-3">
                <span className="text-[var(--accent)]">
                  <ShieldIcon size={24} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-medium text-[var(--text-primary)]">
                    Confermo di non essere un robot
                  </div>
                  <div className="text-[12.5px] text-[var(--text-secondary)]">
                    Segnaposto: al lancio qui ci sarà Cloudflare Turnstile.
                  </div>
                </div>
              </div>
              <button
                onClick={() => setStep("source")}
                className="mt-4 w-full rounded-xl bg-[var(--accent)] py-3 text-[14.5px] font-medium text-white transition-colors hover:bg-[var(--accent-hover)]"
              >
                Continua
              </button>
            </div>
          </div>
        )}

        {step === "source" && (
          <Question
            index={1}
            title="Come ci hai conosciuto?"
            options={SOURCES}
            onPick={pickSource}
          />
        )}

        {step === "team" && (
          <Question
            index={2}
            title="Lavori da solo o in team?"
            options={TEAM_SIZES}
            onPick={pickTeam}
          />
        )}

        {step === "workplace" && (
          <div>
            <Progress index={3} />
            <h1 className="text-[24px] font-semibold leading-tight tracking-[-0.02em] text-[var(--text-primary)]">
              Dove lavori?
            </h1>
            <div className="mt-7 flex flex-col gap-2">
              {WORKPLACES.map((w) => (
                <button
                  key={w}
                  disabled={busy}
                  onClick={() => pickWorkplace(w)}
                  className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3.5 text-left text-[14.5px] text-[var(--text-primary)] transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] disabled:opacity-50"
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
          className="flex h-12 items-center justify-center gap-2.5 rounded-xl border border-[var(--border-strong)] bg-white text-[14.5px] font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--fill-quiet)] disabled:opacity-50"
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
          className="flex h-12 items-center justify-center gap-2.5 rounded-xl bg-[var(--text-primary)] text-[14.5px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
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
  options,
  onPick,
}: {
  index: number;
  title: string;
  options: Array<{ label: string; hint: string; icon: React.ReactNode }>;
  onPick: (label: string) => void;
}) {
  return (
    <div>
      <Progress index={index} />
      <h1 className="text-[24px] font-semibold leading-tight tracking-[-0.02em] text-[var(--text-primary)]">
        {title}
      </h1>
      <div className="mt-7 flex flex-col gap-2">
        {options.map((o) => (
          <button
            key={o.label}
            onClick={() => onPick(o.label)}
            className="flex items-center gap-3.5 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3.5 text-left transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]"
          >
            <span className="shrink-0 text-[var(--text-secondary)]">{o.icon}</span>
            <span className="min-w-0">
              <span className="block text-[14.5px] text-[var(--text-primary)]">{o.label}</span>
              {o.hint && (
                <span className="block text-[12.5px] text-[var(--text-secondary)]">{o.hint}</span>
              )}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Progress({ index }: { index: number }) {
  return (
    <div className="mb-8">
      <div className="mb-3 flex items-center justify-between text-[12px] text-[var(--text-secondary)]">
        <span>Domanda {index} di 3</span>
        <span>Serve a personalizzare il tuo agente</span>
      </div>
      <div className="h-[3px] w-full overflow-hidden rounded-full bg-[var(--border)]">
        <div
          className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-300"
          style={{ width: `${(index / 3) * 100}%` }}
        />
      </div>
    </div>
  );
}

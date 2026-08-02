import { useEffect, useRef, useState } from "react";
import Logo from "../Logo";
import {
  ChatSparkIcon,
  CheckIcon,
  ChevronRightIcon,
  ImageIcon,
  MicIcon,
  ShieldIcon,
  SparkleIcon,
} from "../Icons";
import ChatDemo from "../landing/ChatDemo";
import Counter from "../landing/Counter";
import Faq from "../landing/Faq";
import { useReveal } from "../landing/useReveal";
import { PLANS } from "../../data/plans";

interface LandingProps {
  onStart: () => void;
}

type Page = "home" | "docs" | "terms" | "privacy";

/**
 * La vetrina pubblica.
 *
 * Struttura decisa da Tommaso il 2 Agosto 2026, ordine "vendita diretta":
 * l'effetto wow e la prova per primi, i prezzi presto, le obiezioni alla fine.
 * Chi arriva qui decide in trenta secondi, quindi il valore va mostrato prima
 * di essere spiegato — da lì la demo che si scrive da sola nell'hero.
 *
 * Hero scuro, resto chiaro: il contrasto fa da sipario.
 */
export default function Landing({ onStart }: LandingProps) {
  const [page, setPage] = useState<Page>("home");

  return (
    <div className="h-full overflow-y-auto bg-[var(--bg-card)]">
      {page === "home" ? (
        <HomePage onStart={onStart} onNavigate={setPage} />
      ) : (
        <>
          <PublicHeader onStart={onStart} page={page} onNavigate={setPage} dark={false} />
          {page === "docs" && <Docs />}
          {page === "terms" && <Terms />}
          {page === "privacy" && <Privacy />}
        </>
      )}

      <footer className="border-t border-[var(--border)] px-6 py-10">
        <div className="mx-auto flex max-w-[1100px] flex-col items-center gap-3 text-center">
          <Logo size={20} />
          <div className="flex flex-wrap justify-center gap-4 text-[13px] text-[var(--text-secondary)]">
            <button onClick={() => setPage("docs")} className="hover:text-[var(--text-primary)]">Documentazione</button>
            <button onClick={() => setPage("terms")} className="hover:text-[var(--text-primary)]">Termini di servizio</button>
            <button onClick={() => setPage("privacy")} className="hover:text-[var(--text-primary)]">Privacy</button>
          </div>
          <p className="text-[12px] text-[var(--text-secondary)]">
            CorpAgent — lavoratori digitali IA per negozi, ristoranti e PMI italiane.
          </p>
        </div>
      </footer>
    </div>
  );
}

/** La testata. Sopra l'hero scuro è trasparente, sulle pagine chiare è vetro. */
function PublicHeader({
  onStart,
  page,
  onNavigate,
  dark,
}: {
  onStart: () => void;
  page: Page;
  onNavigate: (p: Page) => void;
  dark: boolean;
}) {
  return (
    <header
      className={
        dark
          ? "absolute inset-x-0 top-0 z-20"
          : "glass sticky top-0 z-20 border-b border-[var(--border)]"
      }
    >
      <div className="mx-auto flex max-w-[1100px] items-center gap-6 px-6 py-4">
        <button
          onClick={() => onNavigate("home")}
          className={`shrink-0 ${dark ? "text-white [&_*]:text-white" : ""}`}
        >
          <Logo size={24} />
        </button>
        <nav className="hidden flex-1 gap-6 sm:flex">
          {(["docs", "terms", "privacy"] as const).map((p) => (
            <button
              key={p}
              onClick={() => onNavigate(p)}
              className="text-[13.5px] transition-colors"
              style={{
                color: dark
                  ? "var(--hero-text-dim)"
                  : page === p
                    ? "var(--text-primary)"
                    : "var(--text-secondary)",
              }}
            >
              {p === "docs" ? "Documentazione" : p === "terms" ? "Termini" : "Privacy"}
            </button>
          ))}
        </nav>
        <button
          onClick={onStart}
          className="btn-grad ml-auto shrink-0 rounded-full px-5 py-2 text-[13.5px] font-medium"
        >
          Prova CorpAgent
        </button>
      </div>
    </header>
  );
}

function HomePage({ onStart, onNavigate }: { onStart: () => void; onNavigate: (p: Page) => void }) {
  useReveal();

  return (
    <>
      <Hero onStart={onStart} onNavigate={onNavigate} />
      <ModelsStrip />
      <HowItWorks />
      <Numbers />
      <Pricing onStart={onStart} />
      <Talents />
      <FaqSection />
      <FinalCta onStart={onStart} />
    </>
  );
}

/* ────────────────────────── 1. HERO ────────────────────────── */

function Hero({ onStart, onNavigate }: { onStart: () => void; onNavigate: (p: Page) => void }) {
  const ref = useRef<HTMLElement>(null);

  /**
   * Il bagliore segue il puntatore. Si scrivono due variabili CSS invece di
   * rifare il render a ogni movimento del mouse: React non se ne accorge
   * nemmeno, e la pagina non perde un fotogramma.
   */
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const move = (e: MouseEvent) => {
      const box = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${((e.clientX - box.left) / box.width) * 100}%`);
      el.style.setProperty("--my", `${((e.clientY - box.top) / box.height) * 100}%`);
    };
    el.addEventListener("mousemove", move);
    return () => el.removeEventListener("mousemove", move);
  }, []);

  const title = ["Il", "tuo", "dipendente", "IA,"];
  const title2 = ["creato", "in", "30", "secondi"];

  return (
    <section
      ref={ref}
      className="on-dark relative overflow-hidden px-6 pb-24 pt-28 md:pb-32"
      style={{ background: "var(--hero-bg)" }}
    >
      <PublicHeader onStart={onStart} page="home" onNavigate={onNavigate} dark />

      {/* Aurora e sfere: la profondità dell'hero */}
      <div aria-hidden className="orb orb-violet animate-aurora left-[-4%] top-[-80px] h-[460px] w-[460px]" />
      <div aria-hidden className="orb orb-cyan animate-aurora right-[-6%] top-[60px] h-[420px] w-[420px]" style={{ animationDelay: "-5s" }} />
      <div aria-hidden className="orb orb-blue animate-aurora bottom-[-140px] left-[38%] h-[380px] w-[380px]" style={{ animationDelay: "-8s" }} />
      <div aria-hidden className="hero-glow" />

      <div className="relative mx-auto grid max-w-[1100px] items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]">
        {/* Colonna sinistra: il messaggio */}
        <div className="text-center lg:text-left">
          <span
            className="word-rise inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium"
            style={{
              borderColor: "var(--hero-border)",
              background: "var(--hero-card)",
              color: "var(--hero-text-dim)",
            }}
          >
            <SparkleIcon size={13} />
            OpenAI · Anthropic · Google — scelti in automatico
          </span>

          <h1
            className="mt-7 text-[42px] font-semibold leading-[1.04] tracking-[-0.034em] md:text-[64px]"
            style={{ color: "var(--hero-text)" }}
          >
            {title.map((w, i) => (
              <span key={w} className="word-rise-w" style={{ animationDelay: `${0.1 + i * 0.08}s` }}>
                {w}
              </span>
            ))}
            <br />
            {title2.map((w, i) => (
              <span
                key={w}
                className="word-rise-w text-grad"
                style={{ animationDelay: `${0.42 + i * 0.08}s` }}
              >
                {w}
              </span>
            ))}
            <span className="word-rise-w" style={{ animationDelay: "0.74s" }}>
              chattando
            </span>
          </h1>

          <p
            className="word-rise mx-auto mt-6 max-w-[520px] text-[17px] leading-relaxed lg:mx-0"
            style={{ animationDelay: "0.85s", color: "var(--hero-text-dim)" }}
          >
            Risponde ai clienti su WhatsApp 24 ore su 24, non sbaglia mai i prezzi, e ti
            restituisce le ore che passi a rispondere sempre alle stesse domande.
          </p>

          <div
            className="word-rise mt-9 flex flex-col items-center gap-3 sm:flex-row lg:justify-start"
            style={{ animationDelay: "0.95s" }}
          >
            <button
              onClick={onStart}
              className="btn-grad inline-flex items-center gap-1.5 rounded-full px-8 py-4 text-[16px] font-medium"
            >
              Prova CorpAgent
              <ChevronRightIcon size={17} />
            </button>
            <span className="text-[13px]" style={{ color: "var(--hero-text-dim)" }}>
              Gratis, senza carta di credito
            </span>
          </div>
        </div>

        {/* Colonna destra: il prodotto che lavora */}
        <div className="word-rise" style={{ animationDelay: "0.6s" }}>
          <ChatDemo />
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────── 2. MODELLI ────────────────────────── */

const MODEL_BRANDS = [
  "OpenAI",
  "Anthropic",
  "Google DeepMind",
  "Meta Llama",
  "Mistral AI",
  "DeepSeek",
  "Qwen",
  "Perplexity",
  "xAI Grok",
  "Cohere",
];

function ModelsStrip() {
  return (
    <section className="border-b border-[var(--border)] bg-[var(--bg-app)] py-8">
      <p className="t-label mb-5 text-center text-[var(--text-tertiary)]">
        Alimentato dai migliori modelli al mondo
      </p>
      {/* Le due maschere ai lati fanno sfumare i loghi invece di tagliarli netti */}
      <div
        className="relative overflow-hidden"
        style={{
          maskImage: "linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)",
          WebkitMaskImage: "linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)",
        }}
      >
        {/* La lista è doppia: quando la prima metà è scorsa via, la seconda è
            già al suo posto e il giro riparte senza salti. */}
        <div className="marquee">
          {[...MODEL_BRANDS, ...MODEL_BRANDS].map((brand, i) => (
            <span
              key={`${brand}-${i}`}
              className="whitespace-nowrap px-8 text-[17px] font-medium text-[var(--text-tertiary)]"
            >
              {brand}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────── 3. COME FUNZIONA ────────────────────────── */

function HowItWorks() {
  const steps = [
    {
      n: "1",
      title: "Racconta cosa fai",
      body: "Rispondi a tre domande. Il Master Builder capisce il tuo mestiere e ti monta l'agente giusto, senza configurazioni.",
    },
    {
      n: "2",
      title: "Carica il menù o il listino",
      body: "L'agente risponde solo con quello che c'è nei tuoi documenti. Niente prezzi inventati, niente sconti non autorizzati.",
    },
    {
      n: "3",
      title: "Collega WhatsApp",
      body: "Un QR code, come WhatsApp Web. Dal momento dopo i tuoi clienti hanno risposta anche a mezzanotte.",
    },
  ];

  return (
    <Section>
      <SectionHead label="Come funziona" title="Operativo in tre passaggi" />
      <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-3">
        {steps.map((s, i) => (
          <div
            key={s.n}
            className="reveal group relative rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-[var(--shadow-1)] transition-all duration-[var(--normal)] hover:-translate-y-1 hover:border-[var(--accent)] hover:shadow-[var(--shadow-3)]"
            style={{ transitionDelay: `${i * 110}ms` }}
          >
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl text-[15px] font-semibold transition-transform duration-[var(--normal)] group-hover:scale-110"
              style={{ background: "var(--grad-primary)", color: "var(--on-primary)" }}
            >
              {s.n}
            </div>
            <h3 className="mt-4 text-[17px] font-medium text-[var(--text-primary)]">{s.title}</h3>
            <p className="mt-2 text-[14px] leading-relaxed text-[var(--text-secondary)]">{s.body}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ────────────────────────── 4. NUMERI ────────────────────────── */

function Numbers() {
  return (
    <section className="border-y border-[var(--border)] bg-[var(--bg-app)] px-6 py-16">
      <div className="mx-auto grid max-w-[1100px] grid-cols-2 gap-8 lg:grid-cols-4">
        <Stat value={<Counter to={337} />} label="modelli IA disponibili" note="dal catalogo vivo" />
        <Stat value={<Counter to={24} suffix="/7" />} label="ore di presenza" note="anche a Ferragosto" />
        <Stat value={<><Counter to={3} /> min</>} label="risparmiati per messaggio" note="calcolo dichiarato" />
        <Stat value={<><Counter to={30} /> sec</>} label="per creare il tuo agente" note="chattando, non configurando" />
      </div>
      <p className="mx-auto mt-8 max-w-[600px] text-center text-[12px] leading-relaxed text-[var(--text-tertiary)]">
        Il risparmio è una stima dichiarata, non una promessa contrattuale: circa 3 minuti
        per ogni messaggio che l'agente gestisce senza di te.
      </p>
    </section>
  );
}

function Stat({ value, label, note }: { value: React.ReactNode; label: string; note: string }) {
  return (
    <div className="reveal text-center">
      <div className="text-grad text-[40px] font-semibold leading-none tracking-[-0.03em] md:text-[52px]">
        {value}
      </div>
      <div className="mt-2.5 text-[14px] font-medium text-[var(--text-primary)]">{label}</div>
      <div className="mt-0.5 text-[12.5px] text-[var(--text-tertiary)]">{note}</div>
    </div>
  );
}

/* ────────────────────────── 5. PREZZI ────────────────────────── */

function Pricing({ onStart }: { onStart: () => void }) {
  // Quattro dei cinque piani: Enterprise ha un percorso commerciale suo e in
  // una griglia di prezzi confonde chi deve decidere in trenta secondi.
  const shown = PLANS.filter((p) => p.id !== "enterprise").slice(0, 4);

  return (
    <Section>
      <SectionHead
        label="Prezzi"
        title="Si parte gratis, si cresce quando serve"
        sub="Nessuna carta di credito per iniziare. Si disdice quando vuoi."
      />
      <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
        {shown.map((plan, i) => {
          const featured = plan.id === "business";
          return (
            <div
              key={plan.id}
              className={`reveal relative flex flex-col rounded-2xl p-6 transition-all duration-[var(--normal)] hover:-translate-y-1 ${
                featured
                  ? "ring-grad shadow-[var(--shadow-3)]"
                  : "border border-[var(--border)] bg-[var(--bg-card)] shadow-[var(--shadow-1)] hover:shadow-[var(--shadow-2)]"
              }`}
              style={{ transitionDelay: `${i * 90}ms` }}
            >
              {featured && (
                <span
                  className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide"
                  style={{ background: "var(--grad-primary)", color: "var(--on-primary)" }}
                >
                  Il più scelto
                </span>
              )}
              <div className="text-[15px] font-semibold text-[var(--text-primary)]">{plan.name}</div>
              <div className="mt-3 flex items-baseline gap-1.5">
                <span
                  className={`text-[34px] font-semibold leading-none tracking-[-0.03em] ${
                    featured ? "text-grad" : "text-[var(--text-primary)]"
                  }`}
                >
                  {plan.price}
                </span>
                <span className="text-[13px] text-[var(--text-secondary)]">{plan.cadence}</span>
              </div>
              <p className="mt-3 min-h-[42px] text-[13px] leading-relaxed text-[var(--text-secondary)]">
                {plan.pitch}
              </p>
              <ul className="mt-4 flex flex-1 flex-col gap-2.5 border-t border-[var(--border)] pt-4">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-[13px] leading-relaxed">
                    <span className="mt-0.5 shrink-0 text-[var(--positive)]">
                      <CheckIcon size={14} />
                    </span>
                    <span className="text-[var(--text-secondary)]">{f}</span>
                  </li>
                ))}
              </ul>
              <button
                onClick={onStart}
                className={`mt-6 w-full rounded-xl py-3 text-[14px] font-medium transition-all ${
                  featured
                    ? "btn-grad"
                    : "border border-[var(--border-strong)] text-[var(--text-primary)] hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]"
                }`}
              >
                {plan.id === "free" ? "Inizia gratis" : "Scegli " + plan.name}
              </button>
            </div>
          );
        })}
      </div>
      <p className="reveal mt-8 text-center text-[13px] text-[var(--text-secondary)]">
        Serve di più? C'è anche il piano <strong className="text-[var(--text-primary)]">Enterprise</strong>{" "}
        con supporto dedicato e multi-postazione.
      </p>
    </Section>
  );
}

/* ────────────────────────── 6. TALENTI ────────────────────────── */

function Talents() {
  const items = [
    {
      icon: <ChatSparkIcon size={19} />,
      title: "Risponde davvero",
      body: "Ogni risposta viene dai modelli più capaci al mondo, scelti da soli in base a quanto è difficile la domanda.",
    },
    {
      icon: <MicIcon size={19} />,
      title: "Parla e ascolta",
      body: "Detti un messaggio a voce, e le risposte puoi fartele leggere con una voce naturale in italiano.",
    },
    {
      icon: <ImageIcon size={19} />,
      title: "Crea immagini",
      body: "Il post per il piatto del giorno o la locandina della promozione: la descrivi e te la disegna.",
    },
    {
      icon: <ShieldIcon size={19} />,
      title: "Non inventa mai",
      body: "Prezzi, orari e condizioni escono solo dai tuoi documenti. Se non lo sa, lo dice — non indovina.",
    },
  ];

  return (
    <section className="border-y border-[var(--border)] bg-[var(--bg-app)] px-6 py-20">
      <div className="mx-auto max-w-[1100px]">
        <SectionHead label="Capacità" title="Un dipendente, molti talenti" />
        <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((it, i) => (
            <div
              key={it.title}
              className="reveal group rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-[var(--shadow-1)] transition-all duration-[var(--normal)] hover:-translate-y-1 hover:shadow-[var(--shadow-3)]"
              style={{ transitionDelay: `${i * 90}ms` }}
            >
              <span className="ring-grad flex h-11 w-11 items-center justify-center rounded-xl text-[var(--accent)] transition-transform duration-[var(--normal)] group-hover:scale-110">
                {it.icon}
              </span>
              <h3 className="mt-4 text-[16px] font-medium text-[var(--text-primary)]">{it.title}</h3>
              <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--text-secondary)]">
                {it.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────── 7. FAQ ────────────────────────── */

function FaqSection() {
  return (
    <Section>
      <SectionHead label="Dubbi" title="Le domande che ci fanno tutti" />
      <div className="mt-10">
        <Faq />
      </div>
    </Section>
  );
}

/* ────────────────────────── 8. CHIUSURA ────────────────────────── */

function FinalCta({ onStart }: { onStart: () => void }) {
  return (
    <section
      className="on-dark relative overflow-hidden px-6 py-24 text-center"
      style={{ background: "var(--hero-bg)" }}
    >
      <div aria-hidden className="orb orb-violet animate-aurora left-[18%] top-[-60px] h-[340px] w-[340px]" />
      <div aria-hidden className="orb orb-cyan animate-aurora right-[16%] bottom-[-80px] h-[320px] w-[320px]" style={{ animationDelay: "-6s" }} />

      <div className="reveal relative mx-auto max-w-[720px]">
        <h2
          className="text-[32px] font-semibold leading-[1.1] tracking-[-0.028em] md:text-[44px]"
          style={{ color: "var(--hero-text)" }}
        >
          I tuoi clienti stanno <span className="text-grad">scrivendo adesso</span>
        </h2>
        <p className="mx-auto mt-5 max-w-[540px] text-[16px] leading-relaxed" style={{ color: "var(--hero-text-dim)" }}>
          Per un ristorante, un negozio o uno studio WhatsApp non è un canale secondario:
          è l'ufficio. CorpAgent lavora dove sono già i tuoi clienti — nessuna app da far
          scaricare a nessuno.
        </p>
        <button
          onClick={onStart}
          className="btn-grad mt-9 inline-flex items-center gap-1.5 rounded-full px-8 py-4 text-[16px] font-medium"
        >
          Crea il tuo agente
          <ChevronRightIcon size={17} />
        </button>
        <p className="mt-3.5 text-[13px]" style={{ color: "var(--hero-text-dim)" }}>
          Trenta secondi. Nessuna carta di credito.
        </p>
      </div>
    </section>
  );
}

/* ────────────────────────── PEZZI CONDIVISI ────────────────────────── */

function Section({ children }: { children: React.ReactNode }) {
  return (
    <section className="px-6 py-20">
      <div className="mx-auto max-w-[1100px]">{children}</div>
    </section>
  );
}

function SectionHead({ label, title, sub }: { label: string; title: string; sub?: string }) {
  return (
    <div className="reveal text-center">
      <span className="t-label text-grad inline-block">{label}</span>
      <h2 className="mt-3 text-[28px] font-semibold tracking-[-0.026em] text-[var(--text-primary)] md:text-[38px]">
        {title}
      </h2>
      {sub && (
        <p className="mx-auto mt-3 max-w-[520px] text-[15px] leading-relaxed text-[var(--text-secondary)]">
          {sub}
        </p>
      )}
    </div>
  );
}

function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="px-6 py-14">
      <div className="mx-auto max-w-[680px]">
        <h1 className="text-[30px] font-semibold tracking-[-0.025em] text-[var(--text-primary)]">
          {title}
        </h1>
        <div className="mt-7 flex flex-col gap-5 text-[14.5px] leading-relaxed text-[var(--text-secondary)]">
          {children}
        </div>
      </div>
    </section>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-3 text-[17px] font-medium text-[var(--text-primary)]">{children}</h2>;
}

function Docs() {
  return (
    <LegalPage title="Documentazione">
      <p>
        CorpAgent crea agenti IA che rispondono ai tuoi clienti. Non serve saper
        programmare: si conversa, e l'agente nasce.
      </p>
      <H2>Il Master Builder</H2>
      <p>
        È la prima cosa che vedi. Ti chiede di cosa ti occupi, cosa ti fa perdere più tempo
        e dove ti scrivono i clienti. Da queste tre risposte genera l'agente, ti consiglia
        il connettore da collegare e il piano più adatto, spiegandoti il perché di ognuno.
      </p>
      <H2>I modelli IA</H2>
      <p>
        Le risposte arrivano dai modelli migliori al mondo tramite un gateway unico. Di
        base la scelta è automatica: le domande semplici vanno a un modello veloce, quelle
        difficili a uno profondo, e se una richiesta costa più del normale te lo dice prima
        di procedere. Se preferisci, puoi scegliere il modello a mano dal selettore in chat.
      </p>
      <H2>Voce e immagini</H2>
      <p>
        Puoi dettare i messaggi col microfono e farti leggere le risposte con una voce
        naturale in italiano. Dalla stessa casella puoi anche generare immagini: descrivi
        quello che vuoi e premi il pennello.
      </p>
      <H2>La base di conoscenza</H2>
      <p>
        Carichi il menù, il listino o il tariffario. L'agente risponde usando solo quello
        che trova in quei documenti: è il meccanismo che gli impedisce di inventare prezzi.
        Puoi togliere un documento in qualsiasi momento.
      </p>
      <H2>Il canale WhatsApp</H2>
      <p>
        Si collega con un QR code, come WhatsApp Web: inquadri col telefono del locale e il
        canale è attivo. Da quel momento i clienti scrivono al tuo numero e trovano
        risposta anche fuori orario.
      </p>
      <H2>Il Contatore Risparmio</H2>
      <p>
        Mostra le ore che l'agente ti ha tolto dalle mani e quanto valgono. Il calcolo è
        dichiarato: circa 3 minuti risparmiati per ogni messaggio gestito senza di te.
      </p>
      <H2>Stato di sviluppo</H2>
      <p>
        Le risposte dell'agente sono reali: la chat è collegata ai modelli IA dal 2 Agosto
        2026. La lettura dei documenti caricati e il collegamento a WhatsApp Business
        arrivano prima della beta di Novembre 2026, e l'interfaccia dichiara sempre cosa è
        già attivo e cosa no.
      </p>
    </LegalPage>
  );
}

function Terms() {
  return (
    <LegalPage title="Termini di servizio">
      <p>
        <strong className="text-[var(--text-primary)]">Bozza non definitiva.</strong> Questo
        testo è un segnaposto scritto durante lo sviluppo. Prima del lancio commerciale
        dovrà essere redatto o verificato da un legale: non usarlo come contratto valido.
      </p>
      <H2>Oggetto del servizio</H2>
      <p>
        CorpAgent fornisce un servizio software che permette di creare e gestire assistenti
        conversazionali basati su intelligenza artificiale, collegabili a canali di
        messaggistica.
      </p>
      <H2>Responsabilità sui contenuti generati</H2>
      <p>
        Le risposte, le immagini e l'audio prodotti dagli agenti derivano dai documenti
        caricati dall'utente e dai modelli IA di terze parti. L'utente resta responsabile
        di verificare prezzi, condizioni commerciali e informazioni comunicate ai propri
        clienti.
      </p>
      <H2>Account e uso corretto</H2>
      <p>
        L'utente è responsabile delle credenziali di accesso e si impegna a non usare il
        servizio per invii massivi non richiesti, contenuti illeciti o attività che violino
        i termini dei canali collegati.
      </p>
      <H2>Abbonamenti</H2>
      <p>
        I piani sono mensili e disdicibili. In caso di esaurimento dei consumi inclusi, il
        servizio propone una ricarica invece di interrompersi senza preavviso.
      </p>
    </LegalPage>
  );
}

function Privacy() {
  return (
    <LegalPage title="Privacy">
      <p>
        <strong className="text-[var(--text-primary)]">Bozza non definitiva.</strong> Anche
        questo testo va verificato da un legale prima del lancio, in particolare sugli
        obblighi GDPR verso i clienti finali delle aziende che usano CorpAgent.
      </p>
      <H2>Dati che raccogliamo</H2>
      <p>
        Dati dell'account (nome, email, provider di accesso), i documenti che carichi nella
        base di conoscenza, e le conversazioni gestite dagli agenti.
      </p>
      <H2>Dove finiscono i tuoi documenti</H2>
      <p>
        I contenuti necessari a rispondere vengono inviati ai fornitori di modelli IA
        tramite un gateway unico; testo per la voce e descrizioni per le immagini vanno ai
        rispettivi fornitori. L'obiettivo dichiarato del progetto è configurare accordi
        che escludano l'uso dei tuoi dati per addestrare modelli futuri.
      </p>
      <H2>Dati sensibili</H2>
      <p>
        È previsto un filtro che oscura automaticamente dati come numeri di carta e codici
        fiscali prima dell'invio ai modelli. Questa funzione non è ancora attiva in questa
        versione di sviluppo.
      </p>
      <H2>Cancellazione</H2>
      <p>
        Puoi rimuovere un documento dalla base di conoscenza quando vuoi. La cancellazione
        completa dell'account e dei dati collegati sarà disponibile con il rilascio
        dell'area account.
      </p>
    </LegalPage>
  );
}

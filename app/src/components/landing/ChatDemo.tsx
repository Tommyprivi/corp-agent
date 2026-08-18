import { useEffect, useRef, useState } from "react";
import { LogoMark } from "../Logo";

/**
 * La conversazione che si scrive da sola nell'hero.
 *
 * Mostra il prodotto in azione invece di descriverlo: un cliente scrive al
 * numero del locale e l'agente risponde con il prezzo giusto. I mestieri
 * ruotano — pizzeria, parrucchiere, negozio, palestra — perché chiunque
 * arrivi sulla pagina si riconosca in uno dei quattro.
 *
 * Le risposte non arrivano da un modello: sono scritte qui. È una vetrina, e
 * chiamare l'IA a ogni visita costerebbe soldi veri per un'animazione.
 */

interface Scene {
  emoji: string;
  business: string;
  question: string;
  answer: string;
}

const SCENES: Scene[] = [
  {
    emoji: "🍕",
    business: "Pizzeria Da Mario",
    question: "Avete un tavolo per stasera alle 21?",
    answer: "Sì, alle 21 abbiamo posto. Per quante persone prenoto?",
  },
  {
    emoji: "✂️",
    business: "Salone Anna",
    question: "Quanto costa taglio e piega?",
    answer: "Taglio e piega 35 €. Domani ho libero alle 15 e alle 17.30.",
  },
  {
    emoji: "👗",
    business: "Boutique Luna",
    question: "Avete la taglia M del vestito blu in vetrina?",
    answer: "Sì, ne restano due. Se vuoi te ne metto uno da parte fino a domani.",
  },
  {
    emoji: "🏋️",
    business: "Palestra Nord",
    question: "L'abbonamento mensile quanto viene?",
    answer: "Il mensile è 45 €, l'annuale 390 €. La prima lezione di prova è gratis.",
  },
];

/** Le fasi di un giro. Ogni fase dura il suo tempo, poi si passa alla successiva. */
type Phase = "typing-question" | "sent" | "thinking" | "typing-answer" | "done";

export default function ChatDemo() {
  const [scene, setScene] = useState(0);
  const [phase, setPhase] = useState<Phase>("typing-question");
  const [questionText, setQuestionText] = useState("");
  const [answerText, setAnswerText] = useState("");

  // Un solo contenitore per tutti i timer: allo smontaggio si spengono tutti,
  // altrimenti un componente sparito continuerebbe a chiamare setState.
  const timers = useRef<number[]>([]);
  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  useEffect(() => {
    const current = SCENES[scene];
    timers.current.forEach(clearTimeout);
    timers.current = [];

    setQuestionText("");
    setAnswerText("");
    setPhase("typing-question");

    // 1. La domanda del cliente compare lettera per lettera.
    const QUESTION_SPEED = 38;
    current.question.split("").forEach((_, i) => {
      later(() => setQuestionText(current.question.slice(0, i + 1)), i * QUESTION_SPEED);
    });

    const questionDone = current.question.length * QUESTION_SPEED;

    // 2. Il messaggio parte. 3. L'agente "pensa". 4. Risponde, sempre a lettere.
    later(() => setPhase("sent"), questionDone + 250);
    later(() => setPhase("thinking"), questionDone + 700);

    const answerStart = questionDone + 2000;
    later(() => setPhase("typing-answer"), answerStart);

    const ANSWER_SPEED = 26;
    current.answer.split("").forEach((_, i) => {
      later(() => setAnswerText(current.answer.slice(0, i + 1)), answerStart + i * ANSWER_SPEED);
    });

    const answerDone = answerStart + current.answer.length * ANSWER_SPEED;
    later(() => setPhase("done"), answerDone);

    // 5. Si resta un attimo sul risultato, poi si cambia mestiere.
    later(() => setScene((s) => (s + 1) % SCENES.length), answerDone + 2600);

    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [scene]);

  const current = SCENES[scene];
  const showQuestion = questionText.length > 0;
  const showAnswer = phase === "typing-answer" || phase === "done";

  return (
    <div className="on-dark animate-float mx-auto w-full max-w-[400px]">
      <div
        className="overflow-hidden rounded-[26px] border shadow-[0_30px_80px_rgba(6,10,30,0.55)]"
        style={{ background: "rgba(18,18,22,0.82)", borderColor: "var(--hero-border)", backdropFilter: "blur(18px)" }}
      >
        {/* La testata: fa capire in un colpo che è WhatsApp, senza dirlo */}
        <div
          className="flex items-center gap-3 border-b px-4 py-3"
          style={{ borderColor: "var(--hero-border)" }}
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-[17px]">
            {current.emoji}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13.5px] font-medium text-[var(--hero-text)]">
              {current.business}
            </div>
            <div className="flex items-center gap-1.5 text-[11.5px] text-[var(--hero-text-dim)]">
              <span className="h-[6px] w-[6px] rounded-full bg-[var(--side-positive)]" />
              Agente CorpAgent attivo
            </div>
          </div>
        </div>

        {/* La conversazione. L'altezza è fissa: senza, la pagina sobbalza a
            ogni lettera che arriva. */}
        <div className="flex h-[236px] flex-col gap-3 px-4 py-4">
          {showQuestion && (
            <div className="flex justify-start">
              <div className="max-w-[82%] rounded-2xl rounded-bl-md bg-white/8 px-3.5 py-2.5 text-[13.5px] leading-relaxed text-[var(--hero-text)]">
                <span className={phase === "typing-question" ? "caret" : ""}>{questionText}</span>
              </div>
            </div>
          )}

          {phase === "thinking" && (
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-white/8 text-white">
                <LogoMark size={13} />
              </span>
              <span className="flex items-center gap-1.5">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="animate-breathe h-[6px] w-[6px] rounded-full bg-white/60"
                    style={{ animationDelay: `${i * 0.16}s` }}
                  />
                ))}
              </span>
            </div>
          )}

          {showAnswer && (
            <div className="flex justify-end">
              <div
                className="max-w-[86%] rounded-2xl rounded-br-md px-3.5 py-2.5 text-[13.5px] leading-relaxed"
                style={{ background: "var(--side-accent)", color: "var(--side-on-accent)" }}
              >
                <span className={phase === "typing-answer" ? "caret" : ""}>{answerText}</span>
                {phase === "done" && (
                  <span className="ml-1.5 inline-block align-middle text-[11px] opacity-80">✓✓</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Il piede: dichiara chi ha risposto e in quanto tempo */}
        <div
          className="flex items-center justify-between border-t px-4 py-2.5 text-[11.5px]"
          style={{ borderColor: "var(--hero-border)", color: "var(--hero-text-dim)" }}
        >
          <span>Risposto in 1,4 secondi</span>
          <span className="flex items-center gap-1.5">
            <span className="h-[5px] w-[5px] rounded-full bg-[var(--side-positive)]" />
            senza di te
          </span>
        </div>
      </div>

      {/* I pallini: quale dei quattro mestieri si sta guardando */}
      <div className="mt-5 flex justify-center gap-1.5">
        {SCENES.map((s, i) => (
          <span
            key={s.business}
            className="h-[5px] rounded-full transition-all duration-500"
            style={{
              width: i === scene ? 22 : 5,
              background: i === scene ? "var(--side-accent)" : "rgba(255,255,255,0.2)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

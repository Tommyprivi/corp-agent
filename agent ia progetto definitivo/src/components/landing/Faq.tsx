import { useState } from "react";
import { ChevronDownIcon } from "../Icons";

/**
 * Le domande che si fa chi sta per provare, con le risposte oneste.
 *
 * Una sola aperta alla volta: una fisarmonica con tutto aperto è un muro di
 * testo, e chi legge le FAQ sta cercando una risposta sola.
 */

const QUESTIONS: Array<{ q: string; a: string }> = [
  {
    q: "Devo saper programmare?",
    a: "No, e non serve nemmeno configurare niente. Entri, rispondi a tre domande e parli con il Master Builder come parleresti con un dipendente nuovo: gli dici di cosa ti occupi e ti mette in piedi lui gli agenti, il canale e il piano.",
  },
  {
    q: "Funziona con il mio numero WhatsApp?",
    a: "Serve un numero dedicato all'attività, non quello personale: è una regola di WhatsApp Business, non nostra. Il collegamento si fa con un QR code come WhatsApp Web. La verifica del profilo aziendale la richiede Meta e può volere qualche giorno.",
  },
  {
    q: "E se l'agente inventa un prezzo?",
    a: "È il rischio che ci preoccupa di più, e per questo l'agente ha una regola sopra tutte: non conosce prezzi, orari o condizioni se non glieli hai dati tu nei documenti. Se un cliente chiede qualcosa che non trova nel tuo menù o listino, dice che deve verificare — non indovina.",
  },
  {
    q: "Quali intelligenze artificiali usa?",
    a: "Le migliori disponibili: OpenAI, Anthropic, Google, DeepSeek, Meta, Mistral e altre, tramite un unico collegamento. La scelta è automatica in base alla difficoltà della domanda — una richiesta semplice non deve costare quanto un'analisi — ma puoi anche scegliere il modello a mano dalla chat.",
  },
  {
    q: "Quanto costa davvero?",
    a: "Si parte gratis, senza carta di credito. I piani a pagamento vanno da 9 € al mese e si disdicono quando vuoi. Se i consumi inclusi finiscono, ti proponiamo una ricarica invece di spegnere l'agente senza avvisare.",
  },
  {
    q: "I miei dati e quelli dei clienti dove finiscono?",
    a: "Il database è in Europa. I contenuti necessari a rispondere passano ai fornitori dei modelli tramite un gateway unico, e l'obiettivo dichiarato è avere accordi che escludano l'uso dei tuoi dati per addestrare modelli futuri. È previsto anche un filtro che oscura dati sensibili prima dell'invio: quello non è ancora attivo, e lo diciamo invece di lasciarlo intendere.",
  },
];

export default function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="mx-auto max-w-[760px]">
      {QUESTIONS.map((item, i) => {
        const isOpen = open === i;
        return (
          <div
            key={item.q}
            className="reveal border-b border-[var(--border)]"
            style={{ transitionDelay: `${i * 50}ms` }}
          >
            <button
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-4 py-5 text-left"
            >
              <span
                className={`text-[16px] font-medium transition-colors ${
                  isOpen ? "text-[var(--accent)]" : "text-[var(--text-primary)]"
                }`}
              >
                {item.q}
              </span>
              <span
                className={`shrink-0 text-[var(--text-tertiary)] transition-transform duration-[var(--normal)] ${
                  isOpen ? "rotate-180" : ""
                }`}
              >
                <ChevronDownIcon size={17} />
              </span>
            </button>
            {/* Si apre con la griglia invece che con l'altezza: così l'animazione
                è fluida senza dover conoscere in anticipo quanto è alto il testo. */}
            <div
              className="grid transition-[grid-template-rows,opacity] duration-[var(--normal)] ease-[var(--ease-out)]"
              style={{ gridTemplateRows: isOpen ? "1fr" : "0fr", opacity: isOpen ? 1 : 0 }}
            >
              <div className="overflow-hidden">
                <p className="pb-5 pr-10 text-[14.5px] leading-relaxed text-[var(--text-secondary)]">
                  {item.a}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

import { useState } from "react";
import Logo from "../Logo";
import { ChevronRightIcon } from "../Icons";

interface LandingProps {
  onStart: () => void;
}

type Page = "home" | "docs" | "terms" | "privacy";

export default function Landing({ onStart }: LandingProps) {
  const [page, setPage] = useState<Page>("home");

  return (
    <div className="h-full overflow-y-auto bg-[var(--bg-card)]">
      <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--bg-card)]/85 backdrop-blur">
        <div className="mx-auto flex max-w-[980px] items-center gap-6 px-6 py-3.5">
          <button onClick={() => setPage("home")} className="shrink-0">
            <Logo size={24} />
          </button>
          <nav className="hidden flex-1 gap-5 sm:flex">
            <NavLink label="Documentazione" active={page === "docs"} onClick={() => setPage("docs")} />
            <NavLink label="Termini" active={page === "terms"} onClick={() => setPage("terms")} />
            <NavLink label="Privacy" active={page === "privacy"} onClick={() => setPage("privacy")} />
          </nav>
          <button
            onClick={onStart}
            className="ml-auto shrink-0 rounded-full bg-[var(--accent)] px-4 py-2 text-[13.5px] font-medium text-white transition-colors hover:bg-[var(--accent-hover)]"
          >
            Prova CorpAgent
          </button>
        </div>
      </header>

      {page === "home" && <HomePage onStart={onStart} />}
      {page === "docs" && <Docs />}
      {page === "terms" && <Terms />}
      {page === "privacy" && <Privacy />}

      <footer className="border-t border-[var(--border)] px-6 py-8">
        <div className="mx-auto flex max-w-[980px] flex-col items-center gap-3 text-center">
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

function NavLink({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`text-[13.5px] transition-colors ${
        active ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
      }`}
    >
      {label}
    </button>
  );
}

function HomePage({ onStart }: { onStart: () => void }) {
  return (
    <>
      <section className="px-6 py-20 text-center md:py-28">
        <div className="mx-auto max-w-[720px]">
          <h1 className="text-[38px] font-semibold leading-[1.08] tracking-[-0.03em] text-[var(--text-primary)] md:text-[54px]">
            Il tuo dipendente IA,
            <br />
            creato in 30 secondi chattando
          </h1>
          <p className="mx-auto mt-5 max-w-[520px] text-[17px] leading-relaxed text-[var(--text-secondary)]">
            Risponde ai clienti su WhatsApp 24 ore su 24, non sbaglia mai i prezzi, e ti
            restituisce le ore che passi a rispondere sempre alle stesse domande.
          </p>
          <button
            onClick={onStart}
            className="mt-9 inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-7 py-3.5 text-[16px] font-medium text-white transition-colors hover:bg-[var(--accent-hover)]"
          >
            Prova CorpAgent
            <ChevronRightIcon size={17} />
          </button>
          <p className="mt-3 text-[13px] text-[var(--text-secondary)]">
            Nessuna carta di credito. Nessun modulo da compilare.
          </p>
        </div>
      </section>

      <section className="border-t border-[var(--border)] px-6 py-16">
        <div className="mx-auto max-w-[980px]">
          <h2 className="text-center text-[13px] font-medium uppercase tracking-wide text-[var(--text-secondary)]">
            Come funziona
          </h2>
          <div className="mt-9 grid grid-cols-1 gap-5 md:grid-cols-3">
            <Step
              n="1"
              title="Racconta cosa fai"
              body="Rispondi a tre domande. Il Master Builder capisce il tuo mestiere e ti monta l'agente giusto, senza configurazioni."
            />
            <Step
              n="2"
              title="Carica il menù o il listino"
              body="L'agente risponde solo con quello che c'è nei tuoi documenti. Niente prezzi inventati, niente sconti non autorizzati."
            />
            <Step
              n="3"
              title="Collega WhatsApp"
              body="Un QR code, come WhatsApp Web. Dal momento dopo i tuoi clienti hanno risposta anche a mezzanotte."
            />
          </div>
        </div>
      </section>

      <section className="border-t border-[var(--border)] bg-[var(--bg-app)] px-6 py-16">
        <div className="mx-auto max-w-[720px] text-center">
          <h2 className="text-[26px] font-semibold tracking-[-0.02em] text-[var(--text-primary)] md:text-[32px]">
            Fatto per chi lavora su WhatsApp
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-[var(--text-secondary)]">
            Per un ristorante, un negozio o uno studio, WhatsApp non è un canale
            secondario: è l'ufficio. I clienti chiedono prezzi, prenotano e protestano lì.
            CorpAgent lavora dove sono già i tuoi clienti — nessuna app da far scaricare a
            nessuno.
          </p>
        </div>
      </section>
    </>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[13px] font-semibold text-[var(--accent)]">
        {n}
      </div>
      <h3 className="mt-3.5 text-[16px] font-medium text-[var(--text-primary)]">{title}</h3>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-[var(--text-secondary)]">{body}</p>
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
  return (
    <h2 className="mt-3 text-[17px] font-medium text-[var(--text-primary)]">{children}</h2>
  );
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
        Questa è una versione in costruzione. Le risposte dell'agente sono ancora simulate e
        l'interfaccia lo dichiara ogni volta: il collegamento ai modelli IA e a WhatsApp
        Business arriva prima della beta di Novembre 2026.
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
        Le risposte prodotte dagli agenti derivano dai documenti caricati dall'utente e dai
        modelli IA di terze parti. L'utente resta responsabile di verificare prezzi,
        condizioni commerciali e informazioni comunicate ai propri clienti.
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
        tramite un gateway unico. L'obiettivo dichiarato del progetto è configurare accordi
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

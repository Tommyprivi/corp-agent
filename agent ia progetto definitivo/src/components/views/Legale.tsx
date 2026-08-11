import { useEffect } from "react";
import Logo from "../Logo";

/**
 * I quattro documenti pubblici: documentazione, privacy, termini, cookie.
 *
 * Chiesti da Tommaso l'11 Agosto 2026. Servono per due ragioni diverse, e
 * conviene tenerle distinte:
 *
 * · **La documentazione vende.** Un imprenditore che sta per lasciare il suo
 *   numero vuole capire cosa compra prima di scrivere un'email.
 * · **Gli altri tre sono obblighi.** Il form raccoglie nome, telefono, email e
 *   la descrizione di un'attività: sono dati personali di persone fisiche
 *   identificabili, e il GDPR chiede di dire chi li tratta, perché, per quanto,
 *   e come farli cancellare. La spunta nel form rimanda qui, quindi questa
 *   pagina deve esistere davvero — una spunta che punta al nulla è peggio di
 *   nessuna spunta.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ⚠️ QUESTI TESTI SONO BOZZE, NON PARERI LEGALI
 * ─────────────────────────────────────────────────────────────────────────
 * Sono scritti in italiano semplice e dicono la verità su cosa fa il sistema
 * oggi. Ma non sostituiscono un avvocato: **prima di Dicembre 2026 vanno fatti
 * vedere a un legale**, e i due punti che chiederà per primi li conosciamo già:
 * il titolare del trattamento (serve un nome e un indirizzo veri) e il
 * trasferimento dati fuori dall'Unione Europea, perché i modelli girano su
 * server americani. È scritto qui perché non se ne perda memoria.
 */

type Documento = "documentazione" | "privacy" | "termini" | "cookie";

const EMAIL = "corpagent7@gmail.com";

export default function Legale({ quale }: { quale: Documento }) {
  useEffect(() => {
    // ⚠️ Chi arriva da un link nel piede della vetrina si trova a metà pagina
    // se non si risale: il browser conserva la posizione di scorrimento.
    window.scrollTo(0, 0);
  }, [quale]);

  const doc = DOCUMENTI[quale];

  return (
    <div className="on-dark min-h-screen bg-[#050507] text-[#F5F5F7]">
      <header className="mx-auto flex max-w-[720px] items-center justify-between px-5 py-5 sm:px-6">
        <a href="/" className="flex cursor-pointer items-center gap-2.5">
          <Logo size={22} />
          <span className="text-[14.5px] font-medium tracking-[-0.01em]">CorpAgent</span>
        </a>
        <a
          href="/"
          className="font-dato cursor-pointer text-[11px] uppercase tracking-[0.1em] text-white/55 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          ← Torna
        </a>
      </header>

      <nav className="mx-auto max-w-[720px] px-5 sm:px-6">
        <div className="flex flex-wrap gap-x-5 gap-y-2 border-b border-white/[0.08] pb-4">
          {(Object.keys(DOCUMENTI) as Documento[]).map((k) => (
            <a
              key={k}
              href={`/${k}`}
              className={`font-dato cursor-pointer text-[11px] uppercase tracking-[0.08em] transition-colors ${
                k === quale ? "text-white" : "text-white/40 hover:text-white/75"
              }`}
            >
              {DOCUMENTI[k].titoloBreve}
            </a>
          ))}
        </div>
      </nav>

      <main className="mx-auto max-w-[720px] px-5 pt-9 pb-24 sm:px-6">
        <h1 className="font-sezione text-[clamp(1.9rem,5vw,2.7rem)] leading-[0.95]">
          {doc.titolo}
        </h1>
        <p className="font-dato mt-3 text-[11px] uppercase tracking-[0.08em] text-white/45">
          Aggiornato l'11 agosto 2026
        </p>

        {doc.avviso && (
          <p className="mt-6 rounded-xl border border-amber-400/25 bg-amber-400/[0.07] px-4 py-3 text-[13px] leading-relaxed text-amber-200/90">
            {doc.avviso}
          </p>
        )}

        <div className="mt-9 space-y-9">
          {doc.sezioni.map((s) => (
            <section key={s.titolo}>
              <h2 className="text-[16.5px] font-semibold tracking-[-0.01em] text-white">
                {s.titolo}
              </h2>
              <div className="mt-2.5 space-y-3">
                {s.righe.map((r, i) => (
                  <p key={i} className="text-[14.5px] leading-[1.65] text-white/65">
                    {r}
                  </p>
                ))}
                {s.elenco && (
                  <ul className="mt-2 space-y-2">
                    {s.elenco.map((v) => (
                      <li key={v} className="flex gap-2.5 text-[14px] leading-[1.6] text-white/60">
                        <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-white/35" />
                        <span>{v}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          ))}
        </div>

        <p className="mt-14 border-t border-white/[0.08] pt-6 text-[14px] leading-relaxed text-white/55">
          Per qualsiasi domanda su questo documento scrivi a{" "}
          <a
            href={`mailto:${EMAIL}`}
            className="cursor-pointer text-white underline underline-offset-2"
          >
            {EMAIL}
          </a>
          .
        </p>
      </main>
    </div>
  );
}

interface Sezione {
  titolo: string;
  righe: string[];
  elenco?: string[];
}

const DOCUMENTI: Record<
  Documento,
  { titolo: string; titoloBreve: string; avviso?: string; sezioni: Sezione[] }
> = {
  // ───────────────────────────────────────────────────────────────────────
  documentazione: {
    titolo: "Come funziona",
    titoloBreve: "Documentazione",
    sezioni: [
      {
        titolo: "In una frase",
        righe: [
          "CorpAgent dà alla tua azienda un agente che risponde ai clienti su WhatsApp, sul sito e al telefono, usando i tuoi prezzi, i tuoi orari e le tue regole. Quando non sa una cosa, lo dice e passa la richiesta a te.",
        ],
      },
      {
        titolo: "Cosa fa, oggi, davvero",
        righe: ["Queste sono le cose provate e funzionanti, non quelle in programma:"],
        elenco: [
          "Risponde su WhatsApp ai messaggi scritti, ai vocali e alle foto",
          "Risponde alle telefonate con una voce naturale, in tempo reale",
          "Legge i tuoi documenti — listini, orari, regole, contratti — e risponde con quelli",
          "Si collega ai programmi che usi già e legge i dati veri, invece di indovinare",
          "Cerca sul web quando la risposta non è nei tuoi documenti",
          "Parla la lingua del cliente: risponde in cinese a chi scrive in cinese",
          "Fotografa uno scontrino e ne estrae i dati",
          "Ogni sera ti manda un messaggio con quello che è successo durante il giorno",
        ],
      },
      {
        titolo: "Le due cose che ti fanno dormire",
        righe: [
          "**Modalità Ghost.** Nelle prime settimane l'agente non manda niente da solo: ti mostra la risposta e decidi tu se inviarla o correggerla. Quando ti fidi, la spegni.",
          "**Il controllore.** Ogni risposta passa da un controllo prima di partire. Se l'agente stesse per promettere uno sconto che non hai autorizzato, o rispondere male a un cliente maleducato, il messaggio si ferma e arriva a te.",
        ],
      },
      {
        titolo: "I collegamenti ai tuoi programmi",
        righe: [
          "L'agente può leggere dai programmi che usi già. Il collegamento lo fai tu, col tuo account: i tuoi dati restano tuoi, e nessun'altra azienda li vede.",
          "Oggi funzionano Fluida (personale, ferie, presenze) e Google Maps (distanze e tempi di percorrenza). Gmail, Outlook e il calendario sono pronti e si attivano quando serve.",
        ],
      },
      {
        titolo: "Come si comincia",
        righe: [
          "Non c'è un'iscrizione e non c'è una prova gratuita da attivare da soli: lavoriamo con poche aziende alla volta, e ognuna la prepariamo a mano.",
          `Compili il form, un agente ti fa tre domande, poi ci scriviamo a ${EMAIL}. Da lì capiamo il tuo lavoro, e in uno o due giorni prepariamo la tua versione partendo da un modello del tuo settore. Poi te la consegniamo e da quel momento la personalizzi da solo.`,
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────
  privacy: {
    titolo: "Privacy",
    titoloBreve: "Privacy",
    avviso:
      "Questa informativa descrive fedelmente cosa fa il sistema oggi, ma è una bozza scritta da chi costruisce il prodotto, non da un avvocato. Prima del lancio pubblico verrà rivista da un legale.",
    sezioni: [
      {
        titolo: "Chi tratta i tuoi dati",
        righe: [
          `CorpAgent, progetto in fase di avvio. Il riferimento per qualsiasi richiesta è ${EMAIL}. I dati di contatto completi del titolare del trattamento saranno pubblicati qui alla costituzione della società.`,
        ],
      },
      {
        titolo: "Cosa raccogliamo quando compili il form",
        righe: ["Solo quello che scrivi tu, e niente di nascosto:"],
        elenco: [
          "Il nome della tua azienda e di cosa vi occupate",
          "Il tuo telefono e la tua email",
          "La descrizione di quello che ti serve",
          "Le risposte che dai all'agente nelle tre domande successive",
          "La data e l'ora della richiesta",
        ],
      },
      {
        titolo: "Perché li raccogliamo",
        righe: [
          "Per una ragione sola: ricontattarti sulla richiesta che ci hai mandato. Non ti iscriviamo a nessuna newsletter, non ti mandiamo pubblicità, e non passiamo il tuo contatto a nessuno.",
          "La base giuridica è l'esecuzione di una richiesta che hai fatto tu, insieme al consenso che dai spuntando la casella prima di inviare.",
        ],
      },
      {
        titolo: "Chi li vede",
        righe: [
          "Le richieste le legge solo chi porta avanti il contatto commerciale. Non c'è nessun accesso pubblico e nessuna condivisione con terzi per scopi di marketing.",
          "Tre fornitori tecnici trattano i dati per conto nostro, e solo per far funzionare il servizio:",
        ],
        elenco: [
          "Neon — il database dove le richieste sono conservate, server nell'Unione Europea",
          "Vercel — dove gira il sito",
          "Resend — che recapita l'email di avviso della tua richiesta",
          "OpenRouter e i fornitori di modelli — leggono il testo della conversazione con l'agente per generare le risposte",
        ],
      },
      {
        titolo: "Il trasferimento fuori dall'Unione Europea",
        righe: [
          "I modelli di intelligenza artificiale girano su server che possono trovarsi negli Stati Uniti. Quando parli con l'agente, il testo dei messaggi viene inviato a quei server per generare la risposta.",
          "Non inviamo mai a quei server la tua email o il tuo telefono: restano nel database e servono solo a noi per ricontattarti.",
        ],
      },
      {
        titolo: "Per quanto tempo li teniamo",
        righe: [
          "Le richieste che portano a un contatto restano finché il rapporto è in corso. Le richieste chiuse senza esito vengono conservate per due anni, poi cancellate: servono a non ricontattare due volte chi ci ha già detto no.",
        ],
      },
      {
        titolo: "I tuoi diritti",
        righe: [
          `Puoi chiedere di vedere, correggere o cancellare i tuoi dati, e puoi ritirare il consenso in qualsiasi momento. Basta una email a ${EMAIL}: rispondiamo entro trenta giorni, come prevede il regolamento.`,
          "Se ritieni che il trattamento non sia corretto, puoi rivolgerti al Garante per la protezione dei dati personali.",
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────
  termini: {
    titolo: "Termini",
    titoloBreve: "Termini",
    avviso:
      "Bozza scritta in italiano semplice per essere capita, non per essere blindata. Verrà rivista da un legale prima del lancio pubblico.",
    sezioni: [
      {
        titolo: "Cos'è questa pagina",
        righe: [
          "Questo sito, oggi, serve a una cosa sola: farci sapere che la tua azienda è interessata. Non è un negozio, non vende niente e non attiva nessun servizio da solo.",
        ],
      },
      {
        titolo: "Mandare una richiesta non è un contratto",
        righe: [
          "Compilare il form e parlare con l'agente non ti impegna a niente, e non impegna noi a fornirti il servizio. Ci parliamo, capiamo se ha senso, e solo allora si concorda qualcosa per iscritto.",
          "Le risposte dell'agente di primo contatto non sono un'offerta commerciale: non contengono prezzi né impegni, di proposito.",
        ],
      },
      {
        titolo: "Cosa ti chiediamo",
        righe: [
          "Di scrivere dati veri, e di non usare il form per mandare pubblicità, contenuti offensivi o richieste automatiche. Le richieste che sembrano generate da un programma vengono scartate.",
        ],
      },
      {
        titolo: "Quando il servizio parte davvero",
        righe: [
          "Se diventi cliente, quello che vale sono le condizioni concordate per iscritto con te: prezzo, cosa comprende, per quanto tempo. Queste righe restano solo per il sito pubblico.",
        ],
      },
      {
        titolo: "Cosa non possiamo promettere",
        righe: [
          "Un agente che risponde ai clienti è uno strumento potente e non è infallibile. Facciamo tre cose per limitare i danni — un controllo su ogni risposta prima dell'invio, la modalità Ghost che ti fa approvare tutto all'inizio, e la regola per cui l'agente dice «non lo so» invece di inventare — ma la responsabilità di cosa viene detto ai tuoi clienti resta condivisa, e ne parliamo esplicitamente prima di partire.",
        ],
      },
      {
        titolo: "Il sito può cambiare",
        righe: [
          "Stiamo costruendo. Funzioni, pagine e queste stesse righe possono cambiare senza preavviso. La data in cima dice sempre quando è stato aggiornato.",
        ],
      },
      {
        titolo: "Legge applicabile",
        righe: ["Si applica la legge italiana."],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────
  cookie: {
    titolo: "Cookie",
    titoloBreve: "Cookie",
    sezioni: [
      {
        titolo: "Non ti tracciamo",
        righe: [
          "Questa pagina non ha Google Analytics, non ha il pixel di Facebook, non ha nessun cookie pubblicitario e non ha cookie di profilazione. Per questo non vedi nessun banner che ti chiede di accettare: non c'è niente da accettare.",
        ],
      },
      {
        titolo: "Cosa c'è, allora",
        righe: [
          "Una cosa sola, e non serve a seguirti: il cookie di sessione, che esiste solo per chi ha un accesso a CorpAgent — cioè le aziende già clienti. Se stai leggendo la vetrina e stai compilando il form, non ce l'hai.",
          "Il form di contatto non usa nessun cookie. Per capire se chi scrive è una persona ci basiamo su controlli che avvengono sul nostro server, senza scrivere niente nel tuo browser e senza coinvolgere servizi terzi.",
        ],
      },
      {
        titolo: "I caratteri sono ospitati da noi",
        righe: [
          "I font di questa pagina sono serviti dai nostri server, non da Google Fonts. È una scelta voluta: caricarli da Google manderebbe il tuo indirizzo IP a un terzo senza che tu abbia acconsentito, e in Europa è già stato considerato un problema.",
        ],
      },
      {
        titolo: "Se cambia",
        righe: [
          "Il giorno in cui aggiungessimo uno strumento di statistica, comparirebbe un banner vero con la possibilità di rifiutare, e questa pagina lo direbbe. Finché leggi questo testo, non c'è.",
        ],
      },
    ],
  },
};

import { useEffect } from "react";
import Logo from "../Logo";

/**
 * I quattro documenti pubblici: documentazione, privacy, termini, cookie.
 *
 * Chiesti da Tommaso l'11 Agosto 2026, estesi il 13 Agosto 2026 («privacy più
 * lunghe», pagine legali più ricche e serie). Servono per due ragioni diverse,
 * e conviene tenerle distinte:
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
 *
 * Regola ferrea di questi testi: ZERO dati inventati. Niente partita IVA,
 * niente sede legale, niente foro cittadino finché non esistono davvero.
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
          Aggiornato il 13 agosto 2026
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
          "Modalità Ghost — nelle prime settimane l'agente non manda niente da solo: ti mostra la risposta e decidi tu se inviarla o correggerla. Quando ti fidi, la spegni.",
          "Il controllore — ogni risposta passa da un controllo prima di partire. Se l'agente stesse per promettere uno sconto che non hai autorizzato, o rispondere male a un cliente maleducato, il messaggio si ferma e arriva a te.",
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
    titolo: "Informativa sulla privacy",
    titoloBreve: "Privacy",
    avviso:
      "Questa informativa descrive fedelmente cosa fa il sistema oggi, ma è una bozza scritta da chi costruisce il prodotto, non da un avvocato. Prima del lancio pubblico verrà rivista da un legale. Se qualcosa non ti torna, scrivici: correggiamo.",
    sezioni: [
      {
        titolo: "Il titolare del trattamento",
        righe: [
          `Il titolare del trattamento dei dati raccolti attraverso questo sito e i servizi collegati è CorpAgent. Per qualsiasi questione che riguardi i tuoi dati personali — domande, richieste, esercizio dei diritti — il canale di contatto è ${EMAIL}, ed è presidiato.`,
          "CorpAgent è un progetto in fase di avvio: i dati identificativi completi del titolare (denominazione sociale e sede) verranno pubblicati in questa pagina appena formalizzati. Fino ad allora qui non trovi una partita IVA o un indirizzo per una ragione semplice: non pubblichiamo dati che non esistono ancora.",
        ],
      },
      {
        titolo: "Quali dati trattiamo, e da dove arrivano",
        righe: [
          "Trattiamo solo i dati che ci dai tu, nelle quattro occasioni in cui il sito o il servizio te li chiede. Non compriamo elenchi di contatti, non incrociamo banche dati esterne e non raccogliamo nulla di nascosto.",
        ],
        elenco: [
          "Richieste dal form della home — il nome della tua azienda, il settore in cui lavora, il tuo telefono, la tua email e la descrizione di quello che ti serve, insieme a data e ora dell'invio.",
          "Ordini dei servizi — quando ordini un servizio dalla vetrina raccogliamo il nome dell'azienda, l'email e il telefono da usare per ricontattarti, oltre al servizio scelto.",
          "Conversazioni con l'agente di qualifica — il testo delle risposte che dai all'agente che, dopo il form, ti fa qualche domanda per capire meglio la richiesta.",
          "Area aziendale delle aziende clienti — se la tua azienda diventa cliente, trattiamo i dati degli account di accesso (nome, email, credenziali) e i dati che l'azienda carica nel proprio spazio: documenti, listini, regole, conversazioni.",
        ],
      },
      {
        titolo: "I dati tecnici",
        righe: [
          "A quelli sopra si aggiungono i normali dati tecnici che qualsiasi server registra per funzionare e difendersi: indirizzo IP e registri delle richieste. Li usiamo solo per la sicurezza e la diagnosi dei guasti, e li conserviamo per il tempo minimo necessario a questi scopi.",
        ],
      },
      {
        titolo: "Perché li trattiamo: le basi giuridiche",
        righe: [
          "Ogni trattamento poggia su una delle basi previste dall'articolo 6 del GDPR:",
        ],
        elenco: [
          "Misure precontrattuali adottate su tua richiesta (art. 6, par. 1, lett. b) — è la base per il form, gli ordini e la conversazione di qualifica: ci hai chiesto tu di essere ricontattato, e i dati servono esattamente a quello.",
          "Esecuzione del contratto (art. 6, par. 1, lett. b) — è la base per gli account dell'area aziendale e per i dati che l'azienda cliente carica: senza trattarli, il servizio non può funzionare.",
          "Legittimo interesse (art. 6, par. 1, lett. f) — è la base per i registri tecnici e i controlli anti-abuso: proteggere il servizio da attacchi e usi fraudolenti è un interesse legittimo nostro e delle aziende clienti.",
        ],
      },
      {
        titolo: "Cosa non facciamo con i tuoi dati",
        righe: ["Quattro impegni, scritti in chiaro perché contino:"],
        elenco: [
          "Niente profilazione — non costruiamo profili sul tuo comportamento e non prendiamo decisioni automatizzate che producano effetti giuridici su di te.",
          "Niente vendita né cessione — il tuo contatto non viene venduto, affittato o passato a terzi per scopi di marketing.",
          "Niente pubblicità non richiesta — non ti iscriviamo a newsletter e non usiamo i tuoi dati per campagne che non hai chiesto.",
          "Niente cookie di tracciamento — il sito non usa strumenti di tracciamento pubblicitario, come spiegato nella pagina Cookie.",
        ],
      },
      {
        titolo: "Dove stanno fisicamente i dati",
        righe: [
          "Il servizio si appoggia a pochi fornitori tecnici, scelti uno per uno, che trattano i dati per conto nostro e solo per far funzionare il sistema:",
        ],
        elenco: [
          "Neon — il database PostgreSQL dove vivono richieste, ordini, account e dati delle aziende clienti. È ospitato nella regione Unione Europea, a Francoforte.",
          "Vercel — la piattaforma dove girano il sito e le funzioni server che lo alimentano.",
          "Resend — il servizio che recapita le email di servizio, come l'avviso che la tua richiesta è arrivata.",
          "OpenRouter — il canale attraverso cui i testi delle conversazioni con l'agente raggiungono i modelli di intelligenza artificiale che generano le risposte.",
        ],
      },
      {
        titolo: "I modelli di intelligenza artificiale e i tuoi testi",
        righe: [
          "Quando parli con l'agente, il testo dei messaggi viene inviato ai modelli di intelligenza artificiale attraverso OpenRouter, per generare la risposta. Usiamo i modelli tramite le loro API commerciali, i cui termini prevedono che i dati inviati non vengano usati per addestrare i modelli, e non attiviamo alcuna opzione di condivisione o di logging facoltativo dei contenuti.",
          "Non inviamo mai ai modelli la tua email o il tuo telefono: restano nel database e servono soltanto a noi per ricontattarti.",
        ],
      },
      {
        titolo: "Il trasferimento fuori dall'Unione Europea",
        righe: [
          "Il database sta a Francoforte, dentro l'Unione Europea. I server dei modelli di intelligenza artificiale, invece, possono trovarsi fuori dall'Unione, tipicamente negli Stati Uniti: quando l'agente genera una risposta, il testo della conversazione può quindi attraversare quel confine.",
          "I fornitori a cui ci appoggiamo dichiarano di operare secondo le garanzie che il GDPR prevede per i trasferimenti verso paesi terzi. È il punto più delicato di questa informativa, e per questo lo scriviamo per esteso invece di nasconderlo in una riga.",
        ],
      },
      {
        titolo: "Per quanto tempo li conserviamo",
        righe: [
          "Non teniamo i dati «per sempre, non si sa mai». I tempi sono questi:",
        ],
        elenco: [
          "Richieste dal form e conversazioni di qualifica senza seguito — due anni dalla richiesta, poi cancellazione. Servono a non ricontattare due volte chi ci ha già detto no.",
          "Ordini che non arrivano all'attivazione — due anni, per le stesse ragioni.",
          "Aziende clienti — per tutta la durata del rapporto, più il tempo che la legge impone di conservare i documenti amministrativi e contabili.",
          "Account dell'area aziendale — finché l'account esiste. Alla chiusura vengono disattivati e i dati personali collegati cancellati.",
          "Dati caricati dall'azienda cliente nel proprio spazio — finché il servizio è attivo. Alla cessazione l'azienda può chiederne la restituzione, poi vengono cancellati.",
          "Registri tecnici di sicurezza — il tempo minimo necessario a individuare e analizzare eventuali abusi.",
        ],
      },
      {
        titolo: "I dati che le aziende clienti ci affidano",
        righe: [
          "Un'azienda cliente può caricare nel proprio spazio documenti e conversazioni che contengono dati personali di terzi — i suoi clienti, i suoi fornitori, il suo personale. Per quei dati il titolare del trattamento è l'azienda cliente, e CorpAgent agisce come responsabile del trattamento per suo conto: li usiamo solo per erogare il servizio, secondo le sue istruzioni, e mai per scopi nostri.",
          "Ogni spazio aziendale è separato dagli altri: un'azienda non può vedere i dati di un'altra.",
        ],
      },
      {
        titolo: "Come proteggiamo i dati",
        righe: [
          "Tutte le connessioni al sito e all'area aziendale viaggiano cifrate (HTTPS). L'accesso al database è ristretto e protetto da credenziali, e le credenziali dei servizi esterni collegati dalle aziende clienti sono conservate in forma cifrata.",
          "Nessun sistema è inviolabile, e non promettiamo il contrario: promettiamo misure adeguate e, come impone il GDPR, l'avviso senza ingiustificato ritardo se un incidente dovesse riguardare i tuoi dati.",
        ],
      },
      {
        titolo: "I tuoi diritti",
        righe: [
          `Il GDPR ti riconosce una serie di diritti sui tuoi dati, e puoi esercitarli tutti con una semplice email a ${EMAIL}. Non serve un modulo: basta dire chi sei e cosa chiedi. Rispondiamo entro trenta giorni.`,
        ],
        elenco: [
          "Accesso — sapere quali dati abbiamo su di te e riceverne copia.",
          "Rettifica — far correggere dati sbagliati o incompleti.",
          "Cancellazione — farli cancellare, quando non c'è più una ragione legittima per tenerli.",
          "Limitazione — chiederci di congelarne l'uso mentre verifichiamo una tua contestazione.",
          "Opposizione — opporti ai trattamenti basati sul legittimo interesse.",
          "Portabilità — ricevere i dati che ci hai fornito in un formato strutturato e leggibile da una macchina, per portarli altrove.",
        ],
      },
      {
        titolo: "Il reclamo al Garante",
        righe: [
          "Se ritieni che il trattamento dei tuoi dati violi il regolamento, hai il diritto di proporre reclamo al Garante per la protezione dei dati personali (garanteprivacy.it), l'autorità di controllo italiana. Preferiremmo però che ci scrivessi prima: quasi tutto si risolve con una email.",
        ],
      },
      {
        titolo: "Modifiche a questa informativa",
        righe: [
          "Se questa informativa cambia, cambia anche la data in cima alla pagina. Le modifiche sostanziali che riguardano le aziende clienti vengono comunicate anche via email. Le versioni precedenti possono essere richieste scrivendoci.",
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────
  termini: {
    titolo: "Termini di servizio",
    titoloBreve: "Termini",
    avviso:
      "Bozza scritta in italiano semplice per essere capita, non per essere blindata. Verrà rivista da un legale prima del lancio pubblico.",
    sezioni: [
      {
        titolo: "Di cosa parlano questi termini",
        righe: [
          "CorpAgent fornisce alle aziende servizi digitali costruiti su misura: agenti di intelligenza artificiale che rispondono ai clienti, aree aziendali riservate, negozi online, siti web e automazioni. Questi termini regolano l'uso del sito pubblico e il percorso che va dalla richiesta all'attivazione di un servizio.",
          "Quando un servizio viene attivato, quello che conta davvero sono le condizioni concordate per iscritto con la singola azienda: prezzo, contenuto, durata. Questi termini fanno da cornice e valgono dove non è stato pattuito diversamente.",
        ],
      },
      {
        titolo: "Come funziona un ordine dalla home",
        righe: [
          "L'ordine che fai dalla home non è un acquisto immediato: registra la tua richiesta. Nessun servizio si attiva da solo e nessun pagamento parte al momento dell'ordine.",
          "Dopo l'ordine vieni ricontattato all'email o al telefono che hai lasciato: si definiscono insieme i dettagli, e solo allora si passa all'attivazione e al pagamento. Quando il servizio è attivo, il pagamento con carta è gestito da Stripe: i dati della carta viaggiano verso Stripe e non passano dai nostri server.",
        ],
      },
      {
        titolo: "L'offerta di lancio e i prezzi",
        righe: [
          "Lavoriamo con poche aziende alla volta, perché ogni attivazione viene preparata a mano: l'offerta di lancio è quindi a disponibilità limitata, e può chiudersi quando i posti finiscono.",
          "I prezzi esposti sul sito possono cambiare per i nuovi ordini. Per gli ordini già confermati vale il prezzo concordato per iscritto al momento della conferma, non quello che compare in vetrina dopo.",
        ],
      },
      {
        titolo: "Cosa chiediamo a te",
        righe: ["Poche cose, ma vere:"],
        elenco: [
          "Dati veri — nome dell'azienda, contatti e informazioni corrette, sia nell'ordine sia nei documenti che carichi. Su dati falsi non si costruisce niente che funzioni.",
          "Uso lecito — i servizi non si usano per attività illegali, per inviare spam o contenuti offensivi, né per violare diritti di terzi.",
          "Custodia degli accessi — le credenziali dell'area aziendale sono personali: chi le riceve risponde di come vengono usate.",
          "Richieste vere — il form e l'agente servono alle persone; le richieste che sembrano generate da un programma vengono scartate.",
        ],
      },
      {
        titolo: "Cosa promettiamo, e cosa onestamente no",
        righe: [
          "Ci impegniamo a fornire il servizio con diligenza e a correggere i problemi appena li conosciamo. Ma il servizio dipende anche da fornitori terzi — i modelli di intelligenza artificiale, l'hosting, i canali di messaggistica — e un loro disservizio può riflettersi sul nostro senza che sia in nostro potere impedirlo. Per questo non possiamo garantire un funzionamento ininterrotto e privo di errori.",
          "Un agente che risponde ai clienti è uno strumento potente e non è infallibile. Per limitare gli errori facciamo tre cose: un controllo su ogni risposta prima dell'invio, la modalità Ghost che all'inizio ti fa approvare tutto, e la regola per cui l'agente dice «non lo so» invece di inventare. La responsabilità di cosa viene comunicato ai tuoi clienti resta però condivisa, e ne parliamo esplicitamente prima di partire.",
          "Nei limiti in cui la legge lo consente, non rispondiamo dei danni indiretti — mancati guadagni, perdita di opportunità — causati da interruzioni o errori del servizio. Non escludiamo, perché non si può e non vogliamo, la responsabilità per dolo o colpa grave.",
        ],
      },
      {
        titolo: "Recesso e disdetta",
        righe: [
          `Non vogliamo clienti prigionieri. Puoi disdire un servizio con un semplice preavviso via email a ${EMAIL}: il servizio resta attivo fino alla fine del periodo già pagato, poi si ferma, senza penali e senza moduli complicati.`,
          "Alla cessazione puoi chiedere la restituzione dei dati che la tua azienda ha caricato, che vengono poi cancellati come descritto nella pagina Privacy.",
        ],
      },
      {
        titolo: "Il sito e i termini possono cambiare",
        righe: [
          "Stiamo costruendo: funzioni, pagine e questi stessi termini possono cambiare. La data in cima dice sempre quando il documento è stato aggiornato, e le modifiche sostanziali vengono comunicate alle aziende clienti via email prima di entrare in vigore per loro.",
        ],
      },
      {
        titolo: "Legge applicabile e foro",
        righe: [
          "Questi termini sono regolati dalla legge italiana. Per le controversie è competente il foro individuato secondo le regole ordinarie previste dalla legge; se il cliente è un consumatore, vale il foro inderogabile del luogo in cui risiede.",
          "Prima di arrivare lì, però, c'è sempre un'email: quasi tutte le questioni si risolvono parlandosi.",
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────
  cookie: {
    titolo: "Cookie e memorizzazione tecnica",
    titoloBreve: "Cookie",
    sezioni: [
      {
        titolo: "La risposta breve",
        righe: [
          "Questo sito non usa cookie di profilazione, cookie pubblicitari o cookie di terze parti. Non c'è Google Analytics, non c'è il pixel di Facebook, non c'è nessuno strumento che ti segue da un sito all'altro.",
          "Quello che il sito scrive nel tuo browser è solo memorizzazione tecnica: alcune informazioni nel localStorage (la preferenza del tema, la sessione dell'area aziendale, la presa visione del banner) e — soltanto se accedi a CorpAgent con un account — un cookie tecnico di sessione, che serve a tenerti collegato ed è quindi strettamente necessario al servizio. Niente di tutto questo traccia la tua navigazione.",
        ],
      },
      {
        titolo: "Cos'è il localStorage, in parole semplici",
        righe: [
          "Il localStorage è un piccolo spazio di appunti che il tuo browser mette a disposizione di ogni sito. Il sito può scriverci delle annotazioni — per esempio «questo visitatore preferisce il tema scuro» — e rileggerle alla visita successiva.",
          "A differenza dei cookie, queste annotazioni non vengono spedite automaticamente al server a ogni richiesta e non escono dal tuo dispositivo per conto loro. E ogni sito vede solo le proprie: quello che CorpAgent scrive non è leggibile da nessun altro sito, e viceversa.",
        ],
      },
      {
        titolo: "Cosa salviamo, esattamente",
        righe: ["Tre cose, tutte tecniche:"],
        elenco: [
          "La preferenza del tema — se hai scelto il tema chiaro o quello scuro, per non fartelo reimpostare a ogni visita.",
          "La sessione dell'area aziendale — esiste solo per chi ha un account, cioè le aziende clienti: serve a non farti rifare l'accesso a ogni pagina. Se stai solo leggendo la vetrina, non c'è.",
          "La presa visione del banner — quando chiudi l'avviso in home, il sito se lo segna per non rimostrartelo a ogni visita.",
        ],
      },
      {
        titolo: "Il banner in home non chiede consensi",
        righe: [
          "Il banner che vedi in home non è un banner di consenso: non c'è nessun tracciamento da accettare o rifiutare. Registra soltanto che l'hai visto, così non ricompare. Se ci fosse davvero qualcosa a cui acconsentire, il banner sarebbe diverso — con un vero pulsante per rifiutare — e questa pagina lo spiegherebbe.",
        ],
      },
      {
        titolo: "Come cancellare tutto",
        righe: [
          "Il localStorage si svuota dalle impostazioni del browser, quando vuoi. Il percorso cambia leggermente da browser a browser, ma la strada è sempre la sezione dedicata alla privacy:",
        ],
        elenco: [
          "Chrome ed Edge — Impostazioni → Privacy e sicurezza → dati dei siti: cerca questo sito e rimuovi i suoi dati.",
          "Firefox — Impostazioni → Privacy e sicurezza → Cookie e dati dei siti web → Gestisci dati.",
          "Safari — Impostazioni → Privacy → Gestisci dati siti web.",
        ],
      },
      {
        titolo: "Cosa succede dopo la cancellazione",
        righe: [
          "Niente di grave: il tema torna a quello predefinito, l'eventuale accesso all'area aziendale va rifatto, e il banner in home ricompare una volta. Nel localStorage non c'è nulla di irrecuperabile.",
        ],
      },
      {
        titolo: "I caratteri sono ospitati da noi",
        righe: [
          "I font di questa pagina sono serviti dai nostri server, non da Google Fonts. È una scelta voluta: caricarli da Google manderebbe il tuo indirizzo IP a un terzo senza che tu abbia acconsentito, e in Europa è già stato considerato un problema.",
        ],
      },
      {
        titolo: "Se qualcosa cambierà",
        righe: [
          "Il giorno in cui il sito aggiungesse uno strumento di statistica o un qualsiasi cookie non tecnico, comparirebbe un banner di consenso vero — con la possibilità di rifiutare — e questa pagina verrebbe aggiornata prima. Finché leggi questo testo, vale quello che c'è scritto sopra.",
        ],
      },
    ],
  },
};

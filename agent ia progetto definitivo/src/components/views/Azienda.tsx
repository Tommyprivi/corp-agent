import { useCallback, useEffect, useRef, useState } from "react";
import { applicaMarchio, MARCHI } from "../../lib/marchio";
import AziendaProfilo, { RUOLI } from "./AziendaProfilo";
import {
  gettone,
  leggi,
  manda,
  salvaGettone,
  SessioneScaduta,
  type Cliente,
  type Cruscotto as DatiCruscotto,
  type Documento,
  type Messaggio,
  type Banchina,
  type Mezzo,
  type Ufficio as UfficioDati,
  type PersonaElenco,
  type PersonaViva,
  type RepartoDati,
} from "../../lib/azienda";
import { Attesa, Barre, Cornice, Linea, Sdraiate } from "../azienda/Grafici";

/**
 * L'area di un'azienda cliente — la prima è Speed Trasporti.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * DA GUSCIO A PRODOTTO — 12 Agosto 2026
 * ─────────────────────────────────────────────────────────────────────────
 * Fino a ieri questa schermata era il guscio: bella e finta. Da oggi è
 * collegata al server (*«rendiamole già funzionanti le funzioni di Salvatore
 * veramente»*): l'accesso apre una sessione vera, la chat parla con il modello
 * e ogni messaggio si salva, i clienti e i documenti stanno nel database, e i
 * numeri del cruscotto sono **contati, non scritti a mano**.
 *
 * ⚠️ La regola dell'onestà non cambia: le sezioni che dipendono da K-Master o
 * dal gestionale dicono che sono vuote e perché, invece di mostrare uno zero.
 * Uno zero è una bugia involontaria: fa credere che il dato sia stato letto e
 * valga zero.
 *
 * ⚠️ Il ruolo arriva DAL SERVER, non dal browser. Il browser non decide più
 * niente: se qualcuno modificasse il JavaScript per farsi vedere il cruscotto,
 * il server gli risponderebbe «non trovato» comunque. Qui si nasconde solo la
 * voce di menu, per non dire a nessuno che esiste una parte riservata.
 */

type Sezione = "chat" | "cruscotto" | "reparto" | "clienti" | "persone" | "documenti" | "mezzi";

interface PostazioneViva {
  id: string;
  nome: string;
  cosa: string;
}

/** Il fallback se il server non risponde: le stesse quattro del piano. */
const POSTAZIONI: PostazioneViva[] = [
  { id: "traffico", nome: "Traffico", cosa: "Risponde ai clienti, organizza i carichi" },
  { id: "magazzino", nome: "Magazzino", cosa: "Carico, scarico, conteggi, bolle" },
  { id: "autisti", nome: "Autisti", cosa: "A voce mentre guidano, foto alla consegna" },
  { id: "ammin", nome: "Amministrazione", cosa: "Solleciti, fatture fornitori" },
];

export default function Azienda({ marchio = "speed" }: { marchio?: string }) {
  const m = MARCHI[marchio];
  const [sezione, setSezione] = useState<Sezione>("chat");
  const [postazione, setPostazione] = useState("traffico");
  const [menuAperto, setMenuAperto] = useState(false);
  /** Vero appena l'utente sceglie qualcosa: da lì in poi comanda lui. */
  const [toccato, setToccato] = useState(false);

  const [persona, setPersona] = useState<PersonaViva | null>(null);
  /** Vero finché stiamo chiedendo al server se la sessione salvata vale ancora. */
  const [controllo, setControllo] = useState(() => Boolean(gettone()));
  const [postazioni, setPostazioni] = useState<PostazioneViva[]>(POSTAZIONI);
  const [agenteVivo, setAgenteVivo] = useState(true);
  /** Quante cose «da controllare» per il capo: il pallino di avviso sul menu. */
  const [avvisi, setAvvisi] = useState(0);

  useEffect(() => {
    applicaMarchio(marchio);
    // ⚠️ Si toglie uscendo: senza, chi torna alla vetrina o al pannello di
    // CorpAgent se li ritroverebbe verdi.
    return () => applicaMarchio(null);
  }, [marchio]);

  const caricaStato = useCallback(() => {
    leggi<{ persona: PersonaViva; postazioni?: PostazioneViva[]; agenteVivo: boolean }>("stato")
      .then((r) => {
        setPersona(r.persona);
        if (r.postazioni?.length) setPostazioni(r.postazioni);
        setAgenteVivo(r.agenteVivo);
      })
      .catch((e) => {
        // ⚠️ Si torna all'ingresso SOLO se la sessione è davvero morta. Un
        // intoppo di rete — il wifi del magazzino a una tacca, un 500
        // momentaneo — NON deve cancellare un gettone valido tre mesi e
        // rispedire al login: è esattamente la cosa che il gettone lungo serve
        // a evitare. `leggi` cancella già il gettone e lancia SessioneScaduta
        // quando il server dice 401; su tutto il resto si tiene il gettone e si
        // riproverà al prossimo giro.
        if (e instanceof SessioneScaduta) setPersona(null);
      })
      .finally(() => setControllo(false));
  }, []);

  useEffect(() => {
    // Il profilo finto dei primi giorni viveva in localStorage: si spazza via,
    // così nessuno resta con un «titolare» dichiarato prima che esistesse il server.
    try {
      window.localStorage.removeItem("corpagent.azienda.profilo");
    } catch {
      /* niente localStorage, niente da pulire */
    }
    if (gettone()) caricaStato();
  }, [caricaStato]);

  // Il pallino di avviso del capo: quante cose aspettano nel suo reparto. Si
  // chiede appena si sa chi è, e la vista del reparto lo aggiorna quando chiude
  // qualcosa.
  useEffect(() => {
    if (persona?.ruolo !== "capo") return;
    leggi<{ controlli: unknown[] }>("reparto")
      .then((r) => setAvvisi(r.controlli?.length ?? 0))
      .catch(() => {});
  }, [persona?.ruolo]);

  /** Torna all'ingresso, avvisando il server se possibile. */
  const esci = useCallback(() => {
    const t = gettone();
    if (t) void manda({ az: "esci" }).catch(() => {});
    salvaGettone(null);
    setPersona(null);
    setSezione("chat");
    setToccato(false);
  }, []);

  /** Ogni sezione la usa: se la sessione muore a metà, si rientra dall'inizio. */
  const seScaduta = useCallback(
    (e: unknown) => {
      if (e instanceof SessioneScaduta) esci();
    },
    [esci]
  );

  if (!m) return null;

  // La sessione salvata è in verifica: un istante di quiete, non un lampo
  // della schermata d'ingresso che poi sparisce.
  if (controllo) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-app)]">
        <img src={m.logo} alt={m.nome} className="h-14 w-auto animate-pulse" />
      </div>
    );
  }

  if (!persona) {
    return (
      <AziendaProfilo
        marchio={marchio}
        onFatto={(p) => {
          setPersona(p);
          // Il profilo appena creato non porta con sé postazioni e stato del
          // modello: si chiedono al server subito dopo.
          caricaStato();
        }}
      />
    );
  }

  // ⚠️ IL RUOLO È QUELLO DEL SERVER. `persona.ruolo` è `ruolo_vero` del
  // database: finché Salvatore non promuove qualcuno dall'elenco delle
  // persone, chiunque entra è un operatore — anche se si è dichiarato titolare.
  const vedeTutto = persona.ruolo === "titolare";
  const isCapo = persona.ruolo === "capo";
  const isGestore = ["titolare", "amministratore", "capo"].includes(persona.ruolo);

  // Le voci del menu, per ruolo. Il vero cancello resta sul server: qui si
  // decide solo cosa vale la pena mostrare a ciascuno.
  const voci: [Sezione, string, boolean, number][] = [
    ["cruscotto", "Cruscotto", vedeTutto, 0],
    ["reparto", "Il reparto", isCapo, avvisi],
    ["clienti", "Clienti", true, 0],
    ["mezzi", "Mezzi", isGestore, 0],
    ["persone", "Persone", vedeTutto, 0],
    ["documenti", "Documenti", true, 0],
  ];
  // Il titolare atterra sul cruscotto, il capo sulla sua area di reparto, gli
  // altri sulla chat: ognuno apre l'app su quello che gli serve per primo.
  const atterraggio: Sezione = vedeTutto ? "cruscotto" : isCapo ? "reparto" : "chat";
  const sezioneVera: Sezione = sezione === "chat" && !toccato ? atterraggio : sezione;

  return (
    <div className="flex min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)]">
      {/* ── La barra: l'azienda ──────────────────────────────────────── */}
      {/* ⚠️ Fuori schermo sotto i 1024px e richiamabile: su un telefono una
          barra fissa da 240px si mangia metà larghezza, e questa app la
          apriranno in banchina e in cabina, non solo alla scrivania. */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-[248px] shrink-0 border-r border-[var(--border)] bg-[var(--bg-card)] transition-transform lg:static lg:translate-x-0 ${
          menuAperto ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-[var(--border)] px-4 py-4">
            <Marchio nome={m.nome} />
          </div>

          <nav className="flex-1 overflow-y-auto p-3">
            <p className="px-2 pb-2 text-[10.5px] uppercase tracking-[0.09em] text-[var(--text-secondary)]">
              Postazioni
            </p>
            {postazioni.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setPostazione(p.id);
                  setSezione("chat");
                  setToccato(true);
                  setMenuAperto(false);
                }}
                className={`mb-0.5 flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13.5px] transition-colors ${
                  sezioneVera === "chat" && postazione === p.id
                    ? "bg-[var(--accent-soft)] font-medium text-[var(--text-primary)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--fill-quiet)]"
                }`}
              >
                {/* ⚠️ Lo stato è una FORMA, non un colore: il verde qui è il
                    marchio, e un pallino verde non direbbe più «attivo». */}
                <span
                  aria-hidden
                  className="h-2 w-2 shrink-0 rounded-full border"
                  style={
                    agenteVivo
                      ? { background: "var(--accent)", borderColor: "var(--accent)" }
                      : { borderColor: "var(--border-strong)" }
                  }
                />
                <span className="flex-1">{p.nome}</span>
              </button>
            ))}

            <div className="my-3 border-t border-[var(--border)]" />

            {/* ⚠️ Le sezioni che un operatore non deve vedere NON SI DISEGNANO
                affatto, invece di disegnarle e negare l'accesso: una voce di
                menu che c'è e non funziona dice a chiunque che esiste una parte
                riservata, e invita a provarci. Il vero cancello è sul server. */}
            {voci
              .filter(([, , mostra]) => mostra)
              .map(([id, nome, , badge]) => (
                <button
                  key={id}
                  onClick={() => {
                    setSezione(id);
                    setToccato(true);
                    setMenuAperto(false);
                  }}
                  className={`mb-0.5 flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13.5px] transition-colors ${
                    sezioneVera === id
                      ? "bg-[var(--accent-soft)] font-medium text-[var(--text-primary)]"
                      : "text-[var(--text-secondary)] hover:bg-[var(--fill-quiet)]"
                  }`}
                >
                  <span className="flex-1">{nome}</span>
                  {/* Il pallino di avviso: quante cose aspettano il capo. Rosso
                      perché è l'unico posto dell'app dove serve gridare. */}
                  {badge > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#D92D20] px-1.5 text-[11px] font-semibold text-white">
                      {badge}
                    </span>
                  )}
                </button>
              ))}
          </nav>

          <div className="border-t border-[var(--border)] px-4 py-3">
            <div className="flex items-center gap-2.5">
              {persona.foto ? (
                <img
                  src={persona.foto}
                  alt=""
                  className="h-8 w-8 shrink-0 rounded-full object-cover"
                />
              ) : (
                <span
                  aria-hidden
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--fill-quiet)] text-[12px] font-medium text-[var(--text-secondary)]"
                >
                  {(persona.nome || persona.email).slice(0, 1).toUpperCase()}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium">
                  {persona.nome || persona.email}
                </span>
                <span className="block truncate text-[11px] text-[var(--text-secondary)]">
                  {RUOLI.find((r) => r.id === persona.ruolo)?.nome ?? persona.ruolo}
                  {persona.reparto && !vedeTutto ? ` · ${persona.reparto}` : ""}
                </span>
              </span>
              <button
                onClick={esci}
                className="shrink-0 cursor-pointer rounded-md px-1.5 py-1 text-[11px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--fill-quiet)] hover:text-[var(--text-primary)]"
                title="Esci da questa postazione"
              >
                Esci
              </button>
            </div>
          </div>
        </div>
      </aside>

      {menuAperto && (
        <button
          aria-label="Chiudi il menu"
          onClick={() => setMenuAperto(false)}
          className="fixed inset-0 z-30 bg-black/25 lg:hidden"
        />
      )}

      {/* ── Il centro ────────────────────────────────────────────────── */}
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3 lg:hidden">
          <button
            onClick={() => setMenuAperto(true)}
            aria-label="Apri il menu"
            className="cursor-pointer rounded-lg p-1.5 text-[var(--text-secondary)] hover:bg-[var(--fill-quiet)]"
          >
            ☰
          </button>
          <Marchio nome={m.nome} compatto />
        </header>

        {/* ⚠️ Il magazzino NON è una chat: è un posto di lavoro (voluto da
            Tommaso: «un'interfaccia più bella, non solo chat — tipo quella del
            capo»). Numeri del giorno, bottoni grossi, il registro dei
            movimenti — e l'agente in una scheda, quando serve. Le altre
            postazioni restano conversazione, finché non avranno le loro. */}
        {sezioneVera === "chat" && postazione === "magazzino" && (
          <Banchina
            postazione={postazioni.find((p) => p.id === "magazzino") ?? postazioni[0]}
            nome={(persona.nome || "").split(" ")[0]}
            agenteVivo={agenteVivo}
            seScaduta={seScaduta}
          />
        )}
        {sezioneVera === "chat" && postazione === "traffico" && (
          <Ufficio
            postazione={postazioni.find((p) => p.id === "traffico") ?? postazioni[0]}
            nome={(persona.nome || "").split(" ")[0]}
            agenteVivo={agenteVivo}
            seScaduta={seScaduta}
          />
        )}
        {sezioneVera === "chat" && postazione !== "magazzino" && postazione !== "traffico" && (
          <Conversazione
            postazione={postazioni.find((p) => p.id === postazione) ?? postazioni[0]}
            nome={(persona.nome || "").split(" ")[0]}
            agenteVivo={agenteVivo}
            seScaduta={seScaduta}
          />
        )}
        {sezioneVera === "cruscotto" && vedeTutto && (
          <Cruscotto
            nome={(persona.nome || "").split(" ")[0]}
            postazioni={postazioni}
            seScaduta={seScaduta}
          />
        )}
        {sezioneVera === "clienti" && (
          <Clienti ruolo={persona.ruolo} seScaduta={seScaduta} />
        )}
        {sezioneVera === "reparto" && isCapo && (
          <Reparto nome={persona.reparto} onAvvisi={setAvvisi} seScaduta={seScaduta} />
        )}
        {sezioneVera === "mezzi" && isGestore && <Mezzi seScaduta={seScaduta} />}
        {sezioneVera === "persone" && vedeTutto && (
          <Persone mieEmail={persona.email} seScaduta={seScaduta} />
        )}
        {sezioneVera === "documenti" && (
          <Documenti ruolo={persona.ruolo} seScaduta={seScaduta} />
        )}
      </main>
    </div>
  );
}

function Marchio({ nome, compatto }: { nome: string; compatto?: boolean }) {
  const logo = MARCHI.speed?.logo;
  // ⚠️ Il logo intero contiene già la scritta «Speed Trasporti»: ripeterla
  // accanto sarebbe scriverla due volte nella stessa riga.
  if (logo) {
    return (
      <img
        src={logo}
        alt={nome}
        className={compatto ? "h-7 w-auto" : "h-11 w-auto"}
        width={887}
        height={375}
      />
    );
  }
  return <span className="text-[14px] font-semibold tracking-[-0.01em]">{nome}</span>;
}

// ─────────────────────────────────────────────────────────────────────────
// LA CONVERSAZIONE — vera: ogni battuta passa dal server e resta salvata
// ─────────────────────────────────────────────────────────────────────────

function Conversazione({
  postazione,
  nome,
  agenteVivo,
  testoIniziale,
  seScaduta,
}: {
  postazione: PostazioneViva;
  nome?: string;
  agenteVivo: boolean;
  /** Un inizio di frase già pronto (es. «Mi serve un preventivo per »). */
  testoIniziale?: string;
  seScaduta: (e: unknown) => void;
}) {
  const [messaggi, setMessaggi] = useState<Messaggio[] | null>(null);
  const [testo, setTesto] = useState("");
  const [inCorso, setInCorso] = useState(false);
  const [ascolto, setAscolto] = useState(false);
  /** Quale funzione rapida è aperta (solo magazzino), o null. */
  const [azione, setAzione] = useState<TipoMovimento | null>(null);
  const fondo = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dettatura = useRef<{ stop: () => void } | null>(null);
  const funzioni = FUNZIONI[postazione.id] ?? [];

  // Il prefill dalle funzioni rapide dell'ufficio: arriva già mezzo scritto,
  // si finisce la frase e si manda.
  useEffect(() => {
    if (testoIniziale) {
      setTesto(testoIniziale);
      inputRef.current?.focus();
    }
  }, [testoIniziale]);

  /** Dopo una registrazione, una conferma in chat: resta la traccia di cosa si è fatto. */
  function conferma(riga: string) {
    setMessaggi((prima) => [
      ...(prima ?? []),
      { id: `c${Date.now()}`, ruolo: "agente", testo: riga, passato: false, creato: "" },
    ]);
  }

  useEffect(() => {
    // ⚠️ Guardia anti-sorpasso: se si cambia postazione mentre la richiesta
    // della precedente è ancora in volo, la risposta vecchia arriverebbe DOPO e
    // riempirebbe la nuova postazione con la conversazione sbagliata. La
    // richiesta obsoleta viene ignorata quando torna.
    let attuale = true;
    setMessaggi(null);
    leggi<{ messaggi: Messaggio[] }>("chat", { p: postazione.id })
      .then((r) => {
        if (attuale) setMessaggi(r.messaggi);
      })
      .catch((e) => {
        if (!attuale) return;
        seScaduta(e);
        // Una conversazione che non si carica non è «vuota»: dirlo, invece di
        // mostrare il saluto come se fosse il primo messaggio.
        setMessaggi([]);
      });
    return () => {
      attuale = false;
    };
  }, [postazione.id, seScaduta]);

  useEffect(() => {
    fondo.current?.scrollIntoView({ block: "end" });
  }, [messaggi, inCorso]);

  // ⚠️ Il microfono va spento uscendo dalla chat: senza, la dettatura resta
  // accesa dopo aver cambiato sezione, con la spia del microfono del telefono
  // che continua a lampeggiare. Su un'app aziendale è la cosa che fa pensare
  // «questo mi sta ascoltando» — e a ragione.
  useEffect(() => () => dettatura.current?.stop(), []);

  async function invia() {
    const t = testo.trim();
    if (!t || inCorso) return;
    setTesto("");
    setInCorso(true);
    // ⚠️ Il messaggio compare SUBITO, prima della risposta del server: chi
    // scrive deve vedere la propria frase nella conversazione nell'istante in
    // cui preme invio, o la riscrive convinto che non sia partita.
    setMessaggi((prima) => [
      ...(prima ?? []),
      { id: `t${Date.now()}`, ruolo: "persona", testo: t, passato: false, creato: "" },
    ]);
    try {
      const r = await manda<{ risposta: string; passato: boolean }>({
        az: "chat",
        postazione: postazione.id,
        testo: t,
      });
      setMessaggi((prima) => [
        ...(prima ?? []),
        { id: `a${Date.now()}`, ruolo: "agente", testo: r.risposta, passato: r.passato, creato: "" },
      ]);
    } catch (e) {
      seScaduta(e);
      setMessaggi((prima) => [
        ...(prima ?? []),
        {
          id: `e${Date.now()}`,
          ruolo: "agente",
          testo: "Non riesco a raggiungere il server. Il messaggio non è partito: riprova.",
          passato: true,
          creato: "",
        },
      ]);
    } finally {
      setInCorso(false);
    }
  }

  /**
   * La dettatura, dove il browser la offre.
   *
   * ⚠️ Web Speech, non un servizio nostro: la voce non lascia il telefono come
   * audio, arriva già trascritta. Metà delle 150 persone parlerà invece di
   * scrivere — autisti che guidano, magazzinieri con le mani occupate.
   */
  function detta() {
    if (ascolto) {
      dettatura.current?.stop();
      return;
    }
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const Riconoscitore = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Riconoscitore) return;
    const r = new Riconoscitore();
    r.lang = "it-IT";
    r.interimResults = true;
    r.onresult = (e) => {
      let frase = "";
      for (let i = 0; i < e.results.length; i++) frase += e.results[i][0].transcript;
      setTesto(frase);
    };
    r.onend = () => setAscolto(false);
    r.onerror = () => setAscolto(false);
    dettatura.current = r;
    setAscolto(true);
    r.start();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-[var(--border)] px-5 py-3.5 md:px-8">
        <h1 className="text-[15.5px] font-semibold tracking-[-0.01em]">{postazione.nome}</h1>
        <p className="mt-0.5 text-[12.5px] text-[var(--text-secondary)]">{postazione.cosa}</p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-6 md:px-8">
        <div className="mx-auto flex min-h-full w-full max-w-[620px] flex-col justify-end space-y-3">
          {messaggi === null && (
            <p className="text-center text-[12.5px] text-[var(--text-secondary)]">
              Riprendo la conversazione…
            </p>
          )}

          {messaggi !== null && messaggi.length === 0 && (
            <div className="rounded-2xl rounded-bl-md bg-[var(--fill-quiet)] px-4 py-3 text-[14.5px] leading-relaxed">
              Buongiorno{nome ? ` ${nome}` : ""}. Sono l'agente del{" "}
              {postazione.nome.toLowerCase()}.
              <br />
              Chiedimi quello che ti serve — anche a voce.
            </div>
          )}

          {messaggi?.map((msg) => (
            <div key={msg.id}>
              <div
                className={
                  msg.ruolo === "persona"
                    ? "ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md px-4 py-2.5 text-[14.5px] leading-relaxed"
                    : "w-fit max-w-[85%] rounded-2xl rounded-bl-md bg-[var(--fill-quiet)] px-4 py-2.5 text-[14.5px] leading-relaxed"
                }
                style={
                  msg.ruolo === "persona"
                    ? { background: "var(--accent-soft)" }
                    : undefined
                }
              >
                {msg.testo}
              </div>
              {/* ⚠️ Quando l'agente ha girato la domanda a una persona lo si
                  scrive sotto la risposta, piccolo ma leggibile: sapere che un
                  umano se ne sta occupando È la risposta, per chi aspetta. */}
              {msg.ruolo === "agente" && msg.passato && (
                <p className="mt-1 pl-1 text-[11px] text-[var(--text-secondary)]">
                  Girata a una persona — la vede il titolare nel cruscotto.
                </p>
              )}
            </div>
          ))}

          {inCorso && (
            <div className="w-fit rounded-2xl rounded-bl-md bg-[var(--fill-quiet)] px-4 py-2.5">
              <span className="inline-flex gap-1" aria-label="L'agente sta scrivendo">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--text-secondary)]"
                    style={{ animationDelay: `${i * 140}ms` }}
                  />
                ))}
              </span>
            </div>
          )}
          <div ref={fondo} />
        </div>
      </div>

      {/* ── Le funzioni rapide della postazione ─────────────────────────
          Solo dove ci sono (oggi il magazzino). Ognuna apre la cosa giusta:
          un carico si registra, «dov'è» si chiede all'agente. */}
      {funzioni.length > 0 && (
        <div className="border-t border-[var(--border)] px-5 pt-3 md:px-8">
          <div className="mx-auto flex w-full max-w-[620px] flex-wrap gap-2">
            {funzioni.map((f) => (
              <button
                key={f.etichetta}
                onClick={() => {
                  if (f.tipo) setAzione(f.tipo);
                  else {
                    // «Dov'è…» non è una registrazione: è una domanda all'agente.
                    setTesto(f.prefisso ?? "");
                    inputRef.current?.focus();
                  }
                }}
                className="flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-3 py-1.5 text-[12.5px] font-medium transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]"
              >
                <span aria-hidden>{f.icona}</span>
                {f.etichetta}
              </button>
            ))}
          </div>
        </div>
      )}

      {azione && (
        <FormMovimento
          tipo={azione}
          onChiudi={() => setAzione(null)}
          onFatto={(riga) => {
            setAzione(null);
            conferma(riga);
          }}
          seScaduta={seScaduta}
        />
      )}

      <div className="border-t border-[var(--border)] px-5 py-4 md:px-8">
        <div className="mx-auto w-full max-w-[620px]">
          {!agenteVivo && (
            <p className="mb-2 text-[12px] text-[var(--text-secondary)]">
              L'agente è momentaneamente spento: quello che scrivi si salva e
              viene ripreso appena torna.
            </p>
          )}
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void invia();
            }}
          >
            <input
              ref={inputRef}
              value={testo}
              onChange={(e) => setTesto(e.target.value)}
              placeholder={ascolto ? "Ti ascolto…" : "Scrivi, oppure premi il microfono…"}
              className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3.5 py-3 text-[16px] outline-none focus:border-[var(--accent)] sm:text-[14.5px]"
            />
            {/* ⚠️ Il microfono è grande quanto l'invio, non un'iconcina di lato. */}
            <button
              type="button"
              onClick={detta}
              aria-label={ascolto ? "Smetti di ascoltare" : "Parla"}
              className="shrink-0 cursor-pointer rounded-xl border px-4 text-[18px] transition-colors"
              style={
                ascolto
                  ? { borderColor: "var(--accent)", background: "var(--accent-soft)" }
                  : { borderColor: "var(--border)" }
              }
            >
              🎤
            </button>
            <button
              type="submit"
              disabled={!testo.trim() || inCorso}
              className="btn-grad shrink-0 cursor-pointer rounded-xl px-4 text-[14px] font-medium disabled:opacity-40"
            >
              Invia
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
  onend: () => void;
  onerror: () => void;
  start: () => void;
  stop: () => void;
}

// ─────────────────────────────────────────────────────────────────────────
// LE FUNZIONI RAPIDE DELLE POSTAZIONI
// ─────────────────────────────────────────────────────────────────────────

type TipoMovimento = "carico" | "scarico" | "differenza" | "problema" | "ritiro" | "reclamo";

interface Funzione {
  etichetta: string;
  icona: string;
  /** Se c'è, apre il form di registrazione. Se no, prefiltra la chat. */
  tipo?: TipoMovimento;
  prefisso?: string;
}

/**
 * ⚠️ Oggi solo il magazzino, per decisione di Tommaso: si parte da lì, il
 * traffico è il prossimo. Aggiungere un reparto è aggiungere una riga qui.
 */
const FUNZIONI: Record<string, Funzione[]> = {
  magazzino: [
    { etichetta: "Carico", icona: "📥", tipo: "carico" },
    { etichetta: "Scarico", icona: "📤", tipo: "scarico" },
    { etichetta: "Differenza", icona: "⚠️", tipo: "differenza" },
    { etichetta: "Dov'è…", icona: "🔎", prefisso: "Dov'è " },
    { etichetta: "Problema", icona: "🛠️", tipo: "problema" },
  ],
};

const NOMI_MOVIMENTO: Record<TipoMovimento, string> = {
  carico: "Registra un carico",
  scarico: "Registra uno scarico",
  differenza: "Differenza di conteggio",
  problema: "Segnala un problema",
  ritiro: "Prenota un ritiro",
  reclamo: "Reclamo o sollecito di un cliente",
};

/**
 * Il form di una funzione del magazzino.
 *
 * ⚠️ È **deterministico**: non passa dal modello, scrive una riga e basta.
 * Carico e scarico sono fatti (colli, mezzo, cliente); la differenza e il
 * problema diventano una cosa «da controllare» per il capo. Niente
 * allucinazioni possibili — questo è un registro, non una chiacchierata.
 */
function FormMovimento({
  tipo,
  onChiudi,
  onFatto,
  seScaduta,
}: {
  tipo: TipoMovimento;
  onChiudi: () => void;
  onFatto: (riga: string) => void;
  seScaduta: (e: unknown) => void;
}) {
  const merci = tipo === "carico" || tipo === "scarico";
  const conCliente = merci || tipo === "ritiro" || tipo === "reclamo";
  const [colli, setColli] = useState("");
  const [atteso, setAtteso] = useState("");
  const [contato, setContato] = useState("");
  const [controparte, setControparte] = useState("");
  const [mezzo, setMezzo] = useState("");
  const [testo, setTesto] = useState("");
  const [quando, setQuando] = useState("");
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [mezzi, setMezzi] = useState<Mezzo[]>([]);
  const [inCorso, setInCorso] = useState(false);

  useEffect(() => {
    // I clienti servono per «da chi/per chi», i mezzi per «su che mezzo».
    // Se non arrivano (rete), il campo resta scrivibile a mano: non si blocca.
    if (conCliente) {
      leggi<{ clienti: Cliente[] }>("clienti").then((r) => setClienti(r.clienti)).catch(() => {});
    }
    if (merci) {
      leggi<{ mezzi: Mezzo[] }>("mezzi").then((r) => setMezzi(r.mezzi)).catch(() => {});
    }
  }, [merci, conCliente]);

  const pronto =
    (tipo === "carico" || tipo === "scarico") ? colli.trim() !== "" :
    tipo === "differenza" ? atteso.trim() !== "" && contato.trim() !== "" :
    tipo === "ritiro" ? controparte.trim() !== "" :
    tipo === "reclamo" ? controparte.trim() !== "" && testo.trim() !== "" :
    testo.trim() !== "";

  async function salva() {
    if (!pronto || inCorso) return;
    setInCorso(true);
    try {
      await manda({
        az: "movimento",
        movimento: {
          tipo,
          colli: merci || tipo === "ritiro" ? colli : null,
          atteso: tipo === "differenza" ? atteso : null,
          contato: tipo === "differenza" ? contato : null,
          mezzo: merci ? mezzo : "",
          controparte: conCliente ? controparte : "",
          testo,
          previsto: tipo === "ritiro" && quando ? new Date(quando).toISOString() : null,
        },
      });
      onFatto(rigaConferma());
    } catch (e) {
      seScaduta(e);
      setInCorso(false);
    }
  }

  function rigaConferma(): string {
    if (tipo === "carico") return `✅ Carico registrato: ${colli} colli${controparte ? ` da ${controparte}` : ""}${mezzo ? ` · ${mezzo}` : ""}.`;
    if (tipo === "scarico") return `✅ Scarico registrato: ${colli} colli${controparte ? ` per ${controparte}` : ""}${mezzo ? ` · ${mezzo}` : ""}.`;
    if (tipo === "differenza") return `⚠️ Differenza segnalata: attesi ${atteso}, contati ${contato}. La vede il capo.`;
    if (tipo === "ritiro") return `📋 Ritiro prenotato da ${controparte}${colli ? `, ${colli} colli` : ""}${quando ? ` — ${new Date(quando).toLocaleString("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : ""}. Lo vede anche il magazzino.`;
    if (tipo === "reclamo") return `📣 Reclamo di ${controparte} registrato. Lo vede il capo e il titolare.`;
    return "🛠️ Problema segnalato. Lo vede il capo e il titolare.";
  }

  return (
    <div className="border-t border-[var(--border)] bg-[var(--fill-quiet)] px-5 py-4 md:px-8">
      <form
        className="mx-auto w-full max-w-[620px]"
        onSubmit={(e) => {
          e.preventDefault();
          void salva();
        }}
      >
        <p className="mb-3 text-[13.5px] font-medium">{NOMI_MOVIMENTO[tipo]}</p>

        {merci && (
          <div className="grid gap-2.5 sm:grid-cols-2">
            <Campo etichetta="Quanti colli *">
              <input
                type="number"
                inputMode="numeric"
                value={colli}
                onChange={(e) => setColli(e.target.value)}
                placeholder="es. 24"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2.5 text-[16px] outline-none focus:border-[var(--accent)] sm:text-[14px]"
              />
            </Campo>
            <Campo etichetta={tipo === "carico" ? "Da chi" : "Per chi"}>
              <input
                list="clienti-lista"
                value={controparte}
                onChange={(e) => setControparte(e.target.value)}
                placeholder="Scegli o scrivi il cliente"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2.5 text-[16px] outline-none focus:border-[var(--accent)] sm:text-[14px]"
              />
              <datalist id="clienti-lista">
                {clienti.map((c) => (
                  <option key={c.id} value={c.nome} />
                ))}
              </datalist>
            </Campo>
            <Campo etichetta="Su che mezzo">
              <input
                list="mezzi-lista"
                value={mezzo}
                onChange={(e) => setMezzo(e.target.value)}
                placeholder={mezzi.length ? "Scegli il mezzo" : "Targa o nome"}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2.5 text-[16px] outline-none focus:border-[var(--accent)] sm:text-[14px]"
              />
              <datalist id="mezzi-lista">
                {mezzi.map((m) => (
                  <option key={m.id} value={[m.nome, m.targa].filter(Boolean).join(" ")} />
                ))}
              </datalist>
            </Campo>
            <Campo etichetta="Numero bolla / DDT">
              <input
                value={testo}
                onChange={(e) => setTesto(e.target.value)}
                placeholder="es. 2026/0451"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2.5 text-[16px] outline-none focus:border-[var(--accent)] sm:text-[14px]"
              />
            </Campo>
          </div>
        )}

        {tipo === "differenza" && (
          <div className="grid gap-2.5 sm:grid-cols-2">
            <Campo etichetta="Attesi (dalla bolla) *">
              <input
                type="number"
                inputMode="numeric"
                value={atteso}
                onChange={(e) => setAtteso(e.target.value)}
                placeholder="es. 40"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2.5 text-[16px] outline-none focus:border-[var(--accent)] sm:text-[14px]"
              />
            </Campo>
            <Campo etichetta="Contati (davvero) *">
              <input
                type="number"
                inputMode="numeric"
                value={contato}
                onChange={(e) => setContato(e.target.value)}
                placeholder="es. 38"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2.5 text-[16px] outline-none focus:border-[var(--accent)] sm:text-[14px]"
              />
            </Campo>
            <Campo etichetta="Cosa e di chi (facoltativo)">
              <input
                value={testo}
                onChange={(e) => setTesto(e.target.value)}
                placeholder="es. pallet Rossi, bolla 0451"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2.5 text-[16px] outline-none focus:border-[var(--accent)] sm:col-span-2 sm:text-[14px]"
              />
            </Campo>
          </div>
        )}

        {tipo === "ritiro" && (
          <div className="grid gap-2.5 sm:grid-cols-2">
            <Campo etichetta="Da quale cliente *">
              <input
                list="clienti-lista"
                value={controparte}
                onChange={(e) => setControparte(e.target.value)}
                placeholder="Scegli o scrivi il cliente"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2.5 text-[16px] outline-none focus:border-[var(--accent)] sm:text-[14px]"
              />
              <datalist id="clienti-lista">
                {clienti.map((c) => (
                  <option key={c.id} value={c.nome} />
                ))}
              </datalist>
            </Campo>
            <Campo etichetta="Quando">
              <input
                type="datetime-local"
                value={quando}
                onChange={(e) => setQuando(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2.5 text-[16px] outline-none focus:border-[var(--accent)] sm:text-[14px]"
              />
            </Campo>
            <Campo etichetta="Quanti colli">
              <input
                type="number"
                inputMode="numeric"
                value={colli}
                onChange={(e) => setColli(e.target.value)}
                placeholder="es. 8"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2.5 text-[16px] outline-none focus:border-[var(--accent)] sm:text-[14px]"
              />
            </Campo>
            <Campo etichetta="Dove / note">
              <input
                value={testo}
                onChange={(e) => setTesto(e.target.value)}
                placeholder="es. via Onorato 12, ore 9-12"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2.5 text-[16px] outline-none focus:border-[var(--accent)] sm:text-[14px]"
              />
            </Campo>
          </div>
        )}

        {tipo === "reclamo" && (
          <div className="grid gap-2.5">
            <Campo etichetta="Quale cliente *">
              <input
                list="clienti-lista"
                value={controparte}
                onChange={(e) => setControparte(e.target.value)}
                placeholder="Scegli o scrivi il cliente"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2.5 text-[16px] outline-none focus:border-[var(--accent)] sm:text-[14px]"
              />
              <datalist id="clienti-lista">
                {clienti.map((c) => (
                  <option key={c.id} value={c.nome} />
                ))}
              </datalist>
            </Campo>
            <textarea
              value={testo}
              onChange={(e) => setTesto(e.target.value)}
              placeholder="Cosa lamenta — es. «Consegna di ieri mai arrivata, aspetta una chiamata»"
              rows={3}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2.5 text-[16px] leading-relaxed outline-none focus:border-[var(--accent)] sm:text-[14px]"
            />
          </div>
        )}

        {tipo === "problema" && (
          <textarea
            value={testo}
            onChange={(e) => setTesto(e.target.value)}
            placeholder="Cosa non va — es. «Muletto 2 non parte» o «Spazio finito in baia 3»"
            rows={3}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2.5 text-[16px] leading-relaxed outline-none focus:border-[var(--accent)] sm:text-[14px]"
          />
        )}

        <div className="mt-3 flex gap-2">
          <button
            type="submit"
            disabled={!pronto || inCorso}
            className="btn-grad cursor-pointer rounded-lg px-4 py-2 text-[13px] font-medium disabled:opacity-40"
          >
            {inCorso ? "Registro…" : "Registra"}
          </button>
          <button
            type="button"
            onClick={onChiudi}
            className="cursor-pointer rounded-lg px-3 py-2 text-[13px] text-[var(--text-secondary)] hover:bg-[var(--bg-card)]"
          >
            Annulla
          </button>
        </div>
      </form>
    </div>
  );
}

function Campo({ etichetta, children }: { etichetta: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[12px] text-[var(--text-secondary)]">{etichetta}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// IL CRUSCOTTO — i numeri contati, disegnati
// ─────────────────────────────────────────────────────────────────────────

/**
 * Lo stile è quello che Salvatore guarda già tutti i giorni nel suo gestionale:
 * barre verdi pulite in alto, un andamento a linea sotto (Tommaso: *«così lo
 * stile, non copiarlo però tipo così»*). La differenza è cosa c'è dentro:
 * **solo numeri nostri**. Il fatturato resta una cornice vuota che dice da dove
 * arriverà — perché uno zero è una bugia involontaria.
 *
 * ⚠️ Due colori in tutto il cruscotto: il verde del marchio per «l'agente ha
 * fatto», il grigio per «è passata a una persona». Il grigio non è una serie
 * qualunque: è la spia più onesta del sistema, perché dice quanto l'agente NON
 * sa ancora fare. L'oro del marchio non porta mai un numero — su bianco ha un
 * contrasto di 1,55:1, e un dato che non si legge non è un dato.
 */
const GRIGIO = "#6B7280";

function Cruscotto({
  nome,
  postazioni,
  seScaduta,
}: {
  nome?: string;
  postazioni: PostazioneViva[];
  seScaduta: (e: unknown) => void;
}) {
  const [dati, setDati] = useState<DatiCruscotto | null>(null);
  const [errore, setErrore] = useState(false);
  const [riepilogo, setRiepilogo] = useState<string | null>(null);
  const [riepilogoInCorso, setRiepilogoInCorso] = useState(false);

  useEffect(() => {
    leggi<{ cruscotto: DatiCruscotto }>("cruscotto")
      .then((r) => setDati(r.cruscotto))
      .catch((e) => {
        seScaduta(e);
        setErrore(true);
      });
  }, [seScaduta]);

  async function chiediRiepilogo() {
    setRiepilogoInCorso(true);
    try {
      const r = await leggi<{ testo: string }>("riepilogo");
      setRiepilogo(r.testo);
    } catch (e) {
      seScaduta(e);
    } finally {
      setRiepilogoInCorso(false);
    }
  }

  const ora = new Date().getHours();
  const saluto = ora < 12 ? "Buongiorno" : ora < 18 ? "Buon pomeriggio" : "Buonasera";
  const nomePostazione = (id: string) => postazioni.find((p) => p.id === id)?.nome ?? id;

  return (
    <div className="flex-1 overflow-y-auto px-5 py-7 md:px-8">
      <div className="mx-auto max-w-[1060px]">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">
          {saluto}
          {nome ? ` ${nome}` : ""}
        </h1>
        <p className="mt-1 text-[13.5px] text-[var(--text-secondary)]">
          {new Date().toLocaleDateString("it-IT", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </p>

        {errore && (
          <p className="mt-6 text-[13.5px] text-[var(--text-secondary)]">
            Non riesco a leggere i numeri in questo momento. Ricarica fra un attimo.
          </p>
        )}

        {!dati && !errore && (
          <p className="mt-6 text-[13.5px] text-[var(--text-secondary)]">Conto…</p>
        )}

        {dati && (
          <>
            {/* ── 0 · L'AGENTE CHE GUARDA TUTTA L'AZIENDA ──────────────── */}
            {/* ⚠️ È la cosa che fa sentire l'IA in TUTTA l'azienda e non solo
                nella chat: un agente di direzione che legge i numeri veri di
                tutti i reparti insieme e racconta com'è andata. Su richiesta,
                non a ogni apertura: ogni riepilogo è una chiamata al modello,
                cioè un costo, e uno che non lo hai chiesto è un costo sprecato. */}
            <div
              className="mt-6 rounded-xl border bg-[var(--bg-card)] p-4 sm:p-5"
              style={{ borderColor: "var(--accent)" }}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span
                    aria-hidden
                    className="flex h-8 w-8 items-center justify-center rounded-full text-[15px]"
                    style={{ background: "var(--accent-soft)" }}
                  >
                    ✦
                  </span>
                  <div>
                    <p className="text-[13.5px] font-medium">L'agente di direzione</p>
                    <p className="text-[12px] text-[var(--text-secondary)]">
                      Guarda tutta l'azienda insieme e ti dice com'è andata.
                    </p>
                  </div>
                </div>
                {!riepilogo && (
                  <button
                    onClick={() => void chiediRiepilogo()}
                    disabled={riepilogoInCorso}
                    className="btn-grad shrink-0 cursor-pointer rounded-lg px-4 py-2 text-[13px] font-medium disabled:opacity-50"
                  >
                    {riepilogoInCorso ? "Sto guardando…" : "Fatti raccontare la giornata"}
                  </button>
                )}
              </div>
              {riepilogo && (
                <div className="mt-3 border-t border-[var(--border)] pt-3">
                  <p className="text-[14px] leading-relaxed">{riepilogo}</p>
                  <button
                    onClick={() => void chiediRiepilogo()}
                    disabled={riepilogoInCorso}
                    className="mt-2.5 cursor-pointer text-[12px] text-[var(--text-secondary)] underline-offset-2 hover:underline disabled:opacity-50"
                  >
                    {riepilogoInCorso ? "Sto guardando…" : "Aggiorna"}
                  </button>
                </div>
              )}
            </div>

            {/* ── 1 · I GUADAGNI — la prima cosa che un titolare guarda ── */}
            {/* ⚠️ Oggi/mese/anno. I numeri veri arrivano dal gestionale delle
                fatture: finché non è collegato, ogni riquadro dice DA DOVE
                verrà, non uno zero. Uno zero al posto del fatturato sembra un
                dato letto — e fa credere all'imprenditore di non aver guadagnato
                niente. La struttura c'è, si riempie nel momento del
                collegamento. */}
            <div className="mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="text-[11px] uppercase tracking-[0.09em] text-[var(--text-secondary)]">
                Guadagni
              </h2>
              <span className="text-[11.5px] text-[var(--text-secondary)] opacity-70">
                dal gestionale fatture — in attesa del collegamento
              </span>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <Soldi periodo="Oggi" />
              <Soldi periodo="Questo mese" />
              <Soldi periodo="Quest'anno" />
            </div>

            {/* ── 2 · OGGI, IN QUATTRO NUMERI ─────────────────────────── */}
            <Fascia titolo="L'agente, oggi" sotto="questi li misuriamo noi: sono veri dal primo giorno" />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Numero
                valore={String(dati.oggi.domande)}
                titolo="Richieste all'agente"
                sotto="oggi, da tutte le postazioni"
              />
              <Numero
                valore={String(dati.oggi.risposte)}
                titolo="Risposte da solo"
                sotto="senza disturbare nessuno"
              />
              <Numero
                valore={String(dati.oggi.passate)}
                titolo="Passate a una persona"
                sotto="quando non sapeva"
              />
              <Numero
                valore={secondi(dati.oggi.attesa)}
                titolo="Tempo di risposta"
                sotto="media di oggi"
              />
            </div>

            {/* ── 2 · LA GIORNATA, ORA PER ORA ────────────────────────── */}
            <div className="mt-3">
              <Cornice
                titolo="La giornata, ora per ora"
                sotto="Quante richieste arrivano all'agente, e quando. È il grafico che dice a che ora serve gente in più."
              >
                <Barre
                  dati={dati.ore.map((o) => ({
                    etichetta: String(o.h),
                    sotto: `dalle ${o.h}:00 alle ${o.h + 1}:00`,
                    valore: o.n,
                  }))}
                  unita="richieste"
                />
              </Cornice>
            </div>

            {/* ── 3 · LA SETTIMANA E LE POSTAZIONI ────────────────────── */}
            <div className="mt-3 grid gap-3 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <Cornice
                  titolo="Gli ultimi sette giorni"
                  sotto="Le richieste, e quante l'agente ha dovuto girare a una persona."
                >
                  <Linea
                    punti={dati.giorni.map((g) => ({
                      etichetta: giornoCorto(g.d),
                      sotto: new Date(g.d).toLocaleDateString("it-IT", {
                        day: "numeric",
                        month: "long",
                      }),
                      valori: [g.n, g.p],
                    }))}
                    serie={[
                      { nome: "Richieste", colore: "#008E33" },
                      { nome: "Passate a una persona", colore: GRIGIO },
                    ]}
                  />
                </Cornice>
              </div>
              <Cornice
                titolo="Da dove arrivano"
                sotto="Richieste per postazione, questa settimana."
              >
                {dati.per_postazione.length ? (
                  <Sdraiate
                    dati={dati.per_postazione.map((p) => ({
                      nome: nomePostazione(p.p),
                      valore: p.n,
                    }))}
                  />
                ) : (
                  <p className="py-6 text-center text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
                    Ancora nessuna richiesta questa settimana.
                    <br />
                    Appena qualcuno scrive a una postazione, qui si vede da quale.
                  </p>
                )}
              </Cornice>
            </div>

            {/* ── 4 · ASPETTA TE ──────────────────────────────────────── */}
            {/* ⚠️ Questa sezione è la ragione per cui un titolare torna ogni
                giorno. Un cruscotto che mostra solo numeri si guarda per una
                settimana; uno che dice «ci sono tre cose che aspettano te» si
                apre tutte le mattine. */}
            <div className="mt-9">
              <h2 className="text-[11px] uppercase tracking-[0.09em] text-[var(--text-secondary)]">
                Aspetta te
              </h2>
              {dati.aspetta.length || dati.controlli.length ? (
                <div className="mt-3 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-card)]">
                  {/* Prima le segnalazioni operative (problemi, differenze):
                      sono soldi e mezzi fermi, più urgenti di una domanda. */}
                  {dati.controlli.map((c, i) => (
                    <div
                      key={`c${c.id}`}
                      className={`px-4 py-3 ${i > 0 ? "border-t border-[var(--border)]" : ""}`}
                    >
                      <p className="text-[13.5px] leading-relaxed">
                        <span aria-hidden>{c.tipo === "problema" ? "🛠️ " : "⚠️ "}</span>
                        {c.tipo === "differenza"
                          ? `Differenza al ${c.reparto.toLowerCase()}: attesi ${c.atteso}, contati ${c.contato}${c.testo ? ` — ${c.testo}` : ""}`
                          : c.testo || "(segnalazione)"}
                      </p>
                      <p className="mt-1 text-[11.5px] text-[var(--text-secondary)]">
                        {c.chi ? `${c.chi} · ` : ""}
                        {c.reparto} · {quando(c.creato)}
                      </p>
                    </div>
                  ))}
                  {dati.aspetta.map((a, i) => (
                    <div
                      key={`a${i}`}
                      className={`px-4 py-3 ${
                        i > 0 || dati.controlli.length ? "border-t border-[var(--border)]" : ""
                      }`}
                    >
                      <p className="text-[13.5px] leading-relaxed">
                        {a.testo ?? "(domanda non registrata)"}
                      </p>
                      <p className="mt-1 text-[11.5px] text-[var(--text-secondary)]">
                        {a.chi ? `${a.chi} · ` : ""}
                        {nomePostazione(a.postazione)} · {quando(a.creato)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3 rounded-xl border border-dashed border-[var(--border)] p-7 text-center">
                  <p className="text-[14.5px] font-medium">Non c'è niente in sospeso</p>
                  <p className="mx-auto mt-1.5 max-w-[44ch] text-[13px] leading-relaxed text-[var(--text-secondary)]">
                    Qui compaiono le domande che l'agente ha girato a te perché non
                    sapeva rispondere.
                  </p>
                </div>
              )}
            </div>

            {/* ── 5 · IL MAGAZZINO — già vero, dalle registrazioni dei suoi ── */}
            {/* ⚠️ Questa fascia non aspetta più gli scanner: i magazzinieri
                registrano carichi e scarichi a mano, e questi numeri sono
                contati da quelle righe. Quando arriva il connettore, si
                affianca. Se oggi non c'è ancora nessun movimento, resta la
                cornice d'attesa: uno zero sarebbe una bugia. */}
            {dati.magazzino && dati.magazzino.movimenti + dati.magazzino.differenze > 0 ? (
              <>
                <div className="mt-9 mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h2 className="text-[11px] uppercase tracking-[0.09em] text-[var(--text-secondary)]">
                    Magazzino
                  </h2>
                  <span className="text-[11.5px] text-[var(--text-secondary)] opacity-70">
                    registrato dai magazzinieri, oggi
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Numero valore={String(dati.magazzino.entrati)} titolo="Colli entrati" sotto="oggi" />
                  <Numero valore={String(dati.magazzino.usciti)} titolo="Colli usciti" sotto="oggi" />
                  <Numero valore={String(dati.magazzino.movimenti)} titolo="Movimenti" sotto="carichi e scarichi" />
                  <Numero valore={String(dati.magazzino.differenze)} titolo="Differenze" sotto="da controllare" />
                </div>
              </>
            ) : null}

            {/* ── 6 · QUELLO CHE ARRIVERÀ COI COLLEGAMENTI ────────────── */}
            {/* ⚠️ Cornici da grafico con gli assi disegnati e NESSUNA barra:
                si vede che il posto è pronto e cosa lo riempirà, senza mostrare
                uno zero che sembrerebbe un dato letto. */}
            <div className="mt-9 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="text-[11px] uppercase tracking-[0.09em] text-[var(--text-secondary)]">
                In attesa dei collegamenti
              </h2>
              <span
                aria-hidden
                className="h-1 w-14 shrink-0 self-center rounded-full"
                style={{ background: "var(--marchio-secondario)" }}
              />
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <Cornice titolo="Il lavoro" sotto="spedizioni, consegne, ritardi">
                <Attesa da="K-Master e QCSNET" altezza={140} />
              </Cornice>
              <Cornice titolo="Le mail dei clienti" sotto="risposte, solleciti, fornitori">
                <Attesa da="Outlook, appena collegato" altezza={140} />
              </Cornice>
            </div>

            {/* ── 6 · LA SPIEGAZIONE ONESTA ───────────────────────────── */}
            <div
              className="mt-9 rounded-xl border-l-2 bg-[var(--fill-quiet)] px-5 py-4"
              style={{ borderColor: "var(--accent)" }}
            >
              <p className="text-[13.5px] font-medium">
                I numeri qui sopra sono contati, non stimati
              </p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--text-secondary)]">
                Ogni richiesta, risposta e passaggio a una persona è una riga scritta
                nel momento in cui succede: questi grafici li disegnano contando
                quelle righe. Fatturato, spedizioni e magazzino vivono invece nei
                vostri sistemi — si riempiono nel momento esatto in cui colleghiamo i
                vostri programmi, e non prima.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Un numero che misuriamo noi, quindi c'è davvero. */
function Numero({ valore, titolo, sotto }: { valore: string; titolo: string; sotto: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
      <p className="text-[30px] font-semibold leading-none tracking-[-0.02em] tabular-nums">
        {valore}
      </p>
      <p className="mt-2 text-[13px] font-medium">{titolo}</p>
      <p className="mt-0.5 text-[12px] text-[var(--text-secondary)]">{sotto}</p>
    </div>
  );
}

/** L'intestazione di una fascia del cruscotto, col «da dove». */
function Fascia({ titolo, sotto }: { titolo: string; sotto: string }) {
  return (
    <div className="mt-9 mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <h2 className="text-[11px] uppercase tracking-[0.09em] text-[var(--text-secondary)]">
        {titolo}
      </h2>
      <span className="text-[11.5px] text-[var(--text-secondary)] opacity-70">{sotto}</span>
    </div>
  );
}

/**
 * Un riquadro dei guadagni per un periodo.
 *
 * ⚠️ Mostra un trattino, non uno zero: il fatturato lo tiene il gestionale
 * delle fatture, e finché non lo colleghiamo non lo sappiamo. Un «0 €» qui
 * direbbe a Salvatore che oggi non ha incassato niente — una bugia. Un trattino
 * dice la verità: non lo sappiamo ancora. Il giorno del collegamento questo
 * riquadro mostra la cifra vera senza toccare altro.
 */
function Soldi({ periodo }: { periodo: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--border)] p-4">
      <p className="text-[30px] font-semibold leading-none tracking-[-0.02em] text-[var(--text-secondary)]">
        —
      </p>
      <p className="mt-2 text-[13px] font-medium">{periodo}</p>
      <p className="mt-0.5 text-[12px] text-[var(--text-secondary)] opacity-70">
        in attesa del gestionale
      </p>
    </div>
  );
}

function secondi(ms: number | null): string {
  if (ms === null || ms === undefined) return "—";
  return `${(ms / 1000).toFixed(1).replace(".", ",")} s`;
}

function giornoCorto(data: string): string {
  const g = new Date(data).toLocaleDateString("it-IT", { weekday: "short" });
  return g.charAt(0).toUpperCase() + g.slice(1).replace(".", "");
}

function quando(iso: string): string {
  const d = new Date(iso);
  const oggi = new Date();
  if (d.toDateString() === oggi.toDateString()) {
    return `oggi alle ${d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}`;
  }
  return d.toLocaleDateString("it-IT", { day: "numeric", month: "long" });
}

// ─────────────────────────────────────────────────────────────────────────
// I CLIENTI — l'anagrafica vera
// ─────────────────────────────────────────────────────────────────────────

const CLIENTE_VUOTO = {
  id: "",
  nome: "",
  referente: "",
  telefono: "",
  email: "",
  zona: "",
  note: "",
};

function Clienti({
  ruolo,
  seScaduta,
}: {
  ruolo: string;
  seScaduta: (e: unknown) => void;
}) {
  const [elenco, setElenco] = useState<Cliente[] | null>(null);
  const [cerca, setCerca] = useState("");
  const [bozza, setBozza] = useState<typeof CLIENTE_VUOTO | null>(null);
  const [inCorso, setInCorso] = useState(false);
  // Chi «guarda e non tocca» vede le schede ma non i pulsanti per cambiarle:
  // il vero cancello è sul server, questo evita solo un pulsante che darebbe errore.
  const puoScrivere = ruolo !== "osservatore";
  // ⚠️ Il numero d'ordine dell'ultima ricerca partita. Se uno cerca «ro» e poi
  // «rossi», la risposta di «ro» può tornare DOPO quella di «rossi» e
  // sovrascrivere i risultati giusti coi vecchi. Si applica solo la risposta
  // dell'ultima ricerca partita, le altre si scartano quando tornano.
  const ultima = useRef(0);

  const carica = useCallback(
    (q = "") => {
      const mia = ++ultima.current;
      leggi<{ clienti: Cliente[] }>("clienti", q ? { q } : {})
        .then((r) => {
          if (mia === ultima.current) setElenco(r.clienti);
        })
        .catch((e) => {
          if (mia !== ultima.current) return;
          seScaduta(e);
          setElenco([]);
        });
    },
    [seScaduta]
  );

  // Una sola strada: la ricerca aspetta che si smetta di scrivere (una chiamata
  // per lettera è traffico inutile), e al primo montaggio parte con cerca vuoto,
  // quindi carica tutto. Nessun secondo effetto che raddoppierebbe la chiamata.
  useEffect(() => {
    const t = setTimeout(() => carica(cerca), cerca ? 250 : 0);
    return () => clearTimeout(t);
  }, [cerca, carica]);

  async function salva() {
    if (!bozza || !bozza.nome.trim() || inCorso) return;
    setInCorso(true);
    try {
      await manda({ az: "cliente", cliente: { ...bozza, id: bozza.id || null } });
      setBozza(null);
      carica(cerca);
    } catch (e) {
      seScaduta(e);
    } finally {
      setInCorso(false);
    }
  }

  async function elimina(id: string) {
    // ⚠️ Niente finestra di conferma del browser: brutta e facile da cliccare a
    // caso. La scheda si può ricreare; il fastidio di una conferma a ogni
    // eliminazione resta per sempre.
    try {
      await manda({ az: "cliente-elimina", id });
      carica(cerca);
    } catch (e) {
      seScaduta(e);
    }
  }

  return (
    <Pagina
      titolo="Clienti"
      sotto="Il fascicolo di ogni cliente: chi è, come lo si chiama, cosa c'è da sapere. L'agente conosce questi nomi."
    >
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={cerca}
          onChange={(e) => setCerca(e.target.value)}
          placeholder="Cerca per nome, referente o zona…"
          className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3.5 py-2.5 text-[16px] outline-none focus:border-[var(--accent)] sm:text-[13.5px]"
        />
        {puoScrivere && (
        <button
          onClick={() => setBozza({ ...CLIENTE_VUOTO })}
          className="btn-grad shrink-0 cursor-pointer rounded-xl px-4 py-2.5 text-[13.5px] font-medium"
        >
          Nuovo cliente
        </button>
        )}
      </div>

      {bozza && (
        <form
          className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void salva();
          }}
        >
          <p className="text-[13.5px] font-medium">
            {bozza.id ? "Modifica la scheda" : "Un nuovo cliente"}
          </p>
          <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
            {(
              [
                ["nome", "Nome dell'azienda *"],
                ["referente", "Con chi si parla"],
                ["telefono", "Telefono"],
                ["email", "Email"],
                ["zona", "Zona"],
              ] as const
            ).map(([campo, etichetta]) => (
              <input
                key={campo}
                value={bozza[campo]}
                onChange={(e) => setBozza({ ...bozza, [campo]: e.target.value })}
                placeholder={etichetta}
                className="rounded-lg border border-[var(--border)] bg-[var(--bg-app)] px-3 py-2.5 text-[16px] outline-none focus:border-[var(--accent)] sm:text-[13.5px]"
              />
            ))}
            <textarea
              value={bozza.note}
              onChange={(e) => setBozza({ ...bozza, note: e.target.value })}
              placeholder="Note: accordi, abitudini, cose promesse…"
              rows={2}
              className="rounded-lg border border-[var(--border)] bg-[var(--bg-app)] px-3 py-2.5 text-[16px] outline-none focus:border-[var(--accent)] sm:col-span-2 sm:text-[13.5px]"
            />
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="submit"
              disabled={!bozza.nome.trim() || inCorso}
              className="btn-grad cursor-pointer rounded-lg px-4 py-2 text-[13px] font-medium disabled:opacity-40"
            >
              {inCorso ? "Salvo…" : "Salva"}
            </button>
            <button
              type="button"
              onClick={() => setBozza(null)}
              className="cursor-pointer rounded-lg px-3 py-2 text-[13px] text-[var(--text-secondary)] hover:bg-[var(--fill-quiet)]"
            >
              Annulla
            </button>
          </div>
        </form>
      )}

      {elenco === null && (
        <p className="mt-6 text-[13px] text-[var(--text-secondary)]">Leggo…</p>
      )}

      {elenco !== null && elenco.length === 0 && !bozza && (
        <Vuoto
          titolo={cerca ? "Nessun cliente con questo nome" : "Nessun cliente, ancora"}
          testo={
            cerca
              ? "Prova con meno lettere, o con la zona."
              : "Le schede si aprono da qui, e l'agente impara i nomi appena le salvi: da quel momento «che numero ha la Rossi?» ha una risposta."
          }
        />
      )}

      {elenco !== null && elenco.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-card)]">
          {elenco.map((c, i) => (
            <div
              key={c.id}
              className={`flex flex-wrap items-start gap-x-4 gap-y-1 px-4 py-3 ${
                i > 0 ? "border-t border-[var(--border)]" : ""
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium">{c.nome}</p>
                <p className="mt-0.5 text-[12.5px] text-[var(--text-secondary)]">
                  {[c.referente, c.telefono, c.zona].filter(Boolean).join(" · ") ||
                    "Solo il nome, per ora"}
                </p>
                {c.note && (
                  <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
                    {c.note}
                  </p>
                )}
              </div>
              {puoScrivere && (
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() =>
                      setBozza({
                        id: c.id,
                        nome: c.nome,
                        referente: c.referente,
                        telefono: c.telefono,
                        email: c.email,
                        zona: c.zona,
                        note: c.note,
                      })
                    }
                    className="cursor-pointer rounded-md px-2 py-1 text-[12px] text-[var(--text-secondary)] hover:bg-[var(--fill-quiet)] hover:text-[var(--text-primary)]"
                  >
                    Modifica
                  </button>
                  <button
                    onClick={() => void elimina(c.id)}
                    className="cursor-pointer rounded-md px-2 py-1 text-[12px] text-[var(--text-secondary)] hover:bg-[var(--fill-quiet)] hover:text-[var(--text-primary)]"
                  >
                    Elimina
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Pagina>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// LE PERSONE — chi entra, e con quali permessi
// ─────────────────────────────────────────────────────────────────────────

function Persone({
  mieEmail,
  seScaduta,
}: {
  mieEmail: string;
  seScaduta: (e: unknown) => void;
}) {
  const [elenco, setElenco] = useState<PersonaElenco[] | null>(null);

  const carica = useCallback(() => {
    leggi<{ persone: PersonaElenco[] }>("persone")
      .then((r) => setElenco(r.persone))
      .catch((e) => {
        seScaduta(e);
        setElenco([]);
      });
  }, [seScaduta]);

  useEffect(() => carica(), [carica]);

  async function cambia(p: PersonaElenco, ruolo: string, attiva: boolean) {
    try {
      await manda({ az: "ruolo", persona: p.id, ruolo, attiva });
      carica();
    } catch (e) {
      seScaduta(e);
    }
  }

  const attive = elenco?.filter((p) => p.attiva).length ?? 0;

  return (
    <Pagina titolo="Persone" sotto="Chi entra e con quali permessi. Le postazioni si aprono una alla volta.">
      <div className="flex items-baseline gap-2">
        <span className="text-[30px] font-semibold tracking-[-0.02em] tabular-nums">{attive}</span>
        <span className="text-[14px] text-[var(--text-secondary)]">
          di 150 postazioni attive
        </span>
      </div>
      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-[var(--fill-quiet)]">
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.max(0.7, (attive / 150) * 100)}%`,
            background: "var(--accent)",
          }}
        />
      </div>

      {elenco === null && <p className="mt-6 text-[13px] text-[var(--text-secondary)]">Leggo…</p>}

      {elenco !== null && (
        <div className="mt-6 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-card)]">
          {elenco.map((p, i) => {
            const sonoIo = p.email.toLowerCase() === mieEmail.toLowerCase();
            const dichiarato =
              p.ruolo_scelto !== p.ruolo_vero &&
              RUOLI.find((r) => r.id === p.ruolo_scelto)?.nome;
            return (
              <div
                key={p.id}
                className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 ${
                  i > 0 ? "border-t border-[var(--border)]" : ""
                } ${p.attiva ? "" : "opacity-50"}`}
              >
                {p.foto ? (
                  <img src={p.foto} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
                ) : (
                  <span
                    aria-hidden
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--fill-quiet)] text-[13px] font-medium text-[var(--text-secondary)]"
                  >
                    {(p.nome || p.email).slice(0, 1).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium">
                    {p.nome || p.email}
                    {sonoIo && (
                      <span className="ml-2 text-[11px] font-normal text-[var(--text-secondary)]">
                        sei tu
                      </span>
                    )}
                  </p>
                  <p className="truncate text-[12px] text-[var(--text-secondary)]">
                    {p.email}
                    {p.reparto ? ` · ${p.reparto}` : ""}
                    {p.ultimo ? ` · entrata ${quando(p.ultimo)}` : ""}
                  </p>
                  {/* ⚠️ Se al primo ingresso ha dichiarato un ruolo diverso da
                      quello che ha, lo si dice: è la richiesta di promozione,
                      senza che serva un modulo per farla. */}
                  {dichiarato && p.attiva && (
                    <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--accent)" }}>
                      Si è presentata come «{dichiarato}» — decidi tu qui a destra.
                    </p>
                  )}
                </div>
                {sonoIo ? (
                  <span className="shrink-0 text-[12.5px] text-[var(--text-secondary)]">
                    {RUOLI.find((r) => r.id === p.ruolo_vero)?.nome}
                  </span>
                ) : (
                  <div className="flex shrink-0 items-center gap-2">
                    <select
                      value={p.ruolo_vero}
                      onChange={(e) => void cambia(p, e.target.value, p.attiva)}
                      className="cursor-pointer rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-2 py-1.5 text-[12.5px] outline-none focus:border-[var(--accent)]"
                    >
                      {RUOLI.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.nome}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => void cambia(p, p.ruolo_vero, !p.attiva)}
                      className="cursor-pointer rounded-md px-2 py-1.5 text-[12px] text-[var(--text-secondary)] hover:bg-[var(--fill-quiet)] hover:text-[var(--text-primary)]"
                    >
                      {p.attiva ? "Chiudi" : "Riapri"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-4 text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
        Chi entra per la prima volta è un operatore, qualunque cosa dichiari: i
        permessi li dai tu da qui, e valgono dal secondo dopo.
      </p>
    </Pagina>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// I DOCUMENTI — quello che l'agente sa
// ─────────────────────────────────────────────────────────────────────────

function Documenti({
  ruolo,
  seScaduta,
}: {
  ruolo: string;
  seScaduta: (e: unknown) => void;
}) {
  const [elenco, setElenco] = useState<Documento[] | null>(null);
  const [titolo, setTitolo] = useState("");
  const [testo, setTesto] = useState("");
  const [aperto, setAperto] = useState(false);
  const [inCorso, setInCorso] = useState(false);
  // ⚠️ La memoria dell'agente la tocca solo chi guida: cancellare un documento
  // gli toglie quello che sa, ed è troppo per una postazione qualunque. Un
  // operatore la legge, non la cambia. Il vero cancello è sul server.
  const puoGestire = ["titolare", "amministratore", "capo"].includes(ruolo);

  const carica = useCallback(() => {
    leggi<{ documenti: Documento[] }>("documenti")
      .then((r) => setElenco(r.documenti))
      .catch((e) => {
        seScaduta(e);
        setElenco([]);
      });
  }, [seScaduta]);

  useEffect(() => carica(), [carica]);

  async function salva() {
    if (!testo.trim() || inCorso) return;
    setInCorso(true);
    try {
      await manda({ az: "documento", titolo: titolo.trim() || "Senza titolo", testo: testo.trim() });
      setTitolo("");
      setTesto("");
      setAperto(false);
      carica();
    } catch (e) {
      seScaduta(e);
    } finally {
      setInCorso(false);
    }
  }

  return (
    <Pagina
      titolo="Documenti"
      sotto="Listini, zone, regole. Quello che scrivi qui l'agente lo sa dal messaggio dopo."
    >
      {!puoGestire ? (
        <p className="text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
          Questa è la memoria dell'agente: la puoi leggere. A cambiarla ci pensa
          chi guida il reparto.
        </p>
      ) : !aperto ? (
        <button
          onClick={() => setAperto(true)}
          className="btn-grad cursor-pointer rounded-xl px-4 py-2.5 text-[13.5px] font-medium"
        >
          Aggiungi qualcosa che l'agente deve sapere
        </button>
      ) : (
        <form
          className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void salva();
          }}
        >
          <input
            value={titolo}
            onChange={(e) => setTitolo(e.target.value)}
            placeholder="Di cosa si tratta — es. «Listino zone Piemonte»"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-app)] px-3 py-2.5 text-[16px] outline-none focus:border-[var(--accent)] sm:text-[13.5px]"
          />
          <textarea
            value={testo}
            onChange={(e) => setTesto(e.target.value)}
            placeholder="Scrivi come lo diresti a un nuovo assunto: zone, prezzi, regole, eccezioni. Non serve che sia in ordine — basta che sia vero."
            rows={6}
            className="mt-2.5 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-app)] px-3 py-2.5 text-[16px] leading-relaxed outline-none focus:border-[var(--accent)] sm:text-[13.5px]"
          />
          <div className="mt-3 flex gap-2">
            <button
              type="submit"
              disabled={!testo.trim() || inCorso}
              className="btn-grad cursor-pointer rounded-lg px-4 py-2 text-[13px] font-medium disabled:opacity-40"
            >
              {inCorso ? "Salvo…" : "L'agente lo impara"}
            </button>
            <button
              type="button"
              onClick={() => setAperto(false)}
              className="cursor-pointer rounded-lg px-3 py-2 text-[13px] text-[var(--text-secondary)] hover:bg-[var(--fill-quiet)]"
            >
              Annulla
            </button>
          </div>
        </form>
      )}

      {elenco === null && <p className="mt-6 text-[13px] text-[var(--text-secondary)]">Leggo…</p>}

      {elenco !== null && elenco.length === 0 && !aperto && (
        <Vuoto
          titolo="La memoria è ancora leggera"
          testo="Oggi l'agente sa presentarsi e poco altro. Il listino, le zone coi tempi e le regole di casa si scrivono qui — e da quel momento le sa."
        />
      )}

      {elenco !== null && elenco.length > 0 && (
        <div className="mt-5 space-y-3">
          {elenco.map((d) => (
            <div key={d.id} className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-[14px] font-medium">{d.titolo}</p>
                {puoGestire && (
                  <button
                    onClick={async () => {
                      try {
                        await manda({ az: "documento-elimina", id: d.id });
                        carica();
                      } catch (e) {
                        seScaduta(e);
                      }
                    }}
                    className="shrink-0 cursor-pointer rounded-md px-2 py-1 text-[12px] text-[var(--text-secondary)] hover:bg-[var(--fill-quiet)] hover:text-[var(--text-primary)]"
                  >
                    Elimina
                  </button>
                )}
              </div>
              <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--text-secondary)]">
                {d.testo.length > 400 ? d.testo.slice(0, 400) + "…" : d.testo}
              </p>
              <p className="mt-2 text-[11.5px] text-[var(--text-secondary)] opacity-70">
                {quando(d.creato)}
              </p>
            </div>
          ))}
        </div>
      )}
    </Pagina>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// LA BANCHINA — il posto di lavoro del magazzino
// ─────────────────────────────────────────────────────────────────────────

/**
 * La postazione Magazzino, rifatta come un posto di lavoro e non una chat
 * (Tommaso, 12 agosto: *«un'interfaccia più bella, non solo chat — falla tipo
 * quella del capo»*).
 *
 * Tre pezzi, nell'ordine in cui servono a chi ha i guanti addosso:
 * 1. **I bottoni grossi** — carico, scarico, differenza, problema. Grandi
 *    perché si premono col pollice, di fretta, in banchina.
 * 2. **Oggi** — i numeri contati dalle registrazioni, e il registro dei
 *    movimenti del giorno (chi, cosa, quando). È la bolla di carta, ma viva.
 * 3. **L'agente** — in una scheda: c'è quando serve una risposta, non in mezzo
 *    quando serve registrare.
 *
 * ⚠️ Il posto è già pronto per gli scanner: quando arriverà il collegamento, le
 * letture entreranno in questo stesso registro e l'IA le analizzerà qui. La
 * cornice in fondo lo dice.
 */
function Banchina({
  postazione,
  nome,
  agenteVivo,
  seScaduta,
}: {
  postazione: PostazioneViva;
  nome?: string;
  agenteVivo: boolean;
  seScaduta: (e: unknown) => void;
}) {
  const [scheda, setScheda] = useState<"lavoro" | "agente">("lavoro");
  const [dati, setDati] = useState<Banchina | null>(null);
  const [azione, setAzione] = useState<TipoMovimento | null>(null);
  const [fatto, setFatto] = useState<string | null>(null);

  const carica = useCallback(() => {
    leggi<Banchina>("banchina")
      .then(setDati)
      .catch((e) => seScaduta(e));
  }, [seScaduta]);

  useEffect(() => carica(), [carica]);

  const mag = dati?.magazzino;
  const AZIONI: { tipo: TipoMovimento; icona: string; nome: string; sotto: string }[] = [
    { tipo: "carico", icona: "📥", nome: "Carico", sotto: "merce che entra" },
    { tipo: "scarico", icona: "📤", nome: "Scarico", sotto: "merce che esce" },
    { tipo: "differenza", icona: "⚠️", nome: "Differenza", sotto: "il conto non torna" },
    { tipo: "problema", icona: "🛠️", nome: "Problema", sotto: "qualcosa non va" },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3.5 md:px-8">
        <div>
          <h1 className="text-[15.5px] font-semibold tracking-[-0.01em]">{postazione.nome}</h1>
          <p className="mt-0.5 text-[12.5px] text-[var(--text-secondary)]">{postazione.cosa}</p>
        </div>
        {/* Le due schede: il lavoro davanti, l'agente a un tocco. */}
        <div className="flex rounded-lg border border-[var(--border)] p-0.5">
          {(
            [
              ["lavoro", "Banchina"],
              ["agente", "Agente"],
            ] as const
          ).map(([id, etichetta]) => (
            <button
              key={id}
              onClick={() => setScheda(id)}
              className={`cursor-pointer rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                scheda === id
                  ? "bg-[var(--accent-soft)] text-[var(--text-primary)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {etichetta}
            </button>
          ))}
        </div>
      </div>

      {scheda === "agente" ? (
        <Conversazione
          postazione={postazione}
          nome={nome}
          agenteVivo={agenteVivo}
          seScaduta={seScaduta}
        />
      ) : (
        <div className="flex-1 overflow-y-auto px-5 py-6 md:px-8">
          <div className="mx-auto max-w-[900px]">
            {/* ── 1 · I BOTTONI GROSSI ───────────────────────────────── */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {AZIONI.map((a) => (
                <button
                  key={a.tipo}
                  onClick={() => {
                    setAzione(a.tipo);
                    setFatto(null);
                  }}
                  className={`cursor-pointer rounded-xl border p-4 text-left transition-colors ${
                    azione === a.tipo
                      ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                      : "border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--accent)]"
                  }`}
                >
                  <span aria-hidden className="text-[26px] leading-none">
                    {a.icona}
                  </span>
                  <span className="mt-2 block text-[14.5px] font-semibold">{a.nome}</span>
                  <span className="block text-[11.5px] text-[var(--text-secondary)]">
                    {a.sotto}
                  </span>
                </button>
              ))}
            </div>

            {azione && (
              <div className="mt-3 overflow-hidden rounded-xl border border-[var(--border)]">
                <FormMovimento
                  tipo={azione}
                  onChiudi={() => setAzione(null)}
                  onFatto={(riga) => {
                    setAzione(null);
                    setFatto(riga);
                    carica();
                  }}
                  seScaduta={seScaduta}
                />
              </div>
            )}

            {fatto && !azione && (
              <p
                className="mt-3 rounded-xl border-l-2 bg-[var(--fill-quiet)] px-4 py-3 text-[13.5px]"
                style={{ borderColor: "var(--accent)" }}
              >
                {fatto}
              </p>
            )}

            {/* ── 2 · OGGI, CONTATO ──────────────────────────────────── */}
            {mag && (
              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Numero valore={String(mag.entrati)} titolo="Colli entrati" sotto="oggi" />
                <Numero valore={String(mag.usciti)} titolo="Colli usciti" sotto="oggi" />
                <Numero valore={String(mag.movimenti)} titolo="Movimenti" sotto="carichi e scarichi" />
                <Numero valore={String(mag.differenze)} titolo="Differenze" sotto="segnalate al capo" />
              </div>
            )}

            {/* ── 3 · IL REGISTRO DEL GIORNO ─────────────────────────── */}
            <div className="mt-6">
              <h2 className="text-[11px] uppercase tracking-[0.09em] text-[var(--text-secondary)]">
                Oggi in banchina
              </h2>
              {dati === null && (
                <p className="mt-3 text-[13px] text-[var(--text-secondary)]">Leggo…</p>
              )}
              {dati !== null && dati.movimenti.length === 0 && (
                <div className="mt-3 rounded-xl border border-dashed border-[var(--border)] p-6 text-center">
                  <p className="text-[14px] font-medium">Ancora niente, oggi</p>
                  <p className="mx-auto mt-1.5 max-w-[44ch] text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
                    Il primo carico o scarico registrato compare qui, con chi
                    l'ha fatto e a che ora — come la bolla di carta, ma viva.
                  </p>
                </div>
              )}
              {dati !== null && dati.movimenti.length > 0 && (
                <div className="mt-3 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-card)]">
                  {dati.movimenti.map((mv, i) => (
                    <div
                      key={mv.id}
                      className={`flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 py-2.5 ${
                        i > 0 ? "border-t border-[var(--border)]" : ""
                      }`}
                    >
                      <span aria-hidden className="text-[15px]">
                        {mv.tipo === "carico"
                          ? "📥"
                          : mv.tipo === "scarico"
                            ? "📤"
                            : mv.tipo === "differenza"
                              ? "⚠️"
                              : "🛠️"}
                      </span>
                      <span className="min-w-0 flex-1 text-[13.5px]">
                        {mv.tipo === "carico" && `${mv.colli ?? "?"} colli${mv.controparte ? ` da ${mv.controparte}` : ""}`}
                        {mv.tipo === "scarico" && `${mv.colli ?? "?"} colli${mv.controparte ? ` per ${mv.controparte}` : ""}`}
                        {mv.tipo === "differenza" && `attesi ${mv.atteso}, contati ${mv.contato}${mv.testo ? ` — ${mv.testo}` : ""}`}
                        {mv.tipo === "problema" && (mv.testo || "segnalazione")}
                        {mv.mezzo ? ` · ${mv.mezzo}` : ""}
                      </span>
                      <span className="shrink-0 text-[11.5px] text-[var(--text-secondary)]">
                        {mv.chi ? `${mv.chi} · ` : ""}
                        {new Date(mv.creato).toLocaleTimeString("it-IT", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {(mv.tipo === "problema" || mv.tipo === "differenza") &&
                          (mv.stato === "aperto" ? " · dal capo" : " · risolto")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── 4 · IN ARRIVO — i ritiri prenotati dal traffico ────── */}
            {/* ⚠️ È il primo pezzo dei reparti che si parlano: il traffico
                prenota, la banchina sa cosa arriva prima che arrivi. */}
            {dati !== null && dati.ritiri.length > 0 && (
              <div className="mt-6">
                <h2 className="text-[11px] uppercase tracking-[0.09em] text-[var(--text-secondary)]">
                  In arrivo · prenotato dal traffico
                </h2>
                <div className="mt-3 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-card)]">
                  {dati.ritiri.map((r, i) => (
                    <div
                      key={r.id}
                      className={`flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 py-2.5 ${
                        i > 0 ? "border-t border-[var(--border)]" : ""
                      }`}
                    >
                      <span aria-hidden className="text-[15px]">🚚</span>
                      <span className="min-w-0 flex-1 text-[13.5px]">
                        {r.controparte}
                        {r.colli ? ` · ${r.colli} colli` : ""}
                        {r.testo ? ` · ${r.testo}` : ""}
                      </span>
                      <span className="shrink-0 text-[11.5px] text-[var(--text-secondary)]">
                        {r.previsto
                          ? new Date(r.previsto).toLocaleString("it-IT", {
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "senza orario"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── 5 · GLI SCANNER, QUANDO ARRIVANO ───────────────────── */}
            <div className="mt-6 rounded-xl border border-dashed border-[var(--border)] px-5 py-4">
              <p className="text-[13px] font-medium">Gli scanner passeranno di qui</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
                Quando colleghiamo gli scanner del magazzino, ogni lettura entra
                in questo registro da sola e l'IA la analizza: conteggi
                automatici, differenze trovate al volo, zero doppia scrittura.
                Fino ad allora, si registra da qui — e vale uguale.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// L'UFFICIO — il posto di lavoro del traffico
// ─────────────────────────────────────────────────────────────────────────

/**
 * La postazione Traffico, stessa filosofia della banchina: prima il lavoro,
 * l'agente a un tocco. Le funzioni decise da Tommaso: prenota ritiro, reclamo,
 * dov'è il carico, preventivo. Le ultime due sono domande, non registrazioni:
 * aprono l'agente con la frase già iniziata. ⚠️ Sui prezzi l'agente segue la
 * regola di ferro scritta nelle sue istruzioni: solo dal listino, se no passa.
 */
function Ufficio({
  postazione,
  nome,
  agenteVivo,
  seScaduta,
}: {
  postazione: PostazioneViva;
  nome?: string;
  agenteVivo: boolean;
  seScaduta: (e: unknown) => void;
}) {
  const [scheda, setScheda] = useState<"lavoro" | "agente">("lavoro");
  const [prefill, setPrefill] = useState<string | undefined>(undefined);
  const [dati, setDati] = useState<UfficioDati | null>(null);
  const [azione, setAzione] = useState<TipoMovimento | null>(null);
  const [fatto, setFatto] = useState<string | null>(null);

  const carica = useCallback(() => {
    leggi<UfficioDati>("ufficio")
      .then(setDati)
      .catch((e) => seScaduta(e));
  }, [seScaduta]);

  useEffect(() => carica(), [carica]);

  async function ritiroFatto(id: string) {
    try {
      await manda({ az: "ritiro-fatto", id });
      carica();
    } catch (e) {
      seScaduta(e);
    }
  }

  const num = dati?.traffico;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3.5 md:px-8">
        <div>
          <h1 className="text-[15.5px] font-semibold tracking-[-0.01em]">{postazione.nome}</h1>
          <p className="mt-0.5 text-[12.5px] text-[var(--text-secondary)]">{postazione.cosa}</p>
        </div>
        <div className="flex rounded-lg border border-[var(--border)] p-0.5">
          {(
            [
              ["lavoro", "Ufficio"],
              ["agente", "Agente"],
            ] as const
          ).map(([id, etichetta]) => (
            <button
              key={id}
              onClick={() => setScheda(id)}
              className={`cursor-pointer rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                scheda === id
                  ? "bg-[var(--accent-soft)] text-[var(--text-primary)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {etichetta}
            </button>
          ))}
        </div>
      </div>

      {scheda === "agente" ? (
        <Conversazione
          postazione={postazione}
          nome={nome}
          agenteVivo={agenteVivo}
          testoIniziale={prefill}
          seScaduta={seScaduta}
        />
      ) : (
        <div className="flex-1 overflow-y-auto px-5 py-6 md:px-8">
          <div className="mx-auto max-w-[900px]">
            {/* ── 1 · LE AZIONI ──────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <button
                onClick={() => {
                  setAzione("ritiro");
                  setFatto(null);
                }}
                className={`cursor-pointer rounded-xl border p-4 text-left transition-colors ${
                  azione === "ritiro"
                    ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                    : "border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--accent)]"
                }`}
              >
                <span aria-hidden className="text-[26px] leading-none">📋</span>
                <span className="mt-2 block text-[14.5px] font-semibold">Prenota ritiro</span>
                <span className="block text-[11.5px] text-[var(--text-secondary)]">lo vede il magazzino</span>
              </button>
              <button
                onClick={() => {
                  setPrefill("Mi serve un preventivo per ");
                  setScheda("agente");
                }}
                className="cursor-pointer rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 text-left transition-colors hover:border-[var(--accent)]"
              >
                <span aria-hidden className="text-[26px] leading-none">💶</span>
                <span className="mt-2 block text-[14.5px] font-semibold">Preventivo</span>
                <span className="block text-[11.5px] text-[var(--text-secondary)]">solo dal listino</span>
              </button>
              <button
                onClick={() => {
                  setPrefill("Dov'è il carico ");
                  setScheda("agente");
                }}
                className="cursor-pointer rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 text-left transition-colors hover:border-[var(--accent)]"
              >
                <span aria-hidden className="text-[26px] leading-none">🔎</span>
                <span className="mt-2 block text-[14.5px] font-semibold">Dov'è il carico</span>
                <span className="block text-[11.5px] text-[var(--text-secondary)]">chiedi all'agente</span>
              </button>
              <button
                onClick={() => {
                  setAzione("reclamo");
                  setFatto(null);
                }}
                className={`cursor-pointer rounded-xl border p-4 text-left transition-colors ${
                  azione === "reclamo"
                    ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                    : "border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--accent)]"
                }`}
              >
                <span aria-hidden className="text-[26px] leading-none">📣</span>
                <span className="mt-2 block text-[14.5px] font-semibold">Reclamo</span>
                <span className="block text-[11.5px] text-[var(--text-secondary)]">va al capo e al titolare</span>
              </button>
            </div>

            {azione && (
              <div className="mt-3 overflow-hidden rounded-xl border border-[var(--border)]">
                <FormMovimento
                  tipo={azione}
                  onChiudi={() => setAzione(null)}
                  onFatto={(riga) => {
                    setAzione(null);
                    setFatto(riga);
                    carica();
                  }}
                  seScaduta={seScaduta}
                />
              </div>
            )}

            {fatto && !azione && (
              <p
                className="mt-3 rounded-xl border-l-2 bg-[var(--fill-quiet)] px-4 py-3 text-[13.5px]"
                style={{ borderColor: "var(--accent)" }}
              >
                {fatto}
              </p>
            )}

            {/* ── 2 · I NUMERI ───────────────────────────────────────── */}
            {num && (
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <Numero valore={String(num.ritiri_prenotati)} titolo="Ritiri prenotati" sotto="oggi" />
                <Numero valore={String(num.ritiri_aperti)} titolo="Ritiri da fare" sotto="in tutto" />
                <Numero valore={String(num.reclami_aperti)} titolo="Reclami aperti" sotto="dal capo" />
              </div>
            )}

            {/* ── 3 · I RITIRI DA FARE ───────────────────────────────── */}
            <div className="mt-6">
              <h2 className="text-[11px] uppercase tracking-[0.09em] text-[var(--text-secondary)]">
                Ritiri da fare
              </h2>
              {dati === null && (
                <p className="mt-3 text-[13px] text-[var(--text-secondary)]">Leggo…</p>
              )}
              {dati !== null && dati.ritiri.length === 0 && (
                <div className="mt-3 rounded-xl border border-dashed border-[var(--border)] p-6 text-center">
                  <p className="text-[14px] font-medium">Nessun ritiro in coda</p>
                  <p className="mx-auto mt-1.5 max-w-[44ch] text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
                    Quando prenoti un ritiro compare qui — e nella banchina del
                    magazzino, così sanno cosa arriva.
                  </p>
                </div>
              )}
              {dati !== null && dati.ritiri.length > 0 && (
                <div className="mt-3 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-card)]">
                  {dati.ritiri.map((r, i) => (
                    <div
                      key={r.id}
                      className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 ${
                        i > 0 ? "border-t border-[var(--border)]" : ""
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-[13.5px] font-medium">
                          {r.controparte}
                          {r.colli ? ` · ${r.colli} colli` : ""}
                        </p>
                        <p className="mt-0.5 text-[12px] text-[var(--text-secondary)]">
                          {r.previsto
                            ? new Date(r.previsto).toLocaleString("it-IT", {
                                weekday: "short",
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "senza orario"}
                          {r.testo ? ` · ${r.testo}` : ""}
                          {r.chi ? ` · prenotato da ${r.chi}` : ""}
                        </p>
                      </div>
                      <button
                        onClick={() => void ritiroFatto(r.id)}
                        className="shrink-0 cursor-pointer rounded-lg border border-[var(--border)] px-3 py-1.5 text-[12.5px] font-medium hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]"
                      >
                        Fatto
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// IL REPARTO — la vista del capo: quanto usano, cosa aspetta
// ─────────────────────────────────────────────────────────────────────────

/**
 * ⚠️ Il capo vede QUANTO usano lo strumento, non COSA scrivono. Nessuna chat,
 * nessun testo di conversazione: solo il numero di richieste per persona e le
 * cose da controllare. È la linea dell'articolo 4, tenuta anche qui
 * nell'interfaccia oltre che nel database.
 */
function Reparto({
  nome,
  onAvvisi,
  seScaduta,
}: {
  nome: string;
  onAvvisi: (n: number) => void;
  seScaduta: (e: unknown) => void;
}) {
  const [dati, setDati] = useState<RepartoDati | null>(null);

  const carica = useCallback(() => {
    leggi<RepartoDati>("reparto")
      .then((r) => {
        setDati(r);
        onAvvisi(r.controlli?.length ?? 0);
      })
      .catch((e) => seScaduta(e));
  }, [onAvvisi, seScaduta]);

  useEffect(() => carica(), [carica]);

  async function chiudi(id: string) {
    try {
      await manda({ az: "controllo-chiudi", id });
      carica();
    } catch (e) {
      seScaduta(e);
    }
  }

  const mag = dati?.magazzino;

  return (
    <div className="flex-1 overflow-y-auto px-5 py-7 md:px-8">
      <div className="mx-auto max-w-[900px]">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">
          Il reparto{nome ? ` · ${nome}` : ""}
        </h1>
        <p className="mt-1 text-[13.5px] text-[var(--text-secondary)]">
          Quanto usano lo strumento e cosa aspetta te. Le conversazioni restano
          private: qui vedi i numeri, non le chat.
        </p>

        {!dati && <p className="mt-6 text-[13px] text-[var(--text-secondary)]">Leggo…</p>}

        {dati && (
          <>
            {/* I numeri del magazzino di oggi, se è il reparto magazzino. */}
            {mag && (
              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Numero valore={String(mag.entrati)} titolo="Colli entrati" sotto="oggi" />
                <Numero valore={String(mag.usciti)} titolo="Colli usciti" sotto="oggi" />
                <Numero valore={String(mag.movimenti)} titolo="Movimenti" sotto="carichi e scarichi" />
                <Numero valore={String(mag.differenze)} titolo="Differenze" sotto="da controllare" />
              </div>
            )}

            {/* ── Le cose da controllare ─────────────────────────────── */}
            <div className="mt-9">
              <h2 className="text-[11px] uppercase tracking-[0.09em] text-[var(--text-secondary)]">
                Aspetta te
              </h2>
              {dati.controlli.length ? (
                <div className="mt-3 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-card)]">
                  {dati.controlli.map((c, i) => (
                    <div
                      key={c.id}
                      className={`flex flex-wrap items-start justify-between gap-3 px-4 py-3 ${
                        i > 0 ? "border-t border-[var(--border)]" : ""
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-[13.5px] leading-relaxed">
                          <span aria-hidden>{c.tipo === "problema" ? "🛠️ " : "⚠️ "}</span>
                          {c.tipo === "differenza"
                            ? `Differenza: attesi ${c.atteso}, contati ${c.contato}${c.testo ? ` — ${c.testo}` : ""}`
                            : c.testo || "(segnalazione senza testo)"}
                        </p>
                        <p className="mt-1 text-[11.5px] text-[var(--text-secondary)]">
                          {c.chi ? `${c.chi} · ` : ""}
                          {quando(c.creato)}
                        </p>
                      </div>
                      <button
                        onClick={() => void chiudi(c.id)}
                        className="shrink-0 cursor-pointer rounded-lg border border-[var(--border)] px-3 py-1.5 text-[12.5px] font-medium hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]"
                      >
                        Risolto
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3 rounded-xl border border-dashed border-[var(--border)] p-6 text-center">
                  <p className="text-[14px] font-medium">Non c'è niente in sospeso</p>
                  <p className="mx-auto mt-1.5 max-w-[42ch] text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
                    Qui arrivano i problemi segnalati dai tuoi e le differenze di
                    conteggio, appena succedono.
                  </p>
                </div>
              )}
            </div>

            {/* ── Quanto usano, persona per persona ──────────────────── */}
            <div className="mt-9">
              <h2 className="text-[11px] uppercase tracking-[0.09em] text-[var(--text-secondary)]">
                Chi lo usa · questa settimana
              </h2>
              {dati.uso.length ? (
                <div className="mt-3 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-card)]">
                  {dati.uso.map((u, i) => (
                    <div
                      key={u.persona}
                      className={`flex items-center gap-3 px-4 py-3 ${
                        i > 0 ? "border-t border-[var(--border)]" : ""
                      }`}
                    >
                      {u.foto ? (
                        <img src={u.foto} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
                      ) : (
                        <span
                          aria-hidden
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--fill-quiet)] text-[12px] font-medium text-[var(--text-secondary)]"
                        >
                          {(u.nome || "?").slice(0, 1).toUpperCase()}
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-medium">
                          {u.nome || "Senza nome"}
                        </span>
                        <span className="block text-[12px] text-[var(--text-secondary)]">
                          {u.ultimo ? `ultima volta ${quando(u.ultimo)}` : "mai entrato"}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-[18px] font-semibold tabular-nums leading-none">
                          {u.richieste}
                        </span>
                        <span className="text-[11px] text-[var(--text-secondary)]">richieste</span>
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-[13px] text-[var(--text-secondary)]">
                  Ancora nessuno ha usato l'agente in questo reparto.
                </p>
              )}
              <p className="mt-3 text-[12px] leading-relaxed text-[var(--text-secondary)]">
                Vedi quante volte ognuno ha chiesto qualcosa all'agente, non cosa
                ha chiesto: le conversazioni sono sue.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// I MEZZI — l'elenco dei camion, per legarci i carichi
// ─────────────────────────────────────────────────────────────────────────

function Mezzi({ seScaduta }: { seScaduta: (e: unknown) => void }) {
  const [elenco, setElenco] = useState<Mezzo[] | null>(null);
  const [nome, setNome] = useState("");
  const [targa, setTarga] = useState("");
  const [inCorso, setInCorso] = useState(false);

  const carica = useCallback(() => {
    leggi<{ mezzi: Mezzo[] }>("mezzi")
      .then((r) => setElenco(r.mezzi))
      .catch((e) => {
        seScaduta(e);
        setElenco([]);
      });
  }, [seScaduta]);

  useEffect(() => carica(), [carica]);

  async function aggiungi() {
    if ((!nome.trim() && !targa.trim()) || inCorso) return;
    setInCorso(true);
    try {
      await manda({ az: "mezzo", nome: nome.trim(), targa: targa.trim() });
      setNome("");
      setTarga("");
      carica();
    } catch (e) {
      seScaduta(e);
    } finally {
      setInCorso(false);
    }
  }

  return (
    <Pagina
      titolo="Mezzi"
      sotto="I camion e i furgoni di Speed. Da qui il magazziniere li sceglie quando registra un carico, invece di scrivere la targa a mano."
    >
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void aggiungi();
        }}
      >
        <label className="min-w-0 flex-1">
          <span className="text-[12px] text-[var(--text-secondary)]">Nome / sigla</span>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="es. Iveco Daily"
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2.5 text-[16px] outline-none focus:border-[var(--accent)] sm:text-[14px]"
          />
        </label>
        <label className="min-w-0 flex-1">
          <span className="text-[12px] text-[var(--text-secondary)]">Targa</span>
          <input
            value={targa}
            onChange={(e) => setTarga(e.target.value)}
            placeholder="es. GA123BC"
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2.5 text-[16px] uppercase outline-none focus:border-[var(--accent)] sm:text-[14px]"
          />
        </label>
        <button
          type="submit"
          disabled={(!nome.trim() && !targa.trim()) || inCorso}
          className="btn-grad shrink-0 cursor-pointer rounded-lg px-4 py-2.5 text-[13.5px] font-medium disabled:opacity-40"
        >
          Aggiungi
        </button>
      </form>

      {elenco === null && <p className="mt-6 text-[13px] text-[var(--text-secondary)]">Leggo…</p>}

      {elenco !== null && elenco.length === 0 && (
        <Vuoto
          titolo="Nessun mezzo, ancora"
          testo="Aggiungi i camion e i furgoni: le targhe le prendiamo al sopralluogo. Un domani il mezzo si lega alla sua posizione su K-Master."
        />
      )}

      {elenco !== null && elenco.length > 0 && (
        <div className="mt-5 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-card)]">
          {elenco.map((mz, i) => (
            <div
              key={mz.id}
              className={`flex items-center justify-between gap-3 px-4 py-3 ${
                i > 0 ? "border-t border-[var(--border)]" : ""
              }`}
            >
              <div>
                <p className="text-[14px] font-medium">{mz.nome || mz.targa || "Senza nome"}</p>
                {mz.nome && mz.targa && (
                  <p className="text-[12.5px] text-[var(--text-secondary)]">{mz.targa}</p>
                )}
              </div>
              <button
                onClick={async () => {
                  try {
                    await manda({ az: "mezzo-elimina", id: mz.id });
                    carica();
                  } catch (e) {
                    seScaduta(e);
                  }
                }}
                className="cursor-pointer rounded-md px-2 py-1 text-[12px] text-[var(--text-secondary)] hover:bg-[var(--fill-quiet)] hover:text-[var(--text-primary)]"
              >
                Togli
              </button>
            </div>
          ))}
        </div>
      )}
    </Pagina>
  );
}

// ─────────────────────────────────────────────────────────────────────────

function Pagina({
  titolo,
  sotto,
  children,
}: {
  titolo: string;
  sotto: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex-1 overflow-y-auto px-5 py-7 md:px-8">
      <div className="mx-auto max-w-[860px]">
        <h1 className="text-[19px] font-semibold tracking-[-0.02em]">{titolo}</h1>
        <p className="mt-1 text-[13.5px] leading-relaxed text-[var(--text-secondary)]">{sotto}</p>
        <div className="mt-7">{children}</div>
      </div>
    </div>
  );
}

/**
 * ⚠️ Uno spazio vuoto non dice «non c'è niente»: dice **perché** non c'è niente
 * e **cosa lo riempirà**. È la differenza fra un prodotto che sembra rotto e un
 * prodotto che sta aspettando qualcosa di preciso.
 */
function Vuoto({ titolo, testo }: { titolo: string; testo: string }) {
  return (
    <div className="mt-4 rounded-xl border border-dashed border-[var(--border)] p-8 text-center">
      <p className="text-[14.5px] font-medium">{titolo}</p>
      <p className="mx-auto mt-2 max-w-[46ch] text-[13px] leading-relaxed text-[var(--text-secondary)]">
        {testo}
      </p>
    </div>
  );
}

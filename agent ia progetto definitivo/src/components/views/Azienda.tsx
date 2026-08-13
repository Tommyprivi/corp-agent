import { useCallback, useEffect, useRef, useState } from "react";
import { applicaMarchio, MARCHI } from "../../lib/marchio";
import { useTheme } from "../../lib/theme";
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
  type Lettura,
  type Messaggio,
  type Attivita as AttivitaRiga,
  type Avviso,
  type Banchina,
  type Mezzo,
  type RisultatoCerca,
  type Ufficio as UfficioDati,
  type PersonaElenco,
  type Invito,
  type PersonaViva,
  type RepartoDati,
} from "../../lib/azienda";
import { Attesa, Barre, Cornice, Linea, Sdraiate } from "../azienda/Grafici";
import {
  applicaSito,
  NOMI_BLOCCO,
  sposta,
  TEMPLATE,
  unisci,
  type Minimal,
  type Sito,
} from "../../lib/sito";
import {
  BarraStrumenti,
  Cella,
  Icona,
  Niente,
  Riga,
  Striscia,
  Tabella,
  Tasto,
  type IconaNome,
  type Strumento,
} from "../azienda/Console";

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

type Sezione = "chat" | "cruscotto" | "reparto" | "clienti" | "persone" | "documenti" | "mezzi" | "attivita" | "impostazioni" | "supporto";

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
  /** Come il titolare ha disposto il sito. Applicato a tutti. */
  const [sito, setSito] = useState<Sito>(() => unisci(null));

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
        // rispedire al login.
        if (e instanceof SessioneScaduta) setPersona(null);
      })
      .finally(() => setControllo(false));
  }, []);

  // ⚠️ Le impostazioni del sito le legge chiunque entra, e le applica: la
  // densità e il minimal cambiano l'aspetto per tutti, non solo per il capo che
  // le ha scelte. Se il server non risponde, resta il default: il sito non si
  // rompe mai per colpa di una preferenza.
  const caricaSito = useCallback(() => {
    leggi<{ config: Partial<Sito> }>("config")
      .then((r) => {
        const s = unisci(r.config);
        setSito(s);
        applicaSito(s);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    applicaSito(sito);
  }, [sito]);

  useEffect(() => {
    // La radice torna pulita uscendo: senza, il pannello CorpAgent erediterebbe
    // la densità di Speed.
    return () => {
      if (typeof document !== "undefined") {
        document.documentElement.removeAttribute("data-densita");
        document.documentElement.removeAttribute("data-minimal");
      }
    };
  }, []);

  useEffect(() => {
    // Il profilo finto dei primi giorni viveva in localStorage: si spazza via,
    // così nessuno resta con un «titolare» dichiarato prima che esistesse il server.
    try {
      window.localStorage.removeItem("corpagent.azienda.profilo");
    } catch {
      /* niente localStorage, niente da pulire */
    }
    if (gettone()) {
      caricaStato();
      caricaSito();
    }
  }, [caricaStato, caricaSito]);

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
          caricaSito();
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

  // Il titolare atterra sul cruscotto, il capo sulla sua area di reparto, gli
  // altri sulla chat: ognuno apre l'app su quello che gli serve per primo.
  const atterraggio: Sezione = vedeTutto ? "cruscotto" : isCapo ? "reparto" : "chat";
  const sezioneVera: Sezione = sezione === "chat" && !toccato ? atterraggio : sezione;

  // Le destinazioni della barra: postazioni + sezioni, ognuna con la sua
  // icona. È l'impianto di Assistant: una fila di strumenti, non una colonna.
  const postIcona: Record<string, IconaNome> = {
    traffico: "traffico",
    magazzino: "magazzino",
    autisti: "autisti",
    ammin: "ammin",
  };
  type Voce = { chiave: string; nome: string; icona: IconaNome; badge?: number; vai: () => void; on: boolean };
  const vaiPostazione = (id: string) => () => {
    setPostazione(id);
    setSezione("chat");
    setToccato(true);
    setMenuAperto(false);
  };
  const vaiSezione = (id: Sezione) => () => {
    setSezione(id);
    setToccato(true);
    setMenuAperto(false);
  };
  const destinazioni: Voce[] = [
    ...(vedeTutto
      ? [{ chiave: "cruscotto", nome: "Cruscotto", icona: "cruscotto" as IconaNome, vai: vaiSezione("cruscotto"), on: sezioneVera === "cruscotto" }]
      : []),
    ...postazioni.map((p) => ({
      chiave: `post:${p.id}`,
      nome: p.nome,
      icona: postIcona[p.id] ?? ("agente" as IconaNome),
      vai: vaiPostazione(p.id),
      on: sezioneVera === "chat" && postazione === p.id,
    })),
    ...(isCapo
      ? [{ chiave: "reparto", nome: "Il reparto", icona: "cruscotto" as IconaNome, badge: avvisi, vai: vaiSezione("reparto"), on: sezioneVera === "reparto" }]
      : []),
    { chiave: "clienti", nome: "Clienti", icona: "clienti" as IconaNome, vai: vaiSezione("clienti"), on: sezioneVera === "clienti" },
    ...(isGestore
      ? [{ chiave: "mezzi", nome: "Mezzi", icona: "mezzi" as IconaNome, vai: vaiSezione("mezzi"), on: sezioneVera === "mezzi" }]
      : []),
    ...(vedeTutto
      ? [{ chiave: "persone", nome: "Persone", icona: "persone" as IconaNome, vai: vaiSezione("persone"), on: sezioneVera === "persone" }]
      : []),
    ...(vedeTutto
      ? [{ chiave: "attivita", nome: "Attività", icona: "attivita" as IconaNome, vai: vaiSezione("attivita"), on: sezioneVera === "attivita" }]
      : []),
    { chiave: "documenti", nome: "Documenti", icona: "documenti" as IconaNome, vai: vaiSezione("documenti"), on: sezioneVera === "documenti" },
  ];

  // ⚠️ L'ordine e la visibilità delle voci li decide il titolare (sito.voci /
  // sito.vociNascoste). La chiave del sito è il nome nudo — «traffico», non
  // «post:traffico» — quindi si toglie il prefisso per confrontare. Le voci che
  // il sito non conosce (o le meta come Impostazioni) restano dove sono.
  const chiaveSito = (c: string) => (c.startsWith("post:") ? c.slice(5) : c);
  const ordinate = destinazioni
    .filter((d) => !sito.vociNascoste.includes(chiaveSito(d.chiave)))
    .sort((a, b) => {
      const ia = sito.voci.indexOf(chiaveSito(a.chiave));
      const ib = sito.voci.indexOf(chiaveSito(b.chiave));
      return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
    });

  // Le meta in coda, sempre: Supporto per tutti, Impostazioni per il titolare.
  const metaVoci: Voce[] = [
    { chiave: "supporto", nome: "Supporto", icona: "supporto" as IconaNome, vai: vaiSezione("supporto"), on: sezioneVera === "supporto" },
    ...(vedeTutto
      ? [{ chiave: "impostazioni", nome: "Impostazioni", icona: "impostazioni" as IconaNome, vai: vaiSezione("impostazioni"), on: sezioneVera === "impostazioni" }]
      : []),
  ];
  const barra = [...ordinate, ...metaVoci];

  const ruoloNome = RUOLI.find((r) => r.id === persona.ruolo)?.nome ?? persona.ruolo;

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg-app)] text-[var(--text-primary)]">
      {/* ── LA TESTATA — come «Assistant Evolution ... Tenant: SPEED» ──── */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-[var(--border)] bg-[var(--bg-card)] px-3 md:px-5">
        <button
          onClick={() => setMenuAperto((v) => !v)}
          aria-label="Menu"
          className="cursor-pointer rounded-md p-1.5 text-[var(--text-secondary)] hover:bg-[var(--fill-quiet)] lg:hidden"
        >
          <Icona nome="menu" size={20} />
        </button>
        <Marchio nome={m.nome} compatto />
        <span className="hidden text-[12px] text-[var(--text-secondary)] sm:inline">
          · Logistica · con CorpAgent
        </span>
        <div className="ml-auto flex items-center gap-2.5">
          <CercaGlobale
            vai={(tipo) => {
              if (tipo === "cliente") vaiSezione("clienti")();
              else if (tipo === "documento") vaiSezione("documenti")();
              else vaiPostazione("magazzino")();
            }}
            seScaduta={seScaduta}
          />
          <LevettaTema />
          <Campanella seScaduta={seScaduta} />
          <span className="hidden text-right sm:block">
            <span className="block text-[12.5px] font-medium leading-tight">
              {persona.nome || persona.email}
            </span>
            <span className="block text-[10.5px] text-[var(--text-secondary)]">
              {ruoloNome}
              {persona.reparto && !vedeTutto ? ` · ${persona.reparto}` : ""}
            </span>
          </span>
          {persona.foto ? (
            <img src={persona.foto} alt="" className="h-8 w-8 rounded-full object-cover" />
          ) : (
            <span
              aria-hidden
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--fill-quiet)] text-[12px] font-medium text-[var(--text-secondary)]"
            >
              {(persona.nome || persona.email).slice(0, 1).toUpperCase()}
            </span>
          )}
          <button
            onClick={esci}
            title="Esci"
            className="cursor-pointer rounded-md p-1.5 text-[var(--text-secondary)] hover:bg-[var(--fill-quiet)] hover:text-[var(--text-primary)]"
          >
            <Icona nome="esci" size={18} />
          </button>
        </div>
      </header>

      {/* ── LA BARRA STRUMENTI — la fila di destinazioni ───────────────── */}
      {/* Su desktop è orizzontale come il gestionale; sotto i 1024px si apre
          come pannello a scomparsa, perché dieci voci in fila non ci stanno. */}
      <nav className="hidden shrink-0 items-center gap-0.5 overflow-x-auto border-b border-[var(--border)] bg-[var(--bg-card)] px-3 lg:flex">
        {barra.map((v) => (
          <button
            key={v.chiave}
            onClick={v.vai}
            className={`relative flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-[12.5px] font-medium transition-colors ${
              v.on
                ? "border-[var(--accent)] text-[var(--text-primary)]"
                : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            <Icona nome={v.icona} size={16} />
            <span className="whitespace-nowrap">{v.nome}</span>
            {v.badge ? (
              <span className="ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#D92D20] px-1 text-[10px] font-semibold text-white">
                {v.badge}
              </span>
            ) : null}
          </button>
        ))}
      </nav>

      {/* Il pannello mobile */}
      {menuAperto && (
        <>
          <button
            aria-label="Chiudi"
            onClick={() => setMenuAperto(false)}
            className="fixed inset-0 z-30 bg-black/25 lg:hidden"
          />
          <nav className="fixed inset-x-0 top-14 z-40 border-b border-[var(--border)] bg-[var(--bg-card)] p-2 shadow-lg lg:hidden">
            {barra.map((v) => (
              <button
                key={v.chiave}
                onClick={v.vai}
                className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-left text-[13.5px] transition-colors ${
                  v.on
                    ? "bg-[var(--accent-soft)] font-medium text-[var(--text-primary)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--fill-quiet)]"
                }`}
              >
                <Icona nome={v.icona} size={18} />
                <span className="flex-1">{v.nome}</span>
                {v.badge ? (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#D92D20] px-1.5 text-[11px] font-semibold text-white">
                    {v.badge}
                  </span>
                ) : null}
              </button>
            ))}
          </nav>
        </>
      )}

      {/* ── IL CENTRO ──────────────────────────────────────────────────── */}
      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
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
            ordine={sito.toolMagazzino}
            titolare={vedeTutto}
            seScaduta={seScaduta}
          />
        )}
        {sezioneVera === "chat" && postazione === "traffico" && (
          <Ufficio
            postazione={postazioni.find((p) => p.id === "traffico") ?? postazioni[0]}
            nome={(persona.nome || "").split(" ")[0]}
            agenteVivo={agenteVivo}
            ordine={sito.toolTraffico}
            seScaduta={seScaduta}
          />
        )}
        {sezioneVera === "chat" && postazione === "autisti" && (
          <Autisti
            postazione={postazioni.find((p) => p.id === "autisti") ?? postazioni[0]}
            nome={(persona.nome || "").split(" ")[0]}
            agenteVivo={agenteVivo}
            seScaduta={seScaduta}
          />
        )}
        {sezioneVera === "chat" && postazione === "ammin" && (
          <Amministrazione
            postazione={postazioni.find((p) => p.id === "ammin") ?? postazioni[0]}
            nome={(persona.nome || "").split(" ")[0]}
            agenteVivo={agenteVivo}
            seScaduta={seScaduta}
          />
        )}
        {sezioneVera === "chat" &&
          !["magazzino", "traffico", "autisti", "ammin"].includes(postazione) && (
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
            sito={sito}
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
        {sezioneVera === "attivita" && vedeTutto && <Attivita seScaduta={seScaduta} />}
        {sezioneVera === "supporto" && <Supporto persona={persona} seScaduta={seScaduta} />}
        {sezioneVera === "impostazioni" && vedeTutto && (
          <Impostazioni
            sito={sito}
            onSalva={(nuovo) => {
              setSito(nuovo);
              applicaSito(nuovo);
            }}
            seScaduta={seScaduta}
          />
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
                <Icona nome={f.icona} size={15} className="text-[var(--text-secondary)]" />
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
              <Icona nome="micro" size={19} />
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
  icona: IconaNome;
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
    { etichetta: "Carico", icona: "carico" as IconaNome, tipo: "carico" },
    { etichetta: "Scarico", icona: "scarico" as IconaNome, tipo: "scarico" },
    { etichetta: "Differenza", icona: "differenza" as IconaNome, tipo: "differenza" },
    { etichetta: "Dov'è…", icona: "cerca" as IconaNome, prefisso: "Dov'è " },
    { etichetta: "Problema", icona: "problema" as IconaNome, tipo: "problema" },
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
    if (tipo === "differenza") return `Differenza segnalata: attesi ${atteso}, contati ${contato}. La vede il capo.`;
    if (tipo === "ritiro") return `Ritiro prenotato da ${controparte}${colli ? `, ${colli} colli` : ""}${quando ? ` — ${new Date(quando).toLocaleString("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : ""}. Lo vede anche il magazzino.`;
    if (tipo === "reclamo") return `Reclamo di ${controparte} registrato. Lo vede il capo e il titolare.`;
    return "Problema segnalato. Lo vede il capo e il titolare.";
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
  sito,
  seScaduta,
}: {
  nome?: string;
  postazioni: PostazioneViva[];
  sito: Sito;
  seScaduta: (e: unknown) => void;
}) {
  // L'ordine e la visibilità dei blocchi li decide il titolare (sito.blocchi /
  // sito.blocchiNascosti). Si applicano con `order` su un contenitore flex e
  // la classe `hidden`: nessun blocco si sposta nel codice, solo nel CSS.
  const ordBlocco = (k: string) => {
    const i = sito.blocchi.indexOf(k);
    return i < 0 ? 50 : i;
  };
  const nascosto = (k: string) => sito.blocchiNascosti.includes(k);
  const [dati, setDati] = useState<DatiCruscotto | null>(null);
  const [errore, setErrore] = useState(false);
  const [riepilogo, setRiepilogo] = useState<string | null>(null);
  const [reportGiorno, setReportGiorno] = useState<string | null>(null);
  const [riepilogoInCorso, setRiepilogoInCorso] = useState(false);

  useEffect(() => {
    leggi<{ cruscotto: DatiCruscotto }>("cruscotto")
      .then((r) => setDati(r.cruscotto))
      .catch((e) => {
        seScaduta(e);
        setErrore(true);
      });
    // ⚠️ Il report serale già pronto si carica da solo: il titolare lo trova
    // scritto, senza premere niente e senza rigenerarlo (il modello si paga
    // una volta al giorno, non a ogni apertura del cruscotto).
    leggi<{ report: { giorno: string; testo: string } | null }>("report")
      .then((r) => {
        if (r.report) {
          setRiepilogo(r.report.testo);
          setReportGiorno(r.report.giorno);
        }
      })
      .catch(() => {});
  }, [seScaduta]);

  async function chiediRiepilogo() {
    setRiepilogoInCorso(true);
    try {
      const r = await leggi<{ testo: string; giorno?: string }>("riepilogo");
      setRiepilogo(r.testo);
      setReportGiorno(r.giorno ?? null);
    } catch (e) {
      seScaduta(e);
    } finally {
      setRiepilogoInCorso(false);
    }
  }

  const ora = new Date().getHours();
  const saluto = ora < 12 ? "Buongiorno" : ora < 18 ? "Buon pomeriggio" : "Buonasera";
  const nomePostazione = (id: string) => postazioni.find((p) => p.id === id)?.nome ?? id;
  // «Via i saluti»: al posto di «Buongiorno Salvatore» un titolo asciutto.
  const senzaSaluti = sito.minimal.includes("saluti");

  return (
    <div className="flex-1 overflow-y-auto px-5 py-7 md:px-8">
      <div className="mx-auto max-w-[1060px]">
        {senzaSaluti ? (
          <div className="flex items-baseline justify-between gap-3">
            <h1 className="text-[17px] font-semibold tracking-[-0.01em]">Cruscotto</h1>
            <span className="text-[12.5px] text-[var(--text-secondary)]">
              {new Date().toLocaleDateString("it-IT", { day: "numeric", month: "long" })}
            </span>
          </div>
        ) : (
          <>
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
          </>
        )}

        {errore && (
          <p className="mt-6 text-[13.5px] text-[var(--text-secondary)]">
            Non riesco a leggere i numeri in questo momento. Ricarica fra un attimo.
          </p>
        )}

        {!dati && !errore && (
          <p className="mt-6 text-[13.5px] text-[var(--text-secondary)]">Conto…</p>
        )}

        {dati && (
          // ⚠️ `gap` + divisori fra i blocchi: «sezioni più separate» (Tommaso).
          // Il gap vale fra gli elementi flex a prescindere dall'ordine, quindi
          // regge anche quando il capo li riordina.
          <div className="mt-6 flex flex-col gap-6 [&>div]:border-t [&>div]:border-[var(--border)] [&>div]:pt-6 [&>div:first-child]:border-t-0 [&>div:first-child]:pt-0 [&>div>*:first-child]:!mt-0">
            <div style={{ order: ordBlocco("direzione") }} className={nascosto("direzione") ? "hidden" : undefined}>
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
                    <p className="text-[13.5px] font-medium">
                      {reportGiorno ? "Il report della giornata" : "L'agente di direzione"}
                    </p>
                    <p className="text-[12px] text-[var(--text-secondary)]">
                      {reportGiorno
                        ? `Fatto dall'agente${reportData(reportGiorno)}. Guarda tutta l'azienda insieme.`
                        : "Guarda tutta l'azienda insieme e ti dice com'è andata."}
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

            </div>
            <div style={{ order: ordBlocco("guadagni") }} className={nascosto("guadagni") ? "hidden" : undefined}>
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

            </div>
            <div style={{ order: ordBlocco("oggi") }} className={nascosto("oggi") ? "hidden" : undefined}>
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

            </div>
            <div style={{ order: ordBlocco("giornata") }} className={nascosto("giornata") ? "hidden" : undefined}>
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

            </div>
            <div style={{ order: ordBlocco("settimana") }} className={nascosto("settimana") ? "hidden" : undefined}>
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

            </div>
            <div style={{ order: ordBlocco("aspetta") }} className={nascosto("aspetta") ? "hidden" : undefined}>
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
                        <Icona nome={c.tipo === "problema" ? "problema" : "differenza"} size={14} className="mr-1.5 inline-block align-[-2px] text-[var(--text-secondary)]" />
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

            </div>
            <div style={{ order: ordBlocco("magazzino") }} className={nascosto("magazzino") ? "hidden" : undefined}>
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

            </div>
            <div style={{ order: ordBlocco("attesa") }} className={nascosto("attesa") ? "hidden" : undefined}>
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
            {/* `az-spiega`: col minimal «spiegazioni nascoste» questo testo lungo
                sparisce. È esattamente la cosa che il capo asciuga per primo. */}
            <div
              className="az-spiega mt-9 rounded-xl border-l-2 bg-[var(--fill-quiet)] px-5 py-4"
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
            </div>
          </div>
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

/** « di oggi» / « di ieri» / « del 12 agosto» a partire da un YYYY-MM-DD. */
function reportData(giorno: string): string {
  const oggi = new Date().toLocaleDateString("en-CA");
  const ieri = new Date(Date.now() - 86400000).toLocaleDateString("en-CA");
  const g = giorno.slice(0, 10);
  if (g === oggi) return " di oggi";
  if (g === ieri) return " di ieri";
  return ` del ${new Date(g).toLocaleDateString("it-IT", { day: "numeric", month: "long" })}`;
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
  const [inviti, setInviti] = useState<Invito[]>([]);
  const [invEmail, setInvEmail] = useState("");
  const [invRuolo, setInvRuolo] = useState("operatore");
  const [invErr, setInvErr] = useState<string | null>(null);
  const [invInCorso, setInvInCorso] = useState(false);

  const carica = useCallback(() => {
    leggi<{ persone: PersonaElenco[] }>("persone")
      .then((r) => setElenco(r.persone))
      .catch((e) => {
        seScaduta(e);
        setElenco([]);
      });
    leggi<{ inviti: Invito[] }>("inviti")
      .then((r) => setInviti(r.inviti))
      .catch(() => {});
  }, [seScaduta]);

  useEffect(() => carica(), [carica]);

  async function invita() {
    if (!invEmail.includes("@") || invInCorso) return;
    setInvInCorso(true);
    setInvErr(null);
    try {
      await manda({ az: "invita", email: invEmail.trim(), ruolo: invRuolo });
      setInvEmail("");
      carica();
    } catch (e) {
      setInvErr(e instanceof Error ? e.message : "Invito non riuscito.");
    } finally {
      setInvInCorso(false);
    }
  }

  async function revocaInvito(email: string) {
    try {
      await manda({ az: "invito-revoca", email });
      carica();
    } catch (e) {
      seScaduta(e);
    }
  }

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

      {/* ── INVITA — solo chi è invitato può entrare ─────────────────── */}
      <div className="mt-6 rounded-md border border-[var(--border)] bg-[var(--bg-card)] p-4">
        <h3 className="text-[13.5px] font-semibold">Invita una persona</h3>
        <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
          Entra solo chi inviti tu. Metti l'email e scegli il ruolo: la persona
          entra la prima volta con quell'email e sceglie la sua password.
        </p>
        <form
          className="mt-3 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void invita();
          }}
        >
          <input
            type="email"
            value={invEmail}
            onChange={(e) => setInvEmail(e.target.value)}
            placeholder="email@azienda.it"
            className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg-app)] px-3 py-2.5 text-[16px] outline-none focus:border-[var(--accent)] sm:text-[13.5px]"
          />
          <select
            value={invRuolo}
            onChange={(e) => setInvRuolo(e.target.value)}
            className="cursor-pointer rounded-lg border border-[var(--border)] bg-[var(--bg-app)] px-3 py-2.5 text-[13.5px] outline-none focus:border-[var(--accent)]"
          >
            {RUOLI.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nome}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={!invEmail.includes("@") || invInCorso}
            className="btn-grad shrink-0 cursor-pointer rounded-lg px-4 py-2.5 text-[13.5px] font-medium disabled:opacity-40"
          >
            {invInCorso ? "Invito…" : "Invita"}
          </button>
        </form>
        {invErr && <p className="mt-2 text-[12.5px] text-[#D92D20]">{invErr}</p>}

        {inviti.filter((i) => !i.usato).length > 0 && (
          <div className="mt-4">
            <p className="mb-1.5 text-[11px] uppercase tracking-[0.09em] text-[var(--text-secondary)]">
              In attesa che entrino
            </p>
            <div className="overflow-hidden rounded-md border border-[var(--border)]">
              {inviti
                .filter((i) => !i.usato)
                .map((i, k) => (
                  <div
                    key={i.email}
                    className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 ${
                      k > 0 ? "border-t border-[var(--border)]" : ""
                    }`}
                  >
                    <span className="min-w-0 flex-1 truncate text-[13px]">{i.email}</span>
                    <span className="text-[12px] text-[var(--text-secondary)]">
                      {RUOLI.find((r) => r.id === i.ruolo)?.nome ?? i.ruolo}
                    </span>
                    <button
                      onClick={() => void revocaInvito(i.email)}
                      className="cursor-pointer rounded-md px-2 py-1 text-[12px] text-[var(--text-secondary)] hover:bg-[var(--fill-quiet)] hover:text-[var(--text-primary)]"
                    >
                      Togli
                    </button>
                  </div>
                ))}
            </div>
          </div>
        )}
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
/** Riordina la barra dei tool secondo la scelta del capo, accodando i nuovi. */
function ordinaTool(ordine: string[] | undefined, def: Strumento[]): Strumento[] {
  if (!ordine || ordine.length === 0) return def;
  const trovati = ordine.map((id) => def.find((s) => s.id === id)).filter(Boolean) as Strumento[];
  const mancanti = def.filter((s) => !ordine.includes(s.id));
  return [...trovati, ...mancanti];
}

function Banchina({
  postazione,
  nome,
  agenteVivo,
  ordine,
  titolare,
  seScaduta,
}: {
  postazione: PostazioneViva;
  nome?: string;
  agenteVivo: boolean;
  ordine?: string[];
  titolare?: boolean;
  seScaduta: (e: unknown) => void;
}) {
  // ⚠️ Si apre sull'AGENTE, non sul registro: Tommaso vuole poca manualità
  // (i dati veri sono già in Assistant), quindi la prima cosa è la chat.
  const [strumento, setStrumento] = useState("agente");
  const [dati, setDati] = useState<Banchina | null>(null);
  const [fatto, setFatto] = useState<string | null>(null);
  const [filtro, setFiltro] = useState("tutti");

  const carica = useCallback(() => {
    leggi<Banchina>("banchina")
      .then(setDati)
      .catch((e) => seScaduta(e));
  }, [seScaduta]);

  useEffect(() => carica(), [carica]);

  const mag = dati?.magazzino;
  // ⚠️ La fila di strumenti in cima, come le barre del gestionale: ogni cosa
  // che si può fare in banchina è UNA VOCE CON LA SUA ICONA, non un percorso
  // da scoprire. «Molti tool da imparare» — Tommaso.
  const strumenti: Strumento[] = ordinaTool(ordine, [
    { id: "registro", nome: "Registro", icona: "magazzino" },
    { id: "scansioni", nome: "Scansioni", icona: "barcode" },
    { id: "carico", nome: "Carico", icona: "carico" },
    { id: "scarico", nome: "Scarico", icona: "scarico" },
    { id: "differenza", nome: "Differenza", icona: "differenza" },
    { id: "problema", nome: "Problema", icona: "problema" },
    { id: "arrivi", nome: "In arrivo", icona: "traffico", badge: dati?.ritiri.length || 0 },
    { id: "agente", nome: "Agente", icona: "agente" },
  ]);
  const formAperto = ["carico", "scarico", "differenza", "problema"].includes(strumento);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-[var(--border)] bg-[var(--bg-card)]">
        <div className="flex items-baseline gap-3 px-5 pt-3 md:px-8">
          <h1 className="text-[15px] font-semibold tracking-[-0.01em]">{postazione.nome}</h1>
          <p className="truncate text-[12px] text-[var(--text-secondary)]">{postazione.cosa}</p>
        </div>
        <div className="mt-1 px-3 md:px-6">
          <BarraStrumenti strumenti={strumenti} attivo={strumento} onScegli={setStrumento} />
        </div>
      </div>

      {strumento === "agente" && (
        <Conversazione
          postazione={postazione}
          nome={nome}
          agenteVivo={agenteVivo}
          seScaduta={seScaduta}
        />
      )}

      {strumento === "scansioni" && (
        <Scansioni titolare={!!titolare} seScaduta={seScaduta} />
      )}

      {formAperto && (
        <div className="flex-1 overflow-y-auto px-5 py-5 md:px-8">
          <div className="mx-auto max-w-[760px] overflow-hidden rounded-md border border-[var(--border)]">
            <FormMovimento
              tipo={strumento as TipoMovimento}
              onChiudi={() => setStrumento("registro")}
              onFatto={(riga) => {
                setFatto(riga);
                carica();
                setStrumento("registro");
              }}
              seScaduta={seScaduta}
            />
          </div>
        </div>
      )}

      {strumento === "arrivi" && (
        <div className="flex-1 overflow-y-auto px-5 py-5 md:px-8">
          <div className="mx-auto max-w-[900px]">
            <p className="mb-3 text-[12.5px] text-[var(--text-secondary)]">
              Ritiri prenotati dal traffico e non ancora arrivati: la banchina sa
              cosa arriva prima che arrivi.
            </p>
            {dati !== null && dati.ritiri.length === 0 && (
              <Niente
                titolo="Niente in arrivo"
                testo="Quando il traffico prenota un ritiro, compare qui con cliente, colli e orario previsto."
              />
            )}
            {dati !== null && dati.ritiri.length > 0 && (
              <Tabella
                colonne={[
                  { nome: "Cliente" },
                  { nome: "Colli", larghezza: "70px", destra: true },
                  { nome: "Note" },
                  { nome: "Quando", larghezza: "170px", destra: true },
                ]}
              >
                {dati.ritiri.map((r) => (
                  <Riga key={r.id}>
                    <Cella>
                      <span className="font-medium">{r.controparte}</span>
                    </Cella>
                    <Cella destra>{r.colli ?? "—"}</Cella>
                    <Cella tenue>{r.testo || "—"}</Cella>
                    <Cella destra tenue>
                      {r.previsto
                        ? new Date(r.previsto).toLocaleString("it-IT", {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "senza orario"}
                    </Cella>
                  </Riga>
                ))}
              </Tabella>
            )}
          </div>
        </div>
      )}

      {strumento === "registro" && (
        <div className="flex-1 overflow-y-auto px-5 py-5 md:px-8">
          <div className="mx-auto max-w-[900px]">
            {fatto && (
              <p
                className="mb-4 rounded-md border-l-2 bg-[var(--fill-quiet)] px-4 py-3 text-[13.5px]"
                style={{ borderColor: "var(--accent)" }}
              >
                {fatto}
              </p>
            )}

            {/* I quattro tasti grossi: scorciatoie agli stessi strumenti della
                barra, per chi lavora col pollice e i guanti. */}
            <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
              <Tasto icona="carico" nome="Carico" sotto="merce che entra" onClick={() => setStrumento("carico")} />
              <Tasto icona="scarico" nome="Scarico" sotto="merce che esce" onClick={() => setStrumento("scarico")} />
              <Tasto icona="differenza" nome="Differenza" sotto="il conto non torna" onClick={() => setStrumento("differenza")} />
              <Tasto icona="problema" nome="Problema" sotto="qualcosa non va" onClick={() => setStrumento("problema")} />
            </div>

            {mag && (
              <div className="mt-4">
                <Striscia
                  dati={[
                    { valore: String(mag.entrati), etichetta: "Colli entrati oggi", forte: true },
                    { valore: String(mag.usciti), etichetta: "Colli usciti oggi" },
                    { valore: String(mag.movimenti), etichetta: "Movimenti" },
                    { valore: String(mag.differenze), etichetta: "Differenze da controllare" },
                  ]}
                />
              </div>
            )}

            <div className="mt-6">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-[11px] uppercase tracking-[0.09em] text-[var(--text-secondary)]">
                  Oggi in banchina
                </h2>
                <div className="flex items-center gap-2">
                  <select
                    value={filtro}
                    onChange={(e) => setFiltro(e.target.value)}
                    className="cursor-pointer rounded-md border border-[var(--border)] bg-[var(--bg-card)] px-2 py-1.5 text-[12px] outline-none focus:border-[var(--accent)]"
                  >
                    <option value="tutti">Tutti i movimenti</option>
                    <option value="carico">Solo carichi</option>
                    <option value="scarico">Solo scarichi</option>
                    <option value="differenza">Solo differenze</option>
                    <option value="problema">Solo problemi</option>
                  </select>
                  <button
                    onClick={() => {
                      const righe = (dati?.movimenti ?? []).filter(
                        (m) => filtro === "tutti" || m.tipo === filtro
                      );
                      scaricaCsv(
                        "registro-banchina.csv",
                        ["Ora", "Tipo", "Colli", "Cliente/Fornitore", "Mezzo", "Note", "Stato", "Chi"],
                        righe.map((m) => [
                          new Date(m.creato).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
                          m.tipo,
                          m.colli != null ? String(m.colli) : m.tipo === "differenza" ? `attesi ${m.atteso} contati ${m.contato}` : "",
                          m.controparte,
                          m.mezzo,
                          m.testo,
                          m.stato,
                          m.chi,
                        ])
                      );
                    }}
                    disabled={!dati?.movimenti.length}
                    className="flex cursor-pointer items-center gap-1.5 rounded-md border border-[var(--border)] px-2.5 py-1.5 text-[12px] font-medium hover:border-[var(--accent)] disabled:opacity-40"
                  >
                    <Icona nome="esporta" size={13} />
                    CSV
                  </button>
                </div>
              </div>
              {dati === null && <p className="text-[13px] text-[var(--text-secondary)]">Leggo…</p>}
              {dati !== null && dati.movimenti.length === 0 && (
                <Niente
                  titolo="Ancora niente, oggi"
                  testo="Il primo carico o scarico registrato compare qui, con chi l'ha fatto e a che ora — come la bolla di carta, ma viva."
                />
              )}
              {dati !== null && dati.movimenti.length > 0 && (
                <Tabella
                  colonne={[
                    { nome: "", larghezza: "34px" },
                    { nome: "Movimento" },
                    { nome: "Mezzo", larghezza: "140px" },
                    { nome: "Stato", larghezza: "90px" },
                    { nome: "Chi · ora", larghezza: "170px", destra: true },
                  ]}
                >
                  {dati.movimenti
                    .filter((m) => filtro === "tutti" || m.tipo === filtro)
                    .map((mv) => (
                    <Riga key={mv.id}>
                      <Cella>
                        <Icona
                          nome={
                            mv.tipo === "carico"
                              ? "carico"
                              : mv.tipo === "scarico"
                                ? "scarico"
                                : mv.tipo === "ritiro"
                                  ? "ritiro"
                                  : mv.tipo === "reclamo"
                                    ? "reclamo"
                                    : mv.tipo === "differenza"
                                      ? "differenza"
                                      : "problema"
                          }
                          size={16}
                          className="text-[var(--text-secondary)]"
                        />
                      </Cella>
                      <Cella>
                        {mv.tipo === "carico" && `${mv.colli ?? "?"} colli${mv.controparte ? ` da ${mv.controparte}` : ""}`}
                        {mv.tipo === "scarico" && `${mv.colli ?? "?"} colli${mv.controparte ? ` per ${mv.controparte}` : ""}`}
                        {mv.tipo === "differenza" && `Attesi ${mv.atteso}, contati ${mv.contato}${mv.testo ? ` — ${mv.testo}` : ""}`}
                        {mv.tipo === "problema" && (mv.testo || "Segnalazione")}
                        {mv.tipo === "ritiro" && `Ritiro da ${mv.controparte}${mv.colli ? `, ${mv.colli} colli` : ""}`}
                        {mv.tipo === "reclamo" && `Reclamo di ${mv.controparte}${mv.testo ? ` — ${mv.testo}` : ""}`}
                      </Cella>
                      <Cella tenue>{mv.mezzo || "—"}</Cella>
                      <Cella tenue>
                        {["problema", "differenza", "reclamo", "ritiro"].includes(mv.tipo)
                          ? mv.stato === "aperto"
                            ? "aperto"
                            : "chiuso"
                          : "—"}
                      </Cella>
                      <Cella destra tenue>
                        {mv.chi ? `${mv.chi} · ` : ""}
                        {new Date(mv.creato).toLocaleTimeString("it-IT", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </Cella>
                    </Riga>
                  ))}
                </Tabella>
              )}
            </div>

            <div className="mt-6 rounded-md border border-dashed border-[var(--border)] px-5 py-4">
              <p className="text-[13px] font-medium">Gli scanner passeranno di qui</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
                Quando colleghiamo le scanner-stampanti e i palmari, ogni lettura
                entra in questo registro da sola e l'IA la analizza: conteggi
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
  ordine,
  seScaduta,
}: {
  postazione: PostazioneViva;
  nome?: string;
  agenteVivo: boolean;
  ordine?: string[];
  seScaduta: (e: unknown) => void;
}) {
  // ⚠️ Anche il traffico si apre sull'agente: poca manualità, prima la chat.
  const [strumento, setStrumento] = useState("agente");
  const [prefill, setPrefill] = useState<string | undefined>(undefined);
  const [dati, setDati] = useState<UfficioDati | null>(null);
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
  const strumenti: Strumento[] = ordinaTool(ordine, [
    { id: "ritiri", nome: "Ritiri", icona: "ritiro", badge: dati?.ritiri.length || 0 },
    { id: "prenota", nome: "Prenota", icona: "piu" },
    { id: "reclamo", nome: "Reclamo", icona: "reclamo" },
    { id: "registro", nome: "Registro", icona: "traffico" },
    { id: "dove", nome: "Dov'è il carico", icona: "cerca" },
    { id: "preventivo", nome: "Preventivo", icona: "agente" },
    { id: "agente", nome: "Agente", icona: "agente" },
  ]);

  // «Dov'è» e «Preventivo» non sono pannelli: sono domande. Aprono l'agente
  // con la frase già iniziata — e sui prezzi vale la regola di ferro del
  // titolare, scritta nelle istruzioni: solo dal listino, se no passa.
  function scegli(id: string) {
    if (id === "dove") {
      setPrefill("Dov'è il carico ");
      setStrumento("agente");
      return;
    }
    if (id === "preventivo") {
      setPrefill("Mi serve un preventivo per ");
      setStrumento("agente");
      return;
    }
    setStrumento(id);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-[var(--border)] bg-[var(--bg-card)]">
        <div className="flex items-baseline gap-3 px-5 pt-3 md:px-8">
          <h1 className="text-[15px] font-semibold tracking-[-0.01em]">{postazione.nome}</h1>
          <p className="truncate text-[12px] text-[var(--text-secondary)]">{postazione.cosa}</p>
        </div>
        <div className="mt-1 px-3 md:px-6">
          <BarraStrumenti strumenti={strumenti} attivo={strumento} onScegli={scegli} />
        </div>
      </div>

      {strumento === "agente" && (
        <Conversazione
          postazione={postazione}
          nome={nome}
          agenteVivo={agenteVivo}
          testoIniziale={prefill}
          seScaduta={seScaduta}
        />
      )}

      {(strumento === "prenota" || strumento === "reclamo") && (
        <div className="flex-1 overflow-y-auto px-5 py-5 md:px-8">
          <div className="mx-auto max-w-[760px] overflow-hidden rounded-md border border-[var(--border)]">
            <FormMovimento
              tipo={strumento === "prenota" ? "ritiro" : "reclamo"}
              onChiudi={() => setStrumento("ritiri")}
              onFatto={(riga) => {
                setFatto(riga);
                carica();
                setStrumento("ritiri");
              }}
              seScaduta={seScaduta}
            />
          </div>
        </div>
      )}

      {strumento === "registro" && (
        <div className="flex-1 overflow-y-auto px-5 py-5 md:px-8">
          <div className="mx-auto max-w-[900px]">
            <p className="mb-3 text-[12.5px] text-[var(--text-secondary)]">
              Quello che l'ufficio ha registrato oggi: prenotazioni e reclami, con
              chi e a che ora.
            </p>
            {dati === null && <p className="text-[13px] text-[var(--text-secondary)]">Leggo…</p>}
            {dati !== null && dati.movimenti.length === 0 && (
              <Niente
                titolo="Ancora niente, oggi"
                testo="Le prenotazioni e i reclami registrati oggi compaiono qui."
              />
            )}
            {dati !== null && dati.movimenti.length > 0 && (
              <Tabella
                colonne={[
                  { nome: "", larghezza: "34px" },
                  { nome: "Registrazione" },
                  { nome: "Stato", larghezza: "90px" },
                  { nome: "Chi · ora", larghezza: "170px", destra: true },
                ]}
              >
                {dati.movimenti.map((mv) => (
                  <Riga key={mv.id}>
                    <Cella>
                      <Icona
                        nome={mv.tipo === "ritiro" ? "ritiro" : mv.tipo === "reclamo" ? "reclamo" : "problema"}
                        size={16}
                        className="text-[var(--text-secondary)]"
                      />
                    </Cella>
                    <Cella>
                      {mv.tipo === "ritiro" && `Ritiro da ${mv.controparte}${mv.colli ? `, ${mv.colli} colli` : ""}${mv.testo ? ` · ${mv.testo}` : ""}`}
                      {mv.tipo === "reclamo" && `Reclamo di ${mv.controparte}${mv.testo ? ` — ${mv.testo}` : ""}`}
                      {mv.tipo !== "ritiro" && mv.tipo !== "reclamo" && (mv.testo || mv.tipo)}
                    </Cella>
                    <Cella tenue>{mv.stato === "aperto" ? "aperto" : "chiuso"}</Cella>
                    <Cella destra tenue>
                      {mv.chi ? `${mv.chi} · ` : ""}
                      {new Date(mv.creato).toLocaleTimeString("it-IT", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Cella>
                  </Riga>
                ))}
              </Tabella>
            )}
          </div>
        </div>
      )}

      {strumento === "ritiri" && (
        <div className="flex-1 overflow-y-auto px-5 py-5 md:px-8">
          <div className="mx-auto max-w-[900px]">
            {fatto && (
              <p
                className="mb-4 rounded-md border-l-2 bg-[var(--fill-quiet)] px-4 py-3 text-[13.5px]"
                style={{ borderColor: "var(--accent)" }}
              >
                {fatto}
              </p>
            )}

            {num && (
              <Striscia
                dati={[
                  { valore: String(num.ritiri_prenotati), etichetta: "Ritiri prenotati oggi", forte: true },
                  { valore: String(num.ritiri_aperti), etichetta: "Ritiri da fare" },
                  { valore: String(num.reclami_aperti), etichetta: "Reclami aperti" },
                ]}
              />
            )}

            <div className="mt-6">
              <h2 className="mb-2 text-[11px] uppercase tracking-[0.09em] text-[var(--text-secondary)]">
                Ritiri da fare
              </h2>
              {dati === null && <p className="text-[13px] text-[var(--text-secondary)]">Leggo…</p>}
              {dati !== null && dati.ritiri.length === 0 && (
                <Niente
                  titolo="Nessun ritiro in coda"
                  testo="Quando prenoti un ritiro compare qui — e nella banchina del magazzino, così sanno cosa arriva."
                />
              )}
              {dati !== null && dati.ritiri.length > 0 && (
                <Tabella
                  colonne={[
                    { nome: "Cliente" },
                    { nome: "Colli", larghezza: "70px", destra: true },
                    { nome: "Note" },
                    { nome: "Quando", larghezza: "160px" },
                    { nome: "", larghezza: "80px", destra: true },
                  ]}
                >
                  {dati.ritiri.map((r) => (
                    <Riga key={r.id}>
                      <Cella>
                        <span className="font-medium">{r.controparte}</span>
                        {r.chi ? <span className="text-[var(--text-secondary)]"> · da {r.chi}</span> : ""}
                      </Cella>
                      <Cella destra>{r.colli ?? "—"}</Cella>
                      <Cella tenue>{r.testo || "—"}</Cella>
                      <Cella tenue>
                        {r.previsto
                          ? new Date(r.previsto).toLocaleString("it-IT", {
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "senza orario"}
                      </Cella>
                      <Cella destra>
                        <button
                          onClick={() => void ritiroFatto(r.id)}
                          className="cursor-pointer rounded-md border border-[var(--border)] px-2.5 py-1 text-[12px] font-medium hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]"
                        >
                          Fatto
                        </button>
                      </Cella>
                    </Riga>
                  ))}
                </Tabella>
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
                          <Icona nome={c.tipo === "problema" ? "problema" : "differenza"} size={14} className="mr-1.5 inline-block align-[-2px] text-[var(--text-secondary)]" />
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

// ─────────────────────────────────────────────────────────────────────────
// LA RICERCA GLOBALE — un colpo solo su clienti, movimenti e documenti
// ─────────────────────────────────────────────────────────────────────────

/**
 * ⚠️ Non cerca nelle chat, di proposito: la ricerca la usano tutti, e le
 * conversazioni restano di chi le ha fatte. Cerca nei dati condivisi.
 */
function CercaGlobale({
  vai,
  seScaduta,
}: {
  vai: (tipo: RisultatoCerca["tipo"]) => void;
  seScaduta: (e: unknown) => void;
}) {
  const [q, setQ] = useState("");
  const [risultati, setRisultati] = useState<RisultatoCerca[] | null>(null);
  const [aperto, setAperto] = useState(false);
  const ultima = useRef(0);

  useEffect(() => {
    if (q.trim().length < 2) {
      setRisultati(null);
      return;
    }
    const mia = ++ultima.current;
    const t = setTimeout(() => {
      leggi<{ risultati: RisultatoCerca[] }>("cerca", { q: q.trim() })
        .then((r) => {
          if (mia === ultima.current) setRisultati(r.risultati);
        })
        .catch((e) => seScaduta(e));
    }, 220);
    return () => clearTimeout(t);
  }, [q, seScaduta]);

  return (
    <div className="relative hidden md:block">
      <div className="flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-app)] px-2.5 py-1.5 focus-within:border-[var(--accent)]">
        <Icona nome="cerca" size={15} className="shrink-0 text-[var(--text-secondary)]" />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setAperto(true);
          }}
          onFocus={() => setAperto(true)}
          onBlur={() => setTimeout(() => setAperto(false), 150)}
          placeholder="Cerca ovunque…"
          className="w-[190px] bg-transparent text-[13px] outline-none placeholder:text-[var(--text-secondary)]"
        />
      </div>

      {aperto && risultati !== null && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-[360px] overflow-hidden rounded-md border border-[var(--border)] bg-[var(--bg-card)] shadow-lg">
          {risultati.length === 0 && (
            <p className="px-3.5 py-3 text-[12.5px] text-[var(--text-secondary)]">
              Niente con «{q.trim()}» — cerco fra clienti, registro e documenti.
            </p>
          )}
          {risultati.map((r) => (
            <button
              key={`${r.tipo}${r.id}`}
              onMouseDown={() => {
                vai(r.tipo);
                setQ("");
                setRisultati(null);
              }}
              className="flex w-full cursor-pointer items-start gap-2.5 border-b border-[var(--border)] px-3.5 py-2.5 text-left last:border-0 hover:bg-[var(--fill-quiet)]"
            >
              <Icona
                nome={r.tipo === "cliente" ? "clienti" : r.tipo === "documento" ? "documenti" : "magazzino"}
                size={15}
                className="mt-0.5 shrink-0 text-[var(--text-secondary)]"
              />
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-medium">{r.titolo}</span>
                {r.sotto && (
                  <span className="block truncate text-[11.5px] text-[var(--text-secondary)]">
                    {r.sotto}
                  </span>
                )}
              </span>
              <span className="ml-auto shrink-0 text-[10.5px] uppercase tracking-wide text-[var(--text-secondary)]">
                {r.tipo}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// LA CAMPANELLA — cosa aspetta qualcuno, adesso
// ─────────────────────────────────────────────────────────────────────────

function Campanella({ seScaduta }: { seScaduta: (e: unknown) => void }) {
  const [avvisi, setAvvisi] = useState<Avviso[]>([]);
  const [aperta, setAperta] = useState(false);

  useEffect(() => {
    let vivo = true;
    const tira = () => {
      leggi<{ avvisi: Avviso[] }>("campanella")
        .then((r) => {
          if (vivo) setAvvisi(r.avvisi);
        })
        .catch((e) => seScaduta(e));
    };
    tira();
    // ⚠️ Ogni due minuti, non ogni secondo: è una campanella, non un radar.
    // 150 persone che chiedono ogni secondo sono 150 richieste al secondo.
    const t = setInterval(tira, 120_000);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, [seScaduta]);

  return (
    <div className="relative">
      <button
        onClick={() => setAperta((v) => !v)}
        title="Avvisi"
        className="relative cursor-pointer rounded-md p-1.5 text-[var(--text-secondary)] hover:bg-[var(--fill-quiet)] hover:text-[var(--text-primary)]"
      >
        <Icona nome="campanella" size={19} />
        {avvisi.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#D92D20] px-1 text-[10px] font-semibold text-white">
            {avvisi.length}
          </span>
        )}
      </button>

      {aperta && (
        <>
          <button
            aria-label="Chiudi"
            onClick={() => setAperta(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div className="absolute right-0 top-full z-50 mt-1.5 w-[340px] overflow-hidden rounded-md border border-[var(--border)] bg-[var(--bg-card)] shadow-lg">
            <p className="border-b border-[var(--border)] px-3.5 py-2 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[var(--text-secondary)]">
              Aspetta qualcuno
            </p>
            {avvisi.length === 0 && (
              <p className="px-3.5 py-4 text-[12.5px] text-[var(--text-secondary)]">
                Niente in sospeso. Quando una differenza, un reclamo o un ritiro
                aspettano qualcuno, compaiono qui.
              </p>
            )}
            {avvisi.slice(0, 10).map((a, i) => (
              <div
                key={i}
                className="flex items-start gap-2.5 border-b border-[var(--border)] px-3.5 py-2.5 last:border-0"
              >
                <Icona
                  nome={
                    a.tipo === "differenza"
                      ? "differenza"
                      : a.tipo === "reclamo"
                        ? "reclamo"
                        : a.tipo === "ritiro"
                          ? "ritiro"
                          : "problema"
                  }
                  size={15}
                  className="mt-0.5 shrink-0 text-[var(--text-secondary)]"
                />
                <span className="min-w-0">
                  <span className="block text-[12.5px] leading-snug">{a.testo}</span>
                  <span className="block text-[11px] text-[var(--text-secondary)]">
                    {quando(a.quando)}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// L'ATTIVITÀ — chi ha fatto cosa (solo titolare)
// ─────────────────────────────────────────────────────────────────────────

/**
 * ⚠️ Fatti amministrativi, mai conversazioni: «è entrato», «ha registrato un
 * carico», «ha promosso Maria». È la linea dell'articolo 4 tenuta anche qui.
 * Le righe più vecchie di 90 giorni si cancellano da sole.
 */
const NOMI_AZIONE: Record<string, string> = {
  accesso: "È entrato",
  ruolo: "Ha cambiato un ruolo",
  documento: "Ha aggiunto un documento",
  "documento-eliminato": "Ha eliminato un documento",
  "cliente-eliminato": "Ha eliminato un cliente",
  "ritiro-fatto": "Ha segnato un ritiro come fatto",
  "movimento:carico": "Ha registrato un carico",
  "movimento:scarico": "Ha registrato uno scarico",
  "movimento:differenza": "Ha segnalato una differenza",
  "movimento:problema": "Ha segnalato un problema",
  "movimento:ritiro": "Ha prenotato un ritiro",
  "movimento:reclamo": "Ha registrato un reclamo",
};

function Attivita({ seScaduta }: { seScaduta: (e: unknown) => void }) {
  const [righe, setRighe] = useState<AttivitaRiga[] | null>(null);

  useEffect(() => {
    leggi<{ attivita: AttivitaRiga[] }>("attivita")
      .then((r) => setRighe(r.attivita))
      .catch((e) => {
        seScaduta(e);
        setRighe([]);
      });
  }, [seScaduta]);

  function esporta() {
    if (!righe?.length) return;
    scaricaCsv(
      "attivita-speed.csv",
      ["Quando", "Chi", "Azione", "Dettaglio"],
      righe.map((r) => [
        new Date(r.creato).toLocaleString("it-IT"),
        r.chi,
        NOMI_AZIONE[r.azione] ?? r.azione,
        r.dettaglio,
      ])
    );
  }

  return (
    <Pagina
      titolo="Attività"
      sotto="Chi ha fatto cosa e quando: accessi, registrazioni, ruoli. I fatti, mai le conversazioni. Si conserva 90 giorni."
    >
      <div className="mb-3 flex justify-end">
        <button
          onClick={esporta}
          disabled={!righe?.length}
          className="flex cursor-pointer items-center gap-1.5 rounded-md border border-[var(--border)] px-3 py-1.5 text-[12.5px] font-medium hover:border-[var(--accent)] disabled:opacity-40"
        >
          <Icona nome="esporta" size={14} />
          Esporta CSV
        </button>
      </div>
      {righe === null && <p className="text-[13px] text-[var(--text-secondary)]">Leggo…</p>}
      {righe !== null && righe.length === 0 && (
        <Niente
          titolo="Ancora niente"
          testo="Da adesso ogni accesso, registrazione e cambio di ruolo lascia una riga qui."
        />
      )}
      {righe !== null && righe.length > 0 && (
        <Tabella
          colonne={[
            { nome: "Quando", larghezza: "170px" },
            { nome: "Chi", larghezza: "170px" },
            { nome: "Azione" },
            { nome: "Dettaglio" },
          ]}
        >
          {righe.map((r) => (
            <Riga key={r.id}>
              <Cella tenue>{new Date(r.creato).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</Cella>
              <Cella>{r.chi || "—"}</Cella>
              <Cella>{NOMI_AZIONE[r.azione] ?? r.azione}</Cella>
              <Cella tenue>{r.dettaglio || "—"}</Cella>
            </Riga>
          ))}
        </Tabella>
      )}
    </Pagina>
  );
}

/**
 * Un CSV che Excel italiano apre GIUSTO al primo colpo: separatore `;`
 * (l'Excel italiano col separatore `,` mette tutto in una colonna) e il BOM
 * UTF-8 in testa (senza, le è diventano Ã¨).
 */
function scaricaCsv(nomeFile: string, intestazioni: string[], righe: string[][]): void {
  const scappa = (v: string) => `"${(v ?? "").replaceAll('"', '""')}"`;
  const testo =
    "﻿" +
    [intestazioni, ...righe].map((r) => r.map(scappa).join(";")).join("\r\n");
  const blob = new Blob([testo], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeFile;
  a.click();
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────────────────
// SUPPORTO — la guida per ruolo e il modulo «scrivi al supporto»
// ─────────────────────────────────────────────────────────────────────────

/**
 * ⚠️ La guida cambia col ruolo: al magazziniere non serve sapere come si
 * promuove una persona, al titolare sì. Mostrare a ognuno solo quello che può
 * fare è metà del «professionale»: l'altra metà è non annegarlo in cose che
 * non lo riguardano.
 */
const GUIDA: Record<string, { titolo: string; punti: string[] }[]> = {
  operatore: [
    {
      titolo: "In magazzino",
      punti: [
        "Apri Magazzino dalla barra in alto.",
        "Premi Carico o Scarico, metti i colli e chi, e salva: la riga compare nel registro con la tua ora.",
        "Se il conto non torna, premi Differenza: la vede il capo.",
      ],
    },
    {
      titolo: "Chiedere all'agente",
      punti: [
        "In ogni postazione c'è la scheda Agente.",
        "Chiedi come parleresti a un collega: «quanti colli oggi?», «quanto dista Milano?».",
        "Se non sa, lo dice e gira la domanda a una persona — non inventa mai.",
      ],
    },
  ],
  capo: [
    {
      titolo: "Il tuo reparto",
      punti: [
        "«Il reparto» mostra quanto usano lo strumento e le cose da controllare.",
        "Vedi quante richieste fa ognuno, mai cosa scrive: è la legge, ed è giusto.",
        "Le differenze e i reclami aperti li chiudi col bottone «Risolto».",
      ],
    },
  ],
  titolare: [
    {
      titolo: "Le persone",
      punti: [
        "In «Persone» promuovi chi entra: da operatore a capo, amministrazione, titolare.",
        "Chi entra la prima volta è sempre operatore, qualunque cosa dichiari.",
        "Puoi chiudere una postazione e riaprirla quando vuoi.",
      ],
    },
    {
      titolo: "Il sito su misura",
      punti: [
        "In «Impostazioni» scegli un template e poi sposti tutto come vuoi.",
        "Ordini le voci in alto, i blocchi del cruscotto e i tool di ogni postazione.",
        "Con «più minimal» asciughi spiegazioni e saluti: resta il software puro.",
      ],
    },
    {
      titolo: "I collegamenti",
      punti: [
        "Le fasce vuote (fatturato, spedizioni) aspettano i vostri programmi.",
        "Appena colleghiamo K-Master, gli scanner o il gestionale, si accendono da sole.",
        "Nel frattempo l'agente usa già le distanze (Maps) e tutto quello che registrate.",
      ],
    },
  ],
};

function Supporto({
  persona,
  seScaduta,
}: {
  persona: PersonaViva;
  seScaduta: (e: unknown) => void;
}) {
  const [testo, setTesto] = useState("");
  const [inviato, setInviato] = useState(false);
  const [inCorso, setInCorso] = useState(false);

  const guida = [
    ...(GUIDA[persona.ruolo] ?? GUIDA.operatore),
    ...(persona.ruolo !== "operatore" ? GUIDA.operatore : []),
  ];

  async function invia() {
    if (testo.trim().length < 3 || inCorso) return;
    setInCorso(true);
    try {
      await manda({ az: "supporto", testo: testo.trim() });
      setInviato(true);
      setTesto("");
    } catch (e) {
      seScaduta(e);
    } finally {
      setInCorso(false);
    }
  }

  return (
    <Pagina
      titolo="Supporto"
      sotto="Come si usa, per il tuo ruolo. E se qualcosa non va, scrivici: rispondiamo noi."
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* ── La guida ─────────────────────────────────────────────── */}
        <div className="space-y-5">
          {guida.map((g, i) => (
            <div key={i}>
              <h3 className="text-[13.5px] font-semibold">{g.titolo}</h3>
              <ul className="mt-2 space-y-1.5">
                {g.punti.map((p, j) => (
                  <li key={j} className="flex gap-2 text-[13px] leading-relaxed text-[var(--text-secondary)]">
                    <span aria-hidden style={{ color: "var(--accent)" }}>
                      —
                    </span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* ── Scrivi al supporto ───────────────────────────────────── */}
        <div className="rounded-md border border-[var(--border)] bg-[var(--bg-card)] p-4 h-fit">
          <div className="flex items-center gap-2">
            <Icona nome="supporto" size={18} className="text-[var(--text-secondary)]" />
            <h3 className="text-[13.5px] font-semibold">Scrivi al supporto</h3>
          </div>
          {inviato ? (
            <p className="mt-3 text-[13px] leading-relaxed text-[var(--text-secondary)]">
              Ricevuto. Ti rispondiamo il prima possibile — di solito in giornata.
              <button
                onClick={() => setInviato(false)}
                className="mt-2 block cursor-pointer text-[12.5px] underline-offset-2 hover:underline"
                style={{ color: "var(--accent)" }}
              >
                Scrivi un'altra cosa
              </button>
            </p>
          ) : (
            <>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
                Un problema, una cosa che non torna, un'idea. Arriva a noi con il tuo
                nome già dentro.
              </p>
              <textarea
                value={testo}
                onChange={(e) => setTesto(e.target.value)}
                placeholder="Cosa succede, o cosa ti serve…"
                rows={5}
                className="mt-2.5 w-full rounded-md border border-[var(--border)] bg-[var(--bg-app)] px-3 py-2.5 text-[16px] leading-relaxed outline-none focus:border-[var(--accent)] sm:text-[13.5px]"
              />
              <button
                onClick={() => void invia()}
                disabled={testo.trim().length < 3 || inCorso}
                className="btn-grad mt-2.5 w-full cursor-pointer rounded-md py-2.5 text-[13.5px] font-medium disabled:opacity-40"
              >
                {inCorso ? "Invio…" : "Invia al supporto"}
              </button>
            </>
          )}
        </div>
      </div>
    </Pagina>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// IMPOSTAZIONI — il capo decide come vogliono tutti il sito (Fase C2)
// ─────────────────────────────────────────────────────────────────────────

/**
 * ⚠️ Quello che si cambia qui vale per TUTTI, non solo per il titolare: è lui
 * che decide come l'azienda vede il sito. In cima la levetta Modifica ⟷
 * Anteprima (voluta da Tommaso): in Anteprima le impostazioni della bozza si
 * applicano davvero alla radice, così vedi il sito cambiare mentre scegli —
 * e tornando a Modifica si rimette com'era finché non premi Salva.
 */
function Impostazioni({
  sito,
  onSalva,
  seScaduta,
}: {
  sito: Sito;
  onSalva: (s: Sito) => void;
  seScaduta: (e: unknown) => void;
}) {
  const [bozza, setBozza] = useState<Sito>(sito);
  const [salvato, setSalvato] = useState(false);
  const [inCorso, setInCorso] = useState(false);
  const [modo, setModo] = useState<"modifica" | "anteprima">("modifica");

  const cambia = (patch: Partial<Sito>) => {
    setBozza((b) => ({ ...b, ...patch }));
    setSalvato(false);
  };

  // In anteprima si applica la bozza; tornando a modifica (o uscendo) si
  // rimette quello che è salvato davvero, per non lasciare il sito «sporcato»
  // di una scelta non confermata.
  useEffect(() => {
    if (modo === "anteprima") applicaSito(bozza);
    else applicaSito(sito);
  }, [modo, bozza, sito]);
  useEffect(() => () => applicaSito(sito), [sito]);

  const applicaTemplate = (id: string) => {
    const t = TEMPLATE[id];
    if (!t) return;
    cambia(unisci({ ...bozza, ...t.sito }));
  };
  const toggleMinimal = (mm: Minimal) => {
    const ha = bozza.minimal.includes(mm);
    cambia({ minimal: ha ? bozza.minimal.filter((x) => x !== mm) : [...bozza.minimal, mm] });
  };
  async function salva() {
    setInCorso(true);
    try {
      await manda({ az: "config-salva", impostazioni: bozza });
      onSalva(bozza);
      setSalvato(true);
      setModo("modifica");
    } catch (e) {
      seScaduta(e);
    } finally {
      setInCorso(false);
    }
  }

  const MINIMAL_NOMI: { id: Minimal; nome: string; sotto: string }[] = [
    { id: "saluti", nome: "Via i saluti", sotto: "niente «Buongiorno», si apre e ci sono i numeri" },
    { id: "spiegazioni", nome: "Spiegazioni nascoste", sotto: "i testi lunghi vanno dietro un piccolo segno" },
    { id: "fitto", nome: "Righe più fitte", sotto: "densità da gestionale, più roba sullo schermo" },
    { id: "tastiSoloMobile", nome: "Tasti grossi solo su telefono", sotto: "su PC solo la barra tool" },
  ];
  const salvaBtn = inCorso ? "Salvo…" : salvato ? "Salvato ✓" : "Salva per tutti";
  const anteprima = modo === "anteprima";

  return (
    <div className="flex-1 overflow-y-auto px-5 py-7 md:px-8">
      <div className="mx-auto max-w-[820px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-[19px] font-semibold tracking-[-0.02em]">Impostazioni del sito</h1>
            <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
              Come lo vede tutta l'azienda. Metti in Anteprima per vederlo cambiare, poi Salva.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* La levetta Modifica ⟷ Anteprima */}
            <div className="flex rounded-md border border-[var(--border)] p-0.5">
              {(
                [
                  ["modifica", "Modifica"],
                  ["anteprima", "Anteprima"],
                ] as const
              ).map(([id, et]) => (
                <button
                  key={id}
                  onClick={() => setModo(id)}
                  className={`flex cursor-pointer items-center gap-1.5 rounded px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                    modo === id
                      ? "bg-[var(--accent-soft)] text-[var(--text-primary)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  <Icona nome={id === "modifica" ? "impostazioni" : "occhio"} size={15} />
                  {et}
                </button>
              ))}
            </div>
            <button
              onClick={() => void salva()}
              disabled={inCorso}
              className="btn-grad shrink-0 cursor-pointer rounded-md px-5 py-2.5 text-[13.5px] font-medium disabled:opacity-50"
            >
              {salvaBtn}
            </button>
          </div>
        </div>

        {anteprima && (
          <p
            className="mt-4 rounded-md border-l-2 bg-[var(--fill-quiet)] px-4 py-2.5 text-[12.5px]"
            style={{ borderColor: "var(--accent)" }}
          >
            Stai vedendo l'anteprima: densità e minimal sono già applicati a questa
            pagina. Gira le altre sezioni per vedere l'effetto, poi torna qui e Salva.
          </p>
        )}

        <Sez titolo="Parti da un template" sotto="Un punto di partenza. Poi sposti quello che vuoi.">
          <div className="grid gap-2.5 sm:grid-cols-3">
            {Object.entries(TEMPLATE).map(([id, t]) => (
              <button
                key={id}
                onClick={() => applicaTemplate(id)}
                className={`cursor-pointer rounded-md border p-3.5 text-left transition-colors ${
                  bozza.template === id
                    ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                    : "border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--accent)]"
                }`}
              >
                <p className="text-[14px] font-semibold">{t.nome}</p>
                <p className="mt-1 text-[12px] leading-relaxed text-[var(--text-secondary)]">{t.sotto}</p>
              </button>
            ))}
          </div>
        </Sez>

        <Sez titolo="Densità" sotto="Compatto per la scrivania, comodo per il telefono.">
          <div className="flex gap-2">
            {(
              [
                ["comodo", "Comodo", "più aria, tocchi grandi"],
                ["compatto", "Compatto", "righe fitte, tutto in vista"],
              ] as const
            ).map(([id, nm, st]) => (
              <button
                key={id}
                onClick={() => cambia({ densita: id })}
                className={`flex-1 cursor-pointer rounded-md border p-3 text-left transition-colors ${
                  bozza.densita === id
                    ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                    : "border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--accent)]"
                }`}
              >
                <p className="text-[13.5px] font-semibold">{nm}</p>
                <p className="text-[12px] text-[var(--text-secondary)]">{st}</p>
              </button>
            ))}
          </div>
        </Sez>

        <Sez titolo="Più minimal, più professionale" sotto="Asciuga quello che non ti serve.">
          <div className="space-y-1.5">
            {MINIMAL_NOMI.map((mm) => {
              const on = bozza.minimal.includes(mm.id);
              return (
                <button
                  key={mm.id}
                  onClick={() => toggleMinimal(mm.id)}
                  className="flex w-full items-center gap-3 rounded-md border border-[var(--border)] bg-[var(--bg-card)] px-3.5 py-2.5 text-left hover:border-[var(--accent)]"
                >
                  <span
                    aria-hidden
                    className="flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors"
                    style={{ background: on ? "var(--accent)" : "var(--border-strong)" }}
                  >
                    <span
                      className="h-4 w-4 rounded-full bg-white transition-transform"
                      style={{ transform: on ? "translateX(16px)" : "none" }}
                    />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13.5px] font-medium">{mm.nome}</span>
                    <span className="block text-[12px] text-[var(--text-secondary)]">{mm.sotto}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </Sez>

        <Ordina
          titolo="Le voci in alto"
          sotto="Sposta e nascondi le voci della barra. Impostazioni e Supporto restano in fondo."
          elenco={bozza.voci}
          nascosti={bozza.vociNascoste}
          nome={(k) => NOMI_VOCE[k] ?? k}
          onOrdine={(voci) => cambia({ voci })}
          onNascondi={(vociNascoste) => cambia({ vociNascoste })}
        />
        <Ordina
          titolo="I blocchi del cruscotto"
          sotto="Cosa vedi per primo aprendo il cruscotto, e cosa non vedi affatto."
          elenco={bozza.blocchi}
          nascosti={bozza.blocchiNascosti}
          nome={(k) => NOMI_BLOCCO[k] ?? k}
          onOrdine={(blocchi) => cambia({ blocchi })}
          onNascondi={(blocchiNascosti) => cambia({ blocchiNascosti })}
        />
        <Ordina
          titolo="I tool del magazzino"
          sotto="La barra della banchina, nell'ordine che vuoi."
          elenco={bozza.toolMagazzino}
          nascosti={[]}
          nome={(k) => NOMI_TOOL[k] ?? k}
          onOrdine={(toolMagazzino) => cambia({ toolMagazzino })}
        />
        <Ordina
          titolo="I tool del traffico"
          sotto="La barra dell'ufficio, nell'ordine che vuoi."
          elenco={bozza.toolTraffico}
          nascosti={[]}
          nome={(k) => NOMI_TOOL[k] ?? k}
          onOrdine={(toolTraffico) => cambia({ toolTraffico })}
        />

        <div className="mt-8 flex justify-end">
          <button
            onClick={() => void salva()}
            disabled={inCorso}
            className="btn-grad cursor-pointer rounded-md px-5 py-2.5 text-[13.5px] font-medium disabled:opacity-50"
          >
            {salvaBtn}
          </button>
        </div>
      </div>
    </div>
  );
}

const NOMI_VOCE: Record<string, string> = {
  cruscotto: "Cruscotto",
  traffico: "Traffico",
  magazzino: "Magazzino",
  autisti: "Autisti",
  ammin: "Amministrazione",
  clienti: "Clienti",
  mezzi: "Mezzi",
  persone: "Persone",
  attivita: "Attività",
  documenti: "Documenti",
};

const NOMI_TOOL: Record<string, string> = {
  registro: "Registro",
  carico: "Carico",
  scarico: "Scarico",
  differenza: "Differenza",
  problema: "Problema",
  arrivi: "In arrivo",
  agente: "Agente",
  ritiri: "Ritiri",
  prenota: "Prenota",
  reclamo: "Reclamo",
  dove: "Dov'è il carico",
  preventivo: "Preventivo",
};

function Sez({ titolo, sotto, children }: { titolo: string; sotto: string; children: React.ReactNode }) {
  return (
    <div className="mt-7">
      <h2 className="text-[14px] font-semibold">{titolo}</h2>
      <p className="mt-0.5 mb-3 text-[12.5px] text-[var(--text-secondary)]">{sotto}</p>
      {children}
    </div>
  );
}

function Ordina({
  titolo,
  sotto,
  elenco,
  nascosti,
  nome,
  onOrdine,
  onNascondi,
}: {
  titolo: string;
  sotto: string;
  elenco: string[];
  nascosti: string[];
  nome: (k: string) => string;
  onOrdine: (v: string[]) => void;
  onNascondi?: (v: string[]) => void;
}) {
  return (
    <Sez titolo={titolo} sotto={sotto}>
      <div className="overflow-hidden rounded-md border border-[var(--border)] bg-[var(--bg-card)]">
        {elenco.map((k, i) => {
          const spento = nascosti.includes(k);
          return (
            <div
              key={k}
              className={`flex items-center gap-2 border-b border-[var(--border)] px-3 py-2 last:border-0 ${
                spento ? "opacity-45" : ""
              }`}
            >
              <span className="flex-1 text-[13.5px] font-medium">{nome(k)}</span>
              {onNascondi && (
                <button
                  onClick={() => onNascondi(spento ? nascosti.filter((x) => x !== k) : [...nascosti, k])}
                  title={spento ? "Mostra" : "Nascondi"}
                  className="cursor-pointer rounded p-1.5 text-[var(--text-secondary)] hover:bg-[var(--fill-quiet)] hover:text-[var(--text-primary)]"
                >
                  <Icona nome={spento ? "occhioNo" : "occhio"} size={16} />
                </button>
              )}
              <button
                onClick={() => onOrdine(sposta(elenco, i, -1))}
                disabled={i === 0}
                title="Su"
                className="cursor-pointer rounded p-1.5 text-[var(--text-secondary)] hover:bg-[var(--fill-quiet)] hover:text-[var(--text-primary)] disabled:opacity-25"
              >
                <Icona nome="su" size={16} />
              </button>
              <button
                onClick={() => onOrdine(sposta(elenco, i, 1))}
                disabled={i === elenco.length - 1}
                title="Giù"
                className="cursor-pointer rounded p-1.5 text-[var(--text-secondary)] hover:bg-[var(--fill-quiet)] hover:text-[var(--text-primary)] disabled:opacity-25"
              >
                <Icona nome="giu" size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </Sez>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// LA LEVETTA CHIARO/SCURO
// ─────────────────────────────────────────────────────────────────────────

/**
 * ⚠️ È una preferenza del DISPOSITIVO, non della persona (vive in
 * localStorage, gestita da theme.ts): chi lavora al chiaro in banchina e al
 * buio in cabina vuole due impostazioni diverse sui due schermi. Sta nella
 * testata dell'area azienda, non muove niente della vetrina pubblica.
 */
function LevettaTema() {
  const { theme, toggle } = useTheme();
  const scuro = theme === "dark";
  return (
    <button
      onClick={toggle}
      title={scuro ? "Passa al chiaro" : "Passa allo scuro"}
      aria-label={scuro ? "Passa al chiaro" : "Passa allo scuro"}
      className="cursor-pointer rounded-md p-1.5 text-[var(--text-secondary)] hover:bg-[var(--fill-quiet)] hover:text-[var(--text-primary)]"
    >
      <Icona nome={scuro ? "sole" : "luna"} size={18} />
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// AUTISTI — pensata per chi guida: prima la voce, poca lettura
// ─────────────────────────────────────────────────────────────────────────

/**
 * ⚠️ Chi la usa sta guidando: agente per primo (voce), niente da compilare.
 * Le consegne del giorno arrivano da K-Master — finché non è collegato, la
 * cornice lo dice invece di mostrare una lista finta. L'unica cosa manuale è
 * segnalare un intoppo in strada, e si fa a voce.
 */
function Autisti({
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
  const [strumento, setStrumento] = useState("agente");
  const [fatto, setFatto] = useState<string | null>(null);
  const strumenti: Strumento[] = [
    { id: "agente", nome: "Agente", icona: "agente" },
    { id: "consegne", nome: "Consegne di oggi", icona: "ritiro" },
    { id: "problema", nome: "Segnala", icona: "problema" },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-[var(--border)] bg-[var(--bg-card)]">
        <div className="flex items-baseline gap-3 px-5 pt-3 md:px-8">
          <h1 className="text-[15px] font-semibold tracking-[-0.01em]">{postazione.nome}</h1>
          <p className="truncate text-[12px] text-[var(--text-secondary)]">{postazione.cosa}</p>
        </div>
        <div className="mt-1 px-3 md:px-6">
          <BarraStrumenti strumenti={strumenti} attivo={strumento} onScegli={setStrumento} />
        </div>
      </div>

      {strumento === "agente" && (
        <Conversazione postazione={postazione} nome={nome} agenteVivo={agenteVivo} seScaduta={seScaduta} />
      )}

      {strumento === "consegne" && (
        <div className="flex-1 overflow-y-auto px-5 py-5 md:px-8">
          <div className="mx-auto max-w-[760px]">
            <p className="mb-3 text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
              Il giro di oggi — chi, dove, in che ordine. Chiedi all'agente
              «qual è la prossima?» o «quanto manca a…»: quello risponde già,
              anche a voce, mentre guidi.
            </p>
            <div className="rounded-md border border-dashed border-[var(--border)] px-5 py-8 text-center">
              <p className="text-[13.5px] font-medium">Il giro arriva da K-Master</p>
              <p className="mx-auto mt-1.5 max-w-[46ch] text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
                Appena colleghiamo il gestionale, qui compare l'elenco delle
                consegne del giorno, in ordine, con indirizzo e note. Fino ad
                allora l'agente conosce già le distanze e i tempi.
              </p>
            </div>
          </div>
        </div>
      )}

      {strumento === "problema" && (
        <div className="flex-1 overflow-y-auto px-5 py-5 md:px-8">
          <div className="mx-auto max-w-[560px] overflow-hidden rounded-md border border-[var(--border)]">
            <FormMovimento
              tipo="problema"
              onChiudi={() => setStrumento("agente")}
              onFatto={(riga) => {
                setFatto(riga);
                setStrumento("agente");
              }}
              seScaduta={seScaduta}
            />
          </div>
          {fatto && (
            <p
              className="mx-auto mt-3 max-w-[560px] rounded-md border-l-2 bg-[var(--fill-quiet)] px-4 py-3 text-[13.5px]"
              style={{ borderColor: "var(--accent)" }}
            >
              {fatto}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// AMMINISTRAZIONE — soldi e scadenze: quasi tutto arriva dal gestionale
// ─────────────────────────────────────────────────────────────────────────

/**
 * ⚠️ Poca manualità: fatture e incassi vivono nel gestionale, non si riscrivono
 * a mano qui. La postazione è l'agente (per chiedere «quanto ci deve la Rossi?»,
 * «cosa scade questa settimana?») più i quadri onesti che si accendono al
 * collegamento. Niente numeri finti nel frattempo.
 */
function Amministrazione({
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
  const [strumento, setStrumento] = useState("agente");
  const strumenti: Strumento[] = [
    { id: "agente", nome: "Agente", icona: "agente" },
    { id: "soldi", nome: "Da incassare", icona: "cruscotto" },
    { id: "fornitori", nome: "Fornitori", icona: "documenti" },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-[var(--border)] bg-[var(--bg-card)]">
        <div className="flex items-baseline gap-3 px-5 pt-3 md:px-8">
          <h1 className="text-[15px] font-semibold tracking-[-0.01em]">{postazione.nome}</h1>
          <p className="truncate text-[12px] text-[var(--text-secondary)]">{postazione.cosa}</p>
        </div>
        <div className="mt-1 px-3 md:px-6">
          <BarraStrumenti strumenti={strumenti} attivo={strumento} onScegli={setStrumento} />
        </div>
      </div>

      {strumento === "agente" && (
        <Conversazione postazione={postazione} nome={nome} agenteVivo={agenteVivo} seScaduta={seScaduta} />
      )}

      {strumento === "soldi" && (
        <div className="flex-1 overflow-y-auto px-5 py-5 md:px-8">
          <div className="mx-auto max-w-[900px]">
            <p className="mb-3 text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
              Quanto c'è da incassare e cosa scade. Arriva dal gestionale delle
              fatture: l'agente incrocia poi gli incassi in banca per spuntarle
              da sole.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <Cornice titolo="Da incassare" sotto="fatture emesse non ancora pagate">
                <Attesa da="il gestionale fatture" altezza={140} />
              </Cornice>
              <Cornice titolo="Scadenze" sotto="cosa scade questa settimana">
                <Attesa da="il gestionale fatture" altezza={140} />
              </Cornice>
            </div>
          </div>
        </div>
      )}

      {strumento === "fornitori" && (
        <div className="flex-1 overflow-y-auto px-5 py-5 md:px-8">
          <div className="mx-auto max-w-[900px]">
            <p className="mb-3 text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
              Le fatture dei fornitori da controllare e pagare. Con Outlook
              collegato, l'agente le raccoglie dalle email appena arrivano.
            </p>
            <Cornice titolo="Fatture fornitori" sotto="da controllare e mettere in scadenzario">
              <Attesa da="Outlook e il gestionale" altezza={160} />
            </Cornice>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SCANSIONI — le letture che arrivano dritte dagli scanner
// ─────────────────────────────────────────────────────────────────────────

/**
 * ⚠️ È la porta che rende vero «le bolle scannerizzate importate direttamente
 * su CorpAgent» (deciso al sopralluogo: QCSNET non dà le API). Il feed si
 * aggiorna da solo; il titolare vede in cima il gettone da mettere nei palmari
 * Zebra, con l'indirizzo dove sparano.
 */
function Scansioni({
  titolare,
  seScaduta,
}: {
  titolare: boolean;
  seScaduta: (e: unknown) => void;
}) {
  const [letture, setLetture] = useState<Lettura[] | null>(null);
  const [chiave, setChiave] = useState<string | null>(null);
  const [inCorso, setInCorso] = useState(false);
  const [copiato, setCopiato] = useState(false);

  useEffect(() => {
    let vivo = true;
    const tira = () => {
      leggi<{ letture: Lettura[] }>("letture")
        .then((r) => {
          if (vivo) setLetture(r.letture);
        })
        .catch((e) => seScaduta(e));
    };
    tira();
    // Ogni 12s: uno scanner che spara in banchina deve comparire quasi subito.
    const t = setInterval(tira, 12_000);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, [seScaduta]);

  useEffect(() => {
    if (!titolare) return;
    leggi<{ chiave: string | null }>("ingresso")
      .then((r) => setChiave(r.chiave))
      .catch((e) => seScaduta(e));
  }, [titolare, seScaduta]);

  async function genera() {
    setInCorso(true);
    try {
      const r = await manda<{ chiave: string }>({ az: "ingresso-genera" });
      setChiave(r.chiave);
    } catch (e) {
      seScaduta(e);
    } finally {
      setInCorso(false);
    }
  }

  const url =
    typeof window !== "undefined" ? `${window.location.origin}/api/config` : "/api/config";

  return (
    <div className="flex-1 overflow-y-auto px-5 py-5 md:px-8">
      <div className="mx-auto max-w-[900px]">
        {/* ── Il gettone, solo per il titolare ─────────────────────────── */}
        {titolare && (
          <div className="mb-5 rounded-md border border-[var(--border)] bg-[var(--bg-card)] p-4">
            <div className="flex items-center gap-2">
              <Icona nome="barcode" size={18} className="text-[var(--text-secondary)]" />
              <h3 className="text-[13.5px] font-semibold">Collegare gli scanner</h3>
            </div>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
              I palmari Zebra sparano il barcode dritto qui dentro. Nel palmare
              (DataWedge → output HTTP) si mette questo indirizzo e questo
              gettone; il barcode arriva nel campo «barcode».
            </p>

            <div className="mt-3 space-y-2">
              <Riga2 etichetta="Indirizzo" valore={url} />
              {chiave ? (
                <Riga2
                  etichetta="Gettone"
                  valore={chiave}
                  segreto
                  onCopia={() => {
                    navigator.clipboard?.writeText(chiave);
                    setCopiato(true);
                    setTimeout(() => setCopiato(false), 1500);
                  }}
                  copiato={copiato}
                />
              ) : (
                <p className="text-[12.5px] text-[var(--text-secondary)]">
                  Ancora nessun gettone. Generane uno e mettilo nei palmari.
                </p>
              )}
            </div>

            <button
              onClick={() => void genera()}
              disabled={inCorso}
              className="mt-3 cursor-pointer rounded-md border border-[var(--border)] px-3.5 py-2 text-[12.5px] font-medium hover:border-[var(--accent)] disabled:opacity-50"
            >
              {inCorso ? "Genero…" : chiave ? "Rigenera (il vecchio smette)" : "Genera gettone"}
            </button>
            {chiave && (
              <p className="mt-2 text-[11.5px] leading-relaxed text-[var(--text-secondary)]">
                ⚠️ Il gettone permette solo di MANDARE letture in questa azienda,
                niente altro. Se lo rigeneri, i palmari vanno riconfigurati col nuovo.
              </p>
            )}
          </div>
        )}

        {/* ── Il feed delle letture ────────────────────────────────────── */}
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[11px] uppercase tracking-[0.09em] text-[var(--text-secondary)]">
            Ultime scansioni
          </h2>
          <span className="text-[11px] text-[var(--text-secondary)]">si aggiorna da solo</span>
        </div>

        {letture === null && <p className="text-[13px] text-[var(--text-secondary)]">Leggo…</p>}
        {letture !== null && letture.length === 0 && (
          <Niente
            titolo="Ancora nessuna scansione"
            testo="Appena un palmare spara un codice, o la multifunzione manda una bolla, compare qui in tempo reale — con codice, ora e dispositivo."
          />
        )}
        {letture !== null && letture.length > 0 && (
          <Tabella
            colonne={[
              { nome: "", larghezza: "34px" },
              { nome: "Codice" },
              { nome: "Tipo", larghezza: "110px" },
              { nome: "Abbinato", larghezza: "90px" },
              { nome: "Dispositivo · ora", larghezza: "200px", destra: true },
            ]}
          >
            {letture.map((l) => (
              <Riga key={l.id}>
                <Cella>
                  <Icona nome="barcode" size={16} className="text-[var(--text-secondary)]" />
                </Cella>
                <Cella>
                  <span className="font-mono text-[12.5px]">{l.barcode}</span>
                </Cella>
                <Cella tenue>{l.tipo}</Cella>
                <Cella tenue>{l.abbinato ? "sì" : "—"}</Cella>
                <Cella destra tenue>
                  {l.dispositivo ? `${l.dispositivo} · ` : ""}
                  {new Date(l.quando).toLocaleTimeString("it-IT", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Cella>
              </Riga>
            ))}
          </Tabella>
        )}
      </div>
    </div>
  );
}

/** Una riga «etichetta: valore» copiabile, per indirizzo e gettone. */
function Riga2({
  etichetta,
  valore,
  segreto,
  onCopia,
  copiato,
}: {
  etichetta: string;
  valore: string;
  segreto?: boolean;
  onCopia?: () => void;
  copiato?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--bg-app)] px-3 py-2">
      <span className="w-[70px] shrink-0 text-[11.5px] text-[var(--text-secondary)]">{etichetta}</span>
      <span
        className={`min-w-0 flex-1 truncate font-mono text-[12px] ${segreto ? "tracking-tight" : ""}`}
      >
        {valore}
      </span>
      {onCopia && (
        <button
          onClick={onCopia}
          className="shrink-0 cursor-pointer rounded border border-[var(--border)] px-2 py-1 text-[11px] font-medium hover:border-[var(--accent)]"
        >
          {copiato ? "Copiato ✓" : "Copia"}
        </button>
      )}
    </div>
  );
}

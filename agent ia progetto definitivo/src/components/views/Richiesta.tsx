import { useCallback, useEffect, useRef, useState } from "react";
import CursoreGlow from "../landing/CursoreGlow";
import Logo from "../Logo";
import {
  suonoAgente,
  suonoClick,
  suonoErrore,
  suonoFatto,
  suonoInvio,
  suonoSfiora,
} from "../../lib/suoni";
import { creaRichiesta, parlaConQualifica } from "../../lib/api";
import { Compare, Numero, PulsanteMagnetico } from "../landing/movimento";

/**
 * La vetrina pubblica — **l'unica cosa che il mondo può vedere.**
 *
 * Direzione finale di Tommaso, 10 Agosto 2026: *«pubblico va solo la landing
 * page con il form di contatto aziende. Tutto il resto resta privato finché
 * non c'è un cliente reale collegato.»*
 *
 * ─────────────────────────────────────────────────────────────────────────
 * PERCHÉ NON C'È NESSUN PULSANTE «ENTRA»
 * ─────────────────────────────────────────────────────────────────────────
 * Non è una dimenticanza: è la porta chiusa. Non esiste iscrizione, non
 * esiste prova gratuita, non esiste un link al prodotto. L'unica strada in
 * avanti, per chiunque arrivi qui, è **scrivere a corpagent7@gmail.com** — e
 * questo è deliberato: il contatto commerciale lo fa Tommaso, a mano, una
 * azienda alla volta.
 *
 * ⚠️ Nascondere la porta non è chiuderla a chiave. Chi conoscesse l'indirizzo
 * d'ingresso entrerebbe comunque. L'elenco degli account ammessi è la vera
 * serratura, e va messo prima di far girare questo link davvero.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * L'ESTETICA QUI È DIVERSA DAL PRODOTTO, PER DECISIONE
 * ─────────────────────────────────────────────────────────────────────────
 * Il prodotto è grafite e bianco, «sembra costoso perché non urla» (2 Agosto).
 * La vetrina ha in più **un accento luminoso freddo** e il cursore con la
 * scia: sceltа di Tommaso il 10 Agosto. Vale solo su questa pagina — chi entra
 * dopo la consegna torna alla calma di sempre.
 */

/** L'accento che vive solo qui, in RGB per poterlo sfumare. */
const LUCE = "77, 225, 255";

// ─────────────────────────────────────────────────────────────────────────
// LA CONVERSAZIONE CHE SI SCRIVE DA SOLA
// ─────────────────────────────────────────────────────────────────────────
//
// ⚠️ Finisce con l'agente che **non sa** e passa la palla al titolare, e non è
// un finale timido: è la risposta alla paura numero uno dell'imprenditore —
// «dirà sciocchezze ai miei clienti?». Una vetrina che mostra solo le risposte
// perfette conferma quella paura invece di scioglierla.
//
// ⚠️ Volutamente SENZA nome di azienda e senza un mestiere riconoscibile
// (Tommaso, 11 Agosto): un esempio di trasporti fa pensare «non è per me» a un
// ristoratore. Le battute funzionano per un negozio, uno studio, un'officina o
// un ristorante — chiunque prenda appuntamenti e riceva richieste di sconto.
const COPIONE: { chi: "cliente" | "agente"; testo: string; nota?: string }[] = [
  { chi: "cliente", testo: "Buonasera, avete disponibilità per domani?" },
  { chi: "agente", testo: "Sì, domani mattina siamo liberi dalle 9 alle 12. Le va bene alle 10?" },
  { chi: "cliente", testo: "Perfetto. E quanto viene in tutto?" },
  { chi: "agente", testo: "Come da listino sono 80 €. Le confermo l'appuntamento?" },
  { chi: "cliente", testo: "Se ne prendo due mi fa 50?" },
  {
    chi: "agente",
    testo: "Su questo decide il titolare: gli passo la richiesta adesso e la richiamo entro stasera.",
    nota: "titolare avvisato",
  },
];

export default function Richiesta() {
  const [inviata, setInviata] = useState<{ chiave: string; saluto: string } | null>(null);

  return (
    <div
      className="on-dark relative min-h-screen overflow-x-hidden bg-[#050507] text-[#F5F5F7]"
      style={{ ["--luce" as string]: LUCE }}
    >
      <CursoreGlow colore={LUCE} />
      <Bagliori />

      <header className="relative z-10 mx-auto flex max-w-[1100px] items-center justify-between px-5 py-5 sm:px-6 sm:py-6">
        <div className="flex items-center gap-2.5">
          <Logo size={24} />
          <span className="text-[15px] font-medium tracking-[-0.01em]">CorpAgent</span>
        </div>
        {/* ⚠️ Nessun «Entra». Vedi il commento in cima al file. */}
        <span className="font-dato text-[11px] uppercase tracking-[0.1em] text-white/55">Su invito</span>
      </header>

      <main className="relative z-10 mx-auto max-w-[1100px] px-5 pb-20 sm:px-6 sm:pb-24">
        <Hero />
        {inviata ? (
          <ChatQualifica chiave={inviata.chiave} saluto={inviata.saluto} />
        ) : (
          <Form onFatto={setInviata} />
        )}
        <Funzioni />
        <Piede />
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// LO SFONDO
// ─────────────────────────────────────────────────────────────────────────

/**
 * Due aloni immobili e una griglia appena visibile.
 *
 * ⚠️ Immobili di proposito. Uno sfondo che si muove da solo compete con la
 * chat che si scrive — e quando due cose si muovono insieme, non se ne guarda
 * nessuna. Il movimento in questa pagina è **uno solo**, ed è il momento
 * vistoso che Tommaso ha scelto.
 */
function Bagliori() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="anima-respiro absolute -top-40 left-1/2 h-[560px] w-[900px] -translate-x-1/2 rounded-full blur-[120px]"
        style={{ background: `radial-gradient(closest-side, rgba(${LUCE}, 0.16), transparent)` }}
      />
      <div
        className="anima-respiro absolute top-[45%] -right-40 h-[420px] w-[620px] rounded-full blur-[130px]"
        style={{ background: `radial-gradient(closest-side, rgba(${LUCE}, 0.09), transparent)` }}
      />
      <div
        className="absolute inset-0 opacity-[0.13]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.14) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.14) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(ellipse 90% 55% at 50% 0%, #000 35%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 90% 55% at 50% 0%, #000 35%, transparent 100%)",
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// L'HERO E LA CHAT CHE SI DIGITA
// ─────────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="grid items-center gap-9 pt-6 pb-12 sm:gap-12 sm:pt-10 sm:pb-16 lg:grid-cols-[1fr_460px] lg:pt-16">
      <div>
        <Compare>
          <p
            className="mb-5 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[12px]"
            style={{ borderColor: `rgba(${LUCE}, 0.28)`, color: `rgba(${LUCE}, 0.95)` }}
          >
            <span className="relative flex h-1.5 w-1.5">
              <span
                className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70"
                style={{ background: `rgb(${LUCE})` }}
              />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: `rgb(${LUCE})` }} />
            </span>
            Lavoriamo con tante aziende insieme
          </p>
        </Compare>

        <Compare ritardo={80}>
          <h1 className="font-vetrina text-[clamp(2.6rem,6vw,4.4rem)] leading-[0.98] tracking-[-0.03em]">
            Sei un&apos;azienda?
          </h1>
        </Compare>

        <Compare ritardo={160}>
          <p className="mt-5 max-w-[30rem] text-[16px] leading-relaxed text-white/60 sm:text-[17px]">
            I tuoi clienti ti scrivono su WhatsApp a tutte le ore. Risponde un agente che
            conosce i tuoi prezzi, i tuoi orari e le tue regole — e che{" "}
            <span className="font-voce text-[19px] text-white/85 sm:text-[21px]">
              quando non sa, lo dice e chiama te.
            </span>
          </p>
        </Compare>

        <Compare ritardo={240}>
          {/* ⚠️ Cifre vere, non arrotondate in su: 1,5 s è il tempo misurato in
              produzione il 2 Agosto; 24 sono le ore; 3 i canali su cui l'agente
              risponde davvero (sito, WhatsApp, telefono). Gonfiare un numero
              qui è ciò che poi tocca disinnescare alla prima email. */}
          <div className="mt-9 flex gap-8 sm:gap-12">
            <Numero fino={1.5} suffisso=" s" etichetta="per rispondere" />
            <Numero fino={24} suffisso="h" etichetta="tutti i giorni" />
            <Numero fino={3} etichetta="canali: sito, WhatsApp, telefono" />
          </div>
        </Compare>
      </div>

      <Compare ritardo={320}>
        <ChatFinta />
      </Compare>
    </section>
  );
}

/**
 * Il momento vistoso: la conversazione si scrive davanti agli occhi.
 *
 * ⚠️ Con «sta scrivendo» prima di ogni risposta dell'agente, e con una pausa
 * più lunga prima dell'ultima battuta. La pausa non è decorativa: è il tempo
 * che serve a chi guarda per aspettarsi lo sconto concesso — e restare
 * spiazzato dal fatto che l'agente **non lo concede**.
 */
function ChatFinta() {
  const [visibili, setVisibili] = useState(0);
  const [scrivendo, setScrivendo] = useState(false);
  const [parziale, setParziale] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const calmo = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (calmo) {
      // Chi ha chiesto meno movimento vede la conversazione già finita: il
      // contenuto è lo stesso, sparisce solo lo spettacolo.
      setVisibili(COPIONE.length);
      return;
    }

    let annullato = false;
    const attese: number[] = [];
    const dormi = (ms: number) =>
      new Promise<void>((ok) => attese.push(window.setTimeout(ok, ms)));

    (async () => {
      await dormi(700);
      for (let i = 0; i < COPIONE.length && !annullato; i++) {
        const b = COPIONE[i];
        if (b.chi === "agente") {
          setScrivendo(true);
          await dormi(i === COPIONE.length - 1 ? 1500 : 850);
          setScrivendo(false);
        }
        // Si scrive lettera per lettera solo quello che dice l'agente: è lui
        // il protagonista, e vedere digitare anche il cliente raddoppierebbe
        // l'attesa senza aggiungere niente.
        if (b.chi === "agente") {
          for (let c = 1; c <= b.testo.length && !annullato; c++) {
            setParziale(b.testo.slice(0, c));
            await dormi(14);
          }
          setParziale("");
        }
        setVisibili(i + 1);
        await dormi(b.chi === "cliente" ? 650 : 900);
      }
    })();

    return () => {
      annullato = true;
      attese.forEach(clearTimeout);
    };
  }, []);

  useEffect(() => {
    boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight, behavior: "smooth" });
  }, [visibili, parziale, scrivendo]);

  return (
    <div
      className="relative rounded-2xl border p-4 backdrop-blur-xl"
      style={{
        borderColor: "rgba(255,255,255,0.09)",
        background: "rgba(255,255,255,0.028)",
        boxShadow: `0 0 90px rgba(${LUCE}, 0.10)`,
      }}
    >
      <div className="mb-3 flex items-center gap-2 border-b border-white/[0.07] pb-3">
        <span className="h-2 w-2 rounded-full" style={{ background: "#2ecc82" }} />
        <span className="font-dato text-[11.5px] uppercase tracking-[0.07em] text-white/60">
          WhatsApp · ieri, 22:41
        </span>
      </div>

      {/* ⚠️ Più bassa su telefono: 330px su uno schermo da 667px di altezza
          mangiano metà pagina, e il form finirebbe sotto due schermate di
          scorrimento. È il form che deve restare a portata di pollice. */}
      <div ref={boxRef} className="h-[240px] space-y-2.5 overflow-y-auto pr-1 sm:h-[330px]">
        {COPIONE.slice(0, visibili).map((b, i) => (
          <Bolla key={i} chi={b.chi} testo={b.testo} nota={b.nota} />
        ))}
        {parziale && <Bolla chi="agente" testo={parziale} digitando />}
        {scrivendo && (
          <div className="flex gap-1 px-3 py-2">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/50"
                style={{ animationDelay: `${i * 130}ms` }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Bolla({
  chi,
  testo,
  nota,
  digitando,
}: {
  chi: "cliente" | "agente";
  testo: string;
  nota?: string;
  digitando?: boolean;
}) {
  const mio = chi === "cliente";
  return (
    <div className={`flex ${mio ? "justify-end" : "justify-start"}`}>
      <div className="max-w-[85%]">
        <div
          className={`rounded-2xl px-3.5 py-2 text-[13.5px] leading-relaxed ${
            mio ? "rounded-br-md text-[#0a0a0b]" : "rounded-bl-md text-white/85"
          }`}
          style={
            mio
              ? { background: "rgba(255,255,255,0.92)" }
              : { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.07)" }
          }
        >
          {testo}
          {digitando && <span className="ml-0.5 inline-block h-3.5 w-[2px] animate-pulse align-middle bg-white/70" />}
        </div>
        {nota && (
          <div className="mt-1.5 flex items-center gap-1.5 pl-1 text-[11.5px]" style={{ color: `rgb(${LUCE})` }}>
            <span>↳</span> {nota}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// IL FORM
// ─────────────────────────────────────────────────────────────────────────

function Form({ onFatto }: { onFatto: (v: { chiave: string; saluto: string }) => void }) {
  const [d, setD] = useState({ azienda: "", settore: "", telefono: "", email: "", esigenza: "" });
  // ⚠️ L'esca. Una persona non la vede e non la compila mai; certi programmi
  // riempiono ogni campo che trovano nel codice. Se arriva piena, la richiesta
  // viene scartata — e a chi l'ha mandata rispondiamo «grazie», per non
  // insegnargli dov'è la trappola.
  const [esca, setEsca] = useState("");
  const [accetto, setAccetto] = useState(false);
  const [attesa, setAttesa] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  // ⚠️ QUI C'ERA CLOUDFLARE TURNSTILE, ED È STATO TOLTO — Tommaso, 11 Agosto
  // 2026: «togli il controllo antirobot».
  //
  // Il motivo pratico: su questo dominio restituiva la pagina d'errore di
  // Cloudflare, quindi il primo effetto del «controllo di sicurezza» era
  // impedire alle aziende vere di scrivere. Un controllo che ferma i clienti e
  // non i programmi è peggio di nessun controllo.
  //
  // ⚠️ Il form NON è rimasto senza difese, e le due che restano sono invisibili
  // a chi compila in buona fede: l'esca qui sotto e il limite di tre richieste
  // all'ora dallo stesso posto (migrazione 0017). Sono più debole di Turnstile:
  // se un giorno arrivasse spam vero, la strada è rimettere Turnstile con
  // l'hostname configurato bene, non inventarne una terza.

  async function invia() {
    setErrore(null);
    setAttesa(true);
    try {
      const r = await creaRichiesta({ ...d, sito: esca });
      suonoFatto();
      onFatto(r);
    } catch (e) {
      suonoErrore();
      setErrore(e instanceof Error ? e.message : String(e));
    } finally {
      setAttesa(false);
    }
  }

  // ⚠️ Il gettone di Turnstile NON entra qui. Se ci entrasse, un guasto di
  // Cloudflare terrebbe il pulsante spento e nessuna azienda potrebbe mandare
  // una richiesta — che è esattamente quello che è successo l'11 Agosto. Il
  // controllo lo fa il server, che sa anche degradare.
  const pieno = Object.values(d).every((v) => v.trim()) && accetto;

  return (
    <Compare ritardo={400}>
      <section id="form" className="mx-auto max-w-[560px] pt-4 sm:pt-8">
        <h2 className="text-[26px] font-semibold tracking-[-0.025em]">Raccontaci il tuo problema</h2>
        <p className="mt-2 text-[14px] leading-relaxed text-white/50">
          Ti facciamo tre domande, poi ti scriviamo noi. Nessun impegno, nessun listino da leggere.
        </p>

        <div className="mt-7 space-y-4">
          <Campo etichetta="Nome dell'azienda" valore={d.azienda} onCambia={(v) => setD({ ...d, azienda: v })} />
          <Campo
            etichetta="Di cosa vi occupate"
            valore={d.settore}
            onCambia={(v) => setD({ ...d, settore: v })}
            suggerimento="Con parole tue: «trasporto merci refrigerate in Sicilia, 8 mezzi»"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etichetta="Telefono" valore={d.telefono} onCambia={(v) => setD({ ...d, telefono: v })} tipo="tel" />
            <Campo
              etichetta="Email"
              valore={d.email}
              onCambia={(v) => setD({ ...d, email: v })}
              tipo="email"
              suggerimento="Ci serve per mandarti la proposta dettagliata"
            />
          </div>
          <Campo
            etichetta="Cosa ti serve"
            valore={d.esigenza}
            onCambia={(v) => setD({ ...d, esigenza: v })}
            righe={4}
            suggerimento="Cosa ti fa perdere più tempo oggi con i clienti?"
          />
        </div>

        {/* ⚠️ Nascosta col CSS e non con `type="hidden"`: i programmi che
            riempiono i moduli SALTANO i campi hidden — sanno che sono trappole
            — mentre compilano quelli visibili nel codice e invisibili sullo
            schermo. `aria-hidden` e `tabIndex={-1}` la tengono fuori dalla
            navigazione da tastiera e dai lettori di schermo, così nessuna
            persona la incontra per sbaglio. */}
        <div aria-hidden className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
          <label>
            Sito web
            <input
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={esca}
              onChange={(e) => setEsca(e.target.value)}
            />
          </label>
        </div>


        <label className="mt-5 flex cursor-pointer items-start gap-3 text-[13px] leading-relaxed text-white/55">
          <input
            type="checkbox"
            checked={accetto}
            onChange={(e) => {
              setAccetto(e.target.checked);
              suonoClick();
            }}
            className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-white/40 bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            style={{ accentColor: `rgb(${LUCE})` }}
          />
          <span>
            Ho letto l&apos;
            <a href="/privacy" className="cursor-pointer underline underline-offset-2 transition-colors duration-200 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70">
              informativa privacy
            </a>{" "}
            e acconsento a essere ricontattato per questa richiesta.
          </span>
        </label>

        {errore && (
          <p className="mt-4 rounded-lg border border-red-500/25 bg-red-500/10 px-3.5 py-2.5 text-[13px] text-red-300">
            {errore}
          </p>
        )}

        <PulsanteMagnetico
          onClick={() => void invia()}
          disabled={!pieno || attesa}
          className="mt-6 w-full cursor-pointer rounded-xl px-5 py-4 text-[15.5px] font-medium text-[#04252c] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#050507] disabled:cursor-not-allowed disabled:opacity-35 sm:py-3.5 sm:text-[15px]"
          style={{
            background: `linear-gradient(180deg, rgb(${LUCE}), rgba(${LUCE},0.82))`,
            boxShadow: pieno && !attesa ? `0 0 40px rgba(${LUCE}, 0.32)` : "none",
          }}
        >
          {attesa ? "Invio…" : "Invia la richiesta"}
        </PulsanteMagnetico>

        <p className="mt-3 text-center text-[12px] text-white/50">
          Non ti iscriviamo a niente. Ti scriviamo da corpagent7@gmail.com.
        </p>
      </section>
    </Compare>
  );
}

function Campo({
  etichetta,
  valore,
  onCambia,
  suggerimento,
  tipo = "text",
  righe,
}: {
  etichetta: string;
  valore: string;
  onCambia: (v: string) => void;
  suggerimento?: string;
  tipo?: string;
  righe?: number;
}) {
  const [attivo, setAttivo] = useState(false);
  const stile = {
    borderColor: attivo ? `rgba(${LUCE}, 0.55)` : "rgba(255,255,255,0.10)",
    boxShadow: attivo ? `0 0 26px rgba(${LUCE}, 0.13)` : "none",
    background: "rgba(255,255,255,0.028)",
  };
  // ⚠️ `text-[16px]` fino a `sm` è obbligatorio, non estetico: Safari su
  // iPhone ingrandisce la pagina da solo quando si tocca un campo con testo
  // sotto i 16px. Su un form che vale un cliente, quello zoom improvviso è il
  // momento in cui molti chiudono la scheda.
  // ⚠️ `focus-visible` e non `focus`: il primo si accende **solo** quando ci
  // sei arrivato da tastiera. Con `focus` semplice l'anello comparirebbe anche
  // a ogni clic del mouse, e allora si tende a toglierlo — che è il modo in cui
  // i siti finiscono per essere inutilizzabili senza mouse.
  const classi =
    "mt-1.5 w-full rounded-xl border px-3.5 py-3 text-[16px] text-white outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-white/45 focus-visible:ring-2 focus-visible:ring-white/70 sm:py-2.5 sm:text-[14.5px]";

  return (
    <label className="block">
      <span className="text-[12.5px] text-white/60">{etichetta}</span>
      {righe ? (
        <textarea
          rows={righe}
          value={valore}
          onChange={(e) => onCambia(e.target.value)}
          onFocus={() => setAttivo(true)}
          onBlur={() => setAttivo(false)}
          placeholder={suggerimento}
          className={`${classi} resize-none`}
          style={stile}
        />
      ) : (
        <input
          type={tipo}
          value={valore}
          onChange={(e) => onCambia(e.target.value)}
          onFocus={() => setAttivo(true)}
          onBlur={() => setAttivo(false)}
          placeholder={suggerimento}
          className={classi}
          style={stile}
        />
      )}
    </label>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// L'AGENTE DI PRIMA QUALIFICA
// ─────────────────────────────────────────────────────────────────────────

function ChatQualifica({ chiave, saluto }: { chiave: string; saluto: string }) {
  const [righe, setRighe] = useState<{ chi: "agente" | "azienda"; testo: string }[]>([
    { chi: "agente", testo: saluto },
  ]);
  const [testo, setTesto] = useState("");
  const [attesa, setAttesa] = useState(false);
  const fondo = useRef<HTMLDivElement>(null);

  useEffect(() => {
    suonoAgente();
  }, []);

  useEffect(() => {
    fondo.current?.scrollIntoView({ behavior: "smooth" });
  }, [righe, attesa]);

  const manda = useCallback(async () => {
    const mio = testo.trim();
    if (!mio || attesa) return;
    suonoInvio();
    setTesto("");
    setRighe((r) => [...r, { chi: "azienda", testo: mio }]);
    setAttesa(true);
    try {
      const { risposta } = await parlaConQualifica(chiave, mio);
      setRighe((r) => [...r, { chi: "agente", testo: risposta }]);
      suonoAgente();
    } catch {
      setRighe((r) => [
        ...r,
        {
          chi: "agente",
          testo:
            "Ho avuto un problema tecnico, ma la tua richiesta è arrivata. Scrivici a corpagent7@gmail.com.",
        },
      ]);
      suonoErrore();
    } finally {
      setAttesa(false);
    }
  }, [attesa, chiave, testo]);

  return (
    <Compare>
      <section className="mx-auto max-w-[620px] pt-4 sm:pt-8">
        <div
          className="rounded-2xl border p-4 sm:p-5"
          style={{
            borderColor: `rgba(${LUCE}, 0.22)`,
            background: "rgba(255,255,255,0.028)",
            boxShadow: `0 0 70px rgba(${LUCE}, 0.10)`,
          }}
        >
          <p className="mb-4 border-b border-white/[0.07] pb-3 text-[13px] text-white/60">
            Richiesta ricevuta. Tre domande veloci e abbiamo finito.
          </p>

          <div className="max-h-[52vh] space-y-3 overflow-y-auto pr-1 sm:max-h-[46vh]">
            {righe.map((r, i) => (
              <div key={i} className={`flex ${r.chi === "azienda" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[86%] rounded-2xl px-3.5 py-2.5 text-[14px] leading-relaxed ${
                    r.chi === "azienda" ? "rounded-br-md text-[#0a0a0b]" : "rounded-bl-md text-white/85"
                  }`}
                  style={
                    r.chi === "azienda"
                      ? { background: "rgba(255,255,255,0.92)" }
                      : { background: "rgba(255,255,255,0.055)", border: "1px solid rgba(255,255,255,0.07)" }
                  }
                >
                  {r.testo}
                </div>
              </div>
            ))}
            {attesa && (
              <div className="flex gap-1 px-3 py-2">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/50"
                    style={{ animationDelay: `${i * 130}ms` }}
                  />
                ))}
              </div>
            )}
            <div ref={fondo} />
          </div>

          <div className="mt-4 flex gap-2">
            <input
              value={testo}
              onChange={(e) => setTesto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void manda();
              }}
              placeholder="Scrivi qui…"
              enterKeyHint="send"
              // ⚠️ 16px e non 14.5 su telefono: sotto i 16px Safari su iPhone
              // ZOOMA da solo quando tocchi un campo, e l'utente si ritrova la
              // pagina ingrandita e storta senza aver fatto niente.
              className="min-w-0 flex-1 rounded-xl border px-3.5 py-3 text-[16px] text-white outline-none transition-colors duration-200 placeholder:text-white/45 focus-visible:ring-2 focus-visible:ring-white/70 sm:py-2.5 sm:text-[14.5px]"
              style={{ borderColor: "rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.028)" }}
            />
            <button
              onClick={() => void manda()}
              onMouseEnter={suonoSfiora}
              disabled={!testo.trim() || attesa}
              className="shrink-0 cursor-pointer rounded-xl px-4 text-[14px] font-medium text-[#04252c] transition-all duration-200 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#050507] active:scale-95 disabled:opacity-30"
              style={{ background: `rgb(${LUCE})` }}
            >
              Invia
            </button>
          </div>
        </div>

        <GuidaEmail />

        <p className="mt-5 text-center text-[13px] text-white/60">
          Per qualsiasi cosa:{" "}
          <a href="mailto:corpagent7@gmail.com" className="text-white underline underline-offset-2">
            corpagent7@gmail.com
          </a>
        </p>
        <p className="mt-2 text-center text-[12px] text-white/45">
          Segui la tua richiesta:{" "}
          <a href={`/richiesta/${chiave}`} className="underline underline-offset-2">
            salva questo link
          </a>
        </p>
      </section>
    </Compare>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// PEZZI COMUNI
// ─────────────────────────────────────────────────────────────────────────

/**
 * Cosa scrivere nell'email — voluto da Tommaso l'11 Agosto 2026.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * PERCHÉ UN ELENCO E NON UNA FRASE GENTILE
 * ─────────────────────────────────────────────────────────────────────────
 * «Scrivici e raccontaci di più» produce email di due righe, e poi tre giorni
 * di botta e risposta per sapere che gestionale usano. Un elenco di quattro
 * punti produce **una email che si può già lavorare** — e visto che il
 * contatto è manuale, ogni giro di email risparmiato è un giorno guadagnato
 * sulla consegna.
 *
 * ⚠️ Chiediamo i NOMI dei programmi, mai le password o le chiavi. Le
 * credenziali si collegano dopo, dal pannello, e le collega il cliente col suo
 * account. Un'email con dentro una chiave API è una chiave che resta per
 * sempre in due caselle di posta.
 */
function GuidaEmail() {
  const punti = [
    {
      titolo: "I programmi che usate",
      dettaglio:
        "Scrivi i nomi: gestionale, fatturazione, magazzino, calendario, e-commerce. Anche «un foglio Excel» è una risposta utile.",
    },
    {
      titolo: "Cosa vorresti che facesse l'agente",
      dettaglio:
        "«Rispondere ai preventivi», «prendere prenotazioni», «dire dov'è un pacco». Una frase per ognuna.",
    },
    {
      titolo: "Chi risponde ai clienti oggi",
      dettaglio: "Tu, un dipendente, nessuno dopo le 19. Serve a capire cosa deve sostituire e cosa no.",
    },
    {
      titolo: "Il numero WhatsApp dell'azienda",
      dettaglio: "Quello su cui ti scrivono i clienti. Se non ne hai uno dedicato, dillo: se ne trova uno.",
    },
  ];

  return (
    <div className="mt-6 rounded-2xl border border-white/[0.08] bg-white/[0.022] p-5">
      <p className="text-[13.5px] font-medium text-white">Quando ci scrivi, mettici queste quattro cose</p>
      <p className="mt-1 text-[12.5px] leading-relaxed text-white/55">
        Ci fanno risparmiare due giorni di domande, e a te un paio di email.
      </p>

      <ol className="mt-4 space-y-3.5">
        {punti.map((p, i) => (
          <li key={p.titolo} className="flex gap-3">
            <span
              className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-medium"
              style={{ background: `rgba(${LUCE}, 0.14)`, color: `rgb(${LUCE})` }}
            >
              {i + 1}
            </span>
            <span>
              <span className="text-[13.5px] text-white/90">{p.titolo}</span>
              <span className="mt-0.5 block text-[12.5px] leading-relaxed text-white/50">{p.dettaglio}</span>
            </span>
          </li>
        ))}
      </ol>

      {/* ⚠️ Questa riga è di sostanza, non di cortesia: senza, qualcuno ci
          manderebbe davvero una chiave API per email. */}
      <p className="mt-4 border-t border-white/[0.07] pt-3 text-[12px] leading-relaxed text-white/45">
        Non mandarci password o chiavi: i collegamenti li fai tu dal pannello, col tuo
        account, dopo la consegna.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// TUTTE LE FUNZIONI
// ─────────────────────────────────────────────────────────────────────────

/**
 * ⚠️ QUI DENTRO CI VA SOLO QUELLO CHE FUNZIONA DAVVERO.
 *
 * È la regola più importante di questa sezione, e vale più di qualunque scelta
 * grafica. Ogni voce elencata è provata in produzione: se un imprenditore legge
 * «risponde al telefono» e poi scopre che non è vero, non ha trovato una
 * funzione mancante — ha scoperto che gli abbiamo mentito, e da lì non si
 * torna. Le cose in programma stanno nel percorso, non in vetrina.
 */
const FUNZIONI: { gruppo: string; voci: { nome: string; cosa: string }[] }[] = [
  {
    gruppo: "Come parla",
    voci: [
      { nome: "WhatsApp", cosa: "Risponde ai messaggi dei clienti sul numero della tua azienda, a tutte le ore." },
      { nome: "Vocali", cosa: "Ascolta i messaggi vocali e risponde a voce, con un tono naturale." },
      { nome: "Telefonate", cosa: "Risponde al telefono in tempo reale, come farebbe una segretaria." },
      { nome: "Foto e documenti", cosa: "Guarda la foto di uno scontrino o di una bolla e ne estrae i dati." },
      { nome: "Ogni lingua", cosa: "Risponde in cinese a chi scrive in cinese. Senza configurare niente." },
      { nome: "Anche sul sito", cosa: "La stessa memoria e gli stessi strumenti, nella chat del sito." },
    ],
  },
  {
    gruppo: "Cosa sa",
    voci: [
      { nome: "I tuoi documenti", cosa: "Listini, orari, regole, contratti: li legge e risponde con quelli." },
      { nome: "Le eccezioni", cosa: "«La veranda solo d'estate» la ricorda, e a gennaio dice no." },
      { nome: "Racconti a voce", cosa: "Gli spieghi l'attività parlando dieci minuti, e si configura da sé." },
      { nome: "Ricerca sul web", cosa: "Se la risposta non è nei tuoi documenti, la cerca e la porta." },
      { nome: "I tuoi programmi", cosa: "Legge i dati veri da gestionali e calendari, invece di indovinare." },
      { nome: "Memoria che dura", cosa: "«Al signor Rossi sconto 10% fisso» se lo ricorda fra sei mesi." },
    ],
  },
  {
    gruppo: "Chi lo controlla",
    voci: [
      { nome: "Modalità Ghost", cosa: "All'inizio non manda niente da solo: approvi tu, una risposta alla volta." },
      { nome: "Il controllore", cosa: "Ogni risposta passa un controllo. Uno sconto non autorizzato non parte." },
      { nome: "Passa a te", cosa: "Quando non sa, lo dice al cliente e la richiesta arriva sul tuo telefono." },
      { nome: "Riepilogo serale", cosa: "Ogni sera un messaggio con com'è andata la giornata." },
      { nome: "Coda intelligente", cosa: "Se qualcosa si guasta, i messaggi si mettono in fila e partono dopo." },
      { nome: "Dati separati", cosa: "Ogni azienda ha la sua memoria: nessun'altra la vede, lo garantisce il database." },
    ],
  },
];

function Funzioni() {
  return (
    <section id="funzioni" className="mt-24 sm:mt-32">
      <Compare>
        <p className="font-dato text-[11px] uppercase tracking-[0.12em]" style={{ color: `rgb(${LUCE})` }}>
          Tutto quello che fa
        </p>
        <h2 className="font-sezione mt-2 text-[clamp(1.9rem,6vw,3rem)] leading-[0.94]">
          Nessuna di queste
          <br />
          è in programma
        </h2>
        <p className="mt-3.5 max-w-[34rem] text-[14.5px] leading-relaxed text-white/55">
          Sono tutte provate e funzionanti oggi. Quello che stiamo ancora costruendo non
          lo trovi elencato qui: se te lo promettessimo e poi non ci fosse, non avresti
          scoperto una funzione mancante — avresti scoperto che ti abbiamo mentito.
        </p>
      </Compare>

      <div className="mt-11 space-y-11 sm:space-y-14">
        {FUNZIONI.map((g, gi) => (
          <Compare key={g.gruppo} ritardo={gi * 70}>
            <h3 className="font-dato text-[11px] uppercase tracking-[0.12em] text-white/45">
              {g.gruppo}
            </h3>
            {/* ⚠️ Una colonna sotto 640px. Due card affiancate su un telefono
                danno righe di quattro parole, e un testo che va a capo ogni
                quattro parole non si legge: si scorre e si salta. */}
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {g.voci.map((v) => (
                <div
                  key={v.nome}
                  className="card-funzione group relative overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.022] p-4 hover:border-white/[0.16] hover:bg-white/[0.04]"
                >
                  {/* Il filo di luce che attraversa il bordo di sopra al passaggio. */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                    style={{
                      background: `linear-gradient(90deg, transparent, rgb(${LUCE}), transparent)`,
                    }}
                  />
                  <p className="text-[14px] font-medium text-white">{v.nome}</p>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-white/55">{v.cosa}</p>
                </div>
              ))}
            </div>
          </Compare>
        ))}
      </div>

      <Compare>
        <p
          className="font-voce mt-14 border-l-2 pl-5 text-[19px] leading-snug text-white/80 sm:text-[22px]"
          style={{ borderColor: `rgba(${LUCE}, 0.5)` }}
        >
          Non c'è un'iscrizione e non c'è una prova da attivare da soli. Ogni azienda la
          prepariamo a mano, partendo dal suo mestiere.
        </p>
      </Compare>
    </section>
  );
}

function Piede() {
  const documenti = [
    { href: "/documentazione", testo: "Come funziona" },
    { href: "/privacy", testo: "Privacy" },
    { href: "/termini", testo: "Termini" },
    { href: "/cookie", testo: "Cookie" },
  ];

  return (
    <footer className="mt-24 border-t border-white/[0.07] pt-7">
      {/* ⚠️ In colonna sotto 640px: quattro link in fila su un telefono
          diventano bersagli piccoli e appiccicati, e si sbaglia quello che si
          tocca. In colonna hanno tutti la loro riga e il loro spazio. */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <Logo size={20} />
            <span className="text-[13.5px] font-medium text-white/85">CorpAgent</span>
          </div>
          <a
            href="mailto:corpagent7@gmail.com"
            className="font-dato mt-2 block cursor-pointer text-[11.5px] text-white/50 transition-colors hover:text-white"
          >
            corpagent7@gmail.com
          </a>
        </div>

        <nav className="flex flex-col gap-1 sm:flex-row sm:gap-5">
          {documenti.map((d) => (
            <a
              key={d.href}
              href={d.href}
              className="font-dato cursor-pointer py-1.5 text-[11px] uppercase tracking-[0.08em] text-white/50 transition-colors duration-200 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 sm:py-1"
            >
              {d.testo}
            </a>
          ))}
        </nav>
      </div>

      <p className="font-dato mt-8 text-[10.5px] uppercase leading-relaxed tracking-[0.08em] text-white/25">
        Nessun cookie di tracciamento · Caratteri ospitati da noi
      </p>
    </footer>
  );
}


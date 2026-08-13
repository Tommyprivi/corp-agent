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
/* ⚠️ Era il ciano neon "77, 225, 255" — IL colore dei siti fatti con l'IA.
   Dal 13 Agosto 2026 la luce della pagina è l'OTTONE della nuova palette:
   caldo, da officina, non da spaceship. */
const LUCE = "200, 155, 60";

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
  // Il ritorno dalla cassa di Stripe (quando ci sarà): ?ordine=fatto o
  // ?ordine=annullato. Senza questo, chi ha PAGATO atterrerebbe su una home
  // che non gli dice niente — trovato dalla verifica avversaria.
  const [esitoPagamento, setEsitoPagamento] = useState<"fatto" | "annullato" | null>(null);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("ordine");
    if (p === "fatto" || p === "annullato") {
      setEsitoPagamento(p);
      // Via il parametro dall'indirizzo: un refresh non deve rimostrarlo.
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  return (
    <div
      className="on-dark relative min-h-screen overflow-x-hidden bg-[#0B0A08] text-[#F2F0EB]"
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
        {esitoPagamento && (
          <div
            className="mt-4 flex items-start justify-between gap-3 rounded-lg border px-4 py-3"
            style={{ borderColor: `rgba(${LUCE}, 0.5)`, background: `rgba(${LUCE}, 0.07)` }}
          >
            <p className="text-[13.5px] leading-relaxed text-white/85">
              {esitoPagamento === "fatto"
                ? "Pagamento ricevuto ✓ — l'ordine è confermato. Ti scriviamo in giornata per partire con l'attivazione."
                : "Pagamento annullato. L'ordine resta registrato: se vuoi ti ricontattiamo noi, o riprova quando preferisci."}
            </p>
            <button
              onClick={() => setEsitoPagamento(null)}
              aria-label="Chiudi"
              className="cursor-pointer text-[16px] leading-none text-white/40 hover:text-white"
            >
              ×
            </button>
          </div>
        )}
        <Hero />
        {inviata ? (
          <ChatQualifica chiave={inviata.chiave} saluto={inviata.saluto} />
        ) : (
          <Form onFatto={setInviata} />
        )}
        <Funzioni />
        <Confronto />
        <Servizi />
        <Storia />
        <Cantiere />
        <Faq />
        <Piede />
        {/* ⚠️ DENTRO main, non fuori: main è uno stacking context (z-10) e un
            banner fratello a z-40 si dipingerebbe SOPRA il modal dell'ordine
            (che vive qui dentro, a z-50). Qui dentro l'ordine è giusto:
            modal sopra il banner. Trovato dalla verifica avversaria. */}
        <BannerCookie />
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// LO SFONDO
// ─────────────────────────────────────────────────────────────────────────

/**
 * Solo la griglia da carta millimetrata.
 *
 * ⚠️ I due aloni sfocati che «respiravano» sono stati TOLTI il 13 Agosto
 * 2026 — Tommaso: «lo stile sembra fatto con l'IA, troppo decorato». Il
 * bagliore radiale sfocato è il cliché numero uno dei siti generati. La
 * griglia resta: è disegno tecnico, non decorazione.
 */
function Bagliori() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
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

// ─────────────────────────────────────────────────────────────────────────
// I SERVIZI — quello che facciamo oltre agli agenti
// ─────────────────────────────────────────────────────────────────────────

/**
 * Voluta da Tommaso il 13 Agosto 2026, in due tempi: prima «voglio vendere
 * prodotti digitali oltre agli agenti IA», poi «si possono pagare
 * direttamente, senza fare la mail dove scrivi tutto».
 *
 * ⚠️ IL LISTINO VERO STA SUL SERVER (api/_lib/ordini.ts): il browser manda
 * solo l'id del servizio. Quello qui sotto è la copia da MOSTRARE — se i due
 * divergono, fa fede il server.
 *
 * ⚠️ L'offerta di lancio è una decisione commerciale di Tommaso: prezzo pieno
 * barrato, prezzo di lancio in grande. Il glow ottone sta SOLO qui, dove si
 * paga — chiesto esplicitamente: «per i pagamenti metti effetti glow».
 */
const LISTINO: {
  id: string;
  nome: string;
  cosa: string;
  pieno: string;
  lancio: string;
  evidenza?: boolean;
  /** Si può pagare in 3 rate mensili senza interessi (deciso il 13 Agosto). */
  rate?: boolean;
}[] = [
  {
    id: "agente",
    nome: "Agente IA su misura",
    cosa: "Un dipendente digitale preparato sul tuo mestiere: risponde a clienti e colleghi, 24 ore su 24.",
    pieno: "99 €/mese",
    lancio: "49 €/mese",
    evidenza: true,
  },
  {
    id: "area",
    rate: true,
    nome: "Area aziendale completa",
    cosa: "Postazioni per reparto, cruscotto coi numeri veri, accessi per il personale, report serale automatico.",
    pieno: "589 € avvio + 119 €/mese",
    lancio: "249 € avvio + 79 €/mese",
  },
  {
    id: "negozio",
    rate: true,
    nome: "Negozio online (Shopify)",
    cosa: "Apriamo e colleghiamo il tuo negozio: catalogo, ordini, magazzino — e l'agente che risponde ai clienti.",
    pieno: "999 €",
    lancio: "499 € una tantum",
  },
  {
    id: "sito",
    rate: true,
    nome: "Sito web professionale",
    cosa: "Vetrina veloce e sobria, fatta per farsi trovare e per vendere. Senza fronzoli.",
    pieno: "599 €",
    lancio: "299 € una tantum",
  },
  {
    id: "automazioni",
    nome: "Automazioni d'ufficio",
    cosa: "Le bolle entrano dallo scanner, le etichette escono col codice a barre, il report si scrive da solo.",
    pieno: "a preventivo",
    lancio: "consulenza gratuita",
  },
  {
    id: "collegamenti",
    rate: true,
    nome: "Collegamenti ai programmi",
    cosa: "Posta, fogli di calcolo, calendario, gestionali: CorpAgent legge e scrive dove lavori già.",
    pieno: "199 € l'uno",
    lancio: "99 € l'uno",
  },
];

function Servizi() {
  const [ordina, setOrdina] = useState<(typeof LISTINO)[number] | null>(null);

  return (
    <section id="servizi" className="mt-24 sm:mt-32">
      <Compare>
        <p className="font-dato text-[11px] uppercase tracking-[0.12em]" style={{ color: `rgb(${LUCE})` }}>
          I servizi · offerta di lancio
        </p>
        <h2 className="font-sezione mt-2 text-[clamp(1.9rem,6vw,3rem)] leading-[0.94]">
          Non solo agenti
        </h2>
        <p className="mt-3.5 max-w-[34rem] text-[14.5px] leading-relaxed text-white/55">
          Siamo appena partiti, e i primi clienti ci servono più dei margini: per
          le <span className="text-white">prime 10 aziende</span> i prezzi sono
          questi. Si ordina qui sotto in trenta secondi — niente form lungo, niente
          listino da chiedere via email.
        </p>
      </Compare>

      <div className="mt-9 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        {LISTINO.map((s, i) => (
          <Compare key={s.id} ritardo={i * 60} className={s.evidenza ? "glow-lancio rounded-xl" : undefined}>
            {/* ⚠️ Il glow sta sul CONTENITORE, la card opaca sopra: un ::before
                con z-index negativo si dipinge SOPRA lo sfondo del suo stesso
                elemento (ordine di pittura CSS), quindi sullo stesso div
                l'alone lavava tutta la faccia della card. Sul wrapper invece
                la card — figlia normale — lo copre al centro e l'alone resta
                solo sui bordi. Trovato dalla verifica avversaria. */}
            <div
              className={`flex h-full flex-col rounded-xl border p-5 ${
                s.evidenza ? "border-white/[0.16] bg-[#14120E]" : "border-white/[0.09] bg-white/[0.022]"
              }`}
            >
              {s.evidenza && (
                <p
                  className="font-dato mb-2 text-[10.5px] uppercase tracking-[0.1em]"
                  style={{ color: `rgb(${LUCE})` }}
                >
                  Il più richiesto
                </p>
              )}
              <p className="text-[15px] font-semibold text-white">{s.nome}</p>
              <p className="mt-1.5 flex-1 text-[13px] leading-relaxed text-white/55">{s.cosa}</p>
              <div className="mt-4 flex items-baseline gap-2.5">
                <span className="text-[12.5px] text-white/35 line-through">{s.pieno}</span>
                <span className="text-[17px] font-semibold" style={{ color: `rgb(${LUCE})` }}>
                  {s.lancio}
                </span>
              </div>
              {s.rate && (
                <p className="mt-1 text-[11.5px] text-white/45">
                  oppure in 3 rate mensili, senza interessi
                </p>
              )}
              <button
                onClick={() => setOrdina(s)}
                className="btn-grad mt-3.5 cursor-pointer rounded-lg py-2.5 text-[13.5px] font-medium"
              >
                {s.id === "automazioni" ? "Prenota la consulenza" : "Ordina adesso"}
              </button>
            </div>
          </Compare>
        ))}
      </div>

      <Compare>
        <p className="mt-6 text-[12px] leading-relaxed text-white/40">
          L'ordine registra la tua richiesta e ti ricontattiamo in giornata per
          attivazione e pagamento — nessun addebito automatico. L'offerta di
          lancio vale finché ci sono posti: i prezzi pieni sono quelli che
          troverai dopo.
        </p>
      </Compare>

      {ordina && <OrdineModal servizio={ordina} onChiudi={() => setOrdina(null)} />}
    </section>
  );
}

/**
 * Il mini-modulo dell'ordine: tre campi e via. È il contrario del form lungo
 * («senza fare la mail dove scrivi tutto»): azienda, email, telefono.
 * L'esca invisibile c'è anche qui, come nel form delle richieste.
 */
function OrdineModal({
  servizio,
  onChiudi,
}: {
  servizio: (typeof LISTINO)[number];
  onChiudi: () => void;
}) {
  const [d, setD] = useState({ azienda: "", email: "", telefono: "" });
  const [esca2, setEsca2] = useState("");
  const [rate, setRate] = useState(false);
  const [attesa, setAttesa] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [fatto, setFatto] = useState(false);

  // Escape chiude (ma non a metà invio: l'ordine partirebbe senza conferma).
  useEffect(() => {
    const giu = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !attesa) onChiudi();
    };
    window.addEventListener("keydown", giu);
    return () => window.removeEventListener("keydown", giu);
  }, [attesa, onChiudi]);

  async function invia() {
    setErrore(null);
    setAttesa(true);
    try {
      const r = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ordine: { servizio: servizio.id, ...d, rate, sito: esca2 } }),
      });
      const body = (await r.json()) as { ok?: boolean; paga?: string; errore?: string };
      if (!r.ok || !body.ok) throw new Error(body.errore ?? "Non è andata: riprova.");
      // Quando Stripe sarà configurato, da qui si va dritti alla cassa.
      if (body.paga) {
        window.location.href = body.paga;
        return;
      }
      setFatto(true);
    } catch (e) {
      setErrore(e instanceof Error ? e.message : String(e));
    } finally {
      setAttesa(false);
    }
  }

  const pieno = d.azienda.trim().length >= 2 && d.email.includes("@");
  const campo =
    "mt-1 w-full rounded-lg border border-white/15 bg-white/[0.04] px-3.5 py-2.5 text-[15px] text-white outline-none placeholder:text-white/25 focus:border-white/40";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      // ⚠️ mousedown sull'overlay stesso, non click: col click, selezionare il
      // testo di un campo e rilasciare fuori chiudeva il modal buttando via
      // quello che era stato scritto. E mai chiudere mentre l'invio è in
      // volo: l'ordine partirebbe senza che nessuno veda la conferma.
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !attesa) onChiudi();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Ordina ${servizio.nome}`}
        className="max-h-[90vh] w-full max-w-[420px] overflow-y-auto rounded-xl border border-white/12 bg-[#14120E] p-6"
      >
        {fatto ? (
          <>
            <p className="text-[17px] font-semibold text-white">Ordine registrato ✓</p>
            <p className="mt-2.5 text-[13.5px] leading-relaxed text-white/60">
              Ti scriviamo <span className="text-white">in giornata</span> a{" "}
              <span className="text-white">{d.email}</span> per attivazione e
              pagamento di <span className="text-white">{servizio.nome}</span> al
              prezzo di lancio ({servizio.lancio}
              {rate ? ", in 3 rate mensili senza interessi" : ""}). Nessun addebito
              parte da solo.
            </p>
            <button
              onClick={onChiudi}
              className="btn-grad mt-5 w-full cursor-pointer rounded-lg py-2.5 text-[13.5px] font-medium"
            >
              Chiudi
            </button>
          </>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <p className="text-[17px] font-semibold text-white">{servizio.nome}</p>
              <button
                onClick={onChiudi}
                disabled={attesa}
                aria-label="Chiudi"
                className="cursor-pointer rounded px-1.5 text-[18px] leading-none text-white/40 hover:text-white disabled:opacity-30"
              >
                ×
              </button>
            </div>
            <p className="mt-1 text-[13px] text-white/55">
              <span className="line-through opacity-60">{servizio.pieno}</span>{" "}
              <span style={{ color: `rgb(${LUCE})` }}>{servizio.lancio}</span> · offerta di lancio
            </p>
            {servizio.rate && (
              <div className="mt-3.5 space-y-1.5">
                {(
                  [
                    [false, "In un'unica soluzione", servizio.lancio],
                    [true, "In 3 rate mensili", "stesso prezzo, senza interessi"],
                  ] as const
                ).map(([val, nome, sotto]) => (
                  <label
                    key={String(val)}
                    className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 ${
                      rate === val ? "border-white/40 bg-white/[0.05]" : "border-white/12"
                    }`}
                  >
                    <input
                      type="radio"
                      name="pagamento"
                      checked={rate === val}
                      onChange={() => setRate(val)}
                      className="accent-[#C89B3C]"
                    />
                    <span className="text-[13px] text-white">{nome}</span>
                    <span className="ml-auto text-[11.5px] text-white/45">{sotto}</span>
                  </label>
                ))}
              </div>
            )}
            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="text-[12px] text-white/50">Nome dell'azienda</span>
                <input value={d.azienda} onChange={(e) => setD({ ...d, azienda: e.target.value })} className={campo} />
              </label>
              <label className="block">
                <span className="text-[12px] text-white/50">Email</span>
                <input type="email" value={d.email} onChange={(e) => setD({ ...d, email: e.target.value })} className={campo} />
              </label>
              <label className="block">
                <span className="text-[12px] text-white/50">Telefono (facoltativo)</span>
                <input type="tel" value={d.telefono} onChange={(e) => setD({ ...d, telefono: e.target.value })} className={campo} />
              </label>
              {/* L'esca: invisibile alle persone, irresistibile per i programmi. */}
              <input
                type="text"
                value={esca2}
                onChange={(e) => setEsca2(e.target.value)}
                tabIndex={-1}
                autoComplete="off"
                aria-hidden
                className="absolute -left-[9999px] h-0 w-0 opacity-0"
              />
            </div>
            {errore && <p className="mt-3 text-[12.5px] text-[#ff9d8f]">{errore}</p>}
            <button
              onClick={() => void invia()}
              disabled={!pieno || attesa}
              className="btn-grad mt-4 w-full cursor-pointer rounded-lg py-2.5 text-[13.5px] font-medium disabled:opacity-40"
            >
              {attesa ? "Invio…" : "Conferma l'ordine"}
            </button>
            <p className="mt-2.5 text-[11px] leading-relaxed text-white/35">
              Registriamo l'ordine e ti ricontattiamo per attivazione e pagamento.
              Dati trattati come da <a href="/privacy" className="underline">privacy</a>.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// IL CONFRONTO — il problema dell'azienda, prima e dopo
// ─────────────────────────────────────────────────────────────────────────

/**
 * Chiesto da Tommaso il 13 Agosto 2026: «fai un confronto tra i servizi e il
 * problema dell'azienda, quella che fa Speed». Le righe vengono dal cantiere
 * VERO: sono i problemi trovati al sopralluogo in un'azienda di trasporti,
 * non esempi inventati. Chi legge si riconosce riga per riga.
 */
const CONFRONTO: { problema: string; dopo: string; servizio: string }[] = [
  {
    problema: "Le bolle arrivano di carta e qualcuno le ricopia a mano nel gestionale.",
    dopo: "La multifunzione le scannerizza ed entrano da sole, già leggibili.",
    servizio: "Automazioni",
  },
  {
    problema: "«Dov'è il mio carico?» — e in ufficio parte la caccia al telefono.",
    dopo: "Risponde l'agente, con lo stato vero, anche alle otto di sera.",
    servizio: "Agente IA",
  },
  {
    problema: "Le etichette dei colli si scrivono a penna, e qualcuna si perde.",
    dopo: "Si stampano col codice a barre e il palmare le rilegge in banchina.",
    servizio: "Automazioni",
  },
  {
    problema: "Il titolare sa com'è andata solo se qualcuno si ricorda di dirglielo.",
    dopo: "Alle otto di sera il report della giornata è già scritto, da solo.",
    servizio: "Area aziendale",
  },
  {
    problema: "Ogni reparto ha i suoi fogli, e nessuno vede il quadro insieme.",
    dopo: "Una postazione per reparto e un cruscotto solo, coi numeri veri.",
    servizio: "Area aziendale",
  },
  {
    problema: "I clienti scrivono su tre canali e qualcosa resta senza risposta.",
    dopo: "L'agente legge la casella e niente cade per terra.",
    servizio: "Collegamenti",
  },
];

function Confronto() {
  return (
    <section className="mt-24 sm:mt-32">
      <Compare>
        <p className="font-dato text-[11px] uppercase tracking-[0.12em]" style={{ color: `rgb(${LUCE})` }}>
          Prima e dopo
        </p>
        <h2 className="font-sezione mt-2 text-[clamp(1.9rem,6vw,3rem)] leading-[0.94]">
          Il tuo problema,
          <br />
          probabilmente, è qui
        </h2>
        <p className="mt-3.5 max-w-[34rem] text-[14.5px] leading-relaxed text-white/55">
          Queste righe vengono da un'azienda vera — trasporti, Torino, 150
          persone — dove stiamo costruendo adesso. Non sono esempi da manuale:
          sono quello che abbiamo trovato entrando in ufficio.
        </p>
      </Compare>

      <Compare>
        <div className="mt-9 overflow-x-auto">
          <div className="min-w-[640px] border-t border-white/[0.08]">
            <div className="grid grid-cols-[1fr_1fr_130px] gap-4 border-b border-white/[0.08] py-2.5">
              <p className="font-dato text-[10.5px] uppercase tracking-[0.1em] text-white/40">Oggi, senza</p>
              <p className="font-dato text-[10.5px] uppercase tracking-[0.1em]" style={{ color: `rgb(${LUCE})` }}>
                Con CorpAgent
              </p>
              <p className="font-dato text-[10.5px] uppercase tracking-[0.1em] text-white/40">Servizio</p>
            </div>
            {CONFRONTO.map((r) => (
              <div key={r.problema} className="grid grid-cols-[1fr_1fr_130px] gap-4 border-b border-white/[0.08] py-3.5">
                <p className="text-[13px] leading-relaxed text-white/55">{r.problema}</p>
                <p className="text-[13px] leading-relaxed text-white">{r.dopo}</p>
                <p className="text-[12px] text-white/45">{r.servizio}</p>
              </div>
            ))}
          </div>
        </div>
      </Compare>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// LA STORIA — chi c'è dietro, senza gonfiarla
// ─────────────────────────────────────────────────────────────────────────

function Storia() {
  return (
    <section className="mt-24 sm:mt-32">
      <Compare>
        <p className="font-dato text-[11px] uppercase tracking-[0.12em]" style={{ color: `rgb(${LUCE})` }}>
          La storia
        </p>
        <h2 className="font-sezione mt-2 text-[clamp(1.9rem,6vw,3rem)] leading-[0.94]">
          Nata in un'azienda vera
        </h2>
        <div className="mt-5 max-w-[38rem] space-y-4 text-[14.5px] leading-relaxed text-white/60">
          <p>
            CorpAgent nasce nel 2026 da una domanda semplice: perché in
            un'azienda che lavora bene c'è ancora qualcuno che ricopia bolle a
            mano, rincorre telefonate e a fine giornata non sa dire com'è andata?
          </p>
          <p>
            Il primo cantiere non è stato un cliente qualsiasi: è un'azienda di
            trasporti di Torino che lavora dal 1998, con centocinquanta persone
            tra uffici, banchina e strada. Lì dentro abbiamo imparato la regola
            che ci portiamo su ogni lavoro:{" "}
            <span className="text-white">
              il software si costruisce dentro l'azienda, non davanti a un catalogo
            </span>
            . Prima il sopralluogo, poi il codice.
          </p>
          <p>
            Per questo non troverai demo gonfiate né funzioni «in arrivo»
            spacciate per pronte: quello che c'è scritto in questa pagina esiste,
            e quello che non esiste non c'è scritto.
          </p>
        </div>
      </Compare>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// IL PRIMO CANTIERE — le recensioni si guadagnano, non si scrivono
// ─────────────────────────────────────────────────────────────────────────

/**
 * ⚠️ Tommaso ha chiesto «recensioni». Le recensioni INVENTATE non entrano qui:
 * su una pagina che promette «se te lo promettessimo e non ci fosse, avresti
 * scoperto che ti abbiamo mentito», cinque clienti finti sarebbero la
 * smentita di tutto il resto (oltre a essere una pratica scorretta per legge).
 * Quello che abbiamo di vero è il primo cantiere: si racconta quello, coi
 * fatti. Le recensioni vere prenderanno questo posto man mano che arrivano.
 */
function Cantiere() {
  const fatti = [
    { cosa: "Postazioni attive", num: "4", sotto: "traffico, magazzino, autisti, amministrazione" },
    { cosa: "Scanner collegati", num: "sì", sotto: "i palmari di banchina mandano le letture da soli" },
    { cosa: "Etichette col barcode", num: "sì", sotto: "stampate da CorpAgent, rilette dai palmari" },
    { cosa: "Report serale", num: "sì", sotto: "il punto della giornata si scrive da solo, ogni sera" },
  ];
  return (
    <section className="mt-24 sm:mt-32">
      <Compare>
        <p className="font-dato text-[11px] uppercase tracking-[0.12em]" style={{ color: `rgb(${LUCE})` }}>
          Il primo cantiere
        </p>
        <h2 className="font-sezione mt-2 text-[clamp(1.9rem,6vw,3rem)] leading-[0.94]">
          Trasporti, Torino,
          <br />
          150 persone
        </h2>
        <p className="mt-3.5 max-w-[34rem] text-[14.5px] leading-relaxed text-white/55">
          Un'azienda che spedisce dal 1998, col suo gestionale storico e le sue
          abitudini. Non gliele abbiamo cambiate: ci siamo collegati.
        </p>
      </Compare>

      <Compare>
        <div className="mt-9 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {fatti.map((f) => (
            <div key={f.cosa} className="rounded-xl border border-white/[0.09] bg-white/[0.022] p-4">
              <p className="font-dato text-[22px]" style={{ color: `rgb(${LUCE})` }}>
                {f.num}
              </p>
              <p className="mt-1 text-[13.5px] font-medium text-white">{f.cosa}</p>
              <p className="mt-1 text-[12px] leading-relaxed text-white/50">{f.sotto}</p>
            </div>
          ))}
        </div>
      </Compare>

      <Compare>
        <p className="mt-6 text-[12px] leading-relaxed text-white/40">
          Le recensioni dei clienti compariranno qui, con nome e cognome, man mano
          che i cantieri si chiudono. Non ne scriveremo nemmeno una al posto loro.
        </p>
      </Compare>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// LE DOMANDE — quelle che fanno davvero, con le risposte vere
// ─────────────────────────────────────────────────────────────────────────

const DOMANDE: { d: string; r: string }[] = [
  {
    d: "Quanto ci vuole per partire?",
    r: "Un agente semplice risponde in pochi giorni. Un'area aziendale completa dipende da quanti reparti e collegamenti servono: al sopralluogo (o alla prima chiamata) ti diamo una data, e quella resta.",
  },
  {
    d: "Devo cambiare il gestionale che uso?",
    r: "No. Ci colleghiamo a quello che c'è — posta, fogli, scanner, gestionali — e dove un collegamento non esiste ancora, te lo diciamo chiaro invece di fingere che ci sia.",
  },
  {
    d: "E se l'agente sbaglia con un cliente?",
    r: "All'inizio lavora in modalità Ghost: prepara le risposte e le approvi tu, una per una, finché non ti fidi. E ogni risposta passa un controllo che blocca sconti non autorizzati e promesse fuori listino.",
  },
  {
    d: "I miei dati dove stanno?",
    r: "In un database PostgreSQL in Europa (Francoforte), separato per azienda: la tua memoria non la vede nessun altro cliente, e lo garantisce il database stesso, non una promessa. I dettagli sono nella pagina privacy.",
  },
  {
    d: "I miei documenti finiscono ad addestrare qualche IA?",
    r: "No. Usiamo i modelli tramite le loro API commerciali, i cui termini prevedono che i dati inviati non vengano usati per addestrarli — e non attiviamo nessuna opzione di condivisione. I tuoi listini restano tuoi.",
  },
  {
    d: "Il personale deve imparare un programma nuovo?",
    r: "Quasi niente: si apre una pagina e si parla con l'agente, o si preme un tasto grosso. Chi usa già un gestionale ci mette mezza giornata a sentirsi a casa.",
  },
  {
    d: "Posso disdire?",
    r: "Sì, con una email e il preavviso scritto nei termini. Niente vincoli pluriennali nascosti: se non ti facciamo risparmiare tempo, è giusto che tu vada.",
  },
  {
    d: "Perché i prezzi di lancio sono così bassi?",
    r: "Perché siamo all'inizio e i primi cantieri ci servono più dei margini: ogni azienda vera ci insegna qualcosa che nessuna demo può insegnare. Quando i posti finiscono, restano i prezzi pieni.",
  },
];

function Faq() {
  return (
    <section className="mt-24 sm:mt-32">
      <Compare>
        <p className="font-dato text-[11px] uppercase tracking-[0.12em]" style={{ color: `rgb(${LUCE})` }}>
          Le domande
        </p>
        <h2 className="font-sezione mt-2 text-[clamp(1.9rem,6vw,3rem)] leading-[0.94]">
          Quello che chiedono tutti
        </h2>
      </Compare>

      <Compare>
        <div className="mt-8 max-w-[44rem] border-t border-white/[0.08]">
          {DOMANDE.map((f) => (
            <details key={f.d} className="group border-b border-white/[0.08]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-[14.5px] font-medium text-white/85 hover:text-white [&::-webkit-details-marker]:hidden">
                {f.d}
                <span aria-hidden className="shrink-0 text-white/40 transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="pb-4 pr-8 text-[13.5px] leading-relaxed text-white/55">{f.r}</p>
            </details>
          ))}
        </div>
      </Compare>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// IL BANNER DEI COOKIE — onesto: qui non c'è tracciamento
// ─────────────────────────────────────────────────────────────────────────

/**
 * Chiesto da Tommaso («aggiungi i cookies»). La verità tecnica: questo sito
 * non ha cookie di profilazione — solo memoria tecnica (tema, sessione,
 * questa presa visione). Il banner lo DICE, invece di fingere un consenso
 * complicato che non serve. Si mostra una volta; la scelta vive in
 * localStorage.
 */
function BannerCookie() {
  const [visibile, setVisibile] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem("cookie-visto")) setVisibile(true);
    } catch {
      /* localStorage bloccato: pazienza, niente banner */
    }
  }, []);

  if (!visibile) return null;

  function chiudi() {
    try {
      localStorage.setItem("cookie-visto", new Date().toISOString());
    } catch {
      /* idem */
    }
    setVisibile(false);
  }

  return (
    <>
      {/* Lo spaziatore: finché la barra è visibile, il fondo pagina non deve
          restarle nascosto sotto (su telefono la barra è alta due righe). */}
      <div aria-hidden className="h-28 sm:h-16" />
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/12 bg-[#14120E] px-5 py-3.5">
        <div className="mx-auto flex max-w-[1100px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[12.5px] leading-relaxed text-white/60">
            Questo sito non usa cookie di tracciamento: solo memoria tecnica per il
            tema e la tua sessione.{" "}
            <a href="/cookie" className="underline underline-offset-2 hover:text-white">
              Come funziona
            </a>
          </p>
          <button
            onClick={chiudi}
            className="btn-grad shrink-0 cursor-pointer rounded-lg px-5 py-2 text-[12.5px] font-medium"
          >
            Ho capito
          </button>
        </div>
      </div>
    </>
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


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
const COPIONE: { chi: "cliente" | "agente"; testo: string; nota?: string }[] = [
  { chi: "cliente", testo: "Buongiorno, quanto per un pallet da Catania a Milano?" },
  { chi: "agente", testo: "Sono 968 km, circa 10 ore. Mi dice il peso e se serve la sponda idraulica?" },
  { chi: "cliente", testo: "300 kg, sponda no" },
  { chi: "agente", testo: "Perfetto. Le mando il preventivo entro stasera. A che nome lo intesto?" },
  { chi: "cliente", testo: "Però mi fate il 30% di sconto?" },
  {
    chi: "agente",
    testo: "Su questo decide il titolare: gli passo la richiesta adesso e la richiamo entro stasera.",
    nota: "titolare avvisato",
  },
];

export default function Richiesta() {
  const [inviata, setInviata] = useState<{ chiave: string; saluto: string } | null>(null);

  // Il gettone di Cloudflare, che arriva dal widget invisibile.
  const [gettone, setGettone] = useState<string>("");

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
        <span className="text-[12.5px] text-white/40">Su invito</span>
      </header>

      <main className="relative z-10 mx-auto max-w-[1100px] px-5 pb-20 sm:px-6 sm:pb-24">
        <Hero />
        {inviata ? (
          <ChatQualifica chiave={inviata.chiave} saluto={inviata.saluto} />
        ) : (
          <Form gettone={gettone} onGettone={setGettone} onFatto={setInviata} />
        )}
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
        className="absolute -top-40 left-1/2 h-[560px] w-[900px] -translate-x-1/2 rounded-full blur-[120px]"
        style={{ background: `radial-gradient(closest-side, rgba(${LUCE}, 0.16), transparent)` }}
      />
      <div
        className="absolute top-[45%] -right-40 h-[420px] w-[620px] rounded-full blur-[130px]"
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
        <Entrando>
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
            Lavoriamo con poche aziende alla volta
          </p>
        </Entrando>

        <Entrando ritardo={80}>
          <h1 className="text-[clamp(2.4rem,5.5vw,3.9rem)] font-semibold leading-[1.04] tracking-[-0.035em]">
            Sei un&apos;azienda?
          </h1>
        </Entrando>

        <Entrando ritardo={160}>
          <p className="mt-5 max-w-[30rem] text-[17px] leading-relaxed text-white/60">
            I tuoi clienti ti scrivono su WhatsApp a tutte le ore. Risponde un agente che
            conosce i tuoi prezzi, i tuoi orari e le tue regole — e che quando non sa,
            lo dice e chiama te.
          </p>
        </Entrando>

        <Entrando ritardo={240}>
          <div className="mt-8 flex flex-wrap gap-x-7 gap-y-2 text-[13px] text-white/40">
            <span>Risponde in 2 secondi</span>
            <span>·</span>
            <span>Legge foto e vocali</span>
            <span>·</span>
            <span>Risponde al telefono</span>
          </div>
        </Entrando>
      </div>

      <Entrando ritardo={320}>
        <ChatFinta />
      </Entrando>
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
        <span className="text-[12.5px] text-white/45">Speed Trasporti · WhatsApp</span>
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
                className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/35"
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

function Form({
  gettone,
  onGettone,
  onFatto,
}: {
  gettone: string;
  onGettone: (g: string) => void;
  onFatto: (v: { chiave: string; saluto: string }) => void;
}) {
  const [d, setD] = useState({ azienda: "", settore: "", telefono: "", email: "", esigenza: "" });
  const [accetto, setAccetto] = useState(false);
  const [attesa, setAttesa] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const turnstileRef = useRef<HTMLDivElement>(null);

  // Turnstile invisibile: si carica solo qui, non su tutta l'app.
  useEffect(() => {
    const chiave = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) ?? "";
    if (!chiave || !turnstileRef.current) return;

    const monta = () => {
      const t = (window as unknown as { turnstile?: { render: (el: HTMLElement, o: unknown) => void } }).turnstile;
      if (!t || !turnstileRef.current) return;
      t.render(turnstileRef.current, { sitekey: chiave, callback: onGettone, theme: "dark", size: "flexible" });
    };

    if ((window as unknown as { turnstile?: unknown }).turnstile) return monta();
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.onload = monta;
    document.head.appendChild(s);
  }, [onGettone]);

  async function invia() {
    setErrore(null);
    setAttesa(true);
    try {
      const r = await creaRichiesta({ ...d, gettone });
      suonoFatto();
      onFatto(r);
    } catch (e) {
      suonoErrore();
      setErrore(e instanceof Error ? e.message : String(e));
    } finally {
      setAttesa(false);
    }
  }

  const pieno = Object.values(d).every((v) => v.trim()) && accetto;

  return (
    <Entrando ritardo={400}>
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

        <div ref={turnstileRef} className="mt-5" />

        <label className="mt-5 flex cursor-pointer items-start gap-3 text-[13px] leading-relaxed text-white/55">
          <input
            type="checkbox"
            checked={accetto}
            onChange={(e) => {
              setAccetto(e.target.checked);
              suonoClick();
            }}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/25 bg-transparent"
            style={{ accentColor: `rgb(${LUCE})` }}
          />
          <span>
            Ho letto l&apos;
            <a href="/privacy" className="underline underline-offset-2 hover:text-white">
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

        <button
          onClick={() => {
            suonoClick();
            void invia();
          }}
          onMouseEnter={suonoSfiora}
          disabled={!pieno || attesa}
          className="mt-6 w-full rounded-xl px-5 py-4 text-[15.5px] font-medium text-[#04252c] transition-all active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-35 sm:py-3.5 sm:text-[15px]"
          style={{
            background: `linear-gradient(180deg, rgb(${LUCE}), rgba(${LUCE},0.82))`,
            boxShadow: pieno && !attesa ? `0 0 40px rgba(${LUCE}, 0.32)` : "none",
          }}
        >
          {attesa ? "Invio…" : "Invia la richiesta"}
        </button>

        <p className="mt-3 text-center text-[12px] text-white/30">
          Non ti iscriviamo a niente. Ti scriviamo da corpagent7@gmail.com.
        </p>
      </section>
    </Entrando>
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
  const classi =
    "mt-1.5 w-full rounded-xl border px-3.5 py-3 text-[16px] text-white outline-none transition-all placeholder:text-white/25 sm:py-2.5 sm:text-[14.5px]";

  return (
    <label className="block">
      <span className="text-[12.5px] text-white/45">{etichetta}</span>
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
    <Entrando>
      <section className="mx-auto max-w-[620px] pt-4 sm:pt-8">
        <div
          className="rounded-2xl border p-4 sm:p-5"
          style={{
            borderColor: `rgba(${LUCE}, 0.22)`,
            background: "rgba(255,255,255,0.028)",
            boxShadow: `0 0 70px rgba(${LUCE}, 0.10)`,
          }}
        >
          <p className="mb-4 border-b border-white/[0.07] pb-3 text-[13px] text-white/45">
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
                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/35"
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
              className="min-w-0 flex-1 rounded-xl border px-3.5 py-3 text-[16px] text-white outline-none placeholder:text-white/25 sm:py-2.5 sm:text-[14.5px]"
              style={{ borderColor: "rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.028)" }}
            />
            <button
              onClick={() => void manda()}
              onMouseEnter={suonoSfiora}
              disabled={!testo.trim() || attesa}
              className="shrink-0 rounded-xl px-4 text-[14px] font-medium text-[#04252c] transition-all active:scale-95 disabled:opacity-30"
              style={{ background: `rgb(${LUCE})` }}
            >
              Invia
            </button>
          </div>
        </div>

        <p className="mt-5 text-center text-[13px] text-white/45">
          Per qualsiasi cosa:{" "}
          <a href="mailto:corpagent7@gmail.com" className="text-white underline underline-offset-2">
            corpagent7@gmail.com
          </a>
        </p>
        <p className="mt-2 text-center text-[12px] text-white/25">
          Segui la tua richiesta:{" "}
          <a href={`/richiesta/${chiave}`} className="underline underline-offset-2">
            salva questo link
          </a>
        </p>
      </section>
    </Entrando>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// PEZZI COMUNI
// ─────────────────────────────────────────────────────────────────────────

function Piede() {
  return (
    <footer className="mt-24 border-t border-white/[0.07] pt-7 text-[12.5px] text-white/30">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span>CorpAgent · corpagent7@gmail.com</span>
        <a href="/privacy" className="hover:text-white/60">
          Privacy
        </a>
      </div>
    </footer>
  );
}

/**
 * Entra salendo di otto pixel, con un ritardo.
 *
 * ⚠️ Otto pixel e 500 ms: sopra questi numeri il movimento si nota **come
 * movimento**, e da lì in poi non sembra più costoso, sembra un sito che si
 * mette in mostra. Chi ha chiesto meno movimento non lo vede affatto.
 */
function Entrando({ children, ritardo = 0 }: { children: React.ReactNode; ritardo?: number }) {
  const [dentro, setDentro] = useState(false);
  useEffect(() => {
    const calmo = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (calmo) return setDentro(true);
    const t = window.setTimeout(() => setDentro(true), ritardo);
    return () => clearTimeout(t);
  }, [ritardo]);

  return (
    <div
      style={{
        opacity: dentro ? 1 : 0,
        transform: dentro ? "translateY(0)" : "translateY(8px)",
        transition: "opacity 500ms cubic-bezier(.16,1,.3,1), transform 500ms cubic-bezier(.16,1,.3,1)",
      }}
    >
      {children}
    </div>
  );
}

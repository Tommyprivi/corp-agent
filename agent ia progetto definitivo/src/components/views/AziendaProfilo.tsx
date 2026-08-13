import { useRef, useState } from "react";
import { MARCHI } from "../../lib/marchio";
import { manda, salvaGettone, type PersonaViva } from "../../lib/azienda";

/**
 * L'ingresso in un'azienda cliente, e la creazione del proprio profilo.
 *
 * Voluto da Tommaso l'11 agosto 2026: *«all'inizio ci sarà l'accesso, che però
 * si salva, e devi creare il tuo account per nome e ruolo, foto ecc. E in base
 * al ruolo cambia la schermata»*.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * DUE SCHERMATE, E UNA SOLA VOLTA NELLA VITA
 * ─────────────────────────────────────────────────────────────────────────
 * 1. **Entra** — email e password, e la sessione resta. Su 150 persone, un
 *    accesso da rifare ogni giorno è la ragione numero uno per cui uno smette
 *    di usare un programma.
 * 2. **Chi sei** — nome, ruolo, reparto, foto. Si compila **una volta sola**,
 *    al primo ingresso, e da lì in poi non si rivede mai più.
 *
 * ⚠️ Il ruolo lo sceglie la persona, ma **è una dichiarazione, non un
 * permesso**: chi si dichiara titolare non diventa titolare. Il ruolo vero lo
 * assegna Salvatore dall'elenco delle persone, e finché non lo conferma la
 * postazione resta da operatore. Lasciare che uno si auto-assegni i permessi
 * sarebbe la falla più grossa di tutto il sistema — e la più facile da fare per
 * distrazione. La difesa non è qui: è sul server, in `api/config.ts`.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ⚠️ NON C'È UNA SCHERMATA DI REGISTRAZIONE, ED È VOLUTO
 * ─────────────────────────────────────────────────────────────────────────
 * Chi mette un'email che il sistema non conosce **si apre la postazione in quel
 * momento**. Salvatore apre il link, scrive la sua email, ed è dentro con tutti
 * i permessi senza che nessuno debba toccare il database: il primo che entra in
 * un'azienda è il titolare, tutti gli altri sono operatori.
 *
 * Il rovescio va detto: oggi chiunque conosca il link può aprirsi una
 * postazione da operatore. Va bene per una beta con un'azienda sola e un link
 * che non è scritto da nessuna parte; prima delle 150 persone vere serve
 * l'invito su elenco chiuso.
 */

export interface ProfiloAziendale {
  nome: string;
  ruolo: Ruolo;
  reparto: string;
  foto: string | null;
}

export type Ruolo = "titolare" | "amministratore" | "capo" | "operatore" | "osservatore";

export const RUOLI: { id: Ruolo; nome: string; cosa: string }[] = [
  { id: "titolare", nome: "Titolare", cosa: "Vedo tutto e decido tutto" },
  { id: "amministratore", nome: "Amministrazione", cosa: "Fatture, solleciti, fornitori" },
  { id: "capo", nome: "Capo reparto", cosa: "Guido una squadra" },
  { id: "operatore", nome: "Operatore", cosa: "Traffico, magazzino, guida" },
  { id: "osservatore", nome: "Solo consultazione", cosa: "Guardo, non tocco" },
];

const REPARTI = ["Traffico", "Magazzino", "Autisti", "Amministrazione", "Direzione"];

export default function AziendaProfilo({
  marchio = "speed",
  onFatto,
}: {
  marchio?: string;
  onFatto: (p: PersonaViva) => void;
}) {
  const m = MARCHI[marchio];
  const [passo, setPasso] = useState<"entra" | "chisei">("entra");

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg-app)] text-[var(--text-primary)]">
      {/* ⚠️ Il marchio è in cima PRIMA di entrare, non dopo: è il momento in
          cui si decide se questo sembra «un software che abbiamo comprato»
          oppure «il nostro sistema». Costa una riga e cambia tutto. */}
      <header className="flex items-center justify-center px-5 pt-10 pb-2">
        {/* ⚠️ Grande, in alto, prima ancora di entrare: è il momento in cui si
            decide se questo sembra «un software che abbiamo comprato» oppure
            «il nostro sistema». Costa una riga e cambia tutto. */}
        {m?.logo ? (
          <img src={m.logo} alt={m.nome} width={887} height={375} className="h-16 w-auto sm:h-20" />
        ) : (
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="h-9 w-9 rounded-full"
              style={{
                background:
                  "conic-gradient(from 210deg, var(--marchio-secondario), var(--marchio-primario), var(--marchio-secondario))",
              }}
            />
            <span>
              <span className="block text-[16px] font-semibold tracking-[-0.01em]">{m?.nome}</span>
              <span className="block text-[10.5px] uppercase tracking-[0.1em] text-[var(--text-secondary)]">
                Logistic Solution
              </span>
            </span>
          </div>
        )}
      </header>

      <main className="flex flex-1 items-center justify-center px-5 py-8">
        {passo === "entra" ? (
          <Entra
            azienda={marchio}
            onDentro={(p) => {
              // ⚠️ Chi ha già un nome non rivede mai più «Chi sei». Rifare la
              // scheda a ogni accesso è il modo più veloce per far chiudere
              // l'app a qualcuno che l'aveva già compilata.
              if (p.nome.trim()) onFatto(p);
              else setPasso("chisei");
            }}
          />
        ) : (
          <ChiSei onFatto={onFatto} />
        )}
      </main>

      <footer className="px-5 pb-6 text-center text-[11px] text-[var(--text-secondary)]">
        con tecnologia CorpAgent
      </footer>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 1 · ENTRA
// ─────────────────────────────────────────────────────────────────────────

function Entra({
  azienda,
  onDentro,
}: {
  azienda: string;
  onDentro: (p: PersonaViva) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errore, setErrore] = useState<string | null>(null);
  const [inCorso, setInCorso] = useState(false);

  async function prova() {
    setInCorso(true);
    setErrore(null);
    try {
      const r = await manda<{ t: string; persona: PersonaViva }>({
        az: "entra",
        azienda,
        email: email.trim(),
        password,
      });
      salvaGettone(r.t);
      onDentro(r.persona);
    } catch (e) {
      setErrore(e instanceof Error ? e.message : "Non riesco a entrare.");
      setInCorso(false);
    }
  }

  return (
    <form
      className="w-full max-w-[380px]"
      onSubmit={(e) => {
        e.preventDefault();
        if (!inCorso) void prova();
      }}
    >
      <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Entra</h1>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-[var(--text-secondary)]">
        Una volta sola: il telefono ti riconosce e non te lo richiede più.
      </p>

      {/* ⚠️ Accesso riservato: si entra SOLO se il titolare ti ha invitato.
          Un estraneo che conosce il link non passa (lo garantisce il server,
          non questo avviso), e la scritta lo dice chiaro. */}
      <div
        className="mt-4 flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5"
        style={{ borderColor: "var(--border)", background: "var(--fill-quiet)" }}
      >
        <span className="mt-0.5 shrink-0" aria-hidden>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="4" y="10" width="16" height="10" rx="2" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
          </svg>
        </span>
        <span className="text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
          <span className="font-medium text-[var(--text-primary)]">Accesso riservato ai membri di Speed Trasporti.</span>{" "}
          Entra solo chi è stato invitato in ufficio. I dati viaggiano cifrati e
          i documenti sono protetti.
        </span>
      </div>

      <div className="mt-6 space-y-2.5">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="La tua email"
          autoComplete="email"
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3.5 py-3 text-[16px] outline-none focus:border-[var(--accent)] sm:text-[14.5px]"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoComplete="current-password"
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3.5 py-3 text-[16px] outline-none focus:border-[var(--accent)] sm:text-[14.5px]"
        />
      </div>

      {/* ⚠️ L'errore sta SOPRA il pulsante, non sotto: chi ha appena premuto
          guarda il pulsante, e un messaggio sotto al piede della schermata su
          un telefono finisce fuori dallo schermo. */}
      {errore && (
        <p
          role="alert"
          className="mt-3 rounded-lg border-l-2 bg-[var(--fill-quiet)] px-3 py-2 text-[12.5px] leading-relaxed"
          style={{ borderColor: "var(--marchio-secondario)" }}
        >
          {errore}
        </p>
      )}

      <button
        type="submit"
        disabled={!email.trim() || password.length < 4 || inCorso}
        className="btn-grad mt-4 w-full cursor-pointer rounded-xl py-3.5 text-[15px] font-medium disabled:opacity-40"
      >
        {inCorso ? "Un attimo…" : "Entra"}
      </button>

      {/* ⚠️ «Resta collegato» non è una casella da spuntare: è il
          comportamento normale. Un magazziniere che deve rifare l'accesso ogni
          mattina coi guanti addosso smette di usarlo entro la settimana. */}
      <p className="mt-3.5 text-center text-[12px] leading-relaxed text-[var(--text-secondary)]">
        Resti collegato su questo telefono per tre mesi.
        <br />
        Entri con l'email che ti hanno invitato in ufficio.
      </p>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 2 · CHI SEI
// ─────────────────────────────────────────────────────────────────────────

function ChiSei({ onFatto }: { onFatto: (p: PersonaViva) => void }) {
  const [nome, setNome] = useState("");
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [ruolo, setRuolo] = useState<Ruolo>("operatore");
  const [reparto, setReparto] = useState("Traffico");
  const [foto, setFoto] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  /**
   * La foto viene rimpicciolita **nel browser** prima di partire.
   *
   * ⚠️ Non è ottimizzazione: una foto scattata col telefono pesa 3-5 MB, e 150
   * persone che ne caricano una fanno mezzo gigabyte di ritratti in un
   * database che serve a rispondere ai clienti. A 256 pixel una faccia si
   * riconosce benissimo e pesa quanto un messaggio.
   */
  function scegliFoto(file: File) {
    const lettore = new FileReader();
    lettore.onload = () => {
      const img = new Image();
      img.onload = () => {
        const lato = 256;
        const tela = document.createElement("canvas");
        tela.width = lato;
        tela.height = lato;
        const ctx = tela.getContext("2d");
        if (!ctx) return;
        // Si ritaglia il quadrato centrale: una faccia sta quasi sempre lì, e
        // deformare una persona per farla entrare in un cerchio è peggio che
        // tagliarle un po' di spalle.
        const min = Math.min(img.width, img.height);
        ctx.drawImage(
          img,
          (img.width - min) / 2,
          (img.height - min) / 2,
          min,
          min,
          0,
          0,
          lato,
          lato
        );
        setFoto(tela.toDataURL("image/jpeg", 0.82));
      };
      img.src = lettore.result as string;
    };
    lettore.readAsDataURL(file);
  }

  const pronto = nome.trim().length > 1;

  return (
    <div className="w-full max-w-[420px]">
      <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Chi sei</h1>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-[var(--text-secondary)]">
        Si compila una volta sola. Serve ai tuoi colleghi per sapere chi ha
        risposto a un cliente.
      </p>

      {/* ── La foto ─────────────────────────────────────────────────── */}
      <div className="mt-7 flex items-center gap-4">
        <button
          onClick={() => fileRef.current?.click()}
          className="relative h-20 w-20 shrink-0 cursor-pointer overflow-hidden rounded-full border-2 border-dashed border-[var(--border-strong)] transition-colors hover:border-[var(--accent)]"
          style={foto ? { borderStyle: "solid", borderColor: "var(--accent)" } : undefined}
        >
          {foto ? (
            <img src={foto} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-[22px] text-[var(--text-secondary)]">＋</span>
          )}
        </button>
        <div>
          <p className="text-[13.5px] font-medium">La tua foto</p>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
            Anche un selfie va bene.
            {/* ⚠️ «Puoi saltarla» scritto esplicitamente: obbligare qualcuno a
                mettere la propria faccia in un sistema aziendale è una cosa che
                a molti dà fastidio, e non vale il fastidio. */}
            <br />
            Puoi anche saltarla.
          </p>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) scegliFoto(f);
          }}
        />
      </div>

      {/* ── Il nome ─────────────────────────────────────────────────── */}
      <label className="mt-6 block">
        <span className="text-[12.5px] text-[var(--text-secondary)]">Come ti chiami</span>
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Nome e cognome"
          autoComplete="name"
          className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3.5 py-3 text-[16px] outline-none focus:border-[var(--accent)] sm:text-[14.5px]"
        />
      </label>

      {/* ── Il ruolo ────────────────────────────────────────────────── */}
      <div className="mt-5">
        <span className="text-[12.5px] text-[var(--text-secondary)]">Cosa fai in azienda</span>
        <div className="mt-2 space-y-1.5">
          {RUOLI.map((r) => (
            <button
              key={r.id}
              onClick={() => setRuolo(r.id)}
              className={`flex w-full cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-colors ${
                ruolo === r.id
                  ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                  : "border-[var(--border)] hover:border-[var(--border-strong)]"
              }`}
            >
              <span
                aria-hidden
                className="h-3.5 w-3.5 shrink-0 rounded-full border-2"
                style={{
                  borderColor: ruolo === r.id ? "var(--accent)" : "var(--border-strong)",
                  background: ruolo === r.id ? "var(--accent)" : "transparent",
                }}
              />
              <span className="min-w-0">
                <span className="block text-[14px] font-medium">{r.nome}</span>
                <span className="block text-[12.5px] text-[var(--text-secondary)]">{r.cosa}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Il reparto ──────────────────────────────────────────────── */}
      {(ruolo === "capo" || ruolo === "operatore") && (
        <label className="mt-5 block">
          <span className="text-[12.5px] text-[var(--text-secondary)]">In quale reparto</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {REPARTI.map((r) => (
              <button
                key={r}
                onClick={() => setReparto(r)}
                className={`cursor-pointer rounded-lg border px-3 py-1.5 text-[13px] transition-colors ${
                  reparto === r
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] font-medium"
                    : "border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </label>
      )}

      {errore && (
        <p role="alert" className="mt-4 text-[12.5px] text-[var(--text-secondary)]">
          {errore}
        </p>
      )}

      <button
        onClick={async () => {
          setInCorso(true);
          setErrore(null);
          try {
            await manda({
              az: "profilo",
              nome: nome.trim(),
              ruolo,
              reparto: ruolo === "capo" || ruolo === "operatore" ? reparto : "",
              foto,
            });
            // ⚠️ Il ruolo che si riporta indietro NON è quello scelto: è
            // «operatore», perché è quello che il server ha davvero
            // assegnato. Riportare quello scelto farebbe comparire il
            // cruscotto per un istante a chi non deve vederlo — e un istante
            // basta per fare uno screenshot.
            onFatto({
              nome: nome.trim(),
              email: "",
              ruolo: "operatore",
              ruoloScelto: ruolo,
              reparto,
              foto,
            });
          } catch (e) {
            setErrore(e instanceof Error ? e.message : "Non sono riuscito a salvare.");
            setInCorso(false);
          }
        }}
        disabled={!pronto || inCorso}
        className="btn-grad mt-7 w-full cursor-pointer rounded-xl py-3.5 text-[15px] font-medium disabled:opacity-40"
      >
        {inCorso ? "Salvo…" : "Entra in Speed Trasporti"}
      </button>

      {/* ⚠️ Questa riga è la difesa contro la falla più grossa possibile: se il
          ruolo che uno dichiara diventasse il permesso che ottiene, chiunque
          fra le 150 persone potrebbe dichiararsi titolare e vedere il
          fatturato. Dirlo qui, in chiaro, evita anche che qualcuno ci provi. */}
      <p className="mt-3.5 text-center text-[12px] leading-relaxed text-[var(--text-secondary)]">
        Il ruolo lo conferma Salvatore. Fino ad allora entri come operatore.
      </p>
    </div>
  );
}

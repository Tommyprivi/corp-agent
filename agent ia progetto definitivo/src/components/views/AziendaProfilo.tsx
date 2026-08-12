import { useRef, useState } from "react";
import { MARCHI } from "../../lib/marchio";

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
 * distrazione.
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
  onFatto: (p: ProfiloAziendale) => void;
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
          <Entra onAvanti={() => setPasso("chisei")} />
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

function Entra({ onAvanti }: { onAvanti: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="w-full max-w-[380px]">
      <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Entra</h1>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-[var(--text-secondary)]">
        Una volta sola: il telefono ti riconosce e non te lo richiede più.
      </p>

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

      <button
        onClick={onAvanti}
        disabled={!email.trim() || password.length < 4}
        className="btn-grad mt-4 w-full cursor-pointer rounded-xl py-3.5 text-[15px] font-medium disabled:opacity-40"
      >
        Entra
      </button>

      {/* ⚠️ «Resta collegato» non è una casella da spuntare: è il
          comportamento normale. Un magazziniere che deve rifare l'accesso ogni
          mattina coi guanti addosso smette di usarlo entro la settimana. */}
      <p className="mt-3.5 text-center text-[12px] leading-relaxed text-[var(--text-secondary)]">
        Resti collegato su questo telefono.
        <br />
        Password dimenticata? Chiedi in ufficio: te la reimpostano.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 2 · CHI SEI
// ─────────────────────────────────────────────────────────────────────────

function ChiSei({ onFatto }: { onFatto: (p: ProfiloAziendale) => void }) {
  const [nome, setNome] = useState("");
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

      <button
        onClick={() => onFatto({ nome: nome.trim(), ruolo, reparto, foto })}
        disabled={!pronto}
        className="btn-grad mt-7 w-full cursor-pointer rounded-xl py-3.5 text-[15px] font-medium disabled:opacity-40"
      >
        Entra in Speed Trasporti
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

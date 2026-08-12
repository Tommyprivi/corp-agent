import { useEffect, useState } from "react";
import { applicaMarchio, MARCHI } from "../../lib/marchio";
import AziendaProfilo, { RUOLI, type ProfiloAziendale } from "./AziendaProfilo";

/**
 * L'area di un'azienda cliente — la prima è Speed Trasporti.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * COS'È E COSA NON È
 * ─────────────────────────────────────────────────────────────────────────
 * È **il guscio del prodotto del cliente**: la struttura completa con tutte le
 * postazioni, i suoi colori, le sue sezioni. I dati veri arrivano quando
 * arrivano i connettori.
 *
 * ⚠️ Le sezioni che dipendono da K-Master o dal gestionale **dicono che sono
 * vuote e perché**, invece di mostrare uno zero. Uno zero è una bugia
 * involontaria: fa credere che il dato sia stato letto e valga zero. «In attesa
 * del collegamento» è la verità, e a un imprenditore la verità sullo stato dei
 * lavori interessa più di un numero finto.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * PERCHÉ CHIARO E NON SCURO
 * ─────────────────────────────────────────────────────────────────────────
 * La vetrina pubblica è nera perché la si guarda una volta. Questa la aprono
 * ogni mattina per otto ore: il chiaro stanca meno, e il logo di Speed
 * Trasporti — verde e oro — è disegnato per il fondo bianco. Su nero l'oro
 * vibra e il verde si spegne.
 */

type Sezione = "chat" | "cruscotto" | "clienti" | "persone" | "documenti";

const POSTAZIONI = [
  { id: "traffico", nome: "Traffico", persone: 12, cosa: "Risponde ai clienti, organizza i carichi" },
  { id: "magazzino", nome: "Magazzino", persone: 12, cosa: "Carico, scarico, conteggi, bolle" },
  { id: "autisti", nome: "Autisti", persone: 0, cosa: "A voce mentre guidano, foto alla consegna" },
  { id: "ammin", nome: "Amministrazione", persone: 0, cosa: "Solleciti, fatture fornitori" },
];

const CHIAVE_PROFILO = "corpagent.azienda.profilo";

export default function Azienda({ marchio = "speed" }: { marchio?: string }) {
  const m = MARCHI[marchio];
  // ⚠️ Il titolare atterra sul CRUSCOTTO, gli altri sulla chat. Un operativo
  // apre l'app per chiedere una cosa; un titolare la apre per sapere come sta
  // andando. Stessa app, due mestieri diversi — e la prima schermata è la
  // differenza fra «mi serve» e «devo cercare».
  const [sezione, setSezione] = useState<Sezione>("chat");
  const [postazione, setPostazione] = useState("traffico");
  const [menuAperto, setMenuAperto] = useState(false);
  /** Vero appena l'utente sceglie qualcosa: da lì in poi comanda lui. */
  const [toccato, setToccato] = useState(false);

  /**
   * Il profilo di chi è entrato.
   *
   * ⚠️ Oggi vive nel browser, e va detto: **è il guscio**, non il prodotto
   * finito. Quando l'area di Speed Trasporti avrà il suo spazio nel database, il
   * profilo si sposterà lì e questa riga diventerà una lettura dal server. Il
   * resto del componente non cambierà di una virgola — è per questo che sta in
   * un posto solo.
   */
  const [profilo, setProfilo] = useState<ProfiloAziendale | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const salvato = window.localStorage.getItem(CHIAVE_PROFILO);
      return salvato ? (JSON.parse(salvato) as ProfiloAziendale) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    applicaMarchio(marchio);
    // ⚠️ Si toglie uscendo: senza, chi torna alla vetrina o al pannello di
    // CorpAgent se li ritroverebbe verdi.
    return () => applicaMarchio(null);
  }, [marchio]);

  if (!m) return null;

  // Primo ingresso: si entra e si dice chi si è. Una volta sola nella vita.
  if (!profilo) {
    return (
      <AziendaProfilo
        marchio={marchio}
        onFatto={(p) => {
          try {
            window.localStorage.setItem(CHIAVE_PROFILO, JSON.stringify(p));
          } catch {
            // Spazio esaurito o navigazione privata: si prosegue lo stesso, e
            // al prossimo ingresso lo si richiede. Meglio che bloccare qui.
          }
          setProfilo(p);
        }}
      />
    );
  }

  // ⚠️ IL RUOLO DICHIARATO NON È IL RUOLO OTTENUTO. Finché Salvatore non lo
  // conferma dall'elenco delle persone, chiunque entra è un operatore. Se
  // questa riga sparisse, chiunque fra le 150 persone potrebbe dichiararsi
  // titolare e vedere il fatturato.
  const ruoloVero = profilo.ruolo === "titolare" ? "titolare" : "operatore";
  const vedeTutto = ruoloVero === "titolare";
  const sezioneVera: Sezione = sezione === "chat" && vedeTutto && !toccato ? "cruscotto" : sezione;

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
            {POSTAZIONI.map((p) => (
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
                    p.persone > 0
                      ? { background: "var(--accent)", borderColor: "var(--accent)" }
                      : { borderColor: "var(--border-strong)" }
                  }
                />
                <span className="flex-1">{p.nome}</span>
                {p.persone > 0 && (
                  <span className="text-[11px] text-[var(--text-secondary)]">{p.persone}</span>
                )}
              </button>
            ))}

            <div className="my-3 border-t border-[var(--border)]" />

            {/* ⚠️ Le sezioni che un operatore non deve vedere NON SI DISEGNANO
                affatto, invece di disegnarle e negare l'accesso: una voce di
                menu che c'è e non funziona dice a chiunque che esiste una parte
                riservata, e invita a provarci. */}
            {(
              [
                ["cruscotto", "Cruscotto"],
                ["clienti", "Clienti"],
                ["persone", "Persone"],
                ["documenti", "Documenti"],
              ] as [Sezione, string][]
            )
              .filter(([id]) => vedeTutto || id === "documenti")
              .map(([id, nome]) => (
              <button
                key={id}
                onClick={() => {
                  setSezione(id);
                  setToccato(true);
                  setMenuAperto(false);
                }}
                className={`mb-0.5 block w-full cursor-pointer rounded-lg px-2.5 py-2 text-left text-[13.5px] transition-colors ${
                  sezioneVera === id
                    ? "bg-[var(--accent-soft)] font-medium text-[var(--text-primary)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--fill-quiet)]"
                }`}
              >
                {nome}
              </button>
              ))}
          </nav>

          <div className="flex items-center gap-2.5 border-t border-[var(--border)] px-4 py-3">
            {profilo.foto ? (
              <img src={profilo.foto} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
            ) : (
              <span
                aria-hidden
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--fill-quiet)] text-[12px] font-medium text-[var(--text-secondary)]"
              >
                {profilo.nome.slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-medium">{profilo.nome}</span>
              <span className="block truncate text-[11px] text-[var(--text-secondary)]">
                {RUOLI.find((r) => r.id === profilo.ruolo)?.nome}
                {profilo.reparto && ruoloVero !== "titolare" ? ` · ${profilo.reparto}` : ""}
              </span>
            </span>
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

        {sezioneVera === "chat" && (
          <Conversazione
            postazione={POSTAZIONI.find((p) => p.id === postazione)!}
            nome={profilo.nome.split(" ")[0]}
          />
        )}
        {sezioneVera === "cruscotto" && vedeTutto && <Cruscotto nome={profilo.nome.split(" ")[0]} />}
        {sezioneVera === "clienti" && vedeTutto && <Clienti />}
        {sezioneVera === "persone" && vedeTutto && <Persone />}
        {sezioneVera === "documenti" && <Documenti />}
      </main>
    </div>
  );
}

/**
 * Il marchio in testata.
 *
 * ⚠️ Il logo vero non c'è ancora — arriverà in vettoriale. Fino ad allora un
 * segno costruito coi loro colori, non un riquadro grigio con scritto
 * «logo»: un segnaposto che sembra un errore fa sembrare rotto tutto il resto.
 */
function Marchio({ nome, compatto }: { nome: string; compatto?: boolean }) {
  const logo = MARCHI.speed?.logo;
  // ⚠️ Il logo intero contiene già la scritta «Speed Trasporti» e «Logistic
  // Solution»: ripeterle accanto sarebbe scriverle due volte nella stessa
  // riga. Quando c'è il logo, il testo sparisce.
  if (logo) {
    return (
      <img
        src={logo}
        alt={nome}
        className={compatto ? "h-7 w-auto" : "h-11 w-auto"}
        // Il file è 887x375: dichiararlo evita che la pagina «salti» mentre
        // l'immagine arriva.
        width={887}
        height={375}
      />
    );
  }
  return (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden
        className="h-7 w-7 shrink-0 rounded-full"
        style={{
          background:
            "conic-gradient(from 210deg, var(--marchio-secondario), var(--marchio-primario), var(--marchio-secondario))",
        }}
      />
      <span className="min-w-0">
        <span className="block truncate text-[14px] font-semibold tracking-[-0.01em]">{nome}</span>
        {!compatto && (
          <span className="block text-[10.5px] uppercase tracking-[0.1em] text-[var(--text-secondary)]">
            Logistic Solution
          </span>
        )}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// LA CONVERSAZIONE
// ─────────────────────────────────────────────────────────────────────────

function Conversazione({
  postazione,
  nome,
}: {
  postazione: { nome: string; cosa: string; persone: number };
  nome?: string;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b border-[var(--border)] px-5 py-3.5 md:px-8">
        <h1 className="text-[15.5px] font-semibold tracking-[-0.01em]">{postazione.nome}</h1>
        <p className="mt-0.5 text-[12.5px] text-[var(--text-secondary)]">{postazione.cosa}</p>
      </div>

      <div className="flex flex-1 flex-col justify-end px-5 py-6 md:px-8">
        <div className="mx-auto w-full max-w-[620px] space-y-3">
          <div className="rounded-2xl rounded-bl-md bg-[var(--fill-quiet)] px-4 py-3 text-[14.5px] leading-relaxed">
            Buongiorno{nome ? ` ${nome}` : ""}. Sono l'agente del{" "}
            {postazione.nome.toLowerCase()}.
            <br />
            Chiedimi quello che ti serve — anche a voce.
          </div>
        </div>
      </div>

      <div className="border-t border-[var(--border)] px-5 py-4 md:px-8">
        <div className="mx-auto flex w-full max-w-[620px] gap-2">
          <input
            placeholder="Scrivi, oppure tieni premuto il microfono…"
            className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3.5 py-3 text-[16px] outline-none focus:border-[var(--accent)] sm:text-[14.5px]"
          />
          {/* ⚠️ Il microfono è grande quanto l'invio, non un'iconcina di lato:
              metà delle 150 persone parlerà invece di scrivere — autisti che
              guidano, magazzinieri con le mani occupate. */}
          <button
            aria-label="Parla"
            className="shrink-0 cursor-pointer rounded-xl border border-[var(--border)] px-4 text-[18px]"
          >
            🎤
          </button>
          <button className="btn-grad shrink-0 cursor-pointer rounded-xl px-4 text-[14px] font-medium">
            Invia
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// IL CRUSCOTTO
// ─────────────────────────────────────────────────────────────────────────

/**
 * ⚠️ Ogni riquadro dice **da dove verrebbe il numero**, e se il collegamento
 * non c'è lo dice invece di mostrare uno zero. Uno zero è una bugia
 * involontaria: fa credere che il dato sia stato letto e valga zero.
 */
function Cruscotto({ nome }: { nome?: string }) {
  const ora = new Date().getHours();
  const saluto = ora < 12 ? "Buongiorno" : ora < 18 ? "Buon pomeriggio" : "Buonasera";

  return (
    <div className="flex-1 overflow-y-auto px-5 py-7 md:px-8">
      <div className="mx-auto max-w-[980px]">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">
          {saluto}{nome ? ` ${nome}` : ""}
        </h1>
        <p className="mt-1 text-[13.5px] text-[var(--text-secondary)]">
          {new Date().toLocaleDateString("it-IT", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </p>

        {/* ── 1 · I SOLDI ─────────────────────────────────────────────
            Prima di tutto, perché è la prima cosa che un imprenditore
            guarda la mattina. ⚠️ Nessuno di questi numeri è nostro. */}
        <Fascia titolo="I soldi" da="gestionale fatture" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Riquadro grande titolo="Fatturato di oggi" />
          <Riquadro titolo="Questo mese" />
          <Riquadro titolo="Da incassare" sotto="e chi è in ritardo" />
          <Riquadro titolo="Fatture fornitori" sotto="da controllare" />
        </div>

        {/* ── 2 · IL LAVORO ──────────────────────────────────────────── */}
        <Fascia titolo="Il lavoro di oggi" da="K-Master · QCSNET" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Riquadro grande titolo="Spedizioni in corso" />
          <Riquadro titolo="Consegnate oggi" />
          <Riquadro titolo="In ritardo" sotto="e di quanto" />
          <Riquadro titolo="Da caricare domani" />
        </div>

        {/* ── 3 · IL MAGAZZINO ───────────────────────────────────────── */}
        <Fascia titolo="Magazzino" da="scanner e barcode" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Riquadro grande titolo="Colli movimentati" />
          <Riquadro titolo="Differenze di conteggio" sotto="letto contro atteso" />
          <Riquadro titolo="In attesa di carico" />
          <Riquadro titolo="Bolle da controllare" />
        </div>

        {/* ── 4 · L'AGENTE — l'unica fascia che funziona dal primo giorno ── */}
        <div className="mt-9 flex items-baseline justify-between gap-3">
          <div>
            <h2 className="text-[11px] uppercase tracking-[0.09em] text-[var(--text-secondary)]">
              Cosa ha fatto l'agente
            </h2>
            <p className="mt-1 text-[12.5px] text-[var(--text-secondary)]">
              Questi li misuriamo noi: ci sono dal primo giorno.
            </p>
          </div>
          <span
            aria-hidden
            className="h-1 w-14 shrink-0 rounded-full"
            style={{ background: "var(--marchio-secondario)" }}
          />
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Nostro titolo="Richieste gestite" valore="0" sotto="oggi, da solo" grande />
          <Nostro titolo="Passate a una persona" valore="0" sotto="quando non sapeva" />
          <Nostro titolo="Tempo di risposta" valore="—" sotto="media di oggi" />
          <Nostro titolo="Ore risparmiate" valore="0" sotto="stima del mese" />
        </div>

        {/* ── 5 · COSA ASPETTA LUI ───────────────────────────────────── */}
        <div className="mt-9">
          <h2 className="text-[11px] uppercase tracking-[0.09em] text-[var(--text-secondary)]">
            Aspetta te
          </h2>
          {/* ⚠️ Questa sezione è la ragione per cui un titolare torna ogni
              giorno. Un cruscotto che mostra solo numeri si guarda per una
              settimana; uno che dice «ci sono tre cose che aspettano te» si
              apre tutte le mattine. */}
          <div className="mt-3 rounded-xl border border-dashed border-[var(--border)] p-7 text-center">
            <p className="text-[14.5px] font-medium">Non c'è niente in sospeso</p>
            <p className="mx-auto mt-1.5 max-w-[44ch] text-[13px] leading-relaxed text-[var(--text-secondary)]">
              Qui compaiono le risposte da approvare, i solleciti da confermare e le
              richieste che l'agente ha girato a te perché non sapeva rispondere.
            </p>
          </div>
        </div>

        {/* ── 6 · LA SPIEGAZIONE ONESTA ──────────────────────────────── */}
        <div
          className="mt-9 rounded-xl border-l-2 bg-[var(--fill-quiet)] px-5 py-4"
          style={{ borderColor: "var(--accent)" }}
        >
          <p className="text-[13.5px] font-medium">Perché tre fasce su quattro sono vuote</p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--text-secondary)]">
            Fatturato, spedizioni e magazzino vivono dentro i vostri sistemi — il
            gestionale delle fatture, K-Master, gli scanner. Questo cruscotto è una
            finestra su quei dati, non una loro copia: si riempie nel momento esatto in
            cui colleghiamo i vostri programmi, e non prima.
          </p>
          {/* ⚠️ Preferiamo dire «vuoto e perché» invece di mostrare uno zero.
              Uno zero è una bugia involontaria: fa credere che il dato sia
              stato letto e valga zero. */}
          <p className="mt-2.5 text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
            Non mettiamo degli zeri al posto dei numeri che non abbiamo: uno zero
            sembra un dato letto, e non lo è.
          </p>
        </div>
      </div>
    </div>
  );
}

/** L'intestazione di una fascia, con scritto da dove verranno i numeri. */
function Fascia({ titolo, da }: { titolo: string; da: string }) {
  return (
    <div className="mt-9 mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <h2 className="text-[11px] uppercase tracking-[0.09em] text-[var(--text-secondary)]">
        {titolo}
      </h2>
      <span className="text-[11.5px] text-[var(--text-secondary)] opacity-70">
        da {da} — in attesa del collegamento
      </span>
    </div>
  );
}

/** Un numero che non abbiamo ancora. */
function Riquadro({
  titolo,
  sotto,
  grande,
}: {
  titolo: string;
  sotto?: string;
  grande?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border border-dashed border-[var(--border)] p-4 ${
        grande ? "sm:col-span-2 lg:col-span-1" : ""
      }`}
    >
      <p className="text-[13px] font-medium text-[var(--text-primary)]">{titolo}</p>
      {sotto && <p className="mt-0.5 text-[12px] text-[var(--text-secondary)]">{sotto}</p>}
      <p className="mt-2.5 text-[12px] text-[var(--text-secondary)] opacity-70">
        in attesa del collegamento
      </p>
    </div>
  );
}

/** Un numero che misuriamo noi, quindi c'è davvero. */
function Nostro({
  titolo,
  valore,
  sotto,
  grande,
}: {
  titolo: string;
  valore: string;
  sotto: string;
  grande?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 ${
        grande ? "sm:col-span-2 lg:col-span-1" : ""
      }`}
    >
      <p className="text-[30px] font-semibold leading-none tracking-[-0.02em]">{valore}</p>
      <p className="mt-2 text-[13px] font-medium">{titolo}</p>
      <p className="mt-0.5 text-[12px] text-[var(--text-secondary)]">{sotto}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// CLIENTI · PERSONE · DOCUMENTI
// ─────────────────────────────────────────────────────────────────────────

function Clienti() {
  return (
    <Pagina titolo="Clienti" sotto="Il fascicolo di ogni cliente: cosa vi siete detti, cosa gli avete promesso.">
      <Vuoto
        titolo="Nessun cliente, ancora"
        testo="Le schede nascono da sole dalle conversazioni: chi vi scrive diventa un cliente e l'agente ci attacca quello che impara. Con il gestionale collegato arrivano anche fatture e spedizioni."
      />
    </Pagina>
  );
}

function Persone() {
  return (
    <Pagina titolo="Persone" sotto="Chi entra e chi no. Le postazioni si aprono una alla volta.">
      <div className="flex items-baseline gap-2">
        <span className="text-[30px] font-semibold tracking-[-0.02em]">1</span>
        <span className="text-[14px] text-[var(--text-secondary)]">di 150 postazioni attive</span>
      </div>
      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-[var(--fill-quiet)]">
        <div className="h-full rounded-full" style={{ width: "0.7%", background: "var(--accent)" }} />
      </div>

      <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--bg-card)]">
        <div className="flex items-center justify-between px-4 py-3.5">
          <div>
            <p className="text-[14px] font-medium">Salvatore</p>
            <p className="text-[12.5px] text-[var(--text-secondary)]">Titolare · tutti i permessi</p>
          </div>
          <span className="text-[12px] text-[var(--text-secondary)]">attivo</span>
        </div>
      </div>

      <p className="mt-4 text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
        Le altre postazioni si aprono quando dici che funziona — un reparto alla volta,
        non tutte insieme.
      </p>
    </Pagina>
  );
}

function Documenti() {
  return (
    <Pagina titolo="Documenti" sotto="Listini, zone, regole. Quello che l'agente sa dell'azienda.">
      <Vuoto
        titolo="La memoria è ancora leggera"
        testo="Oggi l'agente sa quello che è scritto sul vostro sito: chi siete, i tre servizi, dove arrivate. Il listino e le zone con i tempi si caricano qui — oppure li racconti a voce e li mette in ordine lui."
      />
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
    <div className="rounded-xl border border-dashed border-[var(--border)] p-8 text-center">
      <p className="text-[14.5px] font-medium">{titolo}</p>
      <p className="mx-auto mt-2 max-w-[46ch] text-[13px] leading-relaxed text-[var(--text-secondary)]">
        {testo}
      </p>
    </div>
  );
}

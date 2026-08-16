import { useEffect, useState } from "react";
import Richiesta from "./components/views/Richiesta";
import StatoRichiesta from "./components/views/StatoRichiesta";
import Legale from "./components/views/Legale";
import Azienda from "./components/views/Azienda";
import Auth from "./components/Auth";
import MasterChat from "./components/MasterChat";
import Advanced from "./components/views/Advanced";
import { CloseIcon } from "./components/Icons";
import Logo from "./components/Logo";
import {
  authClient,
  createAgent,
  getProfile,
  listAgents,
  surveyComplete,
  updateAgent,
  type Profile,
  type StoredAgent,
} from "./lib/api";
import { useNotify } from "./lib/notify";
import type { RoleAgent, SurveyAnswers } from "./types";

/**
 * Da come li salva il database a come li disegna l'interfaccia.
 *
 * Due nomi diversi per la stessa cosa: il database dice `model_slug` e
 * `is_custom`, il frontend dice `modelId` e `custom`. La traduzione sta qui,
 * in un posto solo, invece che sparsa in ogni componente.
 */
function toRoleAgent(a: StoredAgent): RoleAgent {
  return {
    id: a.id,
    name: a.name,
    role: a.role,
    modelId: a.modelSlug ?? "auto",
    active: a.active,
    custom: a.isCustom,
  };
}

/**
 * Chi decide cosa si vede.
 *
 * Non c'è più una variabile `stage` che avanza a comando: la verità è la
 * sessione vera, letta da Better Auth. Il motivo è concreise — con Google il
 * browser esce dal sito e torna, quindi al ritorno ogni stato inventato dal
 * frontend è già stato buttato. L'unica cosa che sopravvive è il cookie.
 *
 * L'ordine delle domande:
 *   1. Sto ancora capendo chi sei?          → schermata d'attesa
 *   2. Sei entrato e hai già risposto?      → la chat, che è il prodotto
 *   3. Sei entrato ma le domande mancano?   → l'ingresso, che riprende da lì
 *   4. Non sei entrato?                     → la vetrina
 */
export default function App() {
  const { data: session, isPending } = authClient.useSession();
  const notify = useNotify();

  // ⚠️ Non c'è un router: l'indirizzo si legge una volta sola all'avvio. Basta
  // e avanza per tre pagine pubbliche che non navigano fra loro, e una
  // libreria di instradamento in più sarebbe peso sul primo caricamento —
  // cioè sulla pagina che un imprenditore vede per prima.
  const [percorso] = useState(() =>
    typeof window === "undefined" ? "/" : window.location.pathname.replace(/\/$/, "") || "/"
  );
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [justAnswered, setJustAnswered] = useState<SurveyAnswers | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [agents, setAgents] = useState<RoleAgent[]>([]);

  // Il profilo si legge una volta sola, appena si sa chi è l'utente: dice se le
  // tre domande d'ingresso sono già state fatte in una sessione precedente.
  useEffect(() => {
    if (!session) {
      setProfile(null);
      setProfileLoaded(false);
      return;
    }
    let alive = true;
    getProfile()
      .then((p) => {
        if (alive) setProfile(p);
      })
      .catch(() => {
        // Se non si riesce a leggerlo, si riparte dalle domande: è scomodo ma
        // non blocca, e il messaggio d'errore vero lo mostra l'ingresso.
      })
      .finally(() => {
        if (alive) setProfileLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, [session]);

  // Gli agenti salvati (riga 9). Prima vivevano solo nello stato del browser:
  // bastava una ricarica e il lavoro era perso.
  useEffect(() => {
    if (!session) {
      setAgents([]);
      return;
    }
    let alive = true;
    listAgents()
      .then((rows) => {
        if (alive) setAgents(rows.map(toRoleAgent));
      })
      .catch(() => {
        // Nessun agente da mostrare invece di un errore in faccia: la chat
        // funziona comunque, e il Master Builder ne propone di nuovi.
      });
    return () => {
      alive = false;
    };
  }, [session]);

  // Finché non si sa chi è l'utente non si mostra niente: senza questa attesa,
  // chi è già entrato vedrebbe comparire per un istante la vetrina pubblica.
  // ─────────────────────────────────────────────────────────────────────
  // L'AREA DI UN'AZIENDA CLIENTE — la prima è Speed Trasporti
  // ─────────────────────────────────────────────────────────────────────
  // ⚠️ Sta PRIMA di ogni controllo sulla sessione, ed è una scelta consapevole:
  // oggi qui dentro non c'è NESSUN DATO — è il guscio del prodotto, quello che
  // Salvatore vedrà. Il giorno in cui ci finiranno dentro i suoi clienti e il
  // suo fatturato, queste righe vanno spostate dopo il controllo e diventa
  // un'area riservata. **Scritto qui perché non si dimentichi**: un guscio
  // vuoto è innocuo, un guscio pieno di dati veri no.
  if (percorso === "/speed") {
    return <Azienda marchio="speed" />;
  }

  if (isPending || (session && !profileLoaded)) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[var(--bg-app)]">
        <Logo size={28} />
      </div>
    );
  }

  if (!session) {
    // ─────────────────────────────────────────────────────────────────
    // DIREZIONE FINALE, 10 Agosto 2026 — la porta pubblica è UNA SOLA
    // ─────────────────────────────────────────────────────────────────
    // «Pubblico va solo la landing con il form di contatto aziende. Tutto il
    // resto resta privato finché non c'è un cliente reale collegato.»
    //
    // ⚠️ La vecchia vetrina con «Prova CorpAgent» NON è stata cancellata: sta
    // ancora in `Landing.tsx`, PRONTA per il giorno in cui il prodotto si apre
    // da solo — cancellare due mesi di lavoro per un cambio di strategia
    // sarebbe stato uno spreco, non una pulizia.
    //
    // ⚠️ CHIUSA IL 13 AGOSTO 2026: `/vetrina` non è più raggiungibile. Aveva
    // gli effetti (orb/glow) già bocciati altrove nel sito, un flusso «prova
    // gratis, iscriviti» in contraddizione con la porta unica di sopra, e
    // dentro di sé i Termini/Privacy in bozza («non usarlo come contratto
    // valido») raggiungibili da chiunque ci arrivasse. Serviva chiuderla, non
    // solo non linkarla: chi conoscesse l'indirizzo ci entrava comunque.
    // Per riaprirla: ripristinare il blocco `if` subito sotto.
    //
    // ⚠️ L'ingresso vero vive su `/entra`, e nessuna pagina pubblica lo linka.
    // Nascondere una porta però non è chiuderla: chi conoscesse l'indirizzo
    // entrerebbe. La serratura vera è l'elenco degli account ammessi, e va
    // messa prima di far girare il link della vetrina.
    // ⚠️ I quattro documenti pubblici stanno PRIMA di ogni altra cosa: la
    // spunta obbligatoria del form rimanda a `/privacy`, e una spunta che punta
    // al nulla è peggio di nessuna spunta.
    if (["/documentazione", "/privacy", "/termini", "/cookie"].includes(percorso)) {
      return <Legale quale={percorso.slice(1) as "documentazione" | "privacy" | "termini" | "cookie"} />;
    }
    if (percorso.startsWith("/richiesta/")) {
      return <StatoRichiesta chiave={percorso.slice("/richiesta/".length)} />;
    }
    if (percorso === "/entra") {
      return <Auth onDone={setJustAnswered} />;
    }
    // `/vetrina` è chiusa (vedi commento sopra): niente più ritorna <Landing />.
    return <Richiesta />;
  }

  // Entrato, ma le tre domande non risultano fatte: l'ingresso riprende dalla
  // verifica anti-bot e arriva alle domande, poi salva su Neon.
  if (!justAnswered && !surveyComplete(profile)) {
    return <Auth onDone={setJustAnswered} />;
  }

  const surveyAnswers: SurveyAnswers = { ...(profile?.survey ?? {}), ...(justAnswered ?? {}) };

  return (
    <>
      <MasterChat surveyAnswers={surveyAnswers} onOpenAdvanced={() => setAdvancedOpen(true)} />

      {advancedOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[var(--bg-card)]">
          <header className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-5 py-3.5">
            <span className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--text-primary)]">
              Impostazioni Avanzate
            </span>
            <button
              onClick={() => setAdvancedOpen(false)}
              aria-label="Torna alla chat"
              className="rounded-lg p-2 text-[var(--text-secondary)] transition-colors hover:bg-[var(--fill-quiet)] hover:text-[var(--text-primary)]"
            >
              <CloseIcon size={17} />
            </button>
          </header>
          <div className="flex-1 overflow-y-auto">
            <Advanced
              admin={profile?.admin === true}
              agents={agents}
              onToggleAgent={(id) => {
                // Prima si accende l'interruttore, poi si avvisa il server:
                // un interruttore che aspetta la rete per muoversi sembra rotto.
                const next = !agents.find((a) => a.id === id)?.active;
                setAgents((prev) => prev.map((a) => (a.id === id ? { ...a, active: next } : a)));
                void updateAgent({ id, active: next }).catch((error: unknown) => {
                  setAgents((prev) =>
                    prev.map((a) => (a.id === id ? { ...a, active: !next } : a))
                  );
                  notify.error(
                    "Non ho potuto cambiare l'interruttore.",
                    error instanceof Error ? error.message : String(error)
                  );
                });
              }}
              onActivatePreset={async (preset, systemPrompt) => {
                // Il catalogo non e piu una vetrina: attivare scrive su Neon
                // con le istruzioni composte, e da quel momento l agente
                // risponde davvero come qualunque altro.
                try {
                  const created = await createAgent({
                    name: preset.name,
                    role: preset.description,
                    systemPrompt,
                    modelSlug: "auto",
                    isCustom: false,
                  });
                  setAgents((prev) => [...prev, toRoleAgent(created)]);
                  notify.success(`${created.name} è al lavoro.`);
                } catch (error) {
                  // ⚠️ Prima questo `catch` era vuoto, col commento "non lo
                  // mostriamo come se fosse attivo". Giusto a metà: non
                  // mostrarlo attivo sì, ma non dire niente lascia l'utente a
                  // premere un pulsante che non fa niente e non spiega perché.
                  notify.error(
                    `Non ho potuto attivare ${preset.name}.`,
                    error instanceof Error ? error.message : String(error)
                  );
                  throw error;
                }
              }}
              onStartChat={() => setAdvancedOpen(false)}
              onCreateAgent={(description) => {
                void createAgent({
                  name: description.length > 34 ? `${description.slice(0, 34)}...` : description,
                  role: description,
                  // "auto" e non un modello scritto a mano: la scelta la fa il
                  // server in base alla difficoltà della domanda.
                  modelSlug: "auto",
                  isCustom: true,
                })
                  .then((created) => {
                    setAgents((prev) => [...prev, toRoleAgent(created)]);
                    notify.success(`${created.name} è al lavoro.`);
                  })
                  .catch((error: unknown) =>
                    notify.error(
                      "Non ho potuto creare l'agente.",
                      error instanceof Error ? error.message : String(error)
                    )
                  );
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}

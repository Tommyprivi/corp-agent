import { useEffect, useState } from "react";
import Logo from "../Logo";
import { leggiStatoRichiesta, type StatoRichiesta as Stato } from "../../lib/api";

/**
 * «Dove sta la mia richiesta» — la pagina che l'azienda apre col suo link.
 *
 * Direzione finale, 10 Agosto 2026: *«l'azienda che ha compilato il form può
 * controllare lo stato della propria richiesta tramite un link dedicato, senza
 * vedere la dashboard completa»*.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ⚠️ QUI DENTRO NON C'È NIENTE DA CLICCARE, E NON È POVERTÀ
 * ─────────────────────────────────────────────────────────────────────────
 * Niente pulsanti, niente moduli, nessun link al prodotto. Chi arriva qui ha
 * **una sola strada in avanti: scrivere a Tommaso.** Se questa pagina offrisse
 * una scorciatoia — un accesso, un modulo, un secondo form — sarebbe una falla
 * nel modo di vendere, non una comodità.
 *
 * Il server, dal canto suo, restituisce quattro campi e nessuno di più: non le
 * note interne, non l'esito, non le altre richieste. La differenza fra
 * «controlla la tua pratica» e «guarda dentro la mia scrivania» sta lì, in
 * `lead_stato`, non in questa pagina.
 */

/**
 * Una frase umana per ogni stato — scelta di Tommaso il 10 Agosto 2026.
 *
 * ⚠️ Nessuna barra di avanzamento e nessun elenco di passi con le spunte. Un
 * elenco di passi promette implicitamente che si arriva in fondo, e non tutte
 * le richieste arrivano in fondo: alcune non sono per noi, ed è giusto così.
 * Una frase può dire la verità di quel momento senza promettere il seguito.
 */
const FRASI: Record<Stato["stato"], { titolo: string; sotto: string }> = {
  nuova: {
    titolo: "Abbiamo ricevuto la tua richiesta.",
    sotto: "Ti scriviamo entro un giorno lavorativo da corpagent7@gmail.com.",
  },
  qualificata: {
    titolo: "Ci siamo fatti un'idea di cosa ti serve.",
    sotto: "Ti scriviamo entro un giorno lavorativo da corpagent7@gmail.com.",
  },
  in_lavoro: {
    titolo: "Stiamo preparando la tua versione.",
    sotto: "Ti avvisiamo appena è pronta, sempre da corpagent7@gmail.com.",
  },
  consegnata: {
    titolo: "La tua versione è pronta.",
    sotto: "Trovi tutto nell'email che ti abbiamo mandato.",
  },
  chiusa: {
    titolo: "Questa richiesta è chiusa.",
    sotto: "Se ti serve ancora qualcosa, scrivici a corpagent7@gmail.com.",
  },
};

export default function StatoRichiesta({ chiave }: { chiave: string }) {
  const [stato, setStato] = useState<Stato | null>(null);
  const [errore, setErrore] = useState<string | null>(null);

  useEffect(() => {
    leggiStatoRichiesta(chiave)
      .then(setStato)
      // ⚠️ Un solo messaggio d'errore per «chiave sbagliata» e «richiesta che
      // non esiste»: distinguerli permetterebbe di scoprire quali chiavi sono
      // valide provandone tante.
      .catch(() => setErrore("Non troviamo questa richiesta. Controlla il link."));
  }, [chiave]);

  const f = stato ? FRASI[stato.stato] : null;

  return (
    <div className="on-dark flex min-h-screen flex-col bg-[#050507] px-6 text-[#F5F5F7]">
      <header className="mx-auto flex w-full max-w-[560px] items-center gap-2.5 py-6">
        <Logo size={22} />
        <span className="text-[14.5px] font-medium tracking-[-0.01em]">CorpAgent</span>
      </header>

      <main className="mx-auto flex w-full max-w-[560px] flex-1 items-center pb-24">
        <div className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.028] p-7">
          {errore && <p className="text-[14.5px] text-white/60">{errore}</p>}

          {!errore && !stato && <p className="text-[14.5px] text-white/35">Un attimo…</p>}

          {stato && f && (
            <>
              <p className="text-[12.5px] text-white/40">{stato.azienda}</p>
              <h1 className="mt-2 text-[22px] font-semibold leading-snug tracking-[-0.02em]">
                {f.titolo}
              </h1>
              <p className="mt-3 text-[14.5px] leading-relaxed text-white/55">{f.sotto}</p>

              <p className="mt-7 border-t border-white/[0.07] pt-4 text-[12.5px] text-white/30">
                Richiesta del{" "}
                {new Date(stato.creata_il).toLocaleDateString("it-IT", {
                  day: "numeric",
                  month: "long",
                })}
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

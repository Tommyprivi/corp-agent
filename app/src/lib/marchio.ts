/**
 * Il marchio del cliente — l'area di ogni azienda porta i suoi colori.
 *
 * Voluto da Tommaso l'11 agosto 2026 per Speed Trasporti: *«i loro colori in
 * tutta l'interfaccia»*, e il logo già nella schermata d'accesso.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * COME FUNZIONA, E PERCHÉ COSÌ
 * ─────────────────────────────────────────────────────────────────────────
 * Non si riscrivono i componenti: si riscrivono **le variabili CSS**. Un
 * attributo `data-marchio="speed"` sulla radice, e da quel momento ogni
 * pulsante, ogni bordo attivo e ogni accento di tutta l'app cambiano colore
 * senza che nessun componente sappia di esistere in versione Speed Trasporti.
 *
 * ⚠️ È la stessa strada dei due temi chiaro/scuro, ed è quella che regge: il
 * giorno del secondo cliente si aggiunge una riga qui dentro, non si duplica
 * un'interfaccia.
 */

export interface Marchio {
  /** L'identificativo che finisce in `data-marchio`. */
  id: string;
  nome: string;
  /** Il colore dell'identità: pulsanti, accenti, bordi attivi. */
  primario: string;
  primarioScuro: string;
  /** Il colore di contrasto: dettagli, non superfici. */
  secondario: string;
  /** Cosa scrivere SOPRA il primario perché si legga. */
  suPrimario: string;
  logo?: string;
}

export const MARCHI: Record<string, Marchio> = {
  /**
   * Speed Trasporti — Torino, dal 1998.
   *
   * ⚠️ I colori sono **letti dai pixel del loro logo vero**, scaricato dal loro
   * sito — non stimati a occhio. La prima versione diceva `#00913F` e `#F5C518`
   * ed erano tutti e due sbagliati: il verde è più scuro e l'oro è più acceso.
   * Su un marchio, «quasi giusto» è la cosa che un titolare nota per prima e
   * non perdona — è il suo nome, lo guarda da vent'anni.
   *
   * Il file non era vettoriale e non serviva esserlo: si è preso il PNG che
   * usano online, che è lo stesso che stampano.
   */
  speed: {
    id: "speed",
    nome: "Speed Trasporti",
    primario: "#008E33",
    // ⚠️ Non è nel logo: è il verde scurito del 22% per la sfumatura del
    // pulsante e per lo stato premuto. Un marchio dà un colore, un'interfaccia
    // ne chiede tre.
    primarioScuro: "#006F28",
    secondario: "#FFC500",
    suPrimario: "#ffffff",
    logo: "/clienti/speed-logo.png",
  },
};

/**
 * ⚠️ I DUE SCONTRI DI COLORE, E COME SI RISOLVONO
 * ─────────────────────────────────────────────────────────────────────────
 *
 * **1. Il verde del marchio contro il verde di «attivo».**
 * In CorpAgent il verde è l'unico colore con un significato: connesso, acceso,
 * funzionante. Se diventa anche il colore del marchio, un pallino verde accanto
 * a un connettore non vuole più dire niente — è solo l'azienda.
 *
 * La soluzione: **lo stato non usa più il colore, usa la forma.** Un pallino
 * pieno è acceso, un anello vuoto è spento, una crocetta è guasto. Si legge
 * anche da chi non distingue i colori, che è un miglioramento a prescindere.
 *
 * **2. L'oro non regge come testo.**
 * `#F5C518` su bianco ha un contrasto di circa 1,8:1, contro il 4,5:1 richiesto:
 * illeggibile per chiunque, non solo per chi ha problemi di vista.
 *
 * La soluzione: **l'oro è un dettaglio, non una superficie di testo.** Righe,
 * bordi, il filo sotto un titolo, l'accento del logo. Mai una parola scritta in
 * oro su fondo chiaro.
 */
export function applicaMarchio(id: string | null): void {
  if (typeof document === "undefined") return;
  const radice = document.documentElement;

  if (!id || !MARCHI[id]) {
    radice.removeAttribute("data-marchio");
    return;
  }

  const m = MARCHI[id];
  radice.setAttribute("data-marchio", m.id);
  // ⚠️ Le variabili si scrivono qui e non nel CSS statico perché un domani i
  // colori arriveranno dal database — quando il cliente li cambierà dal suo
  // pannello, questa funzione resterà identica.
  radice.style.setProperty("--marchio-primario", m.primario);
  radice.style.setProperty("--marchio-primario-scuro", m.primarioScuro);
  radice.style.setProperty("--marchio-secondario", m.secondario);
  radice.style.setProperty("--marchio-su-primario", m.suPrimario);
}

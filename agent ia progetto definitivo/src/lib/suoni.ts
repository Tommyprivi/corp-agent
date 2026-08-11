/**
 * I suoni della vetrina — voluti da Tommaso il 10 Agosto 2026:
 * *«deve avere animazioni incredibili ed effetti e suoni»*.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ⚠️ SONO SINTETIZZATI, NON SONO FILE
 * ─────────────────────────────────────────────────────────────────────────
 * Nessun `.mp3` da scaricare. Tre ragioni, in ordine di importanza:
 *
 * 1. **Un file audio è una richiesta in più prima che si senta il suono.** Un
 *    click che suona 200 ms dopo il click non è un effetto: è un difetto.
 * 2. Pesano. La landing deve aprirsi istantaneamente anche in 4G scarso, ed è
 *    la prima cosa che un imprenditore vede di noi.
 * 3. Si accordano fra loro. Sono note della stessa scala, quindi il sito
 *    "suona" invece di fare rumori scollegati.
 *
 * ⚠️ IL BROWSER BLOCCA L'AUDIO FINCHÉ NON SI CLICCA, e non è un difetto da
 * aggirare: è la regola che impedisce ai siti di urlare addosso a chi li apre.
 * Quindi il contesto audio nasce **al primo clic vero**, e il primo suono che
 * si sente è quello di quel clic.
 */

let ctx: AudioContext | null = null;

/** Il contesto audio, creato pigro. Restituisce `null` finché non si può. */
function contesto(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Audio = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Audio) return null;
    try {
      ctx = new Audio();
    } catch {
      return null;
    }
  }
  // Safari e Chrome lo sospendono finché non c'è stata un'interazione.
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

interface Nota {
  /** Frequenza in hertz. 440 = il la sopra il do centrale. */
  hz: number;
  /** Durata in secondi. ⚠️ Sotto i 40 ms non si sente; sopra i 200 ms annoia. */
  durata: number;
  /** Volume di picco, da 0 a 1. Qui si sta bassi: è un accento, non un allarme. */
  volume: number;
  tipo?: OscillatorType;
  /** Se c'è, la nota scivola fino a questa frequenza. Dà il senso di movimento. */
  hzFinale?: number;
}

function suona({ hz, durata, volume, tipo = "sine", hzFinale }: Nota): void {
  const c = contesto();
  if (!c) return;

  const osc = c.createOscillator();
  const gain = c.createGain();
  const ora = c.currentTime;

  osc.type = tipo;
  osc.frequency.setValueAtTime(hz, ora);
  if (hzFinale) osc.frequency.exponentialRampToValueAtTime(hzFinale, ora + durata);

  // ⚠️ L'inviluppo è tutto. Un suono che parte e finisce di colpo produce un
  // "clic" secco — un artefatto fisico, non una scelta di gusto: è il salto
  // istantaneo del segnale. Salire in 8 ms e scendere dolcemente lo elimina.
  gain.gain.setValueAtTime(0, ora);
  gain.gain.linearRampToValueAtTime(volume, ora + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, ora + durata);

  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(ora);
  osc.stop(ora + durata + 0.02);
}

/** Un pulsante premuto: corto, secco, in basso. */
export function suonoClick(): void {
  suona({ hz: 520, hzFinale: 400, durata: 0.07, volume: 0.05, tipo: "triangle" });
}

/** Il puntatore entra su qualcosa di cliccabile: quasi impercettibile. */
export function suonoSfiora(): void {
  suona({ hz: 880, durata: 0.045, volume: 0.018, tipo: "sine" });
}

/** Un messaggio dell'agente arriva: due note che salgono, come una domanda. */
export function suonoAgente(): void {
  suona({ hz: 587.33, durata: 0.09, volume: 0.045, tipo: "sine" });
  window.setTimeout(() => suona({ hz: 783.99, durata: 0.13, volume: 0.04, tipo: "sine" }), 85);
}

/** Il messaggio dell'azienda parte: una sola nota, più bassa. */
export function suonoInvio(): void {
  suona({ hz: 659.25, hzFinale: 880, durata: 0.1, volume: 0.045, tipo: "sine" });
}

/** La richiesta è arrivata: tre note, un piccolo accordo che si chiude. */
export function suonoFatto(): void {
  [523.25, 659.25, 783.99].forEach((hz, i) =>
    window.setTimeout(() => suona({ hz, durata: 0.28, volume: 0.05, tipo: "sine" }), i * 90)
  );
}

/** Qualcosa non è andato: due note che scendono. Mai stridulo. */
export function suonoErrore(): void {
  suona({ hz: 392, durata: 0.12, volume: 0.045, tipo: "triangle" });
  window.setTimeout(() => suona({ hz: 293.66, durata: 0.2, volume: 0.04, tipo: "triangle" }), 110);
}

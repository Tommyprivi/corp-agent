/**
 * Un codice a barre Code 39, disegnato a mano in SVG. Nessuna libreria.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * PERCHÉ CODE 39, E PERCHÉ SVG
 * ─────────────────────────────────────────────────────────────────────────
 * Code 39 lo leggono TUTTI i palmari Zebra senza configurare niente: è lo
 * standard più diffuso in magazzino. È autoverificante (non serve una cifra di
 * controllo) e la sua tabella è piccola abbastanza da tenerla qui dentro, senza
 * tirarsi in casa una libreria per una cosa che sono 44 caratteri.
 *
 * SVG e non un'immagine perché un codice a barre è fatto di bordi netti: un PNG
 * si sgrana quando la stampante lo ingrandisce, e uno scanner su barre sfocate
 * fa cilecca. L'SVG resta perfetto a qualsiasi dimensione — e in stampa è ciò
 * che conta, perché la lettura sbagliata è un collo perso.
 *
 * ⚠️ Chi genera i codici mette il testo in MAIUSCOLO: Code 39 non ha le
 * minuscole, e un carattere fuori tabella spaccherebbe il disegno. `pulisci()`
 * tiene solo ciò che sta nella tabella.
 */

// Ogni carattere è 9 elementi (barra/spazio/barra…), che iniziano con una
// barra: "n" = stretto, "w" = largo. Esattamente 3 dei 9 sono larghi — è la
// firma del Code 39. È la tabella standard, non inventata.
const TABELLA: Record<string, string> = {
  "0": "nnnwwnwnn", "1": "wnnwnnnnw", "2": "nnwwnnnnw", "3": "wnwwnnnnn",
  "4": "nnnwwnnnw", "5": "wnnwwnnnn", "6": "nnwwwnnnn", "7": "nnnwnnwnw",
  "8": "wnnwnnwnn", "9": "nnwwnnwnn", A: "wnnnnwnnw", B: "nnwnnwnnw",
  C: "wnwnnwnnn", D: "nnnnwwnnw", E: "wnnnwwnnn", F: "nnwnwwnnn",
  G: "nnnnnwwnw", H: "wnnnnwwnn", I: "nnwnnwwnn", J: "nnnnwwwnn",
  K: "wnnnnnnww", L: "nnwnnnnww", M: "wnwnnnnwn", N: "nnnnwnnww",
  O: "wnnnwnnwn", P: "nnwnwnnwn", Q: "nnnnnnwww", R: "wnnnnnwwn",
  S: "nnwnnnwwn", T: "nnnnwnwwn", U: "wwnnnnnnw", V: "nwwnnnnnw",
  W: "wwwnnnnnn", X: "nwnnwnnnw", Y: "wwnnwnnnn", Z: "nwwnwnnnn",
  "-": "nwnnnnwnw", ".": "wwnnnnwnn", " ": "nwwnnnwnn", $: "nwnwnwnnn",
  "/": "nwnwnnnwn", "+": "nwnnnwnwn", "%": "nnnwnwnwn", "*": "nwnnwnwnn",
};

/** Tiene solo i caratteri che Code 39 sa disegnare, in maiuscolo. */
export function pulisci(testo: string): string {
  return testo
    .toUpperCase()
    .split("")
    .filter((c) => c !== "*" && TABELLA[c])
    .join("");
}

/**
 * Disegna il codice come SVG. `modulo` è la larghezza della barra stretta in
 * unità del viewBox; l'altezza è in proporzione. Il chiamante lo scala col CSS.
 */
export function code39Svg(
  testo: string,
  opts: { modulo?: number; altezza?: number } = {}
): string {
  const modulo = opts.modulo ?? 2;
  const largo = modulo * 2.4; // il rapporto largo/stretto sta fra 2:1 e 3:1
  const altezza = opts.altezza ?? 90;
  const dati = pulisci(testo);
  // Start e stop sono il carattere "*", che delimita ogni Code 39.
  const sequenza = `*${dati}*`;

  let x = modulo; // un margine chiaro (quiet zone) minimo a sinistra
  let barre = "";
  for (let i = 0; i < sequenza.length; i++) {
    const schema = TABELLA[sequenza[i]];
    for (let e = 0; e < 9; e++) {
      const larghezza = schema[e] === "w" ? largo : modulo;
      // Gli elementi pari sono barre (nere), i dispari spazi (bianchi).
      if (e % 2 === 0) {
        barre += `<rect x="${x.toFixed(2)}" y="0" width="${larghezza.toFixed(2)}" height="${altezza}"/>`;
      }
      x += larghezza;
    }
    x += modulo; // lo spazio stretto fra un carattere e l'altro
  }
  const largTot = x + modulo;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${largTot.toFixed(2)} ${altezza}" ` +
    `preserveAspectRatio="none" width="100%" height="100%" fill="#000">${barre}</svg>`
  );
}

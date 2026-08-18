/**
 * Il cursore luminoso — SPENTO il 13 Agosto 2026.
 *
 * Era il glow su canvas che inseguiva il puntatore (voluto il 10 Agosto,
 * senza scia dall'11). Tommaso il 13 Agosto: *«lo stile sembra fatto con
 * l'IA, troppo decorato»* — e la luce che insegue il cursore è esattamente
 * uno dei marchi riconoscibili dei siti generati.
 *
 * Il componente resta montabile: chi lo usa (Richiesta.tsx) non deve
 * cambiare una riga. Semplicemente non disegna più niente. La versione che
 * disegnava vive nella storia di git (`git log -- src/components/landing/
 * CursoreGlow.tsx`), se un giorno dovesse tornare di moda.
 */

export default function CursoreGlow(_props: { colore?: string }) {
  return null;
}

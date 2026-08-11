import { useEffect, useRef } from "react";

/**
 * Il cursore luminoso con la scia — voluto da Tommaso il 10 Agosto 2026.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ⚠️ TRE DIFESE, E OGNUNA RIPARA UN MODO DI ROVINARE IL SITO
 * ─────────────────────────────────────────────────────────────────────────
 *
 * 1. **Il cursore vero resta visibile.** Nasconderlo è la versione più
 *    spettacolare e la più pericolosa: se questo componente non parte — un
 *    errore, un blocco degli script, un browser vecchio — l'utente resta su un
 *    form da compilare senza vedere dove clicca. Un effetto non può prendersi
 *    il rischio di rompere un modulo che vale un cliente.
 *
 * 2. **Non parte su touch e non parte se chi guarda ha chiesto meno
 *    movimento.** `pointer: coarse` è un dito, e un dito non ha un cursore da
 *    seguire. `prefers-reduced-motion` è una persona che soffre di
 *    chinetosi o vertigini: per lei una scia che insegue non è un effetto, è
 *    un malessere.
 *
 * 3. **Disegna su canvas, non con elementi HTML.** Venti pallini della scia
 *    fatti di `<div>` sono venti elementi che il browser ricalcola a ogni
 *    fotogramma; su un portatile modesto si vede scattare — e uno scatto è
 *    peggio di nessun effetto, perché fa sembrare lento tutto il sito.
 */

/** Quanti punti compongono la scia. Più sono, più è lunga e più costa. */
const CODA = 18;

export default function CursoreGlow({ colore = "77, 225, 255" }: { colore?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const fine = window.matchMedia("(pointer: fine)").matches;
    const calmo = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || calmo) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // ⚠️ `devicePixelRatio` non è pignoleria: su uno schermo Retina un canvas
    // non scalato disegna un alone sfocato, e uno sfocato involontario è
    // esattamente ciò che fa sembrare un sito fatto male.
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    function misura() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = window.innerWidth * dpr;
      canvas!.height = window.innerHeight * dpr;
      canvas!.style.width = `${window.innerWidth}px`;
      canvas!.style.height = `${window.innerHeight}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    misura();

    const punti = Array.from({ length: CODA }, () => ({ x: -100, y: -100 }));
    let mouseX = -100;
    let mouseY = -100;
    let sopraCliccabile = false;
    let vivo = true;

    function muovi(e: MouseEvent) {
      mouseX = e.clientX;
      mouseY = e.clientY;
      const sotto = e.target as HTMLElement | null;
      sopraCliccabile = Boolean(
        sotto?.closest("button, a, input, textarea, select, [role='button']")
      );
    }

    function disegna() {
      if (!vivo) return;
      ctx!.clearRect(0, 0, window.innerWidth, window.innerHeight);

      // La testa insegue il mouse con un ritardo; ogni punto insegue quello
      // davanti. È tutta qui la scia: nessuna fisica, solo rincorse in fila.
      punti[0].x += (mouseX - punti[0].x) * 0.35;
      punti[0].y += (mouseY - punti[0].y) * 0.35;
      for (let i = 1; i < punti.length; i++) {
        punti[i].x += (punti[i - 1].x - punti[i].x) * 0.35;
        punti[i].y += (punti[i - 1].y - punti[i].y) * 0.35;
      }

      const raggioTesta = sopraCliccabile ? 13 : 7;

      for (let i = punti.length - 1; i >= 0; i--) {
        const q = 1 - i / punti.length;          // 1 in testa, 0 in coda
        const raggio = raggioTesta * q;
        if (raggio < 0.4) continue;

        const g = ctx!.createRadialGradient(
          punti[i].x, punti[i].y, 0,
          punti[i].x, punti[i].y, raggio * 3.2
        );
        g.addColorStop(0, `rgba(${colore}, ${0.5 * q * q})`);
        g.addColorStop(0.4, `rgba(${colore}, ${0.16 * q * q})`);
        g.addColorStop(1, `rgba(${colore}, 0)`);

        ctx!.fillStyle = g;
        ctx!.beginPath();
        ctx!.arc(punti[i].x, punti[i].y, raggio * 3.2, 0, Math.PI * 2);
        ctx!.fill();
      }

      // Il nocciolo bianco: è quello che fa leggere il punto come "luce" e non
      // come "macchia colorata".
      ctx!.fillStyle = `rgba(255, 255, 255, ${sopraCliccabile ? 0.9 : 0.65})`;
      ctx!.beginPath();
      ctx!.arc(punti[0].x, punti[0].y, sopraCliccabile ? 3.2 : 2, 0, Math.PI * 2);
      ctx!.fill();

      requestAnimationFrame(disegna);
    }

    window.addEventListener("mousemove", muovi, { passive: true });
    window.addEventListener("resize", misura);
    requestAnimationFrame(disegna);

    return () => {
      vivo = false;
      window.removeEventListener("mousemove", muovi);
      window.removeEventListener("resize", misura);
    };
  }, [colore]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      // ⚠️ `pointer-events: none` è la riga che rende innocuo tutto il resto:
      // senza, questo strato coprirebbe la pagina e **nessun pulsante sarebbe
      // più cliccabile**. Un effetto grafico che intercetta i clic è un sito
      // rotto con una bella animazione sopra.
      className="pointer-events-none fixed inset-0 z-[60]"
      style={{ mixBlendMode: "screen" }}
    />
  );
}

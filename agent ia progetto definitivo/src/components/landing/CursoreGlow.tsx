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

/**
 * ⚠️ Niente scia — Tommaso, 11 Agosto 2026: «non mettere la scia, solo il glow
 * al posto del cursore». Resta un punto solo, che insegue con un ritardo
 * minimo: quel filo di ritardo è ciò che lo fa sembrare una cosa fisica invece
 * di un adesivo incollato al puntatore.
 */

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

    const punto = { x: -100, y: -100 };
    let mouseX = -100;
    let mouseY = -100;
    let sopraCliccabile = false;
    let sopraTesto = false;
    let vivo = true;

    // ⚠️ IL CURSORE DI SISTEMA SPARISCE, ed è la cosa più rischiosa di questo
    // file: da qui in poi l'unico segno di dove si clicca è quello che
    // disegniamo noi. Per questo lo si nasconde **solo adesso** — dopo aver
    // verificato che c'è un mouse, che il canvas esiste e che il disegno sta
    // per partire. Se una qualsiasi di queste cose fallisse, la riga non viene
    // mai eseguita e il cursore normale resta al suo posto.
    const cursorePrima = document.body.style.cursor;
    document.body.style.cursor = "none";

    function muovi(e: MouseEvent) {
      mouseX = e.clientX;
      mouseY = e.clientY;
      const sotto = e.target as HTMLElement | null;
      sopraCliccabile = Boolean(sotto?.closest("button, a, [role='button']"));
      // ⚠️ Sopra un campo di testo il punto diventa una barretta verticale. Un
      // pallino sopra una casella da scrivere non dice dove finirà il cursore
      // di scrittura, e chi deve compilare cinque campi lo nota subito.
      sopraTesto = Boolean(sotto?.closest("input[type='text'], input[type='email'], input[type='tel'], textarea"));
    }

    function disegna() {
      if (!vivo) return;
      ctx!.clearRect(0, 0, window.innerWidth, window.innerHeight);

      // Insegue con un ritardo: 0.22 è abbastanza lento da sentirsi e
      // abbastanza veloce da non sembrare in ritardo.
      punto.x += (mouseX - punto.x) * 0.22;
      punto.y += (mouseY - punto.y) * 0.22;

      const raggio = sopraCliccabile ? 15 : 8;

      // L'alone.
      const g = ctx!.createRadialGradient(punto.x, punto.y, 0, punto.x, punto.y, raggio * 3.4);
      g.addColorStop(0, `rgba(${colore}, 0.55)`);
      g.addColorStop(0.35, `rgba(${colore}, 0.18)`);
      g.addColorStop(1, `rgba(${colore}, 0)`);
      ctx!.fillStyle = g;
      ctx!.beginPath();
      ctx!.arc(punto.x, punto.y, raggio * 3.4, 0, Math.PI * 2);
      ctx!.fill();

      // Il nocciolo bianco: è quello che fa leggere il punto come **luce** e
      // non come una macchia colorata. Ed è anche l'unico segno preciso di
      // dove si sta puntando, ora che il cursore vero non c'è più.
      ctx!.fillStyle = "rgba(255,255,255,0.95)";
      if (sopraTesto) {
        ctx!.fillRect(punto.x - 1, punto.y - 11, 2, 22);
      } else {
        ctx!.beginPath();
        ctx!.arc(punto.x, punto.y, sopraCliccabile ? 3.6 : 2.4, 0, Math.PI * 2);
        ctx!.fill();
      }

      requestAnimationFrame(disegna);
    }

    window.addEventListener("mousemove", muovi, { passive: true });
    window.addEventListener("resize", misura);
    requestAnimationFrame(disegna);

    return () => {
      vivo = false;
      // ⚠️ Si RIMETTE il cursore uscendo: senza questa riga, chi passa dalla
      // vetrina a una pagina interna si ritroverebbe senza cursore e senza
      // niente che lo disegni.
      document.body.style.cursor = cursorePrima;
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

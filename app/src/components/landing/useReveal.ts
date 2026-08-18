import { useEffect } from "react";

/**
 * Fa comparire le sezioni mentre si scorre.
 *
 * Perché un osservatore e non un evento di scorrimento: `IntersectionObserver`
 * lavora fuori dal filo principale, quindi la pagina non scatta. Con
 * `onscroll` ogni pixel di rotellina rieseguirebbe il calcolo per ogni sezione.
 *
 * L'animazione avviene una volta sola: una sezione già vista non si rianima
 * tornando indietro, che sarebbe fastidioso invece che elegante.
 */
export function useReveal(): void {
  useEffect(() => {
    const targets = document.querySelectorAll<HTMLElement>(".reveal");

    // Se il browser non lo supporta si mostra tutto subito: mai una pagina
    // vuota per colpa di un effetto decorativo.
    if (typeof IntersectionObserver === "undefined") {
      targets.forEach((el) => el.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        }
      },
      // Il margine negativo in basso fa partire l'animazione quando la sezione
      // è entrata per davvero, non appena spunta di un pixel.
      { threshold: 0.12, rootMargin: "0px 0px -60px 0px" }
    );

    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

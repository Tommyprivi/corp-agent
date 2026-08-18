import { useEffect, useRef, useState } from "react";

interface CounterProps {
  to: number;
  suffix?: string;
  /** Millisecondi per arrivare in fondo. */
  duration?: number;
}

/**
 * Un numero che sale da zero quando entra nello schermo.
 *
 * Parte solo quando lo si vede davvero: un contatore che si è già consumato
 * mentre eri più in alto nella pagina non lo nota nessuno.
 *
 * La curva è una "ease-out cubica": parte veloce e rallenta alla fine, che è
 * il modo in cui un numero che sale sembra vivo invece che meccanico.
 */
export default function Counter({ to, suffix = "", duration = 1800 }: CounterProps) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (typeof IntersectionObserver === "undefined") {
      setValue(to);
      return;
    }

    let frame = 0;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting || started.current) return;
        started.current = true;
        observer.disconnect();

        const start = performance.now();
        const step = (now: number) => {
          const p = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - p, 3);
          setValue(Math.round(to * eased));
          if (p < 1) frame = requestAnimationFrame(step);
        };
        frame = requestAnimationFrame(step);
      },
      { threshold: 0.4 }
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [to, duration]);

  return (
    <span ref={ref}>
      {value.toLocaleString("it-IT")}
      {suffix}
    </span>
  );
}

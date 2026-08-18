import { useCallback, useEffect, useState } from "react";

/**
 * Il tema chiaro o scuro, scelto dall'utente.
 *
 * Decisione di Tommaso del 2 Agosto 2026: si parte **scuro** e si può
 * cambiare quando si vuole.
 *
 * Come funziona: si scrive `data-theme` sull'elemento `<html>`, e il CSS fa
 * il resto — `:root[data-theme="dark"]` riscrive le stesse variabili coi
 * valori scuri. Nessun componente deve sapere quale tema è attivo.
 *
 * La scelta vive in `localStorage` e non nel database: è una preferenza del
 * dispositivo, non della persona. Chi lavora al chiaro in negozio e al buio
 * la sera vuole due impostazioni diverse sui due schermi, non una sola che
 * lo segue ovunque.
 */

export type Theme = "light" | "dark";

const KEY = "corpagent-theme";

/** Il tema da usare all'avvio: quello salvato, altrimenti scuro. */
export function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    // Navigazione in incognito con l'archiviazione bloccata: si va di default.
  }
  return "dark";
}

/**
 * Va chiamata **prima** che React disegni, da `main.tsx`.
 *
 * Se si aspettasse il primo render, per un istante si vedrebbe il tema
 * chiaro e poi lo schermo diventerebbe nero: quel lampo bianco è la cosa
 * più fastidiosa che un tema scuro possa fare.
 */
export function applyThemeEarly(): void {
  document.documentElement.dataset.theme = initialTheme();
}

export function useTheme(): { theme: Theme; toggle: () => void } {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      // Non poter salvare la preferenza non è un motivo per non applicarla.
    }
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }, []);

  return { theme, toggle };
}

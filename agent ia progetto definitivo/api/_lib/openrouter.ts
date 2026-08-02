/**
 * OpenRouter: la scelta automatica del modello e il conto di quanto costa.
 *
 * Righe 4, 5 e 6 della Fase 1 del PERCORSO: scegliere il modello in base alla
 * difficoltà, avvisare prima di una richiesta dispendiosa, contare i consumi.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * PERCHÉ GLI SLUG NON SONO SCRITTI FISSI
 * ─────────────────────────────────────────────────────────────────────────
 * Gli identificativi dei modelli cambiano spesso. La bozza di questo progetto
 * puntava a `openai/gpt-4o-mini` e `anthropic/claude-3.5-sonnet`: verificati il
 * 1 Agosto 2026 contro l'endpoint, **non esistono più**. Un prodotto che li
 * scrive a memoria si rompe da solo dopo qualche mese.
 *
 * Quindi: qui c'è un ordine di preferenza, ma a ogni avvio si legge il catalogo
 * vero da OpenRouter e si tiene il primo preferito che esiste davvero. Se non ne
 * esiste nessuno, si ripiega sul più economico che sia comunque capace. Un
 * modello che cambia nome non manda in errore il prodotto: al massimo lo fa
 * rispondere con un fratello.
 */

const CATALOG_URL = "https://openrouter.ai/api/v1/models";

/** Quanto pesa una richiesta: decide quale modello vale la pena usare. */
export type Load = "light" | "standard" | "heavy";

export interface CatalogModel {
  id: string;
  name: string;
  /** Dollari per token in ingresso. */
  promptUsd: number;
  /** Dollari per token in uscita. */
  completionUsd: number;
  context: number;
}

/**
 * Ordine di preferenza per peso. Verificati contro l'endpoint il 1 Agosto 2026.
 * Se ne aggiungi, mettili dal migliore al peggiore: si prende il primo che esiste.
 */
const PREFERENCES: Record<Load, string[]> = {
  light: ["openai/gpt-5.6-luna", "google/gemini-3.5-flash", "google/gemini-3.6-flash"],
  standard: ["anthropic/claude-sonnet-5", "google/gemini-3.6-flash", "openai/gpt-5.6-terra"],
  heavy: ["anthropic/claude-opus-5", "anthropic/claude-sonnet-5"],
};

/**
 * Cambio euro/dollaro. È un'approssimazione dichiarata: serve a mostrare
 * all'utente un ordine di grandezza in euro, non a fare fatture. Quando
 * arriverà Stripe (Fase 4) i conti veri li farà quello.
 */
const EUR_PER_USD = 0.92;

/** Frasi che tradiscono una richiesta impegnativa. */
const HEAVY_HINTS = [
  "analizza",
  "confronta",
  "riassumi tutto",
  "scrivi un report",
  "strategia",
  "piano dettagliato",
  "calcola",
  "traduci tutto",
];

/**
 * Stima quanto è impegnativa una richiesta. Un "che orari fate?" non deve
 * costare quanto un'analisi di bilancio.
 */
export function estimateLoad(text: string): Load {
  const lower = text.toLowerCase();
  if (HEAVY_HINTS.some((hint) => lower.includes(hint)) || text.length > 600) return "heavy";
  if (text.length < 80) return "light";
  return "standard";
}

// Il catalogo si tiene in memoria per dieci minuti: è lo stesso per tutti gli
// utenti e non cambia di minuto in minuto.
let cache: { at: number; models: CatalogModel[] } | undefined;
const CACHE_MS = 10 * 60 * 1000;

export async function fetchCatalog(): Promise<CatalogModel[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.models;

  const response = await fetch(CATALOG_URL, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Il catalogo di OpenRouter ha risposto ${response.status}`);
  }

  const body = (await response.json()) as {
    data?: Array<{
      id?: string;
      name?: string;
      context_length?: number;
      pricing?: { prompt?: string; completion?: string };
    }>;
  };

  const models: CatalogModel[] = (body.data ?? [])
    .filter((m): m is { id: string } & typeof m => typeof m.id === "string")
    .map((m) => ({
      id: m.id,
      name: m.name ?? m.id,
      promptUsd: Number(m.pricing?.prompt ?? 0),
      completionUsd: Number(m.pricing?.completion ?? 0),
      context: m.context_length ?? 0,
    }));

  cache = { at: Date.now(), models };
  return models;
}

/**
 * Il modello da usare per questo peso: il primo preferito che esiste davvero nel
 * catalogo, altrimenti il più economico con abbastanza contesto per lavorare.
 */
export function chooseModel(load: Load, catalog: CatalogModel[]): CatalogModel {
  const byId = new Map(catalog.map((m) => [m.id, m]));

  for (const slug of PREFERENCES[load]) {
    const found = byId.get(slug);
    if (found) return found;
  }

  const usable = catalog
    .filter((m) => m.context >= 32_000 && m.completionUsd > 0)
    .sort((a, b) => a.completionUsd - b.completionUsd);

  if (usable.length > 0) return usable[0];
  if (catalog.length > 0) return catalog[0];

  throw new Error("Il catalogo di OpenRouter è arrivato vuoto: non posso scegliere un modello.");
}

/** Quanto è costata una risposta, in euro. */
export function costEur(model: CatalogModel, tokensIn: number, tokensOut: number): number {
  const usd = tokensIn * model.promptUsd + tokensOut * model.completionUsd;
  return usd * EUR_PER_USD;
}

/**
 * L'avviso prima di una richiesta dispendiosa (riga 5). Restituisce `null`
 * quando non c'è niente di cui avvisare: la maggior parte delle richieste.
 *
 * La stima dei token è grossolana di proposito — quattro caratteri per token,
 * più un margine per la risposta — perché serve a decidere se mostrare un
 * avviso, non a fatturare.
 */
export function heavyWarning(
  model: CatalogModel,
  load: Load,
  promptChars: number
): { model: string; estimatedEur: number; message: string } | null {
  if (load !== "heavy") return null;

  const tokensIn = Math.ceil(promptChars / 4);
  const tokensOut = 1200;
  const eur = costEur(model, tokensIn, tokensOut);

  return {
    model: model.name,
    estimatedEur: eur,
    message:
      `Questa è una richiesta impegnativa: la passo al modello grande (${model.name}). ` +
      `Costa circa ${eur < 0.01 ? "meno di un centesimo" : `${eur.toFixed(2)} €`}. Procedo?`,
  };
}

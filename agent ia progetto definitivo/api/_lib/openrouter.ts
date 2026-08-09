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
 * Stima quanto è impegnativa una richiesta, **guardando solo il testo**.
 *
 * ⚠️ È veloce e gratis, ma è una euristica e sbaglia. Misurato il 2 Agosto
 * 2026 su dieci casi reali: tre sbagliati, e due nel verso peggiore —
 *
 *   "Calcola 2+2"                    → heavy, perché contiene "calcola".
 *                                      Claude Opus per una somma: 42 volte
 *                                      il costo giusto.
 *   "Traduci tutto in inglese: ciao" → heavy, stessa trappola.
 *   "Perché perdo clienti il         → light, perché è corta. Ma è una
 *    mercoledì?"                       domanda di ragionamento vero.
 *
 * Il problema di fondo: la difficoltà di una richiesta non sta nelle parole
 * che contiene né nella sua lunghezza. Sta in cosa chiede di fare.
 *
 * Per questo `classifyLoad()` qui sotto è quello che si usa davvero: questa
 * funzione resta come corsia veloce per i casi ovvi, e come rete di sicurezza
 * se la classificazione non risponde.
 */
export function estimateLoad(text: string): Load {
  const lower = text.toLowerCase();
  if (HEAVY_HINTS.some((hint) => lower.includes(hint)) || text.length > 600) return "heavy";
  if (text.length < 80) return "light";
  return "standard";
}

/**
 * Le richieste su cui non serve chiedere niente a nessuno.
 *
 * Sono la maggioranza del traffico vero di un ristorante — "che orari fate?",
 * "avete posto stasera?" — e mandarle a un classificatore aggiungerebbe mezzo
 * secondo di attesa a ogni messaggio per confermare l'ovvio.
 */
function obviouslyLight(text: string): boolean {
  const t = text.trim();
  if (t.length > 70) return false;
  // Una domanda breve e diretta, senza chiedere di ragionare.
  //
  // ⚠️ `perch[eéè]` e non `perch[éè]`: in Italia si scrive "perche" senza
  // accento più spesso di quanto si creda, e su WhatsApp quasi sempre. La
  // prima versione controllava solo le forme accentate, e "Perche perdo
  // clienti il mercoledi?" finiva sul modello leggero — una domanda di
  // diagnosi trattata come un "che orari fate?".
  return !/\bperch[eéè]\b|\bcome mai\b|\bconvien|\bmeglio\b|\bconsigl|\bstrateg|\banalizz|\bconfront|\bdiagnos|\bcapire perch/i.test(
    t
  );
}

/**
 * La lingua indovinata dalle parole più comuni, senza chiamare nessuno.
 *
 * Non è un riconoscitore serio e non vuole esserlo: serve a mettere
 * un'etichetta accanto al nome del cliente nella posta. Se non è sicuro
 * restituisce `null`, che è meglio di un'etichetta sbagliata.
 */
function guessLang(text: string): string | null {
  const t = ` ${text.toLowerCase().replace(/[^\p{L}\s]/gu, " ")} `;
  const spie: Record<string, string[]> = {
    it: ["il", "la", "che", "sono", "avete", "vorrei", "quanto", "grazie", "buongiorno", "per", "una", "quando", "aperti"],
    en: ["the", "you", "do", "have", "would", "please", "thanks", "hello", "good", "is", "are", "can", "table"],
    es: ["el", "la", "que", "tienen", "quiero", "gracias", "hola", "buenos", "para", "una", "cuando"],
    fr: ["le", "la", "vous", "avez", "je", "merci", "bonjour", "pour", "une", "est", "quand"],
    de: ["der", "die", "das", "haben", "ich", "danke", "guten", "und", "ist", "wann", "bitte"],
    pt: ["o", "que", "voce", "tem", "obrigado", "bom", "para", "uma", "quando"],
  };

  let vincitore: string | null = null;
  let massimo = 0;
  for (const [codice, parole] of Object.entries(spie)) {
    const punti = parole.filter((w) => t.includes(` ${w} `)).length;
    if (punti > massimo) {
      massimo = punti;
      vincitore = codice;
    }
  }
  // Una parola sola può essere un caso: «per» è italiano ma anche spagnolo.
  return massimo >= 2 ? vincitore : null;
}

const CLASSIFY_SCHEMA = {
  name: "difficolta",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["load", "lang"],
    properties: {
      // ── Riga 26: la lingua del cliente ──────────────────────────────
      // ⚠️ Sta qui dentro, e non in una chiamata sua, perche' questa chiamata
      // si fa comunque a ogni messaggio: riconoscere la lingua non costa un
      // centesimo in piu' ne' un secondo in piu'. Una seconda chiamata solo
      // per la lingua sarebbe stata il doppio del costo per la stessa cosa.
      lang: {
        type: "string",
        description:
          "Il codice a due lettere della lingua in cui e' scritto il messaggio: " +
          "it, en, es, fr, de, pt, zh, ar, ru... Se e' un saluto o una parola sola " +
          "e non si capisce, rispondi 'it'.",
      },
      load: {
        type: "string",
        enum: ["light", "standard", "heavy"],
        description:
          "light = risposta diretta da un dato o da una regola (prezzi, orari, disponibilità, saluti, conti banali). " +
          "standard = serve scrivere o riformulare qualcosa (rispondere a una recensione, redigere un messaggio, riassumere un testo). " +
          "heavy = serve ragionare su più fattori o produrre un piano (analisi, strategia, confronti, diagnosi di un problema).",
      },
    },
  },
} as const;

/**
 * Quanto è impegnativa questa richiesta, deciso da un modello.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * PERCHÉ VALE UNA CHIAMATA IN PIÙ
 * ─────────────────────────────────────────────────────────────────────────
 * Tra il modello leggero e quello grande ci sono **42 volte** di differenza in
 * uscita (0,60 $ contro 25,00 $ per milione di token). Sbagliare verso l'alto
 * brucia il credito su una somma; sbagliare verso il basso dà una risposta
 * scadente a una domanda che valeva soldi.
 *
 * La classificazione costa circa 0,00004 € e usa il modello più economico del
 * catalogo: è due ordini di grandezza meno dell'errore che evita.
 *
 * La corsia veloce salta la chiamata sui casi ovvi — che sono la maggioranza
 * del traffico — così l'attesa in più si paga solo dove serve.
 *
 * Se la classificazione non risponde in tempo o fallisce, si ripiega su
 * `estimateLoad()`: una stima approssimativa è meglio di un errore in faccia.
 */
export async function classifyLoad(
  text: string,
  catalog: CatalogModel[],
  apiKey: string
): Promise<{ load: Load; classified: boolean; lang: string | null }> {
  // ⚠️ La scorciatoia salta la chiamata al modello — e con essa saltava anche
  // il riconoscimento della lingua. Trovato provando il 9 Agosto 2026: un
  // «Good evening, do you have a table for two?» e' corto, quindi passava di
  // qui, e la conversazione restava senza lingua.
  //
  // La risposta arrivava giusta lo stesso (i modelli rispondono nella lingua
  // della domanda per natura), ma nella posta non si vedeva con chi si stava
  // parlando. Qui si indovina a mano: costa zero e sui messaggi corti — che
  // sono esattamente quelli che passano di qui — basta.
  if (obviouslyLight(text)) return { load: "light", classified: false, lang: guessLang(text) };

  const cheap = chooseModel("light", catalog);

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-Title": "CorpAgent",
      },
      body: JSON.stringify({
        model: cheap.id,
        stream: false,
        // Poche parole in uscita: si paga il minimo indispensabile.
        max_tokens: 20,
        response_format: { type: "json_schema", json_schema: CLASSIFY_SCHEMA },
        messages: [
          {
            role: "system",
            content:
              "Classifichi quanto è impegnativa una richiesta fatta a un assistente aziendale, " +
              "e in che lingua è scritta. " +
              "Guarda cosa chiede di FARE, non quanto è lunga né quali parole usa: " +
              '"Calcola 2+2" è light, "Perché perdo clienti il mercoledì?" è heavy. ' +
              "Rispondi solo con la classificazione.",
          },
          { role: "user", content: text.slice(0, 1500) },
        ],
      }),
      // Oltre questo non si aspetta: meglio una stima subito che una
      // classificazione perfetta che fa attendere il cliente.
      signal: AbortSignal.timeout(4000),
    });

    if (!response.ok) return { load: estimateLoad(text), classified: false, lang: null };

    const body = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = body.choices?.[0]?.message?.content;
    if (!raw) return { load: estimateLoad(text), classified: false, lang: null };

    const parsed = JSON.parse(raw) as { load?: string; lang?: string };
    // Due lettere e basta: se il modello scrive "italiano" invece di "it" non
    // lo si tiene, perche' finirebbe nel prompt e nella colonna come rumore.
    const lang =
      typeof parsed.lang === "string" && /^[a-z]{2}$/.test(parsed.lang.trim().toLowerCase())
        ? parsed.lang.trim().toLowerCase()
        : null;
    if (parsed.load === "light" || parsed.load === "standard" || parsed.load === "heavy") {
      return { load: parsed.load, classified: true, lang };
    }
  } catch {
    // Tempo scaduto, rete, JSON storto: si ripiega sulla stima.
  }

  return { load: estimateLoad(text), classified: false, lang: null };
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


// ─────────────────────────────────────────────────────────────────────────
// DISTILLARE UNA CONVERSAZIONE — riga 17
// ─────────────────────────────────────────────────────────────────────────
//
// ⚠️ Stava dentro `api/documents.ts` fino all'8 Agosto 2026. E' salito qui
// quando Tommaso ha chiesto che anche le conversazioni di WhatsApp
// diventino memoria: da quel momento i posti che distillano sono due, e un
// prompt copiato in due file diverge il giorno in cui ne correggi uno solo.

const DISTILL = [
  "Leggi questa conversazione tra il titolare di un'attività e il suo assistente IA.",
  "Estrai SOLO i fatti che valgono anche domani, e che l'assistente deve ricordarsi.",
  "",
  "COSA TENERE",
  "Prezzi, sconti e accordi presi. Orari, giorni di chiusura, eccezioni.",
  "Regole di comportamento («ai clienti abituali non chiedere l'anticipo»).",
  "Nomi e preferenze di clienti specifici, se sono stati detti.",
  "Decisioni operative («da settembre il menù cambia»).",
  "",
  "COSA BUTTARE",
  "Saluti, ringraziamenti, cortesie. Domande a cui è già stato risposto.",
  "Prove e messaggi di test. Tutto ciò che vale solo in quel momento.",
  "Le spiegazioni dell'assistente su come funziona: quelle non sono fatti dell'attività.",
  "",
  "COME SCRIVERLI",
  "Righe brevi, una informazione per riga, sotto titoli di sezione in MAIUSCOLO.",
  "Non aggiungere niente che non sia stato detto. Non completare, non arrotondare.",
  "",
  "⚠️ Se in questa conversazione non c'è NESSUN fatto che valga domani, rispondi",
  "esattamente con la parola NIENTE e nient'altro. È il caso più frequente e va bene:",
  "meglio non ricordare nulla che ricordare che qualcuno ha detto «grazie».",
].join("\n");

/**
 * Tira fuori da una conversazione i fatti che valgono domani.
 *
 * Restituisce `null` se il modello non risponde: in quel caso non si salva
 * niente, che e meglio di salvare una conversazione intera per errore.
 */
export async function distill(transcript: string, apiKey: string): Promise<string | null> {
  try {
    const catalog = await fetchCatalog();
    const model = chooseModel("standard", catalog);
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-Title": "CorpAgent",
      },
      body: JSON.stringify({
        model: model.id,
        stream: false,
        max_tokens: 2000,
        messages: [
          { role: "system", content: DISTILL },
          { role: "user", content: transcript.slice(0, 40_000) },
        ],
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return body.choices?.[0]?.message?.content?.trim() ?? null;
  } catch {
    return null;
  }
}

/**
 * `build-agent` — il Master Builder vero (riga 7 della Fase 1).
 *
 * Fino a ieri, quando l'utente diceva "ho una pizzeria", il prodotto mostrava
 * un kit scritto a mano in `src/data/kits.ts`: sempre lo stesso, per tutti.
 * Da qui in poi è un modello che legge cosa fa quella persona e **genera**
 * l'agente su misura, in JSON garantito.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * PERCHÉ "STRUCTURED OUTPUT" E NON "RISPONDIMI IN JSON, PER FAVORE"
 * ─────────────────────────────────────────────────────────────────────────
 * Chiedere a parole di rispondere in JSON funziona nove volte su dieci. La
 * decima il modello aggiunge "Ecco l'agente che ho preparato:" davanti alle
 * graffe, e `JSON.parse` esplode in faccia a un ristoratore.
 *
 * Con `response_format: json_schema` e `strict: true` è OpenRouter a garantire
 * la forma: quello che torna rispetta lo schema o la richiesta fallisce. Niente
 * da ripulire, niente da indovinare.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * DUE RISPOSTE POSSIBILI, ED È IL PUNTO
 * ─────────────────────────────────────────────────────────────────────────
 * Tommaso ha deciso (2 Agosto 2026) che il Master si comporta come un
 * consulente: fa due o tre domande prima di proporre. Quindi lo schema ha due
 * forme e il modello scegli quale usare:
 *
 *   { kind: "question", ... }  → mi manca qualcosa, chiedo
 *   { kind: "proposal", ... }  → ho capito, ecco gli agenti
 *
 * Il campo `kind` è obbligatorio in entrambe, ed è come il frontend sa se
 * disegnare una domanda o una carta da confermare.
 */

import { currentUser } from "./_lib/auth.js";
import { chooseModel, fetchCatalog } from "./_lib/openrouter.js";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

/**
 * I modelli che sanno produrre JSON garantito, in ordine di preferenza.
 * Verificati contro il catalogo il 2 Agosto 2026: tutti e tre dichiarano
 * `structured_outputs`. Se nessuno esiste più si ripiega su `chooseModel`,
 * che almeno risponde — la forma la controlliamo noi a valle.
 */
const BUILDERS = ["anthropic/claude-sonnet-5", "openai/gpt-5.6-terra", "google/gemini-3.6-flash"];

/** Oltre non si va: sono i toni che l'interfaccia sa offrire. */
const TONES = ["cordiale", "neutro", "formale", "come-parlo-io"] as const;

const SCHEMA = {
  name: "master_builder",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["kind", "message", "question", "agents"],
    properties: {
      kind: {
        type: "string",
        enum: ["question", "proposal"],
        description:
          "'question' se ti manca ancora qualcosa per capire il mestiere. " +
          "'proposal' quando hai capito e proponi gli agenti.",
      },
      message: {
        type: "string",
        description:
          "Quello che dici all'utente, in italiano. Due o tre frasi al massimo. " +
          "Se kind è 'proposal', spiega in una riga perché hai scelto questi agenti.",
      },
      question: {
        type: ["string", "null"],
        description:
          "Solo se kind è 'question': la domanda da fare. Una sola, concreta, " +
          "con un esempio di risposta tra parentesi se aiuta. Altrimenti null.",
      },
      agents: {
        type: "array",
        description:
          "Solo se kind è 'proposal': da 1 a 3 agenti. Uno se il problema è " +
          "chiaro e singolo, tre se l'utente ha elencato più esigenze diverse.",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["name", "role", "instructions", "tone"],
          properties: {
            name: {
              type: "string",
              description:
                "Nome funzionale e chiaro, che dice cosa fa: 'Addetto Prenotazioni', " +
                "'Gestore Resi', 'Risponditore Orari'. Mai nomi di fantasia o di persona. " +
                "Massimo 40 caratteri.",
            },
            role: {
              type: "string",
              description:
                "Di cosa si occupa, in una riga breve e concreta che l'utente possa " +
                "correggere: 'gestisce prenotazioni, orari e allergie'. Massimo 120 caratteri.",
            },
            instructions: {
              type: "string",
              description:
                "Le istruzioni operative dell'agente, scritte come se parlassi a lui. " +
                "Devono includere: cosa fa, come si comporta con i clienti, e " +
                "l'obbligo di NON inventare mai prezzi, orari o disponibilità che non " +
                "conosce — se non lo sa, deve dirlo e passare la parola al titolare. " +
                "Da 400 a 1200 caratteri.",
            },
            tone: {
              type: "string",
              enum: [...TONES],
              description:
                "Il tono suggerito verso i clienti finali, in base al settore: " +
                "'cordiale' per ristorazione e negozi, 'formale' per studi " +
                "professionali e servizi legali, 'neutro' nel dubbio. " +
                "Usa 'come-parlo-io' solo se l'utente lo ha chiesto esplicitamente.",
            },
          },
        },
      },
    },
  },
} as const;

/**
 * Le istruzioni del Master Builder.
 *
 * Il carattere è stato deciso da Tommaso il 2 Agosto 2026, domanda per
 * domanda. Ogni riga qui sotto corrisponde a una sua scelta, e non va
 * cambiata senza chiederglielo: è la voce del prodotto.
 */
function systemPrompt(agentCount: number, questionsAsked: number): string {
  return [
    "Sei il Master Builder di CorpAgent: costruisci \"lavoratori digitali IA\" per chi ha un'attività in Italia.",
    "Il tuo utente è un negoziante, un ristoratore, un artigiano o un professionista. Non è tecnico e non deve diventarlo.",
    "",
    "COME PARLI",
    "Tono professionale e rassicurante: da consulente esperto che ha già visto questo problema cento volte.",
    "Preciso, calmo, concreto. Niente punti esclamativi, niente emoji, niente entusiasmo finto.",
    "Frasi brevi. Mai elenchi lunghi. Mai gergo tecnico: non dire \"prompt\", \"modello\", \"API\", \"configurare\".",
    "",
    "DAI DEL LEI, MA ADÀTTATI",
    "Parti dando del lei. Se l'utente ti dà del tu, passa al tu e non tornare indietro.",
    "",
    "COME LAVORI",
    "Ti comporti come un consulente, non come un modulo. Ma un consulente bravo non interroga:",
    "chiede solo quello che gli manca davvero, e appena ha capito passa ai fatti.",
    "",
    "QUANDO PROPORRE — la regola precisa:",
    "Ti servono DUE informazioni per proporre: (a) che lavoro fa, (b) almeno un problema concreto",
    "che gli fa perdere tempo. Appena hai entrambe, PROPONI. Non chiedere conferma, non chiedere",
    "dettagli in più per sicurezza, non riassumere quello che hai capito: proponi.",
    "Se le hai già entrambe dal primo messaggio, proponi al primo colpo senza fare nessuna domanda.",
    "",
    "QUANDO CHIEDERE:",
    "Solo se ti manca (a) o (b). Una domanda per volta, breve, con un esempio di risposta tra parentesi.",
    "Al massimo DUE domande in tutta la conversazione.",
    "",
    "QUANTI AGENTI: uno se il problema è chiaro e singolo, fino a tre se ha elencato esigenze",
    "diverse tra loro. Mai più di tre.",
    "",
    questionsAsked >= 2
      ? "⚠️ ATTENZIONE: hai già fatto " +
        questionsAsked +
        " domande a questa persona. ADESSO DEVI PROPORRE: usa kind='proposal'. " +
        "Non è ammessa un'altra domanda. Se ancora non hai capito bene il mestiere, proponi un " +
        "agente che risponde alle domande frequenti dei clienti: si specializzerà usandolo. " +
        "Meglio un agente da correggere che un'altra domanda."
      : "",
    "",
    "COSA SAI FARE DAVVERO, OGGI",
    "Rispondere ai clienti su WhatsApp e in chat, leggere i documenti che l'utente carica (menù,",
    "listini, tariffari) per non sbagliare i prezzi, generare immagini, parlare e ascoltare a voce.",
    "",
    "COSA NON C'È ANCORA: telefonate, pubblicazione automatica sui social, gestione del magazzino,",
    "collegamento a gestionali ed e-commerce.",
    "Su queste sii entusiasta del progetto ma non mentire mai: di' che ci arriveremo, non che c'è già.",
    "Poi porta subito la conversazione su quello che puoi fare adesso e che gli risolve il problema oggi.",
    "Non affermare mai che una cosa è attiva se non lo è: l'utente lo direbbe ai suoi clienti.",
    "",
    "LA REGOLA CHE NON SI TOCCA",
    "Ogni agente che generi deve avere nelle istruzioni il divieto assoluto di inventare prezzi,",
    "orari, disponibilità o condizioni. Se non lo sa, lo dice e passa la parola al titolare.",
    "La promessa venduta è \"non sbaglia mai i prezzi\": un agente che indovina fa perdere un cliente vero.",
    "",
    agentCount >= 3
      ? "NOTA: questo utente ha già 3 agenti, che è il limite del piano Free. Se ne propone altri, " +
        "accennagli in una riga che gli abbonamenti arrivano presto — ma creaglieli comunque."
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

interface Body {
  /** La conversazione finora, come la vede l'utente. */
  messages?: Array<{ role: "user" | "agent" | "assistant"; content: string }>;
  /** Quanti agenti ha già: serve per l'avviso sul piano Free. */
  agentCount?: number;
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") {
      return json({ error: "Serve una richiesta POST." }, 405);
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return json(
        {
          error:
            "OPENROUTER_API_KEY non configurata. Istruzioni in docs/SETUP-OPENROUTER.md",
        },
        503
      );
    }

    let user;
    try {
      user = await currentUser(request);
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : String(error) }, 503);
    }
    if (!user) return json({ error: "Devi entrare prima." }, 401);

    let body: Body;
    try {
      body = (await request.json()) as Body;
    } catch {
      return json({ error: "Richiesta non leggibile." }, 400);
    }

    const messages = body.messages ?? [];
    if (messages.length === 0) return json({ error: "Serve almeno un messaggio." }, 400);

    // Quante volte il Master ha già parlato: ogni suo turno in questa
    // conversazione era una domanda, perché appena propone la conversazione
    // passa alla carta e non torna più qui.
    const questionsAsked = messages.filter((m) => m.role === "agent" || m.role === "assistant").length;

    // Il modello: il primo dei preferiti che esiste davvero, altrimenti la
    // scelta normale. Gli slug cambiano, il prodotto non deve rompersi.
    let modelId: string;
    try {
      const catalog = await fetchCatalog();
      const ids = new Set(catalog.map((m) => m.id));
      modelId = BUILDERS.find((b) => ids.has(b)) ?? chooseModel("standard", catalog).id;
    } catch (error) {
      return json({ error: "Non riesco a leggere il catalogo dei modelli.", detail: String(error) }, 502);
    }

    const upstream = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://corpagent.vercel.app",
        "X-Title": "CorpAgent",
      },
      body: JSON.stringify({
        model: modelId,
        // Niente streaming: all'utente non serve vedere un JSON che si scrive
        // carattere per carattere, gli serve la carta pronta.
        stream: false,
        response_format: { type: "json_schema", json_schema: SCHEMA },
        messages: [
          // ⚠️ Le domande le contiamo NOI, non il modello.
          // Alla prima prova, il 2 Agosto 2026, il Master chiedeva all'infinito
          // e non proponeva mai: sperare che un modello tenga il conto dei propri
          // turni è un modo lento di scoprire che non lo fa. Contando qui, dopo
          // la seconda domanda la proposta diventa obbligatoria per costruzione.
          { role: "system", content: systemPrompt(body.agentCount ?? 0, questionsAsked) },
          ...messages.map((m) => ({
            role: m.role === "agent" ? "assistant" : m.role,
            content: m.content,
          })),
        ],
      }),
    });

    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => "");
      return json({ error: `OpenRouter ha risposto ${upstream.status}`, detail }, 502);
    }

    const result = (await upstream.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = result.choices?.[0]?.message?.content;
    if (!raw) return json({ error: "Il modello non ha restituito niente." }, 502);

    // Lo schema è garantito da OpenRouter, ma la garanzia vale sulla forma, non
    // sul buon senso: un `kind: "proposal"` con zero agenti rispetta lo schema
    // e non serve a nulla. Qui si controlla che la risposta sia utilizzabile.
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return json({ error: "Il modello ha risposto in un formato inatteso.", detail: raw.slice(0, 400) }, 502);
    }

    const shaped = shape(parsed);
    if (!shaped) {
      return json({ error: "La proposta è arrivata incompleta. Riprova.", detail: raw.slice(0, 400) }, 502);
    }

    return new Response(JSON.stringify(shaped), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "X-Model-Used": modelId,
      },
    });
  },
};

interface ProposedAgent {
  name: string;
  role: string;
  instructions: string;
  tone: (typeof TONES)[number];
}

type Shaped =
  | { kind: "question"; message: string; question: string }
  | { kind: "proposal"; message: string; agents: ProposedAgent[] };

/** Tiene solo quello che il frontend sa disegnare, e scarta il resto. */
function shape(value: unknown): Shaped | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  const message = typeof v.message === "string" ? v.message.trim() : "";
  if (!message) return null;

  if (v.kind === "question") {
    const question = typeof v.question === "string" ? v.question.trim() : "";
    // Una domanda senza domanda: si tratta come messaggio e si tira avanti.
    return { kind: "question", message, question: question || message };
  }

  if (v.kind === "proposal" && Array.isArray(v.agents)) {
    const agents = v.agents
      .map((a): ProposedAgent | null => {
        if (typeof a !== "object" || a === null) return null;
        const o = a as Record<string, unknown>;
        const name = typeof o.name === "string" ? o.name.trim().slice(0, 40) : "";
        const role = typeof o.role === "string" ? o.role.trim().slice(0, 120) : "";
        const instructions =
          typeof o.instructions === "string" ? o.instructions.trim().slice(0, 20_000) : "";
        if (!name || !role || !instructions) return null;
        const tone = TONES.includes(o.tone as (typeof TONES)[number])
          ? (o.tone as (typeof TONES)[number])
          : "neutro";
        return { name, role, instructions, tone };
      })
      .filter((a): a is ProposedAgent => a !== null)
      // Tre è il massimo deciso da Tommaso: se il modello ne manda quattro,
      // si tagliano invece di riempire lo schermo.
      .slice(0, 3);

    if (agents.length === 0) return null;
    return { kind: "proposal", message, agents };
  }

  return null;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

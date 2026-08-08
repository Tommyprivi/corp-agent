/**
 * La memoria dell'agente: da testo a numeri, e ritorno.
 *
 * Riga 11 della Fase 2 del PERCORSO. È il pezzo che trasforma "l'agente non
 * sa i tuoi prezzi" in "l'agente risponde col prezzo giusto e ti dice da dove
 * l'ha preso".
 *
 * ─────────────────────────────────────────────────────────────────────────
 * COME FUNZIONA, IN DUE RIGHE
 * ─────────────────────────────────────────────────────────────────────────
 * Un modello di "embedding" trasforma una frase in un elenco di 1536 numeri
 * che rappresentano il suo significato. Frasi che vogliono dire cose simili
 * finiscono vicine. Quindi per trovare il prezzo della margherita non si cerca
 * la parola "margherita": si cerca il punto dello spazio più vicino alla
 * domanda, e lì c'è la riga giusta anche se il cliente ha scritto "quanto
 * costa la pizza col pomodoro".
 *
 * Il confronto lo fa Postgres con `pgvector`, che l'indice HNSW rende
 * istantaneo anche su centomila pezzi.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * PERCHÉ OPENAI E NON OPENROUTER
 * ─────────────────────────────────────────────────────────────────────────
 * OpenRouter serve i modelli di chat, non quelli di embedding. Serve una
 * chiave OpenAI a parte — è annotato in docs/CHIAVI.md dal primo giorno.
 * Costa 0,02 $ per un milione di token: indicizzare un menù costa zero.
 */

import { withUser } from "./db.js";

const EMBED_URL = "https://api.openai.com/v1/embeddings";

/**
 * 1536 dimensioni, come la colonna `vector(1536)` creata nella migrazione
 * 0001. Se un giorno si cambia modello, va cambiata anche quella colonna:
 * un vettore di dimensione diversa non ci entra, e Postgres lo rifiuta —
 * meglio un errore chiaro che una ricerca che restituisce spazzatura.
 */
const MODEL = "text-embedding-3-small";
export const DIMENSIONS = 1536;

/** Quanti testi per chiamata: OpenAI ne accetta molti, ma 96 tiene le richieste piccole. */
const BATCH = 96;

export function embeddingConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

/**
 * Trasforma dei testi in vettori, in blocchi.
 *
 * Restituisce i vettori nello stesso ordine dei testi in ingresso: chi chiama
 * si fida di quell'ordine per accoppiarli ai pezzi giusti, e OpenAI lo
 * garantisce nella risposta.
 */
export async function embed(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY non configurata: serve per la memoria dei documenti. " +
        "Vedi docs/SETUP-CHIAVI-MANCANTI.md § OpenAI."
    );
  }
  if (texts.length === 0) return [];

  const out: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH) {
    const slice = texts.slice(i, i + BATCH);
    const response = await fetch(EMBED_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: MODEL, input: slice }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`OpenAI embeddings ha risposto ${response.status}: ${detail.slice(0, 300)}`);
    }

    const body = (await response.json()) as {
      data?: Array<{ index?: number; embedding?: number[] }>;
    };
    const rows = body.data ?? [];
    if (rows.length !== slice.length) {
      throw new Error(
        `OpenAI ha restituito ${rows.length} vettori per ${slice.length} testi: non posso accoppiarli.`
      );
    }

    // `index` dice a quale testo appartiene ogni vettore: si riordina invece di
    // fidarsi della sequenza, perché un ordine sbagliato qui darebbe risposte
    // giuste prese dal pezzo sbagliato — e nessuno se ne accorgerebbe.
    const sorted = [...rows].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    for (const row of sorted) {
      if (!row.embedding || row.embedding.length !== DIMENSIONS) {
        throw new Error(`Vettore di dimensione inattesa: ${row.embedding?.length ?? "nessuno"}.`);
      }
      out.push(row.embedding);
    }
  }

  return out;
}

/** Il formato che `pgvector` si aspetta come parametro: '[0.1,0.2,...]'. */
export function toVector(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

export interface Chunk {
  content: string;
  ordinal: number;
  /** La sezione da cui viene, quando si riesce a riconoscerla. */
  heading?: string;
}

/**
 * Spezza un testo in pezzi da indicizzare.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * PERCHÉ NON SI TAGLIA OGNI 1000 CARATTERI
 * ─────────────────────────────────────────────────────────────────────────
 * Tagliare a lunghezza fissa spezza le righe a metà, e "Margherita" finisce
 * in un pezzo mentre "7,50 €" finisce nel successivo. Da quel momento
 * l'agente non sa più quanto costa la margherita, e per un prodotto che
 * promette "non sbaglia mai i prezzi" è il difetto peggiore possibile.
 *
 * Quindi si taglia **sui confini naturali**: prima i paragrafi, e se un
 * paragrafo è troppo lungo le righe. Un menù o un listino sono già fatti di
 * righe brevi, quindi vengono raggruppati fino alla misura giusta senza mai
 * spezzare una riga in due.
 *
 * `TARGET` è volutamente piccolo: pezzi corti significano risposte più
 * precise, e per un listino il pezzo ideale è "un piatto, il suo prezzo, e
 * la sezione in cui sta".
 */
const TARGET = 700;
const MAX = 1200;

export function chunk(text: string): Chunk[] {
  const clean = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!clean) return [];

  const chunks: Chunk[] = [];
  let buffer: string[] = [];
  let heading: string | undefined;

  const flush = () => {
    const content = buffer.join("\n").trim();
    if (content) chunks.push({ content, ordinal: chunks.length, heading });
    buffer = [];
  };

  const lines = clean.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trimEnd();
    // Un titolo vero ha una riga vuota sopra, o è il primo del documento.
    // Senza questo controllo "Lunedì chiuso" alla fine della sezione ORARI
    // veniva preso per un titolo e finiva in un pezzo da solo — e un pezzo
    // che dice "Lunedì chiuso" senza sapere che parla degli orari non serve
    // a rispondere "siete aperti lunedì?".
    const afterBlank = i === 0 || lines[i - 1].trim() === "";

    // Una riga corta, senza prezzo e senza punto finale, in mezzo al nulla:
    // è quasi sempre un titolo di sezione ("ANTIPASTI", "Primi piatti").
    // Riconoscerlo serve a due cose: dire al titolare da dove viene il dato,
    // e tenere la sezione dentro il pezzo, perché "7,50" senza "Pizze" sopra
    // non significa niente.
    if (isHeading(line, afterBlank)) {
      flush();
      heading = line.trim();
      buffer.push(line);
      continue;
    }

    const wouldBe = buffer.join("\n").length + line.length + 1;
    if (wouldBe > TARGET && buffer.length > 0) {
      flush();
      // La sezione si ripete in cima al pezzo nuovo: senza, un pezzo che
      // comincia a metà degli antipasti non sa più di cosa parla.
      if (heading) buffer.push(heading);
    }

    buffer.push(line);

    // Una riga singola più lunga del massimo (un paragrafo di contratto senza
    // interruzioni): si taglia per forza, ma sui punti fermi dove possibile.
    if (buffer.join("\n").length > MAX) {
      const joined = buffer.join("\n");
      const cut = joined.lastIndexOf(". ", MAX);
      if (cut > TARGET / 2) {
        chunks.push({ content: joined.slice(0, cut + 1).trim(), ordinal: chunks.length, heading });
        buffer = [joined.slice(cut + 1).trim()];
      } else {
        flush();
      }
    }
  }

  flush();
  return chunks;
}

function isHeading(line: string, afterBlank: boolean): boolean {
  const t = line.trim();
  if (t.length === 0 || t.length > 60) return false;
  // Se contiene un prezzo non è un titolo: è una voce di listino.
  if (/\d+[.,]\d{2}|\d+\s*€|€\s*\d+/.test(t)) return false;
  if (/[.;:!?]$/.test(t)) return false;
  // TUTTO MAIUSCOLO, oppure una riga markdown, oppure poche parole capitalizzate.
  // Markdown e TUTTO MAIUSCOLO sono titoli inequivocabili, dove stiano.
  if (/^#{1,4}\s/.test(t)) return true;
  if (t === t.toUpperCase() && /[A-ZÀ-Ü]/.test(t)) return true;
  // Le poche parole capitalizzate lo sono solo se staccate da una riga vuota:
  // in mezzo a un elenco sono contenuto, non intestazione.
  return afterBlank && t.split(/\s+/).length <= 4 && /^[A-ZÀ-Ü]/.test(t);
}

export interface Passage {
  content: string;
  documentId: string;
  documentName: string;
  ordinal: number;
  heading: string | null;
  /** Da 0 a 1: quanto è vicino alla domanda. Serve a decidere se fidarsi. */
  similarity: number;
  updatedAt: string;
}

/**
 * La soglia sotto la quale un pezzo si scarta.
 *
 * ⚠️ È il numero più importante di questa fase. Troppo bassa, e l'agente
 * risponde usando un pezzo che non c'entra — cioè inventa con l'aria di
 * citare, che è peggio del non sapere. Troppo alta, e non trova mai niente.
 *
 * 0,3 di similarità cosenica con `text-embedding-3-small` tiene fuori il
 * rumore lasciando passare le riformulazioni ("quanto viene" per "prezzo").
 * Se si sbaglia, si sbaglia **verso il non rispondere**: è la direzione che
 * la promessa del prodotto impone.
 */
export const MIN_SIMILARITY = 0.3;

/**
 * Cerca nei documenti dell'utente i pezzi più vicini a una domanda.
 *
 * `1 - (embedding <=> query)` è la similarità cosenica: `<=>` di pgvector
 * restituisce la distanza, e uno meno la distanza è la vicinanza. L'indice
 * HNSW creato nella 0001 rende l'ordinamento istantaneo.
 *
 * ⚠️ L'ordine finale non è solo per somiglianza, ma **per somiglianza e poi
 * per data**: se il menù nuovo e il listino vecchio contengono la stessa riga,
 * vincono i due criteri nell'ordine giusto — prima la pertinenza, poi la
 * freschezza. È la decisione di Tommaso del 2 Agosto 2026: il più recente vince.
 */
export async function search(
  client: { query: (sql: string, params: unknown[]) => Promise<{ rows: unknown[] }> },
  userId: string,
  question: string,
  limit = 6
): Promise<Passage[]> {
  const [vector] = await embed([question]);
  if (!vector) return [];

  const result = await client.query(
    `select c.content,
            c.document_id,
            d.name        as document_name,
            c.ordinal,
            c.heading,
            d.updated_at,
            1 - (c.embedding <=> $2::vector) as similarity
       from public.chunks c
       join public.documents d on d.id = c.document_id
      where c.user_id = $1
        and c.embedding is not null
        -- ⚠️ Riga 18: i documenti archiviati non si pescano mai. E il pezzo
        -- che rende vera la time-machine: togliere qualcosa dalla memoria
        -- deve avere effetto sull'istante successivo, senza cancellare niente.
        and d.archived_at is null
        and 1 - (c.embedding <=> $2::vector) >= $3
      order by similarity desc, d.updated_at desc
      limit $4`,
    [userId, toVector(vector), MIN_SIMILARITY, limit]
  );

  return (result.rows as Array<Record<string, unknown>>).map((r) => ({
    content: String(r.content),
    documentId: String(r.document_id),
    documentName: String(r.document_name),
    ordinal: Number(r.ordinal ?? 0),
    heading: r.heading === null || r.heading === undefined ? null : String(r.heading),
    similarity: Number(r.similarity),
    updatedAt: new Date(r.updated_at as string).toISOString(),
  }));
}

/**
 * Riconosce se due documenti diversi dicono cose diverse sullo stesso
 * argomento: è il conflitto da segnalare al titolare.
 *
 * Non prova a capire *cosa* si contraddice — servirebbe un modello e non ne
 * vale la pena. Guarda una cosa sola: se tra i pezzi molto pertinenti ce n'è
 * più di uno che viene da documenti diversi. In un listino solo, i pezzi
 * pertinenti vengono tutti dallo stesso file; quando arrivano da due, uno dei
 * due è vecchio.
 */
export function conflictingSources(passages: Passage[]): string[] {
  const strong = passages.filter((p) => p.similarity >= 0.45);
  const names = [...new Set(strong.map((p) => p.documentName))];
  return names.length > 1 ? names : [];
}

/**
 * Le istruzioni che si aggiungono quando l'agente ha dei documenti da cui
 * pescare (righe 12 e 13 della Fase 2).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LA DECISIONE PIÙ IMPORTANTE DELLA FASE
 * ─────────────────────────────────────────────────────────────────────────
 * Deciso da Tommaso il 2 Agosto 2026: se l'informazione non c'è, l'agente
 * **non risponde** e avvisa il titolare. Non prova a essere utile, non
 * approssima, non offre "qualcosa di simile" su prezzi e disponibilità.
 *
 * È la traduzione tecnica della promessa venduta al ristoratore: "non sbaglia
 * mai i prezzi". Un agente che indovina fa perdere un cliente vero, e nessuno
 * si accorge dell'errore finché non è tardi.
 *
 * La citazione è per il titolare, non per il cliente (altra decisione dello
 * stesso giorno): il cliente legge una risposta pulita, il titolare vede da
 * quale documento e da quale riga arriva il dato.
 */
export function knowledgePrompt(passages: Passage[]): string {
  const sources = passages
    .map((p, i) => {
      const where = p.heading ? `${p.documentName} — ${p.heading}` : p.documentName;
      return `[${i + 1}] ${where}\n${p.content}`;
    })
    .join("\n\n");

  return [
    "─────────────────────────────────────────────",
    "QUELLO CHE SAI DI QUESTA ATTIVITÀ",
    "─────────────────────────────────────────────",
    "Questi sono estratti dai documenti che il titolare ti ha dato. Sono la tua",
    "UNICA fonte di verità su prezzi, orari, prodotti, disponibilità e condizioni.",
    "",
    sources,
    "",
    "─────────────────────────────────────────────",
    "COME USARLI",
    "─────────────────────────────────────────────",
    "Rispondi usando solo quello che c'è scritto qui sopra.",
    "",
    "Se la risposta NON è qui dentro, non inventarla e non dedurla: di' con",
    "semplicità che su quel punto devi far verificare al titolare, e che gli",
    "risponderete a breve. Non proporre alternative sui prezzi, non fare stime,",
    "non dire 'di solito' o 'in genere'. Una risposta che manca costa un minuto,",
    "un prezzo sbagliato costa un cliente.",
    "",
    "Non citare i numeri tra parentesi quadre e non nominare i documenti: al",
    "cliente arriva una risposta pulita, come se lo sapessi.",
  ].join("\n");
}

// ─────────────────────────────────────────────────────────────────────────
// SALVARE IN MEMORIA — un solo modo, per tutti
// ─────────────────────────────────────────────────────────────────────────

/**
 * Prende del testo e lo mette in memoria: lo spezza, lo trasforma in numeri,
 * lo scrive.
 *
 * ⚠️ Questa funzione è nata l'8 Agosto 2026 da una richiesta di Tommaso —
 * «deve essere tutto collegato» — e la ragione per cui sta qui invece che
 * dentro `api/documents.ts` è precisa: da oggi ci sono **due** posti da cui
 * nasce un ricordo. Il sito (uno incolla un menù, o distilla una chat) e
 * WhatsApp (un cliente dice qualcosa che vale domani).
 *
 * Se il salvataggio fosse scritto due volte, prima o poi le due copie
 * divergerebbero: una spezzerebbe il testo in un modo, l'altra in un altro, e
 * l'agente saprebbe la stessa cosa in due modi diversi a seconda di dove gli
 * è stata detta. Una memoria, una strada per entrarci.
 *
 * `externalId` è il modo di dire «questo ricordo sostituisce quello di prima
 * invece di aggiungersi»: la distillazione di una conversazione usa sempre lo
 * stesso identificativo, quindi resta un documento solo che si aggiorna.
 */
export async function indexText(
  userId: string,
  input: { name: string; text: string; source: string; externalId?: string | null }
): Promise<{ documentId: string; chunks: number } | null> {
  const pieces = chunk(input.text);
  if (pieces.length === 0) return null;

  // ⚠️ Gli embedding si calcolano PRIMA di aprire la transazione: una chiamata
  // su 500 pezzi dura secondi, e tenere aperta una connessione di Neon per
  // tutto quel tempo la toglie a chi sta rispondendo a un cliente.
  const vectors = await embed(pieces.map((p) => p.content));

  return withUser(userId, async (client) => {
    const existing = input.externalId
      ? await client.query<{ id: string }>(
          "select id from public.documents where user_id = $1 and external_id = $2",
          [userId, input.externalId]
        )
      : { rows: [] as Array<{ id: string }> };

    let documentId: string;
    if (existing.rows.length > 0) {
      documentId = existing.rows[0].id;
      await client.query("delete from public.chunks where document_id = $1", [documentId]);
      await client.query(
        `update public.documents
            set name = $3, size_bytes = $4, status = 'indexed', chunk_count = $5,
                error = null, updated_at = now(),
                -- Rimettere in memoria qualcosa di archiviato lo riporta in
                -- vita: e chiaramente quello che uno intende facendolo.
                archived_at = null, archived_reason = null
          where id = $1 and user_id = $2`,
        [documentId, userId, input.name, input.text.length, pieces.length]
      );
    } else {
      const created = await client.query<{ id: string }>(
        `insert into public.documents
           (user_id, name, source, external_id, size_bytes, status, chunk_count, updated_at)
         values ($1, $2, $3, $4, $5, 'indexed', $6, now())
         returning id`,
        [userId, input.name, input.source, input.externalId ?? null, input.text.length, pieces.length]
      );
      documentId = created.rows[0].id;
    }

    // I pezzi in un colpo solo: 500 insert separati sono 500 giri di rete, e
    // un menù da 500 pezzi metterebbe minuti invece di secondi.
    const values: unknown[] = [];
    const placeholders: string[] = [];
    pieces.forEach((piece, i) => {
      const base = i * 6;
      placeholders.push(
        `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}::vector)`
      );
      values.push(
        userId,
        documentId,
        piece.content,
        piece.ordinal,
        piece.heading ?? null,
        toVector(vectors[i])
      );
    });

    await client.query(
      `insert into public.chunks (user_id, document_id, content, ordinal, heading, embedding)
       values ${placeholders.join(", ")}`,
      values
    );

    return { documentId, chunks: pieces.length };
  });
}

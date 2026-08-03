/**
 * `documents` — la base di conoscenza dell'agente.
 *
 * Righe 11, 14 e 16 della Fase 2. È dove entra il menù, il listino, il
 * tariffario, e da dove l'agente pesca il prezzo giusto invece di inventarlo.
 *
 *   GET    /api/documents          → i miei documenti, con quanti pezzi ha ognuno
 *   POST   /api/documents          → un testo nuovo: lo spezza e lo indicizza
 *   DELETE /api/documents?id=...   → lo cancella, coi suoi pezzi
 *
 * ─────────────────────────────────────────────────────────────────────────
 * PERCHÉ ARRIVA TESTO E NON FILE
 * ─────────────────────────────────────────────────────────────────────────
 * L'obiettivo di Tommaso è "zero documenti": nessun file da preparare. Le
 * quattro strade — incolla, carica, fotografa, collega Drive — hanno una cosa
 * in comune: alla fine sono testo. L'estrazione (PDF, Word, OCR di una foto)
 * avviene **nel browser**, dove ci sono già le librerie e dove non consuma il
 * tempo massimo di una funzione su Vercel.
 *
 * Il server riceve testo pulito e fa la cosa che solo lui può fare: chiamare
 * OpenAI con la chiave segreta, e scrivere su Neon.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * IL PIÙ RECENTE VINCE
 * ─────────────────────────────────────────────────────────────────────────
 * Deciso da Tommaso il 2 Agosto 2026: se il menù nuovo e il listino vecchio
 * si contraddicono, vale il più recente e il titolare viene avvisato. Qui si
 * mantiene `updated_at`; la scelta in lettura la fa `search()` in `_lib/embed.ts`.
 */

import { currentUser } from "./_lib/auth.js";
import { withUser } from "./_lib/db.js";
import { chunk, embed, embeddingConfigured, toVector } from "./_lib/embed.js";
import { chooseModel, fetchCatalog } from "./_lib/openrouter.js";

/** Un menù sta in poche pagine. Oltre, è qualcuno che incolla un libro. */
const MAX_TEXT = 400_000;
const MAX_NAME = 200;

/**
 * ─────────────────────────────────────────────────────────────────────────
 * RIGA 8: LA CONVERSAZIONE DIVENTA STRUTTURA SALVATA
 * ─────────────────────────────────────────────────────────────────────────
 * Il PERCORSO chiedeva "la conversazione diventa struttura dati salvata": uno
 * racconta com'è fatta la sua attività — "ho tre sale, dentro ci stanno
 * quaranta, la veranda venti ma solo d'estate" — e quello diventa qualcosa che
 * l'agente sa.
 *
 * ⚠️ SCELTA DI ARCHITETTURA, PRESA IL 2 AGOSTO 2026
 * C'era una tabella `structures` pronta dalla migrazione 0001, con `kind`
 * ('class' | 'rule') e `details`. Non la si usa, e vale spiegare perché.
 *
 * Una seconda tabella vorrebbe dire un secondo posto dove l'agente sa le cose:
 * una sua ricerca, una sua iniezione nel prompt, un suo pannello, e due modi di
 * andare fuori sincrono. Ma "in veranda ci stanno venti persone d'estate" è
 * esattamente della stessa natura di "la margherita costa 7,50" — è un fatto
 * sull'attività, e l'agente lo deve trovare quando serve.
 *
 * Quindi il parlato passa da un modello che lo mette in ordine, e finisce nella
 * **stessa memoria** dei documenti. Una ricerca, una fonte di verità, un
 * pannello. La struttura resta (il testo prodotto è organizzato in sezioni e
 * righe), ma non si sdoppia il sistema per ottenerla.
 */
const ORGANISE = [
  "Ti passo quello che il titolare di un'attività ha raccontato a voce o di fretta sulla sua",
  "azienda. Rimettilo in ordine perché un assistente possa usarlo per rispondere ai clienti.",
  "",
  "REGOLE",
  "Scrivi in italiano, in righe brevi, raggruppate sotto titoli di sezione in MAIUSCOLO.",
  "Una informazione per riga. Metti una riga vuota prima di ogni titolo.",
  "",
  "Non aggiungere NIENTE che non sia stato detto: né prezzi, né orari, né capienze, né",
  "condizioni. Non completare, non arrotondare, non dedurre. Se una cosa è detta a metà,",
  "riportala a metà così com'è.",
  "",
  "Togli le esitazioni e le ripetizioni, tieni tutti i numeri e tutte le eccezioni: le",
  "eccezioni ('solo d'estate', 'tranne il lunedì') sono la parte che conta di più.",
  "",
  "Non scrivere introduzioni, commenti o spiegazioni: solo il testo organizzato.",
  "",
  "ESEMPIO",
  "Detto: «allora ho tre sale, dentro ci stanno 40 persone, la veranda 20 ma solo d'estate,",
  "e il giardino lo apro solo per gli eventi»",
  "",
  "Diventa:",
  "",
  "SALE E CAPIENZA",
  "",
  "Sala interna — 40 posti",
  "Veranda — 20 posti — solo d'estate",
  "Giardino — solo per eventi",
].join("\n");

/**
 * Mette in ordine quello che il titolare ha raccontato.
 *
 * Se il modello non risponde si tiene il testo grezzo: una memoria disordinata
 * è comunque meglio di un errore in faccia a chi ha appena finito di parlare.
 */
async function organise(raw: string, apiKey: string): Promise<string> {
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
        max_tokens: 3000,
        messages: [
          { role: "system", content: ORGANISE },
          { role: "user", content: raw.slice(0, 20_000) },
        ],
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) return raw;
    const body = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return body.choices?.[0]?.message?.content?.trim() || raw;
  } catch {
    return raw;
  }
}

interface DocumentRow {
  id: string;
  name: string;
  source: string;
  size_bytes: string | number | null;
  status: string;
  chunk_count: number;
  error: string | null;
  updated_at: string;
  created_at: string;
}

export default {
  async fetch(request: Request): Promise<Response> {
    let user: { id: string; email: string | null } | null;
    try {
      user = await currentUser(request);
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : String(error) }, 503);
    }
    if (!user) return json({ error: "Devi entrare prima." }, 401);

    const userId = user.id;
    const id = new URL(request.url).searchParams.get("id");

    // ── I miei documenti ─────────────────────────────────────────────────
    if (request.method === "GET") {
      const rows = await withUser(userId, async (client) => {
        const result = await client.query<DocumentRow>(
          `select id, name, source, size_bytes, status, chunk_count, error,
                  updated_at, created_at
             from public.documents
            where user_id = $1
            order by updated_at desc`,
          [userId]
        );
        return result.rows;
      });
      return json(rows.map(shape), 200);
    }

    // ── Un documento nuovo ───────────────────────────────────────────────
    if (request.method === "POST") {
      if (!embeddingConfigured()) {
        return json(
          {
            error:
              "OPENAI_API_KEY non configurata: senza quella non posso leggere i documenti. " +
              "Vedi docs/SETUP-CHIAVI-MANCANTI.md § OpenAI.",
          },
          503
        );
      }

      let body: {
        name?: string;
        text?: string;
        source?: string;
        externalId?: string;
        /** Vero quando il testo e parlato da mettere in ordine (riga 8). */
        organise?: boolean;
      };
      try {
        body = (await request.json()) as typeof body;
      } catch {
        return json({ error: "Richiesta non leggibile." }, 400);
      }

      const name = clean(body.name, MAX_NAME) ?? "Documento senza nome";
      const text = typeof body.text === "string" ? body.text.slice(0, MAX_TEXT).trim() : "";
      const source = ["upload", "paste", "photo", "drive"].includes(body.source ?? "")
        ? (body.source as string)
        : "paste";

      if (!text) {
        return json({ error: "Il documento è arrivato vuoto: non c'è testo da leggere." }, 400);
      }

      // ── Riga 8: il parlato diventa struttura ─────────────────────────
      // Si mette in ordine PRIMA di spezzare: un racconto di fretta, spezzato
      // com'e, produrrebbe pezzi che non dicono niente da soli.
      let content = text;
      if (body.organise) {
        const key = process.env.OPENROUTER_API_KEY;
        if (key) content = await organise(text, key);
      }

      const pieces = chunk(content);
      if (pieces.length === 0) {
        return json({ error: "Non ho trovato testo utilizzabile in questo documento." }, 400);
      }

      // ⚠️ Gli embedding si calcolano PRIMA di aprire la transazione.
      // Una chiamata a OpenAI su 500 pezzi può durare secondi: tenere aperta
      // una transazione per tutto quel tempo blocca una connessione del pool
      // di Neon per niente. Se OpenAI fallisce, non abbiamo scritto nulla.
      let vectors: number[][];
      try {
        vectors = await embed(pieces.map((p) => p.content));
      } catch (error) {
        return json(
          { error: "Non riesco a leggere il documento.", detail: String(error) },
          502
        );
      }

      const saved = await withUser(userId, async (client) => {
        // Lo stesso file di Drive non entra due volte: si aggiorna quello che
        // c'è, e i suoi pezzi vecchi vengono sostituiti da quelli nuovi.
        const existing = body.externalId
          ? await client.query<{ id: string }>(
              "select id from public.documents where user_id = $1 and external_id = $2",
              [userId, body.externalId]
            )
          : { rows: [] as Array<{ id: string }> };

        let documentId: string;
        if (existing.rows.length > 0) {
          documentId = existing.rows[0].id;
          await client.query("delete from public.chunks where document_id = $1", [documentId]);
          await client.query(
            `update public.documents
                set name = $3, size_bytes = $4, status = 'indexed', chunk_count = $5,
                    error = null, updated_at = now()
              where id = $1 and user_id = $2`,
            [documentId, userId, name, content.length, pieces.length]
          );
        } else {
          const created = await client.query<{ id: string }>(
            `insert into public.documents
               (user_id, name, source, external_id, size_bytes, status, chunk_count, updated_at)
             values ($1, $2, $3, $4, $5, 'indexed', $6, now())
             returning id`,
            [userId, name, source, clean(body.externalId, 200), content.length, pieces.length]
          );
          documentId = created.rows[0].id;
        }

        // I pezzi in un colpo solo: 500 insert separati su Neon sono 500 giri
        // di rete, e un menù da 500 pezzi metterebbe minuti invece di secondi.
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

        const row = await client.query<DocumentRow>(
          `select id, name, source, size_bytes, status, chunk_count, error,
                  updated_at, created_at
             from public.documents where id = $1 and user_id = $2`,
          [documentId, userId]
        );
        return row.rows[0];
      });

      return saved
        ? json(shape(saved), 201)
        : json({ error: "Documento non salvato." }, 500);
    }

    // ── Cancellare ───────────────────────────────────────────────────────
    if (request.method === "DELETE") {
      if (!id) return json({ error: "Serve l'identificativo del documento." }, 400);

      // I pezzi se ne vanno da soli: `chunks.document_id` ha
      // `on delete cascade` dalla migrazione 0001.
      const count = await withUser(userId, async (client) => {
        const result = await client.query(
          "delete from public.documents where id = $1 and user_id = $2",
          [id, userId]
        );
        return result.rowCount ?? 0;
      });

      return count > 0
        ? json({ deleted: id }, 200)
        : json({ error: "Documento non trovato." }, 404);
    }

    return json({ error: "Metodo non ammesso." }, 405);
  },
};

function clean(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed.slice(0, max);
}

function shape(row: DocumentRow) {
  return {
    id: row.id,
    name: row.name,
    source: row.source,
    sizeBytes: row.size_bytes === null ? null : Number(row.size_bytes),
    status: row.status,
    chunkCount: row.chunk_count,
    error: row.error,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
  };
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

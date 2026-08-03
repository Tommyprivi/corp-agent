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

/** Un menù sta in poche pagine. Oltre, è qualcuno che incolla un libro. */
const MAX_TEXT = 400_000;
const MAX_NAME = 200;

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

      let body: { name?: string; text?: string; source?: string; externalId?: string };
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

      const pieces = chunk(text);
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
            [documentId, userId, name, text.length, pieces.length]
          );
        } else {
          const created = await client.query<{ id: string }>(
            `insert into public.documents
               (user_id, name, source, external_id, size_bytes, status, chunk_count, updated_at)
             values ($1, $2, $3, $4, $5, 'indexed', $6, now())
             returning id`,
            [userId, name, source, clean(body.externalId, 200), text.length, pieces.length]
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

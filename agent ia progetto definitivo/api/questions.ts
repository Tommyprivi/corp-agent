/**
 * `questions` — le domande a cui l'agente non ha saputo rispondere.
 *
 * È l'altra metà della decisione più importante della Fase 2: l'agente non
 * inventa, quindi passa la parola al titolare. Ma un avviso che non si può
 * leggere e a cui non si può rispondere è un avviso perso — e il cliente
 * resterebbe ad aspettare per sempre.
 *
 *   GET   /api/questions   → le domande aperte, le più recenti prima
 *   PATCH /api/questions   → rispondi, oppure archivia
 *
 * ─────────────────────────────────────────────────────────────────────────
 * RISPONDERE INSEGNA QUALCOSA ALL'AGENTE
 * ─────────────────────────────────────────────────────────────────────────
 * Quando il titolare risponde a una domanda aperta, quella risposta non chiude
 * solo la riga: diventa un documento nella memoria. La stessa domanda non
 * tornerà mai più senza risposta.
 *
 * È il meccanismo che realizza l'obiettivo "zero documenti" meglio di qualsiasi
 * caricamento: l'agente impara usandolo, una domanda per volta, senza che
 * nessuno prepari un file.
 */

import { currentUser } from "./_lib/auth.js";
import { withUser } from "./_lib/db.js";
import { chunk, embed, embeddingConfigured, toVector } from "./_lib/embed.js";

interface QuestionRow {
  id: string;
  channel: string;
  question: string;
  holding_reply: string | null;
  status: string;
  answer: string | null;
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

    if (request.method === "GET") {
      const rows = await withUser(userId, async (client) => {
        const result = await client.query<QuestionRow>(
          `select id, channel, question, holding_reply, status, answer, created_at
             from public.open_questions
            where user_id = $1
            order by (status = 'open') desc, created_at desc
            limit 100`,
          [userId]
        );
        return result.rows;
      });
      return json(rows.map(shape), 200);
    }

    if (request.method === "PATCH") {
      let body: { id?: string; answer?: string; dismiss?: boolean };
      try {
        body = (await request.json()) as typeof body;
      } catch {
        return json({ error: "Richiesta non leggibile." }, 400);
      }
      if (!body.id) return json({ error: "Serve l'identificativo della domanda." }, 400);

      // ── Archiviare: non era una domanda vera, o non serve rispondere ───
      if (body.dismiss) {
        const updated = await withUser(userId, async (client) => {
          const result = await client.query<QuestionRow>(
            `update public.open_questions
                set status = 'dismissed'
              where id = $1 and user_id = $2
              returning id, channel, question, holding_reply, status, answer, created_at`,
            [body.id, userId]
          );
          return result.rows[0];
        });
        return updated ? json(shape(updated), 200) : json({ error: "Domanda non trovata." }, 404);
      }

      const answer = typeof body.answer === "string" ? body.answer.trim() : "";
      if (!answer) return json({ error: "Serve una risposta." }, 400);

      // ── Rispondere: si chiude la riga E si insegna all'agente ──────────
      const stored = await withUser(userId, async (client) => {
        const result = await client.query<QuestionRow>(
          `update public.open_questions
              set status = 'answered', answer = $3, answered_at = now()
            where id = $1 and user_id = $2
            returning id, channel, question, holding_reply, status, answer, created_at`,
          [body.id, userId, answer.slice(0, 4000)]
        );
        return result.rows[0];
      });

      if (!stored) return json({ error: "Domanda non trovata." }, 404);

      // La risposta diventa memoria. Se questo pezzo fallisce, la domanda
      // resta comunque chiusa: meglio una risposta data e non memorizzata che
      // una riga che sembra ancora aperta.
      if (embeddingConfigured()) {
        await learn(userId, stored.question, answer).catch((error) => {
          console.error("Risposta salvata ma non messa in memoria:", error);
        });
      }

      return json(shape(stored), 200);
    }

    return json({ error: "Metodo non ammesso." }, 405);
  },
};

/**
 * Trasforma una coppia domanda-risposta in memoria permanente.
 *
 * Tutte le risposte del titolare finiscono in **un solo documento**, che si
 * riscrive ogni volta. Farne uno per risposta riempirebbe l'elenco dei
 * documenti di righe da una frase, e dopo un mese di uso il titolare non
 * troverebbe più il suo menù in mezzo a duecento voci.
 */
async function learn(userId: string, question: string, answer: string): Promise<void> {
  const NAME = "Risposte del titolare";
  const EXTERNAL = "learned:owner-answers";

  await withUser(userId, async (client) => {
    // Si rilegge quello che c'è già e si aggiunge in cima: l'ultima risposta
    // data è anche la più probabile da servire.
    const existing = await client.query<{ id: string; content: string }>(
      `select d.id, coalesce(string_agg(c.content, E'\n\n' order by c.ordinal), '') as content
         from public.documents d
         left join public.chunks c on c.document_id = d.id
        where d.user_id = $1 and d.external_id = $2
        group by d.id`,
      [userId, EXTERNAL]
    );

    const entry = `D: ${question}\nR: ${answer}`;
    const previous = existing.rows[0]?.content ?? "";
    const merged = previous ? `${entry}\n\n${previous}` : entry;
    const pieces = chunk(merged);
    const vectors = await embed(pieces.map((p) => p.content));

    let documentId: string;
    if (existing.rows.length > 0) {
      documentId = existing.rows[0].id;
      await client.query("delete from public.chunks where document_id = $1", [documentId]);
      await client.query(
        `update public.documents
            set chunk_count = $3, size_bytes = $4, status = 'indexed', updated_at = now()
          where id = $1 and user_id = $2`,
        [documentId, userId, pieces.length, merged.length]
      );
    } else {
      const created = await client.query<{ id: string }>(
        `insert into public.documents
           (user_id, name, source, external_id, size_bytes, status, chunk_count, updated_at)
         values ($1, $2, 'paste', $3, $4, 'indexed', $5, now())
         returning id`,
        [userId, NAME, EXTERNAL, merged.length, pieces.length]
      );
      documentId = created.rows[0].id;
    }

    const values: unknown[] = [];
    const placeholders: string[] = [];
    pieces.forEach((piece, i) => {
      const base = i * 6;
      placeholders.push(
        `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}::vector)`
      );
      values.push(userId, documentId, piece.content, piece.ordinal, piece.heading ?? null, toVector(vectors[i]));
    });

    await client.query(
      `insert into public.chunks (user_id, document_id, content, ordinal, heading, embedding)
       values ${placeholders.join(", ")}`,
      values
    );
  });
}

function shape(row: QuestionRow) {
  return {
    id: row.id,
    channel: row.channel,
    question: row.question,
    holdingReply: row.holding_reply,
    status: row.status,
    answer: row.answer,
    createdAt: row.created_at,
  };
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

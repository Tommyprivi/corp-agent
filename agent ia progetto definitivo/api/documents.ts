/**
 * `documents` — la base di conoscenza dell'agente.
 *
 * Righe 11, 14 e 16 della Fase 2. È dove entra il menù, il listino, il
 * tariffario, e da dove l'agente pesca il prezzo giusto invece di inventarlo.
 *
 *   GET    /api/documents          → i miei documenti, con quanti pezzi ha ognuno
 *   POST   /api/documents          → un testo nuovo: lo spezza e lo indicizza
 *   DELETE /api/documents?id=...   → lo archivia (riga 18: non lo cancella)
 *   PATCH  /api/documents          → lo ripristina dall'archivio
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
import { embeddingConfigured, indexText } from "./_lib/embed.js";
import { chooseModel, distill, fetchCatalog } from "./_lib/openrouter.js";

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

/**
 * ─────────────────────────────────────────────────────────────────────────
 * RIGA 17: LA MEMORIA CONTESTUALE — ricordare gli accordi passati
 * ─────────────────────────────────────────────────────────────────────────
 * «Memoria contestuale continua (ricorda accordi passati).»
 *
 * Il problema: una conversazione contiene cose che valgono per sempre — «al
 * signor Rossi facciamo sempre il 10% di sconto», «il martedì chiudiamo alle
 * 22» — mescolate a cose che valgono trenta secondi: «ciao», «grazie», «puoi
 * ripetere?».
 *
 * ⚠️ Indicizzare tutti i messaggi sarebbe il modo sbagliato, ed è la tentazione
 * ovvia: la memoria si riempirebbe di «va bene, grazie» e la ricerca per
 * significato comincerebbe a pescare rumore invece di prezzi. Un RAG affogato
 * nel piccolo cabotaggio risponde peggio di uno vuoto.
 *
 * Quindi un modello legge la conversazione e tira fuori **solo i fatti che
 * valgono domani**. Se non ne trova nessuno restituisce una riga vuota, e non
 * si salva niente — che è il caso più frequente e va bene così.
 */
/** Sotto questa soglia non vale la pena chiamare un modello. */
const MIN_MESSAGES_TO_DISTILL = 4;

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
  archived_at: string | null;
  archived_reason: string | null;
}

/** Le colonne che servono al frontend, in un posto solo. */
const COLUMNS = `id, name, source, size_bytes, status, chunk_count, error,
                 updated_at, created_at, archived_at, archived_reason`;

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
      // ?archived=1 mostra il cestino della time-machine invece della memoria.
      const wantArchived = new URL(request.url).searchParams.get("archived") === "1";
      const rows = await withUser(userId, async (client) => {
        const result = await client.query<DocumentRow>(
          `select ${COLUMNS}
             from public.documents
            where user_id = $1
              and archived_at is ${wantArchived ? "not null" : "null"}
            order by ${wantArchived ? "archived_at" : "updated_at"} desc`,
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
        /**
         * L'identificativo di una conversazione da distillare (riga 17).
         * Quando c'e, il testo non arriva dal browser: si legge dal database.
         */
        fromProject?: string;
      };
      try {
        body = (await request.json()) as typeof body;
      } catch {
        return json({ error: "Richiesta non leggibile." }, 400);
      }

      const name = clean(body.name, MAX_NAME) ?? "Documento senza nome";
      let text = typeof body.text === "string" ? body.text.slice(0, MAX_TEXT).trim() : "";

      // ── Riga 17: la memoria contestuale ───────────────────────────────
      // Il testo non viene dal browser: si legge la conversazione dal database
      // e un modello ne tira fuori solo i fatti che valgono domani.
      if (body.fromProject) {
        const key = process.env.OPENROUTER_API_KEY;
        if (!key) return json({ error: "OPENROUTER_API_KEY non configurata." }, 503);

        const conversation = await withUser(userId, async (client) => {
          const rows = await client.query<{ role: string; content: string }>(
            `select role, content from public.messages
              where project_id = $1 and user_id = $2 and role in ('user', 'agent')
              order by created_at
              limit 200`,
            [body.fromProject, userId]
          );
          return rows.rows;
        });

        if (conversation.length < MIN_MESSAGES_TO_DISTILL) {
          return json({ skipped: "conversazione troppo breve" }, 200);
        }

        const transcript = conversation
          .map((m) => `${m.role === "user" ? "TITOLARE" : "ASSISTENTE"}: ${m.content}`)
          .join("\n");

        const distilled = await distill(transcript, key);
        // NIENTE e la risposta prevista quando non c'e nulla da ricordare: e il
        // caso piu frequente, e non salvare e la cosa giusta.
        if (!distilled || distilled.trim().toUpperCase() === "NIENTE") {
          return json({ skipped: "nessun fatto da ricordare" }, 200);
        }
        text = distilled;
      }
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

      // ⚠️ Il salvataggio non e' scritto qui: sta in `indexText()` dentro
      // `_lib/embed.ts`, ed e' lo stesso identico che usa WhatsApp quando
      // distilla la conversazione con un cliente. Una memoria, una strada per
      // entrarci — se fossero due, il giorno che si corregge il modo di
      // spezzare il testo se ne correggerebbe una sola.
      let indexed: { documentId: string; chunks: number } | null;
      try {
        indexed = await indexText(userId, {
          name,
          text: content,
          source,
          externalId: clean(body.externalId, 200),
        });
      } catch (error) {
        return json(
          { error: "Non riesco a leggere il documento.", detail: String(error) },
          502
        );
      }
      if (!indexed) {
        return json({ error: "Non ho trovato testo utilizzabile in questo documento." }, 400);
      }

      const saved = await withUser(userId, async (client) => {
        const row = await client.query<DocumentRow>(
          `select ${COLUMNS} from public.documents where id = $1 and user_id = $2`,
          [indexed.documentId, userId]
        );
        return row.rows[0];
      });

      return saved
        ? json(shape(saved), 201)
        : json({ error: "Documento non salvato." }, 500);
    }

    // ── Cancellare ───────────────────────────────────────────────────────
    // ── Riga 18: togliere dalla memoria NON cancella ─────────────────────
    // «Utile se per errore sono stati caricati documenti sbagliati»: chi si
    // accorge dell'errore lo scopre dopo, e una time-machine costruita sopra
    // una cancellazione distruttiva e un pulsante che non puo fare niente.
    //
    // L'agente smette di pescare il documento nello stesso istante — lo fa la
    // clausola `archived_at is null` in `search()` — ma la riga e i suoi pezzi
    // restano, e ripristinare e togliere una data.
    //
    // `?forever=1` cancella davvero, per chi vuole svuotare il cestino.
    if (request.method === "DELETE") {
      if (!id) return json({ error: "Serve l'identificativo del documento." }, 400);
      const forever = new URL(request.url).searchParams.get("forever") === "1";

      const count = await withUser(userId, async (client) => {
        if (forever) {
          // I pezzi se ne vanno da soli: `chunks.document_id` ha
          // `on delete cascade` dalla migrazione 0001.
          const result = await client.query(
            "delete from public.documents where id = $1 and user_id = $2",
            [id, userId]
          );
          return result.rowCount ?? 0;
        }
        const result = await client.query(
          `update public.documents
              set archived_at = now(), archived_reason = 'utente'
            where id = $1 and user_id = $2 and archived_at is null`,
          [id, userId]
        );
        return result.rowCount ?? 0;
      });

      return count > 0
        ? json({ [forever ? "deleted" : "archived"]: id }, 200)
        : json({ error: "Documento non trovato." }, 404);
    }

    // ── Ripristinare: la time-machine che riavvolge ──────────────────────
    if (request.method === "PATCH") {
      let patch: { id?: string; restore?: boolean };
      try {
        patch = (await request.json()) as { id?: string; restore?: boolean };
      } catch {
        return json({ error: "Richiesta non leggibile." }, 400);
      }
      if (!patch.id) return json({ error: "Serve l'identificativo del documento." }, 400);

      const restored = await withUser(userId, async (client) => {
        const result = await client.query<DocumentRow>(
          `update public.documents
              set archived_at = null, archived_reason = null, updated_at = now()
            where id = $1 and user_id = $2
            returning ${COLUMNS}`,
          [patch.id, userId]
        );
        return result.rows[0];
      });

      return restored
        ? json(shape(restored), 200)
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
    archivedAt: row.archived_at,
    archivedReason: row.archived_reason,
  };
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

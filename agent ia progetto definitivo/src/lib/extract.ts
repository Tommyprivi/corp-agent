import { readPhoto } from "./api";

/**
 * Da un file qualsiasi al testo che l'agente può leggere.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * PERCHÉ NEL BROWSER E NON SUL SERVER
 * ─────────────────────────────────────────────────────────────────────────
 * Un PDF di cento pagine metterebbe più del tempo massimo di una funzione su
 * Vercel, e caricarlo vorrebbe dire spedire megabyte per poi buttarli. Qui il
 * file non si muove: si legge dove già sta, e al server arriva solo il testo.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * PERCHÉ LE LIBRERIE SI CARICANO SOLO QUANDO SERVONO
 * ─────────────────────────────────────────────────────────────────────────
 * `pdfjs-dist` e `mammoth` insieme pesano più di tutto il resto del sito. Un
 * ristoratore che apre CorpAgent per fare una domanda non deve scaricare un
 * lettore di PDF che non userà: con `await import()` arrivano solo quando
 * qualcuno trascina davvero un PDF, e il caricamento iniziale resta leggero.
 */

/** Quanto testo si tiene: un menù sta in poche pagine, oltre è un libro. */
const MAX_TEXT = 400_000;

export interface Extracted {
  text: string;
  /** Come è entrato: serve al server per sapere se si può ri-leggere da solo. */
  source: "upload" | "photo";
}

export function isSupported(file: File): boolean {
  return (
    isText(file) ||
    isPdf(file) ||
    isWord(file) ||
    isImage(file) ||
    isSpreadsheet(file)
  );
}

/**
 * Il testo di un file. Solleva un errore già in italiano e già comprensibile:
 * quello che scrive qui finisce sotto gli occhi di chi ha caricato il file.
 */
export async function extract(file: File): Promise<Extracted> {
  if (file.size > 40 * 1024 * 1024) {
    throw new Error("Il file è troppo grande: oltre i 40 MB non riesco a leggerlo nel browser.");
  }

  if (isText(file) || isSpreadsheet(file)) {
    const text = await file.text();
    return { text: text.slice(0, MAX_TEXT), source: "upload" };
  }

  if (isPdf(file)) {
    return { text: await fromPdf(file), source: "upload" };
  }

  if (isWord(file)) {
    return { text: await fromWord(file), source: "upload" };
  }

  if (isImage(file)) {
    return { text: await fromImage(file), source: "photo" };
  }

  throw new Error(
    `Non so leggere i file ${file.name.split(".").pop()?.toUpperCase() ?? "di questo tipo"}. ` +
      "Posso leggere PDF, Word, Excel, CSV, testo e foto."
  );
}

// ─────────────────────────────────────────────────────────────────────────
// PDF
// ─────────────────────────────────────────────────────────────────────────

async function fromPdf(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");

  // Il "worker" è il file che fa il lavoro pesante su un altro thread, così la
  // pagina non si blocca mentre legge. Va indicato a mano, e si prende dallo
  // stesso pacchetto: puntarlo a un CDN esterno lo farebbe bloccare dalle
  // regole di sicurezza del sito.
  pdfjs.GlobalWorkerOptions.workerSrc = (
    await import("pdfjs-dist/build/pdf.worker.min.mjs?url")
  ).default;

  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;

  const pages: string[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();

    // I PDF non hanno righe: hanno pezzi di testo con una posizione. Si
    // ricostruiscono le righe raggruppando per coordinata verticale, altrimenti
    // "Margherita" e "7,50 €" — che stanno sulla stessa riga del menù ma sono
    // due elementi separati — finirebbero uno sotto l'altro e il prezzo
    // perderebbe il suo piatto.
    const rows = new Map<number, string[]>();
    for (const item of content.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      // Arrotondato: due elementi sulla stessa riga hanno spesso una frazione
      // di pixel di differenza.
      const y = Math.round((item.transform?.[5] ?? 0) / 3);
      const row = rows.get(y);
      if (row) row.push(item.str);
      else rows.set(y, [item.str]);
    }

    const ordered = [...rows.entries()]
      .sort((a, b) => b[0] - a[0]) // dall'alto in basso
      .map(([, parts]) => parts.join(" ").replace(/\s+/g, " ").trim())
      .filter(Boolean);

    if (ordered.length > 0) pages.push(ordered.join("\n"));
  }

  const text = pages.join("\n\n").slice(0, MAX_TEXT);
  if (!text.trim()) {
    throw new Error(
      "Questo PDF non contiene testo: è una scansione. Fotografalo invece di caricarlo — " +
        "so leggere le immagini."
    );
  }
  return text;
}

// ─────────────────────────────────────────────────────────────────────────
// WORD
// ─────────────────────────────────────────────────────────────────────────

async function fromWord(file: File): Promise<string> {
  const mammoth = await import("mammoth");
  const { value } = await mammoth.extractRawText({
    arrayBuffer: await file.arrayBuffer(),
  });
  const text = value.slice(0, MAX_TEXT);
  if (!text.trim()) throw new Error("Il documento Word è vuoto.");
  return text;
}

// ─────────────────────────────────────────────────────────────────────────
// FOTO
// ─────────────────────────────────────────────────────────────────────────

/**
 * Una foto diventa testo passando da un modello che vede.
 *
 * È la strada più vicina all'obiettivo "zero documenti": si fotografa il menù
 * appeso al muro e finisce. Prima di spedirla si rimpicciolisce, perché una
 * foto da 12 megapixel di un telefono moderno costa dieci volte tanto in token
 * senza aggiungere una virgola di leggibilità.
 */
async function fromImage(file: File): Promise<string> {
  const dataUrl = await shrink(file, 1600);
  const { text } = await readPhoto(dataUrl);
  if (!text.trim()) {
    throw new Error("Non riesco a leggere niente in questa foto. Provane una più a fuoco.");
  }
  return text.slice(0, MAX_TEXT);
}

/** Rimpicciolisce mantenendo le proporzioni, e restituisce un data URL JPEG. */
async function shrink(file: File, maxSide: number): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Non riesco a elaborare l'immagine in questo browser.");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  // 0.85 di qualità: sopra si guadagna peso e non leggibilità.
  return canvas.toDataURL("image/jpeg", 0.85);
}

// ─────────────────────────────────────────────────────────────────────────
// Riconoscere il tipo
// ─────────────────────────────────────────────────────────────────────────
// Si guarda l'estensione oltre al tipo MIME: i browser lo sbagliano spesso sui
// file arrivati da WhatsApp o da un allegato di posta, e un menù .txt che
// arriva come "application/octet-stream" deve comunque funzionare.

const ext = (file: File) => file.name.toLowerCase().split(".").pop() ?? "";

const isText = (f: File) =>
  f.type.startsWith("text/") || ["txt", "md", "markdown", "rtf"].includes(ext(f));

const isSpreadsheet = (f: File) => ["csv", "tsv"].includes(ext(f));

const isPdf = (f: File) => f.type === "application/pdf" || ext(f) === "pdf";

const isWord = (f: File) =>
  f.type.includes("wordprocessingml") || ["docx", "doc"].includes(ext(f));

const isImage = (f: File) =>
  f.type.startsWith("image/") ||
  ["jpg", "jpeg", "png", "webp", "heic", "heif"].includes(ext(f));

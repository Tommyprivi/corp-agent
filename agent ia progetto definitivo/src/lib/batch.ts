import { addDocument, type StoredDocument } from "./api";
import { extract, isSupported } from "./extract";

/**
 * Il caricamento in blocco — riga 16 della Fase 2.
 *
 * «Trascinare un'intera cartella con 500 PDF e farli indicizzare in blocco in
 * pochi minuti, senza doverli caricare uno alla volta.»
 *
 * ─────────────────────────────────────────────────────────────────────────
 * PERCHÉ NON BASTAVA IL CICLO CHE C'ERA
 * ─────────────────────────────────────────────────────────────────────────
 * Prima i file si processavano in serie dentro un `for`: leggi, salva, leggi,
 * salva. Con 500 PDF vuol dire 500 attese di rete una dopo l'altra, e se il
 * numero 7 era corrotto tutto si fermava lì — i 493 dopo non entravano.
 *
 * Qui c'è una coda con tre operazioni in volo, l'avanzamento visibile, e ogni
 * file che cade da solo senza portarsi via gli altri.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * PERCHÉ TRE E NON VENTI
 * ─────────────────────────────────────────────────────────────────────────
 * Il collo di bottiglia non è la rete: è la **CPU del browser**. Aprire un PDF
 * con `pdfjs` è lavoro pesante, e venti in parallelo bloccherebbero la pagina —
 * l'utente vedrebbe l'interfaccia congelarsi e penserebbe che si è rotta.
 *
 * Tre tiene la pagina viva e il tubo pieno. Su una macchina moderna sono
 * comunque circa quindici documenti al minuto.
 */

/** Quante estrazioni in volo insieme. */
const CONCURRENCY = 3;

export interface BatchItem {
  file: File;
  status: "attesa" | "lettura" | "salvataggio" | "fatto" | "errore" | "saltato";
  /** Perché è andato storto, in italiano, da mostrare all'utente. */
  problem?: string;
  document?: StoredDocument;
}

export interface BatchProgress {
  items: BatchItem[];
  done: number;
  failed: number;
  total: number;
  /** Vero finché c'è ancora qualcosa in coda o in volo. */
  running: boolean;
}

/**
 * Legge e indicizza una pila di file, avvisando a ogni cambiamento.
 *
 * `onProgress` viene chiamata spesso: chi la usa deve limitarsi a mettere lo
 * stato in React, non a fare lavoro.
 *
 * Restituisce quando ha finito con tutti. Non solleva mai: i guasti dei singoli
 * file finiscono in `problem`, perché un file corrotto in mezzo a cinquecento
 * non è un errore del programma — è una cosa che succede.
 */
export async function indexAll(
  files: File[],
  onProgress: (progress: BatchProgress) => void,
  options: { organise?: boolean; signal?: AbortSignal } = {}
): Promise<BatchProgress> {
  const items: BatchItem[] = files.map((file) => ({
    file,
    status: isSupported(file) ? "attesa" : "saltato",
    problem: isSupported(file)
      ? undefined
      : `Non so leggere i file ${file.name.split(".").pop()?.toUpperCase() ?? "di questo tipo"}.`,
  }));

  const report = (running: boolean) =>
    onProgress({
      items: [...items],
      done: items.filter((i) => i.status === "fatto").length,
      failed: items.filter((i) => i.status === "errore" || i.status === "saltato").length,
      total: items.length,
      running,
    });

  report(true);

  // La coda è un indice condiviso: ogni lavoratore prende il prossimo libero.
  // Più semplice di spezzare l'elenco in tre parti, e non lascia un lavoratore
  // fermo mentre gli altri hanno ancora da fare — che è quello che succede se
  // per caso i file pesanti finiscono tutti nella stessa fetta.
  let next = 0;

  async function worker() {
    while (true) {
      if (options.signal?.aborted) return;
      const index = next++;
      if (index >= items.length) return;

      const item = items[index];
      if (item.status === "saltato") continue;

      try {
        item.status = "lettura";
        report(true);
        const { text, source } = await extract(item.file);

        if (options.signal?.aborted) return;

        item.status = "salvataggio";
        report(true);
        item.document = await addDocument({
          name: item.file.name,
          text,
          source,
          organise: options.organise,
        });
        item.status = "fatto";
      } catch (error) {
        item.status = "errore";
        item.problem = error instanceof Error ? error.message : String(error);
      }
      report(true);
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, worker));

  const final: BatchProgress = {
    items: [...items],
    done: items.filter((i) => i.status === "fatto").length,
    failed: items.filter((i) => i.status === "errore" || i.status === "saltato").length,
    total: items.length,
    running: false,
  };
  onProgress(final);
  return final;
}

/**
 * Tira fuori i file da un evento di trascinamento, **cartelle comprese**.
 *
 * ⚠️ `event.dataTransfer.files` contiene solo i file singoli: se uno trascina
 * una cartella, lì dentro c'è una voce sola e vuota. Per leggere una cartella
 * serve `webkitGetAsEntry()`, che ha un nome brutto ma funziona in tutti i
 * browser moderni — ed è l'unico modo di far funzionare «trascina una cartella
 * con 500 PDF», che è letteralmente quello che la riga 16 chiede.
 */
export async function filesFromDrop(dataTransfer: DataTransfer): Promise<File[]> {
  const entries = Array.from(dataTransfer.items)
    .map((item) => (item.kind === "file" ? asEntry(item) : null))
    .filter((e): e is FileSystemEntry => e !== null);

  // Nessun accesso alle cartelle (browser vecchio, o trascinamento da un'app):
  // si ripiega sull'elenco piatto, che almeno prende i file singoli.
  if (entries.length === 0) return Array.from(dataTransfer.files);

  const found: File[] = [];
  for (const entry of entries) await walk(entry, found);
  return found;
}

interface FileSystemEntry {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  file?: (cb: (file: File) => void, err: (e: unknown) => void) => void;
  createReader?: () => {
    readEntries: (cb: (entries: FileSystemEntry[]) => void, err: (e: unknown) => void) => void;
  };
}

function asEntry(item: DataTransferItem): FileSystemEntry | null {
  const withEntry = item as DataTransferItem & {
    webkitGetAsEntry?: () => FileSystemEntry | null;
  };
  return withEntry.webkitGetAsEntry?.() ?? null;
}

/** Scende in una cartella e in tutte quelle dentro, raccogliendo i file. */
async function walk(entry: FileSystemEntry, into: File[]): Promise<void> {
  // Un limite c'è, e va detto: oltre mille file il browser fa fatica e la
  // pazienza dell'utente pure. Meglio fermarsi con un numero noto che
  // rallentare all'infinito senza spiegare.
  if (into.length >= 1000) return;

  if (entry.isFile && entry.file) {
    const file = await new Promise<File | null>((resolve) => {
      entry.file!(resolve, () => resolve(null));
    });
    if (file) into.push(file);
    return;
  }

  if (entry.isDirectory && entry.createReader) {
    const reader = entry.createReader();
    // `readEntries` restituisce al massimo cento voci per chiamata: va
    // richiamato finché non torna vuoto. Chiamarlo una volta sola è il bug
    // classico di questa API, e si manifesta solo con cartelle grandi.
    while (true) {
      const batch = await new Promise<FileSystemEntry[]>((resolve) => {
        reader.readEntries(resolve, () => resolve([]));
      });
      if (batch.length === 0) break;
      for (const child of batch) await walk(child, into);
    }
  }
}

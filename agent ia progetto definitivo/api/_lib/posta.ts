/**
 * La posta collegata — il primo connettore dell'area azienda.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * PERCHÉ LA POSTA, E PERCHÉ IMAP
 * ─────────────────────────────────────────────────────────────────────────
 * Dal sopralluogo: la multifunzione dell'ufficio manda le scansioni via email
 * (scan-to-email), e ordini e richieste arrivano nella casella. Se CorpAgent
 * legge quella casella, le bolle entrano DA SOLE — che è la promessa fatta a
 * Salvatore.
 *
 * IMAP e non le API di Microsoft/Google perché funziona con QUALSIASI casella
 * (Outlook, Gmail, Aruba, PEC…) con solo host, utente e password: niente
 * registrazioni su Azure, niente OAuth da configurare. Per Gmail e Microsoft
 * si usa una «password per le app», che il titolare genera in un minuto.
 *
 * LE TRE REGOLE DEI CONNETTORI (le stesse di api/_lib/connectors.ts):
 * 1. Si PROVA prima di salvare — una password rotta salvata è un agente muto
 *    e nessuno sa perché.
 * 2. Il segreto NON ESCE MAI verso il browser: si cifra qui (AES-256-GCM) e
 *    la porta di stato non lo restituisce nemmeno cifrato.
 * 3. Un guasto si SEGNA appena succede (`az_posta_esito`): una casella rotta
 *    in silenzio è peggio di una mai collegata.
 */

import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { cifra, cifraByte, decifra, decifraByte } from "./connectors.js";
import { getPool } from "./db.js";

export interface ConfigPosta {
  host: string;
  porta: number;
  utente: string;
  password: string;
  cartella: string;
}

export interface StatoPosta {
  host: string;
  porta: number;
  utente: string;
  cartella: string;
  attivo: boolean;
  ultimo_controllo: string | null;
  ultimo_errore: string | null;
  scaricati: number;
}

export interface ArrivoPosta {
  id: string;
  ricevuto: string | null;
  mittente: string;
  oggetto: string;
  allegati: string[];
  corpo: string;
}

/** Non più di tanti messaggi per passata: una casella arretrata di mesi non
 *  deve far scadere la funzione (60s su Vercel). Il resto arriva al giro dopo. */
const MASSIMO_PER_PASSATA = 15;

/** I soli tipi di allegato che si tengono: quelli che una multifunzione
 *  produce e che il browser non esegue MAI. ⚠️ NON usare `image/*`: includerebbe
 *  `image/svg+xml`, che è HTML+script travestito da immagine. */
const TIPI_BOLLA = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/tiff",
  "application/pdf",
]);

function apriClient(c: { host: string; porta: number; utente: string; password: string }) {
  return new ImapFlow({
    host: c.host,
    port: c.porta,
    // 993 è IMAP su TLS diretto; le altre porte (143) partono in chiaro e
    // salgono con STARTTLS, che imapflow negozia da solo.
    secure: c.porta === 993,
    auth: { user: c.utente, pass: c.password },
    logger: false,
    socketTimeout: 25_000,
    greetingTimeout: 15_000,
  });
}

/**
 * Un indirizzo IP «di casa»: loopback, rete privata, link-local. Verso questi
 * non ci si collega MAI — non c'è un server di posta lì, c'è la rete interna.
 */
function ipInterno(ip: string): boolean {
  const v = ip.toLowerCase();
  if (v === "::1" || v === "0.0.0.0" || v.startsWith("127.")) return true; // loopback
  if (v.startsWith("10.") || v.startsWith("192.168.")) return true; // privati
  if (v.startsWith("169.254.") || v.startsWith("fe80:")) return true; // link-local
  if (v.startsWith("fc") || v.startsWith("fd")) return true; // ULA IPv6 (fc00::/7)
  const m = v.match(/^172\.(\d+)\./); // 172.16.0.0 – 172.31.255.255
  if (m && Number(m[1]) >= 16 && Number(m[1]) <= 31) return true;
  if (v.startsWith("::ffff:")) return ipInterno(v.slice(7)); // IPv4 mappato in IPv6
  return false;
}

/**
 * ⚠️ SICUREZZA (SSRF): host e porta li sceglie il titolare, e questa funzione
 * gira dentro la rete di Vercel. Senza controllo, «collega la posta» a
 * `10.0.0.5:6379` diventa una sonda per scoprire e raggiungere servizi interni.
 * Qui si RISOLVE l'host e si rifiutano gli indirizzi di casa; e la porta può
 * essere solo quella della posta (993 o 143). Un server di posta vero non
 * vive su un indirizzo privato né su una porta a caso.
 */
async function controllaBersaglio(host: string, porta: number): Promise<void> {
  if (porta !== 993 && porta !== 143) {
    throw new Error("La porta della posta è 993 (o 143). Un'altra porta non è una casella.");
  }
  const pulito = host.trim().toLowerCase();
  if (!pulito || pulito === "localhost" || pulito.endsWith(".localhost") || pulito.endsWith(".internal")) {
    throw new Error("Indirizzo del server non valido.");
  }
  // Se è già un IP, si controlla direttamente; se è un nome, si risolve.
  const indirizzi: string[] = isIP(pulito)
    ? [pulito]
    : (await lookup(pulito, { all: true }).catch(() => {
        throw new Error("Server non trovato: controlla l'indirizzo (es. imap.gmail.com).");
      })).map((r) => r.address);
  if (indirizzi.length === 0) throw new Error("Server non trovato: controlla l'indirizzo.");
  if (indirizzi.some(ipInterno)) {
    throw new Error("Questo indirizzo non è un server di posta raggiungibile da internet.");
  }
}

/**
 * Si connette e PRETENDE il TLS. Su porta 143 imapflow tenta STARTTLS, ma se
 * il server non lo offre prosegue in chiaro — e la password dell'ufficio
 * viaggerebbe nuda. Meglio nessun collegamento che un collegamento così.
 */
async function connettiSicuro(client: ImapFlow): Promise<void> {
  await client.connect();
  if (!client.secureConnection) {
    await client.logout().catch(() => {});
    throw new Error("Il server non offre una connessione cifrata (TLS). Usa la porta 993.");
  }
}

/**
 * Prova il collegamento SENZA salvare niente: si connette, entra, apre la
 * cartella, conta i messaggi, esce. Se qualcosa non va, l'errore torna in
 * italiano comprensibile — è quello che il titolare leggerà.
 */
export async function provaPosta(c: ConfigPosta): Promise<{ messaggi: number }> {
  await controllaBersaglio(c.host, c.porta);
  const client = apriClient(c);
  try {
    await connettiSicuro(client);
    const box = await client.mailboxOpen(c.cartella || "INBOX", { readOnly: true });
    return { messaggi: box.exists };
  } catch (e) {
    throw new Error(traduciErrore(e));
  } finally {
    // logout può fallire se la connessione è già morta: non deve coprire
    // l'errore vero.
    await client.logout().catch(() => {});
  }
}

/** Prova e POI salva (cifrando la password). L'ordine è la regola n. 1. */
export async function salvaPosta(azienda: string, c: ConfigPosta): Promise<{ messaggi: number }> {
  const esito = await provaPosta(c);
  await getPool().query("select public.az_posta_salva($1,$2,$3,$4,$5,$6)", [
    azienda,
    c.host.trim(),
    c.porta,
    c.utente.trim(),
    cifra(c.password),
    c.cartella.trim() || "INBOX",
  ]);
  return esito;
}

export async function statoPosta(azienda: string): Promise<StatoPosta | null> {
  const r = await getPool().query<StatoPosta>("select * from public.az_posta_stato($1)", [azienda]);
  return r.rows[0] ?? null;
}

export async function staccaPosta(azienda: string): Promise<void> {
  await getPool().query("select public.az_posta_stacca($1)", [azienda]);
}

export async function arriviPosta(azienda: string, limite = 20): Promise<ArrivoPosta[]> {
  const r = await getPool().query<ArrivoPosta>("select * from public.az_posta_arrivi($1,$2)", [
    azienda,
    limite,
  ]);
  return r.rows;
}

/**
 * Scarica i messaggi nuovi e li porta dentro: mittente, oggetto, corpo e
 * NOMI degli allegati (il contenuto degli allegati — l'OCR delle bolle — è il
 * passo dopo).
 *
 * ⚠️ «Nuovo» si misura con l'UID, NON con la spunta di lettura (migrazione
 * 0034). La casella dell'ufficio la apre anche una persona: se qualcuno
 * legge una mail in Outlook prima del giro serale, per IMAP è «letta» e col
 * vecchio criterio CorpAgent non l'avrebbe importata MAI — in silenzio. E
 * marcare noi «letto» sporcava la casella. Con l'UID si riparte sempre da
 * dov'eravamo rimasti, qualunque cosa facciano le persone con le spunte; se
 * il server cambia UIDVALIDITY gli UID salvati non valgono più (lo dice
 * IMAP) e si riparte da zero — i doppioni li ferma comunque il msgid unico.
 */
export async function scaricaPosta(azienda: string): Promise<{ nuovi: number; errore: string | null }> {
  const r = await getPool().query<{
    host: string;
    porta: number;
    utente: string;
    segreto_cifrato: string;
    cartella: string;
    attivo: boolean;
    ultimo_uid: string;
    uid_validita: string;
  }>("select * from public.az_posta_credenziali($1)", [azienda]);
  const cred = r.rows[0];
  if (!cred) return { nuovi: 0, errore: "Nessuna casella collegata." };
  if (!cred.attivo) return { nuovi: 0, errore: "Collegamento spento." };

  const password = decifra(cred.segreto_cifrato);
  if (!password) {
    const errore = "Credenziali illeggibili: ricollega la casella.";
    await getPool().query("select public.az_posta_esito($1,$2,$3)", [azienda, errore, 0]);
    return { nuovi: 0, errore };
  }

  // Anche qui si controlla il bersaglio: l'host fu validato al salvataggio, ma
  // un nome DNS può cambiare indirizzo nel frattempo (rebinding). Costa una
  // risoluzione, e chiude la porta a chi salvasse un host che diventa interno.
  try {
    await controllaBersaglio(cred.host, cred.porta);
  } catch (e) {
    const errore = e instanceof Error ? e.message : "Server non valido.";
    await getPool().query("select public.az_posta_esito($1,$2,$3)", [azienda, errore, 0]);
    return { nuovi: 0, errore };
  }

  const client = apriClient({ ...cred, password });
  let nuovi = 0;
  // Da dove si riparte, e fin dove si è arrivati in QUESTA passata: si salva
  // anche se la passata muore a metà, così non si rilavora quanto già fatto.
  let ultimoUid = Number(cred.ultimo_uid) || 0;
  let validitaSalvata = Number(cred.uid_validita) || 0;
  try {
    await connettiSicuro(client);
    const lock = await client.getMailboxLock(cred.cartella || "INBOX");
    try {
      const box = client.mailbox;
      const validita = box && typeof box === "object" ? Number(box.uidValidity ?? 0) : 0;
      if (validita !== validitaSalvata) {
        // Cassetta «rinata»: gli UID vecchi non significano più niente.
        ultimoUid = 0;
        validitaSalvata = validita;
      }
      // ⚠️ La ricerca «n:*» per contratto IMAP ritorna SEMPRE almeno l'ultimo
      // messaggio, anche se il suo UID è sotto n: il filtro dopo è d'obbligo.
      const uids = await client.search({ uid: `${ultimoUid + 1}:*` }, { uid: true });
      const daFare = (uids || [])
        .filter((u) => u > ultimoUid)
        .sort((a, b) => a - b)
        .slice(0, MASSIMO_PER_PASSATA);
      for (const uid of daFare) {
        const msg = await client.fetchOne(String(uid), { source: true }, { uid: true });
        if (msg && msg.source) {
          const posta = await simpleParser(msg.source);
          const allegati = (posta.attachments ?? [])
            .map((a) => a.filename || "")
            .filter(Boolean)
            .slice(0, 20);
          // Senza message-id (capita con scanner economici) se ne fabbrica uno
          // stabile da data+oggetto, così il doppione resta riconoscibile.
          const msgid =
            posta.messageId ||
            `senza-id:${posta.date?.toISOString() ?? ""}:${(posta.subject ?? "").slice(0, 80)}`;
          const inserito = await getPool().query<{ az_posta_arrivo: string | null }>(
            "select public.az_posta_arrivo($1,$2,$3,$4,$5,$6,$7)",
            [
              azienda,
              msgid.slice(0, 500),
              posta.date ?? null,
              posta.from?.text ?? "",
              posta.subject ?? "",
              allegati,
              (posta.text ?? "").trim(),
            ]
          );
          const arrivoId = inserito.rows[0]?.az_posta_arrivo;
          if (arrivoId != null) {
            nuovi++;
            // ⚠️ Gli allegati si salvano COI BYTE: sono le bolle scannerizzate,
            // e senza i byte non c'è niente da leggere. Fino a 4 MB l'uno e 5
            // per messaggio: una foto da 40 MB non è una bolla, è un errore.
            //
            // ⚠️ SICUREZZA: WHITELIST esatta dei tipi, NON `image/*`. La casella
            // è pubblica (scan-to-email), quindi il tipo lo decide un estraneo:
            // un `image/svg+xml` è un'immagine per il filtro ma un documento
            // che ESEGUE SCRIPT per il browser. Si accettano solo i formati
            // che una multifunzione produce davvero e che il browser non
            // esegue mai.
            for (const a of (posta.attachments ?? []).slice(0, 5)) {
              const tipo = (a.contentType || "").toLowerCase();
              const buono = TIPI_BOLLA.has(tipo);
              if (!buono || !a.content || a.content.length > 4_000_000) continue;
              // ⚠️ Si salvano CIFRATI: il documento scannerizzato è un dato
              // sensibile, e nel database ne vivono solo i byte cifrati.
              await getPool().query(
                "select public.az_posta_allegato_salva($1,$2,$3,$4,$5)",
                [azienda, arrivoId, a.filename || "documento", tipo, cifraByte(a.content)]
              );
            }
          }
        }
        // Anche un messaggio illeggibile fa avanzare il segnalibro: meglio
        // perderne uno strano che rimasticarlo a ogni giro per sempre.
        ultimoUid = uid;
      }
    } finally {
      lock.release();
    }
    await getPool().query("select public.az_posta_segna_uid($1,$2,$3)", [
      azienda,
      validitaSalvata,
      ultimoUid,
    ]);
    await getPool().query("select public.az_posta_esito($1,$2,$3)", [azienda, null, nuovi]);
    return { nuovi, errore: null };
  } catch (e) {
    const errore = traduciErrore(e);
    // Il segnalibro di quanto fatto prima dell'errore non si butta.
    await getPool()
      .query("select public.az_posta_segna_uid($1,$2,$3)", [azienda, validitaSalvata, ultimoUid])
      .catch(() => {});
    await getPool().query("select public.az_posta_esito($1,$2,$3)", [azienda, errore, nuovi]);
    return { nuovi, errore };
  } finally {
    await client.logout().catch(() => {});
  }
}

/** Il giro serale: ogni azienda con la posta accesa, una per una — e dopo lo
 *  scarico si LEGGONO le bolle in attesa (fino a 6 per azienda: il resto al
 *  giro dopo, o col tasto «Controlla adesso»). */
export async function scaricaPostaTutte(): Promise<{ azienda: string; nuovi: number; errore: string | null }[]> {
  const r = await getPool().query<{ azienda: string }>("select * from public.az_posta_accese()");
  const esiti: { azienda: string; nuovi: number; errore: string | null }[] = [];
  for (const { azienda } of r.rows) {
    const esito = await scaricaPosta(azienda).catch((e) => ({
      nuovi: 0,
      errore: traduciErrore(e),
    }));
    await leggiBolle(azienda, 6).catch(() => {});
    // E l'agente elabora le mail: classifica, scrive le bozze e — se acceso —
    // risponde alle facili. In prova prepara e basta.
    await elaboraPosta(azienda, 6).catch(() => {});
    esiti.push({ azienda, ...esito });
  }
  return esiti;
}

/** Da errore tecnico a frase che un titolare capisce. */
function traduciErrore(e: unknown): string {
  // ⚠️ imapflow NON scrive «auth» nel messaggio quando il login fallisce
  // (dice solo «Command failed»): lo segnala con questo flag. Scoperto al
  // collaudo con la casella di prova, non indovinato.
  if (e && typeof e === "object" && (e as { authenticationFailed?: boolean }).authenticationFailed)
    return "Utente o password sbagliati. Per Gmail e Outlook serve una «password per le app», non quella normale.";
  const testo = e instanceof Error ? e.message : String(e);
  const minuscolo = testo.toLowerCase();
  if (minuscolo.includes("auth") || minuscolo.includes("login") || minuscolo.includes("credentials"))
    return "Utente o password sbagliati. Per Gmail e Outlook serve una «password per le app», non quella normale.";
  if (minuscolo.includes("enotfound") || minuscolo.includes("getaddrinfo"))
    return "Server non trovato: controlla l'indirizzo (es. imap.gmail.com, outlook.office365.com).";
  if (minuscolo.includes("timeout") || minuscolo.includes("etimedout"))
    return "Il server non risponde: controlla indirizzo e porta (di solito 993).";
  if (minuscolo.includes("econnrefused"))
    return "Collegamento rifiutato: la porta è probabilmente sbagliata (di solito 993).";
  if (minuscolo.includes("certificate") || minuscolo.includes("tls") || minuscolo.includes("ssl"))
    return "Problema di sicurezza TLS col server: controlla host e porta.";
  if (minuscolo.includes("mailbox") && (minuscolo.includes("exist") || minuscolo.includes("select")))
    return "La cartella indicata non esiste sulla casella: prova con INBOX.";
  return "Collegamento non riuscito: " + testo.slice(0, 160);
}


// ─────────────────────────────────────────────────────────────────────────
// LA LETTURA DELLE BOLLE — dai byte ai dati
// ─────────────────────────────────────────────────────────────────────────

/** I dati che si provano a estrarre da una bolla. Tutto può essere null:
 *  meglio un campo vuoto che un campo inventato. */
export interface DatiBolla {
  tipo: string | null;
  mittente: string | null;
  destinatario: string | null;
  numero: string | null;
  data: string | null;
  colli: number | null;
  note: string | null;
}

/**
 * Trova il JPEG più grande annegato in un PDF di scansione.
 *
 * ⚠️ Le multifunzione fanno quasi tutte così: il PDF è solo una busta attorno
 * a un'immagine JPEG (flusso DCTDecode). Invece di renderizzare il PDF — che
 * su una funzione serverless vorrebbe un motore grafico che non c'è — si
 * cerca la firma JPEG (FFD8FF … FFD9) e si tira fuori l'immagine com'è.
 * Se il PDF è "vero" (testo vettoriale), qui non si trova niente e si passa
 * dalla via del testo.
 */
function estraiJpegDaPdf(pdf: Buffer): Buffer | null {
  let migliore: Buffer | null = null;
  let da = 0;
  for (;;) {
    const inizio = pdf.indexOf(Buffer.from([0xff, 0xd8, 0xff]), da);
    if (inizio === -1) break;
    const fine = pdf.indexOf(Buffer.from([0xff, 0xd9]), inizio + 3);
    if (fine === -1) break;
    const pezzo = pdf.subarray(inizio, fine + 2);
    if (!migliore || pezzo.length > migliore.length) migliore = pezzo;
    da = fine + 2;
  }
  // Sotto i 4 KB non è una scansione: è un'iconcina o un falso positivo.
  return migliore && migliore.length > 4_000 && migliore.length < 3_500_000 ? migliore : null;
}

/** Il testo di un PDF "vero" (con strato di testo), via unpdf. */
async function testoDaPdf(pdf: Buffer): Promise<string> {
  try {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const doc = await getDocumentProxy(new Uint8Array(pdf));
    const { text } = await extractText(doc, { mergePages: true });
    return (text ?? "").trim();
  } catch {
    return "";
  }
}

const ISTRUZIONI_LETTURA = [
  "Sei il lettore di documenti di un'azienda di trasporti italiana. Ti arriva",
  "un documento (di solito una bolla di consegna/DDT, a volte una fattura o",
  "un ordine), come immagine scannerizzata o come testo.",
  "",
  "Rispondi SOLO con un oggetto JSON, senza altro testo attorno:",
  '{"tipo":"bolla|fattura|ordine|altro","mittente":string|null,',
  '"destinatario":string|null,"numero":string|null,"data":string|null,',
  '"colli":number|null,"note":string|null,"testo":string}',
  "",
  "REGOLE:",
  "- \"testo\" è la trascrizione fedele di quello che leggi (max ~1500 caratteri).",
  "- null dove non leggi con certezza. NON INVENTARE MAI niente:",
  "  un numero di colli sbagliato è un collo perso in magazzino.",
  "- \"data\" in formato YYYY-MM-DD se leggibile, altrimenti null.",
].join("\n");

/** Una chiamata di lettura al modello: immagine o testo, fuori JSON. */
async function chiediAlModello(
  contenuto: { immagine: string } | { testo: string }
): Promise<{ dati: DatiBolla; testo: string } | null> {
  const chiave = process.env.OPENROUTER_API_KEY;
  if (!chiave) return null;
  const user =
    "immagine" in contenuto
      ? [
          { type: "text", text: "Leggi questo documento scannerizzato." },
          { type: "image_url", image_url: { url: contenuto.immagine } },
        ]
      : [{ type: "text", text: "Leggi questo documento (testo estratto dal PDF):\n\n" + contenuto.testo.slice(0, 6000) }];
  try {
    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${chiave}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://corpagent.vercel.app",
        "X-Title": "CorpAgent · Lettura bolle",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        max_tokens: 900,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: ISTRUZIONI_LETTURA },
          { role: "user", content: user },
        ],
      }),
      signal: AbortSignal.timeout(30_000),
    });
    const body = (await r.json()) as { choices?: { message?: { content?: string } }[] };
    const grezzo = body.choices?.[0]?.message?.content?.trim();
    if (!grezzo) return null;
    const j = JSON.parse(grezzo) as Record<string, unknown>;
    const testo = typeof j.testo === "string" ? j.testo : "";
    const dati: DatiBolla = {
      tipo: typeof j.tipo === "string" ? j.tipo : null,
      mittente: typeof j.mittente === "string" ? j.mittente : null,
      destinatario: typeof j.destinatario === "string" ? j.destinatario : null,
      numero: typeof j.numero === "string" || typeof j.numero === "number" ? String(j.numero) : null,
      data: typeof j.data === "string" ? j.data : null,
      colli: typeof j.colli === "number" && Number.isFinite(j.colli) ? Math.trunc(j.colli) : null,
      note: typeof j.note === "string" ? j.note : null,
    };
    return { dati, testo };
  } catch {
    return null;
  }
}

/**
 * Legge gli allegati ancora `nuovo` di un'azienda, pochi per volta.
 *
 * ⚠️ Ogni lettura è una chiamata al modello (secondi, non millisecondi):
 * `massimo` tiene la passata dentro il tempo di una funzione Vercel. Quello
 * che non si legge ora si legge al giro dopo — o resta `illeggibile` CON IL
 * PERCHÉ scritto, mai un fallimento muto.
 */
export async function leggiBolle(
  azienda: string,
  massimo = 3
): Promise<{ lette: number; illeggibili: number }> {
  const r = await getPool().query<{ id: string; nome: string; tipo: string; dati: Buffer }>(
    "select * from public.az_posta_da_leggere($1,$2)",
    [azienda, massimo]
  );
  let lette = 0;
  let illeggibili = 0;
  for (const allegato of r.rows) {
    let esito: { dati: DatiBolla; testo: string } | null = null;
    let perche = "";
    // I byte arrivano cifrati: si decifrano SOLO qui, in memoria, per leggerli.
    const dati = decifraByte(allegato.dati);
    if (!dati) {
      await getPool().query("select public.az_posta_allegato_letto($1,$2,$3,$4,$5)", [
        azienda,
        Number(allegato.id),
        "illeggibile",
        "Documento illeggibile (chiave di cifratura cambiata?).",
        null,
      ]);
      illeggibili++;
      continue;
    }
    if (allegato.tipo.startsWith("image/")) {
      esito = await chiediAlModello({
        immagine: `data:${allegato.tipo};base64,${dati.toString("base64")}`,
      });
      if (!esito) perche = "Il modello di lettura non ha risposto. Si riproverà.";
    } else {
      // PDF: prima la via del testo (gratis e fedele), poi la scansione.
      const testo = await testoDaPdf(dati);
      if (testo.length > 40) {
        esito = await chiediAlModello({ testo });
        if (!esito) perche = "Il modello di lettura non ha risposto. Si riproverà.";
      } else {
        const jpeg = estraiJpegDaPdf(dati);
        if (jpeg) {
          esito = await chiediAlModello({
            immagine: `data:image/jpeg;base64,${jpeg.toString("base64")}`,
          });
          if (!esito) perche = "Il modello di lettura non ha risposto. Si riproverà.";
        } else {
          perche = "PDF senza testo né immagine estraibile: impostare la multifunzione su JPEG o PDF immagine.";
        }
      }
    }
    if (esito) {
      // La trascrizione è il contenuto del documento: si salva CIFRATA. I dati
      // strutturati (bolla jsonb: mittente, numero, colli) restano in chiaro —
      // sono i metadati che la banchina deve poter leggere per lavorare, come
      // le letture degli scanner; il documento pieno (byte + testo) è cifrato.
      await getPool().query("select public.az_posta_allegato_letto($1,$2,$3,$4,$5)", [
        azienda,
        Number(allegato.id),
        "letto",
        cifra(esito.testo),
        JSON.stringify(esito.dati),
      ]);
      lette++;
    } else if (perche.includes("riproverà")) {
      // Guasto temporaneo: resta `nuovo`, il prossimo giro riprova da sé.
      illeggibili++;
    } else {
      await getPool().query("select public.az_posta_allegato_letto($1,$2,$3,$4,$5)", [
        azienda,
        Number(allegato.id),
        "illeggibile",
        perche,
        null,
      ]);
      illeggibili++;
    }
  }
  return { lette, illeggibili };
}

export interface BollaElenco {
  id: string;
  arrivo: string;
  nome: string;
  tipo: string;
  stato: string;
  letto: string;
  bolla: DatiBolla | null;
  creato: string;
  kb: number;
}

export async function bolle(azienda: string, limite = 30): Promise<BollaElenco[]> {
  const r = await getPool().query<BollaElenco>("select * from public.az_posta_bolle($1,$2)", [
    azienda,
    limite,
  ]);
  // La trascrizione (`letto`) delle bolle LETTE è cifrata: si decifra qui e si
  // taglia per la vista. Per le bolle `illeggibili`, `letto` è un messaggio di
  // sistema in chiaro (il perché) e si lascia com'è.
  return r.rows.map((b) => {
    if (b.stato === "letto" && b.letto) {
      const chiaro = decifra(b.letto);
      return { ...b, letto: (chiaro ?? "").slice(0, 2000) };
    }
    return b;
  });
}

export async function allegato(
  azienda: string,
  id: number
): Promise<{ nome: string; tipo: string; dati: Buffer } | null> {
  const r = await getPool().query<{ nome: string; tipo: string; dati: Buffer }>(
    "select * from public.az_posta_allegato($1,$2)",
    [azienda, id]
  );
  const a = r.rows[0];
  if (!a) return null;
  // I byte escono cifrati dal database: si decifrano solo per servirli. Se la
  // chiave non torna, meglio niente che byte spazzatura.
  const dati = decifraByte(a.dati);
  if (!dati) return null;
  return { nome: a.nome, tipo: a.tipo, dati };
}

// ─────────────────────────────────────────────────────────────────────────
// L'AGENTE CHE RISPONDE ALLE MAIL FACILI
// ─────────────────────────────────────────────────────────────────────────
//
// Tommaso: «senza approvare, legge le mail e risponde a quelle facili». Il
// confine non è l'approvazione a mano — è che l'agente risponde DA SOLO solo
// alle categorie facili, e le difficili (prezzi, sconti, reclami) le gira a
// una persona. Non manda cavolate perché non tocca mai le cose delicate.

import nodemailer from "nodemailer";

export type ModoAuto = "spento" | "prova" | "acceso";
export interface StatoAuto {
  auto_modo: ModoAuto;
  auto_categorie: string[];
  smtp_host: string | null;
  smtp_porta: number | null;
}
export interface RispostaMail {
  id: string;
  ricevuto: string | null;
  mittente: string;
  oggetto: string;
  classe: string | null;
  bozza: string | null;
  risposta_stato: string; // bozza | mandata | umano
  risposta_quando: string | null;
}

/** Le categorie a cui l'agente PUÒ rispondere da solo. Tutto il resto è «umano». */
const CATEGORIE_FACILI = new Set(["conferme", "info", "stato", "prenotazione"]);

/** L'indirizzo email dentro un mittente tipo `Nome <mail@x.it>`, minuscolo. */
function estraiEmail(mittente: string): string {
  const m = mittente.match(/<([^>]+)>/);
  return (m ? m[1] : mittente).trim().toLowerCase();
}

/**
 * ⚠️ NON si risponde a questi, MAI — o si innesca un ping-pong senza fine:
 * - il PROPRIO indirizzo (una nostra risposta rientrata in casella): l'agente
 *   risponderebbe a sé stesso all'infinito. È il classico loop dei risponditori
 *   automatici, e l'abbiamo visto succedere davvero in collaudo;
 * - i mittenti automatici (no-reply, mailer-daemon, postmaster…): dietro non
 *   c'è nessuno che legge, e spesso rimbalzano a loro volta.
 */
function daIgnorare(mittente: string, nostro: string): boolean {
  const email = estraiEmail(mittente);
  if (!email) return true;
  if (nostro && email === nostro.trim().toLowerCase()) return true;
  return /no.?reply|do.?not.?reply|mailer-daemon|postmaster|mail.?delivery|notifications?@|automated/.test(email);
}

/**
 * Dall'indirizzo IMAP a quello SMTP dello stesso fornitore. La casella è la
 * stessa (stesso utente e password): cambia solo la porta di uscita.
 */
function smtpDaImap(host: string): { host: string; porta: number; sicuro: boolean } {
  const h = host.trim().toLowerCase();
  if (h.includes("gmail")) return { host: "smtp.gmail.com", porta: 587, sicuro: false };
  if (h.includes("office365") || h.includes("outlook")) return { host: "smtp.office365.com", porta: 587, sicuro: false };
  if (h.includes("pec.aruba")) return { host: "smtps.pec.aruba.it", porta: 465, sicuro: true };
  if (h.includes("aruba")) return { host: "smtps.aruba.it", porta: 465, sicuro: true };
  // Generico: imap.dominio → smtp.dominio, STARTTLS su 587.
  return { host: h.replace(/^imaps?\./, "smtp."), porta: 587, sicuro: false };
}

/** I documenti dell'azienda in chiaro (decifrati): il contesto per rispondere. */
async function documentiInChiaro(azienda: string): Promise<{ titolo: string; testo: string }[]> {
  const r = await getPool().query<{ titolo: string; testo: string }>(
    "select * from public.az_documenti($1)",
    [azienda]
  );
  return r.rows.map((d) => ({ titolo: d.titolo, testo: decifra(d.testo) ?? d.testo }));
}

const ISTRUZIONI_RISPOSTA = [
  "Sei l'assistente della posta di Speed Trasporti, azienda di trasporti e",
  "logistica di Torino. Leggi una mail arrivata e decidi se puoi rispondere TU,",
  "da solo, oppure se va girata a una persona.",
  "",
  "Rispondi SOLO con un oggetto JSON:",
  '{"classe":"conferme|info|stato|prenotazione|umano","bozza":string|null}',
  "",
  "LE CATEGORIE A CUI PUOI RISPONDERE DA SOLO:",
  "- conferme: ringraziamenti, «avete ricevuto?», conferme di ricezione.",
  "- info: orari, indirizzo, come funziona un ritiro — cose scritte nei documenti.",
  "- stato: «dov'è la mia spedizione?». Rispondi SOLO se l'informazione è nei",
  "  documenti/dati qui sotto; se non ce l'hai, scrivi una bozza interlocutoria",
  "  («stiamo verificando, le facciamo sapere a breve») — MAI inventare una posizione.",
  "- prenotazione: «potete passare martedì?» — conferma la presa in carico della",
  "  richiesta di ritiro, SENZA promettere un orario preciso se non è certo.",
  "",
  "METTI SEMPRE 'umano' (e bozza null) SE la mail riguarda:",
  "- prezzi, preventivi, sconti, trattative economiche;",
  "- reclami, contestazioni, danni, ritardi contestati;",
  "- questioni legali, contratti, pagamenti;",
  "- qualsiasi cosa ambigua o che non sai rispondere con CERTEZZA dai documenti.",
  "Nel dubbio, 'umano'. È sempre meglio far rispondere una persona che sbagliare.",
  "",
  "REGOLE PER LA BOZZA (se rispondi tu):",
  "- Italiano, cortese e corto, come un impiegato sveglio dell'ufficio.",
  "- Firma «Speed Trasporti». Niente numeri, prezzi, date o impegni inventati.",
  "- Usa solo ciò che è scritto nei documenti qui sotto.",
].join("\n");

/** Classifica una mail e, se facile, scrive la bozza. Ritorna null se il modello è spento/muto. */
async function classificaEbozza(
  mail: { mittente: string; oggetto: string; corpo: string },
  documenti: { titolo: string; testo: string }[]
): Promise<{ classe: string; bozza: string | null } | null> {
  const chiave = process.env.OPENROUTER_API_KEY;
  if (!chiave) return null;
  const contesto = documenti.length
    ? documenti.map((d) => `### ${d.titolo}\n${d.testo}`).join("\n\n").slice(0, 6000)
    : "(nessun documento aziendale caricato)";
  const utente =
    `DOCUMENTI DELL'AZIENDA:\n${contesto}\n\n` +
    `MAIL ARRIVATA:\nDa: ${mail.mittente}\nOggetto: ${mail.oggetto}\n\n${(mail.corpo || "").slice(0, 3000)}`;
  try {
    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${chiave}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://corpagent.vercel.app",
        "X-Title": "CorpAgent · Risposte posta",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        max_tokens: 500,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: ISTRUZIONI_RISPOSTA },
          { role: "user", content: utente },
        ],
      }),
      signal: AbortSignal.timeout(30_000),
    });
    const body = (await r.json()) as { choices?: { message?: { content?: string } }[] };
    const grezzo = body.choices?.[0]?.message?.content?.trim();
    if (!grezzo) return null;
    const j = JSON.parse(grezzo) as { classe?: string; bozza?: string | null };
    const classe = typeof j.classe === "string" ? j.classe : "umano";
    const bozza = typeof j.bozza === "string" && j.bozza.trim() ? j.bozza.trim() : null;
    // ⚠️ Rete di sicurezza: se il modello mette una categoria facile ma senza
    // bozza, o una categoria che non conosciamo, si gira a una persona.
    if (!CATEGORIE_FACILI.has(classe) || !bozza) return { classe: "umano", bozza: null };
    return { classe, bozza };
  } catch {
    return null;
  }
}

/** Manda davvero una mail via SMTP (stessa casella IMAP). */
async function mandaMail(
  cred: { host: string; utente: string; password: string },
  a: { destinatario: string; oggetto: string; corpo: string }
): Promise<void> {
  const s = smtpDaImap(cred.host);
  const transport = nodemailer.createTransport({
    host: s.host,
    port: s.porta,
    secure: s.sicuro,
    requireTLS: !s.sicuro, // su 587 si pretende STARTTLS: la password non viaggia in chiaro
    auth: { user: cred.utente, pass: cred.password },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
  });
  await transport.sendMail({
    from: cred.utente,
    to: a.destinatario,
    subject: a.oggetto,
    text: a.corpo,
  });
}

/**
 * Elabora le mail nuove di un'azienda: le classifica, scrive le bozze e — solo
 * se la modalità è «acceso» e la categoria è abilitata — le manda. In «prova»
 * scrive e basta; le difficili le gira sempre a una persona.
 */
export async function elaboraPosta(azienda: string, massimo = 5): Promise<{ bozze: number; mandate: number; umane: number }> {
  const cfg = await getPool().query<StatoAuto>("select * from public.az_posta_auto_stato($1)", [azienda]);
  const stato = cfg.rows[0];
  if (!stato || stato.auto_modo === "spento") return { bozze: 0, mandate: 0, umane: 0 };

  const nuove = await getPool().query<{ id: string; mittente: string; oggetto: string; corpo: string }>(
    "select * from public.az_posta_da_elaborare($1,$2)",
    [azienda, massimo]
  );
  if (nuove.rows.length === 0) return { bozze: 0, mandate: 0, umane: 0 };

  const documenti = await documentiInChiaro(azienda);
  const categorie = new Set(stato.auto_categorie ?? []);

  // Le credenziali: l'utente serve SEMPRE (per non rispondere a sé stessi); la
  // password solo se si manda davvero (modalità acceso).
  const cr = await getPool().query<{ host: string; utente: string; segreto_cifrato: string }>(
    "select * from public.az_posta_credenziali($1)",
    [azienda]
  );
  const c = cr.rows[0];
  const nostro = c?.utente ?? "";
  let cred: { host: string; utente: string; password: string } | null = null;
  if (stato.auto_modo === "acceso" && c) {
    const pw = decifra(c.segreto_cifrato);
    if (pw) cred = { host: c.host, utente: c.utente, password: pw };
  }

  let bozze = 0, mandate = 0, umane = 0;
  for (const mail of nuove.rows) {
    // ⚠️ Prima di tutto: non è una mail a cui si risponde (nostra, o automatica)?
    if (daIgnorare(mail.mittente, nostro)) {
      await getPool().query("select public.az_posta_risposta_salva($1,$2,$3,$4,$5)", [
        azienda, Number(mail.id), "ignorata", null, "ignorata",
      ]);
      continue;
    }
    const esito = await classificaEbozza(mail, documenti).catch(() => null);
    if (!esito) continue; // modello muto: si riproverà al giro dopo (resta 'nuovo')
    if (esito.classe === "umano" || !esito.bozza) {
      await getPool().query("select public.az_posta_risposta_salva($1,$2,$3,$4,$5)", [
        azienda, Number(mail.id), "umano", null, "umano",
      ]);
      umane++;
      continue;
    }
    // Categoria facile con bozza. Si manda solo se ACCESO e categoria abilitata.
    const puoMandare = stato.auto_modo === "acceso" && categorie.has(esito.classe) && cred;
    if (puoMandare && cred) {
      try {
        await mandaMail(cred, {
          destinatario: mail.mittente,
          oggetto: mail.oggetto.toLowerCase().startsWith("re:") ? mail.oggetto : `Re: ${mail.oggetto}`,
          corpo: esito.bozza,
        });
        await getPool().query("select public.az_posta_risposta_salva($1,$2,$3,$4,$5)", [
          azienda, Number(mail.id), esito.classe, cifra(esito.bozza), "mandata",
        ]);
        mandate++;
      } catch {
        // Invio fallito: si tiene la bozza (non si perde il lavoro dell'agente).
        await getPool().query("select public.az_posta_risposta_salva($1,$2,$3,$4,$5)", [
          azienda, Number(mail.id), esito.classe, cifra(esito.bozza), "bozza",
        ]);
        bozze++;
      }
    } else {
      // Prova, o categoria non abilitata: si salva la bozza, non si manda.
      await getPool().query("select public.az_posta_risposta_salva($1,$2,$3,$4,$5)", [
        azienda, Number(mail.id), esito.classe, cifra(esito.bozza), "bozza",
      ]);
      bozze++;
    }
  }
  return { bozze, mandate, umane };
}

export async function statoAuto(azienda: string): Promise<StatoAuto | null> {
  const r = await getPool().query<StatoAuto>("select * from public.az_posta_auto_stato($1)", [azienda]);
  return r.rows[0] ?? null;
}

export async function salvaAuto(azienda: string, modo: ModoAuto, categorie: string[]): Promise<void> {
  // L'SMTP si deriva dalla casella IMAP e si salva per mostrarlo/usarlo.
  const cr = await getPool().query<{ host: string }>("select host from public.az_posta_credenziali($1)", [azienda]);
  const host = cr.rows[0]?.host ?? "";
  const s = host ? smtpDaImap(host) : { host: null as string | null, porta: null as number | null };
  await getPool().query("select public.az_posta_auto_salva($1,$2,$3,$4,$5)", [
    azienda,
    modo,
    categorie.filter((c) => CATEGORIE_FACILI.has(c)),
    s.host,
    s.porta,
  ]);
}

export async function risposte(azienda: string, limite = 30): Promise<RispostaMail[]> {
  const r = await getPool().query<RispostaMail>("select * from public.az_posta_risposte($1,$2)", [azienda, limite]);
  // La bozza è cifrata: si decifra per mostrarla.
  return r.rows.map((x) => ({ ...x, bozza: x.bozza ? decifra(x.bozza) : null }));
}

/** Manda a mano una bozza (in prova): il titolare l'ha letta e vuole spedirla. */
export async function mandaBozza(azienda: string, id: number): Promise<{ ok: boolean; errore: string | null }> {
  const r = await getPool().query<{ mittente: string; oggetto: string; bozza: string; classe: string; risposta_stato: string }>(
    "select * from public.az_posta_bozza($1,$2)",
    [azienda, id]
  );
  const b = r.rows[0];
  if (!b) return { ok: false, errore: "Bozza non trovata." };
  if (b.risposta_stato === "mandata") return { ok: false, errore: "Già mandata." };
  const testo = b.bozza ? decifra(b.bozza) : null;
  if (!testo) return { ok: false, errore: "Bozza vuota o illeggibile." };
  const cr = await getPool().query<{ host: string; utente: string; segreto_cifrato: string }>(
    "select * from public.az_posta_credenziali($1)",
    [azienda]
  );
  const c = cr.rows[0];
  const pw = c ? decifra(c.segreto_cifrato) : null;
  if (!c || !pw) return { ok: false, errore: "Casella non collegata." };
  try {
    await mandaMail(
      { host: c.host, utente: c.utente, password: pw },
      { destinatario: b.mittente, oggetto: b.oggetto.toLowerCase().startsWith("re:") ? b.oggetto : `Re: ${b.oggetto}`, corpo: testo }
    );
    await getPool().query("select public.az_posta_mandata($1,$2)", [azienda, id]);
    return { ok: true, errore: null };
  } catch (e) {
    return { ok: false, errore: e instanceof Error ? traduciErrore(e) : "Invio non riuscito." };
  }
}

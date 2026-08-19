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
import { cifra, cifraByte, decifra, decifraByte, firma, firmaValida } from "./connectors.js";
import { cercaSpedizione, clienti as clientiAzienda, salvaCliente } from "./azienda.js";
import { getPool } from "./db.js";

const GRAPH = "https://graph.microsoft.com/v1.0";
const MS_AUTORIZZA = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const MS_GETTONE = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
// Mail.Send in più rispetto al connettore Microsoft personale (kind
// "microsoft" in connectors.ts, che non manda posta): qui l'agente deve
// poter rispondere e sollecitare, non solo leggere.
const MS_PERMESSI = "offline_access User.Read Mail.Read Mail.Send";

export interface ConfigPosta {
  host: string;
  porta: number;
  utente: string;
  password: string;
  cartella: string;
  /** Come firma le risposte: "Speed Trasporti" invece del solo indirizzo nudo. */
  nomeMittente?: string;
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
  metodo: "imap" | "oauth";
  nome_mittente: string;
}

interface CredPosta {
  host: string;
  porta: number;
  utente: string;
  segreto_cifrato: string;
  cartella: string;
  attivo: boolean;
  metodo: "imap" | "oauth";
  oauth_access_cifrato: string | null;
  oauth_refresh_cifrato: string | null;
  oauth_scade: string | null;
  oauth_delta_link: string | null;
  nome_mittente: string;
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

// ─────────────────────────────────────────────────────────────────────────
// OUTLOOK CON UN CLIC — Microsoft Graph invece della password per le app
// ─────────────────────────────────────────────────────────────────────────
//
// ⚠️ PERCHÉ IL BIGLIETTO PORTA L'IDENTITÀ DENTRO DI SÉ
// ─────────────────────────────────────────────────────────────────────────
// L'ingresso di Speed non è un cookie del browser: è un gettone che il
// codice manda a mano in un'intestazione (`x-azienda-sessione`). Quel
// gettone NON torna da solo quando Microsoft rimanda l'utente su
// `/api/profile` con un `?code=...`. Quindi l'identità (quale azienda) deve
// stare DENTRO il biglietto firmato, non in una sessione che nel frattempo
// è sparita.

function bigliettoPosta(azienda: string): string {
  const corpo = `${azienda}|${Date.now()}`;
  return `${Buffer.from(corpo).toString("base64url")}.${firma(corpo)}`;
}

/** null se il biglietto è scaduto (10 minuti) o manomesso. */
function bigliettoPostaValido(stato: string): string | null {
  try {
    const [parte, sigillo] = stato.split(".");
    const corpo = Buffer.from(parte, "base64url").toString("utf8");
    if (!sigillo || !firmaValida(corpo, sigillo)) return null;
    const [azienda, quando] = corpo.split("|");
    if (!azienda || Date.now() - Number(quando) > 10 * 60 * 1000) return null;
    return azienda;
  } catch {
    return null;
  }
}

/** Un biglietto che comincia così è il ritorno dell'OAuth della posta, non
 *  quello di un connettore personale (che passa da connectors.ts). */
export function eBigliettoPosta(stato: string): boolean {
  return bigliettoPostaValido(stato) !== null;
}

/** Dove mandare il titolare per dire «autorizzo» a Microsoft. */
export function avviaAccessoPosta(azienda: string, ritorno: string): { url: string } | { errore: string } {
  const clientId = process.env.MS365_CLIENT_ID;
  if (!clientId) {
    return { errore: "CorpAgent non è ancora registrata presso Microsoft per questo." };
  }
  const p = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: ritorno,
    response_mode: "query",
    scope: MS_PERMESSI,
    state: bigliettoPosta(azienda),
  });
  return { url: `${MS_AUTORIZZA}?${p.toString()}` };
}

/** Il ritorno da Microsoft: scambia il codice, legge l'indirizzo vero, salva. */
export async function concludiAccessoPosta(
  codice: string,
  stato: string,
  ritorno: string
): Promise<{ ok: true; azienda: string; utente: string } | { ok: false; perche: string }> {
  const azienda = bigliettoPostaValido(stato);
  if (!azienda) return { ok: false, perche: "La richiesta è scaduta o non valida. Riprova a collegare." };

  const clientId = process.env.MS365_CLIENT_ID;
  const clientSecret = process.env.MS365_CLIENT_SECRET;
  if (!clientId || !clientSecret) return { ok: false, perche: "Connettore non configurato." };

  try {
    const r = await fetch(MS_GETTONE, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: codice,
        grant_type: "authorization_code",
        redirect_uri: ritorno,
      }).toString(),
      signal: AbortSignal.timeout(15_000),
    });
    const corpo = (await r.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      error_description?: string;
    };
    if (!r.ok || !corpo.access_token) {
      return { ok: false, perche: corpo.error_description ?? `Microsoft ha risposto ${r.status}.` };
    }

    const chiSono = await fetch(`${GRAPH}/me?$select=mail,userPrincipalName`, {
      headers: { Authorization: `Bearer ${corpo.access_token}` },
      signal: AbortSignal.timeout(10_000),
    });
    const persona = (await chiSono.json().catch(() => ({}))) as {
      mail?: string;
      userPrincipalName?: string;
    };
    const utente = persona.mail || persona.userPrincipalName || "";
    if (!chiSono.ok || !utente) {
      return { ok: false, perche: "Microsoft non ha detto quale indirizzo è." };
    }

    const scade = new Date(Date.now() + (corpo.expires_in ?? 3600) * 1000);
    await getPool().query("select public.az_posta_salva_oauth($1,$2,$3,$4,$5)", [
      azienda,
      utente,
      cifra(corpo.access_token),
      corpo.refresh_token ? cifra(corpo.refresh_token) : null,
      scade,
    ]);

    return { ok: true, azienda, utente };
  } catch (error) {
    return { ok: false, perche: `Non risponde: ${String(error).slice(0, 160)}` };
  }
}

/**
 * Un gettone d'accesso valido, rinnovando con quello di rinnovo se serve.
 * ⚠️ Non lancia mai: torna `null` se non c'è più modo di parlare con
 * Microsoft, e chi chiama decide come dirlo (segna il guasto, o rinuncia).
 */
async function gettoneValidoPosta(azienda: string, c: CredPosta): Promise<string | null> {
  const scade = c.oauth_scade ? new Date(c.oauth_scade).getTime() : 0;
  if (scade - Date.now() > 60_000) {
    const attuale = decifra(c.oauth_access_cifrato);
    if (attuale) return attuale;
  }

  const refresh = decifra(c.oauth_refresh_cifrato);
  const clientId = process.env.MS365_CLIENT_ID;
  const clientSecret = process.env.MS365_CLIENT_SECRET;
  if (!refresh || !clientId || !clientSecret) return null;

  try {
    const r = await fetch(MS_GETTONE, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refresh,
        grant_type: "refresh_token",
      }).toString(),
      signal: AbortSignal.timeout(15_000),
    });
    const corpo = (await r.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };
    if (!r.ok || !corpo.access_token) return null;

    const scadeNuovo = new Date(Date.now() + (corpo.expires_in ?? 3600) * 1000);
    await getPool().query("select public.az_posta_oauth_aggiorna($1,$2,$3,$4)", [
      azienda,
      cifra(corpo.access_token),
      corpo.refresh_token ? cifra(corpo.refresh_token) : null,
      scadeNuovo,
    ]);
    return corpo.access_token;
  } catch {
    return null;
  }
}

/** Manda una risposta o un promemoria con l'account Outlook collegato, senza SMTP. */
async function mandaMailGraph(
  token: string,
  a: { destinatario: string; oggetto: string; corpo: string }
): Promise<void> {
  const r = await fetch(`${GRAPH}/me/sendMail`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        subject: a.oggetto,
        body: { contentType: "Text", content: a.corpo },
        toRecipients: [{ emailAddress: { address: a.destinatario } }],
      },
      saveToSentItems: true,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!r.ok) throw new Error(`Microsoft Graph ha risposto ${r.status} all'invio.`);
}

/**
 * L'invio, con la strada giusta a seconda di come è collegata la casella:
 * password (SMTP) o l'accesso Microsoft (Graph). Chi chiama non deve saperlo.
 */
async function inviaMail(
  azienda: string,
  c: CredPosta,
  a: { destinatario: string; oggetto: string; corpo: string }
): Promise<void> {
  if (c.metodo === "oauth") {
    const token = await gettoneValidoPosta(azienda, c);
    if (!token) throw new Error("Outlook non è più autorizzato: ricollega la casella.");
    await mandaMailGraph(token, a);
    return;
  }
  const password = decifra(c.segreto_cifrato);
  if (!password) throw new Error("Credenziali illeggibili: ricollega la casella.");
  await mandaMail({ host: c.host, utente: c.utente, password, nomeMittente: c.nome_mittente }, a);
}

/** Prova e POI salva (cifrando la password). L'ordine è la regola n. 1. */
export async function salvaPosta(azienda: string, c: ConfigPosta): Promise<{ messaggi: number }> {
  const esito = await provaPosta(c);
  await getPool().query("select public.az_posta_salva($1,$2,$3,$4,$5,$6,$7)", [
    azienda,
    c.host.trim(),
    c.porta,
    c.utente.trim(),
    cifra(c.password),
    c.cartella.trim() || "INBOX",
    (c.nomeMittente ?? "").trim(),
  ]);
  return esito;
}

/** Solo il nome con cui firmano le risposte, senza toccare il resto. */
export async function salvaNomeMittente(azienda: string, nome: string): Promise<void> {
  await getPool().query("select public.az_posta_nome_mittente($1,$2)", [azienda, nome.trim()]);
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
 * Cerca in TUTTE le mail arrivate, non solo quelle classificate come bolle
 * (mittente, oggetto, corpo): serve all'agente per «cosa mi ha scritto X?»,
 * «c'è un reclamo di Y?» — qualunque cosa scritta in una mail vera.
 */
export async function cercaMail(
  azienda: string,
  termine: string,
  limite = 10
): Promise<{ id: string; ricevuto: string | null; mittente: string; oggetto: string; corpo: string }[]> {
  const r = await getPool().query(
    "select * from public.az_posta_arrivi_cerca($1,$2,$3)",
    [azienda, termine, limite]
  );
  return r.rows;
}

interface MessaggioGraph {
  id: string;
  subject?: string;
  from?: { emailAddress?: { address?: string; name?: string } };
  receivedDateTime?: string;
  internetMessageId?: string;
  hasAttachments?: boolean;
  body?: { content?: string };
  "@removed"?: unknown;
}

interface AllegatoGraph {
  "@odata.type"?: string;
  name?: string;
  contentType?: string;
  contentBytes?: string;
  size?: number;
}

/**
 * Lo stesso di `scaricaPosta`, ma per Outlook collegato con Microsoft Graph
 * invece di IMAP. Stessa regola di fondo: NON si usa "letto/non letto" come
 * segnalibro (un titolare che apre la mail in Outlook prima del giro serale
 * la farebbe sparire in silenzio) — si usa la query "delta" di Graph, che è
 * l'equivalente dell'UID IMAP: un cursore opaco che Microsoft stessa fa
 * avanzare, indipendente dalle spunte di lettura.
 */
async function scaricaPostaGraph(
  azienda: string,
  cred: CredPosta,
  massimo = MASSIMO_PER_PASSATA
): Promise<{ nuovi: number; errore: string | null }> {
  const token = await gettoneValidoPosta(azienda, cred);
  if (!token) {
    const errore = "Outlook non è più autorizzato: ricollega la casella.";
    await getPool().query("select public.az_posta_esito($1,$2,$3)", [azienda, errore, 0]);
    return { nuovi: 0, errore };
  }

  let nuovi = 0;
  try {
    // Senza segnalibro salvato si parte con una query "delta" nuova sulla
    // cartella; con un segnalibro si richiama TALE E QUALE il link che
    // Microsoft aveva dato, che porta già dentro il cursore.
    let indirizzo =
      cred.oauth_delta_link ||
      `${GRAPH}/me/mailFolders/inbox/messages/delta?$select=subject,from,receivedDateTime,internetMessageId,hasAttachments,body`;

    let ultimoLink: string | null = null;
    let pagine = 0;
    // Poche pagine per passata: il resto arriva al giro dopo, come per IMAP
    // (`massimo` righe, non messaggi — Graph pagina da solo). Il pulsante
    // manuale «Trova clienti dalle mail» chiama con un `massimo` più alto del
    // giro notturno, per non dover cliccare dieci volte su una casella con
    // mesi di storico arretrato.
    const pagineMax = Math.max(3, Math.ceil(massimo / 15));
    while (indirizzo && pagine < pagineMax && nuovi < massimo) {
      pagine++;
      const r = await fetch(indirizzo, {
        headers: {
          Authorization: `Bearer ${token}`,
          // Il testo semplice, non l'HTML: è quello che il resto della
          // pipeline (classificazione, OCR) si aspetta di leggere.
          Prefer: 'outlook.body-content-type="text"',
        },
        signal: AbortSignal.timeout(20_000),
      });
      if (r.status === 410) {
        // Il segnalibro è scaduto (troppo vecchio, o cassetta cambiata):
        // si ricomincia da una query delta nuova, come l'UIDVALIDITY di IMAP.
        await getPool().query("select public.az_posta_delta_salva($1,$2)", [azienda, null]);
        const errore = "Il collegamento con Outlook si è azzerato: riprova a controllare.";
        await getPool().query("select public.az_posta_esito($1,$2,$3)", [azienda, errore, nuovi]);
        return { nuovi, errore };
      }
      if (!r.ok) throw new Error(`Microsoft Graph ha risposto ${r.status}.`);

      const corpo = (await r.json()) as {
        value?: MessaggioGraph[];
        "@odata.nextLink"?: string;
        "@odata.deltaLink"?: string;
      };

      for (const m of corpo.value ?? []) {
        if (m["@removed"]) continue; // cancellato, non ci interessa
        const mittente = m.from?.emailAddress?.address
          ? `${m.from.emailAddress.name ?? ""} <${m.from.emailAddress.address}>`.trim()
          : "";
        const msgid =
          m.internetMessageId ||
          `senza-id:${m.receivedDateTime ?? ""}:${(m.subject ?? "").slice(0, 80)}`;

        let allegatiNomi: string[] = [];
        let allegatiBuoni: { filename: string; contentType: string; content: Buffer }[] = [];
        if (m.hasAttachments) {
          try {
            const ra = await fetch(`${GRAPH}/me/messages/${m.id}/attachments`, {
              headers: { Authorization: `Bearer ${token}` },
              signal: AbortSignal.timeout(20_000),
            });
            if (ra.ok) {
              const ac = (await ra.json()) as { value?: AllegatoGraph[] };
              for (const a of (ac.value ?? []).slice(0, 5)) {
                if (a["@odata.type"] !== "#microsoft.graph.fileAttachment" || !a.contentBytes) continue;
                const tipo = (a.contentType || "").toLowerCase();
                if (!TIPI_BOLLA.has(tipo)) continue;
                const bytes = Buffer.from(a.contentBytes, "base64");
                if (bytes.length > 4_000_000) continue;
                allegatiBuoni.push({ filename: a.name || "documento", contentType: tipo, content: bytes });
              }
              allegatiNomi = allegatiBuoni.map((a) => a.filename);
            }
          } catch {
            // Un allegato che non si scarica non deve far perdere il messaggio:
            // entra senza allegati, come una mail illeggibile in IMAP.
          }
        }

        const inserito = await getPool().query<{ az_posta_arrivo: string | null }>(
          "select public.az_posta_arrivo($1,$2,$3,$4,$5,$6,$7)",
          [
            azienda,
            msgid.slice(0, 500),
            m.receivedDateTime ?? null,
            mittente,
            m.subject ?? "",
            allegatiNomi,
            (m.body?.content ?? "").trim(),
          ]
        );
        const arrivoId = inserito.rows[0]?.az_posta_arrivo;
        if (arrivoId != null) {
          nuovi++;
          for (const a of allegatiBuoni) {
            await getPool().query("select public.az_posta_allegato_salva($1,$2,$3,$4,$5)", [
              azienda,
              arrivoId,
              a.filename,
              a.contentType,
              cifraByte(a.content),
            ]);
          }
        }
      }

      if (corpo["@odata.deltaLink"]) {
        ultimoLink = corpo["@odata.deltaLink"];
        indirizzo = "";
      } else if (corpo["@odata.nextLink"]) {
        indirizzo = corpo["@odata.nextLink"];
      } else {
        indirizzo = "";
      }
    }

    if (ultimoLink) {
      await getPool().query("select public.az_posta_delta_salva($1,$2)", [azienda, ultimoLink]);
    }
    await getPool().query("select public.az_posta_esito($1,$2,$3)", [azienda, null, nuovi]);
    return { nuovi, errore: null };
  } catch (e) {
    const errore = e instanceof Error ? e.message : "Outlook non risponde.";
    await getPool().query("select public.az_posta_esito($1,$2,$3)", [azienda, errore, nuovi]).catch(() => {});
    return { nuovi, errore };
  }
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
export async function scaricaPosta(
  azienda: string,
  massimo = MASSIMO_PER_PASSATA
): Promise<{ nuovi: number; errore: string | null }> {
  const r = await getPool().query<CredPosta & { ultimo_uid: string; uid_validita: string }>(
    "select * from public.az_posta_credenziali($1)",
    [azienda]
  );
  const cred = r.rows[0];
  if (!cred) return { nuovi: 0, errore: "Nessuna casella collegata." };
  if (!cred.attivo) return { nuovi: 0, errore: "Collegamento spento." };

  if (cred.metodo === "oauth") return scaricaPostaGraph(azienda, cred, massimo);

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
        .slice(0, massimo);
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
    // E l'agente controllo bolle confronta le bolle appena lette con lo
    // scarico vero in banchina: differenze e doppioni si segnalano da soli.
    await controllaBolle(azienda, 10).catch(() => {});
    // E l'agente elabora le mail: classifica, scrive le bozze e — se acceso —
    // risponde alle facili. In prova prepara e basta.
    await elaboraPosta(azienda, 6).catch(() => {});
    // E cerca clienti nuovi nelle mail arrivate — indipendente dalle risposte
    // automatiche: funziona anche se quelle sono spente.
    await estraiClienti(azienda, 6).catch(() => {});
    // E l'agente solleciti guarda i ritiri in arrivo e prepara/manda i promemoria.
    await elaboraSolleciti(azienda, Date.now()).catch(() => {});
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
  controllo_stato: string; // da_controllare | ok | differenza | doppione | in_attesa
  controllo_nota: string;
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

/**
 * Cosa risulta a NOI su chi ha scritto: si cerca nei dati veri (ritiri, bolle,
 * scansioni) per il nome del mittente e per eventuali numeri citati nella mail.
 * È ciò che permette all'agente di rispondere a «dov'è il carico» con la
 * posizione vera invece di un'interlocutoria.
 */
async function contestoDatiMail(azienda: string, mail: { mittente: string; oggetto: string; corpo: string }): Promise<string> {
  const termini = new Set<string>();
  const nome = mail.mittente.replace(/<[^>]*>/g, "").replace(/["']/g, "").trim();
  if (nome.length >= 3 && !nome.includes("@")) termini.add(nome);
  // Numeri lunghi (numero di bolla/collo) nell'oggetto e nel corpo.
  for (const m of `${mail.oggetto} ${mail.corpo}`.matchAll(/\b[A-Za-z]{0,4}\d{3,}\b/g)) termini.add(m[0]);
  const righe: string[] = [];
  for (const t of [...termini].slice(0, 3)) {
    const r = await cercaSpedizione(azienda, t).catch(() => []);
    righe.push(...r);
  }
  return [...new Set(righe)].slice(0, 8).join("\n");
}

/** Classifica una mail e, se facile, scrive la bozza. Ritorna null se il modello è spento/muto. */
async function classificaEbozza(
  mail: { mittente: string; oggetto: string; corpo: string },
  documenti: { titolo: string; testo: string }[],
  contestoDati: string
): Promise<{ classe: string; bozza: string | null } | null> {
  const chiave = process.env.OPENROUTER_API_KEY;
  if (!chiave) return null;
  const contesto = documenti.length
    ? documenti.map((d) => `### ${d.titolo}\n${d.testo}`).join("\n\n").slice(0, 6000)
    : "(nessun documento aziendale caricato)";
  const utente =
    `DOCUMENTI DELL'AZIENDA:\n${contesto}\n\n` +
    (contestoDati
      ? `COSA RISULTA A NOI SU CHI HA SCRITTO (usa questo per «dov'è il carico»):\n${contestoDati}\n\n`
      : "") +
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

const ISTRUZIONI_ESTRAZIONE =
  "Leggi una mail arrivata a un'azienda di trasporti e dici se chi scrive è " +
  "un'azienda/persona che potrebbe essere (o già è) un cliente in anagrafica, " +
  "e con quali dati. REGOLA DI FERRO: riporta SOLO quello che è scritto alla " +
  "lettera nella mail (nella firma, nell'intestazione, nel testo) — MAI un " +
  "dato dedotto, indovinato o completato. Se un campo non c'è scritto, " +
  "lascialo vuoto. Rispondi in JSON: " +
  '{"azienda": string|null, "referente": string|null, "telefono": string|null, ' +
  '"zona": string|null, "necessita": string|null}. ' +
  '"azienda" è null se la mail non sembra di un\'azienda/cliente vero (spam, ' +
  'newsletter, notifiche automatiche, nostre stesse risposte). "necessita" è ' +
  "una riga sola su cosa chiede o di cosa ha bisogno QUESTA mail (un " +
  "preventivo, un tipo di trasporto ricorrente, una lamentela, un orario " +
  "preferito...), SOLO se c'è scritta una richiesta o un'esigenza concreta.";

/**
 * Guarda una mail arrivata e, se sembra un cliente non ancora in anagrafica,
 * lo aggiunge da solo — coi soli dati scritti alla lettera nella mail.
 *
 * ⚠️ Automatico per scelta di Tommaso (18 Agosto 2026): non chiede conferma.
 * Per questo la regola sopra («mai un dato dedotto») non è un dettaglio, è
 * la sicurezza — un'anagrafica sporcata da dati inventati senza che nessuno
 * l'abbia approvata sarebbe peggio di non averla scritta.
 */
interface ClienteConNote {
  id: string;
  nome: string;
  referente: string;
  telefono: string;
  email: string;
  zona: string;
  note: string;
  piva: string;
  indirizzo: string;
}

async function estraiClienteDaMail(
  azienda: string,
  arrivo: { id: string; mittente: string; oggetto: string; corpo: string },
  clientiNoti: ClienteConNote[]
): Promise<boolean> {
  const chiave = process.env.OPENROUTER_API_KEY;
  if (!chiave) return false;
  try {
    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${chiave}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://corpagent.vercel.app",
        "X-Title": "CorpAgent · Clienti dalle mail",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        max_tokens: 300,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: ISTRUZIONI_ESTRAZIONE },
          {
            role: "user",
            content: `Da: ${arrivo.mittente}\nOggetto: ${arrivo.oggetto}\n\n${(arrivo.corpo || "").slice(0, 3000)}`,
          },
        ],
      }),
      signal: AbortSignal.timeout(20_000),
    });
    const body = (await r.json()) as { choices?: { message?: { content?: string } }[] };
    const grezzo = body.choices?.[0]?.message?.content?.trim();
    if (!grezzo) return false;
    const j = JSON.parse(grezzo) as {
      azienda?: string | null;
      referente?: string | null;
      telefono?: string | null;
      zona?: string | null;
      necessita?: string | null;
    };
    const nomeAzienda = (j.azienda ?? "").trim();
    if (!nomeAzienda || nomeAzienda.length < 2) return false;

    const oggi = new Date().toLocaleDateString("it-IT");
    const necessita = (j.necessita ?? "").trim().slice(0, 300);
    const esistente = clientiNoti.find((c) => nomiSimili(c.nome, nomeAzienda));

    if (esistente) {
      // Già in anagrafica: non si duplica, ma se questa mail dice qualcosa di
      // nuovo sui suoi bisogni si arricchisce il profilo — senza toccare gli
      // altri campi, che restano quelli che il titolare (o un giro precedente)
      // ha già scritto.
      if (!necessita || esistente.note.includes(necessita)) return false;
      await salvaCliente(azienda, null, {
        id: esistente.id,
        nome: esistente.nome,
        referente: esistente.referente,
        telefono: esistente.telefono,
        email: esistente.email,
        zona: esistente.zona,
        piva: esistente.piva,
        indirizzo: esistente.indirizzo,
        note: `${esistente.note}${esistente.note ? "\n" : ""}${oggi}: ${necessita}`.slice(-4000),
      });
      esistente.note = `${esistente.note}${esistente.note ? "\n" : ""}${oggi}: ${necessita}`;
      return false; // arricchito, non è un cliente NUOVO
    }

    const emailMittente = estraiEmail(arrivo.mittente);
    await salvaCliente(azienda, null, {
      nome: nomeAzienda.slice(0, 120),
      referente: (j.referente ?? "").trim().slice(0, 80),
      telefono: (j.telefono ?? "").trim().slice(0, 40),
      email: emailMittente,
      zona: (j.zona ?? "").trim().slice(0, 60),
      note: necessita
        ? `Trovato da un'email del ${oggi}: ${necessita}`
        : `Trovato in automatico da un'email arrivata il ${oggi}.`,
    });
    return true;
  } catch {
    // Un'estrazione fallita non deve bloccare il resto della posta: si
    // riprova al prossimo giro solo se l'arrivo non viene segnato «estratto».
    return false;
  }
}

/**
 * Passa in rassegna le mail non ancora guardate per l'estrazione clienti.
 * Ogni arrivo si segna «estratto» SEMPRE, trovato o no un cliente: altrimenti
 * una mail di spam verrebbe rianalizzata (e pagata) a ogni giro per sempre.
 */
export async function estraiClienti(
  azienda: string,
  massimo = 5
): Promise<{ trovati: number; scansionate: number }> {
  const r = await getPool().query<{ id: string; mittente: string; oggetto: string; corpo: string }>(
    "select * from public.az_posta_arrivi_da_estrarre($1,$2)",
    [azienda, massimo]
  );
  if (r.rows.length === 0) return { trovati: 0, scansionate: 0 };

  const clientiNoti = (await clientiAzienda(azienda, "")) as ClienteConNote[];
  let trovati = 0;
  for (const arrivo of r.rows) {
    const nuovo = await estraiClienteDaMail(azienda, arrivo, clientiNoti);
    if (nuovo) {
      trovati++;
      // Ricarica l'elenco: da qui in poi le mail successive di QUESTO stesso
      // giro devono vederlo già in anagrafica, non riproporlo come nuovo.
      clientiNoti.length = 0;
      clientiNoti.push(...((await clientiAzienda(azienda, "")) as ClienteConNote[]));
    }
    await getPool().query("select public.az_posta_arrivo_segna_estratto($1)", [arrivo.id]);
  }
  return { trovati, scansionate: r.rows.length };
}

/** Manda davvero una mail via SMTP (stessa casella IMAP). */
async function mandaMail(
  cred: { host: string; utente: string; password: string; nomeMittente?: string },
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
    from: cred.nomeMittente ? `"${cred.nomeMittente.replace(/"/g, "")}" <${cred.utente}>` : cred.utente,
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

  // Le credenziali: l'utente serve SEMPRE (per non rispondere a sé stessi); si
  // manda davvero solo in modalità acceso — la strada (SMTP o Graph) la
  // sceglie `inviaMail` guardando `metodo`.
  const cr = await getPool().query<CredPosta>("select * from public.az_posta_credenziali($1)", [azienda]);
  const c = cr.rows[0] ?? null;
  const nostro = c?.utente ?? "";
  const cred = stato.auto_modo === "acceso" ? c : null;

  let bozze = 0, mandate = 0, umane = 0;
  for (const mail of nuove.rows) {
    // ⚠️ Prima di tutto: non è una mail a cui si risponde (nostra, o automatica)?
    if (daIgnorare(mail.mittente, nostro)) {
      await getPool().query("select public.az_posta_risposta_salva($1,$2,$3,$4,$5)", [
        azienda, Number(mail.id), "ignorata", null, "ignorata",
      ]);
      continue;
    }
    const contestoDati = await contestoDatiMail(azienda, mail).catch(() => "");
    const esito = await classificaEbozza(mail, documenti, contestoDati).catch(() => null);
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
        await inviaMail(azienda, cred, {
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
  const cr = await getPool().query<CredPosta>("select * from public.az_posta_credenziali($1)", [azienda]);
  const c = cr.rows[0];
  if (!c) return { ok: false, errore: "Casella non collegata." };
  try {
    await inviaMail(azienda, c, {
      destinatario: b.mittente,
      oggetto: b.oggetto.toLowerCase().startsWith("re:") ? b.oggetto : `Re: ${b.oggetto}`,
      corpo: testo,
    });
    await getPool().query("select public.az_posta_mandata($1,$2)", [azienda, id]);
    return { ok: true, errore: null };
  } catch (e) {
    return { ok: false, errore: e instanceof Error ? traduciErrore(e) : "Invio non riuscito." };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// L'AGENTE SOLLECITI RITIRI
// ─────────────────────────────────────────────────────────────────────────
//
// Tiene d'occhio i ritiri prenotati e non ancora fatti: quando si avvicina
// l'ora, prepara — e se acceso manda — un promemoria al cliente. Il testo lo
// scrive un TEMPLATE con la data ESATTA del ritiro, non il modello: un orario
// sbagliato a un cliente è peggio di non dirlo.

export interface SollecitoRiga {
  id: string;
  ritiro: string;
  controparte: string;
  previsto: string | null;
  destinatario: string;
  testo: string | null;
  stato: string; // bozza | mandato | senza_email
  creato: string;
}

/** Da un ritiro al testo del promemoria — con la data vera, copiata. */
function testoSollecito(previsto: string | null, colli: number | null): string {
  const quando = previsto
    ? new Date(previsto).toLocaleString("it-IT", { weekday: "long", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" })
    : "nella data concordata";
  return [
    "Buongiorno,",
    "",
    `le ricordiamo il ritiro${colli ? ` di ${colli} colli` : ""} previsto per ${quando}.`,
    "Se qualcosa è cambiato, ci faccia un cenno e riorganizziamo.",
    "",
    "Grazie,",
    "Speed Trasporti",
  ].join("\n");
}

export async function statoSolleciti(azienda: string): Promise<ModoAuto> {
  const r = await getPool().query<{ az_solleciti_modo: string }>("select public.az_solleciti_modo($1)", [azienda]);
  return (r.rows[0]?.az_solleciti_modo as ModoAuto) ?? "spento";
}

export async function salvaSollecitiModo(azienda: string, modo: ModoAuto): Promise<void> {
  await getPool().query("select public.az_solleciti_modo_salva($1,$2)", [azienda, modo]);
}

export async function solleciti(azienda: string, limite = 40): Promise<SollecitoRiga[]> {
  const r = await getPool().query<SollecitoRiga>("select * from public.az_solleciti($1,$2)", [azienda, limite]);
  return r.rows.map((s) => ({ ...s, testo: s.testo ? decifra(s.testo) : null }));
}

/**
 * Il giro dell'agente solleciti: guarda i ritiri prenotati che si avvicinano
 * (da 12 ore fa a 36 ore avanti — cioè «per oggi/domani»), non ancora
 * sollecitati, e prepara/manda il promemoria al cliente abbinato per nome.
 */
export async function elaboraSolleciti(azienda: string, adesso: number): Promise<{ preparati: number; mandati: number; senzaEmail: number }> {
  const modo = await statoSolleciti(azienda);
  if (modo === "spento") return { preparati: 0, mandati: 0, senzaEmail: 0 };

  const [rit, fatti, cli] = await Promise.all([
    getPool().query<{ id: string; controparte: string; colli: number | null; previsto: string | null }>("select id, controparte, colli, previsto from public.az_ritiri($1)", [azienda]),
    getPool().query<{ ritiro: string }>("select * from public.az_solleciti_fatti($1)", [azienda]),
    getPool().query<{ nome: string; email: string }>("select nome, email from public.az_clienti($1,$2)", [azienda, ""]),
  ]);
  const giaFatti = new Set(fatti.rows.map((f) => String(f.ritiro)));
  const clienti = cli.rows.filter((c) => c.email && c.email.includes("@"));

  // Le credenziali per mandare, solo se acceso.
  let cred: CredPosta | null = null;
  if (modo === "acceso") {
    const cr = await getPool().query<CredPosta>("select * from public.az_posta_credenziali($1)", [azienda]);
    cred = cr.rows[0] ?? null;
  }

  const DODICI_ORE = 12 * 3600_000;
  const TRENTASEI_ORE = 36 * 3600_000;
  let preparati = 0, mandati = 0, senzaEmail = 0;

  for (const r of rit.rows) {
    if (giaFatti.has(String(r.id)) || !r.previsto) continue;
    const t = new Date(r.previsto).getTime();
    if (t < adesso - DODICI_ORE || t > adesso + TRENTASEI_ORE) continue; // fuori finestra

    // Abbina il cliente per nome (contiene): il primo con un'email.
    const nome = r.controparte.trim().toLowerCase();
    const match = clienti.find((c) => nome && (c.nome.toLowerCase().includes(nome) || nome.includes(c.nome.toLowerCase())));
    const testo = testoSollecito(r.previsto, r.colli);

    if (!match) {
      // Non so a chi scrivere: lo preparo lo stesso e lo segno «senza email»,
      // così l'ufficio sa che quel ritiro andrebbe ricordato a mano.
      await getPool().query("select public.az_sollecito_salva($1,$2,$3,$4,$5,$6,$7)", [azienda, Number(r.id), r.controparte, r.previsto, "", cifra(testo), "senza_email"]);
      senzaEmail++;
      continue;
    }

    if (modo === "acceso" && cred) {
      try {
        await inviaMail(azienda, cred, { destinatario: match.email, oggetto: "Promemoria ritiro — Speed Trasporti", corpo: testo });
        await getPool().query("select public.az_sollecito_salva($1,$2,$3,$4,$5,$6,$7)", [azienda, Number(r.id), r.controparte, r.previsto, match.email, cifra(testo), "mandato"]);
        mandati++;
      } catch {
        await getPool().query("select public.az_sollecito_salva($1,$2,$3,$4,$5,$6,$7)", [azienda, Number(r.id), r.controparte, r.previsto, match.email, cifra(testo), "bozza"]);
        preparati++;
      }
    } else {
      await getPool().query("select public.az_sollecito_salva($1,$2,$3,$4,$5,$6,$7)", [azienda, Number(r.id), r.controparte, r.previsto, match.email, cifra(testo), "bozza"]);
      preparati++;
    }
  }
  return { preparati, mandati, senzaEmail };
}

/** Manda a mano un sollecito già preparato (in prova). */
export async function mandaSollecito(azienda: string, id: number): Promise<{ ok: boolean; errore: string | null }> {
  const r = await getPool().query<{ destinatario: string; testo: string; controparte: string; stato: string }>("select * from public.az_sollecito_uno($1,$2)", [azienda, id]);
  const s = r.rows[0];
  if (!s) return { ok: false, errore: "Sollecito non trovato." };
  if (s.stato === "mandato") return { ok: false, errore: "Già mandato." };
  if (!s.destinatario || !s.destinatario.includes("@")) return { ok: false, errore: "Nessuna email per questo cliente: ricordaglielo a mano." };
  const testo = s.testo ? decifra(s.testo) : null;
  if (!testo) return { ok: false, errore: "Promemoria illeggibile." };
  const cr = await getPool().query<CredPosta>("select * from public.az_posta_credenziali($1)", [azienda]);
  const c = cr.rows[0];
  if (!c) return { ok: false, errore: "Casella non collegata." };
  try {
    await inviaMail(azienda, c, { destinatario: s.destinatario, oggetto: "Promemoria ritiro — Speed Trasporti", corpo: testo });
    await getPool().query("select public.az_sollecito_mandato($1,$2)", [azienda, id]);
    return { ok: true, errore: null };
  } catch (e) {
    return { ok: false, errore: e instanceof Error ? traduciErrore(e) : "Invio non riuscito." };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// L'AGENTE CONTROLLO BOLLE — confronta la bolla con lo scarico vero
// ─────────────────────────────────────────────────────────────────────────
//
// Le bolle arrivate via posta dicono «8 colli da Rossi». La banchina, per
// conto suo, registra carichi/scarichi veri (Traffico → Carico/Scarico).
// Questo agente li mette a confronto: se i numeri tornano è "ok", se non
// tornano è una "differenza" da guardare, se sembra la stessa bolla arrivata
// due volte è un "doppione", se non risulta ancora niente in banchina è "in
// attesa" (non un problema — magari il collo deve ancora arrivare).
//
// ⚠️ Non blocca né chiude niente da solo: SEGNALA. Chi decide resta una
// persona — coerente con la regola di tutti gli agenti di quest'area.

/** Il nome ripulito, per il confronto (senza SRL/SPA/punteggiatura pesante). */
function nomePulito(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b(s\.?r\.?l\.?|s\.?p\.?a\.?|s\.?n\.?c\.?)\b/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
}

/** Quanto due nomi si assomigliano: contenimento in un senso o nell'altro. */
function nomiSimili(a: string, b: string): boolean {
  const pa = nomePulito(a);
  const pb = nomePulito(b);
  if (!pa || !pb) return false;
  return pa.includes(pb) || pb.includes(pa);
}

export async function controllaBolle(azienda: string, massimo = 10): Promise<{ controllate: number }> {
  const r = await getPool().query<{ id: string; bolla: DatiBolla; creato: string }>(
    "select * from public.az_posta_bolle_da_controllare($1,$2)",
    [azienda, massimo]
  );
  let controllate = 0;
  for (const riga of r.rows) {
    const d = riga.bolla;
    const mittente = (d.mittente ?? "").trim();
    if (!mittente) {
      // Senza un nome non c'è nessun confronto onesto da fare.
      await getPool().query("select public.az_posta_bolla_controllo_salva($1,$2,$3,$4)", [
        azienda, Number(riga.id), "in_attesa", "Bolla senza mittente leggibile: nulla da confrontare.",
      ]);
      controllate++;
      continue;
    }

    // ⚠️ Il doppione si guarda PRIMA di tutto: due bolle con lo stesso numero
    // e mittente, arrivate in giorni diversi, sono quasi certamente la stessa
    // cosa scannerizzata due volte.
    //
    // ⚠️ SICUREZZA/RLS: qui NON si fa una SELECT diretta sulla tabella — le
    // tabelle dell'area azienda hanno RLS acceso e NESSUNA policy, quindi una
    // SELECT diretta torna SEMPRE zero righe (bug vero, trovato dal collaudo:
    // il controllo non trovava mai un doppione, nemmeno con la stessa bolla
    // arrivata tre volte). Si passa dalla porta `az_posta_bolle_stesso_numero`.
    // Il confronto sul mittente resta "sfumato" (nomiSimili) e non un'uguaglianza
    // esatta: l'OCR può scrivere lo stesso nome con maiuscole/spazi diversi
    // da una lettura all'altra.
    if (d.numero) {
      const altreBolle = await getPool().query<{ id: string; bolla: DatiBolla }>(
        "select * from public.az_posta_bolle_stesso_numero($1,$2,$3)",
        [azienda, Number(riga.id), d.numero]
      );
      const duplicata = altreBolle.rows.some((r) => nomiSimili(r.bolla.mittente ?? "", mittente));
      if (duplicata) {
        await getPool().query("select public.az_posta_bolla_controllo_salva($1,$2,$3,$4)", [
          azienda, Number(riga.id), "doppione",
          `Un'altra bolla con lo stesso numero (${d.numero}) e mittente è già registrata.`,
        ]);
        controllate++;
        continue;
      }
    }

    // La finestra di ricerca: 3 giorni prima e dopo la data della bolla (o
    // di quando è arrivata, se la data non si è letta bene).
    const base = d.data ? new Date(d.data).getTime() : new Date(riga.creato).getTime();
    const TRE_GIORNI = 3 * 24 * 3600_000;
    const mov = await getPool().query<{ id: string; tipo: string; colli: number | null; controparte: string; creato: string }>(
      "select * from public.az_movimenti_finestra($1,$2,$3)",
      [azienda, new Date(base - TRE_GIORNI).toISOString(), new Date(base + TRE_GIORNI).toISOString()]
    );
    const match = mov.rows.find((m) => nomiSimili(m.controparte, mittente));

    if (!match) {
      await getPool().query("select public.az_posta_bolla_controllo_salva($1,$2,$3,$4)", [
        azienda, Number(riga.id), "in_attesa",
        `Nessun carico/scarico di «${mittente}» trovato in banchina, nei giorni vicini. Potrebbe non essere ancora arrivata.`,
      ]);
    } else if (d.colli != null && match.colli != null && d.colli !== match.colli) {
      await getPool().query("select public.az_posta_bolla_controllo_salva($1,$2,$3,$4)", [
        azienda, Number(riga.id), "differenza",
        `La bolla dice ${d.colli} colli, in banchina ne risultano ${match.colli} (${match.tipo} del ${new Date(match.creato).toLocaleDateString("it-IT")}).`,
      ]);
    } else {
      await getPool().query("select public.az_posta_bolla_controllo_salva($1,$2,$3,$4)", [
        azienda, Number(riga.id), "ok",
        `Combacia con il ${match.tipo} in banchina del ${new Date(match.creato).toLocaleDateString("it-IT")}.`,
      ]);
    }
    controllate++;
  }
  return { controllate };
}

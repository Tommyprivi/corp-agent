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
import { cifra, decifra } from "./connectors.js";
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
 * Prova il collegamento SENZA salvare niente: si connette, entra, apre la
 * cartella, conta i messaggi, esce. Se qualcosa non va, l'errore torna in
 * italiano comprensibile — è quello che il titolare leggerà.
 */
export async function provaPosta(c: ConfigPosta): Promise<{ messaggi: number }> {
  const client = apriClient(c);
  try {
    await client.connect();
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

  const client = apriClient({ ...cred, password });
  let nuovi = 0;
  // Da dove si riparte, e fin dove si è arrivati in QUESTA passata: si salva
  // anche se la passata muore a metà, così non si rilavora quanto già fatto.
  let ultimoUid = Number(cred.ultimo_uid) || 0;
  let validitaSalvata = Number(cred.uid_validita) || 0;
  try {
    await client.connect();
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
          const inserito = await getPool().query<{ az_posta_arrivo: boolean }>(
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
          if (inserito.rows[0]?.az_posta_arrivo) nuovi++;
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

/** Il giro serale: ogni azienda con la posta accesa, una per una. */
export async function scaricaPostaTutte(): Promise<{ azienda: string; nuovi: number; errore: string | null }[]> {
  const r = await getPool().query<{ azienda: string }>("select * from public.az_posta_accese()");
  const esiti: { azienda: string; nuovi: number; errore: string | null }[] = [];
  for (const { azienda } of r.rows) {
    const esito = await scaricaPosta(azienda).catch((e) => ({
      nuovi: 0,
      errore: traduciErrore(e),
    }));
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

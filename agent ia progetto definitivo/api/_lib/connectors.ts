/**
 * I connettori — ognuno collega **il suo** account.
 *
 * Regola fissata da Tommaso il 9 Agosto 2026:
 *
 *   «quando colleghi il connettore fai l'accesso con il tuo account e hai le
 *    tue cose, ma questo vale per tutto»
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ⚠️ LE DUE FAMIGLIE, E CONFONDERLE COSTA GIORNATE
 * ─────────────────────────────────────────────────────────────────────────
 * **CHIAVE** — «sono io». Fluida, Google Maps, Shopify: l'utente incolla la
 * sua chiave, noi la cifriamo e la usiamo per conto suo. Chi ce l'ha, entra.
 *
 * **PERMESSO** — «quel signore mi lascia leggere la sua posta». Gmail,
 * Microsoft 365: nessuna chiave basta, e per una ragione che si capisce dicendo
 * la cosa ad alta voce — se bastasse una chiave per leggere Gmail, chi avesse
 * quella chiave leggerebbe la posta di chiunque. Serve che l'utente clicchi
 * «autorizzo», e quello che ne esce è un gettone **suo**, che scade e si
 * rinnova.
 *
 * Le credenziali in `.env.local` non spariscono, ma cambiano mestiere: da
 * «chiavi del servizio» a «carta d'identità di CorpAgent presso Google», cioè
 * quello che serve per poter *chiedere* il permesso. I dati restano di chi li
 * ha.
 */

import { withUser } from "./db.js";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export type ConnectorKind =
  | "fluida"
  | "google"
  | "microsoft"
  | "maps"
  | "shopify"
  | "stripe_shop"
  | "sheets"
  | "notion"
  | "custom";

// ─────────────────────────────────────────────────────────────────────────
// LA CASSAFORTE
// ─────────────────────────────────────────────────────────────────────────

/**
 * Cifra un segreto di un cliente.
 *
 * ⚠️ AES-256-GCM e non "qualcosa di semplice": GCM, oltre a nascondere, **si
 * accorge se qualcuno ha modificato** i byte. Senza quel controllo, chi avesse
 * accesso in scrittura al database potrebbe cambiare un carattere della chiave
 * cifrata e noi manderemmo a Google una credenziale storta senza saperlo.
 *
 * Il formato è `iv.tag.contenuto`, tutto in base64: serve a poter cambiare
 * schema un domani senza indovinare cosa c'è dentro le righe vecchie.
 */
export function cifra(testo: string): string {
  const chiave = chiaveDiCifratura();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", chiave, iv);
  const parti = Buffer.concat([cipher.update(testo, "utf8"), cipher.final()]);
  return [
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    parti.toString("base64"),
  ].join(".");
}

/** Rimette in chiaro. Restituisce `null` se qualcosa non torna. */
export function decifra(pacchetto: string | null): string | null {
  if (!pacchetto) return null;
  try {
    const chiave = chiaveDiCifratura();
    const [iv, tag, contenuto] = pacchetto.split(".");
    if (!iv || !tag || !contenuto) return null;

    const decipher = createDecipheriv("aes-256-gcm", chiave, Buffer.from(iv, "base64"));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(contenuto, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    // Chiave cambiata, riga manomessa, formato vecchio: in tutti e tre i casi
    // la cosa giusta è comportarsi come se il connettore non fosse collegato.
    return null;
  }
}

function chiaveDiCifratura(): Buffer {
  const grezza = process.env.CONNECTORS_KEY;
  if (!grezza) {
    throw new Error(
      "CONNECTORS_KEY non configurata: senza, le credenziali dei clienti " +
        "finirebbero in chiaro nel database. Meglio rifiutare che salvare."
    );
  }
  const chiave = Buffer.from(grezza, "base64");
  if (chiave.length !== 32) {
    throw new Error("CONNECTORS_KEY deve essere 32 byte in base64.");
  }
  return chiave;
}

// ─────────────────────────────────────────────────────────────────────────
// COLLEGARE, LEGGERE, STACCARE
// ─────────────────────────────────────────────────────────────────────────

export interface Connessione {
  kind: ConnectorKind;
  label: string | null;
  status: string;
  meta: Record<string, unknown>;
  lastOkAt: string | null;
  lastError: string | null;
}

/**
 * Salva (o aggiorna) un collegamento.
 *
 * ⚠️ Non torna mai indietro il segreto, nemmeno a chi l'ha appena scritto. È
 * una scelta scomoda e voluta: un valore che non esce da qui non può finire in
 * un registro, in una schermata di errore o nella cronologia del browser.
 */
export async function collega(
  userId: string,
  input: {
    kind: ConnectorKind;
    label?: string | null;
    secret?: string | null;
    refresh?: string | null;
    expiresAt?: Date | null;
    meta?: Record<string, unknown>;
  }
): Promise<void> {
  await withUser(userId, (client) =>
    client.query(
      `insert into public.connections
         (user_id, kind, label, secret_enc, refresh_enc, expires_at, meta,
          status, last_ok_at, last_error)
       values ($1, $2, $3, $4, $5, $6, $7, 'connected', now(), null)
       on conflict (user_id, kind) do update
         set label = coalesce(excluded.label, public.connections.label),
             secret_enc = coalesce(excluded.secret_enc, public.connections.secret_enc),
             refresh_enc = coalesce(excluded.refresh_enc, public.connections.refresh_enc),
             expires_at = excluded.expires_at,
             meta = public.connections.meta || excluded.meta,
             status = 'connected',
             last_ok_at = now(),
             last_error = null,
             updated_at = now()`,
      [
        userId,
        input.kind,
        input.label ?? null,
        input.secret ? cifra(input.secret) : null,
        input.refresh ? cifra(input.refresh) : null,
        input.expiresAt ?? null,
        JSON.stringify(input.meta ?? {}),
      ]
    )
  );
}

/** Cosa ha collegato questo utente — **senza** i segreti. */
export async function collegamenti(userId: string): Promise<Connessione[]> {
  return withUser(userId, async (client) => {
    const righe = await client.query<{
      kind: ConnectorKind;
      label: string | null;
      status: string;
      meta: Record<string, unknown>;
      last_ok_at: string | null;
      last_error: string | null;
    }>(
      `select kind, label, status, meta, last_ok_at, last_error
         from public.connections where user_id = $1 order by kind`,
      [userId]
    );
    return righe.rows.map((r) => ({
      kind: r.kind,
      label: r.label,
      status: r.status,
      meta: r.meta,
      lastOkAt: r.last_ok_at,
      lastError: r.last_error,
    }));
  });
}

/**
 * Le credenziali vere, per chiamare il servizio per conto dell'utente.
 *
 * ⚠️ Questa è l'unica funzione che restituisce segreti in chiaro, e chi la
 * chiama sta agendo **a nome di un'altra persona**. Non passarne mai il
 * risultato a un modello, a un registro o al browser.
 */
export async function credenziali(
  userId: string,
  kind: ConnectorKind
): Promise<{ secret: string | null; refresh: string | null; meta: Record<string, unknown> } | null> {
  return withUser(userId, async (client) => {
    const riga = await client.query<{
      secret_enc: string | null;
      refresh_enc: string | null;
      meta: Record<string, unknown>;
      status: string;
    }>(
      `select secret_enc, refresh_enc, meta, status
         from public.connections where user_id = $1 and kind = $2`,
      [userId, kind]
    );
    const r = riga.rows[0];
    if (!r || r.status === "revoked") return null;
    return {
      secret: decifra(r.secret_enc),
      refresh: decifra(r.refresh_enc),
      meta: r.meta,
    };
  });
}

/**
 * Segna che il connettore ha smesso di funzionare.
 *
 * ⚠️ Va chiamata **appena** una chiamata fallisce, non a fine giornata: un
 * connettore rotto in silenzio è peggio di uno mai collegato, perché l'agente
 * continua a rispondere come se sapesse.
 */
export async function segnalaGuasto(
  userId: string,
  kind: ConnectorKind,
  errore: string
): Promise<void> {
  await withUser(userId, (client) =>
    client.query(
      `update public.connections
          set status = 'error', last_error = $3, updated_at = now()
        where user_id = $1 and kind = $2`,
      [userId, kind, errore.slice(0, 500)]
    )
  ).catch(() => {
    // Se non si riesce nemmeno a segnare il guasto, non si peggiora la
    // situazione facendo fallire anche la richiesta dell'utente.
  });
}

/** Stacca un collegamento. Le credenziali spariscono davvero. */
export async function stacca(userId: string, kind: ConnectorKind): Promise<void> {
  await withUser(userId, (client) =>
    client.query("delete from public.connections where user_id = $1 and kind = $2", [
      userId,
      kind,
    ])
  );
}

// ─────────────────────────────────────────────────────────────────────────
// LA PROVA: un connettore si collega solo se risponde
// ─────────────────────────────────────────────────────────────────────────

/**
 * Chiama il servizio con le credenziali date, **prima** di salvarle.
 *
 * ⚠️ Salvare senza provare è il modo più veloce di regalare a un cliente un
 * agente muto: lui vede «collegato», l'agente non trova niente, e nessuno dei
 * due capisce perché. Meglio un errore chiaro adesso.
 *
 * Restituisce cosa ha trovato, così la schermata può dire «collegato a
 * *Speed Trasporti*» invece di un generico «fatto».
 */
export type EsitoProva =
  | { ok: true; nome: string; meta: Record<string, unknown>; perche?: undefined }
  // ⚠️ `perche?: undefined` sul ramo buono, e non è pignoleria: senza,
  // TypeScript restringe l'unione solo quando riesce a riconoscere `ok` come
  // valore letterale — e con le impostazioni con cui Vercel compila la cartella
  // `api/` non ci riusciva, dando «Property 'perche' does not exist» **solo in
  // produzione**. Un errore che non vedi in locale è il peggiore.
  | { ok: false; perche: string; nome?: undefined; meta?: undefined };

export async function prova(
  kind: ConnectorKind,
  secret: string,
  meta: Record<string, unknown>
): Promise<EsitoProva> {
  try {
    if (kind === "fluida") {
      const companyId = String(meta.companyId ?? "");
      if (!companyId) return { ok: false, perche: "Serve anche l'identificativo dell'azienda." };

      // ⚠️ `x-fluida-app-uuid`, non un nome standard: quattordici tentativi coi
      // nomi soliti rispondevano tutti «unauthorized». Sta scritto nella loro
      // specifica, che il browser disegna ma il codice legge da
      // developer.fluida.io/docs/openapi.json.
      const r = await fetch(`https://api.fluida.io/api/v1/companies/${companyId}`, {
        headers: { "x-fluida-app-uuid": secret, Accept: "application/json" },
        signal: AbortSignal.timeout(12_000),
      });
      if (!r.ok) {
        return {
          ok: false,
          perche:
            r.status === 401
              ? "Fluida non riconosce questa chiave. Controlla che sia abilitata nel pannello."
              : `Fluida ha risposto ${r.status}.`,
        };
      }
      const corpo = (await r.json()) as { data?: { name?: string; subscription_plan?: string } };
      return {
        ok: true,
        nome: corpo.data?.name ?? "Azienda su Fluida",
        meta: { companyId, plan: corpo.data?.subscription_plan ?? null },
      };
    }

    if (kind === "maps") {
      const r = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=Roma&key=${encodeURIComponent(secret)}`,
        { signal: AbortSignal.timeout(12_000) }
      );
      const corpo = (await r.json()) as { status?: string; error_message?: string };
      if (corpo.status !== "OK") {
        return {
          ok: false,
          perche: corpo.error_message ?? `Google Maps ha risposto ${corpo.status}.`,
        };
      }
      return { ok: true, nome: "Google Maps", meta: {} };
    }

    return { ok: false, perche: "Questo connettore non si collega con una chiave." };
  } catch (error) {
    return { ok: false, perche: `Non risponde: ${String(error).slice(0, 120)}` };
  }
}

// ═════════════════════════════════════════════════════════════════════════
// L'ACCESSO — «io li voglio tutti che si fa l'accesso»
// ═════════════════════════════════════════════════════════════════════════
//
// Deciso da Tommaso il 9 Agosto 2026. È la strada giusta e va detto perché:
// incollare una chiave funziona ma abbassa il livello di tutto il resto — un
// prodotto dove colleghi WhatsApp con un tocco e poi vai a pescare una chiave
// in un pannello non è coerente con sé stesso.
//
// ─────────────────────────────────────────────────────────────────────────
// ⚠️ LA DIFFERENZA FRA I TRE
// ─────────────────────────────────────────────────────────────────────────
// **Microsoft e Google** dipendono solo da noi: si registra CorpAgent una
// volta come applicazione, e da lì in poi ogni cliente entra col **suo**
// account. Nessuno deve darci il permesso.
//
// **Fluida** no: il loro accesso richiede che CorpAgent sia registrata presso
// di loro, e quel `client_id` lo danno loro. Fino ad allora resta la chiave —
// ma sotto, come seconda strada, non come vetrina.

interface Fornitore {
  autorizza: string;
  gettone: string;
  permessi: string;
  clientId?: string;
  clientSecret?: string;
}

/**
 * ⚠️ I permessi si chiedono **al minimo indispensabile**, e non è pignoleria:
 * una schermata che chiede «leggere e cancellare tutta la tua posta» fa
 * chiudere la finestra a metà delle persone. Meglio tornare a chiederne un
 * altro quando serve davvero che spaventare al primo incontro.
 */
function fornitore(kind: ConnectorKind): Fornitore | null {
  if (kind === "microsoft") {
    // `common` e non il nostro tenant: così entra chiunque, con l'account della
    // sua azienda o con un Microsoft personale. Se mettessimo il nostro,
    // potrebbe entrare solo chi sta nella nostra directory — cioè nessuno.
    return {
      autorizza: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
      gettone: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      permessi: [
        "offline_access", // il gettone di rinnovo: senza, si scollega ogni ora
        "User.Read",
        "Mail.Read",
        "Calendars.ReadWrite",
      ].join(" "),
      clientId: process.env.MS365_CLIENT_ID,
      clientSecret: process.env.MS365_CLIENT_SECRET,
    };
  }

  if (kind === "google") {
    return {
      autorizza: "https://accounts.google.com/o/oauth2/v2/auth",
      gettone: "https://oauth2.googleapis.com/token",
      permessi: [
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/calendar.events",
        "openid",
        "email",
      ].join(" "),
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    };
  }

  return null;
}

/**
 * Il biglietto che l'utente si porta dietro fino al ritorno.
 *
 * ⚠️ Senza, chiunque potrebbe far tornare il browser di un'altra persona sul
 * nostro indirizzo di ritorno con un codice suo, e collegherebbe **il proprio**
 * account al profilo di quella persona. È un attacco vecchio e reale, e si
 * ferma firmando chi ha cominciato e quando.
 */
function biglietto(userId: string, kind: ConnectorKind): string {
  const corpo = `${userId}|${kind}|${Date.now()}`;
  return `${Buffer.from(corpo).toString("base64url")}.${cifra(corpo).slice(0, 44)}`;
}

function bigliettoValido(stato: string, userId: string, kind: ConnectorKind): boolean {
  try {
    const [parte] = stato.split(".");
    const [chi, quale, quando] = Buffer.from(parte, "base64url").toString("utf8").split("|");
    // Dieci minuti: il tempo di fare un accesso, non di conservare un biglietto.
    return chi === userId && quale === kind && Date.now() - Number(quando) < 10 * 60 * 1000;
  } catch {
    return false;
  }
}

/**
 * Dove torna l'utente dopo aver detto «autorizzo».
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ⚠️ MICROSOFT NON AMMETTE LA CODA `?ritorno=`, E NON È UN CAPRICCIO
 * ─────────────────────────────────────────────────────────────────────────
 * Un'app aperta anche agli **account personali** (Hotmail, Outlook.com) non
 * può registrare un indirizzo di ritorno con una stringa di query. Il portale
 * lo rifiuta secco: *«L'URL non può contenere una stringa di query»*.
 *
 * La ragione è sensata: con gli account personali chiunque nel mondo può
 * autorizzare l'app, e un parametro nell'indirizzo è una cosa in più che
 * qualcuno può provare a piegare. Google, che resta nel recinto di un progetto,
 * la coda la accetta.
 *
 * Quindi per Microsoft si torna sull'indirizzo nudo — e **quale** connettore
 * fosse lo dice il biglietto firmato, che quel dato ce l'ha già dentro. Era
 * ridondante fin dall'inizio: adesso serve.
 */
export function ritornoPer(base: string, kind: ConnectorKind): string {
  return kind === "microsoft"
    ? `${base}/api/profile`
    : `${base}/api/profile?ritorno=${kind}`;
}

/** Quale connettore era, letto dal biglietto. Serve quando manca la coda. */
export function kindDalBiglietto(stato: string): ConnectorKind | null {
  try {
    const [parte] = stato.split(".");
    const quale = Buffer.from(parte, "base64url").toString("utf8").split("|")[1];
    // ⚠️ Non ci si fida ancora: qui si legge soltanto. La firma la controlla
    // `bigliettoValido` un attimo dopo, ed è quella che decide.
    return (quale as ConnectorKind) || null;
  } catch {
    return null;
  }
}

/** L'indirizzo dove mandare l'utente per fare l'accesso. */
export function avviaAccesso(
  kind: ConnectorKind,
  userId: string,
  ritorno: string
): { url: string } | { errore: string } {
  const f = fornitore(kind);
  if (!f) return { errore: "Questo connettore non ha ancora l'accesso: si collega con una chiave." };
  if (!f.clientId) {
    return {
      errore:
        "CorpAgent non è ancora registrata presso questo servizio: manca l'identificativo dell'applicazione.",
    };
  }

  const p = new URLSearchParams({
    client_id: f.clientId,
    response_type: "code",
    redirect_uri: ritorno,
    scope: f.permessi,
    state: biglietto(userId, kind),
    // ⚠️ Google dà il gettone di rinnovo **solo** la prima volta, a meno che
    // non si chieda `prompt=consent`. Senza, il secondo collegamento sembra
    // riuscito e poi si scollega dopo un'ora, senza che nessuno capisca.
    ...(kind === "google" ? { access_type: "offline", prompt: "consent" } : {}),
  });

  return { url: `${f.autorizza}?${p.toString()}` };
}

/**
 * L'utente è tornato: si scambia il codice con i gettoni e si salva.
 *
 * ⚠️ Il codice vale **una volta sola e per pochi secondi**. Se questo passaggio
 * fallisce non si può riprovare con lo stesso: si ricomincia dall'accesso.
 */
/**
 * ⚠️ I campi opzionali su **entrambi** i rami non sono pignoleria: senza,
 * TypeScript restringe l'unione solo con le impostazioni giuste, e Vercel
 * compila la cartella `api/` con le sue — dando «Property 'perche' does not
 * exist» **solo in produzione**. Stesso errore già visto con `prova()`.
 */
export type EsitoAccesso =
  | { ok: true; nome: string; perche?: undefined }
  | { ok: false; perche: string; nome?: undefined };

export async function concludiAccesso(
  kind: ConnectorKind,
  userId: string,
  codice: string,
  stato: string,
  ritorno: string
): Promise<EsitoAccesso> {
  if (!bigliettoValido(stato, userId, kind)) {
    return { ok: false, perche: "La richiesta è scaduta o non è tua. Riprova a collegare." };
  }

  const f = fornitore(kind);
  if (!f?.clientId || !f.clientSecret) {
    return { ok: false, perche: "Connettore non configurato." };
  }

  try {
    const r = await fetch(f.gettone, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: f.clientId,
        client_secret: f.clientSecret,
        code: codice,
        grant_type: "authorization_code",
        redirect_uri: ritorno,
      }).toString(),
    });
    const corpo = (await r.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      error_description?: string;
      error?: string;
    };
    if (!r.ok || !corpo.access_token) {
      return {
        ok: false,
        perche: (corpo.error_description ?? corpo.error ?? `errore ${r.status}`).split("\n")[0],
      };
    }

    // Chi è la persona che ha appena autorizzato: serve a scrivere «collegato
    // come mario@azienda.it» invece di un generico «collegato».
    const chi = await chiSei(kind, corpo.access_token);

    await collega(userId, {
      kind,
      label: chi,
      secret: corpo.access_token,
      refresh: corpo.refresh_token ?? null,
      expiresAt: corpo.expires_in ? new Date(Date.now() + corpo.expires_in * 1000) : null,
      meta: { account: chi, via: "accesso" },
    });

    return { ok: true, nome: chi };
  } catch (error) {
    return { ok: false, perche: String(error).slice(0, 140) };
  }
}

/** Il nome o l'indirizzo di chi ha autorizzato. Se non si sa, non si inventa. */
async function chiSei(kind: ConnectorKind, gettone: string): Promise<string> {
  try {
    if (kind === "microsoft") {
      const r = await fetch("https://graph.microsoft.com/v1.0/me", {
        headers: { Authorization: `Bearer ${gettone}` },
        signal: AbortSignal.timeout(8000),
      });
      const j = (await r.json()) as { mail?: string; userPrincipalName?: string; displayName?: string };
      return j.mail ?? j.userPrincipalName ?? j.displayName ?? "Account Microsoft";
    }
    if (kind === "google") {
      const r = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${gettone}` },
        signal: AbortSignal.timeout(8000),
      });
      const j = (await r.json()) as { email?: string; name?: string };
      return j.email ?? j.name ?? "Account Google";
    }
  } catch {
    /* si va avanti col nome generico */
  }
  return "Account collegato";
}

/**
 * Rinnova il gettone quando è scaduto.
 *
 * ⚠️ Va chiamata **prima** di usare le credenziali, non dopo il primo errore:
 * un gettone di Microsoft dura un'ora, e un agente che risponde ai clienti alle
 * tre di notte non ha nessuno che lo riavvii.
 */
export async function rinnovaSeServe(
  userId: string,
  kind: ConnectorKind
): Promise<string | null> {
  const c = await credenziali(userId, kind);
  if (!c) return null;

  const scadenza = c.meta.expiresAt ? new Date(String(c.meta.expiresAt)).getTime() : 0;
  // Due minuti di margine: un gettone che scade mentre la richiesta è in volo
  // è un errore che si vede solo in produzione e solo a volte.
  if (c.secret && (!scadenza || scadenza - Date.now() > 120_000)) return c.secret;
  if (!c.refresh) return c.secret;

  const f = fornitore(kind);
  if (!f?.clientId || !f.clientSecret) return c.secret;

  try {
    const r = await fetch(f.gettone, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: f.clientId,
        client_secret: f.clientSecret,
        refresh_token: c.refresh,
        grant_type: "refresh_token",
      }).toString(),
    });
    const corpo = (await r.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };
    if (!corpo.access_token) {
      await segnalaGuasto(userId, kind, "il rinnovo è stato rifiutato: va ricollegato");
      return null;
    }

    await collega(userId, {
      kind,
      // ⚠️ Google non rimanda il gettone di rinnovo a ogni giro: se non c'è, si
      // tiene quello vecchio. Sovrascriverlo con `null` scollegherebbe l'utente
      // al rinnovo successivo.
      refresh: corpo.refresh_token ?? null,
      secret: corpo.access_token,
      expiresAt: corpo.expires_in ? new Date(Date.now() + corpo.expires_in * 1000) : null,
      meta: {},
    });
    return corpo.access_token;
  } catch {
    return c.secret;
  }
}

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

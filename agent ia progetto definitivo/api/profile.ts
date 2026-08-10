/**
 * `profile` — chi è l'utente e cosa fa.
 *
 * Parte della riga 9 della Fase 1: il salvataggio permanente. Le risposte al
 * sondaggio d'ingresso finivano nello stato del browser e si perdevano a ogni
 * ricarica; da qui in poi vivono in `profiles` e le vedi in pgAdmin.
 *
 *   GET   → il profilo (lo crea se è il primo accesso)
 *   POST  → verifica il gettone di Cloudflare Turnstile (riga 10)
 *   PATCH → aggiorna sondaggio, mestiere, canale
 *
 * ─────────────────────────────────────────────────────────────────────────
 * PERCHÉ LA VERIFICA ANTI-BOT STA QUI E NON IN UNA FUNZIONE SUA
 * ─────────────────────────────────────────────────────────────────────────
 * Vercel, sul piano Hobby, ammette **12 funzioni per deploy** — e il 2 Agosto
 * 2026 il deploy si è già rotto una volta per questo. Siamo a undici, e il
 * posto che resta serve al webhook di WhatsApp (Fase 3): senza quello il canale
 * non esiste, mentre verificare un gettone sono quattro righe.
 *
 * La casa però non è arbitraria: passare il controllo anti-bot è un fatto
 * dell'ingresso di quell'utente, ed è questo file che si occupa dell'ingresso.
 */

import { currentUser } from "./_lib/auth.js";
import {
  avviaAccesso,
  collega,
  collegamenti,
  concludiAccesso,
  kindDalBiglietto,
  prova,
  ritornoPer,
  stacca,
  type ConnectorKind,
} from "./_lib/connectors.js";
import { ensureProfile, withUser } from "./_lib/db.js";

const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

interface ProfileRow {
  id: string;
  email: string | null;
  trade_id: string | null;
  channel: string | null;
  plan_id: string | null;
  survey: Record<string, unknown>;
  created_at: string;
}

interface PatchBody {
  survey?: Record<string, unknown>;
  tradeId?: string;
  channel?: string;
}

export default {
  async fetch(request: Request): Promise<Response> {
    let user: { id: string; email: string | null } | null;
    try {
      user = await currentUser(request);
    } catch (error) {
      // Configurazione mancante (database o firma dei cookie): è un problema
      // di Tommaso, non dell'utente. Il messaggio dice già quale variabile.
      return json({ error: error instanceof Error ? error.message : String(error) }, 503);
    }
    if (!user) return json({ error: "Devi entrare prima." }, 401);

    // ═══════════════════════════════════════════════════════════════════
    // I CONNETTORI — Fase 5
    // ═══════════════════════════════════════════════════════════════════
    //
    // ⚠️ Vivono qui e non in `api/connectors.ts` per la solita ragione: Vercel
    // Hobby ammette **12 funzioni** e ci siamo esattamente. La casa non è
    // arbitraria — «cosa ho collegato io» è un fatto del profilo, come il
    // mestiere e il sondaggio.
    //
    //   GET   ?connettori=1  → cosa ho collegato (mai i segreti)
    //   POST  { collega }    → collega il MIO account, dopo averlo provato
    //   DELETE ?connettore=  → stacca
    const url = new URL(request.url);

    // ── L'accesso col proprio account ─────────────────────────────────
    // «io li voglio tutti che si fa l'accesso» — Tommaso, 9 Agosto 2026.
    //
    //   GET ?accedi=microsoft   → dove mandare l'utente
    //   GET ?ritorno=microsoft  → dove torna, con il codice in mano
    //
    // ⚠️ L'indirizzo di ritorno deve combaciare **carattere per carattere** con
    // quello registrato presso Google/Microsoft: e' la loro difesa contro chi
    // dirotta i codici, e il primo motivo per cui questi collegamenti falliscono.
    //
    // ⚠️ Non e' uguale per tutti: Microsoft vieta la coda `?ritorno=` alle app
    // aperte agli account personali. Il perche' sta in `ritornoPer()`.
    const base = origine(request);

    const accedi = url.searchParams.get("accedi") as ConnectorKind | null;
    if (request.method === "GET" && accedi) {
      const esito = avviaAccesso(accedi, user.id, ritornoPer(base, accedi));
      return "url" in esito ? json(esito, 200) : json({ error: esito.errore }, 400);
    }

    const codiceInMano = url.searchParams.get("code");
    const statoInMano = url.searchParams.get("state") ?? "";
    // Chi torna con la coda dice da se' chi e'; chi torna nudo (Microsoft) lo
    // dice col biglietto.
    const tornato = (url.searchParams.get("ritorno") ??
      (statoInMano ? kindDalBiglietto(statoInMano) : null)) as ConnectorKind | null;

    if (request.method === "GET" && tornato && (codiceInMano || url.searchParams.get("error"))) {
      const codice = codiceInMano;
      const stato = statoInMano;
      const rifiuto = url.searchParams.get("error");

      // ⚠️ Si risponde con una REDIREZIONE, non con JSON: qui ci arriva il
      // browser dell'utente dopo aver cliccato «autorizzo», e vedersi comparire
      // una pagina di codice al posto del sito e' l'esperienza peggiore
      // possibile subito dopo aver dato fiducia.
      const torna = (esito: string) =>
        new Response(null, {
          status: 302,
          headers: { Location: `${base}/?connettore=${tornato}&esito=${encodeURIComponent(esito)}` },
        });

      if (rifiuto || !codice) return torna(rifiuto === "access_denied" ? "annullato" : "errore");

      const esito = await concludiAccesso(tornato, user.id, codice, stato, ritornoPer(base, tornato));
      return torna(esito.ok === true ? "ok" : esito.perche);
    }

    if (request.method === "GET" && url.searchParams.get("connettori") !== null) {
      return json({ connections: await collegamenti(user.id) }, 200);
    }

    if (request.method === "DELETE") {
      const kind = url.searchParams.get("connettore") as ConnectorKind | null;
      if (!kind) return json({ error: "Serve quale connettore staccare." }, 400);
      await stacca(user.id, kind);
      return json({ staccato: kind }, 200);
    }

    if (request.method === "GET") {
      // Al primo accesso la riga non esiste ancora: la creiamo qui invece di
      // con un trigger sulle tabelle di Better Auth, così se un domani loro
      // cambiano nome non si rompe niente.
      await ensureProfile(user.id, user.email);
      const profile = await read(user.id);
      return profile
        ? json(shape(profile), 200)
        : json({ error: "Profilo non trovato subito dopo averlo creato." }, 500);
    }

    // ── Riga 10: la verifica anti-bot ────────────────────────────────────
    if (request.method === "POST") {
      // ── Collega il MIO account ─────────────────────────────────────
      // La regola di Tommaso, 9 Agosto 2026: «colleghi con il tuo account e hai
      // le tue cose». Le chiavi di CorpAgent non entrano mai qui: quelle che
      // arrivano sono dell'utente, e restano sue.
      const grezzo = await request.clone().text();
      if (grezzo.includes("\"collega\"")) {
        let corpo: {
          collega?: {
            kind?: ConnectorKind;
            secret?: string;
            label?: string;
            meta?: Record<string, unknown>;
          };
        };
        try {
          corpo = JSON.parse(grezzo) as typeof corpo;
        } catch {
          return json({ error: "Richiesta non leggibile." }, 400);
        }

        const c = corpo.collega;
        if (!c?.kind || !c.secret) {
          return json({ error: "Servono il connettore e la chiave." }, 400);
        }

        // ⚠️ Si prova PRIMA di salvare. Salvare una chiave che non funziona
        // regala all'utente un agente muto: lui legge «collegato», l'agente non
        // trova niente, e nessuno dei due capisce perché.
        const esito = await prova(c.kind, c.secret, c.meta ?? {});
        if (esito.ok !== true) return json({ error: esito.perche }, 400);

        await collega(user.id, {
          kind: c.kind,
          label: c.label ?? esito.nome,
          secret: c.secret,
          meta: { ...(c.meta ?? {}), ...(esito.meta ?? {}), nome: esito.nome },
        });

        return json({ connected: c.kind, nome: esito.nome }, 200);
      }

      const secret = process.env.TURNSTILE_SECRET_KEY;

      // Senza la chiave la verifica non si può fare. Si risponde "passato" con
      // `configured: false`: in sviluppo, e finché Tommaso non prende la chiave
      // gratuita, l'ingresso deve funzionare comunque. Un cancello che nessuno
      // può aprire è peggio di nessun cancello — e l'interfaccia lo dichiara,
      // invece di far credere che ci sia una protezione che non c'è.
      if (!secret) return json({ ok: true, configured: false }, 200);

      let body: { token?: string };
      try {
        body = (await request.json()) as { token?: string };
      } catch {
        return json({ error: "Richiesta non leggibile." }, 400);
      }

      const token = typeof body.token === "string" ? body.token : "";
      if (!token) return json({ error: "Verifica non completata." }, 400);

      try {
        // Cloudflare vuole i campi come un modulo, non come JSON.
        const form = new URLSearchParams({ secret, response: token });
        const verify = await fetch(SITEVERIFY, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: form,
          signal: AbortSignal.timeout(8000),
        });
        const result = (await verify.json()) as {
          success?: boolean;
          "error-codes"?: string[];
        };

        if (!result.success) {
          return json(
            {
              error: "La verifica non è andata a buon fine. Riprova.",
              detail: (result["error-codes"] ?? []).join(", "),
            },
            403
          );
        }

        return json({ ok: true, configured: true }, 200);
      } catch (error) {
        // Cloudflare non raggiungibile o tempo scaduto. Non si blocca l'ingresso
        // per un problema che non è dell'utente: si lascia passare e si annota.
        console.error("Turnstile non verificabile, lascio passare:", error);
        return json({ ok: true, configured: true, unverified: true }, 200);
      }
    }

    if (request.method === "PATCH") {
      let body: PatchBody;
      try {
        body = (await request.json()) as PatchBody;
      } catch {
        return json({ error: "Richiesta non leggibile." }, 400);
      }

      await ensureProfile(user.id, user.email);

      const updated = await withUser(user.id, async (client) => {
        const result = await client.query<ProfileRow>(
          `update public.profiles set
             survey   = coalesce($2::jsonb, survey),
             trade_id = coalesce($3, trade_id),
             channel  = coalesce($4, channel)
           where id = $1
           returning *`,
          [
            user.id,
            body.survey ? JSON.stringify(body.survey) : null,
            body.tradeId ?? null,
            body.channel ?? null,
          ]
        );
        return result.rows[0];
      });

      return updated
        ? json(shape(updated), 200)
        : json({ error: "Profilo non aggiornato." }, 500);
    }

    return json({ error: "Metodo non ammesso." }, 405);
  },
};

async function read(userId: string): Promise<ProfileRow | undefined> {
  return withUser(userId, async (client) => {
    const result = await client.query<ProfileRow>(
      "select * from public.profiles where id = $1",
      [userId]
    );
    return result.rows[0];
  });
}

/**
 * Da `trade_id` a `tradeId`. Postgres parla con le sottolineature, il
 * TypeScript con le maiuscole: la traduzione sta qui e in nessun altro posto.
 */
function shape(row: ProfileRow) {
  return {
    id: row.id,
    email: row.email,
    tradeId: row.trade_id,
    channel: row.channel,
    planId: row.plan_id,
    survey: row.survey ?? {},
    createdAt: row.created_at,
  };
}

/**
 * L'indirizzo pubblico del sito.
 *
 * ⚠️ Si preferisce quello configurato a quello della richiesta: su Vercel ogni
 * pubblicazione ha anche un indirizzo suo (`corpagent-xyz123.vercel.app`), e se
 * l'utente ci arrivasse da li' il ritorno non combacerebbe con quello
 * registrato presso Google — e l'accesso fallirebbe solo qualche volta, che e'
 * il modo peggiore di fallire.
 */
function origine(request: Request): string {
  const configurato = process.env.BETTER_AUTH_URL;
  if (configurato?.startsWith("http")) return configurato.replace(/\/$/, "");
  return new URL(request.url).origin;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

/**
 * `billing` — i soldi. Righe 29, 30, 31 e 33 della Fase 4.
 *
 * «Fatto quando: un ristoratore paga con la carta e l'agente si attiva da solo.»
 *
 *   GET  /api/billing            → il mio piano, i miei crediti, la mia chiave
 *   POST { checkout: 'pro' }     → vai a pagare l'abbonamento
 *   POST { topup: 'ricarica10' } → compra un pacchetto di crediti
 *   POST { portal: true }        → cambia carta, disdici, scarica le fatture
 *   POST { byok: 'sk-or-...' }   → uso la mia chiave (riga 31)
 *   POST /api/billing?stripe=1   → il webhook di Stripe (pubblico, firmato)
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ⚠️ NIENTE LIBRERIA DI STRIPE, DI PROPOSITO
 * ─────────────────────────────────────────────────────────────────────────
 * Il pacchetto ufficiale pesa qualche megabyte e su una funzione serverless
 * quel peso si paga a ogni avvio a freddo, cioè proprio nel momento in cui il
 * cliente sta guardando la rotellina prima di pagare. Qui servono tre chiamate
 * HTTP e una verifica di firma: si fanno con `fetch` e `node:crypto`, come già
 * si fa per WhatsApp.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ⚠️ I PREZZI STANNO QUI, NON NEL BROWSER
 * ─────────────────────────────────────────────────────────────────────────
 * Il browser manda **il nome del piano**, mai la cifra. Se mandasse la cifra,
 * chiunque potrebbe aprire gli strumenti da sviluppatore e comprare il piano
 * Pro per un centesimo. È l'errore più vecchio del commercio elettronico e si
 * evita in un modo solo: il prezzo lo decide il server.
 */

import { currentUser } from "./_lib/auth.js";
import { withUser, getPool } from "./_lib/db.js";
import { createHmac, timingSafeEqual } from "node:crypto";

const STRIPE = "https://api.stripe.com/v1";

/**
 * I piani, con i prezzi in centesimi.
 *
 * ⚠️ Devono restare uguali a quelli scritti in `src/data/plans.ts`, che è
 * quello che l'utente legge. Se divergono, uno vede un prezzo e ne paga un
 * altro — ed è il genere di errore che diventa una segnalazione, non un bug.
 */
const PIANI: Record<string, { nome: string; centesimi: number; crediti: number }> = {
  starter: { nome: "CorpAgent Starter", centesimi: 900, crediti: 50_000 },
  business: { nome: "CorpAgent Business", centesimi: 2900, crediti: 250_000 },
  pro: { nome: "CorpAgent Pro", centesimi: 5900, crediti: 800_000 },
  enterprise: { nome: "CorpAgent Enterprise", centesimi: 23000, crediti: 4_000_000 },
};

/**
 * I pacchetti di ricarica (riga 30).
 *
 * «Il sistema non blocca l'agente di punto in bianco, ma gli permette di
 * acquistare pacchetti di ricarica rapida.» Si pagano una volta e non
 * scadono col mese: chi ha comprato dei crediti li ha comprati.
 */
const RICARICHE: Record<string, { nome: string; centesimi: number; crediti: number }> = {
  ricarica5: { nome: "Ricarica 5 €", centesimi: 500, crediti: 200_000 },
  ricarica10: { nome: "Ricarica 10 €", centesimi: 1000, crediti: 450_000 },
  ricarica25: { nome: "Ricarica 25 €", centesimi: 2500, crediti: 1_200_000 },
};

/** Sotto questa soglia si avvisa che stanno finendo (riga 33). */
const SOGLIA_AVVISO = 20_000;

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // ── Il webhook di Stripe ───────────────────────────────────────────
    // ⚠️ Sta PRIMA del controllo dell'accesso, e deve: Stripe non ha un
    // cookie di sessione. Al posto dell'accesso c'è la firma, che è una
    // difesa più forte — un cookie si ruba, una firma HMAC no.
    if (url.searchParams.get("stripe") !== null) {
      return handleWebhook(request);
    }

    let user: { id: string; email: string | null } | null;
    try {
      user = await currentUser(request);
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : String(error) }, 503);
    }
    if (!user) return json({ error: "Devi entrare prima." }, 401);
    const userId = user.id;

    // ── Cosa ho adesso ─────────────────────────────────────────────────
    if (request.method === "GET") {
      const stato = await withUser(userId, async (client) => {
        const sub = await client.query<{
          plan_id: string;
          status: string;
          current_period_end: string | null;
          cancel_at_period_end: boolean;
        }>(
          `select plan_id, status, current_period_end, cancel_at_period_end
             from public.subscriptions where user_id = $1`,
          [userId]
        );
        const saldo = await client.query<{ n: string }>(
          "select public.credit_balance($1)::text as n",
          [userId]
        );
        const profilo = await client.query<{ byok_last4: string | null }>(
          "select byok_last4 from public.profiles where id = $1",
          [userId]
        );
        return {
          sub: sub.rows[0] ?? null,
          crediti: Number(saldo.rows[0]?.n ?? 0),
          byokLast4: profilo.rows[0]?.byok_last4 ?? null,
        };
      });

      const attivo = servizioAttivo(stato.sub);
      return json(
        {
          planId: stato.sub?.plan_id ?? "free",
          status: stato.sub?.status ?? "inactive",
          /**
           * ⚠️ Questo, non `status`: chi disdice resta `canceled` ma ha
           * diritto al servizio fino alla fine del mese che ha già pagato.
           * Spegnerglielo subito sarebbe tenersi dei soldi senza dare niente.
           */
          active: attivo,
          renewsOn: stato.sub?.current_period_end ?? null,
          endingAtPeriodEnd: stato.sub?.cancel_at_period_end ?? false,
          credits: stato.crediti,
          /** Riga 33: stanno finendo. */
          lowCredits: stato.crediti < SOGLIA_AVVISO,
          /** Riga 31: le ultime quattro cifre bastano a capire quale chiave è. */
          byokLast4: stato.byokLast4,
          plans: Object.entries(PIANI).map(([id, p]) => ({
            id,
            name: p.nome,
            priceEur: p.centesimi / 100,
            credits: p.crediti,
          })),
          topups: Object.entries(RICARICHE).map(([id, p]) => ({
            id,
            name: p.nome,
            priceEur: p.centesimi / 100,
            credits: p.crediti,
          })),
        },
        200
      );
    }

    if (request.method !== "POST") return json({ error: "Metodo non ammesso." }, 405);

    let body: {
      checkout?: string;
      topup?: string;
      portal?: boolean;
      byok?: string | null;
      returnTo?: string;
    };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return json({ error: "Richiesta non leggibile." }, 400);
    }

    // ── Riga 31: la mia chiave, i miei soldi ───────────────────────────
    if (body.byok !== undefined) {
      const chiave = typeof body.byok === "string" ? body.byok.trim() : "";
      if (chiave && !chiave.startsWith("sk-or-")) {
        return json(
          { error: "Non sembra una chiave di OpenRouter: cominciano tutte con «sk-or-»." },
          400
        );
      }

      // Si prova prima di salvarla. Salvare una chiave sbagliata vuol dire
      // che l'agente smette di rispondere e nessuno capisce perché.
      if (chiave) {
        const prova = await fetch("https://openrouter.ai/api/v1/key", {
          headers: { Authorization: `Bearer ${chiave}` },
        });
        if (!prova.ok) {
          return json({ error: "OpenRouter non riconosce questa chiave." }, 400);
        }
      }

      await withUser(userId, (client) =>
        client.query(
          `update public.profiles
              set byok_key = $2, byok_last4 = $3
            where id = $1`,
          [userId, chiave || null, chiave ? chiave.slice(-4) : null]
        )
      );
      return json({ byokLast4: chiave ? chiave.slice(-4) : null }, 200);
    }

    // ⚠️ Il controllo su Stripe sta QUI e non in cima, di proposito: leggere il
    // proprio piano e mettere la propria chiave (riga 31) devono funzionare
    // anche prima che i pagamenti esistano. Metterlo in cima — che era la
    // prima versione — spegneva mezza schermata per una chiave che non c'entra.
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) {
      return json(
        { error: "I pagamenti non sono ancora configurati.", detail: "Manca STRIPE_SECRET_KEY." },
        503
      );
    }

    const base = origin(request);
    const customer = await ensureCustomer(userId, user.email, secret);
    if (!customer) return json({ error: "Non riesco a creare il profilo di pagamento." }, 502);

    // ── Cambia carta, disdici, scarica le fatture ──────────────────────
    // ⚠️ Non lo costruiamo noi: è il portale di Stripe. Rifarlo vorrebbe dire
    // gestire carte e fatture con le nostre mani, cioè prendersi obblighi
    // (PCI, fatture, rimborsi) per riprodurre peggio una cosa che esiste.
    if (body.portal) {
      const portale = await stripe(secret, "billing_portal/sessions", {
        customer,
        return_url: `${base}/?pagamento=tornato`,
      });
      if (!portale.ok) return json({ error: "Portale non disponibile.", detail: portale.detail }, 502);
      return json({ url: (portale.data as { url: string }).url }, 200);
    }

    // ── Riga 29: l'abbonamento ─────────────────────────────────────────
    if (body.checkout) {
      const piano = PIANI[body.checkout];
      if (!piano) return json({ error: "Piano sconosciuto." }, 400);

      const sessione = await stripe(secret, "checkout/sessions", {
        mode: "subscription",
        customer,
        success_url: `${base}/?pagamento=ok`,
        cancel_url: `${base}/?pagamento=annullato`,
        // ⚠️ Il prezzo si costruisce qui e non si prende da un listino creato a
        // mano nel pannello di Stripe: un listino da tenere allineato a mano è
        // un posto in più dove i prezzi possono divergere.
        "line_items[0][quantity]": "1",
        "line_items[0][price_data][currency]": "eur",
        "line_items[0][price_data][unit_amount]": String(piano.centesimi),
        "line_items[0][price_data][recurring][interval]": "month",
        "line_items[0][price_data][product_data][name]": piano.nome,
        // Torna indietro nel webhook: è così che sappiamo quale piano è stato
        // comprato senza fidarci di quello che dirà il browser.
        "metadata[plan_id]": body.checkout,
        "subscription_data[metadata][plan_id]": body.checkout,
      });
      if (!sessione.ok) return json({ error: "Pagamento non avviato.", detail: sessione.detail }, 502);
      return json({ url: (sessione.data as { url: string }).url }, 200);
    }

    // ── Riga 30: la ricarica ───────────────────────────────────────────
    if (body.topup) {
      const pacco = RICARICHE[body.topup];
      if (!pacco) return json({ error: "Pacchetto sconosciuto." }, 400);

      const sessione = await stripe(secret, "checkout/sessions", {
        mode: "payment",
        customer,
        success_url: `${base}/?pagamento=ok`,
        cancel_url: `${base}/?pagamento=annullato`,
        "line_items[0][quantity]": "1",
        "line_items[0][price_data][currency]": "eur",
        "line_items[0][price_data][unit_amount]": String(pacco.centesimi),
        "line_items[0][price_data][product_data][name]": pacco.nome,
        "metadata[topup_id]": body.topup,
        "metadata[credits]": String(pacco.crediti),
      });
      if (!sessione.ok) return json({ error: "Ricarica non avviata.", detail: sessione.detail }, 502);
      return json({ url: (sessione.data as { url: string }).url }, 200);
    }

    return json({ error: "Non ho capito cosa vuoi fare." }, 400);
  },
};

// ─────────────────────────────────────────────────────────────────────────
// IL WEBHOOK
// ─────────────────────────────────────────────────────────────────────────

/**
 * Quello che Stripe ci dice: pagato, rinnovato, disdetto, carta rifiutata.
 *
 * ⚠️ È il secondo indirizzo pubblico del sistema, dopo quello di WhatsApp, e
 * vale la stessa regola: **si risponde 200 anche quando qualcosa va storto da
 * noi**. Stripe interpreta un errore come «non ricevuto» e ripete per giorni;
 * un nostro guasto diventerebbe una tempesta.
 *
 * La firma è diversa da quella di Meta: Stripe firma `timestamp.corpo`, e
 * manda tutto dentro `Stripe-Signature` insieme al timestamp.
 */
async function handleWebhook(request: Request): Promise<Response> {
  const segreto = process.env.STRIPE_WEBHOOK_SECRET;
  if (!segreto) {
    console.error("STRIPE_WEBHOOK_SECRET non configurato: rifiuto il webhook.");
    return new Response("Non configurato", { status: 503 });
  }
  if (request.method !== "POST") return new Response("Metodo non ammesso", { status: 405 });

  const raw = await request.text();
  if (!firmaValida(raw, request.headers.get("stripe-signature"), segreto)) {
    return new Response("Firma non valida", { status: 401 });
  }

  let evento: {
    id?: string;
    type?: string;
    data?: { object?: Record<string, unknown> };
  };
  try {
    evento = JSON.parse(raw) as typeof evento;
  } catch {
    return new Response("Corpo non leggibile", { status: 400 });
  }

  try {
    await applica(evento);
  } catch (error) {
    console.error("Webhook Stripe: errore nel trattare l'evento", evento.type, error);
  }
  return new Response("ok", { status: 200 });
}

/**
 * Stripe firma `timestamp.corpo` con HMAC-SHA256.
 *
 * ⚠️ Si controlla anche **quanto è vecchio**: senza, una richiesta firmata
 * intercettata mesi fa potrebbe essere rimandata identica per riattivare un
 * abbonamento disdetto. Cinque minuti è la finestra che consiglia Stripe.
 */
function firmaValida(raw: string, header: string | null, segreto: string): boolean {
  if (!header) return false;

  const parti = Object.fromEntries(
    header.split(",").map((p) => {
      const i = p.indexOf("=");
      return [p.slice(0, i).trim(), p.slice(i + 1).trim()];
    })
  ) as { t?: string; v1?: string };

  if (!parti.t || !parti.v1) return false;

  const eta = Math.abs(Date.now() / 1000 - Number(parti.t));
  if (!Number.isFinite(eta) || eta > 300) return false;

  const atteso = createHmac("sha256", segreto).update(`${parti.t}.${raw}`, "utf8").digest("hex");
  const a = Buffer.from(atteso, "hex");
  const b = Buffer.from(parti.v1, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

async function applica(evento: {
  id?: string;
  type?: string;
  data?: { object?: Record<string, unknown> };
}): Promise<void> {
  const oggetto = evento.data?.object ?? {};
  const client = await getPool().connect();

  try {
    switch (evento.type) {
      // Ha finito di pagare. Se era una ricarica, i crediti si accreditano qui.
      case "checkout.session.completed": {
        const customer = String(oggetto.customer ?? "");
        const metadata = (oggetto.metadata ?? {}) as Record<string, string>;
        if (!customer) return;

        if (metadata.topup_id && metadata.credits) {
          await client.query("select public.credit_from_stripe($1, $2, 'topup', $3)", [
            customer,
            Number(metadata.credits),
            // ⚠️ L'identificativo della sessione, non quello dell'evento:
            // Stripe ripete lo stesso evento con id diversi, e useremmo la
            // chiave sbagliata per accorgerci del doppione.
            String(oggetto.id ?? evento.id ?? ""),
          ]);
        }
        break;
      }

      // Nato, rinnovato, cambiato, disdetto: lo stato arriva sempre da qui.
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const customer = String(oggetto.customer ?? "");
        if (!customer) return;

        const metadata = (oggetto.metadata ?? {}) as Record<string, string>;
        const stato =
          evento.type === "customer.subscription.deleted"
            ? "canceled"
            : String(oggetto.status ?? "active");
        const fine = oggetto.current_period_end
          ? new Date(Number(oggetto.current_period_end) * 1000).toISOString()
          : null;

        const risultato = await client.query<{ user_id: string | null }>(
          "select public.apply_stripe_state($1, $2, $3, $4, $5, $6) as user_id",
          [
            customer,
            String(oggetto.id ?? ""),
            metadata.plan_id ?? null,
            stato,
            fine,
            Boolean(oggetto.cancel_at_period_end),
          ]
        );
        const userId = risultato.rows[0]?.user_id;

        // Il piano nuovo porta i suoi crediti. Una volta per periodo: la
        // chiave del movimento è l'abbonamento + la data di scadenza, quindi
        // un rinnovo accredita, un aggiornamento qualsiasi no.
        if (userId && stato === "active" && metadata.plan_id) {
          const piano = PIANI[metadata.plan_id];
          if (piano) {
            await client.query("select public.credit_from_stripe($1, $2, 'plan', $3)", [
              customer,
              piano.crediti,
              `${oggetto.id}:${oggetto.current_period_end ?? ""}`,
            ]);
          }
          await client.query("update public.profiles set plan_id = $2 where id = $1", [
            userId,
            metadata.plan_id,
          ]);
        }
        break;
      }

      // La carta è stata rifiutata. Non si spegne niente qui: Stripe riprova
      // da solo per giorni, e `status = 'past_due'` basta a far comparire
      // l'avviso nel sito. Spegnere al primo tentativo fallito significa
      // bloccare un cliente per una carta scaduta che lui aggiorna domani.
      case "invoice.payment_failed": {
        const customer = String(oggetto.customer ?? "");
        if (customer) {
          await client.query(
            "select public.apply_stripe_state($1, null, null, 'past_due', null, null)",
            [customer]
          );
        }
        break;
      }
    }
  } finally {
    client.release();
  }
}

// ─────────────────────────────────────────────────────────────────────────
// STRIPE, A MANO
// ─────────────────────────────────────────────────────────────────────────

/** Una chiamata a Stripe. Restituisce sempre, non solleva mai. */
async function stripe(
  secret: string,
  percorso: string,
  campi: Record<string, string>
): Promise<{ ok: boolean; data: unknown; detail?: string }> {
  try {
    const response = await fetch(`${STRIPE}/${percorso}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(campi).toString(),
    });
    const data = (await response.json()) as { error?: { message?: string } };
    return response.ok
      ? { ok: true, data }
      : { ok: false, data, detail: data.error?.message ?? String(response.status) };
  } catch (error) {
    return { ok: false, data: null, detail: String(error) };
  }
}

/**
 * L'identificativo di cliente su Stripe, creandolo la prima volta.
 *
 * ⚠️ Si crea **una volta sola** e si tiene per sempre: è la chiave che tiene
 * insieme carte, fatture e storico. Crearne uno nuovo a ogni pagamento
 * spezzerebbe lo storico del cliente in tanti pezzi scollegati, e a fine anno
 * il commercialista non ci capirebbe niente.
 */
async function ensureCustomer(
  userId: string,
  email: string | null,
  secret: string
): Promise<string | null> {
  const esistente = await withUser(userId, async (client) => {
    const row = await client.query<{ stripe_customer_id: string | null }>(
      "select stripe_customer_id from public.subscriptions where user_id = $1",
      [userId]
    );
    return row.rows[0]?.stripe_customer_id ?? null;
  });
  if (esistente) return esistente;

  const creato = await stripe(secret, "customers", {
    ...(email ? { email } : {}),
    "metadata[user_id]": userId,
  });
  if (!creato.ok) return null;
  const id = (creato.data as { id?: string }).id;
  if (!id) return null;

  await withUser(userId, (client) =>
    client.query(
      `insert into public.subscriptions (user_id, stripe_customer_id)
       values ($1, $2)
       on conflict (user_id) do update set stripe_customer_id = excluded.stripe_customer_id`,
      [userId, id]
    )
  );
  return id;
}

/**
 * Il servizio è attivo adesso?
 *
 * ⚠️ Non basta `status === 'active'`. Chi disdice resta `canceled` ma ha
 * pagato fino alla fine del mese, e in quei giorni il servizio gli spetta.
 * Spegnerlo subito è tenersi dei soldi senza dare niente in cambio.
 */
function servizioAttivo(
  sub: { status: string; current_period_end: string | null } | null
): boolean {
  if (!sub) return false;
  if (sub.status === "active" || sub.status === "trialing") return true;
  if (sub.status === "past_due") return true; // Stripe sta ancora riprovando.
  if (!sub.current_period_end) return false;
  return new Date(sub.current_period_end).getTime() > Date.now();
}

/** L'indirizzo del sito, per dire a Stripe dove riportare la persona. */
function origin(request: Request): string {
  const configurato = process.env.BETTER_AUTH_URL;
  if (configurato && configurato.startsWith("http")) return configurato.replace(/\/$/, "");
  return new URL(request.url).origin;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

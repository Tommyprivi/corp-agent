/**
 * Gli ordini dei servizi — si compra dalla home, senza form lungo.
 *
 * Tommaso, 13 Agosto 2026: «i servizi si possono pagare direttamente, senza
 * fare la mail dove scrivi tutto». Il flusso:
 *
 *   1. OGGI (senza chiavi Stripe): «Ordina» registra l'ordine con un
 *      mini-modulo (azienda, email, telefono), Tommaso riceve l'avviso sui
 *      due canali delle richieste, e il cliente vede la conferma. Niente
 *      pagamento finto: si dice chiaro che si viene ricontattati per
 *      attivazione e pagamento.
 *   2. DOMANI (con le chiavi): per i servizi una-tantum lo stesso tasto apre
 *      il pagamento con carta (Stripe Checkout) e l'ordine passa a 'pagato'.
 *      Gli abbonamenti mensili vorranno i Prices veri su Stripe: quel giorno
 *      si compila `stripePrice` qui sotto, non si riscrive il flusso.
 *
 * ⚠️ IL LISTINO VIVE QUI, SUL SERVER. Il browser manda solo l'id del
 * servizio: se mandasse anche il prezzo, chiunque potrebbe «comprare» a un
 * euro cambiando una riga nella console del browser.
 */

import { getPool } from "./db.js";
import { avvisoWhatsAppTesto, esca, improntaProvenienza } from "./richieste.js";

export interface VoceListino {
  nome: string;
  /** Il prezzo di lancio mostrato e scritto nell'ordine. */
  lancio: string;
  /** Il prezzo pieno, barrato in pagina. */
  pieno: string;
  /** Centesimi per Stripe Checkout una-tantum. 0 = niente carta (abbonamenti e preventivi). */
  centesimi: number;
  /** Si può chiedere in 3 rate mensili senza interessi (13 Agosto 2026,
   *  Tommaso: «dai la possibilità di pagare in rate»). Vale per gli importi
   *  una-tantum e per l'avvio dell'area; l'incasso rateale lo gestiamo al
   *  contatto (e con Stripe, quando ci sarà, diventerà un piano vero). */
  rateabile?: boolean;
  /** Il price di Stripe per gli abbonamenti, quando ci sarà l'account. */
  stripePrice?: string;
}

// ⚠️ Senza prototipo, come AZIENDE: con un oggetto normale, un ordine con
// servizio "constructor" o "toString" supererebbe il controllo `!voce`
// (troverebbe la funzione ereditata da Object.prototype) e andrebbe a
// esplodere sul database. Trovato dalla verifica avversaria, non indovinato.
export const LISTINO: Record<string, VoceListino> = Object.assign(
  Object.create(null) as Record<string, VoceListino>,
  {
  agente: {
    nome: "Agente IA su misura",
    lancio: "49 €/mese",
    pieno: "99 €/mese",
    centesimi: 0,
  },
  area: {
    rateabile: true,
    nome: "Area aziendale completa",
    lancio: "249 € di avvio + 79 €/mese",
    pieno: "589 € di avvio + 119 €/mese",
    centesimi: 0,
  },
  negozio: {
    rateabile: true,
    nome: "Negozio online (Shopify)",
    lancio: "499 € una tantum",
    pieno: "999 € una tantum",
    centesimi: 49900,
  },
  sito: {
    rateabile: true,
    nome: "Sito web professionale",
    lancio: "299 € una tantum",
    pieno: "599 € una tantum",
    centesimi: 29900,
  },
  automazioni: {
    nome: "Automazioni d'ufficio",
    lancio: "consulenza gratuita",
    pieno: "a preventivo",
    centesimi: 0,
  },
  collegamenti: {
    rateabile: true,
    nome: "Collegamenti ai programmi",
    lancio: "99 € l'uno",
    pieno: "199 € l'uno",
    centesimi: 9900,
  },
  // ── Aggiunti il 13 Agosto sera («metti più servizi») — tutti consegnabili
  //    OGGI: WhatsApp e scanner sono già costruiti (api/whatsapp.ts, ingresso
  //    scanner di Speed), formazione/assistenza/dominio sono lavoro nostro.
  whatsapp: {
    nome: "Agente su WhatsApp",
    lancio: "149 € di avvio",
    pieno: "299 € di avvio",
    centesimi: 14900,
  },
  scanner: {
    nome: "Scanner e codici a barre",
    lancio: "199 € di avvio",
    pieno: "399 € di avvio",
    centesimi: 19900,
  },
  formazione: {
    nome: "Formazione del personale",
    lancio: "149 € una tantum",
    pieno: "299 € una tantum",
    centesimi: 14900,
  },
  assistenza: {
    nome: "Assistenza prioritaria",
    lancio: "49 €/mese",
    pieno: "99 €/mese",
    centesimi: 0,
  },
  dominio: {
    nome: "Dominio ed email aziendali",
    lancio: "79 € il primo anno",
    pieno: "149 € il primo anno",
    centesimi: 7900,
  },
  }
);

export interface DatiOrdine {
  servizio: string;
  azienda: string;
  email: string;
  telefono: string;
}

export interface EsitoOrdine {
  ok: boolean;
  /** Dove andare a pagare con la carta, quando Stripe sarà configurato. */
  paga?: string;
  errore?: string;
}

export async function creaOrdine(
  corpo: Record<string, unknown>,
  request: Request
): Promise<EsitoOrdine> {
  // L'esca invisibile: come nel form delle richieste, un programma che compila
  // tutto si tradisce da solo. Gli si dice «grazie» e non si salva niente.
  if (esca(corpo.sito)) return { ok: true };

  const voce = LISTINO[String(corpo.servizio ?? "")];
  if (!voce) return { ok: false, errore: "Servizio sconosciuto." };

  const azienda = String(corpo.azienda ?? "").trim();
  const email = String(corpo.email ?? "").trim();
  const telefono = String(corpo.telefono ?? "").trim();
  // In 3 rate mensili, solo per i servizi che lo ammettono (13 Agosto 2026).
  const rate = corpo.rate === true && voce.rateabile === true;
  if (azienda.length < 2) return { ok: false, errore: "Serve il nome dell'azienda." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return { ok: false, errore: "Serve un'email vera: è lì che arriva la conferma." };

  const prezzo = rate ? `${voce.lancio} · in 3 rate mensili` : voce.lancio;
  const id = await getPool()
    .query<{ ordine_crea: string | null }>("select public.ordine_crea($1,$2,$3,$4,$5,$6)", [
      String(corpo.servizio),
      prezzo,
      azienda,
      email,
      telefono,
      improntaProvenienza(request),
    ])
    .then((r) => r.rows[0]?.ordine_crea ?? null);

  // Il freno è scattato: troppi ordini dalla stessa provenienza in un'ora.
  // ⚠️ Si dice la VERITÀ, come fa il freno delle richieste (429 onesto): il
  // sesto ordine può essere un'azienda vera dietro lo stesso NAT, e un «fatto ✓»
  // finto sarebbe un cliente convinto di aver ordinato — e mai richiamato.
  if (id == null)
    return {
      ok: false,
      errore:
        "Troppi ordini ravvicinati da questa rete: riprova tra un'ora, o scrivici a corpagent7@gmail.com e facciamo noi.",
    };

  // L'avviso a Tommaso sui DUE canali delle richieste (email + WhatsApp), e
  // ATTESO, non lanciato e abbandonato: su Vercel la funzione viene congelata
  // appena la risposta parte, e un fetch lasciato a metà non parte affatto.
  // L'email è l'occhio principale sugli ordini: vale il secondo di attesa.
  await avvisaOrdine(voce, prezzo, azienda, email, telefono).catch(() => {});

  // ── Il ramo Stripe, per quando ci saranno le chiavi ───────────────────
  // Solo per i servizi una-tantum con un importo secco e in unica soluzione
  // (le rate e gli abbonamenti vorranno i piani veri su Stripe). Se qualsiasi
  // cosa va storta si torna all'ordine registrato: MAI un pagamento finto,
  // mai un errore che butta via l'ordine.
  const chiave = process.env.STRIPE_SECRET_KEY;
  if (chiave && voce.centesimi > 0 && !rate) {
    try {
      // L'origine di chi chiama, così anteprime e sviluppo tornano da sé —
      // stessa scelta di billing.ts. In produzione è corpagent.vercel.app.
      const base = request.headers.get("origin") ?? "https://corpagent.vercel.app";
      const p = new URLSearchParams({
        mode: "payment",
        "line_items[0][price_data][currency]": "eur",
        "line_items[0][price_data][product_data][name]": `${voce.nome} — offerta di lancio`,
        "line_items[0][price_data][unit_amount]": String(voce.centesimi),
        "line_items[0][quantity]": "1",
        customer_email: email,
        success_url: `${base}/?ordine=fatto`,
        cancel_url: `${base}/?ordine=annullato`,
        "metadata[ordine_id]": String(id),
      });
      const r = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${chiave}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: p.toString(),
        signal: AbortSignal.timeout(10_000),
      });
      const s = (await r.json()) as { url?: string };
      if (r.ok && s.url) return { ok: true, paga: s.url };
    } catch {
      /* si torna all'ordine registrato */
    }
  }

  return { ok: true };
}

async function avvisaOrdine(
  voce: VoceListino,
  prezzo: string,
  azienda: string,
  email: string,
  telefono: string
): Promise<void> {
  // Due canali insieme, come per le richieste: Resend può finire nello spam
  // e WhatsApp può avere il gettone scaduto — insieme è molto difficile.
  await Promise.allSettled([
    avvisoOrdineEmail(voce, prezzo, azienda, email, telefono),
    avvisoWhatsAppTesto(
      [`Nuovo ORDINE: *${voce.nome}*`, prezzo, "", azienda, `${telefono || "—"} · ${email}`].join("\n")
    ),
  ]);
}

async function avvisoOrdineEmail(
  voce: VoceListino,
  prezzo: string,
  azienda: string,
  email: string,
  telefono: string
): Promise<void> {
  const chiaveResend = process.env.RESEND_API_KEY;
  if (!chiaveResend) return;
  const destinatari = (process.env.AVVISI_A ?? "corpagent7@gmail.com")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${chiaveResend}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM ?? "CorpAgent <onboarding@resend.dev>",
        to: destinatari,
        subject: `ORDINE: ${voce.nome} — ${azienda}`,
        text: [
          `Servizio: ${voce.nome}`,
          `Prezzo di lancio: ${prezzo}`,
          `Azienda:  ${azienda}`,
          `Email:    ${email}`,
          `Telefono: ${telefono}`,
          "",
          "Da ricontattare per attivazione e pagamento.",
        ].join("\n"),
        reply_to: email,
      }),
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    /* muto, come gli avvisi delle richieste */
  }
}

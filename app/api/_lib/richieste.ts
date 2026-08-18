/**
 * Le richieste che arrivano dal form pubblico — Direzione finale, 10 Agosto 2026.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * COSA CAMBIA RISPETTO A TUTTO IL RESTO DEL PROGETTO
 * ─────────────────────────────────────────────────────────────────────────
 * Ogni altro file di `api/` parla con `withUser()`: c'è una persona collegata,
 * e il database mostra solo le sue righe. **Qui no.** Chi compila il form è
 * un'azienda di passaggio che non ha nessun account, e non ne avrà uno finché
 * Tommaso non le consegna la sua versione.
 *
 * Quindi si passa dalle tre funzioni `security definer` della migrazione 0015 —
 * `lead_nuova`, `lead_dice`, `lead_stato` — che sono porte strette: ognuna fa
 * una cosa sola e restituisce solo quello che serve.
 *
 * ⚠️ Questo file è l'unico del progetto raggiungibile **senza aver fatto
 * l'accesso**. Ogni riga qui dentro va letta pensando «e se chi chiama fosse
 * un programma ostile?».
 */

import { getPool } from "./db.js";
import { createHash } from "node:crypto";

const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export interface DatiRichiesta {
  azienda: string;
  settore: string;
  telefono: string;
  email: string;
  esigenza: string;
}

/**
 * Il gettone di Cloudflare, controllato prima di toccare il database.
 *
 * ⚠️ Prima, non dopo. Un bot che riempie `leads` di righe finte non è solo
 * fastidio: ogni riga finta apre una conversazione con l'agente, e ogni
 * conversazione con l'agente sono soldi veri di modello. Il controllo costa
 * una chiamata; non farlo costa la bolletta.
 */
export async function umano(gettone: string | undefined): Promise<boolean> {
  const segreto = process.env.TURNSTILE_SECRET_KEY;
  if (!segreto || !gettone) return false;

  try {
    const r = await fetch(SITEVERIFY, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: segreto, response: gettone }),
      signal: AbortSignal.timeout(8000),
    });
    return ((await r.json()) as { success?: boolean }).success === true;
  } catch {
    return false;
  }
}

/**
 * L'esca: un campo che una persona non vede e non compila mai.
 *
 * ⚠️ È nascosto con il CSS, non con `type="hidden"`. I programmi che riempiono
 * i moduli saltano i campi `hidden` — sanno che sono una trappola — mentre
 * riempiono quelli visibili nel codice ma invisibili sullo schermo. Il campo si
 * chiama `sito` proprio perché sembri una cosa che valga la pena compilare.
 *
 * ⚠️ Non basta da sola: è una difesa debole, che ferma i programmi banali e non
 * quelli scritti apposta. Vive insieme al limite di frequenza, e cede il posto
 * a Turnstile appena Turnstile torna a funzionare.
 */
export function esca(valore: unknown): boolean {
  return typeof valore === "string" && valore.trim().length > 0;
}

/**
 * L'impronta di chi sta scrivendo — per contare, non per riconoscere.
 *
 * ⚠️ Non si conserva l'indirizzo IP. Un IP è un dato personale, e tenerlo per
 * contare tre richieste all'ora sarebbe raccogliere molto più del necessario.
 * L'impronta con sale permette di dire «queste vengono dallo stesso posto»
 * senza permettere di dire «da quale posto»: è la differenza fra contare e
 * sorvegliare.
 */
export function improntaProvenienza(request: Request): string | null {
  // ⚠️ SICUREZZA: NON si prende il PRIMO valore di `x-forwarded-for`. Quello lo
  // scrive il client, e ruotandolo a ogni tentativo il freno anti-bruteforce
  // (8 tentativi/15 min per provenienza) sembrerebbe ogni volta un posto nuovo.
  // Si usano prima gli header che mette LA PIATTAFORMA (Vercel imposta
  // `x-real-ip` / `x-vercel-forwarded-for` all'IP vero della connessione,
  // sovrascrivendo qualsiasi cosa il client dichiari); solo come ultima
  // risorsa l'ULTIMO anello di `x-forwarded-for` — quello aggiunto dal proxio
  // fidato più vicino a noi, non quello dichiarato dal client in testa.
  const ip =
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",").pop()?.trim() ||
    null;
  if (!ip) return null;
  const sale = process.env.CONNECTORS_KEY ?? "corpagent";
  return createHash("sha256").update(`${sale}|${ip}`).digest("hex").slice(0, 32);
}

/** Controlli minimi, quelli che evitano una richiesta inutilizzabile. */
export function cosaManca(d: Partial<DatiRichiesta>): string | null {
  if (!d.azienda?.trim()) return "Manca il nome dell'azienda.";
  if (!d.settore?.trim()) return "Manca di cosa vi occupate.";
  if (!d.telefono?.trim()) return "Manca il telefono.";
  if (!d.email?.trim()) return "Manca l'email.";
  // ⚠️ Il controllo dell'email è volutamente largo: «una chiocciola e un punto
  // dopo». Le regole complete degli indirizzi validi sono un labirinto, e ogni
  // regola in più è un'azienda vera respinta per un indirizzo legittimo strano.
  // Se l'indirizzo è sbagliato lo scopriamo scrivendo, non indovinando.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim())) return "L'email non sembra giusta.";
  if (!d.esigenza?.trim()) return "Raccontaci cosa ti serve.";
  return null;
}

/**
 * Salva la richiesta e restituisce la chiave con cui l'azienda la seguirà.
 * `rifiutata` è vero quando dallo stesso posto ne sono già arrivate tre in
 * un'ora.
 */
export async function nuovaRichiesta(
  d: DatiRichiesta,
  impronta: string | null
): Promise<{ id: string | null; chiave: string | null; rifiutata: boolean }> {
  const r = await getPool().query<{ id: string | null; chiave: string | null; rifiutata: boolean }>(
    "select id, chiave, rifiutata from public.lead_nuova($1,$2,$3,$4,$5,$6)",
    [d.azienda, d.settore, d.telefono, d.email, d.esigenza, impronta]
  );
  return r.rows[0];
}

/** Aggiunge una battuta alla conversazione di qualifica. */
export async function scriviInRichiesta(
  chiave: string,
  ruolo: "agente" | "azienda",
  testo: string
): Promise<number> {
  const r = await getPool().query<{ lead_dice: number }>(
    "select public.lead_dice($1,$2,$3) as lead_dice",
    [chiave, ruolo, testo]
  );
  return r.rows[0]?.lead_dice ?? -1;
}

/**
 * La conversazione fin qui, per dare memoria all'agente.
 *
 * ⚠️ Passa da una funzione e non da un `select`, e la ragione è costata una
 * prova fallita: `leads` ha la sicurezza per riga accesa **senza politiche**,
 * quindi una lettura diretta non trova zero righe per sbaglio — le trova zero
 * perché è esattamente ciò che una tabella così deve rispondere. Vedi la
 * migrazione 0016.
 */
export async function conversazione(
  chiave: string
): Promise<{ ruolo: string; testo: string }[]> {
  const r = await getPool().query<{ ruolo: string; testo: string }>(
    "select * from public.lead_conversazione($1)",
    [chiave]
  );
  return r.rows;
}

/** I dati del form, per far partire l'agente già informato. */
export async function datiRichiesta(chiave: string): Promise<DatiRichiesta | null> {
  const r = await getPool().query<DatiRichiesta>("select * from public.lead_dati($1)", [chiave]);
  return r.rows[0] ?? null;
}

/** Cosa vede l'azienda della sua richiesta: quattro campi, nessuno di più. */
export async function statoRichiesta(chiave: string) {
  const r = await getPool().query("select * from public.lead_stato($1)", [chiave]);
  return r.rows[0] ?? null;
}

// ─────────────────────────────────────────────────────────────────────────
// L'AVVISO A TOMMASO
// ─────────────────────────────────────────────────────────────────────────

/**
 * Manda l'avviso via Resend.
 *
 * ⚠️ Non solleva mai e non blocca la risposta all'azienda. Se l'email non
 * parte, la richiesta è **già salvata**: si perde una notifica, non un cliente.
 * L'ordine giusto è sempre «prima metti al sicuro, poi avvisa» — al contrario,
 * un guasto di Resend farebbe fallire l'invio del form davanti a un
 * imprenditore che non capirebbe perché.
 */
export async function avvisaTommaso(d: DatiRichiesta, chiave: string): Promise<void> {
  // ⚠️ DUE CANALI, E NON È RIDONDANZA INUTILE. Il contatto commerciale è
  // manuale: una richiesta vista due giorni dopo è un cliente perso. Resend
  // può finire nello spam (il mittente non è un dominio nostro) e WhatsApp può
  // avere il gettone scaduto — ma è molto improbabile che falliscano insieme.
  await Promise.allSettled([avvisoPerEmail(d, chiave), avvisoSuWhatsApp(d)]);
}

async function avvisoPerEmail(d: DatiRichiesta, chiave: string): Promise<void> {
  const chiaveResend = process.env.RESEND_API_KEY;
  // ⚠️ Elenco, non un indirizzo solo: finché Resend non ha un dominio
  // verificato accetta **solo la casella con cui ti sei iscritto**. Così si
  // può scrivere a tutte e due e lasciare che sia Resend a scartare quella che
  // non può servire — invece di dover scegliere in anticipo quale funziona.
  const destinatari = (process.env.AVVISI_A ?? "corpagent7@gmail.com")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  if (!chiaveResend) return;

  const corpo = [
    `Azienda:  ${d.azienda}`,
    `Settore:  ${d.settore}`,
    `Telefono: ${d.telefono}`,
    `Email:    ${d.email}`,
    "",
    "Cosa gli serve:",
    d.esigenza,
    "",
    `Segui la pratica: https://corpagent.vercel.app/richiesta/${chiave}`,
  ].join("\n");

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${chiaveResend}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // ⚠️ `onboarding@resend.dev` è il mittente che Resend concede senza
        // dominio verificato. Funziona subito e finisce in posta in arrivo
        // perché scrive **a te**. Per scrivere ai clienti servirà un dominio
        // vero: quel giorno cambia solo questa riga.
        from: process.env.RESEND_FROM ?? "CorpAgent <onboarding@resend.dev>",
        to: destinatari,
        // Il nome dell'azienda nell'oggetto: la casella diventa un elenco
        // scorribile senza aprire niente.
        subject: `Richiesta da ${d.azienda} (${d.settore})`,
        text: corpo,
        reply_to: d.email,
      }),
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    // Volutamente muto: vedi sopra.
  }
}

/**
 * Lo stesso avviso su WhatsApp, al numero del titolare.
 *
 * ⚠️ È il canale che **funziona di sicuro oggi**: è provato, non ha domini da
 * verificare e non finisce nello spam. L'email resta perché regge testi lunghi
 * e si archivia; questo perché arriva in tasca in tre secondi.
 */
async function avvisoSuWhatsApp(d: DatiRichiesta): Promise<void> {
  const testo = [
    `Nuova richiesta: *${d.azienda}*`,
    d.settore,
    "",
    d.esigenza.slice(0, 300),
    "",
    `${d.telefono} · ${d.email}`,
  ].join("\n");
  await avvisoWhatsAppTesto(testo);
}

/**
 * Un testo qualsiasi sul WhatsApp di Tommaso. Esportata perché è il secondo
 * canale anche degli ORDINI (api/_lib/ordini.ts): la ragione è la stessa
 * delle richieste — Resend può finire nello spam, e un ordine non visto è un
 * cliente perso.
 */
export async function avvisoWhatsAppTesto(testo: string): Promise<void> {
  const numero = process.env.AVVISI_WA;
  const gettone = process.env.WHATSAPP_TOKEN;
  const telefono = process.env.WHATSAPP_PHONE_ID;
  if (!numero || !gettone || !telefono) return;

  try {
    await fetch(`https://graph.facebook.com/v21.0/${telefono}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${gettone}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: numero,
        type: "text",
        text: { body: testo },
      }),
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    // Muto come sopra: la richiesta è già al sicuro nel database.
  }
}

// ─────────────────────────────────────────────────────────────────────────
// L'AGENTE DI PRIMA QUALIFICA
// ─────────────────────────────────────────────────────────────────────────

/**
 * Tre domande, poi chiude all'email. Deciso da Tommaso il 10 Agosto 2026.
 *
 * ⚠️ Le tre righe più importanti di questo testo sono i divieti. Un agente
 * commerciale che promette prezzi o tempi crea un'aspettativa che poi tocca a
 * Tommaso disinnescare al primo scambio di email — cioè trasforma un contatto
 * caldo in una trattativa che parte in salita.
 */
export function istruzioniQualifica(d: DatiRichiesta): string {
  return [
    "Sei il primo contatto di CorpAgent. Parli con un imprenditore che ha appena",
    "lasciato la sua richiesta sul sito. Il tuo lavoro è UNO SOLO: capire meglio",
    "il suo problema in tre domande, e poi passarlo a una persona vera.",
    "",
    "QUELLO CHE SAI GIÀ (non richiederlo):",
    `- Azienda: ${d.azienda}`,
    `- Di cosa si occupa: ${d.settore}`,
    `- Cosa ha scritto: ${d.esigenza}`,
    "",
    "LE TRE DOMANDE, una per volta, mai due insieme:",
    "1. Il problema concreto: cosa succede oggi che gli fa perdere tempo o clienti.",
    "2. I numeri: quanti messaggi o chiamate al giorno, in che orari.",
    "3. Cosa usa già: WhatsApp, gestionali, fogli, chi risponde adesso ai clienti.",
    "",
    "Adatta le domande a quello che ha già raccontato: se una risposta l'ha già",
    "data nel form, salta quella domanda e passa alla successiva.",
    "",
    "DOPO LA TERZA RISPOSTA chiudi così, e non continuare oltre:",
    "riassumi in due righe quello che hai capito, e digli di scrivere a",
    "corpagent7@gmail.com — o che gli scriviamo noi da lì entro un giorno",
    "lavorativo. Poi digli che nell'email è utile indicare i programmi che usano",
    "(gestionale, fatturazione, magazzino, calendario) e quali collegamenti",
    "vorrebbero, perché fa risparmiare giorni.",
    "",
    "⚠️ E aggiungi sempre: di NON mandare password o chiavi via email. I",
    "collegamenti li fa il cliente dal pannello, col suo account, dopo la",
    "consegna. Una chiave mandata per posta resta per sempre in due caselle.",
    "",
    "⚠️ NON FARE MAI, per nessun motivo:",
    "- non dire prezzi, cifre, sconti, né 'a partire da'",
    "- non promettere tempi di consegna precisi",
    "- non promettere funzioni: non hai visto la sua azienda",
    "- non proporre chiamate, videochiamate o appuntamenti: il canale è l'email",
    "- non dare link, non parlare di accessi, di prova gratuita o di iscrizione",
    "",
    "Se ti chiede il prezzo: «Dipende da cosa serve davvero, e non voglio",
    "spararti un numero a caso. È la prima cosa di cui ti parliamo per email.»",
    "",
    "TONO: dai del tu, italiano semplice, frasi corte. Sei uno che ha lavorato",
    "in azienda, non un venditore. Niente entusiasmo finto, niente punti",
    "esclamativi, niente «fantastico». Due o tre righe per messaggio, mai di più.",
  ].join("\n");
}

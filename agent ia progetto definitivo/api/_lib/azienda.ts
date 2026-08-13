/**
 * L'area di un'azienda cliente — la parte che gira sul server.
 *
 * Voluta da Tommaso il 12 Agosto 2026: *«rendiamole già funzionanti le funzioni
 * di Salvatore veramente»*. Prima `/speed` era una bella schermata che non
 * faceva niente; da qui in poi l'accesso è vero, la chat risponde davvero, i
 * clienti si salvano e i numeri del cruscotto sono contati.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ⚠️ QUESTE PERSONE NON SONO UTENTI DI CORPAGENT
 * ─────────────────────────────────────────────────────────────────────────
 * Sono dipendenti di un nostro cliente: non pagano un abbonamento, non hanno
 * un account Google, non devono comparire nei nostri conteggi. Hanno tabelle
 * e sessioni loro (migrazione 0018), e si entra solo dalle porte strette
 * `security definer` — la sicurezza per riga qui non ha nessuno da riconoscere.
 *
 * ⚠️ **Il controllo di chi sta chiedendo sta qui, non nel SQL.** Le funzioni
 * del database eseguono e basta. Se una riga di questo file sparisse, un
 * operatore vedrebbe il cruscotto del titolare.
 *
 * @see db/migrations/0018_azienda.sql
 */

import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { getPool } from "./db.js";

/**
 * L'unica azienda viva oggi. Il giorno del secondo cliente diventa un elenco.
 *
 * ⚠️ Senza prototipo (`Object.create(null)`), e non è un vezzo: un oggetto
 * normale risponde `AZIENDE["__proto__"]` con qualcosa di **truthy**, così una
 * guardia `if (!AZIENDE[azienda])` verrebbe scavalcata mandando `azienda:
 * "__proto__"`, e chi la manda si aprirebbe una postazione da titolare in un
 * tenant fantasma. Senza prototipo, `__proto__` è una chiave mancante come
 * un'altra, e la guardia regge.
 */
export const AZIENDE: Record<string, { nome: string; postazioni: Postazione[] }> = Object.assign(
  Object.create(null) as Record<string, { nome: string; postazioni: Postazione[] }>,
  {
  speed: {
    nome: "Speed Trasporti",
    postazioni: [
      {
        id: "traffico",
        nome: "Traffico",
        cosa: "Risponde ai clienti, organizza i carichi",
        istruzioni:
          "Ti occupi del traffico: chi chiama per sapere dov'è un carico, chi chiede " +
          "un preventivo, chi vuole prenotare un ritiro. Rispondi come risponderebbe " +
          "un capo traffico con vent'anni di mestiere: corto, concreto, senza giri.\n" +
          "SUI PREZZI, la regola è di ferro (decisa dal titolare): un preventivo si " +
          "fa SOLO se il listino con quella tratta è scritto qui sotto nei documenti " +
          "— e allora calcoli da lì e dici la cifra del listino, mai uno sconto, mai " +
          "un arrotondamento a favore. Se la tratta o la merce non è nel listino, " +
          "NON stimare mai un prezzo: comincia con [PASSO], raccogli tratta, colli, " +
          "peso e quando serve, e di' che il preventivo arriva da una persona.",
      },
      {
        id: "magazzino",
        nome: "Magazzino",
        cosa: "Carico, scarico, conteggi, bolle",
        istruzioni:
          "Ti occupi del magazzino: conteggi, colli, bolle, differenze fra quello che " +
          "è arrivato e quello che c'era scritto. Chi ti parla ha spesso le mani " +
          "occupate: risposte brevissime, una cosa alla volta.",
      },
      {
        id: "autisti",
        nome: "Autisti",
        cosa: "A voce mentre guidano, foto alla consegna",
        istruzioni:
          "Parli con autisti che stanno guidando. Frasi corte, mai elenchi lunghi, " +
          "mai chiedere di leggere qualcosa. Se serve un'informazione complicata, " +
          "dì che gliela mandi scritta.",
      },
      {
        id: "ammin",
        nome: "Amministrazione",
        cosa: "Solleciti, fatture fornitori",
        istruzioni:
          "Ti occupi di amministrazione: fatture, solleciti, fornitori, scadenze. " +
          "Tono formale ma asciutto. Sui soldi non si tira a indovinare mai.",
      },
    ],
  },
  }
);

export interface Postazione {
  id: string;
  nome: string;
  cosa: string;
  istruzioni: string;
}

export interface Persona {
  persona: string;
  azienda: string;
  email: string;
  nome: string;
  ruolo_scelto: string;
  ruolo_vero: string;
  reparto: string;
  foto: string | null;
  attiva: boolean;
}

// ─────────────────────────────────────────────────────────────────────────
// LA PASSWORD
// ─────────────────────────────────────────────────────────────────────────

/**
 * ⚠️ `scrypt` e non un hash veloce: se un giorno qualcuno si portasse via la
 * tabella, con SHA-256 avrebbe le password di 150 persone in una serata. Con
 * scrypt ogni tentativo costa memoria e tempo, e un elenco così non si prova.
 *
 * Il confronto è a tempo costante: confrontare due stringhe con `===` dice a chi
 * misura i millisecondi quanti caratteri iniziali ha indovinato.
 */
export function impasta(password: string): string {
  const sale = randomBytes(16);
  const impronta = scryptSync(password, sale, 64);
  return `scrypt$${sale.toString("hex")}$${impronta.toString("hex")}`;
}

export function verifica(password: string, salvata: string): boolean {
  const pezzi = salvata.split("$");
  if (pezzi.length !== 3 || pezzi[0] !== "scrypt") return false;
  try {
    const sale = Buffer.from(pezzi[1], "hex");
    const atteso = Buffer.from(pezzi[2], "hex");
    const dato = scryptSync(password, sale, atteso.length);
    return timingSafeEqual(atteso, dato);
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// ENTRARE
// ─────────────────────────────────────────────────────────────────────────

/**
 * Entra, oppure crea la postazione se l'email non c'è ancora.
 *
 * ⚠️ **Non c'è una schermata di registrazione separata**, ed è voluto: Salvatore
 * apre il link, mette la sua email e una password, ed è dentro. Il primo che
 * entra in un'azienda diventa titolare (lo decide il database, non il browser);
 * tutti quelli dopo sono operatori finché lui non li promuove.
 *
 * ⚠️ Il rovescio della medaglia va detto: **oggi chiunque conosca il link può
 * aprirsi una postazione da operatore.** Va bene per la beta di un'azienda sola
 * con un link che non è scritto da nessuna parte; prima delle 150 persone vere
 * serve l'invito su elenco chiuso, ed è segnato in docs/CLIENTE-SPEED-TRASPORTI.md.
 */
export async function entra(
  azienda: string,
  email: string,
  password: string,
  ipHash: string | null = null
): Promise<{ token: string; persona: Persona } | { errore: string }> {
  const pool = getPool();

  // ⚠️ Il freno si guarda PRIMA di toccare la password (migrazione 0019):
  // otto errori in un quarto d'ora dalla stessa impronta non sono un
  // magazziniere coi guanti, sono un programma che prova password. Chi entra
  // giusto al primo colpo non lo incontra mai.
  const freno = await pool.query<{ az_freno: boolean }>(
    "select public.az_freno($1, $2, $3)",
    [azienda, ipHash, email]
  );
  if (freno.rows[0]?.az_freno) {
    return {
      errore:
        "Troppi tentativi in poco tempo. Aspetta un quarto d'ora e riprova — " +
        "o chiedi in ufficio di reimpostarti la password.",
    };
  }

  const trovata = await pool.query<{
    id: string;
    segreto: string;
    attiva: boolean;
  }>("select id, segreto, attiva from public.az_persona($1, $2)", [azienda, email]);

  let id: string;
  if (trovata.rows[0]) {
    const r = trovata.rows[0];
    if (!r.attiva) return { errore: "Questa postazione è stata chiusa. Chiedi in ufficio." };
    if (!verifica(password, r.segreto)) {
      await pool
        .query("select public.az_freno_segna($1, $2, $3)", [azienda, ipHash, email])
        .catch(() => {});
      // ⚠️ Stesso messaggio per «password sbagliata» e per «email che non
      // esiste»: distinguerli direbbe a chiunque quali email sono valide.
      return { errore: "Email o password non corrispondono." };
    }
    id = r.id;
  } else {
    if (password.length < 8) {
      return { errore: "La password deve essere di almeno 8 caratteri." };
    }
    const emailPulita = email.trim().toLowerCase();

    // ⚠️ L'INGRESSO SU INVITO. Il primo che entra in un'azienda è il titolare
    // (bootstrap: Salvatore apre il link ed è dentro). Dal secondo in poi serve
    // un invito del titolare — se no chiunque conoscesse il link entrerebbe.
    const primo = await pool.query<{ az_prima_persona: boolean }>(
      "select public.az_prima_persona($1)",
      [azienda]
    );
    if (primo.rows[0]?.az_prima_persona) {
      const creata = await pool.query<{ id: string }>(
        "select id from public.az_crea($1, $2, $3)",
        [azienda, emailPulita, impasta(password)]
      );
      id = creata.rows[0].id;
    } else {
      // Consuma un invito valido (atomico: lo prende una persona sola).
      const inv = await pool.query<{ az_invito_prendi: string | null }>(
        "select public.az_invito_prendi($1, $2)",
        [azienda, emailPulita]
      );
      const ruolo = inv.rows[0]?.az_invito_prendi ?? null;
      if (!ruolo) {
        await pool
          .query("select public.az_freno_segna($1, $2, $3)", [azienda, ipHash, email])
          .catch(() => {});
        return {
          errore:
            "Non risulti tra le persone invitate. Chiedi in ufficio di aggiungerti, " +
            "poi rientra con questa email.",
        };
      }
      const creata = await pool.query<{ az_crea_invitato: string }>(
        "select public.az_crea_invitato($1, $2, $3, $4, $5) as az_crea_invitato",
        [azienda, emailPulita, impasta(password), ruolo, ""]
      );
      id = creata.rows[0].az_crea_invitato;
    }
  }

  const token = randomBytes(32).toString("base64url");
  // ⚠️ Nel database va l'IMPRONTA del gettone, non il gettone. Il gettone vero
  // lo tiene solo il browser (in localStorage). Così un dump del database non
  // contiene chiavi d'ingresso pronte all'uso: da un'impronta SHA-256 non si
  // risale al gettone, e senza il gettone non si entra. È la stessa logica di
  // una password, che infatti non si salva mai in chiaro.
  await pool.query("select public.az_sessione_apri($1, $2)", [id, improntaGettone(token)]);
  const persona = await sessione(token);
  if (!persona) return { errore: "Non sono riuscito ad aprire la sessione." };
  return { token, persona };
}

/** L'impronta di un gettone: SHA-256, la stessa a ogni chiamata (non salata),
 *  perché serve a RITROVARE la riga, non a nascondere una password debole —
 *  un gettone di 256 bit casuali non ha bisogno del sale. */
function improntaGettone(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export async function sessione(token: string | null | undefined): Promise<Persona | null> {
  if (!token) return null;
  // Si cerca per impronta: nel database non c'è mai il gettone in chiaro.
  const r = await getPool().query<Persona>("select * from public.az_sessione($1)", [
    improntaGettone(token),
  ]);
  const p = r.rows[0];
  if (!p || !p.attiva) return null;
  return p;
}

export async function esci(token: string): Promise<void> {
  await getPool().query("select public.az_esci($1)", [improntaGettone(token)]);
}

export async function salvaProfilo(
  persona: string,
  d: { nome: string; ruolo: string; reparto: string; foto: string | null }
): Promise<void> {
  await getPool().query("select public.az_profilo($1, $2, $3, $4, $5)", [
    persona,
    d.nome,
    d.ruolo,
    d.reparto,
    // Una foto a 256px in JPEG sta sotto i 40 KB: oltre, è un altro formato o
    // un tentativo di usare il database come disco.
    d.foto && d.foto.length < 120_000 ? d.foto : null,
  ]);
}

// ─────────────────────────────────────────────────────────────────────────
// PERSONE · CLIENTI · DOCUMENTI
// ─────────────────────────────────────────────────────────────────────────

export async function persone(azienda: string) {
  const r = await getPool().query("select * from public.az_persone($1)", [azienda]);
  return r.rows;
}

// ── L'ingresso su invito ────────────────────────────────────────────────

export async function invita(
  azienda: string,
  email: string,
  ruolo: string,
  reparto: string
): Promise<void> {
  const ammessi = ["titolare", "amministratore", "capo", "operatore", "osservatore"];
  if (!ammessi.includes(ruolo)) throw new Error("Ruolo sconosciuto.");
  if (!email.includes("@")) throw new Error("Email non valida.");
  await getPool().query("select public.az_invita($1,$2,$3,$4)", [azienda, email, ruolo, reparto]);
}

export async function inviti(azienda: string) {
  const r = await getPool().query("select * from public.az_inviti($1)", [azienda]);
  return r.rows;
}

export async function revocaInvito(azienda: string, email: string): Promise<void> {
  await getPool().query("select public.az_invito_revoca($1,$2)", [azienda, email]);
}

export async function cambiaRuolo(
  azienda: string,
  persona: string,
  ruolo: string,
  attiva: boolean
): Promise<void> {
  const ammessi = ["titolare", "amministratore", "capo", "operatore", "osservatore"];
  if (!ammessi.includes(ruolo)) throw new Error("Ruolo sconosciuto.");
  await getPool().query("select public.az_ruolo($1, $2, $3, $4)", [
    azienda,
    persona,
    ruolo,
    attiva,
  ]);
}

export async function clienti(azienda: string, cerca: string) {
  const r = await getPool().query("select * from public.az_clienti($1, $2)", [azienda, cerca]);
  return r.rows;
}

export async function salvaCliente(
  azienda: string,
  persona: string,
  c: Record<string, unknown>
): Promise<string | null> {
  const r = await getPool().query<{ az_cliente_salva: string | null }>(
    "select public.az_cliente_salva($1,$2,$3,$4,$5,$6,$7,$8,$9)",
    [
      (c.id as string) || null,
      azienda,
      String(c.nome ?? "").trim(),
      String(c.referente ?? ""),
      String(c.telefono ?? ""),
      String(c.email ?? ""),
      String(c.zona ?? ""),
      String(c.note ?? ""),
      persona,
    ]
  );
  return r.rows[0]?.az_cliente_salva ?? null;
}

export async function eliminaCliente(azienda: string, id: string): Promise<void> {
  await getPool().query("select public.az_cliente_elimina($1, $2)", [id, azienda]);
}

export async function documenti(azienda: string) {
  const r = await getPool().query("select * from public.az_documenti($1)", [azienda]);
  return r.rows;
}

export async function salvaDocumento(
  azienda: string,
  persona: string,
  titolo: string,
  testo: string
): Promise<void> {
  await getPool().query("select public.az_documento_salva($1,$2,$3,$4)", [
    azienda,
    titolo,
    testo,
    persona,
  ]);
}

export async function eliminaDocumento(azienda: string, id: string): Promise<void> {
  await getPool().query("select public.az_documento_elimina($1, $2)", [id, azienda]);
}

/**
 * Il registro attività: chi ha fatto cosa. ⚠️ Fatti amministrativi, mai
 * contenuti di chat. Scrittura «lancia e dimentica»: un audit che rallenta o
 * rompe l'azione vera è peggio di nessun audit.
 */
export function segnaAttivita(
  azienda: string,
  persona: string | null,
  azione: string,
  dettaglio = ""
): void {
  void getPool()
    .query("select public.az_attivita_scrivi($1,$2,$3,$4)", [azienda, persona, azione, dettaglio])
    .catch(() => {});
}

export async function attivita(azienda: string) {
  const r = await getPool().query("select * from public.az_attivita($1)", [azienda]);
  return r.rows;
}

export async function cerca(azienda: string, q: string) {
  const r = await getPool().query("select * from public.az_cerca($1,$2)", [azienda, q]);
  return r.rows;
}

export async function cruscotto(azienda: string) {
  const [base, mag, controlli] = await Promise.all([
    getPool().query<{ az_cruscotto: unknown }>("select public.az_cruscotto($1)", [azienda]),
    getPool().query<{ az_magazzino: unknown }>("select public.az_magazzino($1)", [azienda]),
    getPool().query("select * from public.az_da_controllare($1, null)", [azienda]),
  ]);
  const dati = (base.rows[0]?.az_cruscotto ?? {}) as Record<string, unknown>;
  // ⚠️ Il magazzino e le cose da controllare si innestano qui, invece di
  // riscrivere la grande funzione az_cruscotto: una funzione sola che fa tutto
  // è una funzione che si rompe tutta insieme.
  dati.magazzino = mag.rows[0]?.az_magazzino ?? null;
  dati.controlli = controlli.rows;
  return dati;
}

/** La data di oggi in fuso Europe/Rome, come stringa YYYY-MM-DD. */
export function oggiRoma(): string {
  // ⚠️ 'en-CA' dà proprio YYYY-MM-DD; il fuso Rome evita che a mezzanotte UTC
  // il report «di oggi» diventi quello di ieri per chi lavora in Italia.
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Rome" });
}

/** Salva il report di un giorno (uno per giorno, sovrascrive). */
export async function salvaReport(azienda: string, giorno: string, testo: string): Promise<void> {
  await getPool().query("select public.az_report_salva($1,$2::date,$3)", [azienda, giorno, testo]);
}

/** L'ultimo report disponibile — quello di oggi, o il più recente. */
export async function ultimoReport(
  azienda: string
): Promise<{ giorno: string; testo: string; creato: string } | null> {
  const r = await getPool().query<{ giorno: string; testo: string; creato: string }>(
    "select * from public.az_report_ultimo($1)",
    [azienda]
  );
  return r.rows[0] ?? null;
}

/**
 * Genera il report di direzione di un'azienda e lo salva come report del
 * giorno. UNO SOLO posto che lo fa, riusato da due chiamanti: il tasto nel
 * cruscotto (con `nome` = chi lo apre, per il saluto) e il lavoro serale delle
 * 20:00 (senza nome — non c'è nessuno davanti allo schermo).
 *
 * ⚠️ Al modello arrivano SOLO i numeri contati del cruscotto, già in italiano
 * (`riassuntoDati`), e le istruzioni gli vietano di inventare fatturato o
 * spedizioni che il sistema non ha. Ritorna il testo salvato, o `null` se il
 * modello è spento o non risponde: il chiamante decide cosa dire in quel caso.
 */
export async function generaReport(azienda: string, nome = ""): Promise<string | null> {
  const chiave = process.env.OPENROUTER_API_KEY;
  if (!chiave) return null;
  const dati = await cruscotto(azienda);
  try {
    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${chiave}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://corpagent.vercel.app",
        "X-Title": "CorpAgent · " + (AZIENDE[azienda]?.nome ?? azienda),
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        max_tokens: 260,
        temperature: 0.5,
        messages: [
          { role: "system", content: istruzioniRiepilogo(nome) },
          // ⚠️ I numeri già in italiano, non il JSON grezzo: così «1038
          // millisecondi» non diventa «1.038 ore».
          { role: "user", content: "I numeri di oggi e della settimana:\n" + riassuntoDati(dati) },
        ],
      }),
      signal: AbortSignal.timeout(25_000),
    });
    const body = (await r.json()) as { choices?: { message?: { content?: string } }[] };
    const testo = body.choices?.[0]?.message?.content?.trim();
    if (!testo) return null;
    // Si salva come report del giorno: così il titolare lo trova pronto quando
    // apre, senza rigenerarlo (e senza ripagare il modello).
    await salvaReport(azienda, oggiRoma(), testo);
    return testo;
  } catch {
    return null;
  }
}

/**
 * Il lavoro serale: prepara il report di ogni azienda conosciuta, così alle
 * 20:00 è già scritto e il titolare lo trova pronto invece di generarlo lui
 * aprendo il cruscotto. Lo chiama il `cron` di Vercel (dentro `whatsapp.ts`).
 *
 * ⚠️ Le aziende si fanno una per una, non in parallelo: sono poche e ognuna è
 * una chiamata al modello: meglio non aprire dieci richieste insieme. E se una
 * fallisce si va avanti con le altre — un'azienda muta non deve zittire le sue
 * vicine.
 */
export async function generaReportSerale(): Promise<{ azienda: string; fatto: boolean }[]> {
  const esiti: { azienda: string; fatto: boolean }[] = [];
  for (const azienda of Object.keys(AZIENDE)) {
    const testo = await generaReport(azienda).catch(() => null);
    esiti.push({ azienda, fatto: testo != null });
  }
  return esiti;
}

// ─────────────────────────────────────────────────────────────────────────
// IL MAGAZZINO — mezzi, movimenti, e la vista del capo
// ─────────────────────────────────────────────────────────────────────────

/** Da nome di reparto (come lo dichiara la persona) a id di postazione. */
export function postazioneDiReparto(reparto: string): string {
  const m: Record<string, string> = {
    Traffico: "traffico",
    Magazzino: "magazzino",
    Autisti: "autisti",
    Amministrazione: "ammin",
  };
  return m[reparto] ?? "";
}

export async function mezzi(azienda: string) {
  const r = await getPool().query("select * from public.az_mezzi($1)", [azienda]);
  return r.rows as { id: string; nome: string; targa: string; attivo: boolean }[];
}

export async function salvaMezzo(azienda: string, id: string | null, nome: string, targa: string) {
  const r = await getPool().query<{ az_mezzo_salva: string }>(
    "select public.az_mezzo_salva($1,$2,$3,$4)",
    [id, azienda, nome, targa]
  );
  return r.rows[0]?.az_mezzo_salva ?? null;
}

export async function eliminaMezzo(azienda: string, id: string) {
  await getPool().query("select public.az_mezzo_elimina($1,$2)", [id, azienda]);
}

export interface DatiMovimento {
  tipo: "carico" | "scarico" | "differenza" | "problema" | "ritiro" | "reclamo";
  colli?: number | null;
  atteso?: number | null;
  contato?: number | null;
  mezzo?: string;
  controparte?: string;
  testo?: string;
  /** Solo per i ritiri: quando è previsto. ISO, o null se non detto. */
  previsto?: string | null;
}

export async function registraMovimento(
  azienda: string,
  reparto: string,
  persona: string,
  d: DatiMovimento
): Promise<bigint> {
  const r = await getPool().query<{ az_movimento: string }>(
    "select public.az_movimento($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
    [
      azienda,
      reparto || "Magazzino",
      d.tipo,
      d.colli ?? null,
      d.atteso ?? null,
      d.contato ?? null,
      d.mezzo ?? "",
      d.controparte ?? "",
      d.testo ?? "",
      persona,
      d.previsto ?? null,
    ]
  );
  return BigInt(r.rows[0].az_movimento);
}

export async function chiudiControllo(azienda: string, id: string) {
  await getPool().query("select public.az_movimento_chiudi($1,$2)", [Number(id), azienda]);
}

/** Segna un ritiro come fatto. Porta separata: chiude SOLO i ritiri. */
export async function chiudiRitiro(azienda: string, id: string) {
  await getPool().query("select public.az_ritiro_fatto($1,$2)", [Number(id), azienda]);
}

export async function magazzino(azienda: string) {
  const r = await getPool().query<{ az_magazzino: unknown }>(
    "select public.az_magazzino($1)",
    [azienda]
  );
  return r.rows[0]?.az_magazzino ?? null;
}

export async function daControllare(azienda: string, reparto: string | null) {
  const r = await getPool().query("select * from public.az_da_controllare($1,$2)", [
    azienda,
    reparto,
  ]);
  return r.rows;
}

/**
 * I movimenti del giorno di un reparto — il registro della banchina.
 *
 * ⚠️ Sono i MOVIMENTI, non le chat: chi ha scaricato cosa è un dato operativo
 * condiviso (sta anche sulla bolla di carta). Le conversazioni con l'agente
 * restano private; da qui non ne passa nemmeno una riga.
 */
export async function movimentiOggi(azienda: string, reparto: string | null) {
  const r = await getPool().query("select * from public.az_movimenti_oggi($1,$2)", [
    azienda,
    reparto,
  ]);
  return r.rows;
}

/** I ritiri prenotati e non ancora fatti: li vede il traffico E il magazzino. */
export async function ritiri(azienda: string) {
  const r = await getPool().query("select * from public.az_ritiri($1)", [azienda]);
  return r.rows;
}

export async function traffico(azienda: string) {
  const r = await getPool().query<{ az_traffico: unknown }>(
    "select public.az_traffico($1)",
    [azienda]
  );
  return r.rows[0]?.az_traffico ?? null;
}

/**
 * Quanto usano lo strumento, persona per persona — la vista del capo.
 *
 * ⚠️ Non esce nessun testo di chat, per costruzione: la funzione SQL non
 * seleziona la colonna del testo. Il capo vede QUANTO, mai COSA. È la riga che
 * tiene il prodotto dalla parte giusta dell'articolo 4.
 */
export async function repartoUso(azienda: string, postazione: string) {
  const r = await getPool().query("select * from public.az_reparto_uso($1,$2)", [
    azienda,
    postazione,
  ]);
  return r.rows as {
    persona: string;
    nome: string;
    foto: string | null;
    richieste: string;
    ultimo: string | null;
  }[];
}

/**
 * Avvisa il capo di reparto e il titolare di una segnalazione.
 *
 * ⚠️ Oggi è predisposto ma **non parte davvero**: il numero WhatsApp aziendale
 * arriva alla fine (serve la P.IVA per il gettone Meta). Fino ad allora la
 * segnalazione vive nel pallino dell'app — che è già abbastanza. Questa
 * funzione non lancia mai un errore: un avviso che fallisce non deve mai far
 * fallire la registrazione del problema.
 */
export async function avvisaSegnalazione(): Promise<void> {
  if (!process.env.WHATSAPP_TOKEN || !process.env.WHATSAPP_PHONE_ID) return;
  // Il numero del capo non è ancora raccolto: quando ci sarà, qui si manda il
  // template. Per ora si esce in silenzio — il pallino nell'app ha già avvisato.
}

/**
 * Le istruzioni per il riepilogo della giornata — l'IA che guarda **tutta
 * l'azienda insieme**, non una postazione sola.
 *
 * È la cosa che fa sentire l'IA dappertutto e non solo nella chat: il titolare
 * apre il cruscotto e l'agente gli racconta com'è andata, come farebbe un
 * direttore che ha girato tutti i reparti. Il documento di Tommaso la chiama
 * «Agent Pulse» e «Daily Briefing».
 *
 * ⚠️ Stessa regola di ferro delle postazioni: **non inventa**. Parla solo dei
 * numeri che ha davanti — quelli veri, contati. Non conosce fatturato né
 * spedizioni (non ci sono i collegamenti), e non deve fingere di sì.
 */
/**
 * I numeri del cruscotto tradotti in fatti italiani, per il riepilogo.
 *
 * ⚠️ **Non si dà il JSON grezzo al modello.** Un `attesa: 1038` (millisecondi)
 * gli è già stato letto come «1.038 ore di attesa»: il numero da solo non porta
 * la sua unità, e il modello indovina l'unità sbagliata. Qui ogni numero arriva
 * con la sua parola accanto — «1,0 secondi», «2 richieste» — e non c'è niente da
 * indovinare.
 */
export function riassuntoDati(dati: unknown): string {
  const d = (dati ?? {}) as {
    oggi?: { domande?: number; risposte?: number; passate?: number; attesa?: number | null };
    per_postazione?: { p?: string; n?: number }[];
    aspetta?: { testo?: string | null; chi?: string; postazione?: string }[];
    totali?: { clienti?: number; documenti?: number; persone?: number };
  };
  const o = d.oggi ?? {};
  const righe: string[] = [];
  righe.push(
    `OGGI: ${o.domande ?? 0} richieste all'agente, ` +
      `${o.risposte ?? 0} risposte da solo, ` +
      `${o.passate ?? 0} girate a una persona.`
  );
  if (o.attesa != null) {
    righe.push(`Tempo medio di risposta dell'agente oggi: ${(o.attesa / 1000).toFixed(1)} secondi.`);
  }
  if (d.per_postazione?.length) {
    righe.push(
      "Richieste della settimana per postazione: " +
        d.per_postazione.map((p) => `${p.p} ${p.n}`).join(", ") + "."
    );
  }
  const aperte = (d.aspetta ?? []).filter((a) => a.testo);
  if (aperte.length) {
    righe.push(`Domande ancora aperte che aspettano una risposta (${aperte.length}):`);
    for (const a of aperte.slice(0, 6)) {
      righe.push(`- "${a.testo}"${a.chi ? ` (chiesta da ${a.chi})` : ""}`);
    }
  } else {
    righe.push("Non c'è niente in sospeso: nessuna domanda aperta aspetta il titolare.");
  }
  const t = d.totali ?? {};
  righe.push(
    `In archivio: ${t.clienti ?? 0} clienti, ${t.documenti ?? 0} documenti nella memoria dell'agente.`
  );
  return righe.join("\n");
}

export function istruzioniRiepilogo(nome: string): string {
  return [
    "Sei l'assistente di direzione di Speed Trasporti, azienda di trasporti e",
    "logistica di Torino. Stai parlando con il titolare" + (nome ? `, ${nome}` : "") + ".",
    "",
    "Ti do i numeri VERI di oggi e della settimana, contati dal sistema. Scrivi",
    "un riepilogo di 3-4 frasi, in italiano, come lo direbbe un direttore sveglio:",
    "prima come sta andando la giornata, poi — se c'è — cosa aspetta lui.",
    "",
    "REGOLE:",
    "- Parla solo di questi numeri. Non conosci fatturato, spedizioni o magazzino:",
    "  quei collegamenti non ci sono ancora, non inventarli e non nominarli come",
    "  se li avessi.",
    "- Se l'agente ha girato delle domande a una persona, dillo chiaro: sono le",
    "  cose che aspettano lui.",
    "- Niente elenchi puntati, niente titoli. Discorsivo e corto.",
    "- Se oggi non è successo quasi niente, dillo con semplicità invece di gonfiarlo.",
  ].join("\n");
}

// ─────────────────────────────────────────────────────────────────────────
// LA CONVERSAZIONE
// ─────────────────────────────────────────────────────────────────────────

export async function conversazione(azienda: string, persona: string, postazione: string) {
  const r = await getPool().query("select * from public.az_conversazione($1,$2,$3,$4)", [
    azienda,
    persona,
    postazione,
    40,
  ]);
  return r.rows as { id: string; ruolo: string; testo: string; passato: boolean }[];
}

export async function scrivi(
  azienda: string,
  persona: string,
  postazione: string,
  ruolo: "persona" | "agente",
  testo: string,
  passato = false,
  ms: number | null = null
): Promise<void> {
  await getPool().query("select public.az_scrivi($1,$2,$3,$4,$5,$6,$7)", [
    azienda,
    persona,
    postazione,
    ruolo,
    testo,
    passato,
    ms,
  ]);
}

/**
 * Il carattere dell'agente di una postazione.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ⚠️ LA REGOLA CHE VALE PIÙ DI TUTTE LE ALTRE MESSE INSIEME
 * ─────────────────────────────────────────────────────────────────────────
 * L'agente **non inventa**. Se non sa, lo dice e passa la domanda a una
 * persona. Un agente che tira a indovinare su un orario di consegna o su un
 * prezzo fa perdere un cliente a Speed Trasporti in una frase — e la fiducia di
 * Salvatore in tutto il sistema nella frase dopo.
 *
 * Il segnale è `[PASSO]` in testa alla risposta: il codice lo toglie prima di
 * mostrarla e segna quella riga come «girata a un umano». È così che il numero
 * «passate a una persona» del cruscotto è vero e non stimato.
 */
export function istruzioni(
  postazione: Postazione,
  chi: Persona,
  memoria: { titolo: string; testo: string }[],
  clientiNoti: string[]
): string {
  const righe = [
    `Sei l'agente della postazione «${postazione.nome}» di Speed Trasporti, ` +
      "azienda di trasporti e logistica di Torino, attiva dal 1998.",
    postazione.istruzioni,
    "",
    `Stai parlando con ${chi.nome || "un collega"}${chi.reparto ? `, reparto ${chi.reparto}` : ""}.`,
    "Dai del tu. Rispondi in italiano, corto: due o tre frasi, non di più, " +
      "a meno che non ti chiedano espressamente un elenco.",
    "",
    "REGOLA PRINCIPALE — non inventare mai, ma GUARDA prima di arrenderti.",
    "Hai degli strumenti: il registro di oggi, i ritiri da fare, le schede " +
      "clienti e il calcolo di distanze e tempi. USALI prima di dire che non " +
      "sai — un numero che lo strumento ti dà è un numero vero, riportalo con " +
      "sicurezza.",
    "Quello che invece NON hai: K-Master (spedizioni e tracking), il " +
      "gestionale delle fatture, gli scanner. Quindi numeri di spedizione, " +
      "stati di consegna dei colli affidati, prezzi fuori listino e saldi non " +
      "li conosci e non li deduci.",
    "Quando la risposta richiede un dato che né i documenti né gli strumenti " +
      "possono darti, comincia la risposta con [PASSO] e spiega in una frase " +
      "cosa serve e a chi lo stai girando. Non scusarti più di una volta.",
    "Quando la risposta ce l'hai (dai documenti o dagli strumenti), rispondi " +
      "e basta, senza [PASSO].",
  ];

  if (memoria.length) {
    righe.push("", "QUELLO CHE SAI DELL'AZIENDA:");
    for (const d of memoria) {
      righe.push(`— ${d.titolo}: ${d.testo.slice(0, 4000)}`);
    }
  } else {
    righe.push(
      "",
      "Nessuno ha ancora caricato listini, zone o regole nella sezione " +
        "Documenti: per ora sai solo quello che c'è scritto qui."
    );
  }

  if (clientiNoti.length) {
    righe.push(
      "",
      `CLIENTI IN ANAGRAFICA (solo i nomi — le schede stanno nella sezione Clienti): ${clientiNoti
        .slice(0, 60)
        .join(", ")}.`
    );
  }

  return righe.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────
// LE IMPOSTAZIONI DEL SITO — il capo decide come disporre le cose
// ─────────────────────────────────────────────────────────────────────────

/**
 * Le impostazioni di un'azienda: template, densità, ordine dei blocchi e delle
 * voci, tool per postazione. Un blob solo (migrazione 0026): si legge intero e
 * si applica, non si interroga.
 *
 * ⚠️ Il default vive nel FRONTEND, non qui: se un domani cambiano i blocchi
 * disponibili, cambia il default lì e il vecchio salvataggio resta valido —
 * quello che non conosce lo ignora. Qui si restituisce `{}` e ci pensa il
 * browser a riempirlo.
 */
export async function config(azienda: string): Promise<Record<string, unknown>> {
  const r = await getPool().query<{ az_config: Record<string, unknown> }>(
    "select public.az_config($1)",
    [azienda]
  );
  return r.rows[0]?.az_config ?? {};
}

export async function salvaConfig(azienda: string, impostazioni: unknown): Promise<void> {
  // ⚠️ Un tetto sulla dimensione: le impostazioni sono ordini e interruttori,
  // non un posto dove infilare dati. 20 KB è dieci volte quello che servirà mai.
  const testo = JSON.stringify(impostazioni ?? {});
  if (testo.length > 20_000) throw new Error("Impostazioni troppo grandi.");
  await getPool().query("select public.az_config_salva($1, $2::jsonb)", [azienda, testo]);
}

/**
 * Il modulo «scrivi al supporto»: arriva a noi (corpagent7) via Resend, con
 * nome e azienda già dentro l'oggetto, così la casella è un elenco scorribile.
 *
 * ⚠️ Muto sui fallimenti come tutti gli invii: un guasto di Resend non deve far
 * fallire l'azione davanti a chi ha scritto. Restituisce sempre «preso in
 * carico»: il messaggio è già salvato nell'attività, non si perde.
 */
export async function scriviAlSupporto(
  chi: Persona,
  testo: string
): Promise<void> {
  const chiaveResend = process.env.RESEND_API_KEY;
  const destinatari = (process.env.AVVISI_A ?? "corpagent7@gmail.com")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!chiaveResend) return;

  const nomeAzienda = AZIENDE[chi.azienda]?.nome ?? chi.azienda;
  const corpo = [
    `Supporto da ${nomeAzienda}`,
    "",
    `Da:      ${chi.nome || "(senza nome)"} <${chi.email}>`,
    `Ruolo:   ${chi.ruolo_vero}${chi.reparto ? ` · ${chi.reparto}` : ""}`,
    "",
    "Messaggio:",
    testo,
  ].join("\n");

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
        subject: `Supporto — ${nomeAzienda} (${chi.nome || chi.email})`,
        text: corpo,
        reply_to: chi.email || undefined,
      }),
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    // Volutamente muto.
  }
}

// ─────────────────────────────────────────────────────────────────────────
// LA PORTA D'INGRESSO DEGLI SCANNER
// ─────────────────────────────────────────────────────────────────────────

/** Il gettone attuale (per mostrarlo al titolare). Null se non generato. */
export async function ingressoChiave(azienda: string): Promise<string | null> {
  const r = await getPool().query<{ az_ingresso: string | null }>(
    "select public.az_ingresso($1)",
    [azienda]
  );
  return r.rows[0]?.az_ingresso ?? null;
}

/** Genera (o rigenera) il gettone. Il vecchio muore all'istante. */
export async function ingressoGenera(azienda: string): Promise<string> {
  const r = await getPool().query<{ az_ingresso_genera: string }>(
    "select public.az_ingresso_genera($1)",
    [azienda]
  );
  return r.rows[0].az_ingresso_genera;
}

/**
 * Riceve una lettura da un dispositivo. Il gettone identifica l'azienda; non
 * c'è utente. Torna null se il gettone non vale, così l'endpoint rifiuta.
 *
 * ⚠️ Scrive nella zona d'atterraggio grezza (trasp_letture) e, se il barcode è
 * già un collo noto, ne aggiorna lo stato — la stessa porta del database
 * gigante (migrazione 0027). Nessuna lettura si perde, nemmeno se non sappiamo
 * ancora a quale spedizione appartiene.
 */
export async function riceviLettura(
  chiave: string,
  d: { barcode: string; tipo?: string; dispositivo?: string; postazione?: string }
): Promise<{ azienda: string } | null> {
  const pool = getPool();
  const chi = await pool.query<{ az_ingresso_chi: string | null }>(
    "select public.az_ingresso_chi($1)",
    [chiave]
  );
  const azienda = chi.rows[0]?.az_ingresso_chi ?? null;
  if (!azienda) return null;

  await pool.query("select public.trasp_lettura_ingresso($1,$2,$3,$4,$5,$6)", [
    azienda,
    String(d.barcode).slice(0, 80),
    d.postazione ?? "Magazzino",
    null,
    d.tipo ?? "lettura",
    d.dispositivo ?? "",
  ]);
  return { azienda };
}

/** Le ultime letture arrivate dagli scanner, per la banchina. */
export async function letture(azienda: string) {
  // ⚠️ Dalla PORTA, non con una SELECT diretta: trasp_letture ha la sicurezza
  // per riga accesa e una lettura diretta tornerebbe zero righe (migrazione 0029).
  const r = await getPool().query("select * from public.az_letture($1)", [azienda]);
  return r.rows;
}

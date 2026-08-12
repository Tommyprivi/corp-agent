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

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
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
          "un capo traffico con vent'anni di mestiere: corto, concreto, senza giri.",
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
    const creata = await pool.query<{ id: string }>(
      "select id from public.az_crea($1, $2, $3)",
      [azienda, email.trim().toLowerCase(), impasta(password)]
    );
    id = creata.rows[0].id;
  }

  const token = randomBytes(32).toString("base64url");
  await pool.query("select public.az_sessione_apri($1, $2)", [id, token]);
  const persona = await sessione(token);
  if (!persona) return { errore: "Non sono riuscito ad aprire la sessione." };
  return { token, persona };
}

export async function sessione(token: string | null | undefined): Promise<Persona | null> {
  if (!token) return null;
  const r = await getPool().query<Persona>("select * from public.az_sessione($1)", [token]);
  const p = r.rows[0];
  if (!p || !p.attiva) return null;
  return p;
}

export async function esci(token: string): Promise<void> {
  await getPool().query("select public.az_esci($1)", [token]);
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

export async function cruscotto(azienda: string) {
  const r = await getPool().query<{ az_cruscotto: unknown }>(
    "select public.az_cruscotto($1)",
    [azienda]
  );
  return r.rows[0]?.az_cruscotto ?? null;
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
    "REGOLA PRINCIPALE — non inventare mai.",
    "Non hai accesso al gestionale, a K-Master, agli scanner del magazzino né " +
      "alle fatture: quei collegamenti non ci sono ancora. Quindi non conosci " +
      "nessun numero di spedizione, nessun orario di consegna, nessun prezzo e " +
      "nessun saldo, e non devi provare a dedurli.",
    "Quando la risposta richiede un dato che non hai qui sotto, comincia la " +
      "risposta con [PASSO] e poi spiega in una frase cosa serve e a chi lo " +
      "stai girando. Non scusarti più di una volta.",
    "Quando invece la risposta è qui sotto, rispondi e basta, senza [PASSO].",
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

/**
 * Il collegamento fra l'area di un'azienda cliente e il server.
 *
 * Un solo indirizzo (`/api/config`) per tutto, perché **Vercel Hobby ammette 12
 * funzioni** e siamo esattamente a 12. Da fuori sembra un'API con dieci rotte;
 * dentro è un `switch`.
 *
 * ⚠️ Il gettone di sessione vive in `localStorage` e dura 90 giorni. Non è una
 * distrazione: su 150 persone, un accesso da rifare ogni mattina è la ragione
 * numero uno per cui uno smette di usare un programma. Un magazziniere coi
 * guanti non digita una password alle sei del mattino — chiude e torna al
 * telefono.
 */

const CHIAVE = "corpagent.azienda.sessione";

export function gettone(): string | null {
  try {
    return window.localStorage.getItem(CHIAVE);
  } catch {
    return null;
  }
}

export function salvaGettone(t: string | null): void {
  try {
    if (t) window.localStorage.setItem(CHIAVE, t);
    else window.localStorage.removeItem(CHIAVE);
  } catch {
    // Navigazione privata: la sessione vale finché la scheda resta aperta.
  }
}

export interface PersonaViva {
  nome: string;
  email: string;
  ruolo: string;
  ruoloScelto: string;
  reparto: string;
  foto: string | null;
}

/** Sollevata quando la sessione non vale più: chi la riceve rimanda all'ingresso. */
export class SessioneScaduta extends Error {
  constructor() {
    super("sessione");
  }
}

export async function leggi<T>(cosa: string, extra: Record<string, string> = {}): Promise<T> {
  const t = gettone();
  if (!t) throw new SessioneScaduta();
  // ⚠️ Il gettone va nell'intestazione, non nell'URL: un gettone nella query
  // finisce nei log di Vercel e di ogni proxy in mezzo, ed è valido tre mesi.
  const q = new URLSearchParams({ az: cosa, ...extra });
  const r = await fetch(`/api/config?${q}`, {
    headers: { "x-azienda-sessione": t },
  });
  if (r.status === 401) {
    salvaGettone(null);
    throw new SessioneScaduta();
  }
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Errore");
  return (await r.json()) as T;
}

export async function manda<T>(corpo: Record<string, unknown>): Promise<T> {
  const t = gettone();
  const r = await fetch("/api/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(t ? { ...corpo, t } : corpo),
  });
  const body = await r.json().catch(() => ({}));
  if (r.status === 401 && corpo.az !== "entra") {
    salvaGettone(null);
    throw new SessioneScaduta();
  }
  if (!r.ok) throw new Error((body as { error?: string }).error ?? "Errore");
  return body as T;
}

// ─────────────────────────────────────────────────────────────────────────
// I TIPI CHE TORNANO DAL SERVER
// ─────────────────────────────────────────────────────────────────────────

export interface Cliente {
  id: string;
  nome: string;
  referente: string;
  telefono: string;
  email: string;
  zona: string;
  note: string;
  creato: string;
  aggiornato: string;
}

export interface PersonaElenco {
  id: string;
  email: string;
  nome: string;
  ruolo_scelto: string;
  ruolo_vero: string;
  reparto: string;
  foto: string | null;
  attiva: boolean;
  creata: string;
  ultimo: string | null;
  messaggi: string;
}

export interface Documento {
  id: string;
  titolo: string;
  testo: string;
  creato: string;
}

export interface Messaggio {
  id: string;
  ruolo: "persona" | "agente";
  testo: string;
  passato: boolean;
  creato: string;
}

export interface Magazzino {
  entrati: number;
  usciti: number;
  differenze: number;
  movimenti: number;
}

export interface Controllo {
  id: string;
  reparto: string;
  tipo: "problema" | "differenza" | "reclamo";
  testo: string;
  atteso: number | null;
  contato: number | null;
  chi: string;
  creato: string;
}

export interface Cruscotto {
  oggi: { domande: number; risposte: number; passate: number; attesa: number | null };
  ore: { h: number; n: number }[];
  giorni: { d: string; n: number; p: number }[];
  per_postazione: { p: string; n: number }[];
  totali: {
    risposte: number;
    passate: number;
    persone: number;
    clienti: number;
    documenti: number;
  };
  aspetta: { testo: string | null; chi: string; postazione: string; creato: string }[];
  magazzino: Magazzino | null;
  controlli: Controllo[];
}

export interface Mezzo {
  id: string;
  nome: string;
  targa: string;
  attivo: boolean;
}

export interface RepartoUso {
  persona: string;
  nome: string;
  foto: string | null;
  richieste: string;
  ultimo: string | null;
}

export interface RepartoDati {
  reparto: string;
  uso: RepartoUso[];
  controlli: Controllo[];
  magazzino: Magazzino | null;
}

export interface Movimento {
  id: string;
  tipo: "carico" | "scarico" | "differenza" | "problema" | "ritiro" | "reclamo";
  colli: number | null;
  atteso: number | null;
  contato: number | null;
  mezzo: string;
  controparte: string;
  testo: string;
  stato: "aperto" | "chiuso";
  chi: string;
  creato: string;
}

export interface Ritiro {
  id: string;
  controparte: string;
  testo: string;
  colli: number | null;
  previsto: string | null;
  chi: string;
  creato: string;
}

export interface Banchina {
  magazzino: Magazzino | null;
  movimenti: Movimento[];
  ritiri: Ritiro[];
}

export interface Ufficio {
  traffico: {
    ritiri_prenotati: number;
    ritiri_aperti: number;
    reclami_aperti: number;
  } | null;
  movimenti: Movimento[];
  ritiri: Ritiro[];
}

export interface Attivita {
  id: string;
  azione: string;
  dettaglio: string;
  chi: string;
  creato: string;
}

export interface RisultatoCerca {
  tipo: "cliente" | "movimento" | "documento";
  id: string;
  titolo: string;
  sotto: string;
  creato: string;
}

export interface Avviso {
  tipo: string;
  testo: string;
  quando: string;
}

export interface Lettura {
  id: string;
  barcode: string;
  tipo: string;
  dispositivo: string;
  abbinato: boolean;
  quando: string;
}

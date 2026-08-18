/**
 * Fluida — turni, ferie e presenze, per l'azienda cliente.
 *
 * ⚠️ Le stesse tre regole dei connettori di sempre:
 * 1. Si PROVA prima di salvare (una chiave rotta salvata è un agente muto).
 * 2. La chiave è cifrata (AES-256-GCM, `connectors.ts`), mai in chiaro.
 * 3. Un guasto si segna appena succede.
 *
 * Vive QUI, per azienda (`azienda_fluida`), e non nell'account generico di
 * CorpAgent: l'agente della console di Speed non ha nessuna visibilità sui
 * connettori personali di Better Auth — sono due sistemi separati.
 */

import { cifra, decifra } from "./connectors.js";
import { getPool } from "./db.js";

const FLUIDA = "https://api.fluida.io/api/v1";

export interface StatoFluida {
  company_id: string;
  nome: string;
  piano: string;
  attivo: boolean;
  ultimo_errore: string | null;
  aggiornato: string;
}

/** Chiama Fluida con la chiave data, PRIMA di salvare niente. */
export async function provaFluida(
  companyId: string,
  chiave: string
): Promise<{ ok: true; nome: string; piano: string } | { ok: false; perche: string }> {
  const id = companyId.trim();
  if (!id) return { ok: false, perche: "Serve l'ID azienda di Fluida." };
  try {
    const r = await fetch(`${FLUIDA}/companies/${encodeURIComponent(id)}`, {
      headers: { "x-fluida-app-uuid": chiave, Accept: "application/json" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!r.ok) {
      return {
        ok: false,
        perche:
          r.status === 401 || r.status === 403
            ? "Fluida non riconosce questa chiave per questa azienda."
            : `Fluida ha risposto ${r.status}.`,
      };
    }
    const corpo = (await r.json()) as { data?: { name?: string; subscription_plan?: string } };
    return {
      ok: true,
      nome: corpo.data?.name ?? "Azienda su Fluida",
      piano: corpo.data?.subscription_plan ?? "",
    };
  } catch (error) {
    return { ok: false, perche: `Non risponde: ${String(error).slice(0, 120)}` };
  }
}

export async function salvaFluida(
  azienda: string,
  companyId: string,
  chiave: string
): Promise<{ ok: true; nome: string } | { ok: false; perche: string }> {
  const esito = await provaFluida(companyId, chiave);
  if (!esito.ok) return esito;
  await getPool().query("select public.az_fluida_salva($1,$2,$3,$4,$5)", [
    azienda,
    companyId.trim(),
    cifra(chiave),
    esito.nome,
    esito.piano,
  ]);
  return { ok: true, nome: esito.nome };
}

export async function statoFluida(azienda: string): Promise<StatoFluida | null> {
  const r = await getPool().query<StatoFluida>("select * from public.az_fluida_stato($1)", [azienda]);
  return r.rows[0] ?? null;
}

export async function staccaFluida(azienda: string): Promise<void> {
  await getPool().query("select public.az_fluida_stacca($1)", [azienda]);
}

/**
 * Chi è assente oggi (ferie, malattia, permessi...): la domanda più chiesta.
 * ⚠️ Non si inventa una forma ai dati: Fluida risponde con la sua struttura,
 * e qui la si passa al modello quasi grezza — dicendogli esplicitamente di
 * riportare nomi e date COSÌ COME SONO, mai riscritti. Se un domani la forma
 * della risposta cambia, l'agente lo scopre dal contenuto, non da un
 * parsing che si rompe in silenzio.
 */
export async function presenzeOggi(azienda: string): Promise<string> {
  const r = await getPool().query<{ company_id: string; chiave_cifrata: string; attivo: boolean }>(
    "select * from public.az_fluida_credenziali($1)",
    [azienda]
  );
  const cred = r.rows[0];
  if (!cred || !cred.attivo) return "Fluida non è collegato: vai in Impostazioni per collegarlo.";

  const chiave = decifra(cred.chiave_cifrata);
  if (!chiave) return "La chiave di Fluida non è leggibile: va ricollegata.";

  try {
    const r2 = await fetch(`${FLUIDA}/calendar/presence_status/company/${encodeURIComponent(cred.company_id)}`, {
      headers: { "x-fluida-app-uuid": chiave, Accept: "application/json" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!r2.ok) {
      const errore = `Fluida ha risposto ${r2.status} alla richiesta presenze.`;
      await getPool().query("select public.az_fluida_errore($1,$2)", [azienda, errore]);
      return errore;
    }
    const corpo = await r2.text();
    return (
      "Dati grezzi da Fluida sullo stato presenze di oggi (riporta nomi, ruoli e stati " +
      "ESATTAMENTE come scritti qui, non inventare né riassumere numeri che non ci sono):\n" +
      corpo.slice(0, 6000)
    );
  } catch (error) {
    const errore = `Fluida non risponde: ${String(error).slice(0, 120)}`;
    await getPool().query("select public.az_fluida_errore($1,$2)", [azienda, errore]).catch(() => {});
    return errore;
  }
}

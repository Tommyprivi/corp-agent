import { useMemo, useState } from "react";
import { code39Svg, pulisci } from "../../lib/barcode";

/**
 * Le etichette dei colli: CorpAgent le disegna col codice a barre e le stampa
 * dalla stampante collegata al dispositivo.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * COME STAMPA, E PERCHÉ COSÌ
 * ─────────────────────────────────────────────────────────────────────────
 * Non si stampa dal server: una funzione su Vercel vive nel cloud e non può
 * raggiungere una stampante che sta nella rete del magazzino. Si stampa dal
 * BROWSER — che invece la stampante ce l'ha davanti. Si apre una finestra con
 * le sole etichette, formato etichetta, e parte la stampa: va sulla Zebra
 * installata come stampante di Windows, o su una normale se è quella collegata.
 *
 * ⚠️ Il cerchio si chiude qui: stampi l'etichetta → la attacchi al collo → il
 * palmare la RILEGGE in banchina e compare in Scansioni. Per questo il codice è
 * Code 39, quello che gli Zebra leggono senza configurare niente.
 *
 * ⚠️ Domani, quando ci saranno le spedizioni vere (da K-Master o registrate),
 * il codice sull'etichetta sarà il loro numero di spedizione, non uno generato:
 * cambia una riga in chi chiama, non questo file.
 */

export interface DatiEtichetta {
  codice: string;
  cliente?: string;
  righe?: string[]; // dettagli liberi: "3 di 8", "Torino nord", ecc.
}

/** Un codice collo nuovo: prefisso + data + progressivo. Maiuscolo, Code 39. */
export function nuovoCodice(prefisso = "SPD"): string {
  const d = new Date();
  const p = pulisci(prefisso) || "SPD";
  const data = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rnd = Math.floor(Math.random() * 9000 + 1000);
  return `${p}${data}${rnd}`;
}

/**
 * Apre la finestra di stampa con una o più etichette, formato 100×70 mm.
 * ⚠️ Ogni etichetta è una pagina a sé (page-break), così una Zebra a etichette
 * ne stampa una per etichetta e una A4 le mette una per foglio.
 */
export function stampaEtichette(nomeAzienda: string, etichette: DatiEtichetta[]): void {
  if (!etichette.length) return;
  const w = window.open("", "_blank", "width=420,height=560");
  if (!w) return;

  const corpo = etichette
    .map((e) => {
      const codice = pulisci(e.codice) || nuovoCodice();
      const svg = code39Svg(codice, { modulo: 2, altezza: 90 });
      const righe = (e.righe ?? []).map((r) => `<div class="riga">${escape(r)}</div>`).join("");
      return `<div class="et">
        <div class="testa"><span class="marchio">${escape(nomeAzienda)}</span><span class="filo"></span></div>
        ${e.cliente ? `<div class="cliente">${escape(e.cliente)}</div>` : ""}
        <div class="righe">${righe}</div>
        <div class="barcode">${svg}</div>
        <div class="codice">${escape(codice)}</div>
      </div>`;
    })
    .join("");

  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Etichette</title>
  <style>
    @page { size: 100mm 70mm; margin: 0; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; font-family: "Segoe UI", Arial, sans-serif; color: #000; }
    .et { width: 100mm; height: 70mm; padding: 5mm 6mm; page-break-after: always; display: flex; flex-direction: column; }
    .testa { display: flex; align-items: center; gap: 3mm; }
    .marchio { font-weight: 800; font-size: 15pt; letter-spacing: 0.3pt; white-space: nowrap; }
    .filo { flex: 1; height: 2.4mm; background: linear-gradient(90deg,#008E33 0 62%, #FFC500 62% 100%); border-radius: 1mm; }
    .cliente { margin-top: 2.5mm; font-size: 15pt; font-weight: 700; }
    .righe { margin-top: 1mm; font-size: 10pt; color: #222; }
    .riga { line-height: 1.35; }
    .barcode { margin-top: auto; height: 18mm; }
    .barcode svg { width: 100%; height: 100%; }
    .codice { text-align: center; font-family: "Consolas", monospace; font-size: 12pt; letter-spacing: 1pt; margin-top: 1mm; }
  </style></head><body>${corpo}</body></html>`);
  w.document.close();
  // Un attimo perché il layout si assesti, poi stampa. Chi chiude la finestra
  // dopo la stampa lo decide il browser; non la chiudiamo noi per non tagliare
  // un lavoro lento.
  w.focus();
  setTimeout(() => w.print(), 250);
}

function escape(s: string): string {
  return s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c] as string);
}

// ─────────────────────────────────────────────────────────────────────────
// IL PANNELLO — genera e stampa etichette dei colli (per la banchina)
// ─────────────────────────────────────────────────────────────────────────

export function PannelloEtichette({ nomeAzienda }: { nomeAzienda: string }) {
  const [cliente, setCliente] = useState("");
  const [quanti, setQuanti] = useState("1");
  const [seed, setSeed] = useState(() => nuovoCodice());

  const n = Math.max(1, Math.min(50, Number(quanti) || 1));
  // L'anteprima mostra la prima etichetta col codice «seed»; le altre della
  // serie avranno codici nuovi al momento della stampa.
  const anteprimaSvg = useMemo(() => code39Svg(seed, { modulo: 2, altezza: 90 }), [seed]);

  function stampa() {
    const etichette: DatiEtichetta[] = Array.from({ length: n }, (_, i) => ({
      codice: i === 0 ? seed : nuovoCodice(),
      cliente: cliente.trim() || undefined,
      righe: n > 1 ? [`Collo ${i + 1} di ${n}`] : undefined,
    }));
    stampaEtichette(nomeAzienda, etichette);
    // Codice nuovo per la prossima serie, così non si ristampa lo stesso.
    setSeed(nuovoCodice());
  }

  return (
    <div className="mx-auto max-w-[760px]">
      <p className="mb-3 text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
        Stampa le etichette dei colli, col codice a barre. La attacchi al collo e
        il palmare la rilegge in banchina — così quello che stampi qui torna
        dentro da solo. Va sulla stampante collegata a questo dispositivo (la
        Zebra a etichette, o una normale).
      </p>

      <div className="grid gap-4 sm:grid-cols-[1fr_300px]">
        {/* I campi */}
        <div className="rounded-md border border-[var(--border)] bg-[var(--bg-card)] p-4">
          <label className="block">
            <span className="text-[12.5px] text-[var(--text-secondary)]">Cliente (facoltativo)</span>
            <input
              value={cliente}
              onChange={(e) => setCliente(e.target.value)}
              placeholder="es. Rossi Ricambi"
              className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-app)] px-3 py-2.5 text-[16px] outline-none focus:border-[var(--accent)] sm:text-[13.5px]"
            />
          </label>
          <label className="mt-3 block">
            <span className="text-[12.5px] text-[var(--text-secondary)]">Quante etichette</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={50}
              value={quanti}
              onChange={(e) => setQuanti(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-app)] px-3 py-2.5 text-[16px] outline-none focus:border-[var(--accent)] sm:text-[13.5px]"
            />
          </label>
          <p className="mt-2 text-[11.5px] text-[var(--text-secondary)]">
            Ognuna avrà un codice diverso (numerate «collo 1 di {n}»).
          </p>
          <button
            onClick={stampa}
            className="btn-grad mt-3 w-full cursor-pointer rounded-md py-2.5 text-[13.5px] font-medium"
          >
            Stampa {n > 1 ? `${n} etichette` : "l'etichetta"}
          </button>
        </div>

        {/* L'anteprima della prima etichetta */}
        <div>
          <p className="mb-1.5 text-[11px] uppercase tracking-[0.09em] text-[var(--text-secondary)]">
            Anteprima
          </p>
          <div
            className="rounded-md border border-[var(--border)] bg-white p-3 text-black"
            style={{ aspectRatio: "100 / 70" }}
          >
            <div className="flex h-full flex-col">
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-extrabold tracking-tight">{nomeAzienda}</span>
                <span
                  className="h-[6px] flex-1 rounded-full"
                  style={{ background: "linear-gradient(90deg,#008E33 0 62%, #FFC500 62% 100%)" }}
                />
              </div>
              {cliente.trim() && <div className="mt-1.5 text-[12px] font-bold">{cliente.trim()}</div>}
              <div
                className="mt-auto h-[34%]"
                dangerouslySetInnerHTML={{ __html: anteprimaSvg }}
              />
              <div className="text-center font-mono text-[10px] tracking-[1px]">{seed}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

-- ═════════════════════════════════════════════════════════════════════════
-- La porta d'ingresso degli scanner — 12 Agosto 2026
-- ═════════════════════════════════════════════════════════════════════════
--
-- Deciso al sopralluogo: QCSNET non dà le API, quindi **gli scanner diventano
-- la strada dei dati**. I palmari Zebra (via DataWedge) mandano il barcode
-- dritto dentro CorpAgent, e le letture compaiono vive in banchina.
--
-- ⚠️ Un DISPOSITIVO non ha una sessione utente: non fa login, non ha una
-- persona. Ha un GETTONE D'INGRESSO — una chiave lunga, per azienda, che si
-- mette una volta nella configurazione del palmare. Chi ha il gettone può
-- SOLO scrivere letture in quell'azienda, niente altro: se trapela, il danno
-- è «qualcuno inietta barcode finti», non «qualcuno legge i vostri dati».
-- Ed è revocabile in un clic (se ne genera uno nuovo, il vecchio muore).
--
-- ⚠️ Sta in una TABELLA SUA, non in azienda_config: quella la legge ogni utente
-- collegato, e un gettone di scrittura visibile a tutti non è un gettone.

create table if not exists public.azienda_ingresso (
  azienda text primary key,
  chiave  text not null,
  creata  timestamptz not null default now()
);

alter table public.azienda_ingresso enable row level security;

-- ── Genera (o rigenera) il gettone d'ingresso ──────────────────────────
-- ⚠️ pgcrypto è assente su questo Neon: il gettone si costruisce da due UUID
-- come la chiave delle richieste (migrazione 0015). 64 caratteri esadecimali.
create or replace function public.az_ingresso_genera(p_azienda text)
returns text
language plpgsql security definer set search_path = public as $$
declare v text;
begin
  v := 'scz_' || replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into public.azienda_ingresso (azienda, chiave, creata)
  values (p_azienda, v, now())
  on conflict (azienda) do update set chiave = excluded.chiave, creata = now();
  return v;
end;
$$;

-- ── Leggi il gettone attuale (per mostrarlo al titolare) ───────────────
create or replace function public.az_ingresso(p_azienda text)
returns text
language sql security definer set search_path = public as $$
  select chiave from public.azienda_ingresso where azienda = p_azienda;
$$;

-- ── Da quale azienda è questo gettone? (per l'endpoint di import) ───────
-- ⚠️ Nessun controllo qui: risolve il gettone in un nome azienda e basta. Se
-- il gettone non esiste, torna niente e l'endpoint rifiuta.
create or replace function public.az_ingresso_chi(p_chiave text)
returns text
language sql security definer set search_path = public as $$
  select azienda from public.azienda_ingresso where chiave = p_chiave;
$$;

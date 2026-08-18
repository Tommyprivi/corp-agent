-- ═════════════════════════════════════════════════════════════════════════
-- Il sito su misura: il titolare sceglie come disporre le cose — 12 Ago 2026
-- ═════════════════════════════════════════════════════════════════════════
--
-- Voluto da Tommaso: «se sei il capo puoi decidere tu come vuoi il sito,
-- scegliendo dei template, e tutto il modo di disporre le cose». È la Fase C2
-- del PERCORSO — il pannello di personalizzazione — anticipata per Speed.
--
-- ⚠️ UNA RIGA PER AZIENDA, un blob JSON. Le impostazioni sono tante e cambiano
-- spesso (un template, l'ordine dei blocchi, la densità): una colonna per ogni
-- scelta sarebbe una migrazione a ogni ripensamento. Il JSON regge le aggiunte
-- future senza toccare lo schema, e queste impostazioni non si interrogano —
-- si leggono intere e si applicano.

create table if not exists public.azienda_config (
  azienda      text primary key,
  impostazioni jsonb not null default '{}'::jsonb,
  aggiornato   timestamptz not null default now()
);

alter table public.azienda_config enable row level security;

create or replace function public.az_config(p_azienda text)
returns jsonb
language sql security definer set search_path = public as $$
  select coalesce((select impostazioni from public.azienda_config where azienda = p_azienda), '{}'::jsonb);
$$;

-- ⚠️ Nessun controllo di ruolo qui dentro: chi chiama (api/config.ts) verifica
-- prima che sia il titolare. Le funzioni SQL eseguono e basta, come sempre.
create or replace function public.az_config_salva(p_azienda text, p_impostazioni jsonb)
returns void
language sql security definer set search_path = public as $$
  insert into public.azienda_config (azienda, impostazioni, aggiornato)
  values (p_azienda, p_impostazioni, now())
  on conflict (azienda)
  do update set impostazioni = excluded.impostazioni, aggiornato = now();
$$;

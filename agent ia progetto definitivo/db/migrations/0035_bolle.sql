-- ═════════════════════════════════════════════════════════════════════════
-- Le bolle LETTE, non solo elencate — l'OCR degli allegati — 13 Ago 2026
-- ═════════════════════════════════════════════════════════════════════════
--
-- Finora della posta si salvavano mittente, oggetto e i NOMI degli allegati.
-- La promessa a Salvatore però è un'altra: «le bolle scannerizzate importate
-- direttamente su Corp». Qui si salvano gli allegati VERI (i byte), e accanto
-- l'esito della lettura: il testo estratto e i dati strutturati della bolla
-- (mittente, numero, colli…) che l'agente e la banchina possono usare.
--
-- ⚠️ `stato` racconta la verità: 'nuovo' = ancora da leggere, 'letto' = dati
-- estratti, 'illeggibile' = provato e non riuscito (con il perché in `letto`).
-- Niente zeri finti: se una bolla non si legge, si DICE.

create table if not exists public.azienda_posta_allegati (
  id       bigserial primary key,
  azienda  text not null,
  arrivo   bigint not null,
  nome     text not null default '',
  tipo     text not null default '',
  dati     bytea not null,
  stato    text not null default 'nuovo',
  letto    text not null default '',
  bolla    jsonb,
  creato   timestamptz not null default now()
);

create index if not exists azienda_posta_allegati_stato
  on public.azienda_posta_allegati (azienda, stato, id);

alter table public.azienda_posta_allegati enable row level security;

-- L'arrivo ora ritorna l'ID (serve per agganciarci gli allegati);
-- null = doppione. Il tipo di ritorno cambia: drop prima della ricrea.
drop function if exists public.az_posta_arrivo(text, text, timestamptz, text, text, text[], text);

create or replace function public.az_posta_arrivo(
  p_azienda text, p_msgid text, p_ricevuto timestamptz,
  p_mittente text, p_oggetto text, p_allegati text[], p_corpo text
) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_id bigint;
begin
  insert into public.azienda_posta_arrivi (azienda, msgid, ricevuto, mittente, oggetto, allegati, corpo)
  values (p_azienda, p_msgid, p_ricevuto, left(coalesce(p_mittente,''), 300),
          left(coalesce(p_oggetto,''), 500), coalesce(p_allegati, '{}'), left(coalesce(p_corpo,''), 4000))
  returning id into v_id;
  return v_id;
exception when unique_violation then
  return null;
end;
$$;

create or replace function public.az_posta_allegato_salva(
  p_azienda text, p_arrivo bigint, p_nome text, p_tipo text, p_dati bytea
) returns bigint
language sql security definer set search_path = public as $$
  insert into public.azienda_posta_allegati (azienda, arrivo, nome, tipo, dati)
  values (p_azienda, p_arrivo, left(coalesce(p_nome,''), 300), left(coalesce(p_tipo,''), 100), p_dati)
  returning id;
$$;

-- L'elenco per interfaccia e agente: MAI i byte (pesano), solo i fatti.
create or replace function public.az_posta_bolle(p_azienda text, p_limite integer)
returns table (id bigint, arrivo bigint, nome text, tipo text, stato text,
               letto text, bolla jsonb, creato timestamptz, kb integer)
language sql security definer set search_path = public as $$
  select a.id, a.arrivo, a.nome, a.tipo, a.stato,
         left(a.letto, 2000), a.bolla, a.creato,
         (octet_length(a.dati) / 1024)::integer
    from public.azienda_posta_allegati a
   where a.azienda = p_azienda
   order by a.id desc
   limit least(coalesce(p_limite, 30), 100);
$$;

-- I byte di UN allegato, per mostrarlo o riscaricarlo. Solo dal server.
create or replace function public.az_posta_allegato(p_azienda text, p_id bigint)
returns table (nome text, tipo text, dati bytea)
language sql security definer set search_path = public as $$
  select a.nome, a.tipo, a.dati
    from public.azienda_posta_allegati a
   where a.azienda = p_azienda and a.id = p_id;
$$;

-- Da leggere: i più vecchi prima, pochi per volta (l'OCR costa tempo).
create or replace function public.az_posta_da_leggere(p_azienda text, p_limite integer)
returns table (id bigint, nome text, tipo text, dati bytea)
language sql security definer set search_path = public as $$
  select a.id, a.nome, a.tipo, a.dati
    from public.azienda_posta_allegati a
   where a.azienda = p_azienda and a.stato = 'nuovo'
   order by a.id
   limit least(coalesce(p_limite, 3), 10);
$$;

create or replace function public.az_posta_allegato_letto(
  p_azienda text, p_id bigint, p_stato text, p_letto text, p_bolla jsonb
) returns void
language sql security definer set search_path = public as $$
  update public.azienda_posta_allegati
     set stato = p_stato,
         letto = left(coalesce(p_letto,''), 8000),
         bolla = p_bolla
   where azienda = p_azienda and id = p_id;
$$;

-- ═════════════════════════════════════════════════════════════════════════
-- L'agente Solleciti ritiri — «creiamo i veri agenti» — 13 Agosto 2026
-- ═════════════════════════════════════════════════════════════════════════
--
-- Tommaso: «creiamo i veri agenti», e come primo i solleciti dei ritiri.
-- L'agente tiene d'occhio i ritiri prenotati e non ancora fatti, e quando si
-- avvicina l'ora prepara — e, se acceso, manda — un promemoria al cliente.
--
-- ⚠️ Il promemoria lo scrive un TEMPLATE con la data esatta, NON il modello:
-- gpt-4o-mini «arrotonda» gli orari (visto in collaudo), e un orario di ritiro
-- sbagliato a un cliente è peggio di non dirlo. Qui la data è quella vera,
-- copiata dal ritiro.
--
-- ⚠️ Un promemoria per ritiro (unique): l'agente non tempesta lo stesso
-- cliente due volte per lo stesso ritiro. Il testo si salva CIFRATO.

alter table public.azienda_posta
  add column if not exists solleciti_modo text not null default 'spento'; -- spento | prova | acceso

create table if not exists public.azienda_solleciti (
  id          bigserial primary key,
  azienda     text not null,
  ritiro      bigint not null,
  controparte text not null default '',
  previsto    timestamptz,
  destinatario text not null default '',   -- email del cliente, o '' se non trovata
  testo       text not null default '',    -- il promemoria, CIFRATO
  stato       text not null default 'bozza', -- bozza | mandato | senza_email
  creato      timestamptz not null default now(),
  unique (azienda, ritiro)
);

alter table public.azienda_solleciti enable row level security;

-- ── Le porte ─────────────────────────────────────────────────────────────

create or replace function public.az_solleciti_modo_salva(p_azienda text, p_modo text)
returns void
language sql security definer set search_path = public as $$
  update public.azienda_posta
     set solleciti_modo = case when p_modo in ('spento','prova','acceso') then p_modo else 'spento' end
   where azienda = p_azienda;
$$;

create or replace function public.az_solleciti_modo(p_azienda text)
returns text
language sql security definer set search_path = public as $$
  select coalesce((select solleciti_modo from public.azienda_posta where azienda = p_azienda), 'spento');
$$;

-- Gli id dei ritiri già sollecitati: per non ripetersi.
create or replace function public.az_solleciti_fatti(p_azienda text)
returns table (ritiro bigint)
language sql security definer set search_path = public as $$
  select s.ritiro from public.azienda_solleciti s where s.azienda = p_azienda;
$$;

create or replace function public.az_sollecito_salva(
  p_azienda text, p_ritiro bigint, p_controparte text, p_previsto timestamptz,
  p_destinatario text, p_testo text, p_stato text
) returns void
language sql security definer set search_path = public as $$
  insert into public.azienda_solleciti (azienda, ritiro, controparte, previsto, destinatario, testo, stato)
  values (p_azienda, p_ritiro, left(p_controparte,200), p_previsto, left(p_destinatario,200), p_testo, p_stato)
  on conflict (azienda, ritiro) do update set
    controparte = excluded.controparte, previsto = excluded.previsto,
    destinatario = excluded.destinatario, testo = excluded.testo, stato = excluded.stato;
$$;

create or replace function public.az_solleciti(p_azienda text, p_limite integer)
returns table (id bigint, ritiro bigint, controparte text, previsto timestamptz,
               destinatario text, testo text, stato text, creato timestamptz)
language sql security definer set search_path = public as $$
  select s.id, s.ritiro, s.controparte, s.previsto, s.destinatario, s.testo, s.stato, s.creato
    from public.azienda_solleciti s
   where s.azienda = p_azienda
   order by s.previsto asc nulls last, s.id desc
   limit least(coalesce(p_limite, 40), 100);
$$;

create or replace function public.az_sollecito_uno(p_azienda text, p_id bigint)
returns table (destinatario text, testo text, controparte text, stato text)
language sql security definer set search_path = public as $$
  select s.destinatario, s.testo, s.controparte, s.stato
    from public.azienda_solleciti s
   where s.azienda = p_azienda and s.id = p_id;
$$;

create or replace function public.az_sollecito_mandato(p_azienda text, p_id bigint)
returns void
language sql security definer set search_path = public as $$
  update public.azienda_solleciti set stato = 'mandato' where azienda = p_azienda and id = p_id;
$$;

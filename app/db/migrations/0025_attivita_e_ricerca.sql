-- ═════════════════════════════════════════════════════════════════════════
-- Il registro attività e la ricerca globale — 12 Agosto 2026
-- ═════════════════════════════════════════════════════════════════════════
--
-- I tool «da gestionale serio» chiesti da Tommaso: chi ha fatto cosa e quando
-- (audit, solo titolare), e una ricerca che guarda ovunque in un colpo.
--
-- ⚠️ L'attività NON registra i contenuti delle chat: registra le AZIONI —
-- «è entrato», «ha registrato un carico», «ha promosso Maria a capo». È la
-- stessa linea dell'articolo 4 tenuta fin qui: si vede il fatto
-- amministrativo, mai la conversazione.

create table if not exists public.azienda_attivita (
  id        bigserial primary key,
  azienda   text not null,
  persona   uuid references public.azienda_persone(id) on delete set null,
  azione    text not null,
  dettaglio text not null default '',
  creato    timestamptz not null default now()
);

create index if not exists azienda_attivita_idx
  on public.azienda_attivita (azienda, creato desc);

alter table public.azienda_attivita enable row level security;

create or replace function public.az_attivita_scrivi(
  p_azienda text, p_persona uuid, p_azione text, p_dettaglio text
) returns void
language sql security definer set search_path = public as $$
  insert into public.azienda_attivita (azienda, persona, azione, dettaglio)
  values (p_azienda, p_persona, left(p_azione, 40), left(coalesce(p_dettaglio,''), 300));
$$;

-- Di passaggio si spazzano le righe più vecchie di 90 giorni: un registro
-- attività che cresce per sempre è un problema di GDPR travestito da funzione.
create or replace function public.az_attivita(p_azienda text)
returns table (id bigint, azione text, dettaglio text, chi text, creato timestamptz)
language sql security definer set search_path = public as $$
  delete from public.azienda_attivita where creato < now() - interval '90 days';
  select a.id, a.azione, a.dettaglio, coalesce(p.nome, p.email, ''), a.creato
    from public.azienda_attivita a
    left join public.azienda_persone p on p.id = a.persona
   where a.azienda = p_azienda
   order by a.creato desc
   limit 150;
$$;

-- ── La ricerca globale ──────────────────────────────────────────────────
-- Un colpo solo su clienti, movimenti e documenti. ⚠️ NON sulle chat: la
-- ricerca la usano tutti, e le conversazioni restano di chi le ha fatte.
create or replace function public.az_cerca(p_azienda text, p_q text)
returns table (tipo text, id text, titolo text, sotto text, creato timestamptz)
language sql security definer set search_path = public as $$
  (
    select 'cliente'::text, c.id::text, c.nome,
           concat_ws(' · ', nullif(c.referente,''), nullif(c.telefono,''), nullif(c.zona,'')),
           c.creato
      from public.azienda_clienti c
     where c.azienda = p_azienda
       and (c.nome ilike '%'||p_q||'%' or c.referente ilike '%'||p_q||'%'
            or c.zona ilike '%'||p_q||'%' or c.telefono ilike '%'||p_q||'%')
     limit 8
  )
  union all
  (
    select 'movimento'::text, m.id::text,
           concat_ws(' ', initcap(m.tipo),
             case when m.colli is not null then m.colli || ' colli' end,
             nullif(m.controparte,'')),
           coalesce(nullif(m.testo,''), m.reparto),
           m.creato
      from public.azienda_movimenti m
     where m.azienda = p_azienda
       and (m.controparte ilike '%'||p_q||'%' or m.testo ilike '%'||p_q||'%'
            or m.mezzo ilike '%'||p_q||'%')
     order by m.creato desc
     limit 8
  )
  union all
  (
    select 'documento'::text, d.id::text, d.titolo, left(d.testo, 90), d.creato
      from public.azienda_documenti d
     where d.azienda = p_azienda
       and (d.titolo ilike '%'||p_q||'%' or d.testo ilike '%'||p_q||'%')
     limit 6
  )
$$;

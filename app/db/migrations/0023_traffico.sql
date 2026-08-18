-- ═════════════════════════════════════════════════════════════════════════
-- Il traffico: ritiri e reclami nel registro — 12 Agosto 2026
-- ═════════════════════════════════════════════════════════════════════════
--
-- La postazione Traffico diventa un posto di lavoro come la banchina. Due tipi
-- nuovi nel registro dei movimenti:
--
-- - **ritiro**: una prenotazione. Cliente, indirizzo, quando (colonna nuova
--   `previsto`), colli. Resta APERTO finché il ritiro non è fatto — e lo vede
--   anche il magazzino («in arrivo»), perché è il primo pezzo dei reparti che
--   si parlano (deciso da Tommaso oggi).
-- - **reclamo**: un cliente arrabbiato o in attesa. Come una differenza:
--   resta aperto finché il capo non lo guarda e lo chiude.
--
-- ⚠️ Stessa tabella dei movimenti, non una nuova: il registro dell'azienda è
-- UNO, e ogni riga dice il suo reparto. Dieci tabelle uguali con nomi diversi
-- sono il modo migliore per avere dieci bug uguali con nomi diversi.

alter table public.azienda_movimenti
  add column if not exists previsto timestamptz;

alter table public.azienda_movimenti
  drop constraint if exists azienda_movimenti_tipo_check;
alter table public.azienda_movimenti
  add constraint azienda_movimenti_tipo_check
  check (tipo in ('carico','scarico','differenza','problema','ritiro','reclamo'));

create index if not exists azienda_movimenti_ritiri_idx
  on public.azienda_movimenti (azienda, previsto) where tipo = 'ritiro' and stato = 'aperto';

-- ── La porta di registrazione, ora col «quando» ─────────────────────────
drop function if exists public.az_movimento(text, text, text, integer, integer, integer, text, text, text, uuid);

create or replace function public.az_movimento(
  p_azienda text, p_reparto text, p_tipo text, p_colli integer,
  p_atteso integer, p_contato integer, p_mezzo text, p_controparte text,
  p_testo text, p_persona uuid, p_previsto timestamptz default null
) returns bigint
language sql security definer set search_path = public as $$
  insert into public.azienda_movimenti
    (azienda, reparto, tipo, colli, atteso, contato, mezzo, controparte, testo,
     stato, persona, previsto)
  values (
    p_azienda, left(p_reparto, 40), p_tipo,
    p_colli, p_atteso, p_contato,
    left(coalesce(p_mezzo, ''), 60), left(coalesce(p_controparte, ''), 120),
    left(coalesce(p_testo, ''), 2000),
    -- ⚠️ Aperto = aspetta qualcuno. Un ritiro aspetta di essere fatto, un
    -- reclamo/problema/differenza aspetta un occhio. Carico e scarico sono
    -- fatti avvenuti: nascono chiusi.
    case when p_tipo in ('problema','differenza','reclamo','ritiro')
         then 'aperto' else 'chiuso' end,
    p_persona, p_previsto
  )
  returning id;
$$;

-- ── Chiudere vale anche per reclami e ritiri (ritiro chiuso = fatto) ────
create or replace function public.az_movimento_chiudi(p_id bigint, p_azienda text)
returns void
language sql security definer set search_path = public as $$
  update public.azienda_movimenti
     set stato = 'chiuso'
   where id = p_id and azienda = p_azienda
     and tipo in ('problema','differenza','reclamo','ritiro');
$$;

-- ── Le cose da controllare ora includono i reclami ──────────────────────
-- ⚠️ NON i ritiri: un ritiro aperto è lavoro pianificato, non un guaio.
create or replace function public.az_da_controllare(p_azienda text, p_reparto text)
returns table (id bigint, reparto text, tipo text, testo text, atteso integer,
               contato integer, chi text, creato timestamptz)
language sql security definer set search_path = public as $$
  select m.id, m.reparto, m.tipo, m.testo, m.atteso, m.contato,
         coalesce(p.nome, ''), m.creato
    from public.azienda_movimenti m
    left join public.azienda_persone p on p.id = m.persona
   where m.azienda = p_azienda
     and m.tipo in ('problema','differenza','reclamo') and m.stato = 'aperto'
     and (p_reparto is null or m.reparto = p_reparto)
   order by m.creato desc
   limit 50;
$$;

-- ── I ritiri aperti — li vede il traffico E il magazzino ────────────────
create or replace function public.az_ritiri(p_azienda text)
returns table (id bigint, controparte text, testo text, colli integer,
               previsto timestamptz, chi text, creato timestamptz)
language sql security definer set search_path = public as $$
  select m.id, m.controparte, m.testo, m.colli, m.previsto,
         coalesce(p.nome, ''), m.creato
    from public.azienda_movimenti m
    left join public.azienda_persone p on p.id = m.persona
   where m.azienda = p_azienda and m.tipo = 'ritiro' and m.stato = 'aperto'
   order by m.previsto nulls last, m.creato
   limit 60;
$$;

-- ── I numeri del traffico di oggi ───────────────────────────────────────
create or replace function public.az_traffico(p_azienda text)
returns jsonb
language sql security definer set search_path = public as $$
  select jsonb_build_object(
    'ritiri_prenotati', (
      select count(*) from public.azienda_movimenti
       where azienda = p_azienda and tipo = 'ritiro'
         and (creato at time zone 'Europe/Rome')::date
               = (now() at time zone 'Europe/Rome')::date
    ),
    'ritiri_aperti', (
      select count(*) from public.azienda_movimenti
       where azienda = p_azienda and tipo = 'ritiro' and stato = 'aperto'
    ),
    'reclami_aperti', (
      select count(*) from public.azienda_movimenti
       where azienda = p_azienda and tipo = 'reclamo' and stato = 'aperto'
    )
  );
$$;

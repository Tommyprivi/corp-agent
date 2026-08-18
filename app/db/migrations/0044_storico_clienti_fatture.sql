-- ═════════════════════════════════════════════════════════════════════════
-- Tre pezzi chiesti da Tommaso il 18 Agosto 2026: storico dei connettori,
-- più dettaglio sui clienti, contabilità e fatturazione.
-- ═════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────
-- 1) LO STORICO DEI CONNETTORI
-- ─────────────────────────────────────────────────────────────────────────
-- Ogni chiamata fatta con la chiave di un utente (una prova, un uso vero):
-- ok o no, e cosa è andato storto. Stessa RLS di `connections` (0014): ognuno
-- vede solo le proprie righe.
create table if not exists public.connections_log (
  id        bigserial primary key,
  user_id   text not null,
  kind      text not null,
  esito     text not null check (esito in ('ok', 'errore')),
  dettaglio text not null default '',
  creato    timestamptz not null default now()
);

create index if not exists connections_log_idx
  on public.connections_log (user_id, kind, creato desc);

alter table public.connections_log enable row level security;

drop policy if exists "solo le mie chiamate" on public.connections_log;
create policy "solo le mie chiamate" on public.connections_log
  for all using (user_id = current_setting('app.user_id', true))
  with check (user_id = current_setting('app.user_id', true));

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'nexus_app') then
    grant select, insert on public.connections_log to nexus_app;
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────
-- 2) PIÙ DETTAGLIO SUI CLIENTI DI SPEED
-- ─────────────────────────────────────────────────────────────────────────
alter table public.azienda_clienti
  add column if not exists piva      text not null default '',
  add column if not exists indirizzo text not null default '';

-- Il tipo restituito cambia (due colonne in più): serve il drop, altrimenti
-- Postgres rifiuta il create-or-replace con "cannot change return type".
drop function if exists public.az_clienti(text, text);

create function public.az_clienti(p_azienda text, p_cerca text)
returns table (id uuid, nome text, referente text, telefono text, email text,
               zona text, note text, piva text, indirizzo text,
               creato timestamptz, aggiornato timestamptz)
language sql security definer set search_path = public as $$
  select c.id, c.nome, c.referente, c.telefono, c.email, c.zona, c.note,
         c.piva, c.indirizzo, c.creato, c.aggiornato
    from public.azienda_clienti c
   where c.azienda = p_azienda
     and (coalesce(p_cerca,'') = ''
          or c.nome ilike '%'||p_cerca||'%'
          or c.referente ilike '%'||p_cerca||'%'
          or c.zona ilike '%'||p_cerca||'%'
          or c.piva ilike '%'||p_cerca||'%')
   order by lower(c.nome);
$$;

create or replace function public.az_cliente_salva(
  p_id uuid, p_azienda text, p_nome text, p_referente text, p_telefono text,
  p_email text, p_zona text, p_note text, p_persona uuid,
  p_piva text default '', p_indirizzo text default ''
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if p_id is null then
    insert into public.azienda_clienti
      (azienda, nome, referente, telefono, email, zona, note, creato_da, piva, indirizzo)
    values (p_azienda, left(p_nome,120), left(p_referente,80), left(p_telefono,40),
            left(p_email,120), left(p_zona,60), left(p_note,4000), p_persona,
            left(p_piva,20), left(p_indirizzo,200))
    returning id into v_id;
  else
    update public.azienda_clienti
       set nome = left(p_nome,120), referente = left(p_referente,80),
           telefono = left(p_telefono,40), email = left(p_email,120),
           zona = left(p_zona,60), note = left(p_note,4000), aggiornato = now(),
           piva = left(p_piva,20), indirizzo = left(p_indirizzo,200)
     where id = p_id and azienda = p_azienda
    returning id into v_id;
  end if;
  return v_id;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 3) CONTABILITÀ E FATTURAZIONE
-- ─────────────────────────────────────────────────────────────────────────
-- ⚠️ Non è Stripe (quello è per i servizi venduti da CorpAgent, api/_lib/ordini.ts):
-- questa è la contabilità DELL'AZIENDA CLIENTE, quello che fattura Speed ai
-- SUOI clienti. Importi in centesimi, come ovunque nel progetto, per non
-- avere arrotondamenti in virgola mobile.
create table if not exists public.azienda_fatture (
  id          uuid primary key default gen_random_uuid(),
  azienda     text not null,
  numero      text not null default '',
  cliente_id  uuid references public.azienda_clienti(id) on delete set null,
  cliente_nome text not null default '',
  centesimi   bigint not null default 0,
  emessa      date not null default current_date,
  scadenza    date,
  stato       text not null default 'da_incassare'
              check (stato in ('da_incassare', 'incassata', 'scaduta')),
  note        text not null default '',
  creato_da   uuid references public.azienda_persone(id) on delete set null,
  creato      timestamptz not null default now(),
  aggiornato  timestamptz not null default now()
);

create index if not exists azienda_fatture_idx
  on public.azienda_fatture (azienda, scadenza);

create or replace function public.az_fatture(p_azienda text)
returns table (id uuid, numero text, cliente_id uuid, cliente_nome text,
               centesimi bigint, emessa date, scadenza date, stato text,
               note text, creato timestamptz)
language sql security definer set search_path = public as $$
  select f.id, f.numero, f.cliente_id, f.cliente_nome, f.centesimi, f.emessa,
         f.scadenza, f.stato, f.note, f.creato
    from public.azienda_fatture f
   where f.azienda = p_azienda
   order by (f.stato = 'da_incassare') desc, f.scadenza nulls last, f.creato desc;
$$;

create or replace function public.az_fattura_salva(
  p_id uuid, p_azienda text, p_numero text, p_cliente_id uuid,
  p_cliente_nome text, p_centesimi bigint, p_emessa date, p_scadenza date,
  p_note text, p_persona uuid
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if p_id is null then
    insert into public.azienda_fatture
      (azienda, numero, cliente_id, cliente_nome, centesimi, emessa, scadenza, note, creato_da)
    values (p_azienda, left(p_numero,40), p_cliente_id, left(p_cliente_nome,120),
            greatest(p_centesimi,0), coalesce(p_emessa, current_date), p_scadenza,
            left(p_note,2000), p_persona)
    returning id into v_id;
  else
    update public.azienda_fatture
       set numero = left(p_numero,40), cliente_id = p_cliente_id,
           cliente_nome = left(p_cliente_nome,120), centesimi = greatest(p_centesimi,0),
           emessa = coalesce(p_emessa, emessa), scadenza = p_scadenza,
           note = left(p_note,2000), aggiornato = now()
     where id = p_id and azienda = p_azienda
    returning id into v_id;
  end if;
  return v_id;
end;
$$;

create or replace function public.az_fattura_stato(p_id uuid, p_azienda text, p_stato text)
returns void language sql security definer set search_path = public as $$
  update public.azienda_fatture
     set stato = p_stato, aggiornato = now()
   where id = p_id and azienda = p_azienda
     and p_stato in ('da_incassare', 'incassata', 'scaduta');
$$;

create or replace function public.az_fattura_elimina(p_id uuid, p_azienda text)
returns void language sql security definer set search_path = public as $$
  delete from public.azienda_fatture where id = p_id and azienda = p_azienda;
$$;

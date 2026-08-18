-- ═════════════════════════════════════════════════════════════════════════
-- Fluida DENTRO la console di Speed, non nell'account generico
-- ═════════════════════════════════════════════════════════════════════════
-- Tommaso, 18 Agosto 2026: il connettore Fluida collegato nell'account
-- generico di CorpAgent non serve a niente all'agente di Speed — sono due
-- sistemi separati, l'uno non sa che l'altro esiste. Fluida va collegato QUI,
-- per azienda, con le porte security-definer di sempre (RLS senza policy).

create table if not exists public.azienda_fluida (
  azienda        text primary key,
  company_id     text not null,
  chiave_cifrata text not null,
  nome           text not null default '',
  piano          text not null default '',
  attivo         boolean not null default true,
  ultimo_errore  text,
  aggiornato     timestamptz not null default now()
);

-- RLS acceso e NESSUNA policy, come tutte le tabelle dell'area azienda: si
-- entra solo dalle porte security-definer qui sotto, mai con una SELECT diretta.
alter table public.azienda_fluida enable row level security;

-- Lo stato per l'interfaccia: MAI la chiave, nemmeno cifrata.
create or replace function public.az_fluida_stato(p_azienda text)
returns table (company_id text, nome text, piano text, attivo boolean,
               ultimo_errore text, aggiornato timestamptz)
language sql security definer set search_path = public as $$
  select f.company_id, f.nome, f.piano, f.attivo, f.ultimo_errore, f.aggiornato
    from public.azienda_fluida f
   where f.azienda = p_azienda;
$$;

-- Le credenziali per il server (solo api/, mai il browser).
create or replace function public.az_fluida_credenziali(p_azienda text)
returns table (company_id text, chiave_cifrata text, attivo boolean)
language sql security definer set search_path = public as $$
  select f.company_id, f.chiave_cifrata, f.attivo
    from public.azienda_fluida f
   where f.azienda = p_azienda;
$$;

create or replace function public.az_fluida_salva(
  p_azienda text, p_company_id text, p_chiave text, p_nome text, p_piano text
) returns void
language sql security definer set search_path = public as $$
  insert into public.azienda_fluida (azienda, company_id, chiave_cifrata, nome, piano, attivo, aggiornato)
  values (p_azienda, p_company_id, p_chiave, p_nome, p_piano, true, now())
  on conflict (azienda) do update set
    company_id = excluded.company_id, chiave_cifrata = excluded.chiave_cifrata,
    nome = excluded.nome, piano = excluded.piano,
    attivo = true, ultimo_errore = null, aggiornato = now();
$$;

create or replace function public.az_fluida_stacca(p_azienda text)
returns void language sql security definer set search_path = public as $$
  delete from public.azienda_fluida where azienda = p_azienda;
$$;

-- Un guasto si segna appena succede, come per la posta e i connettori.
create or replace function public.az_fluida_errore(p_azienda text, p_errore text)
returns void language sql security definer set search_path = public as $$
  update public.azienda_fluida set ultimo_errore = p_errore, aggiornato = now()
   where azienda = p_azienda;
$$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'nexus_app') then
    grant select, insert, update, delete on public.azienda_fluida to nexus_app;
    grant execute on function public.az_fluida_stato(text) to nexus_app;
    grant execute on function public.az_fluida_credenziali(text) to nexus_app;
    grant execute on function public.az_fluida_salva(text,text,text,text,text) to nexus_app;
    grant execute on function public.az_fluida_stacca(text) to nexus_app;
    grant execute on function public.az_fluida_errore(text,text) to nexus_app;
  end if;
  -- L'analista vede lo stato ma non la chiave: stessa regola dei connettori.
  if exists (select 1 from pg_roles where rolname = 'nexus_analyst') then
    grant execute on function public.az_fluida_stato(text) to nexus_analyst;
  end if;
end $$;

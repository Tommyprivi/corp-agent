-- ═════════════════════════════════════════════════════════════════════════
-- Tre pezzi per il lato piattaforma (non Speed), chiesti da Tommaso il
-- 18 Agosto 2026, in preparazione del pannello admin (Fase 15 — resta
-- l'ultima fase, questa migrazione prepara solo i dati che accumulerà).
-- ═════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────
-- 1) I COSTI IA PER MODELLO — il dettaglio c'è già, manca solo la vista
-- ─────────────────────────────────────────────────────────────────────────
-- `messages` salva già model_slug, tokens_in, tokens_out, cost_eur per OGNI
-- riga (migrazione 0001/0004): non serve una tabella nuova, serve una porta
-- che guardi TUTTI gli utenti insieme — le porte esistenti passano sempre da
-- `withUser()`, cioè un solo utente alla volta.
create or replace function public.admin_costo_per_modello(p_giorni int default 30)
returns table (model_slug text, messaggi bigint, tokens bigint, costo_eur numeric, utenti bigint)
language sql security definer set search_path = public as $$
  select coalesce(m.model_slug, '(sconosciuto)'),
         count(*),
         sum(m.tokens_in + m.tokens_out),
         round(sum(m.cost_eur)::numeric, 4),
         count(distinct m.user_id)
    from public.messages m
   where m.role = 'agent' and m.created_at >= now() - (p_giorni || ' days')::interval
   group by coalesce(m.model_slug, '(sconosciuto)')
   order by sum(m.cost_eur) desc;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 2) QUALI AGENTI DEL CATALOGO VENGONO ATTIVATI DAVVERO
-- ─────────────────────────────────────────────────────────────────────────
-- Finora un agente attivato dal catalogo non portava traccia di QUALE
-- agente del catalogo fosse: solo nome e ruolo copiati, senza id. Senza
-- questo, contare le attivazioni per agente vuol dire indovinare dal nome —
-- fragile se l'utente lo rinomina. `catalog_id` fissa la provenienza per
-- sempre, anche se il nome cambia dopo.
alter table public.agents add column if not exists catalog_id text;

create index if not exists agents_catalog_idx on public.agents (catalog_id) where catalog_id is not null;

create or replace function public.admin_agenti_catalogo()
returns table (catalog_id text, attivazioni bigint, attivi bigint, messaggi bigint)
language sql security definer set search_path = public as $$
  select a.catalog_id,
         count(*),
         count(*) filter (where a.active),
         coalesce(sum((
           select count(*) from public.messages m
             join public.projects p on p.id = m.project_id
            where p.agent_id = a.id
         )), 0)
    from public.agents a
   where a.catalog_id is not null
   group by a.catalog_id
   order by count(*) desc;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 3) LO STORICO DEGLI ABBONAMENTI (non solo lo stato attuale)
-- ─────────────────────────────────────────────────────────────────────────
-- `subscriptions` (0012) tiene solo l'ULTIMO stato: ogni webhook di Stripe
-- lo sovrascrive. Per MRR/ARR/churn nel tempo serve la storia, non solo la
-- fotografia di oggi — stesso principio di `credit_ledger` accanto al saldo.
create table if not exists public.subscription_events (
  id                   bigserial primary key,
  user_id              text not null,
  plan_id              text,
  status               text,
  current_period_end   timestamptz,
  cancel_at_period_end boolean,
  creato               timestamptz not null default now()
);

create index if not exists subscription_events_idx
  on public.subscription_events (user_id, creato desc);

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'nexus_app') then
    grant select, insert on public.subscription_events to nexus_app;
  end if;
  if exists (select 1 from pg_roles where rolname = 'nexus_analyst') then
    grant select on public.subscription_events to nexus_analyst;
  end if;
end $$;

-- Lo stesso `apply_stripe_state` di prima, ma scrive anche una riga di
-- storia ogni volta che viene chiamato — un evento Stripe in più, una riga
-- in più, mai un update silenzioso che perde il "prima".
create or replace function public.apply_stripe_state(
  p_customer text,
  p_sub text,
  p_plan text,
  p_status text,
  p_period_end timestamptz,
  p_cancel_at_end boolean
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare v_user_id text;
begin
  update public.subscriptions
     set stripe_sub_id = coalesce(p_sub, stripe_sub_id),
         plan_id = coalesce(p_plan, plan_id),
         status = coalesce(p_status, status),
         current_period_end = coalesce(p_period_end, current_period_end),
         cancel_at_period_end = coalesce(p_cancel_at_end, cancel_at_period_end),
         low_credit_warned_at = case when p_status = 'active' then null
                                     else low_credit_warned_at end,
         updated_at = now()
   where stripe_customer_id = p_customer
  returning user_id into v_user_id;

  if v_user_id is not null then
    insert into public.subscription_events
      (user_id, plan_id, status, current_period_end, cancel_at_period_end)
    values (v_user_id, p_plan, p_status, p_period_end, p_cancel_at_end);
  end if;

  return v_user_id;
end;
$$;

revoke all on function public.apply_stripe_state(text, text, text, text, timestamptz, boolean) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'nexus_app') then
    grant execute on function public.apply_stripe_state(text, text, text, text, timestamptz, boolean) to nexus_app;
  end if;
end $$;

create or replace function public.admin_abbonamenti_storico(p_limite int default 100)
returns table (user_id text, plan_id text, status text, creato timestamptz)
language sql security definer set search_path = public as $$
  select user_id, plan_id, status, creato
    from public.subscription_events
   order by creato desc
   limit p_limite;
$$;

revoke all on function public.admin_costo_per_modello(int) from public;
revoke all on function public.admin_agenti_catalogo() from public;
revoke all on function public.admin_abbonamenti_storico(int) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'nexus_app') then
    grant execute on function public.admin_costo_per_modello(int) to nexus_app;
    grant execute on function public.admin_agenti_catalogo() to nexus_app;
    grant execute on function public.admin_abbonamenti_storico(int) to nexus_app;
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────
-- FASE 4 — Vendere. Righe 29, 30 e 33.
-- ─────────────────────────────────────────────────────────────────────────
--
-- «Fatto quando: un ristoratore paga con la carta e l'agente si attiva da solo.»
--
-- ⚠️ IL PRINCIPIO CHE COMANDA QUI: STRIPE HA RAGIONE, NOI COPIAMO
-- La tentazione, in un sistema di abbonamenti, è tenere lo stato dei pagamenti
-- nel proprio database e fidarsene. È l'errore che produce i clienti arrabbiati:
-- uno paga, la carta passa, e il software continua a dirgli che è scaduto —
-- oppure il contrario, e regali mesi di servizio.
--
-- Qui la verità sta **da Stripe**. Questa tabella è una copia locale, tenuta
-- aggiornata dai webhook, e serve solo a rispondere in fretta a «questo utente
-- cosa può fare adesso?» senza chiamare Stripe a ogni messaggio. Se le due
-- versioni divergono, vince Stripe e la copia si riallinea.

create table if not exists public.subscriptions (
  user_id             text primary key,
  -- L'identificativo del cliente da Stripe. Si crea una volta e non cambia mai:
  -- è la chiave che tiene insieme le carte, le fatture e lo storico.
  stripe_customer_id  text unique,
  stripe_sub_id       text unique,
  plan_id             text not null default 'free',
  -- Gli stati sono quelli di Stripe, scritti come li scrive lui: tradurli
  -- vorrebbe dire mantenere una tabella di traduzione che prima o poi sbaglia.
  status              text not null default 'inactive'
                      check (status in ('inactive', 'trialing', 'active',
                                        'past_due', 'canceled', 'unpaid')),
  -- Fin quando è pagato. ⚠️ Si guarda QUESTO per decidere se il servizio è
  -- attivo, non `status` da solo: chi disdice resta `canceled` ma ha diritto
  -- al servizio fino alla fine del mese che ha già pagato.
  current_period_end  timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────
-- RIGA 30 — Il portafoglio a crediti
-- ─────────────────────────────────────────────────────────────────────────
--
-- «Se l'utente li esaurisce prima del rinnovo, il sistema non blocca l'agente
-- di punto in bianco, ma gli permette di acquistare pacchetti di ricarica.»
--
-- ⚠️ IL SALDO NON È UNA COLONNA, È UNA SOMMA.
-- La tentazione ovvia è tenere `credits integer` sul profilo e sommarci e
-- sottrarci. Sembra più semplice, e produce due guai certi: due richieste
-- contemporanee possono leggere lo stesso saldo e scriverne uno sbagliato, e
-- soprattutto quando un cliente chiede «perché mi sono finiti i crediti?» non
-- c'è nessuna risposta da dargli.
--
-- Qui si scrive **una riga per movimento** e il saldo è la somma. Non si
-- perdono soldi in una corsa fra due richieste, e la storia si legge riga per
-- riga come un estratto conto.
create table if not exists public.credit_ledger (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  -- Positivo = entrata (ricarica, crediti del piano, regalo).
  -- Negativo = consumo (un messaggio, una risposta, un'immagine).
  amount      integer not null,
  reason      text not null
              check (reason in ('plan', 'topup', 'usage', 'gift', 'refund', 'expiry')),
  -- A cosa si riferisce: l'id del pagamento Stripe, o del messaggio consumato.
  ref         text,
  note        text,
  created_at  timestamptz not null default now()
);

create index if not exists credit_ledger_user_idx
  on public.credit_ledger (user_id, created_at desc);

-- Il saldo, in un posto solo. Una funzione e non una vista perché la si chiama
-- con l'utente: le regole per riga fanno il resto.
create or replace function public.credit_balance(p_user text)
returns integer
language sql
stable
as $$
  select coalesce(sum(amount), 0)::integer
    from public.credit_ledger where user_id = p_user;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- RIGA 33 — L'avviso prima che finiscano
-- ─────────────────────────────────────────────────────────────────────────
-- Si segna quando è già stato mandato, per non ripeterlo a ogni messaggio: un
-- avviso che arriva dieci volte è un avviso che viene silenziato.
alter table public.subscriptions
  add column if not exists low_credit_warned_at timestamptz;

-- ─────────────────────────────────────────────────────────────────────────
-- RIGA 31 — BYOK: l'utente mette la sua chiave
-- ─────────────────────────────────────────────────────────────────────────
--
-- ⚠️ QUI DENTRO CI FINISCE UN SEGRETO DI UN'ALTRA PERSONA, e va trattato come
-- tale. La chiave di OpenRouter di un cliente può spendere i suoi soldi: se
-- esce da qui, il danno è suo e la colpa è nostra.
--
-- Tre difese: la sicurezza per riga (nessun altro utente la vede), il fatto che
-- non esce **mai** verso il browser (l'indirizzo restituisce solo le ultime
-- quattro cifre, per far capire quale chiave è), e il ruolo di sola lettura
-- `nexus_analyst` che su questa colonna non ha permessi.
alter table public.profiles
  add column if not exists byok_key text;

alter table public.profiles
  add column if not exists byok_last4 text;

comment on column public.profiles.byok_key is
  'La chiave OpenRouter dell''utente (riga 31). NON esce mai verso il browser: gli indirizzi restituiscono solo byok_last4. Chi la legge sta spendendo i soldi di qualcun altro.';

-- ── La sicurezza per riga, come tutto il resto ───────────────────────────
alter table public.subscriptions  enable row level security;
alter table public.credit_ledger  enable row level security;

drop policy if exists "solo il mio abbonamento" on public.subscriptions;
create policy "solo il mio abbonamento" on public.subscriptions
  for all using (user_id = current_setting('app.user_id', true))
  with check (user_id = current_setting('app.user_id', true));

drop policy if exists "solo i miei crediti" on public.credit_ledger;
create policy "solo i miei crediti" on public.credit_ledger
  for all using (user_id = current_setting('app.user_id', true))
  with check (user_id = current_setting('app.user_id', true));

-- ─────────────────────────────────────────────────────────────────────────
-- IL WEBHOOK DI STRIPE ARRIVA SENZA SAPERE CHI SEI
-- ─────────────────────────────────────────────────────────────────────────
-- Stessa storia di WhatsApp (0007) e del riepilogo serale (0010): quando
-- Stripe ci dice «questo abbonamento è stato pagato», sappiamo il suo
-- identificativo di cliente, non il nostro utente — anzi, è proprio quello che
-- dobbiamo scoprire. Fuori da `withUser()` le regole per riga non lasciano
-- vedere niente.
--
-- Ancora una porta stretta: accetta un identificativo di Stripe e restituisce
-- **solo** la riga che gli corrisponde.
create or replace function public.resolve_stripe_customer(p_customer text)
returns table (user_id text, plan_id text, status text)
language sql
security definer
set search_path = public
as $$
  select s.user_id, s.plan_id, s.status
    from public.subscriptions s
   where s.stripe_customer_id = p_customer
   limit 1;
$$;

-- Scrive quello che Stripe ci ha appena detto. Anche questa scavalca le regole
-- per riga, e per la stessa ragione: chi scrive è Stripe, non una persona.
create or replace function public.apply_stripe_state(
  p_customer text,
  p_sub text,
  p_plan text,
  p_status text,
  p_period_end timestamptz,
  p_cancel_at_end boolean
)
returns text
language sql
security definer
set search_path = public
as $$
  update public.subscriptions
     set stripe_sub_id = coalesce(p_sub, stripe_sub_id),
         plan_id = coalesce(p_plan, plan_id),
         status = coalesce(p_status, status),
         current_period_end = coalesce(p_period_end, current_period_end),
         cancel_at_period_end = coalesce(p_cancel_at_end, cancel_at_period_end),
         -- Il servizio è tornato attivo: l'avviso «stanno finendo» riparte
         -- da zero, se no non arriverebbe mai più.
         low_credit_warned_at = case when p_status = 'active' then null
                                     else low_credit_warned_at end,
         updated_at = now()
   where stripe_customer_id = p_customer
   returning user_id;
$$;

-- Accreditare crediti da un pagamento riuscito. Serve la stessa porta: il
-- webhook non sa di chi siano finché non lo chiede.
create or replace function public.credit_from_stripe(
  p_customer text,
  p_amount integer,
  p_reason text,
  p_ref text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user text;
begin
  select user_id into v_user
    from public.subscriptions where stripe_customer_id = p_customer limit 1;
  if v_user is null then return null; end if;

  -- ⚠️ Lo stesso pagamento non si accredita due volte. Stripe **ripete** i
  -- webhook finché non riceve un 200, e senza questo controllo una rete lenta
  -- regalerebbe crediti a ogni ripetizione.
  if exists (select 1 from public.credit_ledger
              where user_id = v_user and ref = p_ref and reason = p_reason) then
    return v_user;
  end if;

  insert into public.credit_ledger (user_id, amount, reason, ref)
  values (v_user, p_amount, p_reason, p_ref);
  return v_user;
end $$;

revoke all on function public.resolve_stripe_customer(text) from public;
revoke all on function public.apply_stripe_state(text, text, text, text, timestamptz, boolean) from public;
revoke all on function public.credit_from_stripe(text, integer, text, text) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'nexus_app') then
    grant execute on function public.resolve_stripe_customer(text) to nexus_app;
    grant execute on function public.apply_stripe_state(text, text, text, text, timestamptz, boolean) to nexus_app;
    grant execute on function public.credit_from_stripe(text, integer, text, text) to nexus_app;
    grant select, insert, update on public.subscriptions to nexus_app;
    grant select, insert on public.credit_ledger to nexus_app;
  end if;
  -- ⚠️ L'analista legge tutto tranne le chiavi altrui.
  if exists (select 1 from pg_roles where rolname = 'nexus_analyst') then
    grant select on public.subscriptions to nexus_analyst;
    grant select on public.credit_ledger to nexus_analyst;
  end if;
end $$;

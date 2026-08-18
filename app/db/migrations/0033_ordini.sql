-- ═════════════════════════════════════════════════════════════════════════
-- Gli ordini dei servizi — si compra dalla home, senza form lungo — 13 Ago 2026
-- ═════════════════════════════════════════════════════════════════════════
--
-- Tommaso: «i servizi si possono pagare direttamente, senza fare la mail dove
-- scrivi tutto». Il tasto «Ordina» registra QUI l'ordine con un mini-modulo
-- (azienda, email, telefono) e Tommaso riceve l'avviso. Quando ci saranno le
-- chiavi Stripe, lo stesso flusso aprirà il pagamento con carta e l'ordine
-- passerà a 'pagato' — la tabella è già pronta (colonna stato).
--
-- ⚠️ RLS acceso, nessuna policy: si entra solo dalle porte. Come tutto il resto.

create table if not exists public.ordini_servizi (
  id        bigserial primary key,
  servizio  text not null,
  prezzo    text not null default '',
  azienda   text not null,
  email     text not null,
  telefono  text not null default '',
  impronta  text,
  stato     text not null default 'nuovo',
  creato    timestamptz not null default now()
);

alter table public.ordini_servizi enable row level security;

-- Crea un ordine. Torna l'id, o NULL se da questa provenienza ne sono già
-- arrivati troppi nell'ultima ora (stessa filosofia del freno delle richieste:
-- una persona vera non ordina sei volte in un'ora, un programma sì).
create or replace function public.ordine_crea(
  p_servizio text, p_prezzo text, p_azienda text,
  p_email text, p_telefono text, p_impronta text
) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  quanti integer;
  nuovo bigint;
begin
  if p_impronta is not null then
    select count(*) into quanti
      from public.ordini_servizi
     where impronta = p_impronta and creato > now() - interval '1 hour';
    if quanti >= 5 then
      return null;
    end if;
  end if;
  insert into public.ordini_servizi (servizio, prezzo, azienda, email, telefono, impronta)
  values (left(p_servizio, 100), left(p_prezzo, 60), left(p_azienda, 200),
          left(p_email, 200), left(p_telefono, 60), p_impronta)
  returning id into nuovo;
  return nuovo;
end;
$$;

-- Gli ultimi ordini (per l'admin di domani).
create or replace function public.ordini_ultimi(p_limite integer)
returns table (id bigint, servizio text, prezzo text, azienda text, email text,
               telefono text, stato text, creato timestamptz)
language sql security definer set search_path = public as $$
  select o.id, o.servizio, o.prezzo, o.azienda, o.email, o.telefono, o.stato, o.creato
    from public.ordini_servizi o
   order by o.creato desc
   limit least(coalesce(p_limite, 20), 100);
$$;

-- Segna lo stato (pagato, contattato, chiuso): servirà a Stripe e all'admin.
create or replace function public.ordine_stato(p_id bigint, p_stato text)
returns void
language sql security definer set search_path = public as $$
  update public.ordini_servizi set stato = left(p_stato, 30) where id = p_id;
$$;

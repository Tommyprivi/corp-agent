-- ═════════════════════════════════════════════════════════════════════════
-- L'agente Controllo bolle: confronta la bolla col vero scarico — 13 Ago 2026
-- ═════════════════════════════════════════════════════════════════════════
--
-- Il terzo vero agente. Le bolle arrivate via posta dicono «8 colli da Rossi».
-- La banchina, separatamente, registra carichi/scarichi veri (Traffico →
-- Carico/Scarico). Questo agente li mette a confronto: se combaciano tutto
-- bene, se i numeri non tornano è una differenza da guardare, se la stessa
-- bolla sembra arrivata due volte è un doppione.
--
-- ⚠️ Non è un controllo bloccante: segna e basta. Chi decide cosa farne resta
-- una persona — l'agente non chiude né apre niente da solo qui.

alter table public.azienda_posta_allegati
  add column if not exists controllo_stato text not null default 'da_controllare',
  -- da_controllare | ok | differenza | doppione | in_attesa
  add column if not exists controllo_nota text not null default '';

-- La porta di lettura elenco bolle ora porta anche l'esito del controllo.
drop function if exists public.az_posta_bolle(text, integer);

create or replace function public.az_posta_bolle(p_azienda text, p_limite integer)
returns table (id bigint, arrivo bigint, nome text, tipo text, stato text,
               letto text, bolla jsonb, creato timestamptz, kb integer,
               controllo_stato text, controllo_nota text)
language sql security definer set search_path = public as $$
  select a.id, a.arrivo, a.nome, a.tipo, a.stato,
         a.letto, a.bolla, a.creato,
         (octet_length(a.dati) / 1024)::integer,
         a.controllo_stato, a.controllo_nota
    from public.azienda_posta_allegati a
   where a.azienda = p_azienda
   order by a.id desc
   limit least(coalesce(p_limite, 30), 100);
$$;

-- Le bolle lette e non ancora controllate: quelle su cui l'agente lavora.
create or replace function public.az_posta_bolle_da_controllare(p_azienda text, p_limite integer)
returns table (id bigint, bolla jsonb, creato timestamptz)
language sql security definer set search_path = public as $$
  select a.id, a.bolla, a.creato
    from public.azienda_posta_allegati a
   where a.azienda = p_azienda and a.stato = 'letto' and a.controllo_stato = 'da_controllare'
     and a.bolla is not null
   order by a.id
   limit least(coalesce(p_limite, 10), 30);
$$;

-- I movimenti (carico/scarico) di un'azienda in una finestra di giorni attorno
-- a una data, per il confronto. Non filtra per controparte: il confronto per
-- nome lo fa il codice (stessa logica di cercaSpedizione).
create or replace function public.az_movimenti_finestra(p_azienda text, p_da timestamptz, p_a timestamptz)
returns table (id bigint, tipo text, colli integer, controparte text, creato timestamptz)
language sql security definer set search_path = public as $$
  select m.id, m.tipo, m.colli, m.controparte, m.creato
    from public.azienda_movimenti m
   where m.azienda = p_azienda
     and m.tipo in ('carico', 'scarico')
     and m.creato between p_da and p_a
   order by m.creato;
$$;

create or replace function public.az_posta_bolla_controllo_salva(p_azienda text, p_id bigint, p_stato text, p_nota text)
returns void
language sql security definer set search_path = public as $$
  update public.azienda_posta_allegati
     set controllo_stato = case
           when p_stato in ('ok','differenza','doppione','in_attesa') then p_stato
           else 'da_controllare'
         end,
         controllo_nota = left(coalesce(p_nota,''), 500)
   where azienda = p_azienda and id = p_id;
$$;

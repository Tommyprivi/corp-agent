-- ═════════════════════════════════════════════════════════════════════════
-- L'agente che risponde alle mail facili — «questo è un agente» — 13 Ago 2026
-- ═════════════════════════════════════════════════════════════════════════
--
-- Tommaso: «senza approvare, legge le mail e risponde a quelle facili». Il
-- confine NON è l'approvazione a mano: è che l'agente risponde DA SOLO solo
-- alle categorie facili (conferme, info, dov'è il carico, prenotazioni), e le
-- difficili (prezzi, sconti, reclami) le gira a una persona. Così non manda
-- cavolate perché non tocca mai le cose delicate.
--
-- ⚠️ Si parte in modalità PROVA: l'agente scrive le bozze ma NON le manda.
-- Il titolare le legge, e quando si fida accende l'invio con un interruttore.
--
-- ⚠️ La bozza è testo del documento (può contenere dati del cliente): si salva
-- CIFRATA a riposo, come le trascrizioni delle bolle. Il codice cifra/decifra.

-- Config della risposta automatica, sulla casella collegata.
alter table public.azienda_posta
  add column if not exists auto_modo text not null default 'prova',   -- spento | prova | acceso
  add column if not exists auto_categorie text[] not null default '{}',
  add column if not exists smtp_host text,
  add column if not exists smtp_porta integer;

-- Lo stato di risposta di ogni mail arrivata.
alter table public.azienda_posta_arrivi
  add column if not exists classe text,                 -- conferme|info|stato|prenotazione|umano
  add column if not exists bozza text,                  -- la risposta proposta, CIFRATA
  add column if not exists risposta_stato text not null default 'nuovo', -- nuovo|bozza|mandata|umano
  add column if not exists risposta_quando timestamptz;

-- ── Le porte ─────────────────────────────────────────────────────────────

-- Accende/spegne e sceglie le categorie. Passa anche host/porta SMTP (derivati
-- dal provider dal codice), così l'invio sa dove bussare.
create or replace function public.az_posta_auto_salva(
  p_azienda text, p_modo text, p_categorie text[], p_smtp_host text, p_smtp_porta integer
) returns void
language sql security definer set search_path = public as $$
  update public.azienda_posta
     set auto_modo = case when p_modo in ('spento','prova','acceso') then p_modo else 'prova' end,
         auto_categorie = coalesce(p_categorie, '{}'),
         smtp_host = p_smtp_host,
         smtp_porta = p_smtp_porta
   where azienda = p_azienda;
$$;

-- Lo stato per l'interfaccia (nessun segreto).
create or replace function public.az_posta_auto_stato(p_azienda text)
returns table (auto_modo text, auto_categorie text[], smtp_host text, smtp_porta integer)
language sql security definer set search_path = public as $$
  select p.auto_modo, p.auto_categorie, p.smtp_host, p.smtp_porta
    from public.azienda_posta p where p.azienda = p_azienda;
$$;

-- Le mail ancora da elaborare (non classificate): le più vecchie prima.
create or replace function public.az_posta_da_elaborare(p_azienda text, p_limite integer)
returns table (id bigint, mittente text, oggetto text, corpo text)
language sql security definer set search_path = public as $$
  select a.id, a.mittente, a.oggetto, a.corpo
    from public.azienda_posta_arrivi a
   where a.azienda = p_azienda and a.risposta_stato = 'nuovo'
   order by a.id
   limit least(coalesce(p_limite, 5), 20);
$$;

-- Salva l'esito dell'elaborazione di una mail.
create or replace function public.az_posta_risposta_salva(
  p_azienda text, p_id bigint, p_classe text, p_bozza text, p_stato text
) returns void
language sql security definer set search_path = public as $$
  update public.azienda_posta_arrivi
     set classe = p_classe,
         bozza = p_bozza,
         risposta_stato = p_stato,
         risposta_quando = now()
   where azienda = p_azienda and id = p_id;
$$;

-- L'elenco per l'interfaccia: cosa è arrivato e cosa l'agente ne ha fatto.
create or replace function public.az_posta_risposte(p_azienda text, p_limite integer)
returns table (id bigint, ricevuto timestamptz, mittente text, oggetto text,
               classe text, bozza text, risposta_stato text, risposta_quando timestamptz)
language sql security definer set search_path = public as $$
  select a.id, coalesce(a.ricevuto, a.creato), a.mittente, a.oggetto,
         a.classe, a.bozza, a.risposta_stato, a.risposta_quando
    from public.azienda_posta_arrivi a
   where a.azienda = p_azienda and a.risposta_stato <> 'nuovo'
   order by a.id desc
   limit least(coalesce(p_limite, 30), 100);
$$;

-- I dati per mandare una bozza (destinatario, oggetto, la bozza cifrata).
create or replace function public.az_posta_bozza(p_azienda text, p_id bigint)
returns table (mittente text, oggetto text, bozza text, classe text, risposta_stato text)
language sql security definer set search_path = public as $$
  select a.mittente, a.oggetto, a.bozza, a.classe, a.risposta_stato
    from public.azienda_posta_arrivi a
   where a.azienda = p_azienda and a.id = p_id;
$$;

-- Segna una bozza come mandata.
create or replace function public.az_posta_mandata(p_azienda text, p_id bigint)
returns void
language sql security definer set search_path = public as $$
  update public.azienda_posta_arrivi
     set risposta_stato = 'mandata', risposta_quando = now()
   where azienda = p_azienda and id = p_id;
$$;

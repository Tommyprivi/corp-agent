-- ═════════════════════════════════════════════════════════════════════════
-- Le altre porte sulle richieste — 11 Agosto 2026
-- ═════════════════════════════════════════════════════════════════════════
--
-- ─────────────────────────────────────────────────────────────────────────
-- ⚠️ IL DIFETTO CHE QUESTA MIGRAZIONE RIPARA, TROVATO PROVANDO
-- ─────────────────────────────────────────────────────────────────────────
-- L'agente di prima qualifica rispondeva **«Richiesta non trovata»** a una
-- richiesta che nel database c'era, e che la pagina di stato mostrava senza
-- problemi.
--
-- La causa: la 0015 ha acceso la sicurezza per riga su `leads` senza scrivere
-- nessuna politica — di proposito, perché si doveva entrare solo dalle porte
-- strette. Poi il codice leggeva `leads` con un `select` diretto, e quel
-- `select` non trovava **zero righe per errore**: le trovava zero perché è
-- esattamente ciò che una tabella protetta senza politiche deve rispondere.
--
-- La stessa lezione della migrazione 0011, in un altro punto: **una porta
-- stretta va allargata quando la stanza cresce.** Se si sceglie di entrare
-- solo dalle funzioni, allora TUTTI gli accessi devono essere funzioni — non
-- solo i primi tre a cui si è pensato.

-- ── Quello che serve all'agente per sapere con chi parla ────────────────
create or replace function public.lead_dati(p_chiave text)
returns table (azienda text, settore text, telefono text, email text, esigenza text)
language sql security definer set search_path = public as $$
  select l.azienda, l.settore, l.telefono, l.email, l.esigenza
    from public.leads l where l.chiave = p_chiave;
$$;

-- ── La conversazione fin qui, per dare memoria all'agente ───────────────
create or replace function public.lead_conversazione(p_chiave text)
returns table (ruolo text, testo text)
language sql security definer set search_path = public as $$
  select m.ruolo, m.testo
    from public.lead_messages m
    join public.leads l on l.id = m.lead_id
   where l.chiave = p_chiave
   order by m.id;
$$;

-- ── La scrivania di Tommaso ─────────────────────────────────────────────
-- ⚠️ Questa restituisce TUTTO, comprese email e telefoni: è il pannello del
-- commerciale. Non ha nessun controllo di identità dentro di sé — il controllo
-- è nel codice che la chiama, che verifica prima chi sta chiedendo. Sta
-- scritto qui perché chi legge il SQL da solo non lo indovinerebbe, e una
-- funzione così va chiamata sapendo cosa fa.
create or replace function public.leads_elenco(p_archivio boolean)
returns table (
  id uuid, azienda text, settore text, telefono text, email text,
  esigenza text, stato text, esito text, note text, chiave text,
  creata_il timestamptz, aggiornata timestamptz, messaggi bigint
)
language sql security definer set search_path = public as $$
  select l.id, l.azienda, l.settore, l.telefono, l.email, l.esigenza,
         l.stato, l.esito, l.note, l.chiave, l.creata_il, l.aggiornata,
         (select count(*) from public.lead_messages m where m.lead_id = l.id)
    from public.leads l
   where (p_archivio and l.stato = 'chiusa') or (not p_archivio and l.stato <> 'chiusa')
   order by l.aggiornata desc;
$$;

-- ── I messaggi di una richiesta, per il pannello ────────────────────────
create or replace function public.lead_messaggi(p_id uuid)
returns table (ruolo text, testo text, creato_il timestamptz)
language sql security definer set search_path = public as $$
  select m.ruolo, m.testo, m.creato_il
    from public.lead_messages m where m.lead_id = p_id order by m.id;
$$;

-- ── Spostare una pratica ────────────────────────────────────────────────
create or replace function public.lead_aggiorna(
  p_id uuid, p_stato text, p_note text, p_esito text
) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  update public.leads
     set stato = coalesce(nullif(p_stato, ''), stato),
         -- ⚠️ `coalesce` e non un assegnamento secco: chi aggiorna solo lo
         -- stato non deve cancellare le note scritte il giorno prima.
         note  = coalesce(p_note, note),
         esito = coalesce(p_esito, esito),
         aggiornata = now()
   where id = p_id;
  return found;
end $$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'nexus_app') then
    grant execute on function public.lead_dati(text) to nexus_app;
    grant execute on function public.lead_conversazione(text) to nexus_app;
    grant execute on function public.leads_elenco(boolean) to nexus_app;
    grant execute on function public.lead_messaggi(uuid) to nexus_app;
    grant execute on function public.lead_aggiorna(uuid, text, text, text) to nexus_app;
  end if;
end $$;

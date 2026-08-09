-- ─────────────────────────────────────────────────────────────────────────
-- FASE 3 — La porta stretta deve far passare anche Ghost
-- ─────────────────────────────────────────────────────────────────────────
--
-- ⚠️ DIFETTO TROVATO ESEGUENDO IL 9 AGOSTO 2026, NON COMPILANDO.
-- La modalità Ghost era scritta, l'interruttore si accendeva, il database la
-- salvava — e non succedeva **niente**: l'agente continuava a rispondere da
-- solo come se l'interruttore non ci fosse.
--
-- La causa: il webhook non legge `channels` con una query, legge
-- `resolve_wa_channel()` (migrazione 0007), che restituisce quattro colonne
-- fisse. Ghost era la quinta, e quella funzione non la conosceva. In
-- TypeScript `row.ghost` diventava `undefined`, che è falso, e il messaggio
-- partiva.
--
-- La lezione, che vale per la prossima colonna: **una porta stretta va
-- allargata quando la stanza cresce.** Aggiungere una colonna alla tabella non
-- basta se il codice la legge da una funzione che elenca le colonne a mano.

-- ⚠️ `drop` prima di `create`: Postgres rifiuta un `create or replace` che
-- cambia le colonne restituite («cannot change return type of existing
-- function»). Va buttata e rifatta, ed è sicuro perché la richiama solo il
-- webhook, che nel frattempo prende un errore e risponde comunque 200 —
-- il messaggio resta da Meta, che lo ripete.
drop function if exists public.resolve_wa_channel(text);

create function public.resolve_wa_channel(p_external_id text)
returns table (id uuid, user_id text, agent_id uuid, handoff boolean, ghost boolean)
language sql
security definer
set search_path = public
as $$
  select c.id, c.user_id, c.agent_id, c.handoff, c.ghost
    from public.channels c
   where c.external_id = p_external_id
     and c.kind = 'whatsapp'
     and c.status <> 'disabled'
   limit 1;
$$;

revoke all on function public.resolve_wa_channel(text) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'nexus_app') then
    grant execute on function public.resolve_wa_channel(text) to nexus_app;
  end if;
end $$;

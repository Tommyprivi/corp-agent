-- ─────────────────────────────────────────────────────────────────────────
-- FASE 3 — Trovare il canale prima di sapere di chi è
-- ─────────────────────────────────────────────────────────────────────────
--
-- ⚠️ IL PROBLEMA, TROVATO ESEGUENDO IL 2 AGOSTO 2026
-- Il webhook riceveva il messaggio, rispondeva 200, e **non salvava niente**.
-- Nessun errore, nessuna traccia: il messaggio spariva.
--
-- La causa: `channels` ha la sicurezza per riga, che confronta `user_id` con
-- `app.user_id`. Ma il webhook legge quella tabella **prima** di sapere chi
-- sia l'utente — anzi, la legge proprio per scoprirlo. Fuori da `withUser()`
-- quella variabile non è impostata, la regola non trova corrispondenze, e la
-- query restituisce zero righe come se il canale non esistesse.
--
-- È esattamente lo stesso problema che la migrazione 0002 aveva già descritto
-- per gli scanner di magazzino:
--
--   «quando arriva una lettura, lo scanner manda la chiave ma non sa chi è il
--    suo utente. Serve leggere `ingest_keys` PRIMA di sapere in che panni
--    metterci — cioè fuori da withUser(), dove le regole per riga non
--    lascerebbero vedere niente.»
--
-- Stessa malattia, stessa medicina: una porta stretta invece di una porta
-- aperta. Una funzione che gira coi permessi del proprietario, accetta un
-- identificativo e restituisce **solo** la riga che gli corrisponde.
--
-- Perché è sicuro darla in mano all'applicazione: senza il `phone_number_id`
-- giusto non restituisce niente, e quell'identificativo lo conosce solo chi ha
-- già superato il controllo della firma di Meta. Non è una scorciatoia per
-- leggere i canali altrui: è una chiave che apre una porta sola.

create or replace function public.resolve_wa_channel(p_external_id text)
returns table (id uuid, user_id text, agent_id uuid, handoff boolean)
language sql
security definer
set search_path = public
as $$
  select c.id, c.user_id, c.agent_id, c.handoff
    from public.channels c
   where c.external_id = p_external_id
     and c.kind = 'whatsapp'
     and c.status <> 'disabled'
   limit 1;
$$;

-- Non la può chiamare chiunque si colleghi al database: solo l'applicazione.
revoke all on function public.resolve_wa_channel(text) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'nexus_app') then
    grant execute on function public.resolve_wa_channel(text) to nexus_app;
  end if;
end $$;

comment on function public.resolve_wa_channel(text) is
  'Trova il canale WhatsApp dal phone_number_id di Meta, scavalcando la sicurezza per riga. Serve al webhook, che deve scoprire di chi è il numero prima di potersi mettere nei panni di quell''utente. Vedi api/whatsapp.ts.';

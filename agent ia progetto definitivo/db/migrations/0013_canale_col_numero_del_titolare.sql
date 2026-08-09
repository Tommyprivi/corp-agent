-- ─────────────────────────────────────────────────────────────────────────
-- FASE 3/8 — Il webhook deve riconoscere il titolare
-- ─────────────────────────────────────────────────────────────────────────
--
-- Da quando WhatsApp accetta foto e vocali (9 Agosto 2026), il canale deve
-- sapere **chi sta scrivendo**, e non per curiosità: le due cose sono opposte.
--
--   Un CLIENTE manda una foto      → «cos'è questo?» Si guarda e si risponde.
--   Il TITOLARE manda una foto     → è il menù nuovo, o uno scontrino.
--                                    Va LETTO e messo in memoria, non
--                                    commentato. E soprattutto non gli si
--                                    risponde come a un cliente.
--
-- Rispondere al titolare «Buongiorno! Come possiamo aiutarla?» mentre lui sta
-- fotografando il listino è il modo più veloce di fargli chiudere l'app.
--
-- ⚠️ Terza volta che questa funzione va allargata (0007 → 0011 → questa), e la
-- lezione è sempre la stessa: una porta stretta che elenca le colonne a mano va
-- rifatta ogni volta che la stanza cresce. È il prezzo di scavalcare la
-- sicurezza per riga, e si paga volentieri.

drop function if exists public.resolve_wa_channel(text);

create function public.resolve_wa_channel(p_external_id text)
returns table (
  id uuid, user_id text, agent_id uuid,
  handoff boolean, ghost boolean, owner_wa text
)
language sql
security definer
set search_path = public
as $$
  select c.id, c.user_id, c.agent_id, c.handoff, c.ghost, c.owner_wa
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

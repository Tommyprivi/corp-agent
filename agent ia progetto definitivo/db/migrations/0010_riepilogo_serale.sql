-- ─────────────────────────────────────────────────────────────────────────
-- FASE 3 — Riga 27: il riepilogo serale
-- ─────────────────────────────────────────────────────────────────────────
--
-- «Invece di costringere il titolare a loggarsi sulla dashboard per vedere cosa
-- hanno fatto gli agenti, è l'agente stesso che ogni sera alle 20:00 manda un
-- messaggio WhatsApp al capo.»
--
-- ⚠️ IL PROBLEMA CHE QUESTA FUNZIONE RISOLVE
-- Un lavoro programmato non ha un utente. Parte da solo alle 20:00 e deve
-- guardare i canali di **tutti**, mentre ogni tabella qui dentro è protetta
-- dalla sicurezza per riga, che chiede «per conto di chi stai leggendo?».
--
-- È lo stesso muro di `resolve_wa_channel` (migrazione 0007) e degli scanner
-- (0002), e la medicina è la stessa: una porta stretta invece di una porta
-- aperta. Questa funzione non restituisce i canali — restituisce **solo**
-- quelli che stasera hanno qualcosa da raccontare e a chi mandarlo.
--
-- Perché è sicuro: non accetta parametri che permettano di scegliere di chi
-- leggere, non restituisce messaggi né documenti, e la può chiamare soltanto
-- l'applicazione. Quello che esce sono numeri e un numero di telefono che il
-- titolare ha scritto lui stesso per farsi avvisare.

create or replace function public.pulse_due(p_day date)
returns table (
  channel_id   uuid,
  user_id      text,
  owner_wa     text,
  ricevuti     bigint,
  risposti     bigint,
  fermati      bigint,
  a_mano       bigint,
  costo        numeric
)
language sql
security definer
set search_path = public
as $$
  select
    c.id,
    c.user_id,
    c.owner_wa,
    count(*) filter (where m.direction = 'in')                        as ricevuti,
    count(*) filter (where m.direction = 'out' and m.answered_by = 'agent'
                       and m.hold_reason is null)                     as risposti,
    count(*) filter (where m.hold_reason is not null)                 as fermati,
    count(*) filter (where m.answered_by = 'human')                   as a_mano,
    coalesce(sum(m.cost_eur), 0)                                      as costo
  from public.channels c
  left join public.wa_conversations v on v.channel_id = c.id
  left join public.wa_messages m
         on m.conversation_id = v.id
        and m.created_at >= p_day::timestamptz
        and m.created_at <  (p_day + 1)::timestamptz
 where c.kind = 'whatsapp'
   and c.owner_wa is not null
   and c.status <> 'disabled'
   -- Il giorno già segnato non si rifà: se il lavoro programmato parte due
   -- volte, il titolare riceve un riepilogo solo.
   and (c.pulse_on is null or c.pulse_on < p_day)
 group by c.id, c.user_id, c.owner_wa
 -- Una giornata senza nemmeno un messaggio non merita un avviso: mandarlo
 -- lo stesso insegnerebbe al titolare a ignorare questi messaggi.
having count(*) filter (where m.direction = 'in') > 0;
$$;

-- Segna il giorno come fatto. Anche questa scavalca la sicurezza per riga,
-- e per la stessa ragione: chi scrive è un lavoro programmato, non una persona.
create or replace function public.pulse_done(p_channel uuid, p_day date)
returns void
language sql
security definer
set search_path = public
as $$
  update public.channels set pulse_on = p_day where id = p_channel;
$$;

revoke all on function public.pulse_due(date) from public;
revoke all on function public.pulse_done(uuid, date) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'nexus_app') then
    grant execute on function public.pulse_due(date) to nexus_app;
    grant execute on function public.pulse_done(uuid, date) to nexus_app;
  end if;
end $$;

comment on function public.pulse_due(date) is
  'I canali che stasera hanno qualcosa da raccontare al titolare, coi numeri della giornata. Serve al riepilogo serale (riga 27), che gira senza un utente e quindi non puo'' passare da withUser(). Vedi api/_lib/whatsapp.ts.';

-- ═════════════════════════════════════════════════════════════════════════
-- La difesa che regge anche se Turnstile non parte — 11 Agosto 2026
-- ═════════════════════════════════════════════════════════════════════════
--
-- ─────────────────────────────────────────────────────────────────────────
-- ⚠️ IL PROBLEMA VERO, E NON È «UN CAPTCHA CHE DÀ ERRORE»
-- ─────────────────────────────────────────────────────────────────────────
-- Turnstile su corpagent.vercel.app restituisce la pagina di errore di
-- Cloudflare. Finché resta così, **nessuna azienda può mandare una richiesta**:
-- il controllo fallisce, il server rifiuta, e la vetrina è online.
--
-- La tentazione è togliere il controllo. Sarebbe sbagliato: ogni richiesta
-- finta apre una conversazione con l'agente, e ogni conversazione sono soldi
-- veri di modello. Un form aperto al mondo senza difese non è un rischio
-- teorico, è una bolletta.
--
-- La strada giusta è **degradare, non spegnere**: se Turnstile risponde, vale
-- Turnstile. Se Turnstile è guasto, valgono due difese più deboli ma reali —
-- l'esca e il limite di frequenza — e il servizio resta in piedi.

-- ── Da dove è arrivata la richiesta ─────────────────────────────────────
-- ⚠️ NON l'indirizzo IP: la sua impronta. Un IP è un dato personale, e
-- conservarlo per contare le richieste sarebbe raccogliere molto più di quanto
-- serve. L'impronta permette di dire «queste tre vengono dallo stesso posto»
-- senza permettere di dire «da quale posto». È la differenza fra contare e
-- sorvegliare.
alter table public.leads add column if not exists ip_hash text;

create index if not exists leads_ip_recenti_idx
  on public.leads (ip_hash, creata_il desc);

-- ── La porta pubblica, ora con il limite di frequenza ───────────────────
-- ⚠️ `create or replace` non basta: la funzione cambia i parametri, e Postgres
-- creerebbe un secondo `lead_nuova` invece di sostituire il primo. Con due
-- versioni in giro, indovinare quale viene chiamata è un bug che si manifesta
-- settimane dopo.
drop function if exists public.lead_nuova(text, text, text, text, text);

create or replace function public.lead_nuova(
  p_azienda text, p_settore text, p_telefono text, p_email text,
  p_esigenza text, p_ip_hash text default null
) returns table (id uuid, chiave text, rifiutata boolean)
language plpgsql security definer set search_path = public as $$
declare
  v_recenti integer;
begin
  -- Tre richieste all'ora dallo stesso posto. Un imprenditore che si accorge di
  -- aver sbagliato l'email e riprova due volte passa; un programma che ne manda
  -- cento no.
  if p_ip_hash is not null then
    select count(*) into v_recenti
      from public.leads
     where ip_hash = p_ip_hash
       and creata_il > now() - interval '1 hour';
    if v_recenti >= 3 then
      return query select null::uuid, null::text, true;
      return;
    end if;
  end if;

  return query
  insert into public.leads (azienda, settore, telefono, email, esigenza, ip_hash)
  values (left(trim(p_azienda), 200), left(trim(p_settore), 80),
          left(trim(p_telefono), 40), left(trim(p_email), 200),
          left(trim(p_esigenza), 4000), p_ip_hash)
  returning public.leads.id, public.leads.chiave, false;
end $$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'nexus_app') then
    grant execute on function public.lead_nuova(text,text,text,text,text,text) to nexus_app;
  end if;
end $$;

comment on column public.leads.ip_hash is
  'Impronta della provenienza, non l''indirizzo: serve a contare le richieste ravvicinate senza conservare un dato personale.';

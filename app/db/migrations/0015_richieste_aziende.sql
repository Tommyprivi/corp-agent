-- ═════════════════════════════════════════════════════════════════════════
-- DIREZIONE FINALE — le richieste delle aziende (10 Agosto 2026)
-- ═════════════════════════════════════════════════════════════════════════
--
-- Decisione di Tommaso: pubblico va **solo** il form di contatto aziende. Il
-- prodotto resta dietro una porta finché non c'è un cliente vero collegato.
--
-- ─────────────────────────────────────────────────────────────────────────
-- ⚠️ QUESTA TABELLA NON HA UN `user_id`, E NON È UNA DIMENTICANZA
-- ─────────────────────────────────────────────────────────────────────────
-- Chi compila il form **non ha un account**: è un'azienda che passa dal sito e
-- lascia il suo nome. Tutte le altre tabelle del progetto sono protette dalla
-- sicurezza per riga su `app.user_id`, ma qui quel meccanismo non c'entra: non
-- c'è nessun utente da confrontare.
--
-- Le richieste sono di **Tommaso** — è lui il commerciale. La protezione quindi
-- non è per riga, è per porta: le funzioni `security definer` qui sotto sono le
-- uniche vie d'accesso, e ognuna sa esattamente cosa lascia passare.

create table if not exists public.leads (
  id           uuid primary key default gen_random_uuid(),

  -- ── Quello che scrive l'azienda nel form ────────────────────────────
  azienda      text not null,
  settore      text not null,
  telefono     text not null,
  -- ⚠️ Obbligatoria, e il form dice PERCHÉ: «ci serve per inviarti la proposta
  -- dettagliata». Un campo obbligatorio senza motivo sembra una pretesa; con il
  -- motivo scritto accanto diventa un patto.
  email        text not null,
  esigenza     text not null,

  -- ── La chiave con cui l'azienda controlla la SUA richiesta ──────────
  -- ⚠️ Non l'`id`: un uuid finisce nei registri del server, nelle statistiche,
  -- nei link condivisi. Questa è una parola d'ordine separata, e serve solo a
  -- vedere lo stato — mai a modificare niente.
  -- ⚠️ `gen_random_bytes` sta in pgcrypto, che qui non c'è: su Neon abbiamo
  -- pgvector e le funzioni uuid native, non pgcrypto. Si costruisce con quello
  -- che c'è — due uuid casuali senza trattini danno 64 caratteri esadecimali,
  -- più che abbastanza perché nessuno la indovini.
  chiave       text not null unique
               default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),

  -- ── Dove sta la pratica ─────────────────────────────────────────────
  -- `nuova`      appena arrivata, l'agente non ha ancora parlato
  -- `qualificata` l'agente ha fatto le domande base
  -- `in_lavoro`  Tommaso sta preparando la versione iniziale (1-2 giorni)
  -- `consegnata` mostrata all'azienda
  -- `chiusa`     finita, in un modo o nell'altro → va in archivio
  stato        text not null default 'nuova'
               check (stato in ('nuova','qualificata','in_lavoro','consegnata','chiusa')),
  -- Perché è chiusa: «diventata cliente», «non risponde», «non era per noi».
  -- Serve fra sei mesi, quando le richieste chiuse saranno cento.
  esito        text,

  -- Appunti di Tommaso. ⚠️ Mai mostrati all'azienda: la pagina dello stato
  -- legge solo `stato`, e questo campo non passa da lì.
  note         text,

  creata_il    timestamptz not null default now(),
  aggiornata   timestamptz not null default now()
);

create index if not exists leads_stato_idx on public.leads (stato, creata_il desc);

-- ─────────────────────────────────────────────────────────────────────────
-- LE RISPOSTE ALL'AGENTE DI PRIMA QUALIFICA
-- ─────────────────────────────────────────────────────────────────────────
-- Riga 3 della direzione finale: «dopo l'invio un agente fa alcune domande base
-- di approfondimento, poi chiude indirizzando a scrivere via email».
--
-- ⚠️ Stanno in una tabella a parte e non in un `jsonb` dentro `leads` perché
-- Tommaso le deve **leggere in ordine**, come una conversazione. Un blob JSON si
-- legge male, e queste sono le parole con cui un imprenditore ha spiegato il suo
-- problema: sono la cosa più preziosa che arriva dal form.
create table if not exists public.lead_messages (
  id         bigserial primary key,
  lead_id    uuid not null references public.leads(id) on delete cascade,
  ruolo      text not null check (ruolo in ('agente','azienda')),
  testo      text not null,
  creato_il  timestamptz not null default now()
);

create index if not exists lead_messages_lead_idx on public.lead_messages (lead_id, id);

alter table public.leads enable row level security;
alter table public.lead_messages enable row level security;

-- ⚠️ Nessuna politica permissiva: **niente** passa dalle query dirette. Si entra
-- solo dalle funzioni qui sotto, che sono `security definer` e quindi guardano
-- oltre la sicurezza per riga — ma una alla volta, sapendo cosa fanno.

-- ── La porta pubblica: chiunque può lasciare una richiesta ──────────────
create or replace function public.lead_nuova(
  p_azienda text, p_settore text, p_telefono text, p_email text, p_esigenza text
) returns table (id uuid, chiave text)
language plpgsql security definer set search_path = public as $$
begin
  -- ⚠️ Tagliati alla lunghezza: questo indirizzo è aperto al mondo, e un campo
  -- senza limite è un invito a riempire il database. Il taglio è silenzioso di
  -- proposito — chi scrive un romanzo nel form non deve vedere un errore.
  return query
  insert into public.leads (azienda, settore, telefono, email, esigenza)
  values (left(trim(p_azienda), 200), left(trim(p_settore), 80),
          left(trim(p_telefono), 40), left(trim(p_email), 200),
          left(trim(p_esigenza), 4000))
  returning public.leads.id, public.leads.chiave;
end $$;

-- ── La conversazione di qualifica, sempre dalla porta pubblica ──────────
create or replace function public.lead_dice(
  p_chiave text, p_ruolo text, p_testo text
) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_lead uuid;
  v_quanti integer;
begin
  select id into v_lead from public.leads where chiave = p_chiave;
  if v_lead is null then return -1; end if;

  -- ⚠️ Tetto duro sulla conversazione. L'agente di qualifica fa «alcune domande
  -- base», non assistenza gratuita a tempo indeterminato: senza questo tetto
  -- una sola richiesta potrebbe consumare modello per ore. Il numero è alto
  -- abbastanza da non tagliare nessuno a metà frase.
  select count(*) into v_quanti from public.lead_messages where lead_id = v_lead;
  if v_quanti >= 40 then return -2; end if;

  insert into public.lead_messages (lead_id, ruolo, testo)
  values (v_lead, p_ruolo, left(p_testo, 4000));

  update public.leads
     set stato = case when stato = 'nuova' then 'qualificata' else stato end,
         aggiornata = now()
   where id = v_lead;

  return v_quanti + 1;
end $$;

-- ── Cosa vede l'azienda della PROPRIA richiesta ─────────────────────────
-- ⚠️ Restituisce quattro colonne e nessuna di più. Non `note`, non `esito`,
-- non l'elenco delle altre richieste. È la differenza fra «controlla lo stato»
-- e «guarda dentro la mia scrivania».
create or replace function public.lead_stato(p_chiave text)
returns table (azienda text, stato text, creata_il timestamptz, aggiornata timestamptz)
language sql security definer set search_path = public as $$
  select l.azienda, l.stato, l.creata_il, l.aggiornata
    from public.leads l where l.chiave = p_chiave;
$$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'nexus_app') then
    grant execute on function public.lead_nuova(text,text,text,text,text) to nexus_app;
    grant execute on function public.lead_dice(text,text,text) to nexus_app;
    grant execute on function public.lead_stato(text) to nexus_app;
    -- La dashboard privata legge le tabelle direttamente: ci arriva solo il
    -- codice che ha già verificato che chi chiede è Tommaso.
    grant select, update on public.leads to nexus_app;
    grant select on public.lead_messages to nexus_app;
    grant usage, select on sequence public.lead_messages_id_seq to nexus_app;
  end if;
  if exists (select 1 from pg_roles where rolname = 'nexus_analyst') then
    -- ⚠️ L'analista vede il movimento, non le persone: nessuna email, nessun
    -- telefono. Sono contatti commerciali di aziende vere, e non esiste
    -- statistica che valga il rischio di averli in una query di comodo.
    grant select (id, settore, stato, creata_il, aggiornata) on public.leads to nexus_analyst;
  end if;
end $$;

comment on table public.leads is
  'Le richieste che arrivano dal form pubblico (Direzione finale, 10 Agosto 2026). Nessun user_id: chi compila non ha un account. Si entra solo dalle funzioni lead_nuova / lead_dice / lead_stato.';

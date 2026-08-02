-- CorpAgent — moduli a pagamento, canale WhatsApp, ingesso scanner, telemetria
--
-- Come si applica: pgAdmin → tasto destro sul database → Query Tool →
-- incolla tutto questo file → Execute (F5). Va eseguito DOPO 0001_init.sql.
--
-- ─────────────────────────────────────────────────────────────────────────
-- COSA C'È QUI DENTRO E PERCHÉ
-- ─────────────────────────────────────────────────────────────────────────
-- Tre cose sole, tutte e tre necessarie per incassare entro fine agosto:
--
--  1. MODULI A PAGAMENTO — il meccanismo che rende vendibile il lavoro su
--     misura per l'azienda di trasporti, e ripetibile con il cliente dopo.
--  2. CANALE WHATSAPP — conversazioni e messaggi veri, con la protezione
--     contro le risposte doppie che Meta provoca a ogni tentativo ripetuto.
--  3. INGESSO SCANNER + TELEMETRIA — dove atterrano le letture dei lettori
--     fisici, e le tabelle che rendono il database interrogabile.
--
-- Cosa NON c'è, di proposito: gerarchie aziendali (filiali, divisioni,
-- reparti), ruoli granulari a policy, tabelle di sessione e dispositivi,
-- fatturazione completa, connettori Fluida. Sono le Fasi 4 e 7 di
-- docs/PERCORSO.md. Aggiungerle ora significa che ogni query dell'MVP porta
-- un collegamento in più per servire un cliente che non esiste ancora: il
-- tuo primo cliente è UN'azienda di trasporti, con un account.
-- Il giorno che servono, in Postgres si aggiungono con un `alter table add
-- column org_id` e una policy: è una serata di lavoro, non una riscrittura.
--
-- ─────────────────────────────────────────────────────────────────────────
-- NOTA SULL'ORDINE DELLE MIGRAZIONI
-- ─────────────────────────────────────────────────────────────────────────
-- 0001 diceva che la 0002 avrebbe aggiunto i collegamenti verso la tabella
-- "user" di Better Auth. Quel lavoro si sposta alla 0003, perché adesso ci
-- sono più tabelle da collegare e conviene farlo in un colpo solo. Qui, come
-- in 0001, ogni riferimento a un utente è `text` senza foreign key.


-- ═════════════════════════════════════════════════════════════════════════
-- 1. MODULI A PAGAMENTO
-- ═════════════════════════════════════════════════════════════════════════

-- Il catalogo dei moduli extra. Non sono dati di un utente: è un listino, e
-- lo scrivi tu da pgAdmin. Per questo la regola sotto permette a tutti di
-- leggerlo e a nessuno di scriverlo — il proprietario del database (tu) è
-- esente dalle regole e passa comunque.
create table public.modules (
  code         text primary key,              -- 'scanner-trasporti'
  name         text not null,
  description  text,
  price_eur    numeric(10, 2) not null default 0,
  billing      text not null default 'one_off'
               check (billing in ('one_off', 'monthly', 'yearly')),
  -- false = fatto su misura per un cliente, non compare in nessun catalogo
  is_public    boolean not null default false,
  created_at   timestamptz not null default now()
);

-- Chi ha diritto a cosa. È la riga che l'azienda di trasporti sta comprando.
--
-- ⚠️ La regola di sicurezza qui è `for select` e basta, di proposito:
-- l'utente può vedere i propri moduli ma NON può inserirsene uno. Un diritto
-- si attiva da pgAdmin (tu, che sei esente) o da un endpoint di
-- amministrazione con un ruolo privilegiato. Se fosse `for all`, un bug
-- nell'API diventerebbe un modo per sbloccarsi gratis un modulo da 600 €.
create table public.module_entitlements (
  id             uuid primary key default gen_random_uuid(),
  user_id        text not null,
  module_code    text not null references public.modules (code) on delete restrict,
  status         text not null default 'active'
                 check (status in ('active', 'trial', 'suspended', 'expired')),
  activated_at   timestamptz not null default now(),
  expires_at     timestamptz,                 -- null = per sempre (una tantum)
  price_paid_eur numeric(10, 2),
  -- Perché è stato attivato: 'bonifico 12/08, Trasporti Rossi srl'. Quando
  -- fra sei mesi ti chiederai da dove arriva questo diritto, la risposta è qui.
  note           text,
  created_at     timestamptz not null default now(),
  unique (user_id, module_code)
);

create index module_entitlements_user_idx on public.module_entitlements (user_id, status);

-- Il modulo dell'azienda di trasporti, già in catalogo. Il prezzo lo correggi
-- con una update quando chiudi la trattativa.
insert into public.modules (code, name, description, price_eur, billing, is_public)
values (
  'scanner-trasporti',
  'Scanner di magazzino',
  'Collega i lettori di codici fisici a CorpAgent: ogni lettura arriva nel database e diventa interrogabile.',
  600.00,
  'one_off',
  false
) on conflict (code) do nothing;


-- ═════════════════════════════════════════════════════════════════════════
-- 2. CHIAVI D'INGESSO — come si autentica un lettore di codici
-- ═════════════════════════════════════════════════════════════════════════

-- Uno scanner non fa il login con Google: non ha un browser e non c'è nessuno
-- davanti a premere un pulsante. Gli serve una chiave lunga da mettere nella
-- configurazione una volta sola.
--
-- Della chiave salviamo **solo l'impronta** (sha256), mai il testo. Se un
-- giorno qualcuno leggesse questa tabella, non ne ricaverebbe una chiave
-- funzionante. Il `key_prefix` serve solo a farti riconoscere quale è quale
-- nell'elenco, come fa GitHub con i suoi token.
create table public.ingest_keys (
  id           uuid primary key default gen_random_uuid(),
  user_id      text not null,
  label        text not null,                 -- 'Scanner magazzino Bologna'
  key_hash     text not null,                 -- sha256 della chiave in chiaro
  key_prefix   text not null,                 -- 'nxs_a1b2' — per riconoscerla
  scopes       text[] not null default array['scan:write']::text[],
  last_used_at timestamptz,
  revoked_at   timestamptz,                   -- non si cancella: si revoca
  created_at   timestamptz not null default now()
);

create unique index ingest_keys_hash_idx on public.ingest_keys (key_hash);
create index ingest_keys_user_idx on public.ingest_keys (user_id) where revoked_at is null;

-- Il problema: quando arriva una lettura, lo scanner manda la chiave ma non sa
-- chi è il suo utente. Serve leggere `ingest_keys` PRIMA di sapere in che
-- panni metterci — cioè fuori da `withUser()`, dove le regole per riga non
-- lascerebbero vedere niente.
--
-- La soluzione è questa porta stretta: una funzione che gira coi permessi del
-- proprietario, accetta un'impronta e restituisce l'utente. Senza l'impronta
-- giusta non restituisce nulla, quindi darla in mano all'applicazione è
-- sicuro. Aggiorna anche `last_used_at`, così vedi in pgAdmin quali scanner
-- sono vivi e quali sono in un cassetto da tre mesi.
create or replace function public.resolve_ingest_key(p_key_hash text)
returns table (user_id text, key_id uuid, scopes text[])
language sql
security definer
set search_path = public
as $$
  update public.ingest_keys
     set last_used_at = now()
   where key_hash = p_key_hash
     and revoked_at is null
  returning user_id, id, scopes;
$$;

-- La funzione la può chiamare solo l'applicazione, non chiunque si colleghi.
-- Il `do` serve perché il ruolo `nexus_app` esiste solo se hai già fatto il
-- Passo 5 di docs/SETUP-DATABASE.md: così questo file non dà errore comunque.
revoke all on function public.resolve_ingest_key(text) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'nexus_app') then
    grant execute on function public.resolve_ingest_key(text) to nexus_app;
  end if;
end $$;


-- ═════════════════════════════════════════════════════════════════════════
-- 3. IL CANALE WHATSAPP
-- ═════════════════════════════════════════════════════════════════════════

-- Il numero collegato. Uno per utente all'inizio, ma la tabella ne regge
-- tanti senza modifiche: serve il giorno che un'azienda ha due numeri.
create table public.channels (
  id           uuid primary key default gen_random_uuid(),
  user_id      text not null,
  kind         text not null default 'whatsapp'
               check (kind in ('whatsapp', 'web', 'telegram')),
  display_name text,
  phone_number text,                          -- +39...
  external_id  text,                          -- phone_number_id di Meta
  status       text not null default 'pending'
               check (status in ('pending', 'active', 'error', 'disabled')),
  agent_id     uuid references public.agents on delete set null,
  -- L'interruttore "passa la parola all'umano" del Passo 4: quando è true
  -- l'agente riceve e registra ma non risponde.
  handoff      boolean not null default false,
  config       jsonb not null default '{}'::jsonb,
  last_error   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index channels_user_idx on public.channels (user_id);
create index channels_external_idx on public.channels (external_id) where external_id is not null;

-- Una conversazione per cliente. `status` distingue chi sta rispondendo, ed è
-- quello che il Contatore Risparmio conta a fine mese.
create table public.wa_conversations (
  id              uuid primary key default gen_random_uuid(),
  user_id         text not null,
  channel_id      uuid not null references public.channels on delete cascade,
  customer_wa     text not null,              -- il numero del cliente
  customer_name   text,
  locale          text,                       -- lingua rilevata (Fase 3, riga 26)
  status          text not null default 'bot'
                  check (status in ('bot', 'human', 'closed')),
  last_message_at timestamptz,
  created_at      timestamptz not null default now(),
  unique (channel_id, customer_wa)
);

create index wa_conversations_recent_idx
  on public.wa_conversations (user_id, last_message_at desc);

create table public.wa_messages (
  id              uuid primary key default gen_random_uuid(),
  user_id         text not null,
  conversation_id uuid not null references public.wa_conversations on delete cascade,
  direction       text not null check (direction in ('in', 'out')),
  -- L'identificativo che assegna Meta. Vedi l'indice qui sotto: è la riga più
  -- importante di tutta la tabella.
  wa_message_id   text,
  body            text,
  media_kind      text check (media_kind in ('image', 'audio', 'document', 'video')),
  media_url       text,
  -- Chi ha risposto davvero: alimenta il Contatore Risparmio con dati veri
  -- invece che con una stima dichiarata.
  answered_by     text check (answered_by in ('agent', 'human')),
  model_slug      text,
  tokens_in       integer not null default 0,
  tokens_out      integer not null default 0,
  cost_eur        numeric(10, 6) not null default 0,
  status          text not null default 'received'
                  check (status in ('received', 'queued', 'sent', 'delivered', 'read', 'failed')),
  error           text,
  created_at      timestamptz not null default now()
);

-- ⚠️ QUESTO INDICE EVITA LA FIGURA PEGGIORE DEL PRODOTTO.
-- Meta rimanda lo stesso webhook finché non riceve un 200: se la nostra
-- funzione è lenta o va in errore dopo aver risposto, senza questo vincolo
-- l'agente scrive al cliente due o tre volte lo stesso messaggio. Con questo,
-- il secondo inserimento sbatte contro un conflitto e lo scartiamo.
create unique index wa_messages_external_idx
  on public.wa_messages (wa_message_id) where wa_message_id is not null;

create index wa_messages_conversation_idx
  on public.wa_messages (conversation_id, created_at);


-- ═════════════════════════════════════════════════════════════════════════
-- 4. WEBHOOK GREZZI — quello che ci arriva, prima di interpretarlo
-- ═════════════════════════════════════════════════════════════════════════

-- Si salva il payload così com'è, sempre, anche quando l'elaborazione va male.
-- Serve a due cose: rieseguire a mano un messaggio perso senza chiedere al
-- cliente di riscrivere, e capire perché un'integrazione hardware non funziona
-- senza dover indovinare. Debuggare uno scanner senza i payload è tortura.
--
-- Attenzione alle regole di questa tabella: un webhook arriva PRIMA di sapere
-- di chi è, quindi l'inserimento deve passare sempre. La lettura invece resta
-- limitata alle proprie righe.
create table public.webhook_events (
  id           bigint generated always as identity primary key,
  source       text not null,                 -- 'whatsapp' | 'scanner' | 'stripe'
  external_id  text,
  signature_ok boolean,                       -- la firma del mittente tornava?
  payload      jsonb not null,
  status       text not null default 'pending'
               check (status in ('pending', 'done', 'error', 'ignored')),
  error        text,
  user_id      text,                          -- risolto dopo: all'arrivo può essere null
  received_at  timestamptz not null default now(),
  processed_at timestamptz
);

create index webhook_events_pending_idx
  on public.webhook_events (source, received_at desc) where status = 'pending';
create index webhook_events_payload_idx on public.webhook_events using gin (payload);


-- ═════════════════════════════════════════════════════════════════════════
-- 5. SCAN_EVENTS — il cuore del modulo per l'azienda di trasporti
-- ═════════════════════════════════════════════════════════════════════════

-- Qui atterra ogni lettura. È la tabella che l'azienda sta pagando, ed è anche
-- quella con più volume: `bigint identity` e non uuid, perché un magazzino fa
-- migliaia di letture al giorno e gli uuid casuali frammentano gli indici.
--
-- Le due date separate non sono un vezzo: i lettori portatili lavorano anche
-- senza rete e scaricano in blocco quando rientrano sotto il wifi. `scanned_at`
-- è l'ora del gesto, `received_at` è l'ora in cui l'abbiamo saputo. Se le
-- confondi, i report sui turni di magazzino risultano sbagliati e il cliente
-- se ne accorge subito.
create table public.scan_events (
  id            bigint generated always as identity primary key,
  user_id       text not null,
  ingest_key_id uuid references public.ingest_keys on delete set null,
  device_id     text,                         -- quale lettore
  code          text not null,                -- il codice letto
  code_kind     text,                         -- 'barcode' | 'qr' | 'ddt'
  event_kind    text not null default 'scan'
                check (event_kind in ('scan', 'load', 'unload', 'delivery', 'return')),
  location      text,                         -- 'Magazzino Bologna — baia 3'
  lat           numeric(9, 6),
  lon           numeric(9, 6),
  scanned_at    timestamptz not null,         -- l'ora dello scanner
  received_at   timestamptz not null default now(),
  -- Tutto ciò che il gestionale del cliente manda e che oggi non sappiamo:
  -- numero di spedizione, corriere, peso, destinatario. Sta qui invece di
  -- costringerci a una migrazione ogni volta che aggiungono un campo.
  meta          jsonb not null default '{}'::jsonb,
  -- Se lo scanner rimanda lo stesso blocco (rete instabile), la stessa lettura
  -- non deve contare due volte: il cliente conta i colli con questi numeri.
  dedup_key     text
);

create unique index scan_events_dedup_idx
  on public.scan_events (user_id, dedup_key) where dedup_key is not null;

-- I tre indici che servono all'analista: per periodo, per codice, per lettore.
create index scan_events_time_idx on public.scan_events (user_id, scanned_at desc);
create index scan_events_code_idx on public.scan_events (user_id, code);
create index scan_events_device_idx on public.scan_events (user_id, device_id, scanned_at desc);
create index scan_events_meta_idx on public.scan_events using gin (meta);


-- ═════════════════════════════════════════════════════════════════════════
-- 6. AUDIT LOG — chi ha fatto cosa, senza possibilità di ritocchi
-- ═════════════════════════════════════════════════════════════════════════

create table public.audit_log (
  id          bigint generated always as identity primary key,
  user_id     text,
  actor       text not null default 'user'
              check (actor in ('user', 'system', 'admin')),
  action      text not null,                  -- 'agent.created' | 'module.activated'
  target_kind text,
  target_id   text,
  detail      jsonb not null default '{}'::jsonb,
  ip          inet,
  created_at  timestamptz not null default now()
);

create index audit_log_user_idx on public.audit_log (user_id, created_at desc);
create index audit_log_action_idx on public.audit_log (action, created_at desc);

-- "Immutabile" davvero: le regole per riga non basterebbero, perché tu come
-- proprietario ne sei esente. Un trigger invece vale per tutti, te compreso.
create or replace function public.blocca_modifiche() returns trigger
language plpgsql as $$
begin
  raise exception 'audit_log è immutabile: le righe non si modificano e non si cancellano';
end;
$$;

create trigger audit_log_immutabile
  before update or delete on public.audit_log
  for each row execute function public.blocca_modifiche();

-- Nota per il futuro: il giorno che un utente eserciterà il diritto alla
-- cancellazione (GDPR, Fase 7 riga 78), il trigger si sospende per il tempo
-- della pulizia con `alter table public.audit_log disable trigger
-- audit_log_immutabile;` e si riattiva subito dopo. È scomodo di proposito.


-- ═════════════════════════════════════════════════════════════════════════
-- 7. EVENTS — la tabella dei fatti, quella per l'analista
-- ═════════════════════════════════════════════════════════════════════════

-- Una tabella sola con nome + proprietà in jsonb, invece di una tabella per
-- ogni cosa da misurare. Sul tracciamento del wizard di configurazione questo
-- è meglio, non un compromesso: gli step cambiano ogni settimana mentre
-- sistemi l'onboarding, e con una tabella per step ogni modifica sarebbe una
-- migrazione. Qui aggiungi una proprietà e le query di ieri continuano a
-- funzionare.
--
--   -- quanti si perdono a ogni passo del wizard
--   select props->>'step' as passo, count(distinct user_id) as utenti
--     from public.events
--    where name = 'wizard.step'
--    group by 1 order by 1;
--
-- L'indice gin su `props` rende queste interrogazioni immediate anche con
-- milioni di righe.
create table public.events (
  id         bigint generated always as identity primary key,
  user_id    text,
  name       text not null,                   -- 'wizard.step' | 'agent.created'
  props      jsonb not null default '{}'::jsonb,
  session_id text,
  created_at timestamptz not null default now()
);

create index events_name_time_idx on public.events (name, created_at desc);
create index events_user_time_idx on public.events (user_id, created_at desc);
create index events_props_idx on public.events using gin (props);


-- ═════════════════════════════════════════════════════════════════════════
-- 8. SICUREZZA PER RIGA
-- ═════════════════════════════════════════════════════════════════════════
-- Stessa logica di 0001: l'API dichiara chi sta chiedendo con
-- `set local app.user_id`, e Postgres restituisce solo le righe di quello.
-- Se l'API si dimentica di dichiararlo, non torna niente.

alter table public.modules             enable row level security;
alter table public.module_entitlements enable row level security;
alter table public.ingest_keys         enable row level security;
alter table public.channels            enable row level security;
alter table public.wa_conversations    enable row level security;
alter table public.wa_messages         enable row level security;
alter table public.webhook_events      enable row level security;
alter table public.scan_events         enable row level security;
alter table public.audit_log           enable row level security;
alter table public.events              enable row level security;

-- Il listino lo leggono tutti, lo scrivi solo tu da pgAdmin.
create policy "il listino si legge" on public.modules
  for select using (true);

-- Solo lettura, come spiegato sopra: un diritto non si autoassegna.
create policy "vedo i miei moduli" on public.module_entitlements
  for select using (user_id = current_setting('app.user_id', true));

create policy "solo le mie chiavi" on public.ingest_keys
  for all using (user_id = current_setting('app.user_id', true))
  with check (user_id = current_setting('app.user_id', true));

create policy "solo i miei canali" on public.channels
  for all using (user_id = current_setting('app.user_id', true))
  with check (user_id = current_setting('app.user_id', true));

create policy "solo le mie conversazioni" on public.wa_conversations
  for all using (user_id = current_setting('app.user_id', true))
  with check (user_id = current_setting('app.user_id', true));

create policy "solo i miei messaggi whatsapp" on public.wa_messages
  for all using (user_id = current_setting('app.user_id', true))
  with check (user_id = current_setting('app.user_id', true));

-- Due regole separate: chiunque può registrare un webhook in arrivo (non
-- sappiamo ancora di chi sia), ma rileggerlo può solo il suo proprietario.
create policy "un webhook si registra sempre" on public.webhook_events
  for insert with check (true);
create policy "rileggo i miei webhook" on public.webhook_events
  for select using (user_id = current_setting('app.user_id', true));

create policy "solo le mie letture" on public.scan_events
  for all using (user_id = current_setting('app.user_id', true))
  with check (user_id = current_setting('app.user_id', true));

-- Si scrive e si legge, non si modifica: al resto pensa il trigger.
create policy "il mio registro" on public.audit_log
  for insert with check (true);
create policy "leggo il mio registro" on public.audit_log
  for select using (user_id = current_setting('app.user_id', true));

create policy "i miei eventi" on public.events
  for insert with check (true);
create policy "leggo i miei eventi" on public.events
  for select using (user_id = current_setting('app.user_id', true));


-- ═════════════════════════════════════════════════════════════════════════
-- 9. DUE VISTE PRONTE PER PGADMIN
-- ═════════════════════════════════════════════════════════════════════════
-- ⚠️ `security_invoker = true` non è decorativo. Senza, una vista gira coi
-- permessi di chi l'ha creata (tu, il proprietario) e diventerebbe una porta
-- di servizio che scavalca tutte le regole per riga scritte sopra: un utente
-- interrogherebbe la vista e vedrebbe i dati di tutti.

-- Il Contatore Risparmio con dati veri: quante volte l'agente ha risposto da
-- solo, e quanto tempo è tornato indietro.
create or replace view public.v_risparmio_giornaliero
with (security_invoker = true) as
select
  m.user_id,
  date(m.created_at)                                        as giorno,
  count(*) filter (where m.direction = 'out'
                     and m.answered_by = 'agent')            as risposte_agente,
  count(*) filter (where m.direction = 'out'
                     and m.answered_by = 'human')            as risposte_umane,
  count(distinct m.conversation_id)                          as conversazioni,
  -- 3 minuti per messaggio è la stima dichiarata nell'interfaccia: quando
  -- avrai i dati dei primi clienti veri, si corregge qui e in un punto solo.
  round(count(*) filter (where m.direction = 'out'
                     and m.answered_by = 'agent') * 3.0 / 60, 1) as ore_risparmiate,
  round(sum(m.cost_eur), 4)                                  as costo_ia_eur
from public.wa_messages m
group by m.user_id, date(m.created_at);

-- Le letture degli scanner, giorno per giorno e lettore per lettore. È il
-- primo report che l'azienda di trasporti ti chiederà di far vedere.
create or replace view public.v_scanner_giornaliero
with (security_invoker = true) as
select
  s.user_id,
  date(s.scanned_at)                as giorno,
  s.device_id,
  s.event_kind,
  count(*)                          as letture,
  count(distinct s.code)            as codici_distinti,
  min(s.scanned_at)                 as prima_lettura,
  max(s.scanned_at)                 as ultima_lettura,
  -- Quanto tardi arrivano i dati: se cresce, il lettore lavora offline o la
  -- rete del magazzino ha problemi.
  round(avg(extract(epoch from (s.received_at - s.scanned_at))))::bigint as ritardo_medio_sec
from public.scan_events s
group by s.user_id, date(s.scanned_at), s.device_id, s.event_kind;

-- Se hai già creato il ruolo `nexus_app` (Passo 5 di docs/SETUP-DATABASE.md),
-- gli diamo accesso a quello che è comparso adesso.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'nexus_app') then
    grant select, insert, update, delete on all tables in schema public to nexus_app;
    grant usage, select on all sequences in schema public to nexus_app;
  end if;
end $$;

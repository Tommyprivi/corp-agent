-- CorpAgent — schema iniziale
--
-- Database: PostgreSQL su Neon. Si amministra con pgAdmin, come volevi tu.
-- Istruzioni passo per passo: docs/SETUP-DATABASE.md
--
-- Come si applica: apri pgAdmin → tasto destro sul database → Query Tool →
-- incolla tutto questo file → Execute (F5).
--
-- ─────────────────────────────────────────────────────────────────────────
-- PERCHÉ LE COLONNE user_id SONO `text` E NON `uuid`
-- ─────────────────────────────────────────────────────────────────────────
-- Gli accessi li gestisce Better Auth (Fase 1, riga 2), che crea da sé le sue
-- quattro tabelle: "user", "session", "account", "verification". Better Auth
-- genera gli identificativi come stringhe, non come uuid. Quindi ogni nostra
-- colonna che punta a un utente è `text`.
--
-- I collegamenti veri e propri (le foreign key verso "user") li aggiunge la
-- migrazione 0002, DOPO che Better Auth ha creato le sue tabelle. Così questo
-- file si può eseguire subito, con il solo progetto Neon appena creato e
-- nessun account Google o Apple ancora configurato.

-- Ricerca semantica per la base di conoscenza (il RAG della Fase 2).
create extension if not exists vector;

-- ─────────────────────────────────────────────────────────────────────
-- profiles — chi è l'utente e cosa fa
-- ─────────────────────────────────────────────────────────────────────
-- La riga nasce al primo accesso: la scrive l'API, non un trigger. Un trigger
-- sulle tabelle di Better Auth ci legherebbe le mani se un domani cambiassero.
create table public.profiles (
  id            text primary key,            -- = l'id utente di Better Auth
  email         text,
  trade_id      text,                        -- ristorante | negozio | servizi | studio | altro
  channel       text default 'WhatsApp',
  plan_id       text default 'free',         -- free | starter | business | pro | byok | enterprise
  survey        jsonb default '{}'::jsonb,   -- risposte del sondaggio d'ingresso
  created_at    timestamptz default now()
);

-- ─────────────────────────────────────────────────────────────────────
-- agents — i lavoratori digitali
-- ─────────────────────────────────────────────────────────────────────
create table public.agents (
  id            uuid primary key default gen_random_uuid(),
  user_id       text not null,
  name          text not null,
  role          text not null,
  system_prompt text,                        -- generato dal Master Builder
  model_slug    text default 'auto',         -- 'auto' = scelta per difficoltà
  active        boolean default true,
  is_custom     boolean default false,
  created_at    timestamptz default now()
);

create index agents_user_idx on public.agents (user_id);

-- ─────────────────────────────────────────────────────────────────────
-- projects — le conversazioni separate
-- ─────────────────────────────────────────────────────────────────────
create table public.projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  name        text not null,
  agent_id    uuid references public.agents on delete set null,
  is_setup    boolean default false,         -- il progetto di configurazione non si cancella
  created_at  timestamptz default now()
);

create index projects_user_idx on public.projects (user_id);

-- ─────────────────────────────────────────────────────────────────────
-- messages — ogni riga di conversazione, con quanto è costata
-- ─────────────────────────────────────────────────────────────────────
create table public.messages (
  id            uuid primary key default gen_random_uuid(),
  user_id       text not null,
  project_id    uuid not null references public.projects on delete cascade,
  role          text not null check (role in ('user', 'agent', 'system')),
  content       text not null,
  model_slug    text,
  tokens_in     integer default 0,
  tokens_out    integer default 0,
  cost_eur      numeric(10, 6) default 0,
  -- vero se l'agente ha risposto da solo: alimenta il Contatore Risparmio
  handled_alone boolean default true,
  created_at    timestamptz default now()
);

create index messages_project_idx on public.messages (project_id, created_at);

-- ─────────────────────────────────────────────────────────────────────
-- documents e chunks — la base di conoscenza
-- ─────────────────────────────────────────────────────────────────────
create table public.documents (
  id           uuid primary key default gen_random_uuid(),
  user_id      text not null,
  name         text not null,
  size_bytes   bigint,
  -- Il testo estratto sta nei chunks: il file originale non serve conservarlo
  -- per rispondere. Se un giorno servirà, qui andrà il percorso su R2/S3.
  storage_path text,
  status       text default 'pending' check (status in ('pending', 'indexed', 'error')),
  created_at   timestamptz default now()
);

create index documents_user_idx on public.documents (user_id);

-- Un pezzo di documento con il suo vettore: è quello che permette all'agente di
-- pescare il prezzo giusto invece di inventarlo.
-- 1536 dimensioni = text-embedding-3-small di OpenAI (Fase 2, riga 11).
create table public.chunks (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  document_id uuid not null references public.documents on delete cascade,
  content     text not null,
  page        integer,
  embedding   vector(1536)
);

create index chunks_embedding_idx on public.chunks
  using hnsw (embedding vector_cosine_ops);

-- ─────────────────────────────────────────────────────────────────────
-- structures — le classi configurate parlando (sale, reparti, turni)
-- ─────────────────────────────────────────────────────────────────────
create table public.structures (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  kind        text not null,                 -- 'class' | 'rule'
  name        text not null,
  details     jsonb default '[]'::jsonb,
  created_at  timestamptz default now()
);

create index structures_user_idx on public.structures (user_id);

-- ─────────────────────────────────────────────────────────────────────
-- usage — consumi per il contatore utente e per il pannello admin
-- ─────────────────────────────────────────────────────────────────────
create table public.usage (
  id                uuid primary key default gen_random_uuid(),
  user_id           text not null,
  day               date not null default current_date,
  messages_handled  integer default 0,
  tokens_total      integer default 0,
  cost_eur          numeric(10, 4) default 0,
  unique (user_id, day)
);

-- ─────────────────────────────────────────────────────────────────────────
-- SICUREZZA PER RIGA (Row Level Security)
-- ─────────────────────────────────────────────────────────────────────────
-- È la protezione che fa la differenza tra un prodotto vendibile e un
-- incidente sui dati: senza questa, un errore in una query potrebbe mostrare
-- il listino di un ristorante al concorrente.
--
-- Come funziona qui, in tre righe:
--  1. L'API apre una transazione e dichiara chi sta chiedendo:
--       set local app.user_id = 'id-utente'
--  2. Postgres applica le regole sotto e restituisce SOLO le righe di quello.
--  3. Se l'API si dimentica di dichiararlo, non torna niente. Fallisce chiuso,
--     non aperto: è la parte che conta.
--
-- Tu in pgAdmin continui a vedere tutto: ti colleghi come proprietario del
-- database, e il proprietario è esente da queste regole. Le regole valgono per
-- il ruolo ristretto `nexus_app` che usa l'applicazione (lo crei nel tutorial,
-- docs/SETUP-DATABASE.md, Passo 5).

alter table public.profiles   enable row level security;
alter table public.agents     enable row level security;
alter table public.projects   enable row level security;
alter table public.messages   enable row level security;
alter table public.documents  enable row level security;
alter table public.chunks     enable row level security;
alter table public.structures enable row level security;
alter table public.usage      enable row level security;

create policy "solo il mio profilo" on public.profiles
  for all using (id = current_setting('app.user_id', true))
  with check (id = current_setting('app.user_id', true));

create policy "solo i miei agenti" on public.agents
  for all using (user_id = current_setting('app.user_id', true))
  with check (user_id = current_setting('app.user_id', true));

create policy "solo i miei progetti" on public.projects
  for all using (user_id = current_setting('app.user_id', true))
  with check (user_id = current_setting('app.user_id', true));

create policy "solo i miei messaggi" on public.messages
  for all using (user_id = current_setting('app.user_id', true))
  with check (user_id = current_setting('app.user_id', true));

create policy "solo i miei documenti" on public.documents
  for all using (user_id = current_setting('app.user_id', true))
  with check (user_id = current_setting('app.user_id', true));

create policy "solo i miei pezzi" on public.chunks
  for all using (user_id = current_setting('app.user_id', true))
  with check (user_id = current_setting('app.user_id', true));

create policy "solo la mia configurazione" on public.structures
  for all using (user_id = current_setting('app.user_id', true))
  with check (user_id = current_setting('app.user_id', true));

-- `for all` e non `for select`: è l'API che scrive qui a ogni risposta, sempre
-- nei panni dell'utente. Con il solo `select` il contatore non potrebbe contare.
create policy "solo i miei consumi" on public.usage
  for all using (user_id = current_setting('app.user_id', true))
  with check (user_id = current_setting('app.user_id', true));

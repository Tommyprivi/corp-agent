-- ─────────────────────────────────────────────────────────────────────────
-- FASE 2 — La memoria: da dove arriva un documento, e le domande rimaste
-- ─────────────────────────────────────────────────────────────────────────
--
-- Le tabelle `documents` e `chunks` esistono dalla migrazione 0001, già con
-- `vector(1536)` e l'indice HNSW: chi le ha scritte aveva previsto questa
-- fase. Qui si aggiunge solo ciò che le decisioni di Tommaso del 2 Agosto
-- 2026 richiedono, e che allora non si poteva sapere.
--
-- ── 1. DA DOVE ARRIVA UN DOCUMENTO ──────────────────────────────────────
-- L'obiettivo è "zero documenti": l'utente non deve preparare file. Quindi
-- ci sono quattro strade per la stessa cosa, e vanno distinte perché una
-- cartella di Google Drive si ri-legge da sola, mentre un testo incollato no.
--
-- ── 2. IL PIÙ RECENTE VINCE ─────────────────────────────────────────────
-- Deciso da Tommaso: se il menù nuovo e il listino vecchio dicono prezzi
-- diversi, vale il più recente e il titolare viene avvisato. Serve un
-- `updated_at` vero, perché `created_at` non basta: un documento collegato a
-- Drive viene ri-letto e il suo contenuto cambia senza che la riga rinasca.
--
-- ── 3. LE DOMANDE RIMASTE SENZA RISPOSTA ────────────────────────────────
-- La decisione più importante di questa fase: quando l'informazione non c'è,
-- l'agente NON risponde e avvisa il titolare. Ma un avviso che non viene
-- registrato è un avviso perso: se il cliente scrive alle 23 e il titolare
-- guarda il telefono la mattina dopo, la domanda deve essere ancora lì.
--
-- `events` non basta: è una tabella di statistiche, senza stato. Una domanda
-- aperta ha un ciclo di vita — arriva, il titolare risponde, si chiude — e
-- quello vuole una tabella sua.

-- ── documents: la provenienza e l'aggiornamento ──────────────────────────
alter table public.documents
  add column if not exists source text not null default 'upload'
    check (source in ('upload', 'paste', 'photo', 'drive')),
  -- Per i documenti che vengono da fuori: l'identificativo del file su Drive,
  -- così si riconosce lo stesso file quando cambia e non se ne creano due.
  add column if not exists external_id text,
  add column if not exists updated_at timestamptz not null default now(),
  -- Quanti pezzi ha prodotto: serve a mostrare "indicizzato" con un numero
  -- invece di una spunta che non dice niente.
  add column if not exists chunk_count integer not null default 0,
  -- Perché l'indicizzazione è fallita, in italiano, da mostrare all'utente.
  add column if not exists error text;

comment on column public.documents.source is
  'Come è entrato: upload (file), paste (testo incollato), photo (foto con OCR), drive (cartella collegata).';

comment on column public.documents.updated_at is
  'Ultima volta che il contenuto è stato letto. Decide chi vince quando due documenti si contraddicono: il più recente.';

-- Il più recente prima: è l'ordine in cui si cercano i pezzi quando due
-- documenti dicono cose diverse.
create index if not exists documents_user_updated_idx
  on public.documents (user_id, updated_at desc);

-- Lo stesso file di Drive non deve entrare due volte.
create unique index if not exists documents_external_idx
  on public.documents (user_id, external_id)
  where external_id is not null;

-- ── chunks: da dove viene esattamente questo pezzo ───────────────────────
-- La citazione la vede solo il titolare (deciso il 2 Agosto 2026): il cliente
-- legge una risposta pulita. Ma per mostrarla al titolare serve sapere da che
-- punto del documento arriva il dato, non solo da quale file.
alter table public.chunks
  add column if not exists ordinal integer not null default 0,
  add column if not exists heading text;

comment on column public.chunks.ordinal is
  'Posizione del pezzo dentro il documento: è quello che permette di dire "riga 4" invece del solo nome del file.';

comment on column public.chunks.heading is
  'Il titolo della sezione da cui viene il pezzo, quando si riesce a riconoscerlo (es. "Antipasti", "Listino 2026").';

create index if not exists chunks_document_ordinal_idx
  on public.chunks (document_id, ordinal);

-- ── open_questions: quello che l'agente non ha saputo rispondere ─────────
create table if not exists public.open_questions (
  id           uuid primary key default gen_random_uuid(),
  user_id      text not null,
  -- Da dove è arrivata: la chat di prova, oppure WhatsApp quando ci sarà.
  channel      text not null default 'chat'
               check (channel in ('chat', 'whatsapp', 'web')),
  -- Chi l'ha chiesta, quando si saprà (numero di telefono, nome).
  asked_by     text,
  question     text not null,
  -- Cosa ha risposto l'agente al cliente nel frattempo.
  holding_reply text,
  agent_id     uuid references public.agents on delete set null,
  status       text not null default 'open'
               check (status in ('open', 'answered', 'dismissed')),
  -- La risposta del titolare. Quando arriva, diventa memoria permanente:
  -- la stessa domanda non tornerà mai più senza risposta.
  answer       text,
  answered_at  timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists open_questions_user_idx
  on public.open_questions (user_id, created_at desc);

-- Le aperte per prime, che sono le uniche che chiedono un'azione.
create index if not exists open_questions_open_idx
  on public.open_questions (user_id, created_at desc)
  where status = 'open';

alter table public.open_questions enable row level security;

-- Stessa regola di tutte le altre: ognuno vede solo la sua roba. Il ruolo
-- dell'applicazione gira con app.user_id impostato da withUser().
create policy "solo le mie domande aperte" on public.open_questions
  for all
  using (user_id = current_setting('app.user_id', true))
  with check (user_id = current_setting('app.user_id', true));

-- Come nelle 0002 e 0003: se i ruoli non esistono ancora (Passo 5 di
-- docs/SETUP-DATABASE.md) questo blocco non fa niente e non dà errore.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'nexus_app') then
    grant select, insert, update, delete on public.open_questions to nexus_app;
  end if;
  if exists (select 1 from pg_roles where rolname = 'nexus_analyst') then
    grant select on public.open_questions to nexus_analyst;
  end if;
end $$;

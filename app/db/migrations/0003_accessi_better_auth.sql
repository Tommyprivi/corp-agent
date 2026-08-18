-- CorpAgent — le tabelle degli accessi, e i collegamenti promessi dalla 0001
--
-- La prima parte è generata da Better Auth, non scritta a mano:
--   npx @better-auth/cli@latest generate --config api/_lib/auth.schema.ts
-- Se un giorno Better Auth cambia il suo schema, si rigenera con quel comando e
-- si aggiunge una migrazione nuova. Non si modificano queste righe a mano.
--
-- La seconda parte è nostra: le chiavi esterne verso "user" che la 0001 aveva
-- rimandato, perché allora la tabella "user" non esisteva ancora.


-- ═════════════════════════════════════════════════════════════════════════
-- 1. LE QUATTRO TABELLE DI BETTER AUTH (generate)
-- ═════════════════════════════════════════════════════════════════════════

create table "user" ("id" text not null primary key, "name" text not null, "email" text not null unique, "emailVerified" boolean not null, "image" text, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz default CURRENT_TIMESTAMP not null);

create table "session" ("id" text not null primary key, "expiresAt" timestamptz not null, "token" text not null unique, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz not null, "ipAddress" text, "userAgent" text, "userId" text not null references "user" ("id") on delete cascade);

create table "account" ("id" text not null primary key, "accountId" text not null, "providerId" text not null, "userId" text not null references "user" ("id") on delete cascade, "accessToken" text, "refreshToken" text, "idToken" text, "accessTokenExpiresAt" timestamptz, "refreshTokenExpiresAt" timestamptz, "scope" text, "password" text, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz not null);

create table "verification" ("id" text not null primary key, "identifier" text not null, "value" text not null, "expiresAt" timestamptz not null, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz default CURRENT_TIMESTAMP not null);

create index "session_userId_idx" on "session" ("userId");

create index "account_userId_idx" on "account" ("userId");

create index "verification_identifier_idx" on "verification" ("identifier");


-- ─────────────────────────────────────────────────────────────────────────
-- PERCHÉ QUESTE QUATTRO NON HANNO LA SICUREZZA PER RIGA
-- ─────────────────────────────────────────────────────────────────────────
-- Su tutte le nostre tabelle c'è, e serve. Qui no, e non è una dimenticanza:
-- Better Auth interroga "session" per **scoprire** chi è l'utente, partendo dal
-- cookie. In quel momento `app.user_id` non è ancora stato dichiarato — non si
-- sa ancora chi sia. Con le regole attive quella ricerca non troverebbe nulla e
-- nessuno riuscirebbe più a entrare.
--
-- La protezione qui è diversa: a queste tabelle arriva solo il codice di Better
-- Auth, il token di sessione è un segreto lungo, e il browser non le vede mai.


-- ═════════════════════════════════════════════════════════════════════════
-- 2. I COLLEGAMENTI VERSO "user" (la promessa della 0001)
-- ═════════════════════════════════════════════════════════════════════════
-- A cosa servono: senza, cancellare un utente lascerebbe in giro i suoi agenti,
-- le sue conversazioni e i suoi documenti per sempre — righe orfane che nessuno
-- può più leggere né cancellare. Con `on delete cascade` invece se ne va tutto
-- insieme, che è anche quello che chiede il GDPR quando un cliente esercita il
-- diritto alla cancellazione (Fase 7, riga 78).

alter table public.profiles
  add constraint profiles_user_fk foreign key (id)
  references "user" ("id") on delete cascade;

alter table public.agents
  add constraint agents_user_fk foreign key (user_id)
  references "user" ("id") on delete cascade;

alter table public.projects
  add constraint projects_user_fk foreign key (user_id)
  references "user" ("id") on delete cascade;

alter table public.messages
  add constraint messages_user_fk foreign key (user_id)
  references "user" ("id") on delete cascade;

alter table public.documents
  add constraint documents_user_fk foreign key (user_id)
  references "user" ("id") on delete cascade;

alter table public.chunks
  add constraint chunks_user_fk foreign key (user_id)
  references "user" ("id") on delete cascade;

alter table public.structures
  add constraint structures_user_fk foreign key (user_id)
  references "user" ("id") on delete cascade;

alter table public.usage
  add constraint usage_user_fk foreign key (user_id)
  references "user" ("id") on delete cascade;

alter table public.module_entitlements
  add constraint module_entitlements_user_fk foreign key (user_id)
  references "user" ("id") on delete cascade;

alter table public.ingest_keys
  add constraint ingest_keys_user_fk foreign key (user_id)
  references "user" ("id") on delete cascade;

alter table public.channels
  add constraint channels_user_fk foreign key (user_id)
  references "user" ("id") on delete cascade;

alter table public.wa_conversations
  add constraint wa_conversations_user_fk foreign key (user_id)
  references "user" ("id") on delete cascade;

alter table public.wa_messages
  add constraint wa_messages_user_fk foreign key (user_id)
  references "user" ("id") on delete cascade;

alter table public.scan_events
  add constraint scan_events_user_fk foreign key (user_id)
  references "user" ("id") on delete cascade;

-- `events` porta la telemetria: se un utente se ne va, i suoi eventi vanno con
-- lui. È nullable, quindi restano quelli di sistema senza proprietario.
alter table public.events
  add constraint events_user_fk foreign key (user_id)
  references "user" ("id") on delete cascade;

-- I webhook grezzi si slegano invece di sparire: il payload di una consegna
-- serve a capire cos'è successo anche dopo che l'account non c'è più.
alter table public.webhook_events
  add constraint webhook_events_user_fk foreign key (user_id)
  references "user" ("id") on delete set null;

-- ⚠️ `audit_log` NON prende nessun collegamento, di proposito, per due motivi.
-- Il primo: un registro che si svuota quando cancelli l'utente non è un
-- registro. Il secondo è tecnico e sarebbe una trappola — `on delete set null`
-- farebbe una UPDATE sulle righe del log, e il trigger di immutabilità della
-- 0002 la bloccherebbe: da quel momento nessun utente sarebbe più cancellabile,
-- e il messaggio d'errore non farebbe capire il perché.


-- ═════════════════════════════════════════════════════════════════════════
-- 3. PERMESSI PER IL RUOLO DELL'APPLICAZIONE
-- ═════════════════════════════════════════════════════════════════════════
-- La 0002 li aveva già dati, ma queste quattro tabelle allora non esistevano.
-- Se non hai ancora creato `nexus_app` (Passo 5 di docs/SETUP-DATABASE.md),
-- questo blocco non fa niente e non dà errore.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'nexus_app') then
    grant select, insert, update, delete on all tables in schema public to nexus_app;
    grant usage, select on all sequences in schema public to nexus_app;
  end if;
end $$;

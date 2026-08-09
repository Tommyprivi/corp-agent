-- ═════════════════════════════════════════════════════════════════════════
-- FASE 5 — I connettori sono DI CHI LI COLLEGA
-- ═════════════════════════════════════════════════════════════════════════
--
-- Regola fissata da Tommaso il 9 Agosto 2026:
--
--   «quando colleghi il connettore fai l'accesso con il tuo account e hai le
--    tue cose, ma questo vale per tutto»
--
-- ─────────────────────────────────────────────────────────────────────────
-- ⚠️ COSA CAMBIA, E PERCHÉ È LA COSA GIUSTA
-- ─────────────────────────────────────────────────────────────────────────
-- Le chiavi arrivate finora (Fluida, Google Maps, Microsoft) sono **di
-- Tommaso**. Metterle in `.env.local` e usarle per tutti sarebbe stato veloce
-- e sbagliato in tre modi:
--
--   1. Il ristoratore di Milano vedrebbe i dipendenti di Tommaso. Non è un
--      difetto di comodità: è una fuga di dati.
--   2. Un solo tetto di chiamate per tutti: il decimo cliente rompe il servizio
--      al primo.
--   3. Quando un cliente se ne va, i suoi dati restano nella nostra chiave.
--
-- Da qui in poi ogni utente collega **il suo** account, e quello che vede è
-- **suo**. Le chiavi in `.env.local` restano, ma cambiano mestiere: da
-- «credenziali del servizio» a «credenziali dell'applicazione CorpAgent presso
-- Google/Microsoft» — cioè quello che serve per poter *chiedere il permesso*.
--
-- ⚠️ Vale anche per WhatsApp: `channels` fa già così dal primo giorno (ogni
-- utente il suo numero). Questa tabella estende lo stesso principio a tutto.

create table if not exists public.connections (
  id           uuid primary key default gen_random_uuid(),
  user_id      text not null,

  -- Quale servizio. Si aggiunge una riga all'elenco quando nasce un connettore
  -- nuovo: il vincolo serve a non ritrovarsi 'gmail' e 'Gmail' e 'google-mail'.
  kind         text not null
               check (kind in ('fluida', 'google', 'microsoft', 'maps',
                               'shopify', 'stripe_shop', 'sheets', 'notion',
                               'custom')),

  -- Come si chiama per l'utente: «Gmail di lavoro», «Fluida — Speed Trasporti».
  -- Serve a chi ne collega due dello stesso tipo.
  label        text,

  -- ⚠️ IL SEGRETO È CIFRATO, e non è teatro: qui dentro c'è la chiave con cui
  -- si legge la posta di un'altra persona. Chi apre il database in sola
  -- lettura — un analista, un backup finito nel posto sbagliato — deve vedere
  -- byte senza significato. La chiave per decifrare vive solo tra le variabili
  -- d'ambiente del server (`CONNECTORS_KEY`), mai nel database.
  secret_enc   text,

  -- ⚠️ Il gettone di rinnovo di OAuth, cifrato allo stesso modo. È più
  -- prezioso del gettone d'accesso: quello scade in un'ora, questo apre la
  -- porta per mesi.
  refresh_enc  text,
  expires_at   timestamptz,

  -- Quello che NON è segreto e serve a far funzionare le chiamate o a far
  -- capire all'utente cosa ha collegato: l'id azienda di Fluida, l'email
  -- dell'account Google, gli ambiti concessi.
  meta         jsonb not null default '{}'::jsonb,

  status       text not null default 'connected'
               check (status in ('connected', 'error', 'expired', 'revoked')),
  -- Quando ha risposto l'ultima volta. ⚠️ Un connettore che si rompe in
  -- silenzio è peggio di uno che non c'è: l'agente continua a rispondere come
  -- se sapesse. Questo campo è quello che accende il pallino rosso.
  last_ok_at   timestamptz,
  last_error   text,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- Uno per tipo, per utente. Chi ne vuole due (due caselle Gmail) usa
  -- `label` e va tolto questo vincolo: quel giorno si decide, non prima.
  unique (user_id, kind)
);

create index if not exists connections_user_idx on public.connections (user_id);

alter table public.connections enable row level security;

drop policy if exists "solo le mie connessioni" on public.connections;
create policy "solo le mie connessioni" on public.connections
  for all using (user_id = current_setting('app.user_id', true))
  with check (user_id = current_setting('app.user_id', true));

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'nexus_app') then
    grant select, insert, update, delete on public.connections to nexus_app;
  end if;
  -- ⚠️ L'analista vede CHE COSA è collegato e se funziona, mai le credenziali.
  -- Sono soldi e posta di altre persone: non c'è nessuna analisi che valga
  -- il rischio di averle in una query di comodo.
  if exists (select 1 from pg_roles where rolname = 'nexus_analyst') then
    grant select (id, user_id, kind, label, status, last_ok_at, created_at)
      on public.connections to nexus_analyst;
  end if;
end $$;

comment on table public.connections is
  'I servizi che OGNI UTENTE ha collegato col proprio account (Fase 5). Regola di Tommaso, 9 Agosto 2026: «colleghi con il tuo account e hai le tue cose». I segreti sono cifrati con CONNECTORS_KEY, che vive solo tra le variabili d''ambiente.';

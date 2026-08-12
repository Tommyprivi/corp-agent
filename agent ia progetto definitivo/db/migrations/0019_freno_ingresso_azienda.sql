-- ═════════════════════════════════════════════════════════════════════════
-- Il freno sull'ingresso dell'area aziendale — 12 Agosto 2026
-- ═════════════════════════════════════════════════════════════════════════
--
-- L'ingresso di /speed è una casella email e una password esposte a internet.
-- Senza un freno, una password si può provare **all'infinito**, e la password
-- del titolare adesso protegge dati veri: fatturato in arrivo, clienti,
-- conversazioni.
--
-- ⚠️ Stessa filosofia della migrazione 0017 (il form pubblico): si conserva
-- **l'impronta** della provenienza, mai l'indirizzo IP. Contare senza
-- sorvegliare.
--
-- ⚠️ Si contano solo i TENTATIVI FALLITI. Chi entra con la password giusta non
-- lascia traccia qui e non incontra mai il freno: 150 persone che si collegano
-- alle 6 del mattino dallo stesso ufficio (stessa impronta!) non devono
-- trovarselo davanti. Otto errori in un quarto d'ora dallo stesso posto invece
-- non sono un magazziniere coi guanti: sono un programma.

create table if not exists public.azienda_tentativi (
  id       bigserial primary key,
  azienda  text not null,
  ip_hash  text,
  email    text not null,
  quando   timestamptz not null default now()
);

create index if not exists azienda_tentativi_idx
  on public.azienda_tentativi (ip_hash, quando desc);

alter table public.azienda_tentativi enable row level security;

-- ── È il caso di fermarsi? ──────────────────────────────────────────────
-- Vero = fermati. Otto errori in 15 minuti dalla stessa impronta, oppure
-- cinque sulla stessa email da qualunque posto (contro chi cambia rete).
create or replace function public.az_freno(p_azienda text, p_ip_hash text, p_email text)
returns boolean
language sql security definer set search_path = public as $$
  select
    coalesce((select count(*) >= 8 from public.azienda_tentativi
       where ip_hash is not distinct from p_ip_hash
         and azienda = p_azienda
         and quando > now() - interval '15 minutes'), false)
    or
    coalesce((select count(*) >= 5 from public.azienda_tentativi
       where lower(email) = lower(p_email)
         and azienda = p_azienda
         and quando > now() - interval '15 minutes'), false);
$$;

-- ── Segna un tentativo fallito ──────────────────────────────────────────
-- Di passaggio spazza i tentativi più vecchi di un giorno: la tabella non ha
-- motivo di crescere, e un lavoro programmato in più non serve.
create or replace function public.az_freno_segna(p_azienda text, p_ip_hash text, p_email text)
returns void
language sql security definer set search_path = public as $$
  delete from public.azienda_tentativi where quando < now() - interval '1 day';
  insert into public.azienda_tentativi (azienda, ip_hash, email)
  values (p_azienda, p_ip_hash, left(p_email, 200));
$$;

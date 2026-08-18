-- ═════════════════════════════════════════════════════════════════════════
-- La posta collegata — il primo connettore dell'area azienda — 13 Ago 2026
-- ═════════════════════════════════════════════════════════════════════════
--
-- Scelto da Tommaso: «dobbiamo collegare tutti i connettori per fare gli
-- agenti». Il primo è la casella email: è lì che la multifunzione manda le
-- bolle scannerizzate (scan-to-email), ed è lì che arrivano ordini e richieste.
-- CorpAgent legge la casella via IMAP e porta dentro quello che arriva.
--
-- ⚠️ La password NON sta qui in chiaro: arriva già cifrata (AES-256-GCM con
-- CONNECTORS_KEY, la stessa cifratura dei connettori della piattaforma).
-- Il database vede solo il pacchetto cifrato.
--
-- ⚠️ Come tutte le tabelle dell'area azienda: RLS acceso e NESSUNA policy.
-- Si entra solo dalle porte security definer; il controllo di CHI può è in
-- api/config.ts, non qui.

create table if not exists public.azienda_posta (
  azienda          text primary key,
  host             text not null,
  porta            integer not null default 993,
  utente           text not null,
  segreto_cifrato  text not null,
  cartella         text not null default 'INBOX',
  attivo           boolean not null default true,
  ultimo_controllo timestamptz,
  ultimo_errore    text,
  scaricati        integer not null default 0,
  aggiornato       timestamptz not null default now()
);

alter table public.azienda_posta enable row level security;

-- Quello che è arrivato: una riga per messaggio. `msgid` unico per azienda,
-- così ricontrollare la casella non crea doppioni.
create table if not exists public.azienda_posta_arrivi (
  id        bigserial primary key,
  azienda   text not null,
  msgid     text not null,
  ricevuto  timestamptz,
  mittente  text not null default '',
  oggetto   text not null default '',
  allegati  text[] not null default '{}',
  corpo     text not null default '',
  creato    timestamptz not null default now(),
  unique (azienda, msgid)
);

alter table public.azienda_posta_arrivi enable row level security;

-- ── Le porte ─────────────────────────────────────────────────────────────

-- Salva (o aggiorna) il collegamento. Il segreto arriva GIÀ cifrato.
create or replace function public.az_posta_salva(
  p_azienda text, p_host text, p_porta integer, p_utente text,
  p_segreto text, p_cartella text
) returns void
language sql security definer set search_path = public as $$
  insert into public.azienda_posta (azienda, host, porta, utente, segreto_cifrato, cartella, attivo, aggiornato)
  values (p_azienda, p_host, coalesce(p_porta, 993), p_utente, p_segreto, coalesce(nullif(p_cartella,''), 'INBOX'), true, now())
  on conflict (azienda) do update set
    host = excluded.host, porta = excluded.porta, utente = excluded.utente,
    segreto_cifrato = excluded.segreto_cifrato, cartella = excluded.cartella,
    attivo = true, ultimo_errore = null, aggiornato = now();
$$;

-- Lo stato per l'interfaccia: TUTTO tranne il segreto. Il segreto non esce
-- mai verso il browser, nemmeno cifrato.
create or replace function public.az_posta_stato(p_azienda text)
returns table (host text, porta integer, utente text, cartella text, attivo boolean,
               ultimo_controllo timestamptz, ultimo_errore text, scaricati integer)
language sql security definer set search_path = public as $$
  select p.host, p.porta, p.utente, p.cartella, p.attivo,
         p.ultimo_controllo, p.ultimo_errore, p.scaricati
    from public.azienda_posta p
   where p.azienda = p_azienda;
$$;

-- Le credenziali per il server (solo api/, mai il browser): con il segreto.
create or replace function public.az_posta_credenziali(p_azienda text)
returns table (host text, porta integer, utente text, segreto_cifrato text, cartella text, attivo boolean)
language sql security definer set search_path = public as $$
  select p.host, p.porta, p.utente, p.segreto_cifrato, p.cartella, p.attivo
    from public.azienda_posta p
   where p.azienda = p_azienda;
$$;

-- Le aziende con la posta accesa: il giro serale le controlla una per una.
create or replace function public.az_posta_accese()
returns table (azienda text)
language sql security definer set search_path = public as $$
  select p.azienda from public.azienda_posta p where p.attivo;
$$;

-- Un guasto si segna appena succede (regola dei connettori): una casella rotta
-- in silenzio è peggio di una mai collegata.
create or replace function public.az_posta_esito(p_azienda text, p_errore text, p_nuovi integer)
returns void
language sql security definer set search_path = public as $$
  update public.azienda_posta
     set ultimo_controllo = now(),
         ultimo_errore = p_errore,
         scaricati = scaricati + greatest(coalesce(p_nuovi, 0), 0)
   where azienda = p_azienda;
$$;

-- Stacca la casella: via credenziali e stato, restano gli arrivi già portati dentro.
create or replace function public.az_posta_stacca(p_azienda text)
returns void
language sql security definer set search_path = public as $$
  delete from public.azienda_posta where azienda = p_azienda;
$$;

-- Registra un messaggio arrivato. Ritorna true se è nuovo, false se doppione.
create or replace function public.az_posta_arrivo(
  p_azienda text, p_msgid text, p_ricevuto timestamptz,
  p_mittente text, p_oggetto text, p_allegati text[], p_corpo text
) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  insert into public.azienda_posta_arrivi (azienda, msgid, ricevuto, mittente, oggetto, allegati, corpo)
  values (p_azienda, p_msgid, p_ricevuto, left(coalesce(p_mittente,''), 300),
          left(coalesce(p_oggetto,''), 500), coalesce(p_allegati, '{}'), left(coalesce(p_corpo,''), 4000));
  return true;
exception when unique_violation then
  return false;
end;
$$;

-- Gli ultimi arrivi, per l'interfaccia e per l'agente.
create or replace function public.az_posta_arrivi(p_azienda text, p_limite integer)
returns table (id bigint, ricevuto timestamptz, mittente text, oggetto text, allegati text[], corpo text)
language sql security definer set search_path = public as $$
  select a.id, a.ricevuto, a.mittente, a.oggetto, a.allegati, a.corpo
    from public.azienda_posta_arrivi a
   where a.azienda = p_azienda
   order by coalesce(a.ricevuto, a.creato) desc
   limit least(coalesce(p_limite, 20), 100);
$$;

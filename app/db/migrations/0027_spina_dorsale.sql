-- ═════════════════════════════════════════════════════════════════════════
-- La spina dorsale di un'azienda di trasporti — «rendi il database gigante»
-- Tommaso, 12 Agosto 2026
-- ═════════════════════════════════════════════════════════════════════════
--
-- Fin qui il database teneva quello che le persone registrano a mano (movimenti,
-- ritiri, clienti, documenti). Questa migrazione costruisce il MONDO VERO di
-- un'azienda di trasporti: spedizioni, colli, viaggi, tariffe, zone, fornitori,
-- fatture, autisti, e la zona d'atterraggio delle letture degli scanner.
--
-- ─────────────────────────────────────────────────────────────────────────
-- ⚠️ PERCHÉ TABELLE VUOTE NON SONO UNA BUGIA (E UNO ZERO SÌ)
-- ─────────────────────────────────────────────────────────────────────────
-- Queste tabelle nascono vuote e restano vuote finché non arrivano i
-- connettori (K-Master per le spedizioni, gli scanner per i colli, il
-- gestionale per le fatture). NON è un database finto: è la **presa di
-- corrente** montata prima dell'elettrodomestico. Il giorno del collegamento,
-- i dati di QCSNET entrano QUI dentro senza cambiare una riga di schema — e
-- l'interfaccia, che già dice «in attesa del collegamento», si accende.
--
-- La regola dell'onestà resta intatta: l'app non mostra uno zero al posto di un
-- dato che non ha. Mostra «vuoto, e da dove arriverà». Queste tabelle sono
-- quel «da dove».
--
-- ─────────────────────────────────────────────────────────────────────────
-- LE REGOLE DI COSTRUZIONE, LE STESSE DI SEMPRE
-- ─────────────────────────────────────────────────────────────────────────
-- • ogni tabella porta `azienda text` (multi-tenant), la protezione per riga
--   accesa e nessuna politica: si entra solo dalle porte `security definer`;
-- • il controllo di CHI chiede sta nel codice (api/config.ts), non nel SQL;
-- • niente `pgcrypto`: gli id sono `gen_random_uuid()` (nativo dal 13).

-- ═════════════════════════════════════════════════════════════════════════
-- 1 · ZONE E TARIFFE — quello che serve a fare un preventivo VERO
-- ═════════════════════════════════════════════════════════════════════════

-- Le zone di consegna: un nome, i CAP che copre, il tempo promesso.
create table if not exists public.trasp_zone (
  id         uuid primary key default gen_random_uuid(),
  azienda    text not null,
  nome       text not null,
  cap_da     text not null default '',
  cap_a      text not null default '',
  regione    text not null default '',
  ore_consegna integer,
  note       text not null default '',
  creato     timestamptz not null default now()
);
create index if not exists trasp_zone_idx on public.trasp_zone (azienda, nome);

-- Il listino: per zona e fascia di peso, un prezzo. È la fonte da cui l'agente
-- del traffico può fare un preventivo senza inventare (la regola di ferro).
create table if not exists public.trasp_tariffe (
  id         uuid primary key default gen_random_uuid(),
  azienda    text not null,
  zona_id    uuid references public.trasp_zone(id) on delete cascade,
  descrizione text not null default '',
  peso_min_kg numeric(10,2) not null default 0,
  peso_max_kg numeric(10,2),
  prezzo_eur  numeric(10,2) not null default 0,
  per_collo   boolean not null default false,
  attiva      boolean not null default true,
  creato      timestamptz not null default now()
);
create index if not exists trasp_tariffe_idx on public.trasp_tariffe (azienda, zona_id, peso_min_kg);

-- ═════════════════════════════════════════════════════════════════════════
-- 2 · CLIENTI E FORNITORI — l'anagrafica ricca (accanto ad azienda_clienti)
-- ═════════════════════════════════════════════════════════════════════════
-- ⚠️ `azienda_clienti` resta la scheda leggera che l'agente conosce e che si
-- compila a mano. Questa è l'anagrafica «da gestionale»: P.IVA, sedi, listino
-- collegato. Quando arriva K-Master, i clienti veri entrano qui e le due si
-- allineano sul nome. Non si è cancellato niente: si è aggiunto sotto.

create table if not exists public.trasp_anagrafiche (
  id         uuid primary key default gen_random_uuid(),
  azienda    text not null,
  tipo       text not null default 'cliente' check (tipo in ('cliente','fornitore','vettore')),
  ragione_sociale text not null,
  piva       text not null default '',
  codice_fiscale text not null default '',
  sdi_pec    text not null default '',
  indirizzo  text not null default '',
  cap        text not null default '',
  citta      text not null default '',
  provincia  text not null default '',
  telefono   text not null default '',
  email      text not null default '',
  referente  text not null default '',
  note       text not null default '',
  esterno_id text,             -- l'id nel gestionale del cliente (K-Master)
  creato     timestamptz not null default now(),
  aggiornato timestamptz not null default now()
);
create index if not exists trasp_anagrafiche_idx on public.trasp_anagrafiche (azienda, tipo, lower(ragione_sociale));
create index if not exists trasp_anagrafiche_piva_idx on public.trasp_anagrafiche (azienda, piva);

-- ═════════════════════════════════════════════════════════════════════════
-- 3 · SPEDIZIONI — il cuore: cosa parte, per chi, dov'è
-- ═════════════════════════════════════════════════════════════════════════
create table if not exists public.trasp_spedizioni (
  id           uuid primary key default gen_random_uuid(),
  azienda      text not null,
  numero       text not null default '',        -- il numero bordereaux / DDT
  esterno_id   text,                            -- l'id in K-Master
  mittente_id  uuid references public.trasp_anagrafiche(id) on delete set null,
  destinatario_id uuid references public.trasp_anagrafiche(id) on delete set null,
  mittente     text not null default '',        -- copia testuale, se l'anagrafica non c'è
  destinatario text not null default '',
  zona_id      uuid references public.trasp_zone(id) on delete set null,
  colli        integer not null default 0,
  peso_kg      numeric(10,2),
  volume_m3    numeric(10,3),
  contrassegno_eur numeric(10,2),
  vettore      text not null default '',         -- Palletways, corriere terzo…
  stato        text not null default 'creata'
    check (stato in ('creata','ritirata','in_transito','in_consegna','consegnata','giacenza','annullata')),
  ritiro_previsto  timestamptz,
  consegna_prevista timestamptz,
  consegnata_il    timestamptz,
  note         text not null default '',
  creato       timestamptz not null default now(),
  aggiornato   timestamptz not null default now()
);
create index if not exists trasp_sped_idx on public.trasp_spedizioni (azienda, creato desc);
create index if not exists trasp_sped_stato_idx on public.trasp_spedizioni (azienda, stato);
create index if not exists trasp_sped_numero_idx on public.trasp_spedizioni (azienda, numero);
create index if not exists trasp_sped_esterno_idx on public.trasp_spedizioni (azienda, esterno_id);

-- Gli eventi di tracking di una spedizione: la sua storia, riga per riga.
create table if not exists public.trasp_tracking (
  id            bigserial primary key,
  azienda       text not null,
  spedizione_id uuid not null references public.trasp_spedizioni(id) on delete cascade,
  stato         text not null,
  luogo         text not null default '',
  nota          text not null default '',
  quando        timestamptz not null default now(),
  fonte         text not null default 'manuale'   -- manuale | k-master | scanner
);
create index if not exists trasp_tracking_idx on public.trasp_tracking (azienda, spedizione_id, quando desc);

-- ═════════════════════════════════════════════════════════════════════════
-- 4 · COLLI E LETTURE SCANNER — la zona d'atterraggio dei palmari Zebra
-- ═════════════════════════════════════════════════════════════════════════
create table if not exists public.trasp_colli (
  id            uuid primary key default gen_random_uuid(),
  azienda       text not null,
  spedizione_id uuid references public.trasp_spedizioni(id) on delete cascade,
  barcode       text not null default '',
  peso_kg       numeric(10,2),
  lung_cm       integer, larg_cm integer, alt_cm integer,
  stato         text not null default 'atteso'
    check (stato in ('atteso','caricato','scaricato','consegnato','mancante','danneggiato')),
  creato        timestamptz not null default now()
);
create index if not exists trasp_colli_idx on public.trasp_colli (azienda, spedizione_id);
create index if not exists trasp_colli_barcode_idx on public.trasp_colli (azienda, barcode);

-- ⚠️ LE LETTURE GREZZE degli scanner. Qui entra OGNI sparata del palmare,
-- prima di essere interpretata: barcode, quando, chi, da quale postazione. È il
-- registro immutabile su cui l'IA poi lavora (conteggi, differenze). Deciso
-- così perché una lettura non va mai persa, nemmeno se non sappiamo ancora a
-- quale collo appartiene.
create table if not exists public.trasp_letture (
  id          bigserial primary key,
  azienda     text not null,
  barcode     text not null,
  postazione  text not null default '',
  persona     uuid references public.azienda_persone(id) on delete set null,
  tipo        text not null default 'lettura'   -- carico | scarico | inventario | lettura
    check (tipo in ('carico','scarico','inventario','lettura')),
  dispositivo text not null default '',          -- il seriale del palmare Zebra
  abbinato    boolean not null default false,    -- già collegato a un collo?
  quando      timestamptz not null default now()
);
create index if not exists trasp_letture_idx on public.trasp_letture (azienda, quando desc);
create index if not exists trasp_letture_barcode_idx on public.trasp_letture (azienda, barcode);

-- ═════════════════════════════════════════════════════════════════════════
-- 5 · MEZZI, AUTISTI E VIAGGI — la flotta e i giri
-- ═════════════════════════════════════════════════════════════════════════
-- ⚠️ I mezzi «leggeri» stanno già in azienda_mezzi (li sceglie chi registra un
-- carico). Questa è la scheda piena: revisione, assicurazione, bollo.
create table if not exists public.trasp_mezzi (
  id           uuid primary key default gen_random_uuid(),
  azienda      text not null,
  targa        text not null default '',
  descrizione  text not null default '',
  tipo         text not null default '',          -- furgone, motrice, bilico…
  portata_kg   integer,
  revisione_scad timestamptz,
  assicurazione_scad timestamptz,
  bollo_scad   timestamptz,
  attivo       boolean not null default true,
  creato       timestamptz not null default now()
);
create index if not exists trasp_mezzi_idx on public.trasp_mezzi (azienda, targa);

-- Gli autisti come ENTITÀ (oltre alla persona che accede): patente, scadenze,
-- il collegamento alla postazione se ce l'ha.
create table if not exists public.trasp_autisti (
  id           uuid primary key default gen_random_uuid(),
  azienda      text not null,
  persona      uuid references public.azienda_persone(id) on delete set null,
  nome         text not null,
  telefono     text not null default '',
  patente      text not null default '',
  patente_scad timestamptz,
  cqc_scad     timestamptz,
  attivo       boolean not null default true,
  creato       timestamptz not null default now()
);
create index if not exists trasp_autisti_idx on public.trasp_autisti (azienda, lower(nome));

-- Un viaggio: un autista, un mezzo, un giorno, e le spedizioni che porta.
create table if not exists public.trasp_viaggi (
  id          uuid primary key default gen_random_uuid(),
  azienda     text not null,
  data        date not null,
  autista_id  uuid references public.trasp_autisti(id) on delete set null,
  mezzo_id    uuid references public.trasp_mezzi(id) on delete set null,
  partenza    text not null default '',
  km_previsti integer,
  km_fatti    integer,
  stato       text not null default 'pianificato'
    check (stato in ('pianificato','in_corso','chiuso','annullato')),
  note        text not null default '',
  creato      timestamptz not null default now()
);
create index if not exists trasp_viaggi_idx on public.trasp_viaggi (azienda, data desc);

-- Quali spedizioni stanno su quale viaggio, e in che ordine di consegna.
create table if not exists public.trasp_viaggio_tappe (
  id            bigserial primary key,
  azienda       text not null,
  viaggio_id    uuid not null references public.trasp_viaggi(id) on delete cascade,
  spedizione_id uuid references public.trasp_spedizioni(id) on delete set null,
  ordine        integer not null default 0,
  stato         text not null default 'da_fare'
    check (stato in ('da_fare','consegnata','saltata')),
  esito         text not null default ''
);
create index if not exists trasp_tappe_idx on public.trasp_viaggio_tappe (azienda, viaggio_id, ordine);

-- ═════════════════════════════════════════════════════════════════════════
-- 6 · SOLDI — fatture, righe, scadenzario, incassi (fascia «I soldi»)
-- ═════════════════════════════════════════════════════════════════════════
create table if not exists public.trasp_fatture (
  id           uuid primary key default gen_random_uuid(),
  azienda      text not null,
  numero       text not null default '',
  tipo         text not null default 'attiva' check (tipo in ('attiva','passiva')),
  anagrafica_id uuid references public.trasp_anagrafiche(id) on delete set null,
  controparte  text not null default '',
  data         date,
  scadenza     date,
  imponibile_eur numeric(12,2) not null default 0,
  iva_eur      numeric(12,2) not null default 0,
  totale_eur   numeric(12,2) not null default 0,
  stato        text not null default 'emessa'
    check (stato in ('bozza','emessa','inviata','pagata','scaduta','insoluta','annullata')),
  esterno_id   text,
  creato       timestamptz not null default now()
);
create index if not exists trasp_fatture_idx on public.trasp_fatture (azienda, data desc);
create index if not exists trasp_fatture_stato_idx on public.trasp_fatture (azienda, stato, scadenza);

create table if not exists public.trasp_fattura_righe (
  id          bigserial primary key,
  azienda     text not null,
  fattura_id  uuid not null references public.trasp_fatture(id) on delete cascade,
  descrizione text not null default '',
  quantita    numeric(10,2) not null default 1,
  prezzo_eur  numeric(12,2) not null default 0,
  spedizione_id uuid references public.trasp_spedizioni(id) on delete set null
);
create index if not exists trasp_fatt_righe_idx on public.trasp_fattura_righe (azienda, fattura_id);

create table if not exists public.trasp_incassi (
  id          bigserial primary key,
  azienda     text not null,
  fattura_id  uuid references public.trasp_fatture(id) on delete set null,
  importo_eur numeric(12,2) not null default 0,
  data        date not null default current_date,
  metodo      text not null default '',           -- bonifico, contrassegno, RiBa…
  note        text not null default ''
);
create index if not exists trasp_incassi_idx on public.trasp_incassi (azienda, data desc);

-- ═════════════════════════════════════════════════════════════════════════
-- 7 · TUTTO CHIUSO, SI ENTRA SOLO DALLE PORTE
-- ═════════════════════════════════════════════════════════════════════════
do $$
declare t text;
begin
  foreach t in array array[
    'trasp_zone','trasp_tariffe','trasp_anagrafiche','trasp_spedizioni',
    'trasp_tracking','trasp_colli','trasp_letture','trasp_mezzi','trasp_autisti',
    'trasp_viaggi','trasp_viaggio_tappe','trasp_fatture','trasp_fattura_righe',
    'trasp_incassi'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ═════════════════════════════════════════════════════════════════════════
-- 8 · LE PRIME PORTE — quelle che servono GIÀ
-- ═════════════════════════════════════════════════════════════════════════
-- ⚠️ Non si scrivono tutte le porte di tutte le tabelle oggi: sarebbe codice
-- morto per mesi. Si scrivono quelle che l'app e l'agente usano adesso
-- (tariffe per il preventivo, la lettura scanner in ingresso, il quadro
-- «I soldi»). Le altre nascono il giorno che il connettore le riempie.

-- La lettura scanner in ingresso: è la porta su cui, domani, punteranno i
-- palmari Zebra (via DataWedge) e K-Master. Torna anche l'id del collo se il
-- barcode è già noto, così l'IA sa subito se è una lettura «attesa» o a sorpresa.
create or replace function public.trasp_lettura_ingresso(
  p_azienda text, p_barcode text, p_postazione text, p_persona uuid,
  p_tipo text, p_dispositivo text
) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_id bigint; v_collo uuid;
begin
  select id into v_collo from public.trasp_colli
   where azienda = p_azienda and barcode = p_barcode limit 1;

  insert into public.trasp_letture (azienda, barcode, postazione, persona, tipo, dispositivo, abbinato)
  values (p_azienda, left(p_barcode, 80), left(coalesce(p_postazione,''),40), p_persona,
          case when p_tipo in ('carico','scarico','inventario','lettura') then p_tipo else 'lettura' end,
          left(coalesce(p_dispositivo,''),60), v_collo is not null)
  returning id into v_id;

  -- Se il collo è noto, la lettura ne aggiorna lo stato: caricato/scaricato.
  if v_collo is not null and p_tipo in ('carico','scarico') then
    update public.trasp_colli
       set stato = case when p_tipo = 'carico' then 'caricato' else 'scaricato' end
     where id = v_collo;
  end if;

  return v_id;
end;
$$;

-- Il preventivo dal listino: data una zona (per nome) e un peso, la tariffa.
-- È la fonte «vera» da cui l'agente del traffico può fare un prezzo senza
-- inventare — quando il listino sarà caricato.
create or replace function public.trasp_tariffa(p_azienda text, p_zona text, p_peso numeric)
returns table (zona text, descrizione text, prezzo_eur numeric, per_collo boolean, ore_consegna integer)
language sql security definer set search_path = public as $$
  select z.nome, t.descrizione, t.prezzo_eur, t.per_collo, z.ore_consegna
    from public.trasp_tariffe t
    join public.trasp_zone z on z.id = t.zona_id
   where t.azienda = p_azienda and t.attiva
     and z.nome ilike '%'||p_zona||'%'
     and coalesce(p_peso,0) >= t.peso_min_kg
     and (t.peso_max_kg is null or coalesce(p_peso,0) <= t.peso_max_kg)
   order by t.peso_min_kg desc
   limit 3;
$$;

-- Il quadro «I soldi», contato dalle fatture VERE quando ci saranno. Torna
-- tutto a zero finché le tabelle sono vuote — e l'interfaccia sa già di NON
-- mostrare questi zeri finché il gestionale non è collegato.
create or replace function public.trasp_soldi(p_azienda text)
returns jsonb
language sql security definer set search_path = public as $$
  select jsonb_build_object(
    'ci_sono_dati', exists(select 1 from public.trasp_fatture where azienda = p_azienda),
    'fatturato_mese', coalesce((
      select sum(totale_eur) from public.trasp_fatture
       where azienda = p_azienda and tipo = 'attiva'
         and date_trunc('month', data) = date_trunc('month', current_date)), 0),
    'da_incassare', coalesce((
      select sum(totale_eur) from public.trasp_fatture
       where azienda = p_azienda and tipo = 'attiva' and stato in ('emessa','inviata','scaduta','insoluta')), 0),
    'scadute', coalesce((
      select count(*) from public.trasp_fatture
       where azienda = p_azienda and tipo = 'attiva' and stato = 'scaduta'), 0),
    'fornitori_da_pagare', coalesce((
      select sum(totale_eur) from public.trasp_fatture
       where azienda = p_azienda and tipo = 'passiva' and stato <> 'pagata'), 0)
  );
$$;

-- Il quadro «Il lavoro» dalle spedizioni vere (di nuovo: zero finché vuote).
create or replace function public.trasp_lavoro(p_azienda text)
returns jsonb
language sql security definer set search_path = public as $$
  select jsonb_build_object(
    'ci_sono_dati', exists(select 1 from public.trasp_spedizioni where azienda = p_azienda),
    'in_corso', (select count(*) from public.trasp_spedizioni
                  where azienda = p_azienda and stato in ('ritirata','in_transito','in_consegna')),
    'consegnate_oggi', (select count(*) from public.trasp_spedizioni
                  where azienda = p_azienda and stato = 'consegnata'
                    and (consegnata_il at time zone 'Europe/Rome')::date = (now() at time zone 'Europe/Rome')::date),
    'in_ritardo', (select count(*) from public.trasp_spedizioni
                  where azienda = p_azienda and stato in ('in_transito','in_consegna')
                    and consegna_prevista < now()),
    'in_giacenza', (select count(*) from public.trasp_spedizioni
                  where azienda = p_azienda and stato = 'giacenza')
  );
$$;

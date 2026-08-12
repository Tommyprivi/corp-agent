-- ═════════════════════════════════════════════════════════════════════════
-- Il magazzino: il registro dei movimenti, e la vista del capo — 12 Agosto 2026
-- ═════════════════════════════════════════════════════════════════════════
--
-- Voluto da Tommaso: le postazioni non sono più solo una chat. Il magazzino ha
-- le sue funzioni — carico, scarico, differenza di conteggio, segnala un
-- problema — e ognuna **scrive una riga vera**. Da qui il cruscotto del
-- magazzino conta numeri veri già oggi, senza aspettare gli scanner: quando il
-- connettore arriverà, le sue righe si affiancano a queste, non le sostituiscono.
--
-- ⚠️ IL CAPO VEDE QUANTO USANO, NON COSA SCRIVONO. È una richiesta esplicita di
-- Tommaso, ed è anche l'unica strada legale: l'articolo 4 dello Statuto dei
-- Lavoratori vieta di usare uno strumento di lavoro per controllare il
-- contenuto dell'attività dei dipendenti. Contare le richieste è misurare
-- l'uso di uno strumento; leggere le chat è sorveglianza. La funzione
-- `az_reparto_uso` restituisce **nome, numero, ultimo accesso** — e nessun
-- testo, per costruzione: la colonna del testo non compare proprio nella query.
--
-- Stessa architettura di sempre: RLS accesa, nessuna politica, si entra solo
-- dalle porte `security definer` e il controllo di CHI sta chiedendo vive nel
-- codice che le chiama (api/config.ts), non qui dentro.
-- @see db/migrations/0018_azienda.sql

create table if not exists public.azienda_movimenti (
  id          bigserial primary key,
  azienda     text not null,
  reparto     text not null default 'Magazzino',
  -- carico/scarico portano `colli` (e da chi/per chi, e il mezzo);
  -- differenza porta `atteso` e `contato`; problema porta solo `testo`.
  tipo        text not null check (tipo in ('carico','scarico','differenza','problema')),
  colli       integer,
  atteso      integer,
  contato     integer,
  mezzo       text not null default '',
  controparte text not null default '',
  testo       text not null default '',
  -- Solo i problemi si «chiudono»: un carico è un fatto avvenuto, non una cosa
  -- da risolvere. Per carico/scarico/differenza lo stato resta 'chiuso' e non
  -- significa niente; per il problema 'aperto' vuol dire «aspetta qualcuno».
  stato       text not null default 'chiuso' check (stato in ('aperto','chiuso')),
  persona     uuid references public.azienda_persone(id) on delete set null,
  creato      timestamptz not null default now()
);

create index if not exists azienda_movimenti_idx
  on public.azienda_movimenti (azienda, reparto, creato desc);
create index if not exists azienda_movimenti_aperti_idx
  on public.azienda_movimenti (azienda, stato) where tipo = 'problema';

alter table public.azienda_movimenti enable row level security;

-- ── Registra un movimento ───────────────────────────────────────────────
create or replace function public.az_movimento(
  p_azienda text, p_reparto text, p_tipo text, p_colli integer,
  p_atteso integer, p_contato integer, p_mezzo text, p_controparte text,
  p_testo text, p_persona uuid
) returns bigint
language sql security definer set search_path = public as $$
  insert into public.azienda_movimenti
    (azienda, reparto, tipo, colli, atteso, contato, mezzo, controparte, testo,
     stato, persona)
  values (
    p_azienda, left(p_reparto, 40), p_tipo,
    p_colli, p_atteso, p_contato,
    left(coalesce(p_mezzo, ''), 60), left(coalesce(p_controparte, ''), 120),
    left(coalesce(p_testo, ''), 2000),
    case when p_tipo = 'problema' then 'aperto' else 'chiuso' end,
    p_persona
  )
  returning id;
$$;

-- ── Chiudi un problema (lo fa il capo o il titolare) ────────────────────
create or replace function public.az_movimento_chiudi(p_id bigint, p_azienda text)
returns void
language sql security definer set search_path = public as $$
  update public.azienda_movimenti
     set stato = 'chiuso'
   where id = p_id and azienda = p_azienda and tipo = 'problema';
$$;

-- ── I numeri del magazzino di oggi ──────────────────────────────────────
-- ⚠️ In fuso Europe/Rome come il resto del cruscotto: un «oggi» calcolato in
-- UTC farebbe sparire i movimenti fatti dopo le 22 dalla giornata giusta.
create or replace function public.az_magazzino(p_azienda text)
returns jsonb
language sql security definer set search_path = public as $$
  with oggi as (
    select * from public.azienda_movimenti
     where azienda = p_azienda
       and (creato at time zone 'Europe/Rome')::date
             = (now() at time zone 'Europe/Rome')::date
  )
  select jsonb_build_object(
    'entrati',    coalesce((select sum(colli) from oggi where tipo = 'carico'), 0),
    'usciti',     coalesce((select sum(colli) from oggi where tipo = 'scarico'), 0),
    'differenze', (select count(*) from oggi where tipo = 'differenza'),
    'movimenti',  (select count(*) from oggi where tipo in ('carico','scarico'))
  );
$$;

-- ── I problemi ancora aperti (per il cruscotto e per il capo) ───────────
create or replace function public.az_problemi(p_azienda text, p_reparto text)
returns table (id bigint, reparto text, testo text, chi text, creato timestamptz)
language sql security definer set search_path = public as $$
  select m.id, m.reparto, m.testo, coalesce(p.nome, ''), m.creato
    from public.azienda_movimenti m
    left join public.azienda_persone p on p.id = m.persona
   where m.azienda = p_azienda and m.tipo = 'problema' and m.stato = 'aperto'
     and (p_reparto is null or m.reparto = p_reparto)
   order by m.creato desc
   limit 40;
$$;

-- ── Quanto usano lo strumento, persona per persona ──────────────────────
-- ⚠️ NIENTE TESTO. La query non seleziona `m.testo` e non può selezionarlo: il
-- capo vede quante volte uno ha chiesto qualcosa all'agente e quando è entrato
-- l'ultima volta, mai cosa ha scritto. È la riga che tiene il prodotto dalla
-- parte giusta dell'articolo 4.
create or replace function public.az_reparto_uso(p_azienda text, p_postazione text)
returns table (persona uuid, nome text, foto text, richieste bigint, ultimo timestamptz)
language sql security definer set search_path = public as $$
  select p.id, p.nome, p.foto,
         count(*) filter (where m.ruolo = 'persona'),
         max(m.creato)
    from public.azienda_messaggi m
    join public.azienda_persone p on p.id = m.persona
   where m.azienda = p_azienda and m.postazione = p_postazione
   group by p.id, p.nome, p.foto
   order by count(*) filter (where m.ruolo = 'persona') desc;
$$;

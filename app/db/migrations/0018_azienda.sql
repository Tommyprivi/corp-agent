-- ═════════════════════════════════════════════════════════════════════════
-- L'area di un'azienda cliente — 12 Agosto 2026
-- ═════════════════════════════════════════════════════════════════════════
--
-- Voluta da Tommaso: *«rendiamole già funzionanti le funzioni di Salvatore
-- veramente»*. Fino a ieri `/speed` era il guscio: bella e finta. Da qui in poi
-- l'accesso è vero, la chat scrive davvero, i clienti si salvano, e i numeri
-- del cruscotto sono contati, non scritti a mano.
--
-- ─────────────────────────────────────────────────────────────────────────
-- ⚠️ PERCHÉ QUESTE PERSONE NON SONO UTENTI DI CORPAGENT
-- ─────────────────────────────────────────────────────────────────────────
-- Le 150 persone di Speed Trasporti non hanno un account Google e non pagano
-- un abbonamento: sono **dipendenti di un cliente**, non clienti nostri.
-- Metterle in `public."user"` di Better Auth le farebbe comparire nei nostri
-- conteggi, nella nostra fatturazione e nei nostri limiti di piano. Sono un
-- mondo a parte, con la sua tabella e le sue sessioni.
--
-- Conseguenza diretta: `app.user_id` qui non esiste, quindi **la sicurezza per
-- riga non ha nessuno da riconoscere**. Si entra solo dalle porte strette —
-- funzioni `security definer` — esattamente come per le richieste delle
-- aziende (migrazioni 0015-0017). Le tabelle hanno la protezione accesa e
-- nessuna politica: un `select` diretto torna zero righe, ed è voluto.
--
-- ⚠️ Il controllo di CHI sta chiedendo sta nel codice che chiama queste
-- funzioni, non dentro le funzioni. Chi legge solo il SQL non lo indovinerebbe:
-- sta scritto qui.

-- ─────────────────────────────────────────────────────────────────────────
-- LE PERSONE
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.azienda_persone (
  id           uuid primary key default gen_random_uuid(),
  azienda      text not null,
  email        text not null,
  -- `scrypt$sale$impronta`, calcolata in Node. In chiaro non c'è mai.
  segreto      text not null,
  nome         text not null default '',
  -- ⚠️ DUE RUOLI, E NON È UNA RIDONDANZA.
  -- `ruolo_scelto` è quello che la persona dichiara al primo ingresso.
  -- `ruolo_vero`  è quello che vale davvero, e lo assegna solo il titolare.
  -- Se ce ne fosse uno solo, chiunque fra le 150 persone si dichiarerebbe
  -- titolare e vedrebbe il fatturato. È la falla più facile da fare per
  -- distrazione, ed è chiusa qui invece che nel browser.
  ruolo_scelto text not null default 'operatore',
  ruolo_vero   text not null default 'operatore',
  reparto      text not null default '',
  -- La foto arriva già rimpicciolita a 256px dal browser: sono ~20 KB.
  foto         text,
  attiva       boolean not null default true,
  creata       timestamptz not null default now(),
  ultimo       timestamptz,
  constraint azienda_persone_ruolo_vero_ck
    check (ruolo_vero in ('titolare','amministratore','capo','operatore','osservatore'))
);

create unique index if not exists azienda_persone_email_idx
  on public.azienda_persone (azienda, lower(email));

-- ─────────────────────────────────────────────────────────────────────────
-- LE SESSIONI
-- ─────────────────────────────────────────────────────────────────────────
-- ⚠️ Novanta giorni, non un'ora. Un magazziniere che deve rifare l'accesso ogni
-- mattina coi guanti addosso smette di usare il programma entro la settimana —
-- e un programma che nessuno usa non protegge niente.
create table if not exists public.azienda_sessioni (
  token   text primary key,
  persona uuid not null references public.azienda_persone(id) on delete cascade,
  creata  timestamptz not null default now(),
  scade   timestamptz not null default now() + interval '90 days'
);

create index if not exists azienda_sessioni_persona_idx
  on public.azienda_sessioni (persona);

-- ─────────────────────────────────────────────────────────────────────────
-- I CLIENTI DELL'AZIENDA
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.azienda_clienti (
  id         uuid primary key default gen_random_uuid(),
  azienda    text not null,
  nome       text not null,
  referente  text not null default '',
  telefono   text not null default '',
  email      text not null default '',
  zona       text not null default '',
  note       text not null default '',
  creato_da  uuid references public.azienda_persone(id) on delete set null,
  creato     timestamptz not null default now(),
  aggiornato timestamptz not null default now()
);

create index if not exists azienda_clienti_idx
  on public.azienda_clienti (azienda, lower(nome));

-- ─────────────────────────────────────────────────────────────────────────
-- LA CONVERSAZIONE CON L'AGENTE
-- ─────────────────────────────────────────────────────────────────────────
-- ⚠️ Questa tabella **è** il cruscotto. Ogni numero della fascia «cosa ha fatto
-- l'agente» è un conteggio di righe qui dentro: non c'è nessun contatore
-- separato da tenere allineato, e quindi nessun modo di farlo sballare.
create table if not exists public.azienda_messaggi (
  id         bigserial primary key,
  azienda    text not null,
  persona    uuid references public.azienda_persone(id) on delete set null,
  postazione text not null,
  ruolo      text not null check (ruolo in ('persona','agente')),
  testo      text not null,
  -- Vero quando l'agente ha ammesso di non sapere e ha girato la domanda a un
  -- umano. È la metrica più onesta che abbiamo: dice quanto NON funziona.
  passato    boolean not null default false,
  -- Millisecondi impiegati dal modello. Solo sulle righe dell'agente.
  ms         integer,
  creato     timestamptz not null default now()
);

create index if not exists azienda_messaggi_idx
  on public.azienda_messaggi (azienda, creato desc);
create index if not exists azienda_messaggi_conv_idx
  on public.azienda_messaggi (azienda, persona, postazione, id);

-- ─────────────────────────────────────────────────────────────────────────
-- QUELLO CHE L'AGENTE SA DELL'AZIENDA
-- ─────────────────────────────────────────────────────────────────────────
-- Listini, zone, regole. Niente vettori per ora: sono poche pagine e ci stanno
-- tutte nel contesto del modello. Quando saranno cinquecento si passa al RAG
-- già in casa (`api/_lib/embed.ts`) e questa tabella resta com'è.
create table if not exists public.azienda_documenti (
  id        uuid primary key default gen_random_uuid(),
  azienda   text not null,
  titolo    text not null,
  testo     text not null,
  creato_da uuid references public.azienda_persone(id) on delete set null,
  creato    timestamptz not null default now()
);

create index if not exists azienda_documenti_idx
  on public.azienda_documenti (azienda, creato desc);

-- ── Tutto chiuso, si entra solo dalle porte ────────────────────────────
alter table public.azienda_persone   enable row level security;
alter table public.azienda_sessioni  enable row level security;
alter table public.azienda_clienti   enable row level security;
alter table public.azienda_messaggi  enable row level security;
alter table public.azienda_documenti enable row level security;

-- ═════════════════════════════════════════════════════════════════════════
-- LE PORTE
-- ═════════════════════════════════════════════════════════════════════════

-- ── Chi è questa email? ────────────────────────────────────────────────
create or replace function public.az_persona(p_azienda text, p_email text)
returns table (id uuid, segreto text, nome text, ruolo_scelto text,
               ruolo_vero text, reparto text, foto text, attiva boolean)
language sql security definer set search_path = public as $$
  select p.id, p.segreto, p.nome, p.ruolo_scelto, p.ruolo_vero,
         p.reparto, p.foto, p.attiva
    from public.azienda_persone p
   where p.azienda = p_azienda and lower(p.email) = lower(p_email);
$$;

-- ── Il primo che entra è il titolare ───────────────────────────────────
-- ⚠️ Non è una comodità, è come si consegna il prodotto: Salvatore apre il
-- link, mette la sua email, ed è dentro con tutti i permessi senza che nessuno
-- debba toccare il database. Il secondo che entra è un operatore, e resta tale
-- finché Salvatore non lo promuove dall'elenco delle persone.
create or replace function public.az_crea(
  p_azienda text, p_email text, p_segreto text
) returns table (id uuid, ruolo_vero text)
language plpgsql security definer set search_path = public as $$
declare
  v_primo boolean;
  v_id uuid;
  v_ruolo text;
begin
  select not exists (select 1 from public.azienda_persone where azienda = p_azienda)
    into v_primo;
  v_ruolo := case when v_primo then 'titolare' else 'operatore' end;

  insert into public.azienda_persone (azienda, email, segreto, ruolo_vero, ruolo_scelto)
  values (p_azienda, left(p_email, 200), p_segreto, v_ruolo, v_ruolo)
  returning azienda_persone.id into v_id;

  return query select v_id, v_ruolo;
end;
$$;

-- ── Apri e leggi una sessione ──────────────────────────────────────────
create or replace function public.az_sessione_apri(p_persona uuid, p_token text)
returns void
language sql security definer set search_path = public as $$
  insert into public.azienda_sessioni (token, persona) values (p_token, p_persona);
  update public.azienda_persone set ultimo = now() where id = p_persona;
$$;

create or replace function public.az_sessione(p_token text)
returns table (persona uuid, azienda text, email text, nome text,
               ruolo_scelto text, ruolo_vero text, reparto text,
               foto text, attiva boolean)
language sql security definer set search_path = public as $$
  select p.id, p.azienda, p.email, p.nome, p.ruolo_scelto, p.ruolo_vero,
         p.reparto, p.foto, p.attiva
    from public.azienda_sessioni s
    join public.azienda_persone p on p.id = s.persona
   where s.token = p_token and s.scade > now();
$$;

create or replace function public.az_esci(p_token text)
returns void language sql security definer set search_path = public as $$
  delete from public.azienda_sessioni where token = p_token;
$$;

-- ── Chi sei (si compila una volta sola) ────────────────────────────────
create or replace function public.az_profilo(
  p_persona uuid, p_nome text, p_ruolo text, p_reparto text, p_foto text
) returns void
language sql security definer set search_path = public as $$
  update public.azienda_persone
     set nome = left(p_nome, 80),
         ruolo_scelto = p_ruolo,
         reparto = left(p_reparto, 40),
         foto = p_foto
   where id = p_persona;
$$;

-- ── L'elenco delle persone, e la promozione ────────────────────────────
-- ⚠️ Chi chiama deve aver già verificato che sia il titolare: qui dentro non
-- c'è nessun controllo di identità, perché la funzione non sa chi sta parlando.
create or replace function public.az_persone(p_azienda text)
returns table (id uuid, email text, nome text, ruolo_scelto text,
               ruolo_vero text, reparto text, foto text, attiva boolean,
               creata timestamptz, ultimo timestamptz, messaggi bigint)
language sql security definer set search_path = public as $$
  select p.id, p.email, p.nome, p.ruolo_scelto, p.ruolo_vero, p.reparto,
         p.foto, p.attiva, p.creata, p.ultimo,
         (select count(*) from public.azienda_messaggi m
           where m.persona = p.id and m.ruolo = 'persona')
    from public.azienda_persone p
   where p.azienda = p_azienda
   order by (p.ruolo_vero = 'titolare') desc, p.creata;
$$;

create or replace function public.az_ruolo(
  p_azienda text, p_persona uuid, p_ruolo text, p_attiva boolean
) returns void
language sql security definer set search_path = public as $$
  update public.azienda_persone
     set ruolo_vero = p_ruolo, attiva = p_attiva
   where id = p_persona and azienda = p_azienda;
$$;

-- ── I clienti ──────────────────────────────────────────────────────────
create or replace function public.az_clienti(p_azienda text, p_cerca text)
returns table (id uuid, nome text, referente text, telefono text, email text,
               zona text, note text, creato timestamptz, aggiornato timestamptz)
language sql security definer set search_path = public as $$
  select c.id, c.nome, c.referente, c.telefono, c.email, c.zona, c.note,
         c.creato, c.aggiornato
    from public.azienda_clienti c
   where c.azienda = p_azienda
     and (coalesce(p_cerca,'') = ''
          or c.nome ilike '%'||p_cerca||'%'
          or c.referente ilike '%'||p_cerca||'%'
          or c.zona ilike '%'||p_cerca||'%')
   order by lower(c.nome);
$$;

create or replace function public.az_cliente_salva(
  p_id uuid, p_azienda text, p_nome text, p_referente text, p_telefono text,
  p_email text, p_zona text, p_note text, p_persona uuid
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if p_id is null then
    insert into public.azienda_clienti
      (azienda, nome, referente, telefono, email, zona, note, creato_da)
    values (p_azienda, left(p_nome,120), left(p_referente,80), left(p_telefono,40),
            left(p_email,120), left(p_zona,60), left(p_note,4000), p_persona)
    returning id into v_id;
  else
    update public.azienda_clienti
       set nome = left(p_nome,120), referente = left(p_referente,80),
           telefono = left(p_telefono,40), email = left(p_email,120),
           zona = left(p_zona,60), note = left(p_note,4000), aggiornato = now()
     where id = p_id and azienda = p_azienda
    returning id into v_id;
  end if;
  return v_id;
end;
$$;

create or replace function public.az_cliente_elimina(p_id uuid, p_azienda text)
returns void language sql security definer set search_path = public as $$
  delete from public.azienda_clienti where id = p_id and azienda = p_azienda;
$$;

-- ── I documenti ────────────────────────────────────────────────────────
create or replace function public.az_documenti(p_azienda text)
returns table (id uuid, titolo text, testo text, creato timestamptz)
language sql security definer set search_path = public as $$
  select d.id, d.titolo, d.testo, d.creato
    from public.azienda_documenti d
   where d.azienda = p_azienda
   order by d.creato desc;
$$;

create or replace function public.az_documento_salva(
  p_azienda text, p_titolo text, p_testo text, p_persona uuid
) returns uuid
language sql security definer set search_path = public as $$
  insert into public.azienda_documenti (azienda, titolo, testo, creato_da)
  values (p_azienda, left(p_titolo,120), left(p_testo,40000), p_persona)
  returning id;
$$;

create or replace function public.az_documento_elimina(p_id uuid, p_azienda text)
returns void language sql security definer set search_path = public as $$
  delete from public.azienda_documenti where id = p_id and azienda = p_azienda;
$$;

-- ── La conversazione ───────────────────────────────────────────────────
create or replace function public.az_scrivi(
  p_azienda text, p_persona uuid, p_postazione text, p_ruolo text,
  p_testo text, p_passato boolean, p_ms integer
) returns bigint
language sql security definer set search_path = public as $$
  insert into public.azienda_messaggi
    (azienda, persona, postazione, ruolo, testo, passato, ms)
  values (p_azienda, p_persona, p_postazione, p_ruolo,
          left(p_testo, 8000), coalesce(p_passato,false), p_ms)
  returning id;
$$;

create or replace function public.az_conversazione(
  p_azienda text, p_persona uuid, p_postazione text, p_quanti integer
) returns table (id bigint, ruolo text, testo text, passato boolean, creato timestamptz)
language sql security definer set search_path = public as $$
  select * from (
    select m.id, m.ruolo, m.testo, m.passato, m.creato
      from public.azienda_messaggi m
     where m.azienda = p_azienda and m.persona = p_persona
       and m.postazione = p_postazione
     order by m.id desc
     limit coalesce(p_quanti, 40)
  ) ultimi order by id;
$$;

-- ═════════════════════════════════════════════════════════════════════════
-- IL CRUSCOTTO
-- ═════════════════════════════════════════════════════════════════════════
--
-- ⚠️ Una sola chiamata, e restituisce **solo quello che sappiamo davvero**.
-- Fatturato, spedizioni e magazzino non sono qui dentro e non lo saranno finché
-- non colleghiamo K-Master e il gestionale: uno zero al loro posto sarebbe una
-- bugia involontaria, perché farebbe credere che il dato sia stato letto.
--
-- ⚠️ Le ore sono calcolate in fuso Europe/Rome, non in UTC. Un grafico «per
-- ora» che sposta il picco del mattino alle 6 non è un dettaglio: è il grafico
-- che dice a Salvatore quando gli serve gente in più.
create or replace function public.az_cruscotto(p_azienda text)
returns jsonb
language sql security definer set search_path = public as $$
  with fuso as (select 'Europe/Rome'::text as tz),
  oggi as (
    select m.* from public.azienda_messaggi m, fuso
     where m.azienda = p_azienda
       and (m.creato at time zone fuso.tz)::date = (now() at time zone fuso.tz)::date
  ),
  sett as (
    select m.* from public.azienda_messaggi m, fuso
     where m.azienda = p_azienda
       and (m.creato at time zone fuso.tz)::date
             > (now() at time zone fuso.tz)::date - 7
  )
  select jsonb_build_object(
    'oggi', jsonb_build_object(
      'domande',  (select count(*) from oggi where ruolo = 'persona'),
      'risposte', (select count(*) from oggi where ruolo = 'agente' and not passato),
      'passate',  (select count(*) from oggi where ruolo = 'agente' and passato),
      'attesa',   (select round(avg(ms)) from oggi where ruolo = 'agente' and ms is not null)
    ),
    -- Le 24 ore, sempre tutte e 24 anche quando sono zero: un grafico a barre a
    -- cui mancano le ore vuote mente sulla forma della giornata.
    'ore', (
      select coalesce(jsonb_agg(jsonb_build_object('h', h, 'n', n) order by h), '[]'::jsonb)
        from (
          select g.h,
                 (select count(*) from oggi o, fuso
                   where o.ruolo = 'persona'
                     and extract(hour from (o.creato at time zone fuso.tz)) = g.h) as n
            from generate_series(0,23) as g(h)
        ) x
    ),
    -- Sette giorni pieni, oggi compreso.
    'giorni', (
      select coalesce(jsonb_agg(jsonb_build_object('d', d, 'n', n, 'p', p) order by d), '[]'::jsonb)
        from (
          select g.d::date as d,
                 (select count(*) from sett s, fuso
                   where s.ruolo = 'persona'
                     and (s.creato at time zone fuso.tz)::date = g.d::date) as n,
                 (select count(*) from sett s, fuso
                   where s.ruolo = 'agente' and s.passato
                     and (s.creato at time zone fuso.tz)::date = g.d::date) as p
            from generate_series(
              (select (now() at time zone tz)::date - 6 from fuso),
              (select (now() at time zone tz)::date from fuso),
              interval '1 day'
            ) as g(d)
        ) x
    ),
    'per_postazione', (
      select coalesce(jsonb_agg(jsonb_build_object('p', postazione, 'n', n) order by n desc), '[]'::jsonb)
        from (select postazione, count(*) as n from sett
               where ruolo = 'persona' group by postazione) y
    ),
    'totali', jsonb_build_object(
      'risposte', (select count(*) from public.azienda_messaggi
                    where azienda = p_azienda and ruolo = 'agente' and not passato),
      'passate',  (select count(*) from public.azienda_messaggi
                    where azienda = p_azienda and ruolo = 'agente' and passato),
      'persone',  (select count(*) from public.azienda_persone
                    where azienda = p_azienda and attiva),
      'clienti',  (select count(*) from public.azienda_clienti where azienda = p_azienda),
      'documenti',(select count(*) from public.azienda_documenti where azienda = p_azienda)
    ),
    -- ⚠️ Le domande a cui l'agente non ha saputo rispondere, in chiaro. È la
    -- sezione per cui un titolare riapre il programma domani: un cruscotto di
    -- soli numeri si guarda per una settimana, uno che dice «tre cose
    -- aspettano te» si apre tutte le mattine.
    'aspetta', (
      select coalesce(jsonb_agg(x order by x->>'creato' desc), '[]'::jsonb) from (
        select jsonb_build_object(
                 'testo', (select d.testo from public.azienda_messaggi d
                            where d.azienda = m.azienda and d.persona = m.persona
                              and d.postazione = m.postazione
                              and d.ruolo = 'persona' and d.id < m.id
                            order by d.id desc limit 1),
                 'chi', coalesce(p.nome, ''),
                 'postazione', m.postazione,
                 'creato', m.creato
               ) as x
          from public.azienda_messaggi m
          left join public.azienda_persone p on p.id = m.persona
         where m.azienda = p_azienda and m.ruolo = 'agente' and m.passato
         order by m.id desc limit 8
      ) z
    )
  );
$$;

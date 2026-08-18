-- ═════════════════════════════════════════════════════════════════════════
-- I mezzi aziendali, e le cose «da controllare» — 12 Agosto 2026
-- ═════════════════════════════════════════════════════════════════════════
--
-- Due aggiunte al magazzino, decise da Tommaso:
--
-- 1. **I mezzi si scelgono da una lista**, non si scrivono a mano ogni volta.
--    Così un carico si lega al camion, e il camion (un domani) alla posizione
--    di K-Master. Le targhe vere si prendono al sopralluogo; qui c'è la tabella
--    e le porte per riempirla.
--
-- 2. **Una differenza di conteggio non è solo un numero: è una segnalazione.**
--    «La bolla dice 40, ne ho contati 38» è il momento esatto in cui l'azienda
--    perde dei soldi. Quindi una differenza, come un problema, resta APERTA
--    finché il capo non l'ha guardata e chiusa. Prima restava 'chiuso' e non la
--    vedeva nessuno.

-- ── I mezzi ─────────────────────────────────────────────────────────────
create table if not exists public.azienda_mezzi (
  id      uuid primary key default gen_random_uuid(),
  azienda text not null,
  nome    text not null default '',
  targa   text not null default '',
  attivo  boolean not null default true,
  creato  timestamptz not null default now()
);

create index if not exists azienda_mezzi_idx on public.azienda_mezzi (azienda, attivo);
alter table public.azienda_mezzi enable row level security;

create or replace function public.az_mezzi(p_azienda text)
returns table (id uuid, nome text, targa text, attivo boolean)
language sql security definer set search_path = public as $$
  select m.id, m.nome, m.targa, m.attivo
    from public.azienda_mezzi m
   where m.azienda = p_azienda and m.attivo
   order by m.nome, m.targa;
$$;

create or replace function public.az_mezzo_salva(
  p_id uuid, p_azienda text, p_nome text, p_targa text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if p_id is null then
    insert into public.azienda_mezzi (azienda, nome, targa)
    values (p_azienda, left(p_nome, 60), upper(left(p_targa, 12)))
    returning id into v_id;
  else
    update public.azienda_mezzi
       set nome = left(p_nome, 60), targa = upper(left(p_targa, 12))
     where id = p_id and azienda = p_azienda
    returning id into v_id;
  end if;
  return v_id;
end;
$$;

create or replace function public.az_mezzo_elimina(p_id uuid, p_azienda text)
returns void language sql security definer set search_path = public as $$
  -- Non si cancella: si spegne. Un carico vecchio deve poter ancora nominare il
  -- mezzo su cui è andato, anche se quel camion è stato venduto.
  update public.azienda_mezzi set attivo = false where id = p_id and azienda = p_azienda;
$$;

-- ── Una differenza ora resta aperta, come un problema ───────────────────
drop function if exists public.az_movimento(text, text, text, integer, integer, integer, text, text, text, uuid);

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
    -- ⚠️ Problema E differenza restano da controllare finché qualcuno non le
    -- chiude. Carico e scarico sono fatti avvenuti: nascono già chiusi.
    case when p_tipo in ('problema','differenza') then 'aperto' else 'chiuso' end,
    p_persona
  )
  returning id;
$$;

create or replace function public.az_movimento_chiudi(p_id bigint, p_azienda text)
returns void
language sql security definer set search_path = public as $$
  update public.azienda_movimenti
     set stato = 'chiuso'
   where id = p_id and azienda = p_azienda and tipo in ('problema','differenza');
$$;

-- ── Le cose da controllare: problemi + differenze ancora aperti ─────────
-- Sostituisce az_problemi. Un nome più onesto: non sono solo «problemi», sono
-- tutto ciò che aspetta l'occhio di una persona.
create or replace function public.az_da_controllare(p_azienda text, p_reparto text)
returns table (id bigint, reparto text, tipo text, testo text, atteso integer,
               contato integer, chi text, creato timestamptz)
language sql security definer set search_path = public as $$
  select m.id, m.reparto, m.tipo, m.testo, m.atteso, m.contato,
         coalesce(p.nome, ''), m.creato
    from public.azienda_movimenti m
    left join public.azienda_persone p on p.id = m.persona
   where m.azienda = p_azienda
     and m.tipo in ('problema','differenza') and m.stato = 'aperto'
     and (p_reparto is null or m.reparto = p_reparto)
   order by m.creato desc
   limit 50;
$$;

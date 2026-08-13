-- ═════════════════════════════════════════════════════════════════════════
-- Il report serale — l'agente di direzione fa il punto da solo — 12 Ago 2026
-- ═════════════════════════════════════════════════════════════════════════
--
-- Scelto da Tommaso come prima automazione proattiva: ogni sera l'agente
-- riassume la giornata e il titolare lo trova pronto sul cruscotto, senza
-- premere niente. È l'«Agent Pulse» del documento, nella versione che funziona
-- oggi (WhatsApp non c'è ancora): invece di spingerlo su un canale, lo si
-- lascia pronto dove il titolare guarda.
--
-- ⚠️ Una riga per giorno per azienda: `on conflict` sovrascrive, così se si
-- rigenera (a mano o dal lavoro serale) non si accumulano doppioni.

create table if not exists public.azienda_report (
  azienda text not null,
  giorno  date not null,
  testo   text not null,
  creato  timestamptz not null default now(),
  primary key (azienda, giorno)
);

alter table public.azienda_report enable row level security;

create or replace function public.az_report_salva(p_azienda text, p_giorno date, p_testo text)
returns void
language sql security definer set search_path = public as $$
  insert into public.azienda_report (azienda, giorno, testo, creato)
  values (p_azienda, p_giorno, left(p_testo, 4000), now())
  on conflict (azienda, giorno)
  do update set testo = excluded.testo, creato = now();
$$;

-- L'ultimo report disponibile: quello di oggi se c'è, altrimenti il più recente.
create or replace function public.az_report_ultimo(p_azienda text)
returns table (giorno date, testo text, creato timestamptz)
language sql security definer set search_path = public as $$
  select r.giorno, r.testo, r.creato
    from public.azienda_report r
   where r.azienda = p_azienda
   order by r.giorno desc
   limit 1;
$$;

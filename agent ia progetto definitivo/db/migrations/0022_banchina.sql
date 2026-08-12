-- ═════════════════════════════════════════════════════════════════════════
-- La banchina: i movimenti del giorno, per chi ci lavora — 12 Agosto 2026
-- ═════════════════════════════════════════════════════════════════════════
--
-- Tommaso: *«preferisco un'interfaccia più bella, non solo chat — falla tipo
-- quella del capo»*. La postazione Magazzino diventa un posto di lavoro:
-- numeri del giorno, bottoni grossi, e l'elenco di quello che è passato.
--
-- ⚠️ Questa porta restituisce i MOVIMENTI, non le chat. Il registro dei
-- carichi è un dato operativo condiviso — chi ha scaricato cosa è scritto
-- anche sulla bolla di carta, lo vede tutta la banchina. Le conversazioni con
-- l'agente restano private come prima: qui non ne passa nemmeno una riga.

create or replace function public.az_movimenti_oggi(p_azienda text, p_reparto text)
returns table (id bigint, tipo text, colli integer, atteso integer,
               contato integer, mezzo text, controparte text, testo text,
               stato text, chi text, creato timestamptz)
language sql security definer set search_path = public as $$
  select m.id, m.tipo, m.colli, m.atteso, m.contato, m.mezzo, m.controparte,
         m.testo, m.stato, coalesce(p.nome, ''), m.creato
    from public.azienda_movimenti m
    left join public.azienda_persone p on p.id = m.persona
   where m.azienda = p_azienda
     and (p_reparto is null or m.reparto = p_reparto)
     and (m.creato at time zone 'Europe/Rome')::date
           = (now() at time zone 'Europe/Rome')::date
   order by m.creato desc
   limit 60;
$$;

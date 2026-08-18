-- ═════════════════════════════════════════════════════════════════════════
-- Cercare in TUTTE le mail arrivate, non solo quelle classificate come bolle
-- ═════════════════════════════════════════════════════════════════════════
-- Tommaso, 18 Agosto 2026: «continua a pensare solo alle bolle per le mail».
-- Lo strumento "bolle_arrivate" guarda solo i documenti scannerizzati letti
-- come bolla. Qui si cerca dentro TUTTO quello che è arrivato via posta
-- (mittente, oggetto, corpo) — domande dei clienti, richieste, reclami,
-- qualunque cosa scritta in una mail vera, non solo un allegato.

create or replace function public.az_posta_arrivi_cerca(p_azienda text, p_termine text, p_limite int)
returns table (id bigint, ricevuto timestamptz, mittente text, oggetto text, corpo text)
language sql security definer set search_path = public as $$
  select a.id, a.ricevuto, a.mittente, a.oggetto, a.corpo
    from public.azienda_posta_arrivi a
   where a.azienda = p_azienda
     and (coalesce(p_termine,'') = ''
          or a.mittente ilike '%'||p_termine||'%'
          or a.oggetto ilike '%'||p_termine||'%'
          or a.corpo ilike '%'||p_termine||'%')
   order by a.id desc
   limit p_limite;
$$;

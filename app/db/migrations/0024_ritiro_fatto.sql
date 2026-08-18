-- ═════════════════════════════════════════════════════════════════════════
-- «Ritiro fatto» — la porta per chi lavora, non solo per chi guida
-- ═════════════════════════════════════════════════════════════════════════
--
-- Chiudere un RECLAMO è una decisione del capo (az_movimento_chiudi, gestori).
-- Segnare un RITIRO come fatto è lavoro di chiunque lo faccia: l'operatore del
-- traffico o il magazziniere che riceve la merce. Serve una porta separata che
-- chiuda SOLO i ritiri: se si riusasse quella dei controlli, un operatore
-- potrebbe chiudere un reclamo passando l'id giusto — e i reclami sono del capo.

create or replace function public.az_ritiro_fatto(p_id bigint, p_azienda text)
returns void
language sql security definer set search_path = public as $$
  update public.azienda_movimenti
     set stato = 'chiuso'
   where id = p_id and azienda = p_azienda and tipo = 'ritiro';
$$;

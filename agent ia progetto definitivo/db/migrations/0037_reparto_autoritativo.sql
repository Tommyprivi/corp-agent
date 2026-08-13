-- ═════════════════════════════════════════════════════════════════════════
-- Il reparto lo decide il TITOLARE, non chi lo abita — 13 Agosto 2026
-- ═════════════════════════════════════════════════════════════════════════
--
-- Trovato dalla revisione di sicurezza: il `reparto` di una persona finiva
-- nella stessa colonna che il suo stesso profilo poteva riscrivere. Ma è il
-- reparto che decide COSA VEDE un capo (config.ts, vista "reparto"). Quindi:
-- un capo del Magazzino apriva il profilo, si scriveva reparto = "Amministrazione",
-- e leggeva i controlli e i movimenti dell'Amministrazione. Intra-azienda, ma
-- è un salto di comparto che non deve esistere.
--
-- La regola giusta: il reparto è un'ASSEGNAZIONE, come il ruolo. Lo mette il
-- titolare (all'invito, o cambiando ruolo). Il profilo tocca nome, foto e
-- ruolo DICHIARATO — mai reparto, mai ruolo vero.

-- 1) Il profilo non scrive più il reparto (stessa firma a 5 argomenti, così il
--    codice che chiama non cambia: p_reparto viene semplicemente ignorato).
create or replace function public.az_profilo(
  p_persona uuid, p_nome text, p_ruolo text, p_reparto text, p_foto text
) returns void
language sql security definer set search_path = public as $$
  update public.azienda_persone
     set nome = left(p_nome, 80),
         ruolo_scelto = p_ruolo,
         foto = p_foto
   where id = p_persona;
$$;

-- 2) Il titolare, cambiando ruolo, assegna anche il reparto. Nuovo argomento in
--    coda: se null, il reparto non si tocca (per non azzerarlo quando si cambia
--    solo il ruolo). Vecchia firma a 4 argomenti rimossa prima della nuova.
drop function if exists public.az_ruolo(text, uuid, text, boolean);

create or replace function public.az_ruolo(
  p_azienda text, p_persona uuid, p_ruolo text, p_attiva boolean, p_reparto text default null
) returns void
language sql security definer set search_path = public as $$
  update public.azienda_persone
     set ruolo_vero = p_ruolo,
         attiva = p_attiva,
         reparto = case when p_reparto is null then reparto else left(p_reparto, 40) end
   where id = p_persona and azienda = p_azienda;
$$;

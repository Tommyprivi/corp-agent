-- ═════════════════════════════════════════════════════════════════════════
-- La porta per trovare i doppioni — trovata dal collaudo, 13 Agosto 2026
-- ═════════════════════════════════════════════════════════════════════════
--
-- Bug vero, preso dal vivo: il controllo dei doppioni faceva una SELECT
-- diretta su azienda_posta_allegati. Questa tabella ha RLS acceso e NESSUNA
-- policy (come tutte le tabelle dell'area azienda): una SELECT diretta torna
-- SEMPRE zero righe. Il controllo "vedeva" sempre zero altre bolle, quindi
-- non trovava mai un doppione — anche quando la stessa identica bolla era
-- arrivata tre volte. Serve, come ovunque in questo progetto, una porta
-- security definer.
--
-- Il filtro per numero si fa QUI in SQL (esatto, dopo trim/minuscolo); il
-- confronto "sfumato" sul mittente (nomiSimili) resta nel codice, perché deve
-- tollerare piccole differenze di OCR che l'uguaglianza SQL non gestisce.

create or replace function public.az_posta_bolle_stesso_numero(p_azienda text, p_escludi bigint, p_numero text)
returns table (id bigint, bolla jsonb)
language sql security definer set search_path = public as $$
  select a.id, a.bolla
    from public.azienda_posta_allegati a
   where a.azienda = p_azienda and a.id <> p_escludi and a.stato = 'letto'
     and a.bolla is not null
     and lower(trim(a.bolla->>'numero')) = lower(trim(p_numero))
   order by a.id desc
   limit 50;
$$;

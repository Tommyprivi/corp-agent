-- ═════════════════════════════════════════════════════════════════════════
-- La porta di lettura delle scansioni — 12 Agosto 2026
-- ═════════════════════════════════════════════════════════════════════════
-- ⚠️ trasp_letture ha la sicurezza per riga accesa (0027) senza politiche: una
-- SELECT diretta torna zero righe, ed è voluto. Serve la porta security-definer
-- per farle vedere in banchina. La stessa lezione delle migrazioni 0016/0018.

create or replace function public.az_letture(p_azienda text)
returns table (id bigint, barcode text, tipo text, dispositivo text,
               abbinato boolean, quando timestamptz)
language sql security definer set search_path = public as $$
  select l.id, l.barcode, l.tipo, l.dispositivo, l.abbinato, l.quando
    from public.trasp_letture l
   where l.azienda = p_azienda
   order by l.quando desc
   limit 40;
$$;

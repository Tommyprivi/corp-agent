-- ═════════════════════════════════════════════════════════════════════════
-- Spazio per il testo CIFRATO dei documenti — 13 Agosto 2026
-- ═════════════════════════════════════════════════════════════════════════
--
-- Il testo dei documenti (listini, contratti, regole) ora si salva cifrato
-- (api/_lib/azienda.ts). Il testo cifrato è più lungo dell'originale (~1/3 in
-- più, per via del base64 e dell'intestazione di cifratura): il vecchio taglio
-- a 40.000 caratteri avrebbe spezzato un documento lungo, rendendolo poi
-- indecifrabile. Si alza il tetto a 200.000. La lettura (az_documenti) non
-- tocca il testo. Firma e tipo di ritorno invariati (uuid).

create or replace function public.az_documento_salva(
  p_azienda text, p_titolo text, p_testo text, p_persona uuid
) returns uuid
language sql security definer set search_path = public as $$
  insert into public.azienda_documenti (azienda, titolo, testo, creato_da)
  values (p_azienda, left(p_titolo, 120), left(p_testo, 200000), p_persona)
  returning id;
$$;

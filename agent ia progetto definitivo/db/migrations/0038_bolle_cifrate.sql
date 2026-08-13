-- ═════════════════════════════════════════════════════════════════════════
-- Le bolle cifrate a riposo: la porta non tronca più il testo — 13 Ago 2026
-- ═════════════════════════════════════════════════════════════════════════
--
-- I documenti scannerizzati sono dati sensibili (DDT, a volte fatture di
-- terzi). Ora i loro BYTE e la loro TRASCRIZIONE si salvano CIFRATI a riposo
-- (AES-256-GCM, la stessa cifratura dei connettori, chiave CONNECTORS_KEY che
-- vive solo sul server): chi leggesse il database senza la chiave vede byte
-- illeggibili, non documenti. La cifratura la fa il codice (api/_lib/posta.ts):
-- il database non conosce la chiave, come dev'essere.
--
-- ⚠️ Il testo estratto ora è un PACCHETTO CIFRATO: la porta NON deve più
-- troncarlo con `left(...)`, o lo spezza e diventa indecifrabile. Il taglio
-- per la vista si fa in chiaro, dopo aver decifrato, nel codice.
-- I `bytea` dei documenti restano bytea: ci mettiamo dentro i byte cifrati.

create or replace function public.az_posta_bolle(p_azienda text, p_limite integer)
returns table (id bigint, arrivo bigint, nome text, tipo text, stato text,
               letto text, bolla jsonb, creato timestamptz, kb integer)
language sql security definer set search_path = public as $$
  select a.id, a.arrivo, a.nome, a.tipo, a.stato,
         a.letto, a.bolla, a.creato,
         (octet_length(a.dati) / 1024)::integer
    from public.azienda_posta_allegati a
   where a.azienda = p_azienda
   order by a.id desc
   limit least(coalesce(p_limite, 30), 100);
$$;

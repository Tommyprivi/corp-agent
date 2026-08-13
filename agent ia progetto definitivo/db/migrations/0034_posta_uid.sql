-- ═════════════════════════════════════════════════════════════════════════
-- La posta ricorda DOV'ERA rimasta (UID), non «cosa è da leggere» — 13 Ago 2026
-- ═════════════════════════════════════════════════════════════════════════
--
-- Trovato dalla revisione del connettore: importare i messaggi «non letti»
-- (seen:false) ha un buco operativo serio. La casella dell'ufficio la apre
-- anche una PERSONA: se qualcuno legge una mail in Outlook prima del giro
-- delle 20:00, per IMAP è «letta» e CorpAgent non la importerà MAI — in
-- silenzio. E marcare noi «letto» sporca la casella dell'ufficio.
--
-- La misura giusta è quella dei client veri: l'UID. Ogni messaggio ha un
-- numero crescente; ci si segna l'ultimo processato e si riparte da lì+1,
-- qualunque cosa abbiano fatto le persone con le loro spunte di lettura.
--
-- ⚠️ `uid_validita`: se il server dichiara una UIDVALIDITY diversa, tutti gli
-- UID sono da buttare (lo dice IMAP): si riparte da zero, e i doppioni li
-- ferma comunque il msgid unico.

alter table public.azienda_posta
  add column if not exists ultimo_uid bigint not null default 0,
  add column if not exists uid_validita bigint not null default 0;

-- Il tipo di ritorno cambia: PostgreSQL vuole il drop prima della ricrea.
drop function if exists public.az_posta_credenziali(text);

create or replace function public.az_posta_credenziali(p_azienda text)
returns table (host text, porta integer, utente text, segreto_cifrato text,
               cartella text, attivo boolean, ultimo_uid bigint, uid_validita bigint)
language sql security definer set search_path = public as $$
  select p.host, p.porta, p.utente, p.segreto_cifrato, p.cartella, p.attivo,
         p.ultimo_uid, p.uid_validita
    from public.azienda_posta p
   where p.azienda = p_azienda;
$$;

-- Dove siamo arrivati: si scrive DOPO ogni passata riuscita.
create or replace function public.az_posta_segna_uid(p_azienda text, p_validita bigint, p_uid bigint)
returns void
language sql security definer set search_path = public as $$
  update public.azienda_posta
     set uid_validita = coalesce(p_validita, 0),
         ultimo_uid = greatest(coalesce(p_uid, 0), 0)
   where azienda = p_azienda;
$$;

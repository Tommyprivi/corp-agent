-- ═════════════════════════════════════════════════════════════════════════
-- Outlook con un clic (Microsoft Graph), invece della password per le app
-- ═════════════════════════════════════════════════════════════════════════
-- Chiesto da Tommaso il 18 Agosto 2026: «mettiamo il collegamento più
-- semplice con Outlook». Oggi collegare Outlook per la posta vuole 4 passi
-- (attivare la verifica in due passaggi, generare una password per le app,
-- copiarla, incollarla). Con Microsoft Graph e l'OAuth già registrato per
-- l'altro connettore Microsoft (MS365_CLIENT_ID/SECRET, permesso Mail.Read)
-- basta un clic e un «autorizzo».
--
-- ⚠️ La casella resta IMAP per chiunque non sia su Outlook (Gmail, Aruba,
-- PEC, altra): questa migrazione AGGIUNGE una seconda strada, non toglie
-- la prima.

alter table public.azienda_posta
  add column if not exists metodo text not null default 'imap'
    check (metodo in ('imap', 'oauth')),
  add column if not exists oauth_access_cifrato  text,
  add column if not exists oauth_refresh_cifrato text,
  add column if not exists oauth_scade           timestamptz,
  -- Il segnalibro delle query "delta" di Graph: stesso ruolo dell'UID IMAP,
  -- ma qui lo dà Microsoft come un unico link opaco da richiamare tale e
  -- quale al giro dopo. ⚠️ Come per l'UID: NON si usa "isRead" come
  -- segnalibro — un titolare che legge la bolla in Outlook prima del giro
  -- serale la farebbe sparire per sempre, in silenzio (lo stesso errore
  -- evitato per IMAP, vedi il commento sopra scaricaPosta).
  add column if not exists oauth_delta_link      text;

-- host/utente/segreto_cifrato restano NOT NULL per non rompere l'inserimento
-- IMAP esistente: per l'OAuth si passa una stringa vuota dove non serve
-- (host non esiste, non c'è password) e si usa `utente` per l'indirizzo
-- vero restituito da Microsoft.
create or replace function public.az_posta_salva_oauth(
  p_azienda text, p_utente text, p_access text, p_refresh text, p_scade timestamptz
) returns void
language sql security definer set search_path = public as $$
  insert into public.azienda_posta
    (azienda, host, porta, utente, segreto_cifrato, cartella, attivo, metodo,
     oauth_access_cifrato, oauth_refresh_cifrato, oauth_scade, aggiornato)
  values
    (p_azienda, 'outlook (microsoft graph)', 0, p_utente, '', 'INBOX', true, 'oauth',
     p_access, p_refresh, p_scade, now())
  on conflict (azienda) do update set
    utente = excluded.utente, metodo = 'oauth',
    oauth_access_cifrato = excluded.oauth_access_cifrato,
    oauth_refresh_cifrato = coalesce(excluded.oauth_refresh_cifrato, public.azienda_posta.oauth_refresh_cifrato),
    oauth_scade = excluded.oauth_scade,
    attivo = true, ultimo_errore = null, aggiornato = now();
$$;

-- Il gettone si rinnova ogni ora circa: una porta magra, chiamata spesso.
create or replace function public.az_posta_oauth_aggiorna(
  p_azienda text, p_access text, p_refresh text, p_scade timestamptz
) returns void
language sql security definer set search_path = public as $$
  update public.azienda_posta
     set oauth_access_cifrato = p_access,
         oauth_refresh_cifrato = coalesce(p_refresh, oauth_refresh_cifrato),
         oauth_scade = p_scade
   where azienda = p_azienda;
$$;

-- Il segnalibro delta, salvato a fine passata (anche se la passata si ferma
-- a metà: si riparte da dove si era arrivati, come per l'UID di IMAP).
create or replace function public.az_posta_delta_salva(p_azienda text, p_link text)
returns void
language sql security definer set search_path = public as $$
  update public.azienda_posta set oauth_delta_link = p_link where azienda = p_azienda;
$$;

-- Le credenziali per il server, con anche i campi OAuth: chi legge sceglie
-- il ramo giusto guardando `metodo`, come già fa per gmail/outlook/altra
-- nella scelta del provider IMAP.
-- ⚠️ Deve portare avanti ANCHE `ultimo_uid`/`uid_validita` (migrazione 0034):
-- sono il segnalibro del percorso IMAP, e ridefinire la porta senza quelle
-- due colonne le avrebbe fatte sparire da sotto scaricaPosta().
drop function if exists public.az_posta_credenziali(text);
create function public.az_posta_credenziali(p_azienda text)
returns table (host text, porta integer, utente text, segreto_cifrato text,
               cartella text, attivo boolean, ultimo_uid bigint, uid_validita bigint,
               metodo text, oauth_access_cifrato text, oauth_refresh_cifrato text,
               oauth_scade timestamptz, oauth_delta_link text)
language sql security definer set search_path = public as $$
  select p.host, p.porta, p.utente, p.segreto_cifrato, p.cartella, p.attivo,
         p.ultimo_uid, p.uid_validita, p.metodo,
         p.oauth_access_cifrato, p.oauth_refresh_cifrato, p.oauth_scade, p.oauth_delta_link
    from public.azienda_posta p
   where p.azienda = p_azienda;
$$;

drop function if exists public.az_posta_stato(text);
create function public.az_posta_stato(p_azienda text)
returns table (host text, porta integer, utente text, cartella text, attivo boolean,
               ultimo_controllo timestamptz, ultimo_errore text, scaricati integer, metodo text)
language sql security definer set search_path = public as $$
  select p.host, p.porta, p.utente, p.cartella, p.attivo,
         p.ultimo_controllo, p.ultimo_errore, p.scaricati, p.metodo
    from public.azienda_posta p
   where p.azienda = p_azienda;
$$;

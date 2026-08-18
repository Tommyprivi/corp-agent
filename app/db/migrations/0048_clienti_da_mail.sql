-- ═════════════════════════════════════════════════════════════════════════
-- Clienti trovati da soli, leggendo lo storico delle mail
-- ═════════════════════════════════════════════════════════════════════════
-- Tommaso, 18 Agosto 2026: «si aggiungono clienti automaticamente vedendo
-- tutti i loro dettagli [...] tramite lo storico delle mail». Ogni mail
-- arrivata già passa dalla classificazione dell'agente (elaboraPosta): qui si
-- aggiunge un secondo sguardo, che cerca SOLO fatti scritti alla lettera
-- nella mail (nome, referente, telefono) — mai un dato indovinato.

alter table public.azienda_posta_arrivi
  add column if not exists cliente_estratto boolean not null default false;

create or replace function public.az_posta_arrivi_da_estrarre(p_azienda text, p_limite int)
returns table (id bigint, mittente text, oggetto text, corpo text)
language sql security definer set search_path = public as $$
  select a.id, a.mittente, a.oggetto, a.corpo
    from public.azienda_posta_arrivi a
   where a.azienda = p_azienda and a.cliente_estratto = false
   order by a.id
   limit p_limite;
$$;

create or replace function public.az_posta_arrivo_segna_estratto(p_id bigint)
returns void language sql security definer set search_path = public as $$
  update public.azienda_posta_arrivi set cliente_estratto = true where id = p_id;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Con che nome risponde l'agente
-- ─────────────────────────────────────────────────────────────────────────
-- Tommaso: «potrai configurare a che mail far rispondere l'agente». L'unica
-- casella resta quella collegata (leggere e rispondere da un'altra casella
-- vorrebbe dire un secondo collegamento, non ancora previsto) — quello che
-- diventa configurabile è il NOME con cui il cliente vede arrivare la
-- risposta ("Speed Trasporti" invece del solo indirizzo email nudo).
alter table public.azienda_posta
  add column if not exists nome_mittente text not null default '';

drop function if exists public.az_posta_salva(text,text,integer,text,text,text);
create or replace function public.az_posta_salva(
  p_azienda text, p_host text, p_porta integer, p_utente text,
  p_segreto text, p_cartella text, p_nome_mittente text default ''
) returns void
language sql security definer set search_path = public as $$
  insert into public.azienda_posta (azienda, host, porta, utente, segreto_cifrato, cartella, nome_mittente, attivo, aggiornato)
  values (p_azienda, p_host, coalesce(p_porta, 993), p_utente, p_segreto, coalesce(nullif(p_cartella,''), 'INBOX'), coalesce(p_nome_mittente,''), true, now())
  on conflict (azienda) do update set
    host = excluded.host, porta = excluded.porta, utente = excluded.utente,
    segreto_cifrato = excluded.segreto_cifrato, cartella = excluded.cartella,
    nome_mittente = excluded.nome_mittente,
    attivo = true, ultimo_errore = null, aggiornato = now();
$$;

create or replace function public.az_posta_nome_mittente(p_azienda text, p_nome text)
returns void language sql security definer set search_path = public as $$
  update public.azienda_posta set nome_mittente = coalesce(p_nome,''), aggiornato = now()
   where azienda = p_azienda;
$$;

drop function if exists public.az_posta_stato(text);
create function public.az_posta_stato(p_azienda text)
returns table (host text, porta integer, utente text, cartella text, attivo boolean,
               ultimo_controllo timestamptz, ultimo_errore text, scaricati integer, metodo text,
               nome_mittente text)
language sql security definer set search_path = public as $$
  select p.host, p.porta, p.utente, p.cartella, p.attivo,
         p.ultimo_controllo, p.ultimo_errore, p.scaricati, p.metodo, p.nome_mittente
    from public.azienda_posta p
   where p.azienda = p_azienda;
$$;

-- Deve continuare a portare avanti TUTTE le colonne di prima (0034, 0046):
-- lo stesso errore preso dal vivo il 18 Agosto su questa stessa funzione.
drop function if exists public.az_posta_credenziali(text);
create function public.az_posta_credenziali(p_azienda text)
returns table (host text, porta integer, utente text, segreto_cifrato text,
               cartella text, attivo boolean, ultimo_uid bigint, uid_validita bigint,
               metodo text, oauth_access_cifrato text, oauth_refresh_cifrato text,
               oauth_scade timestamptz, oauth_delta_link text, nome_mittente text)
language sql security definer set search_path = public as $$
  select p.host, p.porta, p.utente, p.segreto_cifrato, p.cartella, p.attivo,
         p.ultimo_uid, p.uid_validita, p.metodo,
         p.oauth_access_cifrato, p.oauth_refresh_cifrato, p.oauth_scade, p.oauth_delta_link,
         p.nome_mittente
    from public.azienda_posta p
   where p.azienda = p_azienda;
$$;

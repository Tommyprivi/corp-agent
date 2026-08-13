-- ═════════════════════════════════════════════════════════════════════════
-- L'ingresso su invito — 13 Agosto 2026
-- ═════════════════════════════════════════════════════════════════════════
--
-- Fin qui chiunque conoscesse il link si apriva una postazione da operatore.
-- Andava bene con un'azienda sola e un link non scritto da nessuna parte;
-- prima delle 150 persone di Speed serve il cancello: entra solo chi è stato
-- invitato dal titolare.
--
-- ⚠️ IL PRIMO CHE ENTRA RESTA IL TITOLARE, senza invito: è come si consegna il
-- prodotto (Salvatore apre il link ed è dentro). Dal secondo in poi, invito
-- obbligatorio. Chi ha già una postazione entra come sempre — l'invito serve
-- solo a CREARNE una nuova.

create table if not exists public.azienda_inviti (
  azienda text not null,
  email   text not null,
  ruolo   text not null default 'operatore',
  reparto text not null default '',
  creato  timestamptz not null default now(),
  usato   timestamptz,
  primary key (azienda, email)
);

alter table public.azienda_inviti enable row level security;

-- ── Il titolare invita (o re-invita: aggiorna ruolo/reparto) ────────────
create or replace function public.az_invita(
  p_azienda text, p_email text, p_ruolo text, p_reparto text
) returns void
language sql security definer set search_path = public as $$
  insert into public.azienda_inviti (azienda, email, ruolo, reparto, creato, usato)
  values (p_azienda, lower(left(p_email, 200)), p_ruolo, left(p_reparto, 40), now(), null)
  on conflict (azienda, email)
  do update set ruolo = excluded.ruolo, reparto = excluded.reparto,
                creato = now(), usato = null;
$$;

-- ── Gli inviti in sospeso, per il titolare ──────────────────────────────
create or replace function public.az_inviti(p_azienda text)
returns table (email text, ruolo text, reparto text, creato timestamptz, usato timestamptz)
language sql security definer set search_path = public as $$
  select email, ruolo, reparto, creato, usato
    from public.azienda_inviti
   where azienda = p_azienda
   order by usato nulls first, creato desc;
$$;

create or replace function public.az_invito_revoca(p_azienda text, p_email text)
returns void
language sql security definer set search_path = public as $$
  delete from public.azienda_inviti where azienda = p_azienda and lower(email) = lower(p_email);
$$;

-- ── Consuma un invito valido: torna il ruolo, e lo marca usato ──────────
-- ⚠️ In una sola istruzione (update ... returning): due persone che entrano
-- con lo stesso invito nello stesso istante non possono usarlo tutte e due.
create or replace function public.az_invito_prendi(p_azienda text, p_email text)
returns text
language sql security definer set search_path = public as $$
  update public.azienda_inviti
     set usato = now()
   where azienda = p_azienda and lower(email) = lower(p_email) and usato is null
  returning ruolo;
$$;

-- ── Quante persone ci sono già (per il bootstrap del primo = titolare) ──
create or replace function public.az_prima_persona(p_azienda text)
returns boolean
language sql security definer set search_path = public as $$
  select not exists (select 1 from public.azienda_persone where azienda = p_azienda);
$$;

-- ── Crea la persona invitata, col ruolo che il titolare le ha dato ──────
-- ⚠️ Diversa da az_crea (che fa il primo = titolare): qui il ruolo lo ha
-- scelto il titolare invitando, quindi lo si assegna davvero (ruolo_vero).
create or replace function public.az_crea_invitato(
  p_azienda text, p_email text, p_segreto text, p_ruolo text, p_reparto text
) returns uuid
language sql security definer set search_path = public as $$
  insert into public.azienda_persone
    (azienda, email, segreto, ruolo_vero, ruolo_scelto, reparto)
  values (p_azienda, left(p_email, 200), p_segreto,
          p_ruolo, p_ruolo, left(coalesce(p_reparto, ''), 40))
  returning id;
$$;

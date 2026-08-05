-- ─────────────────────────────────────────────────────────────────────────
-- FASE 2, RIGA 18 — La Time-Machine della memoria
-- ─────────────────────────────────────────────────────────────────────────
--
-- Dal documento di Tommaso: «permette all'imprenditore di riavvolgere la
-- memoria di un agente a una certa data, utile se per errore sono stati
-- caricati documenti sbagliati nella Knowledge Base».
--
-- ⚠️ LA PARTE CHE CAMBIA TUTTO STA IN QUELLA FRASE: "per errore".
--
-- Chi si accorge di aver caricato il listino sbagliato lo scopre **dopo**, e
-- fino a oggi `DELETE` cancellava davvero — la riga e i suoi pezzi, per sempre.
-- Una time-machine costruita sopra una cancellazione distruttiva non è una
-- time-machine: è un pulsante che non può fare niente.
--
-- Quindi togliere un documento dalla memoria diventa **archiviarlo**: l'agente
-- smette di pescarlo nello stesso istante, ma la riga e i suoi pezzi restano.
-- Ripristinare è togliere una data.
--
-- ─────────────────────────────────────────────────────────────────────────
-- PERCHÉ NON UNA TABELLA DI STORICO
-- ─────────────────────────────────────────────────────────────────────────
-- La strada "seria" sarebbe versionare: ogni modifica crea una revisione, e la
-- memoria a una data si ricostruisce dalle revisioni. Costa una tabella, una
-- migrazione dei dati e una query di ricostruzione per ogni ricerca.
--
-- Ma la domanda vera dell'utente non è «com'era la mia memoria il 14 marzo»:
-- è «togli quella roba che ho caricato per sbaglio ieri». Due date su una riga
-- rispondono a quella domanda, e la ricerca resta una WHERE in più invece di
-- una ricostruzione. Se un giorno servirà il versionamento vero, questo non lo
-- impedisce.

alter table public.documents
  -- Quando è stato archiviato. `null` = attivo, in memoria.
  add column if not exists archived_at timestamptz,
  -- Perché: 'utente' se l'ha tolto lui, 'sostituito' se è arrivata una
  -- versione più recente dello stesso file. Serve a spiegarglielo dopo.
  add column if not exists archived_reason text;

comment on column public.documents.archived_at is
  'Quando il documento è uscito dalla memoria. null = attivo. Archiviare non cancella: la riga e i suoi pezzi restano, e si può ripristinare.';

-- La ricerca guarda solo i documenti attivi, e questo indice è quello che le
-- serve: filtra per utente escludendo gli archiviati, in un colpo.
create index if not exists documents_active_idx
  on public.documents (user_id, updated_at desc)
  where archived_at is null;

-- Per il pannello della time-machine: cosa è stato archiviato, e quando.
create index if not exists documents_archived_idx
  on public.documents (user_id, archived_at desc)
  where archived_at is not null;

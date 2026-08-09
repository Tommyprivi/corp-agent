-- ─────────────────────────────────────────────────────────────────────────
-- FASE 3 — Righe 22-27: fidarsi dell'agente per gradi
-- ─────────────────────────────────────────────────────────────────────────
--
-- Le tre righe che restano hanno tutte la stessa radice: **la paura del
-- titolare**. Un imprenditore non lascia i suoi clienti in mano a un'IA il
-- primo giorno, e ha ragione. Quindi il prodotto non chiede fiducia: la
-- costruisce a scalini.
--
--   Scalino 1 (riga 22, Ghost)     l'agente scrive, tu approvi. Non parte nulla
--                                  senza che tu l'abbia letto.
--   Scalino 2 (riga 23, Watchdog)  l'agente risponde da solo, ma se sta per
--                                  dire una fesseria si ferma e chiama te.
--   Scalino 3                      pilota automatico.
--
-- Dopo una settimana in cui non sbaglia un colpo, si scende di scalino. È il
-- percorso descritto nel documento di Tommaso, e queste colonne lo reggono.

-- ── Riga 22: la modalità Ghost ────────────────────────────────────────────
alter table public.channels
  add column if not exists ghost boolean not null default false;

comment on column public.channels.ghost is
  'Modalita'' Ghost (riga 22): l''agente prepara la risposta ma NON la manda. Resta in attesa della tua approvazione nella posta del sito. Si accende nelle prime settimane e si spegne quando ti fidi.';

-- ── Riga 24: dove avvisare il titolare ────────────────────────────────────
-- ⚠️ Il numero del titolare, non quello dell'attività. È lui che deve ricevere
-- «un cliente aspetta» mentre è in giro — se l'avviso arrivasse sul numero
-- aziendale finirebbe nella stessa casella che stiamo cercando di svuotare.
alter table public.channels
  add column if not exists owner_wa text;

comment on column public.channels.owner_wa is
  'Il numero WhatsApp personale del titolare, in formato internazionale senza +. Ci arrivano gli avvisi (riga 24) e il riepilogo serale (riga 27). Vuoto = niente avvisi.';

-- ── Riga 27: il riepilogo serale, una volta sola ──────────────────────────
-- Un lavoro programmato può essere chiamato due volte: se il giorno è già
-- segnato, il secondo giro non manda niente. Senza questo, il titolare
-- riceverebbe lo stesso riepilogo due volte e smetterebbe di leggerlo.
alter table public.channels
  add column if not exists pulse_on date;

comment on column public.channels.pulse_on is
  'L''ultimo giorno per cui e'' gia'' stato mandato il riepilogo serale. Difesa contro il doppio invio se il lavoro programmato parte due volte.';

-- ── Righe 22, 23 e 25: perché un messaggio è fermo ────────────────────────
-- `wa_messages.status = 'queued'` diceva già "non è partito". Non diceva
-- **perché**, e le tre ragioni vogliono tre comportamenti diversi:
--
--   'ghost'    → aspetta te. Nella posta compare con «Approva e invia».
--   'watchdog' → l'agente stava per dire qualcosa fuori dalle regole.
--                Aspetta te, ma con scritto cosa non andava.
--   'offline'  → la rete o il modello non rispondevano. Non aspetta te:
--                riparte da solo al primo messaggio utile.
alter table public.wa_messages
  add column if not exists hold_reason text
  check (hold_reason in ('ghost', 'watchdog', 'offline'));

comment on column public.wa_messages.hold_reason is
  'Perche'' questo messaggio non e'' partito: ghost = aspetta la tua approvazione, watchdog = stava per violare le regole, offline = la rete non rispondeva e riparte da solo.';

-- Che cosa aveva visto il guardiano. Si mostra al titolare così com'è: dirgli
-- «bloccato» senza dirgli perché è peggio che non bloccare.
alter table public.wa_messages
  add column if not exists hold_note text;

-- La coda si legge spesso e deve essere istantanea: sono i messaggi fermi,
-- quasi sempre pochissimi rispetto al totale.
create index if not exists wa_messages_hold_idx
  on public.wa_messages (user_id, created_at)
  where hold_reason is not null;

-- ── Riga 26: la lingua del cliente ────────────────────────────────────────
-- La colonna `locale` esiste dalla migrazione 0002 e non è mai stata scritta.
-- Da adesso la riempie il classificatore, che già gira a ogni messaggio: la
-- lingua esce dalla stessa chiamata che decide quale modello usare, quindi
-- riconoscerla non costa niente in più.
comment on column public.wa_conversations.locale is
  'La lingua in cui scrive il cliente (it, en, es, de, fr, zh...), riconosciuta dal classificatore. L''agente risponde in quella. Vedi la riga 26 del PERCORSO.';

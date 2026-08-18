-- ─────────────────────────────────────────────────────────────────────────
-- FASE 3 — La posta WhatsApp sul sito
-- ─────────────────────────────────────────────────────────────────────────
--
-- Deciso da Tommaso l'8 Agosto 2026: «nel sito ovviamente devi mettere la
-- possibilità di ricordarsi le chat anche su WhatsApp, deve essere tutto
-- collegato».
--
-- Serviva una cosa sola che il database non aveva: sapere **cosa il titolare
-- ha già letto**. Senza, la casella di posta non può dire «3 nuovi» — e una
-- casella che non distingue il letto dal non letto costringe ad aprire tutto
-- ogni volta, che è esattamente il lavoro che questo prodotto promette di
-- togliere.
--
-- Il resto c'era già:
--   · `wa_conversations.status` ('bot' | 'human' | 'closed') è il passaggio di
--     mano per singolo cliente. Prima lo leggeva solo il canale intero: ora
--     conta per conversazione, che è come ragiona chi risponde davvero — si
--     prende in mano UN cliente, non si spegne il numero.
--   · `wa_messages.answered_by` ('agent' | 'human') distingue chi ha risposto,
--     ed è quello che il Contatore Risparmio conta a fine mese.

alter table public.wa_conversations
  add column if not exists read_at timestamptz;

comment on column public.wa_conversations.read_at is
  'Quando il titolare ha aperto questa conversazione sul sito. Se e'' null, o se e'' precedente a last_message_at, la conversazione conta come non letta.';

-- La casella si apre ordinata per "chi ha scritto per ultimo", e il non letto
-- va in cima: senza questo indice ogni apertura sarebbe una scansione.
create index if not exists wa_conversations_unread_idx
  on public.wa_conversations (user_id, last_message_at desc)
  where read_at is null;

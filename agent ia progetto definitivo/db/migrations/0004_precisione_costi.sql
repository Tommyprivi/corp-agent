-- ─────────────────────────────────────────────────────────────────────────
-- Precisione dei costi nel contatore consumi giornaliero
-- ─────────────────────────────────────────────────────────────────────────
--
-- Trovato il 2 Agosto 2026, alla prima esecuzione vera della chat (riga 6
-- della Fase 1). Una domanda breve è costata 0,000019 € — salvata bene in
-- `messages.cost_eur`, che è numeric(10,6) — ma il contatore giornaliero
-- `usage.cost_eur` era numeric(10,4), quindi l'ha registrata come 0,0000.
--
-- Non è un problema di visualizzazione: l'arrotondamento avviene al momento
-- dell'insert, quindi il dato è perso per sempre. Con il modello leggero
-- (0,10 $ / milione di token in ingresso) quasi ogni messaggio normale sta
-- sotto la soglia di 0,00005 €, cioè il totale giornaliero di un utente
-- resterebbe a zero anche dopo mille conversazioni.
--
-- Cosa si romperebbe più avanti:
--   · gli avvisi di budget quando i token stanno finendo (Fase 4, riga 33)
--   · il costo vivo delle API e il margine per utente (Fase 5, riga 41)
--
-- Sei decimali sono gli stessi che usa già `messages.cost_eur`: le due
-- tabelle ora tornano, e la somma dei messaggi combacia con il contatore.
-- Dodici cifre totali invece di dieci lasciano spazio a un utente che spenda
-- fino a un milione di euro in un giorno, che è un problema che vorremmo avere.

alter table public.usage
  alter column cost_eur type numeric(12, 6);

comment on column public.usage.cost_eur is
  'Costo in euro delle risposte di questo giorno. Sei decimali: una singola '
  'risposta breve costa circa 0,00002 €, con meno decimali si conterebbe zero.';

-- ═════════════════════════════════════════════════════════════════════════
-- I gettoni di sessione diventano IMPRONTE, non chiavi in chiaro — 13 Ago 2026
-- ═════════════════════════════════════════════════════════════════════════
--
-- Trovato guardando la sicurezza dell'ingresso: `azienda_sessioni.token`
-- conteneva il gettone IN CHIARO. Un gettone vale 90 giorni ed è la chiave
-- che tiene dentro una persona: un dump del database (backup rubato, accesso
-- errato) sarebbe stato un mazzo di chiavi pronte all'uso per 150 persone.
--
-- Ora nel database vive solo l'IMPRONTA (SHA-256) del gettone. Il gettone
-- vero lo tiene solo il browser; a ogni richiesta il server ne calcola
-- l'impronta e cerca QUELLA. Da un'impronta non si torna al gettone — come
-- per una password, che infatti non si salva mai in chiaro. Il codice che
-- calcola l'impronta sta in api/_lib/azienda.ts (improntaGettone).
--
-- ⚠️ NON disconnette nessuno: si convertono le righe esistenti sul posto.
-- Il browser ha ancora il gettone vero; il server calcolerà la stessa
-- impronta e ritroverà la riga convertita.
--
-- ⚠️ IDEMPOTENTE (serve: due sessioni Claude lavorano sullo stesso database):
-- un'impronta è ESATTAMENTE 64 caratteri esadecimali minuscoli; un gettone
-- vero è 43 caratteri base64url. Si convertono solo le righe che NON sono
-- già un'impronta, così rieseguire la migrazione non ri-cifra due volte.

create extension if not exists pgcrypto;

update public.azienda_sessioni
   set token = encode(digest(token, 'sha256'), 'hex')
 where token !~ '^[0-9a-f]{64}$';

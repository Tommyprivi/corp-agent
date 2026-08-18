# Tutorial: il database su Neon, gestito con pgAdmin

Tempo richiesto: **20 minuti.** È la **riga 1 della Fase 1**: senza questa non si va avanti.

> Decisione di Tommaso del 1 Agosto 2026: **Neon**, non Supabase. Un PostgreSQL puro in
> cloud, amministrato con pgAdmin, come nel documento originale.

## Cosa copre Neon e cosa dobbiamo mettere noi

Neon è **solo il database** — ottimo, vero Postgres, con `pgvector` per la ricerca
semantica e `pg_dump` per portarti via i dati quando vuoi. Ma le altre tre cose che
servono a un SaaS le costruiamo noi:

| Ci serve | Chi lo fa |
|---|---|
| PostgreSQL + pgvector + backup | **Neon** |
| Login con Google e Apple | **Better Auth**, dentro Neon → [SETUP-ACCESSI.md](SETUP-ACCESSI.md) |
| Il posto sicuro dove vivono le chiavi | **funzioni su Vercel**, cartella `api/` |
| Storage dei PDF caricati | per ora **non serve**: dei documenti conserviamo il testo estratto e i vettori, che è quello che serve per rispondere |

---

## Passo 1 — Crea il progetto su Neon

1. Vai su **[neon.com](https://neon.com)** → **Sign up**
2. Accedi con GitHub (lo stesso account dove sta il repo)
3. **Create project**
   - **Name:** `corpagent`
   - **Postgres version:** l'ultima proposta
   - **Region:** **Europe (Frankfurt)** o **Europe (Ireland)**. Scegli l'Europa: è più
     vicina ai tuoi clienti italiani (risposte più rapide) e tiene i dati sotto GDPR.
4. **Create project**

Finito, il database è già in piedi. Neon ti mostra subito la **connection string**.

---

## Passo 2 — Copia la stringa di connessione

Nel pannello del progetto premi **Connect**. Ti dà una riga di questa forma:

```
postgresql://corpagent_owner:LAPASSWORD@ep-qualcosa-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require
```

⚠️ **Prendi quella con `-pooler` dentro l'indirizzo.** È quella che regge tante
connessioni brevi: è esattamente come lavorano le funzioni su Vercel.

Questa riga è una password: **non incollarla in una chat, in un messaggio o nel codice.**
Va in due soli posti:

1. Nel file `.env.local` del progetto, sulla riga `DATABASE_URL=` (copia `.env.example`
   per avere il modello). Quel file non finisce su GitHub.
2. Più avanti, nel pannello di Vercel → *Settings* → *Environment Variables*.

---

## Passo 3 — Collega pgAdmin

Dalla stringa del Passo 2 ricavi i pezzi da mettere in pgAdmin:

```
postgresql:// UTENTE : PASSWORD @ HOST / DATABASE ?sslmode=require
```

1. Apri pgAdmin
2. Tasto destro su **Servers** → **Register** → **Server...**
3. Scheda **General**
   - **Name:** `CorpAgent (Neon)`
4. Scheda **Connection**
   - **Host name/address:** la parte `ep-...neon.tech`
   - **Port:** `5432`
   - **Maintenance database:** `neondb`
   - **Username:** la parte prima dei due punti (tipo `corpagent_owner`)
   - **Password:** la parte tra `:` e `@`
   - Spunta **Save password**
5. Scheda **Parameters**
   - Aggiungi **SSL mode** = `require`
   - Neon rifiuta le connessioni non cifrate: senza questo dà errore
6. **Save**

Nell'albero a sinistra si apre il server, e sotto
`Databases → neondb → Schemas → public` vedi le tabelle. Adesso è vuoto: le creiamo ora.

---

## Passo 4 — Crea le tabelle

1. In pgAdmin, tasto destro sul database `neondb` → **Query Tool**
2. Apri il file `db/migrations/0001_init.sql` del progetto, copia **tutto**
3. Incollalo nella finestra e premi **Execute** (F5)

Dovresti leggere `Query returned successfully`. Aggiorna la vista (tasto destro su
**Tables** → *Refresh*) e vedrai comparire:

| Tabella | Cosa contiene |
|---|---|
| `profiles` | chi è l'utente, che mestiere fa, che piano ha |
| `agents` | gli agenti creati, con il loro prompt e il modello |
| `projects` | i progetti (le conversazioni separate) |
| `messages` | ogni messaggio, di chi è, quanti token è costato |
| `documents` | i file caricati nella base di conoscenza |
| `chunks` | i pezzi dei documenti col vettore per la ricerca semantica |
| `structures` | le classi configurate parlando (sale, reparti, turni) |
| `usage` | consumi e costi per utente, per il contatore e per il pannello admin |

Le tabelle degli accessi (`user`, `session`, `account`, `verification`) **non** sono qui:
le crea Better Auth col suo comando, in [SETUP-ACCESSI.md](SETUP-ACCESSI.md).

---

## Passo 5 — Il ruolo ristretto per l'applicazione

Questo passo è quello che protegge i dati dei tuoi clienti, ed è veloce.

Ogni tabella ha la **sicurezza per riga** attiva: un utente vede solo le proprie righe.
Ma in Postgres **il proprietario del database è esente** da quelle regole — comodo per te
in pgAdmin, pericoloso se l'applicazione si collega con quello stesso utente, perché in
caso di errore in una query vedrebbe tutto di tutti.

Quindi: tu resti proprietario e continui a vedere tutto in pgAdmin, l'applicazione usa un
ruolo ristretto a cui le regole si applicano davvero.

Nel Query Tool, **sostituisci `SCEGLI_UNA_PASSWORD_LUNGA`** con una password che generi
tu, poi esegui:

```sql
create role nexus_app with login password 'SCEGLI_UNA_PASSWORD_LUNGA';

grant connect on database neondb to nexus_app;
grant usage on schema public to nexus_app;
grant select, insert, update, delete on all tables in schema public to nexus_app;
grant usage, select on all sequences in schema public to nexus_app;

-- Vale anche per le tabelle che creeremo dopo (comprese quelle degli accessi).
alter default privileges in schema public
  grant select, insert, update, delete on tables to nexus_app;
alter default privileges in schema public
  grant usage, select on sequences to nexus_app;
```

Poi nella riga `DATABASE_URL` del tuo `.env.local` usa **questo** utente al posto del
proprietario: sostituisci `corpagent_owner:LAPASSWORD` con
`nexus_app:LAPASSWORDCHEHAISCELTO`, lasciando invariato il resto dell'indirizzo.

> **Perché conta.** Da questo momento, anche se un giorno scrivessi una query sbagliata,
> il massimo che può uscire sono le righe dell'utente che sta chiedendo. È la differenza
> tra un prodotto vendibile e un incidente sui dati.

---

## Riassunto: cosa devi fare tu

- [ ] Progetto Neon creato in Europa
- [ ] pgAdmin collegato (con SSL mode = `require`)
- [ ] `db/migrations/0001_init.sql` eseguito: 8 tabelle create
- [ ] Ruolo `nexus_app` creato con i permessi del Passo 5
- [ ] `.env.local` creato da `.env.example`, con `DATABASE_URL` che usa `nexus_app`
- [ ] Account OpenRouter con credito e chiave in `OPENROUTER_API_KEY` → [SETUP-OPENROUTER.md](SETUP-OPENROUTER.md)
- [ ] Repository GitHub `corp-agent` creato

Poi scrivimi **"database fatto"** e passiamo alla riga 2: gli accessi veri con Google.

# AGENTS.md — regole per QUALSIASI IA che lavora su questo repo

Questo file lo leggono gli strumenti IA (Cline, Aider, Codex, Gemini CLI,
Copilot, Qwen Coder…) come Claude legge `CLAUDE.md`. **Leggilo prima di
toccare qualsiasi cosa.** Chi lo ignora rompe il progetto sui punti dove siamo
stati più attenti.

## Dov'è il progetto
Il codice VERO sta nella sottocartella **`app/`**.
I comandi (build, migrazioni, deploy) si lanciano da DENTRO quella cartella.
Leggi anche il suo **`CLAUDE.md`**: è la bibbia del progetto e vince su tutto.

## Cos'è
CorpAgent: SaaS italiano per creare "lavoratori digitali IA". Primo cliente
vero: **Speed Trasporti** (Torino), su `/speed`. Online su
https://corpagent.vercel.app. Codice e commenti in **ITALIANO**: continua così.

## Stack
React 19 + Vite + TypeScript + Tailwind v4 · Neon (PostgreSQL, pgvector) ·
funzioni serverless su Vercel (cartella `api/`) · OpenRouter · Better Auth.

## ⚠️ LE TRAPPOLE CHE ROMPONO TUTTO
1. **Vercel Hobby = MAX 12 funzioni serverless.** Sei già a 12. Ogni nuova
   rotta dell'area azienda va DENTRO `api/config.ts` (un `case` nello switch
   su `corpo.az` / `?az=`), MAI un file nuovo in `api/`.
2. Negli **import relativi dentro `api/` l'estensione DEVE finire in `.js`**
   (anche se il file è `.ts`). È ESM: senza `.js`, 500 in produzione.
3. Le tabelle dell'area azienda hanno **RLS acceso e NESSUNA policy**: una
   SELECT diretta torna ZERO righe. Si accede SOLO tramite le funzioni SQL
   `security definer` (le "porte", nome `az_...`). Il controllo di CHI può fare
   cosa sta in `api/config.ts` (ruoli), non in SQL.
4. Il **gettone di sessione** va nell'intestazione `x-azienda-sessione` (GET) o
   nel campo `t` del corpo (POST), MAI nell'URL. Nel database è salvato come
   IMPRONTA SHA-256, mai in chiaro.
5. **Migrazioni**: `node ./mig.cjs db/migrations/NNNN.sql` (usa
   `DATABASE_URL_OWNER` da `.env.local`). Scrivile **IDEMPOTENTI**
   (`if not exists` / `create or replace`): più agenti lavorano sullo stesso DB.
6. **NON cancellare né declassare gli account VERI**:
   `salvatore@speedtrasporti.com` (titolare) e `privitera.tommaso2013@gmail.com`.
   Nei collaudi pulisci SOLO le righe di prova che crei tu.
7. **Segreti** (chiavi, password, token) SOLO in `.env.local` / variabili
   Vercel, MAI nel codice né in `vercel.json` (è pubblico).
8. **Documenti e bolle sono CIFRATI a riposo** (`api/_lib/connectors.ts`:
   `cifra`/`cifraByte`). Per i testi che vanno ai CLIENTI (promemoria, risposte)
   usa TEMPLATE con la data/ora esatta: NON far parafrasare date e numeri al
   modello, sbaglia gli orari.

## Come si lavora, ogni pezzo
migrazione → `mig.cjs` → helper nel backend → rotta in `api/config.ts` →
frontend → `npx tsc -b --force` (NON `tsc --noEmit`) → `npm run build` →
COLLAUDO DAL VIVO (curl su `npm run dev`, con una sessione titolare creata a
mano nel DB) → pulisci le righe di prova → commit con messaggio chiaro.
Principio di onestà: mai uno zero finto per dati che dipendono da un
collegamento assente — scrivi "in attesa del collegamento".

## ⚠️ Come si consegna il lavoro (LEGGI: non si pubblica da soli)
- **NON si scrive mai su `main`.** Si lavora su un ramo proprio e si apre una
  **Pull Request** (una proposta).
- Ogni proposta viene riassunta da **CodeRabbit** e deve essere **approvata da
  Tommaso (@Tommyprivi)** prima di andare online. Tu proponi, lui decide.
- Il deploy su Vercel parte **dopo** l'approvazione e il merge in `main`.

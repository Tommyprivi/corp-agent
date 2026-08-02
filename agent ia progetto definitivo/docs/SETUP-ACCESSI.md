# Tutorial: gli accessi con Google (e Apple, dopo)

Tempo richiesto: **25 minuti.** È la **riga 2 della Fase 1**. Prima serve il database:
[SETUP-DATABASE.md](SETUP-DATABASE.md).

Gli accessi li gestisce **Better Auth**, dentro il tuo Neon. Gli utenti stanno nel tuo
database — li vedi in pgAdmin — non sui server di qualcun altro. Nessun costo, nessun
limite di iscritti.

---

## Passo 1 — La firma dei cookie di sessione

Non è una chiave da comprare: te la generi in un secondo. Nel terminale, dentro la
cartella del progetto:

```bash
npx @better-auth/cli@latest secret
```

Copia il risultato nella riga `BETTER_AUTH_SECRET=` del tuo `.env.local`.

> A cosa serve: firma i cookie che tengono l'utente collegato. Se cambia, tutti vengono
> disconnessi — quindi generala una volta e lasciala stare. In produzione su Vercel usane
> una **diversa** da quella locale.

---

## Passo 2 — Crea le tabelle degli accessi

Better Auth ha bisogno di quattro tabelle sue: `user`, `session`, `account`,
`verification`. Non le scriviamo a mano: le genera lui, così restano giuste anche quando
aggiorna.

```bash
npx @better-auth/cli@latest generate --config api/_lib/auth.ts
```

Ti scrive un file `.sql`. Aprilo, copia tutto, e incollalo in **pgAdmin → Query Tool →
Execute (F5)**, esattamente come hai fatto con `0001_init.sql`.

Aggiorna la vista delle tabelle: adesso sono dodici (le otto nostre più queste quattro).

> **Perché non `migrate`.** Il comando `migrate` le creerebbe da sé senza passare da
> pgAdmin. Funziona, ma tu vuoi vedere cosa entra nel tuo database prima che ci entri: con
> `generate` leggi l'SQL e lo esegui tu. Se preferisci la scorciatoia, `migrate` fa la
> stessa cosa in un colpo.

Questo passaggio richiede solo `DATABASE_URL` e `BETTER_AUTH_SECRET`: si può fare **prima**
di avere Google.

---

## Passo 3 — Il login con Google

1. Vai su **[console.cloud.google.com](https://console.cloud.google.com)**
2. In alto, **crea un nuovo progetto**: nome `CorpAgent`
3. Menù a sinistra → **APIs & Services** → **OAuth consent screen**
   - **User type:** External → **Create**
   - **App name:** `CorpAgent`
   - **User support email:** la tua
   - **Developer contact:** la tua email
   - Salva e continua fino alla fine. Resta in modalità *Testing*: basta per lo sviluppo.
     Prima del lancio pubblico va premuto **Publish app**, e Google può chiedere una
     verifica che richiede giorni — **quindi non lasciarla all'ultima settimana.**
4. **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth client ID**
   - **Application type:** Web application
   - **Name:** `CorpAgent Web`
   - **Authorized JavaScript origins**, aggiungi entrambi:
     - `http://localhost:5173`
     - l'indirizzo del sito su Vercel, quando ce l'avrai
   - **Authorized redirect URIs**, aggiungi entrambi:
     - `http://localhost:5173/api/auth/callback/google`
     - `https://IL-TUO-SITO.vercel.app/api/auth/callback/google`
   - **Create**
5. Google ti mostra **Client ID** e **Client secret**. Copiali nelle righe
   `GOOGLE_CLIENT_ID=` e `GOOGLE_CLIENT_SECRET=` del tuo `.env.local`.

⚠️ **L'indirizzo di ritorno deve combaciare al carattere.** È l'errore più comune:
`redirect_uri_mismatch` significa quasi sempre una barra di troppo o `http` invece di
`https`. La parte `/api/auth/callback/google` non è inventata: è quella che serve il
codice in `api/auth/[...all].ts`.

---

## Passo 4 — Prova

```bash
npm run dev
```

Apri `http://localhost:5173`, premi *Prova CorpAgent* e poi il pulsante Google. Se
finisci dentro con il tuo nome, hai fatto.

Controlla anche in pgAdmin: nella tabella `user` è comparsa una riga con la tua email, e
in `profiles` la riga gemella creata al primo accesso. Da quel momento tutto quello che
crei è tuo e resta lì anche se ricarichi la pagina.

### Se qualcosa non va

| Cosa vedi | Cosa significa |
|---|---|
| `Accessi non configurati: manca...` | Una riga di `.env.local` è vuota. Il messaggio dice quale. |
| `redirect_uri_mismatch` | L'indirizzo di ritorno del Passo 3 non combacia esattamente. |
| Il pulsante Google non compare | Mancano `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`. |
| Entri ma vieni disconnesso subito | `BETTER_AUTH_URL` non corrisponde all'indirizzo da cui stai navigando. |

Dopo aver cambiato `.env.local` **riavvia `npm run dev`**: le variabili si leggono
all'avvio.

---

## Passo 5 — Apple, quando vuoi

Il login con Apple richiede l'**account sviluppatore Apple, 99 €/anno**. Non serve per
vendere ai ristoranti italiani: quelli entrano con Google. Finché le due righe
`APPLE_CLIENT_ID` e `APPLE_CLIENT_SECRET` sono vuote, il pulsante Apple non compare e
nulla si rompe.

Quando deciderai di prenderlo, si aggiunge senza toccare il codice: bastano le due righe.

---

## Riassunto

- [ ] `BETTER_AUTH_SECRET` generata e incollata
- [ ] Le 4 tabelle degli accessi create in pgAdmin
- [ ] Progetto Google Cloud con schermata di consenso compilata
- [ ] Client OAuth creato con i due indirizzi di ritorno
- [ ] `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` incollate
- [ ] Entrato davvero, e la riga in `user` esiste

Poi scrivimi **"accessi fatti"** e passo alla riga 3: la chat che risponde davvero.

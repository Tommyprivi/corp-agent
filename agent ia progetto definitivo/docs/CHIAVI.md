# Chiavi API — cosa recuperare e dove metterle

> **Regola che non si negozia:** una chiave API non entra mai nel codice, nel repo, in una
> chat o in un messaggio. Vive in due soli posti, dove il browser non la può leggere:
>
> | Dove | Per cosa |
> |---|---|
> | `.env.local` nella cartella del progetto | sviluppo sul computer di Tommaso. È ignorato da git: non finisce su GitHub |
> | Vercel → il progetto → *Settings* → *Environment Variables* | il sito pubblicato |
>
> I nomi delle variabili sono elencati in [`.env.example`](../.env.example), senza valori.
> Una chiave nel frontend è visibile a chiunque apra il sito col tasto destro → Ispeziona.
> **Una chiave che è passata da una conversazione va considerata pubblica e si revoca**,
> anche se la conversazione era privata.

## I tutorial

| Documento | Cosa copre |
|---|---|
| [SETUP-CHIAVI-MANCANTI.md](SETUP-CHIAVI-MANCANTI.md) | **Passo-passo per ogni chiave ancora vuota**: OpenRouter, Turnstile, OpenAI, Stripe, Apple, ElevenLabs. Costi, tempi e dove ci si incastra. |
| [SETUP-CONNETTORI.md](SETUP-CONNETTORI.md) | Come funzionano Gmail, Slack, Shopify e gli altri, e perché le loro credenziali **non** stanno quasi mai in `.env.local`. Fase 6. |
| [SETUP-DATABASE.md](SETUP-DATABASE.md) | Neon: progetto, ruoli, migrazioni |
| [SETUP-ACCESSI.md](SETUP-ACCESSI.md) | Better Auth e il login con Google |
| [SETUP-OPENROUTER.md](SETUP-OPENROUTER.md) | Il credito e la chiave di OpenRouter |
| [SETUP-TURNSTILE.md](SETUP-TURNSTILE.md) | **La verifica anti-bot, passo per passo.** Gratis, 4 minuti: è l'ultima riga della Fase 1 |
| [SETUP-WHATSAPP.md](SETUP-WHATSAPP.md) | Meta Business, numero verificato, webhook |

## Chiavi già compromesse — da revocare

Queste sono state incollate in chat durante lo sviluppo, quindi **vanno considerate
pubbliche**. Revocarle e generarne di nuove:

| Provider | Dove revocare | Stato |
|---|---|---|
| OpenAI | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) | ⚠️ da revocare |
| ElevenLabs | elevenlabs.io → Profile → API Keys | ⚠️ da revocare |

Su OpenAI controllare anche la sezione **Usage** nei giorni successivi: un consumo anomalo
significa che qualcuno l'ha raccolta.

---

## Servono per la V1 (senza queste non si lancia)

### 1. OpenRouter — il cervello degli agenti
- **Dove:** [openrouter.ai/keys](https://openrouter.ai/keys)
- **Costo:** a consumo, si carica credito (bastano 10-20 € per tutti i test)
- **Perché:** una chiave sola per tutti i modelli testuali. È il gateway scelto nel piano.
- **Variabile:** `OPENROUTER_API_KEY`

### 2. Neon — il database
- **Dove:** [neon.com](https://neon.com) → nuovo progetto, regione **Europa**
- **Costo:** gratuito per iniziare
- **Perché:** ci vivono utenti, agenti, conversazioni, documenti. PostgreSQL puro, si
  amministra con pgAdmin.
- **Variabile:** `DATABASE_URL` (la stringa di connessione con `-pooler`)
- **Tutorial:** [SETUP-DATABASE.md](SETUP-DATABASE.md)

### 2b. Google Cloud — il login
- **Dove:** [console.cloud.google.com](https://console.cloud.google.com) → OAuth client ID
- **Costo:** gratuito
- **Perché:** è il pulsante "Entra con Google". Gli accessi li gestisce **Better Auth**,
  che salva gli utenti dentro Neon.
- **Variabili:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, più `BETTER_AUTH_SECRET`
  (generata da te con `npx @better-auth/cli@latest secret`)
- **Apple:** opzionale, richiede l'account sviluppatore Apple da 99 €/anno. Senza,
  compare solo il pulsante Google e nulla si rompe.
- **Tutorial:** [SETUP-ACCESSI.md](SETUP-ACCESSI.md)

### 3. WhatsApp Business API — il canale
- **Dove:** [developers.facebook.com](https://developers.facebook.com) → app Business →
  prodotto WhatsApp
- **Costo:** le conversazioni di servizio hanno una quota gratuita mensile, poi si paga a
  conversazione
- **Serve:** un numero di telefono dedicato (non quello personale) e la verifica del
  Business Manager, che può richiedere giorni
- **Variabili:** `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_VERIFY_TOKEN`

### 4. Cloudflare Turnstile — la verifica anti-bot
- **Dove:** dashboard Cloudflare → Turnstile
- **Costo:** gratuito
- **Variabili:** `TURNSTILE_SITE_KEY` (pubblica, può stare nel frontend),
  `TURNSTILE_SECRET_KEY` (solo server)

---

## Servono per vendere (Passo 7)

### 5. Stripe — pagamenti
- **Dove:** [stripe.com](https://stripe.com)
- **Costo:** commissione sulle transazioni, nessun fisso
- **Serve:** partita IVA per l'account business italiano
- **Variabili:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`

---

## Post-lancio — non prenderle adesso

Costano e non servono a vendere la V1. La bibbia esclude esplicitamente Voice e Browser dal
lancio.

| Serve per | Provider | Nota |
|---|---|---|
| Immagini | OpenAI (GPT-Image / DALL·E) | Non passa da OpenRouter |
| Voce e cloni vocali | ElevenLabs | Escluso dalla V1 dalla bibbia |
| Video | Runway, Luma, Kling | Il più caro di tutti: ultimo in ordine |
| Trascrizione audio | OpenAI Whisper | Utile per le note vocali, post-lancio |

---

## Come si mettono

### Sul tuo computer, per sviluppare

1. Il file `.env.local` esiste già nella cartella del progetto (creato da `.env.example`)
2. Aprilo, incolla ogni valore dopo il `=` della riga giusta, salva
3. Riavvia `npm run dev` — le variabili si leggono all'avvio
4. Niente virgolette, niente spazi attorno all'uguale: `OPENROUTER_API_KEY=sk-or-v1-...`

### Sul sito pubblicato

1. Pannello di Vercel → il progetto → **Settings** → **Environment Variables**
2. Aggiungi le stesse variabili, una per una
3. Ridistribuisci il progetto perché le legga

Le funzioni in `api/` le leggono da `process.env`; il frontend chiama solo quelle funzioni.

Il frontend non contiene **nessuna** chiave, tranne quelle esplicitamente pubbliche: solo
le variabili con il prefisso `VITE_` arrivano al browser (oggi una sola,
`VITE_TURNSTILE_SITE_KEY`, che è progettata per essere visibile). **Non aggiungere mai il
prefisso `VITE_` a una chiave segreta:** equivale a pubblicarla.

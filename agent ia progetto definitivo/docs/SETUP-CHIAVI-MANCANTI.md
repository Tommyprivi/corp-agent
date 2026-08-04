# Come ottenere ogni chiave che manca

> Tutorial passo-passo per le chiavi ancora vuote in `.env.local`. Una sezione per
> chiave: dove si prende, quanto costa, quanto ci vuole, e dove ci si incastra.
>
> Per la mappa generale vedi [CHIAVI.md](CHIAVI.md). Per i connettori (Gmail, Slack,
> Shopify…) vedi [SETUP-CONNETTORI.md](SETUP-CONNETTORI.md), che funzionano in modo
> diverso da tutte queste.
>
> ⚠️ **I pannelli cambiano.** Google, Meta e Stripe rifanno l'interfaccia ogni pochi
> mesi. Se un menù non si chiama più come qui, cerca la parola chiave indicata: la
> sostanza non cambia, cambiano le etichette.

## Le tre regole che valgono per tutte

1. **Si incolla in `.env.local`, mai nel codice.** Il file è ignorato da git.
2. **Dopo ogni modifica si riavvia `npm run dev`.** Le variabili si leggono
   all'avvio: se non riavvii, il sito continua a vedere il valore vecchio.
3. **Quello che metti qui va rimesso anche su Vercel** (Settings → Environment
   Variables) e poi bisogna ridistribuire, altrimenti vale solo sul tuo computer.

## Quadro d'insieme

| Chiave | Costo | Tempo | Quando serve |
|---|---|---|---|
| `OPENROUTER_API_KEY` | 10-20 € di credito | 10 min | **Adesso** — Fase 1, riga 3 |
| `VITE_TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY` | gratis | 10 min | **Adesso** — Fase 1, riga 10 |
| `OPENAI_API_KEY` | ~5 € bastano per un anno | 10 min | Fase 2 (RAG) |
| `META_APP_*` + `WHATSAPP_*` | quota gratuita, poi a conversazione | **giorni** | Fase 3 |
| `STRIPE_*` | commissione sulle transazioni | 1-2 h | Fase 4 |
| `APPLE_CLIENT_*` | **99 €/anno** | 1 h | facoltativo, mai obbligatorio |
| `CONNECTOR_ENCRYPTION_KEY` | gratis, te la generi | 10 secondi | Fase 6 |
| `ELEVENLABS_API_KEY` | a consumo | 5 min | Fase 8, dopo il lancio |

---

# 1. OpenRouter — il cervello degli agenti

**È l'unica chiave che serve adesso.** Sblocca sei righe del PERCORSO (3, 4, 5, 6, 7, 8):
oggi quel codice è scritto e non è mai stato eseguito.

C'è già un tutorial dedicato: **[SETUP-OPENROUTER.md](SETUP-OPENROUTER.md)**. In breve:

1. Vai su [openrouter.ai](https://openrouter.ai) e crea l'account (si entra con Google).
2. **Carica credito prima di generare la chiave**: `Credits` → `Add Credits`. Bastano
   10-20 € per tutti i test della V1. OpenRouter è prepagato: senza credito la chiave
   esiste ma ogni risposta torna `402`.
3. Vai su [openrouter.ai/keys](https://openrouter.ai/keys) → `Create Key`.
4. Dagli un nome (`corpagent-dev`) e **imposta un tetto di spesa**: è il campo
   *credit limit*. Metti 10 €. Se qualcosa va in loop, il danno si ferma lì.
5. Copia il valore — comincia con `sk-or-v1-` — e incollalo in `.env.local`:
   `OPENROUTER_API_KEY=sk-or-v1-...`
6. Riavvia `npm run dev`.

**Dove ci si incastra**

- La chiave si vede **una volta sola**. Se chiudi la finestra senza copiarla, la
  cancelli e ne fai un'altra.
- Fai due chiavi separate, `corpagent-dev` e `corpagent-prod`. Se quella di sviluppo
  finisce dove non deve, revochi solo quella e il sito pubblicato non si ferma.
- Nel pannello `Activity` vedi ogni singola richiesta con il costo: è il posto dove
  controllare che il "Contatore Risparmio" dica la verità.

---

# 2. Cloudflare Turnstile — la verifica anti-bot

> 📖 **Tutorial completo: [SETUP-TURNSTILE.md](SETUP-TURNSTILE.md)** — con le trappole,
> le chiavi di prova di Cloudflare e cosa fa il codice. Qui sotto solo l'essenziale.

Gratis, senza limiti, e a differenza del CAPTCHA di Google nella maggior parte dei casi
l'utente non deve cliccare niente. È la riga 10 della Fase 1: oggi nel sito c'è un
segnaposto che non verifica nulla.

1. Crea un account su [dash.cloudflare.com](https://dash.cloudflare.com) — **non serve
   avere un dominio su Cloudflare**, questo è il dubbio più comune.
2. Nel menù a sinistra cerca **Turnstile** → `Add widget`.
3. Compila:
   - **Widget name:** `corpagent`
   - **Hostnames:** aggiungi `localhost` **e** il dominio di Vercel. Sono due righe
     separate. Se dimentichi `localhost`, in sviluppo il widget non parte mai.
   - **Widget Mode:** `Managed`. È quello che decide da solo se disturbare l'utente.
4. Alla fine ti dà due valori:

| Valore | Variabile | Chi lo vede |
|---|---|---|
| **Site Key** (`0x4AAA...`) | `VITE_TURNSTILE_SITE_KEY` | il browser — **è pubblica di progetto** |
| **Secret Key** (`0x4AAA...`) | `TURNSTILE_SECRET_KEY` | solo il server |

5. Incolla entrambe e riavvia.

**Dove ci si incastra**

- ⚠️ Il prefisso `VITE_` **fa arrivare la variabile dentro il codice del browser**.
  Sulla Site Key è giusto e voluto. Non metterlo mai davanti alla Secret: sarebbe come
  pubblicarla sul sito.
- Le due chiavi si somigliano moltissimo (iniziano entrambe con `0x4AAA`). Se le
  inverti, il sintomo è un widget che gira all'infinito. Ricontrolla l'ordine.
- Per provare i casi limite Cloudflare ha chiavi finte documentate (una che passa
  sempre, una che fallisce sempre): cerca *"Turnstile testing site keys"*.

---

# 3. OpenAI — solo per gli "embedding" della Fase 2

Serve **solo** per il RAG. OpenRouter dà i modelli di chat, ma non i modelli che
trasformano un documento in numeri per poterlo cercare per significato. Quelli si
prendono da OpenAI a parte.

> ⚠️ **La vecchia chiave OpenAI è compromessa** (è passata in una chat, vedi
> [CHIAVI.md](CHIAVI.md)). Prima di tutto vai su
> [platform.openai.com/api-keys](https://platform.openai.com/api-keys) e **revocala**.
> Poi controlla `Usage` nei giorni seguenti: un consumo che non riconosci significa che
> qualcuno l'ha raccolta.

1. [platform.openai.com](https://platform.openai.com) → accedi.
2. **Prima carica credito:** `Settings` → `Billing` → `Add to credit balance`. È
   prepagato come OpenRouter. **5 € bastano per moltissimo tempo**: indicizzare un
   milione di parole con `text-embedding-3-small` costa circa **0,02 $**.
3. `API keys` → `Create new secret key`.
   - Name: `corpagent-rag`
   - Permissions: scegli **Restricted** e lascia acceso solo `Model capabilities`.
     Una chiave che può solo calcolare embedding non può svuotarti il conto in altri modi.
4. Copia (comincia con `sk-proj-` o `sk-`) e incolla: `OPENAI_API_KEY=...`
5. `Settings` → `Limits` → imposta un **budget mensile** con avviso via email.

**Dove ci si incastra**

- Avere ChatGPT Plus **non c'entra niente**: sono due portafogli diversi. La API si
  paga a parte, anche se hai l'abbonamento.
- Anche qui la chiave si vede una volta sola.

---

# 4. Meta / WhatsApp Business — il canale (Fase 3)

Il tutorial lungo è **[SETUP-WHATSAPP.md](SETUP-WHATSAPP.md)**. Qui sotto solo le
**due variabili nuove** che ho aggiunto adesso a `.env.local` e che quel documento non
copriva, più l'avvertimento sui tempi.

> ⏰ **Inizia con una settimana di anticipo.** La verifica del Business Manager (Meta
> deve controllare che la tua azienda esista) richiede giorni, a volte due settimane, e
> non si può accelerare. È l'unico passaggio del progetto che non dipende da quanto
> lavori.

| Variabile | Dove si prende |
|---|---|
| `META_APP_ID` | developers.facebook.com → la tua app → `Impostazioni` → `Base` |
| `META_APP_SECRET` | stessa pagina, campo *Chiave segreta*, pulsante `Mostra` |
| `WHATSAPP_TOKEN` | Business Manager → `Utenti di sistema` → token **permanente** |
| `WHATSAPP_PHONE_ID` | l'app → `WhatsApp` → `Configurazione API` |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | stessa pagina, sopra il precedente |
| `WHATSAPP_VERIFY_TOKEN` | **te lo inventi tu**, una parola qualsiasi |

**Perché `META_APP_SECRET` non è facoltativa.** Il webhook di WhatsApp è un indirizzo
pubblico: chiunque lo indovini può mandarci dei finti messaggi e far rispondere il tuo
agente a spese tue. Meta firma ogni richiesta con l'App Secret nell'intestazione
`X-Hub-Signature-256`. Senza quel controllo, il canale è aperto al mondo.

**Perché `WHATSAPP_TOKEN` deve essere permanente.** Il token che Meta mostra per primo
nella pagina di configurazione **scade dopo 24 ore**: va benissimo per la prima prova,
poi il sabato mattina l'agente smette di rispondere e non capisci perché. Quello vero
si genera da `business.facebook.com` → `Impostazioni azienda` → `Utenti di sistema` →
crea un utente di sistema → `Genera nuovo token` → durata **Non scade mai**.

**Come si prova in locale.** Meta deve poter raggiungere il tuo computer, e
`localhost` non è raggiungibile da internet. Serve un tunnel:

```bash
npx cloudflared tunnel --url http://localhost:5173
```

Ti restituisce un indirizzo pubblico temporaneo: quello va incollato come URL del
webhook nel pannello Meta.

---

# 5. Stripe — incassare (Fase 4)

Serve la **partita IVA** per l'account business italiano. Si può però costruire e
provare tutto in **modalità test** senza aver ancora aperto niente: le carte finte
funzionano da subito.

1. [stripe.com](https://stripe.com) → crea l'account.
2. Lascia l'interruttore in alto su **Modalità test**.
3. `Sviluppatori` → `Chiavi API`. Due valori:

| Valore | Variabile | Note |
|---|---|---|
| **Publishable key** (`pk_test_...`) | `VITE_STRIPE_PUBLISHABLE_KEY` | pubblica per progetto: apre la pagina di pagamento |
| **Secret key** (`sk_test_...`) | `STRIPE_SECRET_KEY` | solo server |

4. Per il **webhook secret** (`whsec_...`) in locale si usa la riga di comando di Stripe:

```bash
stripe login
stripe listen --forward-to localhost:5173/api/stripe/webhook
```

Il comando stampa il `whsec_...` da incollare in `STRIPE_WEBHOOK_SECRET`. In produzione
è diverso: si crea l'endpoint dal pannello (`Sviluppatori` → `Webhook`) e Stripe ne dà
uno nuovo, **da non confondere con quello locale**.

**Dove ci si incastra**

- Il webhook non è un dettaglio: è **l'unico modo affidabile** di sapere che un
  pagamento è andato a buon fine. Il browser dell'utente può chiudersi a metà, la
  connessione può cadere. Stripe invece riprova per giorni finché non gli rispondi.
- Le carte di prova: `4242 4242 4242 4242`, scadenza qualsiasi nel futuro, CVC
  qualsiasi. Ce n'è anche una che simula il rifiuto e una che chiede il 3D Secure.
- Quando passi in produzione **cambiano tutte e tre le chiavi**. È il momento in cui si
  rompe tutto se non le hai messe anche su Vercel.

---

# 6. Apple — il secondo pulsante di accesso (facoltativo)

**Costa 99 € l'anno e non è mai obbligatorio.** Senza, compare solo il pulsante Google
e non si rompe niente. Diventa obbligatorio solo il giorno in cui pubblichi un'app sullo
store di Apple: la loro regola impone che se c'è "Entra con Google" ci sia anche "Entra
con Apple". Per un sito web, no.

Se lo vuoi lo stesso, è il più macchinoso di tutti perché servono **quattro** pezzi per
comporne due:

1. Iscriviti all'[Apple Developer Program](https://developer.apple.com/programs/) (99 €/anno,
   la verifica dell'identità richiede 1-2 giorni).
2. `Certificates, Identifiers & Profiles` → `Identifiers` → crea un **App ID** e
   abilita *Sign in with Apple*.
3. Crea un **Services ID** (per esempio `app.corpagent.web`). ⚠️ **Questo, non l'App ID,
   è il valore di `APPLE_CLIENT_ID`.** È l'inversione che fa perdere un pomeriggio a tutti.
4. Nel Services ID configura i domini e il *Return URL*:
   `https://tuodominio.com/api/auth/callback/apple`
5. `Keys` → crea una chiave con *Sign in with Apple* attivo → scarica il file **`.p8`**.
   ⚠️ **Si scarica una volta sola e non è più recuperabile.** Segnati anche il **Key ID**
   e il tuo **Team ID** (in alto a destra nel portale).

**La parte che sorprende:** `APPLE_CLIENT_SECRET` **non è una password**. È un token JWT
che si costruisce firmando Team ID + Key ID + Services ID con il file `.p8`, e che
**Apple obbliga a far scadere entro 6 mesi**. Vuol dire che due volte l'anno l'accesso
con Apple smette di funzionare finché non lo rigeneri. Quando ci arriveremo scriviamo uno
script che lo rifà, ma va saputo prima di firmare l'abbonamento.

---

# 7. CONNECTOR_ENCRYPTION_KEY — te la generi tu

Non si compra da nessuno: è la chiave con cui si cifrano i permessi dei clienti prima di
scriverli nel database (vedi [SETUP-CONNETTORI.md](SETUP-CONNETTORI.md)). Serve dalla
Fase 6, ma generarla costa dieci secondi:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Incolla il risultato in `CONNECTOR_ENCRYPTION_KEY=`.

⚠️ **Questa non si può cambiare a cuor leggero.** `BETTER_AUTH_SECRET`, se la cambi,
costringe solo tutti a rifare l'accesso. Questa invece rende illeggibili tutti i
collegamenti già salvati: ogni cliente dovrebbe ricollegare a mano ogni suo account.
Quando l'avrai generata, tienine una copia in un gestore di password.

---

# 8. ElevenLabs — la voce (Fase 8, molto dopo)

La bibbia esclude esplicitamente la voce dalla V1. La riga esiste in `.env.local` solo
perché tu abbia un posto dove metterla il giorno che servirà.

> ⚠️ Anche la vecchia chiave ElevenLabs è compromessa: vai su elevenlabs.io → `Profile`
> → `API Keys` e **revocala adesso**, anche se non useremo il servizio per mesi. Una
> chiave attiva che gira è un conto che qualcun altro può far salire.

Quando servirà: elevenlabs.io → `Profile` → `API Keys` → `Create`.

---

## Riepilogo: cosa fare oggi, in tre righe

1. **OpenRouter** con 10 € di credito e tetto di spesa → sblocca metà della Fase 1.
2. **Turnstile** (gratis, 10 minuti) → chiude l'ultima riga della Fase 1.
3. **Revocare** le vecchie chiavi OpenAI ed ElevenLabs, che sono in giro da settimane.

Tutto il resto può aspettare il suo turno nel [PERCORSO](PERCORSO.md).

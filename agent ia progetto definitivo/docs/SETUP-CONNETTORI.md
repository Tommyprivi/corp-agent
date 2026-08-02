# Come funzionano davvero i connettori

> Come si collegano Gmail, Slack, Shopify e gli altri, e **perché quasi nessuna delle
> loro credenziali sta in `.env.local`**.
>
> Questa è la Fase 6 del [PERCORSO](PERCORSO.md): post-lancio. Il documento esiste
> perché tu abbia la mappa prima di arrivarci, non perché si costruisca adesso. In V1
> esiste un solo canale, WhatsApp.

## La cosa da capire prima di tutte le altre

C'è un equivoco naturale, e vale la pena toglierlo subito perché cambia tutta
l'architettura:

> **`.env.local` non conterrà mai il Gmail dei tuoi clienti.**

Pensa a mille ristoratori che collegano ognuno la propria casella di posta. Un file di
configurazione non può contenere mille credenziali diverse, e soprattutto non può
cambiare ogni volta che un cliente si iscrive alle tre di notte: i file di
configurazione si leggono all'avvio del server.

Le credenziali sono di **due specie diverse**, e vivono in due posti diversi:

| | Livello 1 — la tua applicazione | Livello 2 — il singolo cliente |
|---|---|---|
| **Cos'è** | il documento d'identità di CorpAgent presso Google | il permesso che Mario ti dà sulla *sua* posta |
| **Esempio** | `GOOGLE_CLIENT_ID`, `SLACK_CLIENT_SECRET` | `ya29.a0Af...` (il token di Mario) |
| **Quante ce ne sono** | **una** per fornitore, per sempre | **una per cliente**, e cambia in continuazione |
| **Dove vive** | `.env.local` e Vercel | **nel database, cifrata** |
| **Chi la crea** | tu, una volta sola | il cliente, cliccando "Collega" |
| **Se si perde** | rigeneri e rimetti la variabile | quel cliente ricollega, gli altri non se ne accorgono |

Il Livello 1 è quello che metti in `.env.local`: dice a Google *"esiste un'applicazione
che si chiama CorpAgent e sono io"*. Il Livello 2 nasce quando un cliente clicca il
pulsante, e va nel database perché è un dato, non una configurazione.

## Come si collegano, in pratica: tre famiglie

Non tutti i connettori funzionano allo stesso modo. Sono tre schemi, e da quale schema
usa un servizio dipende se serve o no una riga in `.env.local`.

### Famiglia A — OAuth: il cliente clicca e autorizza

È lo schema di **Google, Slack, Shopify, Notion, HubSpot, Microsoft, Airtable**. Il
cliente non ti dà mai una password: ti dà un permesso revocabile.

```
1. Mario clicca "Collega Gmail" nel sito
2. Il nostro server lo manda su accounts.google.com portandosi dietro
   GOOGLE_CLIENT_ID e la lista di permessi che chiediamo
3. Mario vede la schermata di Google: "CorpAgent vuole leggere la tua posta"
   → accetta (o rifiuta, ed è finita lì)
4. Google rimanda Mario al nostro sito con un codice usa-e-getta
5. Il nostro server scambia quel codice con GOOGLE_CLIENT_SECRET
   → riceve access_token (dura 1 ora) e refresh_token (dura finché non revoca)
6. I due token si CIFRANO e si salvano nel database, riga di Mario
7. Da quel momento l'agente legge la posta di Mario usando il suo token
```

Il `client_secret` serve solo al **passo 5**, sul server. Il browser di Mario non lo vede
mai. Ecco perché è l'unica cosa che sta in `.env.local`.

### Famiglia B — un bot solo, tuo

**Telegram** e **Discord**: il bot è uno solo, è tuo, e i clienti lo invitano nei loro
gruppi. Qui il token nel `.env.local` è davvero la credenziale operativa, perché non c'è
niente "del cliente" da autorizzare.

WhatsApp Business è un ibrido: si può partire con **un numero tuo** (semplice, ed è
quello che faremo in Fase 3) e passare poi all'*Embedded Signup* di Meta, che è OAuth e
permette a ogni cliente di collegare il **proprio** numero. Il secondo modo è l'unico che
scala davvero, ed è per questo che `META_APP_ID` e `META_APP_SECRET` sono già previsti.

### Famiglia C — è il cliente che incolla le sue credenziali

**WooCommerce, IMAP/SMTP, database SQL, webhook custom.** Non c'è nessuna
registrazione da fare da nessuna parte: il cliente genera le chiavi nel suo pannello e le
incolla nel nostro. **Zero righe in `.env.local`**, tutto cifrato nel database.

## Dove finiscono i token dei clienti

Il database è già mezzo predisposto. C'è la tabella `channels` (in
[0002_moduli_canali_scanner.sql](../db/migrations/0002_moduli_canali_scanner.sql)):

```sql
create table public.channels (
  user_id      text not null,
  kind         text not null default 'whatsapp'
               check (kind in ('whatsapp', 'web', 'telegram')),
  external_id  text,     -- il phone_number_id di Meta
  config       jsonb not null default '{}'::jsonb,
  status       text not null default 'pending' ...
);
```

Il campo `config` è il posto giusto dove finiranno i token cifrati. Due cose da sapere
quando ci arriveremo:

1. Il vincolo `check (kind in (...))` oggi ammette **solo tre valori**. Aggiungere Slack
   o Gmail richiede una migrazione, non una riga di codice. È voluto: impedisce che un
   errore di battitura crei un canale fantasma.
2. Le regole per riga (RLS) sono già attive su quella tabella: ogni utente vede solo i
   propri canali. Il codice deve passare da `withUser()` in
   [api/_lib/db.ts](../api/_lib/db.ts), come fa già `api/chat.ts`, altrimenti non vede
   niente — ed è giusto così.

**Perché cifrati e non in chiaro.** Chi legge una riga di quella tabella, con i token in
chiaro, legge la posta di quel cliente. Un backup smarrito, un collaboratore, un accesso
di sola lettura al database diventano una fuga di dati dei tuoi clienti, non dei tuoi. La
cifratura si fa con `CONNECTOR_ENCRYPTION_KEY`, che sta in `.env.local`: chi ha il
database ma non il file non ottiene niente.

## Il giro completo, nel nostro codice

Oggi in `api/` ci sono `chat`, `agents`, `projects`, `models`, `config`, `profile` e
`auth`. La cartella dei connettori **non esiste ancora**: quando si farà, lo schema è
questo.

```
.env.local                     ← le credenziali della TUA app (Livello 1)
   │  process.env, solo sul server
   ▼
api/connectors/[provider]/start.ts      manda il cliente dal fornitore
api/connectors/[provider]/callback.ts   riceve il codice, cifra, salva
api/connectors/[provider]/webhook.ts    riceve gli eventi in arrivo
   │
   ▼
database, tabella channels     ← i permessi dei CLIENTI (Livello 2), cifrati
   │
   ▼
src/components/...             il browser chiama solo /api/..., non vede niente
```

Tre vincoli che valgono già oggi e che è bene non scoprire dopo:

- **I file in `api/` che iniziano con `_` non diventano indirizzi pubblici.** È la
  convenzione di Vercel per il codice condiviso: `_lib/db.ts` non è raggiungibile da fuori.
- **Nella cartella `api/` si usano solo import relativi**, mai gli alias del
  `tsconfig.json`: Vercel non supporta i project references per le funzioni.
- **Solo le variabili con prefisso `VITE_` arrivano al browser.** Tutto il resto è
  invisibile al frontend, ed è esattamente la ragione per cui l'architettura sta in piedi.

## L'ostacolo pratico numero uno: gli indirizzi di ritorno

Ogni fornitore, senza eccezioni, pretende che tu dichiari in anticipo **a quale indirizzo
può rimandare l'utente** dopo l'autorizzazione. Se non combacia carattere per carattere,
il collegamento fallisce con un errore che non spiega niente.

Vuol dire che per **ogni** connettore vanno registrati almeno due indirizzi:

```
http://localhost:5173/api/connectors/google/callback     (il tuo computer)
https://corpagent.app/api/connectors/google/callback     (il sito pubblicato)
```

Attenzione a `http` contro `https`, alla barra finale, e al fatto che quasi nessun
fornitore accetta `localhost` sugli account di produzione: quasi tutti chiedono di
tenere un'app separata per lo sviluppo. Il che è comunque una buona idea.

**Per i webhook** (gli eventi che arrivano dal fornitore verso di noi) `localhost` non
basta mai, perché il fornitore deve poterti raggiungere da internet. Serve un tunnel:

```bash
npx cloudflared tunnel --url http://localhost:5173
```

## Le credenziali per fornitore, quando servirà

Tutte queste variabili sono **già presenti e vuote** in `.env.local`, blocco 5. Non
riempirle adesso: la regola d'oro dice che se non aiuta a vendere entro Dicembre 2026 si
taglia, e nessuna di queste lo fa.

| Fornitore | Dove si registra l'app | Variabili |
|---|---|---|
| **Google** (Gmail, Calendar, Drive) | console.cloud.google.com → Credentials | *nessuna nuova*: riusa `GOOGLE_CLIENT_ID/SECRET`, cambiano solo gli scope |
| **Telegram** | scrivi a **@BotFather** su Telegram → `/newbot` | `TELEGRAM_BOT_TOKEN` |
| **Slack** | api.slack.com/apps → Create New App | `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_SIGNING_SECRET` |
| **Discord** | discord.com/developers/applications | `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_BOT_TOKEN` |
| **Microsoft** (Teams, Outlook) | portal.azure.com → Entra ID → App registrations | `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_TENANT_ID` |
| **Instagram, Messenger** | developers.facebook.com | *nessuna nuova*: riusa `META_APP_ID/SECRET` |
| **Shopify** | partners.shopify.com → Apps → Create app | `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET` |
| **Notion** | notion.so/my-integrations (tipo *public*) | `NOTION_CLIENT_ID`, `NOTION_CLIENT_SECRET` |
| **Airtable** | airtable.com/create/oauth | `AIRTABLE_CLIENT_ID`, `AIRTABLE_CLIENT_SECRET` |
| **HubSpot** | developers.hubspot.com → app → scheda Auth | `HUBSPOT_CLIENT_ID`, `HUBSPOT_CLIENT_SECRET` |
| **Fatture in Cloud** | developers.fattureincloud.it | `FATTURE_IN_CLOUD_CLIENT_ID`, `..._SECRET` |
| **WooCommerce** | *niente*: le genera ogni negozio | nessuna — vanno nel database |
| **VIES** (partite IVA UE) | *niente*: servizio pubblico gratuito | nessuna |

Alcune cose da mettere in conto quando ci arriverai, perché non sono ovvie:

- **Google e Meta richiedono una verifica** per pubblicare un'app che legge dati
  sensibili come la posta. Settimane di attesa e, per Google, un audit di sicurezza a
  pagamento se chiedi gli scope più invasivi. Non è un dettaglio burocratico: è la
  ragione per cui i connettori sono Fase 6 e non Fase 2.
- **I client secret di Microsoft scadono** (24 mesi al massimo). Se nessuno se ne ricorda,
  un giorno tutti i clienti Teams si scollegano insieme.
- **Chiedi il minor numero di permessi possibile.** "Leggi tutta la posta" fa scappare i
  clienti e fa fallire le verifiche. Se basta leggere gli allegati di una etichetta, chiedi
  quello.

## Aggiungere una variabile: la procedura, in breve

1. Aggiungila a **`.env.example`** (nomi, mai valori — quel file sta su GitHub).
2. Aggiungila a **`.env.local`** col valore vero.
3. Aggiungila su **Vercel** → Settings → Environment Variables, e **ridistribuisci**.
4. Leggila **solo** dentro `api/`, con `process.env.NOME`.
5. Non metterle mai il prefisso `VITE_` a meno che non sia progettata per essere pubblica.

I due file `.env.local` e `.env.example` sono generati dallo stesso modello, quindi
contengono esattamente le stesse variabili: se ne aggiungi una in uno, mettila anche
nell'altro o il prossimo computer partirà rotto.

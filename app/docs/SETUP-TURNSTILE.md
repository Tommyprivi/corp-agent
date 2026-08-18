# Turnstile — la verifica anti-bot

> **Costo: zero. Tempo: 4 minuti.** È l'ultima riga della Fase 1 (riga 10), e
> l'unica cosa che manca perché quella fase sia chiusa.
>
> Il codice c'è già ed è provato: appena incolli le due chiavi funziona, senza
> altre modifiche. Finché non le incolli si entra comunque, e l'interfaccia
> dichiara che la protezione non è attiva — non finge.

## Cos'è, e perché non è il CAPTCHA di Google

Cloudflare Turnstile fa la stessa cosa dei riquadri con i semafori, ma
**guardando come si comporta il browser** invece di far cliccare l'utente. Nella
maggior parte dei casi chi entra non si accorge di niente: compare una spunta e
si va avanti.

Per il nostro target conta: un ristoratore a cui chiedi di indovinare quali
foto contengono un attraversamento pedonale è un ristoratore che chiude la
pagina.

---

## I 6 passi

### 1. L'account Cloudflare

Vai su **[dash.cloudflare.com](https://dash.cloudflare.com)** e crea l'account
se non ce l'hai.

⚠️ **Non serve avere un dominio su Cloudflare.** È il dubbio che ferma tutti:
Turnstile funziona su qualsiasi sito, ospitato dove vuoi. Il nostro sta su
Vercel e va benissimo.

### 2. Trova Turnstile

Nel menù a sinistra cerca **Turnstile**. Poi premi **`Add widget`**.

### 3. Il nome

**Widget name:** `corpagent`

Serve solo a te per riconoscerlo nell'elenco.

### 4. Gli hostname — il passo dove si sbaglia

⚠️ **`At least 1 hostname must be added`** — se leggi questo errore, è perché
scrivere nella casella **non basta**: è un campo a etichette, e ogni voce va
confermata.

1. Scrivi `localhost`
2. Premi **Invio** (o clicca la voce «Add localhost» che compare sotto)
3. Deve diventare una **targhetta** con la ✕ accanto. Se resta testo normale nella
   casella, per Cloudflare non l'hai aggiunta
4. Ripeti con `corpagent.vercel.app`

Alla fine devi vedere due targhette:

```
Hostnames
┌──────────────┐ ┌────────────────────────┐
│ localhost  ✕ │ │ corpagent.vercel.app ✕ │
└──────────────┘ └────────────────────────┘
```

**Se `localhost` viene rifiutato** — alcune versioni del pannello vogliono un
nome con il punto — metti solo `corpagent.vercel.app`. Il sito online funziona,
e in sviluppo si usano le chiavi di prova di Cloudflare (in fondo a questo
documento), che valgono su qualsiasi indirizzo.

| Perché | |
|---|---|
| `localhost` | senza questo, in sviluppo sul tuo computer il widget **non parte mai** e resta a girare |
| `corpagent.vercel.app` | il sito pubblicato |

Quando registrerai un dominio vero (`corpagent.app` o quello che sceglierai),
torna qui e aggiungi anche quello. Si possono aggiungere in qualsiasi momento.

### 5. Il tipo di widget

**Widget Mode:** `Managed`

È quello che decide da solo se disturbare l'utente. Gli altri due (`Non-Interactive`
e `Invisible`) non chiedono mai niente, ma proteggono meno.

### 6. Copia le due chiavi

Alla fine Cloudflare mostra due valori. **Si somigliano tantissimo: iniziano
entrambi con `0x4AAA`.**

| Sul pannello | Nel file `.env.local` |
|---|---|
| **Site Key** | `VITE_TURNSTILE_SITE_KEY=` |
| **Secret Key** | `TURNSTILE_SECRET_KEY=` |

Incollale, salva, e riavvia `npm run dev`.

---

## ⚠️ Le tre cose che vanno storte

### Non invertirle

È l'errore più comune, perché i due valori sono quasi identici a vedersi. Il
sintomo: **il widget gira all'infinito** e non passa mai. Se succede,
ricontrolla quale hai messo dove.

### Il prefisso `VITE_` va solo sulla Site Key

Le variabili con `VITE_` **arrivano dentro il codice del browser**: chiunque apra
il sito e prema "Ispeziona" le vede. Sulla Site Key è giusto e voluto — è
progettata per essere pubblica.

Sulla Secret **no, mai.** Quella vive solo sul server, in `api/profile.ts`.
Metterle `VITE_` davanti equivale a pubblicarla, e da quel momento chiunque può
fingere di aver passato la verifica.

### Vanno messe anche su Vercel

Il file `.env.local` vale solo sul tuo computer. Per il sito pubblicato:

**Vercel → il progetto → Settings → Environment Variables** → aggiungi le stesse
due → **ridistribuisci** (senza il nuovo deploy non le legge).

---

## Come si prova che funziona

Cloudflare pubblica delle chiavi finte per i test. Sono utili per vedere i due
casi senza aspettare di incontrarli:

| Chiave segreta di prova | Cosa fa |
|---|---|
| `1x0000000000000000000000000000000AA` | passa **sempre** |
| `2x0000000000000000000000000000000AA` | fallisce **sempre** |

Verificate contro Cloudflare il 2 Agosto 2026: la prima risponde
`success=true`, la seconda `success=false` con `invalid-input-response`. Sono il
modo più rapido per controllare che il giro sia collegato bene prima di usare le
chiavi vere.

---

## Cosa fa il codice, in breve

Sapere questo serve quando qualcosa non torna.

**Nel browser** ([src/components/Turnstile.tsx](../src/components/Turnstile.tsx))
il widget si disegna da sé e, quando la verifica passa, produce un **gettone**.

**Sul server** ([api/profile.ts](../api/profile.ts), metodo POST) quel gettone
va a Cloudflare insieme alla chiave segreta, e Cloudflare dice se è buono.

La verifica **deve** stare sul server: chiunque può dire "sono umano" a un pezzo
di codice che gira sul proprio computer. Solo il server conosce la chiave
segreta, e solo lui può chiedere a Cloudflare la verità.

### Tre casi in cui si entra comunque, di proposito

1. **La chiave manca** → si passa, e il riquadro dichiara «Verifica non
   configurata». Un cancello che nessuno può aprire è peggio di nessun cancello,
   e far credere a una protezione che non c'è è la bugia che questo progetto
   evita per principio.
2. **Cloudflare non risponde** (o va in timeout dopo 8 secondi) → si passa e si
   annota nei log. Bloccare l'ingresso per un guasto che non è dell'utente costa
   un cliente e non ferma nessun bot.
3. **Il gettone è scaduto** (durano 5 minuti) → l'interfaccia lo dice e si rifà
   la verifica, invece di lasciar premere a vuoto.

Se invece Cloudflare risponde e dice **no**, quello sì blocca: è l'unico caso in
cui c'è davvero qualcosa da fermare.

### Dove sta la funzione, e perché non ha una casa sua

Vercel, sul piano Hobby, ammette **12 funzioni per deploy** — e il 2 Agosto 2026
il deploy si è già rotto una volta per averne tredici. Siamo a undici, e il posto
libero serve al webhook di WhatsApp (Fase 3): senza quello il canale non esiste,
mentre verificare un gettone sono quattro righe.

Quindi la verifica sta dentro `api/profile.ts`. Non è arbitrario: passare il
controllo anti-bot è un fatto dell'ingresso di quell'utente, ed è quel file che
si occupa dell'ingresso.

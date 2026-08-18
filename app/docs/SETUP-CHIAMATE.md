# Le chiamate vocali — accendere il ponte

> Voluto da Tommaso il 9 Agosto 2026: *«esigo che funzioni la chiamata»*.
> Un cliente chiama il numero WhatsApp, e risponde l'agente. A voce, in tempo reale.

---

## Perché serve un pezzo in più

Tutto CorpAgent gira su funzioni che si svegliano, rispondono e muoiono. Una telefonata
è l'opposto: una linea che resta aperta, con pacchetti audio che passano venti volte al
secondo per tutta la durata della conversazione.

Non è una limitazione di Vercel — è la differenza fra *rispondere a una domanda* e
*tenere una linea aperta*. Serve un processo acceso, e quel processo è la cartella
[`voice-bridge/`](../voice-bridge/).

**Costa circa 3-5 € al mese.** È l'unica spesa fissa del progetto oltre al database.

---

## Cosa è già fatto e provato

✅ Le chiamate sono **accese** sul numero: i clienti vedono la cornetta su WhatsApp.
✅ Il ponte è scritto, e provato in locale il 9 Agosto 2026:

```
il ponte risponde: 200
il telefono è: connected
tracce audio ricevute dal telefono: 1
pacchetti di voce arrivati al telefono: 948
[prova-1] agente: Speed Trasporti, buongiorno, mi dica pure in cosa posso darle una mano oggi.
```

🟢 **ACCESO E COLLEGATO — 9 Agosto 2026.**

| Cosa | Dove |
|---|---|
| Il ponte | `https://corpagent-voce.fly.dev` (Fly, regione Parigi) |
| Indirizzo dedicato per la voce | `149.248.213.138` |
| Porte della voce | UDP 10000-10020 |
| Il sito lo sa | `VOICE_BRIDGE_URL` e `BRIDGE_SECRET` su Vercel |

Provato **dall'esterno**, contro il ponte online:

```
il ponte online risponde: 200
il telefono è: connected
tracce audio: 1 · pacchetti di voce arrivati: 1197
```

⚠️ **Cosa resta non provato:** la chiamata WhatsApp **vera**. Fin qui il "telefono" è
sempre stato uno script che finge di esserlo. Il pezzo che manca — Meta che consegna
l'audio di un cliente in carne e ossa — si verifica solo chiamando il numero. Se qualcosa
non torna, il piano B scatta da solo: la chiamata viene rifiutata e parte il vocale.

---

## Come è stato acceso (per rifarlo, o per capire cosa c'è)

### 1. Un account su Fly.io

⚠️ **Railway e Render NON vanno bene**, ed è la scoperta che ha deciso la piattaforma:
aprono solo il traffico web, e la voce viaggia su **UDP**. Il ponte si sarebbe collegato
e sarebbe rimasto muto — il guasto peggiore, perché sembra funzionare.

⚠️ Serve anche un **indirizzo IPv4 dedicato** (2 $ al mese): senza, i pacchetti audio
arrivano a Fly e non sanno a quale contenitore andare.

⚠️ Un account Fly in **prova gratuita** genera token già bloccati (`root banned`). Prima
la carta, poi il token — al contrario non funziona, e l'errore non lo dice.

```bash
curl -L https://fly.io/install.sh | sh
fly auth signup
```

### 2. Mettere online il ponte

```bash
cd "app/voice-bridge"
fly launch --no-deploy --name corpagent-voce
```

⚠️ Quando chiede se vuole un database o Redis: **no**. Il ponte non salva niente — è un
tubo, non un magazzino.

### 3. Le due chiavi

```bash
# La chiave OpenAI: è la stessa già in .env.local
fly secrets set OPENAI_API_KEY=sk-proj-...

# Un segreto inventato, che deve combaciare con quello su Vercel.
# Generalo così:  node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
fly secrets set BRIDGE_SECRET=...
```

### 4. Accendere

```bash
fly deploy
fly status          # deve dire "started"
curl https://corpagent-voce.fly.dev/salute
# {"vivo":true,"chiamateInCorso":0}
```

### 5. Dirlo a CorpAgent

Su Vercel, due variabili d'ambiente:

| Nome | Valore |
|---|---|
| `VOICE_BRIDGE_URL` | `https://corpagent-voce.fly.dev` |
| `BRIDGE_SECRET` | lo stesso segreto del punto 3 |

Poi un deploy, e la prossima chiamata viene **accettata** invece che rifiutata.

---

## ⚠️ 
Le trappole, tutte trovate provando

**1. `onTrack` scatta *durante* `setRemoteDescription`, non dopo.**
Iscriversi dopo significa iscriversi a un evento già passato: la connessione risulta
perfetta, il modello risponde, e non arriva **un solo pacchetto audio**. Nessun errore da
nessuna parte, solo silenzio. È il difetto che è costato più tentativi.

**2. L'intestazione `OpenAI-Beta` fa fallire tutto.**
Con quella si prende `400 — The Realtime Beta API is no longer supported`. L'indirizzo
giusto è `/v1/realtime/calls` (non `/v1/realtime`), vuole solo la chiave, e risponde
**201**, non 200.

**3. La configurazione della sessione ha una forma nuova.**
Serve `session.type = "realtime"`, e le impostazioni audio stanno dentro `audio.input` e
`audio.output`. Con la forma vecchia OpenAI risponde *«Missing required parameter:
session.type»* e **ignora la configurazione**: il modello risponde lo stesso, ma con la
voce e il comportamento predefiniti invece che con i tuoi. È un guasto silenzioso.

**4. L'evento dei messaggi si chiama `onMessage`, non `message`.**
Col nome sbagliato si prende un `Cannot read properties of undefined` al primo messaggio
del modello.

---

## Come è fatto dentro, in due righe

I pacchetti audio **non vengono mai aperti**. Tutti e due i lati — il telefono del
cliente e il modello di OpenAI — parlano Opus a 48 kHz, quindi i pacchetti si girano
così come sono da una parte all'altra.

La strada ovvia sarebbe stata: decodifica → trascrizione → modello → sintesi vocale →
ricodifica. Sei passaggi, due secondi buoni prima della prima sillaba. Al telefono due
secondi di silenzio sono un'eternità: la gente dice «pronto? pronto?» e riattacca.

È lo stesso trucco dei server delle videoconferenze: chi sta in mezzo instrada, non
ascolta.

---

## Quanto costa una chiamata

Il modello vocale di OpenAI si paga a minuto di audio, in entrata e in uscita. Una
telefonata da due minuti costa **qualche decina di centesimi** — molto più di un
messaggio scritto, che ne costa millesimi.

Per questo il ponte ha un **tetto di dieci minuti** per chiamata: più di qualsiasi
domanda vera fatta a un negozio, e sotto la soglia del telefono rimasto in tasca.

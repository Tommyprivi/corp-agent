# Continuare CorpAgent dal telefono

Guida per portare avanti il progetto senza il computer.

---

## Passo 0 — Da fare al computer, prima di partire (2 minuti)

Il commit è già fatto e il remote è già configurato. Manca solo creare il repository vuoto
su GitHub, perché quello richiede il tuo account.

1. Apri **https://github.com/new**
2. Repository name: `corp-agent`
3. Scegli **Private**
4. **Non** spuntare niente ("Add a README", ".gitignore", "license" vanno lasciati vuoti:
   il progetto ha già tutto)
5. Premi "Create repository"

Poi torna qui e scrivi a Claude "**fai il push**", oppure esegui da solo:

```bash
git push -u origin main
```

Da questo momento il progetto è online e raggiungibile da qualsiasi dispositivo.

---

## Passo 1 — Come scrivere codice dal telefono

Apri **https://claude.ai/code** dal browser del telefono (funziona anche da tablet).

1. Collega il repository `corp-agent`
2. Apri una nuova sessione
3. Scrivi sempre questa frase come primo messaggio:

> Leggi CLAUDE.md e docs/PIANO.md, poi fai il Passaggio 2.

Claude lavora in un ambiente cloud (non serve il tuo PC accesso), scrive il codice e apre
una **pull request**. Tu la leggi dal telefono e, se ti piace, premi "Merge".

Cambia solo il numero del passaggio ogni volta: Passaggio 2, poi 3, poi 4, poi 5.

### Se qualcosa non ti piace

Rispondi nella stessa sessione, in italiano, dicendo cosa cambiare:

> Il tasto "Prova CorpAgent" è troppo piccolo e il grigio dello sfondo è spento.

Non serve spiegare di nuovo il progetto: i file `CLAUDE.md`, `docs/SPEC.md` e
`docs/PIANO.md` lo fanno per te a ogni nuova sessione.

---

## Passo 2 — Cosa puoi fare in vacanza e cosa no

### Si può fare dal telefono

I **Passaggi 2, 3, 4 e 5** (Blocco A del piano). Sono tutti di interfaccia: non servono
chiavi, account a pagamento o carte di credito.

- Passaggio 2 — Landing pubblica con il tasto "Prova CorpAgent"
- Passaggio 3 — Onboarding: login, CAPTCHA, le 3 domande, il piano consigliato
- Passaggio 4 — Chat che propone gli agenti, selettore modello, avviso costi
- Passaggio 5 — Sfogliare i 68 agenti e crearne uno personalizzato

### Meglio aspettare il computer

Dal **Passaggio 6** in poi servono account veri (Supabase, OpenRouter, Stripe) e la
gestione delle chiavi API.

⚠️ **Non incollare mai una chiave API in una chat, da nessun dispositivo.** Le chiavi si
inseriscono solo nel pannello di Supabase o di Vercel. Se una chiave finisce in una
conversazione o in un commit, va considerata compromessa e rigenerata.

---

## Passo 3 — Per ragionare, non per programmare

La normale **app Claude** sul telefono va benissimo per:

- rivedere i testi dell'interfaccia
- decidere prezzi e nomi dei piani
- ragionare su nuove funzioni prima di farle costruire
- farti spiegare qualcosa del progetto

Non tocca il repository: quello che decidi lì, poi lo passi a claude.ai/code.

---

## Promemoria rapido

| Cosa voglio fare | Dove vado |
|---|---|
| Scrivere codice | claude.ai/code, dal browser del telefono |
| Ragionare e decidere | app Claude |
| Vedere il codice | github.com/mykernelhubb/corp-agent |
| Sapere cosa manca | `docs/PIANO.md`, sezione "Stato attuale" |

**La frase magica, ogni volta:**

> Leggi CLAUDE.md e docs/PERCORSO.md, poi continua dalla prima riga non spuntata.

---

## Lavorare da più computer senza perdere niente

Due comandi, due momenti. Se li rispetti non ti succede mai niente di brutto.

**Appena ti siedi**, prima di toccare qualsiasi cosa:

```bash
git pull
```

Scarica tutto quello che è stato fatto altrove. Se salti questo passaggio e ti metti a
lavorare, poi i due computer litigano.

**Prima di alzarti**, sempre:

```bash
git add -A
git commit -m "cosa ho fatto stasera"
git push
```

Da questo momento il lavoro è su GitHub e lo ritrovi ovunque.

> **La regola in una riga:** `pull` quando arrivi, `push` quando te ne vai.
> Non ci sono altre regole.

### La prima volta su un computer nuovo

```bash
git clone https://github.com/mykernelhubb/corp-agent.git
cd corp-agent
npm install
```

Poi va ricostruito `.env.local`, che **non viaggia con git** — le chiavi non stanno mai
nei repository. Non è lungo, perché due su quattro si rigenerano da sole:

```bash
cp .env.example .env.local
npm run db:role      # rigenera DATABASE_URL
npm run db:analyst   # rigenera ANALYST_DATABASE_URL
```

Restano da incollare a mano solo queste:

| Riga | Dove la prendi |
|---|---|
| `DATABASE_URL_OWNER` | Neon → il progetto → **Connect** |
| `BETTER_AUTH_SECRET` | Generane una nuova: l'unico effetto è che rifai l'accesso |
| `GOOGLE_CLIENT_ID` e `_SECRET` | Copiali dall'altro computer, o crea un secondo client OAuth |
| `OPENROUTER_API_KEY` | [openrouter.ai/keys](https://openrouter.ai/keys) |

Il database è su Neon, quindi è lo stesso da qualsiasi computer: gli utenti, le
conversazioni e i documenti li ritrovi già lì, non c'è niente da spostare.

### Se due computer hanno litigato lo stesso

Capita se hai lavorato in due posti senza fare `pull`. Non toccare niente e scrivimi
**"git litiga"** con quello che ti dice il terminale: si risolve in un minuto, ma è
l'unica cosa che conviene non improvvisare.

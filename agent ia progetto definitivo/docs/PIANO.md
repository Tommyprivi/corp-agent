# CorpAgent — Piano di lavoro per il lancio di Dicembre 2026

Indirizzo del progetto: **[BIBBIA.md](BIBBIA.md)** — vince su tutto.
Requisiti storici: [SPEC.md](SPEC.md). Idee congelate per dopo: [BACKLOG.md](BACKLOG.md).
Convenzioni di codice: [../CLAUDE.md](../CLAUDE.md). Lavorare dal telefono: [VACANZA.md](VACANZA.md).

**Stato attuale:** Passi 1 e 2 fatti (Master Builder, Home su misura, motore di
raccomandazione, connessione WhatsApp). In corso: Passo 3 (base di conoscenza).

⚠️ **SPEC.md è stato aggiornato il 1 Agosto 2026** con un secondo documento molto più
grande: centinaia di funzioni enterprise (pannello admin, multi-tenant, marketplace,
white-label, voice, browser agent...). Tommaso ha confermato che tutto questo resta
**backlog post-lancio** — è archiviato in [BACKLOG.md](BACKLOG.md), non si costruisce ora.
La V1 resta quella descritta sotto, invariata.

**Come si usa questo file:** un passo per sessione. Quando è finito, spuntare le caselle e
aggiornare "Stato attuale". Prima di aggiungere qualcosa, applicare la regola d'oro: *se non
aiuta a vendere entro Dicembre, tagliala.*

---

## Il blocco essenziale — questo e nient'altro

```
Master Builder  ──▶  Home su misura  ──▶  Conoscenza  ──▶  WhatsApp  ──▶  Risparmio
  (onboarding)        (solo il utile)       (il cervello)     (il canale)    (il valore)
```

---

## PASSO 1 — Master Builder

L'IA di onboarding. Chiede di cosa si occupa l'utente e gli costruisce l'agente.

- [ ] Chat a schermo pieno come primo ingresso, non un modulo
- [ ] Domanda 1: **"Di cosa ti occupi?"** con risposte rapide (ristorante, negozio, servizi
      alla persona, studio professionale, altro)
- [ ] Domanda 2: cosa gli fa perdere più tempo
- [ ] Domanda 3: dove gli scrivono i clienti
- [ ] Genera un agente su misura con nome e mansione, pescando dai preset esistenti
- [ ] Chiude con l'effetto WOW: *"Il tuo dipendente IA è pronto"*, in meno di 30 secondi

**Fatto quando:** dall'ingresso all'agente pronto in tre risposte, senza vedere una sola
schermata di configurazione.

## PASSO 2 — Home costruita su misura

- [ ] La Home mostra **solo** le carte utili al mestiere scelto
- [ ] Navigazione ridotta all'osso: Home, Chat, Impostazioni Avanzate
- [ ] Tutto il resto (agenti, modelli, connettori, flussi) sta in **Impostazioni Avanzate**
- [ ] L'estetica si cambia da chat o dalle impostazioni

**Fatto quando:** un ristoratore entra e non vede niente che non gli serva.

## PASSO 3 — Base di conoscenza (il cervello)

Serve alla promessa "non sbaglia mai i prezzi".

- [ ] Caricamento di menù, listini e documenti
- [ ] Elenco di cosa l'agente sa, con la possibilità di togliere un documento
- [ ] Indicizzazione e ricerca semantica (RAG) — backend nel Passo 6
- [ ] L'agente cita da dove ha preso il prezzo

**Fatto quando:** carichi un menù e l'agente risponde con il prezzo giusto, citando la fonte.

## PASSO 4 — Canale WhatsApp

- [ ] Collegamento del numero (WhatsApp Business API)
- [ ] Stato del canale visibile in Home: attivo, in attesa, errore
- [ ] Anteprima delle conversazioni con i clienti
- [ ] Interruttore per passare la parola all'umano

**Fatto quando:** un cliente scrive su WhatsApp e l'agente risponde da solo.

## PASSO 5 — Contatore Risparmio

- [ ] Ore risparmiate e valore in euro
- [ ] Conteggio dei messaggi gestiti senza intervento umano
- [ ] Confronto con la settimana precedente

**Fatto quando:** l'utente apre la Home e vede subito quanto gli è tornato indietro.

## PASSO 6 — Backend reale

Il passo che rende vere le risposte. **Serve un computer e delle chiavi API.**

- [ ] Supabase: Auth Google/Apple, tabelle, Row Level Security
- [ ] Edge Function `chat` che chiama **OpenRouter** in streaming
- [ ] Vector store per il RAG del Passo 3
- [ ] WhatsApp Business API dietro webhook
- [ ] Conteggio consumi per utente

**Fatto quando:** la chat risponde davvero e la chiave non è mai raggiungibile dal browser.

## PASSO 7 — Vendere

- [ ] Landing pubblica con il tasto **"Prova CorpAgent"**
- [ ] Pagine Documentazione, Termini di servizio, Privacy
- [ ] Stripe e i piani di abbonamento
- [ ] Beta con negozi e ristoranti veri — **Novembre 2026**

---

## Congelato fino a dopo il lancio

Non toccare, non mostrare, non "aggiungere solo un pulsantino":

Voice · Browser / Computer-Use · Marketplace di agenti · White-Label · Flussi di
Automazione · i 68 agenti preimpostati come elenco da sfogliare · il selettore dei 64
modelli · i 31 connettori oltre WhatsApp · Electron · Play Store

I cataloghi restano in `src/data/` perché alimentano i suggerimenti del Master Builder, ma
**non diventano pagine da navigare**.

---

## Decisioni tecniche già prese

| Tema | Decisione |
|---|---|
| Frontend | React + Vite + TypeScript + Tailwind v4 |
| Estetica | Minimalismo Apple: `#FAFAFC` / `#FFFFFF` / `#1D1D1F` / `#86868B` / `#0071E3` |
| Modelli | **OpenRouter**: una chiave sola, scelta automatica, l'utente non la vede |
| Backend | **Supabase**: Auth, Postgres, Edge Functions, vector store |
| Canale V1 | WhatsApp Business API |
| Dove vivono le chiavi | Solo server-side. **Mai nel browser, mai in chat, mai nel repo.** |
| Pagamenti | Stripe |

## Regole per tutti i passi

1. **Un passo per sessione.** Non iniziare il successivo senza aver spuntato il precedente.
2. **Regola d'oro** prima di ogni aggiunta: aiuta a vendere entro Dicembre? Se no, taglia.
3. **Niente risposte finte spacciate per vere.** Finché il backend non c'è, l'interfaccia
   dichiara che la risposta è simulata.
4. `npx tsc -b --force` pulito prima di chiudere una sessione (non `--noEmit`: è un no-op qui).

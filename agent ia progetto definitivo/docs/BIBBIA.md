# La bibbia del progetto

> Documento di indirizzo scritto da Tommaso. **Vince su tutto il resto**, incluso
> [SPEC.md](SPEC.md). Se una decisione presa altrove contraddice questo file, questo file ha
> ragione.

Nome tecnico: **AgentFlow**. Nome commerciale: **CorpAgent**.

## Obiettivo

Costruire una piattaforma SaaS che permette a chiunque di creare "lavoratori digitali IA"
chattando. Zero codice, zero sbattimento.

## I 3 principi non negoziabili

### 1. Semplicità assoluta tramite IA guida

L'utente **non** deve vedere 100 funzioni all'ingresso. Entra e parla con il **Master
Builder** (un'IA di onboarding). Il Master Builder gli chiede "Di cosa ti occupi?" e gli
monta in automatico la Home con **solo** le cose che gli servono per quel lavoro specifico.

Tutte le altre funzioni sono nascoste in **Impostazioni Avanzate**, organizzate al top.
L'utente può cambiare l'estetica sia chiedendolo in chat, sia dalle impostazioni.

### 2. Lanciare piccolo, pensare gigante

Si è parlato di 50+ funzioni. Per il lancio di Dicembre 2026 **si congela tutto**. Si
realizza e si lancia SOLO il blocco essenziale:

| Blocco essenziale | Ruolo |
|---|---|
| **Master Builder** | onboarding |
| **Chat WhatsApp** | canale |
| **RAG / Knowledge Base** | cervello |
| **Contatore Risparmio** | valore |

Tutto il resto — Voice, Browser, Marketplace, White-Label — è **post-lancio**.

### 3. Effetto WOW

La frase che deve dire il prodotto appena l'agente è pronto:

> "Ho creato il mio dipendente IA in 30 secondi chattando."

Ogni singola cosa nel prodotto deve portare a questo risultato immediato.

## Mercato

- **Target V1:** negozi, ristoranti, PMI italiane che usano WhatsApp per lavorare.
- **Promessa di valore:** "L'agente IA risponde ai clienti 24/7, non sbaglia mai i prezzi, e
  ti fa risparmiare ore di lavoro vero".

## Tempi

- **Beta:** Novembre 2026
- **Lancio pubblico:** Dicembre 2026

## Regola d'oro

> "Se una feature non aiuta a vendere entro Dicembre, tagliala."

Focus su: **Semplice, Utile, Veloce.**

---

## Cosa è stato congelato per effetto di questa bibbia

Costruito prima della bibbia, resta nel codice ma **fuori dall'interfaccia V1**:

- I 68 agenti preimpostati (`src/data/presetAgents.ts`) — il Master Builder ne genera uno
  su misura, non si sfogliano elenchi
- I 64 modelli (`src/data/models.ts`) — la scelta è automatica, l'utente non la vede
- I 31 connettori (`src/data/connectors.ts`) — in V1 esiste solo WhatsApp
- Flussi di Automazione — post-lancio
- Computer-Use, Electron, Play Store — post-lancio

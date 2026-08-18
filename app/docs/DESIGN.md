# Il ridisegno — brief

> Deciso da Tommaso il **1 Agosto 2026**, dopo aver guardato l'interfaccia dal vivo:
> *"l'UI del sito è pessima"*.
>
> **Turno nel piano:** subito dopo la chiusura della Fase 1, prima della Fase 2.
> Non prima: ridisegnare adesso significherebbe farlo attorno a contenuti finti e
> rifarlo dopo, quando le risposte vere scorrono davvero nella chat.

## Le decisioni già prese

| Domanda | Risposta |
|---|---|
| Cosa non va | **Tutto e quattro insieme:** vuota, anonima, colori spenti, sembra un prototipo |
| Direzione | **Apple, ma fatto sul serio** — la bibbia non cambia, cambia l'esecuzione |
| Da dove si parte | **La chat** — è il prodotto, è dove l'utente sta il 90% del tempo |
| Quanto si cambia | **Ridisegno delle schermate** — layout e componenti rifatti, flusso invariato |

## La diagnosi

Le quattro lamentele non sono quattro problemi: sono lo stesso problema visto da
quattro lati. **Abbiamo preso dal minimalismo la sottrazione, non il mestiere.**

Il minimalismo Apple non è una pagina vuota con un pulsante al centro. È tipografia
grande e sicura di sé, una gerarchia così netta che l'occhio sa dove andare senza
pensarci, e dettagli lavorati al pixel. Il vuoto c'è, ma è *dosato*: serve a far
risaltare qualcosa. Da noi il vuoto non fa risaltare niente, quindi legge come una
pagina non finita.

## Cosa cambia, concretamente

### Tipografia — è qui che si vince

Oggi i titoli stanno tra 24 e 26px e il testo a 14,5px: dimensioni da pannello di
amministrazione, non da prodotto. Apple apre le sue pagine con caratteri da 48-64px.

- Scala tipografica vera, con salti netti invece di mezze misure
- Il titolo di ogni schermata diventa **grande e senza timidezza**
- Meno pesi diversi, più differenza di dimensione: è quello che crea gerarchia

### Colore e contrasto — c'è un problema misurabile

✅ **Fatto il 2 Agosto 2026.** `--text-secondary` era `#86868B`: su bianco dava
**3,62:1** misurati, contro i **4,5:1** che lo standard di accessibilità chiede per
il testo normale. Quindi "colori spenti" non era un'impressione, era un difetto — e
riguardava anche chi ci legge male.

- Secondario portato a **`#6E6E73`**: **5,07:1** misurati nel browser. È anche il
  grigio che usa davvero Apple, non quello che ci eravamo scelti noi
- Aggiunto `--text-tertiary` per ciò che deve esserci senza farsi notare
- Aggiunto **`--positive: #1D8A4E`**: prima "agente attivo", "WhatsApp collegato" e
  "ore risparmiate" erano blu come i pulsanti, quindi "funziona" e "qui si preme"
  avevano lo stesso colore
- Aggiunto `--bg-sunken` e tre livelli di ombra al posto di un'ombra sola uguale
  ovunque

### Densità — il vuoto va guadagnato

La schermata d'ingresso ha un logo, due righe e un pulsante in mezzo a un campo di
bianco. Se togli il resto, quello che resta deve essere **grosso**.

### Materiali e profondità

Oggi: bordo grigio da 1px e un'ombra appena percettibile, ovunque, uguale. Servono
elevazioni diverse per cose diverse, e bordi che spariscono dove non servono.

### Movimento

Non c'è. Le risposte compaiono, le schermate si sostituiscono di scatto. Bastano
transizioni brevi e una comparsa curata dei messaggi — sempre rispettando
`prefers-reduced-motion`, come dice CLAUDE.md.

## Ordine di lavoro

1. **La chat** — bolle, area di scrittura, carte azione, stato "sta scrivendo",
   comparsa del testo in streaming
2. **La schermata d'ingresso** — oggi la più spoglia, ed è la prima impressione
3. **La landing** — serve per la beta di Novembre
4. **Impostazioni Avanzate** — per ultima, la vede meno gente

## Cosa NON si tocca

- I tre principi della [bibbia](BIBBIA.md) e le tre voci di navigazione
- Il flusso: chat come primo ingresso, Master Builder che guida, niente pannelli
- Il logo (anello aperto con il punto)
- I colori restano variabili CSS in `src/index.css`, mai scritti nei componenti

## Da chiedere quando si parte

- Un prodotto che gli piace *davvero*, da guardare insieme
- Se il tema scuro serve alla V1 o è backlog (oggi non esiste)

# I test veri per Salvatore — provare gli agenti prima di accenderli

Guida pratica per far provare a Salvatore, con mano sua, i tre agenti già
costruiti. Tutto si fa in **modalità "In prova"**: l'agente prepara le cose
ma NON manda niente ai clienti veri finché lui non conferma. Zero rischio.

⚠️ Serve una casella email collegata (vedi Test 0). Se Salvatore non ne ha
ancora una dedicata, usa il consiglio lì sotto: una Gmail apposta per la prova,
così non tocchiamo la posta vera dell'ufficio.

---

## Test 0 — Collegare una casella di prova

**Perché:** senza posta, gli agenti "mail" e "solleciti" non hanno nulla su
cui lavorare.

**Come:**
1. Salvatore entra come titolare → **Impostazioni** (in alto)
2. Scende fino a **«Collegamenti · La posta»**
3. Clicca il fornitore giusto (Gmail, Outlook, Aruba…) e segue la guida che
   compare per la password
4. Clicca **«Prova e collega»**

**Cosa deve vedere:** un messaggio con quanti messaggi ci sono nella casella.
Se dà errore, il testo dell'errore dice già cosa correggere (password
sbagliata, server sbagliato…).

> 💡 **Consiglio**: fatevi una casella tipo `test.speedtrasporti@gmail.com`
> solo per questa prova. Non tocca la posta vera dell'ufficio, e potete
> mandarci mail finte quanto volete senza pensieri.

---

## Test 1 — L'agente risponde alle mail facili

**Perché:** verificare che l'agente distingua da solo cosa può gestire e
cosa no, PRIMA di lasciarlo mandare mail vere.

**Come:**
1. Da un'altra casella (il telefono di Salvatore, o un amico), manda alla
   casella collegata **due mail di prova**:
   - Una **facile**: *"Buongiorno, a che ora aprite il sabato?"*
   - Una **delicata**: *"Per 20 spedizioni al mese che sconto mi fate?"*
2. Nell'app: **Impostazioni → Collegamenti · La posta**
3. Clicca **«Controlla adesso»**
4. Scendi alla sezione **«Risposte automatiche»**

**Cosa deve vedere:**
- La mail sull'orario → **stato "Bozza pronta"**, con una risposta scritta
  (magari va caricato prima un documento con gli orari in **Documenti**, per
  farla rispondere giusta)
- La mail sullo sconto → **stato "Girata a te"** — l'agente NON risponde da
  solo sui prezzi, giusto così

**Il passo successivo (quando si fida):** cliccare **«Manda questa»** sulla
bozza buona, per vedere che l'invio vero funziona. Solo dopo, passare
l'interruttore su **«Acceso»**.

---

## Test 2 — «Dov'è il carico»

**Perché:** far vedere che l'agente sa rispondere coi dati VERI, non a caso.

**Come:**
1. **Clienti** → aggiungi un cliente di prova, es. *"Prova Ricambi"*, con
   un'email tua
2. **Traffico** → registra un **ritiro** per "Prova Ricambi": qualche collo,
   un orario domani
3. Vai nella postazione **Traffico** (o Magazzino) → tool **«Agente»**
4. Scrivi in chat: *"dov'è il carico di Prova Ricambi?"*

**Cosa deve vedere:** l'agente risponde con **lo stesso orario esatto** che
è stato scritto al passo 2 (es. *"previsto per il 15/08 alle 11:00"*) — non
un orario a caso, non un "non lo so" se il dato c'è davvero.

**Prova anche il caso onesto:** chiedi di un cliente MAI registrato — deve
dire che non risulta niente e girare la domanda a una persona, non inventare.

---

## Test 3 — L'agente Solleciti ritiri

**Perché:** vedere il promemoria che l'agente scrive da solo ai clienti coi
ritiri in arrivo.

**Come:** (riusa il ritiro di prova del Test 2, previsto per oggi/domani)
1. **Impostazioni → Collegamenti · La posta** → sezione
   **«Agente solleciti ritiri»**
2. Metti l'interruttore su **«In prova»**
3. Clicca **«Controlla adesso»**

**Cosa deve vedere:**
- Se "Prova Ricambi" ha l'email in anagrafica → un promemoria pronto, con
  la **data e l'ora esatte** del ritiro
- Se manca l'email → segnato **«Manca l'email»**, non manda a caso

**Poi:** clicca **«Manda questo»** per vedere l'invio vero, oppure passa ad
**«Acceso»** quando si fida — da lì in poi lo fa da solo ogni sera.

---

## Test 4 — Le bolle che si leggono da sole (OCR)

**Perché:** è la promessa fatta a Salvatore — la scansione della
multifunzione che entra da sola.

**Come:**
1. Scatta o scannerizza una bolla qualsiasi (anche finta, scritta a mano
   chiara) e mandala come **allegato immagine (JPEG/PNG)** alla casella di
   prova
2. **Impostazioni → Collegamenti · La posta → «Controlla adesso»**
3. Vai in **Magazzino → tool «In arrivo» → sezione «Bolle dalla posta»**

**Cosa deve vedere:** la bolla compare **già letta**: mittente, numero,
colli — con il tasto **«Apri»** che mostra la scansione originale.

---

## Checklist finale, da spuntare con Salvatore

- [ ] Casella di prova collegata senza errori
- [ ] Mail facile → bozza corretta; mail su prezzi → girata a lui
- [ ] «Dov'è il carico» risponde con l'orario ESATTO del ritiro registrato
- [ ] Cliente inesistente → l'agente lo ammette, non inventa
- [ ] Sollecito ritiro → data/ora esatte, e segnala se manca l'email
- [ ] Una bolla scansionata compare letta, con dati giusti
- [ ] Ha capito la differenza fra **In prova** (scrive, non manda) e
      **Acceso** (manda da solo)

Quando tutte le caselle sono spuntate, Salvatore ha *visto* gli agenti
lavorare coi suoi dati veri — non deve fidarsi sulla parola, l'ha provato.
A quel punto si può accendere sul serio, categoria per categoria.

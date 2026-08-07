# Tutorial: WhatsApp Business API

Tempo richiesto: **un'ora tua.** Poi **da qualche giorno a qualche settimana di attesa**,
che non dipende da te.

> ⚠️ **Questo è l'unico passaggio del piano dove conviene partire in anticipo.**
> È la Fase 3, ma la verifica dell'azienda va avviata **adesso**, mentre finiamo la Fase 1.
> Non è lavoro: è coda. Se la avvii quando arriveremo alla Fase 3, aspetti fermo — e la
> beta è a Novembre.
>
> La buona notizia: c'è un **numero di prova gratuito** che funziona subito, senza nessuna
> verifica. Si può costruire e collaudare tutto mentre l'azienda viene approvata.

---

## Dal telefono o dal computer?

Domanda di Tommaso, e la risposta è comoda: **la parte lenta si fa dal telefono**, quella
fastidiosa aspetta comunque il computer.

| Passo | Dove | Perché |
|---|---|---|
| 1 · Portfolio aziendale | 📱 **telefono** | è un modulo, si compila bene ovunque |
| 2 · **Verifica dell'azienda** | 📱 **telefono, anzi meglio** | fotografi la visura con la fotocamera invece di scansionarla |
| Cancellare il numero da WhatsApp | 📱 **solo dal telefono** | si fa dall'app: Impostazioni → Account → Elimina account |
| 3 · App per sviluppatori | 💻 computer | console fitta, schede, tabelle |
| 4-5 · Numero di prova e credenziali | 💻 computer | il token è lunghissimo e si copia una volta sola: sbagliare un carattere significa non capire perché non funziona |
| 6 · Webhook | 💻 computer | lo facciamo insieme |
| 7 · Numero vero | 💻 computer + 📱 per l'SMS | |

**Quindi stasera dal divano puoi fare i passi 1 e 2** — che sono quelli che innescano
l'attesa di giorni. Tutto il resto viene dopo l'approvazione, quando sarai al computer
comunque.

---

## Passo 0 — Cosa ti serve prima di cominciare

| Cosa | Nota |
|---|---|
| Un account Facebook personale | Serve solo per entrare nel Business Manager, non comparirà da nessuna parte |
| Dati dell'attività | Denominazione esatta, indirizzo, **partita IVA**, sito web |
| Un documento dell'azienda | Visura camerale o certificato di attribuzione della P.IVA |
| Una bolletta o un documento con l'indirizzo | Deve combaciare **al carattere** con l'indirizzo che dichiari |
| **Un numero di telefono dedicato** | ⚠️ Leggi il riquadro qui sotto |

> ⚠️ **Il numero non deve essere già su WhatsApp.** Se quel numero ha WhatsApp o WhatsApp
> Business installato, la registrazione fallisce. Devi prima **cancellare l'account** dal
> telefono (Impostazioni → Account → Elimina il mio account), e non è reversibile.
>
> **Non usare il tuo numero personale.** Prendi una SIM nuova o un numero VoIP che possa
> ricevere SMS o una chiamata. Costa pochi euro e ti evita di restare senza WhatsApp.

---

## Passo 1 — Il portfolio aziendale

1. Vai su **[business.facebook.com](https://business.facebook.com)**
2. **Crea un account** / **Crea portfolio aziendale**
3. Compila:
   - **Nome**: la denominazione esatta come sui documenti, non il nome commerciale
   - **La tua email di lavoro**
4. Poi **Impostazioni azienda** → **Informazioni sull'azienda** e riempi tutto: indirizzo,
   partita IVA, sito, telefono

⚠️ **Il nome e l'indirizzo devono combaciare esattamente coi documenti.** È il motivo
numero uno per cui la verifica viene respinta: "Trasporti Rossi S.r.l." e "Trasporti Rossi
srl" per Meta non sono la stessa azienda.

---

## Passo 2 — Avvia la verifica (fallo per primo, è la coda lunga)

1. **Impostazioni azienda** → **Centro sicurezza** (o **Security Center**)
2. **Avvia la verifica** / **Start verification**
3. Carica il documento dell'azienda
4. Scegli come farti ricontattare (email sul dominio aziendale, telefono, o SMS)

Da qui in poi è attesa: **da pochi giorni a qualche settimana.** Meta manda un'email
quando ha finito. Se ti respingono, dice il motivo e si può ripresentare.

> 💡 **Verifica anche il dominio** (Impostazioni azienda → Brand safety → Domini): è
> gratis, si fa con una riga nei DNS e velocizza l'approvazione.

**Da adesso in poi non devi più aspettare: si continua col numero di prova.**

---

## Passo 3 — L'app per sviluppatori

1. Vai su **[developers.facebook.com](https://developers.facebook.com)** → **Le mie app**
   → **Crea un'app**
2. Tipo: **Azienda** (Business)
3. Nome: `CorpAgent`
4. Collega l'app al portfolio aziendale del Passo 1
5. Nella schermata dei prodotti, cerca **WhatsApp** → **Configura**

Meta ti crea automaticamente un **account WhatsApp Business** (WABA) di prova.

---

## Passo 4 — Il numero di prova, per lavorare subito

Nella sezione WhatsApp → **Configurazione API** trovi già un **numero di test** regalato da
Meta. Funziona subito, gratis, senza verifica.

Limite: può scrivere solo a **5 numeri** che aggiungi tu a mano nella stessa pagina
(metti il tuo cellulare personale). Per collaudare è più che sufficiente: si prova tutto il
giro — cliente scrive, agente risponde — prima di avere il numero vero.

---

## Passo 5 — Le tre credenziali

Nella stessa pagina **Configurazione API** trovi:

| Cosa | Dove | Va in |
|---|---|---|
| **Token di accesso** | in cima alla pagina | `WHATSAPP_TOKEN` |
| **ID numero di telefono** | sotto il numero, è un numero lungo | `WHATSAPP_PHONE_ID` |
| **ID account WhatsApp Business** | stessa pagina, sopra il precedente | `WHATSAPP_BUSINESS_ACCOUNT_ID` |
| **Token di verifica** | ⚠️ non esiste: **te lo inventi tu** | `WHATSAPP_VERIFY_TOKEN` |

E due che stanno in un'altra pagina — l'app → **Impostazioni** → **Base**:

| Cosa | Va in | A cosa serve |
|---|---|---|
| **ID app** | `META_APP_ID` | identifica l'app; servirà anche a Messenger e Instagram |
| **Chiave segreta** (premi `Mostra`) | `META_APP_SECRET` | ⚠️ **non è facoltativa**, vedi sotto |

> ⚠️ **Perché `META_APP_SECRET` è obbligatoria.** Il webhook è un indirizzo pubblico:
> chiunque lo indovini può mandarci finti messaggi e far rispondere il tuo agente a spese
> tue. Meta firma ogni richiesta con questa chiave nell'intestazione
> `X-Hub-Signature-256`, e senza quel controllo il canale è aperto al mondo. Non è una
> precauzione teorica: è un indirizzo che chiunque può chiamare.

Il **token di verifica** è una parola d'ordine che scegli tu: serve solo a far capire a
Meta e a noi che stiamo parlando tra di noi. Va bene una frase a caso, l'importante è che
sia identica nei due posti. Generane una così:

```bash
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

⚠️ **Il token di accesso della pagina dura 24 ore**, ed è la trappola che fa perdere un
sabato mattina: tutto funziona, poi di colpo l'agente smette di rispondere e sembra che si
sia rotto qualcosa. Non si è rotto niente — il token è scaduto.

Va bene per le prove. Quello definitivo si fa in **Impostazioni azienda → Utenti →
Utenti di sistema**: crei un utente di sistema, gli dai accesso all'app e generi un token
con durata **Non scade mai**. Lo faremo insieme.

Le tre righe sono già pronte e vuote in `.env.example`. Mandamele o mettile tu in
`.env.local`.

---

## Passo 6 — Il webhook (qui serve una cosa che non abbiamo ancora)

Meta deve poterci **chiamare** quando arriva un messaggio. Serve un indirizzo pubblico in
`https://` — e `localhost:5173` dal di fuori non esiste.

✅ **Questo pezzo è già a posto:** il sito è pubblicato dal 2 Agosto 2026, quindi
l'indirizzo esiste già ed è

```
https://corpagent.vercel.app/api/whatsapp
```

Serve un tunnel **solo** se vuoi provare il webhook contro il codice sul tuo computer
prima di distribuirlo:

```bash
npx cloudflared tunnel --url http://localhost:5173
```

Ti stampa un indirizzo `https://...trycloudflare.com` che punta al tuo computer. Cambia a
ogni avvio, quindi va bene per un pomeriggio di prove, non per restare acceso.

Poi in WhatsApp → **Configurazione** → **Webhook** → **Modifica**:

| Campo | Valore |
|---|---|
| URL di callback | `https://IL-TUO-INDIRIZZO/api/whatsapp` |
| Token di verifica | quello che hai generato al Passo 5 |

Salva, e poi **iscriviti al campo `messages`** nell'elenco sotto. Senza quella spunta il
webhook è collegato ma non arriva niente.

⚠️ Meta chiama subito l'indirizzo per controllare che risponda correttamente. Finché non
scrivo `api/whatsapp.ts` (Fase 3, riga 19) **fallirà**, ed è normale. Questo passo si
completa insieme, non da solo.

---

## Passo 7 — Il numero vero, quando la verifica passa

Quando arriva l'email di approvazione:

1. WhatsApp → **Configurazione API** → **Aggiungi numero di telefono**
2. Inserisci il numero dedicato, ricevi il codice via SMS o chiamata, confermi
3. Scegli il **nome visualizzato** — quello che i clienti vedranno in cima alla chat.
   Passa da un'altra approvazione, di solito rapida. Deve avere a che fare con l'azienda:
   nomi di fantasia vengono respinti.

Da lì aggiorni `WHATSAPP_PHONE_ID` col numero nuovo e sei in produzione.

---

## Cose da sapere prima di venderlo a un cliente

- **Le risposte al cliente sono gratis entro 24 ore** da un suo messaggio. È esattamente
  il nostro caso d'uso: il cliente scrive, l'agente risponde.
- **Scrivere per primi costa** e richiede un **modello approvato** (template). Serve per
  promemoria e promozioni — è la Fase 6, non ora.
- **Si parte piano:** all'inizio Meta limita quanti clienti diversi puoi contattare in 24
  ore. Il limite sale da solo se la qualità resta buona.
- **La qualità conta:** se i clienti bloccano o segnalano il numero, Meta abbassa il limite
  e può sospendere. Un agente che risponde bene protegge anche questo.

I prezzi Meta li cambia spesso: prima di mettere una cifra nel listino di CorpAgent,
controlla la pagina ufficiale dei prezzi invece di fidarti di quello che sai.

---

## Cosa dire a Claude quando hai finito

| Se hai fatto | Scrivimi |
|---|---|
| Avviato la verifica | "verifica Meta avviata" — così so che il cronometro parte |
| Numero di prova e credenziali | "WhatsApp di prova pronto" — e mandami le tre righe |
| Verifica approvata | "Meta approvato" |

---

## Riassunto

- [ ] Portfolio aziendale creato, dati esatti come sui documenti
- [ ] **Verifica avviata** ← la cosa che conta, fallo oggi
- [ ] Dominio verificato (facoltativo, ma velocizza)
- [ ] App per sviluppatori con il prodotto WhatsApp
- [ ] Numero di prova attivo, il tuo cellulare tra i 5 destinatari
- [ ] `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID` presi
- [ ] `META_APP_ID` e `META_APP_SECRET` presi (pagina *Impostazioni → Base*)
- [ ] `WHATSAPP_VERIFY_TOKEN` generato
- [ ] SIM dedicata comprata (serve al Passo 7, non prima)

**Le Fasi 1 e 2 sono chiuse dal 2 Agosto 2026**, quindi il progetto è pronto ad accogliere
WhatsApp: il cervello risponde, la memoria funziona, il sito è online.

Quello che serve da te adesso è **solo il Passo 2**: avviare la verifica e far partire
l'attesa. Tutto il resto lo si può costruire e collaudare col numero di prova mentre Meta
guarda i tuoi documenti.

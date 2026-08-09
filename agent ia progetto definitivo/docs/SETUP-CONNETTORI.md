# I connettori — cosa serve davvero per ognuno

> Fase 5 del [PERCORSO](PERCORSO.md), messa in cima da Tommaso il 9 Agosto 2026:
> *«prima degli agenti colleghiamo i connettori»*.

---

## ⚠️ Prima di tutto: chiave ≠ permesso

È la confusione che fa perdere le giornate, e Google la alimenta chiamando «API key»
due cose diverse.

**Una CHIAVE dice «sono io, l'applicazione».**
Sta sul server, si manda a ogni richiesta, e basta. Google Maps funziona così: chiedi
quanto ci vuole da Catania a Milano, e risponde. Non c'entra nessun utente.

**Un PERMESSO dice «quel signore mi lascia leggere la sua posta».**
Nessuna chiave può darlo, per un motivo ovvio appena lo si dice ad alta voce: se
bastasse una chiave per leggere Gmail, chiunque avesse quella chiave leggerebbe la posta
di chiunque. Serve che **l'utente clicchi «autorizzo»**, e che noi conserviamo il gettone
che ne esce — uno per utente, non uno per l'applicazione.

| Connettore | Cosa serve | Ce l'abbiamo? |
|---|---|---|
| **Google Maps** | una chiave | ✅ sì |
| **Fluida** | una chiave + l'id azienda | ✅ sì |
| **Microsoft 365** | permesso (OAuth) — id, segreto **e tenant** | ⚠️ manca il tenant |
| **Gmail / Calendar / Drive** | permesso (OAuth) — id e segreto | ⚠️ la chiave data non serve |

---

## Google Maps ✅ pronto

`GOOGLE_MAPS_API_KEY` è in `.env.local`. Sblocca le cose che un'azienda di trasporti o
un ristorante con consegne chiede ogni giorno: *quanto dista*, *quanto ci metto*, *è
nella mia zona di consegna*.

⚠️ **Da fare prima di pubblicare:** nella console Google, limitare la chiave alle sole
API che usiamo (Distance Matrix, Geocoding) e agli indirizzi IP del server. Una chiave
Maps senza limiti, se esce, la spende qualcun altro — e Maps si paga a chiamata.

---

## Fluida ✅ pronto

`FLUIDA_API_KEY` e `FLUIDA_COMPANY_ID` sono in `.env.local`. È il gestionale di presenze,
ferie e permessi: sblocca gli agenti che rispondono «Marco è in ferie fino al 18» senza
che nessuno glielo dica.

---

## Microsoft 365 ⚠️ manca un pezzo

Ci sono `MS365_CLIENT_ID` e `MS365_CLIENT_SECRET`. Manca il **Tenant ID**, e senza non si
sa a quale organizzazione chiedere il permesso.

**Dove trovarlo:**

1. `https://portal.azure.com`
2. Cerca **Microsoft Entra ID** (si chiamava Azure Active Directory)
3. **Registrazioni app** → clicca l'applicazione `b9712c06-…`
4. Nella **Panoramica**, accanto a «ID applicazione (client)», c'è **«ID directory
   (tenant)»** — è quello. Stesso formato, con i trattini.

Poi va in `.env.local` alla riga `MS365_TENANT_ID=`.

⚠️ **Il valore segreto scade.** Azure li fa scadere a 6, 12 o 24 mesi. Quando scade,
Outlook e Calendario smettono di rispondere **senza un errore chiaro**: sembra che il
connettore sia rotto. Segnati la data di scadenza da qualche parte.

---

## Gmail, Calendar, Drive ⚠️ la chiave data non apre la posta

La chiave `AIzaSy…` fornita per Gmail non funzionerà mai su una casella di posta, e non
è un errore di Tommaso: è che Google chiama «API key» anche quella, ma Gmail accetta
**solo** il permesso dell'utente.

**La buona notizia: non serve niente di nuovo.** `GOOGLE_CLIENT_ID` e
`GOOGLE_CLIENT_SECRET` ci sono già — sono quelli con cui si entra nel sito. Bastano due
cose:

1. Nella console Google, **aggiungere gli ambiti** (`gmail.readonly`, `calendar`,
   `drive.file`) alla schermata di consenso
2. Quando l'utente collega Gmail, chiedergli il permesso e **conservare il gettone di
   rinnovo**

⚠️ **Aggiungere gli ambiti sensibili fa scattare la verifica di Google**, che richiede
giorni e un video che mostra l'uso. Come la verifica di Meta: si apre con anticipo, non
il giorno prima di averne bisogno.

La chiave `GOOGLE_API_KEY` resta in `.env.local` — serve per i servizi Google che la
accettano davvero.

---

## Il pannello «Connettori»

Non basta salvare le chiavi: l'utente deve **vedere** se un connettore risponde. Un
collegamento che si rompe in silenzio è peggio di un collegamento che non c'è, perché
l'agente continua a rispondere come se sapesse.

Ogni connettore, nel pannello, deve mostrare tre cose: **collegato o no**, **provalo
adesso** (una chiamata vera, con la risposta a schermo), e **quando ha risposto
l'ultima volta**.

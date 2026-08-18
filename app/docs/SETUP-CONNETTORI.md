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

## Fluida ✅ collegato e provato

```
200  https://api.fluida.io/api/v1/companies/<azienda>
     {"data":{"name":"corp agent","subscription_plan":"plus", ...}}
```

**Base:** `https://api.fluida.io/api/v1`
**Intestazione:** `x-fluida-app-uuid: <la chiave>`

⚠️ **Quel nome non lo indovina nessuno**, e ci ho perso quattordici tentativi:
`x-api-key`, `Authorization: Bearer`, `Api-Key`, `Token`, col prefisso `key:`, come
parametro nell'indirizzo — tutti `401 unauthorized`. Il nome vero non è scritto né nel
pannello di Fluida né nella loro guida: sta dentro la **specifica OpenAPI**, che il
portale carica col browser e che quindi non si vede leggendo la pagina.

Si tira fuori così:

```bash
curl -s https://developer.fluida.io/docs/openapi.json | jq .components.securitySchemes
```

**La lezione, che vale per il prossimo connettore:** quando una API risponde `401` e non
`404`, l'indirizzo è giusto e sbagli solo il modo di presentarti. Non provare a
indovinare — cerca il file OpenAPI: quasi tutti i portali moderni ne hanno uno, ed è
l'unico posto dove il nome dell'intestazione è scritto per esteso.

**Cosa c'è dentro:** 360 indirizzi. Quelli che servono agli agenti: `teams`,
`subsidiaries` (sedi), `time_off/counters` (ferie residue), `contracts` (i dipendenti),
`stampings` (timbrature), `calendar/presences` (chi c'è oggi).

⚠️ **Due cose da sistemare prima di usarlo davvero:**

1. **L'account è vuoto.** Squadre: 0. Sedi: 0. È un'azienda appena creata — l'agente
   può collegarsi, ma non ha niente da dire. Vanno inseriti i dipendenti in Fluida.
2. **La chiave non ha tutti i permessi.** `time_off/counters` risponde `401` mentre
   `teams` risponde `200`: quando la chiave è stata creata sono stati scelti permessi
   parziali. Si correggono in **Azienda → Generali → chiave → Permessi**, mettendo
   almeno *Read Only* su tutto.

---

## Microsoft 365 ⛔ bloccato dall'organizzazione, non dalle chiavi

⚠️ **Non è il Tenant ID che manca — o meglio, non è quello il problema.** Provando le
credenziali contro Microsoft si ottiene:

```
AADSTS53003: Access has been blocked by Conditional Access policies.
```

Che vuol dire: **l'applicazione esiste e le credenziali sono valide**, ma
l'organizzazione a cui appartiene l'account Microsoft di Tommaso ha una regola che vieta
il rilascio dei permessi. Verificato anche che non è un account personale: provando col
tenant dei privati (`9188040d-…`) risponde «applicazione non trovata in questa directory».

⚠️ **È la stessa organizzazione che blocca i token personali su Fly con l'SSO.** Scuola,
università o azienda: l'account è dentro il loro Microsoft, e le regole le fa il loro
amministratore.

**Anche col Tenant ID corretto resterebbe bloccato.** Le uniche due strade sono chiedere
all'amministratore di quell'organizzazione, oppure creare un tenant proprio (gratuito,
dieci minuti) dove l'amministratore è Tommaso.

**Se un giorno serve il Tenant ID:** sta in `portal.azure.com` → **Microsoft Entra ID** →
**Registrazioni app** → l'applicazione → **Panoramica**, alla voce «ID directory
(tenant)».

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

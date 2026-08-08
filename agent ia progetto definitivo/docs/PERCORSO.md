# Il percorso completo — tutte le funzioni del documento, in ordine

> ⚠️ **QUESTO È L'ORDINE DI LAVORO VINCOLANTE.** Fissato da Tommaso il 1 Agosto 2026:
> *"fissati questo percorso, questo è quello che devi seguire"*.
>
> Regole d'uso:
> 1. Si prende la **prima riga non spuntata** della fase aperta e si fa quella.
> 2. Non si salta avanti a fasi successive, nemmeno se sembrano più divertenti.
> 3. Non si aggiungono funzioni che non sono in questo elenco senza chiedere a Tommaso.
> 4. Quando una riga è finita, si spunta qui e si aggiorna "Fase aperta" sotto.
>
> **FASE 1 — Il cervello: CHIUSA.** Righe **1-6 chiuse e verificate** il 2 Agosto
> 2026. Quel giorno è arrivata `OPENROUTER_API_KEY` e per la prima volta il progetto ha
> parlato con un modello vero: domanda in italiano, risposta in 1,5 secondi, salvata su
> Neon, con l'avviso costi che è scattato da solo su una richiesta pesante.
>
> Chiusa anche la **9** lo stesso giorno: conversazioni, progetti e agenti vivono su
> Neon. Ricarichi la pagina e ritrovi tutto — provato leggendo indietro dal database
> i messaggi appena scritti.
>
> Chiusa anche la **7**: il Master Builder genera l'agente in JSON garantito, si comporta
> come un consulente (due domande al massimo, poi propone) e non promette cose che il
> prodotto non sa fare. Il carattere è stato deciso da Tommaso domanda per domanda il
> 2 Agosto 2026: sta scritto in `api/build-agent.ts` e non si cambia senza chiederglielo.
>
> Lo stesso giorno i **125 agenti del catalogo** sono diventati funzionanti: avevano nome
> e descrizione ma nessuna istruzione, quindi attivarne uno non produceva niente.
>
> Chiusa anche la **8**: racconti com'è fatta l'attività come viene — «ho tre sale, dentro
> 40, la veranda 20 ma solo d'estate» — e un modello la mette in ordine prima di
> indicizzarla. Le eccezioni non si perdono: a «possiamo cenare in veranda a gennaio?»
> l'agente risponde no, e a «siamo in 60» non inventa, gira la domanda al titolare.
>
> ⚠️ La tabella `structures` della migrazione 0001 **non si usa**, di proposito: il
> perché sta scritto in `api/documents.ts`. Una seconda memoria vorrebbe dire una seconda
> ricerca, una seconda iniezione nel prompt e due modi di andare fuori sincrono.
>
> 🎉 **LA FASE 1 È CHIUSA.** Tutte e dieci le righe, il 2 Agosto 2026. Chiusa anche la
> **10**: le chiavi di Cloudflare sono in `.env.local` e su Vercel, e la protezione è
> attiva davvero — un gettone finto riceve un 403 da Cloudflare, non un via libera.
>
> Verificato anche il confine delle chiavi: la Site Key è nel pacchetto servito al
> browser (è pubblica di progetto, va bene) e la Secret **no**, come deve essere.
>
> 🎉 **ANCHE LA FASE 2 È CHIUSA.** Otto righe su otto, il 2 Agosto 2026.
>
> Le ultime tre: **16** — 132 documenti al minuto con tre estrazioni in volo, e il
> trascinamento legge anche le cartelle (500 PDF in meno di quattro minuti, e un file
> corrotto non ferma gli altri). **17** — un modello distilla le conversazioni tenendo
> solo i fatti che valgono domani: «al signor Rossi sconto 10% fisso» sì, «grazie» no.
> **18** — togliere un documento lo **archivia**, non lo cancella: l'agente smette di
> pescarlo nell'istante stesso, ma si può rimettere in memoria.
>
> ⚠️ Sulla 18 c'era una trappola: una time-machine costruita sopra un `DELETE`
> distruttivo è un pulsante che non può fare niente. La parola che comanda, nel
> documento di Tommaso, è **«per errore»** — e chi sbaglia lo scopre dopo.
>
> **Fase aperta: FASE 3 — WhatsApp.** È quella che rende il prodotto vendibile.
> ⏰ La verifica del Business Manager di Meta richiede **giorni**: quella pratica va
> aperta con anticipo, ed è l'unico passaggio che non dipende da quanto si lavora.
>
> ⚠️ **Cambio di architettura deciso da Tommaso il 1 Agosto 2026:** il backend è
> **Neon + funzioni su Vercel + Better Auth**, non più Supabase. Neon è solo il database,
> quindi login e chiavi li gestiamo noi. L'ordine delle righe **non cambia**: cambiano due
> nomi. Dettagli in [SETUP-DATABASE.md](SETUP-DATABASE.md) e [SETUP-ACCESSI.md](SETUP-ACCESSI.md).

Ordinate per **dipendenza tecnica**: ogni fase usa quello che ha costruito la precedente.
Non si può invertire l'ordine — senza la Fase 2 (backend) nulla di quello che segue
funziona davvero, resta interfaccia.

Legenda: ✅ fatto · 🔧 in corso · ⬜ da fare · 🔑 richiede una chiave API

---

## FASE 0 — Fondazioni ✅ FATTA

| Funzione | Stato |
|---|---|
| Interfaccia minimale stile Apple, palette e tipografia | ✅ |
| Logo (anello aperto + punto) | ✅ |
| Landing pubblica con "Prova CorpAgent" | ✅ |
| Documentazione, Termini di servizio, Privacy | ✅ (bozze da far vedere a un legale) |
| Login Google / Apple (interfaccia) | ✅ |
| CAPTCHA / verifica anti-bot (segnaposto) | ✅ |
| Sondaggio: come ci hai conosciuto, solo o in team, dove lavori | ✅ |
| Chat unica a tutto schermo con scorrimento automatico | ✅ |
| Master Builder: una domanda, propone tutto | ✅ |
| Kit pronti per 5 mestieri (agenti + connettori + piano in 1 clic) | ✅ |
| Motore di raccomandazione a 3 livelli (Mente / Mani / Budget) | ✅ |
| 135 agenti preimpostati in catalogo | ✅ |
| 64 modelli IA in catalogo | ✅ |
| 53 connettori in catalogo | ✅ |
| 5 piani di abbonamento + funzione che consiglia quale | ✅ |
| Configurazione guidata delle "classi" parlando (sale, reparti, turni) | ✅ |
| Base di conoscenza: carica e rimuovi documenti | ✅ |
| Contatore Risparmio (calcolo dichiarato) | ✅ |
| Impostazioni Avanzate dietro un'icona | ✅ |

**Cosa manca a questa fase:** niente. Tutto è interfaccia funzionante, con le risposte
dell'IA dichiarate come simulate.

---

## FASE 1 — Il cervello ✅ FATTA 🔑 LA PIÙ IMPORTANTE

Senza questa fase il prodotto non è vendibile: l'agente non risponde davvero.

| Ordine | Funzione | Chiave | Stato |
|---|---|---|---|
| 1 | Progetto **Neon**: database, tabelle, sicurezza per riga | Neon | ✅ 23 tabelle, 3 migrazioni, 3 ruoli, RLS provata |
| 2 | Auth vera con Google e Apple (**Better Auth**) | Google Cloud | ✅ Google entra davvero (Apple quando vorrai i 99 €/anno) |
| 3 | Funzione `chat` **su Vercel** che chiama OpenRouter in streaming | OpenRouter | ✅ risposta vera in 1,5 s, primo pezzo dopo 1 s |
| 4 | Scelta automatica del modello per difficoltà | — | ✅ "ciao" → modello leggero, "analizza" → Opus |
| 5 | Avviso prima di una richiesta dispendiosa | — | ✅ scatta **prima** di spendere, con la cifra |
| 6 | Conteggio token e consumi per utente | — | ✅ dopo la migrazione `0004` (vedi sotto) |
| 7 | Master Builder vero: Structured Output che genera l'agente in JSON | OpenRouter | ✅ genera, chiede, non mente — e i 125 preset funzionano |
| 8 | Configurazione guidata vera: la conversazione diventa struttura dati salvata | OpenRouter | ✅ racconti di fretta, diventa memoria organizzata |
| 9 | Salvataggio permanente di agenti, chat, documenti, configurazioni | Neon | ✅ chat, progetti e agenti — i documenti alla Fase 2 |
| 10 | Turnstile vero al posto del segnaposto | Cloudflare (gratis) | ✅ attivo: un gettone finto viene rifiutato |

> ✅ **Eseguite davvero il 2 Agosto 2026.** Le righe 3-6 erano rimaste per settimane
> "scritte ma mai eseguite": codice che compila non è codice che funziona. Adesso sono
> state provate contro OpenRouter vero, con una sessione vera, e i messaggi sono
> finiti su Neon dove si possono guardare con pgAdmin.
>
> ⚠️ **Cosa ha trovato la prima esecuzione.** `usage.cost_eur` era `numeric(10,4)`, ma
> una risposta breve costa circa 0,00002 €: ogni messaggio veniva contato **zero**, e
> l'arrotondamento avveniva all'inserimento, quindi il dato era perso per sempre. Il
> contatore giornaliero sarebbe rimasto a zero anche dopo mille conversazioni,
> falsando gli alert di budget (riga 33) e il margine per utente (riga 41). Risolto
> dalla migrazione `0004_precisione_costi.sql`, che porta la colonna a sei decimali —
> gli stessi di `messages.cost_eur`. È il genere di cosa che si scopre solo eseguendo.

**Fatto quando:** scrivi in chat e risponde davvero, e se ricarichi la pagina è tutto ancora lì.

**Dove sta il codice:** `db/migrations/0001_init.sql` (riga 1), `api/_lib/auth.ts` e
`api/auth/[...all].ts` (riga 2), `api/chat.ts` (righe 3, 6, 9), `api/_lib/openrouter.ts`
(righe 4, 5).

---

## FASE 2 — La memoria (RAG) ✅ FATTA 🔑

| Ordine | Funzione | Chiave | Stato |
|---|---|---|---|
| 11 | Vector store e indicizzazione dei documenti | Neon (pgvector) | ✅ |
| 12 | L'agente pesca dai documenti prima di rispondere | OpenRouter | ✅ |
| 13 | Cita da dove ha preso il prezzo | — | ✅ a te, non ai clienti |
| 14 | Supporto multi-formato: PDF, Word, Excel, CSV, immagini | — | ✅ |
| 15 | OCR per foto di listini e menù | OpenRouter (visione) | ✅ |
| 16 | Batch-processor: trascina 500 PDF insieme | — | ✅ 132 documenti al minuto, cartelle comprese |
| 17 | Memoria contestuale continua (ricorda accordi passati) | — | ✅ tiene gli accordi, butta le chiacchiere |
| 18 | Time-Machine: riavvolgi la memoria a una data | — | ✅ togliere archivia, non cancella |

**Fatto quando:** carichi il menù e l'agente risponde col prezzo giusto, citando la riga.
✅ **Succede dal 2 Agosto 2026.** Provato: menù indicizzato in 3 secondi, «quanto viene la
pizza col pomodoro e mozzarella» → 7,50 € (la parola *margherita* non era nella domanda: la
ricerca è per significato), «fate il tiramisù senza uova?» → non inventa, gira la domanda al
titolare, e quando il titolare risponde quella risposta **entra in memoria per sempre**.

---

## FASE 3 — WhatsApp 🔑 IL CANALE

| Ordine | Funzione | Chiave | Stato |
|---|---|---|---|
| 19 | WhatsApp Business API: numero verificato e webhook | Meta Business | ✅ firma verificata, ripetizioni scartate |
| 20 | Ricezione e invio messaggi reali | Meta | ✅ il cliente scrive, l'agente risponde |
| 21 | Human-in-the-Loop: l'agente si ferma e ti chiama | — | ✅ interruttore «rispondo io» |
| 22 | Modalità Ghost: approvi le risposte prima dell'invio | — | 🔧 c'è la posta, manca l'approvazione |
| 23 | Agent Watchdog: blocca le risposte fuori dalle regole | — | |
| 24 | Notifiche al titolare (push, WhatsApp, email) | — | |
| 25 | Coda intelligente se la connessione salta | — | |
| 26 | Riconoscimento automatico della lingua del cliente | — | |
| 27 | Agent Pulse: riepilogo serale su WhatsApp | — | |
| 28 | Contatore Risparmio alimentato dai messaggi veri | — | |

**Fatto quando:** un cliente scrive al tuo numero e l'agente risponde da solo, corretto.

✅ **Il motore gira dall'8 Agosto 2026.** Provato in produzione con firma vera: stretta di
mano 200, firma falsa 401, «a che ora aprite domenica?» → risposta dell'agente in 6,6
secondi (0,000049 €), ripetizione di Meta scartata, interruttore «rispondo io» che registra
e tace. Manca solo l'ultimo passo, che è di Tommaso: incollare l'indirizzo del webhook nel
pannello Meta e scriverci dal telefono.

📬 **La posta WhatsApp sul sito — 8 Agosto 2026.** Chiesta da Tommaso appena il canale
ha risposto: *«nel sito ovviamente devi mettere la possibilità di ricordarsi le chat anche
su WhatsApp, deve essere tutto collegato»*. Dentro la Chat, accanto alle conversazioni del
sito — **non** una quarta voce di menu:

| Cosa | Come |
|---|---|
| Leggi le conversazioni coi clienti | elenco con non-letto, l'ultima riga in anteprima |
| Vedi **chi** ha risposto | sotto ogni messaggio: «l'agente» o «l'hai scritto tu» |
| Prendi in mano un cliente | interruttore per **singola conversazione**, non per tutto il numero |
| Rispondi tu | il messaggio parte davvero, il cliente non vede differenza |
| Quello che si dice diventa memoria | ogni 6 messaggi, o subito col pulsante |

⚠️ La memoria **era già una sola** (`search()` sugli stessi documenti da tutte e due i
lati): mancava solo che WhatsApp ci scrivesse dentro. Ora `indexText()` in `_lib/embed.ts`
è l'unica strada per entrarci — prima il salvataggio stava dentro `documents.ts` e sarebbe
diventato due copie destinate a divergere.

⚠️ Niente file nuovo in `api/`: la posta vive dentro `projects.ts`. Vercel Hobby ammette
**12 funzioni** e ne abbiamo esattamente 12 — un tredicesimo file non rompe il codice,
rompe il **deploy**.

⚠️ **Due difetti veri trovati provando, nessuno dei due visibile compilando.** Il webhook
rispondeva 200 e non salvava niente:
1. `channels` ha la sicurezza per riga, e il webhook la legge **prima** di sapere di chi è
   il numero. Fuori da `withUser()` la query non vedeva nulla → migrazione 0007,
   `resolve_wa_channel()`.
2. La risposta dell'agente veniva salvata con stato `"error"`, che il vincolo della 0002
   non ammette: eccezione, e la risposta spariva. Ora è `"failed"`.

⚠️ **Un terzo, trovato nella prima conversazione vera.** Tommaso ha scritto dal suo
telefono alle 17:52 dell'8 Agosto 2026 e ha chiesto «con chi parlo». L'agente ha risposto
*«l'assistenza di [nome attività]»* — un segnaposto, mandato a un cliente. Ora il prompt
di WhatsApp li vieta: senza il nome si dice «siamo qui», non si lascia il buco.

---

## FASE 4 — Vendere 🔑

| Ordine | Funzione | Chiave |
|---|---|---|
| 29 | Stripe: abbonamenti Starter / Pro / Enterprise | Stripe (serve P.IVA) |
| 30 | Wallet a crediti e ricariche rapide | Stripe |
| 31 | BYOK: l'utente mette la sua chiave OpenRouter | — |
| 32 | Fatturazione elettronica italiana (P.IVA, codice univoco, PEC) | Provider e-fattura |
| 33 | Alert di budget quando i token stanno finendo | — |
| 34 | Beta con negozi e ristoranti veri | — |

**Fatto quando:** un ristoratore paga con la carta e l'agente si attiva da solo.

---

## FASE 5 — Il tuo pannello admin

| Ordine | Funzione |
|---|---|
| 35 | MRR, ARR, fatturato netto vs lordo |
| 36 | Suddivisione incassi per piano, LTV, CAC, churn rate |
| 37 | Anagrafica utenti e aziende con ricerca |
| 38 | Profilo utente: iscrizione, connettori, token, pagamenti |
| 39 | Azioni admin: bannare, estendere, regalare un mese |
| 40 | Consumo token globale e classifica modelli più usati |
| 41 | Costo vivo API e margine per utente |
| 42 | Alert anomalie (picchi sospetti di consumo) |
| 43 | Stato connettori verde/rosso e uptime server |
| 44 | Broadcast email a tutti gli utenti |
| 45 | Feature flags per accendere e spegnere funzioni |
| 46 | Codici promo e coupon |
| 47 | Audit log completo |
| 48 | Ticket di supporto con stati |

---

## FASE 6 — Automazioni e connettori

| Ordine | Funzione |
|---|---|
| 49 | Editor visivo di flussi a nodi (drag and drop) |
| 50 | Trigger temporali (cron): "ogni venerdì alle 18 il report" |
| 51 | Trigger condizionali se/allora |
| 52 | Connettori ondata 1: Gmail, Google Calendar, Drive/Sheets |
| 53 | Connettori ondata 2: Shopify, WooCommerce, Stripe |
| 54 | Connettori ondata 3: Telegram, Instagram, Slack, Discord, Teams |
| 55 | Connettori ondata 4: Notion, Airtable, CRM, database SQL |
| 56 | Connettori ondata 5: Fatture in Cloud, Zucchetti, VIES, corrieri |
| 57 | Zapier e Make, webhook in uscita, API pubbliche + SDK |
| 58 | Sync bidirezionale in tempo reale |
| 59 | Smart-routing dei canali per complessità |
| 60 | Multi-channel fallback (SMS/email se WhatsApp non recapita) |
| 61 | Recupero carrelli abbandonati |
| 62 | Follow-up e nurturing automatico |
| 63 | Monitoraggio reputazione online e risposta alle recensioni |
| 64 | Smart Drive: archiviazione e rinomina automatica dei file |
| 65 | Scanner fatture e scontrini da fotocamera |
| 66 | Nexus Flash-Campaign (promozioni a tempo) |

---

## FASE 7 — Aziende e team

| Ordine | Funzione |
|---|---|
| 67 | Organizzazioni e workspace condivisi |
| 68 | Fino a 200 postazioni con contatore |
| 69 | RBAC: Owner, Admin, Agent Creator, Operator/Viewer |
| 70 | Inviti via email e revoca postazioni |
| 71 | Profilo aziendale: nome, logo, dominio verificato, settore |
| 72 | Budget cap e cost-cap per reparto |
| 73 | Multi-workspace a reparti stagni |
| 74 | SSO (Active Directory, Okta), 2FA forzato per admin |
| 75 | PII Masking automatico + masking personalizzato |
| 76 | No-training data agreements |
| 77 | Audit trail immutabile ed esportabile |
| 78 | Cancellazione dati a norma GDPR, log retention |
| 79 | IP whitelisting, timeout inattività |
| 80 | Vault crittografato zero-knowledge |
| 81 | Export certificato per il commercialista |
| 82 | Ghost Mode collaborativo, session recording |

---

## FASE 8 — Voce, immagini, video 🔑

| Ordine | Funzione | Chiave |
|---|---|---|
| 83 | Trascrizione note vocali WhatsApp | OpenAI Whisper |
| 84 | Risposte vocali su WhatsApp | ElevenLabs |
| 85 | Voice-clone aziendale | ElevenLabs |
| 86 | Modalità walkie-talkie in tempo reale | ElevenLabs |
| 87 | Chiamate telefoniche vocali | Twilio + ElevenLabs |
| 88 | Note vocali d'azienda (racconti l'attività, si autoconfigura) | Whisper |
| 89 | Voice-to-report giornaliero | Whisper |
| 90 | Generazione immagini in chat | OpenAI / Flux |
| 91 | Generazione video | Runway / Luma / Kling (il più caro) |

---

## FASE 9 — Crescita

| Ordine | Funzione |
|---|---|
| 92 | Multi-lingua UI (8 lingue core + traduttore dinamico) |
| 93 | Traduttore culturale incrociato |
| 94 | Nexus Store: marketplace di agenti con revenue share |
| 95 | White-label per agenzie (logo, colori, dominio) |
| 96 | White-label app mobile iOS/Android |
| 97 | Programma affiliazione Nexus Partner |
| 98 | Nexus Audit: check-up gratuito come lead magnet |
| 99 | Report di competitività automatizzati |
| 100 | Gamification e badge di efficienza |
| 101 | Licenze stagionali / pass temporanei |
| 102 | Widget incorporabile per siti web |
| 103 | Personalizzazioni estetiche avanzate (CSS, font, temi, Lottie) |
| 104 | A/B testing dei prompt, red teaming, certificazioni agenti |
| 105 | Multi-agent swarm, auto-healing dei prompt |
| 106 | Browser Conductor, Computer-Use |
| 107 | Desktop Electron |
| 108 | Play Store con Capacitor |

---

## Cosa dice questo elenco, onestamente

Le funzioni sono **108**. Le Fasi 0-3 (le prime 28) sono quelle che rendono il prodotto
vendibile: un ristoratore paga per quelle. Le Fasi 5-9 sono ciò che serve quando hai già
centinaia di clienti paganti — costruirle prima significa costruire per nessuno.

La Fase 0 è finita. La Fase 1 è il prossimo passo e cambia tutto: è dove il prodotto
smette di essere una bella interfaccia e inizia a funzionare.

**Per partire con la Fase 1 servono tre cose da te:**
1. Un progetto Neon (gratis) → [SETUP-DATABASE.md](SETUP-DATABASE.md)
2. Un account OpenRouter con 10-20 € di credito → [SETUP-OPENROUTER.md](SETUP-OPENROUTER.md)
3. Un client OAuth di Google per il login → [SETUP-ACCESSI.md](SETUP-ACCESSI.md)



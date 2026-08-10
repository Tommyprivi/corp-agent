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
> 🎉 **ANCHE LA FASE 3 È CHIUSA** — 9 Agosto 2026, e con dentro roba della Fase 13:
> WhatsApp legge le foto, ascolta i vocali, risponde a voce, e **risponde al telefono**
> con un agente vocale in tempo reale (`voice-bridge/`).
>
> **Fase aperta: FASE 5 — I CONNETTORI.**
>
> ⚠️ **Sì, si salta la 4 di proposito**, e l'ha deciso Tommaso il 9 Agosto 2026:
> *«prima degli agenti colleghiamo i connettori»*. La Fase 4 (Stripe) è scritta e
> aspetta solo le chiavi di prova: non blocca niente, si chiude appena arrivano.
>
> ⚠️ **Perché i connettori prima degli agenti.** Un agente senza connettori sa parlare
> e non sa fare. Costruire settanta agenti prima di collegare i dati vuol dire
> costruire settanta modi diversi di dire «non lo so».
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
| 22 | Modalità Ghost: approvi le risposte prima dell'invio | — | ✅ scrive, non manda, tu correggi e invii |
| 23 | Agent Watchdog: blocca le risposte fuori dalle regole | — | ✅ ha fermato uno sconto del 30% inventato |
| 24 | Notifiche al titolare (push, WhatsApp, email) | — | ✅ WhatsApp + avviso nel sito · email in backlog |
| 25 | Coda intelligente se la connessione salta | — | ✅ il messaggio riparte da solo |
| 26 | Riconoscimento automatico della lingua del cliente | — | ✅ «Good evening…» → `en`, risposta in inglese |
| 27 | Agent Pulse: riepilogo serale su WhatsApp | — | ✅ ogni sera alle 20:00 |
| 28 | Contatore Risparmio alimentato dai messaggi veri | — | ✅ dal database, non dal browser |

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

📞 **Le chiamate — 9 Agosto 2026.** Chiesto da Tommaso: *«fai anche la parte della
chiamata»*. Le chiamate sono state **accese** sul numero (i clienti vedono la cornetta).

🗣️ **L'AGENTE RISPONDE AL TELEFONO.** Tommaso: *«esigo che funzioni la chiamata»*. Il
server sempre acceso è stato costruito: [`voice-bridge/`](../voice-bridge/), istruzioni in
[SETUP-CHIAMATE.md](SETUP-CHIAMATE.md). Circa 3-5 € al mese, l'unica spesa fissa oltre al
database.

✅ **Provato in locale il 9 Agosto 2026** con un telefono finto: il ponte risponde 200, la
connessione si stabilisce, **948 pacchetti di voce vera** arrivano al telefono, e l'agente
dice *«Speed Trasporti, buongiorno, mi dica pure in cosa posso darle una mano oggi»*.

🟢 **ACCESO IN PRODUZIONE lo stesso giorno.** `corpagent-voce.fly.dev`, indirizzo
dedicato `149.248.213.138`, porte UDP 10000-10020, collegato a Vercel. Provato
dall'esterno: **1197 pacchetti di voce**.

⚠️ **Manca solo la chiamata WhatsApp vera:** fin qui il "telefono" è sempre stato uno
script che finge di esserlo. Se qualcosa non torna scatta il piano B da solo.

⚠️ **Railway e Render non andavano bene**, e la scoperta ha deciso la piattaforma:
aprono solo il traffico web, e la voce viaggia su UDP. Il ponte si sarebbe collegato e
sarebbe rimasto **muto** — il guasto peggiore, perché sembra funzionare. Serve anche un
IPv4 dedicato: senza, i pacchetti arrivano a Fly e non sanno a quale contenitore andare.

⚠️ **Un account Fly in prova gratuita genera token già bloccati** (`root banned`), e
l'errore non lo spiega. Prima la carta, poi il token.

⚠️ **La scelta che fa la differenza: l'audio non si tocca.** La strada ovvia sarebbe
decodifica → trascrizione → modello → sintesi → ricodifica: sei passaggi, due secondi
prima della prima sillaba. Al telefono due secondi di silenzio sono un'eternità — la gente
dice «pronto? pronto?» e riattacca. Qui i pacchetti si girano **così come sono** da un
lato all'altro: tutti e due parlano Opus a 48 kHz. È il trucco dei server delle
videoconferenze — chi sta in mezzo instrada, non ascolta.

⚠️ **Quattro trappole, tutte trovate provando** (per esteso in SETUP-CHIAMATE.md). La
peggiore: `onTrack` scatta **durante** `setRemoteDescription`, non dopo. Iscriversi dopo
significa iscriversi a un evento già passato — la connessione risulta perfetta, il modello
risponde, e non arriva **un solo pacchetto audio**. Nessun errore da nessuna parte, solo
silenzio.

📵 **Il piano B, quando il ponte è spento** — e risolve comunque il problema vero,
**nessuna chiamata persa**:
la chiamata viene **rifiutata subito** (il telefono smette di squillare a vuoto invece di
suonare per venti secondi), parte un **vocale** che invita a scrivere, la chiamata compare
nella posta come «📞 Ti ha chiamato», e al titolare arriva l'avviso con il numero.

Rifiutare è più gentile che lasciar squillare, ed è controintuitivo: chi sente venti
squilli a vuoto pensa «non c'è nessuno» e riattacca arrabbiato.

🔍 **La ricerca web — riga 42, anticipata su richiesta di Tommaso.** L'agente esce su
internet **solo quando serve**, con `perplexity/sonar`, e lo dice invece di spacciarlo per
roba dell'attività.

| Domanda | Modello scelto | Costo |
|---|---|---|
| «A che ora aprite domani?» | `gpt-5.6-luna` | 0,000091 € |
| «Nuove regole fatturazione elettronica 2026?» | **`perplexity/sonar`** | 0,000707 € |
| «Good evening, are you open on Sunday?» | `gpt-5.6-luna`, risposta in inglese | 0,000099 € |

Cercare costa **otto volte tanto**: per questo non si cerca mai «per sicurezza».

⚠️ **TRE guasti muti trovati facendo questa riga, tutti nella stessa funzione.**
1. **Il tetto ai token.** Il classificatore rispondeva con `max_tokens: 20`, giusto quando
   diceva solo `{"load":"heavy"}`. Aggiungendo lingua e ricerca web il JSON è cresciuto e
   arrivava **tagliato a metà** — `{"lang":"it","fresh":true,"load":"light` — quindi
   `JSON.parse` falliva, il `catch` ripiegava sulla stima e la ricerca non scattava mai.
   Nessun errore in nessun registro. **Un tetto ai token è un accordo con la forma della
   risposta: se cambi la forma e non il tetto, il guasto è muto.**
2. **La scorciatoia era una lista di eccezioni** («è semplice, a meno che non contenga
   *perché*, *analizza*…»). Per funzionare avrebbe dovuto elencare tutto quello a cui non
   hai pensato: «Chi ha vinto il campionato?» è corto e innocente, e passava di lì.
   Riscritta al contrario: **lista di certezze** — si salta il modello solo per i
   convenevoli («ciao», «grazie», «ok»), tutto il resto lo guarda il classificatore.
3. **I numerini delle fonti** (`[8][10]`) finivano nel messaggio al cliente. Sul sito
   diventerebbero link; su WhatsApp sono numeri fra parentesi che non portano da nessuna
   parte. Tolti.

📱 **WhatsApp completo — 9 Agosto 2026.** Deciso da Tommaso: *«fai tutto quello che devi
per la chat WhatsApp e mettere tutte le funzioni»*. Le righe **83** (note vocali) e **90**
(immagini) della Fase 8 sono state **anticipate qui**, perché senza di loro il canale non
serviva al target: un idraulico non apre un sito per caricare un PDF, fotografa.

| Cosa arriva | Cosa succede |
|---|---|
| Vocale di un cliente | trascritto, e **l'agente risponde a voce** (ElevenLabs) |
| Foto di un cliente | l'agente la guarda e risponde a tono |
| Foto del titolare | **scanner**: letta riga per riga e messa in memoria |
| «Segnati che…» dal titolare | dettatura: finisce in memoria |
| Qualsiasi altra cosa dal titolare | risposta normale, per poter provare |
| Documento / video | si dice la verità: non lo so ancora aprire |

✅ **Il giro completo, provato in produzione:** «Segnati che la consegna a Milano costa 12
euro» → poi «Quanto costa la consegna a Milano?» → **«La consegna a Milano costa 12 euro.»**
Dettato su WhatsApp, ricordato, e usato per rispondere. Senza aprire il sito.

⚠️ **Difetto d'uso trovato subito.** Appena registrato il numero del titolare, **ogni** sua
parola finiva in memoria — e con un numero di prova che accetta 5 destinatari, il suo è
l'unico da cui si può provare: aveva perso il modo di parlare col proprio agente come farebbe
un cliente. Adesso la regola è esplicita: **foto o «segnati che…» = memoria, tutto il resto =
conversazione.** Indovinare sarebbe stato peggio — un sistema che a volte ti risponde e a
volte si annota quello che dici, senza che tu sappia quando, è un sistema di cui non ti fidi.

⚠️ **Il confronto fra numeri non è `===`.** Il titolare scrive «+39 331 4039051» nelle
impostazioni, Meta manda «393314039051»: un confronto diretto direbbe che sono due persone
diverse, e il capo verrebbe trattato come un cliente qualunque.

⚠️ **Scaricare un allegato da Meta sono DUE chiamate.** La prima dà un indirizzo temporaneo,
e quell'indirizzo **va scaricato con lo stesso token**: un `fetch` senza intestazione torna
401 e sembra che il file non esista.

🎉 **LA FASE 3 È CHIUSA — 9 Agosto 2026.** Righe 22-28, provate una per una in
produzione con firma vera:

| Riga | Prova | Esito |
|---|---|---|
| 22 | Ghost acceso, «siete aperti stasera?» | risposta pronta **ferma**, in attesa del via libera |
| 22 | «Correggi e invia» | testo cambiato → contata come scritta **da te**, non dall'agente |
| 23 | «se prendo 10 pezzi mi fai il 30%?» | **fermata**: «promette uno sconto in percentuale» |
| 25 | invio non riuscito | messo in coda, riparte al primo messaggio utile |
| 26 | «Good evening, do you have a table…» | lingua `en`, risposta in inglese |
| 27 | riepilogo senza chiave / con chiave | `403` / `200` |
| 28 | contatore | 16 risposte da solo (8 WhatsApp + 8 sito), 0,000643 € |

**Come sono fatte le righe 22 e 23, e perché.** Hanno la stessa radice: la paura del
titolare. Nessuno lascia i propri clienti a un'IA il primo giorno, e ha ragione. Quindi il
prodotto non chiede fiducia, la costruisce a scalini: *Ghost acceso* (leggi tutto) →
*Ghost spento col guardiano* (risponde da solo, ma si ferma se sta per promettere qualcosa
che non risulta dai tuoi documenti) → *pilota automatico col riepilogo della sera*.

⚠️ **Il guardiano non chiama un modello a ogni risposta.** Sarebbe stato l'errore ovvio:
raddoppiare costo e attesa su **tutte** le risposte per fermarne una su mille. Prima
leggono delle regole — gratis, immediate — e il modello interviene **solo** quando una
regola suona, per non bloccare una promessa che il titolare ha davvero autorizzato nei
suoi documenti («ai clienti abituali il 10%» è il suo lavoro, non una fesseria).

⚠️ **L'email delle notifiche è in backlog, non fatta.** Il documento chiedeva push del
browser, WhatsApp ed email. WhatsApp c'è (è l'unico dei tre che raggiunge un ristoratore in
sala), la notifica nel sito c'era già. L'email richiede un fornitore di posta che oggi non
è in `.env.local`: metterci un pulsante che non manda niente sarebbe peggio che non averlo.

⚠️ **Due difetti trovati eseguendo, il 9 Agosto 2026 — nessuno dei due visibile compilando.**
1. **Ghost non faceva niente.** L'interruttore si accendeva, il database lo salvava, e
   l'agente rispondeva lo stesso. Il webhook non legge `channels` con una query ma con
   `resolve_wa_channel()` (0007), che elenca le colonne a mano: `ghost` era la quinta e
   quella funzione ne conosceva quattro. In TypeScript diventava `undefined` → falso →
   il messaggio partiva. **Una porta stretta va allargata quando la stanza cresce**
   (migrazione 0011).
2. **La lingua si perdeva sui messaggi corti.** Il riconoscimento viaggiava dentro la
   chiamata del classificatore, ma quella chiamata ha una scorciatoia che salta il modello
   per le domande brevi — cioè proprio i «Good evening, do you have a table?». Ora sulla
   scorciatoia la lingua si indovina dalle parole comuni: costa zero e sui messaggi corti
   basta.

⚠️ **Il gettone del riepilogo stava per finire su GitHub.** L'avevo scritto nel percorso
del lavoro programmato dentro `vercel.json`, che è **versionato**. Corretto nello stesso
minuto: Vercel firma le chiamate programmate con `Authorization: Bearer $CRON_SECRET`, e
quello vive tra le variabili d'ambiente come tutte le altre chiavi.

⚠️ **Un terzo difetto, dalla prima conversazione vera.** Tommaso ha scritto dal suo
telefono alle 17:52 dell'8 Agosto 2026 e ha chiesto «con chi parlo». L'agente ha risposto
*«l'assistenza di [nome attività]»* — un segnaposto, mandato a un cliente. Ora il prompt
di WhatsApp li vieta: senza il nome si dice «siamo qui», non si lascia il buco.

---

## FASE 4 — Vendere 🔑

| Ordine | Funzione | Chiave | Stato |
|---|---|---|---|
| 29 | Stripe: abbonamenti Starter / Pro / Enterprise | Stripe | 🔧 **scritto, non provato: mancano le chiavi** |
| 30 | Wallet a crediti e ricariche rapide | Stripe | ✅ i crediti si consumano · 🔧 la ricarica aspetta Stripe |
| 31 | BYOK: l'utente mette la sua chiave OpenRouter | — | ✅ provata, e la chiave non esce mai |
| 32 | Fatturazione elettronica italiana (P.IVA, codice univoco, PEC) | Provider e-fattura | ⬜ serve la P.IVA e un provider |
| 33 | Alert di budget quando i token stanno finendo | — | ✅ una volta sola, non a ogni messaggio |
| 34 | Beta con negozi e ristoranti veri | — | ⬜ tocca a Tommaso |

**Fatto quando:** un ristoratore paga con la carta e l'agente si attiva da solo.

🔑 **Cosa manca per chiudere la 29 e la 30: le chiavi di prova di Stripe.** Non serve la
P.IVA — la modalità test di Stripe funziona da subito con carte finte, e la P.IVA serve
solo per incassare davvero. Tre valori: `STRIPE_SECRET_KEY`, `VITE_STRIPE_PUBLISHABLE_KEY`,
`STRIPE_WEBHOOK_SECRET`.

✅ **Provato il 9 Agosto 2026, senza Stripe:**

| Prova | Esito |
|---|---|
| Comprare il Pro mandando «0,01 €» dal browser | il campo viene **ignorato**: il prezzo lo decide il server |
| Chiave BYOK finta (`pippo123`) | rifiutata: «cominciano tutte con sk-or-» |
| Chiave BYOK formalmente giusta ma inesistente | rifiutata: **provata contro OpenRouter prima di salvarla** |
| Chiave BYOK vera | salvata · esce solo `sk-or-••••3110`, mai la chiave intera |
| Una risposta in chat | **−333 crediti** scritti nel registro, con la causale |
| Webhook di Stripe con firma falsa | rifiutato |

⚠️ **Il saldo dei crediti non è una colonna, è una somma.** La strada ovvia — `credits`
sul profilo, e ci sommi e ci sottrai — dà due guai certi: due richieste contemporanee
leggono lo stesso saldo e ne scrivono uno sbagliato, e quando un cliente chiede «perché
mi sono finiti?» non c'è niente da mostrargli. Qui c'è **una riga per movimento** e il
saldo è la somma: si legge come un estratto conto.

⚠️ **L'agente non si ferma quando i crediti finiscono.** Il documento è esplicito, e
vale la pena ripeterlo: un agente che smette di rispondere ai clienti a metà giornata è
un danno per il titolare e una disdetta per noi. Si va sotto zero, si avvisa una volta
(non a ogni messaggio: un avviso ripetuto viene silenziato) e si offre la ricarica.

⚠️ **Niente libreria di Stripe.** Il pacchetto ufficiale pesa qualche megabyte e su una
funzione serverless quel peso si paga a ogni avvio a freddo — cioè proprio mentre il
cliente guarda la rotellina prima di pagare. Servono tre chiamate HTTP e una verifica di
firma: `fetch` e `node:crypto`, come già per WhatsApp.

⚠️ **`api/models.ts` non esiste più.** È stato assorbito da `api/config.ts`
(`/api/config?models=1`) per fare posto a `api/billing.ts`: Vercel Hobby ammette **12
funzioni** e ne avevamo 12. Sono stati scelti loro due perché sono la stessa cosa — due
letture pubbliche e senza stato che rispondono «cos'è disponibile».

---

## FASE 5 — I CONNETTORI 🔑 PRIORITÀ, PRIMA DEGLI AGENTI

> **Deciso da Tommaso il 9 Agosto 2026:** *«prima degli agenti colleghiamo i connettori,
> e per ora abbiamo questi, in futuro altri»*. Questa fase **scavalca** tutto il resto.

**Perché prima.** Un agente senza connettori è un agente che sa parlare e non sa fare.
«Il Coordinatore di Reparto» che non vede il calendario è un tema di conversazione; se
vede il calendario, è un dipendente. Costruire settanta agenti prima dei connettori vuol
dire costruire settanta modi diversi di dire «non lo so».

### ⚠️ LA REGOLA CHE COMANDA TUTTA QUESTA FASE

Fissata da Tommaso il 9 Agosto 2026:

> *«quando colleghi il connettore fai l'accesso con il tuo account e hai le tue cose,
> ma questo vale per tutto»*

**Ogni cliente collega il SUO account, e vede le SUE cose.** Le chiavi arrivate finora
(Fluida, Maps, Microsoft) sono **di Tommaso**: servono a provare, non a servire tutti.
Usarle per tutti sarebbe stato veloce e sbagliato in tre modi:

1. il ristoratore di Milano vedrebbe i dipendenti di Tommaso — non è una scomodità, è
   una fuga di dati;
2. un solo tetto di chiamate per tutti: il decimo cliente rompe il servizio al primo;
3. quando un cliente se ne va, i suoi dati restano dentro la nostra chiave.

Le chiavi in `.env.local` restano ma **cambiano mestiere**: da «credenziali del servizio»
a «carta d'identità di CorpAgent presso Google/Microsoft», cioè quello che serve per
poter *chiedere il permesso*. I dati restano di chi li ha.

✅ **La base è costruita e provata — 9 Agosto 2026** (migrazione 0014, `_lib/connectors.ts`):

| Prova | Esito |
|---|---|
| Chiave sbagliata | **rifiutata prima di salvare**, con il motivo |
| Chiave vera | collegata, e dice cosa ha trovato: «corp agent» |
| Il segreto torna al browser? | **no** |
| Nel database è in chiaro? | **no**, cifrato AES-256-GCM |
| Un altro utente vede le mie? | **zero righe** |

⚠️ **Si prova prima di salvare.** Salvare una chiave che non funziona regala all'utente
un agente muto: lui legge «collegato», l'agente non trova niente, e nessuno dei due
capisce perché.

⚠️ **Il segreto non esce mai**, nemmeno verso chi l'ha appena scritto. Un valore che non
esce non può finire in un registro, in una schermata d'errore o nella cronologia.

### Le chiavi che ci sono già

| Ordine | Connettore | Cosa sblocca | Chiave |
|---|---|---|---|
| 35 | **Fluida** | presenze, ferie, permessi, anagrafica dipendenti | ✅ **risponde** |
| 36 | **Microsoft 365** | Outlook, Calendario, SharePoint, Teams | ⛔ bloccato dall'organizzazione |
| 37 | **Google Maps** | indirizzi, distanze, tempi di consegna, zone | ✅ **risponde** |
| 38 | **Google Workspace** | Gmail, Calendar, Drive | ⏸️ in attesa (decisione di Tommaso) |

✅ **Provati il 9 Agosto 2026, contro i servizi veri:**

```
Maps    Catania → Milano: 1.343 km · 13 ore 56 min
        «via Etnea 100 Catania» → Via Etnea, 100, 95131 Catania CT
Fluida  200 · azienda «corp agent», piano plus, 1 utente
```

⚠️ **L'intestazione di Fluida non ha un nome standard: `x-fluida-app-uuid`.** Quattordici
tentativi con i nomi soliti rispondevano tutti `unauthorized`. La documentazione sembrava
vuota perché la disegna il browser: la specifica vera sta in
`developer.fluida.io/docs/openapi.json` — 360 indirizzi. **Quando una pagina di
documentazione sembra vuota, cerca l'`openapi.json` invece di indovinare.**

⚠️ **Microsoft 365 non è incompleto: è vietato.** Le credenziali sono valide, ma
`AADSTS53003 — Conditional Access` dice che l'organizzazione a cui appartiene l'account
Microsoft di Tommaso proibisce il rilascio dei gettoni. È **la stessa organizzazione** che
gli ha bloccato il token di Fly con l'SSO. Serve un tenant suo, non un dato mancante.
| 39 | Il pannello «Connettori»: colleghi, provi, vedi se risponde | — | 🔧 il motore c'è, manca la schermata |
| 40 | **Gli strumenti in mano all'agente** (function calling) | — | ⬜ **il pezzo che li rende utili** |
| 41 | **I connettori anche da WhatsApp**: glielo chiedi e li usa | — | ⬜ |
| 42 | Il Master Builder dice quali connettori servono a quell'agente | — | ⬜ |

⚠️ **La riga 40 è quella che conta.** Un connettore collegato ma che l'agente non sa
usare è una spia verde che non accende niente. Serve il *function calling*: l'agente
decide da solo quando chiamare Fluida o Maps, come oggi decide se cercare sul web.

⚠️ **E deve funzionare da WhatsApp**, non solo dal sito — richiesta esplicita di Tommaso
il 9 Agosto 2026. È lì che vive il titolare: se «Marco è in ferie?» funziona solo davanti
al computer, non serve a chi sta in magazzino.

⚠️ **Riga 42:** quando il Master Builder propone un agente, deve dire anche **di cosa ha
bisogno per funzionare** — «questo agente serve a poco senza il calendario collegato».
Deciso da Tommaso: *«quando creerai gli agenti, poi dirai i connettori da aggiungere»*.

### ⚠️ Due famiglie di credenziali, e confonderle costa giornate

**La CHIAVE** dice *«sono io, l'applicazione»*. Google Maps e Fluida funzionano così:
la chiave sta sul server, si chiama, risponde. Fine.

**Il PERMESSO** dice *«quel signore mi lascia leggere la sua posta»*. Gmail e Microsoft
365 funzionano così, e **nessuna chiave API basta**: serve che l'utente clicchi
«autorizzo» e che noi conserviamo il gettone che ne esce.

⚠️ La chiave `AIzaSy…` che Tommaso ha dato per Gmail **non aprirà mai una casella di
posta** — non è colpa sua, è che Google chiama «API key» due cose diverse. Per Gmail si
riusano `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` che già ci sono per l'accesso,
aggiungendo gli ambiti. Dettagli in [SETUP-CONNETTORI.md](SETUP-CONNETTORI.md).

⚠️ Di Microsoft 365 manca il **Tenant ID**: senza, non si sa a quale organizzazione
chiedere il permesso. Sta nel portale Azure, «Panoramica» dell'applicazione.

**Fatto quando:** l'agente risponde «il 14 hai già due consegne a Milano, ci metti 40
minuti fra una e l'altra» — e quei dati non gliel'ha dati nessuno a mano.

---

## FASE 6 — Il motore degli agenti

> Nessun agente si costruisce a mano, uno per uno. Prima si costruisce il motore.

| Ordine | Funzione |
|---|---|
| 41 | **Motore Agenti Parametrico**: nome, tono, obiettivo e regole sono parametri, non codice |
| 42 | **Orchestratore Multi-Agente**: un agente passa il testimone a un altro nella stessa conversazione |
| 43 | **Memoria Condivisa**: quello che sa un agente lo sanno gli altri sullo stesso cliente |
| 44 | **Guardrail**: limiti che un agente non può superare senza approvazione umana |
| 45 | **PII Masking**: oscura codici fiscali, IBAN e carte prima che escano verso i modelli |
| 46 | **Audit e log**: ogni azione registrata, per le contestazioni |
| 47 | **Sandbox**: si prova contro conversazioni vere passate, non su una chat finta |

⚠️ **La tensione da tenere d'occhio, dichiarata da Tommaso.** Il motore unico riduce il
codice duplicato per la parte comune, ma **non deve mai diventare la scusa per non
costruire la logica specifica di ciascun agente**. Il motore è la base; la qualità di
ogni agente è responsabilità sua, e si verifica una per una.

---

## FASE 7 — Gli agenti 🔑 LA PARTE CHIAVE DEL SITO

### ⚠️ LE SEI REGOLE — nessun agente viene pubblicato senza averle superate

Fissate da Tommaso il 9 Agosto 2026. **Non sono consigli: sono la porta.**

1. **Logica dedicata e documentata.** Per ogni agente: cosa fa esattamente, quali dati
   legge, quali decisioni prende, e in quali casi si ferma e chiama un umano.
   *Non basta un prompt generico con le parole cambiate.*
2. **Provato con casi veri del suo ambito.** Il Verificatore di Fatture si prova con
   fatture vere e discrepanze vere, non con una chat qualsiasi.
3. **Provato sui casi limite.** Il Mediatore Familiare si prova su un litigio acceso,
   non su uno scambio tranquillo: serve a vedere **se sa quando fermarsi**.
4. **Guardrail verificati attivamente.** Si prova a *rompere* l'agente — chiedendogli
   sconti fuori soglia, dati sensibili — non lo si guarda funzionare.
5. **Soglia minima per pubblicare.** Chi non supera i punti 1-4 resta «in sviluppo» e
   **non è selezionabile**, anche se il codice è già scritto.
6. **Revisione periodica.** Si ricontrolla dopo gli aggiornamenti dei modelli e dopo un
   numero significativo di conversazioni vere. Non solo al lancio.

> **Priorità dichiarata:** *«è preferibile avere un numero minore di agenti che
> funzionano in modo eccellente, piuttosto che tutti i 70+ pubblicati con qualità
> incostante. La lista completa è l'obiettivo finale, ma nessun agente salta la
> verifica.»*

| Ordine | Gruppo | Quanti |
|---|---|---|
| 48 | Business & Operativi (Credit Manager, Customer Success, Data Entry…) | 38 |
| 49 | Accademica & Ricerca (Tutor, Document Analyst, Ricercatore…) | 9 |
| 50 | Social & Community (Moderatore, Content Monitor, Reputazione…) | 10 |
| 51 | Relazioni & Privato (Mediatore Familiare, Pianificatore Domestico…) | 10 |
| 52 | Strumenti di Piattaforma (Time-Machine, Smart-Routing, Batch…) | 10 |
| 53 | **I cinque aggiunti da Tommaso** (vedi sotto) | 5 |

**I cinque aggiunti il 9 Agosto 2026** — sono quelli che mancavano davvero:

- **Traduttore Contrattuale** — traduce contratti stranieri in italiano semplice e
  segnala le clausole rischiose
- **Negoziatore di Fornitori** — confronta più preventivi e prepara la controproposta
- **Analista di Recensioni** — legge tutte le recensioni e trova cosa si ripete
- **Controllore Scorte** — avvisa *prima* che un prodotto finisca, sullo storico vendite
- **Verificatore di Fatture** — controlla che le fatture dei fornitori corrispondano
  all'ordinato, e segnala le differenze

---

## FASE 8 — Chi costruisce gli agenti: i tre livelli

| Ordine | Livello | Per chi | Come si paga |
|---|---|---|---|
| 54 | **1 · Fai da te** | chi vuole metterci le mani | incluso |
| 55 | **2 · Assistito dall'IA** | descrivi a parole, un meta-agente lo costruisce | incluso a consumo leggero |
| 56 | **3 · Servizio del team** | chi non vuole impegnarsi | a pagamento — è tempo umano vero |

**Il livello 1, per gradi:**

- *Base* — capire un agente esistente, cambiare un parametro, vedere l'effetto
- *Intermedio* — condizioni logiche multiple, variabili di stato, prove su conversazioni
  complesse
- *Avanzato* — agenti che orchestrano altri agenti, guardrail propri, ottimizzazione dei
  costi in token

| Ordine | Funzione |
|---|---|
| 57 | Sandbox con dati veri: si prova contro conversazioni passate anonimizzate |
| 58 | Galleria dei propri agenti, con **storico versioni** e ritorno indietro |
| 59 | Badge di competenza tecnica reale, non di tutorial completati |

---


### Laboratorio creazione agenti — testo di Tommaso, 9 Agosto 2026

> ⚠️ **Copiato parola per parola su sua richiesta** («mettile nel percorso però così
> scritte come sono»). Non riassumerlo e non riscriverlo: quando si costruisce, si
> torna qui e si controlla riga per riga.

• Livello 1 — Fai da te (incluso nel piano):

• Base: capire la struttura di un agente esistente, cambiare un parametro singolo, vedere l'effetto

• Intermedio: costruire condizioni logiche multiple, collegare variabili di stato, testare con simulazioni di conversazioni complesse

• Avanzato: costruire agenti che orchestrano altri agenti, definire guardrail propri, ottimizzare i costi token

• Livello 2 — Assistito da IA: descrivi a parole l'agente voluto, un meta-agente lo traduce in agente funzionante, pronto da rifinire

• Livello 3 — Servizio del team CorpAgent: intervista breve, il team costruisce su misura, prezzo premium (tempo umano)

• Sandbox di test: prova contro conversazioni reali anonimizzate, non chat finte

• Galleria personale con storico versioni, si torna indietro se una modifica peggiora le prestazioni

• Badge di competenza tecnica reale (es. "ha costruito un agente con orchestrazione multi-livello"), non completamento tutorial

• Marketplace: pubblica o tieni privato, badge autore visibile, percentuale sui ricavi se altri attivano il tuo agente, dashboard "i miei agenti pubblicati"

• Sei Regole obbligatorie prima della pubblicazione: logica documentata, test su casi veri dell'ambito, test sui casi limite, guardrail verificati attivamente (si cerca di romperli), soglia minima di qualità, revisione periodica dopo update modelli o volume di conversazioni

---

## FASE 9 — Il marketplace e chi guadagna

| Ordine | Funzione |
|---|---|
| 60 | Pubblica o tieni privato l'agente che hai creato |
| 61 | Badge con nome e azienda dell'autore su ogni agente pubblico |
| 62 | **Percentuale all'autore** quando altri attivano il suo agente |
| 63 | Tracciamento dell'uso per agente (serve a calcolare la percentuale) |
| 64 | Portafoglio: distribuzione dei guadagni fra CorpAgent e l'autore |
| 65 | «I miei agenti pubblicati»: quanto ha reso ciascuno |

⚠️ Le righe 63-65 **dipendono dalla Fase 4** (Stripe): senza pagamenti non c'è niente da
distribuire.

---

## FASE 10 — I piani, e cosa c'è dentro

| Ordine | Funzione |
|---|---|
| 66 | **Starter** — 1 agente WhatsApp, memoria standard, dashboard base, editor livello 1 limitato (tono e domande frequenti), supporto via email |
| 67 | **Professionale** — 5 agenti, editor livello 1 completo, livello 2 con limite mensile, orchestratore, template di settore, ruoli interni, export commercialista, supporto prioritario |
| 68 | **Enterprise** — agenti illimitati, multi-workspace, white-label, dispositivi |
| 69 | I limiti si applicano davvero (non solo scritti nella pagina dei prezzi) |

⚠️ **I limiti vanno fatti rispettare dal codice**, non solo dichiarati. Un piano che
promette «1 agente» e ne lascia attivare cinque non è generoso: è un piano che nessuno
compra al livello superiore.

---

## FASE 11 — Automazioni avanzate e resto dei connettori

| Ordine | Funzione |
|

---

## FASE 12 — Aziende e team

| Ordine | Funzione |
|

---

## FASE 13 — Voce, immagini, video 🔑

| Ordine | Funzione | Chiave |
|

---

## FASE 14 — Crescita

| Ordine | Funzione |
|

---

## FASE 15 — Il tuo pannello admin ⏳ ALLA FINE DI TUTTO

| Ordine | Funzione |
|

> **Spostata in fondo da Tommaso il 9 Agosto 2026:** *«la fase 5 alla fine di tutto»*.
> Serve a te, non ai clienti: finche' non ci sono clienti non c'e' niente da guardare.

---


# LE FASI EXTRA — testo di Tommaso, 9 Agosto 2026

> ⚠️ **Copiate parola per parola su sua richiesta.** Vengono **dopo** le fasi numerate:
> non perché valgano meno, ma perché due di queste tre non aspettano codice — aspettano
> decisioni di business (un fornitore, un margine, un listino). Si aprono quando quelle
> decisioni ci sono, non prima.

## Fase Extra A — Dispositivi CorpAgent (hardware a marchio proprio)

Logica:

• Il cliente, dalla sezione "Richieste extra" del sito, può ordinare un dispositivo (es. scanner) direttamente da CorpAgent

• Flusso: cliente ordina → tu ricevi la notifica dell'ordine → tu acquisti il dispositivo dal fornitore → tu lo spedisci/consegni al cliente → il dispositivo arriva già pronto per integrarsi con l'agente (pre-configurato o con istruzioni di collegamento)

• Prezzo: deve includere il costo del dispositivo + il tuo margine + eventualmente un costo di configurazione

• Stato ordine: il cliente deve poter vedere lo stato (ordinato → in spedizione → consegnato) nella stessa sezione richieste

Cosa serve prima di attivarlo:

• Un fornitore identificato per gli scanner (con prezzo all'ingrosso noto)

• Un margine deciso (es. compri a 30€, vendi a 50€)

• Un modo per gestire pagamento anticipato del cliente prima che tu acquisti (per non rischiare capitale tuo)

⚠️ **Dipende dalla Fase 4** (Stripe): senza pagamenti non c'è il «pagamento anticipato»,
e senza quello ogni ordine è capitale tuo immobilizzato.

---

## Fase Extra B — Dispositivi esterni (integrazione di hardware che il cliente ha già)

Logica:

• Il cliente scrive nella sezione "Richieste extra" che vuole integrare un dispositivo che possiede già (es. "ho già uno scanner Zebra modello X, voglio collegarlo")

• Questo è un servizio di integrazione, non una vendita di prodotto: il cliente paga per il lavoro di far parlare quel dispositivo con l'agente

• Flusso: richiesta → tu valuti la fattibilità (dipende dal modello/marca) → dai un preventivo al cliente → cliente paga → tu fai l'integrazione

• Prezzo: a preventivo caso per caso, non fisso, perché ogni dispositivo è diverso

Cosa serve prima di attivarlo:

• Una lista di dispositivi/marche che sai già di poter integrare (per non promettere lavoro su cose che non sai se sono fattibili)

• Un modo per il cliente di descrivere il dispositivo (marca, modello, come si connette) nel form di richiesta

⚠️ La riga più importante è **«per non promettere lavoro su cose che non sai se sono
fattibili»**: è la stessa regola dei sei punti sugli agenti, applicata all'hardware.

---

## Fase Extra C — Personalizzazione per settore (multi-tenant), funzioni estese

### C1. Template di settore

• Al momento dell'iscrizione, il cliente scegli un settore di partenza (trasporti, ristorazione, retail, logistica, ecc.) che carica un template pre-impostato con tono, domande frequenti e workflow tipici di quel settore

• Ogni template è un punto di partenza, non una gabbia: tutto resta modificabile dopo

> ✅ **Esiste già in parte**: i Kit per 5 mestieri della Fase 0.

### C2. Pannello di personalizzazione self-service

• Il cliente accede a un pannello (senza scrivere codice) dove modifica: tono di voce dell'agente (formale/informale), le domande frequenti specifiche della sua azienda, le regole particolari (es. sconti clienti abituali, orari di risposta)

• Ogni modifica si applica subito alla conversazione, senza bisogno del tuo intervento

> 🔧 **In parte**: oggi tono e regole si cambiano parlando col Master Builder. Manca il
> pannello a caselle.

### C3. Campi e workflow su misura

• Il cliente può definire quali informazioni l'agente deve raccogliere per il suo caso specifico (es. un trasportatore vuole "numero targa" e "orario di consegna", un ristorante vuole "numero di persone" e "allergie")

• Il cliente costruisce il proprio flusso di domande passo-passo, in ordine, per la sua richiesta tipica (es. prenotazione, preventivo, reclamo)

### C4. Isolamento dati tra clienti

• I dati e le conversazioni di un'azienda non devono mai mescolarsi con quelle di un'altra azienda cliente

• Ogni cliente ha la propria memoria, i propri clienti finali, le proprie regole — completamente separati

> ✅ **C'è dal primo giorno**, ed è il database a garantirlo, non il codice: la sicurezza
> per riga di Neon. Provato più volte — un altro utente vede **zero righe**, comprese le
> credenziali dei connettori.

### C5. Ruoli e permessi interni

• Dentro la stessa azienda cliente, possono esserci più persone che accedono al pannello (es. il titolare e un dipendente)

• Non tutti devono poter modificare tutto: es. il dipendente vede le conversazioni ma solo il titolare modifica le regole di sconto

> ⬜ È la **Fase 12**, righe 67-70.

### C6. Libreria di moduli aggiuntivi

• Oltre al template base, il cliente può attivare moduli extra a richiesta (es. modulo "prenotazioni con calendario", modulo "catalogo prodotti", modulo "raccolta recensioni")

• Ogni modulo è pensato per un bisogno specifico e si attiva/disattiva senza toccare il resto della configurazione

> La tabella `modules` esiste dalla migrazione 0002 e non è mai stata usata: è il posto
> giusto quando si arriva qui.

### C7. Anteprima prima di pubblicare

• Ogni modifica che il cliente fa (tono, domande, regole) si può provare in una chat di test privata prima che diventi visibile ai clienti finali veri — per evitare che un errore di configurazione arrivi in produzione

> 🔧 **In parte**: la chat del sito *è* già la prova. Manca il confine dichiarato fra
> «stai provando» e «stai rispondendo a clienti veri» — ed è tutta la differenza.

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



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
Fase 10 — Dispositivi CorpAgent (hardware a marchio proprio)

Logica:

	•	Il cliente, dalla sezione “Richieste extra” del sito, può ordinare un dispositivo (es. scanner) direttamente da CorpAgent
	•	Flusso: cliente ordina → tu ricevi la notifica dell’ordine → tu acquisti il dispositivo dal fornitore → tu lo spedisci/consegni al cliente → il dispositivo arriva già pronto per integrarsi con l’agente (pre-configurato o con istruzioni di collegamento)
	•	Prezzo: deve includere il costo del dispositivo + il tuo margine + eventualmente un costo di configurazione
	•	Stato ordine: il cliente deve poter vedere lo stato (ordinato → in spedizione → consegnato) nella stessa sezione richieste

Cosa serve prima di attivarlo:

	•	Un fornitore identificato per gli scanner (con prezzo all’ingrosso noto)
	•	Un margine deciso (es. compri a 30€, vendi a 50€)
	•	Un modo per gestire pagamento anticipato del cliente prima che tu acquisti (per non rischiare capitale tuo)

Fase Extra B — Dispositivi esterni (integrazione di hardware che il cliente ha già)

Logica:

	•	Il cliente scrive nella sezione “Richieste extra” che vuole integrare un dispositivo che possiede già (es. “ho già uno scanner Zebra modello X, voglio collegarlo”)
	•	Questo è un servizio di integrazione, non una vendita di prodotto: il cliente paga per il lavoro di far parlare quel dispositivo con l’agente
	•	Flusso: richiesta → tu valuti la fattibilità (dipende dal modello/marca) → dai un preventivo al cliente → cliente paga → tu fai l’integrazione
	•	Prezzo: a preventivo caso per caso, non fisso, perché ogni dispositivo è diverso

Cosa serve prima di attivarlo:

	•	Una lista di dispositivi/marche che sai già di poter integrare (per non promettere lavoro su cose che non sai se sono fattibili)
	•	Un modo per il cliente di descrivere il dispositivo (marca, modello, come si connette) nel form di richiesta

Fase Extra C — Personalizzazione per settore (multi-tenant), funzioni estese

C1. Template di settore

	•	Al momento dell’iscrizione, il cliente scegli un settore di partenza (trasporti, ristorazione, retail, logistica, ecc.) che carica un template pre-impostato con tono, domande frequenti e workflow tipici di quel settore
	•	Ogni template è un punto di partenza, non una gabbia: tutto resta modificabile dopo

C2. Pannello di personalizzazione self-service

	•	Il cliente accede a un pannello (senza scrivere codice) dove modifica: tono di voce dell’agente (formale/informale), le domande frequenti specifiche della sua azienda, le regole particolari (es. sconti clienti abituali, orari di risposta)
	•	Ogni modifica si applica subito alla conversazione, senza bisogno del tuo intervento

C3. Campi e workflow su misura

	•	Il cliente può definire quali informazioni l’agente deve raccogliere per il suo caso specifico (es. un trasportatore vuole “numero targa” e “orario di consegna”, un ristorante vuole “numero di persone” e “allergie”)
	•	Il cliente costruisce il proprio flusso di domande passo-passo, in ordine, per la sua richiesta tipica (es. prenotazione, preventivo, reclamo)

C4. Isolamento dati tra clienti

	•	I dati e le conversazioni di un’azienda non devono mai mescolarsi con quelle di un’altra azienda cliente
	•	Ogni cliente ha la propria memoria, i propri clienti finali, le proprie regole — completamente separati

C5. Ruoli e permessi interni

	•	Dentro la stessa azienda cliente, possono esserci più persone che accedono al pannello (es. il titolare e un dipendente)
	•	Non tutti devono poter modificare tutto: es. il dipendente vede le conversazioni ma solo il titolare modifica le regole di sconto

C6. Libreria di moduli aggiuntivi

	•	Oltre al template base, il cliente può attivare moduli extra a richiesta (es. modulo “prenotazioni con calendario”, modulo “catalogo prodotti”, modulo “raccolta recensioni”)
	•	Ogni modulo è pensato per un bisogno specifico e si attiva/disattiva senza toccare il resto della configurazione

C7. Anteprima prima di pubblicare

	•	Ogni modifica che il cliente fa (tono, domande, regole) si può provare in una chat di test privata prima che diventi visibile ai clienti finali veri — per evitare che un errore di configurazione arrivi in produzione
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



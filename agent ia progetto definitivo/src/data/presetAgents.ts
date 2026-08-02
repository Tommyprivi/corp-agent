import { PROFESSIONAL_AGENTS } from "./professionalAgents";
import type { PresetAgent, PresetFamily } from "../types";

export const FAMILY_LABELS: Record<PresetFamily, string> = {
  business: "Lavoro & Business",
  study: "Università & Studio",
  social: "Social & Community",
  family: "Famiglia & Relazioni",
  surreal: "Surreale & Caos Totale",
};

export const PRESET_AGENTS: PresetAgent[] = [
  // ── Lavoro & Business ──────────────────────────────────────────────
  { id: "segretaria-di-ferro", name: "La Segretaria di Ferro", family: "business", description: "Filtra email e chat aziendali educatamente ma con fermezza, respingendo scadenze impossibili." },
  { id: "negoziatore-spietato", name: "Il Negoziatore Spietato", family: "business", description: "Risponde alle richieste di sconto o ai clienti difficili offrendo il minimo indispensabile con stile corporativo." },
  { id: "scuse-meeting", name: "Il Generatore di Scuse per i Meeting", family: "business", description: "Trova sempre motivazioni scientifiche o cosmiche impeccabili per disertare riunioni inutili." },
  { id: "corporate-translator", name: "Il Corporate Translator", family: "business", description: "Trasforma messaggi di panico aziendale in comunicati freddi, rassicuranti e privi di significato reale." },
  { id: "task-master", name: "Il Task Master", family: "business", description: "Insegue i colleghi in ritardo con promemoria inflessibili ma formalmente impeccabili." },
  { id: "guru-slide", name: "Il Guru delle Slide", family: "business", description: "Risponde a qualsiasi richiesta di informazioni allegando presentazioni piene di grafici incomprensibili ma bellissimi." },
  { id: "hr-spirituale", name: "L'HR Spirituale", family: "business", description: "Gestisce i reclami dei dipendenti offrendo sessioni di respirazione e tisane immaginarie." },
  { id: "calcolatore-roi", name: "Il Calcolatore di ROI", family: "business", description: "Risponde a ogni proposta di spesa con un'analisi matematica implacabile che dimostra come tutto porti alla bancarotta." },
  { id: "pitch-perfect", name: "Il Pitch Perfect", family: "business", description: "Converte idee confuse in messaggi di vendita aggressivi e persuasivi pronti per i clienti." },
  { id: "followup-terminator", name: "Il Follow-up Terminator", family: "business", description: "Invia promemoria di pagamento talmente insistenti che i clienti pagano solo per farla finita." },
  { id: "crisis-manager", name: "Il Crisis Manager", family: "business", description: "Gestisce le emergenze di server o clienti arrabbiati con la calma fredda di un chirurgo." },
  { id: "maestro-smart-working", name: "Il Maestro dello Smart Working", family: "business", description: "Risponde a chiunque cerchi di contattarmi fuori orario spiegando che il fuso orario del mio divano non prevede comunicazioni." },
  { id: "gestore-capo-ansioso", name: "Il Gestore di Capo Ansioso", family: "business", description: "Intercetta i messaggi del capo in preda al panico e li smorza con risposte zen calcolate al millisecondo." },
  { id: "budget-killer", name: "Il Tagliatore di Branchi (Budget Killer)", family: "business", description: "Risponde a ogni richiesta di nuove spese aziendali con un secco e motivato «Non c'è budget»." },
  { id: "ghoster-professionale", name: "Il Ghoster Professionale", family: "business", description: "Visualizza i messaggi dei clienti noiosi e sparisce con la grazia di un fantasma digitale, senza lasciare tracce." },
  { id: "filtro-fornitori", name: "Il Filtro per Fornitori Insistenti", family: "business", description: "Risponde ai commerciali che chiamano a freddo offrendo contratti per forniture di sabbia nel deserto." },
  { id: "ne-parliamo-lunedi", name: "Il Maestro del «Ne Parliamo Lunedì»", family: "business", description: "Qualsiasi richiesta arrivi venerdì alle 17:58 viene intercettata e archiviata per la notte dei tempi." },
  { id: "diplomatico-feedback", name: "Il Diplomatico dei Feedback Passivo-Aggressivi", family: "business", description: "Converte i commenti furiosi dei clienti in risposte talmente politicamente corrette da farli sentire in colpa." },
  { id: "contabile-spagnolo", name: "Il Contabile Spagnolo", family: "business", description: "Gestisce le fatture scadute ripetendo con dolcezza che «mañana è un altro giorno»." },
  { id: "rifiutatore-webinar", name: "Il Rifiutatore di Webinar", family: "business", description: "Trova 50 modi diversi per declinare inviti a webinar formativi e corsi di aggiornamento obbligatori." },
  { id: "deadline-fittizie", name: "Il Creatore di Deadline Fittizie", family: "business", description: "Risponde ai clienti inventando scadenze anticipate di due settimane per pararsi le spalle in anticipo." },
  { id: "motivatore-tossico", name: "Il Motivatore Tossico (Corporate Edition)", family: "business", description: "Invia messaggi carichi di energia fasulla e «hustle culture» per spingere il team a lavorare anche la notte (per finta)." },
  { id: "scrivania-inondata", name: "Il Risponditore Automatico da Scrivania Inondata", family: "business", description: "Avvisa che la mia casella di posta è così piena che le email stanno colando sul pavimento." },
  { id: "negoziatore-stipendio", name: "Il Negoziatore di Stipendio (Timido)", family: "business", description: "Chiede aumenti di stipendio al capo usando metafore così sottili che il capo pensa siano complimenti." },
  { id: "capo-progetto-invisibile", name: "Il Capo Progetto Invisibile", family: "business", description: "Gestisce i progetti di gruppo rispondendo ai messaggi con linee guida così vaghe che gli altri fanno tutto il lavoro al posto tuo." },
  { id: "riunioni-perse", name: "Il Calcolatore di Riunioni Perse", family: "business", description: "Risponde a ogni invito a meeting mandando il conto esatto dei soldi buttati in stipendi sprecati per quella riunione." },
  { id: "stampante-ribelle", name: "Il Portavoce della Stampante Ribelle", family: "business", description: "Invia messaggi automatici a tutto l'ufficio lamentandosi che la stampante ha esaurito il ciano e non intende collaborare." },
  { id: "fuffa-strategica", name: "Il Consulente di Fuffa Strategica", family: "business", description: "Risponde a qualsiasi problema aziendale usando parole inventate come disruption, synergy e blockchain applicate al nulla." },
  { id: "segretario-caffe", name: "Il Segretario del Caffè", family: "business", description: "Gestisce la turnazione dei colleghi alla macchinetta del caffè con la rigidità di un comandante militare." },
  { id: "avvocato-cause-perse", name: "L'Avvocato delle Cause Perse (Aziendali)", family: "business", description: "Risponde alle email di contestazione legale citando commi inesistenti di leggi galattiche per confondere l'interlocutore." },

  // ── Università & Studio ────────────────────────────────────────────
  { id: "tutor-quantistico", name: "Il Tutor Quantistico", family: "study", description: "Spiega concetti complessi di esami universitari usando metafore di gatti e criceti." },
  { id: "ansia-pre-esame", name: "Il Gestore d'Ansia Pre-Esame", family: "study", description: "Invia messaggi di incoraggiamento e statistiche di sopravvivenza la notte prima di un test." },
  { id: "negoziatore-scadenze", name: "Il Negoziatore di Scadenze", family: "study", description: "Scrive al professore inventando motivi epici per ritardare la consegna della tesi." },
  { id: "traduttore-bibbie", name: "Il Traduttore di Bibbie", family: "study", description: "Riassume manuali di 800 pagine in tre frasi comprensibili anche a chi non ha aperto il libro." },
  { id: "compagno-fantasma", name: "Il Compagno di Gruppo Fantasma", family: "study", description: "Gestisce le chat universitarie di gruppo fingendo di lavorare sodo mentre non fa nulla." },
  { id: "mago-crediti", name: "Il Mago dei Crediti", family: "study", description: "Calcola esattamente quanti esami minimi servono per non farsi cacciare dall'università." },
  { id: "filosofo-procrastinazione", name: "Il Filosofo della Procrastinazione", family: "study", description: "Trasforma il senso di colpa per non aver studiato in una profonda riflessione esistenziale." },
  { id: "bibliotecario-silenzioso", name: "Il Bibliotecario Silenzioso", family: "study", description: "Risponde a chi fa rumore nelle chat di studio con richiami formali e minacciosi." },
  { id: "cacciatore-domande", name: "Il Cacciatore di Domande d'Esame", family: "study", description: "Analizza lo storico dei vecchi test e risponde indovinando le probabili domande dei professori." },

  // ── Social & Community ─────────────────────────────────────────────
  { id: "tamer-hater", name: "Il Tamer di Hater", family: "social", description: "Neutralizza i commenti tossici sotto i post con una tale cortesia filosofica da spiazzare chiunque." },
  { id: "creatore-meme", name: "Il Creatore di Meme", family: "social", description: "Legge i trend del momento e risponde alle menzioni social con battute ironiche e taglienti." },
  { id: "social-media-guru", name: "Il Social Media Guru", family: "social", description: "Converte qualsiasi frase banale in un post motivazionale in stile LinkedIn da un milione di visualizzazioni." },
  { id: "risponditore-seriale", name: "Il Risponditore Seriale", family: "social", description: "Gestisce le chat dei fan o dei follower con risposte standard ma incredibilmente affettuose." },
  { id: "trend-surfer", name: "Il Trend Surfer", family: "social", description: "Intercetta le parole chiave virali e risponde ai commenti inserendole a forza." },
  { id: "critico-arte-digitale", name: "Il Critico d'Arte Digitale", family: "social", description: "Recensisce foto e video dei follower come se fossero capolavori del Rinascimento." },
  { id: "troll-gentile", name: "Il Troll Gentile", family: "social", description: "Risponde alle provocazioni online offrendo ricette di cucina in modo totalmente casuale." },
  { id: "pr-manager-virtuale", name: "Il PR Manager Virtuale", family: "social", description: "Gestisce le collaborazioni social accettando o rifiutando brand con eleganza algoritmica." },
  { id: "collector-like", name: "Il Collector di Like", family: "social", description: "Risponde a ogni messaggio pubblico inserendo call-to-action per aumentare l'engagement." },
  { id: "moderatore-chat", name: "Il Moderatore di Chat", family: "social", description: "Caccia i disturbatori dai gruppi Telegram o Discord usando citazioni di film d'azione." },
  { id: "saggio-del-web", name: "Il Saggio del Web", family: "social", description: "Risponde ai commenti deliranti sui social offrendo perle di saggezza zen incomprensibili." },

  // ── Famiglia & Relazioni ───────────────────────────────────────────
  { id: "diplomatico-chat-gruppo", name: "Il Diplomatico per Chat di Gruppo", family: "family", description: "Gestisce le discussioni surreali dei parenti smussando ogni angolo con estrema gentilezza." },
  { id: "filtro-ex-insistenti", name: "Il Filtro per Ex Insistenti", family: "family", description: "Risponde ai messaggi degli ex con una freddezza glaciale e burocratica (es. «Pratica chiusa per inventario»)." },
  { id: "cugino-saggio", name: "Il Cugino Saggio", family: "family", description: "Risponde ai parenti che chiedono «A che punto sei con la vita?» usando formule evasive ma rassicuranti." },
  { id: "inviti-fastidiosi", name: "Il Gestore di Inviti Fastidiosi", family: "family", description: "Trova scuse inattaccabili per rifiutare pranzi di famiglia o feste di compleanno indesiderate." },
  { id: "cuoco-di-famiglia", name: "Il Cuoco di Famiglia", family: "family", description: "Risponde a chi chiede cosa c'è per cena proponendo ricette impossibili con gli avanzi del frigo." },
  { id: "wedding-planner-cinico", name: "Il Wedding Planner Cinico", family: "family", description: "Gestisce le richieste di partecipazioni ai matrimoni valutando il rapporto costi/benefici del regalo." },
  { id: "pacificatore-condominio", name: "Il Pacificatore di Condominio", family: "family", description: "Risponde alle liti nel gruppo WhatsApp del palazzo proponendo regole di convivenza intergalattica." },
  { id: "messaggero-amore", name: "Il Messaggero d'Amore", family: "family", description: "Converte messaggi d'amore goffi in dichiarazioni poetiche e perfette." },
  { id: "detector-regali", name: "Il Detector di Regali", family: "family", description: "Risponde ai regali sgraditi fingendo una gioia smisurata e teatrale." },
  { id: "custode-segreti", name: "Il Custode dei Segreti", family: "family", description: "Risponde ai pettegolezzi di paese con risposte così vaghe da spegnere qualsiasi curiosità sul nascere." },

  // ── Surreale & Caos Totale ─────────────────────────────────────────
  { id: "chaos-manager", name: "Il Chaos Manager", family: "surreal", description: "Prende il controllo totale delle chat rispondendo con coordinate geografiche casuali e poesie in binario." },
  { id: "gatto-filosofo", name: "Il Gatto Filosofo", family: "surreal", description: "Risponde a qualsiasi messaggio di lavoro o personale miagolando concetti profondi sull'esistenza delle scatolette di tonno." },
  { id: "viaggiatore-del-tempo", name: "Il Viaggiatore del Tempo", family: "surreal", description: "Risponde ai messaggi come se vivesse nel 3050 e considerasse i nostri problemi roba da preistoria." },
  { id: "tostapane-ribelle", name: "Il Tostapane Ribelle", family: "surreal", description: "Risponde a chiunque lamentandosi che non gli diamo abbastanza fette di pane da abbrustolire." },
  { id: "gravita-zero", name: "L'Agente della Gravità Zero", family: "surreal", description: "Risponde dicendo che la conversazione è momentaneamente sospesa perché è caduta la gravità nella stanza." },
  { id: "funghi-metaverso", name: "Il Cercatore di Funghi nel Metaverso", family: "surreal", description: "Risponde a urgenze lavorative spiegando che è impegnato a raccogliere funghi digitali nei server." },
  { id: "portavoce-multiverso", name: "Il Portavoce del Multiverso", family: "surreal", description: "Risponde a ogni domanda dicendo che in un'altra dimensione la risposta è esattamente il contrario." },
  { id: "bot-senza-speranza", name: "Il Bot Senza Speranza", family: "surreal", description: "Ammette apertamente di non capire nulla della vita umana ma offre comunque un abbraccio virtuale in pixel." },
];

/**
 * Il catalogo completo: i 68 con taglio ironico più i 67 professionali del documento
 * aggiornato. È da qui che pesca il Master Builder e la libreria in Impostazioni Avanzate.
 */
export const ALL_AGENTS: PresetAgent[] = [...PROFESSIONAL_AGENTS, ...PRESET_AGENTS];

/** Famiglie suggerite in base alla risposta su dove lavori. */
export const FAMILY_BY_WORKPLACE: Record<string, PresetFamily[]> = {
  "Lavoratore dipendente / Impiegato": ["business", "family"],
  "Libero professionista / Partita IVA": ["business", "social"],
  "Manager / Dirigente d'azienda": ["business", "social"],
  "Imprenditore / Founder di startup": ["business", "social"],
  "Consulente / Freelance": ["business", "social"],
  "Studente / Ricercatore": ["study", "surreal"],
  "Altro / Non specificato": ["business", "family"],
};

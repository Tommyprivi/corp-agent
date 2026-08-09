/**
 * ═══════════════════════════════════════════════════════════════════════
 * IL PONTE VOCALE — l'agente che risponde al telefono su WhatsApp
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Voluto da Tommaso il 9 Agosto 2026: «esigo che funzioni la chiamata».
 *
 * ─────────────────────────────────────────────────────────────────────────
 * PERCHÉ QUESTO PEZZO VIVE FUORI DA VERCEL
 * ─────────────────────────────────────────────────────────────────────────
 * Tutto il resto di CorpAgent gira su funzioni che si svegliano, rispondono e
 * muoiono. Una telefonata è l'esatto contrario: un flusso di pacchetti audio
 * che deve restare aperto per tutta la durata della conversazione, con
 * qualcuno dall'altra parte che li riceve venti volte al secondo.
 *
 * Non è una limitazione di Vercel: è la differenza fra «rispondere a una
 * domanda» e «tenere una linea aperta». Serve un processo acceso, e questo è
 * quel processo. Costa qualche euro al mese e sta in un contenitore suo.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * COME FUNZIONA, IN QUATTRO RIGHE
 * ─────────────────────────────────────────────────────────────────────────
 *   1. Un cliente chiama il numero WhatsApp dell'attività.
 *   2. Meta manda al webhook una proposta di connessione (SDP).
 *   3. `api/whatsapp.ts` la gira qui, insieme alle istruzioni dell'agente e a
 *      quello che sa dell'attività.
 *   4. Questo processo apre DUE connessioni — una verso il telefono del
 *      cliente, una verso il modello vocale di OpenAI — e si mette in mezzo.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ⚠️ LA SCELTA CHE FA LA DIFFERENZA: NON SI TOCCA L'AUDIO
 * ─────────────────────────────────────────────────────────────────────────
 * La strada ovvia sarebbe: ricevere l'audio, decodificarlo da Opus, mandarlo
 * a un trascrittore, prendere il testo, chiedere al modello, generare la voce,
 * ricodificarla in Opus. Sei passaggi, ognuno con il suo ritardo: due secondi
 * buoni prima che il cliente senta la prima sillaba. Al telefono due secondi
 * di silenzio sono un'eternità — la gente dice «pronto? pronto?» e riattacca.
 *
 * Qui invece **i pacchetti audio non vengono nemmeno aperti**: tutti e due i
 * lati parlano Opus a 48 kHz, quindi i pacchetti che arrivano dal telefono si
 * girano così come sono al modello, e viceversa. Zero decodifiche, zero
 * ricodifiche, zero librerie audio native da compilare. Il ritardo è quello
 * della rete più quello del modello, e basta.
 *
 * È lo stesso trucco che usano i server delle videoconferenze: chi sta in
 * mezzo instrada, non ascolta.
 */

import { createServer } from "node:http";
import { RTCPeerConnection, MediaStreamTrack } from "werift";

const PORT = Number(process.env.PORT ?? 8080);
const OPENAI_KEY = process.env.OPENAI_API_KEY;

/**
 * La chiave condivisa con `api/whatsapp.ts`.
 *
 * ⚠️ Questo processo è raggiungibile da internet: senza un segreto, chiunque
 * conosca l'indirizzo potrebbe far partire telefonate a spese di Tommaso.
 */
const BRIDGE_SECRET = process.env.BRIDGE_SECRET;

/** Il modello che parla e ascolta nello stesso momento. */
const REALTIME_MODEL = process.env.REALTIME_MODEL ?? "gpt-realtime";

/**
 * ⚠️ Il tetto alla durata, e non è un dettaglio.
 * Una chiamata che nessuno chiude resta aperta per sempre e continua a
 * costare. Dieci minuti sono più di qualsiasi domanda vera fatta a un
 * negozio; oltre, quasi sempre è un telefono rimasto in tasca.
 */
const MAX_DURATA_MS = 10 * 60 * 1000;

/** Le chiamate in corso, per poterle chiudere. */
const inCorso = new Map();

/**
 * Le porte da cui entra ed esce la voce, e l'indirizzo con cui farsi trovare.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ⚠️ QUESTA È LA PARTE CHE NON FUNZIONA "PER MAGIA"
 * ─────────────────────────────────────────────────────────────────────────
 * Il traffico web passa dalla porta 443 e chiunque lo sa instradare. La voce
 * no: viaggia su UDP, su porte scelte al momento, e chi ospita il contenitore
 * deve saperle aprire. È il motivo per cui Railway e Render non andavano bene
 * — aprono solo il web — e per cui questa app ha un indirizzo IP **dedicato**
 * (2 $ al mese): senza, i pacchetti audio del cliente arriverebbero a Fly e
 * non saprebbero a quale contenitore andare.
 *
 * Le porte sono fissate a mano, e non lasciate scegliere a caso, perché vanno
 * dichiarate una per una in `fly.toml`. Venti bastano: ogni telefonata ne usa
 * una, e venti telefonate insieme sono più di quante ne riceva un negozio in
 * un'ora di punta.
 *
 * `PUBLIC_IP` serve a dire al telefono del cliente «trovami qui». Senza,
 * il ponte annuncerebbe il suo indirizzo interno — che dall'esterno non esiste
 * — e la chiamata si collegherebbe... a niente.
 */
const PORTA_MIN = Number(process.env.ICE_PORT_MIN ?? 10000);
const PORTA_MAX = Number(process.env.ICE_PORT_MAX ?? 10020);
const IP_PUBBLICO = process.env.PUBLIC_IP;

const CONFIGURAZIONE_RETE = {
  icePortRange: [PORTA_MIN, PORTA_MAX],
  ...(IP_PUBBLICO ? { iceAdditionalHostAddresses: [IP_PUBBLICO] } : {}),
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

// ─────────────────────────────────────────────────────────────────────────
// IL SERVER
// ─────────────────────────────────────────────────────────────────────────

const server = createServer(async (req, res) => {
  // Un controllo di vita, per Fly/Railway e per sapere se è acceso.
  if (req.method === "GET" && req.url === "/salute") {
    return rispondi(res, 200, { vivo: true, chiamateInCorso: inCorso.size });
  }

  if (req.method !== "POST" || !req.url?.startsWith("/chiamata")) {
    return rispondi(res, 404, { error: "Non c'è niente qui." });
  }

  if (!BRIDGE_SECRET || req.headers.authorization !== `Bearer ${BRIDGE_SECRET}`) {
    return rispondi(res, 401, { error: "Non autorizzato." });
  }
  if (!OPENAI_KEY) {
    return rispondi(res, 503, { error: "OPENAI_API_KEY non configurata sul ponte." });
  }

  let corpo;
  try {
    corpo = JSON.parse(await leggiTutto(req));
  } catch {
    return rispondi(res, 400, { error: "Corpo non leggibile." });
  }

  const { callId, sdp, istruzioni, saluto, ritorno } = corpo;
  if (!callId || !sdp) {
    return rispondi(res, 400, { error: "Servono callId e sdp." });
  }

  try {
    const risposta = await apriChiamata({ callId, sdp, istruzioni, saluto, ritorno });
    return rispondi(res, 200, { sdp: risposta });
  } catch (errore) {
    console.error(`[${callId}] non sono riuscito ad aprire la chiamata:`, errore);
    return rispondi(res, 502, { error: String(errore) });
  }
});

server.listen(PORT, () => {
  console.log(`Ponte vocale acceso sulla porta ${PORT}.`);
  console.log(`Voce sulle porte UDP ${PORTA_MIN}-${PORTA_MAX}` + (IP_PUBBLICO ? ` · mi annuncio come ${IP_PUBBLICO}` : " · ⚠️ PUBLIC_IP non impostato: la voce non arrivera'"));
  if (!BRIDGE_SECRET) console.warn("⚠️  BRIDGE_SECRET non impostato: rifiuto tutto.");
  if (!OPENAI_KEY) console.warn("⚠️  OPENAI_API_KEY non impostata: non posso rispondere.");
});

// ─────────────────────────────────────────────────────────────────────────
// LA CHIAMATA
// ─────────────────────────────────────────────────────────────────────────

/**
 * Apre le due connessioni e le incolla.
 *
 * L'ordine è obbligato e vale la pena scriverlo, perché sbagliarlo dà errori
 * incomprensibili:
 *
 *   1. si crea il lato OpenAI e si chiede a lui una proposta (offer)
 *   2. si manda quella proposta a OpenAI, che risponde
 *   3. solo adesso si guarda la proposta arrivata da WhatsApp
 *   4. si risponde a WhatsApp
 *
 * Il motivo: i due lati devono avere già le loro tracce audio pronte prima di
 * dichiarare cosa sanno fare, se no la trattativa si chiude su «nessun audio»
 * e la telefonata resta muta senza che nessuno dia errore.
 */
async function apriChiamata({ callId, sdp, istruzioni, saluto, ritorno }) {
  // ── I due lati, prima di parlare con chiunque ──────────────────────
  // ⚠️ Si costruisce TUTTO prima di negoziare, ed e' il difetto che mi e'
  // costato piu' tentativi: `onTrack` scatta **durante**
  // `setRemoteDescription`, non dopo. Iscriversi dopo significa iscriversi a
  // un evento gia' passato — la connessione risulta perfetta, il modello
  // risponde, e non arriva un solo pacchetto audio. Nessun errore da nessuna
  // parte: solo silenzio.
  const versoModello = new RTCPeerConnection(CONFIGURAZIONE_RETE);
  const audioVersoModello = new MediaStreamTrack({ kind: "audio" });
  versoModello.addTransceiver(audioVersoModello, { direction: "sendrecv" });
  const comandi = versoModello.createDataChannel("oai-events");

  const versoCliente = new RTCPeerConnection(CONFIGURAZIONE_RETE);
  const audioVersoCliente = new MediaStreamTrack({ kind: "audio" });
  versoCliente.addTransceiver(audioVersoCliente, { direction: "sendrecv" });

  // ── Il travaso, nei due sensi ──────────────────────────────────────
  // ⚠️ `writeRtp` e non «riproduci»: il pacchetto si sposta cosi' com'e'.
  // Aprirlo per guardarci dentro sarebbe esattamente il ritardo che stiamo
  // evitando.
  versoCliente.onTrack.subscribe((traccia) => {
    traccia.onReceiveRtp.subscribe((pacchetto) => {
      try {
        audioVersoModello.writeRtp(pacchetto);
      } catch {
        /* la chiamata sta chiudendo */
      }
    });
  });

  versoModello.onTrack.subscribe((traccia) => {
    traccia.onReceiveRtp.subscribe((pacchetto) => {
      try {
        audioVersoCliente.writeRtp(pacchetto);
      } catch {
        /* la chiamata sta chiudendo */
      }
    });
  });

  // ── Il lato del modello ────────────────────────────────────────────
  await versoModello.setLocalDescription(await versoModello.createOffer());

  const rispostaModello = await fetch(
    `https://api.openai.com/v1/realtime/calls?model=${encodeURIComponent(REALTIME_MODEL)}`,
    {
      method: "POST",
      // ⚠️ NIENTE intestazione `OpenAI-Beta`: con quella OpenAI risponde 400
      // «The Realtime Beta API is no longer supported». L'indirizzo giusto e'
      // `/v1/realtime/calls` (non `/v1/realtime`) e vuole solo la chiave.
      // Restituisce **201**, non 200.
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/sdp",
      },
      body: versoModello.localDescription.sdp,
    }
  );
  if (!rispostaModello.ok) {
    const dettaglio = await rispostaModello.text().catch(() => "");
    throw new Error(`OpenAI ha risposto ${rispostaModello.status}: ${dettaglio.slice(0, 300)}`);
  }
  await versoModello.setRemoteDescription({
    type: "answer",
    sdp: await rispostaModello.text(),
  });

  // ── Il lato del cliente ────────────────────────────────────────────
  await versoCliente.setRemoteDescription({ type: "offer", sdp });
  await versoCliente.setLocalDescription(await versoCliente.createAnswer());

  // ── Chi e' l'agente, e cosa sa ─────────────────────────────────────
  comandi.stateChanged.subscribe((stato) => {
    if (stato !== "open") return;

    // ⚠️ La forma e' quella nuova: `session.type = "realtime"` e le
    // impostazioni audio dentro `audio.input` / `audio.output`. Con la forma
    // vecchia OpenAI risponde «Missing required parameter: session.type» e la
    // configurazione viene ignorata — il modello risponde lo stesso, ma con
    // la voce e il comportamento predefiniti invece che con i tuoi.
    comandi.send(
      JSON.stringify({
        type: "session.update",
        session: {
          type: "realtime",
          instructions: istruzioni ?? ISTRUZIONI_MINIME,
          audio: {
            input: {
              // Il modello capisce da solo quando il cliente ha finito.
              // ⚠️ 700 ms di silenzio, non 200: al telefono la gente si ferma
              // a pensare in mezzo alla frase, e un'IA che parte a ogni pausa
              // da' l'impressione di interrompere di continuo.
              turn_detection: { type: "server_vad", silence_duration_ms: 700 },
              transcription: { model: "whisper-1" },
            },
            // ⚠️ "marin", non "alloy": la voce predefinita e' corretta ma
            // piatta, e al telefono si sente. Questa ha le pause e l'intonazione
            // di chi parla davvero — che e' tutta la differenza fra «ho parlato
            // col vostro assistente» e «ho parlato con un robot».
            output: { voice: process.env.VOICE ?? "marin" },
          },
        },
      })
    );

    // Parla per primo: al telefono chi risponde saluta. Un silenzio dopo il
    // "clic" fa dire «pronto? pronto?» e riattaccare.
    comandi.send(
      JSON.stringify({
        type: "response.create",
        response: {
          instructions:
            saluto ??
            "Saluta brevemente e chiedi come puoi aiutare. Una frase sola, calda e naturale.",
        },
      })
    );
  });

  // ── Quello che vi siete detti ──────────────────────────────────────
  // ⚠️ Non basta stamparlo nel registro: se la telefonata resta qui dentro,
  // il titolare ha un assistente che parla coi suoi clienti e non gli racconta
  // mai cosa si sono detti. Le battute si raccolgono e a fine chiamata tornano
  // a CorpAgent, dove diventano una conversazione nella posta e poi memoria.
  const battute = [];

  // Le trascrizioni servono a due cose: farle vedere nella posta del sito, e
  // capire dopo perche' una telefonata e' andata male.
  // ⚠️ `onMessage`, non `message`: con il nome sbagliato si prende un
  // «Cannot read properties of undefined» al primo messaggio del modello.
  comandi.onMessage.subscribe((dato) => {
    try {
      const evento = JSON.parse(typeof dato === "string" ? dato : dato.toString());
      if (evento.type === "conversation.item.input_audio_transcription.completed") {
        console.log(`[${callId}] cliente: ${evento.transcript}`);
        battute.push({ chi: "cliente", testo: evento.transcript });
      }
      if (String(evento.type).includes("transcript.done")) {
        console.log(`[${callId}] agente: ${evento.transcript}`);
        battute.push({ chi: "agente", testo: evento.transcript });
      }
      if (evento.type === "error") {
        console.error(`[${callId}] il modello ha protestato:`, evento.error?.message);
      }
    } catch {
      /* eventi non JSON: si ignorano */
    }
  });

  // ── La chiusura ────────────────────────────────────────────────────
  const chiudi = (perche) => {
    if (!inCorso.has(callId)) return;
    inCorso.delete(callId);
    console.log(`[${callId}] chiusa dopo ${battute.length} battute (${perche}).`);
    versoCliente.close().catch(() => {});
    versoModello.close().catch(() => {});

    // ⚠️ Si rimanda indietro anche se la chiamata e' finita male: una
    // telefonata caduta a meta' e' comunque una cosa che il titolare deve
    // poter leggere. Se il ritorno fallisce non si insiste — meglio perdere
    // una trascrizione che tenere in vita un processo per un riporto.
    if (ritorno?.url && battute.length > 0) {
      fetch(ritorno.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ritorno.segreto ?? ""}`,
        },
        body: JSON.stringify({ callId, battute, durataSecondi: Math.round((Date.now() - inizio) / 1000) }),
        signal: AbortSignal.timeout(10_000),
      })
        .then((r) => console.log(`[${callId}] trascrizione rimandata a CorpAgent: ${r.status}`))
        .catch((e) => console.error(`[${callId}] trascrizione persa:`, String(e)));
    }
  };

  versoCliente.connectionStateChange.subscribe((s) => {
    if (s === "failed" || s === "closed" || s === "disconnected") chiudi(`cliente ${s}`);
  });
  versoModello.connectionStateChange.subscribe((s) => {
    if (s === "failed" || s === "closed" || s === "disconnected") chiudi(`modello ${s}`);
  });

  const inizio = Date.now();
  const timer = setTimeout(() => chiudi("tempo massimo"), MAX_DURATA_MS);
  timer.unref?.();

  inCorso.set(callId, { chiudi, iniziata: Date.now() });
  console.log(`[${callId}] aperta. In corso adesso: ${inCorso.size}`);

  return versoCliente.localDescription.sdp;
}

const ISTRUZIONI_MINIME = [
  "Sei l'assistente telefonico di un'attività italiana e stai parlando al telefono.",
  "",
  "Frasi corte. Una cosa per volta. Non elencare mai più di due opzioni a voce:",
  "chi ascolta non può rileggere.",
  "",
  "Non inventare MAI prezzi, orari o disponibilità che non ti sono stati dati.",
  "Se non lo sai, dillo con semplicità e proponi di far richiamare dal titolare.",
].join("\n");

// ─────────────────────────────────────────────────────────────────────────

function rispondi(res, stato, corpo) {
  const testo = JSON.stringify(corpo);
  res.writeHead(stato, { "Content-Type": "application/json" });
  res.end(testo);
}

function leggiTutto(req) {
  return new Promise((risolvi, rifiuta) => {
    let dati = "";
    req.on("data", (pezzo) => {
      dati += pezzo;
      // Una proposta SDP sta in pochi kilobyte: oltre, è qualcuno che gioca.
      if (dati.length > 200_000) rifiuta(new Error("corpo troppo grande"));
    });
    req.on("end", () => risolvi(dati));
    req.on("error", rifiuta);
  });
}

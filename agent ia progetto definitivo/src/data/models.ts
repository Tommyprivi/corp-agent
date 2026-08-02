import type { ModelDefinition } from "../types";

/**
 * Catalogo completo dei modelli elencati in docs/SPEC.md.
 *
 * Il campo `slug` (identificativo OpenRouter) e' volutamente vuoto: gli slug cambiano
 * spesso e vanno letti da https://openrouter.ai/api/v1/models durante il Passaggio 6,
 * non scritti a memoria.
 *
 * Il campo `access` dice COME si raggiunge il modello:
 *   openrouter  -> una sola chiave, gateway OpenRouter
 *   media       -> gateway immagini/video/audio (fal.ai o Replicate)
 *   direct      -> API dedicata del provider
 *   integration -> e' un prodotto da collegare, non un modello di chat
 *   selfhost    -> libreria da far girare su un proprio server
 */
export const MODEL_CATALOG: ModelDefinition[] = [
  // ── 1. Top di gamma: logica, ragionamento e coding ──────────────────
  { id: "gpt-4o", name: "GPT-4o", provider: "OpenAI", category: "reasoning", access: "openrouter", weight: "standard", tagline: "Il modello di punta multimodale, veloce e versatile" },
  { id: "gpt-4o-mini", name: "GPT-4o-mini", provider: "OpenAI", category: "reasoning", access: "openrouter", weight: "light", tagline: "Economico, leggero e ultra-veloce per task ripetitivi" },
  { id: "o1-o3", name: "Serie o1 / o3", provider: "OpenAI", category: "reasoning", access: "openrouter", weight: "heavy", tagline: "Specializzati in reasoning profondo, matematica e logica complessa" },
  { id: "claude-3-5-sonnet", name: "Claude 3.5 Sonnet", provider: "Anthropic", category: "reasoning", access: "openrouter", weight: "standard", tagline: "Il re indiscusso per scrittura creativa, programmazione e analisi testuale" },
  { id: "claude-3-5-haiku", name: "Claude 3.5 Haiku", provider: "Anthropic", category: "reasoning", access: "openrouter", weight: "light", tagline: "Il modello fulmineo ed economico per chat di tutti i giorni" },
  { id: "claude-3-opus", name: "Claude 3 Opus", provider: "Anthropic", category: "reasoning", access: "openrouter", weight: "heavy", tagline: "Il modello piu' profondo per compiti complessi" },
  { id: "gemini-1-5-pro", name: "Gemini 1.5 Pro", provider: "Google", category: "reasoning", access: "openrouter", weight: "standard", tagline: "Finestra di contesto gigantesca, legge interi libri o database" },
  { id: "gemini-1-5-flash", name: "Gemini 1.5 Flash", provider: "Google", category: "reasoning", access: "openrouter", weight: "light", tagline: "Leggerissimo e velocissimo per automazioni in tempo reale" },
  { id: "deepseek-v3", name: "DeepSeek-V3", provider: "DeepSeek", category: "reasoning", access: "openrouter", weight: "standard", tagline: "Potenza eccezionale per testo e logica a costi bassissimi" },
  { id: "deepseek-r1", name: "DeepSeek-R1", provider: "DeepSeek", category: "reasoning", access: "openrouter", weight: "heavy", tagline: "Open-reasoning che rivaleggia con OpenAI sui calcoli pesanti" },

  // ── 2. Open-source ad alta velocita' (Groq / Together AI) ───────────
  { id: "llama-3-3-70b", name: "Llama 3.3 (70B) / Llama 3.1", provider: "Meta", category: "opensource", access: "openrouter", weight: "standard", tagline: "Il modello open-source aziendale piu' potente al mondo" },
  { id: "llama-3-2-small", name: "Llama 3.2 (3B / 1B)", provider: "Meta", category: "opensource", access: "openrouter", weight: "light", tagline: "Microscopici, ideali per girare in locale o su server leggeri" },
  { id: "mistral-large-2", name: "Mistral Large 2", provider: "Mistral AI", category: "opensource", access: "openrouter", weight: "standard", tagline: "La potenza europea multilingua, eccezionale per l'italiano" },
  { id: "mistral-small", name: "Mistral Small", provider: "Mistral AI", category: "opensource", access: "openrouter", weight: "light", tagline: "Compatto ed economico per volumi alti" },
  { id: "qwen-2-5", name: "Qwen 2.5", provider: "Alibaba", category: "opensource", access: "openrouter", weight: "standard", tagline: "Tra i migliori open-source al mondo per task generali" },
  { id: "qwen-2-5-coder", name: "Qwen 2.5-Coder", provider: "Alibaba", category: "opensource", access: "openrouter", weight: "standard", tagline: "Variante specializzata nella programmazione" },

  // ── 3. Ricerca web in tempo reale ──────────────────────────────────
  { id: "sonar", name: "Sonar", provider: "Perplexity", category: "websearch", access: "openrouter", weight: "standard", tagline: "Cerca attivamente su internet e cita le fonti" },
  { id: "sonar-pro", name: "Sonar Pro", provider: "Perplexity", category: "websearch", access: "openrouter", weight: "heavy", tagline: "Ricerca web approfondita con fonti verificate" },
  { id: "grok-2", name: "Grok 2", provider: "xAI", category: "websearch", access: "openrouter", weight: "standard", tagline: "Collegato in tempo reale ai dati della piattaforma X" },
  { id: "grok-3", name: "Grok 3", provider: "xAI", category: "websearch", access: "openrouter", weight: "heavy", tagline: "Notizie fresche e ragionamento sui dati di X" },

  // ── 4. Leggeri e di settore ────────────────────────────────────────
  { id: "phi-3", name: "Phi-3", provider: "Microsoft", category: "lightweight", access: "openrouter", weight: "light", tagline: "Small Language Model per dispositivi edge" },
  { id: "phi-4", name: "Phi-4", provider: "Microsoft", category: "lightweight", access: "openrouter", weight: "light", tagline: "Perfetto per automazioni mirate a basso costo" },
  { id: "command-r", name: "Command R", provider: "Cohere", category: "lightweight", access: "openrouter", weight: "standard", tagline: "Specializzato in sistemi RAG e ricerca aziendale" },
  { id: "command-r-plus", name: "Command R+", provider: "Cohere", category: "lightweight", access: "openrouter", weight: "standard", tagline: "Gestione documenti interni su larga scala" },

  // ── 5. Meta-router universale ──────────────────────────────────────
  { id: "openrouter-gateway", name: "OpenRouter API Gateway", provider: "OpenRouter", category: "router", access: "openrouter", weight: "standard", tagline: "Un solo connettore per qualsiasi modello esistente, con credito centralizzato" },

  // ── Generazione di immagini e grafica ──────────────────────────────
  { id: "midjourney", name: "Midjourney (V6+)", provider: "Midjourney", category: "image", access: "direct", weight: "heavy", tagline: "Il re indiscusso per qualita' artistica, estetica e fotorealismo" },
  { id: "flux-1", name: "Flux.1 / Flux Pro", provider: "Black Forest Labs", category: "image", access: "media", weight: "standard", tagline: "Miglior open-weight: imbattibile su mani realistiche e scritte precise" },
  { id: "dalle-3", name: "DALL-E 3", provider: "OpenAI", category: "image", access: "direct", weight: "standard", tagline: "Eccellente nel seguire prompt complessi e articolati" },
  { id: "stable-diffusion", name: "Stable Diffusion XL / 3.5", provider: "Stability AI", category: "image", access: "media", weight: "standard", tagline: "Il pilastro open-source, personalizzabile in locale" },
  { id: "firefly", name: "Firefly", provider: "Adobe", category: "image", access: "direct", weight: "standard", tagline: "Sicuro per uso commerciale, con licenze pulite" },

  // ── Generazione di musica e audio ──────────────────────────────────
  { id: "suno", name: "Suno AI (v3.5 / v4)", provider: "Suno", category: "music", access: "direct", weight: "heavy", tagline: "Leader per canzoni complete e radiofoniche di qualsiasi genere" },
  { id: "udio", name: "Udio", provider: "Udio", category: "music", access: "direct", weight: "heavy", tagline: "Qualita' audio cristallina e voci molto definite" },
  { id: "lyria", name: "Lyria", provider: "Google", category: "music", access: "direct", weight: "heavy", tagline: "Tracce musicali originali e melodie dinamiche" },
  { id: "stable-audio", name: "Stable Audio", provider: "Stability AI", category: "music", access: "media", weight: "standard", tagline: "Effetti sonori, tappeti musicali e loop strumentali" },

  // ── Generazione di video ───────────────────────────────────────────
  { id: "sora", name: "Sora", provider: "OpenAI", category: "video", access: "direct", weight: "heavy", tagline: "Riferimento per fotorealismo video e coerenza fisica delle scene" },
  { id: "runway-gen", name: "Gen-2 / Gen-3 Alpha", provider: "Runway", category: "video", access: "direct", weight: "heavy", tagline: "Tra i modelli video piu' avanzati per registi e creator" },
  { id: "dream-machine", name: "Dream Machine", provider: "Luma", category: "video", access: "media", weight: "heavy", tagline: "Veloce, con movimenti di camera fluidi e spettacolari" },
  { id: "kling", name: "Kling AI", provider: "Kling", category: "video", access: "media", weight: "heavy", tagline: "Ottimo per scene d'azione e animazioni complesse" },
  { id: "pika", name: "Pika Labs", provider: "Pika", category: "video", access: "media", weight: "standard", tagline: "Perfetto per animare dettagli in immagini statiche" },

  // ── Voce, sintesi vocale e cloni vocali ────────────────────────────
  { id: "elevenlabs", name: "ElevenLabs", provider: "ElevenLabs", category: "voice", access: "direct", weight: "standard", tagline: "Leader mondiale per sintesi vocale e voice cloning" },
  { id: "whisper-tts", name: "Whisper / TTS", provider: "OpenAI", category: "voice", access: "direct", weight: "light", tagline: "Trascrizione da audio a testo e viceversa" },
  { id: "rvc", name: "RVC", provider: "Open source", category: "voice", access: "selfhost", weight: "standard", tagline: "Conversione vocale da una persona all'altra in tempo reale" },

  // ── Coding e sviluppo software ─────────────────────────────────────
  { id: "github-copilot", name: "GitHub Copilot", provider: "GitHub", category: "coding", access: "integration", weight: "standard", tagline: "Assistente integrato negli editor di codice" },
  { id: "codestral", name: "Codestral", provider: "Mistral AI", category: "coding", access: "openrouter", weight: "standard", tagline: "Specializzato in autocompletamento e codice pulito" },
  { id: "deepseek-coder", name: "DeepSeek-Coder", provider: "DeepSeek", category: "coding", access: "openrouter", weight: "standard", tagline: "Open-source potentissimo per sviluppatori" },

  // ── Ricerca web e agenti autonomi ──────────────────────────────────
  { id: "perplexity-ai", name: "Perplexity AI", provider: "Perplexity", category: "webagent", access: "direct", weight: "standard", tagline: "Motore di ricerca conversazionale che naviga e cita le fonti" },
  { id: "operator-frameworks", name: "Operator / Agent Frameworks", provider: "OpenAI", category: "webagent", access: "direct", weight: "heavy", tagline: "Apre il browser, clicca, compila form e naviga al posto tuo" },

  // ── Scienza e biologia ─────────────────────────────────────────────
  { id: "alphafold", name: "AlphaFold 2 / AlphaFold 3", provider: "Google DeepMind", category: "science", access: "integration", weight: "heavy", tagline: "Prevede la struttura tridimensionale delle proteine" },
  { id: "alphagenome", name: "AlphaGenome / modelli genomici", provider: "Google DeepMind", category: "science", access: "integration", weight: "heavy", tagline: "Sequenzia e interpreta DNA e RNA" },
  { id: "drug-discovery", name: "Modelli per Drug Discovery", provider: "Vari", category: "science", access: "integration", weight: "heavy", tagline: "Simulano molecole per trovare nuovi medicinali" },

  // ── Matematica e dimostrazione formale ─────────────────────────────
  { id: "lean-alphaproof", name: "Lean / AlphaProof", provider: "Vari", category: "math", access: "integration", weight: "heavy", tagline: "Dimostrano teoremi scrivendo e verificando prove formali" },

  // ── Traduzione avanzata e multilingua ──────────────────────────────
  { id: "seamless-m4t", name: "SeamlessM4T", provider: "Meta", category: "translation", access: "selfhost", weight: "standard", tagline: "Traduce testo, voce e flussi audio in tempo reale" },

  // ── Gaming, reinforcement learning e simulazione ───────────────────
  { id: "five-alphastar", name: "OpenAI Five / AlphaStar", provider: "OpenAI · DeepMind", category: "gaming", access: "integration", weight: "heavy", tagline: "Battono i campioni umani in giochi strategici complessi" },
  { id: "physics-sim", name: "Modelli di Fisica e Simulazione", provider: "Vari", category: "gaming", access: "integration", weight: "heavy", tagline: "Addestrano robot in ambienti virtuali prima del mondo reale" },

  // ── Computer vision e analisi visiva ───────────────────────────────
  { id: "yolo", name: "YOLO", provider: "Open source", category: "vision", access: "selfhost", weight: "light", tagline: "Standard industriale per il riconoscimento oggetti in tempo reale" },
  { id: "ocr-avanzato", name: "OCR avanzati (PaddleOCR, ViT)", provider: "Open source", category: "vision", access: "selfhost", weight: "light", tagline: "Leggono testo scritto a mano anche su documenti storti" },

  // ── Modelli predittivi, finanziari e time-series ───────────────────
  { id: "xgboost-lightgbm", name: "XGBoost / LightGBM", provider: "Open source", category: "predictive", access: "selfhost", weight: "light", tagline: "Rischio creditizio, frodi e stime dei mercati finanziari" },
  { id: "chronos", name: "Chronos", provider: "Amazon", category: "predictive", access: "selfhost", weight: "standard", tagline: "Analizza serie storiche e prevede trend futuri" },

  // ── Computer-use e navigazione GUI ─────────────────────────────────
  { id: "anthropic-computer-use", name: "Anthropic Computer Use", provider: "Anthropic", category: "computeruse", access: "direct", weight: "heavy", tagline: "Vede lo schermo, calcola le coordinate, clicca e compila i campi" },
  { id: "openai-operator", name: "Operator / Browser Use", provider: "OpenAI", category: "computeruse", access: "direct", weight: "heavy", tagline: "Prende il controllo del browser per eseguire task complessi" },
  { id: "gui-agents", name: "OSWorld / CogAgent / SeeAct", provider: "Open source", category: "computeruse", access: "selfhost", weight: "heavy", tagline: "Navigano dentro Windows, macOS e Linux leggendo l'interfaccia" },

  // ── System monitoring e analisi dei log ────────────────────────────
  { id: "rag-locale", name: "RAG e Vector Search locale", provider: "LlamaIndex · ChromaDB", category: "monitoring", access: "selfhost", weight: "standard", tagline: "Indicizza l'intero disco e permette ricerche semantiche istantanee" },
  { id: "threat-detection", name: "Threat Detection", provider: "Datadog · CrowdStrike", category: "monitoring", access: "integration", weight: "standard", tagline: "Monitora rete e file di sistema per anomalie e malware" },
  { id: "devops-agents", name: "Agenti DevOps e SysAdmin", provider: "AWS · Microsoft", category: "monitoring", access: "integration", weight: "standard", tagline: "Tengono d'occhio server e database risolvendo i problemi in autonomia" },
];

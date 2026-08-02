import type { ConnectorDefinition } from "../types";

/** I 31 connettori elencati in docs/SPEC.md, raggruppati per famiglia. */
export const CONNECTOR_CATALOG: ConnectorDefinition[] = [
  // Messaggistica e chat
  { id: "whatsapp-business", name: "WhatsApp Business API", family: "messaging", description: "Rispondi ai clienti su WhatsApp", connected: false },
  { id: "telegram", name: "Telegram Bot", family: "messaging", description: "Bot e canali Telegram", connected: false },
  { id: "slack", name: "Slack", family: "messaging", description: "Canali e messaggi diretti del team", connected: false },
  { id: "discord", name: "Discord", family: "messaging", description: "Server e moderazione community", connected: false },
  { id: "messenger", name: "Messenger", family: "messaging", description: "Pagine Facebook e Messenger", connected: false },
  { id: "instagram-dm", name: "Instagram Direct", family: "messaging", description: "Messaggi diretti e commenti", connected: false },
  { id: "teams", name: "Microsoft Teams", family: "messaging", description: "Chat e canali aziendali", connected: false },
  { id: "google-chat", name: "Google Chat", family: "messaging", description: "Spazi e conversazioni Workspace", connected: false },
  { id: "signal-matrix", name: "Signal / Matrix", family: "messaging", description: "Messaggistica cifrata", connected: false },

  // Email
  { id: "gmail", name: "Gmail / Google Workspace", family: "email", description: "Posta e contatti Google", connected: false },
  { id: "outlook", name: "Microsoft Outlook / Exchange", family: "email", description: "Posta e contatti Microsoft", connected: false },
  { id: "imap-smtp", name: "IMAP / SMTP universale", family: "email", description: "Qualsiasi altra casella di posta", connected: false },

  // Web e ricerca
  { id: "web-scraper", name: "Web Scraper & Browser Conductor", family: "web", description: "Estrae dati dai siti e guida il browser", connected: false },
  { id: "search-api", name: "Google Search API / Perplexity", family: "web", description: "Ricerche web con fonti", connected: false },
  { id: "rss", name: "RSS Feed / Atom", family: "web", description: "Monitora blog e testate", connected: false },

  // File, documenti e database
  { id: "google-drive", name: "Google Drive / Docs / Sheets", family: "files", description: "File e fogli di calcolo Google", connected: false },
  { id: "onedrive", name: "OneDrive / SharePoint / Excel", family: "files", description: "File e cartelle Microsoft", connected: false },
  { id: "notion", name: "Notion", family: "files", description: "Pagine e database Notion", connected: false },
  { id: "airtable", name: "Airtable", family: "files", description: "Basi dati e tabelle", connected: false },
  { id: "dropbox-box", name: "Dropbox / Box", family: "files", description: "Archivi cloud", connected: false },
  { id: "databases", name: "Database SQL e NoSQL", family: "files", description: "PostgreSQL, MySQL, SQLite, MongoDB", connected: false },

  // Calendario e progetti
  { id: "google-calendar", name: "Google Calendar", family: "calendar", description: "Eventi e disponibilità", connected: false },
  { id: "outlook-calendar", name: "Outlook Calendar", family: "calendar", description: "Eventi e riunioni Microsoft", connected: false },
  { id: "project-tools", name: "Trello / Asana / ClickUp / Jira", family: "calendar", description: "Attività e ticket di progetto", connected: false },
  { id: "git-hosting", name: "GitHub / GitLab", family: "calendar", description: "Repository, issue e pull request", connected: false },

  // Business e pagamenti
  { id: "ecommerce", name: "Shopify / WooCommerce", family: "business", description: "Ordini, prodotti e magazzino", connected: false },
  { id: "payments", name: "Stripe / PayPal", family: "business", description: "Incassi, fatture e abbonamenti", connected: false },
  { id: "crm", name: "HubSpot / Salesforce", family: "business", description: "Contatti, trattative e pipeline", connected: false },

  // Automazione e sviluppo
  { id: "zapier", name: "Zapier Conductor", family: "automation", description: "Migliaia di app tramite Zapier", connected: false },
  { id: "make", name: "Make.com", family: "automation", description: "Integrazione nativa con gli scenari Make", connected: false },
  { id: "webhooks", name: "Webhook e API REST custom", family: "automation", description: "Qualsiasi servizio con un endpoint", connected: false },

  // ── Aggiunti dal documento del 1 Agosto 2026 ───────────────────────
  // E-commerce e retail
  { id: "shopify-pos", name: "Shopify POS", family: "business", description: "Vendite in negozio sincronizzate col magazzino online", connected: false },
  { id: "magento", name: "Magento 2", family: "business", description: "Cataloghi prodotti complessi e stati ordine", connected: false },
  { id: "amazon-seller", name: "Amazon Seller Central", family: "business", description: "Domande e risposte sui prodotti venduti su Amazon", connected: false },
  { id: "food-delivery", name: "Glovo / JustEat", family: "business", description: "Ordini in arrivo e tempi di consegna", connected: false },
  { id: "gift-card", name: "Gift Card", family: "business", description: "Saldo e generazione di carte regalo", connected: false },

  // Amministrazione e finanza (Italia)
  { id: "fatture-in-cloud", name: "Fatture in Cloud / Zucchetti", family: "business", description: "Fatture proforma, ordini e anagrafiche", connected: false },
  { id: "vies", name: "Verifica Partita IVA (VIES)", family: "business", description: "Controllo validità delle partite IVA comunitarie", connected: false },
  { id: "home-banking", name: "Home banking (flussi CBI)", family: "business", description: "Incassi e riconciliazione con le fatture emesse", connected: false },
  { id: "conservazione", name: "Conservazione digitale (InfoCert)", family: "business", description: "Archiviazione sostitutiva a norma di legge", connected: false },

  // Logistica e operazioni
  { id: "corrieri", name: "Corrieri (DHL, UPS, FedEx)", family: "business", description: "Tariffe di spedizione e tracking dei colli", connected: false },
  { id: "wms", name: "Sistemi WMS (magazzino)", family: "business", description: "Stato di imballaggio e spedizione dei colli", connected: false },
  { id: "telemetria", name: "Flotta aziendale (Geotab)", family: "business", description: "Posizione GPS dei mezzi aziendali", connected: false },
  { id: "iot", name: "Sensori IoT industriali", family: "business", description: "Temperatura e umidità, es. celle frigorifere", connected: false },

  // Comunicazione aggiuntiva
  { id: "sms", name: "SMS transazionali (Twilio)", family: "messaging", description: "Codici di verifica e promemoria via SMS", connected: false },

  // Marketing
  { id: "ga4", name: "Google Analytics 4", family: "automation", description: "Eventi personalizzati dalla piattaforma", connected: false },
  { id: "meta-capi", name: "Meta Conversions API", family: "automation", description: "Eventi di conversione verso i sistemi Meta", connected: false },
  { id: "email-marketing", name: "Mailchimp / ActiveCampaign", family: "automation", description: "Liste newsletter e automazioni email", connected: false },

  // IT e sviluppo
  { id: "sso", name: "Single Sign-On (Okta, Active Directory)", family: "automation", description: "Accesso con le credenziali aziendali", connected: false },
  { id: "sentry", name: "Sentry", family: "automation", description: "Monitoraggio errori degli agenti", connected: false },
  { id: "observability", name: "Datadog / New Relic", family: "automation", description: "Metriche prestazionali di server e agenti", connected: false },

  // Ticketing e HR
  { id: "ticketing", name: "Zendesk / Freshdesk", family: "calendar", description: "Richieste irrisolte passate al supporto umano", connected: false },
  { id: "ats", name: "ATS (Workday)", family: "calendar", description: "Stato delle candidature ai candidati", connected: false },
];

# Backlog post-lancio

> Tutto quello che sta qui **non si costruisce prima di Dicembre 2026**. È il "resto" di
> cui parla la bibbia: *"Nel doc ci sono 50 funzioni. Per Dicembre 2026 lanciamo solo:
> Master Builder + Chat WhatsApp + RAG/Knowledge Base + Contatore Risparmio. Tutto il
> resto... va congelato e fatto dopo il lancio."* — [BIBBIA.md](BIBBIA.md)
>
> Questo file esiste per **non perdere le idee**, non per pianificarle. Quando si riaprirà
> la roadmap dopo il lancio, si riparte da qui e si applica di nuovo la regola d'oro:
> *se non aiuta a vendere, non è la prossima cosa da fare.*

Fonte: seconda estrazione di `AgentFlow.docx` (Agosto 2026), righe 40-965 di
[SPEC.md](SPEC.md) in avanti — tutto ciò che eccede i 4 pilastri.

---

## Nuovi agenti preimpostati (non ancora in `src/data/presetAgents.ts`)

Il documento aggiunge una seconda ondata di agenti, più orientati al business
strutturato rispetto ai 68 "surreali/famiglia/social" già catalogati:

- **Business & Operativo** (~45): Credit Manager, Customer Success Specialist, Data Entry
  & Matcher, Supply Chain Monitor, Compliance & GDPR Checker, Sales Funnel Qualifier,
  Knowledge Base Curator, Coordinatore Esecutivo, Responsabile Commerciale, Analista di
  Calendario, Comunicatore Corporate, Project Tracker, Financial Controller, Consulente
  Legale Interno, e altri ~30 simili (vedi SPEC.md righe 57-106)
- **Area Accademica & Ricerca** (~9): Tutor Accademico, Coordinatore delle Consegne,
  Document Analyst, Analista di Carriera, Ricercatore Bibliografico
- **Social & Community Management** (~10): Moderatore di Community, Content Monitor,
  Redattore Corporate, Conversion Optimizer, Analista di Reputazione Online
- **Relazioni & Organizzazione Privata** (~10): Mediatore Familiare, Pianificatore di
  Eventi, Consulente di Budget Familiare, Segretario di Gestione Privata

**Nota per quando si riprende:** questi si sovrappongono parzialmente ai 68 già presenti
(stessa idea, tono più "corporate" invece che "surreale/ironico"). Prima di aggiungerli,
decidere se sostituiscono o affiancano il tono già scelto per `PRESET_AGENTS`.

## Connettori aggiuntivi (oltre i 31 già in `src/data/connectors.ts`)

~60 connettori extra, principalmente enterprise/verticali:
- **E-commerce avanzato**: Shopify POS, Magento 2, Amazon Seller Central, Glovo/JustEat
- **Finanza/ERP**: Fatture in Cloud, Zucchetti, VIES, flussi CBI, InfoCert
- **Logistica**: corrieri (DHL/UPS/FedEx), WMS, IoT industriale, Geotab
- **Sviluppo/IT**: GitHub Actions CI/CD, Sentry, Datadog/New Relic, SSO (Active Directory,
  Okta)
- **Marketing**: GA4, Meta Conversions API, Mailchimp/ActiveCampaign, Clearbit, Twilio SMS
- **HR**: ATS (Workday), Gusto (payroll), pulse survey

## Funzioni di piattaforma (non agenti, non connettori)

Raggruppate per area, con una riga sul perché non sono V1:

| Funzione | Perché aspetta |
|---|---|
| Pannello Admin (MRR/ARR/churn, CRM interno, log) | Serve quando ci sono clienti paganti da monitorare, non prima |
| Multi-tenant / Organizzazioni a 200 postazioni + RBAC | Il target V1 è il singolo negozio/ristorante, non l'azienda strutturata |
| Marketplace di agenti (Nexus Store) | Serve un catalogo di creator esterni che oggi non esiste |
| White-Label dinamico per agenzie | Richiede un cliente B2B che rivende, non il target V1 |
| Voice Agents (chiamate telefoniche, cloni vocali ElevenLabs) | La bibbia esclude esplicitamente "Voice" dal lancio |
| Browser Conductor (agente che naviga il web) | La bibbia esclude esplicitamente "Browser" dal lancio |
| Multi-Agent Swarm | Funzione avanzata Pro/Enterprise, non serve al primo cliente |
| Versioning/rollback dei prompt ("Time-Machine") | Utile quando ci sono utenti che modificano prompt da tempo |
| A/B testing dei system prompt | Ottimizzazione avanzata, non un pilastro del lancio |
| Sandbox/Red-teaming degli agenti | Sicurezza avanzata per clienti enterprise |
| Multi-lingua UI dinamica (8+ lingue core, traduttore per il resto) | V1 è italiano, target italiano |
| Scanner fotografico scontrini/fatture (OCR mobile) | Bella funzione, ma non è uno dei 4 pilastri |
| Daily Briefing vocale, Agent Pulse su WhatsApp | Raffinamento del Contatore Risparmio, dopo che esiste la v1 di quello |
| Ghost Mode / Modalità Bozza Guidata | Variante più sofisticata dell'Human-in-the-Loop già previsto nel Passo 4 |
| Nexus Audit (report gratuito da sito web, lead magnet) | Strumento di marketing, si costruisce quando c'è traffico da convertire |
| Programma affiliazione "Nexus Partner" | Crescita, non lancio |
| Licenze stagionali / pass temporanei | Modello di pricing alternativo, si valuta dopo aver visto i primi clienti |
| Personalizzazioni estetiche avanzate (Lottie, glassmorphism, temi festivi, CSS custom) | Il principio 1 della bibbia vuole *meno* superficie di configurazione, non di più |

## Modello di monetizzazione — confermato, non in conflitto

Il documento chiarisce che il modello scelto è **BYOK ibrido**: l'utente collega la
propria chiave (o CorpAgent la fornisce inclusa nell'abbonamento), CorpAgent guadagna
sul software. Questo è già coerente con `src/data/plans.ts` e con la decisione
"OpenRouter, una chiave sola" in [PIANO.md](PIANO.md). Il documento aggiunge dettagli sui
prezzi (Starter 25€, Pro 49€, Enterprise 230€) e sul wallet a crediti con ricariche
rapide — da riconciliare con `PLANS` quando si arriva al Passo 10 (Monetizzazione).

## Architettura tecnica menzionata (per il Passo 6, quando si costruisce il backend)

Il documento specifica scelte tecniche che confermano — non contraddicono — quanto già
deciso in PIANO.md:
- **PostgreSQL** (gestito con pgAdmin) come database relazionale — coerente con Supabase,
  che è Postgres gestito
- **OpenRouter** con Structured Outputs / Function Calling per il Master Builder — il
  "cervellone" estrae un JSON (nome agente, ruolo, regole, connettori) mentre l'utente
  chatta, poi salva l'agente
- Un agente è: **Persona** (system prompt) + **Memoria** (vector DB/RAG) + **Strumenti**
  (function calling verso i connettori) + **Modello** (scelto via OpenRouter)

Questo schema tecnico va tenuto presente quando si costruisce davvero il Passo 6, ma non
richiede di anticipare nessuna funzione oggi.

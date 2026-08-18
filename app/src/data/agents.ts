import type { AutomationFlow, RoleAgent } from "../types";

export const ROLE_AGENTS: RoleAgent[] = [
  {
    id: "seo",
    name: "Agente SEO",
    role: "Ricerca parole chiave e ottimizza le pagine",
    modelId: "claude-3-5-sonnet",
    active: true,
  },
  {
    id: "content",
    name: "Content Creator",
    role: "Scrive articoli, email e testi social",
    modelId: "gpt-4o",
    active: true,
  },
  {
    id: "data",
    name: "Data Processor",
    role: "Estrae e riordina dati da file e siti",
    modelId: "deepseek-v3",
    active: false,
  },
];

export const ONBOARDING_QUESTIONS = [
  {
    id: "source",
    question: "Come ci hai conosciuto?",
    options: ["Ricerca su Google", "Social media", "Consiglio di un collega", "Newsletter o blog"],
  },
  {
    id: "usage",
    question: "Come userai CorpAgent?",
    options: [
      "Automatizzare attività ripetitive",
      "Creare contenuti",
      "Analizzare dati",
      "Coordinare un team",
    ],
  },
  {
    id: "industry",
    question: "Qual è il tuo settore?",
    options: ["Marketing", "Sviluppo software", "E-commerce", "Consulenza"],
  },
];

export const AUTOMATION_FLOWS: AutomationFlow[] = [
  {
    id: "flow-seo",
    name: "Report SEO settimanale",
    steps: ["Cartelle cloud", "Agente SEO", "Gmail"],
    active: true,
  },
  {
    id: "flow-inbox",
    name: "Riassunto posta in arrivo",
    steps: ["Gmail", "Content Creator", "Cartelle locali"],
    active: false,
  },
];

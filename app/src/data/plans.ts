import type { Plan, PlanId } from "../types";

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    price: "0 €",
    cadence: "per sempre",
    pitch: "Per provare CorpAgent senza impegno.",
    maxWeight: "light",
    features: [
      "3 agenti attivi",
      "20 richieste al giorno",
      "Solo modelli leggeri",
      "1 connettore",
    ],
  },
  {
    id: "starter",
    name: "Starter",
    price: "9 €",
    cadence: "al mese",
    pitch: "Ti serve solo una chat automatica leggera e risposte di base.",
    maxWeight: "standard",
    features: [
      "1 agente attivo",
      "Volumi di messaggi standard",
      "Il canale di messaggistica principale",
      "Base di conoscenza (menù, listino, orari)",
    ],
  },
  {
    id: "business",
    name: "Business",
    price: "29 €",
    cadence: "al mese",
    pitch: "Attivi connettori pesanti (gestionale, magazzino) e hai volumi di messaggi elevati.",
    maxWeight: "standard",
    features: [
      "Agenti illimitati",
      "Connettori e-commerce e gestionali (Shopify, WooCommerce, Fatture in Cloud)",
      "Volumi di messaggi elevati",
      "Contatore Risparmio dettagliato",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "59 €",
    cadence: "al mese",
    pitch: "Ti servono automazioni avanzate, più operatori o integrazioni su misura.",
    maxWeight: "heavy",
    features: [
      "Multi-operatore",
      "Connettori di calendario e CRM (Google Calendar, HubSpot)",
      "Automazioni avanzate",
      "Integrazioni custom",
    ],
  },
  {
    id: "byok",
    name: "BYOK",
    price: "5 €",
    cadence: "al mese",
    pitch: "Colleghi la tua chiave OpenRouter e paghi i consumi direttamente ai provider.",
    maxWeight: "heavy",
    features: [
      "Nessun limite di consumo da parte nostra",
      "Paghi solo il software, non i token",
      "Tutti i modelli che la tua chiave sblocca",
      "Ideale se hai già un account OpenRouter",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Su misura",
    cadence: "contratto annuale",
    pitch: "Per aziende con più sedi e requisiti di sicurezza.",
    maxWeight: "heavy",
    features: [
      "Utenti e permessi per il team",
      "Supporto dedicato",
      "Sicurezza avanzata e audit log",
      "API illimitate",
    ],
  },
];

export function planById(id: PlanId): Plan {
  return PLANS.find((p) => p.id === id) ?? PLANS[0];
}

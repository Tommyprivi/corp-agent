import { CONNECTOR_CATALOG } from "../data/connectors";
import { planById } from "../data/plans";
import { tradeById, VOLUME_BY_TRADE } from "../data/trades";
import type {
  BuilderProfile,
  DataHome,
  Intent,
  PlanId,
  Recommendation,
  SurveyAnswers,
  VolumeId,
} from "../types";

/**
 * Il motore di raccomandazione a tre livelli del Master Builder:
 *   1. La Mente   — quale agente, in base al problema che porta via più tempo
 *   2. Le Mani    — quale connettore, in base a dove vivono già i dati del business
 *   3. Il Budget  — quale piano, in base al volume atteso e al peso del connettore
 *
 * Tutto deriva dalle tre risposte già raccolte dal Master Builder: nessuna domanda in
 * più, altrimenti si perde l'effetto "pronto in 30 secondi".
 */

const INTENT_WHY: Record<Intent, string> = {
  assistenza:
    "la maggior parte del tuo tempo se ne va in richieste ripetitive: l'ho impostato per rispondere e filtrare, non per vendere",
  prenotazioni:
    "il grosso del tuo lavoro sono gli appuntamenti: l'ho impostato per gestire calendario e conferme",
  vendite:
    "gestisci trattative e vendite: l'ho impostato per chiudere, non solo per rispondere",
};

/** Il connettore giusto per canale, quando il business vive "nella chat stessa". */
const CHANNEL_CONNECTOR_ID: Record<string, string | undefined> = {
  WhatsApp: "whatsapp-business",
  Instagram: "instagram-dm",
  Email: "imap-smtp",
  Telefono: undefined,
};

function pickConnectorId(dataHome: DataHome, tradeId: string, channel: string): string | undefined {
  if (dataHome === "ecommerce") return "ecommerce";
  if (dataHome === "calendario") return tradeId === "studio" ? "crm" : "google-calendar";
  if (dataHome === "documenti") return "google-drive";
  return CHANNEL_CONNECTOR_ID[channel];
}

function connectorWhy(dataHome: DataHome, connectorName: string): string {
  if (dataHome === "ecommerce") {
    return `I tuoi prodotti e i prezzi vivono nel gestionale: collegando ${connectorName} l'agente li legge da solo, senza che tu li ricopi.`;
  }
  if (dataHome === "calendario") {
    return `Appuntamenti e clienti vivono nel calendario: collegando ${connectorName} l'agente prenota e sposta da solo, senza doppie prenotazioni.`;
  }
  if (dataHome === "documenti") {
    return `I tuoi documenti vivono altrove: collegando ${connectorName} l'agente li legge senza che tu li carichi uno a uno.`;
  }
  return `Lavori soprattutto in chat: attivare subito ${connectorName} è l'unica cosa che ti serve per partire.`;
}

function pickPlan(dataHome: DataHome, volume: VolumeId): { id: PlanId; why: string } {
  if (dataHome === "ecommerce") {
    return {
      id: "business",
      why: "Colleghi un connettore pesante come il gestionale: ti serve un piano senza limiti di volume, non quello base.",
    };
  }
  if (dataHome === "calendario") {
    if (volume === "alto" || volume === "altissimo") {
      return {
        id: "business",
        why: "Il calendario genera molti messaggi nelle ore di punta: Business toglie i limiti di volume.",
      };
    }
    return {
      id: "pro",
      why: "Gestire appuntamenti e clienti insieme ad altre persone richiede automazioni e multi-operatore: è il caso di Pro.",
    };
  }
  if (volume === "alto" || volume === "altissimo") {
    return {
      id: "business",
      why: "Il volume di messaggi previsto è alto: ti conviene un piano senza limiti fin da subito.",
    };
  }
  return {
    id: "starter",
    why: "Ti serve solo una chat automatica affidabile: Starter copre tutto senza farti pagare funzioni che non usi.",
  };
}

export function recommendPackage(
  profile: BuilderProfile,
  intent: Intent,
  survey?: SurveyAnswers
): Recommendation {
  const trade = tradeById(profile.tradeId);
  const volume = VOLUME_BY_TRADE[trade.id];

  const connectorId = pickConnectorId(trade.dataHome, trade.id, profile.channel);
  const connector = CONNECTOR_CATALOG.find((c) => c.id === connectorId);
  const connectorName = connector?.name ?? profile.channel;

  let plan = pickPlan(trade.dataHome, volume);

  // Chi lavora in team ha bisogno di più postazioni e connettori: il piano sale di livello.
  if (survey?.teamSize?.toLowerCase().includes("team") && plan.id !== "enterprise") {
    plan = {
      id: "pro",
      why: `${plan.why} Lavori in team, quindi ti servono agenti illimitati e tutti i connettori.`,
    };
  }

  const planDef = planById(plan.id);

  return {
    agent: {
      name: trade.agentName,
      role: trade.agentRole,
      why: INTENT_WHY[intent],
    },
    connector: {
      id: connectorId ?? "whatsapp-business",
      name: connectorName,
      why: connectorWhy(trade.dataHome, connectorName),
    },
    plan: {
      id: plan.id,
      name: planDef.name,
      price: `${planDef.price} ${planDef.cadence}`,
      why: plan.why,
    },
  };
}

import type { Kit, TradeId } from "../types";

/**
 * I kit pronti: dico cosa faccio, e l'IA mi mette in piedi tutto in un colpo — la squadra
 * di agenti, i canali da collegare e il piano. Un clic, non cinque schermate.
 *
 * È il "Kit per Azienda" della SPEC: riduce il time-to-value da ore a trenta secondi.
 */
export const KITS: Record<TradeId, Kit> = {
  ristorante: {
    headline: "Per un ristorante ti metto in piedi questa squadra",
    agents: [
      { name: "Addetto Sala", role: "Risponde su menù, orari e prezzi senza sbagliare un piatto" },
      { name: "Addetto Prenotazioni", role: "Prende e sposta i tavoli, conferma il giorno prima" },
      { name: "Gestore Recensioni", role: "Ringrazia chi lascia una recensione e ti avvisa delle critiche" },
    ],
    connectors: [
      { name: "WhatsApp", why: "è lì che i clienti chiedono se c'è posto" },
      { name: "Google Calendar", why: "serve per non prendere due tavoli sulla stessa ora" },
    ],
    knowledge: "il menù e gli orari",
    planId: "pro",
    planWhy: "un ristorante riceve messaggi a raffica nelle ore di punta",
  },
  negozio: {
    headline: "Per un negozio ti metto in piedi questa squadra",
    agents: [
      { name: "Addetto Vendite", role: "Dice se un prodotto c'è e quanto costa, leggendo il listino" },
      { name: "Responsabile Sconti", role: "Gestisce le richieste di sconto senza scendere sotto il margine" },
      { name: "Recupero Carrelli", role: "Riscrive a chi ha lasciato un ordine a metà" },
    ],
    connectors: [
      { name: "WhatsApp", why: "è il canale dove chiedono taglie e disponibilità" },
      { name: "Shopify o WooCommerce", why: "serve per sapere cosa c'è davvero in magazzino" },
    ],
    knowledge: "il listino prezzi",
    planId: "pro",
    planWhy: "collegare il magazzino richiede il piano che sblocca i connettori pesanti",
  },
  servizi: {
    headline: "Per chi lavora su appuntamento ti metto in piedi questa squadra",
    agents: [
      { name: "Addetto Appuntamenti", role: "Fissa, sposta e conferma gli appuntamenti al posto tuo" },
      { name: "Promemoria Clienti", role: "Ricorda l'appuntamento il giorno prima, così non ti salta nessuno" },
      { name: "Addetto Preventivi", role: "Risponde su quanto costa ogni trattamento, listino alla mano" },
    ],
    connectors: [
      { name: "WhatsApp", why: "i clienti spostano gli appuntamenti da lì, a qualsiasi ora" },
      { name: "Google Calendar", why: "serve per vedere gli orari liberi in tempo reale" },
    ],
    knowledge: "il listino trattamenti",
    planId: "starter",
    planWhy: "il volume di un salone si gestisce bene anche col piano intermedio",
  },
  studio: {
    headline: "Per uno studio professionale ti metto in piedi questa squadra",
    agents: [
      { name: "Segreteria", role: "Filtra chi scrive e risponde alle domande che ricevi ogni giorno" },
      { name: "Filtro Nuovi Clienti", role: "Capisce se una richiesta vale il tuo tempo prima di passarla a te" },
      { name: "Solleciti Pagamenti", role: "Ricorda le fatture scadute con garbo, ma senza mollare" },
    ],
    connectors: [
      { name: "WhatsApp", why: "è dove ti arrivano le richieste fuori orario" },
      { name: "Google Calendar", why: "serve per fissare i primi appuntamenti senza rimpalli" },
    ],
    knowledge: "il tariffario",
    planId: "starter",
    planWhy: "uno studio ha meno volume ma richieste più lunghe: il piano intermedio basta",
  },
  altro: {
    headline: "Ti metto in piedi una squadra di base, poi la aggiustiamo parlando",
    agents: [
      { name: "Assistente", role: "Risponde ai clienti con le informazioni che gli dai" },
      { name: "Filtro Richieste", role: "Smista quello che arriva e ti chiama solo quando serve davvero" },
      { name: "Promemoria Clienti", role: "Ricontatta chi era interessato e poi è sparito" },
    ],
    connectors: [{ name: "WhatsApp", why: "è il canale che usano già tutti i tuoi clienti" }],
    knowledge: "i tuoi documenti",
    planId: "starter",
    planWhy: "si parte leggeri: se il volume cresce, si cambia in un clic",
  },
};

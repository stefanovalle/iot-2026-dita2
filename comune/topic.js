// ---------------------------------------------------------------------------
// I topic della flotta.
//
// Un posto solo per i nomi dei topic, perché devono essere identici per chi
// pubblica (l'auto) e per chi si iscrive (il servizio): una maiuscola diversa
// e i messaggi non arrivano, senza nessun errore.
//
// Sono quelli dell'albero disegnato a lezione:
//     flotta/AA123BB/telemetria     la misura, ogni pochi secondi
//     flotta/AA123BB/connessione    "online" oppure "offline", retained
//     flotta/AA123BB/comandi        i comandi per quell'auto (giornata 4)
// Se il nostro albero è diverso, cambiamolo qui: auto e servizio leggono
// entrambi da questo file.
//
// Su un broker condiviso con altre coppie (o su test.mosquitto.org) usiamo un
// prefisso nostro, altrimenti ci ritroviamo i dati degli altri:
//     PREFISSO=rossi-bianchi npm run auto       (e lo stesso per il servizio)
// Su PowerShell:  $env:PREFISSO="rossi-bianchi"; npm run auto
// ---------------------------------------------------------------------------

export const PREFISSO = process.env.PREFISSO ?? 'flotta';

/** Il topic su cui un'auto pubblica la sua telemetria. */
export const topicTelemetria = (targa) => `${PREFISSO}/${targa}/telemetria`;

/** Il topic con lo stato della connessione di un'auto: "online" o "offline". */
export const topicConnessione = (targa) => `${PREFISSO}/${targa}/connessione`;

/** Il topic dei comandi destinati a un'auto: l'auto ci si iscrive, il servizio ci pubblica. */
export const topicComandi = (targa) => `${PREFISSO}/${targa}/comandi`;

/** Il filtro per ricevere la telemetria di tutte le auto. */
export const FILTRO_TELEMETRIA = `${PREFISSO}/+/telemetria`;

/** Il filtro per ricevere lo stato di connessione di tutte le auto. */
export const FILTRO_CONNESSIONE = `${PREFISSO}/+/connessione`;

/** Da "flotta/AA123BB/telemetria" ricava "AA123BB". */
export function targaDalTopic(topic) {
  return topic.slice(PREFISSO.length + 1).split('/')[0];
}

// ---------------------------------------------------------------------------
// Gli eventi della flotta (giornata 6).
//
// Un evento dice che è successo qualcosa a un'auto: un noleggio è iniziato,
// un noleggio è finito, un'auto è andata in manutenzione. Il servizio lo
// pubblica su RabbitMQ, sull'exchange flotta.eventi (di tipo topic), con una
// chiave di instradamento fatta di tre parole separate dal punto:
//
//     noleggio.inizio.milano
//     noleggio.fine.milano
//     auto.guasto.milano
//
// Chi lo riceve non lo decide il servizio: lo decidono i binding delle code
// degli uffici (uffici/index.js), che sono configurazione e non codice.
//
// Su un RabbitMQ condiviso con altre coppie usiamo il PREFISSO, come per i
// topic MQTT: cambia il nome degli exchange e delle code, e non ci si pesta
// i piedi.
// ---------------------------------------------------------------------------

import { randomUUID } from 'node:crypto';
import { PREFISSO } from './topic.js';

/** L'indirizzo di RabbitMQ: utente e password sono quelli di broker/compose.yaml. */
export const URL_AMQP = process.env.AMQP ?? 'amqp://flotta:flotta@localhost:5672';

/** La città delle nostre auto: il simulatore le fa girare tutte a Milano. */
export const CITTA = process.env.CITTA ?? 'milano';

/** L'exchange su cui il servizio pubblica gli eventi: tipo topic. */
export const EXCHANGE_EVENTI = `${PREFISSO}.eventi`;

/** L'exchange che raccoglie i messaggi rifiutati dagli uffici (dead letter). */
export const EXCHANGE_ERRORI = `${PREFISSO}.errori`;

/** Il nome di una coda: "fatturazione", oppure "rossi-bianchi.fatturazione" con un prefisso nostro. */
export const nomeCoda = (nome) => (PREFISSO === 'flotta' ? nome : `${PREFISSO}.${nome}`);

/**
 * @typedef {object} Evento
 * @property {string} id        identificativo unico: chi lo riceve due volte se ne accorge
 * @property {string} tipo      "noleggio.inizio", "noleggio.fine" o "auto.guasto"
 * @property {string} targa
 * @property {string} citta
 * @property {number} batteria  com'era la batteria in quel momento
 * @property {number} lat
 * @property {number} lon
 * @property {string} istante
 */

/**
 * Dal cambio di stato di un'auto ricava il tipo di evento, oppure null se
 * non è successo niente che interessi a qualcuno.
 */
export function tipoEvento(prima, dopo) {
  if (prima === 'libera' && dopo === 'in_uso') return 'noleggio.inizio';
  if (prima === 'in_uso' && dopo === 'libera') return 'noleggio.fine';
  // Per la flotta, un'auto mandata in manutenzione è un'auto che si è guastata.
  if (prima !== 'in_manutenzione' && dopo === 'in_manutenzione') return 'auto.guasto';
  return null;
}

/** Crea un evento a partire dalla telemetria che l'ha fatto scattare. */
export function creaEvento(tipo, telemetria) {
  const { targa, batteria, lat, lon } = telemetria;
  return { id: randomUUID(), tipo, targa, citta: CITTA, batteria, lat, lon, istante: new Date().toISOString() };
}

/** La chiave di instradamento: dal generale al particolare, per esempio "noleggio.fine.milano". */
export const chiaveEvento = (evento) => `${evento.tipo}.${evento.citta}`;

/** L'indirizzo senza la password, per stamparlo. */
export const senzaPassword = (url) => url.replace(/\/\/[^@/]*@/, '//');

/**
 * Dichiara un exchange o una coda su un canale usa e getta.
 *
 * Se l'oggetto esiste già con impostazioni diverse (per esempio creato a
 * mano dalla console, al passo 1 del laboratorio), RabbitMQ non lo modifica:
 * risponde con un errore 406 e chiude il canale. In quel caso avvisiamo e
 * usiamo quello che c'è.
 * @returns {Promise<any|null>} quello che risponde RabbitMQ, oppure null
 */
export async function dichiara(connessione, descrizione, operazione) {
  const canale = await connessione.createChannel();
  canale.on('error', () => {}); // l'errore lo gestiamo qui sotto
  try {
    const risposta = await operazione(canale);
    await canale.close();
    return risposta;
  } catch (errore) {
    if (errore.code !== 406) throw errore;
    console.log(`!! ${descrizione} esiste già con impostazioni diverse: usiamo quella che c'è.`);
    console.log('   Se la vogliamo come la dichiara il programma, cancelliamola dalla console e ripartiamo.');
    return null;
  }
}

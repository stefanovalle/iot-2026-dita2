// ---------------------------------------------------------------------------
// GIORNATA 6 — i tre uffici che ricevono gli eventi della flotta.
//
//     npm run ufficio -- fatturazione
//     npm run ufficio -- manutenzione
//     npm run ufficio -- analisi
//
// Un programma solo che si avvia in tre modi diversi, uno per terminale. Ogni
// ufficio ha la sua coda su RabbitMQ, legata all'exchange flotta.eventi con i
// suoi binding: nessuno dei tre sa che esistono gli altri due, e il servizio
// non sa che esistono i tre.
//
// Variabili d'ambiente, se servono:
//     AMQP       l'indirizzo di RabbitMQ (predefinito amqp://flotta:flotta@localhost:5672)
//     PREFISSO   come per MQTT: su un RabbitMQ condiviso cambia i nomi di exchange e code
//     LENTO      millisecondi di "lavoro" per ogni evento (predefinito 300)
//     FALLISCI   una targa: gli eventi di quell'auto vengono rifiutati e finiscono
//                nella coda degli errori (passo 5 del laboratorio)
// ---------------------------------------------------------------------------

import amqp from 'amqplib';
import {
  EXCHANGE_ERRORI, EXCHANGE_EVENTI, URL_AMQP, dichiara, nomeCoda, senzaPassword,
} from '../comune/eventi.js';

// Chi vuole cosa. Sono le righe della slide «Fine noleggio, e tre uffici
// diversi»: per aggiungere un quarto ufficio basta una riga qui, oppure un
// binding creato dalla console. Il servizio non si tocca.
const UFFICI = {
  fatturazione: ['noleggio.fine.*'],
  manutenzione: ['noleggio.#', 'auto.guasto.*'],
  analisi: ['#'],
};

const ufficio = process.argv[2];
if (!UFFICI[ufficio]) {
  console.log(`Uso: npm run ufficio -- ${Object.keys(UFFICI).join(' | ')}`);
  process.exit(1);
}
const LENTO = Number(process.env.LENTO ?? 300);
const FALLISCI = process.env.FALLISCI?.toUpperCase();

const coda = nomeCoda(ufficio);
const codaErrori = nomeCoda(`${ufficio}.errori`);
const ora = () => new Date().toLocaleTimeString('it-IT');
const attendi = (ms) => new Promise((fatto) => setTimeout(fatto, ms));

let connessione;
try {
  connessione = await amqp.connect(URL_AMQP);
} catch (errore) {
  const suggerimento = errore.code === 'ECONNREFUSED' ? ' (RabbitMQ è acceso? docker compose up -d rabbitmq in broker/)' : '';
  console.log(`!! RabbitMQ non raggiungibile: ${errore.code ?? errore.message}${suggerimento}`);
  process.exit(1);
}
connessione.on('close', () => {
  console.log('!! RabbitMQ ha chiuso la connessione: riavviamo l\'ufficio quando è tornato.');
  process.exit(1);
});

// 1. Gli exchange: quello degli eventi (topic) e quello degli errori (direct).
//    Li dichiara anche il servizio: chi arriva primo li crea, l'altro li trova.
await dichiara(connessione, `L'exchange ${EXCHANGE_EVENTI}`, (c) =>
  c.assertExchange(EXCHANGE_EVENTI, 'topic', { durable: true }));
await dichiara(connessione, `L'exchange ${EXCHANGE_ERRORI}`, (c) =>
  c.assertExchange(EXCHANGE_ERRORI, 'direct', { durable: true }));

// 2. La coda degli errori di questo ufficio, legata all'exchange degli errori
//    con il nome dell'ufficio come chiave.
await dichiara(connessione, `La coda ${codaErrori}`, async (c) => {
  await c.assertQueue(codaErrori, { durable: true });
  await c.bindQueue(codaErrori, EXCHANGE_ERRORI, ufficio);
});

// 3. La coda dell'ufficio: durevole (sopravvive al riavvio del broker) e con
//    il suo dead letter: quello che rifiutiamo va nell'exchange degli errori,
//    con il nome dell'ufficio come chiave, e da lì nella coda degli errori.
const stato = await dichiara(connessione, `La coda ${coda}`, (c) =>
  c.assertQueue(coda, {
    durable: true,
    arguments: { 'x-dead-letter-exchange': EXCHANGE_ERRORI, 'x-dead-letter-routing-key': ufficio },
  }));

const canale = await connessione.createChannel();

/**
 * TODO giornata 6 (passo 3, prima parte) — legare la coda all'exchange.
 * Un binding per ogni chiave dell'ufficio: canale.bindQueue(coda, exchange, chiave).
 * Se il binding esiste già (creato dalla console al passo 1) non succede niente.
 */
async function leghiLaCoda(chiavi) {
  for (const chiave of chiavi) {
    await canale.bindQueue(coda, EXCHANGE_EVENTI, chiave);
  }
}

await leghiLaCoda(UFFICI[ufficio]);

// Gli id già elaborati: se lo stesso evento arriva due volte (succede, con la
// riconsegna) lo riconosciamo. È la stessa difesa dei comandi della giornata 2.
const giaVisti = new Set();
const conteggio = {};

/**
 * TODO giornata 6 (passo 3, seconda parte) — cosa fare con un evento.
 * Leggerlo, fare il lavoro, e solo alla fine dire a RabbitMQ che è fatto:
 * canale.ack(messaggio). Se il programma muore prima dell'ack, RabbitMQ lo
 * ridà a qualcun altro.
 */
async function quandoArriva(messaggio) {
  const evento = JSON.parse(messaggio.content.toString());

  if (giaVisti.has(evento.id)) {
    console.log(`${ora()}  doppione di ${evento.id}: lo confermiamo senza rifarlo`);
    canale.ack(messaggio);
    return;
  }

  // Passo 5, se avanza tempo: un evento che non sappiamo trattare. Lo
  // rifiutiamo senza rimetterlo in coda (il terzo argomento, false): va al
  // dead letter. Con true tornerebbe in testa alla coda, all'infinito.
  if (FALLISCI && evento.targa === FALLISCI) {
    console.log(`${ora()}  ${evento.tipo} di ${evento.targa}: rifiutato, va in ${codaErrori}`);
    canale.nack(messaggio, false, false);
    return;
  }

  await attendi(LENTO); // il "lavoro" dell'ufficio
  giaVisti.add(evento.id);
  conteggio[evento.tipo] = (conteggio[evento.tipo] ?? 0) + 1;
  const quando = new Date(evento.istante).toLocaleTimeString('it-IT');
  const chiave = messaggio.fields.routingKey;
  if (ufficio === 'fatturazione') {
    console.log(`${ora()}  fattura: noleggio di ${evento.targa} finito alle ${quando}, batteria ${evento.batteria}%  [${chiave}]`);
  } else if (ufficio === 'manutenzione') {
    console.log(`${ora()}  ${evento.tipo} di ${evento.targa}, batteria ${evento.batteria}%  [${chiave}]`);
  } else {
    const totale = Object.entries(conteggio).map(([tipo, n]) => `${tipo} ${n}`).join(', ');
    console.log(`${ora()}  ${evento.tipo} di ${evento.targa}  ·  finora: ${totale}`);
  }
  canale.ack(messaggio);
}

// 4. Uno alla volta: il prossimo arriva quando abbiamo confermato questo
//    (prefetch, slide «Due consumatori sulla stessa coda»).
await canale.prefetch(1);
await canale.consume(coda, async (messaggio) => {
  if (messaggio === null) return; // la coda è stata cancellata dalla console
  try {
    await quandoArriva(messaggio);
  } catch (errore) {
    console.log(`!! ${errore.message}`);
  }
}, { noAck: false });

const inAttesa = stato ? ` (${stato.messageCount} eventi ci aspettavano)` : '';
console.log(`Ufficio ${ufficio} collegato a ${senzaPassword(URL_AMQP)}: legge la coda ${coda}${inAttesa}.`);
console.log(`Binding su ${EXCHANGE_EVENTI}: ${UFFICI[ufficio].join(', ')}. Ctrl+C per spegnerlo.`);

process.on('SIGINT', async () => {
  console.log(`\nUfficio ${ufficio} spento. La coda resta su RabbitMQ, e aspetta.`);
  await connessione.close().catch(() => {});
  process.exit(0);
});

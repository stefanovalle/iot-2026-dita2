// ---------------------------------------------------------------------------
// GIORNATA 3 — il servizio si iscrive al broker.
//
// Con HTTP era l'auto a chiamare il servizio. Con MQTT nessuno chiama nessuno:
// l'auto pubblica sul broker, il servizio si è iscritto, e il broker consegna.
// Il servizio, per il broker, è un client come tutti gli altri.
//
// Qui riceviamo due cose:
//   - la telemetria:   flotta/+/telemetria   -> la salviamo in memoria
//   - la connessione:  flotta/+/connessione  -> "online" o "offline", retained
// ---------------------------------------------------------------------------

import mqtt from 'mqtt';
import { telemetriaValida } from '../comune/modelli.js';
import { FILTRO_CONNESSIONE, FILTRO_TELEMETRIA, targaDalTopic } from '../comune/topic.js';
import { registraMqtt } from './registro.js';

// I TODO si segnalano una volta sola, per non riempire lo schermo.
const giaSegnalati = new Set();
function segnalaUnaVolta(messaggio) {
  if (giaSegnalati.has(messaggio)) return;
  giaSegnalati.add(messaggio);
  console.log(`!! ${messaggio}`);
}

/**
 * Si collega al broker, si iscrive ai topic della flotta e mette in memoria
 * quello che arriva.
 * @param {string} urlBroker  per esempio "mqtt://localhost:1883"
 * @param {import('./memoria.js').MemoriaFlotta} memoria
 */
export function collegaBroker(urlBroker, memoria) {
  // Un clientId unico: se due servizi usassero lo stesso, il broker
  // chiuderebbe la connessione del primo ogni volta che si collega il secondo.
  const client = mqtt.connect(urlBroker, { clientId: `servizio-flotta-${process.pid}` });

  client.on('connect', async () => {
    console.log(`Servizio collegato al broker ${urlBroker}`);
    // Ci iscriviamo a ogni (ri)connessione: con una sessione pulita il broker
    // non si ricorda delle iscrizioni di prima.
    // TODO giornata 3 (passo 4) — iscriversi anche alla telemetria.
    //   Un SUBSCRIBE può contenere più iscrizioni: aggiungiamo FILTRO_TELEMETRIA
    //   (comune/topic.js) con il suo QoS. Il QoS dell'iscrizione è un tetto:
    //   quale ci serve?
    await client.subscribeAsync({
      [FILTRO_CONNESSIONE]: { qos: 1 },
    });
    console.log(`Iscritto a ${FILTRO_CONNESSIONE}`);
  });

  client.on('message', (topic, payload, pacchetto) => {
    registraMqtt(topic, payload, pacchetto);
    const targa = targaDalTopic(topic);

    if (topic.endsWith('/telemetria')) {
      // TODO giornata 3 (passo 4) — mettere in memoria la misura arrivata.
      //
      //  1. payload è un Buffer (byte): payload.toString() lo rende testo, e
      //     JSON.parse lo trasforma in oggetto. Se non è JSON valido, JSON.parse
      //     lancia un errore: try/catch, un avviso, e ignoriamo il messaggio.
      //  2. telemetriaValida(dato) controlla i campi, come per la POST.
      //  3. memoria.salvaTelemetria({ ...dato, targa }): la targa la prendiamo
      //     dal topic, non dal contenuto. È il topic a dire di chi è.
      //
      //  Quando funziona, la dashboard torna a mostrare l'auto.
      segnalaUnaVolta('TODO giornata 3: salvare la telemetria in cloud/mqtt.js');
    } else if (topic.endsWith('/connessione')) {
      memoria.salvaConnessione(targa, payload.toString());
    }
  });

  // mqtt.js riprova da solo a collegarsi ogni secondo: ci basta avvisare una volta.
  let avvisato = false;
  client.on('error', (errore) => {
    if (avvisato) return;
    avvisato = true;
    const suggerimento = errore.code === 'ECONNREFUSED' ? ' (il broker è acceso? npm run broker, oppure docker compose up -d in broker/)' : '';
    console.log(`!! broker MQTT non raggiungibile: ${errore.code ?? errore.message}${suggerimento}`);
  });
  client.on('connect', () => (avvisato = false));

  return client;
}

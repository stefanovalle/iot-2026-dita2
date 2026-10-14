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
//
// GIORNATA 4 — e ne mandiamo una: i comandi, su flotta/{targa}/comandi.
// Il servizio, che finora aspettava le domande delle auto, adesso parla per
// primo. È il punto di tutto il corso.
// ---------------------------------------------------------------------------

import mqtt from 'mqtt';
import { telemetriaValida } from '../comune/modelli.js';
import { FILTRO_CONNESSIONE, FILTRO_TELEMETRIA, targaDalTopic, topicComandi } from '../comune/topic.js';
import { registraMqtt } from './registro.js';

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
    await client.subscribeAsync({
      [FILTRO_TELEMETRIA]: { qos: 0 },
      [FILTRO_CONNESSIONE]: { qos: 1 },
    });
    console.log(`Iscritto a ${FILTRO_TELEMETRIA} e ${FILTRO_CONNESSIONE}`);
  });

  client.on('message', (topic, payload, pacchetto) => {
    registraMqtt(topic, payload, pacchetto);
    const targa = targaDalTopic(topic);

    if (topic.endsWith('/telemetria')) {
      let dato;
      try {
        dato = JSON.parse(payload.toString());
      } catch {
        console.warn(`[mqtt] su ${topic} è arrivato qualcosa che non è JSON: lo ignoriamo`);
        return;
      }
      if (!telemetriaValida(dato)) {
        console.warn(`[mqtt] telemetria incompleta su ${topic}: la ignoriamo`);
        return;
      }
      // La targa la prendiamo dal topic, non dal contenuto: è il topic a dire di chi è.
      memoria.salvaTelemetria({ ...dato, targa });
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

/**
 * Pubblica un comando sul topic dei comandi della sua auto.
 * @param {import('mqtt').MqttClient} client  quello restituito da collegaBroker
 * @param {import('../comune/modelli.js').Comando} comando
 */
export async function pubblicaComando(client, comando) {
  // TODO giornata 4 (passo 3) — il servizio parla per primo.
  //
  //  1. Se il client non è connesso (client.connected), lanciamo un errore:
  //     POST /comandi risponderà 503.
  //  2. Il topic: topicComandi(comando.targa), da comune/topic.js.
  //  3. await client.publishAsync(topic, JSON.stringify(comando), { qos, retain })
  //     QoS: deve arrivare. Retained: pensiamoci bene. Un "apri" lasciato
  //     appeso al topic cosa farebbe a chi si iscrive domani mattina?
  //  4. Una riga nel log, come quelle del registro, aiuta a vedere cosa parte.
  throw new Error('TODO giornata 4: pubblicaComando in cloud/mqtt.js');
}

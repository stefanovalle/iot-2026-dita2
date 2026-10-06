// ---------------------------------------------------------------------------
// GIORNATA 3 — il trasporto MQTT.
//
// Gli stessi due metodi di TrasportoHttp, un protocollo diverso sotto:
//   - inviaTelemetria: un PUBLISH sul topic della telemetria. Niente risposta
//     da aspettare, niente intestazioni da ripetere: la connessione è già
//     aperta e il broker sa già chi siamo, gliel'abbiamo detto nel CONNECT.
//   - ascoltaComandi: per oggi resta il polling HTTP di ieri. Alla giornata 4
//     diventerà un'iscrizione al topic dei comandi, e il polling sparirà.
//
// La libreria è MQTT.js (npm install, una volta sola): si occupa lei di
// costruire i pacchetti, di mandare i PINGREQ e di riprovare quando la
// connessione cade.
// ---------------------------------------------------------------------------

import mqtt from 'mqtt';
import { Trasporto } from './trasporto.js';
import { TrasportoHttp } from './http.js';
import { topicConnessione, topicTelemetria } from '../../comune/topic.js';

export class TrasportoMqtt extends Trasporto {
  /**
   * @param {string} urlBroker    per esempio "mqtt://localhost:1883"
   * @param {string} targa        la targa di questa auto
   * @param {string} urlServizio  serve ancora per i comandi, che oggi restano in HTTP
   */
  constructor(urlBroker, targa, urlServizio) {
    super();
    this.targa = targa;
    this.urlBroker = urlBroker;
    this.topicTelemetria = topicTelemetria(targa);
    this.topicConnessione = topicConnessione(targa);

    // I comandi, per oggi, li chiede ancora il vecchio trasporto HTTP.
    this.comandiHttp = new TrasportoHttp(urlServizio, targa);

    // Il CONNECT: i campi sono quelli della slide del pacchetto.
    this.client = mqtt.connect(urlBroker, {
      clientId: `auto-${targa}`, // unico sul broker: è la targa
      clean: true, // la sessione ricordata è materia della giornata 4
      keepalive: 60, // secondi: se tacciamo più a lungo, PINGREQ
      // TODO giornata 3, se avanza tempo (passo 5) — il testamento.
      //   Un campo "will" con topic, payload, qos e retain: se l'auto sparisce
      //   senza salutare, il broker pubblica "offline" al posto suo, retained,
      //   su this.topicConnessione. È la slide «Lo stato dell'auto».
    });

    this.client.on('connect', () => {
      console.log(`[mqtt] collegata al broker ${urlBroker} come auto-${targa}`);
      // TODO giornata 3, se avanza tempo (passo 5) — appena connessa diciamo
      //   che ci siamo: "online" su this.topicConnessione, QoS 1, retained.
      //   Lo strumento è this.client.publish(topic, testo, { qos, retain }).
    });

    // mqtt.js riprova da solo a collegarsi ogni secondo: avvisiamo una volta.
    let avvisato = false;
    this.client.on('error', (errore) => {
      if (avvisato) return;
      avvisato = true;
      const suggerimento = errore.code === 'ECONNREFUSED' ? ' (il broker è acceso?)' : '';
      console.log(`[mqtt] broker non raggiungibile: ${errore.code ?? errore.message}${suggerimento}`);
    });
    this.client.on('offline', () => console.log('[mqtt] connessione persa, riprovo'));
    this.client.on('connect', () => (avvisato = false));
  }

  async inviaTelemetria(dato) {
    // TODO giornata 3 (passo 3) — pubblicare una misura.
    //
    //  1. Se la connessione non c'è (this.client.connected è false), lanciamo
    //     un errore che lo dica: la misura va persa. Alla giornata 4 la
    //     terremo da parte in una coda, per mandarla dopo.
    //  2. Il topic è già pronto: this.topicTelemetria.
    //  3. Il contenuto è testo: JSON.stringify(dato), come con HTTP.
    //  4. await this.client.publishAsync(topic, contenuto, { qos })
    //     Quale QoS? Ripensiamo alla tabella «Quale QoS per quale flusso».
    //
    //  Quando funziona, apriamo MQTT Explorer (o npm run ascolta): i messaggi
    //  compaiono lì, senza che il servizio sappia ancora niente.
    throw new Error('TODO giornata 3: inviaTelemetria in auto/trasporti/mqtt.js');
  }

  ascoltaComandi(quandoArriva) {
    this.comandiHttp.ascoltaComandi(quandoArriva);
  }

  async chiudi() {
    await this.comandiHttp.chiudi();
    // TODO giornata 3, se avanza tempo (passo 5) — spegnimento educato: il
    //   testamento non parte, quindi "offline" lo pubblichiamo noi, prima di
    //   chiudere (solo se siamo ancora connessi). Usiamo publishAsync con
    //   await: altrimenti endAsync chiude prima che il messaggio parta.
    await this.client.endAsync();
  }
}

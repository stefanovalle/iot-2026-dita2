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
      // Il testamento: se spariamo senza salutare, il broker pubblica
      // "offline" al posto nostro, retained, sul topic della connessione.
      will: { topic: this.topicConnessione, payload: 'offline', qos: 1, retain: true },
    });

    this.client.on('connect', () => {
      console.log(`[mqtt] collegata al broker ${urlBroker} come auto-${targa}`);
      // Appena connessa diciamo che ci siamo: stesso topic del testamento,
      // retained anche lui. Sul topic c'è sempre e solo l'ultima verità.
      this.client.publish(this.topicConnessione, 'online', { qos: 1, retain: true });
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
    // Se la connessione non c'è, la misura va persa: lo diciamo chiaramente.
    // Alla giornata 4 la terremo da parte in una coda, per mandarla dopo.
    if (!this.client.connected) {
      throw new Error('broker non raggiungibile, misura persa');
    }
    // QoS 0: tra pochi secondi ne arriva un'altra, perderne una non cambia niente.
    await this.client.publishAsync(this.topicTelemetria, JSON.stringify(dato), { qos: 0 });
  }

  ascoltaComandi(quandoArriva) {
    this.comandiHttp.ascoltaComandi(quandoArriva);
  }

  async chiudi() {
    await this.comandiHttp.chiudi();
    // Spegnimento educato: il testamento non parte, quindi "offline" lo
    // pubblichiamo noi, prima del DISCONNECT.
    if (this.client.connected) {
      await this.client.publishAsync(this.topicConnessione, 'offline', { qos: 1, retain: true });
    }
    await this.client.endAsync();
  }
}

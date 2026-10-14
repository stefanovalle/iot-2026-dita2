// ---------------------------------------------------------------------------
// GIORNATA 3 e 4 — il trasporto MQTT.
//
// Gli stessi due metodi di TrasportoHttp, un protocollo diverso sotto:
//   - inviaTelemetria: un PUBLISH sul topic della telemetria (giornata 3).
//   - ascoltaComandi: un SUBSCRIBE sul topic dei comandi di questa auto
//     (giornata 4). Il polling sparisce: il comando arriva quando c'è, sulla
//     connessione che l'auto ha già aperto.
//
// La libreria è MQTT.js: costruisce i pacchetti, manda i PINGREQ e riprova
// da sola quando la connessione cade.
//
// Variabile d'ambiente per il laboratorio sulle sessioni (giornata 4):
//     SESSIONE=ricordata   il broker si ricorda di noi tra una connessione e
//                          l'altra (clean: false): iscrizioni e comandi QoS 1
//                          arrivati mentre eravamo via ci aspettano.
// ---------------------------------------------------------------------------

import mqtt from 'mqtt';
import { Trasporto } from './trasporto.js';
import { topicComandi, topicConnessione, topicTelemetria } from '../../comune/topic.js';

const SESSIONE_RICORDATA = process.env.SESSIONE === 'ricordata';

// I TODO si segnalano una volta sola, per non riempire lo schermo.
const giaSegnalati = new Set();
function todo(messaggio) {
  if (giaSegnalati.has(messaggio)) return;
  giaSegnalati.add(messaggio);
  console.log(`!! ${messaggio}`);
}

export class TrasportoMqtt extends Trasporto {
  /**
   * @param {string} urlBroker  per esempio "mqtt://localhost:1883"
   * @param {string} targa      la targa di questa auto
   */
  constructor(urlBroker, targa) {
    super();
    this.targa = targa;
    this.urlBroker = urlBroker;
    this.topicTelemetria = topicTelemetria(targa);
    this.topicConnessione = topicConnessione(targa);
    this.topicComandi = topicComandi(targa);
    this.quandoArriva = null; // chi avvisare quando arriva un comando

    // Il CONNECT: i campi sono quelli della slide del pacchetto.
    this.client = mqtt.connect(urlBroker, {
      clientId: `auto-${targa}`, // unico sul broker: è la targa
      clean: !SESSIONE_RICORDATA, // sessione pulita, salvo SESSIONE=ricordata
      keepalive: 60, // secondi: se tacciamo più a lungo, PINGREQ
      // Il testamento: se spariamo senza salutare, il broker pubblica
      // "offline" al posto nostro, retained, sul topic della connessione.
      will: { topic: this.topicConnessione, payload: 'offline', qos: 1, retain: true },
    });

    this.client.on('connect', (connack) => {
      const sessione = SESSIONE_RICORDATA ? (connack.sessionPresent ? 'ricordata, ritrovata' : 'ricordata, nuova') : 'pulita';
      console.log(`[mqtt] collegata al broker ${urlBroker} come auto-${targa} (sessione ${sessione})`);
      // Appena connessa diciamo che ci siamo: stesso topic del testamento,
      // retained anche lui. Sul topic c'è sempre e solo l'ultima verità.
      this.client.publish(this.topicConnessione, 'online', { qos: 1, retain: true });
      // Con la sessione pulita il broker dimentica le iscrizioni a ogni
      // disconnessione: le rifacciamo a ogni (ri)connessione.
      if (this.quandoArriva) this.iscriviAiComandi();
    });

    // Ogni messaggio ricevuto passa da qui, qualunque sia il topic.
    this.client.on('message', (topic, payload) => {
      if (topic !== this.topicComandi || !this.quandoArriva) return;
      // TODO giornata 4 (passo 2) — consegnare il comando al resto del programma.
      //
      //  1. payload è un Buffer: payload.toString() è il testo, JSON.parse lo
      //     trasforma nell'oggetto comando { id, targa, azione, istante }.
      //     Se non è JSON valido: try/catch, un avviso, e lo ignoriamo.
      //  2. this.quandoArriva(comando): è la funzione che auto/index.js ci ha
      //     passato in ascoltaComandi. Esegue il comando e riconosce i doppioni
      //     dall'id (con QoS 1 un comando può arrivare due volte).
      todo('TODO giornata 4: consegnare il comando, nel gestore "message" di auto/trasporti/mqtt.js');
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
    if (!this.client.connected) {
      throw new Error('broker non raggiungibile, misura persa');
    }
    // QoS 0: tra pochi secondi ne arriva un'altra, perderne una non cambia niente.
    await this.client.publishAsync(this.topicTelemetria, JSON.stringify(dato), { qos: 0 });
  }

  ascoltaComandi(quandoArriva) {
    this.quandoArriva = quandoArriva;
    // Se siamo già connessi ci iscriviamo subito; altrimenti lo farà
    // l'evento 'connect', appena la connessione è pronta.
    if (this.client.connected) this.iscriviAiComandi();
  }

  /** Il SUBSCRIBE al topic dei comandi di questa auto. */
  async iscriviAiComandi() {
    // TODO giornata 4 (passo 1) — iscriversi al topic dei comandi.
    //
    //  1. Il topic è già pronto: this.topicComandi (flotta/AA123BB/comandi).
    //  2. await this.client.subscribeAsync(topic, { qos }) restituisce un
    //     elenco con il QoS concesso dal broker (il SUBACK): stampiamolo.
    //     Quale QoS per un comando? Ripensiamo alla tabella della giornata 3.
    //  3. Se qualcosa va storto, un avviso (try/catch): non fermiamo l'auto.
    //
    //  Questo metodo lo chiamano ascoltaComandi e l'evento 'connect': con la
    //  sessione pulita il broker dimentica le iscrizioni a ogni disconnessione.
    todo('TODO giornata 4: iscriversi ai comandi in iscriviAiComandi, auto/trasporti/mqtt.js');
  }

  async chiudi() {
    // Spegnimento educato: il testamento non parte, quindi "offline" lo
    // pubblichiamo noi, prima del DISCONNECT.
    if (this.client.connected) {
      await this.client.publishAsync(this.topicConnessione, 'offline', { qos: 1, retain: true });
    }
    await this.client.endAsync();
  }
}

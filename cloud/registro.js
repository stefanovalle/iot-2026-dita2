// ---------------------------------------------------------------------------
// Il registro del servizio.
//
// Scrive una riga per ogni richiesta HTTP e per ogni messaggio MQTT che
// arriva, e ogni 30 secondi un riepilogo: quanti byte di protocollo, e quanti
// di quei byte erano davvero dati. È lo strumento con cui confrontiamo i
// protocolli: alla giornata 2 c'era solo HTTP, dalla giornata 3 c'è anche MQTT.
//
// I byte sono quelli del protocollo e basta: per HTTP prima riga, intestazioni
// e corpo; per MQTT il pacchetto PUBLISH intero. Non contiamo TCP e TLS, che
// a lezione abbiamo visto pesare anche di più.
//
// Le richieste della dashboard non hanno una riga propria (sarebbero troppe):
// finiscono solo nel riepilogo.
// ---------------------------------------------------------------------------

const OGNI_MS = 30_000;

const ora = () => new Date().toLocaleTimeString('it-IT');
const kb = (byte) => (byte / 1024).toFixed(1);
const percento = (parte, tutto) => (tutto ? ((100 * parte) / tutto).toFixed(0) : '0');

/** '/auto/AA123BB/comandi' diventa '/auto/:targa/comandi', per raggruppare. */
const generico = (percorso) => percorso.replace(/^\/auto\/[^/]+/, '/auto/:targa');

/** 'flotta/AA123BB/telemetria' diventa 'flotta/+/telemetria', per raggruppare. */
const topicGenerico = (topic) => topic.replace(/^([^/]+)\/[^/]+/, '$1/+');

function byteRichiesta(req) {
  let byte = Buffer.byteLength(`${req.method} ${req.url} HTTP/${req.httpVersion}\r\n`);
  for (let i = 0; i < req.rawHeaders.length; i += 2) {
    byte += Buffer.byteLength(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}\r\n`);
  }
  return byte + 2 + Number(req.headers['content-length'] ?? 0);
}

function byteRisposta(res) {
  // Node aggiunge da solo Date, Connection e Keep-Alive: circa 70 byte.
  let byte = Buffer.byteLength(`HTTP/1.1 ${res.statusCode} ${res.statusMessage}\r\n`) + 70;
  for (const [nome, valore] of Object.entries(res.getHeaders())) {
    byte += Buffer.byteLength(`${nome}: ${valore}\r\n`);
  }
  return byte + 2 + Number(res.getHeader('content-length') ?? 0);
}

/** Un pacchetto MQTT intero: 1 byte di tipo, da 1 a 4 di lunghezza, poi il resto. */
function bytePacchettoMqtt(lunghezzaRestante) {
  const byteLunghezza = lunghezzaRestante < 128 ? 1 : lunghezzaRestante < 16_384 ? 2 : lunghezzaRestante < 2_097_152 ? 3 : 4;
  return 1 + byteLunghezza + lunghezzaRestante;
}

function nuovaFinestra() {
  return {
    http: { richieste: 0, byte: 0, datoUtile: 0, pollingVuoti: 0, perTipo: new Map() },
    mqtt: { messaggi: 0, byte: 0, datoUtile: 0, perTopic: new Map() },
  };
}

let finestra = nuovaFinestra();

function riepilogo() {
  const { http, mqtt } = finestra;
  if (http.richieste === 0 && mqtt.messaggi === 0) return;
  const elenco = (mappa) =>
    [...mappa.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([tipo, quante]) => `      ${String(quante).padStart(5)}  ${tipo}`)
      .join('\n');

  let testo = `\n---- ultimi ${OGNI_MS / 1000} secondi -------------------------------------\n`;
  if (http.richieste > 0) {
    testo +=
      `  HTTP: ${http.richieste} richieste, ${kb(http.byte)} KB, ` +
      `di cui ${kb(http.datoUtile)} KB di telemetria vera (${percento(http.datoUtile, http.byte)}%)\n` +
      `  richieste di polling tornate senza comandi: ${http.pollingVuoti}\n${elenco(http.perTipo)}\n`;
  }
  if (mqtt.messaggi > 0) {
    testo +=
      `  MQTT: ${mqtt.messaggi} messaggi, ${kb(mqtt.byte)} KB, ` +
      `di cui ${kb(mqtt.datoUtile)} KB di telemetria vera (${percento(mqtt.datoUtile, mqtt.byte)}%)\n${elenco(mqtt.perTopic)}\n`;
  }
  console.log(testo + '-----------------------------------------------------------\n');
  finestra = nuovaFinestra();
}

setInterval(riepilogo, OGNI_MS).unref();

/** Il registro delle richieste HTTP: si aggiunge al router con app.use(registro()). */
export function registro() {
  return (req, res) => {
    const inizio = performance.now();
    const daDashboard = req.headers['x-dashboard'] === '1';

    res.on('finish', () => {
      const http = finestra.http;
      const millisecondi = (performance.now() - inizio).toFixed(1);
      const tipo = `${req.method} ${generico(req.path)}${daDashboard ? '  (dashboard)' : ''}`;

      http.richieste += 1;
      http.byte += byteRichiesta(req) + byteRisposta(res);
      http.perTipo.set(tipo, (http.perTipo.get(tipo) ?? 0) + 1);
      if (req.method === 'POST' && req.path.endsWith('/telemetria')) {
        http.datoUtile += Number(req.headers['content-length'] ?? 0);
      }
      const vuoto = res.statusCode === 204 || Number(res.getHeader('content-length')) <= 2;
      if (req.method === 'GET' && req.path.endsWith('/comandi') && vuoto) http.pollingVuoti += 1;

      if (!daDashboard) {
        console.log(`${ora()}  ${req.method.padEnd(6)} ${req.path.padEnd(30)} ${res.statusCode}  ${millisecondi} ms`);
      }
    });
  };
}

/**
 * Il registro dei messaggi MQTT: si chiama per ogni messaggio che arriva al
 * servizio, con quello che mqtt.js ci passa nell'evento 'message'.
 */
export function registraMqtt(topic, payload, pacchetto) {
  const mqtt = finestra.mqtt;
  const byte = bytePacchettoMqtt(pacchetto.length);
  mqtt.messaggi += 1;
  mqtt.byte += byte;
  if (topic.endsWith('/telemetria')) mqtt.datoUtile += payload.length;
  const tipo = topicGenerico(topic) + (pacchetto.retain ? '  (retained)' : '');
  mqtt.perTopic.set(tipo, (mqtt.perTopic.get(tipo) ?? 0) + 1);
  console.log(`${ora()}  MQTT   ${topic.padEnd(30)} ${String(byte).padStart(3)} byte`);
}

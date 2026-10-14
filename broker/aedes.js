// ---------------------------------------------------------------------------
// Un broker MQTT di riserva, scritto in JavaScript (la libreria Aedes).
//
//     npm run broker
//
// Serve solo a chi non ha Docker: il broker del corso è Mosquitto, in
// broker/compose.yaml. Come Mosquitto ascolta MQTT sulla porta 1883 e MQTT
// dentro i WebSocket sulla 9001 (quella della dashboard nel browser), e
// scrive chi si collega e chi se ne va: utile per vedere il testamento.
// ---------------------------------------------------------------------------

import http from 'node:http';
import net from 'node:net';
import { Aedes } from 'aedes';
import { WebSocketServer, createWebSocketStream } from 'ws';

const PORTA = Number(process.env.PORTA_BROKER ?? 1883);
const PORTA_WS = Number(process.env.PORTA_BROKER_WS ?? 9001);
const ora = () => new Date().toLocaleTimeString('it-IT');

const broker = await Aedes.createBroker();

broker.on('client', (client) => console.log(`${ora()}  collegato:   ${client.id}`));
broker.on('clientDisconnect', (client) => console.log(`${ora()}  scollegato:  ${client.id}`));
broker.on('subscribe', (iscrizioni, client) => {
  for (const { topic, qos } of iscrizioni) console.log(`${ora()}  iscrizione:  ${client.id} -> ${topic} (QoS ${qos})`);
});

function occupata(porta) {
  return (errore) => {
    if (errore.code === 'EADDRINUSE') {
      console.log(`La porta ${porta} è già occupata: c'è già un broker acceso (Mosquitto in Docker?).`);
      process.exit(1);
    }
    throw errore;
  };
}

// MQTT semplice, su TCP.
const server = net.createServer(broker.handle);
server.on('error', occupata(PORTA));
server.listen(PORTA, () => console.log(`Broker di riserva (Aedes): MQTT su mqtt://localhost:${PORTA}`));

// MQTT dentro i WebSocket, per i browser. Il client chiede il sottoprotocollo "mqtt".
const serverHttp = http.createServer();
const ws = new WebSocketServer({ server: serverHttp, handleProtocols: (protocolli) => (protocolli.has('mqtt') ? 'mqtt' : false) });
ws.on('connection', (socket, richiesta) => broker.handle(createWebSocketStream(socket), richiesta));
serverHttp.on('error', occupata(PORTA_WS));
serverHttp.listen(PORTA_WS, () => console.log(`                            WebSocket su ws://localhost:${PORTA_WS}  (Ctrl+C per spegnerlo)`));

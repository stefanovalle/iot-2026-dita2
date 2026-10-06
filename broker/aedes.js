// ---------------------------------------------------------------------------
// Un broker MQTT di riserva, scritto in JavaScript (la libreria Aedes).
//
//     npm run broker
//
// Serve solo a chi non ha Docker: il broker del corso è Mosquitto, in
// broker/compose.yaml. Questo ascolta sulla porta 1883 come Mosquitto, ma
// solo MQTT semplice (niente WebSocket), e scrive chi si collega e chi se ne
// va: utile per vedere il testamento in azione.
// ---------------------------------------------------------------------------

import net from 'node:net';
import { Aedes } from 'aedes';

const PORTA = Number(process.env.PORTA_BROKER ?? 1883);
const ora = () => new Date().toLocaleTimeString('it-IT');

const broker = await Aedes.createBroker();
const server = net.createServer(broker.handle);

broker.on('client', (client) => console.log(`${ora()}  collegato:   ${client.id}`));
broker.on('clientDisconnect', (client) => console.log(`${ora()}  scollegato:  ${client.id}`));
broker.on('subscribe', (iscrizioni, client) => {
  for (const { topic, qos } of iscrizioni) console.log(`${ora()}  iscrizione:  ${client.id} -> ${topic} (QoS ${qos})`);
});

server.on('error', (errore) => {
  if (errore.code === 'EADDRINUSE') {
    console.log(`La porta ${PORTA} è già occupata: c'è già un broker acceso (Mosquitto in Docker?).`);
    process.exit(1);
  }
  throw errore;
});

server.listen(PORTA, () => {
  console.log(`Broker di riserva (Aedes) in ascolto su mqtt://localhost:${PORTA}. Ctrl+C per spegnerlo.`);
});

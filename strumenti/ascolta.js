// ---------------------------------------------------------------------------
// Ascoltare il broker dal terminale, per chi non ha MQTT Explorer.
//
//     npm run ascolta                        (tutto: #)
//     npm run ascolta -- "flotta/+/telemetria"
//
// Per ogni messaggio scrive il topic, quanti byte occupa il pacchetto PUBLISH
// intero e il contenuto. Variabile d'ambiente BROKER per cambiare indirizzo.
// ---------------------------------------------------------------------------

import mqtt from 'mqtt';

const URL_BROKER = process.env.BROKER ?? 'mqtt://localhost:1883';
const filtro = process.argv[2] ?? '#';
const ora = () => new Date().toLocaleTimeString('it-IT');

const client = mqtt.connect(URL_BROKER, { clientId: `ascolta-${process.pid}` });

client.on('connect', async () => {
  await client.subscribeAsync(filtro, { qos: 1 });
  console.log(`In ascolto su ${URL_BROKER}, filtro "${filtro}". Ctrl+C per smettere.`);
});

client.on('message', (topic, payload, packet) => {
  // Il pacchetto intero: 1 byte di tipo, da 1 a 4 di lunghezza, poi il resto.
  const byte = 1 + (packet.length < 128 ? 1 : packet.length < 16384 ? 2 : 3) + packet.length;
  const retained = packet.retain ? '  (retained)' : '';
  console.log(`${ora()}  ${topic}  ${byte} byte${retained}\n          ${payload.toString()}`);
});

client.on('error', (errore) => {
  console.log(`!! ${errore.code ?? errore.message}${errore.code === 'ECONNREFUSED' ? ' (il broker è acceso?)' : ''}`);
});

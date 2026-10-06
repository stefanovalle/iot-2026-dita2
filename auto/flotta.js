// ---------------------------------------------------------------------------
// Tante auto in un solo programma.
//
//     npm run flotta            (10 auto)
//     npm run flotta -- 50      (50 auto)
//
// Serve a vedere cosa succede al servizio quando le auto non sono una ma
// tante: guardiamo il log del cloud, e il riepilogo ogni 30 secondi.
// Usa lo stesso trasporto di auto/index.js: quando cambia lì, cambia qui.
// ---------------------------------------------------------------------------

import { Auto } from './simulatore.js';
import { TrasportoHttp } from './trasporti/http.js';
import { TrasportoMqtt } from './trasporti/mqtt.js';

const QUANTE = Number(process.argv[2] ?? 10);
const URL_SERVIZIO = process.env.SERVIZIO ?? 'http://localhost:3000';
const URL_BROKER = process.env.BROKER ?? 'mqtt://localhost:1883';
const OGNI_QUANTI_MS = Number(process.env.OGNI_MS ?? 5000);

let inviate = 0;
let errori = 0;
let comandi = 0;
const giaSegnalati = new Set();

function segnala(errore) {
  errori += 1;
  const messaggio = errore.cause?.code ?? errore.message;
  if (giaSegnalati.has(messaggio)) return;
  giaSegnalati.add(messaggio);
  console.log(`!! ${messaggio}`);
}

for (let i = 1; i <= QUANTE; i++) {
  const targa = `FL${String(i).padStart(3, '0')}AA`;
  const auto = new Auto(targa);

  // ----- QUI SI CAMBIA (come in auto/index.js) -----
  const trasporto = new TrasportoMqtt(URL_BROKER, targa, URL_SERVIZIO);
  // -------------------------------------------------

  try {
    trasporto.ascoltaComandi((comando) => {
      if (auto.eseguiComando(comando)) comandi += 1;
    });
  } catch (errore) {
    segnala(errore);
  }

  // Ogni auto parte in un momento diverso, come nella realtà.
  setTimeout(() => {
    setInterval(async () => {
      try {
        await trasporto.inviaTelemetria(auto.passo());
        inviate += 1;
      } catch (errore) {
        segnala(errore);
      }
    }, OGNI_QUANTI_MS);
  }, Math.random() * OGNI_QUANTI_MS);
}

console.log(`Flotta di ${QUANTE} auto accesa. Servizio: ${URL_SERVIZIO}, broker: ${URL_BROKER}.`);

setInterval(() => {
  console.log(`[flotta] ultimi 10 s: ${inviate} misure inviate, ${comandi} comandi eseguiti, ${errori} errori`);
  inviate = 0;
  errori = 0;
  comandi = 0;
}, 10000);

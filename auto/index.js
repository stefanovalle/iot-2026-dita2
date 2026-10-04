// ---------------------------------------------------------------------------
// Il simulatore di UN'auto.
//
//     npm run auto                  (targa AA123BB)
//     npm run auto -- CC456DD       (targa scelta da noi)
//
// Ogni pochi secondi produce una telemetria e la manda al cloud; intanto
// ascolta i comandi e li esegue. Come li manda e come li ascolta non lo sa:
// se ne occupa il trasporto, scelto più sotto.
//
// Variabili d'ambiente, se servono:
//     SERVIZIO   indirizzo del cloud (predefinito http://localhost:3000)
//     OGNI_MS    millisecondi tra una misura e l'altra (predefinito 5000)
// ---------------------------------------------------------------------------

import { Auto } from './simulatore.js';
import { TrasportoHttp } from './trasporti/http.js';

const targa = (process.argv[2] ?? 'AA123BB').toUpperCase();
const URL_SERVIZIO = process.env.SERVIZIO ?? 'http://localhost:3000';
const OGNI_QUANTI_MS = Number(process.env.OGNI_MS ?? 5000);

const auto = new Auto(targa);

// ----- QUI SI CAMBIA -------------------------------------------------------
// È l'unica riga che sa quale protocollo usiamo. Alla giornata 3 diventerà
// "new TrasportoMqtt(...)", e il resto del file resterà identico.
const trasporto = new TrasportoHttp(URL_SERVIZIO, targa);
// ---------------------------------------------------------------------------

// Gli errori "TODO" li stampiamo una volta sola, per non riempire lo schermo.
const giaSegnalati = new Set();
function segnala(contesto, errore) {
  const messaggio = errore.cause?.code ?? errore.message;
  if (messaggio.startsWith('TODO')) {
    if (giaSegnalati.has(messaggio)) return;
    giaSegnalati.add(messaggio);
    console.log(`!! ${messaggio}`);
    return;
  }
  const suggerimento = messaggio === 'ECONNREFUSED' ? ' (il servizio è acceso?)' : '';
  console.log(`!! ${contesto}: ${messaggio}${suggerimento}`);
}

console.log(`Auto ${targa} accesa. Servizio: ${URL_SERVIZIO}. Una misura ogni ${OGNI_QUANTI_MS / 1000} s.`);

// 1. I comandi: il trasporto ci chiama ogni volta che ne arriva uno.
try {
  trasporto.ascoltaComandi(async (comando) => {
    const eseguito = auto.eseguiComando(comando);
    if (eseguito) {
      console.log(`<- comando "${comando.azione}" eseguito: ora l'auto è ${auto.stato}`);
    } else {
      console.log(`<- comando ${comando.id} già eseguito o sconosciuto: ignorato`);
    }
  });
} catch (errore) {
  segnala('ascolto dei comandi non avviato', errore);
}

// 2. La telemetria: una misura ogni OGNI_QUANTI_MS.
setInterval(async () => {
  const dato = auto.passo();
  try {
    await trasporto.inviaTelemetria(dato);
    console.log(`-> telemetria inviata: ${dato.stato}, batteria ${dato.batteria}%, (${dato.lat}, ${dato.lon})`);
  } catch (errore) {
    segnala('telemetria non inviata', errore);
  }
}, OGNI_QUANTI_MS);

// ---------------------------------------------------------------------------
// Il simulatore del cloud: il servizio della flotta.
//
//     npm run cloud            (si ferma con Ctrl+C)
//     npm run cloud:watch      (si riavvia da solo a ogni salvataggio)
//
// Riceve la telemetria delle auto, tiene l'ultimo stato di ognuna e permette
// di mandare comandi. Alla giornata 2 parla con le auto in HTTP. Dalla
// giornata 3 riceve la telemetria anche via MQTT, iscrivendosi al broker
// (cloud/mqtt.js); dalla giornata 4 anche i comandi partono dal broker. L'API
// HTTP resta comunque, per le persone: la dashboard, il back-office. Dalla
// giornata 6 pubblica anche gli eventi per gli uffici su RabbitMQ
// (cloud/amqp.js): MQTT verso le auto, AMQP dentro il cloud.
//
// Variabili d'ambiente, se servono:
//     PORTA      la porta HTTP (predefinita 3000)
//     BROKER     l'indirizzo del broker MQTT (predefinito mqtt://localhost:1883)
//     BROKER_WS  il broker visto dal browser (predefinito ws://<host>:9001)
//     PREFISSO   il primo livello dei topic (predefinito "flotta")
//     AMQP       l'indirizzo di RabbitMQ (predefinito amqp://flotta:flotta@localhost:5672)
//
// La dashboard è su http://localhost:3000 — apriamola nel browser.
// ---------------------------------------------------------------------------

import { readFile } from 'node:fs/promises';
import { creaApp } from './router.js';
import { registro } from './registro.js';
import { MemoriaFlotta } from './memoria.js';
import { AZIONI, creaComando, telemetriaValida } from '../comune/modelli.js';
import { PREFISSO } from '../comune/topic.js';
import { collegaBroker, pubblicaComando } from './mqtt.js';
import { collegaAmqp, pubblicaEvento } from './amqp.js';
import { URL_AMQP, creaEvento, tipoEvento } from '../comune/eventi.js';

const PORTA = Number(process.env.PORTA ?? 3000);
const URL_BROKER = process.env.BROKER ?? 'mqtt://localhost:1883';

const memoria = new MemoriaFlotta();
const app = creaApp();
app.use(registro());

// La dashboard non c'entra con il protocollo: è già pronta.
const dashboard = await readFile(new URL('./public/index.html', import.meta.url));
app.get('/', (req, res) => res.html(dashboard));

// 1. L'auto manda una misura in HTTP (giornata 2; via MQTT arriva in cloud/mqtt.js).
//    Rispondiamo 204: è andata bene e non c'è niente da restituire. Anche 201
//    sarebbe difendibile, ma solo se la misura diventasse una risorsa con un
//    suo indirizzo; 200 con un corpo vuoto è il meno preciso dei tre.
app.post('/auto/:targa/telemetria', (req, res) => {
  if (!telemetriaValida(req.body)) {
    return res.status(400).json({ errore: 'Telemetria incompleta: servono lat, lon, batteria e uno stato valido' });
  }
  memoria.salvaTelemetria({ ...req.body, targa: req.params.targa });
  res.status(204).end();
});

// 2. Lo stato più recente di un'auto.
app.get('/auto/:targa', (req, res) => {
  const stato = memoria.ultimo(req.params.targa);
  if (!stato) {
    return res.status(404).json({ errore: `L'auto ${req.params.targa} non si è mai fatta sentire` });
  }
  res.json(stato);
});

// 3. Tutte le auto conosciute. Con ?stato=libera filtra per stato.
app.get('/auto', (req, res) => {
  let elenco = memoria.tutte();
  if (req.query.stato) elenco = elenco.filter((auto) => auto.stato === req.query.stato);
  res.json(elenco);
});

// 4. L'endpoint che l'auto interroga in polling: consegna i comandi in
//    attesa e li toglie dalla coda. Quando non c'è niente rispondiamo una
//    lista vuota con 200 (anche 204 sarebbe corretto: l'importante è
//    sceglierne uno e sapere perché).
app.get('/auto/:targa/comandi', (req, res) => {
  res.json(memoria.prendiComandi(req.params.targa));
});

// 5. Un operatore (o la dashboard, o noi con curl) manda un comando.
app.post('/comandi', async (req, res) => {
  const { targa, azione } = req.body ?? {};
  if (typeof targa !== 'string' || !AZIONI.includes(azione)) {
    return res.status(400).json({ errore: `Servono "targa" e un'"azione" tra: ${AZIONI.join(', ')}` });
  }
  if (!memoria.ultimo(targa)) {
    return res.status(404).json({ errore: `L'auto ${targa} non si è mai fatta sentire` });
  }
  const comando = creaComando(targa, azione);
  // Giornata 4: il comando parte subito sul broker, verso l'auto. Lo teniamo
  // anche in coda per le eventuali auto rimaste in HTTP, che lo chiederanno
  // con il polling (endpoint 4): ogni auto usa un trasporto solo, e se mai
  // arrivasse due volte l'id lo smaschera.
  memoria.accodaComando(comando);
  try {
    await pubblicaComando(broker, comando);
  } catch (errore) {
    return res.status(503).json({ errore: `Comando non pubblicato sul broker: ${errore.message}` });
  }
  res.status(201).json(comando);
});

// 6. Il collegamento al broker MQTT (giornata 3): da lì arriva la telemetria
//    delle auto che usano TrasportoMqtt, e da lì partono i comandi (giornata 4).
const broker = collegaBroker(URL_BROKER, memoria);

// 7. La dashboard nel browser si collega da sola al broker, via WebSocket
//    (giornata 4): le servono la libreria MQTT.js e due informazioni.
const libreriaMqtt = await readFile(new URL('../node_modules/mqtt/dist/mqtt.esm.js', import.meta.url));
app.get('/mqtt.esm.js', (req, res) => {
  res.set('Content-Type', 'text/javascript; charset=utf-8');
  res.set('Content-Length', libreriaMqtt.length);
  res.end(libreriaMqtt);
});
app.get('/configurazione', (req, res) => {
  const host = (req.headers.host ?? 'localhost').split(':')[0];
  res.json({ brokerWebSocket: process.env.BROKER_WS ?? `ws://${host}:9001`, prefisso: PREFISSO });
});

// 8. Gli eventi per gli uffici (giornata 6). Quando un'auto cambia stato, la
//    memoria ce lo dice; se il cambio interessa a qualcuno (inizio o fine di
//    un noleggio, un guasto) lo pubblichiamo su RabbitMQ. A chi arriva lo
//    decidono i binding, non il servizio.
const rabbit = collegaAmqp(URL_AMQP);
const giaSegnalati = new Set();
memoria.on('cambioStato', async (prima, dopo, dato) => {
  const tipo = tipoEvento(prima, dopo);
  if (!tipo) return;
  try {
    await pubblicaEvento(rabbit, creaEvento(tipo, dato));
  } catch (errore) {
    // I TODO e i guasti che si ripetono li stampiamo una volta sola.
    if (giaSegnalati.has(errore.message)) return;
    giaSegnalati.add(errore.message);
    console.log(`!! evento ${tipo} di ${dato.targa} non pubblicato: ${errore.message}`);
  }
});

app.listen(PORTA, () => {
  console.log(`Servizio flotta in ascolto su http://localhost:${PORTA}  (lì c'è anche la dashboard)`);
});

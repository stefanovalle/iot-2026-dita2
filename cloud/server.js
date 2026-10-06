// ---------------------------------------------------------------------------
// Il simulatore del cloud: il servizio della flotta.
//
//     npm run cloud            (si ferma con Ctrl+C)
//     npm run cloud:watch      (si riavvia da solo a ogni salvataggio)
//
// Riceve la telemetria delle auto, tiene l'ultimo stato di ognuna e permette
// di mandare comandi. Alla giornata 2 parla con le auto in HTTP. Dalla
// giornata 3 riceve la telemetria anche via MQTT, iscrivendosi al broker
// (cloud/mqtt.js); i comandi restano in HTTP fino alla giornata 4. L'API HTTP
// resta comunque, per le persone: la dashboard, il back-office.
//
// Variabili d'ambiente, se servono:
//     PORTA      la porta HTTP (predefinita 3000)
//     BROKER     l'indirizzo del broker MQTT (predefinito mqtt://localhost:1883)
//     PREFISSO   il primo livello dei topic (predefinito "flotta")
//
// La dashboard è su http://localhost:3000 — apriamola nel browser.
// ---------------------------------------------------------------------------

import { readFile } from 'node:fs/promises';
import { creaApp } from './router.js';
import { registro } from './registro.js';
import { MemoriaFlotta } from './memoria.js';
import { AZIONI, creaComando, telemetriaValida } from '../comune/modelli.js';
import { collegaBroker } from './mqtt.js';

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
app.post('/comandi', (req, res) => {
  const { targa, azione } = req.body ?? {};
  if (typeof targa !== 'string' || !AZIONI.includes(azione)) {
    return res.status(400).json({ errore: `Servono "targa" e un'"azione" tra: ${AZIONI.join(', ')}` });
  }
  if (!memoria.ultimo(targa)) {
    return res.status(404).json({ errore: `L'auto ${targa} non si è mai fatta sentire` });
  }
  const comando = creaComando(targa, azione);
  memoria.accodaComando(comando);
  res.status(201).json(comando);
});

// 6. Il collegamento al broker MQTT (giornata 3): da lì arriva la telemetria
//    delle auto che usano TrasportoMqtt.
collegaBroker(URL_BROKER, memoria);

app.listen(PORTA, () => {
  console.log(`Servizio flotta in ascolto su http://localhost:${PORTA}  (lì c'è anche la dashboard)`);
});

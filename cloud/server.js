// ---------------------------------------------------------------------------
// Il simulatore del cloud: il servizio della flotta.
//
//     npm run cloud            (si ferma con Ctrl+C)
//     npm run cloud:watch      (si riavvia da solo a ogni salvataggio)
//
// Riceve la telemetria delle auto, tiene l'ultimo stato di ognuna e permette
// di mandare comandi. Alla giornata 2 parla con le auto in HTTP; da quella
// successiva resterà un'API HTTP per le persone (la dashboard, il
// back-office) ma con le auto parlerà in un altro modo.
//
// La dashboard è su http://localhost:3000 — apriamola nel browser.
// ---------------------------------------------------------------------------

import { readFile } from 'node:fs/promises';
import { creaApp } from './router.js';
import { registro } from './registro.js';
import { MemoriaFlotta } from './memoria.js';
import { AZIONI, STATI, creaComando } from '../comune/modelli.js';

const PORTA = Number(process.env.PORTA ?? 3000);

const memoria = new MemoriaFlotta();
const app = creaApp();
app.use(registro());

// La dashboard non c'entra con il protocollo: è già pronta.
const dashboard = await readFile(new URL('./public/index.html', import.meta.url));
app.get('/', (req, res) => res.html(dashboard));

// Un endpoint di esempio, già scritto, da cui copiare la forma:
//     curl http://localhost:3000/salute
app.get('/salute', (req, res) => {
  res.json({ servizio: 'flotta', ora: new Date().toISOString() });
});

// ---------------------------------------------------------------------------
// TODO giornata 2 — gli endpoint. Prima di scriverli decidiamo i nomi:
// l'indirizzo dice QUALE COSA, il verbo dice QUALE AZIONE.
//
// Cosa abbiamo a disposizione dentro un endpoint:
//     req.params.targa   il pezzo :targa dell'indirizzo
//     req.query.stato    il ?stato=... in fondo all'indirizzo
//     req.body           il corpo della richiesta, già trasformato da JSON in oggetto
//     res.status(201).json({ ... })   risponde con un codice e un oggetto JSON
//     res.status(204).end()           risponde con un codice e nessun corpo
//     memoria.salvaTelemetria(dato), memoria.ultimo(targa), memoria.tutte(),
//     memoria.accodaComando(comando), memoria.prendiComandi(targa)
//     creaComando(targa, azione), AZIONI, STATI   (da comune/modelli.js)
//
// Da scrivere, nell'ordine:
//
//  1. POST /auto/:targa/telemetria
//     L'auto manda una misura: salviamola in memoria (con la targa presa
//     dall'indirizzo). Cosa rispondiamo, 200, 201 o 204? È la domanda della
//     slide sugli status code, e qui una risposta è migliore delle altre.
//     Se nel corpo mancano dei campi: 400.
//
//  2. GET /auto/:targa
//     Lo stato più recente di un'auto. Se la targa non esiste: 404.
//
//  3. GET /auto
//     Tutte le auto conosciute: è quello che chiede la dashboard.
//     Se avanza tempo: con ?stato=libera restituiamo solo quelle libere.
//
//  4. GET /auto/:targa/comandi
//     È l'endpoint che l'auto interroga in polling: restituisce i comandi
//     ancora da consegnare e li toglie dalla coda (prendiComandi lo fa già).
//     Domanda: quando non c'è niente, rispondiamo una lista vuota con 200
//     oppure 204? Non c'è una sola risposta giusta: sceglierne una e saper
//     dire perché.
//
//  5. POST /comandi       corpo: { "targa": "AA123BB", "azione": "apri" }
//     Lo usano la dashboard e noi con curl, per mandare un comando a
//     un'auto. Creiamolo con creaComando e accodiamolo. Azione sconosciuta:
//     400. Auto mai vista: 404. Tutto bene: 201, con il comando nel corpo.
//
// Quando funziona: lasciamo girare un'auto con il polling ogni due secondi e
// guardiamo il registro riempirsi di righe tutte uguali. È il problema che ci
// porteremo alla giornata 3.
// ---------------------------------------------------------------------------

app.listen(PORTA, () => {
  console.log(`Servizio flotta in ascolto su http://localhost:${PORTA}  (lì c'è anche la dashboard)`);
});

// ---------------------------------------------------------------------------
// Il registro delle richieste.
//
// Scrive una riga per ogni richiesta che arriva, e ogni 30 secondi un
// riepilogo: quante richieste, quanti byte di HTTP, e quanti di quei byte
// erano davvero dati. È lo strumento con cui misuriamo il protocollo, e alla
// giornata 3 lo confronteremo con quello di MQTT.
//
// I byte sono una stima: contiamo prima riga, intestazioni e corpo, cioè
// tutto quello che è HTTP. Non contiamo TCP e TLS, che a lezione abbiamo
// visto pesare anche di più.
//
// Le richieste della dashboard non hanno una riga propria (sarebbero troppe):
// finiscono solo nel riepilogo.
// ---------------------------------------------------------------------------

const OGNI_MS = 30_000;

const ora = () => new Date().toLocaleTimeString('it-IT');

/** '/auto/AA123BB/comandi' diventa '/auto/:targa/comandi', per raggruppare. */
const generico = (percorso) => percorso.replace(/^\/auto\/[^/]+/, '/auto/:targa');

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

function nuovaFinestra() {
  return { richieste: 0, byte: 0, datoUtile: 0, pollingVuoti: 0, perTipo: new Map() };
}

export function registro() {
  let finestra = nuovaFinestra();

  setInterval(() => {
    if (finestra.richieste === 0) return;
    const kb = (byte) => (byte / 1024).toFixed(1);
    const tipi = [...finestra.perTipo.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([tipo, quante]) => `      ${String(quante).padStart(5)}  ${tipo}`)
      .join('\n');
    console.log(
      `\n---- ultimi ${OGNI_MS / 1000} secondi -------------------------------------\n` +
        `  ${finestra.richieste} richieste, ${kb(finestra.byte)} KB di HTTP, ` +
        `di cui ${kb(finestra.datoUtile)} KB di telemetria vera (${((100 * finestra.datoUtile) / finestra.byte).toFixed(0)}%)\n` +
        `  richieste di polling tornate senza comandi: ${finestra.pollingVuoti}\n${tipi}\n` +
        `-----------------------------------------------------------\n`,
    );
    finestra = nuovaFinestra();
  }, OGNI_MS).unref();

  return (req, res) => {
    const inizio = performance.now();
    const daDashboard = req.headers['x-dashboard'] === '1';

    res.on('finish', () => {
      const millisecondi = (performance.now() - inizio).toFixed(1);
      const tipo = `${req.method} ${generico(req.path)}${daDashboard ? '  (dashboard)' : ''}`;

      finestra.richieste += 1;
      finestra.byte += byteRichiesta(req) + byteRisposta(res);
      finestra.perTipo.set(tipo, (finestra.perTipo.get(tipo) ?? 0) + 1);
      if (req.method === 'POST' && req.path.endsWith('/telemetria')) {
        finestra.datoUtile += Number(req.headers['content-length'] ?? 0);
      }
      const vuoto = res.statusCode === 204 || Number(res.getHeader('content-length')) <= 2;
      if (req.method === 'GET' && req.path.endsWith('/comandi') && vuoto) finestra.pollingVuoti += 1;

      if (!daDashboard) {
        console.log(`${ora()}  ${req.method.padEnd(6)} ${req.path.padEnd(30)} ${res.statusCode}  ${millisecondi} ms`);
      }
    });
  };
}

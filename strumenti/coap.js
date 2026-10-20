// ---------------------------------------------------------------------------
// Parlare CoAP dal terminale: il "curl" di CoAP, per il laboratorio della
// giornata 5.
//
//     npm run coap -- get /test              una GET semplice
//     npm run coap -- scopri                 GET /.well-known/core: cosa c'è?
//     npm run coap -- osserva /obs           GET con Observe: gli aggiornamenti
//                                            arrivano da soli (Ctrl+C per smettere)
//     npm run coap -- get /test --non        stessa GET, ma non confermabile (NON)
//
// Di solito si parla con il sandbox pubblico di Eclipse Californium. Con la
// variabile d'ambiente COAP si cambia server, per esempio il sensore di prova
// che gira sul nostro computer (npm run sensore):
//
//     COAP=coap://localhost npm run coap -- scopri            (bash)
//     $env:COAP="coap://localhost"; npm run coap -- scopri    (PowerShell)
//
// Al posto del percorso si può scrivere un indirizzo completo, coap://...
// La barra iniziale si può omettere (get test): in Git Bash a volte serve.
// ---------------------------------------------------------------------------

import coap from 'coap';

const SERVER = process.env.COAP ?? 'coap://californium.eclipseprojects.io';
const ATTESA_MASSIMA = 10_000; // ms: oltre, quasi sempre la rete blocca UDP

const argomenti = process.argv.slice(2);
const nonConfermabile = argomenti.includes('--non');
const [comando = 'aiuto', percorso = '/'] = argomenti.filter((a) => a !== '--non');

// I codici CoAP si leggono come quelli HTTP: 2.05 è "205", 4.04 è "404".
const NOMI = {
  '2.01': 'Created', '2.02': 'Deleted', '2.03': 'Valid', '2.04': 'Changed', '2.05': 'Content',
  '4.00': 'Bad Request', '4.01': 'Unauthorized', '4.04': 'Not Found', '4.05': 'Method Not Allowed',
  '5.00': 'Internal Server Error', '5.03': 'Service Unavailable',
};

// Git Bash su Windows "aiuta" troppo: un argomento che comincia con la barra
// lo prende per un percorso di file e lo riscrive, così /test arriva qui come
// C:/Program Files/Git/test. Se riconosciamo il trucco togliamo la parte
// aggiunta; il percorso si può anche scrivere senza barra (get test).
function ripulisci(percorso) {
  if (!/^[A-Za-z]:[\\/]/.test(percorso)) return percorso;
  const normale = percorso.replaceAll('\\', '/');
  const radice = (process.env.EXEPATH ?? '').replaceAll('\\', '/').replace(/\/(usr\/)?bin\/?$/i, '').replace(/\/$/, '');
  if (radice && normale.toLowerCase().startsWith(radice.toLowerCase() + '/')) return normale.slice(radice.length);
  const git = normale.search(/\/Git\//i);
  if (git >= 0) return normale.slice(git + 4);
  console.log(`!! "${percorso}" sembra un percorso di Windows: in Git Bash scriviamo il percorso senza la barra iniziale (get test).`);
  process.exit(1);
}

function indirizzo(percorso) {
  percorso = ripulisci(percorso);
  if (!percorso.startsWith('/') && !percorso.startsWith('coap://')) percorso = '/' + percorso;
  const url = new URL(percorso.startsWith('coap://') ? percorso : SERVER + percorso);
  // "localhost" può diventare ::1 (IPv6) mentre il sensore ascolta su IPv4.
  if (url.hostname === 'localhost') url.hostname = '127.0.0.1';
  return url;
}

function richiesta(percorso, { osserva = false } = {}) {
  const url = indirizzo(percorso);
  const tipo = nonConfermabile ? 'NON' : 'CON';
  console.log(`→ GET ${url.href}  (${tipo}${osserva ? ', Observe' : ''})`);

  const req = coap.request({
    hostname: url.hostname,
    port: url.port || 5683,
    pathname: url.pathname,
    query: url.search.slice(1),
    method: 'GET',
    observe: osserva,
    confirmable: !nonConfermabile,
  });

  const timer = setTimeout(() => {
    console.log(`!! Nessuna risposta in ${ATTESA_MASSIMA / 1000} secondi.`);
    console.log('   La rete lascia passare UDP sulla porta 5683? In alternativa: npm run sensore');
    console.log('   in un altro terminale, e COAP=coap://localhost qui.');
    process.exit(1);
  }, ATTESA_MASSIMA);

  req.on('error', (errore) => {
    clearTimeout(timer);
    console.log(`!! ${errore.code ?? errore.message}`);
    process.exit(1);
  });
  req.on('response', (res) => clearTimeout(timer));
  req.end();
  return req;
}

function intestazione(res) {
  const formato = res.headers['Content-Format'] ?? 'nessun formato';
  return `← ${res.code} ${NOMI[res.code] ?? ''}  ·  ${formato}  ·  ${res.payload.length} byte di contenuto`;
}

const ora = () => new Date().toLocaleTimeString('it-IT');

switch (comando) {
  case 'get': {
    richiesta(percorso).on('response', (res) => {
      console.log(intestazione(res));
      console.log(res.payload.toString());
      process.exit(0);
    });
    break;
  }

  case 'scopri': {
    // La risposta è in "link format" (RFC 6690): una virgola tra una risorsa e
    // l'altra, e per ciascuna gli attributi dopo il punto e virgola.
    richiesta('/.well-known/core').on('response', (res) => {
      console.log(intestazione(res));
      for (const link of res.payload.toString().split(/,(?=<)/)) {
        const [risorsa, ...attributi] = link.split(';');
        console.log(`  ${risorsa.padEnd(28)} ${attributi.join('  ')}`);
      }
      process.exit(0);
    });
    break;
  }

  case 'osserva': {
    // La risposta non finisce: ogni notifica del server è un nuovo 'data'.
    richiesta(percorso, { osserva: true }).on('response', (res) => {
      console.log(intestazione(res));
      res.on('data', (contenuto) => console.log(`${ora()}  ${contenuto.toString().trim()}`));
      console.log('In ascolto. Ctrl+C per smettere.');
      process.on('SIGINT', () => {
        // Ce ne andiamo e basta: il server continua a mandare notifiche a
        // un indirizzo dove non c'è più nessuno. Anche questo è CoAP.
        process.exit(0);
      });
    });
    break;
  }

  default:
    console.log('Uso: npm run coap -- get <percorso> | scopri | osserva <percorso>   [--non]');
    console.log(`Server: ${SERVER}   (variabile COAP per cambiarlo)`);
}

// ---------------------------------------------------------------------------
// Un mini-Express, scritto per il corso.
//
// Node.js sa già parlare HTTP da solo (il modulo node:http), ma scrivere ogni
// endpoint a mano è scomodo. Questo file offre gli stessi comandi di Express,
// la libreria più usata al mondo per i server in Node:
//
//     app.get('/auto/:targa', (req, res) => { ... })
//     req.params.targa   req.query.stato   req.body
//     res.status(404).json({ errore: '...' })
//     res.status(204).end()
//
// Così impariamo la forma che troveremo dappertutto, senza installare niente.
// Il giorno in cui useremo Express vero, il codice dei nostri endpoint
// resterà quasi identico.
//
// Non serve leggerlo per fare il laboratorio: basta usarlo.
// ---------------------------------------------------------------------------

import http from 'node:http';

const LIMITE_CORPO = 1_000_000; // un megabyte basta e avanza

/** Trasforma '/auto/:targa/comandi' in un'espressione regolare con i nomi dei parametri. */
function compila(metodo, percorso, gestore) {
  const nomi = [];
  const modello = percorso
    .split('/')
    .map((pezzo) => {
      if (pezzo.startsWith(':')) {
        nomi.push(pezzo.slice(1));
        return '([^/]+)';
      }
      return pezzo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');
  return { metodo, percorso, regex: new RegExp(`^${modello}/?$`), nomi, gestore };
}

/** Aggiunge alla risposta di Node i comandi comodi di Express. */
function arricchisci(res) {
  res.status = (codice) => {
    res.statusCode = codice;
    return res;
  };
  res.set = (nome, valore) => {
    res.setHeader(nome, valore);
    return res;
  };
  res.location = (indirizzo) => res.set('Location', indirizzo);
  res.json = (oggetto) => {
    const testo = JSON.stringify(oggetto);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Length', Buffer.byteLength(testo));
    res.end(testo);
  };
  res.html = (contenuto) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Length', Buffer.byteLength(contenuto));
    res.end(contenuto);
  };
  return res;
}

/** Legge il corpo della richiesta e, se è JSON, lo trasforma in oggetto. */
function leggiCorpo(req) {
  return new Promise((risolvi, rifiuta) => {
    const pezzi = [];
    let lunghezza = 0;
    req.on('data', (pezzo) => {
      lunghezza += pezzo.length;
      if (lunghezza > LIMITE_CORPO) {
        rifiuta(Object.assign(new Error('Corpo troppo grande'), { codice: 413 }));
        req.destroy();
        return;
      }
      pezzi.push(pezzo);
    });
    req.on('end', () => {
      const testo = Buffer.concat(pezzi).toString('utf8');
      req.corpoGrezzo = testo;
      if (testo.length === 0) return risolvi(undefined);
      if (!(req.headers['content-type'] ?? '').includes('application/json')) return risolvi(testo);
      try {
        risolvi(JSON.parse(testo));
      } catch {
        rifiuta(Object.assign(new Error('Il corpo non è JSON valido'), { codice: 400 }));
      }
    });
    req.on('error', rifiuta);
  });
}

export function creaApp() {
  const rotte = [];
  const middleware = [];

  async function gestisci(req, resNode) {
    const res = arricchisci(resNode);
    const url = new URL(req.url, 'http://localhost');
    req.path = decodeURIComponent(url.pathname);
    req.query = Object.fromEntries(url.searchParams);
    req.params = {};

    for (const funzione of middleware) funzione(req, res);

    try {
      req.body = await leggiCorpo(req);
    } catch (errore) {
      return res.status(errore.codice ?? 400).json({ errore: errore.message });
    }

    const stessoPercorso = rotte.filter((rotta) => rotta.regex.test(req.path));
    const rotta = stessoPercorso.find((r) => r.metodo === req.method);

    if (!rotta) {
      if (stessoPercorso.length > 0) {
        // L'indirizzo esiste, ma non con questo verbo.
        res.set('Allow', stessoPercorso.map((r) => r.metodo).join(', '));
        return res.status(405).json({ errore: `${req.method} non è previsto su ${req.path}` });
      }
      return res.status(404).json({ errore: `Nessun endpoint per ${req.method} ${req.path}` });
    }

    const valori = rotta.regex.exec(req.path).slice(1);
    rotta.nomi.forEach((nome, i) => (req.params[nome] = valori[i]));

    try {
      await rotta.gestore(req, res);
    } catch (errore) {
      console.error(errore);
      if (!res.headersSent) res.status(500).json({ errore: 'Errore interno del servizio' });
    }
  }

  return {
    use: (funzione) => middleware.push(funzione),
    get: (percorso, gestore) => rotte.push(compila('GET', percorso, gestore)),
    post: (percorso, gestore) => rotte.push(compila('POST', percorso, gestore)),
    put: (percorso, gestore) => rotte.push(compila('PUT', percorso, gestore)),
    patch: (percorso, gestore) => rotte.push(compila('PATCH', percorso, gestore)),
    delete: (percorso, gestore) => rotte.push(compila('DELETE', percorso, gestore)),
    listen(porta, quandoPronto) {
      const server = http.createServer(gestisci);
      server.on('error', (errore) => {
        if (errore.code === 'EADDRINUSE') {
          console.error(`La porta ${porta} è già occupata: c'è già un servizio acceso? Chiudiamolo, o usiamo PORTA=3001.`);
          process.exit(1);
        }
        throw errore;
      });
      return server.listen(porta, quandoPronto);
    },
  };
}

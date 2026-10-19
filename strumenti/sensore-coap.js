// ---------------------------------------------------------------------------
// Un sensore di parcheggio finto che parla CoAP, sul nostro computer.
//
//     npm run sensore
//
// Serve se la rete della scuola blocca UDP verso l'esterno: con il sensore
// acceso, lo stesso laboratorio si rifà con COAP=coap://localhost.
// Le risorse:
//
//     /posto/12      "libero" o "occupato": cambia da sola, si può osservare
//     /batteria      la carica della pila, in percentuale
//     /test, /obs    le due risorse di prova del sandbox Californium, per
//                    usare gli stessi comandi delle slide
//     /.well-known/core   l'elenco di tutto questo
// ---------------------------------------------------------------------------

import coap from 'coap';

const PORTA = Number(process.env.PORTA_COAP ?? 5683);

const stato = { posto: 'libero', batteria: 87 };
const osservatori = new Set(); // le risposte ancora aperte su /posto/12

// Ogni tanto arriva o se ne va un'auto: lo diciamo a chi osserva.
function prossimoCambio() {
  setTimeout(() => {
    stato.posto = stato.posto === 'libero' ? 'occupato' : 'libero';
    console.log(`posto 12: ${stato.posto}`);
    for (const res of osservatori) res.write(stato.posto);
    prossimoCambio();
  }, 5_000 + Math.random() * 10_000);
}
prossimoCambio();

const RISORSE = {
  '/posto/12': {
    attributi: 'rt="parcheggio";obs;ct=0',
    leggi: () => stato.posto,
    osservatori,
  },
  '/batteria': {
    attributi: 'rt="batteria";ct=0',
    leggi: () => `${stato.batteria}%`,
  },
  '/test': {
    attributi: 'title="Risorsa di prova";ct=0',
    leggi: () => 'Ciao dal sensore del posto 12',
  },
  '/obs': {
    attributi: 'title="Cambia ogni 5 secondi";obs;ct=0',
    leggi: () => new Date().toLocaleTimeString('it-IT'),
    ogni: 5_000,
  },
};

const elenco = () =>
  Object.entries(RISORSE).map(([percorso, r]) => `<${percorso}>;${r.attributi}`).join(',');

const server = coap.createServer((req, res) => {
  const percorso = req.url.split('?')[0];
  console.log(`${req.method} ${percorso}${req.headers.Observe === 0 ? '  (Observe)' : ''}  da ${req.rsinfo.address}`);

  if (req.method !== 'GET') {
    res.code = '4.05';
    return res.end();
  }
  if (percorso === '/.well-known/core') {
    res.setOption('Content-Format', 'application/link-format');
    return res.end(elenco());
  }

  const risorsa = RISORSE[percorso];
  if (!risorsa) {
    res.code = '4.04';
    return res.end();
  }

  res.setOption('Content-Format', 'text/plain');
  if (req.headers.Observe !== 0 || !risorsa.attributi.includes('obs')) {
    return res.end(risorsa.leggi());
  }

  // Observe: la risposta resta aperta e ogni write() è una notifica.
  res.write(risorsa.leggi());
  if (risorsa.osservatori) {
    risorsa.osservatori.add(res);
    // Se chi osserva chiude la risposta, lo togliamo dalla lista. Chi sparisce
    // senza dirlo (Ctrl+C) resta in lista: il server non può saperlo.
    const via = () => risorsa.osservatori.delete(res);
    res.on('finish', via);
    res.on('close', via);
    res.on('error', via);
  } else {
    const timer = setInterval(() => res.write(risorsa.leggi()), risorsa.ogni);
    for (const evento of ['finish', 'close', 'error']) res.on(evento, () => clearInterval(timer));
  }
});

server.listen(PORTA, () => {
  console.log(`Sensore CoAP in ascolto su coap://localhost:${PORTA}. Ctrl+C per spegnerlo.`);
});

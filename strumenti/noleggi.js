// ---------------------------------------------------------------------------
// Fa partire e finire un po' di noleggi, per generare eventi (giornata 6).
//
//     npm run noleggi              (5 noleggi)
//     npm run noleggi -- 10        (10 noleggi)
//
// Usa l'API HTTP del servizio, come la dashboard: manda "apri" a un'auto
// libera, aspetta che la telemetria dica "in_uso", manda "chiudi" e aspetta
// "libera". Il servizio vede i due cambi di stato e pubblica noleggio.inizio
// e noleggio.fine su RabbitMQ. Più auto sono accese (npm run flotta), più va
// veloce: lavora su tutte insieme.
// ---------------------------------------------------------------------------

const QUANTI = Number(process.argv[2] ?? 5);
const SERVIZIO = process.env.SERVIZIO ?? 'http://localhost:3000';
const attendi = (ms) => new Promise((fatto) => setTimeout(fatto, ms));

async function chiedi(metodo, percorso, corpo) {
  const risposta = await fetch(SERVIZIO + percorso, {
    method: metodo,
    headers: corpo ? { 'Content-Type': 'application/json' } : {},
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  if (!risposta.ok) throw new Error(`${metodo} ${percorso}: ${risposta.status}`);
  return risposta.json();
}

async function aspettaStato(targa, stato) {
  for (let i = 0; i < 30; i++) {
    if ((await chiedi('GET', `/auto/${targa}`)).stato === stato) return;
    await attendi(1000);
  }
  throw new Error(`${targa} non è mai diventata ${stato}`);
}

let auto;
try {
  auto = (await chiedi('GET', '/auto')).filter((a) => a.stato === 'libera').map((a) => a.targa);
} catch (errore) {
  console.log(`!! servizio non raggiungibile su ${SERVIZIO}: ${errore.cause?.code ?? errore.message}`);
  process.exit(1);
}
if (auto.length === 0) {
  console.log('!! Nessuna auto libera: accendiamone qualcuna (npm run auto, oppure npm run flotta).');
  process.exit(1);
}

let fatti = 0;
let prossimo = 0;
async function lavora(targa) {
  while (prossimo < QUANTI) {
    const numero = ++prossimo;
    await chiedi('POST', '/comandi', { targa, azione: 'apri' });
    await aspettaStato(targa, 'in_uso');
    await chiedi('POST', '/comandi', { targa, azione: 'chiudi' });
    await aspettaStato(targa, 'libera');
    fatti += 1;
    console.log(`noleggio ${numero} su ${targa}: iniziato e finito`);
  }
}

console.log(`${QUANTI} noleggi su ${Math.min(auto.length, QUANTI)} auto libere...`);
const esiti = await Promise.allSettled(auto.slice(0, QUANTI).map(lavora));
for (const esito of esiti) if (esito.status === 'rejected') console.log(`!! ${esito.reason.message}`);
console.log(`Fatto: ${fatti} noleggi chiusi.`);

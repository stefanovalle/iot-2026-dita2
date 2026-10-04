# Flotta — il progetto del corso Protocolli IoT

Progetto che accompagna tutto il corso **Protocolli IoT** (ITS 2026-2027). Si lavora **a coppie**, e lo stesso progetto cresce a ogni giornata: non si ricomincia mai da capo, si sostituisce solo il pezzo che riguarda il protocollo appena studiato.

Tutto in **JavaScript**, con Node.js.

## Cosa costruiamo

Due programmi che parlano tra loro.

```
  auto/   ──────── telemetria ───────►   cloud/
  (simula un'auto)  ◄─────── comandi ────────  (riceve, conserva, comanda)
```

- **auto/** simula un'auto del car sharing: ogni pochi secondi produce posizione, batteria e stato, e li manda al cloud. Ogni tanto riceve un comando (`apri`, `chiudi`, `manutenzione`) e lo esegue.
- **cloud/** è il servizio della flotta: riceve la telemetria, tiene l'ultimo stato di ogni auto e permette di mandare comandi. Ha anche una piccola dashboard, da aprire nel browser.

## Come si parte

Serve **Node.js 20 o successivo** (controlliamo con `node -v`) e **git**.

```
git clone <indirizzo del repository>
cd protocolli-2026-dita2

npm run cloud             # primo terminale: il servizio, su http://localhost:3000
npm run auto              # secondo terminale: un'auto con targa AA123BB
npm run auto -- CC456DD   # un'altra auto, con la targa che vogliamo
npm run flotta -- 20      # venti auto in un colpo solo
```

Non serve `npm install`: per la parte HTTP non usiamo nessuna libreria esterna, Node.js sa già fare tutto da solo. Le librerie arriveranno con i protocolli successivi.

Apriamo **http://localhost:3000** nel browser: è la dashboard della flotta.

`npm run cloud:watch` fa ripartire il servizio da solo ogni volta che salviamo un file: comodo mentre scriviamo gli endpoint.

## I branch: un passo per ciascuno

Ogni branch è un passo del corso. Si parte da `main`.

| Branch | Cosa contiene |
|---|---|
| `main` | **Giornata 2, da completare.** Lo scheletro: tutto parte, ma i pezzi HTTP sono dei TODO da riempire. |
| `http-soluzione` | **Giornata 2, completata.** La versione HTTP che funziona: per confrontarla con la nostra, dopo. |

I passi successivi (MQTT, CoAP, AMQP, sicurezza) arriveranno come nuovi branch.

Prima di cominciare, creiamo un branch nostro, così il nostro lavoro resta separato da quello del corso:

```
git switch -c coppia-rossi-bianchi
```

Quando abbiamo finito, possiamo confrontarci con la soluzione:

```
git diff http-soluzione -- auto/trasporti/http.js cloud/server.js
```

## Com'è fatto

```
comune/
  modelli.js            i due messaggi che viaggiano: Telemetria e Comando
auto/
  index.js              un'auto: genera la telemetria e esegue i comandi
  flotta.js             tante auto in un solo programma
  simulatore.js         come si muove e consuma un'auto (non va toccato)
  trasporti/
    trasporto.js        il contratto di ogni trasporto: due metodi
    http.js             il trasporto HTTP            <-- TODO giornata 2
cloud/
  server.js             il servizio e i suoi endpoint <-- TODO giornata 2
  memoria.js            dove il servizio tiene i dati (in RAM)
  registro.js           scrive ogni richiesta e un riepilogo ogni 30 s
  router.js             un mini-Express scritto per il corso
  public/index.html     la dashboard
```

## La regola che rende il progetto interessante

Tutto quello che riguarda **il protocollo** sta dietro due metodi, definiti in `auto/trasporti/trasporto.js`:

```js
inviaTelemetria(dato)          // l'auto parla al cloud
ascoltaComandi(quandoArriva)   // il cloud parla all'auto
```

Oggi scriviamo `TrasportoHttp`. Alla giornata 3 scriveremo `TrasportoMqtt` con gli stessi due metodi, e in `auto/index.js` cambierà **una riga sola**, quella sotto `QUI SI CAMBIA`. Se abbiamo fatto le cose per bene, il resto del programma non se ne accorge: è esattamente il punto del corso.

## Giornata 2: i TODO

Nell'ordine:

1. **`cloud/server.js`** — l'endpoint `POST /auto/:targa/telemetria`. Quale codice di stato rispondiamo: 200, 201 o 204?
2. **`auto/trasporti/http.js`** — `inviaTelemetria`: la POST dall'auto. Quando funziona, la dashboard mostra l'auto.
3. **`cloud/server.js`** — `GET /auto/:targa` e `GET /auto`.
4. **`cloud/server.js`** — `GET /auto/:targa/comandi` e `POST /comandi`.
5. **`auto/trasporti/http.js`** — `ascoltaComandi`: il polling. L'intervallo lo scegliamo noi.

Alla fine lasciamo girare tutto e guardiamo il registro del servizio: righe identiche a ripetizione. Quante hanno prodotto un'informazione nuova? Il riepilogo ogni 30 secondi ce lo dice.

## Provare con curl

Su Windows, in PowerShell, scriviamo `curl.exe` e non `curl`: il secondo è un'altra cosa.

```
curl -i http://localhost:3000/auto
curl -i http://localhost:3000/auto/AA123BB
curl -i -X POST http://localhost:3000/comandi -H "Content-Type: application/json" -d "{\"targa\":\"AA123BB\",\"azione\":\"apri\"}"
```

## Problemi frequenti

- **`La porta 3000 è già occupata`**: c'è già un servizio acceso in un altro terminale. Chiudiamolo, oppure `PORTA=3001 npm run cloud` (su PowerShell: `$env:PORTA=3001; npm run cloud`).
- **`ECONNREFUSED`** nell'auto: il servizio è spento, o è su un'altra porta. Con `SERVIZIO=http://localhost:3001 npm run auto` l'auto lo cerca altrove.
- **`fetch is not defined`**: Node.js è troppo vecchio. Serve la versione 20 o successiva.
- **`Nessun endpoint per ...`**: l'endpoint non è ancora scritto, o l'indirizzo ha un errore di battitura.

## Regole di lavoro

- Si lavora **in due sullo stesso computer**, scambiandosi la tastiera a ogni TODO. Chi non digita legge ad alta voce cosa dovrebbe succedere: è il modo più veloce per accorgersi di un errore.
- Il codice della coppia resta lo stesso per tutte le giornate. Facciamo commit spesso, sul nostro branch.
- Non serve che sia bello. Serve che funzioni e che il pezzo del protocollo sia separato dal resto.

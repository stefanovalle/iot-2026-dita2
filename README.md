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
npm install               # dalla giornata 3: scarica la libreria MQTT

npm run cloud             # primo terminale: il servizio, su http://localhost:3000
npm run auto              # secondo terminale: un'auto con targa AA123BB
npm run auto -- CC456DD   # un'altra auto, con la targa che vogliamo
npm run flotta -- 20      # venti auto in un colpo solo
```

Per la parte HTTP non serve nessuna libreria esterna: Node.js sa già fare tutto da solo. Dalla giornata 3 usiamo **MQTT.js** (il client MQTT) e, per chi non ha Docker, **Aedes** (un broker di riserva): `npm install` li scarica una volta sola nella cartella `node_modules`, che non finisce nel repository.

Apriamo **http://localhost:3000** nel browser: è la dashboard della flotta.

`npm run cloud:watch` fa ripartire il servizio da solo ogni volta che salviamo un file: comodo mentre scriviamo gli endpoint.

## I branch: un passo per ciascuno

Ogni branch è un passo del corso. Si parte da `main`.

| Branch | Cosa contiene |
|---|---|
| `main` | **Giornata 2, da completare.** Lo scheletro: tutto parte, ma i pezzi HTTP sono dei TODO da riempire. |
| `http-soluzione` | **Giornata 2, completata.** La versione HTTP che funziona: per confrontarla con la nostra, dopo. |
| `mqtt` | **Giornata 3, da completare.** Parte da `http-soluzione`: c'è il broker, c'è il trasporto MQTT con i TODO, e il servizio che si iscrive al broker. |
| `mqtt-soluzione` | **Giornata 3, completata.** La telemetria viaggia su MQTT, con lo stato online/offline e il testamento. I comandi restano in HTTP fino alla giornata 4. |
| `mqtt-comandi` | **Giornata 4, da completare.** Parte da `mqtt-soluzione`: i comandi passano dal broker, il polling sparisce. TODO nell'auto, nel servizio e (se avanza tempo) nella dashboard. |
| `mqtt-comandi-soluzione` | **Giornata 4, completata.** Comandi su MQTT con QoS 1, sessione ricordata a richiesta, dashboard in diretta dal broker via WebSocket. |
| `coap` | **Giornata 5, niente da completare.** Parte da `mqtt-comandi-soluzione` e aggiunge due strumenti: un client CoAP da terminale e un sensore di parcheggio finto che parla CoAP. Il progetto della flotta non cambia. |

I passi successivi (AMQP, sicurezza) arriveranno come nuovi branch.

Prima di cominciare, creiamo un branch nostro, così il nostro lavoro resta separato da quello del corso:

```
git switch -c coppia-rossi-bianchi
```

Quando abbiamo finito, possiamo confrontarci con la soluzione:

```
git diff http-soluzione -- auto/trasporti/http.js cloud/server.js     # giornata 2
git diff mqtt-soluzione -- auto/trasporti/mqtt.js cloud/mqtt.js       # giornata 3
git diff mqtt-comandi-soluzione -- auto/trasporti/mqtt.js cloud/mqtt.js cloud/public/index.html   # giornata 4
```

Per la giornata 3 partiamo dal lavoro della giornata 2, portandoci dentro le novità del branch `mqtt`:

```
git switch coppia-rossi-bianchi
git merge mqtt
npm install
```

Se il merge segnala conflitti nei file della giornata 2, teniamo la nostra versione; se è troppo complicato, ripartiamo pulito con `git switch -c coppia-rossi-bianchi-g3 mqtt`.

## Com'è fatto

```
comune/
  modelli.js            i due messaggi che viaggiano: Telemetria e Comando
  topic.js              i nomi dei topic MQTT, uguali per auto e servizio
auto/
  index.js              un'auto: genera la telemetria e esegue i comandi
  flotta.js             tante auto in un solo programma
  simulatore.js         come si muove e consuma un'auto (non va toccato)
  trasporti/
    trasporto.js        il contratto di ogni trasporto: due metodi
    http.js             il trasporto HTTP            <-- TODO giornata 2
    mqtt.js             il trasporto MQTT            <-- TODO giornata 3
cloud/
  server.js             il servizio e i suoi endpoint <-- TODO giornata 2
  mqtt.js               il servizio iscritto al broker <-- TODO giornata 3
  memoria.js            dove il servizio tiene i dati (in RAM)
  registro.js           scrive ogni richiesta HTTP e ogni messaggio MQTT, e un riepilogo ogni 30 s
  router.js             un mini-Express scritto per il corso
  public/index.html     la dashboard
broker/
  compose.yaml          il broker dell'aula: Mosquitto in Docker
  mosquitto.conf        la sua configurazione (porte 1883 e 9001)
  aedes.js              un broker di riserva in JavaScript, per chi non ha Docker (porte 1883 e 9001)
strumenti/
  ascolta.js            stampa i messaggi che passano dal broker
  coap.js               un client CoAP da terminale: get, scopri, osserva   (giornata 5)
  sensore-coap.js       un sensore di parcheggio finto che parla CoAP       (giornata 5)
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

## Giornata 3: MQTT

Oggi la telemetria smette di viaggiare in HTTP e passa da un **broker**. I comandi restano in HTTP fino alla giornata 4: ci serve vedere un pezzo alla volta.

```
  auto/  ── PUBLISH flotta/AA123BB/telemetria ──►  broker  ──►  cloud/ (iscritto a flotta/+/telemetria)
  auto/  ── GET /auto/AA123BB/comandi (polling, ancora per oggi) ──────────────►  cloud/
```

**0. Il broker.** Uno dei due:

```
cd broker
docker compose up -d        # Mosquitto, il broker del corso (porte 1883 e 9001)
cd ..

npm run broker              # oppure, senza Docker: il broker di riserva in JavaScript
```

Colleghiamo **MQTT Explorer** a `localhost`, porta `1883`: da qui in poi vediamo tutto quello che passa. Chi non l'ha installato usa `npm run ascolta` in un terzo terminale.

Poi i TODO, nell'ordine:

1. **`auto/index.js`** — la riga sotto `QUI SI CAMBIA`: `new TrasportoMqtt(URL_BROKER, targa, URL_SERVIZIO)`. Nient'altro. L'auto parte e ci dice cosa manca.
2. **`auto/trasporti/mqtt.js`** — `inviaTelemetria`: un PUBLISH sul topic della telemetria. Quando funziona, i messaggi compaiono in MQTT Explorer anche se il servizio non sa ancora niente.
3. **`cloud/mqtt.js`** — l'iscrizione a `flotta/+/telemetria` e il salvataggio in memoria. Quando funziona, la dashboard torna a mostrare l'auto.
4. **Il confronto.** Lasciamo girare tutto un minuto e guardiamo il riepilogo del registro: la stessa telemetria, quanti byte con HTTP ieri e quanti con MQTT oggi? E il polling dei comandi, che è ancora lì?
5. **Se avanza tempo — lo stato online/offline.** In `auto/trasporti/mqtt.js`: il testamento nel CONNECT, "online" appena connessi, "offline" in `chiudi()`. Il servizio sa già ascoltarli: la dashboard mostra ● online accanto alla targa. Proviamo a chiudere l'auto con Ctrl+C (spegnimento educato) e poi chiudendo la finestra del terminale (sparizione: parte il testamento).

Anche `auto/flotta.js` ha la sua riga `QUI SI CAMBIA`: cambiamola per vedere venti auto su MQTT.

**Broker condiviso con altre coppie?** Ognuno usa una targa diversa (il clientId è `auto-` più la targa: due uguali si buttano fuori a vicenda) e conviene un prefisso proprio nei topic, uguale per auto e servizio:

```
PREFISSO=rossi-bianchi npm run cloud                          # bash
$env:PREFISSO="rossi-bianchi"; npm run cloud                  # PowerShell
BROKER=mqtt://192.168.1.10:1883 npm run auto                  # un broker su un'altra macchina
```

## Giornata 4: i comandi su MQTT

Ieri la telemetria è passata al broker, ma i comandi arrivavano ancora con il polling HTTP. Oggi anche loro passano dal broker: l'auto si iscrive al proprio topic dei comandi e il servizio ci pubblica. Il polling sparisce.

```
  cloud/  ── PUBLISH flotta/AA123BB/comandi (QoS 1) ──►  broker  ──►  auto/ (iscritta a flotta/AA123BB/comandi)
```

Si parte come ieri: `git merge mqtt-comandi` nel nostro branch (oppure `git switch -c coppia-rossi-bianchi-g4 mqtt-comandi`), `npm install`, broker acceso. Poi i TODO:

1. **`auto/trasporti/mqtt.js`** — `iscriviAiComandi`: il SUBSCRIBE a `flotta/AA123BB/comandi`. Con quale QoS?
2. **`auto/trasporti/mqtt.js`** — il gestore `'message'`: dal messaggio al comando, e il comando a `quandoArriva`. Da MQTT Explorer pubblichiamo a mano un comando sul topic giusto e guardiamo l'auto reagire.
3. **`cloud/mqtt.js`** — `pubblicaComando`: il servizio pubblica. Proviamo i bottoni della dashboard: quanto ci mette il comando ad arrivare, rispetto al polling di ieri?
4. **Se avanza tempo — la dashboard in diretta.** In `cloud/public/index.html` la pagina si collega già al broker via WebSocket (porta 9001, slide «MQTT nel browser»): mancano le iscrizioni. Quando ci sono, in alto compare «in diretta dal broker» e la dashboard smette di chiedere `GET /auto`.

Il registro del servizio è la verifica: le righe `GET /auto/.../comandi` non ci sono più.

**Il laboratorio delle sessioni.** Con `SESSIONE=ricordata` l'auto si collega con la sessione ricordata (`clean: false`): spegniamola, mandiamo un comando dalla dashboard, riaccendiamola. Con la sessione pulita il comando è perso; con quella ricordata il broker lo ha tenuto da parte e arriva appena l'auto torna.

```
SESSIONE=ricordata npm run auto                       # bash
$env:SESSIONE="ricordata"; npm run auto               # PowerShell
```

## Giornata 5: CoAP dal terminale

Oggi il progetto resta fermo: parliamo con un server CoAP che esiste già, dal terminale. Ci portiamo dentro il branch `coap` e installiamo la libreria [`coap`](https://www.npmjs.com/package/coap):

```
git merge coap
npm install
```

Poi i passi del laboratorio, contro il sandbox pubblico di Eclipse Californium:

```
npm run coap -- get /test              # 1. una GET semplice: guardiamo il codice 2.05
npm run coap -- scopri                 # 2. GET /.well-known/core: cosa c'è su questo server?
npm run coap -- osserva /obs           # 3. gli aggiornamenti arrivano da soli (Ctrl+C per smettere)
npm run coap -- get /test --non        #    la stessa GET non confermabile, da guardare in Wireshark
```

Per il passo 4 apriamo Wireshark con il filtro `coap` e rifacciamo la GET: contiamo i byte e confrontiamoli con i circa 700 di una GET HTTP.

**Se la rete blocca UDP verso l'esterno** (la richiesta resta senza risposta), accendiamo il sensore finto in un altro terminale e rifacciamo gli stessi comandi verso il nostro computer:

```
npm run sensore
COAP=coap://localhost npm run coap -- scopri                 # bash
$env:COAP="coap://localhost"; npm run coap -- scopri         # PowerShell
```

Il sensore espone anche `/posto/12`, che passa da libero a occupato da solo: è la risorsa da osservare.

`strumenti/coap.js` è una pagina di codice: vale la pena aprirlo. La libreria somiglia a `node:http` (`coap.request`, `coap.createServer`), e la differenza con HTTP sta tutta in due opzioni: `observe` e `confirmable`.

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
- **`Cannot find package 'mqtt'`** (o `'coap'`): manca `npm install` (dalla giornata 3).
- **`ENOTFOUND` da `npm run coap`, con un indirizzo come `californium.eclipseprojects.ioC/Program Files/Git/test`**: è Git Bash, che riscrive gli argomenti che cominciano con la barra come se fossero file. Il client lo riconosce e lo corregge da solo; se non ci riesce, scriviamo il percorso senza barra: `npm run coap -- get test`.
- **`Nessuna risposta in 10 secondi`** da `npm run coap`: la rete blocca UDP sulla porta 5683. Usiamo il sensore finto (`npm run sensore`) con `COAP=coap://localhost`.
- **`EADDRINUSE`** da `npm run sensore`: c'è già un sensore acceso, oppure un altro programma usa la porta 5683. `PORTA_COAP=5684 npm run sensore` e `COAP=coap://localhost:5684`.
- **`broker non raggiungibile: ECONNREFUSED`**: il broker è spento. `docker compose up -d` nella cartella `broker/`, oppure `npm run broker`.
- **I messaggi partono ma il servizio non li vede**: il topic di chi pubblica e il filtro di chi si iscrive non coincidono. Maiuscole, barre in più, prefissi diversi: guardiamo i topic veri in MQTT Explorer.
- **L'auto si scollega e ricollega di continuo**: c'è un'altra auto con la stessa targa sullo stesso broker, cioè lo stesso clientId.

## Regole di lavoro

- Si lavora **in due sullo stesso computer**, scambiandosi la tastiera a ogni TODO. Chi non digita legge ad alta voce cosa dovrebbe succedere: è il modo più veloce per accorgersi di un errore.
- Il codice della coppia resta lo stesso per tutte le giornate. Facciamo commit spesso, sul nostro branch.
- Non serve che sia bello. Serve che funzioni e che il pezzo del protocollo sia separato dal resto.

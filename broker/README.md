# Il broker MQTT in locale

Il broker del corso è **Mosquitto**, in un container Docker. Questa cartella contiene tutto quello che serve per accenderlo sul nostro computer.

| File | A cosa serve |
|---|---|
| `compose.yaml` | dice a Docker quale immagine usare (`eclipse-mosquitto:2`), quali porte aprire e dove trovare la configurazione |
| `mosquitto.conf` | la configurazione del broker: porta 1883 per MQTT, porta 9001 per MQTT nei WebSocket, accesso senza autenticazione |
| `aedes.js` | un broker di riserva scritto in JavaScript, per chi non ha Docker (`npm run broker` dalla cartella principale) |

## Accenderlo

Serve **Docker Desktop** acceso (su Windows e Mac) oppure Docker installato (su Linux). Dalla cartella `broker/`:

```
docker compose up -d          # scarica l'immagine la prima volta e accende il broker
docker compose ps             # deve dire "running", con le porte 1883 e 9001
docker compose logs broker    # chi si collega e chi se ne va (con -f per seguirlo dal vivo)
docker compose down           # lo spegne
```

`-d` vuol dire «in sottofondo»: il terminale torna libero e il broker resta acceso finché non lo spegniamo (o si riaccende da solo al riavvio di Docker, grazie a `restart: unless-stopped`).

## Controllare che risponda

- Con **MQTT Explorer** (o MQTTX): host `localhost`, porta `1883`, nessun utente. Iscriviamoci a `#`.
- Oppure dal terminale, dalla cartella principale del progetto: `npm run ascolta`.

Per una prova senza programmi in più, dentro il container ci sono anche i client di Mosquitto:

```
docker compose exec broker mosquitto_sub -t "flotta/#" -v                 # un terminale ascolta
docker compose exec broker mosquitto_pub -t "flotta/prova" -m "ciao"      # un altro pubblica
```

## Senza Docker

- **Mosquitto installato da pacchetto** (https://mosquitto.org/download/): la configurazione è la stessa. Dalla cartella `broker/`: `mosquitto -c mosquitto.conf -v`.
- **Il broker di riserva in JavaScript**: `npm install` e poi `npm run broker` dalla cartella principale. Solo porta 1883, niente WebSocket, ma per il laboratorio basta.
- **Il broker pubblico** `test.mosquitto.org`: funziona senza installare niente, ma tutto quello che pubblichiamo lo vede chiunque. Usiamolo con un prefisso nostro nei topic (`PREFISSO=rossi-bianchi`) e con `BROKER=mqtt://test.mosquitto.org:1883`.

## Problemi frequenti

- **`port is already allocated`** o **`address already in use`**: sulla porta 1883 c'è già un broker (un altro container, Mosquitto installato come servizio, oppure `npm run broker` acceso). Spegniamo l'altro.
- **`Cannot connect to the Docker daemon`** / **`error during connect`**: Docker Desktop non è acceso.
- **I client si collegano ma vengono buttati fuori**: due client con lo stesso clientId. Nel progetto il clientId è `auto-` più la targa: su un broker condiviso ognuno usa una targa diversa.
- **Il broker non accetta connessioni da altri computer dell'aula**: il firewall di Windows blocca la porta 1883. Per il laboratorio basta il broker di ognuno su `localhost`.

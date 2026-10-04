// ---------------------------------------------------------------------------
// GIORNATA 2 — il trasporto HTTP.
//
// Due metodi, due direzioni:
//   - inviaTelemetria: l'auto parla al cloud. Con HTTP è facile: una POST.
//   - ascoltaComandi: il cloud dovrebbe parlare all'auto. Con HTTP non può,
//     perché l'auto sta dietro la rete dell'operatore e nessuno può bussare
//     alla sua porta. Allora è l'auto a chiedere ogni tanto: il polling.
//
// fetch() è già dentro Node.js (dalla versione 18): niente da installare.
// ---------------------------------------------------------------------------

import { Trasporto } from './trasporto.js';

// Ogni quanto l'auto chiede "ci sono comandi per me?".
// Proviamo 2 secondi e poi 60, guardando il log del servizio: non esiste il
// valore giusto, ed è esattamente il problema.
const INTERVALLO_POLLING_MS = 2000;

/** Una descrizione breve di un errore di rete (per esempio ECONNREFUSED). */
const descrivi = (errore) => errore.cause?.code ?? errore.message;

export class TrasportoHttp extends Trasporto {
  /**
   * @param {string} urlServizio  per esempio "http://localhost:3000"
   * @param {string} targa        la targa di questa auto
   * @param {number} intervalloPollingMs
   */
  constructor(urlServizio, targa, intervalloPollingMs = INTERVALLO_POLLING_MS) {
    super();
    this.urlServizio = urlServizio;
    this.targa = targa;
    this.intervalloPollingMs = intervalloPollingMs;
    this.attivo = false;
    this.timer = null;
  }

  async inviaTelemetria(dato) {
    // TODO giornata 2 — mandare una misura al servizio.
    //
    //  1. L'indirizzo: POST {this.urlServizio}/auto/{this.targa}/telemetria
    //  2. Il corpo: il dato trasformato in testo con JSON.stringify(dato), più
    //     un'intestazione Content-Type che dica al servizio che è JSON.
    //  3. fetch(indirizzo, { method, headers, body }) restituisce una Promise:
    //     aspettiamola con await.
    //  4. Controlliamo la risposta: risposta.ok vale true per tutti i 2xx. Se non
    //     lo è, lanciamo un errore con il codice (risposta.status): chi ci ha
    //     chiamato lo stamperà.
    //
    //  Domanda da farsi mentre lo scriviamo: se il servizio risponde 400, ha
    //  senso riprovare? E se risponde 503?
    throw new Error('TODO giornata 2: inviaTelemetria in auto/trasporti/http.js');
  }

  ascoltaComandi(quandoArriva) {
    // TODO giornata 2 — il polling: chiedere ogni tanto se ci sono comandi.
    //
    //  1. GET {this.urlServizio}/auto/{this.targa}/comandi
    //  2. Se la risposta contiene comandi (un array JSON: risposta.json()),
    //     per ognuno chiamiamo quandoArriva(comando).
    //  3. Poi aspettiamo this.intervalloPollingMs e ricominciamo. Lo strumento
    //     giusto è setTimeout: con setInterval, se il servizio è lento, due
    //     richieste rischiano di sovrapporsi.
    //  4. Se il servizio non risponde, fetch lancia un errore: non fermiamoci,
    //     scriviamo un avviso e riproviamo al giro dopo (try/catch).
    //  5. Ricordiamoci di this.attivo: chiudi() lo mette a false, e a quel
    //     punto il polling deve smettere.
    //
    //  L'intervallo è in cima al file: 2 secondi? 60? Proviamoli entrambi e
    //  guardiamo il registro del servizio.
    throw new Error('TODO giornata 2: ascoltaComandi in auto/trasporti/http.js');
  }

  async chiudi() {
    this.attivo = false;
    clearTimeout(this.timer);
  }
}

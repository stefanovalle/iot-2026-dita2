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
    const indirizzo = `${this.urlServizio}/auto/${encodeURIComponent(this.targa)}/telemetria`;

    const risposta = await fetch(indirizzo, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dato),
    });

    if (!risposta.ok) {
      // 4xx: abbiamo sbagliato noi, e riprovare la stessa richiesta non serve.
      // 5xx: il servizio è in difficoltà; qui non riproviamo, perché tra
      // pochi secondi parte comunque la misura successiva.
      throw new Error(`il servizio ha risposto ${risposta.status} ${risposta.statusText}`);
    }
  }

  ascoltaComandi(quandoArriva) {
    const indirizzo = `${this.urlServizio}/auto/${encodeURIComponent(this.targa)}/comandi`;
    this.attivo = true;

    const chiedi = async () => {
      try {
        const risposta = await fetch(indirizzo);

        if (risposta.status === 200) {
          const comandi = await risposta.json();
          for (const comando of comandi) {
            await quandoArriva(comando);
          }
        } else if (risposta.status !== 204) {
          console.warn(`[polling] risposta inattesa dal servizio: ${risposta.status}`);
        }
      } catch (errore) {
        // Il servizio è spento o irraggiungibile: non ci fermiamo, riproviamo al giro dopo.
        console.warn(`[polling] servizio non raggiungibile (${descrivi(errore)}), riprovo`);
      }

      // setTimeout e non setInterval: la prossima richiesta parte solo quando
      // questa è finita, così due richieste lente non si sovrappongono mai.
      if (this.attivo) this.timer = setTimeout(chiedi, this.intervalloPollingMs);
    };

    chiedi();
  }

  async chiudi() {
    this.attivo = false;
    clearTimeout(this.timer);
  }
}

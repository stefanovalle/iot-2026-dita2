// ---------------------------------------------------------------------------
// Il contratto di ogni trasporto.
//
// Tutto quello che riguarda il protocollo sta dietro questi due metodi, e il
// resto del programma non sa (e non deve sapere) quale protocollo c'è sotto.
//
// Alla giornata 2 scriviamo TrasportoHttp. Alla giornata 3 scriveremo
// TrasportoMqtt con gli stessi due metodi, e in auto/index.js cambierà una
// riga sola. Se lo abbiamo fatto bene, l'auto non se ne accorgerà nemmeno:
// è il punto di tutto il corso.
//
// JavaScript non ha le interfacce di altri linguaggi: questa classe ne fa le
// veci. Ogni trasporto la estende e riscrive i suoi metodi.
// ---------------------------------------------------------------------------

export class Trasporto {
  /**
   * Manda una misura al cloud.
   * Se qualcosa va storto, lancia un errore: chi chiama decide cosa farne.
   * @param {import('../../comune/modelli.js').Telemetria} dato
   */
  async inviaTelemetria(dato) {
    throw new Error(`${this.constructor.name}: inviaTelemetria non è stato scritto`);
  }

  /**
   * Comincia ad ascoltare i comandi destinati a questa auto. Ogni volta che
   * ne arriva uno, chiama quandoArriva(comando). Non restituisce niente:
   * continua a lavorare per conto suo finché non si chiama chiudi().
   * @param {(comando: import('../../comune/modelli.js').Comando) => Promise<void> | void} quandoArriva
   */
  ascoltaComandi(quandoArriva) {
    throw new Error(`${this.constructor.name}: ascoltaComandi non è stato scritto`);
  }

  /** Smette di ascoltare e chiude quello che c'è da chiudere. */
  async chiudi() {}
}

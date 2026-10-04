// ---------------------------------------------------------------------------
// L'auto simulata.
//
// Non c'entra niente con i protocolli: si muove, consuma batteria, cambia
// stato quando riceve un comando. È uguale in tutte le giornate del corso,
// e non va toccata.
// ---------------------------------------------------------------------------

import { creaTelemetria } from '../comune/modelli.js';

// Si parte intorno a piazza del Duomo, a Milano.
const CENTRO = { lat: 45.4642, lon: 9.19 };

const arrotonda = (numero, cifre) => Number(numero.toFixed(cifre));

export class Auto {
  constructor(targa) {
    this.targa = targa;
    this.lat = CENTRO.lat + (Math.random() - 0.5) * 0.04;
    this.lon = CENTRO.lon + (Math.random() - 0.5) * 0.06;
    this.batteria = Math.round(60 + Math.random() * 40);
    this.stato = 'libera';
    this.direzione = Math.random() * 2 * Math.PI;

    // Gli id dei comandi già eseguiti: è la nostra difesa contro i doppioni.
    this.comandiEseguiti = new Set();
  }

  /**
   * Fa passare un po' di tempo e restituisce la telemetria del momento.
   * In uso l'auto si muove e consuma; libera sta ferma e ogni tanto si ricarica.
   */
  passo() {
    if (this.stato === 'in_uso') {
      this.direzione += (Math.random() - 0.5) * 0.6;
      this.lat += Math.cos(this.direzione) * 0.0004;
      this.lon += Math.sin(this.direzione) * 0.0006;
      if (Math.random() < 0.5) this.batteria = Math.max(0, this.batteria - 1);
    } else if (this.stato === 'libera' && this.batteria < 100 && Math.random() < 0.2) {
      this.batteria += 1;
    }
    return creaTelemetria(this.targa, arrotonda(this.lat, 5), arrotonda(this.lon, 5), this.batteria, this.stato);
  }

  /**
   * Esegue un comando. Restituisce false se l'aveva già eseguito (stesso id)
   * o se l'azione non esiste: in quel caso non cambia niente.
   */
  eseguiComando(comando) {
    if (this.comandiEseguiti.has(comando.id)) return false;
    this.comandiEseguiti.add(comando.id);

    switch (comando.azione) {
      case 'apri':
        this.stato = 'in_uso';
        return true;
      case 'chiudi':
        this.stato = 'libera';
        return true;
      case 'manutenzione':
        this.stato = 'in_manutenzione';
        return true;
      default:
        return false;
    }
  }
}

// ---------------------------------------------------------------------------
// I messaggi che viaggiano nel progetto.
//
// Sono due, e vanno in due direzioni opposte:
//   - la TELEMETRIA va dall'auto al cloud: "ecco dove sono e come sto";
//   - il COMANDO va dal cloud all'auto: "apriti", "chiuditi", "fermati".
//
// La seconda direzione è quella difficile, e sarà il filo di tutto il corso.
// ---------------------------------------------------------------------------

import { randomUUID } from 'node:crypto';

/** Le azioni che il cloud può chiedere a un'auto. */
export const AZIONI = ['apri', 'chiudi', 'manutenzione'];

/** Gli stati in cui può trovarsi un'auto. */
export const STATI = ['libera', 'in_uso', 'in_manutenzione'];

/**
 * @typedef {object} Telemetria
 * @property {string} targa     per esempio "AA123BB"
 * @property {number} lat       latitudine
 * @property {number} lon       longitudine
 * @property {number} batteria  percentuale, da 0 a 100
 * @property {string} stato     uno di STATI
 * @property {string} istante   quando è stata misurata, in formato ISO e in UTC
 */

/**
 * @typedef {object} Comando
 * @property {string} id       identificativo unico: serve a riconoscere un doppione
 * @property {string} targa    a quale auto è destinato
 * @property {string} azione   una di AZIONI
 * @property {string} istante  quando è stato emesso
 */

/**
 * Crea una telemetria. Teniamola piccola: ogni campo viaggia 43 milioni di
 * volte al giorno, e a lezione conteremo quanto pesa.
 * @returns {Telemetria}
 */
export function creaTelemetria(targa, lat, lon, batteria, stato) {
  return { targa, lat, lon, batteria, stato, istante: new Date().toISOString() };
}

/**
 * Crea un comando. L'id conta più di quanto sembri: se lo stesso comando
 * arriva due volte (succede, e alla giornata 3 vedremo perché), l'auto deve
 * poterlo riconoscere ed eseguirlo una volta sola.
 * @returns {Comando}
 */
export function creaComando(targa, azione) {
  return { id: randomUUID(), targa, azione, istante: new Date().toISOString() };
}

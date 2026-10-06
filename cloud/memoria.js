// ---------------------------------------------------------------------------
// La memoria del servizio.
//
// Tiene l'ultimo stato di ogni auto e i comandi che aspettano di essere
// consegnati. Sta tutta in RAM: se spegniamo il servizio si dimentica tutto,
// e per il corso va benissimo così (i database sono materia del corso di
// architetture cloud).
// ---------------------------------------------------------------------------

export class MemoriaFlotta {
  constructor() {
    this.ultimoStato = new Map(); // targa -> ultima telemetria ricevuta
    this.comandiInAttesa = new Map(); // targa -> elenco di comandi da consegnare
    this.connessione = new Map(); // targa -> "online" | "offline" (giornata 3, MQTT)
  }

  /** Salva l'ultima telemetria di un'auto, al posto della precedente. */
  salvaTelemetria(dato) {
    this.ultimoStato.set(dato.targa, dato);
  }

  /** Ricorda se un'auto è collegata al broker ("online") oppure no ("offline"). */
  salvaConnessione(targa, stato) {
    this.connessione.set(targa, stato);
  }

  /** L'ultimo stato noto di un'auto, oppure undefined se non si è mai fatta sentire. */
  ultimo(targa) {
    const dato = this.ultimoStato.get(targa);
    if (!dato) return undefined;
    const connessione = this.connessione.get(targa);
    return connessione ? { ...dato, connessione } : dato;
  }

  /** Tutte le auto conosciute, in ordine di targa. */
  tutte() {
    return [...this.ultimoStato.keys()].sort().map((targa) => this.ultimo(targa));
  }

  /** Mette in coda un comando per l'auto a cui è destinato. */
  accodaComando(comando) {
    const coda = this.comandiInAttesa.get(comando.targa) ?? [];
    coda.push(comando);
    this.comandiInAttesa.set(comando.targa, coda);
  }

  /** Consegna i comandi in attesa per un'auto e li toglie dalla coda. */
  prendiComandi(targa) {
    const coda = this.comandiInAttesa.get(targa) ?? [];
    this.comandiInAttesa.delete(targa);
    return coda;
  }
}

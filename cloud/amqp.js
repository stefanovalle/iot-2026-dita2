// ---------------------------------------------------------------------------
// GIORNATA 6 — il servizio pubblica gli eventi su RabbitMQ.
//
// MQTT resta dov'è, tra le auto e il servizio. AMQP si aggiunge dentro il
// cloud: quando un'auto cambia stato, il servizio pubblica un evento
// sull'exchange flotta.eventi e ha finito. A chi arriva lo decidono i
// binding delle code degli uffici, non questo file.
//
// Usiamo un canale "con conferme" (confirm channel): RabbitMQ ci risponde
// quando ha preso il messaggio. E pubblichiamo con mandatory: se nessuna coda
// corrisponde alla chiave, il messaggio ci torna indietro invece di sparire
// in silenzio (slide «E chi pubblica, come fa a saperlo?»).
// ---------------------------------------------------------------------------

import amqp from 'amqplib';
import { EXCHANGE_EVENTI, chiaveEvento, dichiara, senzaPassword } from '../comune/eventi.js';

/**
 * Si collega a RabbitMQ e dichiara l'exchange degli eventi. Se il broker non
 * c'è o cade, riprova ogni 5 secondi: amqplib non lo fa da solo.
 * @param {string} url  per esempio "amqp://flotta:flotta@localhost:5672"
 * @returns {{ canale: import('amqplib').ConfirmChannel | null }}
 */
export function collegaAmqp(url) {
  const rabbit = { canale: null };
  let avvisato = false;

  async function collega() {
    try {
      const connessione = await amqp.connect(url);
      connessione.on('error', () => {}); // segue sempre un 'close', gestito qui sotto
      connessione.on('close', () => {
        rabbit.canale = null;
        console.log('!! RabbitMQ: connessione chiusa, riprovo tra 5 secondi');
        setTimeout(collega, 5000);
      });

      // L'exchange è durevole e di tipo topic. Dichiararlo è idempotente:
      // se c'è già uguale non succede niente.
      await dichiara(connessione, `L'exchange ${EXCHANGE_EVENTI}`, (c) =>
        c.assertExchange(EXCHANGE_EVENTI, 'topic', { durable: true }),
      );

      const canale = await connessione.createConfirmChannel();
      canale.on('return', (messaggio) => {
        console.log(`!! RabbitMQ: nessuna coda per la chiave "${messaggio.fields.routingKey}": l'evento non è arrivato a nessuno`);
      });
      rabbit.canale = canale;
      avvisato = false;
      console.log(`Servizio collegato a RabbitMQ ${senzaPassword(url)}, exchange ${EXCHANGE_EVENTI}`);
    } catch (errore) {
      if (!avvisato) {
        avvisato = true;
        const suggerimento = errore.code === 'ECONNREFUSED' ? ' (RabbitMQ è acceso? docker compose up -d rabbitmq in broker/)' : '';
        console.log(`!! RabbitMQ non raggiungibile: ${errore.code ?? errore.message}${suggerimento}`);
      }
      setTimeout(collega, 5000);
    }
  }

  collega();
  return rabbit;
}

/**
 * Pubblica un evento sull'exchange degli eventi.
 * @param {{ canale: import('amqplib').ConfirmChannel | null }} rabbit  quello restituito da collegaAmqp
 * @param {import('../comune/eventi.js').Evento} evento
 */
export async function pubblicaEvento(rabbit, evento) {
  // TODO giornata 6 (passo 2) — pubblicare l'evento.
  //
  //  1. Se rabbit.canale è null, RabbitMQ non c'è: lanciamo un errore.
  //  2. La chiave di instradamento: chiaveEvento(evento), da comune/eventi.js.
  //     Per esempio "noleggio.fine.milano".
  //  3. rabbit.canale.publish(EXCHANGE_EVENTI, chiave, Buffer.from(JSON.stringify(evento)), opzioni)
  //     Le opzioni che contano:
  //       persistent   deve sopravvivere al riavvio del broker?
  //       contentType  'application/json', per chi lo guarda dalla console
  //       messageId    evento.id: chi lo riceve due volte se ne accorge
  //       mandatory    se nessuna coda corrisponde, vogliamo saperlo?
  //  4. await rabbit.canale.waitForConfirms(): aspettiamo che RabbitMQ dica
  //     «preso». Da quel momento la responsabilità è sua.
  //  5. Una riga nel log, come quelle del registro, aiuta a vedere cosa parte.
  throw new Error('TODO giornata 6: pubblicaEvento in cloud/amqp.js');
}

// Ciclo do baralho: 8 cartas, mão de 4, próxima carta visível. A carta jogada vai para o fim da fila.

export class DeckCycle {
  /**
   * @param {string[]} cardIds 8 ids únicos
   * @param {{shuffle:(a:any[])=>any[]}} rng
   * @param {number} handSize
   */
  constructor(cardIds, rng, handSize = 4) {
    if (!Array.isArray(cardIds) || cardIds.length < handSize + 1) {
      throw new Error('Baralho precisa ter mais cartas que a mão');
    }
    if (new Set(cardIds).size !== cardIds.length) throw new Error('Baralho com cartas repetidas');
    const order = rng ? rng.shuffle(cardIds) : cardIds.slice();
    this.hand = order.slice(0, handSize);
    this.queue = order.slice(handSize);
  }

  get next() {
    return this.queue[0];
  }

  has(slot) {
    return slot >= 0 && slot < this.hand.length && this.hand[slot] != null;
  }

  /** Remove a carta do slot, coloca a próxima no lugar e manda a jogada para o fim da fila. */
  play(slot) {
    if (!this.has(slot)) throw new Error('Slot inválido');
    const played = this.hand[slot];
    this.hand[slot] = this.queue.shift();
    this.queue.push(played);
    return played;
  }

  all() {
    return [...this.hand, ...this.queue];
  }
}

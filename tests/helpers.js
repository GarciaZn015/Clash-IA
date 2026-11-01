import { Match } from '../src/sim/match.js';
import { STARTER_DECK } from '../src/data/decks.js';
import { TICK } from '../src/core/constants.js';

export const DECK_A = ['escudeiro', 'arqueiras', 'lobos', 'diabretes', 'corvos', 'bombardeiro', 'saraivada', 'javali'];
export const DECK_B = ['golem', 'mago', 'meteoro', 'balista', 'geada', 'fonte', 'hino', 'feiticeira'];

export function newMatch(opts = {}) {
  return new Match({ decks: [opts.deck0 || STARTER_DECK, opts.deck1 || STARTER_DECK], seed: 42, rules: { countdown: 0, ...(opts.rules || {}) }, levels: opts.levels });
}

/** Garante que a carta esteja na mão e retorna o slot (sem alterar o conjunto de cartas). */
export function slotFor(m, side, cardId) {
  const deck = m.players[side].deck;
  let i = deck.hand.indexOf(cardId);
  if (i >= 0) return i;
  const q = deck.queue.indexOf(cardId);
  if (q < 0) throw new Error(`carta ${cardId} não está no baralho`);
  [deck.hand[0], deck.queue[q]] = [deck.queue[q], deck.hand[0]];
  return 0;
}

export function play(m, side, cardId, x, y, energy = 10) {
  m.players[side].energy = energy;
  return m.playCard(side, slotFor(m, side, cardId), x, y);
}

export function run(m, seconds, each) {
  const n = Math.round(seconds / TICK);
  for (let i = 0; i < n && !m.isOver; i++) {
    if (each) each(m);
    m.step(TICK);
    m.drainEvents();
  }
}

/** Remove todas as tropas e mantém apenas torres (útil para cenários isolados). */
export function clearUnits(m) {
  for (const e of m.entities) if (e.kind !== 'tower') e.dead = true;
  m.resolveDeaths();
  m.drainEvents();
}

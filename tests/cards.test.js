import test from 'node:test';
import assert from 'node:assert/strict';
import { CARDS, validateCards, levelMult } from '../src/data/cards.js';
import { UNITS } from '../src/data/units.js';
import { DeckCycle } from '../src/sim/deck.js';
import { createRng } from '../src/core/rng.js';
import { DECK_A } from './helpers.js';

test('dados das cartas são válidos', () => {
  assert.deepEqual(validateCards(), []);
});

test('existem pelo menos 16 cartas com papéis distintos e todas as categorias pedidas', () => {
  assert.ok(CARDS.length >= 16);
  const has = (pred) => CARDS.some(pred);
  const unit = (c) => (c.unitId ? UNITS[c.unitId] : null);
  assert.ok(has((c) => c.type === 'troop' && !unit(c).air), 'terrestre');
  assert.ok(has((c) => c.type === 'troop' && unit(c).air), 'aérea');
  assert.ok(has((c) => c.type === 'troop' && unit(c).range >= 3), 'à distância');
  assert.ok(has((c) => c.type === 'troop' && unit(c).range < 1), 'corpo a corpo');
  assert.ok(has((c) => c.type === 'troop' && unit(c).hp >= 2000), 'tanque');
  assert.ok(has((c) => c.type === 'troop' && unit(c).speed >= 1.6), 'rápida');
  assert.ok(has((c) => c.type === 'building'), 'construção');
  assert.ok(has((c) => c.type === 'spell' && c.spell.damage), 'feitiço ofensivo');
  assert.ok(has((c) => c.type === 'spell' && c.spell.friendly), 'feitiço de suporte');
  assert.ok(has((c) => c.unitId && unit(c).targets === 'buildings'), 'especialista em construções');
  // Nenhuma carta é cópia de outra com os mesmos números.
  const sigs = new Set(CARDS.map((c) => JSON.stringify(c.type === 'spell' ? c.spell : { ...UNITS[c.unitId], name: 0, count: c.count })));
  assert.equal(sigs.size, CARDS.length);
});

test('nível escala atributos em 10% compostos', () => {
  assert.equal(levelMult(1), 1);
  assert.ok(Math.abs(levelMult(3) - 1.21) < 1e-9);
});

test('ciclo do baralho: mão de 4, próxima carta e rotação', () => {
  const d = new DeckCycle(DECK_A, createRng(1), 4);
  assert.equal(d.hand.length, 4);
  assert.equal(d.queue.length, 4);
  assert.equal(new Set(d.all()).size, 8);
  const next = d.next;
  const played = d.play(2);
  assert.equal(d.hand[2], next, 'próxima carta entra no slot jogado');
  assert.equal(d.queue.at(-1), played, 'carta jogada vai para o fim da fila');
  assert.equal(new Set(d.all()).size, 8);
  // após 4 jogadas no mesmo slot, a primeira carta jogada volta à frente da fila
  d.play(2); d.play(2); d.play(2);
  assert.equal(d.next, played);
  assert.throws(() => d.play(7));
  assert.throws(() => new DeckCycle(['a', 'a', 'b', 'c', 'd', 'e', 'f', 'g'], null, 4));
});

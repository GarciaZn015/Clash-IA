import test from 'node:test';
import assert from 'node:assert/strict';
import { newMatch, clearUnits } from './helpers.js';
import { TICK } from '../src/core/constants.js';

test('desempenho: 150 unidades simultâneas simulam bem acima do tempo real', () => {
  const m = newMatch();
  clearUnits(m);
  const ids = ['escudeiro', 'arqueira', 'lobo', 'diabrete', 'corvo', 'mago', 'bombardeiro'];
  for (let i = 0; i < 150; i++) {
    const side = i % 2;
    m.spawnUnit(ids[i % ids.length], side, 1 + (i * 7) % 16, side === 0 ? 18 + (i % 12) : 2 + (i % 12), 1, null, 0);
  }
  const ticks = 30 * 5;
  const t0 = performance.now();
  for (let i = 0; i < ticks; i++) {
    m.step(TICK);
    m.drainEvents();
  }
  const ms = performance.now() - t0;
  const perTick = ms / ticks;
  // Orçamento de um quadro a 60 FPS é ~16 ms; a simulação precisa de bem menos que isso.
  assert.ok(perTick < 4, `${perTick.toFixed(2)} ms por tick`);
});

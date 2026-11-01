import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../src/sim/match.js';
import { AIController } from '../src/ai/ai.js';
import { AI_DECKS } from '../src/data/decks.js';
import { TICK } from '../src/core/constants.js';
import { clearUnits, DECK_A } from './helpers.js';
import { getCard } from '../src/data/cards.js';

function playMatch(da, db, seed) {
  const m = new Match({ decks: [AI_DECKS[da][seed % AI_DECKS[da].length], AI_DECKS[db][seed % AI_DECKS[db].length]], seed });
  const ais = [new AIController(m, 0, da, seed + 1), new AIController(m, 1, db, seed + 2)];
  let guard = 0;
  while (!m.isOver && guard++ < 30 * 400) {
    for (const a of ais) a.update(TICK);
    m.step(TICK);
    m.drainEvents();
  }
  return { m, ais };
}

test('IA joga cartas, respeita o éter e a partida termina', () => {
  const { m, ais } = playMatch('normal', 'normal', 5);
  assert.ok(m.isOver, 'partida terminou');
  for (const side of [0, 1]) {
    const st = m.players[side].stats;
    assert.ok(st.cardsPlayed >= 10, `lado ${side} jogou ${st.cardsPlayed} cartas`);
    // Éter gasto nunca supera o disponível: inicial + regeneração máxima possível
    const maxPossible = 5 + m.time * (1 / 2.8) * 2;
    assert.ok(st.energySpent <= maxPossible + 1e-6);
    assert.notEqual(ais[side].lastDecision?.action, 'error');
  }
});

test('IA nunca gasta éter que não tem', () => {
  const m = new Match({ decks: [DECK_A, AI_DECKS.hard[0]], seed: 3, rules: { countdown: 0 } });
  const ai = new AIController(m, 1, 'hard', 1);
  for (let i = 0; i < 30 * 60; i++) {
    const before = m.players[1].energy;
    const played = m.players[1].stats.energySpent;
    ai.update(TICK);
    const spent = m.players[1].stats.energySpent - played;
    assert.ok(spent <= before + 1e-9, 'gastou mais que o disponível');
    assert.ok(m.players[1].energy >= -1e-9);
    m.step(TICK);
    m.drainEvents();
  }
});

test('IA defende um ataque perigoso no seu lado', () => {
  let defended = 0;
  for (let seed = 1; seed <= 5; seed++) {
    const m = new Match({ decks: [DECK_A, AI_DECKS.normal[0]], seed, rules: { countdown: 0 } });
    clearUnits(m);
    const ai = new AIController(m, 1, 'hard', seed);
    m.players[1].energy = 8;
    // ataque do jogador já do lado da IA
    for (let i = 0; i < 3; i++) m.spawnUnit('lobo', 0, 3.5 + i * 0.4, 11, 1, null, 0);
    m.spawnUnit('escudeiro', 0, 3.5, 12, 1, null, 0);
    const before = m.players[1].stats.cardsPlayed;
    for (let i = 0; i < 30 * 2; i++) {
      ai.update(TICK);
      m.step(TICK);
      m.drainEvents();
    }
    if (m.players[1].stats.cardsPlayed > before) defended++;
  }
  assert.ok(defended >= 4, `defendeu em ${defended}/5 cenários`);
});

test('IA posiciona tropas apenas no próprio lado (ou no bolsão liberado)', () => {
  const m = new Match({ decks: [AI_DECKS.normal[0], AI_DECKS.hard[1]], seed: 21 });
  const ais = [new AIController(m, 0, 'normal', 1), new AIController(m, 1, 'hard', 2)];
  let checked = 0;
  while (!m.isOver) {
    for (const a of ais) a.update(TICK);
    m.step(TICK);
    for (const ev of m.drainEvents()) {
      if (ev.type !== 'cardPlayed' || getCard(ev.cardId).type === 'spell') continue;
      const ly = ev.side === 0 ? ev.y : 32 - ev.y;
      assert.ok(ly >= 17.5 || (ly >= 10 && ly <= 14.5), `posição inválida ${ev.cardId} ${ev.x},${ev.y}`);
      checked++;
    }
  }
  assert.ok(checked > 10);
});

test('dificuldades produzem desafio crescente (difícil vence fácil na maioria)', () => {
  let hardWins = 0;
  const N = 6;
  for (let i = 0; i < N; i++) {
    const { m } = playMatch('hard', 'easy', 100 + i);
    if (m.result.winner === 0) hardWins++;
  }
  assert.ok(hardWins >= 5, `difícil venceu ${hardWins}/${N}`);
});

test('IA usa feitiço de dano em grupo valioso', () => {
  let cast = 0;
  for (let seed = 1; seed <= 6; seed++) {
    const deck = ['saraivada', 'meteoro', 'escudeiro', 'arqueiras', 'lobos', 'diabretes', 'corvos', 'bombardeiro'];
    const m = new Match({ decks: [DECK_A, deck], seed, rules: { countdown: 0 } });
    clearUnits(m);
    const ai = new AIController(m, 1, 'hard', seed);
    m.players[1].energy = 10;
    for (let i = 0; i < 5; i++) m.spawnUnit('diabrete', 0, 3 + (i % 3) * 0.5, 12 + Math.floor(i / 3) * 0.5, 1, null, 0);
    m.spawnUnit('arqueira', 0, 4, 13, 1, null, 0);
    const spells = () => m.players[1].stats.spellsCast;
    for (let i = 0; i < 30 * 2 && spells() === 0; i++) {
      ai.update(TICK);
      m.step(TICK);
      m.drainEvents();
    }
    if (spells() > 0) cast++;
  }
  assert.ok(cast >= 3, `usou feitiço em ${cast}/6`);
  assert.equal(getCard('saraivada').type, 'spell');
});

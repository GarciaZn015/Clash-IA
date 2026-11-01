import test from 'node:test';
import assert from 'node:assert/strict';
import { Match, PHASE } from '../src/sim/match.js';
import { TICK, RIVER_TOP, RIVER_BOTTOM, BRIDGES, MAX_ENERGY } from '../src/core/constants.js';
import { newMatch, play, run, clearUnits, slotFor, DECK_A, DECK_B } from './helpers.js';
import { STARTER_DECK } from '../src/data/decks.js';

test('contagem regressiva bloqueia jogadas e depois inicia a partida', () => {
  const m = new Match({ decks: [STARTER_DECK, STARTER_DECK], seed: 1 });
  assert.equal(m.phase, PHASE.COUNTDOWN);
  assert.equal(m.playCard(0, 0, 9, 25).ok, false);
  run(m, 3.1);
  assert.equal(m.phase, PHASE.PLAYING);
  assert.ok(m.time < 0.2);
});

test('baralho com tamanho errado ou carta inexistente é rejeitado', () => {
  assert.throws(() => new Match({ decks: [STARTER_DECK.slice(0, 7), STARTER_DECK] }));
  assert.throws(() => new Match({ decks: [[...STARTER_DECK.slice(0, 7), 'inexistente'], STARTER_DECK] }));
});

test('éter: consumo, bloqueio sem recursos, regeneração, limite e aceleração', () => {
  const m = newMatch();
  const p = m.players[0];
  assert.equal(p.energy, 5);
  p.energy = 2;
  const slot = slotFor(m, 0, 'escudeiro');
  const r = m.playCard(0, slot, 9, 24);
  assert.equal(r.ok, false);
  assert.match(r.reason, /insuficiente/);
  p.energy = 3;
  assert.ok(m.playCard(0, slot, 9, 24).ok);
  assert.ok(p.energy < 1e-9);
  run(m, 2.8);
  assert.ok(Math.abs(p.energy - 1) < 0.02, `regenera 1 a cada 2,8s (${p.energy})`);
  p.energy = 9.9;
  run(m, 5);
  assert.equal(p.energy, MAX_ENERGY);
  assert.ok(p.stats.energyWasted > 0);
  // último minuto: regeneração dobrada
  const m2 = newMatch();
  m2.time = 120.5;
  m2.players[0].energy = 0;
  run(m2, 1.4);
  assert.ok(Math.abs(m2.players[0].energy - 1) < 0.03, `dobro (${m2.players[0].energy})`);
});

test('posicionamento: próprio lado sim; rio, lado inimigo e torres não; feitiços em qualquer lugar', () => {
  const m = newMatch({ deck0: DECK_A });
  const s = slotFor(m, 0, 'escudeiro');
  m.players[0].energy = 10;
  assert.equal(m.canPlay(0, s, 9, 10).ok, false, 'lado inimigo');
  assert.equal(m.canPlay(0, s, 9, 16).ok, false, 'rio');
  assert.equal(m.canPlay(0, s, 3.5, 25.5).ok, false, 'sobre a torre');
  assert.equal(m.canPlay(0, s, -1, 25).ok, false, 'fora da arena');
  assert.equal(m.canPlay(0, s, Number.NaN, 25).ok, false, 'NaN');
  assert.equal(m.canPlay(0, s, 9, 20).ok, true);
  // o lado de cima é espelhado
  m.players[1].energy = 10;
  const s1 = slotFor(m, 1, 'escudeiro');
  assert.equal(m.canPlay(1, s1, 9, 20).ok, false);
  assert.equal(m.canPlay(1, s1, 9, 12).ok, true);
  const sp = slotFor(m, 0, 'saraivada');
  assert.equal(m.canPlay(0, sp, 9, 5).ok, true, 'feitiço no lado inimigo');
});

test('bolsão: destruir torre auxiliar libera posicionamento avançado naquela lateral', () => {
  const m = newMatch({ deck0: DECK_A });
  m.players[0].energy = 10;
  const s = slotFor(m, 0, 'escudeiro');
  assert.equal(m.canPlay(0, s, 4, 12).ok, false);
  const left = m.towers.find((t) => t.side === 1 && t.role === 'princess' && t.lane === 0);
  m.applyDamage(left, 99999, 0);
  m.resolveDeaths();
  assert.equal(m.canPlay(0, s, 4, 12).ok, true, 'lateral esquerda liberada');
  assert.equal(m.canPlay(0, s, 14, 12).ok, false, 'lateral direita continua bloqueada');
  assert.equal(m.players[0].crowns, 1);
  const king = m.kingOf(1);
  assert.equal(king.active, true, 'rei desperta quando uma torre auxiliar cai');
});

test('tropas terrestres atravessam o rio apenas pelas pontes', () => {
  const m = newMatch({ deck0: DECK_A });
  clearUnits(m);
  play(m, 0, 'escudeiro', 9, 18);
  const u = m.entities.find((e) => e.defId === 'escudeiro');
  let crossed = false;
  run(m, 20, () => {
    if (u.dead) return;
    if (u.y > RIVER_TOP && u.y < RIVER_BOTTOM) {
      assert.ok(BRIDGES.some((b) => Math.abs(u.x - b.x) <= b.half + 1e-6), `no rio fora da ponte: ${u.x.toFixed(2)},${u.y.toFixed(2)}`);
    }
    if (u.y < RIVER_TOP) crossed = true;
  });
  assert.ok(crossed, 'unidade chegou ao outro lado');
});

test('unidade aérea voa por cima do rio em linha reta', () => {
  const m = newMatch({ deck0: DECK_A });
  clearUnits(m);
  play(m, 0, 'corvos', 9, 18);
  const c = m.entities.find((e) => e.defId === 'corvo');
  let overRiverOffBridge = false;
  run(m, 6, () => {
    if (!c.dead && c.y > RIVER_TOP && c.y < RIVER_BOTTOM && !BRIDGES.some((b) => Math.abs(c.x - b.x) <= b.half)) overRiverOffBridge = true;
  });
  assert.ok(overRiverOffBridge);
});

test('alvos: quem mira construções ignora tropas; terrestres não acertam aéreos', () => {
  const m = newMatch({ deck0: DECK_A });
  clearUnits(m);
  const jav = m.spawnUnit('javali', 0, 3.5, 20, 1, null, 0);
  const enemyKnight = m.spawnUnit('escudeiro', 1, 3.5, 19, 1, null, 0);
  const bat = m.spawnUnit('corvo', 1, 9, 20, 1, null, 0);
  const bomber = m.spawnUnit('bombardeiro', 0, 9, 22, 1, null, 0);
  assert.equal(m.canTarget(jav, enemyKnight), false);
  assert.equal(m.canTarget(bomber, bat), false);
  assert.equal(m.canTarget(m.towers.find((t) => t.side === 0), bat), true, 'torres miram o ar');
  m.step(TICK);
  const t = m.getEntity(jav.targetId);
  assert.ok(t && (t.kind === 'tower' || t.kind === 'building'));
});

test('combate real: dano reduz vida, morte remove a entidade e limpa referências', () => {
  const m = newMatch();
  clearUnits(m);
  const a = m.spawnUnit('escudeiro', 0, 9, 21, 1, null, 0);
  const b = m.spawnUnit('diabrete', 1, 9, 20.2, 1, null, 0);
  const bId = b.id;
  run(m, 4);
  assert.equal(m.getEntity(bId), null, 'diabrete morreu');
  assert.ok(!m.entities.includes(b));
  assert.ok(!a.dead, 'escudeiro sobreviveu');
  m.step(TICK);
  assert.notEqual(a.targetId, bId, 'alvo morto não é mais referenciado');
  assert.ok(m.players[0].stats.unitsKilled >= 1);
});

test('escudo absorve dano antes da vida', () => {
  const m = newMatch();
  const k = m.spawnUnit('escudeiro', 0, 9, 22, 1, null, 0);
  m.applyDamage(k, 100, 1);
  assert.equal(k.hp, k.maxHp);
  assert.equal(k.shield, k.maxShield - 100);
  m.applyDamage(k, k.shield + 50, 1);
  assert.equal(k.shield, 0);
  assert.equal(k.hp, k.maxHp - 50);
});

test('torres atacam invasores no alcance e o rei só desperta quando atacado', () => {
  const m = newMatch();
  clearUnits(m);
  const enemy = m.spawnUnit('escudeiro', 1, 3.5, 20.5, 1, null, 0);
  const hp0 = enemy.hp + enemy.shield;
  run(m, 3, () => { enemy.speed = 0; });
  assert.ok(enemy.dead || enemy.hp + enemy.shield < hp0, 'torre auxiliar causou dano');
  const king = m.kingOf(0);
  assert.equal(king.active, false);
  m.applyDamage(king, 10, 1);
  assert.equal(king.active, true);
});

test('feitiços: dano em área, dano reduzido em torre, congelamento e cura', () => {
  const m = newMatch({ deck0: DECK_B });
  clearUnits(m);
  const units = [0, 1, 2].map((i) => m.spawnUnit('diabrete', 1, 4 + i * 0.5, 9.5, 1, null, 0));
  for (const u of units) u.speed = 0;
  const tower = m.towers.find((t) => t.side === 1 && t.lane === 0);
  assert.ok(play(m, 0, 'meteoro', 4.5, 7.5).ok);
  run(m, 1.2);
  assert.ok(tower.hp < tower.maxHp && tower.maxHp - tower.hp <= 400 * 0.35 + 1, 'dano reduzido na torre');
  assert.ok(units.every((u) => u.dead), 'meteoro elimina o enxame');
  const m2 = newMatch({ deck0: DECK_B });
  clearUnits(m2);
  const imp = m2.spawnUnit('escudeiro', 1, 9, 9, 1, null, 0);
  assert.ok(play(m2, 0, 'geada', 9, 9).ok);
  run(m2, 0.3);
  assert.ok(imp.frozenT > 2, 'congelado');
  const y0 = imp.y;
  run(m2, 1);
  assert.equal(imp.y, y0, 'congelado não se move');
  const friend = m2.spawnUnit('escudeiro', 0, 9, 24, 1, null, 0);
  friend.hp = 100;
  assert.ok(play(m2, 0, 'fonte', 9, 24).ok);
  run(m2, 2);
  assert.ok(friend.hp > 250, `curou (${friend.hp})`);
});

test('morte do golem causa dano e libera fragmentos; forja gera diabretes', () => {
  const m = newMatch();
  clearUnits(m);
  const g = m.spawnUnit('golem', 0, 9, 22, 1, null, 0);
  m.applyDamage(g, 99999, 1);
  m.resolveDeaths();
  assert.equal(m.entities.filter((e) => e.defId === 'fragmento').length, 2);
  const f = m.spawnUnit('forja', 0, 9, 24, 1, null, 0);
  run(m, 2);
  assert.ok(m.entities.filter((e) => e.defId === 'diabrete' && e.side === 0).length >= 2);
  assert.ok(f.hp < f.maxHp, 'construção perde vida com o tempo');
});

test('vitória imediata ao destruir a torre do rei e nada mais acontece depois', () => {
  const m = newMatch();
  m.spawnUnit('golem', 0, 9, 6, 1, null, 0);
  m.applyDamage(m.kingOf(1), 99999, 0);
  m.step(TICK);
  assert.equal(m.phase, PHASE.ENDED);
  assert.equal(m.result.winner, 0);
  assert.equal(m.result.crowns[0], 3);
  const snapshot = JSON.stringify(m.entities.map((e) => [e.id, e.hp, e.x, e.y]));
  run(m, 5);
  m.applyDamage(m.kingOf(0), 500, 1);
  assert.equal(JSON.stringify(m.entities.map((e) => [e.id, e.hp, e.x, e.y])), snapshot, 'estado congelado após o fim');
  assert.equal(m.playCard(0, 0, 9, 24).ok, false);
  assert.equal(m.projectiles.length, 0);
});

test('destruição simultânea das duas torres do rei resulta em empate', () => {
  const m = newMatch();
  m.kingOf(0).hp = 0;
  m.kingOf(0).dead = true;
  m.kingOf(1).hp = 0;
  m.kingOf(1).dead = true;
  m.step(TICK);
  assert.equal(m.result.winner, null);
});

test('fim do tempo: mais coroas vence; empate vai para prorrogação; morte súbita; desempate por vida', () => {
  const m = newMatch({ rules: { duration: 2, overtime: 2 } });
  clearUnits(m);
  m.applyDamage(m.towers.find((t) => t.side === 1 && t.role === 'princess'), 99999, 0);
  run(m, 3);
  assert.equal(m.result.winner, 0);

  const m2 = newMatch({ rules: { duration: 1, overtime: 3 } });
  run(m2, 1.1);
  assert.equal(m2.phase, PHASE.OVERTIME);
  assert.ok(m2.energyMultiplier === 2);
  m2.applyDamage(m2.towers.find((t) => t.side === 0 && t.role === 'princess'), 99999, 1);
  run(m2, 0.1);
  assert.equal(m2.result.winner, 1, 'morte súbita');

  const m3 = newMatch({ rules: { duration: 1, overtime: 1 } });
  m3.towers.find((t) => t.side === 1).hp -= 100;
  run(m3, 2.2);
  assert.equal(m3.result.winner, 0, 'desempate por vida das torres');

  const m4 = newMatch({ rules: { duration: 1, overtime: 1 } });
  run(m4, 2.2);
  assert.equal(m4.result.winner, null, 'empate perfeito');
});

test('determinismo: mesma semente e mesmos comandos geram o mesmo resultado', () => {
  const sim = () => {
    const m = new Match({ decks: [DECK_A, DECK_A], seed: 9, rules: { countdown: 0 } });
    play(m, 0, 'lobos', 3.5, 20);
    play(m, 1, 'escudeiro', 3.5, 12);
    run(m, 15);
    return JSON.stringify(m.entities.map((e) => [e.defId, Math.round(e.hp), e.x.toFixed(3)]));
  };
  assert.equal(sim(), sim());
});

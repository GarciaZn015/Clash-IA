// Adversário controlado pelo computador. Lê o estado real da partida (tropas, torres, éter)
// e decide entre defender, contra-atacar, pressionar ou guardar recursos.
// Toda jogada passa por match.playCard, que valida custo e posicionamento como para o jogador.
import { ARENA_H, ARENA_W, localY, MAX_ENERGY } from '../core/constants.js';
import { dist } from '../core/math.js';
import { createRng } from '../core/rng.js';
import { getCard, levelMult } from '../data/cards.js';
import { getUnit } from '../data/units.js';
import { PHASE } from '../sim/match.js';

export const AI_PROFILES = {
  easy: { reaction: [1.8, 3.0], mistake: 0.3, noise: 1.4, attackAt: 9.5, defendThreshold: 4.0, spellValue: 2.2, counterpush: false, snipe: false },
  normal: { reaction: [0.9, 1.5], mistake: 0.08, noise: 0.6, attackAt: 8, defendThreshold: 2.2, spellValue: 1.5, counterpush: true, snipe: false },
  hard: { reaction: [0.45, 0.8], mistake: 0, noise: 0.25, attackAt: 7, defendThreshold: 1.2, spellValue: 1.15, counterpush: true, snipe: true },
};

const LANE_X = [3.5, 14.5];

function unitValue(e) {
  if (e.kind === 'tower') return 0;
  const dps = e.hitSpeed > 0 ? e.damage / e.hitSpeed : 0;
  const v = ((e.hp + e.shield) / 260 + dps / 55) * 0.6;
  return e.kind === 'building' ? v * 0.5 : v;
}

export class AIController {
  constructor(match, side, difficulty = 'normal', seed = 7) {
    this.match = match;
    this.side = side;
    this.difficulty = AI_PROFILES[difficulty] ? difficulty : 'normal';
    this.p = AI_PROFILES[this.difficulty];
    this.rng = createRng(seed);
    this.timer = 1.0 + this.rng.next();
    this.lastDecision = null;
  }

  /** Converte coordenadas locais (lado da IA embaixo) para o mundo. */
  world(lx, ly) {
    return { x: lx, y: this.side === 0 ? ly : ARENA_H - ly };
  }

  ly(y) {
    return localY(this.side, y);
  }

  update(dt) {
    const m = this.match;
    if (m.phase !== PHASE.PLAYING && m.phase !== PHASE.OVERTIME) return;
    this.timer -= dt;
    if (this.timer > 0) return;
    const [a, b] = this.p.reaction;
    this.timer = a + (b - a) * this.rng.next();
    try {
      this.lastDecision = this.decide();
    } catch (err) {
      // A IA nunca pode derrubar a partida; registra e segue.
      this.lastDecision = { action: 'error', error: String(err) };
    }
  }

  analyze() {
    const m = this.match;
    const enemies = [];
    const allies = [];
    for (const e of m.entities) {
      if (e.dead || e.kind === 'tower') continue;
      (e.side === this.side ? allies : enemies).push(e);
    }
    const lanes = [0, 1].map(() => ({ threat: 0, units: [], front: null, air: 0, swarm: 0, tank: 0, rusher: 0 }));
    for (const e of enemies) {
      const ly = this.ly(e.y);
      if (ly < 11) continue; // ainda longe
      const lane = e.x < ARENA_W / 2 ? 0 : 1;
      const L = lanes[lane];
      const proximity = ly > 17 ? 1.4 : 0.8;
      const v = unitValue(e) * proximity;
      L.threat += v;
      L.units.push(e);
      if (!L.front || ly > this.ly(L.front.y)) L.front = e;
      if (e.air) L.air += v;
      if (e.maxHp < 130) L.swarm++;
      if (e.maxHp >= 1500) L.tank += v;
      if (e.targets === 'buildings') L.rusher += v;
    }
    const allyValue = [0, 1].map((lane) => allies.filter((a) => (a.x < ARENA_W / 2 ? 0 : 1) === lane && a.kind === 'unit').reduce((s, a) => s + unitValue(a), 0));
    const enemyTowers = m.towers.filter((t) => t.side !== this.side && !t.dead);
    const ownTowers = m.towers.filter((t) => t.side === this.side && !t.dead);
    return { enemies, allies, lanes, allyValue, enemyTowers, ownTowers };
  }

  hand() {
    const p = this.match.players[this.side];
    return p.deck.hand.map((id, slot) => ({ slot, card: getCard(id) })).filter((h) => h.card.cost <= p.energy + 1e-9);
  }

  decide() {
    const m = this.match;
    const me = m.players[this.side];
    const st = this.analyze();
    const options = this.hand();
    if (!options.length) return { action: 'wait' };

    if (this.rng.chance(this.p.mistake) && me.energy > 4) return this.randomPlay(options);

    // 1) Defesa
    const laneIdx = st.lanes[0].threat >= st.lanes[1].threat ? 0 : 1;
    const L = st.lanes[laneIdx];
    const defenseNeed = L.threat - st.allyValue[laneIdx] * 0.8;
    if (L.front && defenseNeed > this.p.defendThreshold * 0.5) {
      const played = this.defend(L, options, st, defenseNeed);
      if (played) return played;
    }

    // 2) Suporte: curar ou acelerar tropas em combate
    const supportPlay = this.trySupportSpell(options, st);
    if (supportPlay) return supportPlay;

    // 3) Feitiço de alto valor ou para finalizar torre
    const spellPlay = this.trySpell(options, st);
    if (spellPlay) return spellPlay;

    // 4) Contra-ataque apoiando tropas vivas
    if (this.p.counterpush) {
      const pushLane = st.allyValue[0] >= st.allyValue[1] ? 0 : 1;
      if (st.allyValue[pushLane] > 2.5 && me.energy >= 4) {
        const support = this.support(options, st, pushLane);
        if (support) return support;
      }
    }

    // 5) Ataque quando há éter de sobra
    const leaking = me.energy >= MAX_ENERGY - 0.6;
    if (me.energy >= this.p.attackAt || leaking) return this.attack(options, st) || { action: 'wait' };
    return { action: 'wait' };
  }

  tryPlay(slot, lx, ly, tag) {
    const n = this.p.noise;
    const attempts = [[0, 0], [this.rng.range(-n, n), this.rng.range(-n, n)], [0, 1], [0, 2], [1.5, 1.5], [-1.5, 1.5], [0, 4]];
    for (const [dx, dy] of attempts) {
      const w = this.world(Math.max(0.6, Math.min(ARENA_W - 0.6, lx + dx)), Math.max(0.6, Math.min(ARENA_H - 0.6, ly + dy)));
      const res = this.match.playCard(this.side, slot, w.x, w.y);
      if (res.ok) return { action: tag, cardId: res.cardId, x: w.x, y: w.y };
    }
    return null;
  }

  scoreDefender(card, L) {
    if (card.type === 'spell') return -10;
    const u = getUnit(card.unitId);
    let s = 1;
    const airShare = L.threat > 0 ? L.air / L.threat : 0;
    const hitsAir = u.targets === 'both';
    if (airShare > 0.4) s += hitsAir ? 4 : -6;
    if (L.swarm >= 3) s += u.splash || u.spin ? 4 : card.count > 1 ? 0.5 : -1;
    if (L.tank > 2) {
      if (u.ability && u.ability.type === 'ramp') s += 5;
      if (card.count >= 3) s += 2.5;
      if (u.building) s += 2.5;
    }
    if (L.rusher > 0.5 && u.building) s += 2.5;
    if (u.targets === 'buildings') s -= 6; // não defende
    if (u.targets === 'none' && !u.spawn) s -= 6;
    if (u.spawn) s -= 1;
    const dps = u.hitSpeed > 0 ? (u.damage * card.count) / u.hitSpeed : 0;
    s += Math.min(3, dps / 90) + Math.min(2, (u.hp * card.count) / 700);
    s -= Math.max(0, card.cost - (L.threat + 2)) * 0.8;
    return s;
  }

  defend(L, options, st, need) {
    const front = L.front;
    const fly = this.ly(front.y);
    // Feitiço se o grupo vale a pena
    const spell = this.bestSpellOn(options, st.enemies, front.x, front.y, true);
    if (spell && spell.value >= spell.card.cost * this.p.spellValue && (L.swarm >= 3 || spell.value >= spell.card.cost * 1.8)) {
      return this.castAt(spell, 'defend-spell');
    }
    let best = null;
    let bestScore = -Infinity;
    for (const o of options) {
      const sc = this.scoreDefender(o.card, L) + this.rng.range(-0.5, 0.5);
      if (sc > bestScore) {
        bestScore = sc;
        best = o;
      }
    }
    if (!best || bestScore < 0) {
      if (spell && need > 4) return this.castAt(spell, 'defend-spell');
      return null;
    }
    // Não reage a ameaças pequenas com cartas caras, deixa a torre trabalhar
    if (need < this.p.defendThreshold && best.card.cost > 3) return null;
    const u = getUnit(best.card.unitId);
    const laneX = front.x < ARENA_W / 2 ? LANE_X[0] : LANE_X[1];
    let lx;
    let ly;
    if (u.building) {
      lx = front.x < ARENA_W / 2 ? 7.2 : 10.8;
      ly = 21.5;
    } else if (u.range >= 3) {
      // Unidades à distância ficam atrás, protegidas pela torre
      lx = laneX + (laneX < 9 ? 1.5 : -1.5);
      ly = Math.max(23, Math.min(28, fly + 5));
    } else if (fly > 17.5) {
      lx = front.x;
      ly = Math.min(30, fly + 1.2);
    } else {
      lx = laneX;
      ly = 19.5;
    }
    return this.tryPlay(best.slot, lx, ly, 'defend');
  }

  bestSpellOn(options, enemies, cx, cy, defensive) {
    let best = null;
    for (const o of options) {
      if (o.card.type !== 'spell' || o.card.spell.friendly) continue;
      const sp = o.card.spell;
      // Centro previsto: média ponderada das unidades próximas ao ponto, avançada pelo atraso do feitiço
      let wx = 0;
      let wy = 0;
      let wsum = 0;
      for (const e of enemies) {
        if (dist(e.x, e.y, cx, cy) > sp.radius * 1.6) continue;
        const v = unitValue(e);
        const dirY = e.side === 0 ? -1 : 1;
        const lead = e.deployT > 0 || e.speed === 0 ? 0 : e.speed * (sp.delay || 0) * 0.8;
        wx += e.x * v;
        wy += (e.y + dirY * lead) * v;
        wsum += v;
      }
      if (wsum <= 0) continue;
      const x = wx / wsum;
      const y = wy / wsum;
      let value = 0;
      for (const e of enemies) {
        if (dist(e.x, e.y, x, y) > sp.radius + e.radius) continue;
        const effHp = e.hp + e.shield;
        const dmg = ((sp.damage || 0) / (sp.waves || 1)) * (sp.waves || 1) * levelMult(this.match.players[this.side].levelOf(o.card.id));
        const killFrac = dmg > 0 ? Math.min(1, dmg / Math.max(1, effHp)) : 0.3;
        value += (e.maxHp < 150 ? 0.9 : unitValue(e) * killFrac) + (sp.freeze ? unitValue(e) * 0.4 : 0);
      }
      for (const t of this.match.towers) {
        if (t.side === this.side || t.dead) continue;
        if (dist(t.x, t.y, x, y) <= sp.radius + t.radius) value += defensive ? 0.4 : 1.2;
      }
      if (!best || value > best.value) best = { ...o, x, y, value };
    }
    return best;
  }

  castAt(spell, tag) {
    const n = this.p.noise * 0.4;
    const res = this.match.playCard(this.side, spell.slot, spell.x + this.rng.range(-n, n), spell.y + this.rng.range(-n, n));
    if (res.ok) return { action: tag, cardId: res.cardId, x: spell.x, y: spell.y };
    return null;
  }

  trySpell(options, st) {
    const spells = options.filter((o) => o.card.type === 'spell' && !o.card.spell.friendly);
    if (!spells.length) return null;
    if (this.p.snipe) {
      for (const t of st.enemyTowers) {
        for (const o of spells) {
          const sp = o.card.spell;
          const lvl = this.match.players[this.side].levelOf(o.card.id);
          const dmg = (sp.damage || 0) * levelMult(lvl) * (sp.towerFactor ?? 0.35);
          if (dmg >= t.hp) return this.castAt({ ...o, x: t.x, y: t.y }, 'snipe');
        }
      }
    }
    // Grupo inimigo valioso em qualquer lugar
    let best = null;
    for (const e of st.enemies) {
      const s = this.bestSpellOn(spells, st.enemies, e.x, e.y, false);
      if (s && (!best || s.value > best.value)) best = s;
    }
    if (best && best.value >= best.card.cost * this.p.spellValue * 1.3) return this.castAt(best, 'value-spell');
    return null;
  }

  /** Fonte de Cura em tropas feridas engajadas; Hino de Guerra em grupos lutando. */
  trySupportSpell(options, st) {
    const friendly = options.filter((o) => o.card.type === 'spell' && o.card.spell.friendly);
    if (!friendly.length) return null;
    const engaged = st.allies.filter((a) => a.kind === 'unit' && a.deployT <= 0 && this.match.getEntity(a.targetId));
    if (engaged.length < 2) return null;
    for (const o of friendly) {
      const sp = o.card.spell;
      let best = null;
      for (const center of engaged) {
        let value = 0;
        let cx = 0;
        let cy = 0;
        let n = 0;
        for (const a of engaged) {
          if (dist(a.x, a.y, center.x, center.y) > sp.radius) continue;
          value += sp.heal ? Math.min(a.maxHp - a.hp, sp.heal * sp.duration) : unitValue(a);
          cx += a.x;
          cy += a.y;
          n++;
        }
        if (n && (!best || value > best.value)) best = { value, x: cx / n, y: cy / n, n };
      }
      if (!best) continue;
      const worth = sp.heal ? best.value >= 450 : best.n >= 3 && best.value >= 4;
      if (worth) {
        const res = this.match.playCard(this.side, o.slot, best.x, best.y);
        if (res.ok) return { action: 'support-spell', cardId: res.cardId, x: best.x, y: best.y };
      }
    }
    return null;
  }

  support(options, st, lane) {
    const allies = st.allies.filter((a) => a.kind === 'unit' && (a.x < ARENA_W / 2 ? 0 : 1) === lane);
    if (!allies.length) return null;
    const lead = allies.reduce((b, a) => (this.ly(a.y) < this.ly(b.y) ? a : b));
    const leadLy = this.ly(lead.y);
    if (leadLy > 22) return null; // ainda está defendendo perto da torre
    // Hino de Guerra sobre o grupo avançado
    const hymn = options.find((o) => o.card.id === 'hino');
    if (hymn && allies.length >= 2 && leadLy < 14) {
      const res = this.match.playCard(this.side, hymn.slot, lead.x, lead.y);
      if (res.ok) return { action: 'support-spell', cardId: res.cardId };
    }
    const troops = options.filter((o) => o.card.type === 'troop');
    if (!troops.length) return null;
    const pick = troops.sort((a, b) => b.card.cost - a.card.cost)[0];
    if (pick.card.cost > this.match.players[this.side].energy - 1 && this.match.players[this.side].energy < 7) return null;
    return this.tryPlay(pick.slot, LANE_X[lane], 18.3, 'counterpush');
  }

  pickAttackLane(st) {
    let lane = this.rng.chance(0.5) ? 0 : 1;
    let lowest = Infinity;
    for (const l of [0, 1]) {
      const t = st.enemyTowers.find((tt) => tt.role === 'princess' && tt.lane === l);
      const hp = t ? t.hp : -1; // torre já destruída = rota livre para o rei
      if (hp < lowest) {
        lowest = hp;
        lane = l;
      }
    }
    return lane;
  }

  attack(options, st) {
    const me = this.match.players[this.side];
    const lane = this.pickAttackLane(st);
    const lx = LANE_X[lane];
    const ranked = options.map((o) => {
      const c = o.card;
      let s = this.rng.range(0, 1);
      if (c.type === 'spell') s -= 5;
      else {
        const u = getUnit(c.unitId);
        if (u.targets === 'buildings') s += 3;
        if (u.hp >= 1500) s += me.energy >= 9 ? 4 : -3;
        if (u.building && u.spawn) s += 1.5;
        if (u.building && !u.spawn) s -= 4;
        if (c.count >= 3) s += 0.5;
      }
      return { o, s };
    }).sort((a, b) => b.s - a.s);
    for (const { o, s } of ranked) {
      if (s < -2) break;
      const u = getUnit(o.card.unitId);
      if (u.hp >= 1500) {
        const r = this.tryPlay(o.slot, lane === 0 ? 7 : 11, 30.5, 'tank-back');
        if (r) return r;
      } else if (u.building) {
        const r = this.tryPlay(o.slot, lane === 0 ? 6.5 : 11.5, 26.5, 'spawner');
        if (r) return r;
      } else if (u.range >= 3) {
        const r = this.tryPlay(o.slot, lx, 21, 'attack-ranged');
        if (r) return r;
      } else {
        const r = this.tryPlay(o.slot, lx, 18.2, 'attack');
        if (r) return r;
      }
    }
    // Último recurso para não desperdiçar éter
    if (me.energy >= MAX_ENERGY - 0.6) {
      const cheap = options.filter((o) => o.card.type !== 'spell').sort((a, b) => a.card.cost - b.card.cost)[0];
      if (cheap) return this.tryPlay(cheap.slot, 9, 27, 'anti-leak');
    }
    return null;
  }

  randomPlay(options) {
    const o = this.rng.pick(options);
    if (o.card.type === 'spell') {
      const target = this.rng.pick(this.match.towers.filter((t) => t.side !== this.side && !t.dead)) || { x: 9, y: 16 };
      const res = this.match.playCard(this.side, o.slot, target.x + this.rng.range(-2, 2), target.y + this.rng.range(-2, 2));
      return res.ok ? { action: 'random', cardId: res.cardId } : { action: 'wait' };
    }
    return this.tryPlay(o.slot, this.rng.range(1.5, 16.5), this.rng.range(18.5, 30), 'random') || { action: 'wait' };
  }
}

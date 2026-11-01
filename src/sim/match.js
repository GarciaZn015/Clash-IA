// Simulação autoritativa da partida. Não depende de DOM nem de renderização:
// recebe comandos (playCard), avança em passos fixos (step) e emite eventos para UI/áudio/efeitos.
import {
  ARENA_W, ARENA_H, TICK, MAX_ENERGY, TOWER_STATS, TOWER_LAYOUT, DEFAULT_SIGHT, DEPLOY_TIME,
  CROWN_TOWER_SPELL_FACTOR, SIDE_PLAYER, mirrorY,
} from '../core/constants.js';
import { createRng } from '../core/rng.js';
import { dist, edgeDist, clamp } from '../core/math.js';
import { getCard, levelMult } from '../data/cards.js';
import { getUnit } from '../data/units.js';
import { getRules } from '../data/modes.js';
import { DeckCycle } from './deck.js';
import { canDeployAt, canCastAt } from './placement.js';
import { waypoint, constrain } from './navigation.js';

export const PHASE = Object.freeze({
  COUNTDOWN: 'countdown', PLAYING: 'playing', OVERTIME: 'overtime', ENDED: 'ended',
});

function newStats() {
  return {
    cardsPlayed: 0, energySpent: 0, troopsDeployed: 0, spellsCast: 0, airDeployed: 0, buildingsPlaced: 0,
    damageDealt: 0, towerDamage: 0, unitsKilled: 0, towersDestroyed: 0, energyWasted: 0,
  };
}

export class Match {
  /**
   * @param {object} opts
   * @param {[string[], string[]]} opts.decks baralhos dos lados 0 (baixo) e 1 (cima)
   * @param {[Record<string,number>|number, Record<string,number>|number]} [opts.levels] nível por carta ou nível fixo
   * @param {object} [opts.rules] sobrescritas das regras
   * @param {number} [opts.seed]
   */
  constructor({ decks, levels = [1, 1], rules = {}, seed = Date.now() & 0xffffffff, modeId = 'classic' } = {}) {
    if (!decks || decks.length !== 2) throw new Error('São necessários dois baralhos');
    this.rules = getRules(modeId, rules);
    this.rng = createRng(seed);
    this.nextId = 1;
    this.time = 0; // tempo de jogo (após a contagem)
    this.countdown = this.rules.countdown;
    this.phase = this.countdown > 0 ? PHASE.COUNTDOWN : PHASE.PLAYING;
    this.tickCount = 0;
    this.entities = [];
    this.byId = new Map();
    this.towers = [];
    this.projectiles = [];
    this.pendingSpells = [];
    this.zones = [];
    this.events = [];
    this.result = null;
    this.players = [0, 1].map((side) => {
      for (const id of decks[side]) getCard(id); // valida
      if (decks[side].length !== this.rules.deckSize) throw new Error(`Baralho do lado ${side} precisa de ${this.rules.deckSize} cartas`);
      const lv = levels[side];
      return {
        side,
        energy: this.rules.startEnergy,
        deck: new DeckCycle(decks[side], this.rng, this.rules.handSize),
        levelOf: (cardId) => (typeof lv === 'number' ? lv : (lv && lv[cardId]) || 1),
        crowns: 0,
        stats: newStats(),
      };
    });
    for (const side of [0, 1]) {
      for (const t of TOWER_LAYOUT) this.createTower(side, t);
    }
  }

  // ---------------------------------------------------------------- consultas

  get isOver() {
    return this.phase === PHASE.ENDED;
  }

  get timeLeft() {
    if (this.phase === PHASE.OVERTIME) return Math.max(0, this.rules.duration + this.rules.overtime - this.time);
    return Math.max(0, this.rules.duration - this.time);
  }

  get energyMultiplier() {
    if (this.phase === PHASE.OVERTIME) return this.rules.overtimeEnergyMult;
    if (this.time >= this.rules.duration - this.rules.doubleEnergyAt) return this.rules.doubleEnergyMult;
    return 1;
  }

  getEntity(id) {
    const e = this.byId.get(id);
    return e && !e.dead ? e : null;
  }

  towersOf(side) {
    return this.towers.filter((t) => t.side === side);
  }

  kingOf(side) {
    return this.towers.find((t) => t.side === side && t.role === 'king');
  }

  drainEvents() {
    const ev = this.events;
    this.events = [];
    return ev;
  }

  emit(e) {
    this.events.push(e);
  }

  // ---------------------------------------------------------------- criação

  createTower(side, layout) {
    const s = TOWER_STATS[layout.role];
    const t = this.addEntity({
      kind: 'tower', role: layout.role, lane: layout.lane, side, defId: layout.role,
      x: layout.x, y: side === SIDE_PLAYER ? layout.y : mirrorY(layout.y),
      radius: s.radius, mass: 9999, air: false,
      hp: s.hp, maxHp: s.hp, shield: 0, maxShield: 0,
      damage: s.damage, hitSpeed: s.hitSpeed, range: s.range, sight: s.range, speed: 0,
      targets: 'both', projectile: { kind: layout.role === 'king' ? 'cannon' : 'arrow', speed: 14 },
      active: layout.role !== 'king',
    });
    this.towers.push(t);
    return t;
  }

  addEntity(props) {
    const e = {
      id: this.nextId++, dead: false, targetId: null, attackCd: 0, deployT: 0,
      frozenT: 0, rageT: 0, rageMult: 0, hitFlash: 0, attackAnim: 0, facing: props.side === SIDE_PLAYER ? -Math.PI / 2 : Math.PI / 2,
      splash: 0, px: props.x, py: props.y, ...props,
    };
    this.entities.push(e);
    this.byId.set(e.id, e);
    return e;
  }

  spawnUnit(templateId, side, x, y, level = 1, cardId = null, deployTime = DEPLOY_TIME) {
    const u = getUnit(templateId);
    const m = levelMult(level);
    const e = this.addEntity({
      kind: u.building ? 'building' : 'unit', side, defId: templateId, cardId, level,
      x, y, radius: u.radius, mass: u.mass, air: !!u.air, riverJump: !!u.riverJump,
      hp: Math.round(u.hp * m), maxHp: Math.round(u.hp * m),
      shield: Math.round((u.shield || 0) * m), maxShield: Math.round((u.shield || 0) * m),
      damage: Math.round(u.damage * m), hitSpeed: u.hitSpeed, range: u.range,
      sight: Math.max(DEFAULT_SIGHT, u.range + 1), speed: u.speed, targets: u.targets,
      splash: u.splash || 0, projectile: u.projectile || null, ability: u.ability || null,
      deathSpawn: u.deathSpawn || null, deathDamage: u.deathDamage ? { ...u.deathDamage, damage: Math.round(u.deathDamage.damage * m) } : null,
      lifetime: u.lifetime || 0, spawn: u.spawn || null, spawnT: u.spawn ? u.spawn.firstDelay : 0,
      deployT: deployTime, firstStrikeReady: !!(u.ability && u.ability.type === 'firstStrike'),
      rampStage: 0, rampTime: 0, rampTargetId: null,
    });
    constrain(e);
    e.px = e.x;
    e.py = e.y;
    this.emit({ type: 'spawn', id: e.id, defId: templateId, x: e.x, y: e.y, side, air: e.air, kind: e.kind });
    return e;
  }

  // ---------------------------------------------------------------- comandos

  canPlay(side, slot, x, y) {
    if (this.phase !== PHASE.PLAYING && this.phase !== PHASE.OVERTIME) return { ok: false, reason: 'A partida não está em andamento' };
    const p = this.players[side];
    if (!p || !p.deck.has(slot)) return { ok: false, reason: 'Carta inválida' };
    const card = getCard(p.deck.hand[slot]);
    if (p.energy + 1e-9 < card.cost) return { ok: false, reason: 'Éter insuficiente' };
    if (!Number.isFinite(x) || !Number.isFinite(y)) return { ok: false, reason: 'Posição inválida' };
    if (card.type === 'spell') return canCastAt(x, y);
    const u = getUnit(card.unitId);
    return canDeployAt(this, side, x, y, { building: !!u.building, radius: u.radius });
  }

  /** Comando principal de jogo: usa a carta do slot na posição (x, y). */
  playCard(side, slot, x, y) {
    const check = this.canPlay(side, slot, x, y);
    if (!check.ok) return check;
    const p = this.players[side];
    const cardId = p.deck.play(slot);
    const card = getCard(cardId);
    p.energy -= card.cost;
    p.stats.cardsPlayed++;
    p.stats.energySpent += card.cost;
    const level = p.levelOf(cardId);
    if (card.type === 'spell') {
      this.castSpell(side, card, x, y, level);
      p.stats.spellsCast++;
    } else {
      const u = getUnit(card.unitId);
      const n = card.count;
      for (let i = 0; i < n; i++) {
        let ox = 0;
        let oy = 0;
        if (n > 1) {
          const a = (i / n) * Math.PI * 2 + 0.4;
          const r = n <= 2 ? 0.55 : 0.75;
          ox = Math.cos(a) * r;
          oy = Math.sin(a) * r;
        }
        this.spawnUnit(card.unitId, side, clamp(x + ox, 0.4, ARENA_W - 0.4), clamp(y + oy, 0.4, ARENA_H - 0.4), level, cardId);
      }
      if (u.building) p.stats.buildingsPlaced++;
      else p.stats.troopsDeployed++;
      if (u.air) p.stats.airDeployed++;
    }
    this.emit({ type: 'cardPlayed', side, cardId, x, y });
    return { ok: true, cardId };
  }

  castSpell(side, card, x, y, level) {
    const s = card.spell;
    const m = levelMult(level);
    const king = this.kingOf(side);
    this.pendingSpells.push({
      side, cardId: card.id, x, y, level, t: s.delay || 0,
      wavesLeft: s.waves || 1, spell: s, mult: m,
      fromX: king.x, fromY: king.y, total: s.delay || 0,
    });
    this.emit({ type: 'spell', stage: 'cast', cardId: card.id, x, y, radius: s.radius, side, delay: s.delay || 0, fromX: king.x, fromY: king.y });
  }

  // ---------------------------------------------------------------- simulação

  step(dt = TICK) {
    if (this.phase === PHASE.ENDED) return;
    this.tickCount++;
    if (this.phase === PHASE.COUNTDOWN) {
      this.countdown -= dt;
      if (this.countdown <= 0) {
        this.countdown = 0;
        this.phase = PHASE.PLAYING;
        this.emit({ type: 'phase', phase: PHASE.PLAYING });
      }
      return;
    }
    const wasDouble = this.energyMultiplier > 1;
    this.time += dt;
    if (!wasDouble && this.energyMultiplier > 1 && this.phase === PHASE.PLAYING) this.emit({ type: 'doubleEnergy' });

    for (const p of this.players) {
      const before = p.energy;
      p.energy = Math.min(MAX_ENERGY, p.energy + this.rules.energyPerSecond * this.energyMultiplier * dt);
      if (before >= MAX_ENERGY) p.stats.energyWasted += this.rules.energyPerSecond * this.energyMultiplier * dt;
    }

    for (const e of this.entities) {
      e.px = e.x;
      e.py = e.y;
    }

    this.updateSpells(dt);
    this.updateZones(dt);
    for (const e of this.entities) {
      if (e.dead) continue;
      this.updateEntity(e, dt);
    }
    this.updateProjectiles(dt);
    this.resolveCollisions();
    this.resolveDeaths();
    this.checkEnd();
  }

  updateEntity(e, dt) {
    if (e.hitFlash > 0) e.hitFlash = Math.max(0, e.hitFlash - dt);
    if (e.attackAnim > 0) e.attackAnim = Math.max(0, e.attackAnim - dt);
    if (e.rageT > 0) e.rageT = Math.max(0, e.rageT - dt);
    if (e.frozenT > 0) {
      e.frozenT = Math.max(0, e.frozenT - dt);
      return;
    }
    if (e.deployT > 0) {
      e.deployT = Math.max(0, e.deployT - dt);
      return;
    }
    const haste = e.rageT > 0 ? 1 + e.rageMult : 1;
    if (e.kind === 'building') {
      if (e.lifetime > 0) {
        e.hp -= (e.maxHp / e.lifetime) * dt;
        if (e.hp <= 0) {
          e.hp = 0;
          e.dead = true;
          return;
        }
      }
      if (e.spawn) {
        e.spawnT -= dt * haste;
        if (e.spawnT <= 0) {
          e.spawnT += e.spawn.interval;
          this.spawnGroup(e, e.spawn.unitId, e.spawn.count, 0.4);
        }
      }
    }
    if (e.kind === 'tower' && !e.active) return;
    if (e.targets === 'none') return;
    if (e.attackCd > 0) e.attackCd = Math.max(0, e.attackCd - dt * haste);

    let target = this.getEntity(e.targetId);
    const engaged = target && this.canTarget(e, target) && edgeDist(e, target) <= e.range + 0.25;
    if (!engaged) {
      const next = this.acquireTarget(e);
      if (next !== target) {
        if (next && e.attackCd < e.hitSpeed * 0.4) e.attackCd = e.hitSpeed * 0.4; // tempo de "mira" ao trocar de alvo
        target = next;
        e.targetId = next ? next.id : null;
      }
    }
    if (!target) return;

    const d = edgeDist(e, target);
    e.facing = Math.atan2(target.y - e.y, target.x - e.x);
    if (d <= e.range) {
      if (e.attackCd <= 0) {
        this.attack(e, target);
        e.attackCd = e.hitSpeed;
      }
    } else if (e.speed > 0) {
      const wp = waypoint(e, target.x, target.y);
      const dx = wp.x - e.x;
      const dy = wp.y - e.y;
      const len = Math.hypot(dx, dy) || 1;
      const stepLen = Math.min(len, e.speed * haste * dt, Math.max(0.0, d - e.range + 0.05));
      e.x += (dx / len) * stepLen;
      e.y += (dy / len) * stepLen;
      e.facing = Math.atan2(dy, dx);
      e.moving = true;
      return;
    }
    e.moving = false;
  }

  spawnGroup(parent, unitId, count, deployTime) {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + this.rng.next() * 0.5;
      const r = parent.radius * 0.6 + 0.3;
      const dirY = parent.side === SIDE_PLAYER ? -1 : 1;
      this.spawnUnit(unitId, parent.side, parent.x + Math.cos(a) * r, parent.y + Math.sin(a) * r + dirY * 0.3, parent.level || 1, null, deployTime);
    }
  }

  canTarget(e, t) {
    if (!t || t.dead || t.side === e.side) return false;
    switch (e.targets) {
      case 'buildings': return t.kind === 'building' || t.kind === 'tower';
      case 'ground': return !t.air;
      case 'both': return true;
      default: return false;
    }
  }

  acquireTarget(e) {
    let best = null;
    let bestD = Infinity;
    const sight = Math.max(e.sight, e.range);
    for (const t of this.entities) {
      if (!this.canTarget(e, t)) continue;
      const d = edgeDist(e, t);
      if (d <= sight && d < bestD) {
        bestD = d;
        best = t;
      }
    }
    if (best || e.speed <= 0) return best;
    // Sem alvo próximo: avança para a estrutura inimiga mais próxima.
    for (const t of this.entities) {
      if (t.dead || t.side === e.side) continue;
      if (t.kind !== 'tower' && t.kind !== 'building') continue;
      if (!this.canTarget(e, t)) continue;
      // Pesa a distância em Y para que as tropas sigam sua própria lane.
      const d = Math.abs(t.x - e.x) * 1.4 + Math.abs(t.y - e.y);
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
    return best;
  }

  attack(e, target) {
    let dmg = e.damage;
    if (e.firstStrikeReady && e.ability) {
      dmg = Math.round(dmg * e.ability.mult);
      e.firstStrikeReady = false;
    }
    if (e.ability && e.ability.type === 'ramp') {
      if (e.rampTargetId !== target.id) {
        e.rampTargetId = target.id;
        e.rampTime = 0;
        e.rampStage = 0;
      }
      e.rampTime += e.hitSpeed;
      e.rampStage = Math.min(e.ability.stages.length - 1, Math.floor(e.rampTime / e.ability.stageTime));
      dmg = Math.round(dmg * e.ability.stages[e.rampStage]);
    }
    e.attackAnim = Math.min(0.35, e.hitSpeed * 0.6);
    const melee = !e.projectile && !(e.ability && e.ability.type === 'ramp');
    this.emit({ type: 'attack', id: e.id, defId: e.defId, side: e.side, x: e.x, y: e.y, tx: target.x, ty: target.y, melee, beam: !!(e.ability && e.ability.type === 'ramp'), stage: e.rampStage || 0, targetId: target.id });
    if (e.projectile) {
      this.projectiles.push({
        id: this.nextId++, side: e.side, ownerDef: e.defId, kind: e.projectile.kind, arc: !!e.projectile.arc,
        x: e.x, y: e.y, sx: e.x, sy: e.y, px: e.x, py: e.y, targetId: target.id, tx: target.x, ty: target.y,
        speed: e.projectile.speed, damage: dmg, splash: e.splash, targets: e.targets, air: e.air,
        traveled: 0, total: Math.max(0.1, dist(e.x, e.y, target.x, target.y)),
      });
    } else if (e.splash > 0) {
      this.areaDamage(e.side, target.x, target.y, e.splash, dmg, { targets: e.targets });
    } else {
      this.applyDamage(target, dmg, e.side);
    }
  }

  updateProjectiles(dt) {
    const keep = [];
    for (const p of this.projectiles) {
      p.px = p.x;
      p.py = p.y;
      const t = this.getEntity(p.targetId);
      if (t) {
        p.tx = t.x;
        p.ty = t.y;
      }
      const dx = p.tx - p.x;
      const dy = p.ty - p.y;
      const len = Math.hypot(dx, dy);
      const stepLen = p.speed * dt;
      if (len <= stepLen + 0.05) {
        p.x = p.tx;
        p.y = p.ty;
        if (p.splash > 0) {
          this.areaDamage(p.side, p.tx, p.ty, p.splash, p.damage, { targets: p.targets });
          this.emit({ type: 'impact', kind: p.kind, x: p.tx, y: p.ty, radius: p.splash, side: p.side });
        } else if (t) {
          this.applyDamage(t, p.damage, p.side);
          this.emit({ type: 'impact', kind: p.kind, x: p.tx, y: p.ty, radius: 0, side: p.side });
        }
        continue; // alvo morto antes do impacto: projétil some sem causar dano
      }
      p.x += (dx / len) * stepLen;
      p.y += (dy / len) * stepLen;
      p.traveled += stepLen;
      keep.push(p);
    }
    this.projectiles = keep;
  }

  updateSpells(dt) {
    const keep = [];
    for (const s of this.pendingSpells) {
      s.t -= dt;
      if (s.t > 0) {
        keep.push(s);
        continue;
      }
      this.resolveSpell(s);
      s.wavesLeft--;
      if (s.wavesLeft > 0) {
        s.t += s.spell.waveInterval || 0.3;
        keep.push(s);
      }
    }
    this.pendingSpells = keep;
  }

  resolveSpell(s) {
    const sp = s.spell;
    this.emit({ type: 'spell', stage: 'impact', cardId: s.cardId, x: s.x, y: s.y, radius: sp.radius, side: s.side });
    if (sp.friendly) {
      this.zones.push({
        side: s.side, cardId: s.cardId, x: s.x, y: s.y, radius: sp.radius, remaining: sp.duration, duration: sp.duration,
        heal: sp.heal ? sp.heal * s.mult : 0, rage: sp.rage || 0,
      });
      return;
    }
    const dmg = Math.round(((sp.damage || 0) / (sp.waves || 1)) * s.mult);
    for (const e of this.entities) {
      if (e.dead || e.side === s.side) continue;
      if (dist(e.x, e.y, s.x, s.y) > sp.radius + e.radius) continue;
      if (dmg > 0) {
        const factor = e.kind === 'tower' ? (sp.towerFactor ?? CROWN_TOWER_SPELL_FACTOR) : 1;
        this.applyDamage(e, Math.round(dmg * factor), s.side, true);
      }
      if (sp.freeze) e.frozenT = Math.max(e.frozenT, sp.freeze);
      if (sp.knockback && e.kind === 'unit' && e.mass < 15) {
        const dx = e.x - s.x;
        const dy = e.y - s.y;
        const len = Math.hypot(dx, dy) || 1;
        e.x += (dx / len) * sp.knockback;
        e.y += (dy / len) * sp.knockback;
        constrain(e);
      }
    }
  }

  updateZones(dt) {
    const keep = [];
    for (const z of this.zones) {
      z.remaining -= dt;
      for (const e of this.entities) {
        if (e.dead || e.side !== z.side || e.kind === 'tower') continue;
        if (dist(e.x, e.y, z.x, z.y) > z.radius + e.radius) continue;
        if (z.heal) e.hp = Math.min(e.maxHp, e.hp + z.heal * dt);
        if (z.rage) {
          e.rageT = Math.max(e.rageT, 1.0);
          e.rageMult = z.rage;
        }
      }
      if (z.remaining > 0) keep.push(z);
    }
    this.zones = keep;
  }

  areaDamage(side, x, y, radius, dmg, { targets = 'both' } = {}) {
    for (const e of this.entities) {
      if (e.dead || e.side === side) continue;
      if (targets === 'ground' && e.air) continue;
      if (targets === 'buildings' && e.kind === 'unit') continue;
      if (dist(e.x, e.y, x, y) > radius + e.radius) continue;
      this.applyDamage(e, dmg, side);
    }
  }

  /** Único ponto do jogo que reduz vida. */
  applyDamage(target, amount, sourceSide, isSpell = false) {
    if (!target || target.dead || amount <= 0 || this.phase === PHASE.ENDED) return 0;
    let remaining = amount;
    if (target.shield > 0) {
      const absorbed = Math.min(target.shield, remaining);
      target.shield -= absorbed;
      remaining -= absorbed;
      if (target.shield <= 0) this.emit({ type: 'shieldBreak', id: target.id, x: target.x, y: target.y });
    }
    const dealt = Math.min(target.hp, remaining);
    target.hp -= remaining;
    target.hitFlash = 0.12;
    const src = this.players[sourceSide];
    if (src) {
      src.stats.damageDealt += dealt;
      if (target.kind === 'tower') src.stats.towerDamage += dealt;
    }
    if (target.kind === 'tower' && target.role === 'king' && !target.active) this.activateKing(target);
    this.emit({ type: 'hit', id: target.id, x: target.x, y: target.y, amount: Math.round(amount), side: target.side, kind: target.kind, spell: isSpell });
    if (target.hp <= 0) {
      target.hp = 0;
      target.dead = true;
    }
    return dealt;
  }

  activateKing(king) {
    if (king.active || king.dead) return;
    king.active = true;
    this.emit({ type: 'kingActivated', side: king.side, x: king.x, y: king.y });
  }

  resolveCollisions() {
    const list = this.entities;
    const n = list.length;
    for (let i = 0; i < n; i++) {
      const a = list[i];
      if (a.dead) continue;
      for (let j = i + 1; j < n; j++) {
        const b = list[j];
        if (b.dead) continue;
        const aStatic = a.kind !== 'unit';
        const bStatic = b.kind !== 'unit';
        if (aStatic && bStatic) continue;
        if (a.air !== b.air) continue; // camadas diferentes (céu x solo)
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const minD = a.radius + b.radius;
        const d2 = dx * dx + dy * dy;
        if (d2 >= minD * minD) continue;
        const d = Math.sqrt(d2) || 0.0001;
        const overlap = minD - d;
        const nx = d2 === 0 ? (a.id < b.id ? 1 : -1) : dx / d;
        const ny = d2 === 0 ? 0 : dy / d;
        if (aStatic || bStatic) {
          const mover = aStatic ? b : a;
          const sgn = aStatic ? 1 : -1;
          mover.x += nx * overlap * sgn;
          mover.y += ny * overlap * sgn;
          // Deslize tangencial para contornar estruturas em vez de travar.
          const tx = -ny;
          const ty = nx;
          const side = mover.x < ARENA_W / 2 ? -1 : 1;
          const slide = Math.min(0.06, overlap) * (tx * side >= 0 ? 1 : -1);
          mover.x += tx * slide;
          mover.y += ty * slide;
        } else {
          const total = a.mass + b.mass;
          const wa = b.mass / total;
          const wb = a.mass / total;
          const push = overlap * 0.6;
          a.x -= nx * push * wa;
          a.y -= ny * push * wa;
          b.x += nx * push * wb;
          b.y += ny * push * wb;
        }
      }
    }
    for (const e of list) if (e.kind === 'unit' && !e.dead) constrain(e);
  }

  resolveDeaths() {
    for (let guard = 0; guard < 6; guard++) {
      const dead = this.entities.filter((e) => e.dead && !e.removed);
      if (!dead.length) break;
      for (const e of dead) {
        e.removed = true;
        this.byId.delete(e.id);
        const killer = this.players[1 - e.side];
        this.emit({ type: 'death', id: e.id, defId: e.defId, kind: e.kind, role: e.role, x: e.x, y: e.y, side: e.side, air: e.air, radius: e.radius });
        if (e.kind === 'unit') killer.stats.unitsKilled++;
        if (e.kind === 'tower') {
          killer.stats.towersDestroyed++;
          if (e.role === 'king') killer.crowns = 3;
          else {
            killer.crowns = Math.min(3, killer.crowns + 1);
            this.activateKing(this.kingOf(e.side));
          }
          this.emit({ type: 'towerDestroyed', side: e.side, role: e.role, x: e.x, y: e.y });
        }
        if (e.deathDamage) this.areaDamage(e.side, e.x, e.y, e.deathDamage.radius, e.deathDamage.damage);
        if (e.deathSpawn) this.spawnGroup(e, e.deathSpawn.unitId, e.deathSpawn.count, 0.5);
      }
      this.entities = this.entities.filter((e) => !e.removed);
    }
  }

  checkEnd() {
    const k0 = this.kingOf(0);
    const k1 = this.kingOf(1);
    if (k0.dead || k1.dead) {
      if (k0.dead && k1.dead) return this.finish(null, 'Destruição simultânea das torres do rei');
      return this.finish(k1.dead ? 0 : 1, 'Torre do rei destruída');
    }
    const [c0, c1] = [this.players[0].crowns, this.players[1].crowns];
    if (this.phase === PHASE.PLAYING && this.time >= this.rules.duration) {
      if (c0 !== c1) return this.finish(c0 > c1 ? 0 : 1, 'Mais coroas ao fim do tempo');
      if (this.rules.overtime > 0) {
        this.phase = PHASE.OVERTIME;
        this.emit({ type: 'phase', phase: PHASE.OVERTIME });
        return;
      }
      return this.tiebreak();
    }
    if (this.phase === PHASE.OVERTIME) {
      if (c0 !== c1) return this.finish(c0 > c1 ? 0 : 1, 'Morte súbita na prorrogação');
      if (this.time >= this.rules.duration + this.rules.overtime) return this.tiebreak();
    }
  }

  /** Desempate: vence quem preservou a maior fração de vida somada das torres. */
  tiebreak() {
    const frac = (side) => {
      let hp = 0;
      let max = 0;
      for (const t of this.towersOf(side)) {
        hp += Math.max(0, t.hp);
        max += t.maxHp;
      }
      return hp / max;
    };
    const f0 = frac(0);
    const f1 = frac(1);
    if (Math.abs(f0 - f1) < 1e-6) return this.finish(null, 'Empate: torres com a mesma vida');
    return this.finish(f0 > f1 ? 0 : 1, 'Desempate pela vida das torres');
  }

  finish(winner, reason) {
    if (this.phase === PHASE.ENDED) return;
    this.phase = PHASE.ENDED;
    this.projectiles = [];
    this.pendingSpells = [];
    this.zones = [];
    for (const e of this.entities) {
      e.targetId = null;
      e.moving = false;
    }
    this.result = {
      winner, reason, time: this.time,
      crowns: [this.players[0].crowns, this.players[1].crowns],
      stats: [this.players[0].stats, this.players[1].stats],
    };
    this.emit({ type: 'end', result: this.result });
  }
}

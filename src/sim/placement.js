// Regras de posicionamento de cartas. Usadas pela partida (validação autoritativa), pela UI e pela IA.
import {
  ARENA_W, ARENA_H, RIVER_TOP, RIVER_BOTTOM, POCKET_LIMIT_Y, SIDE_PLAYER, localY,
} from '../core/constants.js';
import { dist } from '../core/math.js';

const MARGIN = 0.5;

export function inArena(x, y) {
  return x >= MARGIN && x <= ARENA_W - MARGIN && y >= MARGIN && y <= ARENA_H - MARGIN;
}

export function inRiverBand(y) {
  return y > RIVER_TOP && y < RIVER_BOTTOM;
}

/** Lane (0 = esquerda, 1 = direita) a partir do X. */
export function laneOf(x) {
  return x < ARENA_W / 2 ? 0 : 1;
}

/**
 * Verifica se o lado pode posicionar uma tropa/construção em (x, y).
 * @param {object} match instância de Match (lê torres e construções)
 */
export function canDeployAt(match, side, x, y, { building = false, radius = 0.5 } = {}) {
  if (!inArena(x, y)) return { ok: false, reason: 'Fora da arena' };
  const ly = localY(side, y);
  if (ly > RIVER_TOP - 0.5 && ly < RIVER_BOTTOM + 0.5) {
    return { ok: false, reason: 'Não é possível invocar no rio' };
  }
  let allowed = ly >= RIVER_BOTTOM + 0.5;
  if (!allowed && ly >= POCKET_LIMIT_Y && ly <= RIVER_TOP - 0.5) {
    const lane = laneOf(x);
    const enemyTower = match.towers.find((t) => t.side !== side && t.role === 'princess' && t.lane === lane);
    if (!enemyTower || enemyTower.dead) allowed = true;
  }
  if (!allowed) return { ok: false, reason: 'Só é possível invocar no seu lado da arena' };
  for (const t of match.towers) {
    if (t.dead) continue;
    if (dist(x, y, t.x, t.y) < t.radius + 0.35) return { ok: false, reason: 'Sobre uma torre' };
  }
  if (building) {
    for (const e of match.entities) {
      if (e.kind !== 'building' || e.dead) continue;
      if (dist(x, y, e.x, e.y) < e.radius + radius) return { ok: false, reason: 'Sobre outra construção' };
    }
  }
  return { ok: true };
}

export function canCastAt(x, y) {
  if (!inArena(x, y)) return { ok: false, reason: 'Fora da arena' };
  return { ok: true };
}

/** Retângulos (em coordenadas do mundo) onde o lado pode posicionar tropas — usado para desenhar a zona. */
export function deployZones(match, side) {
  const zones = [];
  const own = side === SIDE_PLAYER
    ? { x0: MARGIN, y0: RIVER_BOTTOM + 0.5, x1: ARENA_W - MARGIN, y1: ARENA_H - MARGIN }
    : { x0: MARGIN, y0: MARGIN, x1: ARENA_W - MARGIN, y1: RIVER_TOP - 0.5 };
  zones.push(own);
  for (const lane of [0, 1]) {
    const enemyTower = match.towers.find((t) => t.side !== side && t.role === 'princess' && t.lane === lane);
    if (enemyTower && !enemyTower.dead) continue;
    const x0 = lane === 0 ? MARGIN : ARENA_W / 2;
    const x1 = lane === 0 ? ARENA_W / 2 : ARENA_W - MARGIN;
    if (side === SIDE_PLAYER) zones.push({ x0, y0: POCKET_LIMIT_Y, x1, y1: RIVER_TOP - 0.5 });
    else zones.push({ x0, y0: ARENA_H - (RIVER_TOP - 0.5), x1, y1: ARENA_H - POCKET_LIMIT_Y });
  }
  return zones;
}

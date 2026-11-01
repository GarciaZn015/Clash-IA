// Navegação terrestre: tropas atravessam o rio apenas pelas pontes (exceto as que saltam o rio).
import { BRIDGES, RIVER_TOP, RIVER_BOTTOM, ARENA_W, ARENA_H } from '../core/constants.js';
import { clamp } from '../core/math.js';

const bankSide = (y) => (y < RIVER_TOP ? -1 : y > RIVER_BOTTOM ? 1 : 0);

export function bridgeAt(x) {
  for (const b of BRIDGES) if (Math.abs(x - b.x) <= b.half) return b;
  return null;
}

function bestBridge(ux, tx) {
  let best = BRIDGES[0];
  let bestCost = Infinity;
  for (const b of BRIDGES) {
    const cost = Math.abs(ux - b.x) + Math.abs(tx - b.x);
    if (cost < bestCost) {
      bestCost = cost;
      best = b;
    }
  }
  return best;
}

/** Faixa X utilizável da ponte para uma unidade de raio r (o corpo inteiro fica sobre as tábuas). */
function laneOnBridge(b, r) {
  const inner = Math.max(0.1, b.half - r * 0.6);
  return [b.x - inner, b.x + inner];
}

/** Retorna o próximo ponto de passagem para uma unidade chegar a (tx, ty). Terrestres só cruzam pelas pontes. */
export function waypoint(unit, tx, ty) {
  if (unit.air) return { x: tx, y: ty };
  const r = unit.radius || 0.5;
  const us = bankSide(unit.y);
  const ts = bankSide(ty);
  if (us === 0) {
    // Sobre a ponte: siga reto até a margem do alvo.
    if (ts === 0) return { x: tx, y: ty };
    const b = bridgeAt(unit.x) || bestBridge(unit.x, tx);
    const [x0, x1] = laneOnBridge(b, r);
    const exitY = ts < 0 ? RIVER_TOP - 0.6 - r * 0.4 : RIVER_BOTTOM + 0.6 + r * 0.4;
    return { x: clamp(unit.x, x0, x1), y: exitY };
  }
  if (ts === 0 || us === ts) return { x: tx, y: ty };
  const b = bestBridge(unit.x, tx);
  const [x0, x1] = laneOnBridge(b, r);
  const bankY = us > 0 ? RIVER_BOTTOM : RIVER_TOP;
  if (unit.x >= x0 - 0.05 && unit.x <= x1 + 0.05 && Math.abs(unit.y - bankY) < 1.4) {
    // Alinhado com a ponte: atravesse em linha reta.
    return { x: clamp(unit.x, x0, x1), y: us > 0 ? RIVER_TOP - 0.6 : RIVER_BOTTOM + 0.6 };
  }
  // Primeiro vá até a cabeceira da ponte do seu lado.
  return { x: b.x, y: bankY + us * 0.9 };
}

/**
 * Corrige posições inválidas: fora da arena, ou com o corpo sobre a água fora de uma ponte.
 * Tropas terrestres nunca ficam no rio — se forem empurradas para lá, voltam à margem ou deslizam para dentro da ponte.
 */
export function constrain(unit) {
  const r = unit.radius;
  unit.x = clamp(unit.x, r * 0.5, ARENA_W - r * 0.5);
  unit.y = clamp(unit.y, r * 0.5, ARENA_H - r * 0.5);
  if (unit.air) return;
  const top = RIVER_TOP - r * 0.4;
  const bot = RIVER_BOTTOM + r * 0.4;
  if (unit.y <= top || unit.y >= bot) return;
  let near = null;
  for (const b of BRIDGES) if (Math.abs(unit.x - b.x) <= b.half + r * 0.3) near = b;
  if (near) {
    const [x0, x1] = laneOnBridge(near, r);
    unit.x = clamp(unit.x, x0, x1);
    return;
  }
  unit.y = unit.py <= (RIVER_TOP + RIVER_BOTTOM) / 2 ? top : bot;
}

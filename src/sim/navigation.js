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

/** Retorna o próximo ponto de passagem para uma unidade chegar a (tx, ty). */
export function waypoint(unit, tx, ty) {
  if (unit.air || unit.riverJump) return { x: tx, y: ty };
  const us = bankSide(unit.y);
  const ts = bankSide(ty);
  if (us === 0) {
    // Sobre a ponte: siga em frente para a margem do alvo.
    if (ts === 0) return { x: tx, y: ty };
    const b = bridgeAt(unit.x) || bestBridge(unit.x, tx);
    const exitY = ts < 0 ? RIVER_TOP - 0.4 : RIVER_BOTTOM + 0.4;
    return { x: clamp(unit.x, b.x - b.half + 0.3, b.x + b.half - 0.3), y: exitY };
  }
  if (ts === 0 || us === ts) return { x: tx, y: ty };
  const b = bestBridge(unit.x, tx);
  const bankY = us > 0 ? RIVER_BOTTOM : RIVER_TOP;
  if (Math.abs(unit.x - b.x) <= b.half - 0.3 && Math.abs(unit.y - bankY) < 1.2) {
    // Alinhado com a ponte: atravesse.
    return { x: unit.x, y: us > 0 ? RIVER_TOP - 0.4 : RIVER_BOTTOM + 0.4 };
  }
  return { x: b.x, y: bankY + us * 0.7 };
}

/** Corrige posições inválidas (dentro do rio fora das pontes ou fora da arena). */
export function constrain(unit) {
  const r = unit.radius;
  unit.x = clamp(unit.x, r * 0.5, ARENA_W - r * 0.5);
  unit.y = clamp(unit.y, r * 0.5, ARENA_H - r * 0.5);
  if (unit.air || unit.riverJump) return;
  if (unit.y > RIVER_TOP && unit.y < RIVER_BOTTOM) {
    const wasOnBridge = unit.py > RIVER_TOP && unit.py < RIVER_BOTTOM && bridgeAt(unit.px);
    const b = bridgeAt(unit.x);
    if (b) return;
    if (wasOnBridge) {
      unit.x = clamp(unit.x, wasOnBridge.x - wasOnBridge.half + 0.05, wasOnBridge.x + wasOnBridge.half - 0.05);
    } else {
      unit.y = unit.py <= (RIVER_TOP + RIVER_BOTTOM) / 2 ? RIVER_TOP : RIVER_BOTTOM;
    }
  }
}

// Regras e dimensões centrais da partida. Todo o resto do jogo lê daqui.

export const ARENA_W = 18;
export const ARENA_H = 32;

/** Faixa do rio (em tiles, eixo Y). */
export const RIVER_TOP = 15;
export const RIVER_BOTTOM = 17;
export const RIVER_MID = 16;

/** Pontes: centro X e meia-largura. */
export const BRIDGES = [
  { x: 3.5, half: 1.1 },
  { x: 14.5, half: 1.1 },
];

export const TICK_RATE = 30;
export const TICK = 1 / TICK_RATE;

export const SIDE_PLAYER = 0;
export const SIDE_ENEMY = 1;

export const MAX_ENERGY = 10;

/** Regras padrão; modos de jogo podem sobrescrever (ver src/data/modes.js). */
export const DEFAULT_RULES = Object.freeze({
  countdown: 3,
  duration: 180, // tempo regulamentar (s)
  overtime: 60, // prorrogação com morte súbita (s)
  doubleEnergyAt: 60, // últimos N segundos do tempo regulamentar com regeneração dobrada
  startEnergy: 5,
  energyPerSecond: 1 / 2.8,
  overtimeEnergyMult: 2,
  doubleEnergyMult: 2,
  handSize: 4,
  deckSize: 8,
});

export const TOWER_STATS = Object.freeze({
  princess: { hp: 1400, damage: 50, hitSpeed: 0.8, range: 7.5, radius: 1.5 },
  king: { hp: 2400, damage: 55, hitSpeed: 1.0, range: 7.0, radius: 2.0 },
});

/** Posições das torres do jogador de baixo (lado 0). O lado 1 é espelhado no eixo Y. */
export const TOWER_LAYOUT = [
  { role: 'princess', lane: 0, x: 3.5, y: 25.5 },
  { role: 'princess', lane: 1, x: 14.5, y: 25.5 },
  { role: 'king', lane: -1, x: 9, y: 29 },
];

/** Linha Y de "bolso" liberada quando uma torre auxiliar inimiga cai (perspectiva do lado 0). */
export const POCKET_LIMIT_Y = 10;

export const DEFAULT_SIGHT = 5.5;
export const DEPLOY_TIME = 1.0;
export const CROWN_TOWER_SPELL_FACTOR = 0.35;

export function mirrorY(y) {
  return ARENA_H - y;
}

/** Converte Y do mundo para a perspectiva do lado (0 = baixo). */
export function localY(side, y) {
  return side === SIDE_PLAYER ? y : ARENA_H - y;
}

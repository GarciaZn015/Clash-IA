// Registro de modos e arenas. Novos modos (desafios, eventos) entram aqui sobrescrevendo regras.
import { DEFAULT_RULES } from '../core/constants.js';

export const MODES = {
  classic: {
    id: 'classic',
    name: 'Batalha contra a IA',
    description: '3 minutos, prorrogação com morte súbita.',
    rules: { ...DEFAULT_RULES },
  },
};

export function getRules(modeId = 'classic', overrides = {}) {
  const mode = MODES[modeId] || MODES.classic;
  return Object.freeze({ ...mode.rules, ...overrides });
}

/** Arenas temáticas: só alteram a paleta e decoração; o layout de regras é o mesmo. */
export const ARENAS = [
  {
    id: 'vale', name: 'Vale do Éter', unlockLevel: 1,
    palette: { grassA: '#5f9d48', grassB: '#57923f', path: '#c9b07a', river: '#3f8fd0', riverDeep: '#2c6fae', bridge: '#8a5a33', border: '#3a5e2a', decor: '#2f6b2a' },
  },
  {
    id: 'glacial', name: 'Fortaleza Glacial', unlockLevel: 4,
    palette: { grassA: '#c9dbe6', grassB: '#bccfdc', path: '#9fb3c4', river: '#5fb7e0', riverDeep: '#3d8fbd', bridge: '#6b7d8f', border: '#7d95a8', decor: '#e8f3fa' },
  },
  {
    id: 'brasa', name: 'Cratera de Brasa', unlockLevel: 7,
    palette: { grassA: '#6b4a3a', grassB: '#634334', path: '#a07a55', river: '#e06a2a', riverDeep: '#b8461a', bridge: '#3a3030', border: '#3d2a22', decor: '#2a1d18' },
  },
];

export function arenaForLevel(level) {
  let best = ARENAS[0];
  for (const a of ARENAS) if (level >= a.unlockLevel) best = a;
  return best;
}

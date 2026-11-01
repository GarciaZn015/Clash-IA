// Perfil do jogador: nível, experiência, moedas, coleção, baralhos e configurações.
// Funções puras/mutadoras simples, sem DOM — testáveis em Node.
import { CARDS, CARD_MAP, MAX_CARD_LEVEL } from '../data/cards.js';
import { STARTER_DECK } from '../data/decks.js';

export const PROFILE_VERSION = 1;
export const DECK_SLOTS = 3;
export const MAX_CHESTS = 4;
export const HISTORY_LIMIT = 20;

export const UPGRADE_COPIES = {
  comum: [2, 4, 8, 15, 30, 50, 80, 120],
  rara: [1, 2, 4, 8, 15, 25, 40, 60],
  epica: [1, 1, 2, 4, 6, 10, 15, 20],
  lendaria: [1, 1, 1, 2, 3, 4, 6, 8],
};
export const UPGRADE_COINS = [20, 50, 120, 250, 500, 900, 1500, 2500];

export function defaultSettings() {
  return { music: 0.45, sfx: 0.8, muted: false, damageNumbers: true, reducedEffects: false, difficulty: 'normal' };
}

export function createProfile() {
  const cards = {};
  for (const c of CARDS) if (c.unlockLevel <= 1) cards[c.id] = { level: 1, copies: 0 };
  return {
    version: PROFILE_VERSION,
    name: 'Comandante',
    level: 1,
    xp: 0,
    coins: 150,
    trophies: 0,
    cards,
    decks: [STARTER_DECK.slice(), STARTER_DECK.slice(), STARTER_DECK.slice()],
    activeDeck: 0,
    chests: [],
    history: [],
    stats: { matches: 0, wins: 0, losses: 0, draws: 0, threeCrowns: 0, towersDestroyed: 0, cardsPlayed: 0, hardWins: 0, chestsOpened: 0, upgrades: 0 },
    missions: { day: '', list: [] },
    achievements: {},
    shop: { day: '', bought: [], freeClaimed: false },
    settings: defaultSettings(),
    tutorialDone: false,
    createdAt: 0,
  };
}

/** XP necessária para passar do nível `level` para o próximo. */
export function xpToNext(level) {
  return 60 + 45 * (level - 1);
}

export const MAX_PLAYER_LEVEL = 30;

/** Adiciona XP e processa subidas de nível. Retorna lista de eventos de nível. */
export function addXp(profile, amount) {
  const ups = [];
  profile.xp += Math.max(0, Math.round(amount));
  while (profile.level < MAX_PLAYER_LEVEL && profile.xp >= xpToNext(profile.level)) {
    profile.xp -= xpToNext(profile.level);
    profile.level++;
    const coins = 40 + profile.level * 20;
    profile.coins += coins;
    const unlocked = unlockCardsForLevel(profile);
    ups.push({ level: profile.level, coins, unlocked });
  }
  if (profile.level >= MAX_PLAYER_LEVEL) profile.xp = Math.min(profile.xp, xpToNext(profile.level));
  return ups;
}

export function unlockCardsForLevel(profile) {
  const unlocked = [];
  for (const c of CARDS) {
    if (c.unlockLevel <= profile.level && !profile.cards[c.id]) {
      profile.cards[c.id] = { level: 1, copies: 0 };
      unlocked.push(c.id);
    }
  }
  return unlocked;
}

export function isUnlocked(profile, cardId) {
  return !!profile.cards[cardId];
}

export function cardLevel(profile, cardId) {
  return profile.cards[cardId] ? profile.cards[cardId].level : 1;
}

export function upgradeCost(profile, cardId) {
  const card = CARD_MAP[cardId];
  const entry = profile.cards[cardId];
  if (!card || !entry || entry.level >= MAX_CARD_LEVEL) return null;
  const i = entry.level - 1;
  return { copies: UPGRADE_COPIES[card.rarity][i], coins: UPGRADE_COINS[i] };
}

export function canUpgrade(profile, cardId) {
  const cost = upgradeCost(profile, cardId);
  if (!cost) return { ok: false, reason: 'Nível máximo' };
  const entry = profile.cards[cardId];
  if (entry.copies < cost.copies) return { ok: false, reason: `Faltam ${cost.copies - entry.copies} cópias` };
  if (profile.coins < cost.coins) return { ok: false, reason: `Faltam ${cost.coins - profile.coins} moedas` };
  return { ok: true, cost };
}

export function upgradeCard(profile, cardId) {
  const check = canUpgrade(profile, cardId);
  if (!check.ok) return check;
  const entry = profile.cards[cardId];
  entry.copies -= check.cost.copies;
  profile.coins -= check.cost.coins;
  entry.level++;
  profile.stats.upgrades++;
  const levelUps = addXp(profile, 6 * entry.level);
  return { ok: true, level: entry.level, levelUps };
}

export function activeDeck(profile) {
  return profile.decks[profile.activeDeck];
}

export function validateDeck(profile, deck) {
  if (!Array.isArray(deck) || deck.length !== 8) return { ok: false, reason: 'O baralho precisa de 8 cartas' };
  if (new Set(deck).size !== 8) return { ok: false, reason: 'Cartas repetidas no baralho' };
  for (const id of deck) {
    if (!CARD_MAP[id]) return { ok: false, reason: `Carta inexistente: ${id}` };
    if (!isUnlocked(profile, id)) return { ok: false, reason: `${CARD_MAP[id].name} ainda está bloqueada` };
  }
  return { ok: true };
}

/** Troca a carta da posição `index` do baralho ativo; se a nova carta já estiver no baralho, as duas trocam de lugar. */
export function setDeckCard(profile, index, cardId) {
  const deck = activeDeck(profile).slice();
  if (index < 0 || index >= 8) return { ok: false, reason: 'Posição inválida' };
  if (!isUnlocked(profile, cardId)) return { ok: false, reason: 'Carta bloqueada' };
  const existing = deck.indexOf(cardId);
  if (existing >= 0) [deck[existing], deck[index]] = [deck[index], deck[existing]];
  else deck[index] = cardId;
  const v = validateDeck(profile, deck);
  if (!v.ok) return v;
  profile.decks[profile.activeDeck] = deck;
  return { ok: true };
}

export function averageDeckLevel(profile, deck = activeDeck(profile)) {
  return deck.reduce((s, id) => s + cardLevel(profile, id), 0) / deck.length;
}

export function levelsMap(profile) {
  const m = {};
  for (const id of Object.keys(profile.cards)) m[id] = profile.cards[id].level;
  return m;
}

const num = (v, def, min = -Infinity, max = Infinity) => (Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : def);

/** Recebe qualquer coisa carregada do armazenamento e devolve um perfil válido. */
export function sanitizeProfile(raw) {
  const base = createProfile();
  if (!raw || typeof raw !== 'object') return base;
  const p = base;
  p.name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 20) : base.name;
  p.level = Math.floor(num(raw.level, 1, 1, MAX_PLAYER_LEVEL));
  p.xp = Math.floor(num(raw.xp, 0, 0, 1e7));
  p.coins = Math.floor(num(raw.coins, base.coins, 0, 1e9));
  p.trophies = Math.floor(num(raw.trophies, 0, 0, 1e6));
  if (raw.cards && typeof raw.cards === 'object') {
    for (const [id, v] of Object.entries(raw.cards)) {
      if (!CARD_MAP[id] || !v || typeof v !== 'object') continue;
      p.cards[id] = { level: Math.floor(num(v.level, 1, 1, MAX_CARD_LEVEL)), copies: Math.floor(num(v.copies, 0, 0, 1e6)) };
    }
  }
  unlockCardsForLevel(p);
  if (Array.isArray(raw.decks)) {
    for (let i = 0; i < DECK_SLOTS; i++) {
      const d = raw.decks[i];
      if (validateDeck(p, d).ok) p.decks[i] = d.slice();
    }
  }
  p.activeDeck = Math.floor(num(raw.activeDeck, 0, 0, DECK_SLOTS - 1));
  if (Array.isArray(raw.chests)) {
    p.chests = raw.chests
      .filter((c) => c && typeof c.type === 'string' && typeof c.id === 'string')
      .slice(0, MAX_CHESTS)
      .map((c) => ({ id: c.id, type: c.type, unlockAt: Number.isFinite(c.unlockAt) ? c.unlockAt : null }));
  }
  if (Array.isArray(raw.history)) p.history = raw.history.filter((h) => h && typeof h.result === 'string').slice(0, HISTORY_LIMIT);
  if (raw.stats && typeof raw.stats === 'object') {
    for (const k of Object.keys(p.stats)) p.stats[k] = Math.floor(num(raw.stats[k], 0, 0, 1e9));
  }
  if (raw.missions && typeof raw.missions.day === 'string' && Array.isArray(raw.missions.list)) {
    p.missions = {
      day: raw.missions.day,
      list: raw.missions.list.filter((m) => m && typeof m.id === 'string').map((m) => ({ id: m.id, progress: num(m.progress, 0, 0, 1e9), claimed: !!m.claimed })),
    };
  }
  if (raw.achievements && typeof raw.achievements === 'object') {
    for (const [k, v] of Object.entries(raw.achievements)) if (v === true) p.achievements[k] = true;
  }
  if (raw.shop && typeof raw.shop.day === 'string') {
    p.shop = { day: raw.shop.day, bought: Array.isArray(raw.shop.bought) ? raw.shop.bought.filter((b) => typeof b === 'string') : [], freeClaimed: !!raw.shop.freeClaimed };
  }
  if (raw.settings && typeof raw.settings === 'object') {
    const s = raw.settings;
    p.settings.music = num(s.music, p.settings.music, 0, 1);
    p.settings.sfx = num(s.sfx, p.settings.sfx, 0, 1);
    p.settings.muted = !!s.muted;
    p.settings.damageNumbers = s.damageNumbers !== false;
    p.settings.reducedEffects = !!s.reducedEffects;
    if (['easy', 'normal', 'hard'].includes(s.difficulty)) p.settings.difficulty = s.difficulty;
  }
  p.tutorialDone = !!raw.tutorialDone;
  p.createdAt = num(raw.createdAt, 0);
  return p;
}

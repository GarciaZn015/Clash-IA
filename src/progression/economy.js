// Baús, loja diária e distribuição de cartas.
import { CARDS, CARD_MAP } from '../data/cards.js';
import { createRng, hashString } from '../core/rng.js';
import { MAX_CHESTS, addXp } from './profile.js';

export const CHEST_TYPES = {
  madeira: { name: 'Baú de Madeira', unlockSec: 15, coins: [20, 40], cards: 4, color: '#a4703f', minRarity: null },
  prata: { name: 'Baú de Prata', unlockSec: 60, coins: [50, 90], cards: 8, color: '#c7d3de', minRarity: null },
  ouro: { name: 'Baú de Ouro', unlockSec: 180, coins: [120, 200], cards: 16, color: '#f2c14e', minRarity: 'rara' },
  magico: { name: 'Baú Mágico', unlockSec: 300, coins: [250, 400], cards: 26, color: '#b46cf0', minRarity: 'epica' },
};

const RARITY_WEIGHT = { comum: 70, rara: 22, epica: 7, lendaria: 1.2 };
const RARITY_ORDER = ['comum', 'rara', 'epica', 'lendaria'];

export function rollChestType(rng) {
  const r = rng.next();
  if (r < 0.03) return 'magico';
  if (r < 0.15) return 'ouro';
  if (r < 0.45) return 'prata';
  return 'madeira';
}

export function addChest(profile, type, rng) {
  if (profile.chests.length >= MAX_CHESTS) return null;
  const chest = { id: `c${Date.now().toString(36)}${Math.floor(rng.next() * 1e6).toString(36)}`, type, unlockAt: null };
  profile.chests.push(chest);
  return chest;
}

export function chestStatus(chest, now) {
  if (chest.unlockAt == null) return { state: 'locked', remaining: CHEST_TYPES[chest.type].unlockSec };
  const remaining = Math.max(0, (chest.unlockAt - now) / 1000);
  return remaining <= 0 ? { state: 'ready', remaining: 0 } : { state: 'unlocking', remaining };
}

export function startUnlock(profile, chestId, now) {
  if (profile.chests.some((c) => c.unlockAt != null && chestStatus(c, now).state === 'unlocking')) {
    return { ok: false, reason: 'Já existe um baú sendo destrancado' };
  }
  const chest = profile.chests.find((c) => c.id === chestId);
  if (!chest) return { ok: false, reason: 'Baú não encontrado' };
  if (chest.unlockAt != null) return { ok: false, reason: 'Baú já em destrancamento' };
  chest.unlockAt = now + CHEST_TYPES[chest.type].unlockSec * 1000;
  return { ok: true };
}

/** Custo em moedas para abrir imediatamente. */
export function rushCost(chest, now) {
  const st = chestStatus(chest, now);
  if (st.state === 'ready') return 0;
  return Math.max(5, Math.ceil(st.remaining / 4));
}

/** Sorteia cartas desbloqueadas respeitando raridades. */
export function rollCards(profile, total, rng, minRarity = null) {
  const pool = CARDS.filter((c) => profile.cards[c.id]);
  const drops = {};
  const stacks = Math.min(pool.length, Math.max(1, Math.ceil(total / 4)));
  let remaining = total;
  const pickWeighted = (cands) => {
    const sum = cands.reduce((s, c) => s + RARITY_WEIGHT[c.rarity], 0);
    let r = rng.next() * sum;
    for (const c of cands) {
      r -= RARITY_WEIGHT[c.rarity];
      if (r <= 0) return c;
    }
    return cands[cands.length - 1];
  };
  for (let i = 0; i < stacks && remaining > 0; i++) {
    let cands = pool.filter((c) => !drops[c.id]);
    if (i === 0 && minRarity) {
      const min = RARITY_ORDER.indexOf(minRarity);
      const better = cands.filter((c) => RARITY_ORDER.indexOf(c.rarity) >= min);
      if (better.length) cands = better;
    }
    if (!cands.length) break;
    const card = pickWeighted(cands);
    const rarityDiv = { comum: 1, rara: 2.5, epica: 6, lendaria: 12 }[card.rarity];
    const share = i === stacks - 1 ? remaining : Math.max(1, Math.round((remaining / (stacks - i)) * (0.6 + rng.next() * 0.8)));
    const qty = Math.max(1, Math.round(share / rarityDiv));
    drops[card.id] = qty;
    remaining -= share;
  }
  return drops;
}

export function grantCards(profile, drops) {
  for (const [id, qty] of Object.entries(drops)) {
    if (!profile.cards[id]) continue;
    profile.cards[id].copies += qty;
  }
}

export function openChestContents(profile, type, rng) {
  const def = CHEST_TYPES[type];
  const coins = Math.round(def.coins[0] + (def.coins[1] - def.coins[0]) * rng.next());
  const cards = rollCards(profile, def.cards, rng, def.minRarity);
  profile.coins += coins;
  grantCards(profile, cards);
  profile.stats.chestsOpened++;
  const levelUps = addXp(profile, Math.round(def.cards * 1.5));
  return { type, coins, cards, levelUps };
}

export function openChest(profile, chestId, now, rng, { rush = false } = {}) {
  const idx = profile.chests.findIndex((c) => c.id === chestId);
  if (idx < 0) return { ok: false, reason: 'Baú não encontrado' };
  const chest = profile.chests[idx];
  const st = chestStatus(chest, now);
  if (st.state !== 'ready') {
    if (!rush) return { ok: false, reason: 'O baú ainda não foi destrancado' };
    const cost = rushCost(chest, now);
    if (profile.coins < cost) return { ok: false, reason: `Precisa de ${cost} moedas` };
    profile.coins -= cost;
  }
  profile.chests.splice(idx, 1);
  return { ok: true, ...openChestContents(profile, chest.type, rng) };
}

// ------------------------------------------------------------------ loja

export function dayKey(now) {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const CARD_PRICE = { comum: 10, rara: 40, epica: 200, lendaria: 800 };
const CARD_QTY = { comum: 10, rara: 4, epica: 1, lendaria: 1 };

export function shopOffers(profile, now) {
  const day = dayKey(now);
  const rng = createRng(hashString(`${day}:${profile.createdAt}`));
  const pool = rng.shuffle(CARDS.filter((c) => profile.cards[c.id]));
  const offers = pool.slice(0, 3).map((c, i) => ({
    id: `card:${c.id}:${i}`, kind: 'card', cardId: c.id, qty: CARD_QTY[c.rarity], price: CARD_PRICE[c.rarity] * CARD_QTY[c.rarity],
    name: `${CARD_QTY[c.rarity]}x ${c.name}`,
  }));
  offers.push({ id: 'chest:prata', kind: 'chest', chest: 'prata', price: 220, name: CHEST_TYPES.prata.name });
  offers.push({ id: 'chest:ouro', kind: 'chest', chest: 'ouro', price: 600, name: CHEST_TYPES.ouro.name });
  return offers;
}

function rollShopDay(profile, now) {
  const day = dayKey(now);
  if (profile.shop.day !== day) profile.shop = { day, bought: [], freeClaimed: false };
}

export function buyOffer(profile, offerId, now, rng) {
  rollShopDay(profile, now);
  const offer = shopOffers(profile, now).find((o) => o.id === offerId);
  if (!offer) return { ok: false, reason: 'Oferta indisponível' };
  if (offer.kind === 'card' && profile.shop.bought.includes(offerId)) return { ok: false, reason: 'Oferta já comprada hoje' };
  if (profile.coins < offer.price) return { ok: false, reason: 'Moedas insuficientes' };
  profile.coins -= offer.price;
  if (offer.kind === 'card') {
    profile.shop.bought.push(offerId);
    grantCards(profile, { [offer.cardId]: offer.qty });
    return { ok: true, offer, cards: { [offer.cardId]: offer.qty } };
  }
  return { ok: true, offer, ...openChestContents(profile, offer.chest, rng) };
}

export function claimFreeGift(profile, now, rng) {
  rollShopDay(profile, now);
  if (profile.shop.freeClaimed) return { ok: false, reason: 'Presente de hoje já resgatado' };
  profile.shop.freeClaimed = true;
  return { ok: true, ...openChestContents(profile, 'madeira', rng) };
}

export function isOfferBought(profile, offerId, now) {
  return profile.shop.day === dayKey(now) && profile.shop.bought.includes(offerId);
}

export { CARD_MAP };

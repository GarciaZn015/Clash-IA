import test from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/core/rng.js';
import {
  createProfile, addXp, xpToNext, upgradeCard, canUpgrade, setDeckCard, activeDeck, sanitizeProfile, validateDeck, MAX_CHESTS,
} from '../src/progression/profile.js';
import { addChest, startUnlock, chestStatus, openChest, rushCost, buyOffer, shopOffers, claimFreeGift, rollCards } from '../src/progression/economy.js';
import { ensureDailyMissions, progressMissions, claimMission, claimAchievement, achievementState, missionDef } from '../src/progression/missions.js';
import { applyMatchResult } from '../src/progression/rewards.js';
import { createStorage, memoryBackend, SAVE_KEY } from '../src/progression/storage.js';
import { CARDS } from '../src/data/cards.js';

const NOW = new Date('2026-11-01T12:00:00').getTime();
const fakeResult = (winner, crowns = [1, 0]) => ({
  winner, crowns, time: 180, reason: 'teste',
  stats: [0, 1].map(() => ({ cardsPlayed: 20, energySpent: 70, troopsDeployed: 15, spellsCast: 3, airDeployed: 2, buildingsPlaced: 0, damageDealt: 5000, towerDamage: 1500, unitsKilled: 20, towersDestroyed: crowns[0], energyWasted: 0 })),
});

test('perfil novo: cartas iniciais desbloqueadas e baralho válido', () => {
  const p = createProfile();
  assert.equal(Object.keys(p.cards).length, CARDS.filter((c) => c.unlockLevel <= 1).length);
  assert.ok(validateDeck(p, activeDeck(p)).ok);
});

test('XP sobe de nível, dá moedas e desbloqueia cartas', () => {
  const p = createProfile();
  const coins = p.coins;
  const ups = addXp(p, xpToNext(1) + 5);
  assert.equal(p.level, 2);
  assert.equal(p.xp, 5);
  assert.ok(p.coins > coins);
  assert.deepEqual(ups[0].unlocked.sort(), CARDS.filter((c) => c.unlockLevel === 2).map((c) => c.id).sort());
  addXp(p, 100000);
  assert.ok(Object.keys(p.cards).length === CARDS.length, 'todas desbloqueadas');
});

test('melhoria de carta consome cópias e moedas e falha sem recursos', () => {
  const p = createProfile();
  p.coins = 0;
  assert.equal(upgradeCard(p, 'escudeiro').ok, false);
  p.cards.escudeiro.copies = 2;
  assert.match(canUpgrade(p, 'escudeiro').reason, /moedas/);
  p.coins = 100;
  const r = upgradeCard(p, 'escudeiro');
  assert.ok(r.ok);
  assert.equal(p.cards.escudeiro.level, 2);
  assert.equal(p.cards.escudeiro.copies, 0);
  assert.equal(p.coins, 80);
  assert.equal(upgradeCard(p, 'golem').ok, false, 'carta bloqueada não melhora');
});

test('construtor de baralho: troca cartas, impede bloqueadas e duplicatas', () => {
  const p = createProfile();
  assert.equal(setDeckCard(p, 0, 'golem').ok, false);
  addXp(p, 100000);
  assert.ok(setDeckCard(p, 0, 'golem').ok);
  assert.equal(activeDeck(p)[0], 'golem');
  const before = activeDeck(p).slice();
  assert.ok(setDeckCard(p, 1, 'golem').ok, 'carta já no baralho troca de posição');
  assert.equal(activeDeck(p)[1], 'golem');
  assert.equal(activeDeck(p)[0], before[1]);
  assert.equal(new Set(activeDeck(p)).size, 8);
});

test('baús: limite de espaços, destrancar, abrir e abrir na hora com moedas', () => {
  const p = createProfile();
  const rng = createRng(1);
  for (let i = 0; i < MAX_CHESTS + 2; i++) addChest(p, 'madeira', rng);
  assert.equal(p.chests.length, MAX_CHESTS);
  const c = p.chests[0];
  assert.equal(openChest(p, c.id, NOW, rng).ok, false, 'trancado');
  assert.ok(startUnlock(p, c.id, NOW).ok);
  assert.equal(startUnlock(p, p.chests[1].id, NOW).ok, false, 'apenas um destrancando por vez');
  assert.equal(chestStatus(c, NOW + 5000).state, 'unlocking');
  const copiesBefore = Object.values(p.cards).reduce((s, x) => s + x.copies, 0);
  const coinsBefore = p.coins;
  const r = openChest(p, c.id, NOW + 16000, rng);
  assert.ok(r.ok);
  assert.ok(p.coins > coinsBefore);
  assert.ok(Object.values(p.cards).reduce((s, x) => s + x.copies, 0) > copiesBefore);
  const c2 = p.chests[0];
  const cost = rushCost(c2, NOW);
  p.coins = cost;
  assert.ok(openChest(p, c2.id, NOW, rng, { rush: true }).ok);
  assert.ok(p.coins >= 0);
});

test('cartas sorteadas vêm apenas da coleção desbloqueada', () => {
  const p = createProfile();
  const drops = rollCards(p, 30, createRng(3));
  for (const id of Object.keys(drops)) assert.ok(p.cards[id]);
});

test('loja: compra com moedas, oferta diária única e presente gratuito', () => {
  const p = createProfile();
  const rng = createRng(2);
  const offer = shopOffers(p, NOW).find((o) => o.kind === 'card');
  p.coins = offer.price;
  assert.ok(buyOffer(p, offer.id, NOW, rng).ok);
  assert.equal(p.coins, 0);
  p.coins = 99999;
  assert.equal(buyOffer(p, offer.id, NOW, rng).ok, false, 'mesma oferta só uma vez por dia');
  assert.ok(claimFreeGift(p, NOW, rng).ok);
  assert.equal(claimFreeGift(p, NOW, rng).ok, false);
  assert.ok(claimFreeGift(p, NOW + 86400000, rng).ok, 'renova no dia seguinte');
  p.coins = 0;
  assert.equal(buyOffer(p, 'chest:ouro', NOW, rng).ok, false, 'sem moedas');
});

test('resultado da partida aplica recompensas, histórico, baú e missões', () => {
  const p = createProfile();
  ensureDailyMissions(p, NOW);
  const r = applyMatchResult(p, fakeResult(0, [2, 0]), { difficulty: 'normal', now: NOW, rng: createRng(1) });
  assert.equal(r.outcome, 'win');
  assert.equal(p.stats.wins, 1);
  assert.ok(r.coins > 0 && r.xp > 0);
  assert.ok(r.chest);
  assert.equal(p.history.length, 1);
  assert.ok(p.missions.list.some((m) => m.progress > 0));
  const l = applyMatchResult(p, fakeResult(1, [0, 1]), { difficulty: 'hard', now: NOW, rng: createRng(1) });
  assert.equal(l.outcome, 'loss');
  assert.equal(l.chest, null);
  const d = applyMatchResult(p, fakeResult(null, [1, 1]), { difficulty: 'easy', now: NOW, rng: createRng(1) });
  assert.equal(d.outcome, 'draw');
  assert.equal(p.stats.matches, 3);
  assert.equal(p.history[0].result, 'draw');
});

test('missões: progresso, resgate único; conquistas', () => {
  const p = createProfile();
  const list = ensureDailyMissions(p, NOW);
  assert.equal(list.length, 3);
  const id = list[0].id;
  assert.equal(claimMission(p, id, NOW).ok, false);
  progressMissions(p, { [missionDef(id).stat]: 1e6 }, NOW);
  const coins = p.coins;
  assert.ok(claimMission(p, id, NOW).ok);
  assert.ok(p.coins > coins);
  assert.equal(claimMission(p, id, NOW).ok, false);
  assert.equal(achievementState(p, 'first_win'), 'locked');
  p.stats.wins = 1;
  assert.ok(claimAchievement(p, 'first_win').ok);
  assert.equal(claimAchievement(p, 'first_win').ok, false);
});

test('persistência: salvar e carregar mantém o progresso', () => {
  const backend = memoryBackend();
  const st = createStorage(backend);
  const { profile, fresh } = st.load(NOW);
  assert.ok(fresh);
  profile.coins = 1234;
  addXp(profile, 500);
  profile.cards.escudeiro.level = 4;
  assert.ok(st.save(profile));
  const again = createStorage(backend).load(NOW);
  assert.equal(again.fresh, false);
  assert.equal(again.profile.coins, profile.coins);
  assert.equal(again.profile.level, profile.level);
  assert.equal(again.profile.cards.escudeiro.level, 4);
});

test('persistência: dados corrompidos ou adulterados são saneados', () => {
  const backend = memoryBackend();
  backend.setItem(SAVE_KEY, '{nao é json');
  const r = createStorage(backend).load(NOW);
  assert.ok(r.recovered);
  assert.ok(backend.getItem(`${SAVE_KEY}.corrupt`));
  const p = sanitizeProfile({ level: 9999, coins: -50, cards: { escudeiro: { level: 99, copies: -1 }, falsa: { level: 1 } }, decks: [['golem', 'golem']], settings: { music: 7 } });
  assert.equal(p.level, 30);
  assert.equal(p.coins, 0);
  assert.equal(p.cards.escudeiro.level, 9);
  assert.equal(p.cards.escudeiro.copies, 0);
  assert.equal(p.cards.falsa, undefined);
  assert.ok(validateDeck(p, activeDeck(p)).ok);
  assert.equal(p.settings.music, 1);
});

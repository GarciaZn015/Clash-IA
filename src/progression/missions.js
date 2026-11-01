// Missões diárias e conquistas.
import { createRng, hashString } from '../core/rng.js';
import { CARDS } from '../data/cards.js';
import { dayKey } from './economy.js';
import { addXp } from './profile.js';

export const MISSION_POOL = [
  { id: 'win2', text: 'Vença 2 partidas', target: 2, stat: 'wins', coins: 70, xp: 40 },
  { id: 'play3', text: 'Jogue 3 partidas', target: 3, stat: 'matches', coins: 50, xp: 30 },
  { id: 'crowns4', text: 'Conquiste 4 coroas', target: 4, stat: 'crowns', coins: 60, xp: 35 },
  { id: 'cards30', text: 'Jogue 30 cartas', target: 30, stat: 'cardsPlayed', coins: 45, xp: 25 },
  { id: 'spells5', text: 'Lance 5 feitiços', target: 5, stat: 'spellsCast', coins: 45, xp: 25 },
  { id: 'air6', text: 'Invoque 6 tropas aéreas', target: 6, stat: 'airDeployed', coins: 45, xp: 25 },
  { id: 'tower3000', text: 'Cause 3.000 de dano a torres', target: 3000, stat: 'towerDamage', coins: 60, xp: 35 },
  { id: 'kills40', text: 'Derrote 40 tropas inimigas', target: 40, stat: 'unitsKilled', coins: 55, xp: 30 },
];

export function ensureDailyMissions(profile, now) {
  const day = dayKey(now);
  if (profile.missions.day === day && profile.missions.list.length) return profile.missions.list;
  const rng = createRng(hashString(`missions:${day}:${profile.createdAt}`));
  profile.missions = { day, list: rng.shuffle(MISSION_POOL).slice(0, 3).map((m) => ({ id: m.id, progress: 0, claimed: false })) };
  return profile.missions.list;
}

export function missionDef(id) {
  return MISSION_POOL.find((m) => m.id === id);
}

/** Atualiza progresso com o resumo de uma partida: {wins, matches, crowns, cardsPlayed, ...}. */
export function progressMissions(profile, delta, now) {
  ensureDailyMissions(profile, now);
  const completed = [];
  for (const m of profile.missions.list) {
    const def = missionDef(m.id);
    if (!def || m.claimed) continue;
    const before = m.progress;
    m.progress = Math.min(def.target, m.progress + (delta[def.stat] || 0));
    if (before < def.target && m.progress >= def.target) completed.push(m.id);
  }
  return completed;
}

export function claimMission(profile, id, now) {
  ensureDailyMissions(profile, now);
  const m = profile.missions.list.find((x) => x.id === id);
  const def = missionDef(id);
  if (!m || !def) return { ok: false, reason: 'Missão não encontrada' };
  if (m.claimed) return { ok: false, reason: 'Recompensa já resgatada' };
  if (m.progress < def.target) return { ok: false, reason: 'Missão incompleta' };
  m.claimed = true;
  profile.coins += def.coins;
  const levelUps = addXp(profile, def.xp);
  return { ok: true, coins: def.coins, xp: def.xp, levelUps };
}

export const ACHIEVEMENTS = [
  { id: 'first_win', text: 'Primeira vitória', desc: 'Vença uma partida.', coins: 100, check: (p) => p.stats.wins >= 1 },
  { id: 'wins10', text: 'Veterano', desc: 'Vença 10 partidas.', coins: 300, check: (p) => p.stats.wins >= 10 },
  { id: 'three_crowns', text: 'Conquista total', desc: 'Vença com 3 coroas.', coins: 200, check: (p) => p.stats.threeCrowns >= 1 },
  { id: 'hard_win', text: 'Desafiante', desc: 'Vença a IA no Difícil.', coins: 400, check: (p) => p.stats.hardWins >= 1 },
  { id: 'level5', text: 'Comandante experiente', desc: 'Alcance o nível 5.', coins: 250, check: (p) => p.level >= 5 },
  { id: 'upgrade5', text: 'Ferreiro', desc: 'Melhore cartas 5 vezes.', coins: 150, check: (p) => p.stats.upgrades >= 5 },
  { id: 'chests10', text: 'Caçador de tesouros', desc: 'Abra 10 baús.', coins: 200, check: (p) => p.stats.chestsOpened >= 10 },
  { id: 'collector', text: 'Colecionador', desc: 'Desbloqueie todas as cartas.', coins: 500, check: (p) => CARDS.every((c) => p.cards[c.id]) },
];

export function achievementState(profile, id) {
  const a = ACHIEVEMENTS.find((x) => x.id === id);
  if (!a) return 'unknown';
  if (profile.achievements[id]) return 'claimed';
  return a.check(profile) ? 'ready' : 'locked';
}

export function claimAchievement(profile, id) {
  const a = ACHIEVEMENTS.find((x) => x.id === id);
  if (!a) return { ok: false, reason: 'Conquista inexistente' };
  const st = achievementState(profile, id);
  if (st === 'claimed') return { ok: false, reason: 'Já resgatada' };
  if (st !== 'ready') return { ok: false, reason: 'Objetivo ainda não alcançado' };
  profile.achievements[id] = true;
  profile.coins += a.coins;
  return { ok: true, coins: a.coins };
}

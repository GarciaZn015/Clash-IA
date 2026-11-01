// Aplica o resultado de uma partida ao perfil (XP, moedas, troféus, baú, estatísticas, histórico, missões).
import { DIFFICULTIES } from '../data/decks.js';
import { addXp, HISTORY_LIMIT, MAX_CHESTS } from './profile.js';
import { addChest, rollChestType } from './economy.js';
import { progressMissions } from './missions.js';

/**
 * @param {object} profile
 * @param {object} result resultado de Match.result
 * @param {{difficulty:string, now:number, rng:object, side?:number}} ctx
 */
export function applyMatchResult(profile, result, { difficulty = 'normal', now = Date.now(), rng, side = 0 }) {
  const diff = DIFFICULTIES[difficulty] || DIFFICULTIES.normal;
  const outcome = result.winner === null ? 'draw' : result.winner === side ? 'win' : 'loss';
  const myCrowns = result.crowns[side];
  const theirCrowns = result.crowns[1 - side];
  const stats = result.stats[side];

  const baseXp = outcome === 'win' ? 40 : outcome === 'draw' ? 20 : 12;
  const baseCoins = outcome === 'win' ? 30 + myCrowns * 10 : outcome === 'draw' ? 15 : 5 + myCrowns * 5;
  const xp = Math.round((baseXp + myCrowns * 6) * diff.rewardMult);
  const coins = Math.round(baseCoins * diff.rewardMult);
  const trophyDelta = outcome === 'win' ? Math.round(30 * diff.rewardMult) : outcome === 'loss' ? -15 : 0;

  profile.coins += coins;
  profile.trophies = Math.max(0, profile.trophies + trophyDelta);
  const s = profile.stats;
  s.matches++;
  if (outcome === 'win') s.wins++;
  else if (outcome === 'loss') s.losses++;
  else s.draws++;
  if (outcome === 'win' && myCrowns === 3) s.threeCrowns++;
  if (outcome === 'win' && difficulty === 'hard') s.hardWins++;
  s.towersDestroyed += stats.towersDestroyed;
  s.cardsPlayed += stats.cardsPlayed;

  let chest = null;
  let chestBlocked = false;
  if (outcome === 'win') {
    if (profile.chests.length < MAX_CHESTS) {
      let type = rollChestType(rng);
      if (difficulty === 'hard' && type === 'madeira') type = 'prata';
      chest = addChest(profile, type, rng);
    } else chestBlocked = true;
  }

  const levelUps = addXp(profile, xp);
  const missionsCompleted = progressMissions(profile, {
    wins: outcome === 'win' ? 1 : 0, matches: 1, crowns: myCrowns,
    cardsPlayed: stats.cardsPlayed, spellsCast: stats.spellsCast, airDeployed: stats.airDeployed,
    towerDamage: Math.round(stats.towerDamage), unitsKilled: stats.unitsKilled,
  }, now);

  profile.history.unshift({
    date: now, result: outcome, crowns: [myCrowns, theirCrowns], difficulty,
    duration: Math.round(result.time), reason: result.reason, coins, xp, trophies: trophyDelta,
  });
  profile.history.length = Math.min(profile.history.length, HISTORY_LIMIT);

  return { outcome, xp, coins, trophyDelta, chest, chestBlocked, levelUps, missionsCompleted };
}

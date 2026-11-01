// Teste de balanceamento: partidas IA x IA (mesma dificuldade) com baralhos aleatórios.
// Mede a taxa de vitória de cada carta quando presente no baralho. Uso: node scripts/balance.mjs [partidas]
import { Match } from '../src/sim/match.js';
import { AIController } from '../src/ai/ai.js';
import { CARDS } from '../src/data/cards.js';
import { createRng } from '../src/core/rng.js';
import { TICK } from '../src/core/constants.js';

const N = Number(process.argv[2] || 200);
const rng = createRng(2024);
const stats = Object.fromEntries(CARDS.map((c) => [c.id, { games: 0, wins: 0, played: 0 }]));
let draws = 0;
let sideWins = [0, 0];
let totalCrowns = 0;
const randomDeck = () => {
  // garante ao menos um feitiço e uma unidade antiaérea para baralhos jogáveis
  for (;;) {
    const d = rng.shuffle(CARDS.map((c) => c.id)).slice(0, 8);
    const hasSpell = d.some((id) => CARDS.find((c) => c.id === id).type === 'spell');
    if (hasSpell) return d;
  }
};
const t0 = performance.now();
for (let i = 0; i < N; i++) {
  const decks = [randomDeck(), randomDeck()];
  const m = new Match({ decks, seed: 7000 + i });
  const ais = [new AIController(m, 0, 'hard', i * 3 + 1), new AIController(m, 1, 'hard', i * 3 + 2)];
  while (!m.isOver) {
    for (const a of ais) a.update(TICK);
    m.step(TICK);
    for (const ev of m.drainEvents()) if (ev.type === 'cardPlayed') stats[ev.cardId].played++;
  }
  const w = m.result.winner;
  totalCrowns += m.result.crowns[0] + m.result.crowns[1];
  if (w === null) draws++;
  else sideWins[w]++;
  for (const side of [0, 1]) {
    for (const id of decks[side]) {
      stats[id].games++;
      if (w === side) stats[id].wins++;
      else if (w === null) stats[id].wins += 0.5;
    }
  }
}
const rows = Object.entries(stats).map(([id, s]) => ({ id, wr: s.games ? s.wins / s.games : 0, games: s.games, playedPerGame: s.games ? s.played / s.games : 0 }));
rows.sort((a, b) => b.wr - a.wr);
console.log(`Partidas: ${N}  | lado0 ${sideWins[0]} x lado1 ${sideWins[1]} | empates ${draws} | coroas/partida ${(totalCrowns / N).toFixed(2)} | ${((performance.now() - t0) / 1000).toFixed(1)}s\n`);
console.log('carta          vitória  jogos  usos/partida');
for (const r of rows) console.log(`${r.id.padEnd(14)} ${(r.wr * 100).toFixed(1).padStart(6)}%  ${String(r.games).padStart(5)}  ${r.playedPerGame.toFixed(1).padStart(6)}`);
const outliers = rows.filter((r) => r.games >= 20 && (r.wr > 0.62 || r.wr < 0.38));
console.log(outliers.length ? `\nAtenção (fora de 38%–62%): ${outliers.map((r) => r.id).join(', ')}` : '\nNenhuma carta fora da faixa 38%–62%.');

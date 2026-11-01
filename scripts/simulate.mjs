// Executa partidas IA x IA sem renderização. Uso: node scripts/simulate.mjs [partidas] [difA] [difB]
import { Match } from '../src/sim/match.js';
import { AIController } from '../src/ai/ai.js';
import { AI_DECKS } from '../src/data/decks.js';
import { TICK } from '../src/core/constants.js';

const n = Number(process.argv[2] || 10);
const da = process.argv[3] || 'hard';
const db = process.argv[4] || 'easy';
const tally = { 0: 0, 1: 0, draw: 0 };
let totalTime = 0;
const t0 = performance.now();
for (let i = 0; i < n; i++) {
  const deckA = AI_DECKS[da][i % AI_DECKS[da].length];
  const deckB = AI_DECKS[db][(i * 7) % AI_DECKS[db].length];
  const m = new Match({ decks: [deckA, deckB], seed: 1000 + i });
  const ais = [new AIController(m, 0, da, 11 + i), new AIController(m, 1, db, 97 + i)];
  let maxEnt = 0;
  while (!m.isOver) {
    for (const a of ais) a.update(TICK);
    m.step(TICK);
    m.drainEvents();
    maxEnt = Math.max(maxEnt, m.entities.length);
  }
  const r = m.result;
  tally[r.winner === null ? 'draw' : r.winner]++;
  totalTime += r.time;
  console.log(`#${i} ${da}(${r.crowns[0]}) x ${db}(${r.crowns[1]}) -> ${r.winner === null ? 'empate' : r.winner === 0 ? da : db} | ${r.reason} | ${r.time.toFixed(0)}s | cartas ${r.stats[0].cardsPlayed}/${r.stats[1].cardsPlayed} | max ent ${maxEnt}`);
}
console.log(`\n${da}: ${tally[0]}  ${db}: ${tally[1]}  empates: ${tally.draw}  | duração média ${(totalTime / n).toFixed(0)}s | ${(performance.now() - t0).toFixed(0)}ms`);

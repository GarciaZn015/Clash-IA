// Teste de fumaça no navegador real (Chromium via Playwright, se disponível).
// Navega pelos menus, joga cartas por arrasto, redimensiona a janela, conclui uma partida e verifica o salvamento.
// Uso: node scripts/smoke.mjs   (screenshots em ./screenshots)
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require('playwright');
} catch {
  console.log('Playwright não encontrado — instale com "npm i -D playwright" para rodar o smoke test.');
  process.exit(0);
}

const PORT = 5199;
const server = spawn(process.execPath, ['scripts/serve.mjs', String(PORT)], { stdio: 'pipe' });
await new Promise((r) => server.stdout.once('data', r));
await mkdir('screenshots', { recursive: true });

const errors = [];
const failures = [];
const check = (cond, msg) => {
  if (!cond) failures.push(msg);
  console.log(`${cond ? '✔' : '✘'} ${msg}`);
};

const browser = await playwright.chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 1 });
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForSelector('.modal');
  await page.screenshot({ path: 'screenshots/01-tutorial.png' });
  for (let i = 0; i < 4; i++) await page.click('.modal .btn.gold');
  check(!(await page.$('.modal')), 'Tutorial pode ser concluído');
  await page.screenshot({ path: 'screenshots/02-home.png' });

  for (const [tab, shot] of [['Cartas', '03-collection'], ['Loja', '04-shop'], ['Missões', '05-missions'], ['Perfil', '06-profile']]) {
    await page.click(`.nav button[aria-label="${tab}"]`);
    await page.waitForTimeout(150);
    await page.screenshot({ path: `screenshots/${shot}.png` });
  }
  // Detalhe de carta
  await page.click('.nav button[aria-label="Cartas"]');
  await page.click('.card-grid .card');
  await page.waitForSelector('.modal .stats-table');
  await page.screenshot({ path: 'screenshots/07-card-detail.png' });
  await page.keyboard.press('Escape');
  // Presente diário na loja
  await page.click('.nav button[aria-label="Loja"]');
  const coinsBefore = await page.evaluate(() => window.__bastioes.profile.coins);
  await page.click('text=Resgatar');
  await page.waitForSelector('.reward-grid');
  await page.screenshot({ path: 'screenshots/08-chest.png' });
  await page.click('.modal .btn.gold');
  const coinsAfter = await page.evaluate(() => window.__bastioes.profile.coins);
  check(coinsAfter > coinsBefore, 'Presente diário concede moedas');

  // Batalha
  await page.click('.nav button[aria-label="Batalha"]');
  await page.click('.battle-btn');
  await page.waitForSelector('.battle canvas');
  await page.waitForTimeout(3600); // contagem
  const canvas = await page.$('.field-wrap canvas');
  const box = await canvas.boundingBox();
  const energyBefore = await page.evaluate(() => window.__bastioes.battle.match.players[0].energy);
  // Arrasta a primeira carta da mão para o lado do jogador
  const slot = 0;
  const cardBox = await (await page.$(`.hand .slot[data-slot="${slot}"] .card`)).boundingBox();
  await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.72, { steps: 8 });
  await page.screenshot({ path: 'screenshots/09-drag.png' });
  await page.mouse.up();
  await page.waitForTimeout(200);
  const played = await page.evaluate(() => window.__bastioes.battle.match.players[0].stats.cardsPlayed);
  const energyAfter = await page.evaluate(() => window.__bastioes.battle.match.players[0].energy);
  check(played === 1 && energyAfter < energyBefore, 'Carta jogada por arrasto consome Éter');
  // Tentativa inválida: lado inimigo
  const cb2 = await (await page.$('.hand .slot[data-slot="1"] .card')).boundingBox();
  await page.mouse.click(cb2.x + cb2.width / 2, cb2.y + cb2.height / 2);
  const isSpell = await page.evaluate(() => {
    const m = window.__bastioes.battle.match;
    return m.players[0].deck.hand[1] === 'saraivada' || m.players[0].deck.hand[1] === 'meteoro';
  });
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.2);
  await page.waitForTimeout(100);
  const played2 = await page.evaluate(() => window.__bastioes.battle.match.players[0].stats.cardsPlayed);
  if (!isSpell) check(played2 === 1, 'Invocação no lado inimigo é rejeitada');
  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'screenshots/10-battle.png' });

  // Redimensionamento
  for (const [w, hgt, name] of [[1280, 720, '11-desktop'], [360, 640, '12-small']]) {
    await page.setViewportSize({ width: w, height: hgt });
    await page.waitForTimeout(400);
    await page.screenshot({ path: `screenshots/${name}.png` });
    const fits = await page.evaluate(() => {
      const r = window.__bastioes.battle.renderer;
      return r.scale > 0 && r.offX >= -0.5 && r.offY >= -0.5 && document.documentElement.scrollWidth <= window.innerWidth;
    });
    check(fits, `Arena se adapta a ${w}x${hgt}`);
  }
  await page.setViewportSize({ width: 420, height: 860 });

  // Pausa
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  const t1 = await page.evaluate(() => window.__bastioes.battle.match.time);
  await page.waitForTimeout(600);
  const t2 = await page.evaluate(() => window.__bastioes.battle.match.time);
  check(t1 === t2, 'Pausa congela a partida');
  await page.screenshot({ path: 'screenshots/13-pause.png' });
  await page.click('text=Continuar');

  // Acelera a partida até o fim (IA x jogador parado + IA do lado do jogador)
  await page.evaluate(async () => {
    const { AIController } = await import('./src/ai/ai.js');
    const b = window.__bastioes.battle;
    const helper = new AIController(b.match, 0, 'hard', 3);
    while (!b.match.isOver) {
      helper.update(1 / 30);
      b.ai.update(1 / 30);
      b.match.step(1 / 30);
      for (const ev of b.match.drainEvents()) b.onEvent(ev);
    }
  });
  await page.waitForSelector('.overlay.result', { timeout: 5000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'screenshots/14-result.png' });
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('bastioes-do-eter.save.v1')));
  check(saved && saved.stats.matches === 1 && saved.history.length === 1, 'Resultado salvo no armazenamento');

  // Recarrega e confere persistência
  await page.reload();
  await page.waitForSelector('.topbar');
  const after = await page.evaluate(() => window.__bastioes.profile.stats.matches);
  check(after === 1, 'Progresso persiste após recarregar');
  check(!(await page.$('.modal')), 'Tutorial não reaparece após concluído');

  // Jogar novamente
  await page.click('.battle-btn');
  await page.waitForSelector('.battle canvas');
  await page.waitForTimeout(500);
  check(await page.evaluate(() => window.__bastioes.battle.match.phase === 'countdown'), 'Nova partida inicia com contagem');
} finally {
  await browser.close();
  server.kill();
}

check(errors.length === 0, `Sem erros no console${errors.length ? ': ' + errors.join(' | ') : ''}`);
if (failures.length) {
  console.log(`\n${failures.length} verificação(ões) falharam.`);
  process.exit(1);
}
console.log('\nSmoke test OK. Screenshots em ./screenshots');

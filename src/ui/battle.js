// Tela de batalha: liga simulação, IA, renderização, efeitos, áudio e entrada do jogador.
import { TICK, MAX_ENERGY, SIDE_PLAYER } from '../core/constants.js';
import { createRng } from '../core/rng.js';
import { getCard } from '../data/cards.js';
import { AI_DECKS, DIFFICULTIES } from '../data/decks.js';
import { arenaForLevel } from '../data/modes.js';
import { Match, PHASE } from '../sim/match.js';
import { AIController } from '../ai/ai.js';
import { Renderer } from '../render/renderer.js';
import { Effects } from '../render/effects.js';
import { soundForEvent } from '../audio/audio.js';
import { activeDeck, averageDeckLevel, levelsMap, MAX_CHESTS } from '../progression/profile.js';
import { applyMatchResult } from '../progression/rewards.js';
import { CHEST_TYPES } from '../progression/economy.js';
import { MAX_CARD_LEVEL } from '../data/cards.js';
import { h, icon, cardEl, toast, fmtTime } from './dom.js';

export class Battle {
  constructor(app, { difficulty = 'normal', seed = (Date.now() ^ (Math.random() * 1e9)) >>> 0 } = {}) {
    this.app = app;
    this.difficulty = DIFFICULTIES[difficulty] ? difficulty : 'normal';
    this.seed = seed;
    const profile = app.profile;
    const rng = createRng(seed);
    const aiDeck = rng.pick(AI_DECKS[this.difficulty]);
    const avg = Math.round(averageDeckLevel(profile));
    const aiLevel = Math.max(1, Math.min(MAX_CARD_LEVEL, avg + DIFFICULTIES[this.difficulty].levelOffset));
    this.match = new Match({ decks: [activeDeck(profile).slice(), aiDeck], levels: [levelsMap(profile), aiLevel], seed });
    this.ai = new AIController(this.match, 1, this.difficulty, seed ^ 0x9e3779b9);
    this.aiLevel = aiLevel;
    this.fx = new Effects();
    this.fx.setOptions(profile.settings);
    this.arena = arenaForLevel(profile.level);
    this.paused = false;
    this.acc = 0;
    this.last = 0;
    this.raf = 0;
    this.selected = -1;
    this.drag = null;
    this.preview = null;
    this.handKey = '';
    this.ended = false;
    this.lastCountdown = -1;
    this.firstMatch = profile.stats.matches === 0;
    this.listeners = [];
  }

  mount(root) {
    const m = this.match;
    this.canvas = h('canvas', { 'aria-label': 'Arena de batalha' });
    this.timerEl = h('div', { class: 'timer' }, '3:00');
    this.x2El = h('div', { class: 'x2' }, 'x2 Éter');
    this.crownsEl = [h('div', { class: 'crowns' }), h('div', { class: 'crowns' })];
    this.handEl = h('div', { class: 'hand' });
    this.energyNum = h('div', { class: 'num' }, '5');
    this.energyFill = h('div', { class: 'fill' });
    this.overlay = h('div', { class: 'overlay', style: { pointerEvents: 'none' } });
    this.hintEl = this.firstMatch ? h('div', { class: 'hint' }, 'Arraste uma carta para o seu lado da arena') : null;
    const pauseBtn = h('button', { class: 'icon-btn', 'aria-label': 'Pausar', onclick: () => this.togglePause(true) });
    pauseBtn.append(icon('pause'));

    this.el = h('div', { class: 'battle' },
      h('div', { class: 'bhud' },
        h('div', { class: 'who' }, h('div', { style: { color: '#9cc8ff' } }, this.app.profile.name), this.crownsEl[0]),
        h('div', { class: 'spacer' }),
        h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' } }, this.timerEl, this.x2El),
        h('div', { class: 'spacer' }),
        h('div', { class: 'who', style: { textAlign: 'right' } }, h('div', { style: { color: '#ffaa9e' } }, `IA ${DIFFICULTIES[this.difficulty].label} · Nv ${this.aiLevel}`), this.crownsEl[1]),
        pauseBtn,
      ),
      h('div', { class: 'field-wrap' }, this.canvas, this.overlay, this.hintEl),
      h('div', { class: 'hand-bar' },
        this.handEl,
        h('div', { class: 'energy' }, this.energyNum, h('div', { class: 'bar' }, this.energyFill, h('div', { class: 'ticks' }, Array.from({ length: 10 }, () => h('i'))))),
      ),
    );
    root.replaceChildren(this.el);
    this.renderer = new Renderer(this.canvas, this.arena.palette);
    this.renderer.resize();
    this.bindInput();
    this.renderHand(true);
    this.updateCrowns();
    this.app.audio.startMusic('battle');
    this.app.audio.setIntensity(0);
    this.last = performance.now();
    this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  on(target, type, fn, opts) {
    target.addEventListener(type, fn, opts);
    this.listeners.push(() => target.removeEventListener(type, fn, opts));
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    for (const off of this.listeners) off();
    this.listeners = [];
  }

  // ---------------------------------------------------------------- loop

  frame(t) {
    this.raf = requestAnimationFrame((tt) => this.frame(tt));
    const dt = Math.min(0.1, (t - this.last) / 1000);
    this.last = t;
    if (!this.paused) {
      this.acc += dt;
      let steps = 0;
      while (this.acc >= TICK && steps < 8) {
        this.ai.update(TICK);
        this.match.step(TICK);
        for (const ev of this.match.drainEvents()) this.onEvent(ev);
        this.acc -= TICK;
        steps++;
      }
      this.fx.update(dt);
    }
    try {
      this.renderer.render(this.match, Math.min(1, this.acc / TICK), this.fx, { preview: this.preview });
    } catch (err) {
      console.error('Erro de renderização', err);
    }
    this.updateHud();
  }

  onEvent(ev) {
    this.fx.handle(ev, this.match);
    const snd = soundForEvent(ev);
    if (snd) this.app.audio.play(snd, { throttle: ev.type === 'attack' ? 0.07 : 0.04 });
    if (ev.type === 'towerDestroyed' || ev.type === 'kingActivated') this.updateCrowns();
    if (ev.type === 'doubleEnergy') this.app.audio.setIntensity(0.6);
    if (ev.type === 'phase' && ev.phase === PHASE.OVERTIME) this.app.audio.setIntensity(1);
    if (ev.type === 'cardPlayed' && ev.side === SIDE_PLAYER && this.hintEl) {
      this.hintEl.remove();
      this.hintEl = null;
    }
    if (ev.type === 'end') this.onEnd(ev.result);
  }

  // ---------------------------------------------------------------- HUD

  updateHud() {
    const m = this.match;
    const p = m.players[SIDE_PLAYER];
    // contagem
    if (m.phase === PHASE.COUNTDOWN) {
      const n = Math.ceil(m.countdown);
      if (n !== this.lastCountdown) {
        this.lastCountdown = n;
        this.overlay.replaceChildren(h('div', { class: 'countdown' }, n));
        this.app.audio.play('beep');
      }
    } else if (this.lastCountdown !== 0 && !this.ended) {
      this.lastCountdown = 0;
      this.overlay.replaceChildren();
    }
    const tl = m.timeLeft;
    const mm = Math.floor(Math.ceil(tl) / 60);
    const ss = String(Math.ceil(tl) % 60).padStart(2, '0');
    const ot = m.phase === PHASE.OVERTIME;
    const label = ot ? 'PRORROGAÇÃO' : 'TEMPO';
    const text = `${mm}:${ss}`;
    if (this.timerEl.dataset.v !== text + label) {
      this.timerEl.dataset.v = text + label;
      this.timerEl.replaceChildren(h('span', { class: 'lbl' }, label), text);
      this.timerEl.classList.toggle('ot', ot);
      this.timerEl.classList.toggle('low', !ot && tl <= 10 && m.phase === PHASE.PLAYING);
    }
    this.x2El.classList.toggle('on', m.energyMultiplier > 1 && m.phase !== PHASE.ENDED);
    this.x2El.textContent = ot ? 'x2 Éter · Morte súbita' : 'x2 Éter';
    const e = p.energy;
    this.energyNum.textContent = Math.floor(e + 1e-6);
    this.energyFill.style.width = `${(e / MAX_ENERGY) * 100}%`;
    const key = p.deck.hand.join(',') + '|' + p.deck.next;
    if (key !== this.handKey) this.renderHand();
    for (const slotEl of this.handEl.querySelectorAll('.slot')) {
      const i = Number(slotEl.dataset.slot);
      const card = getCard(p.deck.hand[i]);
      const cEl = slotEl.firstElementChild;
      const poor = e + 1e-9 < card.cost;
      cEl.classList.toggle('poor', poor);
      cEl.classList.toggle('sel', i === this.selected);
      const charge = cEl.querySelector('.charge');
      if (charge) charge.style.height = poor ? `${(1 - e / card.cost) * 100}%` : '0%';
    }
  }

  renderHand(initial = false) {
    const p = this.match.players[SIDE_PLAYER];
    const prev = this.handKey ? this.handKey.split('|')[0].split(',') : [];
    this.handKey = p.deck.hand.join(',') + '|' + p.deck.next;
    const nextCard = getCard(p.deck.next);
    const children = [h('div', { class: 'next' }, 'Próxima', cardEl(nextCard, { showName: false }))];
    p.deck.hand.forEach((id, i) => {
      const card = getCard(id);
      const c = cardEl(card, { extraClass: !initial && prev[i] !== id ? 'new' : '' });
      c.append(h('div', { class: 'charge' }));
      c.setAttribute('aria-label', `${card.name}, custo ${card.cost}. Tecla ${i + 1}`);
      children.push(h('div', { class: 'slot', 'data-slot': i }, c));
    });
    this.handEl.replaceChildren(...children);
  }

  updateCrowns() {
    for (const side of [0, 1]) {
      const n = this.match.players[side].crowns;
      const color = side === 0 ? '#5aa2ff' : '#ff6a5a';
      const el = this.crownsEl[side];
      el.replaceChildren(...[0, 1, 2].map((i) => icon('crown', i < n ? color : '#3a3f5c')));
    }
  }

  // ---------------------------------------------------------------- entrada

  bindInput() {
    const hand = this.handEl;
    this.on(hand, 'pointerdown', (e) => {
      const slotEl = e.target.closest('.slot');
      if (!slotEl || this.paused || this.ended) return;
      e.preventDefault();
      const slot = Number(slotEl.dataset.slot);
      this.app.audio.unlock();
      this.drag = { slot, id: e.pointerId, x0: e.clientX, y0: e.clientY, moved: false, wasSelected: this.selected === slot };
      this.selected = slot;
      this.app.audio.play('select');
    });
    this.on(window, 'pointermove', (e) => {
      if (this.drag && e.pointerId === this.drag.id) {
        if (Math.hypot(e.clientX - this.drag.x0, e.clientY - this.drag.y0) > 10) this.drag.moved = true;
        if (this.drag.moved) this.updatePreview(e.clientX, e.clientY);
      } else if (!this.drag && this.selected >= 0 && e.pointerType === 'mouse') {
        this.updatePreview(e.clientX, e.clientY);
      }
    });
    this.on(window, 'pointerup', (e) => {
      if (!this.drag || e.pointerId !== this.drag.id) return;
      const d = this.drag;
      this.drag = null;
      if (d.moved) {
        if (this.preview) this.tryPlay(this.preview.x, this.preview.y);
        else this.preview = null;
      } else if (d.wasSelected) {
        this.selected = -1;
        this.preview = null;
      }
    });
    this.on(window, 'pointercancel', () => {
      this.drag = null;
      this.preview = null;
    });
    this.on(this.canvas, 'pointerdown', (e) => {
      if (this.drag || this.selected < 0 || this.paused || this.ended) return;
      e.preventDefault();
      this.app.audio.unlock();
      this.updatePreview(e.clientX, e.clientY);
      if (this.preview) this.tryPlay(this.preview.x, this.preview.y);
    });
    this.on(this.canvas, 'pointerleave', () => {
      if (!this.drag) this.preview = null;
    });
    this.on(window, 'keydown', (e) => {
      if (this.ended) return;
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        this.togglePause(!this.paused);
        return;
      }
      const n = Number(e.key);
      if (n >= 1 && n <= 4) {
        this.selected = this.selected === n - 1 ? -1 : n - 1;
        if (this.selected < 0) this.preview = null;
        this.app.audio.play('select');
      }
    });
    this.on(window, 'resize', () => this.renderer.resize());
    this.on(document, 'visibilitychange', () => {
      if (document.hidden && !this.ended) this.togglePause(true);
    });
  }

  updatePreview(clientX, clientY) {
    const p = this.match.players[SIDE_PLAYER];
    if (this.selected < 0 || !p.deck.has(this.selected)) {
      this.preview = null;
      return;
    }
    const w = this.renderer.clientToWorld(clientX, clientY);
    if (w.x < 0 || w.x > 18 || w.y < 0 || w.y > 32) {
      this.preview = null;
      return;
    }
    const x = Math.round(w.x * 2) / 2;
    const y = Math.round(w.y * 2) / 2;
    const card = getCard(p.deck.hand[this.selected]);
    const check = this.match.canPlay(SIDE_PLAYER, this.selected, x, y);
    this.preview = { card, x, y, valid: check.ok, reason: check.reason };
  }

  tryPlay(x, y) {
    const res = this.match.playCard(SIDE_PLAYER, this.selected, x, y);
    if (res.ok) {
      this.selected = -1;
      this.preview = null;
    } else {
      this.app.audio.play('deny');
      toast(res.reason, 'bad');
      this.preview = null;
    }
  }

  // ---------------------------------------------------------------- pausa / fim

  togglePause(on) {
    if (this.ended || this.match.phase === PHASE.ENDED) return;
    this.paused = on;
    this.app.audio.play('click');
    if (!on) {
      this.overlay.replaceChildren();
      this.overlay.style.pointerEvents = 'none';
      this.overlay.style.background = '';
      this.last = performance.now();
      this.lastCountdown = -1;
      return;
    }
    this.drag = null;
    this.preview = null;
    this.overlay.style.pointerEvents = 'auto';
    this.overlay.style.background = 'rgba(5,6,14,0.75)';
    this.overlay.replaceChildren(
      h('div', { class: 'modal', style: { maxWidth: '320px' } },
        h('h2', {}, 'Pausa'),
        h('p', { class: 'muted small', style: { textAlign: 'center' } }, 'A partida contra a IA fica congelada enquanto pausada.'),
        h('div', { style: { display: 'grid', gap: '8px' } },
          h('button', { class: 'btn gold block', onclick: () => this.togglePause(false) }, 'Continuar'),
          h('button', { class: 'btn block', onclick: () => this.app.openSettings() }, 'Configurações'),
          h('button', { class: 'btn red block', onclick: () => this.forfeit() }, 'Desistir'),
        ),
      ),
    );
  }

  forfeit() {
    this.paused = false;
    this.overlay.replaceChildren();
    this.match.finish(1, 'Desistência');
    for (const ev of this.match.drainEvents()) this.onEvent(ev);
  }

  onEnd(result) {
    if (this.ended) return;
    this.ended = true;
    this.selected = -1;
    this.preview = null;
    const profile = this.app.profile;
    const summary = applyMatchResult(profile, result, { difficulty: this.difficulty, now: this.app.now(), rng: createRng(this.seed ^ 0xabc) });
    this.app.save();
    this.app.audio.setIntensity(0);
    const outcome = summary.outcome;
    this.fx.showBanner(outcome === 'win' ? 'Vitória!' : outcome === 'loss' ? 'Derrota' : 'Empate', outcome === 'win' ? '#f2c14e' : outcome === 'loss' ? '#ff7a6a' : '#c7d3de', 1.6);
    setTimeout(() => {
      if (!this.el.isConnected) return;
      this.app.audio.play(outcome === 'win' ? 'victory' : 'defeat');
      if (summary.levelUps.length) setTimeout(() => this.app.audio.play('levelup'), 900);
      this.showResult(result, summary);
    }, 1700);
  }

  showResult(result, summary) {
    const st = result.stats;
    const titles = { win: 'Vitória!', loss: 'Derrota', draw: 'Empate' };
    const crownRow = (side) => h('div', { class: 'crowns' }, [0, 1, 2].map((i) => icon('crown', i < result.crowns[side] ? (side === 0 ? '#5aa2ff' : '#ff6a5a') : '#3a3f5c')));
    const row = (label, a, b) => h('tr', {}, h('td', {}, label), h('td', { class: 'num' }, a), h('td', { class: 'num' }, b));
    const rewards = h('div', { class: 'rewards' },
      h('span', { class: 'pill' }, icon('xp'), `+${summary.xp} XP`),
      h('span', { class: 'pill' }, icon('coin'), `+${summary.coins}`),
      h('span', { class: 'pill' }, icon('trophy'), `${summary.trophyDelta >= 0 ? '+' : ''}${summary.trophyDelta}`),
      summary.chest ? h('span', { class: 'pill' }, icon('chest', CHEST_TYPES[summary.chest.type].color), CHEST_TYPES[summary.chest.type].name) : null,
    );
    const extras = [];
    if (summary.chestBlocked) extras.push(h('p', { class: 'small muted', style: { textAlign: 'center' } }, `Seus ${MAX_CHESTS} espaços de baú estão cheios — abra baús para ganhar novos.`));
    for (const up of summary.levelUps) {
      extras.push(h('div', { class: 'levelup' }, `Nível ${up.level}! +${up.coins} moedas`));
      if (up.unlocked.length) extras.push(h('p', { class: 'small', style: { textAlign: 'center' } }, 'Novas cartas: ', up.unlocked.map((id) => getCard(id).name).join(', ')));
    }
    if (summary.missionsCompleted.length) extras.push(h('p', { class: 'small', style: { textAlign: 'center', color: '#6ddc8e' } }, `Missão diária concluída! Resgate em Missões.`));

    this.overlay.className = 'overlay result';
    this.overlay.style.pointerEvents = 'auto';
    this.overlay.replaceChildren(
      h('div', { class: 'inner' },
        h('h1', { class: summary.outcome }, titles[summary.outcome]),
        h('p', { class: 'muted small', style: { textAlign: 'center', margin: 0 } }, `${result.reason} · ${fmtTime(result.time)}`),
        h('div', { class: 'crowns-big' }, crownRow(0), h('span', { class: 'vs' }, 'x'), crownRow(1)),
        rewards,
        ...extras,
        h('div', { class: 'panel' },
          h('table', { class: 'stats-table' },
            h('tr', {}, h('th', {}, 'Estatística'), h('th', { class: 'num' }, 'Você'), h('th', { class: 'num' }, 'IA')),
            row('Cartas jogadas', st[0].cardsPlayed, st[1].cardsPlayed),
            row('Éter gasto', st[0].energySpent, st[1].energySpent),
            row('Éter desperdiçado', st[0].energyWasted.toFixed(1), st[1].energyWasted.toFixed(1)),
            row('Dano em torres', Math.round(st[0].towerDamage), Math.round(st[1].towerDamage)),
            row('Dano total', Math.round(st[0].damageDealt), Math.round(st[1].damageDealt)),
            row('Tropas derrotadas', st[0].unitsKilled, st[1].unitsKilled),
            row('Torres destruídas', st[0].towersDestroyed, st[1].towersDestroyed),
          ),
          st[0].energyWasted > 4 ? h('p', { class: 'small muted', style: { marginBottom: 0 } }, 'Dica: você ficou com o Éter cheio por um tempo. Jogue cartas baratas para não desperdiçar recursos.') : null,
        ),
        h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' } },
          h('button', { class: 'btn', onclick: () => this.app.go('home') }, 'Menu'),
          h('button', { class: 'btn gold', onclick: () => this.app.startBattle(this.difficulty) }, 'Jogar novamente'),
        ),
      ),
    );
  }
}

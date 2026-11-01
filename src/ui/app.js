// Aplicação: navegação entre telas, menus, coleção, loja, missões, perfil e configurações.
import { CARDS, CARD_MAP, RARITIES, getCard } from '../data/cards.js';
import { DIFFICULTIES } from '../data/decks.js';
import { ARENAS, arenaForLevel } from '../data/modes.js';
import { createRng } from '../core/rng.js';
import {
  xpToNext, activeDeck, upgradeCost, canUpgrade, upgradeCard, setDeckCard, isUnlocked, DECK_SLOTS, MAX_CHESTS, averageDeckLevel,
} from '../progression/profile.js';
import {
  CHEST_TYPES, chestStatus, startUnlock, openChest, rushCost, shopOffers, buyOffer, claimFreeGift, isOfferBought, dayKey,
} from '../progression/economy.js';
import { ensureDailyMissions, missionDef, claimMission, ACHIEVEMENTS, achievementState, claimAchievement } from '../progression/missions.js';
import { AudioEngine } from '../audio/audio.js';
import { Battle } from './battle.js';
import { h, icon, cardEl, cardStatRows, openModal, toast, confirmModal, fmtTime } from './dom.js';
import { Renderer } from '../render/renderer.js';
import { Match } from '../sim/match.js';
import { STARTER_DECK } from '../data/decks.js';

const TABS = [
  { id: 'shop', label: 'Loja', icon: 'shop' },
  { id: 'collection', label: 'Cartas', icon: 'cards' },
  { id: 'home', label: 'Batalha', icon: 'swords' },
  { id: 'missions', label: 'Missões', icon: 'scroll' },
  { id: 'profile', label: 'Perfil', icon: 'person' },
];

export class App {
  constructor(root, storage, { now = () => Date.now() } = {}) {
    this.root = root;
    this.storage = storage;
    this.now = now;
    const loaded = storage.load(now());
    this.profile = loaded.profile;
    this.recovered = loaded.recovered;
    this.audio = new AudioEngine();
    this.audio.apply(this.profile.settings);
    this.screen = 'home';
    this.battle = null;
    this.swapCard = null;
    this.ticker = null;
    this.rng = createRng((now() ^ 0x5bd1e995) >>> 0);
  }

  start() {
    const unlock = () => {
      this.audio.unlock();
      if (!this.battle) this.audio.startMusic('menu');
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    window.addEventListener('pagehide', () => this.save());
    ensureDailyMissions(this.profile, this.now());
    this.go('home');
    if (this.recovered) toast('Seu salvamento estava corrompido e foi reiniciado.', 'bad');
    if (!this.profile.tutorialDone) this.openTutorial();
    this.ticker = setInterval(() => this.tick(), 1000);
  }

  save() {
    if (!this.storage.save(this.profile)) toast('Não foi possível salvar o progresso.', 'bad');
  }

  tick() {
    if (this.battle) return;
    if (this.screen === 'home') {
      const slots = this.root.querySelector('.chests');
      if (slots) slots.replaceWith(this.chestSlots());
    }
  }

  // ---------------------------------------------------------------- navegação

  go(screen) {
    if (this.battle) {
      this.battle.destroy();
      this.battle = null;
      this.audio.startMusic('menu');
    }
    this.screen = screen;
    if (screen !== 'collection') this.swapCard = null;
    this.render();
  }

  render() {
    const content = h('div', { class: 'content' });
    switch (this.screen) {
      case 'shop': this.renderShop(content); break;
      case 'collection': this.renderCollection(content); break;
      case 'missions': this.renderMissions(content); break;
      case 'profile': this.renderProfile(content); break;
      default: this.renderHome(content);
    }
    const scroll = this.root.querySelector('.content')?.scrollTop || 0;
    const sameScreen = this.root.dataset.screen === this.screen;
    this.root.dataset.screen = this.screen;
    this.root.replaceChildren(h('div', { class: 'shell' }, this.topbar(), content, this.nav()));
    if (sameScreen) content.scrollTop = scroll;
    if (this.screen === 'home') this.drawArenaPreview();
  }

  refresh() {
    this.save();
    this.render();
  }

  topbar() {
    const p = this.profile;
    const need = xpToNext(p.level);
    const gear = h('button', { class: 'icon-btn', 'aria-label': 'Configurações', onclick: () => this.openSettings() });
    gear.append(icon('gear'));
    return h('div', { class: 'topbar' },
      h('div', { class: 'lvl-badge', title: 'Nível' }, p.level),
      h('div', { class: 'player-info' },
        h('div', { class: 'player-name' }, p.name),
        h('div', { class: 'xpbar' }, h('i', { style: { width: `${Math.min(100, (p.xp / need) * 100)}%` } })),
        h('div', { class: 'xptext' }, `${p.xp}/${need} XP`),
      ),
      h('span', { class: 'pill', title: 'Troféus' }, icon('trophy'), p.trophies),
      h('span', { class: 'pill', title: 'Moedas' }, icon('coin'), p.coins),
      gear,
    );
  }

  nav() {
    const now = this.now();
    const missionsReady = ensureDailyMissions(this.profile, now).some((m) => !m.claimed && m.progress >= missionDef(m.id).target)
      || ACHIEVEMENTS.some((a) => achievementState(this.profile, a.id) === 'ready');
    const upgradable = Object.keys(this.profile.cards).some((id) => canUpgrade(this.profile, id).ok);
    const giftReady = !(this.profile.shop.day === dayKey(now) && this.profile.shop.freeClaimed);
    const dots = { missions: missionsReady, collection: upgradable, shop: giftReady };
    return h('nav', { class: 'nav' }, TABS.map((t) => {
      const b = h('button', { class: this.screen === t.id ? 'active' : '', onclick: () => { this.audio.play('click'); this.go(t.id); }, 'aria-label': t.label });
      b.append(icon(t.icon), h('span', {}, t.label));
      if (dots[t.id]) b.append(h('i', { class: 'dot' }));
      return b;
    }));
  }

  // ---------------------------------------------------------------- início

  renderHome(c) {
    const p = this.profile;
    const arena = arenaForLevel(p.level);
    const nextArena = ARENAS.find((a) => a.unlockLevel > p.level);
    const deck = activeDeck(p);
    const diff = p.settings.difficulty;
    c.append(
      h('div', { class: 'arena-hero' },
        h('canvas', { id: 'arena-preview' }),
        h('div', { class: 'label' },
          h('h1', {}, arena.name),
          h('div', { class: 'muted small' }, nextArena ? `Próxima arena: ${nextArena.name} (nível ${nextArena.unlockLevel})` : 'Todas as arenas desbloqueadas'),
        ),
      ),
      h('div', { class: 'panel' },
        h('h3', {}, 'Dificuldade da IA'),
        h('div', { class: 'seg', role: 'radiogroup' }, Object.values(DIFFICULTIES).map((d) => h('button', {
          class: diff === d.id ? 'active' : '', role: 'radio', 'aria-checked': String(diff === d.id),
          onclick: () => { p.settings.difficulty = d.id; this.audio.play('click'); this.refresh(); },
        }, d.label, h('span', { class: 'sub' }, `Recompensa x${d.rewardMult}`)))),
        h('div', { style: { height: '12px' } }),
        h('button', { class: 'btn gold battle-btn', onclick: () => this.startBattle(diff) }, 'BATALHAR'),
      ),
      h('div', { class: 'panel' },
        h('div', { class: 'row', style: { marginBottom: '8px' } },
          h('h3', { style: { margin: 0 } }, `Baralho ${p.activeDeck + 1}`),
          h('span', { class: 'muted small' }, `Custo médio ${(deck.reduce((s, id) => s + CARD_MAP[id].cost, 0) / 8).toFixed(1)}`),
          h('div', { class: 'spacer' }),
          h('button', { class: 'btn small', onclick: () => this.go('collection') }, 'Editar'),
        ),
        h('div', { class: 'deck-mini' }, deck.map((id) => {
          const img = cardEl(getCard(id), { showName: false });
          img.style.cursor = 'default';
          return img;
        })),
      ),
      h('div', { class: 'panel' },
        h('div', { class: 'row', style: { marginBottom: '8px' } }, h('h3', { style: { margin: 0 } }, 'Baús'), h('div', { class: 'spacer' }), h('span', { class: 'muted small' }, 'Vença partidas para ganhar baús')),
        this.chestSlots(),
      ),
      h('button', { class: 'btn block', onclick: () => this.openTutorial() }, 'Como jogar'),
    );
  }

  drawArenaPreview() {
    const canvas = this.root.querySelector('#arena-preview');
    if (!canvas) return;
    try {
      const r = new Renderer(canvas, arenaForLevel(this.profile.level).palette);
      r.resize();
      const m = new Match({ decks: [STARTER_DECK, STARTER_DECK], seed: 1, rules: { countdown: 0 } });
      // Visão cortada no rio: centraliza o miolo da arena
      r.scale = canvas.width / 18;
      r.offX = 0;
      r.offY = canvas.height / 2 - 16 * r.scale;
      r.buildBackground();
      r.render(m, 1, { time: 0, particles: [], rings: [], texts: [], meteors: [], arrows: [], beams: [], slashes: [], zaps: [], shake: 0, flash: 0, banner: null }, {});
    } catch (err) {
      console.warn('Prévia da arena indisponível', err);
    }
  }

  chestSlots() {
    const now = this.now();
    const p = this.profile;
    const slots = [];
    for (let i = 0; i < MAX_CHESTS; i++) {
      const chest = p.chests[i];
      if (!chest) {
        slots.push(h('div', { class: 'chest-slot' }, 'Espaço vazio'));
        continue;
      }
      const def = CHEST_TYPES[chest.type];
      const st = chestStatus(chest, now);
      const label = st.state === 'ready' ? 'Abrir!' : st.state === 'unlocking' ? fmtTime(st.remaining) : `Destrancar ${fmtTime(def.unlockSec)}`;
      const el = h('button', { class: `chest-slot filled ${st.state === 'ready' ? 'ready' : ''}`, onclick: () => this.onChest(chest.id) },
        icon('chest', def.color), h('div', {}, def.name.replace('Baú de ', '').replace('Baú ', '')), h('div', { class: 't' }, label));
      el.firstElementChild.style.width = '34px';
      el.firstElementChild.style.height = '34px';
      slots.push(el);
    }
    return h('div', { class: 'chests' }, slots);
  }

  onChest(id) {
    const now = this.now();
    const chest = this.profile.chests.find((c) => c.id === id);
    if (!chest) return;
    const st = chestStatus(chest, now);
    const def = CHEST_TYPES[chest.type];
    if (st.state === 'ready') {
      const res = openChest(this.profile, id, now, this.rng);
      if (res.ok) this.showChestRewards(res);
      return;
    }
    const cost = rushCost(chest, now);
    const anyUnlocking = this.profile.chests.some((c) => chestStatus(c, now).state === 'unlocking');
    const m = openModal([
      h('h2', {}, def.name),
      h('div', { style: { display: 'grid', placeItems: 'center' } }, (() => { const i = icon('chest', def.color); i.style.width = '80px'; i.style.height = '80px'; return i; })()),
      h('p', { class: 'muted', style: { textAlign: 'center' } }, `Contém ${def.coins[0]}–${def.coins[1]} moedas e ~${def.cards} cartas.`, def.minRarity ? ` Ao menos uma carta ${RARITIES[def.minRarity].label.toLowerCase()} ou melhor (se desbloqueada).` : ''),
      h('p', { style: { textAlign: 'center' } }, st.state === 'unlocking' ? `Destrancando: ${fmtTime(st.remaining)}` : `Tempo para destrancar: ${fmtTime(def.unlockSec)}`),
      h('div', { class: 'actions' },
        st.state === 'locked' ? h('button', { class: 'btn blue', disabled: anyUnlocking, title: anyUnlocking ? 'Já há um baú destrancando' : '', onclick: () => {
          const r = startUnlock(this.profile, id, this.now());
          if (!r.ok) toast(r.reason, 'bad');
          m.close();
          this.refresh();
        } }, anyUnlocking ? 'Outro baú destrancando' : 'Destrancar') : null,
        h('button', { class: 'btn gold', disabled: this.profile.coins < cost, onclick: () => {
          const r = openChest(this.profile, id, this.now(), this.rng, { rush: true });
          m.close();
          if (r.ok) this.showChestRewards(r);
          else toast(r.reason, 'bad');
        } }, icon('coin'), `Abrir agora (${cost})`),
      ),
    ]);
  }

  showChestRewards(res, title) {
    this.audio.play('chest');
    this.save();
    const def = CHEST_TYPES[res.type];
    const cards = Object.entries(res.cards || {});
    openModal([
      h('h2', {}, title || def?.name || 'Recompensas'),
      res.coins ? h('div', { class: 'rewards' }, h('span', { class: 'pill' }, icon('coin'), `+${res.coins}`)) : null,
      h('div', { class: 'reward-grid' }, cards.map(([id, qty], i) => {
        const el = cardEl(getCard(id));
        el.style.animationDelay = `${i * 0.12}s`;
        el.append(h('span', { class: 'qty' }, `x${qty}`));
        return el;
      })),
      ...(res.levelUps || []).map((u) => h('div', { class: 'levelup' }, `Nível ${u.level}!`)),
      h('div', { class: 'actions' }, h('button', { class: 'btn gold', onclick: (e) => e.target.closest('.modal-back').click() }, 'Coletar')),
    ], { onClose: () => this.refresh() });
  }

  startBattle(difficulty) {
    this.audio.unlock();
    this.audio.play('click');
    if (this.battle) this.battle.destroy();
    clearInterval(this.ticker);
    this.ticker = setInterval(() => this.tick(), 1000);
    this.screen = 'battle';
    this.root.dataset.screen = 'battle';
    this.battle = new Battle(this, { difficulty });
    this.battle.mount(this.root);
  }

  // ---------------------------------------------------------------- coleção / baralho

  renderCollection(c) {
    const p = this.profile;
    const deck = activeDeck(p);
    const avg = deck.reduce((s, id) => s + CARD_MAP[id].cost, 0) / 8;
    const deckGrid = h('div', { class: 'card-grid' }, deck.map((id, idx) => {
      const entry = p.cards[id];
      const cost = upgradeCost(p, id);
      const el = cardEl(getCard(id), {
        level: entry.level, copies: cost ? entry.copies : null, needed: cost ? cost.copies : null,
        extraClass: this.swapCard ? 'swap-target' : '',
        onClick: () => {
          if (this.swapCard) {
            const r = setDeckCard(p, idx, this.swapCard);
            if (!r.ok) toast(r.reason, 'bad');
            else toast(`${getCard(this.swapCard).name} entrou no baralho`, 'good');
            this.swapCard = null;
            this.audio.play('select');
            this.refresh();
          } else this.openCardDetail(id);
        },
      });
      if (canUpgrade(p, id).ok) el.append(h('span', { class: 'badge-up' }, '↑'));
      return el;
    }));
    const sorted = CARDS.slice().sort((a, b) => (isUnlocked(p, b.id) - isUnlocked(p, a.id)) || a.unlockLevel - b.unlockLevel || a.cost - b.cost);
    const collection = h('div', { class: 'card-grid' }, sorted.filter((card) => !deck.includes(card.id)).map((card) => {
      const entry = p.cards[card.id];
      const locked = !entry;
      const cost = entry ? upgradeCost(p, card.id) : null;
      const el = cardEl(card, {
        locked, level: entry?.level, copies: cost ? entry.copies : null, needed: cost ? cost.copies : null,
        onClick: () => this.openCardDetail(card.id),
      });
      if (entry && canUpgrade(p, card.id).ok) el.append(h('span', { class: 'badge-up' }, '↑'));
      return el;
    }));
    c.append(
      h('div', { class: 'panel' },
        h('div', { class: 'tabs' }, Array.from({ length: DECK_SLOTS }, (_, i) => h('button', {
          class: p.activeDeck === i ? 'active' : '', onclick: () => { p.activeDeck = i; this.swapCard = null; this.audio.play('click'); this.refresh(); },
        }, `Baralho ${i + 1}`))),
        this.swapCard
          ? h('div', { class: 'row', style: { marginBottom: '8px' } }, h('b', { style: { color: '#6fb0ff' } }, `Toque em uma carta para trocar por ${getCard(this.swapCard).name}`), h('div', { class: 'spacer' }), h('button', { class: 'btn small', onclick: () => { this.swapCard = null; this.render(); } }, 'Cancelar'))
          : h('div', { class: 'row', style: { marginBottom: '8px' } }, h('span', { class: 'muted small' }, `Custo médio de Éter: ${avg.toFixed(1)} · Nível médio ${averageDeckLevel(p).toFixed(1)}`)),
        deckGrid,
      ),
      h('h2', {}, `Coleção (${Object.keys(p.cards).length}/${CARDS.length})`),
      collection,
    );
  }

  openCardDetail(id) {
    const p = this.profile;
    const card = getCard(id);
    const entry = p.cards[id];
    const level = entry ? entry.level : 1;
    const cost = entry ? upgradeCost(p, id) : null;
    const up = entry ? canUpgrade(p, id) : { ok: false, reason: `Desbloqueia no nível ${card.unlockLevel}` };
    const rarity = RARITIES[card.rarity];
    const inDeck = activeDeck(p).includes(id);
    const rows = cardStatRows(card, level);
    const typeLabel = { troop: 'Tropa', building: 'Construção', spell: 'Feitiço' }[card.type];
    let m = null;
    m = openModal([
      h('div', { class: 'card-detail' },
        cardEl(card, { level: entry ? level : null, locked: !entry }),
        h('div', {},
          h('h2', { style: { textAlign: 'left', marginBottom: '4px' } }, card.name),
          h('span', { class: 'rarity-tag', style: { background: rarity.color } }, rarity.label), ' ',
          h('span', { class: 'muted small' }, `${typeLabel} · ${card.role}`),
          h('p', { class: 'small', style: { lineHeight: 1.4 } }, card.description),
          h('div', { class: 'tags' }, card.tags.map((t) => h('span', {}, t))),
        ),
      ),
      h('table', { class: 'stats-table', style: { marginTop: '10px' } },
        h('tr', {}, h('th', {}, 'Atributo'), h('th', { class: 'num' }, `Nível ${level}`), cost ? h('th', { class: 'num' }, `Nível ${level + 1}`) : null),
        rows.map((r) => h('tr', {}, h('td', {}, r.label), h('td', { class: 'num' }, r.now), cost ? h('td', { class: 'num up' }, r.next != null && r.next !== r.now ? r.next : '') : null)),
      ),
      entry && cost ? h('p', { class: 'small muted', style: { textAlign: 'center' } }, `Melhoria: ${entry.copies}/${cost.copies} cópias e ${cost.coins} moedas`) : null,
      entry && !cost ? h('p', { class: 'small', style: { textAlign: 'center', color: '#f2c14e' } }, 'Nível máximo alcançado!') : null,
      h('div', { class: 'actions' },
        entry && !inDeck ? h('button', { class: 'btn blue', onclick: () => { this.swapCard = id; m.close(); this.go('collection'); } }, 'Usar') : null,
        entry ? h('button', { class: 'btn green', disabled: !up.ok, title: up.ok ? '' : up.reason, onclick: () => {
          const r = upgradeCard(p, id);
          if (r.ok) {
            this.audio.play('levelup');
            toast(`${card.name} subiu para o nível ${r.level}!`, 'good');
            m.close();
            this.refresh();
            this.openCardDetail(id);
          } else toast(r.reason, 'bad');
        } }, up.ok ? `Melhorar (${cost.coins})` : (cost ? up.reason : 'Máximo')) : null,
        h('button', { class: 'btn', onclick: () => m.close() }, 'Fechar'),
      ),
    ]);
  }

  // ---------------------------------------------------------------- loja

  renderShop(c) {
    const p = this.profile;
    const now = this.now();
    const offers = shopOffers(p, now);
    const freeClaimed = p.shop.day === dayKey(now) && p.shop.freeClaimed;
    const buy = (offer) => {
      const res = buyOffer(p, offer.id, this.now(), this.rng);
      if (!res.ok) {
        this.audio.play('deny');
        toast(res.reason, 'bad');
        return;
      }
      this.audio.play('coins');
      if (offer.kind === 'chest') this.showChestRewards(res);
      else {
        toast(`Comprado: ${offer.name}`, 'good');
        this.refresh();
      }
    };
    c.append(
      h('div', { class: 'panel' },
        h('div', { class: 'row' },
          (() => { const i = icon('chest', CHEST_TYPES.madeira.color); i.style.width = '46px'; i.style.height = '46px'; return i; })(),
          h('div', { class: 'grow', style: { flex: 1 } }, h('h3', { style: { margin: 0 } }, 'Presente diário'), h('div', { class: 'muted small' }, freeClaimed ? 'Volte amanhã para outro presente.' : 'Um Baú de Madeira grátis por dia.')),
          h('button', { class: 'btn green', disabled: freeClaimed, onclick: () => {
            const r = claimFreeGift(p, this.now(), this.rng);
            if (r.ok) this.showChestRewards(r, 'Presente diário');
            else toast(r.reason, 'bad');
          } }, freeClaimed ? 'Resgatado' : 'Resgatar'),
        ),
      ),
      h('h2', {}, 'Ofertas do dia'),
      h('div', { class: 'offer-grid', style: { marginBottom: '14px' } }, offers.filter((o) => o.kind === 'card').map((o) => {
        const bought = isOfferBought(p, o.id, now);
        const card = getCard(o.cardId);
        return h('div', { class: 'offer' },
          cardEl(card, { showName: false }),
          h('div', { class: 't' }, o.name),
          h('button', { class: 'btn small gold', disabled: bought || p.coins < o.price, onclick: () => buy(o) }, bought ? 'Comprado' : [icon('coin'), ` ${o.price}`]),
        );
      })),
      h('h2', {}, 'Baús'),
      h('div', { class: 'offer-grid', style: { gridTemplateColumns: '1fr 1fr' } }, offers.filter((o) => o.kind === 'chest').map((o) => {
        const def = CHEST_TYPES[o.chest];
        const ic = icon('chest', def.color);
        ic.style.width = '64px';
        ic.style.height = '64px';
        return h('div', { class: 'offer' }, ic, h('div', { class: 't' }, `${o.name} · ~${def.cards} cartas`),
          h('button', { class: 'btn small gold', disabled: p.coins < o.price, onclick: () => buy(o) }, icon('coin'), ` ${o.price}`));
      })),
      h('p', { class: 'muted small', style: { textAlign: 'center' } }, 'Todos os itens são comprados com moedas ganhas jogando. Ofertas renovam diariamente.'),
    );
  }

  // ---------------------------------------------------------------- missões

  renderMissions(c) {
    const p = this.profile;
    const list = ensureDailyMissions(p, this.now());
    c.append(
      h('h2', {}, 'Missões diárias'),
      ...list.map((m) => {
        const def = missionDef(m.id);
        const done = m.progress >= def.target;
        return h('div', { class: 'list-item' },
          h('div', { class: 'grow' },
            h('b', {}, def.text),
            h('div', { class: 'small muted' }, `Recompensa: ${def.coins} moedas · ${def.xp} XP`),
            h('div', { class: 'progress' }, h('i', { style: { width: `${(m.progress / def.target) * 100}%` } })),
            h('div', { class: 'small muted' }, `${Math.floor(m.progress)}/${def.target}`),
          ),
          h('button', { class: `btn small ${done && !m.claimed ? 'gold' : ''}`, disabled: !done || m.claimed, onclick: () => {
            const r = claimMission(p, m.id, this.now());
            if (r.ok) {
              this.audio.play('coins');
              toast(`+${r.coins} moedas, +${r.xp} XP`, 'good');
              this.refresh();
            } else toast(r.reason, 'bad');
          } }, m.claimed ? 'Resgatada' : 'Resgatar'),
        );
      }),
      h('p', { class: 'muted small' }, 'Novas missões a cada dia.'),
      h('h2', { style: { marginTop: '16px' } }, 'Conquistas'),
      ...ACHIEVEMENTS.map((a) => {
        const st = achievementState(p, a.id);
        return h('div', { class: 'list-item', style: { opacity: st === 'locked' ? 0.7 : 1 } },
          icon('trophy'),
          h('div', { class: 'grow' }, h('b', {}, a.text), h('div', { class: 'small muted' }, `${a.desc} · ${a.coins} moedas`)),
          h('button', { class: `btn small ${st === 'ready' ? 'gold' : ''}`, disabled: st !== 'ready', onclick: () => {
            const r = claimAchievement(p, a.id);
            if (r.ok) {
              this.audio.play('coins');
              toast(`Conquista resgatada: +${r.coins} moedas`, 'good');
              this.refresh();
            }
          } }, st === 'claimed' ? 'Concluída' : st === 'ready' ? 'Resgatar' : 'Bloqueada'),
        );
      }),
    );
  }

  // ---------------------------------------------------------------- perfil

  renderProfile(c) {
    const p = this.profile;
    const s = p.stats;
    const winRate = s.matches ? Math.round((s.wins / s.matches) * 100) : 0;
    const nameInput = h('input', { class: 'input', value: p.name, maxlength: '20', 'aria-label': 'Nome do jogador' });
    nameInput.addEventListener('change', () => {
      const v = nameInput.value.trim().slice(0, 20);
      if (v) {
        p.name = v;
        this.refresh();
        toast('Nome atualizado', 'good');
      }
    });
    const stat = (label, value) => h('tr', {}, h('td', {}, label), h('td', { class: 'num' }, value));
    const resultLabel = { win: 'Vitória', loss: 'Derrota', draw: 'Empate' };
    c.append(
      h('div', { class: 'panel' }, h('div', { class: 'field' }, h('label', {}, 'Nome do comandante'), nameInput)),
      h('div', { class: 'panel' },
        h('h3', {}, 'Estatísticas'),
        h('table', { class: 'stats-table' },
          stat('Nível', p.level), stat('Troféus', p.trophies), stat('Partidas', s.matches), stat('Vitórias', s.wins), stat('Derrotas', s.losses),
          stat('Empates', s.draws), stat('Taxa de vitória', `${winRate}%`), stat('Vitórias com 3 coroas', s.threeCrowns),
          stat('Vitórias no Difícil', s.hardWins), stat('Torres destruídas', s.towersDestroyed), stat('Cartas jogadas', s.cardsPlayed),
          stat('Baús abertos', s.chestsOpened), stat('Melhorias de cartas', s.upgrades),
        ),
      ),
      h('h2', {}, 'Últimas partidas'),
      p.history.length ? p.history.map((m) => h('div', { class: `hist ${m.result}` },
        h('span', { class: 'r' }, resultLabel[m.result]),
        h('span', {}, `${m.crowns[0]} x ${m.crowns[1]} · ${DIFFICULTIES[m.difficulty]?.label || m.difficulty} · ${fmtTime(m.duration)}`, h('div', { class: 'small muted' }, new Date(m.date).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }))),
        h('span', { class: 'small' }, `${m.trophies >= 0 ? '+' : ''}${m.trophies} 🏆`),
      )) : h('p', { class: 'muted' }, 'Nenhuma partida jogada ainda.'),
    );
  }

  // ---------------------------------------------------------------- configurações e tutorial

  openSettings() {
    const s = this.profile.settings;
    const apply = () => {
      this.audio.apply(s);
      if (this.battle) this.battle.fx.setOptions(s);
      this.save();
    };
    const slider = (key, label) => {
      const val = h('span', {}, `${Math.round(s[key] * 100)}%`);
      const input = h('input', { type: 'range', min: '0', max: '100', value: String(Math.round(s[key] * 100)), 'aria-label': label });
      input.addEventListener('input', () => {
        s[key] = Number(input.value) / 100;
        val.textContent = `${input.value}%`;
        apply();
      });
      input.addEventListener('change', () => this.audio.play(key === 'sfx' ? 'coins' : 'click'));
      return h('div', { class: 'field' }, h('label', {}, label, val), input);
    };
    const toggle = (key, label) => {
      const input = h('input', { type: 'checkbox' });
      input.checked = !!s[key];
      input.addEventListener('change', () => {
        s[key] = input.checked;
        apply();
      });
      return h('label', { class: 'toggle' }, label, input);
    };
    const m = openModal([
      h('h2', {}, 'Configurações'),
      slider('music', 'Música'),
      slider('sfx', 'Efeitos sonoros'),
      toggle('muted', 'Silenciar tudo'),
      toggle('damageNumbers', 'Mostrar números de dano'),
      toggle('reducedEffects', 'Efeitos reduzidos (desempenho)'),
      h('div', { style: { display: 'grid', gap: '8px', marginTop: '14px' } },
        h('button', { class: 'btn', onclick: () => { m.close(); this.openTutorial(); } }, 'Rever tutorial'),
        this.battle ? null : h('button', { class: 'btn red', onclick: async () => {
          m.close();
          if (await confirmModal('Apagar progresso?', 'Todo o progresso (nível, cartas, moedas e histórico) será apagado permanentemente.', { okLabel: 'Apagar' })) {
            this.storage.reset();
            this.profile = this.storage.load(this.now()).profile;
            this.save();
            this.audio.apply(this.profile.settings);
            this.go('home');
            toast('Progresso reiniciado');
          }
        } }, 'Apagar progresso'),
      ),
      h('div', { class: 'actions' }, h('button', { class: 'btn gold', onclick: () => m.close() }, 'Fechar')),
    ]);
  }

  openTutorial() {
    const steps = [
      { big: '🏰', title: 'Bem-vindo aos Bastiões do Éter', text: 'Destrua a Torre do Rei inimiga para vencer na hora. Se o tempo acabar, vence quem tiver mais coroas — cada torre destruída vale uma.' },
      { big: '🃏', title: 'Cartas e Éter', text: 'Você tem 4 cartas na mão. Arraste uma carta (ou toque nela e depois na arena) para invocá-la. Cada carta custa Éter, que se regenera sozinho até 10. No último minuto, a regeneração dobra!' },
      { big: '🗺️', title: 'Onde invocar', text: 'Tropas e construções só podem ser posicionadas no seu lado do rio. Ao destruir uma torre auxiliar inimiga, você pode avançar nessa lateral. Feitiços podem ser lançados em qualquer lugar.' },
      { big: '⚔️', title: 'Vença pela estratégia', text: 'Tropas aéreas só são atingidas por quem mira o céu. Enxames derretem com dano em área. Tanques precisam de muito dano concentrado. Defenda com eficiência e contra-ataque com o que sobrar!' },
    ];
    let i = 0;
    const body = h('div');
    let m = null;
    const draw = () => {
      const st = steps[i];
      body.replaceChildren(
        h('div', { class: 'tut-step' },
          h('div', { class: 'big' }, st.big),
          h('h2', {}, st.title),
          h('p', {}, st.text),
          h('div', { class: 'dots' }, steps.map((_, k) => h('i', { class: k === i ? 'on' : '' }))),
        ),
        h('div', { class: 'actions' },
          i > 0 ? h('button', { class: 'btn', onclick: () => { i--; draw(); } }, 'Voltar') : h('button', { class: 'btn', onclick: () => m.close() }, 'Pular'),
          h('button', { class: 'btn gold', onclick: () => { if (i < steps.length - 1) { i++; draw(); } else m.close(); } }, i < steps.length - 1 ? 'Próximo' : 'Entendi!'),
        ),
      );
    };
    draw();
    m = openModal(body, { onClose: () => { this.profile.tutorialDone = true; this.save(); } });
  }
}

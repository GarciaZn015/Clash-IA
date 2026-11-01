// Utilitários de DOM, ícones SVG, modais e toasts.
import { RARITIES, levelMult } from '../data/cards.js';
import { getUnit } from '../data/units.js';
import { cardArtURL } from '../render/sprites.js';

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

const svg = (body, vb = '0 0 24 24') => `<svg viewBox="${vb}" class="ico" aria-hidden="true">${body}</svg>`;

export const ICONS = {
  coin: svg('<circle cx="12" cy="12" r="10" fill="#f2c14e" stroke="#8e6312" stroke-width="2"/><circle cx="12" cy="12" r="5.5" fill="none" stroke="#b9861d" stroke-width="2"/>'),
  trophy: svg('<path d="M7 3h10v4a5 5 0 0 1-10 0z" fill="#f2c14e" stroke="#8e6312" stroke-width="1.5"/><path d="M7 5H4a3 3 0 0 0 3 4M17 5h3a3 3 0 0 1-3 4" fill="none" stroke="#8e6312" stroke-width="1.5"/><rect x="10" y="12" width="4" height="5" fill="#d9a531"/><rect x="7" y="17" width="10" height="3" rx="1" fill="#8e6312"/>'),
  gear: svg('<path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z" fill="none" stroke="#dfe2f2" stroke-width="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" stroke="#dfe2f2" stroke-width="2" stroke-linecap="round"/>'),
  pause: svg('<rect x="6" y="5" width="4" height="14" rx="1" fill="#dfe2f2"/><rect x="14" y="5" width="4" height="14" rx="1" fill="#dfe2f2"/>'),
  crown: (color) => svg(`<path d="M3 18 2 7l5.5 4L12 4l4.5 7L22 7l-1 11z" fill="${color}" stroke="#1a1405" stroke-width="1.5" stroke-linejoin="round"/>`),
  shop: svg('<path d="M4 9h16l-1 11H5z" fill="currentColor" opacity=".9"/><path d="M8 9V7a4 4 0 0 1 8 0v2" fill="none" stroke="currentColor" stroke-width="2"/>'),
  cards: svg('<rect x="3" y="5" width="11" height="15" rx="2" fill="currentColor" opacity=".6" transform="rotate(-10 8 12)"/><rect x="10" y="4" width="11" height="15" rx="2" fill="currentColor"/>'),
  swords: svg('<path d="M4 4l10 10M20 4 10 14" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><path d="M6 16l2 2-3 3-2-2zM18 16l-2 2 3 3 2-2z" fill="currentColor"/>'),
  scroll: svg('<path d="M6 3h11a3 3 0 0 1 3 3v1h-4v11a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-1h3z" fill="currentColor" opacity=".9"/><path d="M8 8h6M8 12h6M8 16h4" stroke="#171b2e" stroke-width="1.6"/>'),
  person: svg('<circle cx="12" cy="8" r="4" fill="currentColor"/><path d="M4 21a8 8 0 0 1 16 0z" fill="currentColor"/>'),
  chest: (color = '#a4703f') => svg(`<rect x="3" y="10" width="18" height="10" rx="1.5" fill="${color}" stroke="#2a1a0c" stroke-width="1.5"/><path d="M3 10a9 5 0 0 1 18 0z" fill="${color}" stroke="#2a1a0c" stroke-width="1.5" filter="brightness(1.15)"/><rect x="10" y="10" width="4" height="5" rx="1" fill="#f2c14e" stroke="#2a1a0c"/>`),
  xp: svg('<path d="M12 2l3 7h7l-5.5 4.5L18.5 21 12 16.5 5.5 21l2-7.5L2 9h7z" fill="#6fb6ff" stroke="#183f86" stroke-width="1.2"/>'),
  energy: svg('<path d="M12 2c4 5 7 8 7 12a7 7 0 0 1-14 0c0-4 3-7 7-12z" fill="#b46cf0" stroke="#3a1060" stroke-width="1.5"/>'),
};

export function icon(name, ...args) {
  const v = ICONS[name];
  const html = typeof v === 'function' ? v(...args) : v;
  const span = document.createElement('span');
  span.innerHTML = html;
  return span.firstElementChild;
}

// ------------------------------------------------------------ componentes de carta

const TARGETS_LABEL = { ground: 'Terrestres', both: 'Aéreos e terrestres', buildings: 'Construções', none: '—' };
const SPEED_LABEL = (v) => (v >= 1.9 ? 'Muito rápida' : v >= 1.4 ? 'Rápida' : v >= 0.95 ? 'Média' : v > 0 ? 'Lenta' : '—');

export function cardEl(card, { level = null, copies = null, needed = null, locked = false, onClick, extraClass = '', showName = true } = {}) {
  const r = RARITIES[card.rarity];
  const el = h('div', { class: `card ${locked ? 'locked' : ''} ${extraClass}`, style: { '--rc': r.color }, role: 'button', tabindex: '0', 'data-card': card.id, 'aria-label': `${card.name}, custo ${card.cost}` },
    h('img', { class: 'art', src: cardArtURL(card), alt: '', draggable: 'false' }),
    h('div', { class: 'cost' }, card.cost),
    showName ? h('div', { class: 'name' }, card.name) : null,
  );
  if (level != null && !locked) el.append(h('div', { class: 'lv' }, `Nível ${level}`));
  if (copies != null && needed != null && !locked) {
    const full = copies >= needed;
    el.append(h('div', { class: `copies ${full ? 'full' : ''}` }, h('i', { style: { width: `${Math.min(100, (copies / needed) * 100)}%` } }), h('span', {}, `${copies}/${needed}`)));
  }
  if (locked) el.append(h('div', { class: 'lockmsg' }, `Nível ${card.unlockLevel}`));
  if (onClick) {
    el.addEventListener('click', onClick);
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick(e);
      }
    });
  }
  return el;
}

/** Linhas de atributos da carta em um nível (e no próximo, para comparação). */
export function cardStatRows(card, level) {
  const m = levelMult(level);
  const m2 = levelMult(level + 1);
  const rows = [];
  const add = (label, base, fmt = (v) => Math.round(v), scales = true) => rows.push({ label, now: fmt(scales ? base * m : base), next: scales ? fmt(base * m2) : null });
  if (card.type === 'spell') {
    const s = card.spell;
    if (s.damage) add(s.waves ? `Dano total (${s.waves} ondas)` : 'Dano', s.damage);
    if (s.damage) add('Dano em torres', s.damage * (s.towerFactor ?? 0.35));
    if (s.heal) add('Cura por segundo', s.heal);
    if (s.freeze) add('Congelamento', s.freeze, (v) => `${v}s`, false);
    if (s.rage) add('Bônus de velocidade', s.rage * 100, (v) => `+${Math.round(v)}%`, false);
    if (s.duration) add('Duração', s.duration, (v) => `${v}s`, false);
    add('Raio', s.radius, (v) => `${v} tiles`, false);
    return rows;
  }
  const u = getUnit(card.unitId);
  add('Vida', u.hp);
  if (u.shield) add('Escudo', u.shield);
  if (u.damage) add(u.splash ? 'Dano em área' : 'Dano', u.damage);
  if (u.damage && u.hitSpeed) add('Dano por segundo', u.damage / u.hitSpeed);
  if (u.hitSpeed) add('Velocidade de ataque', u.hitSpeed, (v) => `${v}s`, false);
  if (u.range) add('Alcance', u.range, (v) => (v < 1 ? 'Corpo a corpo' : `${v} tiles`), false);
  if (!u.building) add('Movimento', u.speed, SPEED_LABEL, false);
  add('Alvos', 0, () => TARGETS_LABEL[u.targets] || '—', false);
  if (card.count > 1) add('Quantidade', card.count, (v) => `x${v}`, false);
  if (u.lifetime) add('Duração', u.lifetime, (v) => `${v}s`, false);
  if (u.spawn) add('Gera', u.spawn.count, (v) => `${v} a cada ${u.spawn.interval}s`, false);
  if (u.deathDamage) add('Dano ao morrer', u.deathDamage.damage);
  if (u.ability?.type === 'ramp') add('Multiplicador máximo', u.ability.stages.at(-1), (v) => `x${v}`, false);
  if (u.ability?.type === 'firstStrike') add('Mergulho', u.ability.mult, (v) => `x${v}`, false);
  return rows;
}

// ------------------------------------------------------------ modais e toasts

let toastWrap = null;
export function toast(msg, kind = '') {
  if (!toastWrap) {
    toastWrap = h('div', { class: 'toast-wrap' });
    document.body.append(toastWrap);
  }
  const t = h('div', { class: `toast ${kind}` }, msg);
  toastWrap.append(t);
  setTimeout(() => t.remove(), 2500);
}

export function openModal(content, { onClose, dismissable = true } = {}) {
  const modal = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' }, content);
  const back = h('div', { class: 'modal-back' }, modal);
  const close = () => {
    if (!back.isConnected) return;
    back.remove();
    document.removeEventListener('keydown', onKey);
    if (onClose) onClose();
  };
  const onKey = (e) => {
    if (e.key === 'Escape' && dismissable) close();
  };
  if (dismissable) back.addEventListener('click', (e) => e.target === back && close());
  document.addEventListener('keydown', onKey);
  document.body.append(back);
  const focusable = modal.querySelector('button');
  if (focusable) focusable.focus({ preventScroll: true });
  return { close, el: modal };
}

export function confirmModal(title, text, { okLabel = 'Confirmar', okClass = 'red' } = {}) {
  return new Promise((resolve) => {
    let result = false;
    const m = openModal([
      h('h2', {}, title),
      h('p', { class: 'muted', style: { textAlign: 'center' } }, text),
      h('div', { class: 'actions' },
        h('button', { class: 'btn', onclick: () => m.close() }, 'Cancelar'),
        h('button', { class: `btn ${okClass}`, onclick: () => { result = true; m.close(); } }, okLabel),
      ),
    ], { onClose: () => resolve(result) });
  });
}

export function fmtTime(sec) {
  const s = Math.max(0, Math.ceil(sec));
  if (s >= 3600) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  if (s >= 60) return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
  return `${s}s`;
}

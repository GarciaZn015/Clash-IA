// Arte procedural no estilo "chibi" de jogos mobile: cabeças grandes, contorno grosso, sombreamento suave.
// Cada função desenha a unidade virada para a direita, com os pés em y ≈ +0.3·s e centro visual próximo da origem.
// `s` = pixels por tile. Tudo é original e gerado por código.

export const TEAM = [
  { main: '#2f7de1', light: '#8cc2ff', dark: '#163f86', trim: '#f2c14e', glow: 'rgba(80,160,255,0.55)' },
  { main: '#d8402f', light: '#ff9d8a', dark: '#7a1a12', trim: '#f2c14e', glow: 'rgba(255,90,70,0.55)' },
];

const OUT = '#1d1726';
const SKIN = '#f4c7a1';

// ------------------------------------------------------------------ cor

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const cache = new Map();
/** amt > 0 clareia, amt < 0 escurece. */
export function tone(hex, amt) {
  const key = hex + amt;
  if (cache.has(key)) return cache.get(key);
  const [r, g, b] = hexToRgb(hex);
  const f = (c) => Math.round(amt >= 0 ? c + (255 - c) * amt : c * (1 + amt));
  const v = `rgb(${f(r)},${f(g)},${f(b)})`;
  cache.set(key, v);
  return v;
}

// ------------------------------------------------------------------ primitivas

function lw(s, k = 1) {
  return Math.max(1.2, s * 0.045 * k);
}

/** Esfera sombreada com contorno. */
function ball(ctx, x, y, r, color, s, { outline = true, k = 1 } = {}) {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, tone(color, 0.35));
  g.addColorStop(0.55, color);
  g.addColorStop(1, tone(color, -0.35));
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  if (outline) {
    ctx.lineWidth = lw(s, k);
    ctx.strokeStyle = OUT;
    ctx.stroke();
  }
}

function ellipse(ctx, x, y, rx, ry, color, s, outline = true) {
  const g = ctx.createRadialGradient(x - rx * 0.3, y - ry * 0.4, Math.min(rx, ry) * 0.1, x, y, Math.max(rx, ry));
  g.addColorStop(0, tone(color, 0.3));
  g.addColorStop(0.6, color);
  g.addColorStop(1, tone(color, -0.35));
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  if (outline) {
    ctx.lineWidth = lw(s);
    ctx.strokeStyle = OUT;
    ctx.stroke();
  }
}

function rrPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Retângulo arredondado com degradê vertical. */
function box(ctx, x, y, w, h, r, color, s, outline = true) {
  const g = ctx.createLinearGradient(x, y, x + w * 0.3, y + h);
  g.addColorStop(0, tone(color, 0.25));
  g.addColorStop(1, tone(color, -0.3));
  rrPath(ctx, x, y, w, h, r);
  ctx.fillStyle = g;
  ctx.fill();
  if (outline) {
    ctx.lineWidth = lw(s);
    ctx.strokeStyle = OUT;
    ctx.stroke();
  }
}

function poly(ctx, pts, color, s, outline = true, flat = false) {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
  if (flat) ctx.fillStyle = color;
  else {
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 1; i < pts.length; i += 2) {
      minY = Math.min(minY, pts[i]);
      maxY = Math.max(maxY, pts[i]);
    }
    const g = ctx.createLinearGradient(0, minY, 0, maxY);
    g.addColorStop(0, tone(color, 0.25));
    g.addColorStop(1, tone(color, -0.25));
    ctx.fillStyle = g;
  }
  ctx.fill();
  if (outline) {
    ctx.lineJoin = 'round';
    ctx.lineWidth = lw(s);
    ctx.strokeStyle = OUT;
    ctx.stroke();
  }
}

function stroke(ctx, pts, color, width, cap = 'round') {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.lineCap = cap;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

/** Traço com contorno escuro (armas, cabos). */
function stick(ctx, x1, y1, x2, y2, color, w, s) {
  stroke(ctx, [x1, y1, x2, y2], OUT, w + lw(s) * 2);
  stroke(ctx, [x1, y1, x2, y2], color, w);
}

function eyes(ctx, s, x, y, { size = 1, color = '#1b1420', angry = false } = {}) {
  const r = s * 0.045 * size;
  for (const dx of [-0.07, 0.07]) {
    ctx.beginPath();
    ctx.ellipse(x + dx * s, y, r, r * 1.35, 0, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + dx * s + r * 0.35, y - r * 0.45, r * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
  }
  if (angry) {
    stroke(ctx, [x - 0.13 * s, y - 0.09 * s, x - 0.03 * s, y - 0.06 * s], OUT, s * 0.035);
    stroke(ctx, [x + 0.13 * s, y - 0.09 * s, x + 0.03 * s, y - 0.06 * s], OUT, s * 0.035);
  }
}

/** Corpo chibi: pernas, tronco, cabeça. Retorna pontos úteis (mão, cabeça). */
function chibi(ctx, s, a, { body, legs = '#3a3346', skin = SKIN, headR = 0.27, bodyW = 0.42, bodyH = 0.36, belt = null, face = true, angry = false }) {
  const walk = a.walk || 0;
  const by = a.bob || 0;
  // pernas
  for (const side of [-1, 1]) {
    const lift = Math.max(0, Math.sin(walk + (side > 0 ? 0 : Math.PI))) * s * 0.06;
    box(ctx, side * s * 0.12 - s * 0.07, s * 0.12 - lift, s * 0.14, s * 0.19, s * 0.05, legs, s);
  }
  // tronco
  box(ctx, -s * bodyW / 2, -s * 0.18 + by, s * bodyW, s * bodyH, s * 0.12, body, s);
  if (belt) {
    ctx.fillStyle = belt;
    ctx.fillRect(-s * bodyW / 2 + lw(s) / 2, s * 0.06 + by, s * bodyW - lw(s), s * 0.06);
  }
  // cabeça
  const hx = s * 0.02;
  const hy = -s * 0.42 + by;
  ball(ctx, hx, hy, s * headR, skin, s);
  if (face) eyes(ctx, s, hx + s * 0.06, hy + s * 0.02, { angry });
  return { hx, hy, hand: { x: s * 0.24, y: -s * 0.02 + by }, back: { x: -s * 0.24, y: -s * 0.02 + by } };
}

// ------------------------------------------------------------------ unidades

const DRAW = {
  escudeiro(ctx, s, team, a) {
    const p = chibi(ctx, s, a, { body: '#9aa6b5', belt: team.main, angry: true });
    // capacete
    ctx.beginPath();
    ctx.arc(p.hx, p.hy - s * 0.02, s * 0.29, Math.PI * 1.02, Math.PI * 1.98);
    ctx.lineTo(p.hx + s * 0.29, p.hy - s * 0.04);
    ctx.fillStyle = '#c3ccd8';
    ctx.fill();
    ctx.lineWidth = lw(s);
    ctx.strokeStyle = OUT;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fillRect(p.hx - s * 0.18, p.hy - s * 0.2, s * 0.08, s * 0.12);
    poly(ctx, [p.hx - s * 0.04, p.hy - s * 0.3, p.hx + s * 0.02, p.hy - s * 0.52, p.hx + s * 0.1, p.hy - s * 0.3], team.main, s);
    // tabardo do time
    poly(ctx, [-s * 0.13, -s * 0.16 + (a.bob || 0), s * 0.13, -s * 0.16 + (a.bob || 0), s * 0.1, s * 0.12, 0, s * 0.18, -s * 0.1, s * 0.12], team.main, s);
    // espada
    ctx.save();
    ctx.translate(p.hand.x, p.hand.y);
    ctx.rotate(-0.9 + a.attack * 2.0);
    stick(ctx, 0, 0, 0, -s * 0.55, '#e9eef5', s * 0.07, s);
    stick(ctx, -s * 0.1, -s * 0.05, s * 0.1, -s * 0.05, '#b8862f', s * 0.05, s);
    ctx.restore();
    // escudo
    if (a.shield) {
      poly(ctx, [-s * 0.42, -s * 0.2, -s * 0.12, -s * 0.24, -s * 0.12, s * 0.06, -s * 0.27, s * 0.22, -s * 0.42, s * 0.06], team.main, s);
      poly(ctx, [-s * 0.33, -s * 0.14, -s * 0.21, -s * 0.15, -s * 0.21, s * 0.02, -s * 0.27, s * 0.1, -s * 0.33, s * 0.02], team.trim, s, false);
    }
  },
  arqueira(ctx, s, team, a) {
    // capa
    poly(ctx, [-s * 0.22, -s * 0.2 + (a.bob || 0), s * 0.12, -s * 0.2, s * 0.05, s * 0.22, -s * 0.32, s * 0.24], team.dark, s);
    const p = chibi(ctx, s, a, { body: '#4f8a3c', belt: '#7a4e25' });
    // capuz
    ctx.beginPath();
    ctx.arc(p.hx - s * 0.02, p.hy - s * 0.02, s * 0.3, Math.PI * 0.95, Math.PI * 2.05);
    ctx.quadraticCurveTo(p.hx - s * 0.2, p.hy - s * 0.5, p.hx - s * 0.42, p.hy - s * 0.15);
    ctx.fillStyle = team.main;
    ctx.fill();
    ctx.lineWidth = lw(s);
    ctx.strokeStyle = OUT;
    ctx.stroke();
    // trança
    ball(ctx, p.hx - s * 0.3, p.hy + s * 0.12, s * 0.07, '#c6762f', s);
    // arco
    ctx.save();
    ctx.translate(p.hand.x + s * 0.06, p.hand.y - s * 0.06);
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.3, -1.25, 1.25);
    ctx.lineWidth = s * 0.09 + lw(s) * 2;
    ctx.strokeStyle = OUT;
    ctx.stroke();
    ctx.lineWidth = s * 0.09;
    ctx.strokeStyle = '#9a6430';
    ctx.stroke();
    const pull = a.attack * 0.14 * s;
    stroke(ctx, [Math.cos(-1.25) * s * 0.3, Math.sin(-1.25) * s * 0.3, -pull, 0, Math.cos(1.25) * s * 0.3, Math.sin(1.25) * s * 0.3], '#f4f0e6', s * 0.025);
    ctx.restore();
  },
  lobo(ctx, s, team, a) {
    const b = (a.bob || 0) * 0.6;
    const leg = Math.sin(a.walk || 0) * s * 0.06;
    for (const [x, d] of [[-0.22, leg], [-0.08, -leg], [0.12, -leg], [0.26, leg]]) box(ctx, s * x - s * 0.05, s * 0.06 + d * 0.3, s * 0.1, s * 0.22, s * 0.04, '#3a3644', s);
    poly(ctx, [-s * 0.38, -s * 0.06 + b, -s * 0.66, -s * 0.3 + b, -s * 0.44, s * 0.06 + b], '#4a4656', s);
    ellipse(ctx, 0, -s * 0.02 + b, s * 0.4, s * 0.22, '#5a5568', s);
    ctx.fillStyle = team.main;
    ctx.fillRect(s * 0.14, -s * 0.18 + b, s * 0.08, s * 0.24);
    ball(ctx, s * 0.32, -s * 0.2 + b, s * 0.2, '#646074', s);
    poly(ctx, [s * 0.2, -s * 0.32 + b, s * 0.23, -s * 0.56 + b, s * 0.34, -s * 0.36 + b], '#4a4656', s);
    poly(ctx, [s * 0.36, -s * 0.34 + b, s * 0.44, -s * 0.54 + b, s * 0.46, -s * 0.3 + b], '#4a4656', s);
    poly(ctx, [s * 0.42, -s * 0.24 + b, s * 0.66, -s * 0.15 + b, s * 0.62, -s * 0.06 + b, s * 0.42, -s * 0.1 + b], '#7c788c', s);
    ball(ctx, s * 0.65, -s * 0.13 + b, s * 0.04, '#1b1420', s, { outline: false });
    ctx.fillStyle = '#ffd34a';
    ctx.beginPath();
    ctx.ellipse(s * 0.39, -s * 0.25 + b, s * 0.035, s * 0.025, -0.3, 0, Math.PI * 2);
    ctx.fill();
    if (a.attack > 0) poly(ctx, [s * 0.5, -s * 0.06 + b, s * 0.62, -s * 0.04 + b, s * 0.55, s * 0.02 + b], '#fff', s, false, true);
  },
  diabrete(ctx, s, team, a) {
    const b = a.bob || 0;
    for (const side of [-1, 1]) box(ctx, side * s * 0.1 - s * 0.05, s * 0.12, s * 0.1, s * 0.16, s * 0.04, '#b4472a', s);
    ball(ctx, 0, -s * 0.1 + b, s * 0.3, '#e4693e', s);
    poly(ctx, [-s * 0.2, -s * 0.3 + b, -s * 0.36, -s * 0.58 + b, -s * 0.08, -s * 0.36 + b], '#f6e7c8', s);
    poly(ctx, [s * 0.2, -s * 0.3 + b, s * 0.36, -s * 0.58 + b, s * 0.08, -s * 0.36 + b], '#f6e7c8', s);
    eyes(ctx, s, s * 0.06, -s * 0.13 + b, { size: 1.2, color: '#2a0d06', angry: true });
    stroke(ctx, [-s * 0.02, -s * 0.0 + b, s * 0.06, s * 0.03 + b, s * 0.14, -s * 0.0 + b], OUT, s * 0.03);
    ctx.fillStyle = team.main;
    rrPath(ctx, -s * 0.24, s * 0.06 + b, s * 0.48, s * 0.1, s * 0.04);
    ctx.fill();
    ctx.save();
    ctx.translate(s * 0.28, -s * 0.02 + b);
    ctx.rotate(-0.6 + a.attack * 1.6);
    stick(ctx, 0, 0, 0, -s * 0.3, '#d6dde6', s * 0.06, s);
    ctx.restore();
  },
  corvo(ctx, s, team, a) {
    const flap = Math.sin((a.t || 0) * 16) * 0.45;
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.scale(side, 1);
      poly(ctx, [s * 0.05, -s * 0.05, s * 0.6, -s * (0.25 + flap * 0.35), s * 0.5, -s * 0.02, s * 0.4, s * 0.08, s * 0.15, s * 0.1], '#2b2838', s);
      ctx.restore();
    }
    ellipse(ctx, 0, 0, s * 0.18, s * 0.24, '#36324a', s);
    ball(ctx, s * 0.06, -s * 0.2, s * 0.15, '#3f3a55', s);
    poly(ctx, [s * 0.18, -s * 0.22, s * 0.36, -s * 0.17, s * 0.18, -s * 0.12], '#f0b33c', s);
    ctx.fillStyle = '#ff5547';
    ctx.beginPath();
    ctx.arc(s * 0.1, -s * 0.23, s * 0.035, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = team.main;
    ctx.fillRect(-s * 0.08, s * 0.12, s * 0.16, s * 0.07);
  },
  bombardeiro(ctx, s, team, a) {
    const p = chibi(ctx, s, a, { body: team.main, belt: '#5b3a1e', bodyW: 0.5, headR: 0.28 });
    // barba
    poly(ctx, [p.hx - s * 0.18, p.hy + s * 0.04, p.hx + s * 0.26, p.hy + s * 0.04, p.hx + s * 0.14, p.hy + s * 0.36, p.hx + s * 0.02, p.hy + s * 0.42, p.hx - s * 0.1, p.hy + s * 0.3], '#d97a2e', s);
    // capacete de minerador
    ctx.beginPath();
    ctx.arc(p.hx, p.hy - s * 0.04, s * 0.29, Math.PI, 0);
    ctx.closePath();
    ctx.fillStyle = '#7a5530';
    ctx.fill();
    ctx.lineWidth = lw(s);
    ctx.strokeStyle = OUT;
    ctx.stroke();
    ball(ctx, p.hx + s * 0.16, p.hy - s * 0.2, s * 0.06, '#ffe680', s);
    eyes(ctx, s, p.hx + s * 0.06, p.hy - s * 0.0);
    // bomba
    const lift = a.attack * s * 0.3;
    ball(ctx, p.hand.x + s * 0.06, p.hand.y - s * 0.06 - lift, s * 0.14, '#33303d', s);
    stroke(ctx, [p.hand.x + s * 0.12, p.hand.y - s * 0.2 - lift, p.hand.x + s * 0.18, p.hand.y - s * 0.3 - lift], '#d9b37a', s * 0.03);
    ball(ctx, p.hand.x + s * 0.19, p.hand.y - s * 0.32 - lift, s * 0.04, '#ffb030', s, { outline: false });
  },
  mago(ctx, s, team, a) {
    // manto
    poly(ctx, [-s * 0.26, -s * 0.2 + (a.bob || 0), s * 0.26, -s * 0.2 + (a.bob || 0), s * 0.32, s * 0.28, -s * 0.32, s * 0.28], team.main, s);
    const p = chibi(ctx, s, { ...a, walk: 0 }, { body: team.main, belt: team.trim, legs: team.dark });
    // barba branca
    poly(ctx, [p.hx - s * 0.12, p.hy + s * 0.06, p.hx + s * 0.24, p.hy + s * 0.06, p.hx + s * 0.08, p.hy + s * 0.42], '#f2f2f6', s);
    // chapéu
    poly(ctx, [p.hx - s * 0.36, p.hy - s * 0.12, p.hx + s * 0.36, p.hy - s * 0.12, p.hx + s * 0.1, p.hy - s * 0.42, p.hx - s * 0.12, p.hy - s * 0.82, p.hx - s * 0.18, p.hy - s * 0.4], '#4b2f8f', s);
    ctx.fillStyle = team.trim;
    ctx.fillRect(p.hx - s * 0.24, p.hy - s * 0.2, s * 0.48, s * 0.06);
    ball(ctx, p.hx - s * 0.02, p.hy - s * 0.48, s * 0.04, '#ffe680', s, { outline: false });
    // cajado
    stick(ctx, p.hand.x + s * 0.04, p.hand.y + s * 0.3, p.hand.x + s * 0.04, p.hand.y - s * 0.55, '#8a5a2b', s * 0.06, s);
    const glow = 0.1 + a.attack * 0.1;
    ctx.fillStyle = 'rgba(143,240,255,0.35)';
    ctx.beginPath();
    ctx.arc(p.hand.x + s * 0.04, p.hand.y - s * 0.62, s * (glow + 0.08), 0, Math.PI * 2);
    ctx.fill();
    ball(ctx, p.hand.x + s * 0.04, p.hand.y - s * 0.62, s * glow, '#8ff0ff', s);
  },
  javali(ctx, s, team, a) {
    const b = (a.bob || 0) * 0.7;
    const leg = Math.sin(a.walk || 0) * s * 0.07;
    for (const [x, d] of [[-0.3, leg], [-0.14, -leg], [0.16, -leg], [0.3, leg]]) box(ctx, s * x - s * 0.06, s * 0.1 + d * 0.3, s * 0.12, s * 0.2, s * 0.04, '#5a3a22', s);
    ellipse(ctx, 0, b, s * 0.5, s * 0.28, '#8a5a36', s);
    for (let i = -2; i <= 2; i++) poly(ctx, [i * s * 0.1 - s * 0.05, -s * 0.24 + b, i * s * 0.1, -s * 0.38 + b, i * s * 0.1 + s * 0.05, -s * 0.24 + b], '#3d2716', s, false, true);
    ball(ctx, s * 0.44, -s * 0.06 + b, s * 0.22, '#7b4d2d', s);
    ellipse(ctx, s * 0.62, -s * 0.02 + b, s * 0.09, s * 0.08, '#c98f78', s);
    poly(ctx, [s * 0.5, s * 0.06 + b, s * 0.66, -s * 0.16 + b, s * 0.56, s * 0.1 + b], '#f6edd8', s);
    ball(ctx, s * 0.46, -s * 0.14 + b, s * 0.035, '#1b1420', s, { outline: false });
    // sela
    ctx.fillStyle = team.main;
    rrPath(ctx, -s * 0.22, -s * 0.3 + b, s * 0.36, s * 0.14, s * 0.05);
    ctx.fill();
    // cavaleiro
    ctx.save();
    ctx.translate(-s * 0.04, -s * 0.38 + b);
    ctx.scale(0.8, 0.8);
    const p = chibi(ctx, s, { ...a, walk: 0, bob: 0 }, { body: team.main, belt: '#5b3a1e', angry: true });
    ctx.beginPath();
    ctx.arc(p.hx, p.hy - s * 0.04, s * 0.29, Math.PI, 0);
    ctx.closePath();
    ctx.fillStyle = '#c3ccd8';
    ctx.fill();
    ctx.lineWidth = lw(s);
    ctx.strokeStyle = OUT;
    ctx.stroke();
    ctx.save();
    ctx.translate(p.hand.x, p.hand.y);
    ctx.rotate(-1.1 + a.attack * 2.4);
    stick(ctx, 0, 0, 0, -s * 0.5, '#6b4a2e', s * 0.06, s);
    box(ctx, -s * 0.13, -s * 0.66, s * 0.26, s * 0.18, s * 0.04, '#9aa3ad', s);
    ctx.restore();
    ctx.restore();
  },
  golem(ctx, s, team, a, k = 1) {
    const b = (a.bob || 0) * 0.4;
    const leg = Math.sin(a.walk || 0) * s * 0.05;
    for (const side of [-1, 1]) box(ctx, side * s * 0.26 * k - s * 0.14 * k, s * 0.08 + leg * side, s * 0.28 * k, s * 0.26, s * 0.06, '#5f5c6b', s);
    poly(ctx, [-s * 0.55 * k, s * 0.14, -s * 0.66 * k, -s * 0.36 + b, -s * 0.34 * k, -s * 0.74 + b, s * 0.34 * k, -s * 0.74 + b, s * 0.66 * k, -s * 0.36 + b, s * 0.55 * k, s * 0.14], '#8a8798', s);
    // musgo e fissuras
    poly(ctx, [-s * 0.34 * k, -s * 0.74 + b, s * 0.34 * k, -s * 0.74 + b, s * 0.22 * k, -s * 0.6 + b, -s * 0.24 * k, -s * 0.62 + b], '#6aa056', s, false, true);
    const glow = a.attack > 0 ? '#ffffff' : '#62ecff';
    stroke(ctx, [-s * 0.3 * k, -s * 0.2 + b, -s * 0.06 * k, -s * 0.42 + b, s * 0.14 * k, -s * 0.18 + b, s * 0.34 * k, -s * 0.36 + b], glow, s * 0.06);
    ball(ctx, -s * 0.12 * k, -s * 0.54 + b, s * 0.06, glow, s, { outline: false });
    ball(ctx, s * 0.14 * k, -s * 0.54 + b, s * 0.06, glow, s, { outline: false });
    ctx.fillStyle = team.main;
    rrPath(ctx, -s * 0.5 * k, -s * 0.06 + b, s * k, s * 0.1, s * 0.04);
    ctx.fill();
    const punch = a.attack * s * 0.3;
    ball(ctx, -s * 0.74 * k, -s * 0.12 + b + punch, s * 0.22 * k, '#77748a', s);
    ball(ctx, s * 0.74 * k, -s * 0.12 + b + punch, s * 0.22 * k, '#77748a', s);
  },
  fragmento(ctx, s, team, a) {
    DRAW.golem(ctx, s, team, a, 0.62);
  },
  grifo(ctx, s, team, a) {
    const flap = Math.sin((a.t || 0) * 10) * 0.35;
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.scale(side, 1);
      poly(ctx, [s * 0.08, -s * 0.12, s * 0.78, -s * (0.5 + flap), s * 0.7, -s * 0.18, s * 0.56, s * 0.02, s * 0.3, s * 0.08], '#f1ead9', s);
      stroke(ctx, [s * 0.3, -s * 0.12, s * 0.62, -s * (0.36 + flap * 0.7)], tone('#f1ead9', -0.25), s * 0.025);
      ctx.restore();
    }
    ellipse(ctx, -s * 0.04, 0, s * 0.32, s * 0.24, '#cf9e55', s);
    ctx.fillStyle = team.main;
    rrPath(ctx, -s * 0.22, -s * 0.06, s * 0.3, s * 0.1, s * 0.04);
    ctx.fill();
    ball(ctx, s * 0.24, -s * 0.2, s * 0.17, '#fbf6ec', s);
    poly(ctx, [s * 0.36, -s * 0.24, s * 0.56, -s * 0.16, s * 0.38, -s * 0.1], '#f2b134', s);
    eyes(ctx, s, s * 0.28, -s * 0.24, { size: 0.8, angry: true });
  },
  dragonete(ctx, s, team, a) {
    const flap = Math.sin((a.t || 0) * 9) * 0.3;
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.scale(side, 1);
      poly(ctx, [s * 0.08, -s * 0.1, s * 0.82, -s * (0.55 + flap), s * 0.66, -s * 0.12, s * 0.5, s * 0.08, s * 0.3, -s * 0.0], '#a72f28', s);
      ctx.restore();
    }
    poly(ctx, [-s * 0.26, s * 0.06, -s * 0.66, s * 0.3, -s * 0.5, s * 0.36, -s * 0.18, s * 0.18], '#d95a37', s);
    ellipse(ctx, 0, 0, s * 0.3, s * 0.26, '#e2643c', s);
    ellipse(ctx, s * 0.04, s * 0.04, s * 0.15, s * 0.14, '#f8c46c', s, false);
    ball(ctx, s * 0.28, -s * 0.24, s * 0.2, '#ea6d43', s);
    poly(ctx, [s * 0.18, -s * 0.38, s * 0.16, -s * 0.58, s * 0.3, -s * 0.42], '#f6e7c8', s);
    poly(ctx, [s * 0.32, -s * 0.4, s * 0.4, -s * 0.58, s * 0.42, -s * 0.38], '#f6e7c8', s);
    eyes(ctx, s, s * 0.32, -s * 0.26, { size: 0.8, color: '#3a1a00' });
    ctx.fillStyle = team.main;
    rrPath(ctx, -s * 0.16, -s * 0.24, s * 0.26, s * 0.08, s * 0.03);
    ctx.fill();
  },
  feiticeira(ctx, s, team, a) {
    poly(ctx, [-s * 0.28, -s * 0.18 + (a.bob || 0), s * 0.26, -s * 0.18, s * 0.34, s * 0.3, -s * 0.36, s * 0.3], '#2a2540', s);
    const p = chibi(ctx, s, { ...a, walk: 0 }, { body: '#2a2540', belt: team.main, skin: '#e3d2f0', legs: '#1a1626' });
    // capuz
    ctx.beginPath();
    ctx.arc(p.hx - s * 0.02, p.hy - s * 0.02, s * 0.31, Math.PI * 0.9, Math.PI * 2.1);
    ctx.quadraticCurveTo(p.hx - s * 0.1, p.hy - s * 0.6, p.hx - s * 0.36, p.hy + s * 0.05);
    ctx.fillStyle = '#1b1828';
    ctx.fill();
    ctx.lineWidth = lw(s);
    ctx.strokeStyle = OUT;
    ctx.stroke();
    stroke(ctx, [p.hx - s * 0.3, p.hy + s * 0.04, p.hx + s * 0.28, p.hy - s * 0.12], team.main, s * 0.04);
    eyes(ctx, s, p.hx + s * 0.07, p.hy + s * 0.03, { color: '#3fd8c8' });
    const pulse = 0.1 + Math.sin((a.t || 0) * 6) * 0.02 + a.attack * 0.06;
    ctx.fillStyle = 'rgba(79,224,208,0.3)';
    ctx.beginPath();
    ctx.arc(p.hand.x + s * 0.08, p.hand.y - s * 0.12, s * pulse * 1.9, 0, Math.PI * 2);
    ctx.fill();
    ball(ctx, p.hand.x + s * 0.08, p.hand.y - s * 0.12, s * pulse, '#5ff0e0', s);
  },
  esqueleto(ctx, s, team, a) {
    const walk = a.walk || 0;
    for (const side of [-1, 1]) {
      const lift = Math.max(0, Math.sin(walk + (side > 0 ? 0 : Math.PI))) * s * 0.05;
      stick(ctx, side * s * 0.08, s * 0.08, side * s * 0.09, s * 0.28 - lift, '#efeadc', s * 0.05, s);
    }
    box(ctx, -s * 0.14, -s * 0.16 + (a.bob || 0), s * 0.28, s * 0.26, s * 0.06, '#e8e2d2', s);
    for (let i = 0; i < 3; i++) stroke(ctx, [-s * 0.1, -s * 0.1 + i * s * 0.07, s * 0.1, -s * 0.1 + i * s * 0.07], '#9d9786', s * 0.025);
    ctx.fillStyle = team.main;
    ctx.fillRect(-s * 0.15, s * 0.04, s * 0.3, s * 0.06);
    const hy = -s * 0.36 + (a.bob || 0);
    ball(ctx, s * 0.02, hy, s * 0.22, '#f4efe2', s);
    for (const dx of [-0.05, 0.11]) {
      ctx.fillStyle = '#1b1420';
      ctx.beginPath();
      ctx.ellipse(s * dx, hy, s * 0.05, s * 0.06, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    stroke(ctx, [-s * 0.02, hy + s * 0.12, s * 0.12, hy + s * 0.12], '#1b1420', s * 0.025);
    ctx.save();
    ctx.translate(s * 0.2, -s * 0.02);
    ctx.rotate(-0.7 + a.attack * 1.8);
    stick(ctx, 0, 0, 0, -s * 0.34, '#cfd6df', s * 0.05, s);
    ctx.restore();
  },
  gigante(ctx, s, team, a) {
    const OGRE = '#93a86a';
    const p = chibi(ctx, s, a, { body: team.main, belt: '#6b4425', bodyW: 0.62, bodyH: 0.42, headR: 0.25, legs: '#5d4a36', skin: OGRE, angry: true });
    // ombreira de pedra e musgo
    ball(ctx, -s * 0.26, -s * 0.16 + (a.bob || 0), s * 0.13, '#8d8a99', s);
    ellipse(ctx, -s * 0.26, -s * 0.24 + (a.bob || 0), s * 0.12, s * 0.05, '#6aa056', s, false);
    // presas e tatuagem rúnica
    poly(ctx, [p.hx + s * 0.02, p.hy + s * 0.12, p.hx + s * 0.06, p.hy + s * 0.02, p.hx + s * 0.09, p.hy + s * 0.12], '#f6eedc', s);
    poly(ctx, [p.hx + s * 0.14, p.hy + s * 0.12, p.hx + s * 0.18, p.hy + s * 0.02, p.hx + s * 0.21, p.hy + s * 0.12], '#f6eedc', s);
    stroke(ctx, [p.hx - s * 0.12, p.hy - s * 0.16, p.hx - s * 0.04, p.hy - s * 0.22, p.hx + s * 0.04, p.hy - s * 0.16], team.light, s * 0.035);
    // punhos enormes
    const punch = a.attack * s * 0.24;
    ball(ctx, -s * 0.38, s * 0.02, s * 0.14, OGRE, s);
    ball(ctx, s * 0.4 + punch, -s * 0.02, s * 0.16, OGRE, s);
    stroke(ctx, [s * 0.32 + punch, -s * 0.06, s * 0.46 + punch, -s * 0.06], '#6b4425', s * 0.04);
  },
  atiradora(ctx, s, team, a) {
    const p = chibi(ctx, s, a, { body: team.main, belt: '#3b2a1c', legs: '#2e2a3a' });
    // cabelo escuro e chapéu de aba larga com pena
    ball(ctx, p.hx - s * 0.2, p.hy + s * 0.08, s * 0.11, '#3a2a22', s);
    ellipse(ctx, p.hx, p.hy - s * 0.18, s * 0.38, s * 0.09, '#3b2f45', s);
    box(ctx, p.hx - s * 0.18, p.hy - s * 0.42, s * 0.36, s * 0.24, s * 0.08, '#3b2f45', s);
    stroke(ctx, [p.hx - s * 0.12, p.hy - s * 0.36, p.hx - s * 0.42, p.hy - s * 0.66], team.light, s * 0.06);
    // besta pesada
    ctx.save();
    ctx.translate(p.hand.x, p.hand.y - s * 0.04);
    ctx.translate(-a.attack * s * 0.08, 0);
    box(ctx, -s * 0.1, -s * 0.05, s * 0.6, s * 0.1, s * 0.03, '#6b4a2e', s);
    ctx.beginPath();
    ctx.arc(s * 0.4, 0, s * 0.22, -1.35, 1.35);
    ctx.lineWidth = s * 0.06 + lw(s) * 2;
    ctx.strokeStyle = OUT;
    ctx.stroke();
    ctx.lineWidth = s * 0.06;
    ctx.strokeStyle = '#9aa3ad';
    ctx.stroke();
    ctx.restore();
  },
  berserker(ctx, s, team, a) {
    const spin = a.attack > 0 ? (1 - a.attack) * Math.PI * 2 : 0;
    // capa de pele de urso
    poly(ctx, [-s * 0.3, -s * 0.22 + (a.bob || 0), s * 0.16, -s * 0.22, s * 0.06, s * 0.2, -s * 0.34, s * 0.2], '#6a4a32', s);
    const p = chibi(ctx, s, a, { body: '#a8794e', belt: team.main, legs: '#4a3626', angry: true });
    // capuz de pele com orelhas
    ctx.beginPath();
    ctx.arc(p.hx, p.hy - s * 0.02, s * 0.3, Math.PI * 0.95, Math.PI * 2.05);
    ctx.closePath();
    ctx.fillStyle = '#6a4a32';
    ctx.fill();
    ctx.lineWidth = lw(s);
    ctx.strokeStyle = OUT;
    ctx.stroke();
    ball(ctx, p.hx - s * 0.2, p.hy - s * 0.26, s * 0.07, '#6a4a32', s);
    ball(ctx, p.hx + s * 0.2, p.hy - s * 0.26, s * 0.07, '#6a4a32', s);
    // barba castanha e pintura de guerra do time
    poly(ctx, [p.hx - s * 0.14, p.hy + s * 0.08, p.hx + s * 0.26, p.hy + s * 0.06, p.hx + s * 0.08, p.hy + s * 0.32], '#7a4a26', s);
    stroke(ctx, [p.hx + s * 0.0, p.hy - s * 0.06, p.hx + s * 0.2, p.hy - s * 0.06], team.main, s * 0.04);
    // machado de duas lâminas (gira no ataque)
    ctx.save();
    ctx.translate(p.hand.x, p.hand.y);
    ctx.rotate(-0.5 + spin);
    stick(ctx, 0, s * 0.1, 0, -s * 0.5, '#6b4a2e', s * 0.06, s);
    poly(ctx, [0, -s * 0.36, s * 0.24, -s * 0.52, s * 0.28, -s * 0.28, 0, -s * 0.3], '#c9d1db', s);
    poly(ctx, [0, -s * 0.36, -s * 0.2, -s * 0.48, -s * 0.22, -s * 0.28, 0, -s * 0.3], '#c9d1db', s);
    ctx.restore();
    if (a.attack > 0) {
      ctx.strokeStyle = `rgba(255,255,255,${a.attack * 0.6})`;
      ctx.lineWidth = s * 0.06;
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 0.62, s * 0.3, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  },
  balista(ctx, s, team, a) {
    ellipse(ctx, 0, s * 0.18, s * 0.8, s * 0.42, '#6b6158', s);
    ellipse(ctx, 0, s * 0.08, s * 0.66, s * 0.34, '#8d8276', s);
    ctx.save();
    ctx.rotate(a.aim || 0);
    box(ctx, -s * 0.12, -s * 0.13, s * 0.78, s * 0.26, s * 0.05, '#8a5a33', s);
    ctx.beginPath();
    ctx.arc(s * 0.45, 0, s * 0.46, -1.3, 1.3);
    ctx.lineWidth = s * 0.1 + lw(s) * 2;
    ctx.strokeStyle = OUT;
    ctx.stroke();
    ctx.lineWidth = s * 0.1;
    ctx.strokeStyle = '#5a3a20';
    ctx.stroke();
    stick(ctx, s * 0.55 - a.attack * s * 0.3, 0, s * 0.98, 0, '#dfe5ec', s * 0.05, s);
    ctx.restore();
    ball(ctx, 0, 0, s * 0.16, team.main, s);
  },
  canhao(ctx, s, team, a) {
    ellipse(ctx, 0, s * 0.16, s * 0.72, s * 0.4, '#5f5850', s);
    box(ctx, -s * 0.5, -s * 0.12, s * 1.0, s * 0.3, s * 0.08, '#7a6a5a', s);
    ctx.save();
    ctx.rotate(a.aim || 0);
    ctx.translate(-a.attack * s * 0.12, 0);
    box(ctx, -s * 0.15, -s * 0.18, s * 0.72, s * 0.36, s * 0.16, '#b07a3c', s);
    ellipse(ctx, s * 0.56, 0, s * 0.08, s * 0.16, '#2a2622', s);
    ctx.restore();
    ball(ctx, 0, -s * 0.02, s * 0.2, team.main, s);
  },
  forja(ctx, s, team, a) {
    ellipse(ctx, 0, s * 0.22, s * 0.86, s * 0.44, '#5b5249', s);
    box(ctx, -s * 0.6, -s * 0.36, s * 1.2, s * 0.58, s * 0.08, '#8c7b69', s);
    for (let i = 0; i < 3; i++) stroke(ctx, [-s * 0.56, -s * 0.2 + i * s * 0.15, s * 0.56, -s * 0.2 + i * s * 0.15], 'rgba(40,30,25,0.35)', s * 0.03);
    poly(ctx, [-s * 0.72, -s * 0.32, 0, -s * 0.86, s * 0.72, -s * 0.32], team.main, s);
    const g = 0.6 + Math.sin((a.t || 0) * 7) * 0.3;
    ctx.beginPath();
    ctx.arc(0, s * 0.16, s * 0.26, Math.PI, 0);
    ctx.closePath();
    ctx.fillStyle = `rgb(255,${Math.round(120 + g * 90)},40)`;
    ctx.fill();
    ctx.lineWidth = lw(s);
    ctx.strokeStyle = OUT;
    ctx.stroke();
    box(ctx, s * 0.24, -s * 0.98, s * 0.18, s * 0.42, s * 0.04, '#6b6158', s);
  },
};

export function drawUnit(ctx, defId, side, s, anim = {}) {
  const team = TEAM[side] || TEAM[0];
  const a = { t: 0, attack: 0, bob: 0, walk: 0, shield: true, ...anim };
  const fn = DRAW[defId];
  ctx.save();
  if (fn) fn(ctx, s, team, a);
  else ball(ctx, 0, 0, s * 0.4, team.main, s);
  ctx.restore();
}

// ------------------------------------------------------------------ torres

function towerBody(ctx, s, R, top, team) {
  // base de pedra
  ellipse(ctx, 0, s * 0.25, s * R * 1.02, s * R * 0.62, '#5c5866', s);
  // corpo cilíndrico com sombreamento lateral
  const bw = s * R * 0.72;
  const g = ctx.createLinearGradient(-bw, 0, bw, 0);
  g.addColorStop(0, '#7d7889');
  g.addColorStop(0.35, '#c9c4d2');
  g.addColorStop(0.7, '#a8a2b3');
  g.addColorStop(1, '#6c6778');
  ctx.beginPath();
  ctx.moveTo(-bw, top);
  ctx.lineTo(-bw, s * 0.2);
  ctx.ellipse(0, s * 0.2, bw, bw * 0.4, 0, Math.PI, 0, true);
  ctx.lineTo(bw, top);
  ctx.closePath();
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = lw(s, 1.2);
  ctx.strokeStyle = OUT;
  ctx.stroke();
  // fileiras de pedra
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = 'rgba(40,34,52,0.28)';
  ctx.lineWidth = Math.max(1, s * 0.03);
  for (let y = top + s * 0.28, row = 0; y < s * 0.5; y += s * 0.26, row++) {
    ctx.beginPath();
    ctx.ellipse(0, y, bw, bw * 0.4, 0, 0, Math.PI);
    ctx.stroke();
    for (let i = -2; i <= 2; i++) {
      const x = (i + (row % 2) * 0.5) * bw * 0.4;
      ctx.beginPath();
      ctx.moveTo(x, y + bw * 0.4 * Math.sqrt(Math.max(0, 1 - (x / bw) ** 2)) - s * 0.26);
      ctx.lineTo(x, y + bw * 0.4 * Math.sqrt(Math.max(0, 1 - (x / bw) ** 2)));
      ctx.stroke();
    }
  }
  ctx.restore();
  // topo: plataforma e ameias
  ellipse(ctx, 0, top, bw * 1.08, bw * 0.42, '#d8d3e0', s);
  ellipse(ctx, 0, top, bw * 0.78, bw * 0.28, '#8f8a9d', s, false);
  for (let i = 0; i < 7; i++) {
    const ang = Math.PI * (0.05 + (i / 6) * 0.9);
    const x = Math.cos(ang) * bw * 0.98;
    const y = top + Math.sin(ang) * bw * 0.38;
    box(ctx, x - s * 0.1, y - s * 0.2, s * 0.2, s * 0.22, s * 0.04, '#cfc9d8', s);
  }
  // estandarte
  const fw = bw * 0.55;
  const fy = top + s * 0.32;
  ctx.beginPath();
  ctx.moveTo(-fw / 2, fy);
  ctx.lineTo(fw / 2, fy);
  ctx.lineTo(fw / 2, fy + s * 0.62);
  ctx.lineTo(0, fy + s * 0.78);
  ctx.lineTo(-fw / 2, fy + s * 0.62);
  ctx.closePath();
  const fg = ctx.createLinearGradient(0, fy, 0, fy + s * 0.8);
  fg.addColorStop(0, team.light);
  fg.addColorStop(0.3, team.main);
  fg.addColorStop(1, team.dark);
  ctx.fillStyle = fg;
  ctx.fill();
  ctx.lineWidth = lw(s);
  ctx.strokeStyle = OUT;
  ctx.stroke();
  ctx.strokeStyle = team.trim;
  ctx.lineWidth = Math.max(1, s * 0.04);
  ctx.strokeRect(-fw / 2 + s * 0.06, fy + s * 0.06, fw - s * 0.12, s * 0.5);
  return bw;
}

const towerCache = new Map();

/** Torre auxiliar ou do rei. As partes estáticas são renderizadas uma vez e reaproveitadas. */
export function drawTower(ctx, role, side, s, { ruined = false, active = true, t = 0, attack = 0, frozen = false, aim = 0 } = {}) {
  const team = TEAM[side];
  const R = role === 'king' ? 2.0 : 1.5;
  if (ruined) {
    ellipse(ctx, 0, s * 0.2, s * R * 0.95, s * R * 0.58, '#5c5660', s);
    for (let i = 0; i < 9; i++) {
      const ang = i * 2.4;
      const rr = s * R * (0.15 + (i % 3) * 0.2);
      ball(ctx, Math.cos(ang) * rr, Math.sin(ang) * rr * 0.55 - s * 0.1, s * (0.16 + (i % 2) * 0.08), '#9a94a2', s);
    }
    ctx.fillStyle = team.dark;
    ctx.fillRect(-s * 0.05, -s * 0.6, s * 0.08, s * 0.5);
    poly(ctx, [s * 0.03, -s * 0.6, s * 0.4, -s * 0.5, s * 0.03, -s * 0.38], team.main, s);
    return;
  }
  const top = -s * R * (role === 'king' ? 1.2 : 1.15);
  const key = `${role}|${side}|${Math.round(s * 10)}`;
  let img = towerCache.get(key);
  if (!img && typeof document !== 'undefined') {
    const W = Math.ceil(s * R * 2.6);
    const H = Math.ceil(s * R * 3.4);
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    g.translate(W / 2, H * 0.62);
    towerBody(g, s, R, top, team);
    if (role === 'king') {
      // muralha frontal com portão
      box(g, -s * R * 0.62, -s * 0.2, s * R * 1.24, s * 0.6, s * 0.08, '#b7b1c1', s);
      g.beginPath();
      g.arc(0, s * 0.4, s * 0.3, Math.PI, 0);
      g.fillStyle = '#4a3220';
      g.fill();
      g.lineWidth = lw(s);
      g.strokeStyle = OUT;
      g.stroke();
      // torreões laterais
      for (const sx of [-1, 1]) {
        box(g, sx * s * R * 0.72 - s * 0.24, top + s * 0.25, s * 0.48, s * 1.5, s * 0.1, '#bdb7c8', s);
        poly(g, [sx * s * R * 0.72 - s * 0.32, top + s * 0.3, sx * s * R * 0.72, top - s * 0.4, sx * s * R * 0.72 + s * 0.32, top + s * 0.3], team.main, s);
      }
    }
    towerCache.set(key, c);
    img = c;
  }
  if (img) ctx.drawImage(img, -img.width / 2, -img.height * 0.62);
  else towerBody(ctx, s, R, top, team);

  // ocupante animado no topo
  ctx.save();
  ctx.translate(0, top - s * 0.05);
  if (role === 'king') {
    const recoil = attack * s * 0.15;
    // canhão
    ctx.save();
    ctx.rotate(aim);
    ctx.translate(-recoil, 0);
    box(ctx, -s * 0.1, -s * 0.16, s * 0.8, s * 0.32, s * 0.14, '#3a3644', s);
    ctx.restore();
    // rei
    ctx.translate(-s * 0.05, -s * 0.15);
    ctx.scale(1.05, 1.05);
    const p = chibi(ctx, s, { bob: active ? Math.sin(t * 2) * s * 0.01 : 0 }, { body: team.main, belt: team.trim, face: active });
    poly(ctx, [p.hx - s * 0.26, p.hy - s * 0.12, p.hx - s * 0.28, p.hy - s * 0.42, p.hx - s * 0.13, p.hy - s * 0.28, p.hx, p.hy - s * 0.48, p.hx + s * 0.13, p.hy - s * 0.28, p.hx + s * 0.28, p.hy - s * 0.42, p.hx + s * 0.26, p.hy - s * 0.12], '#f2c14e', s);
    poly(ctx, [p.hx - s * 0.12, p.hy + s * 0.08, p.hx + s * 0.24, p.hy + s * 0.08, p.hx + s * 0.06, p.hy + s * 0.34], '#f1f1f4', s);
    if (!active) {
      stroke(ctx, [p.hx - s * 0.02, p.hy + s * 0.02, p.hx + s * 0.06, p.hy + s * 0.02], OUT, s * 0.03);
      stroke(ctx, [p.hx + s * 0.1, p.hy + s * 0.02, p.hx + s * 0.18, p.hy + s * 0.02], OUT, s * 0.03);
      ctx.fillStyle = '#ffffff';
      ctx.font = `900 ${Math.round(s * 0.42)}px Nunito, sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = Math.max(2, s * 0.08);
      ctx.strokeStyle = OUT;
      const zy = p.hy - s * 0.6 - ((t * 0.8) % 1) * s * 0.4;
      ctx.strokeText('Z', s * 0.45, zy);
      ctx.fillText('Z', s * 0.45, zy);
    }
  } else {
    ctx.scale(0.85, 0.85);
    ctx.translate(0, -s * 0.1);
    DRAW.arqueira(ctx, s, team, { t, attack, bob: 0, walk: 0 });
  }
  ctx.restore();
  if (frozen) {
    ctx.fillStyle = 'rgba(170,225,255,0.45)';
    ctx.beginPath();
    ctx.ellipse(0, top * 0.45, s * R * 0.85, -top * 0.75, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ------------------------------------------------------------------ ícones de feitiço e retratos

const SPELL_ICON = {
  saraivada(ctx, s) {
    for (let i = 0; i < 5; i++) {
      const x = (i - 2) * s * 0.17;
      const y = (i % 2) * s * 0.16 - s * 0.1;
      stick(ctx, x + s * 0.16, y - s * 0.34, x - s * 0.04, y + s * 0.22, '#9a6430', s * 0.05, s);
      poly(ctx, [x - s * 0.06, y + s * 0.3, x - s * 0.14, y + s * 0.16, x + s * 0.03, y + s * 0.18], '#e6ebf0', s);
      poly(ctx, [x + s * 0.16, y - s * 0.34, x + s * 0.24, y - s * 0.4, x + s * 0.12, y - s * 0.24], '#d8402f', s, false, true);
    }
  },
  meteoro(ctx, s) {
    for (let i = 0; i < 3; i++) stroke(ctx, [s * (0.18 + i * 0.12), -s * (0.5 - i * 0.04), -s * 0.04, s * 0.04], `rgba(255,${150 + i * 35},60,0.75)`, s * (0.16 - i * 0.04));
    ball(ctx, -s * 0.08, s * 0.1, s * 0.28, '#7a6658', s);
    stroke(ctx, [-s * 0.22, s * 0.02, -s * 0.04, s * 0.08, -s * 0.1, s * 0.22], '#5fe8ff', s * 0.06);
  },
  fonte(ctx, s) {
    ctx.fillStyle = 'rgba(110,240,150,0.25)';
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.42, 0, Math.PI * 2);
    ctx.fill();
    box(ctx, -s * 0.09, -s * 0.32, s * 0.18, s * 0.64, s * 0.05, '#5be08a', s);
    box(ctx, -s * 0.32, -s * 0.09, s * 0.64, s * 0.18, s * 0.05, '#5be08a', s);
  },
  hino(ctx, s) {
    ctx.fillStyle = 'rgba(255,200,60,0.25)';
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.42, 0, Math.PI * 2);
    ctx.fill();
    poly(ctx, [-s * 0.22, s * 0.3, -s * 0.04, -s * 0.02, -s * 0.18, -s * 0.02, s * 0.06, -s * 0.38, s * 0.22, -s * 0.38, s * 0.06, -s * 0.12, s * 0.2, -s * 0.12], '#f7c64a', s);
  },
  geada(ctx, s) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      stick(ctx, 0, 0, Math.cos(a) * s * 0.4, Math.sin(a) * s * 0.4, '#bfeaff', s * 0.07, s);
    }
    ball(ctx, 0, 0, s * 0.12, '#ffffff', s);
  },
  faisca(ctx, s) {
    ctx.fillStyle = 'rgba(120,200,255,0.25)';
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.42, 0, Math.PI * 2);
    ctx.fill();
    poly(ctx, [s * 0.08, -s * 0.44, -s * 0.2, s * 0.04, -s * 0.02, s * 0.04, -s * 0.1, s * 0.44, s * 0.22, -s * 0.08, s * 0.02, -s * 0.08], '#9fe0ff', s);
  },
};

export function drawCardArt(ctx, card, s) {
  if (card.type === 'spell') {
    (SPELL_ICON[card.id] || (() => ball(ctx, 0, 0, s * 0.3, '#ccc', s)))(ctx, s);
    return;
  }
  const big = { golem: 0.55, gigante: 0.78, forja: 0.62, balista: 0.62, canhao: 0.7, javali: 0.72, dragonete: 0.8, grifo: 0.78 }[card.unitId] || 1;
  ctx.save();
  ctx.translate(0, s * 0.18);
  ctx.scale(big, big);
  if (card.count > 1) {
    ctx.save();
    ctx.translate(-s * 0.26, -s * 0.06);
    ctx.scale(0.72, 0.72);
    drawUnit(ctx, card.unitId, 0, s, { t: 0.3 });
    ctx.restore();
    ctx.translate(s * 0.14, s * 0.06);
  }
  drawUnit(ctx, card.unitId, 0, s, { t: 0 });
  ctx.restore();
}

const artCache = new Map();
/** Retrato da carta como dataURL (gerado uma vez). */
export function cardArtURL(card, px = 128) {
  const key = `${card.id}:${px}`;
  if (artCache.has(key)) return artCache.get(key);
  if (typeof document === 'undefined') return '';
  const W = px;
  const H = Math.round(px * 1.2);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  const bg = { troop: ['#7cc0f0', '#2c5a8f'], building: ['#e0b878', '#6e4a28'], spell: ['#c79cf0', '#41246e'] }[card.type];
  const grd = ctx.createRadialGradient(W / 2, H * 0.4, W * 0.05, W / 2, H / 2, W * 0.85);
  grd.addColorStop(0, bg[0]);
  grd.addColorStop(1, bg[1]);
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, W, H);
  // raios de luz
  ctx.save();
  ctx.translate(W / 2, H * 0.42);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  for (let i = 0; i < 10; i++) {
    ctx.rotate(Math.PI / 5);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(W, -W * 0.12);
    ctx.lineTo(W, W * 0.12);
    ctx.fill();
  }
  ctx.restore();
  // chão
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(W / 2, H * 0.84, W * 0.36, H * 0.07, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.translate(W / 2, H * 0.55);
  drawCardArt(ctx, card, px * 0.72);
  const url = c.toDataURL();
  artCache.set(key, url);
  return url;
}

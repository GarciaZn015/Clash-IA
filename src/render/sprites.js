// Arte vetorial procedural de todas as unidades, torres e ícones de feitiço.
// Cada função desenha centrada na origem; `s` é o tamanho em pixels de 1 tile.

export const TEAM = [
  { main: '#3b82f6', light: '#9cc8ff', dark: '#1d3f8f', glow: 'rgba(80,160,255,0.55)' },
  { main: '#e0453a', light: '#ffaa9e', dark: '#7d1f1a', glow: 'rgba(255,90,70,0.55)' },
];

function circle(ctx, x, y, r, fill, stroke, lw = 1) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.lineWidth = lw;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

function ellipse(ctx, x, y, rx, ry, fill) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

function poly(ctx, pts, fill, stroke, lw = 1) {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.lineWidth = lw;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

function line(ctx, x1, y1, x2, y2, color, lw) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.stroke();
}

const OUT = 'rgba(20,16,24,0.85)';

/** Corpo humanoide genérico: túnica do time + cabeça. */
function humanoid(ctx, s, team, { robe, skin = '#f1c9a0', hat = null, h = 1 }) {
  const bw = s * 0.32;
  poly(ctx, [-bw, s * 0.2, -bw * 0.7, -s * 0.22 * h, bw * 0.7, -s * 0.22 * h, bw, s * 0.2], robe || team.main, OUT, s * 0.04);
  ctx.fillStyle = team.dark;
  ctx.fillRect(-bw * 0.85, s * 0.02, bw * 1.7, s * 0.06);
  circle(ctx, 0, -s * 0.34 * h, s * 0.15, skin, OUT, s * 0.035);
  if (hat) hat();
}

const DRAW = {
  escudeiro(ctx, s, team, a) {
    humanoid(ctx, s, team, { robe: '#8c96a3' });
    // capacete
    ctx.beginPath();
    ctx.arc(0, -s * 0.36, s * 0.16, Math.PI, 0);
    ctx.fillStyle = '#c9d1db';
    ctx.fill();
    ctx.strokeStyle = OUT;
    ctx.lineWidth = s * 0.035;
    ctx.stroke();
    line(ctx, 0, -s * 0.52, 0, -s * 0.62, team.main, s * 0.06);
    // espada
    const sw = a.attack * 1.6;
    ctx.save();
    ctx.translate(s * 0.3, -s * 0.05);
    ctx.rotate(-0.6 + sw);
    line(ctx, 0, 0, 0, -s * 0.5, '#e8eef5', s * 0.07);
    line(ctx, -s * 0.09, -s * 0.04, s * 0.09, -s * 0.04, '#a77b3a', s * 0.06);
    ctx.restore();
    // escudo
    if (a.shield) {
      poly(ctx, [-s * 0.5, -s * 0.2, -s * 0.18, -s * 0.24, -s * 0.16, s * 0.12, -s * 0.33, s * 0.3, -s * 0.5, s * 0.12], team.main, OUT, s * 0.04);
      circle(ctx, -s * 0.33, -s * 0.02, s * 0.06, '#f2c14e');
    }
  },
  arqueira(ctx, s, team, a) {
    humanoid(ctx, s, team, { robe: '#3f7d3a', hat: () => {
      poly(ctx, [-s * 0.18, -s * 0.33, 0, -s * 0.62, s * 0.18, -s * 0.33], '#2f5f2b', OUT, s * 0.03);
    } });
    ctx.fillStyle = team.main;
    ctx.fillRect(-s * 0.22, -s * 0.12, s * 0.44, s * 0.08);
    ctx.save();
    ctx.translate(s * 0.28, -s * 0.08);
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.3, -1.2, 1.2);
    ctx.strokeStyle = '#8a5a2b';
    ctx.lineWidth = s * 0.06;
    ctx.stroke();
    const pull = a.attack * 0.12 * s;
    line(ctx, Math.cos(-1.2) * s * 0.3, Math.sin(-1.2) * s * 0.3, -pull, 0, '#eee', s * 0.02);
    line(ctx, -pull, 0, Math.cos(1.2) * s * 0.3, Math.sin(1.2) * s * 0.3, '#eee', s * 0.02);
    ctx.restore();
  },
  lobo(ctx, s, team, a) {
    const b = a.bob * 0.5;
    ellipse(ctx, 0, -s * 0.05 + b, s * 0.38, s * 0.2, '#3d3a45');
    poly(ctx, [-s * 0.36, -s * 0.05 + b, -s * 0.62, -s * 0.2 + b, -s * 0.38, s * 0.06 + b], '#2b2932');
    circle(ctx, s * 0.32, -s * 0.18 + b, s * 0.16, '#4a4655', OUT, s * 0.03);
    poly(ctx, [s * 0.22, -s * 0.3 + b, s * 0.26, -s * 0.46 + b, s * 0.34, -s * 0.31 + b], '#4a4655');
    poly(ctx, [s * 0.4, -s * 0.18 + b, s * 0.58, -s * 0.12 + b, s * 0.42, -s * 0.08 + b], '#57536a');
    circle(ctx, s * 0.37, -s * 0.21 + b, s * 0.03, '#ff5a3c');
    ctx.fillStyle = team.main;
    ctx.fillRect(-s * 0.12, -s * 0.24 + b, s * 0.18, s * 0.1);
  },
  diabrete(ctx, s, team, a) {
    const b = a.bob;
    circle(ctx, 0, -s * 0.1 + b, s * 0.26, '#d9673e', OUT, s * 0.04);
    poly(ctx, [-s * 0.18, -s * 0.28 + b, -s * 0.3, -s * 0.52 + b, -s * 0.06, -s * 0.33 + b], '#f5e2c0');
    poly(ctx, [s * 0.18, -s * 0.28 + b, s * 0.3, -s * 0.52 + b, s * 0.06, -s * 0.33 + b], '#f5e2c0');
    circle(ctx, -s * 0.08, -s * 0.13 + b, s * 0.05, '#fff7a0');
    circle(ctx, s * 0.09, -s * 0.13 + b, s * 0.05, '#fff7a0');
    ctx.fillStyle = team.main;
    ctx.fillRect(-s * 0.2, s * 0.04 + b, s * 0.4, s * 0.08);
    line(ctx, s * 0.26, b, s * 0.42, -s * 0.2 + b - a.attack * s * 0.2, '#c0c6cf', s * 0.05);
  },
  corvo(ctx, s, team, a) {
    const flap = Math.sin(a.t * 18) * 0.5;
    ctx.save();
    ctx.scale(1, 1);
    poly(ctx, [0, 0, -s * 0.55, -s * (0.15 + flap * 0.3), -s * 0.2, s * 0.1], '#1d1b26', OUT, s * 0.02);
    poly(ctx, [0, 0, s * 0.55, -s * (0.15 + flap * 0.3), s * 0.2, s * 0.1], '#1d1b26', OUT, s * 0.02);
    ctx.restore();
    ellipse(ctx, 0, 0, s * 0.16, s * 0.22, '#2a2736');
    poly(ctx, [-s * 0.05, -s * 0.18, 0, -s * 0.32, s * 0.05, -s * 0.18], '#e2b13c');
    circle(ctx, 0, -s * 0.12, s * 0.035, team.light);
    ctx.fillStyle = team.main;
    ctx.fillRect(-s * 0.08, s * 0.12, s * 0.16, s * 0.06);
  },
  bombardeiro(ctx, s, team, a) {
    poly(ctx, [-s * 0.34, s * 0.2, -s * 0.3, -s * 0.15, s * 0.3, -s * 0.15, s * 0.34, s * 0.2], team.main, OUT, s * 0.04);
    circle(ctx, 0, -s * 0.28, s * 0.16, '#f1c9a0', OUT, s * 0.035);
    poly(ctx, [-s * 0.16, -s * 0.24, 0, s * 0.08, s * 0.16, -s * 0.24], '#d2752c');
    ctx.beginPath();
    ctx.arc(0, -s * 0.33, s * 0.17, Math.PI, 0);
    ctx.fillStyle = '#6c4a2e';
    ctx.fill();
    const lift = a.attack * s * 0.25;
    circle(ctx, s * 0.32, -s * 0.12 - lift, s * 0.12, '#2a2a33', OUT, s * 0.03);
    line(ctx, s * 0.36, -s * 0.24 - lift, s * 0.42, -s * 0.32 - lift, '#ffb030', s * 0.03);
  },
  mago(ctx, s, team, a) {
    humanoid(ctx, s, team, { robe: '#5b3fa0', h: 1.05, hat: () => {
      poly(ctx, [-s * 0.24, -s * 0.38, s * 0.04, -s * 0.85, s * 0.24, -s * 0.38], '#4a3285', OUT, s * 0.035);
      ctx.fillStyle = team.main;
      ctx.fillRect(-s * 0.22, -s * 0.43, s * 0.44, s * 0.06);
    } });
    line(ctx, s * 0.32, s * 0.2, s * 0.32, -s * 0.55, '#8a5a2b', s * 0.06);
    circle(ctx, s * 0.32, -s * 0.6, s * (0.08 + a.attack * 0.12), a.attack > 0 ? '#ffe680' : '#8ff0ff', null);
  },
  javali(ctx, s, team, a) {
    const b = a.bob * 0.6;
    ellipse(ctx, 0, b, s * 0.48, s * 0.27, '#7a4f31');
    circle(ctx, s * 0.42, -s * 0.05 + b, s * 0.2, '#6b4429', OUT, s * 0.03);
    poly(ctx, [s * 0.52, s * 0.02 + b, s * 0.68, -s * 0.12 + b, s * 0.55, -s * 0.03 + b], '#f3ead8');
    circle(ctx, s * 0.47, -s * 0.12 + b, s * 0.035, '#ffcf3c');
    for (let i = -2; i <= 2; i++) poly(ctx, [i * s * 0.1 - s * 0.05, -s * 0.22 + b, i * s * 0.1, -s * 0.36 + b, i * s * 0.1 + s * 0.05, -s * 0.22 + b], '#3d2716');
    // cavaleiro
    poly(ctx, [-s * 0.15, -s * 0.15 + b, -s * 0.1, -s * 0.5 + b, s * 0.12, -s * 0.5 + b, s * 0.15, -s * 0.15 + b], team.main, OUT, s * 0.035);
    circle(ctx, 0, -s * 0.62 + b, s * 0.13, '#f1c9a0', OUT, s * 0.03);
    ctx.save();
    ctx.translate(s * 0.12, -s * 0.4 + b);
    ctx.rotate(-0.9 + a.attack * 2);
    line(ctx, 0, 0, 0, -s * 0.36, '#5a4030', s * 0.06);
    ellipse(ctx, 0, -s * 0.38, s * 0.1, s * 0.07, '#9ba3ad');
    ctx.restore();
  },
  golem(ctx, s, team, a, kind = 1) {
    const k = kind;
    const b = a.bob * 0.3;
    poly(ctx, [-s * 0.55 * k, s * 0.3, -s * 0.62 * k, -s * 0.25 + b, -s * 0.3 * k, -s * 0.6 + b, s * 0.3 * k, -s * 0.6 + b, s * 0.62 * k, -s * 0.25 + b, s * 0.55 * k, s * 0.3], '#7d7a86', OUT, s * 0.05);
    poly(ctx, [-s * 0.3 * k, -s * 0.6 + b, -s * 0.2 * k, -s * 0.85 + b, s * 0.2 * k, -s * 0.85 + b, s * 0.3 * k, -s * 0.6 + b], '#8e8b98', OUT, s * 0.04);
    const glow = a.attack > 0 ? '#ffffff' : '#5fe8ff';
    circle(ctx, -s * 0.1 * k, -s * 0.72 + b, s * 0.05, glow);
    circle(ctx, s * 0.1 * k, -s * 0.72 + b, s * 0.05, glow);
    line(ctx, -s * 0.2 * k, -s * 0.2 + b, 0, -s * 0.4 + b, '#5fe8ff', s * 0.05);
    line(ctx, 0, -s * 0.4 + b, s * 0.2 * k, -s * 0.15 + b, '#5fe8ff', s * 0.05);
    ctx.fillStyle = team.main;
    ctx.fillRect(-s * 0.5 * k, s * 0.05, s * k, s * 0.1);
    const punch = a.attack * s * 0.3;
    circle(ctx, -s * 0.7 * k, -s * 0.05 + punch, s * 0.2 * k, '#6c6975', OUT, s * 0.04);
    circle(ctx, s * 0.7 * k, -s * 0.05 + punch, s * 0.2 * k, '#6c6975', OUT, s * 0.04);
  },
  fragmento(ctx, s, team, a) {
    DRAW.golem(ctx, s, team, a, 0.6);
  },
  grifo(ctx, s, team, a) {
    const flap = Math.sin(a.t * 10) * 0.35;
    poly(ctx, [-s * 0.1, -s * 0.1, -s * 0.75, -s * (0.45 + flap), -s * 0.55, s * 0.05], '#f3eee2', OUT, s * 0.03);
    poly(ctx, [s * 0.1, -s * 0.1, s * 0.75, -s * (0.45 + flap), s * 0.55, s * 0.05], '#f3eee2', OUT, s * 0.03);
    ellipse(ctx, 0, 0, s * 0.3, s * 0.22, '#c79a52');
    circle(ctx, s * 0.25, -s * 0.18, s * 0.15, '#f7f3ea', OUT, s * 0.03);
    poly(ctx, [s * 0.36, -s * 0.2, s * 0.52, -s * 0.12, s * 0.36, -s * 0.1], '#f2b134');
    circle(ctx, s * 0.29, -s * 0.22, s * 0.03, '#222');
    ctx.fillStyle = team.main;
    ctx.fillRect(-s * 0.2, -s * 0.05, s * 0.3, s * 0.08);
  },
  dragonete(ctx, s, team, a) {
    const flap = Math.sin(a.t * 9) * 0.3;
    poly(ctx, [-s * 0.1, -s * 0.1, -s * 0.8, -s * (0.5 + flap), -s * 0.6, -s * 0.1, -s * 0.4, s * 0.1], '#b8322a', OUT, s * 0.03);
    poly(ctx, [s * 0.1, -s * 0.1, s * 0.8, -s * (0.5 + flap), s * 0.6, -s * 0.1, s * 0.4, s * 0.1], '#b8322a', OUT, s * 0.03);
    ellipse(ctx, 0, 0, s * 0.3, s * 0.24, '#e0603a');
    poly(ctx, [-s * 0.28, s * 0.05, -s * 0.6, s * 0.3, -s * 0.22, s * 0.15], '#e0603a');
    circle(ctx, s * 0.28, -s * 0.2, s * 0.17, '#e86a40', OUT, s * 0.03);
    poly(ctx, [s * 0.2, -s * 0.33, s * 0.22, -s * 0.48, s * 0.3, -s * 0.34], '#f3e3c0');
    circle(ctx, s * 0.33, -s * 0.23, s * 0.035, '#ffe680');
    ellipse(ctx, 0, s * 0.02, s * 0.15, s * 0.12, '#f7c06a');
    ctx.fillStyle = team.main;
    ctx.fillRect(-s * 0.12, -s * 0.2, s * 0.22, s * 0.07);
  },
  feiticeira(ctx, s, team, a) {
    humanoid(ctx, s, team, { robe: '#232136', skin: '#d9c7e8', hat: () => {
      ctx.beginPath();
      ctx.arc(0, -s * 0.36, s * 0.19, Math.PI * 0.9, Math.PI * 2.1);
      ctx.fillStyle = '#16141f';
      ctx.fill();
    } });
    ctx.fillStyle = team.main;
    ctx.fillRect(-s * 0.24, -s * 0.16, s * 0.48, s * 0.06);
    const pulse = 0.1 + Math.sin(a.t * 6) * 0.02 + a.attack * 0.08;
    circle(ctx, s * 0.32, -s * 0.25, s * pulse * 1.6, 'rgba(79,224,208,0.25)');
    circle(ctx, s * 0.32, -s * 0.25, s * pulse, '#4fe0d0', OUT, s * 0.02);
  },
  balista(ctx, s, team, a) {
    ellipse(ctx, 0, s * 0.15, s * 0.8, s * 0.45, '#6b6158');
    ellipse(ctx, 0, s * 0.08, s * 0.66, s * 0.36, '#857a6f');
    ctx.save();
    ctx.rotate(a.aim || 0);
    ctx.fillStyle = '#7a5130';
    ctx.fillRect(-s * 0.1, -s * 0.15, s * 0.75, s * 0.3);
    ctx.beginPath();
    ctx.arc(s * 0.45, 0, s * 0.45, -1.3, 1.3);
    ctx.strokeStyle = '#4a3020';
    ctx.lineWidth = s * 0.09;
    ctx.stroke();
    line(ctx, s * 0.6 - a.attack * s * 0.3, 0, s * 0.95, 0, '#d8dde3', s * 0.05);
    ctx.restore();
    circle(ctx, 0, 0, s * 0.16, team.main, OUT, s * 0.04);
  },
  forja(ctx, s, team, a) {
    ellipse(ctx, 0, s * 0.2, s * 0.85, s * 0.45, '#5b5249');
    poly(ctx, [-s * 0.6, s * 0.2, -s * 0.55, -s * 0.35, s * 0.55, -s * 0.35, s * 0.6, s * 0.2], '#7a6c5e', OUT, s * 0.05);
    poly(ctx, [-s * 0.7, -s * 0.33, 0, -s * 0.85, s * 0.7, -s * 0.33], team.main, OUT, s * 0.05);
    const g = 0.6 + Math.sin(a.t * 7) * 0.3;
    ctx.beginPath();
    ctx.arc(0, s * 0.12, s * 0.24, Math.PI, 0);
    ctx.fillStyle = `rgba(255,${120 + g * 80},40,1)`;
    ctx.fill();
    ctx.fillStyle = '#5b5249';
    ctx.fillRect(s * 0.25, -s * 0.95, s * 0.16, s * 0.4);
  },
};

export function drawUnit(ctx, defId, side, s, anim = {}) {
  const team = TEAM[side] || TEAM[0];
  const a = { t: 0, attack: 0, bob: 0, shield: true, ...anim };
  const fn = DRAW[defId];
  if (fn) fn(ctx, s, team, a);
  else circle(ctx, 0, 0, s * 0.4, team.main, OUT, 2);
}

/** Torre auxiliar ou do rei. `ruined` desenha os escombros. */
export function drawTower(ctx, role, side, s, { ruined = false, active = true, t = 0, attack = 0, frozen = false } = {}) {
  const team = TEAM[side];
  const R = role === 'king' ? 2.0 : 1.5;
  if (ruined) {
    ellipse(ctx, 0, 0, s * R * 0.95, s * R * 0.6, '#5c564f');
    for (let i = 0; i < 7; i++) {
      const ang = i * 2.1;
      const rr = s * R * (0.25 + (i % 3) * 0.18);
      poly(ctx, [Math.cos(ang) * rr - s * 0.2, Math.sin(ang) * rr * 0.6, Math.cos(ang) * rr, Math.sin(ang) * rr * 0.6 - s * 0.3, Math.cos(ang) * rr + s * 0.25, Math.sin(ang) * rr * 0.6], '#8a837b', OUT, s * 0.03);
    }
    return;
  }
  // base
  ellipse(ctx, 0, s * 0.2, s * R * 1.0, s * R * 0.7, '#5e5a63');
  ellipse(ctx, 0, 0, s * R * 0.92, s * R * 0.62, '#9c97a3');
  // anel de pedras
  ctx.strokeStyle = 'rgba(40,36,44,0.35)';
  ctx.lineWidth = s * 0.04;
  for (let i = 0; i < 10; i++) {
    const ang = (i / 10) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(ang) * s * R * 0.55, Math.sin(ang) * s * R * 0.37);
    ctx.lineTo(Math.cos(ang) * s * R * 0.9, Math.sin(ang) * s * R * 0.6);
    ctx.stroke();
  }
  // corpo da torre
  const bw = s * R * 0.55;
  const top = -s * R * (role === 'king' ? 0.95 : 0.85);
  ctx.fillStyle = '#b3aeb9';
  ctx.fillRect(-bw, top, bw * 2, -top + s * 0.05);
  ctx.strokeStyle = OUT;
  ctx.lineWidth = s * 0.05;
  ctx.strokeRect(-bw, top, bw * 2, -top + s * 0.05);
  // ameias
  for (let i = 0; i < 4; i++) {
    const x = -bw + (i * bw * 2) / 3.5;
    ctx.fillStyle = '#c8c3cd';
    ctx.fillRect(x, top - s * 0.18, bw * 0.38, s * 0.2);
    ctx.strokeRect(x, top - s * 0.18, bw * 0.38, s * 0.2);
  }
  // estandarte do time
  ctx.fillStyle = team.main;
  ctx.fillRect(-bw * 0.45, top + s * 0.18, bw * 0.9, -top * 0.55);
  poly(ctx, [-bw * 0.45, top + s * 0.18 - top * 0.55, 0, top + s * 0.4 - top * 0.55, bw * 0.45, top + s * 0.18 - top * 0.55], team.main);
  if (role === 'king') {
    // coroa
    const cy = top + s * 0.45;
    poly(ctx, [-s * 0.3, cy, -s * 0.3, cy - s * 0.22, -s * 0.15, cy - s * 0.1, 0, cy - s * 0.28, s * 0.15, cy - s * 0.1, s * 0.3, cy - s * 0.22, s * 0.3, cy], '#f2c14e', OUT, s * 0.03);
    // canhão
    ctx.save();
    ctx.translate(0, top - s * 0.1);
    const recoil = attack * s * 0.15;
    ctx.fillStyle = '#2d2b33';
    ctx.fillRect(-s * 0.16, (side === 0 ? -s * 0.6 : 0) + (side === 0 ? recoil : -recoil), s * 0.32, s * 0.6);
    ctx.restore();
    if (!active) {
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.font = `bold ${Math.round(s * 0.45)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('z', s * 0.6, top - s * 0.2 - Math.sin(t * 2) * s * 0.1);
    }
  } else {
    // arqueiro da torre
    circle(ctx, 0, top - s * 0.25, s * 0.18, '#f1c9a0', OUT, s * 0.03);
    ctx.beginPath();
    ctx.arc(0, top - s * 0.28, s * 0.19, Math.PI, 0);
    ctx.fillStyle = team.dark;
    ctx.fill();
  }
  if (frozen) {
    ctx.fillStyle = 'rgba(170,225,255,0.45)';
    ctx.fillRect(-bw, top, bw * 2, -top);
  }
}

const SPELL_ICON = {
  saraivada(ctx, s) {
    for (let i = 0; i < 5; i++) {
      const x = (i - 2) * s * 0.18;
      const y = (i % 2) * s * 0.15 - s * 0.1;
      line(ctx, x + s * 0.15, y - s * 0.3, x - s * 0.05, y + s * 0.25, '#8a5a2b', s * 0.05);
      poly(ctx, [x - s * 0.05, y + s * 0.25, x - s * 0.12, y + s * 0.14, x + s * 0.02, y + s * 0.16], '#d8dde3');
    }
  },
  meteoro(ctx, s) {
    for (let i = 0; i < 3; i++) line(ctx, s * (0.1 + i * 0.12), -s * (0.45 - i * 0.05), -s * 0.05, s * 0.05, `rgba(255,${160 + i * 30},60,0.7)`, s * (0.12 - i * 0.03));
    circle(ctx, -s * 0.08, s * 0.08, s * 0.25, '#6b5a4f', OUT, s * 0.04);
    line(ctx, -s * 0.2, s * 0.02, 0, s * 0.14, '#5fe8ff', s * 0.05);
  },
  fonte(ctx, s) {
    circle(ctx, 0, 0, s * 0.38, 'rgba(110,240,150,0.25)');
    ctx.fillStyle = '#5be08a';
    ctx.fillRect(-s * 0.08, -s * 0.3, s * 0.16, s * 0.6);
    ctx.fillRect(-s * 0.3, -s * 0.08, s * 0.6, s * 0.16);
  },
  hino(ctx, s) {
    circle(ctx, 0, 0, s * 0.38, 'rgba(255,200,60,0.25)');
    poly(ctx, [-s * 0.25, s * 0.25, -s * 0.05, -s * 0.05, -s * 0.2, -s * 0.05, s * 0.05, -s * 0.38, s * 0.25, -s * 0.38, s * 0.05, -s * 0.12, s * 0.2, -s * 0.12], '#f7c64a', OUT, s * 0.03);
  },
  geada(ctx, s) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      line(ctx, 0, 0, Math.cos(a) * s * 0.4, Math.sin(a) * s * 0.4, '#bfeaff', s * 0.07);
      line(ctx, Math.cos(a) * s * 0.22, Math.sin(a) * s * 0.22, Math.cos(a + 0.5) * s * 0.3, Math.sin(a + 0.5) * s * 0.3, '#bfeaff', s * 0.04);
    }
    circle(ctx, 0, 0, s * 0.1, '#ffffff');
  },
};

export function drawCardArt(ctx, card, s) {
  if (card.type === 'spell') {
    (SPELL_ICON[card.id] || (() => circle(ctx, 0, 0, s * 0.3, '#ccc')))(ctx, s);
    return;
  }
  const scale = card.unitId === 'golem' ? 0.62 : ['balista', 'forja'].includes(card.unitId) ? 0.7 : 1;
  ctx.save();
  ctx.translate(0, s * 0.12);
  ctx.scale(scale, scale);
  if (card.count > 1) {
    ctx.save();
    ctx.translate(-s * 0.22, -s * 0.08);
    ctx.scale(0.7, 0.7);
    drawUnit(ctx, card.unitId, 0, s, { t: 0.3 });
    ctx.restore();
    ctx.translate(s * 0.12, s * 0.05);
  }
  drawUnit(ctx, card.unitId, 0, s, { t: 0 });
  ctx.restore();
}

const artCache = new Map();
/** Retorna uma dataURL com o retrato da carta (gerado uma vez). */
export function cardArtURL(card, px = 96) {
  const key = `${card.id}:${px}`;
  if (artCache.has(key)) return artCache.get(key);
  if (typeof document === 'undefined') return '';
  const c = document.createElement('canvas');
  c.width = px;
  c.height = px;
  const ctx = c.getContext('2d');
  const grd = ctx.createRadialGradient(px / 2, px * 0.45, px * 0.1, px / 2, px / 2, px * 0.7);
  const bg = { troop: ['#4a6a8f', '#1f2c40'], building: ['#7a6a52', '#2e271d'], spell: ['#6a4a8f', '#24183a'] }[card.type];
  grd.addColorStop(0, bg[0]);
  grd.addColorStop(1, bg[1]);
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, px, px);
  ctx.translate(px / 2, px / 2);
  drawCardArt(ctx, card, px * 0.62);
  const url = c.toDataURL();
  artCache.set(key, url);
  return url;
}

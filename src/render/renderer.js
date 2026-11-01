// Renderização da arena em Canvas 2D. Lê o estado da partida (somente leitura) e os efeitos visuais.
// O cenário estático é pré-renderizado uma vez por tamanho de tela; o resto é desenhado a cada quadro.
import { ARENA_W, ARENA_H, RIVER_TOP, RIVER_BOTTOM, BRIDGES, TOWER_LAYOUT, mirrorY } from '../core/constants.js';
import { createRng } from '../core/rng.js';
import { getCard } from '../data/cards.js';
import { getUnit } from '../data/units.js';
import { deployZones } from '../sim/placement.js';
import { drawUnit, drawTower, TEAM, tone } from './sprites.js';

/** Unidades são desenhadas maiores que a hitbox para ficarem legíveis no celular. */
const UNIT_VISUAL_SCALE = 1.4;
/** Altura de voo das unidades aéreas (tiles). */
const AIR_LIFT = 1.1;

function visualScale(e) {
  if (e.kind === 'building') return 1;
  const base = (e.radius / 0.5) * UNIT_VISUAL_SCALE;
  if (e.defId === 'golem') return base * 0.7;
  if (e.defId === 'gigante') return base * 0.78;
  if (e.defId === 'fragmento') return base * 0.9;
  return base;
}

export class Renderer {
  constructor(canvas, palette) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.palette = palette;
    this.scale = 20;
    this.offX = 0;
    this.offY = 0;
    this.dpr = 1;
    this.bg = null;
    this.time = 0;
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
    const w = Math.max(1, Math.floor(rect.width * dpr));
    const h = Math.max(1, Math.floor(rect.height * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.dpr = dpr;
    this.scale = Math.min(w / ARENA_W, h / ARENA_H);
    this.offX = (w - ARENA_W * this.scale) / 2;
    this.offY = (h - ARENA_H * this.scale) / 2;
    this.buildBackground();
  }

  /** Redimensiona se o tamanho exibido do canvas mudou (layout, barra de endereço do celular, fontes…). */
  ensureSize() {
    const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
    const w = Math.max(1, Math.floor(this.canvas.clientWidth * dpr));
    const h = Math.max(1, Math.floor(this.canvas.clientHeight * dpr));
    if (w !== this.canvas.width || h !== this.canvas.height || dpr !== this.dpr) this.resize();
  }

  /** Converte coordenadas de cliente (CSS px) para o mundo usando a proporção real exibida do canvas. */
  clientToWorld(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const kx = this.canvas.width / (rect.width || 1);
    const ky = this.canvas.height / (rect.height || 1);
    const px = (clientX - rect.left) * kx;
    const py = (clientY - rect.top) * ky;
    return { x: (px - this.offX) / this.scale, y: (py - this.offY) / this.scale };
  }

  // ---------------------------------------------------------------- cenário estático

  buildBackground() {
    const s = this.scale;
    const c = document.createElement('canvas');
    c.width = this.canvas.width;
    c.height = this.canvas.height;
    const g = c.getContext('2d');
    const P = this.palette;
    const rng = createRng(77);

    // floresta fora da arena (visível em telas largas)
    g.fillStyle = tone(P.border, -0.35);
    g.fillRect(0, 0, c.width, c.height);
    if (this.offX > s * 0.5) {
      for (let i = 0; i < 160; i++) {
        const left = i % 2 === 0;
        const x = left ? rng.range(-s, this.offX) : rng.range(this.offX + ARENA_W * s, c.width + s);
        const y = rng.range(-s, c.height + s);
        this.tree(g, x, y, s * rng.range(0.7, 1.2), P);
      }
    }

    g.save();
    g.translate(this.offX, this.offY);
    const W = ARENA_W * s;
    const H = ARENA_H * s;

    // grama em faixas (gramado aparado) com quadriculado sutil
    for (let y = 0; y < ARENA_H; y++) {
      for (let x = 0; x < ARENA_W; x++) {
        const base = (x + y) % 2 ? P.grassA : P.grassB;
        g.fillStyle = base;
        g.fillRect(x * s, y * s, s + 0.6, s + 0.6);
      }
    }
    const shade = g.createLinearGradient(0, 0, W, 0);
    shade.addColorStop(0, 'rgba(0,0,0,0.12)');
    shade.addColorStop(0.15, 'rgba(0,0,0,0)');
    shade.addColorStop(0.85, 'rgba(0,0,0,0)');
    shade.addColorStop(1, 'rgba(0,0,0,0.12)');
    g.fillStyle = shade;
    g.fillRect(0, 0, W, H);
    // tufos e folhinhas
    for (let i = 0; i < 900; i++) {
      const x = rng.range(0, ARENA_W);
      const y = rng.range(0, ARENA_H);
      if (y > RIVER_TOP - 0.3 && y < RIVER_BOTTOM + 0.3) continue;
      g.strokeStyle = rng.chance(0.5) ? tone(P.grassA, -0.18) : tone(P.grassB, 0.15);
      g.lineWidth = Math.max(1, s * 0.035);
      g.beginPath();
      g.moveTo(x * s, y * s);
      g.lineTo((x - 0.05) * s, (y - 0.16) * s);
      g.moveTo(x * s, y * s);
      g.lineTo((x + 0.07) * s, (y - 0.13) * s);
      g.stroke();
    }
    for (let i = 0; i < 40; i++) {
      const x = rng.range(0.3, ARENA_W - 0.3);
      const y = rng.range(0.3, ARENA_H - 0.3);
      if (y > RIVER_TOP - 0.5 && y < RIVER_BOTTOM + 0.5) continue;
      g.fillStyle = rng.pick(['#fff6c8', '#ffd1e6', '#ffe27a', '#d6e8ff']);
      g.beginPath();
      g.arc(x * s, y * s, s * 0.06, 0, Math.PI * 2);
      g.fill();
    }

    // lado de cada time (tom bem leve)
    g.fillStyle = 'rgba(60,120,255,0.05)';
    g.fillRect(0, RIVER_BOTTOM * s, W, (ARENA_H - RIVER_BOTTOM) * s);
    g.fillStyle = 'rgba(255,70,60,0.05)';
    g.fillRect(0, 0, W, RIVER_TOP * s);

    // caminhos de pedra
    const paths = [];
    for (const b of BRIDGES) paths.push([[b.x, 5.2], [b.x, 26.8]]);
    for (const yk of [3, 29]) {
      const yp = yk === 3 ? 6.5 : 25.5;
      const dir = yk === 3 ? 1 : -1;
      for (const side of [-1, 1]) {
        const pts = [];
        for (let t = 0; t <= 1.0001; t += 0.1) {
          const x = 9 + side * (5.5 * t);
          const y = yk + dir * 1.6 + (yp - yk - dir * 1.6) * Math.sin((t * Math.PI) / 2);
          pts.push([x, y]);
        }
        paths.push(pts);
      }
    }
    const strokePath = (pts, width, color) => {
      g.strokeStyle = color;
      g.lineWidth = width;
      g.lineCap = 'round';
      g.lineJoin = 'round';
      g.beginPath();
      g.moveTo(pts[0][0] * s, pts[0][1] * s);
      for (const [x, y] of pts.slice(1)) g.lineTo(x * s, y * s);
      g.stroke();
    };
    for (const pts of paths) strokePath(pts, s * 1.55, tone(P.path, -0.3));
    for (const pts of paths) strokePath(pts, s * 1.35, P.path);
    // pedras do calçamento
    for (const pts of paths) {
      for (let i = 0; i < pts.length - 1; i++) {
        const [x0, y0] = pts[i];
        const [x1, y1] = pts[i + 1];
        const len = Math.hypot(x1 - x0, y1 - y0);
        const n = Math.ceil(len * 3);
        for (let k = 0; k < n; k++) {
          const t = k / n;
          const px = x0 + (x1 - x0) * t + rng.range(-0.5, 0.5);
          const py = y0 + (y1 - y0) * t + rng.range(-0.5, 0.5);
          if (py > RIVER_TOP - 0.2 && py < RIVER_BOTTOM + 0.2) continue;
          const r = s * rng.range(0.1, 0.17);
          g.fillStyle = tone(P.path, rng.range(-0.15, 0.12));
          g.beginPath();
          g.ellipse(px * s, py * s, r, r * 0.75, rng.range(0, 3), 0, Math.PI * 2);
          g.fill();
          g.strokeStyle = tone(P.path, -0.3);
          g.lineWidth = Math.max(0.6, s * 0.018);
          g.stroke();
        }
      }
    }

    // plataformas das torres
    for (const side of [0, 1]) {
      for (const t of TOWER_LAYOUT) {
        const y = side === 0 ? t.y : mirrorY(t.y);
        const R = (t.role === 'king' ? 2.55 : 1.95) * s;
        g.fillStyle = 'rgba(0,0,0,0.18)';
        g.beginPath();
        g.arc(t.x * s, y * s + s * 0.15, R * 1.04, 0, Math.PI * 2);
        g.fill();
        const pg = g.createRadialGradient(t.x * s, y * s - R * 0.3, R * 0.1, t.x * s, y * s, R);
        pg.addColorStop(0, '#d8d2c4');
        pg.addColorStop(1, '#a39b8b');
        g.fillStyle = pg;
        g.beginPath();
        g.arc(t.x * s, y * s, R, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = '#7d7566';
        g.lineWidth = Math.max(1, s * 0.05);
        g.stroke();
        g.strokeStyle = 'rgba(90,80,70,0.35)';
        for (let k = 0; k < 12; k++) {
          const a = (k / 12) * Math.PI * 2;
          g.beginPath();
          g.moveTo(t.x * s + Math.cos(a) * R * 0.72, y * s + Math.sin(a) * R * 0.72);
          g.lineTo(t.x * s + Math.cos(a) * R, y * s + Math.sin(a) * R);
          g.stroke();
        }
        g.beginPath();
        g.arc(t.x * s, y * s, R * 0.72, 0, Math.PI * 2);
        g.stroke();
      }
    }

    // rio: margens de terra, pedrinhas e água
    const rt = RIVER_TOP * s;
    const rb = RIVER_BOTTOM * s;
    g.fillStyle = '#7a5b3a';
    g.fillRect(0, rt - s * 0.22, W, s * 0.3);
    g.fillRect(0, rb - s * 0.08, W, s * 0.3);
    const wg = g.createLinearGradient(0, rt, 0, rb);
    wg.addColorStop(0, P.riverDeep);
    wg.addColorStop(0.25, P.river);
    wg.addColorStop(0.75, P.river);
    wg.addColorStop(1, P.riverDeep);
    g.fillStyle = wg;
    g.fillRect(0, rt, W, rb - rt);
    g.fillStyle = 'rgba(255,255,255,0.25)';
    g.fillRect(0, rt, W, Math.max(1, s * 0.06));
    for (let i = 0; i < 70; i++) {
      const x = rng.range(0, ARENA_W);
      const top = rng.chance(0.5);
      const y = top ? RIVER_TOP - rng.range(0.05, 0.2) : RIVER_BOTTOM + rng.range(0.0, 0.18);
      g.fillStyle = tone('#9a9184', rng.range(-0.2, 0.2));
      g.beginPath();
      g.ellipse(x * s, y * s, s * rng.range(0.08, 0.16), s * rng.range(0.05, 0.1), 0, 0, Math.PI * 2);
      g.fill();
    }

    // pontes com tábuas, vigas e corrimão
    for (const b of BRIDGES) {
      const x0 = (b.x - b.half - 0.15) * s;
      const w = (b.half * 2 + 0.3) * s;
      const y0 = (RIVER_TOP - 0.55) * s;
      const h = (RIVER_BOTTOM - RIVER_TOP + 1.1) * s;
      g.fillStyle = 'rgba(0,0,0,0.3)';
      g.fillRect(x0 + s * 0.12, y0 + s * 0.2, w, h);
      for (let y = 0, k = 0; y < h; y += s * 0.36, k++) {
        g.fillStyle = tone(P.bridge, k % 2 ? 0.08 : -0.04);
        g.fillRect(x0, y0 + y, w, Math.min(s * 0.36, h - y));
        g.fillStyle = 'rgba(0,0,0,0.25)';
        g.fillRect(x0, y0 + y + s * 0.33, w, Math.max(1, s * 0.03));
        g.fillStyle = 'rgba(40,25,10,0.5)';
        g.fillRect(x0 + s * 0.2, y0 + y + s * 0.15, s * 0.05, s * 0.05);
        g.fillRect(x0 + w - s * 0.25, y0 + y + s * 0.15, s * 0.05, s * 0.05);
      }
      for (const rx of [x0 - s * 0.1, x0 + w - s * 0.1]) {
        g.fillStyle = tone(P.bridge, -0.35);
        g.fillRect(rx, y0 - s * 0.05, s * 0.2, h + s * 0.1);
        for (let y = 0; y <= h; y += h / 3) {
          g.fillStyle = tone(P.bridge, -0.45);
          g.fillRect(rx - s * 0.04, y0 + y - s * 0.12, s * 0.28, s * 0.24);
          g.fillStyle = tone(P.bridge, 0.1);
          g.fillRect(rx - s * 0.04, y0 + y - s * 0.12, s * 0.28, s * 0.06);
        }
      }
    }

    // decoração nas bordas (fora da área útil)
    const decor = [
      [0.25, 1.2, 'bush'], [17.75, 3.4, 'rock'], [0.25, 9.5, 'bush'], [17.75, 11.4, 'bush'], [0.25, 13.6, 'rock'],
      [17.75, 18.6, 'rock'], [0.25, 20.4, 'bush'], [17.75, 23, 'bush'], [0.25, 28, 'rock'], [17.75, 30.6, 'bush'],
      [6.6, 0.25, 'rock'], [11.4, 31.75, 'rock'], [5.6, 31.75, 'bush'], [12.4, 0.25, 'bush'],
    ];
    for (const [x, y, kind] of decor) {
      if (kind === 'bush') this.bush(g, x * s, y * s, s * 0.42, P);
      else this.rock(g, x * s, y * s, s * 0.32);
    }
    // borda/moldura da arena
    g.strokeStyle = 'rgba(0,0,0,0.35)';
    g.lineWidth = s * 0.16;
    g.strokeRect(0, 0, W, H);
    g.restore();

    // vinheta
    const vg = g.createRadialGradient(c.width / 2, c.height / 2, Math.min(c.width, c.height) * 0.35, c.width / 2, c.height / 2, Math.max(c.width, c.height) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.35)');
    g.fillStyle = vg;
    g.fillRect(0, 0, c.width, c.height);
    this.bg = c;
  }

  tree(g, x, y, r, P) {
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.beginPath();
    g.ellipse(x + r * 0.2, y + r * 0.6, r, r * 0.45, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#5a3d24';
    g.fillRect(x - r * 0.12, y, r * 0.24, r * 0.6);
    for (const [dx, dy, k] of [[0, -0.2, 1], [-0.45, 0.1, 0.75], [0.45, 0.1, 0.75]]) {
      const cg = g.createRadialGradient(x + dx * r - r * 0.2, y + dy * r - r * 0.3, r * 0.1, x + dx * r, y + dy * r, r * k);
      cg.addColorStop(0, tone(P.decor, 0.35));
      cg.addColorStop(1, tone(P.decor, -0.3));
      g.fillStyle = cg;
      g.beginPath();
      g.arc(x + dx * r, y + dy * r, r * k, 0, Math.PI * 2);
      g.fill();
    }
  }

  bush(g, x, y, r, P) {
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.beginPath();
    g.ellipse(x, y + r * 0.45, r * 1.1, r * 0.4, 0, 0, Math.PI * 2);
    g.fill();
    for (const [dx, dy, k] of [[-0.45, 0.05, 0.7], [0.45, 0.05, 0.7], [0, -0.2, 0.85]]) {
      const cg = g.createRadialGradient(x + dx * r - r * 0.2, y + dy * r - r * 0.3, r * 0.05, x + dx * r, y + dy * r, r * k);
      cg.addColorStop(0, tone(P.decor, 0.4));
      cg.addColorStop(1, tone(P.decor, -0.25));
      g.fillStyle = cg;
      g.beginPath();
      g.arc(x + dx * r, y + dy * r, r * k, 0, Math.PI * 2);
      g.fill();
    }
  }

  rock(g, x, y, r) {
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.beginPath();
    g.ellipse(x, y + r * 0.5, r * 1.1, r * 0.4, 0, 0, Math.PI * 2);
    g.fill();
    const rg = g.createRadialGradient(x - r * 0.3, y - r * 0.4, r * 0.1, x, y, r);
    rg.addColorStop(0, '#d2ccd6');
    rg.addColorStop(1, '#6f6979');
    g.fillStyle = rg;
    g.beginPath();
    g.moveTo(x - r, y + r * 0.4);
    g.lineTo(x - r * 0.7, y - r * 0.5);
    g.lineTo(x + r * 0.1, y - r * 0.8);
    g.lineTo(x + r * 0.9, y - r * 0.2);
    g.lineTo(x + r, y + r * 0.4);
    g.closePath();
    g.fill();
  }

  // ---------------------------------------------------------------- quadro

  render(match, alpha, fx, ui = {}) {
    const ctx = this.ctx;
    const s = this.scale;
    this.time = fx.time;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (this.bg) ctx.drawImage(this.bg, 0, 0);
    let shx = 0;
    let shy = 0;
    if (fx.shake > 0 && !fx.reduced) {
      shx = (Math.random() - 0.5) * fx.shake * s * 0.6;
      shy = (Math.random() - 0.5) * fx.shake * s * 0.6;
    }
    ctx.setTransform(1, 0, 0, 1, this.offX + shx, this.offY + shy);
    this.drawWater(ctx, s);

    if (ui.preview && ui.preview.card.type !== 'spell') this.drawZones(ctx, match, s);
    for (const z of match.zones) this.drawZone(ctx, z, s);

    const lerp = (e) => ({ x: e.px + (e.x - e.px) * alpha, y: e.py + (e.y - e.py) * alpha });
    const ground = [];
    const air = [];
    for (const t of match.towers) if (t.dead) ground.push({ e: t, x: t.x, y: t.y, ruin: true });
    for (const e of match.entities) {
      const p = lerp(e);
      (e.air ? air : ground).push({ e, x: p.x, y: p.y });
    }
    ground.sort((a, b) => a.y - b.y);
    air.sort((a, b) => a.y - b.y);

    for (const d of ground) this.drawShadow(ctx, d, s, false);
    for (const d of air) this.drawShadow(ctx, d, s, true);
    for (const d of ground) this.drawEntity(ctx, d, s, match);
    this.drawProjectiles(ctx, match, alpha, s, false);
    for (const p of fx.particles) if (p.z < 0.8) this.drawParticle(ctx, p, s);
    for (const d of air) this.drawEntity(ctx, d, s, match);
    this.drawProjectiles(ctx, match, alpha, s, true);
    for (const p of fx.particles) if (p.z >= 0.8) this.drawParticle(ctx, p, s);
    this.drawFx(ctx, fx, match, s);
    for (const d of ground) if (!d.ruin) this.drawBars(ctx, d, s);
    for (const d of air) this.drawBars(ctx, d, s);
    if (ui.preview) this.drawPreview(ctx, ui.preview, s);
    this.drawTexts(ctx, fx, s);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (fx.flash > 0) {
      ctx.fillStyle = `rgba(255,240,200,${fx.flash * 0.8})`;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    if (fx.banner) this.drawBanner(ctx, fx.banner);
  }

  drawWater(ctx, s) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, RIVER_TOP * s, ARENA_W * s, (RIVER_BOTTOM - RIVER_TOP) * s);
    ctx.clip();
    ctx.lineCap = 'round';
    for (let i = 0; i < 14; i++) {
      const x = ((i * 1.7 + this.time * (0.5 + (i % 3) * 0.15)) % (ARENA_W + 2)) - 1;
      const y = RIVER_TOP + 0.35 + (i % 4) * 0.42;
      const a = 0.18 + 0.12 * Math.sin(this.time * 2 + i);
      ctx.strokeStyle = `rgba(255,255,255,${a})`;
      ctx.lineWidth = Math.max(1, s * 0.06);
      ctx.beginPath();
      ctx.moveTo(x * s, y * s);
      ctx.quadraticCurveTo((x + 0.35) * s, (y - 0.12) * s, (x + 0.7) * s, y * s);
      ctx.stroke();
    }
    // espuma ao redor dos pilares das pontes
    for (const b of BRIDGES) {
      for (const side of [-1, 1]) {
        const fx = (b.x + side * (b.half + 0.25)) * s;
        for (let k = 0; k < 3; k++) {
          const yy = (RIVER_TOP + 0.4 + k * 0.6) * s;
          ctx.fillStyle = `rgba(255,255,255,${0.25 + 0.15 * Math.sin(this.time * 4 + k + side)})`;
          ctx.beginPath();
          ctx.ellipse(fx + side * s * 0.12, yy, s * 0.14, s * 0.07, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.restore();
  }

  drawZones(ctx, match, s) {
    const zones = deployZones(match, 0);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, ARENA_W * s, ARENA_H * s);
    for (const z of zones) ctx.rect(z.x0 * s, z.y0 * s, (z.x1 - z.x0) * s, (z.y1 - z.y0) * s);
    ctx.fillStyle = 'rgba(140,20,20,0.3)';
    ctx.fill('evenodd');
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    for (const z of zones) ctx.fillRect(z.x0 * s, z.y0 * s, (z.x1 - z.x0) * s, (z.y1 - z.y0) * s);
    ctx.setLineDash([s * 0.3, s * 0.2]);
    ctx.lineDashOffset = -this.time * s;
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = Math.max(1, s * 0.07);
    for (const z of zones) ctx.strokeRect(z.x0 * s, z.y0 * s, (z.x1 - z.x0) * s, (z.y1 - z.y0) * s);
    ctx.restore();
  }

  drawZone(ctx, z, s) {
    const pulse = 0.5 + Math.sin(this.time * 6) * 0.15;
    const col = z.heal ? '110,240,150' : '255,200,60';
    ctx.save();
    const g = ctx.createRadialGradient(z.x * s, z.y * s, 0, z.x * s, z.y * s, z.radius * s);
    g.addColorStop(0, `rgba(${col},${0.05})`);
    g.addColorStop(1, `rgba(${col},${0.25 * pulse + 0.1})`);
    ctx.beginPath();
    ctx.arc(z.x * s, z.y * s, z.radius * s, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = s * 0.08;
    ctx.strokeStyle = `rgba(${col},${0.7 * pulse})`;
    ctx.stroke();
    ctx.restore();
  }

  drawShadow(ctx, d, s, isAir) {
    const e = d.e;
    const vs = e.kind === 'unit' ? visualScale(e) : 1;
    const r = e.kind === 'tower' ? e.radius * 1.05 : e.radius * (e.kind === 'building' ? 1.0 : 0.75 * vs);
    const cx = d.x * s;
    const cy = (d.y + (e.kind === 'unit' && !isAir ? 0.18 * vs : 0.25)) * s;
    ctx.fillStyle = isAir ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(cx, cy, r * s * (isAir ? 0.7 : 1), r * s * (isAir ? 0.28 : 0.42), 0, 0, Math.PI * 2);
    ctx.fill();
    if (e.kind === 'unit' && !d.ruin) {
      ctx.strokeStyle = TEAM[e.side].main;
      ctx.globalAlpha = isAir ? 0.5 : 0.85;
      ctx.lineWidth = Math.max(1.5, s * 0.07);
      ctx.beginPath();
      ctx.ellipse(cx, cy, r * s * 0.9 * (isAir ? 0.7 : 1), r * s * 0.38 * (isAir ? 0.7 : 1), 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  drawEntity(ctx, d, s, match) {
    const e = d.e;
    ctx.save();
    if (e.kind === 'tower') {
      ctx.translate(d.x * s, d.y * s);
      const aim = e.role === 'king' && e.active ? this.aimFor(e, match, true) : 0;
      drawTower(ctx, e.role, e.side, s, { ruined: d.ruin, active: e.active, t: this.time, attack: e.attackAnim > 0 ? e.attackAnim / 0.35 : 0, frozen: e.frozenT > 0, aim });
      ctx.restore();
      return;
    }
    const vs = visualScale(e);
    const lift = e.air ? AIR_LIFT + Math.sin(this.time * 3 + e.id) * 0.08 : 0;
    ctx.translate(d.x * s, (d.y - lift) * s);
    const deploying = e.deployT > 0;
    if (deploying) {
      const k = 1 - e.deployT;
      ctx.globalAlpha = 0.5 + k * 0.4;
      ctx.translate(0, -Math.max(0, 0.35 - k) * s);
    }
    if (e.attackAnim > 0 && !e.projectile && e.kind === 'unit' && !e.spin) {
      const k = Math.sin((e.attackAnim / 0.35) * Math.PI) * 0.2;
      ctx.translate(Math.cos(e.facing) * k * s, Math.sin(e.facing) * k * s);
    }
    if (e.kind === 'unit' && Math.cos(e.facing) < -0.1) ctx.scale(-1, 1);
    // Centro visual da figura sobre a posição real (o toque do jogador).
    ctx.translate(0, 0.12 * s * vs);
    ctx.scale(vs, vs);
    const moving = e.moving && e.frozenT <= 0;
    const anim = {
      t: this.time + e.id * 0.37,
      attack: e.attackAnim > 0 ? e.attackAnim / 0.35 : 0,
      bob: moving ? Math.abs(Math.sin(this.time * 10 + e.id)) * -s * 0.04 : Math.sin(this.time * 2 + e.id) * s * 0.01,
      walk: moving ? this.time * 10 + e.id : 0,
      shield: e.shield > 0,
      aim: e.kind === 'building' && e.targets !== 'none' ? this.aimFor(e, match) : 0,
    };
    drawUnit(ctx, e.defId, e.side, s, anim);
    ctx.restore();
    // overlays de estado
    const cx = d.x * s;
    const cy = (d.y - lift - e.radius * 0.2) * s;
    const rr = e.radius * s * (e.kind === 'building' ? 1 : vs) * 0.85;
    if (e.hitFlash > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(255,255,255,${e.hitFlash * 2.5})`;
      ctx.beginPath();
      ctx.arc(cx, cy, rr, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    if (e.frozenT > 0) {
      const stun = e.stunT && e.frozenT <= e.stunT + 0.01;
      ctx.fillStyle = stun ? 'rgba(255,255,140,0.25)' : 'rgba(170,225,255,0.5)';
      ctx.beginPath();
      ctx.arc(cx, cy, rr * 1.1, 0, Math.PI * 2);
      ctx.fill();
      if (stun) {
        for (let k = 0; k < 3; k++) {
          const a = this.time * 6 + (k * Math.PI * 2) / 3;
          ctx.fillStyle = '#fff59a';
          ctx.beginPath();
          ctx.arc(cx + Math.cos(a) * rr * 0.7, cy - rr * 1.1 + Math.sin(a) * rr * 0.2, s * 0.07, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    if (e.rageT > 0) {
      ctx.strokeStyle = `rgba(255,200,60,${0.5 + Math.sin(this.time * 12) * 0.3})`;
      ctx.lineWidth = s * 0.08;
      ctx.beginPath();
      ctx.arc(cx, cy, rr * 1.15, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (deploying) {
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = s * 0.08;
      ctx.beginPath();
      ctx.arc(cx, cy, rr * 0.8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, 1 - e.deployT / 1.0));
      ctx.stroke();
    }
  }

  aimFor(e, match, relativeToRight = false) {
    const t = match.getEntity(e.targetId);
    if (!t) return relativeToRight ? (e.side === 0 ? -Math.PI / 2 : Math.PI / 2) : e.side === 0 ? -Math.PI / 2 : Math.PI / 2;
    return Math.atan2(t.y - e.y, t.x - e.x);
  }

  drawBars(ctx, d, s) {
    const e = d.e;
    if (e.dead) return;
    const isTower = e.kind === 'tower';
    if (!isTower && e.hp >= e.maxHp && e.shield >= e.maxShield && e.kind !== 'building') return;
    const vs = e.kind === 'unit' ? visualScale(e) : 1;
    const lift = e.air ? AIR_LIFT : 0;
    const w = isTower ? (e.role === 'king' ? 3.0 : 2.4) : Math.max(0.9, e.radius * 1.8 * Math.min(1.3, vs));
    const h = isTower ? 0.34 : 0.17;
    const x = d.x - w / 2;
    const yRaw = isTower ? d.y - e.radius * 1.9 - 0.75 : d.y - lift - e.radius * vs * 1.25 - 0.45;
    const y = Math.max(0.15, yRaw);
    const r = h * s * 0.5;
    const path = (px, py, pw, ph, rad) => {
      ctx.beginPath();
      ctx.moveTo(px + rad, py);
      ctx.arcTo(px + pw, py, px + pw, py + ph, rad);
      ctx.arcTo(px + pw, py + ph, px, py + ph, rad);
      ctx.arcTo(px, py + ph, px, py, rad);
      ctx.arcTo(px, py, px + pw, py, rad);
      ctx.closePath();
    };
    path(x * s - 2, y * s - 2, w * s + 4, h * s + 4, r + 2);
    ctx.fillStyle = 'rgba(20,14,26,0.85)';
    ctx.fill();
    const frac = Math.max(0, e.hp / e.maxHp);
    if (frac > 0) {
      const col = e.side === 0 ? ['#7fc0ff', '#2f7de1'] : ['#ff9b8a', '#d8402f'];
      const g = ctx.createLinearGradient(0, y * s, 0, (y + h) * s);
      g.addColorStop(0, col[0]);
      g.addColorStop(1, col[1]);
      path(x * s, y * s, Math.max(r * 2, w * s * frac), h * s, r);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillRect(x * s + r, y * s + 1, Math.max(0, w * s * frac - r * 2), h * s * 0.3);
    }
    if (e.maxShield > 0 && e.shield > 0) {
      path(x * s, (y - h * 0.75) * s, w * s * (e.shield / e.maxShield), h * s * 0.6, r * 0.6);
      ctx.fillStyle = '#e6edf5';
      ctx.fill();
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (isTower) {
      ctx.font = `900 ${Math.round(s * 0.4)}px Nunito, system-ui, sans-serif`;
      ctx.lineWidth = Math.max(2, s * 0.09);
      ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      ctx.fillStyle = '#fff';
      const label = String(Math.ceil(e.hp));
      ctx.strokeText(label, d.x * s, (y + h / 2) * s + 1);
      ctx.fillText(label, d.x * s, (y + h / 2) * s + 1);
    } else if (e.level) {
      const bx = (x - 0.18) * s;
      const by = (y + h / 2) * s;
      const br = s * 0.17;
      ctx.beginPath();
      ctx.moveTo(bx - br, by - br);
      ctx.lineTo(bx + br, by - br);
      ctx.lineTo(bx + br, by + br * 0.3);
      ctx.lineTo(bx, by + br * 1.1);
      ctx.lineTo(bx - br, by + br * 0.3);
      ctx.closePath();
      ctx.fillStyle = TEAM[e.side].dark;
      ctx.fill();
      ctx.lineWidth = Math.max(1, s * 0.03);
      ctx.strokeStyle = '#f2c14e';
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = `900 ${Math.round(s * 0.22)}px Nunito, system-ui, sans-serif`;
      ctx.fillText(String(e.level), bx, by);
    }
  }

  drawProjectiles(ctx, match, alpha, s, airLayer) {
    for (const p of match.projectiles) {
      if (!!p.air !== airLayer) continue;
      const x = p.px + (p.x - p.px) * alpha;
      const y = p.py + (p.y - p.py) * alpha;
      const prog = Math.min(1, p.traveled / p.total);
      const baseLift = p.air ? AIR_LIFT : 0.6;
      const z = p.arc ? Math.sin(prog * Math.PI) * 1.8 + baseLift * (1 - prog) : baseLift * (1 - prog) + 0.2;
      const ang = Math.atan2(p.ty - p.y, p.tx - p.x);
      // sombra do projétil
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.ellipse(x * s, y * s, s * 0.12, s * 0.05, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.translate(x * s, (y - z) * s);
      switch (p.kind) {
        case 'arrow':
        case 'bolt': {
          ctx.rotate(ang);
          const L = p.kind === 'bolt' ? 0.8 : 0.55;
          ctx.strokeStyle = '#1d1726';
          ctx.lineWidth = Math.max(2, s * (p.kind === 'bolt' ? 0.13 : 0.09));
          ctx.beginPath();
          ctx.moveTo(-L * s, 0);
          ctx.lineTo(0, 0);
          ctx.stroke();
          ctx.strokeStyle = '#a06a35';
          ctx.lineWidth = Math.max(1, s * (p.kind === 'bolt' ? 0.08 : 0.05));
          ctx.stroke();
          ctx.fillStyle = '#f2f5f8';
          ctx.beginPath();
          ctx.moveTo(s * 0.16, 0);
          ctx.lineTo(-s * 0.06, -s * 0.09);
          ctx.lineTo(-s * 0.06, s * 0.09);
          ctx.fill();
          ctx.fillStyle = '#e6e0d0';
          ctx.fillRect(-L * s, -s * 0.06, s * 0.14, s * 0.12);
          break;
        }
        case 'bomb':
        case 'cannon': {
          const r = s * (p.kind === 'cannon' ? 0.2 : 0.17);
          const g = ctx.createRadialGradient(-r * 0.3, -r * 0.4, r * 0.1, 0, 0, r);
          g.addColorStop(0, '#6a6676');
          g.addColorStop(1, '#16131c');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.fill();
          if (p.kind === 'bomb') {
            ctx.fillStyle = Math.sin(this.time * 30) > 0 ? '#ffd040' : '#ff7a20';
            ctx.beginPath();
            ctx.arc(r * 0.6, -r * 0.8, r * 0.35, 0, Math.PI * 2);
            ctx.fill();
          }
          break;
        }
        case 'rune':
        case 'fire': {
          const [c0, c1] = p.kind === 'rune' ? ['rgba(143,240,255,0.45)', '#e6feff'] : ['rgba(255,120,40,0.5)', '#fff0a0'];
          ctx.globalCompositeOperation = 'lighter';
          // rastro
          ctx.rotate(ang);
          for (let k = 1; k <= 4; k++) {
            ctx.fillStyle = c0;
            ctx.globalAlpha = 0.5 / k;
            ctx.beginPath();
            ctx.arc(-k * s * 0.16, 0, s * (0.26 - k * 0.04), 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalAlpha = 1;
          ctx.fillStyle = c0;
          ctx.beginPath();
          ctx.arc(0, 0, s * 0.34, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = c1;
          ctx.beginPath();
          ctx.arc(0, 0, s * 0.15, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        default:
          ctx.fillStyle = '#fff';
          ctx.fillRect(-2, -2, 4, 4);
      }
      ctx.restore();
    }
  }

  drawParticle(ctx, p, s) {
    const a = Math.max(0, p.life / p.max);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    const r = p.size * s * (0.5 + a * 0.5);
    ctx.beginPath();
    ctx.arc(p.x * s, (p.y - p.z) * s, r / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  drawFx(ctx, fx, match, s) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const r of fx.rings) {
      const k = 1 - r.life / r.max;
      ctx.strokeStyle = r.color;
      ctx.globalAlpha = (1 - k) * 0.9;
      ctx.lineWidth = Math.max(1, r.width * s * (1 - k * 0.5));
      ctx.beginPath();
      ctx.ellipse(r.x * s, r.y * s, r.radius * s * (0.4 + k * 0.6), r.radius * s * (0.4 + k * 0.6) * 0.8, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (const sl of fx.slashes) {
      const k = 1 - sl.life / sl.max;
      ctx.strokeStyle = `rgba(255,255,255,${1 - k})`;
      ctx.lineWidth = Math.max(1.5, s * 0.1 * (1 - k));
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(sl.x * s, (sl.y - 0.3) * s, s * 0.5, sl.ang - 1.3 + k, sl.ang + 0.3 + k);
      ctx.stroke();
    }
    for (const b of fx.beams) {
      const from = match.getEntity(b.from);
      const to = match.getEntity(b.to);
      if (!from || !to) continue;
      const fz = from.air ? AIR_LIFT : 0.45;
      const tz = to.air ? AIR_LIFT : to.kind === 'tower' ? 1.4 : 0.35;
      const w = (0.06 + b.stage * 0.07) * s;
      const wob = Math.sin(this.time * 40) * w * 0.3;
      ctx.strokeStyle = `rgba(79,224,208,${0.35 + b.stage * 0.2})`;
      ctx.lineWidth = w * 2.6 + wob;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(from.x * s, (from.y - fz) * s);
      ctx.lineTo(to.x * s, (to.y - tz) * s);
      ctx.stroke();
      ctx.strokeStyle = '#effffd';
      ctx.lineWidth = w * 0.8;
      ctx.stroke();
    }
    ctx.restore();
    for (const m of fx.meteors) {
      const k = Math.min(1, m.t / m.dur);
      const x = m.fx + (m.x - m.fx) * k;
      const y = m.fy + (m.y - m.fy) * k;
      const z = (1 - k) * 9 + Math.sin(k * Math.PI) * 2;
      ctx.fillStyle = `rgba(0,0,0,${0.15 + k * 0.25})`;
      ctx.beginPath();
      ctx.ellipse(m.x * s, m.y * s, m.radius * s * k, m.radius * s * 0.5 * k, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255,140,50,0.45)';
      ctx.beginPath();
      ctx.arc(x * s, (y - z) * s, s * 0.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      const g = ctx.createRadialGradient((x - 0.15) * s, (y - z - 0.2) * s, s * 0.05, x * s, (y - z) * s, s * 0.55);
      g.addColorStop(0, '#9c8a7c');
      g.addColorStop(1, '#3e322c');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x * s, (y - z) * s, s * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#5fe8ff';
      ctx.lineWidth = s * 0.08;
      ctx.beginPath();
      ctx.moveTo((x - 0.25) * s, (y - z - 0.1) * s);
      ctx.lineTo((x + 0.2) * s, (y - z + 0.15) * s);
      ctx.stroke();
    }
    for (const a of fx.arrows) {
      const k = 1 - a.life / a.max;
      const z = (1 - k) * 3;
      ctx.strokeStyle = '#6b4a2a';
      ctx.lineWidth = Math.max(1.5, s * 0.06);
      ctx.beginPath();
      ctx.moveTo((a.x + 0.15) * s, (a.y - z - 0.5) * s);
      ctx.lineTo(a.x * s, (a.y - z) * s);
      ctx.stroke();
    }
    for (const z of fx.zaps || []) {
      const k = z.life / z.max;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(170,230,255,${k})`;
      ctx.lineWidth = s * 0.08;
      for (let n = 0; n < 6; n++) {
        let px = z.x * s;
        let py = (z.y - 3) * s;
        ctx.beginPath();
        ctx.moveTo(px, py);
        for (let i = 0; i < 5; i++) {
          px = z.x * s + (Math.random() - 0.5) * z.radius * s * 1.6;
          py += s * 0.6;
          ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  drawPreview(ctx, pv, s) {
    const { card, x, y, valid } = pv;
    ctx.save();
    const color = valid ? 'rgba(255,255,255,0.95)' : 'rgba(255,80,80,0.95)';
    if (card.type === 'spell') {
      ctx.fillStyle = valid ? 'rgba(255,255,255,0.18)' : 'rgba(255,60,60,0.18)';
      ctx.strokeStyle = color;
      ctx.lineWidth = s * 0.08;
      ctx.beginPath();
      ctx.arc(x * s, y * s, card.spell.radius * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else {
      const u = getUnit(card.unitId);
      if (u.range >= 2) {
        ctx.setLineDash([s * 0.2, s * 0.2]);
        ctx.strokeStyle = 'rgba(255,255,255,0.45)';
        ctx.lineWidth = s * 0.05;
        ctx.beginPath();
        ctx.arc(x * s, y * s, (u.range + u.radius) * s, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      // marcador no chão exatamente no ponto escolhido
      ctx.fillStyle = valid ? 'rgba(255,255,255,0.25)' : 'rgba(255,60,60,0.25)';
      ctx.strokeStyle = color;
      ctx.lineWidth = s * 0.07;
      ctx.beginPath();
      ctx.ellipse(x * s, y * s, Math.max(0.55, u.radius * 1.2) * s, Math.max(0.55, u.radius * 1.2) * s * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      const n = card.count;
      ctx.globalAlpha = valid ? 0.8 : 0.45;
      for (let i = 0; i < n; i++) {
        let ox = 0;
        let oy = 0;
        if (n > 1) {
          const a = (i / n) * Math.PI * 2 + 0.4;
          const r = n <= 2 ? 0.55 : 0.75;
          ox = Math.cos(a) * r;
          oy = Math.sin(a) * r;
        }
        const fake = { kind: u.building ? 'building' : 'unit', radius: u.radius, defId: card.unitId };
        const vs = visualScale(fake);
        ctx.save();
        ctx.translate((x + ox) * s, (y + oy - (u.air ? AIR_LIFT : 0)) * s);
        ctx.translate(0, 0.12 * s * vs);
        ctx.scale(vs, vs);
        drawUnit(ctx, card.unitId, 0, s, { t: this.time });
        ctx.restore();
      }
    }
    ctx.restore();
  }

  drawTexts(ctx, fx, s) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const t of fx.texts) {
      const k = 1 - t.life / t.max;
      ctx.globalAlpha = Math.min(1, (t.life / t.max) * 2);
      const pop = 1 + Math.max(0, 0.3 - k) * 1.5;
      ctx.font = `900 ${Math.round(t.size * s * pop)}px Nunito, system-ui, sans-serif`;
      ctx.lineWidth = Math.max(2, s * 0.09);
      ctx.strokeStyle = 'rgba(20,10,20,0.9)';
      ctx.fillStyle = t.color;
      const yy = (t.y - k * 0.9) * s;
      ctx.strokeText(t.str, t.x * s, yy);
      ctx.fillText(t.str, t.x * s, yy);
    }
    ctx.globalAlpha = 1;
  }

  drawBanner(ctx, b) {
    const W = this.canvas.width;
    const H = this.canvas.height;
    const k = b.life / b.max;
    const a = Math.min(1, k * 4, (1 - k) * 8 + 0.2);
    const size = Math.round(Math.min(W / 11, this.scale * 1.35));
    const pop = 1 + Math.max(0, (1 - k) < 0.12 ? (0.12 - (1 - k)) * 3 : 0);
    ctx.save();
    ctx.globalAlpha = a;
    const cy = H * 0.42;
    const g = ctx.createLinearGradient(0, cy - size, 0, cy + size);
    g.addColorStop(0, 'rgba(30,20,50,0)');
    g.addColorStop(0.2, 'rgba(30,20,50,0.75)');
    g.addColorStop(0.8, 'rgba(30,20,50,0.75)');
    g.addColorStop(1, 'rgba(30,20,50,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, cy - size * 1.1, W, size * 2.2);
    ctx.translate(W / 2, cy);
    ctx.scale(pop, pop);
    ctx.font = `900 ${size}px Cinzel, Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(4, size * 0.16);
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1b1024';
    ctx.strokeText(b.text, 0, 0);
    const tg = ctx.createLinearGradient(0, -size / 2, 0, size / 2);
    tg.addColorStop(0, '#ffffff');
    tg.addColorStop(0.45, b.color);
    tg.addColorStop(1, tone(b.color.startsWith('#') ? b.color : '#f2c14e', -0.3));
    ctx.fillStyle = tg;
    ctx.fillText(b.text, 0, 0);
    ctx.restore();
  }
}

export { getCard };

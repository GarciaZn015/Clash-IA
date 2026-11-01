// Renderização da arena em Canvas 2D. Lê o estado da partida (somente leitura) e os efeitos visuais.
import { ARENA_W, ARENA_H, RIVER_TOP, RIVER_BOTTOM, BRIDGES, TOWER_LAYOUT, mirrorY } from '../core/constants.js';
import { getCard } from '../data/cards.js';
import { getUnit } from '../data/units.js';
import { deployZones } from '../sim/placement.js';
import { drawUnit, drawTower, TEAM } from './sprites.js';

/** Unidades são desenhadas um pouco maiores que a hitbox para legibilidade. */
const UNIT_VISUAL_SCALE = 1.3;

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

  /** Converte coordenadas de cliente (CSS px) para o mundo. */
  clientToWorld(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const px = (clientX - rect.left) * this.dpr;
    const py = (clientY - rect.top) * this.dpr;
    return { x: (px - this.offX) / this.scale, y: (py - this.offY) / this.scale };
  }

  buildBackground() {
    const s = this.scale;
    const c = document.createElement('canvas');
    c.width = this.canvas.width;
    c.height = this.canvas.height;
    const g = c.getContext('2d');
    const P = this.palette;
    g.fillStyle = P.border;
    g.fillRect(0, 0, c.width, c.height);
    g.save();
    g.translate(this.offX, this.offY);
    // grama quadriculada
    for (let y = 0; y < ARENA_H; y++) {
      for (let x = 0; x < ARENA_W; x++) {
        g.fillStyle = (x + y) % 2 ? P.grassA : P.grassB;
        g.fillRect(x * s, y * s, s + 0.5, s + 0.5);
      }
    }
    // leve tom dos lados
    g.fillStyle = 'rgba(60,120,255,0.05)';
    g.fillRect(0, RIVER_BOTTOM * s, ARENA_W * s, (ARENA_H - RIVER_BOTTOM) * s);
    g.fillStyle = 'rgba(255,70,60,0.05)';
    g.fillRect(0, 0, ARENA_W * s, RIVER_TOP * s);
    // caminhos
    g.strokeStyle = P.path;
    g.globalAlpha = 0.55;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.lineWidth = s * 1.4;
    for (const b of BRIDGES) {
      g.beginPath();
      g.moveTo(b.x * s, 6.5 * s);
      g.lineTo(b.x * s, 25.5 * s);
      g.stroke();
    }
    for (const yk of [3, 29]) {
      const yp = yk === 3 ? 6.5 : 25.5;
      g.beginPath();
      g.moveTo(3.5 * s, yp * s);
      g.quadraticCurveTo(9 * s, yp * s, 9 * s, yk * s);
      g.quadraticCurveTo(9 * s, yp * s, 14.5 * s, yp * s);
      g.stroke();
    }
    g.globalAlpha = 1;
    // rio
    const rg = g.createLinearGradient(0, RIVER_TOP * s, 0, RIVER_BOTTOM * s);
    rg.addColorStop(0, P.riverDeep);
    rg.addColorStop(0.5, P.river);
    rg.addColorStop(1, P.riverDeep);
    g.fillStyle = rg;
    g.fillRect(0, RIVER_TOP * s, ARENA_W * s, (RIVER_BOTTOM - RIVER_TOP) * s);
    g.fillStyle = 'rgba(0,0,0,0.18)';
    g.fillRect(0, RIVER_TOP * s, ARENA_W * s, s * 0.15);
    g.fillRect(0, RIVER_BOTTOM * s - s * 0.15, ARENA_W * s, s * 0.15);
    // pontes
    for (const b of BRIDGES) {
      const x0 = (b.x - b.half) * s;
      const w = b.half * 2 * s;
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.fillRect(x0 + s * 0.1, (RIVER_TOP - 0.4) * s + s * 0.15, w, (RIVER_BOTTOM - RIVER_TOP + 0.8) * s);
      g.fillStyle = P.bridge;
      g.fillRect(x0, (RIVER_TOP - 0.4) * s, w, (RIVER_BOTTOM - RIVER_TOP + 0.8) * s);
      g.strokeStyle = 'rgba(0,0,0,0.3)';
      g.lineWidth = Math.max(1, s * 0.05);
      for (let y = RIVER_TOP - 0.4; y < RIVER_BOTTOM + 0.4; y += 0.4) {
        g.beginPath();
        g.moveTo(x0, y * s);
        g.lineTo(x0 + w, y * s);
        g.stroke();
      }
      g.fillStyle = '#5a3a20';
      g.fillRect(x0 - s * 0.12, (RIVER_TOP - 0.4) * s, s * 0.18, (RIVER_BOTTOM - RIVER_TOP + 0.8) * s);
      g.fillRect(x0 + w - s * 0.06, (RIVER_TOP - 0.4) * s, s * 0.18, (RIVER_BOTTOM - RIVER_TOP + 0.8) * s);
    }
    // decoração: arbustos e pedras nas bordas
    const decor = [[0.6, 2], [17.3, 4], [0.5, 12], [17.4, 11.5], [0.6, 20], [17.4, 21], [0.5, 30.5], [17.4, 29], [6.4, 0.6], [11.6, 31.4], [8.5, 14.2], [9.6, 17.8]];
    for (const [x, y] of decor) {
      g.fillStyle = 'rgba(0,0,0,0.2)';
      g.beginPath();
      g.ellipse(x * s, y * s + s * 0.2, s * 0.5, s * 0.25, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = P.decor;
      g.beginPath();
      g.arc(x * s - s * 0.2, y * s, s * 0.32, 0, Math.PI * 2);
      g.arc(x * s + s * 0.2, y * s - s * 0.05, s * 0.36, 0, Math.PI * 2);
      g.fill();
    }
    // bases das torres (marcas no chão)
    for (const side of [0, 1]) {
      for (const t of TOWER_LAYOUT) {
        const y = side === 0 ? t.y : mirrorY(t.y);
        g.fillStyle = 'rgba(0,0,0,0.12)';
        g.beginPath();
        g.arc(t.x * s, y * s, (t.role === 'king' ? 2.6 : 2.0) * s, 0, Math.PI * 2);
        g.fill();
      }
    }
    // linha central
    g.restore();
    this.bg = c;
  }

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
    this.drawRiverShimmer(ctx, s);

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
    for (const d of ground) this.drawEntity(ctx, d, s, match);
    this.drawProjectiles(ctx, match, alpha, s, false);
    for (const p of fx.particles) if (p.z < 0.8) this.drawParticle(ctx, p, s);
    for (const d of air) this.drawShadow(ctx, d, s, true);
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

  drawRiverShimmer(ctx, s) {
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1, s * 0.05);
    for (let i = 0; i < 9; i++) {
      const x = ((i * 2.3 + this.time * 0.6) % (ARENA_W + 2)) - 1;
      const y = RIVER_TOP + 0.5 + (i % 3) * 0.5;
      if (BRIDGES.some((b) => Math.abs(x - b.x) < b.half + 0.6)) continue;
      ctx.beginPath();
      ctx.moveTo(x * s, y * s);
      ctx.quadraticCurveTo((x + 0.3) * s, (y - 0.12) * s, (x + 0.6) * s, y * s);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawZones(ctx, match, s) {
    const zones = deployZones(match, 0);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, ARENA_W * s, ARENA_H * s);
    for (const z of zones) ctx.rect(z.x0 * s, z.y0 * s, (z.x1 - z.x0) * s, (z.y1 - z.y0) * s);
    ctx.fillStyle = 'rgba(120,10,10,0.28)';
    ctx.fill('evenodd');
    ctx.setLineDash([s * 0.3, s * 0.2]);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = Math.max(1, s * 0.06);
    for (const z of zones) ctx.strokeRect(z.x0 * s, z.y0 * s, (z.x1 - z.x0) * s, (z.y1 - z.y0) * s);
    ctx.restore();
  }

  drawZone(ctx, z, s) {
    const pulse = 0.5 + Math.sin(this.time * 6) * 0.15;
    const col = z.heal ? '110,240,150' : '255,200,60';
    ctx.save();
    ctx.beginPath();
    ctx.arc(z.x * s, z.y * s, z.radius * s, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${col},${0.16 * pulse + 0.05})`;
    ctx.fill();
    ctx.lineWidth = s * 0.08;
    ctx.strokeStyle = `rgba(${col},${0.6 * pulse})`;
    ctx.stroke();
    ctx.restore();
  }

  drawShadow(ctx, d, s, isAir) {
    const e = d.e;
    const r = e.radius * (e.kind === 'tower' ? 1.0 : 0.9);
    ctx.fillStyle = isAir ? 'rgba(0,0,0,0.18)' : 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(d.x * s, (d.y + (isAir ? 0.5 : 0.15)) * s, r * s, r * s * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    if (!isAir && e.kind === 'unit') {
      ctx.strokeStyle = TEAM[e.side].main;
      ctx.lineWidth = Math.max(1, s * 0.07);
      ctx.beginPath();
      ctx.ellipse(d.x * s, (d.y + 0.15) * s, r * s * 0.9, r * s * 0.4, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  drawEntity(ctx, d, s, match) {
    const e = d.e;
    ctx.save();
    if (e.kind === 'tower') {
      ctx.translate(d.x * s, d.y * s);
      drawTower(ctx, e.role, e.side, s, { ruined: d.ruin, active: e.active, t: this.time, attack: e.attackAnim, frozen: e.frozenT > 0 });
      ctx.restore();
      return;
    }
    const lift = e.air ? 1.0 : 0;
    ctx.translate(d.x * s, (d.y - lift) * s);
    const deploying = e.deployT > 0;
    if (deploying) ctx.globalAlpha = 0.55;
    let lungeX = 0;
    let lungeY = 0;
    if (e.attackAnim > 0 && !e.projectile && e.kind === 'unit') {
      const k = Math.sin((e.attackAnim / 0.35) * Math.PI) * 0.18;
      lungeX = Math.cos(e.facing) * k * s;
      lungeY = Math.sin(e.facing) * k * s;
    }
    ctx.translate(lungeX, lungeY);
    const unitScale = (e.radius / 0.5) * (e.defId === 'golem' ? 0.62 : e.defId === 'fragmento' ? 0.85 : 1) * (e.kind === 'building' ? 0.95 : UNIT_VISUAL_SCALE);
    if (e.kind === 'unit' && Math.cos(e.facing) < -0.1) ctx.scale(-1, 1);
    ctx.scale(unitScale, unitScale);
    const bob = e.moving && e.frozenT <= 0 ? Math.sin(this.time * 12 + e.id) * s * 0.05 : 0;
    const aim = e.defId === 'balista' ? this.aimFor(e, match) : 0;
    drawUnit(ctx, e.defId, e.side, s, { t: this.time + e.id * 0.37, attack: e.attackAnim > 0 ? e.attackAnim / 0.35 : 0, bob, shield: e.shield > 0, aim });
    ctx.restore();
    // overlays de estado
    const cx = d.x * s;
    const cy = (d.y - lift - e.radius * 0.3) * s;
    if (e.hitFlash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${e.hitFlash * 3})`;
      ctx.beginPath();
      ctx.arc(cx, cy, e.radius * s * 0.9, 0, Math.PI * 2);
      ctx.fill();
    }
    if (e.frozenT > 0) {
      ctx.fillStyle = 'rgba(170,225,255,0.5)';
      ctx.beginPath();
      ctx.arc(cx, cy, e.radius * s * 1.05, 0, Math.PI * 2);
      ctx.fill();
    }
    if (e.rageT > 0) {
      ctx.strokeStyle = `rgba(255,200,60,${0.5 + Math.sin(this.time * 12) * 0.3})`;
      ctx.lineWidth = s * 0.08;
      ctx.beginPath();
      ctx.arc(cx, cy, e.radius * s * 1.1, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (deploying) {
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = s * 0.07;
      ctx.beginPath();
      ctx.arc(cx, cy, e.radius * s * 0.7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - e.deployT / 1.0));
      ctx.stroke();
    }
  }

  aimFor(e, match) {
    const t = match.getEntity(e.targetId);
    if (!t) return e.side === 0 ? -Math.PI / 2 : Math.PI / 2;
    return Math.atan2(t.y - e.y, t.x - e.x);
  }

  drawBars(ctx, d, s) {
    const e = d.e;
    if (e.dead) return;
    const isTower = e.kind === 'tower';
    if (!isTower && e.hp >= e.maxHp && e.shield >= e.maxShield && e.kind !== 'building') return;
    const lift = e.air ? 1.0 : 0;
    const w = isTower ? (e.role === 'king' ? 3.2 : 2.6) : Math.max(0.8, e.radius * 2);
    const h = isTower ? 0.36 : 0.16;
    const x = d.x - w / 2;
    const y = Math.max(0.12, d.y - lift - (isTower ? e.radius * 1.55 + 0.35 : e.radius * UNIT_VISUAL_SCALE + 0.5));
    ctx.fillStyle = 'rgba(15,12,20,0.75)';
    ctx.fillRect(x * s - 1, y * s - 1, w * s + 2, h * s + 2);
    const frac = Math.max(0, e.hp / e.maxHp);
    ctx.fillStyle = e.side === 0 ? '#4aa3ff' : '#ff5446';
    ctx.fillRect(x * s, y * s, w * s * frac, h * s);
    if (e.maxShield > 0 && e.shield > 0) {
      ctx.fillStyle = '#dfe6ee';
      ctx.fillRect(x * s, (y - h * 0.9) * s, w * s * (e.shield / e.maxShield), h * s * 0.7);
    }
    if (isTower) {
      ctx.font = `bold ${Math.round(s * 0.42)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = Math.max(2, s * 0.08);
      ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.fillStyle = '#fff';
      const label = String(Math.ceil(e.hp));
      ctx.strokeText(label, d.x * s, (y + h / 2) * s);
      ctx.fillText(label, d.x * s, (y + h / 2) * s);
    } else if (e.level) {
      ctx.fillStyle = e.side === 0 ? '#1d3f8f' : '#7d1f1a';
      ctx.fillRect((x - 0.3) * s, (y - 0.06) * s, 0.28 * s, 0.28 * s);
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.round(s * 0.22)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(e.level), (x - 0.16) * s, (y + 0.08) * s);
    }
  }

  drawProjectiles(ctx, match, alpha, s, airLayer) {
    for (const p of match.projectiles) {
      if (!!p.air !== airLayer) continue;
      const x = p.px + (p.x - p.px) * alpha;
      const y = p.py + (p.y - p.py) * alpha;
      const prog = Math.min(1, p.traveled / p.total);
      const baseLift = p.air ? 1.0 : 0.4;
      const z = p.arc ? Math.sin(prog * Math.PI) * 1.6 + baseLift * (1 - prog) : baseLift * (1 - prog);
      const ang = Math.atan2(p.ty - p.y, p.tx - p.x);
      ctx.save();
      ctx.translate(x * s, (y - z) * s);
      switch (p.kind) {
        case 'arrow':
        case 'bolt': {
          ctx.rotate(ang);
          const L = p.kind === 'bolt' ? 0.8 : 0.5;
          ctx.strokeStyle = '#6b4a2a';
          ctx.lineWidth = Math.max(1, s * (p.kind === 'bolt' ? 0.09 : 0.05));
          ctx.beginPath();
          ctx.moveTo(-L * s, 0);
          ctx.lineTo(0, 0);
          ctx.stroke();
          ctx.fillStyle = '#e6ebf0';
          ctx.beginPath();
          ctx.moveTo(s * 0.12, 0);
          ctx.lineTo(-s * 0.06, -s * 0.07);
          ctx.lineTo(-s * 0.06, s * 0.07);
          ctx.fill();
          break;
        }
        case 'bomb':
        case 'cannon':
          ctx.fillStyle = '#26232c';
          ctx.beginPath();
          ctx.arc(0, 0, s * (p.kind === 'cannon' ? 0.2 : 0.16), 0, Math.PI * 2);
          ctx.fill();
          if (p.kind === 'bomb') {
            ctx.fillStyle = '#ffb030';
            ctx.beginPath();
            ctx.arc(s * 0.1, -s * 0.12, s * 0.06, 0, Math.PI * 2);
            ctx.fill();
          }
          break;
        case 'rune':
          ctx.fillStyle = 'rgba(143,240,255,0.35)';
          ctx.beginPath();
          ctx.arc(0, 0, s * 0.32, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#c8fbff';
          ctx.beginPath();
          ctx.arc(0, 0, s * 0.15, 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'fire':
          ctx.fillStyle = 'rgba(255,120,40,0.4)';
          ctx.beginPath();
          ctx.arc(0, 0, s * 0.34, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#ffd36a';
          ctx.beginPath();
          ctx.arc(0, 0, s * 0.16, 0, Math.PI * 2);
          ctx.fill();
          break;
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
    ctx.fillRect(p.x * s - r / 2, (p.y - p.z) * s - r / 2, r, r);
    ctx.globalAlpha = 1;
  }

  drawFx(ctx, fx, match, s) {
    for (const r of fx.rings) {
      const k = 1 - r.life / r.max;
      ctx.strokeStyle = r.color;
      ctx.globalAlpha = 1 - k;
      ctx.lineWidth = Math.max(1, r.width * s * (1 - k * 0.5));
      ctx.beginPath();
      ctx.arc(r.x * s, r.y * s, r.radius * s * (0.4 + k * 0.6), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (const sl of fx.slashes) {
      const k = 1 - sl.life / sl.max;
      ctx.strokeStyle = `rgba(255,255,255,${1 - k})`;
      ctx.lineWidth = Math.max(1, s * 0.08);
      ctx.beginPath();
      ctx.arc(sl.x * s, sl.y * s, s * 0.45, sl.ang - 1.2 + k, sl.ang + 0.2 + k);
      ctx.stroke();
    }
    for (const b of fx.beams) {
      const from = match.getEntity(b.from);
      const to = match.getEntity(b.to);
      if (!from || !to) continue;
      const fz = from.air ? 1.0 : 0.3;
      const tz = to.air ? 1.0 : to.kind === 'tower' ? 1.2 : 0.3;
      const w = (0.06 + b.stage * 0.06) * s;
      ctx.strokeStyle = `rgba(79,224,208,${0.35 + b.stage * 0.2})`;
      ctx.lineWidth = w * 2.2;
      ctx.beginPath();
      ctx.moveTo(from.x * s, (from.y - fz) * s);
      ctx.lineTo(to.x * s, (to.y - tz) * s);
      ctx.stroke();
      ctx.strokeStyle = '#e8fffb';
      ctx.lineWidth = w * 0.8;
      ctx.stroke();
    }
    for (const m of fx.meteors) {
      const k = Math.min(1, m.t / m.dur);
      const x = m.fx + (m.x - m.fx) * k;
      const y = m.fy + (m.y - m.fy) * k;
      const z = (1 - k) * 9 + Math.sin(k * Math.PI) * 2;
      ctx.fillStyle = `rgba(0,0,0,${0.15 + k * 0.25})`;
      ctx.beginPath();
      ctx.ellipse(m.x * s, m.y * s, m.radius * s * k, m.radius * s * 0.5 * k, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,140,50,0.4)';
      ctx.beginPath();
      ctx.arc(x * s, (y - z) * s, s * 0.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#6b5a4f';
      ctx.beginPath();
      ctx.arc(x * s, (y - z) * s, s * 0.5, 0, Math.PI * 2);
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
      ctx.lineWidth = Math.max(1, s * 0.05);
      ctx.beginPath();
      ctx.moveTo((a.x + 0.15) * s, (a.y - z - 0.45) * s);
      ctx.lineTo(a.x * s, (a.y - z) * s);
      ctx.stroke();
    }
  }

  drawPreview(ctx, pv, s) {
    const { card, x, y, valid } = pv;
    ctx.save();
    const color = valid ? 'rgba(255,255,255,0.9)' : 'rgba(255,80,80,0.9)';
    if (card.type === 'spell') {
      ctx.fillStyle = valid ? 'rgba(255,255,255,0.15)' : 'rgba(255,60,60,0.15)';
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
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = s * 0.05;
        ctx.beginPath();
        ctx.arc(x * s, y * s, (u.range + u.radius) * s, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.globalAlpha = valid ? 0.75 : 0.4;
      ctx.translate(x * s, (y - (u.air ? 1 : 0)) * s);
      const sc = (u.radius / 0.5) * (card.unitId === 'golem' ? 0.62 : 1);
      ctx.scale(sc, sc);
      drawUnit(ctx, card.unitId, 0, s, { t: this.time });
      ctx.setTransform(1, 0, 0, 1, this.offX, this.offY);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = color;
      ctx.lineWidth = s * 0.07;
      ctx.beginPath();
      ctx.arc(x * s, y * s, Math.max(0.5, u.radius) * s, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawTexts(ctx, fx, s) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const t of fx.texts) {
      const k = 1 - t.life / t.max;
      ctx.globalAlpha = Math.min(1, t.life / t.max * 2);
      ctx.font = `900 ${Math.round(t.size * s)}px system-ui, sans-serif`;
      ctx.lineWidth = Math.max(2, s * 0.08);
      ctx.strokeStyle = 'rgba(0,0,0,0.85)';
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
    const size = Math.round(Math.min(W / 12, this.scale * 1.3));
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(10,8,16,0.55)';
    ctx.fillRect(0, H * 0.42 - size, W, size * 2);
    ctx.font = `900 ${size}px Cinzel, Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(3, size * 0.1);
    ctx.strokeStyle = 'rgba(0,0,0,0.9)';
    ctx.fillStyle = b.color;
    ctx.strokeText(b.text, W / 2, H * 0.42);
    ctx.fillText(b.text, W / 2, H * 0.42);
    ctx.globalAlpha = 1;
  }
}

export { getCard };

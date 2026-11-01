// Efeitos visuais (somente apresentação). Consomem eventos da simulação; nunca alteram o estado da partida.
// Usa um pool limitado de partículas para manter o desempenho em aparelhos modestos.
import { TEAM } from './sprites.js';

const MAX_PARTICLES = 600;

export class Effects {
  constructor() {
    this.particles = [];
    this.texts = [];
    this.rings = [];
    this.meteors = [];
    this.arrows = [];
    this.beams = [];
    this.slashes = [];
    this.shake = 0;
    this.flash = 0;
    this.banner = null;
    this.reduced = false;
    this.damageNumbers = true;
    this.time = 0;
  }

  setOptions({ reducedEffects, damageNumbers }) {
    this.reduced = !!reducedEffects;
    this.damageNumbers = damageNumbers !== false;
  }

  burst(x, y, { count = 10, color = '#fff', speed = 3, life = 0.6, size = 0.12, gravity = 0, up = 0, air = false }) {
    const n = this.reduced ? Math.ceil(count / 3) : count;
    for (let i = 0; i < n && this.particles.length < MAX_PARTICLES; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.3 + Math.random() * 0.7);
      this.particles.push({
        x, y, z: air ? 1.2 : 0.2, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.7, vz: up * (0.5 + Math.random()),
        life, max: life, size: size * (0.6 + Math.random() * 0.8), color, gravity,
      });
    }
  }

  ring(x, y, radius, color, life = 0.5, width = 0.15) {
    this.rings.push({ x, y, radius, color, life, max: life, width });
  }

  text(x, y, str, color = '#fff', size = 0.5) {
    if (this.texts.length > 40) this.texts.shift();
    this.texts.push({ x: x + (Math.random() - 0.5) * 0.4, y, str, color, size, life: 0.9, max: 0.9 });
  }

  showBanner(text, color = '#f2c14e', duration = 1.6) {
    this.banner = { text, color, life: duration, max: duration };
  }

  handle(ev, match) {
    switch (ev.type) {
      case 'spawn':
        this.ring(ev.x, ev.y, ev.kind === 'building' ? 1.2 : 0.8, TEAM[ev.side].light, 0.45, 0.12);
        if (!ev.air) this.burst(ev.x, ev.y, { count: 6, color: 'rgba(220,200,160,0.8)', speed: 1.5, life: 0.4, size: 0.12 });
        break;
      case 'attack':
        if (ev.beam) {
          this.beams.push({ from: ev.id, to: ev.targetId, life: 0.42, max: 0.42, stage: ev.stage, side: ev.side });
        } else if (ev.melee) {
          this.slashes.push({ x: ev.tx, y: ev.ty, ang: Math.atan2(ev.ty - ev.y, ev.tx - ev.x), life: 0.18, max: 0.18 });
        }
        break;
      case 'hit': {
        const big = ev.amount >= 150;
        this.burst(ev.x, ev.y, { count: big ? 6 : 3, color: ev.spell ? '#ffd27a' : '#fff3c4', speed: 2.2, life: 0.3, size: 0.08 });
        if (this.damageNumbers && (ev.kind === 'tower' || big)) {
          this.text(ev.x, ev.y - (ev.kind === 'tower' ? 1.6 : 0.6), `-${ev.amount}`, ev.side === 0 ? '#ff8f80' : '#ffffff', ev.kind === 'tower' ? 0.45 : 0.38);
        }
        break;
      }
      case 'shieldBreak':
        this.burst(ev.x, ev.y, { count: 10, color: '#cfd8e3', speed: 3, life: 0.5, size: 0.12, up: 2 });
        this.text(ev.x, ev.y - 0.8, 'Escudo!', '#cfe3ff', 0.35);
        break;
      case 'impact':
        if (ev.radius > 0) {
          const col = ev.kind === 'fire' ? '#ff8a3c' : ev.kind === 'rune' ? '#8ff0ff' : '#ffcf6a';
          this.ring(ev.x, ev.y, ev.radius, col, 0.35, 0.18);
          this.burst(ev.x, ev.y, { count: 10, color: col, speed: 3, life: 0.45, size: 0.14 });
        }
        break;
      case 'death':
        if (ev.kind === 'unit') {
          this.burst(ev.x, ev.y, { count: 12, color: ev.side === 0 ? '#9cc8ff' : '#ffaa9e', speed: 2.5, life: 0.6, size: 0.12, air: ev.air });
          this.burst(ev.x, ev.y, { count: 5, color: 'rgba(240,240,255,0.7)', speed: 0.6, life: 0.9, size: 0.2, up: 1.5, air: ev.air });
        } else if (ev.kind === 'building') {
          this.burst(ev.x, ev.y, { count: 22, color: '#a89a88', speed: 3.5, life: 0.9, size: 0.18, up: 3, gravity: 6 });
        }
        break;
      case 'towerDestroyed':
        this.shake = Math.max(this.shake, 0.6);
        this.flash = 0.25;
        this.ring(ev.x, ev.y, 4, '#ffcf6a', 0.7, 0.35);
        this.burst(ev.x, ev.y, { count: 50, color: '#a89a88', speed: 6, life: 1.2, size: 0.22, up: 5, gravity: 8 });
        this.burst(ev.x, ev.y, { count: 30, color: '#ff9a3c', speed: 4, life: 0.8, size: 0.2 });
        this.showBanner(ev.side === 0 ? 'Sua torre caiu!' : 'Torre inimiga destruída!', ev.side === 0 ? '#ff7a6a' : '#f2c14e');
        break;
      case 'kingActivated':
        this.ring(ev.x, ev.y, 2.5, '#f2c14e', 0.6, 0.15);
        break;
      case 'spell':
        this.handleSpell(ev, match);
        break;
      case 'doubleEnergy':
        this.showBanner('Éter em dobro!', '#c18cff');
        break;
      case 'phase':
        if (ev.phase === 'playing') this.showBanner('Batalha!', '#f2c14e', 1.1);
        if (ev.phase === 'overtime') this.showBanner('Prorrogação — morte súbita!', '#ff9a3c', 2.2);
        break;
      default:
        break;
    }
  }

  handleSpell(ev) {
    if (ev.stage === 'cast') {
      if (ev.cardId === 'meteoro') this.meteors.push({ x: ev.x, y: ev.y, fx: ev.fromX, fy: ev.fromY, t: 0, dur: ev.delay, radius: ev.radius });
      if (ev.cardId === 'saraivada') this.ring(ev.x, ev.y, ev.radius, 'rgba(255,255,255,0.5)', ev.delay + 0.6, 0.06);
      return;
    }
    switch (ev.cardId) {
      case 'meteoro':
        this.shake = Math.max(this.shake, 0.35);
        this.ring(ev.x, ev.y, ev.radius, '#ff9a3c', 0.5, 0.3);
        this.burst(ev.x, ev.y, { count: 35, color: '#ff8a3c', speed: 5, life: 0.7, size: 0.2, up: 3, gravity: 5 });
        this.burst(ev.x, ev.y, { count: 15, color: '#5a4a40', speed: 3, life: 1.0, size: 0.25, up: 4, gravity: 8 });
        break;
      case 'saraivada':
        for (let i = 0; i < (this.reduced ? 6 : 16); i++) {
          const a = Math.random() * Math.PI * 2;
          const r = Math.sqrt(Math.random()) * ev.radius;
          this.arrows.push({ x: ev.x + Math.cos(a) * r, y: ev.y + Math.sin(a) * r, life: 0.25, max: 0.25 });
        }
        this.burst(ev.x, ev.y, { count: 8, color: '#e6d7b8', speed: 3, life: 0.3, size: 0.1 });
        break;
      case 'geada':
        this.ring(ev.x, ev.y, ev.radius, '#bfeaff', 0.8, 0.35);
        this.burst(ev.x, ev.y, { count: 40, color: '#dff4ff', speed: 4, life: 0.9, size: 0.14 });
        break;
      case 'fonte':
        this.ring(ev.x, ev.y, ev.radius, '#7cf0a0', 0.6, 0.2);
        break;
      case 'hino':
        this.ring(ev.x, ev.y, ev.radius, '#ffd257', 0.6, 0.2);
        this.burst(ev.x, ev.y, { count: 20, color: '#ffd257', speed: 3, life: 0.6, size: 0.12, up: 2 });
        break;
      default:
        break;
    }
  }

  update(dt) {
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt * 1.8);
    this.flash = Math.max(0, this.flash - dt);
    const ps = this.particles;
    let w = 0;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      p.life -= dt;
      if (p.life <= 0) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vz -= p.gravity * dt;
      if (p.z < 0) {
        p.z = 0;
        p.vz *= -0.3;
      }
      p.vx *= 0.94;
      p.vy *= 0.94;
      ps[w++] = p;
    }
    ps.length = w;
    const tick = (arr) => {
      let k = 0;
      for (const o of arr) {
        o.life -= dt;
        if (o.life > 0) arr[k++] = o;
      }
      arr.length = k;
    };
    tick(this.texts);
    tick(this.rings);
    tick(this.arrows);
    tick(this.beams);
    tick(this.slashes);
    for (const m of this.meteors) m.t += dt;
    this.meteors = this.meteors.filter((m) => m.t < m.dur);
    if (this.banner) {
      this.banner.life -= dt;
      if (this.banner.life <= 0) this.banner = null;
    }
  }
}

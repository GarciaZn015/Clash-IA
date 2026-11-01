// Áudio 100% procedural (Web Audio API): efeitos sintetizados e trilha gerada em tempo real.
// Volumes de música e efeitos são independentes. Tudo falha silenciosamente se o navegador não suportar áudio.

const SCALE = [0, 2, 3, 5, 7, 9, 10]; // dórico
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.settings = { music: 0.45, sfx: 0.8, muted: false };
    this.lastPlayed = new Map();
    this.musicMode = null;
    this.musicTimer = null;
    this.nextNoteTime = 0;
    this.step = 0;
    this.noiseBuf = null;
    this.intensity = 0;
  }

  /** Precisa ser chamado a partir de um gesto do usuário (política de autoplay). */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.connect(this.master);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.connect(this.master);
      const len = this.ctx.sampleRate * 1;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.apply(this.settings);
      if (this.musicMode) this.startMusic(this.musicMode, true);
    } catch {
      this.ctx = null;
    }
  }

  apply(settings) {
    this.settings = { ...this.settings, ...settings };
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.settings.muted ? 0 : 0.9, t, 0.02);
    this.musicGain.gain.setTargetAtTime(this.settings.music * 0.35, t, 0.05);
    this.sfxGain.gain.setTargetAtTime(this.settings.sfx * 0.6, t, 0.02);
  }

  tone({ freq = 440, to = null, type = 'sine', dur = 0.15, vol = 0.3, attack = 0.005, when = 0, dest = null }) {
    const c = this.ctx;
    const t = c.currentTime + when;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(dest || this.sfxGain);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  noise({ dur = 0.2, vol = 0.3, filter = 'lowpass', freq = 1000, to = null, q = 1, when = 0 }) {
    const c = this.ctx;
    const t = c.currentTime + when;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = filter;
    f.frequency.setValueAtTime(freq, t);
    if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.sfxGain);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  /** Toca um efeito pelo nome, com limite de repetição para não saturar. */
  play(name, { throttle = 0.05 } = {}) {
    if (!this.ctx || this.settings.muted || this.settings.sfx <= 0) return;
    const now = this.ctx.currentTime;
    const last = this.lastPlayed.get(name) || -1;
    if (now - last < throttle) return;
    this.lastPlayed.set(name, now);
    try {
      this.synth(name);
    } catch { /* ignora */ }
  }

  synth(name) {
    switch (name) {
      case 'click': this.tone({ freq: 660, to: 880, type: 'square', dur: 0.06, vol: 0.12 }); break;
      case 'deny': this.tone({ freq: 220, to: 150, type: 'square', dur: 0.15, vol: 0.12 }); break;
      case 'select': this.tone({ freq: 520, type: 'triangle', dur: 0.08, vol: 0.15 }); break;
      case 'place':
        this.tone({ freq: 180, to: 70, type: 'sine', dur: 0.25, vol: 0.4 });
        this.noise({ dur: 0.15, vol: 0.15, freq: 900 });
        break;
      case 'sword': this.noise({ dur: 0.08, vol: 0.18, filter: 'bandpass', freq: 2600, q: 3 }); break;
      case 'bite': this.noise({ dur: 0.07, vol: 0.15, filter: 'bandpass', freq: 1200, q: 2 }); break;
      case 'arrow': this.noise({ dur: 0.12, vol: 0.1, filter: 'highpass', freq: 3000, to: 1500 }); break;
      case 'cannon':
        this.tone({ freq: 120, to: 50, dur: 0.2, vol: 0.3 });
        this.noise({ dur: 0.15, vol: 0.15, freq: 600 });
        break;
      case 'bomb':
        this.noise({ dur: 0.35, vol: 0.3, freq: 700, to: 120 });
        this.tone({ freq: 90, to: 40, dur: 0.3, vol: 0.3 });
        break;
      case 'magic': this.tone({ freq: 500, to: 1200, type: 'sine', dur: 0.2, vol: 0.12 }); break;
      case 'fire': this.noise({ dur: 0.25, vol: 0.18, filter: 'bandpass', freq: 800, to: 300, q: 1 }); break;
      case 'beam': this.tone({ freq: 300 + Math.random() * 30, type: 'sawtooth', dur: 0.12, vol: 0.04 }); break;
      case 'hitTower': this.tone({ freq: 160, to: 110, type: 'triangle', dur: 0.1, vol: 0.18 }); break;
      case 'death': this.tone({ freq: 400, to: 120, type: 'triangle', dur: 0.22, vol: 0.12 }); break;
      case 'building': this.noise({ dur: 0.5, vol: 0.25, freq: 500, to: 100 }); break;
      case 'tower':
        this.noise({ dur: 1.2, vol: 0.5, freq: 900, to: 60 });
        this.tone({ freq: 70, to: 30, dur: 1.0, vol: 0.5 });
        break;
      case 'meteor':
        this.noise({ dur: 0.7, vol: 0.45, freq: 1200, to: 80 });
        this.tone({ freq: 80, to: 30, dur: 0.6, vol: 0.45 });
        break;
      case 'whoosh': this.noise({ dur: 0.6, vol: 0.12, filter: 'bandpass', freq: 400, to: 2000, q: 2 }); break;
      case 'volley': for (let i = 0; i < 4; i++) this.noise({ dur: 0.1, vol: 0.08, filter: 'highpass', freq: 3500, when: i * 0.04 }); break;
      case 'freeze': for (let i = 0; i < 4; i++) this.tone({ freq: 1400 + i * 350, type: 'sine', dur: 0.5, vol: 0.06, when: i * 0.05 }); break;
      case 'heal': [0, 4, 7, 12].forEach((n, i) => this.tone({ freq: midi(72 + n), type: 'sine', dur: 0.3, vol: 0.08, when: i * 0.06 })); break;
      case 'rage': [0, 3, 7].forEach((n, i) => this.tone({ freq: midi(60 + n), type: 'sawtooth', dur: 0.2, vol: 0.06, when: i * 0.05 })); break;
      case 'shield': this.tone({ freq: 900, to: 300, type: 'square', dur: 0.15, vol: 0.1 }); break;
      case 'beep': this.tone({ freq: 880, type: 'square', dur: 0.1, vol: 0.12 }); break;
      case 'horn':
        this.tone({ freq: midi(57), type: 'sawtooth', dur: 0.6, vol: 0.12, attack: 0.05 });
        this.tone({ freq: midi(64), type: 'sawtooth', dur: 0.6, vol: 0.1, attack: 0.05 });
        break;
      case 'victory': [0, 4, 7, 12, 16].forEach((n, i) => this.tone({ freq: midi(64 + n), type: 'triangle', dur: 0.5, vol: 0.18, when: i * 0.12 })); break;
      case 'defeat': [7, 3, 0, -5].forEach((n, i) => this.tone({ freq: midi(60 + n), type: 'triangle', dur: 0.6, vol: 0.16, when: i * 0.18 })); break;
      case 'coins': [0, 7, 12].forEach((n, i) => this.tone({ freq: midi(84 + n), type: 'square', dur: 0.08, vol: 0.06, when: i * 0.05 })); break;
      case 'chest':
        this.noise({ dur: 0.4, vol: 0.2, freq: 400, to: 3000 });
        [0, 4, 7, 11, 14].forEach((n, i) => this.tone({ freq: midi(72 + n), type: 'sine', dur: 0.4, vol: 0.1, when: 0.2 + i * 0.07 }));
        break;
      case 'levelup': [0, 4, 7, 12, 7, 12, 16].forEach((n, i) => this.tone({ freq: midi(67 + n), type: 'triangle', dur: 0.25, vol: 0.14, when: i * 0.09 })); break;
      default: break;
    }
  }

  // ---------------------------------------------------------------- música

  startMusic(mode, force = false) {
    if (this.musicMode === mode && !force && this.musicTimer) return;
    this.musicMode = mode;
    if (!this.ctx) return;
    this.stopTimer();
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.step = 0;
    this.musicTimer = setInterval(() => this.schedule(), 100);
  }

  stopMusic() {
    this.musicMode = null;
    this.stopTimer();
  }

  stopTimer() {
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = null;
  }

  setIntensity(v) {
    this.intensity = v;
  }

  schedule() {
    if (!this.ctx || this.settings.music <= 0 || this.settings.muted) {
      if (this.ctx) this.nextNoteTime = this.ctx.currentTime + 0.1;
      return;
    }
    const battle = this.musicMode === 'battle';
    const bpm = battle ? 104 + this.intensity * 24 : 78;
    const stepDur = 60 / bpm / 2;
    const root = battle ? 50 : 52;
    const prog = battle ? [0, 0, 5, 3] : [0, 3, 5, 4];
    while (this.nextNoteTime < this.ctx.currentTime + 0.3) {
      const when = this.nextNoteTime - this.ctx.currentTime;
      const bar = Math.floor(this.step / 8) % prog.length;
      const chordRoot = root + SCALE[prog[bar] % SCALE.length] + (prog[bar] >= SCALE.length ? 12 : 0);
      const st = this.step % 8;
      if (st === 0) this.tone({ freq: midi(chordRoot - 12), type: 'triangle', dur: stepDur * 7, vol: 0.22, attack: 0.03, when, dest: this.musicGain });
      const pattern = battle ? [0, 2, 4, 2, 7, 4, 2, 4] : [0, 4, 2, 4, 7, 4, 2, 4];
      const deg = pattern[st];
      const note = chordRoot + 12 + SCALE[deg % 7] + (deg >= 7 ? 12 : 0);
      if (battle || st % 2 === 0) this.tone({ freq: midi(note), type: battle ? 'square' : 'triangle', dur: stepDur * 0.9, vol: battle ? 0.05 : 0.08, when, dest: this.musicGain });
      if (battle && st % 4 === 0) this.noiseDrum(when, st === 0 ? 0.18 : 0.08);
      this.nextNoteTime += stepDur;
      this.step++;
    }
  }

  noiseDrum(when, vol) {
    const c = this.ctx;
    const t = c.currentTime + when;
    const o = c.createOscillator();
    const g = c.createGain();
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.15);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g);
    g.connect(this.musicGain);
    o.start(t);
    o.stop(t + 0.2);
  }
}

/** Mapeia eventos da simulação para efeitos sonoros. */
export function soundForEvent(ev) {
  switch (ev.type) {
    case 'cardPlayed': return ev.side === 0 ? 'place' : null;
    case 'attack': {
      if (ev.beam) return 'beam';
      if (ev.melee) return ev.defId === 'lobo' || ev.defId === 'diabrete' || ev.defId === 'corvo' ? 'bite' : 'sword';
      if (ev.defId === 'king') return 'cannon';
      if (ev.defId === 'bombardeiro') return 'whoosh';
      if (ev.defId === 'mago') return 'magic';
      if (ev.defId === 'dragonete') return 'fire';
      return 'arrow';
    }
    case 'impact': return ev.radius > 0 ? (ev.kind === 'bomb' ? 'bomb' : null) : null;
    case 'hit': return ev.kind === 'tower' ? 'hitTower' : null;
    case 'death': return ev.kind === 'unit' ? 'death' : ev.kind === 'building' ? 'building' : null;
    case 'towerDestroyed': return 'tower';
    case 'shieldBreak': return 'shield';
    case 'spell':
      if (ev.stage === 'impact') return { meteoro: 'meteor', saraivada: 'volley', geada: 'freeze', fonte: 'heal', hino: 'rage' }[ev.cardId] || null;
      return ev.cardId === 'meteoro' ? 'whoosh' : null;
    case 'phase': return ev.phase === 'playing' ? 'horn' : ev.phase === 'overtime' ? 'horn' : null;
    default: return null;
  }
}

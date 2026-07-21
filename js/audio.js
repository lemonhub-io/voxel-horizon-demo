class AudioEngine {
  constructor() {
    this.ok = false;
    this.vol = { master: 0.8, music: 0.6, sfx: 0.9 };
    this.loops = {};
    this.musicMode = null;
    this.nightMix = 0;
  }

  ensure() {
    if (this.ok) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const c = this.ctx;
    this.master = c.createGain();
    this.comp = c.createDynamicsCompressor();
    this.comp.threshold.value = -14;
    this.comp.ratio.value = 5;
    this.master.connect(this.comp);
    this.comp.connect(c.destination);
    this.sfxBus = c.createGain();
    this.musicBus = c.createGain();
    this.sfxBus.connect(this.master);
    this.musicBus.connect(this.master);
    this.reverb = c.createConvolver();
    this.reverb.buffer = this.makeImpulse(2.6, 2.2);
    this.revGain = c.createGain();
    this.revGain.gain.value = 0.5;
    this.reverb.connect(this.revGain);
    this.revGain.connect(this.master);
    this.noiseBuf = this.makeNoise(2);
    this.ok = true;
    this.applyVol();
  }

  applyVol() {
    if (!this.ok) return;
    this.master.gain.value = this.vol.master;
    this.sfxBus.gain.value = this.vol.sfx;
    this.musicBus.gain.value = this.vol.music * 0.8;
  }
  setVol(k, v) { this.vol[k] = v; this.applyVol(); }

  makeImpulse(dur, decay) {
    const c = this.ctx, rate = c.sampleRate, len = rate * dur;
    const buf = c.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }
  makeNoise(dur) {
    const c = this.ctx, len = c.sampleRate * dur;
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  tone(o) {
    if (!this.ok) return null;
    const c = this.ctx, t = c.currentTime + (o.at || 0);
    const osc = c.createOscillator();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f, t);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(o.f2, 1), t + (o.slide || o.dur || 0.2));
    if (o.detune) osc.detune.value = o.detune;
    const g = c.createGain();
    const a = o.a || 0.004, d = o.dur || 0.2, r = o.r || 0.06;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(o.vol || 0.2, t + a);
    if (o.sus !== undefined) g.gain.setValueAtTime(o.sus, t + d);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d + r);
    let node = osc;
    if (o.filter) {
      const f = c.createBiquadFilter();
      f.type = o.filter; f.frequency.value = o.ff || 1200; f.Q.value = o.q || 1;
      osc.connect(f); node = f;
    }
    node.connect(g);
    let out = g;
    if (o.pan) {
      const p = c.createStereoPanner();
      p.pan.value = U.clamp(o.pan, -1, 1);
      g.connect(p); out = p;
    }
    out.connect(o.bus || this.sfxBus);
    if (o.rev) { const rg = c.createGain(); rg.gain.value = o.rev; out.connect(rg); rg.connect(this.reverb); }
    osc.start(t);
    osc.stop(t + d + r + 0.05);
    return osc;
  }

  noise(o) {
    if (!this.ok) return;
    const c = this.ctx, t = c.currentTime + (o.at || 0);
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = o.type || 'bandpass';
    f.frequency.setValueAtTime(o.f || 1000, t);
    if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + (o.dur || 0.2));
    f.Q.value = o.q || 1;
    const g = c.createGain();
    const a = o.a || 0.003, d = o.dur || 0.15, r = o.r || 0.05;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(o.vol || 0.2, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d + r);
    src.connect(f); f.connect(g);
    let out = g;
    if (o.pan) { const p = c.createStereoPanner(); p.pan.value = U.clamp(o.pan, -1, 1); g.connect(p); out = p; }
    out.connect(o.bus || this.sfxBus);
    if (o.rev) { const rg = c.createGain(); rg.gain.value = o.rev; out.connect(rg); rg.connect(this.reverb); }
    src.start(t);
    src.stop(t + d + r + 0.1);
  }

  mkLoop(name, build) {
    if (!this.ok || this.loops[name]) return this.loops[name];
    const c = this.ctx;
    const g = c.createGain();
    g.gain.value = 0;
    g.connect(this.sfxBus);
    const handle = build(c, g);
    this.loops[name] = { gain: g, handle, on: false };
    return this.loops[name];
  }
  setLoop(name, on, vol, ramp) {
    const l = this.loops[name];
    if (!l) return;
    const t = this.ctx.currentTime;
    l.gain.gain.cancelScheduledValues(t);
    l.gain.gain.setValueAtTime(l.gain.gain.value, t);
    l.gain.gain.linearRampToValueAtTime(on ? (vol || 1) : 0, t + (ramp || 0.08));
    l.on = on;
  }

  initLoops() {
    if (!this.ok) return;
    this.mkLoop('wind', (c, out) => {
      const src = c.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420; f.Q.value = 0.6;
      const g2 = c.createGain(); g2.gain.value = 0.5;
      const lfo = c.createOscillator(); lfo.frequency.value = 0.13;
      const lg = c.createGain(); lg.gain.value = 180;
      lfo.connect(lg); lg.connect(f.frequency);
      src.connect(f); f.connect(g2); g2.connect(out);
      src.start(); lfo.start();
    });
    this.mkLoop('laser', (c, out) => {
      const o1 = c.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 92;
      const o2 = c.createOscillator(); o2.type = 'square'; o2.frequency.value = 138.5; o2.detune.value = 6;
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
      const lfo = c.createOscillator(); lfo.frequency.value = 17;
      const lg = c.createGain(); lg.gain.value = 300;
      lfo.connect(lg); lg.connect(f.frequency);
      const g2 = c.createGain(); g2.gain.value = 0.14;
      o1.connect(f); o2.connect(f); f.connect(g2); g2.connect(out);
      o1.start(); o2.start(); lfo.start();
      return { o1, o2 };
    });
    this.mkLoop('jet', (c, out) => {
      const src = c.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 800; f.Q.value = 0.8;
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 55;
      const og = c.createGain(); og.gain.value = 0.35;
      const g2 = c.createGain(); g2.gain.value = 0.4;
      src.connect(f); f.connect(g2); o.connect(og); og.connect(g2); g2.connect(out);
      src.start(); o.start();
    });
    this.mkLoop('ship', (c, out) => {
      const o1 = c.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 48;
      const o2 = c.createOscillator(); o2.type = 'triangle'; o2.frequency.value = 96.5;
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 300;
      const src = c.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
      const nf = c.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 500; nf.Q.value = 0.5;
      const ng = c.createGain(); ng.gain.value = 0.16;
      const g2 = c.createGain(); g2.gain.value = 0.35;
      o1.connect(f); o2.connect(f); f.connect(g2);
      src.connect(nf); nf.connect(ng); ng.connect(g2);
      g2.connect(out);
      o1.start(); o2.start(); src.start();
      return { o1, o2, f, nf };
    });
    this.mkLoop('storm', (c, out) => {
      const src = c.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700; f.Q.value = 0.7;
      const lfo = c.createOscillator(); lfo.frequency.value = 0.4;
      const lg = c.createGain(); lg.gain.value = 350;
      lfo.connect(lg); lg.connect(f.frequency);
      const g2 = c.createGain(); g2.gain.value = 0.8;
      src.connect(f); f.connect(g2); g2.connect(out);
      src.start(); lfo.start();
    });
  }

  shipThrottle(t) {
    const l = this.loops.ship;
    if (!l || !l.handle) return;
    const now = this.ctx.currentTime;
    l.handle.o1.frequency.setTargetAtTime(48 + t * 60, now, 0.1);
    l.handle.o2.frequency.setTargetAtTime(96.5 + t * 120, now, 0.1);
    l.handle.f.frequency.setTargetAtTime(300 + t * 1400, now, 0.1);
  }
  laserPitch(p) {
    const l = this.loops.laser;
    if (!l || !l.handle) return;
    const now = this.ctx.currentTime;
    l.handle.o1.frequency.setTargetAtTime(92 + p * 90, now, 0.05);
    l.handle.o2.frequency.setTargetAtTime(138.5 + p * 140, now, 0.05);
  }

  uiHover() { this.tone({ type: 'sine', f: 2400, dur: 0.03, vol: 0.05, r: 0.03 }); }
  uiClick() { this.tone({ type: 'sine', f: 1700, f2: 2300, dur: 0.06, vol: 0.12, r: 0.05, rev: 0.2 }); this.tone({ type: 'square', f: 850, dur: 0.03, vol: 0.03 }); }
  uiOpen() {
    this.noise({ type: 'highpass', f: 1200, dur: 0.12, vol: 0.08 });
    this.tone({ type: 'sine', f: 520, f2: 780, dur: 0.14, vol: 0.1, rev: 0.3 });
    this.tone({ type: 'sine', f: 1040, dur: 0.1, vol: 0.06, at: 0.05, rev: 0.3 });
  }
  uiClose() { this.noise({ type: 'highpass', f: 1400, dur: 0.1, vol: 0.06 }); this.tone({ type: 'sine', f: 700, f2: 420, dur: 0.12, vol: 0.09 }); }
  uiDeny() { this.tone({ type: 'square', f: 220, dur: 0.09, vol: 0.09 }); this.tone({ type: 'square', f: 185, dur: 0.12, vol: 0.09, at: 0.1 }); }
  pickup(i) {
    const f = 880 * Math.pow(1.06, (i || 0) % 8);
    this.tone({ type: 'sine', f, f2: f * 1.5, dur: 0.07, vol: 0.11, rev: 0.25 });
    this.tone({ type: 'triangle', f: f * 2, dur: 0.05, vol: 0.05, at: 0.04, rev: 0.25 });
  }
  notify(kind) {
    if (kind === 'danger') {
      this.tone({ type: 'square', f: 640, dur: 0.1, vol: 0.1, filter: 'lowpass', ff: 1800 });
      this.tone({ type: 'square', f: 640, dur: 0.1, vol: 0.1, at: 0.16, filter: 'lowpass', ff: 1800 });
    } else {
      this.tone({ type: 'sine', f: 1245, dur: 0.09, vol: 0.12, rev: 0.4 });
      this.tone({ type: 'sine', f: 1867, dur: 0.14, vol: 0.1, at: 0.09, rev: 0.4 });
    }
  }
  milestone() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      this.tone({ type: 'triangle', f, dur: 0.5, vol: 0.12, at: i * 0.1, a: 0.01, r: 0.6, rev: 0.7 });
      this.tone({ type: 'sine', f: f * 2, dur: 0.3, vol: 0.04, at: i * 0.1, rev: 0.7 });
    });
    this.noise({ type: 'highpass', f: 3000, dur: 0.7, vol: 0.03, a: 0.3, rev: 0.6 });
  }
  missionDone() {
    [659.25, 880, 1108.7].forEach((f, i) => this.tone({ type: 'sine', f, dur: 0.3, vol: 0.11, at: i * 0.12, r: 0.4, rev: 0.6 }));
  }
  craft() {
    this.noise({ type: 'bandpass', f: 2400, dur: 0.08, vol: 0.1 });
    [740, 932, 1244].forEach((f, i) => this.tone({ type: 'triangle', f, dur: 0.12, vol: 0.1, at: 0.05 + i * 0.07, rev: 0.4 }));
  }
  alarm() {
    this.tone({ type: 'sawtooth', f: 880, f2: 620, dur: 0.28, vol: 0.07, filter: 'lowpass', ff: 2200 });
    this.tone({ type: 'sawtooth', f: 880, f2: 620, dur: 0.28, vol: 0.07, at: 0.36, filter: 'lowpass', ff: 2200 });
  }
  heartbeat() {
    this.tone({ type: 'sine', f: 60, f2: 40, dur: 0.09, vol: 0.3 });
    this.tone({ type: 'sine', f: 55, f2: 38, dur: 0.08, vol: 0.22, at: 0.16 });
  }
  mineHit(snd, pan) {
    const m = { stone: [1500, 0.05], grass: [650, 0.07], wood: [950, 0.06], sand: [480, 0.08], crystal: [2600, 0.06], glass: [2900, 0.05], metal: [2100, 0.05] }[snd] || [1200, 0.06];
    this.noise({ type: 'bandpass', f: m[0], q: 1.5, dur: m[1], vol: 0.14, pan });
    if (snd === 'crystal' || snd === 'glass') this.tone({ type: 'sine', f: 1800 + Math.random() * 900, dur: 0.06, vol: 0.06, pan });
  }
  blockBreak(snd, pan) {
    const base = { stone: 320, grass: 260, wood: 300, sand: 220, crystal: 900, glass: 1200, metal: 500 }[snd] || 300;
    this.noise({ type: 'lowpass', f: base * 3, dur: 0.16, vol: 0.3, pan });
    this.tone({ type: 'sine', f: base * 0.4, f2: base * 0.2, dur: 0.12, vol: 0.18, pan });
    if (snd === 'crystal' || snd === 'glass') [1, 1.4, 1.9].forEach((m, i) => this.tone({ type: 'sine', f: 1600 * m, dur: 0.09, vol: 0.05, at: i * 0.03, pan }));
  }
  place(snd, pan) {
    this.noise({ type: 'lowpass', f: 900, dur: 0.07, vol: 0.2, pan });
    this.tone({ type: 'sine', f: 240, f2: 170, dur: 0.08, vol: 0.14, pan });
  }
  step(snd, run) {
    const m = { grass: [500, 0.05], stone: [1300, 0.04], sand: [380, 0.07], wood: [800, 0.045], metal: [1600, 0.04] }[snd] || [500, 0.05];
    this.noise({ type: 'bandpass', f: m[0] * (0.9 + Math.random() * 0.25), q: 1.1, dur: m[1], vol: run ? 0.09 : 0.06 });
    if (snd === 'stone' || snd === 'metal') this.tone({ type: 'sine', f: 900 + Math.random() * 300, dur: 0.02, vol: 0.02 });
  }
  jump() { this.noise({ type: 'bandpass', f: 700, dur: 0.08, vol: 0.06 }); }
  land(hard) {
    this.noise({ type: 'lowpass', f: 500, dur: hard ? 0.2 : 0.1, vol: hard ? 0.35 : 0.15 });
    if (hard) this.tone({ type: 'sine', f: 80, f2: 40, dur: 0.15, vol: 0.3 });
  }
  hurt() {
    this.tone({ type: 'sawtooth', f: 260, f2: 130, dur: 0.18, vol: 0.16, filter: 'lowpass', ff: 1400 });
    this.noise({ type: 'lowpass', f: 800, dur: 0.12, vol: 0.15 });
  }
  death() {
    this.tone({ type: 'sawtooth', f: 320, f2: 55, dur: 1.6, vol: 0.2, filter: 'lowpass', ff: 900, r: 0.8 });
    this.noise({ type: 'lowpass', f: 400, dur: 1.2, vol: 0.2, r: 0.8 });
  }
  respawn() {
    [392, 523.25, 659.25, 783.99].forEach((f, i) => this.tone({ type: 'sine', f, dur: 0.4, vol: 0.09, at: i * 0.13, rev: 0.7 }));
  }
  scanPulse() {
    this.tone({ type: 'sine', f: 700, f2: 2400, dur: 0.7, slide: 0.7, vol: 0.1, a: 0.02, r: 0.3, rev: 0.6 });
    this.noise({ type: 'highpass', f: 2000, dur: 0.5, vol: 0.04, a: 0.1, rev: 0.5 });
  }
  scanFound(i) { this.tone({ type: 'sine', f: 1560 + i * 120, dur: 0.06, vol: 0.07, at: 0.3 + i * 0.07, rev: 0.5 }); }
  analyze() {
    this.tone({ type: 'sine', f: 980, f2: 1960, dur: 0.5, slide: 0.5, vol: 0.09, rev: 0.5 });
    [1244, 1568, 2093].forEach((f, i) => this.tone({ type: 'triangle', f, dur: 0.18, vol: 0.08, at: 0.5 + i * 0.09, rev: 0.6 }));
  }
  analyzeTick(p) { this.tone({ type: 'sine', f: 900 + p * 800, dur: 0.03, vol: 0.04 }); }
  recharge() {
    this.tone({ type: 'sine', f: 420, f2: 1200, dur: 0.5, slide: 0.5, vol: 0.1, rev: 0.3 });
    this.noise({ type: 'bandpass', f: 1800, dur: 0.35, vol: 0.05, a: 0.1 });
  }
  useItem() { this.tone({ type: 'sine', f: 620, f2: 1240, dur: 0.25, vol: 0.11, rev: 0.3 }); }
  overheat() {
    this.noise({ type: 'highpass', f: 2500, dur: 0.7, vol: 0.14, r: 0.4 });
    this.tone({ type: 'square', f: 340, f2: 180, dur: 0.3, vol: 0.08 });
  }
  splash() { this.noise({ type: 'lowpass', f: 1100, dur: 0.25, vol: 0.22, r: 0.15 }); }
  takeoff() {
    this.noise({ type: 'lowpass', f: 300, f2: 2400, dur: 2.4, vol: 0.4, a: 0.15, r: 0.8 });
    this.tone({ type: 'sawtooth', f: 45, f2: 160, dur: 2.4, slide: 2.4, vol: 0.22, filter: 'lowpass', ff: 700, r: 0.6 });
  }
  landing() {
    this.noise({ type: 'lowpass', f: 1600, f2: 300, dur: 1.6, vol: 0.3, a: 0.05, r: 0.5 });
    this.tone({ type: 'sawtooth', f: 130, f2: 40, dur: 1.7, slide: 1.7, vol: 0.16, filter: 'lowpass', ff: 500 });
  }
  warpCharge() {
    this.tone({ type: 'sawtooth', f: 70, f2: 640, dur: 2.2, slide: 2.2, vol: 0.16, filter: 'lowpass', ff: 1600, a: 0.2 });
    this.tone({ type: 'sine', f: 140, f2: 1280, dur: 2.2, slide: 2.2, vol: 0.1, a: 0.2, rev: 0.5 });
    this.noise({ type: 'highpass', f: 900, f2: 4000, dur: 2.2, vol: 0.08, a: 0.6 });
  }
  warpBoom() {
    this.noise({ type: 'lowpass', f: 2000, f2: 120, dur: 1.4, vol: 0.5, r: 0.8 });
    this.tone({ type: 'sine', f: 55, f2: 30, dur: 1.2, vol: 0.4, r: 0.6 });
    this.tone({ type: 'sine', f: 1760, dur: 0.6, vol: 0.06, at: 0.2, rev: 0.8 });
  }
  creatureCall(seed, dist) {
    if (dist > 40) return;
    const rng = U.mulberry32(seed);
    const vol = 0.12 * (1 - dist / 40);
    const base = 300 + rng() * 700;
    const n = 1 + Math.floor(rng() * 3);
    for (let i = 0; i < n; i++) {
      this.tone({ type: rng() < 0.5 ? 'sine' : 'triangle', f: base * (1 + rng() * 0.4), f2: base * (0.7 + rng() * 0.9), dur: 0.1 + rng() * 0.15, vol, at: i * (0.12 + rng() * 0.1), rev: 0.5, pan: (rng() - 0.5) });
    }
  }
  creatureHurt(pan) { this.tone({ type: 'square', f: 500, f2: 260, dur: 0.14, vol: 0.1, pan, filter: 'lowpass', ff: 1800 }); }
  thunder() {
    this.noise({ type: 'lowpass', f: 220, dur: 1.8, vol: 0.35, a: 0.02, r: 1.2, rev: 0.6 });
  }

  startMusic(mode) {
    if (!this.ok) return;
    this.stopMusic();
    this.musicMode = mode;
    this.chordIdx = 0;
    this.padTimer = setInterval(() => this.playPad(), 7000);
    this.playPad();
    this.pluckTimer = setInterval(() => { if (Math.random() < 0.65) this.playPluck(); }, 5200);
  }
  stopMusic() {
    clearInterval(this.padTimer);
    clearInterval(this.pluckTimer);
    this.padTimer = this.pluckTimer = null;
  }
  playPad() {
    if (!this.ok) return;
    const day = [[0, 7, 14, 21], [-2, 5, 12, 17], [-4, 3, 10, 19], [-7, 0, 7, 16]];
    const night = [[0, 3, 10, 15], [-4, 3, 8, 15], [-2, 1, 8, 13], [-7, 0, 5, 12]];
    const prog = this.nightMix > 0.5 ? night : day;
    const chord = prog[this.chordIdx % prog.length];
    this.chordIdx++;
    const root = 110;
    const c = this.ctx;
    chord.forEach(semi => {
      const f = root * Math.pow(2, semi / 12);
      [[-7, 'sawtooth'], [7, 'sawtooth'], [0, 'triangle']].forEach(([det, type]) => {
        const t = c.currentTime;
        const o = c.createOscillator();
        o.type = type; o.frequency.value = f; o.detune.value = det;
        const flt = c.createBiquadFilter();
        flt.type = 'lowpass';
        flt.frequency.setValueAtTime(300, t);
        flt.frequency.linearRampToValueAtTime(750 - this.nightMix * 300, t + 3.5);
        flt.frequency.linearRampToValueAtTime(300, t + 8);
        const g = c.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.028, t + 2.8);
        g.gain.linearRampToValueAtTime(0.0001, t + 8.5);
        o.connect(flt); flt.connect(g);
        g.connect(this.musicBus);
        const rg = c.createGain(); rg.gain.value = 0.8;
        g.connect(rg); rg.connect(this.reverb);
        o.start(t); o.stop(t + 9);
      });
    });
  }
  playPluck() {
    if (!this.ok) return;
    const scale = this.nightMix > 0.5 ? [0, 3, 5, 7, 10, 12, 15] : [0, 2, 4, 7, 9, 12, 14];
    const c = this.ctx;
    const n = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const f = 440 * Math.pow(2, U.pick(scale) / 12);
      const t = c.currentTime + i * (0.3 + Math.random() * 0.4);
      const o = c.createOscillator();
      o.type = 'sine'; o.frequency.value = f;
      const mod = c.createOscillator(); mod.frequency.value = f * 2;
      const mg = c.createGain(); mg.gain.setValueAtTime(f * 1.2, t); mg.gain.exponentialRampToValueAtTime(1, t + 0.4);
      mod.connect(mg); mg.connect(o.frequency);
      const g = c.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.05, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
      o.connect(g); g.connect(this.musicBus);
      const rg = c.createGain(); rg.gain.value = 1.2;
      g.connect(rg); rg.connect(this.reverb);
      o.start(t); o.stop(t + 1.8); mod.start(t); mod.stop(t + 1.8);
    }
  }
}

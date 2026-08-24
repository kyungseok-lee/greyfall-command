const rand = (a, b) => a + Math.random() * (b - a);

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.hbOn = false;
    this.nextHb = 0;
    this.ambOn = false;
    this.nextRumble = 0;
    this.ambSources = [];
    this.ambOut = null;
    this.stepAlt = false;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;

    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -14;
    this.comp.knee.value = 18;
    this.comp.ratio.value = 5;
    this.comp.attack.value = 0.004;
    this.comp.release.value = 0.2;
    this.master.connect(this.comp);
    this.comp.connect(ctx.destination);

    this.bus = ctx.createGain();
    this.bus.gain.value = 1;
    this.bus.connect(this.master);

    this.revIn = ctx.createGain();
    this.revIn.gain.value = 1;
    this.conv = ctx.createConvolver();
    this.conv.buffer = this._makeIR(0.42, 3.2);
    const revOut = ctx.createGain();
    revOut.gain.value = 0.7;
    this.revIn.connect(this.conv);
    this.conv.connect(revOut);
    revOut.connect(this.master);

    this.noiseBuf = this._makeNoise(1.2, 'white');
    this.brownBuf = this._makeNoise(2.5, 'brown');
  }

  _makeNoise(dur, type) {
    const ctx = this.ctx;
    const n = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      if (type === 'brown') {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      } else {
        d[i] = w;
      }
    }
    return buf;
  }

  _makeIR(dur, decay) {
    const ctx = this.ctx;
    const n = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < n; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 1.6) * Math.exp(-decay * (i / n));
      }
    }
    return buf;
  }

  _src(buf, rate = 1) {
    const s = this.ctx.createBufferSource();
    s.buffer = buf;
    s.playbackRate.value = rate;
    return s;
  }

  _noiseHit({ t, dur, type = 'bandpass', f0, f1 = null, q = 1, gain = 0.5, a = 0.002, rate = 1, wet = 0, brown = false, dest = null }) {
    const ctx = this.ctx;
    const s = this._src(brown ? this.brownBuf : this.noiseBuf, rate);
    const filt = ctx.createBiquadFilter();
    filt.type = type;
    filt.frequency.setValueAtTime(Math.max(20, f0), t);
    if (f1 !== null) filt.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    filt.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + a);
    g.gain.exponentialRampToValueAtTime(0.0008, t + a + dur);
    s.connect(filt);
    filt.connect(g);
    g.connect(dest || this.bus);
    if (wet > 0) {
      const w = ctx.createGain();
      w.gain.value = wet;
      g.connect(w);
      w.connect(this.revIn);
    }
    const maxOff = Math.max(0, s.buffer.duration - dur * Math.max(1, rate) - 0.1);
    s.start(t, maxOff > 0.1 ? rand(0, maxOff) : 0);
    s.stop(t + a + dur + 0.05);
  }

  _tone({ t, type = 'sine', f0, f1 = null, dur, gain, a = 0.001, wet = 0, curve = 'exp' }) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== null) o.frequency.exponentialRampToValueAtTime(Math.max(10, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + a);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g);
    g.connect(this.bus);
    if (wet > 0) {
      const w = ctx.createGain();
      w.gain.value = wet;
      g.connect(w);
      w.connect(this.revIn);
    }
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  _gunshot({ clickF, clickDur, clickG, bodyF0, bodyF1, bodyDur, bodyG, bodyQ = 0.9, subF0, subF1, subDur, subG, rate = 1, wet }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.001;
    const r = rand(0.96, 1.04);
    if (clickG > 0) {
      this._noiseHit({ t, dur: clickDur, type: 'highpass', f0: clickF, gain: clickG, a: 0.001, rate });
    }
    this._noiseHit({ t, dur: bodyDur * r, type: 'bandpass', f0: bodyF0 * r, f1: bodyF1, q: bodyQ, gain: bodyG, a: 0.002, rate: rate * r, wet });
    if (subG > 0) {
      this._tone({ t, type: 'sine', f0: subF0 * r, f1: subF1, dur: subDur, gain: subG, a: 0.003 });
    }
  }

  shootRifle() {
    this._gunshot({
      clickF: 3600, clickDur: 0.018, clickG: 0.45,
      bodyF0: 2400, bodyF1: 620, bodyDur: 0.095, bodyG: 0.85,
      subF0: 118, subF1: 52, subDur: 0.1, subG: 0.75,
      wet: 0.32
    });
  }

  shootSMG() {
    this._gunshot({
      clickF: 4300, clickDur: 0.014, clickG: 0.38,
      bodyF0: 2900, bodyF1: 1150, bodyDur: 0.07, bodyG: 0.68, bodyQ: 1.1,
      subF0: 150, subF1: 76, subDur: 0.07, subG: 0.52,
      wet: 0.22
    });
  }

  shootShotgun() {
    this._gunshot({
      clickF: 2600, clickDur: 0.02, clickG: 0.3,
      bodyF0: 1300, bodyF1: 320, bodyDur: 0.24, bodyG: 1.0, bodyQ: 0.5,
      subF0: 95, subF1: 38, subDur: 0.28, subG: 1.0,
      rate: 0.85, wet: 0.5
    });
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.016;
    this._noiseHit({ t, dur: 0.12, type: 'lowpass', f0: 900, f1: 300, gain: 0.5, a: 0.004, rate: 0.9, wet: 0.3 });
  }

  shootSniper() {
    this._gunshot({
      clickF: 2800, clickDur: 0.03, clickG: 0.85,
      bodyF0: 1150, bodyF1: 240, bodyDur: 0.32, bodyG: 0.9, bodyQ: 0.7,
      subF0: 82, subF1: 33, subDur: 0.42, subG: 0.95,
      rate: 0.92, wet: 0.65
    });
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.14;
    this._noiseHit({ t, dur: 0.5, type: 'lowpass', f0: 700, f1: 140, gain: 0.28, a: 0.01, rate: 0.75, wet: 0.7 });
  }

  dryFire() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.001;
    this._noiseHit({ t, dur: 0.012, type: 'highpass', f0: 4200, gain: 0.25, a: 0.001 });
    this._tone({ t, type: 'square', f0: 1900, f1: 1200, dur: 0.02, gain: 0.09 });
  }

  reloadClick(stage) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.001;
    const f = [1750, 2400, 1250][Math.max(0, Math.min(2, stage | 0))];
    this._noiseHit({ t, dur: stage === 2 ? 0.07 : 0.04, type: 'bandpass', f0: f, q: 5, gain: 0.34, a: 0.002 });
    this._tone({ t, type: 'square', f0: f * 0.55, f1: f * 0.4, dur: 0.03, gain: 0.13 });
    if (stage === 2) {
      this._noiseHit({ t: t + 0.05, dur: 0.09, type: 'bandpass', f0: 900, q: 2, gain: 0.2, a: 0.004 });
    }
  }

  enemyShot(dist) {
    if (!this.ctx) return;
    const v = Math.max(0.04, 0.62 / (1 + dist * 0.06));
    const t = this.ctx.currentTime + 0.001;
    this._noiseHit({ t, dur: 0.11, type: 'lowpass', f0: 1000, f1: 260, gain: v, a: 0.002, rate: rand(0.9, 1.05), wet: 0.25 * v });
    this._tone({ t, type: 'sine', f0: 92, f1: 48, dur: 0.08, gain: v * 0.65 });
  }

  impact(materialType) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.001;
    switch (materialType) {
      case 'metal': {
        const n = 2 + Math.floor(rand(0, 3));
        for (let i = 0; i < n; i++) {
          const f = rand(2300, 5400);
          this._tone({ t: t + i * rand(0.01, 0.04), type: 'sine', f0: f, f1: f * 0.94, dur: rand(0.05, 0.12), gain: rand(0.08, 0.16) });
        }
        this._noiseHit({ t, dur: 0.02, type: 'highpass', f0: 5000, gain: 0.1, a: 0.001 });
        break;
      }
      case 'sand':
        this._noiseHit({ t, dur: 0.07, type: 'lowpass', f0: 900, f1: 350, gain: 0.14, a: 0.004, brown: true });
        break;
      case 'wood':
        this._tone({ t, type: 'triangle', f0: 340, f1: 180, dur: 0.05, gain: 0.2 });
        this._noiseHit({ t, dur: 0.03, type: 'bandpass', f0: 1200, q: 1.5, gain: 0.14, a: 0.002 });
        break;
      default:
        this._noiseHit({ t, dur: 0.05, type: 'lowpass', f0: 520, f1: 200, gain: 0.22, a: 0.002, brown: true });
        this._noiseHit({ t, dur: 0.02, type: 'highpass', f0: 3200, gain: 0.06, a: 0.001 });
        break;
    }
  }

  hitmarker(kill) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.001;
    this._tone({ t, type: 'sine', f0: 1320, dur: 0.04, gain: kill ? 0.26 : 0.2 });
    this._tone({ t: t + 0.045, type: 'sine', f0: 1760, dur: 0.045, gain: 0.18 });
    if (kill) {
      this._tone({ t: t + 0.02, type: 'sine', f0: 165, f1: 88, dur: 0.14, gain: 0.4 });
      this._noiseHit({ t: t + 0.02, dur: 0.08, type: 'lowpass', f0: 320, gain: 0.24, a: 0.003, brown: true });
    }
  }

  explosion(dist) {
    if (!this.ctx) return;
    const v = Math.min(1, Math.max(0.08, 0.95 / (1 + dist * 0.045)));
    const t = this.ctx.currentTime + 0.001;
    this._noiseHit({ t, dur: 0.9, type: 'lowpass', f0: 520, f1: 60, gain: v, a: 0.004, rate: 0.6, brown: true, wet: 0.55 * v });
    this._tone({ t, type: 'sine', f0: 90, f1: 35, dur: 0.72, gain: v * 0.95, a: 0.005 });
    this._noiseHit({ t: t + 0.02, dur: 0.16, type: 'highpass', f0: 1100, gain: v * 0.28, a: 0.002 });
    this._noiseHit({ t: t + 0.26, dur: 1.5, type: 'lowpass', f0: 130, f1: 50, gain: v * 0.35, a: 0.15, rate: 0.5, brown: true, wet: 0.5 });
  }

  footstep(sprinting) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.001;
    this.stepAlt = !this.stepAlt;
    const f = rand(620, 940) * (this.stepAlt ? 1 : 0.92);
    this._noiseHit({
      t, dur: sprinting ? 0.07 : 0.05, type: 'bandpass',
      f0: f, q: 0.8, gain: sprinting ? 0.26 : 0.13, a: 0.003,
      rate: rand(0.9, 1.15), brown: true
    });
    this._noiseHit({ t, dur: 0.015, type: 'highpass', f0: 2600, gain: 0.04, a: 0.001 });
  }

  land() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.001;
    this._noiseHit({ t, dur: 0.13, type: 'lowpass', f0: 380, f1: 120, gain: 0.42, a: 0.004, brown: true });
    this._tone({ t, type: 'sine', f0: 78, f1: 40, dur: 0.13, gain: 0.35 });
  }

  hurt() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.001;
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(rand(130, 150), t);
    o.frequency.exponentialRampToValueAtTime(64, t + 0.2);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(520, t);
    lp.frequency.exponentialRampToValueAtTime(220, t + 0.22);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.3, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0008, t + 0.24);
    o.connect(lp); lp.connect(g); g.connect(this.bus);
    o.start(t); o.stop(t + 0.28);
    this._noiseHit({ t, dur: 0.16, type: 'lowpass', f0: 300, gain: 0.2, a: 0.01, brown: true });
  }

  heartbeat(on) {
    this.hbOn = !!on;
    if (on && this.ctx) this.nextHb = Math.min(this.nextHb, this.ctx.currentTime + 0.05);
  }

  waveHorn() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + 0.02;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 1.2;
    lp.frequency.setValueAtTime(240, t);
    lp.frequency.linearRampToValueAtTime(1050, t + 0.85);
    lp.frequency.linearRampToValueAtTime(320, t + 2.1);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.34, t + 0.75);
    g.gain.setValueAtTime(0.34, t + 1.25);
    g.gain.exponentialRampToValueAtTime(0.0008, t + 2.2);
    lp.connect(g); g.connect(this.bus);
    const w = ctx.createGain(); w.gain.value = 0.35;
    g.connect(w); w.connect(this.revIn);
    const detunes = [0, 6, -7];
    for (const base of [110, 164.8]) {
      for (const dt2 of detunes) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = base;
        o.detune.value = dt2;
        const og = ctx.createGain();
        og.gain.value = base > 130 ? 0.35 : 0.6;
        o.connect(og); og.connect(lp);
        o.start(t); o.stop(t + 2.3);
      }
    }
    this._noiseHit({ t, dur: 1.8, type: 'bandpass', f0: 500, q: 0.5, gain: 0.05, a: 0.5 });
  }

  uiClick() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.001;
    this._tone({ t, type: 'square', f0: 880, f1: 720, dur: 0.03, gain: 0.1 });
    this._noiseHit({ t, dur: 0.008, type: 'highpass', f0: 4000, gain: 0.05, a: 0.001 });
  }

  startAmbient() {
    if (!this.ctx || this.ambOn) return;
    const ctx = this.ctx;
    this.ambOn = true;
    const t = ctx.currentTime;
    const src = this._src(this.brownBuf, 0.5);
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 380;
    bp.Q.value = 0.55;
    const wg = ctx.createGain();
    wg.gain.setValueAtTime(0, t);
    wg.gain.linearRampToValueAtTime(0.14, t + 2);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 210;
    lfo.connect(lfoGain);
    lfoGain.connect(bp.frequency);
    const alfo = ctx.createOscillator();
    alfo.frequency.value = 0.045;
    const alfoGain = ctx.createGain();
    alfoGain.gain.value = 0.05;
    alfo.connect(alfoGain);
    alfoGain.connect(wg.gain);
    src.connect(bp); bp.connect(wg); wg.connect(this.bus);
    src.start(t); lfo.start(t); alfo.start(t);
    this.ambSources = [src, lfo, alfo];
    this.ambOut = wg;
    this.nextRumble = t + rand(5, 11);
  }

  stopAmbient() {
    if (!this.ctx || !this.ambOn) return;
    const t = this.ctx.currentTime;
    const { ambSources, ambOut } = this;
    ambOut.gain.cancelScheduledValues(t);
    ambOut.gain.setValueAtTime(ambOut.gain.value, t);
    ambOut.gain.linearRampToValueAtTime(0, t + 0.3);
    for (const s of ambSources) {
      try { s.stop(t + 0.35); } catch (e) { void e; }
    }
    setTimeout(() => {
      for (const n of [...ambSources, ambOut]) {
        try { n.disconnect(); } catch (e) { void e; }
      }
    }, 450);
    this.ambSources = [];
    this.ambOut = null;
    this.ambOn = false;
  }

  update(dt) {
    void dt;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (this.hbOn) {
      while (this.nextHb < t + 0.18) {
        const base = Math.max(t + 0.01, this.nextHb);
        this._tone({ t: base, type: 'sine', f0: 58, f1: 40, dur: 0.1, gain: 0.42, a: 0.008 });
        this._tone({ t: base + 0.3, type: 'sine', f0: 47, f1: 34, dur: 0.08, gain: 0.28, a: 0.008 });
        this.nextHb = base + 1.0;
      }
    } else {
      this.nextHb = t;
    }
    if (this.ambOn && t >= this.nextRumble) {
      this._noiseHit({ t: t + 0.05, dur: 2.6, type: 'lowpass', f0: 110, f1: 55, gain: 0.1, a: 1.2, rate: 0.4, brown: true, wet: 0.4 });
      this.nextRumble = t + rand(9, 22);
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  suspend() {
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend();
  }

  dispose() {
    this.stopAmbient();
    if (this.ctx) {
      const c = this.ctx;
      this.ctx = null;
      c.close().catch(() => {});
    }
  }
}

import './style.css';

const $ = (id) => document.getElementById(id);
const clamp01 = (v) => Math.max(0, Math.min(1, v));

const COMPASS_LABELS = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
const PX_PER_DEG = 4;
const CYCLE = 360 * PX_PER_DEG;

export class HUD {
  constructor(root = document.getElementById('hud')) {
    this.root = root;
    this.el = {
      crosshair: $('crosshair'),
      hitmarker: $('hitmarker'),
      scope: $('scope-overlay'),
      healthFill: $('health-fill'),
      healthNum: $('health-num'),
      healthWrap: $('health-wrap'),
      ammoMag: $('ammo-mag'),
      ammoReserve: $('ammo-reserve'),
      weaponName: $('weapon-name'),
      ammoWrap: $('ammo-wrap'),
      reloadBar: $('reload-bar'),
      reloadWrap: $('reload-wrap'),
      minimap: $('minimap'),
      compassWrap: $('compass-wrap'),
      compassStrip: $('compass-strip'),
      waveNum: $('wave-num'),
      enemiesLeft: $('enemies-left'),
      scoreNum: $('score-num'),
      killfeed: $('killfeed'),
      banner: $('banner'),
      bannerMain: $('banner-main'),
      bannerSub: $('banner-sub'),
      vignette: $('damage-vignette'),
      blood: $('blood-overlay')
    };
    this.mmCtx = this.el.minimap.getContext('2d');

    this._buildCompass();

    this.ddis = [];
    for (let i = 0; i < 3; i++) {
      const w = document.createElement('div');
      w.className = 'ddi';
      const arc = document.createElement('div');
      arc.className = 'ddi-arc';
      w.appendChild(arc);
      root.appendChild(w);
      this.ddis.push({ el: w, t: 0 });
    }

    this.vig = 0;
    this.hmT = 0;
    this.bannerPhase = 'hidden';
    this.bannerT = 0;
    this.bannerHold = 0;
    this.feedEntries = [];
    this.lowHp = false;

    this.mmDirty = true;
    this.mmData = null;
    this.mmSweep = 0;

    window.addEventListener('resize', () => { this._wrapW = 0; });

    this.reset();
  }

  _buildCompass() {
    const strip = this.el.compassStrip;
    strip.innerHTML = '';
    const frag = document.createDocumentFragment();
    for (let cyc = -1; cyc <= 2; cyc++) {
      for (let deg = 0; deg < 360; deg += 15) {
        const x = (cyc * 360 + deg) * PX_PER_DEG;
        const tick = document.createElement('span');
        tick.className = 'c-tick' + (deg % 45 === 0 ? ' major' : '');
        tick.style.left = x + 'px';
        frag.appendChild(tick);
        if (deg % 45 === 0) {
          const lab = document.createElement('span');
          lab.className = 'c-label' + (deg % 90 === 0 ? '' : ' minor');
          lab.textContent = COMPASS_LABELS[deg];
          lab.style.left = x + 'px';
          frag.appendChild(lab);
        }
      }
    }
    strip.appendChild(frag);
  }

  setHealth(hp, max) {
    const pct = clamp01(hp / max) * 100;
    this.el.healthFill.style.width = pct + '%';
    this.el.healthNum.textContent = String(Math.ceil(Math.max(0, hp)));
    const wrap = this.el.healthWrap;
    wrap.classList.toggle('crit', pct <= 25);
    wrap.classList.toggle('mid', pct > 25 && pct <= 55);
  }

  setAmmo(mag, reserve) {
    this.el.ammoMag.textContent = String(mag);
    this.el.ammoReserve.textContent = '/ ' + reserve;
    const wrap = this.el.ammoWrap;
    wrap.classList.toggle('empty', mag <= 0);
    wrap.classList.toggle('low', mag > 0 && mag <= 8);
  }

  setWeapon(name) {
    this.el.weaponName.textContent = name;
    this.el.ammoWrap.classList.remove('swap');
    void this.el.ammoWrap.offsetWidth;
    this.el.ammoWrap.classList.add('swap');
  }

  setReload(p) {
    const on = p !== null && p !== undefined;
    this.el.reloadWrap.classList.toggle('active', on);
    if (on) this.el.reloadBar.style.width = clamp01(p) * 100 + '%';
  }

  setWave(w) {
    this.el.waveNum.textContent = String(w);
  }

  setEnemiesLeft(n) {
    this.el.enemiesLeft.textContent = String(n);
  }

  setScore(s) {
    this.el.scoreNum.textContent = String(s);
    this.el.scoreNum.classList.remove('pop');
    void this.el.scoreNum.offsetWidth;
    this.el.scoreNum.classList.add('pop');
  }

  killfeed(text, headshot) {
    const li = document.createElement('li');
    li.className = 'kf' + (headshot ? ' head' : '');
    const name = document.createElement('span');
    name.textContent = text;
    li.appendChild(name);
    if (headshot) {
      const em = document.createElement('em');
      em.textContent = 'HEADSHOT';
      li.appendChild(em);
    }
    const feed = this.el.killfeed;
    feed.appendChild(li);
    while (feed.children.length > 5) {
      const first = feed.firstChild;
      feed.removeChild(first);
      const idx = this.feedEntries.findIndex((e) => e.el === first);
      if (idx >= 0) this.feedEntries.splice(idx, 1);
    }
    requestAnimationFrame(() => li.classList.add('in'));
    this.feedEntries.push({ el: li, age: 0 });
  }

  hitmarker(kill) {
    this.el.hitmarker.classList.toggle('kill', !!kill);
    this.hmT = 1;
  }

  damageFrom(angleRad) {
    let best = this.ddis[0];
    for (const d of this.ddis) if (d.t <= best.t) best = d;
    best.t = 1;
    best.el.style.transform = `rotate(${angleRad}rad)`;
    best.el.style.opacity = '0.95';
  }

  flashDamage(intensity01) {
    this.vig = clamp01(this.vig + intensity01);
  }

  crosshairSpread(px) {
    this.el.crosshair.style.setProperty('--spread', px + 'px');
  }

  showCrosshair(b) {
    this.el.crosshair.classList.toggle('hidden', !b);
  }

  scopeOverlay(b) {
    this.el.scope.classList.toggle('active', !!b);
  }

  banner(main, sub, ms = 2200) {
    this.el.bannerMain.textContent = main;
    this.el.bannerSub.textContent = sub || '';
    this.bannerPhase = 'in';
    this.bannerT = 0;
    this.bannerHold = ms / 1000;
  }

  compass(yawRad) {
    if (!this._wrapW) this._wrapW = this.el.compassWrap.clientWidth || 340;
    const hdgDeg = ((-yawRad * 180 / Math.PI) % 360 + 360) % 360;
    const base = this._wrapW / 2 - (hdgDeg + 360) * PX_PER_DEG;
    this.el.compassStrip.style.transform = `translateX(${base}px)`;
  }

  minimap(playerPos, playerYaw, enemies, rects) {
    this.mmData = { px: playerPos.x, pz: playerPos.z, yaw: playerYaw, enemies, rects };
    this.mmDirty = true;
  }

  lowHealth(on) {
    this.lowHp = !!on;
    this.root.classList.toggle('low-hp', !!on);
  }

  reset() {
    this.vig = 0;
    this.hmT = 0;
    this.bannerPhase = 'hidden';
    this.bannerT = 0;
    this.el.banner.style.opacity = '0';
    this.el.banner.style.transform = 'translate(-50%, -12px)';
    for (const d of this.ddis) { d.t = 0; d.el.style.opacity = '0'; }
    this.el.vignette.style.opacity = '0';
    this.el.blood.style.opacity = '0';
    this.el.hitmarker.style.opacity = '0';
    this.el.killfeed.innerHTML = '';
    this.feedEntries.length = 0;
    this.setHealth(100, 100);
    this.setAmmo(30, 120);
    this.setWave(1);
    this.setEnemiesLeft(0);
    this.el.scoreNum.textContent = '0';
    this.setReload(null);
    this.showCrosshair(true);
    this.scopeOverlay(false);
    this.lowHealth(false);
    this.crosshairSpread(10);
    this.mmDirty = true;
  }

  update(dt) {
    if (this.vig > 0.001) {
      this.vig = Math.max(0, this.vig - dt * 1.7);
      const eased = this.vig * this.vig * (3 - 2 * this.vig);
      this.el.vignette.style.opacity = eased.toFixed(3);
      this.el.blood.style.opacity = (eased * 0.9).toFixed(3);
    } else if (this.el.vignette.style.opacity !== '0') {
      this.vig = 0;
      this.el.vignette.style.opacity = '0';
      this.el.blood.style.opacity = '0';
    }

    if (this.hmT > 0) {
      this.hmT = Math.max(0, this.hmT - dt * 3.4);
      const u = 1 - this.hmT;
      this.el.hitmarker.style.opacity = (this.hmT * this.hmT).toFixed(3);
      this.el.hitmarker.style.transform = `translate(-50%, -50%) scale(${(0.85 + u * 0.35).toFixed(3)})`;
    } else if (this.el.hitmarker.style.opacity !== '0') {
      this.el.hitmarker.style.opacity = '0';
    }

    if (this.bannerPhase !== 'hidden') {
      this.bannerT += dt;
      if (this.bannerPhase === 'in') {
        const u = clamp01(this.bannerT / 0.28);
        this.el.banner.style.opacity = (u * u).toFixed(3);
        this.el.banner.style.transform = `translate(-50%, ${((1 - u) * -14).toFixed(1)}px)`;
        if (u >= 1) {
          this.bannerPhase = 'hold';
          this.bannerT = 0;
        }
      } else if (this.bannerPhase === 'hold') {
        if (this.bannerT >= this.bannerHold) {
          this.bannerPhase = 'out';
          this.bannerT = 0;
        }
      } else if (this.bannerPhase === 'out') {
        const u = clamp01(this.bannerT / 0.45);
        this.el.banner.style.opacity = (1 - u).toFixed(3);
        this.el.banner.style.transform = `translate(-50%, ${(u * 10).toFixed(1)}px)`;
        if (u >= 1) this.bannerPhase = 'hidden';
      }
    }

    for (const d of this.ddis) {
      if (d.t > 0) {
        d.t = Math.max(0, d.t - dt * 1.3);
        d.el.style.opacity = (d.t * 0.95).toFixed(3);
      }
    }

    const feed = this.feedEntries;
    for (let i = feed.length - 1; i >= 0; i--) {
      const e = feed[i];
      e.age += dt;
      if (e.age > 3.6 && !e.el.classList.contains('out')) e.el.classList.add('out');
      if (e.age > 4.05) {
        e.el.remove();
        feed.splice(i, 1);
      }
    }

    if (this.mmDirty && this.mmData) {
      this.mmDirty = false;
      this._drawMinimap(this.mmData);
    }
  }

  _drawMinimap(d) {
    const ctx = this.mmCtx;
    const S = 200;
    const c = S / 2;
    const R = c - 4;
    const rangeM = 46;
    const scale = R / rangeM;
    const cosY = Math.cos(d.yaw);
    const sinY = Math.sin(d.yaw);

    ctx.clearRect(0, 0, S, S);
    ctx.save();
    ctx.beginPath();
    ctx.arc(c, c, c - 1, 0, Math.PI * 2);
    ctx.clip();

    ctx.fillStyle = 'rgba(10,13,10,0.62)';
    ctx.fillRect(0, 0, S, S);

    ctx.strokeStyle = 'rgba(255,184,77,0.09)';
    ctx.lineWidth = 1;
    for (const rr of [R / 3, (R * 2) / 3]) {
      ctx.beginPath();
      ctx.arc(c, c, rr, 0, Math.PI * 2);
      ctx.stroke();
    }

    this.mmSweep += 0.02;
    const sweepA = this.mmSweep % (Math.PI * 2);
    ctx.save();
    ctx.translate(c, c);
    for (let i = 0; i < 14; i++) {
      const a = sweepA - i * 0.03;
      ctx.strokeStyle = `rgba(255,184,77,${(0.22 * (1 - i / 14)).toFixed(3)})`;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.sin(a) * R, -Math.cos(a) * R);
      ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.translate(c, c);
    ctx.rotate(d.yaw);
    ctx.scale(scale, scale);
    ctx.lineWidth = 1.4 / scale;
    for (const r of d.rects || []) {
      ctx.save();
      ctx.translate(r.x - d.px, r.z - d.pz);
      if (r.rot) ctx.rotate(r.rot);
      ctx.fillStyle = 'rgba(196,200,192,0.26)';
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(-r.w / 2, -r.d / 2, r.w, r.d);
      ctx.strokeRect(-r.w / 2, -r.d / 2, r.w, r.d);
      ctx.restore();
    }
    ctx.restore();

    for (const e of d.enemies || []) {
      const rx = e.x - d.px;
      const rz = e.z - d.pz;
      let sx = rx * cosY - rz * sinY;
      let sy = rx * sinY + rz * cosY;
      sx *= scale;
      sy *= scale;
      const dist = Math.hypot(sx, sy);
      if (dist > R - 5) {
        sx = (sx / dist) * (R - 5);
        sy = (sy / dist) * (R - 5);
      }
      ctx.fillStyle = dist > R - 5 ? 'rgba(255,70,60,0.55)' : '#ff4642';
      ctx.beginPath();
      ctx.arc(c + sx, c + sy, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#ffb84d';
    ctx.beginPath();
    ctx.moveTo(c, c - 7);
    ctx.lineTo(c + 5.5, c + 6);
    ctx.lineTo(c, c + 3.5);
    ctx.lineTo(c - 5.5, c + 6);
    ctx.closePath();
    ctx.fill();

    const nx = c + Math.sin(d.yaw) * (R - 7);
    const ny = c - Math.cos(d.yaw) * (R - 7);
    ctx.fillStyle = 'rgba(255,184,77,0.75)';
    ctx.font = '700 11px Rajdhani, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', nx, ny);

    ctx.restore();

    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(c, c, c - 1.5, 0, Math.PI * 2);
    ctx.stroke();
  }
}

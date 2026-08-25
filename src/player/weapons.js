import * as THREE from 'three';
import { CONFIG } from '../core/contracts.js';
import { buildWeaponModels, disposeWeaponModels } from './viewmodel.js';

const W = CONFIG.WEAPONS;
const ORDER = ['ar', 'smg', 'shotgun', 'sniper'];
const DIGIT_KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4'];
const SHOOT_FN = { ar: 'Rifle', smg: 'SMG', shotgun: 'Shotgun', sniper: 'Sniper' };
const BASE_FOV = 75;
const SPRINT_FOV = 6;
const ADS_TIME = 0.16;
const SWITCH_LOWER = 0.12;
const SWITCH_RAISE = 0.15;
const BLOOM_DECAY = 7.5;
const BLOOM_MAX = 4;
const RECOIL_PITCH = 0.0125;
const RECOIL_YAW = 0.006;

const T_A = new THREE.Vector3();
const T_ORI = new THREE.Vector3();
const T_FWD = new THREE.Vector3();
const T_RT = new THREE.Vector3();
const T_UP = new THREE.Vector3();
const T_MUZ = new THREE.Vector3();
const T_DIR = new THREE.Vector3();
const T_END = new THREE.Vector3();

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (t) => t * t * (3 - 2 * t);

export class WeaponSystem {
  constructor({ camera, input }) {
    this.camera = camera;
    this.input = input;
    this.player = null;
    this.combat = null;

    this.models = buildWeaponModels();
    this.root = new THREE.Group();
    for (const id of ORDER) {
      const m = this.models[id];
      m.group.visible = false;
      this.root.add(m.group);
    }
    camera.add(this.root);

    this.onAmmoChange = null;
    this.onReloadProgress = null;
    this.onWeaponSwitched = null;
    this.onAdsChanged = null;

    this.currentId = 'ar';
    this.state = {};
    for (const id of ORDER) {
      const w = W[id];
      this.state[id] = { mag: w.magSize, reserve: w.reserveMax, bloom: 0 };
    }
    this.models.ar.group.visible = true;

    this._adsT = 0;
    this._wasAds = false;
    this.fireTimer = 0;
    this.shotCounter = 0;
    this.triggerHeld = false;
    this.shotLocked = false;
    this.elapsed = 0;
    this.recoilPitch = 0;
    this.recoilYaw = 0;
    this.kickPitch = 0;
    this.kickBack = 0;
    this.swayX = 0;
    this.swayY = 0;
    this.reload = { active: false, t: 0, dur: 1, stages: [false, false, false] };
    this.switch = { active: false, phase: 0, t: 0, nextId: null };
    this.prevKeys = new Set();
    this._lastFov = -1;
  }

  setCombat(combat) {
    this.combat = combat;
  }

  setAdsChanged(cb) {
    this.onAdsChanged = cb;
  }

  get ammo() {
    const s = this.state[this.currentId];
    return { mag: s.mag, reserve: s.reserve };
  }

  get adsT() {
    return this._adsT;
  }

  get isAds() {
    return this._adsT >= 0.85;
  }

  get viewModelVisible() {
    return this.models[this.currentId].group.visible;
  }

  getCrosshairPx() {
    const s = this.currentSpread();
    const h = typeof window !== 'undefined' ? window.innerHeight : 1080;
    return Math.round((s * h) / Math.max(this.camera.fov, 1));
  }

  currentSpread() {
    const w = W[this.currentId];
    return (w.spreadHip + (w.spreadAds - w.spreadHip) * smooth(this._adsT)) + this.state[this.currentId].bloom * (1 - this._adsT * 0.7);
  }

  equip(id) {
    if (!W[id] || id === this.currentId) return;
    if (this.switch.active) {
      if (this.switch.phase === 0) this.switch.nextId = id;
      else {
        this.swapModel(id);
        this.switch.nextId = id;
        this.switch.t = 0;
      }
      return;
    }
    this.cancelReload();
    this.switch.active = true;
    this.switch.phase = 0;
    this.switch.t = 0;
    this.switch.nextId = id;
  }

  equipNext(dir) {
    const i = ORDER.indexOf(this.currentId);
    this.equip(ORDER[(i + dir + ORDER.length) % ORDER.length]);
  }

  swapModel(id) {
    this.models[this.currentId].group.visible = false;
    this.currentId = id;
    this.models[id].group.visible = !(W[id].scope && this._adsT > 0.85);
    this.onWeaponSwitched?.(id, W[id].name);
    const a = this.ammo;
    this.onAmmoChange?.(a.mag, a.reserve);
  }

  tryReload() {
    if (this.reload.active || this.switch.active) return;
    const s = this.state[this.currentId];
    const w = W[this.currentId];
    if (s.mag >= w.magSize || s.reserve <= 0) return;
    this.reload.active = true;
    this.reload.t = 0;
    this.reload.dur = w.reloadTime;
    this.reload.stages[0] = false;
    this.reload.stages[1] = false;
    this.reload.stages[2] = false;
    this.onReloadProgress?.(0);
  }

  cancelReload() {
    if (!this.reload.active) return;
    this.reload.active = false;
    const m = this.models[this.currentId];
    if (m.mag) {
      m.mag.position.y = m.magY;
      m.mag.rotation.x = 0;
    }
    this.onReloadProgress?.(null);
  }

  finishReload() {
    const s = this.state[this.currentId];
    const w = W[this.currentId];
    const take = Math.min(w.magSize - s.mag, s.reserve);
    s.mag += take;
    s.reserve -= take;
    this.reload.active = false;
    this.onAmmoChange?.(s.mag, s.reserve);
    this.onReloadProgress?.(null);
  }

  update(dt) {
    this.elapsed += dt;
    const pl = this.player;
    const dead = pl ? !pl.alive : false;
    const k = this.input.keys;
    const prev = this.prevKeys;

    if (!dead) {
      for (let i = 0; i < ORDER.length; i++) {
        if (k.has(DIGIT_KEYS[i]) && !prev.has(DIGIT_KEYS[i])) this.equip(ORDER[i]);
      }
      if (k.has('KeyR') && !prev.has('KeyR')) this.tryReload();
      let wheel = this.input.consumeWheel();
      while (wheel > 0) {
        this.equipNext(1);
        wheel--;
      }
      while (wheel < 0) {
        this.equipNext(-1);
        wheel++;
      }
    } else {
      this.input.consumeWheel();
    }

    const trigger = !dead && this.input.buttons[0];
    const wantAds = !dead && !!this.input.buttons[2] && !this.switch.active && !this.reload.active;

    if (trigger && !this.triggerHeld) {
      const s = this.state[this.currentId];
      this.shotLocked = false;
      if (s.mag <= 0 && !this.reload.active && !this.switch.active) {
        this.combat?.audio?.dryFire?.();
        this.tryReload();
      }
      if (pl?.isSprinting) pl.blockSprint(0.35);
    } else if (!trigger) {
      this.shotLocked = false;
    }
    this.triggerHeld = trigger;

    let switching = false;
    let lowerK = 0;
    if (this.switch.active) {
      switching = true;
      if (this.switch.phase === 0) {
        this.switch.t += dt / SWITCH_LOWER;
        lowerK = Math.min(this.switch.t, 1);
        if (this.switch.t >= 1) {
          this.swapModel(this.switch.nextId);
          this.switch.phase = 1;
          this.switch.t = 0;
          lowerK = 1;
        }
      } else {
        this.switch.t += dt / SWITCH_RAISE;
        lowerK = 1 - Math.min(this.switch.t, 1);
        if (this.switch.t >= 1) {
          this.switch.active = false;
          lowerK = 0;
        }
      }
      lowerK = clamp(lowerK, 0, 1);
    }

    const sprintBlend = pl ? pl.sprintBlend : 0;
    const adsTarget = wantAds && !switching ? 1 : 0;
    this._adsT += clamp(adsTarget - this._adsT, -dt / ADS_TIME, dt / ADS_TIME);
    const adsE = smooth(this._adsT);

    const isAdsNow = this.isAds;
    if (isAdsNow !== this._wasAds) {
      this._wasAds = isAdsNow;
      this.onAdsChanged?.(isAdsNow);
    }

    this.fireTimer -= dt;
    const s = this.state[this.currentId];
    s.bloom = Math.max(0, s.bloom - BLOOM_DECAY * dt);

    let fired = false;
    const semiLocked = !W[this.currentId].auto && this.shotLocked;
    if (
      this.combat &&
      trigger &&
      !dead &&
      !switching &&
      !semiLocked &&
      !this.reload.active &&
      this.fireTimer <= 0 &&
      s.mag > 0 &&
      !(pl && pl.isSprinting)
    ) {
      this.shoot(s);
      if (!W[this.currentId].auto) this.shotLocked = true;
      fired = true;
    } else if (trigger && !dead && !switching && pl && pl.isSprinting) {
      pl.blockSprint(0.25);
    }


    if (this.reload.active) {
      this.reload.t += dt;
      const p = this.reload.t / this.reload.dur;
      if (p >= 0.10 && !this.reload.stages[0]) {
        this.reload.stages[0] = true;
        this.combat?.audio?.reloadClick(0);
      }
      if (p >= 0.55 && !this.reload.stages[1]) {
        this.reload.stages[1] = true;
        this.combat?.audio?.reloadClick(1);
      }
      if (p >= 0.90 && !this.reload.stages[2]) {
        this.reload.stages[2] = true;
        this.combat?.audio?.reloadClick(2);
      }
      if (p >= 1) this.finishReload();
      else this.onReloadProgress?.(p);
    }

    const rec = Math.min(1, W[this.currentId].recoilRecover * dt);
    this.recoilPitch -= this.recoilPitch * rec;
    this.recoilYaw -= this.recoilYaw * rec * 1.4;
    this.kickPitch -= this.kickPitch * rec * 1.15;
    this.kickBack -= this.kickBack * rec * 1.15;

    const lvx = pl ? pl.lookVelPitch : 0;
    const lvy = pl ? pl.lookVelYaw : 0;
    const swayK = Math.min(1, 10 * dt);
    this.swayY += (clamp(-lvy * 0.02, -0.05, 0.05) - this.swayY) * swayK;
    this.swayX += (clamp(-lvx * 0.016, -0.04, 0.04) - this.swayX) * swayK;

    this.camera.rotation.x += this.recoilPitch;
    this.camera.rotation.y += this.recoilYaw;

    const fov = BASE_FOV + sprintBlend * SPRINT_FOV;
    const targetFov = fov + (W[this.currentId].adsFov - fov) * adsE;
    if (Math.abs(targetFov - this._lastFov) > 0.01) {
      this._lastFov = targetFov;
      this.camera.fov = targetFov;
      this.camera.updateProjectionMatrix();
    }

    this.composeViewmodel(dt, adsE, sprintBlend, lowerK);

    if (fired) {
      this.camera.updateMatrixWorld(true);
      this.emitShotEffects();
    }

    prev.clear();
    for (const c of k) prev.add(c);
  }

  shoot(s) {
    this.combat?.onShot?.();
    const w = W[this.currentId];
    s.mag--;
    s.bloom = Math.min(BLOOM_MAX, s.bloom + w.bloomPerShot);
    this.fireTimer = 60 / w.rpm;
    this.onAmmoChange?.(s.mag, s.reserve);
    this.player?.blockSprint(0.3);
  }

  emitShotEffects() {
    const c = this.combat;
    if (!c) return;
    const w = W[this.currentId];
    const cam = this.camera;
    const e = cam.matrixWorld.elements;
    T_RT.set(e[0], e[1], e[2]).normalize();
    T_UP.set(e[4], e[5], e[6]).normalize();
    T_FWD.set(-e[8], -e[9], -e[10]).normalize();
    const origin = cam.getWorldPosition(T_ORI);
    const muzzle = this.models[this.currentId].muzzle.getWorldPosition(T_MUZ);

    c.fx.muzzleFlash(muzzle, T_FWD);
    c.audio?.[SHOOT_FN[this.currentId]]?.();

    const spreadRad = this.currentSpread() * Math.PI / 180;
    for (let i = 0; i < w.pellets; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = spreadRad * Math.sqrt(Math.random()) * (0.55 + Math.random() * 0.45);
      const dir = T_DIR.copy(T_FWD).addScaledVector(T_RT, Math.cos(a) * r).addScaledVector(T_UP, Math.sin(a) * r).normalize();
      const hit = c.raycast(origin, dir, w.range);
      let end;
      if (hit) {
        end = T_END.copy(hit.point);
        if (hit.type === 'enemy' && hit.enemy) {
          c.damageEnemy(hit.enemy, w.damage, !!hit.isHead, hit.point, dir);
        } else if (hit.type === 'barrel') {
          const barrel = hit.barrelMesh || hit.barrel || hit.object || hit.mesh;
          if (barrel) c.damageBarrel(barrel, w.damage, hit.point);
          else c.fx.impact(hit.point, hit.normal || T_FWD, hit.materialType || 'metal');
        } else {
          c.fx.impact(hit.point, hit.normal || T_FWD, hit.materialType || 'concrete');
        }
      } else {
        end = T_END.copy(origin).addScaledVector(dir, w.range);
      }
      this.shotCounter++;
      if (this.shotCounter % w.tracerEvery === 0) c.fx.tracer(muzzle, end);
    }

    const eject = this.models[this.currentId].eject.getWorldPosition(T_A);
    c.fx.shellCasing(eject, T_RT);

    const kick = w.recoilKick;
    this.recoilPitch += kick * RECOIL_PITCH * (0.85 + Math.random() * 0.3);
    this.recoilYaw += (Math.random() - 0.5) * 2 * kick * RECOIL_YAW;
    this.kickPitch += kick * 0.055;
    this.kickBack += kick * 0.024;
    this.player?.addShake(clamp(0.03 + kick * 0.028, 0, 0.16));
  }

  composeViewmodel(dt, adsE, sprintBlend, lowerK) {
    const m = this.models[this.currentId];
    const g = m.group;
    const w = W[this.currentId];
    const pl = this.player;
    const scopeHide = !!w.scope && this._adsT > 0.85;
    g.visible = !scopeHide;

    const hip = HIP_POSES[this.currentId];
    const ads = ADS_POSES[this.currentId];
    let px = hip.x + (ads.x - hip.x) * adsE;
    let py = hip.y + (ads.y - hip.y) * adsE;
    let pz = hip.z + (ads.z - hip.z) * adsE;

    const sb = sprintBlend * (1 - adsE);
    let rx = 0;
    let ry = 0;
    let rz = 0;
    px += -0.04 * sb;
    py += -0.06 * sb;
    pz += 0.07 * sb;
    ry += 0.5 * sb;
    rx += 0.18 * sb;
    rz += 0.22 * sb;

    py -= 0.28 * lowerK;
    rx += 0.75 * lowerK;
    rz += 0.15 * lowerK;

    const amp = (pl ? pl.moveAmt : 0) * (1 - 0.85 * adsE);
    const phase = pl ? pl.bobPhase : 0;
    const bobScale = 1 + sb * 0.8;
    px += Math.cos(phase) * 0.011 * amp * bobScale;
    py += Math.sin(phase * 2) * 0.008 * amp * bobScale;
    rz += Math.cos(phase) * 0.008 * amp * bobScale;

    const br = 1 - adsE;
    py += Math.sin(this.elapsed * 1.45) * 0.0016 * br;
    rx += Math.sin(this.elapsed * 1.1 + 1.2) * 0.0022 * br;
    rz += Math.sin(this.elapsed * 0.85 + 0.6) * 0.0026 * br;

    const sw = 1 - 0.78 * adsE;
    ry += this.swayY * sw;
    rx += this.swayX * sw;
    px += this.swayY * 0.22 * sw;

    rx += this.kickPitch;
    pz += this.kickBack;
    py += this.kickPitch * 0.12;

    if (this.reload.active) {
      const p = clamp(this.reload.t / this.reload.dur, 0, 1);
      const env = Math.sin(Math.min(p * 1.25, 1) * Math.PI);
      rx += 0.42 * env;
      rz -= 0.38 * env;
      py -= 0.05 * env;
      if (m.mag) {
        const drop = smooth(clamp((p - 0.08) / 0.28, 0, 1)) - smooth(clamp((p - 0.56) / 0.3, 0, 1));
        m.mag.position.y = m.magY - 0.16 * drop;
        m.mag.rotation.x = -0.35 * drop;
      }
    } else if (m.mag) {
      m.mag.position.y += (m.magY - m.mag.position.y) * Math.min(1, 14 * dt);
      m.mag.rotation.x *= Math.max(0, 1 - 14 * dt);
    }

    g.position.set(px, py, pz);
    g.rotation.set(rx, ry, rz);
  }

  reset() {
    for (const id of ORDER) {
      const w = W[id];
      const s = this.state[id];
      s.mag = w.magSize;
      s.reserve = w.reserveMax;
      s.bloom = 0;
    }
    this.cancelReload();
    this.switch.active = false;
    this.switch.phase = 0;
    this.switch.t = 0;
    this.switch.nextId = null;
    this.models[this.currentId].group.visible = false;
    this.currentId = 'ar';
    this.models.ar.group.visible = true;
    for (const id of ORDER) {
      const m = this.models[id];
      if (m.mag) {
        m.mag.position.y = m.magY;
        m.mag.rotation.x = 0;
      }
    }
    this._adsT = 0;
    this._wasAds = false;
    this.fireTimer = 0;
    this.triggerHeld = false;
    this.recoilPitch = 0;
    this.recoilYaw = 0;
    this.kickPitch = 0;
    this.kickBack = 0;
    this.swayX = 0;
    this.swayY = 0;
    this.camera.fov = BASE_FOV;
    this.camera.updateProjectionMatrix();
    this._lastFov = BASE_FOV;
    const g = this.models.ar.group;
    g.position.copy(HIP_POSES.ar);
    g.rotation.set(0, 0, 0);
    this.onWeaponSwitched?.('ar', W.ar.name);
    this.onAmmoChange?.(this.state.ar.mag, this.state.ar.reserve);
    this.onReloadProgress?.(null);
    this.onAdsChanged?.(false);
  }

  dispose() {
    this.root.removeFromParent();
    disposeWeaponModels(this.models);
  }
}

const HIP_POSES = {
  ar: { x: 0.22, y: -0.235, z: -0.46 },
  smg: { x: 0.20, y: -0.215, z: -0.40 },
  shotgun: { x: 0.21, y: -0.24, z: -0.48 },
  sniper: { x: 0.23, y: -0.255, z: -0.52 }
};
const ADS_POSES = {
  ar: { x: 0, y: -0.106, z: -0.26 },
  smg: { x: 0, y: -0.096, z: -0.24 },
  shotgun: { x: 0, y: -0.078, z: -0.30 },
  sniper: { x: 0, y: -0.085, z: -0.34 }
};

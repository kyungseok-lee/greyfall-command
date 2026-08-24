import * as THREE from 'three';
import { CONFIG } from '../core/contracts.js';

const EC = CONFIG.ENEMY;
const WC = CONFIG.WAVE;
const EYE_H = 1.55;
const FALL_DUR = 0.9;
const FALL_ANG = 1.5;
const SINK_START = 2.8;
const SINK_RATE = 1.05;
const CORPSE_LIFE = 4;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const wrapPI = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const damp = (cur, tgt, rate, dt) => lerp(cur, tgt, 1 - Math.exp(-rate * dt));

function easeOutBounce(x) {
  const n1 = 7.5625, d1 = 2.75;
  if (x < 1 / d1) return n1 * x * x;
  if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75;
  if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375;
  return n1 * (x -= 2.625 / d1) * x + 0.984375;
}

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _v4 = new THREE.Vector3();
const _v5 = new THREE.Vector3();
const _v6 = new THREE.Vector3();
const _v7 = new THREE.Vector3();
const _v8 = new THREE.Vector3();
const _rcLOS = new THREE.Raycaster();
const _rcProbe = new THREE.Raycaster();
const _rcShot = new THREE.Raycaster();
const _hitsLOS = [];
const _hitsA = [];
const _hitsB = [];
const _hitsC = [];
const _hitsShot = [];
const _probeRes = [_hitsA, _hitsB, _hitsC];
const _probeDists = [0, 0, 0];
const _probeAngs = [0, 0.95, -0.95];

let ASSETS = null;

function buildAssets() {
  const g = {};
  const m = {};
  g.leg = new THREE.BoxGeometry(0.155, 0.82, 0.17);
  g.boot = new THREE.BoxGeometry(0.175, 0.115, 0.3);
  g.chest = new THREE.BoxGeometry(0.4, 0.56, 0.23);
  g.vest = new THREE.BoxGeometry(0.46, 0.42, 0.29);
  g.pouch = new THREE.BoxGeometry(0.12, 0.15, 0.06);
  g.backPanel = new THREE.BoxGeometry(0.3, 0.27, 0.08);
  g.pad = new THREE.BoxGeometry(0.17, 0.11, 0.21);
  g.belt = new THREE.BoxGeometry(0.43, 0.09, 0.27);
  g.head = new THREE.SphereGeometry(0.125, 10, 8);
  g.goggles = new THREE.BoxGeometry(0.195, 0.055, 0.03);
  g.helmet = new THREE.SphereGeometry(0.152, 12, 8, 0, Math.PI * 2, 0, 1.95);
  g.brim = new THREE.CylinderGeometry(0.158, 0.168, 0.03, 12, 1, true);
  g.visor = new THREE.BoxGeometry(0.14, 0.02, 0.07);
  g.upperArm = new THREE.BoxGeometry(0.095, 0.3, 0.095);
  g.foreArm = new THREE.BoxGeometry(0.08, 0.08, 0.3);
  g.fist = new THREE.BoxGeometry(0.085, 0.09, 0.1);
  g.receiver = new THREE.BoxGeometry(0.055, 0.1, 0.44);
  g.barrel = new THREE.CylinderGeometry(0.018, 0.018, 0.32, 8);
  g.handguard = new THREE.BoxGeometry(0.05, 0.062, 0.2);
  g.mag = new THREE.BoxGeometry(0.045, 0.17, 0.075);
  g.stock = new THREE.BoxGeometry(0.05, 0.095, 0.2);
  g.grip = new THREE.BoxGeometry(0.04, 0.1, 0.05);
  g.sight = new THREE.BoxGeometry(0.03, 0.05, 0.11);
  g.hbHead = new THREE.BoxGeometry(0.3, 0.36, 0.3);
  g.hbTorso = new THREE.BoxGeometry(0.56, 0.74, 0.4);
  g.hbLegs = new THREE.BoxGeometry(0.42, 1.02, 0.34);

  m.fatigue = new THREE.MeshStandardMaterial({ color: 0x8a7c54, roughness: 0.92, metalness: 0.02 });
  m.helmet = new THREE.MeshStandardMaterial({ color: 0x4a4f38, roughness: 0.8, metalness: 0.08 });
  m.balaclava = new THREE.MeshStandardMaterial({ color: 0x1d1f22, roughness: 0.95 });
  m.goggles = new THREE.MeshStandardMaterial({ color: 0x10151a, emissive: 0xff9a3d, emissiveIntensity: 0.55, roughness: 0.35 });
  m.vest = new THREE.MeshStandardMaterial({ color: 0x30332a, roughness: 0.88 });
  m.pouch = new THREE.MeshStandardMaterial({ color: 0x272a21, roughness: 0.9 });
  m.pad = new THREE.MeshStandardMaterial({ color: 0x3d4130, roughness: 0.85 });
  m.belt = new THREE.MeshStandardMaterial({ color: 0x24231d, roughness: 0.9 });
  m.boot = new THREE.MeshStandardMaterial({ color: 0x201f1b, roughness: 0.85 });
  m.gun = new THREE.MeshStandardMaterial({ color: 0x191b1d, roughness: 0.5, metalness: 0.6 });
  m.gunAccent = new THREE.MeshStandardMaterial({ color: 0x2e2a22, roughness: 0.8 });
  m.hitbox = new THREE.MeshBasicMaterial();
  return { g, m };
}

function getAssets() {
  if (!ASSETS) ASSETS = buildAssets();
  return ASSETS;
}

class Soldier {
  constructor(mgr, spawnPos, wave) {
    this.mgr = mgr;
    this.pos = new THREE.Vector3(spawnPos.x, 0, spawnPos.z);
    this.vel = new THREE.Vector3();
    this.wave = wave;
    this.speedMult = Math.min(1 + (wave - 1) * 0.02, 1.3);
    this.maxHealth = EC.health + Math.min((wave - 1) * 8, 60);
    this.health = this.maxHealth;
    this.accuracy = clamp(EC.baseAccuracy + wave * EC.accuracyPerWave, 0, EC.maxAccuracy);
    this.dead = false;
    this.removeMe = false;
    this.deathT = 0;
    this.sinkY = 0;
    this.age = 0;
    this.state = 'spawn';
    this.stateT = 0;
    this.hasLOS = false;
    this.losTimer = (mgr.soldiers.length * 0.017) % 0.15;
    this.distToPlayer = Infinity;
    this.rootYaw = Math.atan2(mgr.playerPos().x - this.pos.x, mgr.playerPos().z - this.pos.z);
    this.torsoYaw = 0;
    this.walkPhase = Math.random() * 6.28;
    this.ready = 0;
    this.hide = 0;
    this.peek = 0;
    this.recoil = 0;
    this.flinchT = 0;
    this.flinchLX = 0;
    this.flinchLZ = 0;
    this.lastDamaged = -99;
    this.exposure = 0;
    this.avoidMem = 0;
    this.avoidSide = 0;
    this.stuckT = 0;
    this.detourT = 0;
    this.detourDir = new THREE.Vector3();
    this.cover = null;
    this.coverStand = new THREE.Vector3();
    this.coverPerp = new THREE.Vector3();
    this.coverSide = Math.random() < 0.5 ? 1 : -1;
    this.coverSwapT = rand(4, 7);
    this.rhythm = 'hide';
    this.rhythmT = rand(0.4, 0.8);
    this.shotsLeft = 0;
    this.shotTimer = 0;
    this.relocTarget = new THREE.Vector3();
    this.fallDir = new THREE.Vector3(0, 0, 1);
    this.lostLOST = 0;

    this.buildBody();
    mgr.scene.add(this.group);
  }

  buildBody() {
    const A = getAssets();
    const g = A.g;
    this.matFatigue = A.m.fatigue.clone();
    this.matFatigue.color.offsetHSL(rand(-0.02, 0.02), rand(-0.07, 0.07), rand(-0.05, 0.05));
    const F = this.matFatigue;

    const grp = new THREE.Group();
    this.group = grp;
    const mesh = (geo, mat, parent) => {
      const ms = new THREE.Mesh(geo, mat);
      ms.castShadow = true;
      parent.add(ms);
      return ms;
    };

    this.torso = new THREE.Group();
    this.torso.position.y = 1.02;
    grp.add(this.torso);

    const chest = mesh(g.chest, F, this.torso); chest.position.y = 0.3;
    const belt = mesh(g.belt, A.m.belt, this.torso); belt.position.y = 0.005;
    const vest = mesh(g.vest, A.m.vest, this.torso); vest.position.y = 0.27;
    const pl = mesh(g.pouch, A.m.pouch, this.torso); pl.position.set(-0.11, 0.17, 0.155);
    const pr = mesh(g.pouch, A.m.pouch, this.torso); pr.position.set(0.11, 0.17, 0.155);
    const bp = mesh(g.backPanel, A.m.pouch, this.torso); bp.position.set(0, 0.29, -0.175);
    const padL = mesh(g.pad, A.m.pad, this.torso); padL.position.set(-0.28, 0.5, 0);
    const padR = mesh(g.pad, A.m.pad, this.torso); padR.position.set(0.28, 0.5, 0);

    this.head = new THREE.Group();
    this.head.position.y = 0.66;
    this.torso.add(this.head);
    const skull = mesh(g.head, A.m.balaclava, this.head); skull.scale.set(1, 1.15, 1.05); skull.position.y = 0.02;
    const goggles = mesh(g.goggles, A.m.goggles, this.head); goggles.position.set(0, 0.045, 0.108);
    const dome = mesh(g.helmet, A.m.helmet, this.head); dome.position.set(0, 0.062, -0.005);
    const brim = mesh(g.brim, A.m.helmet, this.head); brim.position.set(0, 0.048, 0.005);
    const visor = mesh(g.visor, A.m.helmet, this.head); visor.position.set(0, 0.052, 0.135);

    const mkArm = (sx, baseRot, elbRot) => {
      const piv = new THREE.Group();
      piv.position.set(sx, 0.5, 0);
      this.torso.add(piv);
      const up = mesh(g.upperArm, F, piv); up.position.y = -0.13;
      const elb = new THREE.Group();
      elb.position.y = -0.27;
      elb.rotation.x = elbRot;
      piv.add(elb);
      const fo = mesh(g.foreArm, F, elb); fo.position.z = 0.14;
      const fi = mesh(g.fist, A.m.balaclava, elb); fi.position.z = 0.3;
      piv.rotation.set(baseRot[0], baseRot[1], baseRot[2]);
      piv.userData.base = baseRot;
      return piv;
    };
    this.armR = mkArm(-0.255, [-1.12, 0.2, 0.06], -0.5);
    this.armL = mkArm(0.255, [-1.28, -0.42, -0.12], -0.68);

    this.rifle = new THREE.Group();
    this.rifle.position.set(-0.03, 0.37, 0.22);
    this.rifle.rotation.y = -0.04;
    this.torso.add(this.rifle);
    const rec = mesh(g.receiver, A.m.gun, this.rifle);
    const bar = mesh(g.barrel, A.m.gun, this.rifle); bar.rotation.x = Math.PI / 2; bar.position.set(0, 0.015, 0.38);
    const hg = mesh(g.handguard, A.m.gunAccent, this.rifle); hg.position.set(0, 0.005, 0.26);
    const mg = mesh(g.mag, A.m.gunAccent, this.rifle); mg.position.set(0, -0.115, 0.03); mg.rotation.x = 0.22;
    const st = mesh(g.stock, A.m.gunAccent, this.rifle); st.position.set(0, -0.015, -0.31);
    const gr = mesh(g.grip, A.m.gunAccent, this.rifle); gr.position.set(0, -0.095, -0.13); gr.rotation.x = 0.3;
    const si = mesh(g.sight, A.m.gun, this.rifle); si.position.set(0, 0.08, 0.04);
    this.gunTip = new THREE.Object3D();
    this.gunTip.position.set(0, 0.02, 0.55);
    this.rifle.add(this.gunTip);

    this.legL = new THREE.Group();
    this.legL.position.set(-0.115, 0.96, 0);
    grp.add(this.legL);
    this.legR = new THREE.Group();
    this.legR.position.set(0.115, 0.96, 0);
    grp.add(this.legR);
    for (const leg of [this.legL, this.legR]) {
      const th = mesh(g.leg, F, leg); th.position.y = -0.41;
      const bt = mesh(g.boot, A.m.boot, leg); bt.position.set(0, -0.865, 0.045);
    }

    this.hitboxes = [];
    const hbDefs = [
      [g.hbHead, this.head, _v1.set(0, 0.03, 0), true],
      [g.hbTorso, this.torso, _v1.set(0, 0.28, 0), false],
      [g.hbLegs, grp, _v1.set(0, 0.5, 0), false]
    ];
    for (const [geo, anchor, off, isHead] of hbDefs) {
      const anc = new THREE.Object3D();
      anc.position.copy(off);
      anchor.add(anc);
      const hb = new THREE.Mesh(geo, getAssets().m.hitbox);
      hb.visible = false;
      hb.userData.enemyRef = this;
      if (isHead) hb.userData.isHead = true;
      this.mgr.hitGroup.add(hb);
      this.hitboxes.push({ hb, anc });
    }

    grp.position.copy(this.pos);
    grp.rotation.y = this.rootYaw;
  }

  playerPos() {
    return this.mgr.player.position;
  }

  checkLOS() {
    const w = this.mgr.world;
    const p = this.mgr.player;
    if (!w || !w.raycastGroup || !p) return false;
    _v1.set(this.pos.x, this.pos.y + EYE_H, this.pos.z);
    _v2.copy(p.position);
    const d = _v1.distanceTo(_v2);
    if (d > EC.fireRange + 4) return false;
    if (d < 0.7) return true;
    _v3.subVectors(_v2, _v1).normalize();
    _rcLOS.set(_v1, _v3);
    _rcLOS.near = 0.15;
    _rcLOS.far = d - 0.35;
    _hitsLOS.length = 0;
    _rcLOS.intersectObject(w.raycastGroup, true, _hitsLOS);
    return _hitsLOS.length === 0;
  }

  probeSteer(outDir) {
    const w = this.mgr.world;
    if (!w || !w.raycastGroup) return;
    _v1.set(this.pos.x, this.pos.y + 1.25, this.pos.z);
    const baseYaw = Math.atan2(outDir.x, outDir.z);
    const PROBE = 2.4;
    for (let i = 0; i < 3; i++) {
      _v2.set(Math.sin(baseYaw + _probeAngs[i]), 0, Math.cos(baseYaw + _probeAngs[i]));
      _rcProbe.set(_v1, _v2);
      _rcProbe.near = 0.15;
      _rcProbe.far = PROBE;
      _probeRes[i].length = 0;
      _rcProbe.intersectObject(w.raycastGroup, true, _probeRes[i]);
      _probeDists[i] = _probeRes[i].length ? _probeRes[i][0].distance : PROBE;
    }
    if (_probeDists[0] < 1.5) {
      this.avoidSide = _probeDists[1] > _probeDists[2] ? 1 : -1;
      this.avoidMem = 0.45;
    }
    if (this.avoidMem > 0) {
      const str = clamp((1.6 - _probeDists[0]) / 1.2, 0, 1) * 1.05 * this.avoidSide;
      const yaw = baseYaw + str;
      const len = outDir.length();
      outDir.set(Math.sin(yaw) * len, 0, Math.cos(yaw) * len);
    }
  }

  resolveCollisions(p) {
    const cols = this.mgr.world && this.mgr.world.colliders;
    if (!cols) return;
    const r = 0.38;
    for (let i = 0; i < cols.length; i++) {
      const b = cols[i];
      if (b.max.y < 0.3 || b.min.y > 1.5) continue;
      const cx = clamp(p.x, b.min.x, b.max.x);
      const cz = clamp(p.z, b.min.z, b.max.z);
      const dx = p.x - cx;
      const dz = p.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 > r * r) continue;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        const push = (r - d) / d;
        p.x += dx * push;
        p.z += dz * push;
      } else {
        const pxl = p.x - b.min.x + r;
        const pxr = b.max.x - p.x + r;
        const pzl = p.z - b.min.z + r;
        const pzr = b.max.z - p.z + r;
        const mn = Math.min(pxl, pxr, pzl, pzr);
        if (mn === pxl) p.x = b.min.x - r;
        else if (mn === pxr) p.x = b.max.x + r;
        else if (mn === pzl) p.z = b.min.z - r;
        else p.z = b.max.z + r;
      }
    }
  }

  moveToward(target, speed, dt) {
    _v4.subVectors(target, this.pos);
    _v4.y = 0;
    const dist = _v4.length();
    if (dist > 1e-4) {
      _v4.multiplyScalar(1 / dist);
      this.probeSteer(_v4);
      if (this.detourT > 0) {
        _v4.lerp(this.detourDir, 0.75).normalize();
      }
    } else {
      _v4.set(0, 0, 0);
    }
    const accel = 1 - Math.exp(-9 * dt);
    this.vel.x += (_v4.x * speed - this.vel.x) * accel;
    this.vel.z += (_v4.z * speed - this.vel.z) * accel;
    const step = _v5.set(this.pos.x + this.vel.x * dt, 0, this.pos.z + this.vel.z * dt);
    this.resolveCollisions(step);
    this.pos.x = step.x;
    this.pos.z = step.z;
    return dist;
  }

  pickCover(minDistFromSelf) {
    const w = this.mgr.world;
    const p = this.mgr.player;
    if (!w || !w.coverPoints || !w.coverPoints.length || !p) {
      this.cover = null;
      return;
    }
    const pts = w.coverPoints;
    let best = null;
    let bestScore = Infinity;
    let bestStand = null;
    let bestPerp = null;
    const myDistP = _v1.subVectors(p.position, this.pos).setY(0).length();
    let evaluated = 0;
    for (let i = 0; i < pts.length && evaluated < 10; i++) {
      const cp = pts[i];
      _v2.subVectors(cp.pos, this.pos).setY(0);
      const dMe = _v2.length();
      if (dMe > 30 || dMe < (minDistFromSelf || 0.5)) continue;
      evaluated++;
      _v3.subVectors(p.position, cp.pos).setY(0);
      const dP = _v3.length();
      if (dP < 3) continue;
      let blocks = false;
      if (w.raycastGroup) {
        _v4.set(cp.pos.x, cp.pos.y !== undefined ? cp.pos.y + 1.3 : 1.3, cp.pos.z);
        _v5.copy(p.position);
        const dd = _v4.distanceTo(_v5);
        if (dd > 0.5) {
          _v6.subVectors(_v5, _v4).normalize();
          _rcLOS.set(_v4, _v6);
          _rcLOS.near = 0.15;
          _rcLOS.far = dd - 0.4;
          _hitsLOS.length = 0;
          _rcLOS.intersectObject(w.raycastGroup, true, _hitsLOS);
          blocks = _hitsLOS.length > 0;
        }
      }
      let score = dMe;
      if (!blocks) score += 6;
      if (dP > myDistP) score += 4;
      if (dP > 45) score += 4;
      if (score < bestScore) {
        bestScore = score;
        best = cp;
        bestStand = _v7.set(cp.pos.x - cp.dir.x * 0.25, 0, cp.pos.z - cp.dir.z * 0.25).clone();
        bestPerp = _v8.set(cp.dir.z, 0, -cp.dir.x).clone();
      }
    }
    if (best) {
      this.cover = best;
      this.coverStand.copy(bestStand);
      this.coverPerp.copy(bestPerp);
      this.coverSide = Math.random() < 0.5 ? 1 : -1;
      this.coverSwapT = rand(4, 7);
    } else {
      this.cover = null;
    }
  }

  enterCombat(keepCover) {
    this.state = 'combat';
    this.stateT = 0;
    this.exposure = 0;
    if (!keepCover || !this.cover) this.pickCover(0.5);
    if (this.cover) this.rhythmT = rand(0.35, 0.8);
    else this.rhythmT = rand(0.2, 0.45);
    this.rhythm = 'hide';
  }

  relocate() {
    this.exposure = 0;
    const before = this.cover;
    this.pickCover(7);
    if (this.cover && this.cover !== before) {
      this.relocTarget.copy(this.coverStand);
    } else {
      const a = Math.random() * Math.PI * 2;
      const r = rand(8, 13);
      this.relocTarget.set(this.pos.x + Math.sin(a) * r, 0, this.pos.z + Math.cos(a) * r);
      this.cover = null;
    }
    this.state = 'reposition';
    this.stateT = 0;
  }

  flinch(worldLean) {
    if (this.dead) return;
    this.flinchT = EC.flinchTime;
    const a = wrapPI(Math.atan2(worldLean.x, worldLean.z) - this.rootYaw);
    this.flinchLX = Math.sin(a);
    this.flinchLZ = Math.cos(a);
  }

  startDeath(point) {
    this.dead = true;
    this.deathT = 0;
    _v1.set(this.pos.x, 1.2, this.pos.z);
    _v2.subVectors(_v1, point);
    _v2.y = 0;
    if (_v2.lengthSq() < 1e-6) _v2.set(rand(-1, 1), 0, rand(-1, 1));
    _v2.normalize();
    const ja = rand(-0.5, 0.5);
    const cs = Math.cos(ja), sn = Math.sin(ja);
    this.fallDir.set(_v2.x * cs - _v2.z * sn, 0, _v2.x * sn + _v2.z * cs).normalize();
    for (const h of this.hitboxes) {
      h.hb.userData.enemyRef = null;
      this.mgr.hitGroup.remove(h.hb);
    }
  }

  shoot() {
    const p = this.mgr.player;
    const fx = this.mgr.fx;
    const audio = this.mgr.audio;
    if (!p || !p.alive) return;
    this.gunTip.getWorldPosition(_v1);
    _v2.copy(p.position);
    _v2.y -= 0.35;
    const dist = _v1.distanceTo(_v2);
    let chance = this.accuracy;
    if (this.mgr.playerSpeed > 6.5) chance *= 0.75;
    if (this.mgr.playerCrouch) chance *= 0.85;
    if (dist > 35) chance *= 0.6;
    _v3.subVectors(_v2, _v1).normalize();
    const hit = Math.random() < chance;
    let end;
    if (hit) {
      end = _v4.copy(_v2);
      end.x += rand(-0.1, 0.1);
      end.y += rand(-0.1, 0.1);
      const dmg = randInt(EC.dmgPerHit[0], EC.dmgPerHit[1]);
      this.mgr.onPlayerHit && this.mgr.onPlayerHit(dmg, _v5.set(this.pos.x, this.pos.y + 1.3, this.pos.z));
    } else {
      const mag = Math.min(dist * rand(0.04, 0.11), 2.4);
      _v6.set(rand(-1, 1), rand(-0.6, 0.8), rand(-1, 1)).normalize().multiplyScalar(mag);
      _v4.copy(_v2).add(_v6);
      _v3.subVectors(_v4, _v1).normalize();
      end = _v4.copy(_v1).addScaledVector(_v3, 140);
      const w = this.mgr.world;
      if (w && w.raycastGroup) {
        _rcShot.set(_v1, _v3);
        _rcShot.near = 0.2;
        _rcShot.far = 140;
        _hitsShot.length = 0;
        _rcShot.intersectObject(w.raycastGroup, true, _hitsShot);
        if (_hitsShot.length) {
          const h = _hitsShot[0];
          end.copy(h.point);
          let n = _v6.copy(_v3).negate();
          if (h.face) {
            n = _v6.copy(h.face.normal).transformDirection(h.object.matrixWorld);
          }
          const mt = h.object.userData.materialType || 'concrete';
          fx && fx.impact && fx.impact(h.point, n, mt);
        }
      }
    }
    fx && fx.muzzleFlash && fx.muzzleFlash(_v1, _v3);
    fx && fx.tracer && fx.tracer(_v1, end);
    audio && audio.enemyShot && audio.enemyShot(dist);
    this.recoil = 1;
  }

  updateRhythm(dt) {
    if (this.rhythm === 'hide') {
      this.hide = damp(this.hide, 1, 8, dt);
      this.peek = damp(this.peek, 0, 10, dt);
      this.rhythmT -= dt;
      if (this.rhythmT <= 0) {
        if (this.distToPlayer < EC.fireRange) {
          this.rhythm = 'peek';
          this.rhythmT = 0.22;
        } else {
          this.rhythmT = rand(0.3, 0.6);
        }
      }
    } else if (this.rhythm === 'peek') {
      this.hide = damp(this.hide, 0, 10, dt);
      this.peek = damp(this.peek, 1, 10, dt);
      this.rhythmT -= dt;
      if (this.rhythmT <= 0) {
        this.rhythm = 'burst';
        this.shotsLeft = EC.burstSize;
        this.shotTimer = 0;
        this.losTimer = Math.min(this.losTimer, 0.02);
      }
    } else if (this.rhythm === 'burst') {
      this.hide = damp(this.hide, 0, 10, dt);
      this.peek = damp(this.peek, 1, 10, dt);
      this.shotTimer -= dt;
      while (this.shotTimer <= 0 && this.shotsLeft > 0) {
        this.shotTimer += EC.burstInterval;
        this.shotsLeft--;
        if (this.hasLOS && this.distToPlayer < EC.fireRange && this.hide < 0.5) this.shoot();
        if (!this.hasLOS) {
          this.shotsLeft = 0;
          if (this.cover) this.coverSide = -this.coverSide;
          break;
        }
      }
      if (this.shotsLeft <= 0) {
        this.rhythm = 'cool';
        this.rhythmT = EC.burstCooldown * rand(0.85, 1.2);
        if (this.cover) this.coverSide = -this.coverSide;
      }
    } else {
      this.hide = damp(this.hide, this.cover ? 0.7 : 0.15, 5, dt);
      this.peek = damp(this.peek, 0, 8, dt);
      this.rhythmT -= dt;
      if (this.rhythmT <= 0) {
        this.rhythm = 'hide';
        this.rhythmT = this.cover ? rand(0.6, 1.2) : rand(0.35, 0.7);
      }
    }
  }

  updateCombat(dt, movingAllowed) {
    let desired = _v7.copy(this.pos);
    let arrived = true;
    if (!this.cover) {
      this.coverSwapT -= dt;
      if (this.coverSwapT <= 0) {
        this.coverSwapT = rand(4, 7);
        this.pickCover(4);
      }
    }
    if (this.cover && this.pos.distanceTo(this.coverStand) > 0.8) {
      desired.copy(this.coverStand);
      arrived = false;
    } else {
      const wob = Math.sin(this.age * 2.1) * 0.22;
      const lat = this.rhythm === 'burst' || this.rhythm === 'peek' ? 0.55 : wob;
      desired.copy(this.coverStand).addScaledVector(this.coverPerp, lat * this.coverSide);
      if (!this.cover) {
        const a = this.age * 0.6 + this.walkPhase;
        desired.set(this.pos.x + Math.sin(a) * 0.3, 0, this.pos.z + Math.cos(a) * 0.3);
      }
    }
    if (arrived) {
      const exposed = this.hasLOS || this.age - this.lastDamaged < 2.5;
      this.exposure = exposed ? this.exposure + dt : Math.max(0, this.exposure - dt * 2);
      if (this.exposure > 6) {
        this.relocate();
        return;
      }
      this.coverSwapT -= dt;
      if (this.coverSwapT <= 0 && this.cover) {
        this.pickCover(6);
      }
    }
    if (movingAllowed) {
      const spd = EC.walkSpeed * this.speedMult * 0.85;
      this.moveToward(desired, spd, dt);
    }
    this.updateRhythm(dt);
  }

  updateAnim(dt, speed) {
    const p = this.mgr.player;
    const k = clamp(speed / 4.5, 0, 1.25);
    this.walkPhase += speed * dt * 2.55;
    const swing = Math.sin(this.walkPhase) * 0.58 * k;
    const bob = Math.abs(Math.cos(this.walkPhase)) * 0.035 * k;

    this.ready = damp(this.ready, this.state === 'spawn' ? 0 : 1, 5, dt);

    let fK = 0;
    if (this.flinchT > 0) {
      this.flinchT -= dt;
      fK = Math.sin(Math.PI * clamp(1 - this.flinchT / EC.flinchTime, 0, 1));
    }

    let dx = 0, dz = 1, dy = 0, distXZ = 1;
    if (p) {
      dx = p.position.x - this.pos.x;
      dz = p.position.z - this.pos.z;
      dy = p.position.y - (this.pos.y + EYE_H);
      distXZ = Math.max(0.001, Math.sqrt(dx * dx + dz * dz));
    }
    const aimYaw = Math.atan2(dx, dz);

    if (!this.dead) {
      let faceYaw = aimYaw;
      let turnRate = 5;
      const movingFast = speed > 1.2 && Math.abs(this.vel.x) + Math.abs(this.vel.z) > 0.1;
      if (movingFast && (this.state === 'advance' || this.state === 'reposition')) {
        faceYaw = Math.atan2(this.vel.x, this.vel.z);
        turnRate = 8;
      }
      const d = wrapPI(faceYaw - this.rootYaw);
      this.rootYaw += clamp(d, -turnRate * dt, turnRate * dt);
    }
    const rel = wrapPI(aimYaw - this.rootYaw);
    this.torsoYaw = damp(this.torsoYaw, clamp(rel, -1.15, 1.15), 10, dt);
    const pitch = Math.atan2(dy, distXZ);

    this.recoil = Math.max(0, this.recoil - dt * 9);
    const hide = this.hide;
    const peek = this.peek;

    const g = this.group;
    g.position.set(this.pos.x, this.pos.y - this.sinkY, this.pos.z);
    g.rotation.set(0, this.rootYaw, 0);

    const t = this.torso;
    t.rotation.set(
      -pitch * 0.55 + this.flinchLZ * -0.38 * fK + hide * 0.28,
      this.torsoYaw + this.flinchLX * 0.12 * fK,
      this.flinchLX * 0.3 * fK
    );
    t.position.y = 1.02 - hide * 0.16 - bob + Math.sin(this.age * 1.7) * 0.006;

    this.head.rotation.set(
      pitch * 0.4 + hide * 0.32 + Math.sin(this.age * 0.9) * 0.03 + this.flinchLZ * -0.2 * fK,
      Math.sin(this.age * 0.6) * 0.04,
      0
    );

    const armSwing = Math.sin(this.walkPhase) * 0.07 * k;
    const lowAdd = (1 - this.ready) * 0.5 + hide * 0.42;
    const bR = this.armR.userData.base;
    const bL = this.armL.userData.base;
    this.armR.rotation.set(bR[0] + lowAdd + armSwing, bR[1], bR[2] + this.flinchLX * -0.25 * fK);
    this.armL.rotation.set(bL[0] + lowAdd - armSwing, bL[1] + peek * 0.08, bL[2]);

    const rKick = this.recoil * this.recoil;
    this.rifle.rotation.x = lowAdd * 0.85 - rKick * 0.12 + Math.sin(this.walkPhase * 2) * 0.015 * k;
    this.rifle.position.y = 0.37 - hide * 0.1 + Math.sin(this.walkPhase * 2) * 0.009 * k;
    this.rifle.position.z = 0.22 - rKick * 0.05;

    const splay = 0;
    this.legL.rotation.set(swing, 0, 0.06 + splay);
    this.legR.rotation.set(-swing, 0, -0.06 - splay);

    for (const { hb, anc } of this.hitboxes) {
      anc.getWorldPosition(hb.position);
      anc.getWorldQuaternion(hb.quaternion);
    }
  }

  updateDeath(dt) {
    this.deathT += dt;
    const kk = easeOutBounce(clamp(this.deathT / FALL_DUR, 0, 1));
    const g = this.group;
    g.position.set(this.pos.x, this.pos.y - this.sinkY, this.pos.z);
    g.rotation.set(
      this.fallDir.z * FALL_ANG * kk,
      this.rootYaw,
      -this.fallDir.x * FALL_ANG * kk
    );
    const sp = kk * 0.55;
    this.legL.rotation.set(0.15 * kk, 0, 0.06 + sp);
    this.legR.rotation.set(-0.1 * kk, 0, -0.06 - sp * 0.7);
    const bR = this.armR.userData.base;
    const bL = this.armL.userData.base;
    this.armR.rotation.set(bR[0] + sp, bR[1], bR[2] - sp * 0.8);
    this.armL.rotation.set(bL[0] + sp * 0.8, bL[1], bL[2] + sp);
    this.torso.rotation.x = lerp(this.torso.rotation.x, 0.12, kk);
    this.head.rotation.z = 0.3 * kk;
    if (this.deathT > SINK_START) {
      this.sinkY += SINK_RATE * dt;
    }
    if (this.deathT >= CORPSE_LIFE) this.removeMe = true;
  }

  update(dt) {
    this.age += dt;
    if (this.dead) {
      this.updateDeath(dt);
      return;
    }
    const p = this.mgr.player;
    if (p) {
      _v1.subVectors(p.position, this.pos);
      _v1.y = 0;
      this.distToPlayer = _v1.length();
    } else {
      this.distToPlayer = Infinity;
    }

    this.losTimer -= dt;
    if (this.losTimer <= 0) {
      this.losTimer = 0.15;
      this.hasLOS = this.checkLOS();
    }
    if (this.hasLOS) this.lostLOST = 0;
    else this.lostLOST += dt;

    this.avoidMem = Math.max(0, this.avoidMem - dt);
    if (this.detourT > 0) this.detourT -= dt;

    let speed = 0;

    switch (this.state) {
      case 'spawn': {
        this.stateT += dt;
        if (this.stateT >= 0.6) {
          if (this.hasLOS && this.distToPlayer < EC.fireRange) this.enterCombat();
          else {
            this.state = 'advance';
            this.stateT = 0;
          }
        }
        break;
      }
      case 'advance': {
        if (this.hasLOS && this.distToPlayer < EC.fireRange) {
          this.enterCombat();
          break;
        }
        const sprint = this.distToPlayer > 30;
        const spd = (sprint ? EC.sprintSpeed : EC.walkSpeed) * this.speedMult;
        const tx = p ? p.position.x : this.pos.x;
        const tz = p ? p.position.z : this.pos.z;
        const dBefore = Math.sqrt((tx - this.pos.x) * (tx - this.pos.x) + (tz - this.pos.z) * (tz - this.pos.z));
        this.moveToward(_v3.set(tx, 0, tz), spd, dt);
        const moved = dBefore - Math.sqrt((tx - this.pos.x) * (tx - this.pos.x) + (tz - this.pos.z) * (tz - this.pos.z));
        if (moved < spd * dt * 0.25 && dBefore > 1.5) {
          this.stuckT += dt;
          if (this.stuckT > 0.7) {
            this.stuckT = 0;
            this.detourT = 0.8;
            const a = this.rootYaw + (Math.random() < 0.5 ? 1 : -1) * rand(0.9, 1.4);
            this.detourDir.set(Math.sin(a), 0, Math.cos(a));
          }
        } else {
          this.stuckT = 0;
        }
        speed = Math.sqrt(this.vel.x * this.vel.x + this.vel.z * this.vel.z);
        break;
      }
      case 'combat': {
        if (this.lostLOST > 2.5 || this.distToPlayer > EC.fireRange + 10) {
          this.state = 'advance';
          this.stateT = 0;
          break;
        }
        this.updateCombat(dt, true);
        speed = Math.sqrt(this.vel.x * this.vel.x + this.vel.z * this.vel.z);
        break;
      }
      case 'reposition': {
        this.stateT += dt;
        const d = this.moveToward(this.relocTarget, EC.sprintSpeed * this.speedMult, dt);
        speed = Math.sqrt(this.vel.x * this.vel.x + this.vel.z * this.vel.z);
        if (d < 1 || this.stateT > 6) {
          this.enterCombat(true);
        }
        break;
      }
    }

    if (this.state !== 'combat') {
      this.hide = damp(this.hide, 0, 6, dt);
      this.peek = damp(this.peek, 0, 6, dt);
    }

    this.updateAnim(dt, speed);
  }

  destroy(mgr) {
    mgr.scene.remove(this.group);
    this.matFatigue.dispose();
    for (const { hb } of this.hitboxes) {
      hb.userData.enemyRef = null;
      mgr.hitGroup.remove(hb);
    }
  }
}

export class EnemyManager {
  constructor({ scene }) {
    this.scene = scene;
    this.hitGroup = new THREE.Group();
    scene.add(this.hitGroup);
    this.world = null;
    this.player = null;
    this.fx = null;
    this.audio = null;
    this.onKill = null;
    this.onPlayerHit = null;
    this.soldiers = [];
    this.wave = 1;
    this.queue = 0;
    this.spawnTimer = 0;
    this.allSpawnedFlag = true;
    this._prevP = new THREE.Vector3();
    this._havePrev = false;
    this.playerSpeed = 0;
    this.playerCrouch = false;
    this._sorted = null;
    this._mmArr = [];
    this._mmPool = [];
  }

  setRefs({ world, player, fx, audio }) {
    this.world = world;
    this.player = player;
    this.fx = fx;
    this.audio = audio;
  }

  playerPos() {
    return this.player ? this.player.position : _v1.set(0, 1.7, 0);
  }

  get aliveCount() {
    let n = 0;
    for (let i = 0; i < this.soldiers.length; i++) {
      if (!this.soldiers[i].dead) n++;
    }
    return n;
  }

  get remainingInWave() {
    return this.queue + this.aliveCount;
  }

  get allSpawned() {
    return this.allSpawnedFlag;
  }

  spawnWave(n) {
    this.wave = n;
    this.queue = n;
    this.allSpawnedFlag = n <= 0;
    this.spawnTimer = 0.5;
    this._sorted = null;
  }

  _pickSpawn(out) {
    const sp = this.world && this.world.spawnPoints;
    if (!sp || !sp.length) {
      return out.set(0, 0, 0);
    }
    if (!this._sorted) {
      const p = this.playerPos();
      this._sorted = sp.slice().sort((a, b) => {
        const da = (a.x - p.x) * (a.x - p.x) + (a.z - p.z) * (a.z - p.z);
        const db = (b.x - p.x) * (b.x - p.x) + (b.z - p.z) * (b.z - p.z);
        return db - da;
      });
    }
    const half = Math.max(1, Math.ceil(this._sorted.length * 0.5));
    const p = this.playerPos();
    for (let tries = 0; tries < 4; tries++) {
      const pt = this._sorted[Math.floor(Math.random() * half)];
      const dx = pt.x - p.x;
      const dz = pt.z - p.z;
      if (dx * dx + dz * dz > 100 || tries === 3) return out.copy(pt);
    }
    return out.copy(this._sorted[0]);
  }

  _spawnOne() {
    _v2.set(0, 0, 0);
    this._pickSpawn(_v2);
    const s = new Soldier(this, _v2, this.wave);
    this.soldiers.push(s);
  }

  damage(enemyRef, amount, isHead, point) {
    if (!enemyRef || enemyRef.dead) return false;
    const e = enemyRef;
    e.lastDamaged = e.age;
    const dmg = amount * (isHead ? EC.headshotMult : 1);
    e.health -= dmg;
    _v3.set(e.pos.x, 1.25, e.pos.z);
    _v4.subVectors(_v3, point);
    _v4.y *= 0.35;
    if (_v4.lengthSq() < 1e-6) _v4.set(0, 0, 1);
    _v4.normalize();
    this.fx && this.fx.blood && this.fx.blood(point, _v4);
    if (e.health <= 0) {
      e.startDeath(point);
      this.onKill && this.onKill(e, !!isHead);
      return true;
    }
    e.flinch(_v5.subVectors(_v3, point).normalize());
    return false;
  }

  clear() {
    for (let i = 0; i < this.soldiers.length; i++) {
      this.soldiers[i].destroy(this);
    }
    this.soldiers.length = 0;
    this.queue = 0;
    this.allSpawnedFlag = true;
  }

  minimapEnemies() {
    const arr = this._mmArr;
    const pool = this._mmPool;
    let n = 0;
    for (let i = 0; i < this.soldiers.length; i++) {
      const s = this.soldiers[i];
      if (s.dead) continue;
      if (!pool[n]) pool[n] = new THREE.Vector3();
      pool[n].set(s.pos.x, s.pos.y + 1.2, s.pos.z);
      n++;
    }
    arr.length = n;
    for (let i = 0; i < n; i++) arr[i] = pool[i];
    return arr;
  }

  update(dt) {
    if (dt <= 0) return;
    dt = Math.min(dt, 0.05);

    const p = this.player;
    if (p && p.position) {
      if (this._havePrev && dt > 0) {
        _v1.set(p.position.x - this._prevP.x, 0, p.position.z - this._prevP.z);
        this.playerSpeed = _v1.length() / dt;
      }
      this._prevP.copy(p.position);
      this._havePrev = true;
      this.playerCrouch = p.position.y < (CONFIG.PLAYER.height + CONFIG.PLAYER.crouchHeight) * 0.5;
    }

    if (this.queue > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0 && this.aliveCount < WC.maxAlive) {
        this.queue--;
        this._spawnOne();
        this.spawnTimer = 0.8;
        if (this.queue === 0) this.allSpawnedFlag = true;
      }
    }

    const sols = this.soldiers;
    for (let i = 0; i < sols.length; i++) {
      sols[i].update(dt);
    }

    for (let i = sols.length - 1; i >= 0; i--) {
      if (sols[i].removeMe) {
        sols[i].destroy(this);
        sols[i] = sols[sols.length - 1];
        sols.pop();
      }
    }

    const n = sols.length;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = sols[i];
        const b = sols[j];
        if (a.dead || b.dead) continue;
        const dx = b.pos.x - a.pos.x;
        const dz = b.pos.z - a.pos.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < 0.81 && d2 > 1e-6) {
          const d = Math.sqrt(d2);
          const push = (0.9 - d) * 0.5 / d;
          a.pos.x -= dx * push;
          a.pos.z -= dz * push;
          b.pos.x += dx * push;
          b.pos.z += dz * push;
        }
      }
    }
  }

  dispose() {
    this.clear();
    this.scene.remove(this.hitGroup);
    this.hitGroup.clear();
    if (ASSETS) {
      for (const k in ASSETS.g) ASSETS.g[k].dispose();
      for (const k in ASSETS.m) ASSETS.m[k].dispose();
      ASSETS = null;
    }
  }
}

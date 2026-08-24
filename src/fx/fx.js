import * as THREE from 'three';
import { CONFIG } from '../core/contracts.js';

const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const randSign = () => (Math.random() < 0.5 ? -1 : 1);
const easeOutCubic = (u) => 1 - Math.pow(1 - u, 3);
const easeOutQuart = (u) => 1 - Math.pow(1 - u, 4);
const easeOutExpo = (u) => (u >= 1 ? 1 : 1 - Math.pow(2, -10 * u));

function makeTex(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

function softCircleTex() {
  return makeTex(128, (g, s) => {
    const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.3, 'rgba(255,255,255,0.6)');
    gr.addColorStop(0.65, 'rgba(255,255,255,0.18)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, s, s);
  });
}

function sparkCoreTex() {
  return makeTex(64, (g, s) => {
    const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.25, 'rgba(255,255,255,0.9)');
    gr.addColorStop(0.6, 'rgba(255,255,255,0.25)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, s, s);
  });
}

function starTex() {
  return makeTex(128, (g, s) => {
    const c = s / 2;
    g.translate(c, c);
    for (let i = 0; i < 6; i++) {
      g.save();
      g.rotate((i / 6) * TAU + rand(-0.1, 0.1));
      const len = c * rand(0.75, 1);
      const gr = g.createLinearGradient(0, 0, len, 0);
      gr.addColorStop(0, 'rgba(255,255,255,0.95)');
      gr.addColorStop(0.4, 'rgba(255,255,255,0.35)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(0, -s * 0.045);
      g.lineTo(len, 0);
      g.lineTo(0, s * 0.045);
      g.closePath();
      g.fill();
      g.restore();
    }
    const core = g.createRadialGradient(0, 0, 0, 0, 0, c * 0.34);
    core.addColorStop(0, 'rgba(255,255,255,1)');
    core.addColorStop(0.55, 'rgba(255,250,235,0.75)');
    core.addColorStop(1, 'rgba(255,240,210,0)');
    g.fillStyle = core;
    g.beginPath();
    g.arc(0, 0, c * 0.34, 0, TAU);
    g.fill();
  });
}

function smokeTex() {
  return makeTex(128, (g, s) => {
    for (let i = 0; i < 26; i++) {
      const r = rand(s * 0.08, s * 0.26);
      const x = rand(r, s - r);
      const y = rand(r, s - r);
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(255,255,255,${rand(0.05, 0.16)})`);
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, s, s);
    }
    g.globalCompositeOperation = 'destination-in';
    const mask = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    mask.addColorStop(0, 'rgba(0,0,0,1)');
    mask.addColorStop(0.7, 'rgba(0,0,0,0.85)');
    mask.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = mask;
    g.fillRect(0, 0, s, s);
  });
}

function bulletHoleTex() {
  return makeTex(64, (g, s) => {
    const c = s / 2;
    let gr = g.createRadialGradient(c, c, 0, c, c, c * 0.95);
    gr.addColorStop(0, 'rgba(12,10,8,0.95)');
    gr.addColorStop(0.32, 'rgba(24,20,16,0.85)');
    gr.addColorStop(0.6, 'rgba(70,62,52,0.4)');
    gr.addColorStop(1, 'rgba(90,82,68,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 9; i++) {
      const a = rand(0, TAU);
      const r0 = rand(c * 0.25, c * 0.6);
      g.strokeStyle = `rgba(10,8,6,${rand(0.25, 0.6)})`;
      g.lineWidth = rand(1, 2.5);
      g.beginPath();
      g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
      g.lineTo(Math.cos(a) * (r0 + rand(4, 12)), Math.sin(a) * (r0 + rand(4, 12)));
      g.stroke();
    }
  });
}

function tracerTex() {
  return makeTex(64, (g, s) => {
    const gr = g.createLinearGradient(0, 0, 0, s);
    gr.addColorStop(0, 'rgba(255,240,214,0)');
    gr.addColorStop(0.25, 'rgba(255,236,200,0.85)');
    gr.addColorStop(0.5, 'rgba(255,252,244,1)');
    gr.addColorStop(0.75, 'rgba(255,236,200,0.85)');
    gr.addColorStop(1, 'rgba(255,240,214,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, s, s);
  });
}

const POINT_VERT = `
attribute float aSize;
attribute float aAlpha;
attribute vec3 aColor;
varying float vA;
varying vec3 vC;
uniform float uScale;
void main() {
  vA = aAlpha;
  vC = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float d = max(0.1, -mv.z);
  gl_PointSize = aSize * uScale / d;
  gl_Position = projectionMatrix * mv;
}`;

const POINT_FRAG = `
uniform sampler2D uMap;
varying float vA;
varying vec3 vC;
void main() {
  float a = texture2D(uMap, gl_PointCoord).a * vA;
  if (a < 0.004) discard;
  gl_FragColor = vec4(vC, a);
}`;

class ParticlePool {
  constructor(capacity, tex, blending) {
    this.cap = capacity;
    this.cursor = 0;
    this.pos = new Float32Array(capacity * 3).fill(-9999);
    this.vel = new Float32Array(capacity * 3);
    this.life = new Float32Array(capacity);
    this.maxLife = new Float32Array(capacity);
    this.size0 = new Float32Array(capacity);
    this.size1 = new Float32Array(capacity);
    this.grav = new Float32Array(capacity);
    this.drag = new Float32Array(capacity);
    this.baseA = new Float32Array(capacity);

    const geo = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.BufferAttribute(new Float32Array(capacity), 1).setUsage(THREE.DynamicDrawUsage);
    this.aAlpha = new THREE.BufferAttribute(new Float32Array(capacity), 1).setUsage(THREE.DynamicDrawUsage);
    this.aColor = new THREE.BufferAttribute(new Float32Array(capacity * 3), 3).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.aPos);
    geo.setAttribute('aSize', this.aSize);
    geo.setAttribute('aAlpha', this.aAlpha);
    geo.setAttribute('aColor', this.aColor);
    this.geo = geo;

    this.mat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: tex }, uScale: { value: 600 } },
      vertexShader: POINT_VERT,
      fragmentShader: POINT_FRAG,
      transparent: true,
      depthWrite: false,
      blending
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
  }

  spawn(x, y, z, vx, vy, vz, life, lifeJit, size0, sizeJit, size1, grav, drag, alpha, r, g, b) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.cap;
    const i3 = i * 3;
    this.pos[i3] = x; this.pos[i3 + 1] = y; this.pos[i3 + 2] = z;
    this.vel[i3] = vx; this.vel[i3 + 1] = vy; this.vel[i3 + 2] = vz;
    const lj = lifeJit ? rand(1 - lifeJit, 1 + lifeJit) : 1;
    const sj = sizeJit ? rand(1 - sizeJit, 1 + sizeJit) : 1;
    this.life[i] = this.maxLife[i] = Math.max(0.02, life * lj);
    this.size0[i] = size0 * sj;
    this.size1[i] = (size1 === null ? size0 : size1) * sj;
    this.grav[i] = grav;
    this.drag[i] = drag;
    this.baseA[i] = alpha;
    this.aColor.array[i3] = r;
    this.aColor.array[i3 + 1] = g;
    this.aColor.array[i3 + 2] = b;
  }

  update(dt) {
    const { pos, vel, life, maxLife, size0, size1, grav, drag, baseA } = this;
    const szArr = this.aSize.array;
    const alArr = this.aAlpha.array;
    let any = false;
    for (let i = 0; i < this.cap; i++) {
      if (life[i] <= 0) continue;
      any = true;
      life[i] -= dt;
      const i3 = i * 3;
      if (life[i] <= 0) {
        life[i] = 0;
        alArr[i] = 0;
        szArr[i] = 0;
        pos[i3 + 1] = -9999;
        continue;
      }
      const dmp = Math.max(0, 1 - drag[i] * dt);
      vel[i3] *= dmp;
      vel[i3 + 1] = (vel[i3 + 1] - grav[i] * dt) * dmp;
      vel[i3 + 2] *= dmp;
      pos[i3] += vel[i3] * dt;
      pos[i3 + 1] += vel[i3 + 1] * dt;
      pos[i3 + 2] += vel[i3 + 2] * dt;
      const u = 1 - life[i] / maxLife[i];
      const grow = easeOutCubic(u);
      szArr[i] = size0[i] + (size1[i] - size0[i]) * grow;
      alArr[i] = baseA[i] * Math.min(1, u * 8) * Math.pow(1 - u, 1.35);
    }
    if (any) {
      this.aPos.needsUpdate = true;
      this.aSize.needsUpdate = true;
      this.aAlpha.needsUpdate = true;
      this.aColor.needsUpdate = true;
    }
  }

  dispose() {
    this.geo.dispose();
    this.mat.dispose();
  }
}

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _v4 = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _dq = new THREE.Quaternion();
const _eu = new THREE.Euler();
const _m = new THREE.Matrix4();
const Z_AXIS = new THREE.Vector3(0, 0, 1);
const UP = new THREE.Vector3(0, 1, 0);

export class FXManager {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.root = new THREE.Group();
    this.root.matrixAutoUpdate = false;
    scene.add(this.root);

    this.tex = {
      soft: softCircleTex(),
      spark: sparkCoreTex(),
      star: starTex(),
      smoke: smokeTex(),
      hole: bulletHoleTex(),
      tracer: tracerTex()
    };

    this.glow = new ParticlePool(720, this.tex.spark, THREE.AdditiveBlending);
    this.puff = new ParticlePool(520, this.tex.soft, THREE.NormalBlending);
    this.root.add(this.glow.points, this.puff.points);

    const planeGeo = new THREE.PlaneGeometry(1, 1);
    planeGeo.translate(0, 0.5, 0);
    this.tracerGeo = planeGeo;
    this.tracers = [];
    for (let i = 0; i < 32; i++) {
      const mat = new THREE.MeshBasicMaterial({
        map: this.tex.tracer,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        color: 0xffd9a0
      });
      const mesh = new THREE.Mesh(planeGeo, mat);
      mesh.visible = false;
      mesh.frustumCulled = false;
      mesh.renderOrder = 4;
      this.root.add(mesh);
      this.tracers.push({ mesh, active: false, head: 0, dist: 0, ox: 0, oy: 0, oz: 0, dx: 0, dy: 0, dz: 1 });
    }
    this.tracerCursor = 0;

    this.flashes = [];
    for (let i = 0; i < 8; i++) {
      const mat = new THREE.SpriteMaterial({
        map: this.tex.star, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false
      });
      const spr = new THREE.Sprite(mat);
      spr.visible = false;
      this.root.add(spr);
      this.flashes.push({ spr, active: false, t: 0, dur: 0, s0: 1, s1: 1, a0: 1 });
    }

    this.glowsprites = [];
    for (let i = 0; i < 16; i++) {
      const mat = new THREE.SpriteMaterial({
        map: this.tex.soft, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false
      });
      const spr = new THREE.Sprite(mat);
      spr.visible = false;
      this.root.add(spr);
      this.glowsprites.push({ spr, active: false, t: 0, dur: 0, s0: 1, s1: 1, a0: 1, fp: 1, vx: 0, vy: 0, vz: 0, ep: 3 });
    }

    this.puffsprites = [];
    for (let i = 0; i < 48; i++) {
      const mat = new THREE.SpriteMaterial({
        map: this.tex.smoke, blending: THREE.NormalBlending, depthWrite: false, transparent: true
      });
      const spr = new THREE.Sprite(mat);
      spr.visible = false;
      this.root.add(spr);
      this.puffsprites.push({ spr, active: false, t: 0, dur: 0, s0: 1, s1: 1, a0: 1, fp: 1.4, spin: 0, vx: 0, vy: 0, vz: 0 });
    }

    this.rings = [];
    const ringGeo = new THREE.RingGeometry(0.86, 1, 56);
    this.ringGeo = ringGeo;
    for (let i = 0; i < 5; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffd9a0, transparent: true, blending: THREE.AdditiveBlending,
        depthWrite: false, side: THREE.DoubleSide, fog: false
      });
      const mesh = new THREE.Mesh(ringGeo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.visible = false;
      this.root.add(mesh);
      this.rings.push({ mesh, active: false, t: 0, dur: 0, s0: 1, s1: 1, a0: 1 });
    }

    this.surfaceFlashes = [];
    const sqGeo = new THREE.PlaneGeometry(1, 1);
    this.sqGeo = sqGeo;
    for (let i = 0; i < 10; i++) {
      const mat = new THREE.MeshBasicMaterial({
        map: this.tex.soft, color: 0xfff2cc, transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false, fog: false
      });
      const mesh = new THREE.Mesh(sqGeo, mat);
      mesh.visible = false;
      this.root.add(mesh);
      this.surfaceFlashes.push({ mesh, active: false, t: 0, dur: 0, s0: 1, s1: 1 });
    }

    this.decals = [];
    const decGeo = new THREE.PlaneGeometry(1, 1);
    this.decGeo = decGeo;
    for (let i = 0; i < 64; i++) {
      const mat = new THREE.MeshBasicMaterial({
        map: this.tex.hole, transparent: true, depthWrite: false,
        polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
      });
      const mesh = new THREE.Mesh(decGeo, mat);
      mesh.visible = false;
      this.root.add(mesh);
      this.decals.push({ mesh, active: false, life: 0, maxLife: 1, baseO: 1 });
    }
    this.decalCursor = 0;

    this.muzzleLights = [];
    this.blastLights = [];
    for (let i = 0; i < 2; i++) {
      const l = new THREE.PointLight(0xffc27a, 0, 11, 2);
      l.visible = false;
      this.root.add(l);
      this.muzzleLights.push({ light: l, t: 0, dur: 0, peak: 0 });
    }
    for (let i = 0; i < 2; i++) {
      const l = new THREE.PointLight(0xff9a4d, 0, 34, 2);
      l.visible = false;
      this.root.add(l);
      this.blastLights.push({ light: l, t: 0, dur: 0, peak: 0 });
    }

    const debGeo = new THREE.BoxGeometry(1, 1, 1);
    this.debGeo = debGeo;
    this.debMat = new THREE.MeshLambertMaterial({});
    this.debris = new THREE.InstancedMesh(debGeo, this.debMat, 96);
    this.debris.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.debris.frustumCulled = false;
    const zeroM = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < 96; i++) {
      this.debris.setMatrixAt(i, zeroM);
      this.debris.setColorAt(i, new THREE.Color(1, 1, 1));
    }
    this.debris.instanceColor.needsUpdate = true;
    this.root.add(this.debris);
    this.debEntries = [];
    for (let i = 0; i < 96; i++) {
      this.debEntries.push({
        active: false, i, px: 0, py: 0, pz: 0, vx: 0, vy: 0, vz: 0,
        qx: 0, qy: 0, qz: 0, qw: 1, ax: 0, ay: 0, az: 0,
        sx: 1, sy: 1, sz: 1, life: 0, maxLife: 1, bounced: 0
      });
    }
    this.debCursor = 0;
    this.debZero = zeroM;

    this.pending = [];
    for (let i = 0; i < 32; i++) this.pending.push({ t: 0, x: 0, y: 0, z: 0, active: false });
    this.pendingCursor = 0;

    this.onShake = null;
  }

  _takeSprite(pool) {
    for (let i = 0; i < pool.length; i++) if (!pool[i].active) return pool[i];
    return null;
  }

  muzzleFlash(pos, dir, scale = 1) {
    const f = this._takeSprite(this.flashes) || this.flashes[0];
    f.active = true;
    f.t = 0;
    f.dur = rand(0.04, 0.06);
    f.s0 = rand(0.5, 0.7) * scale;
    f.s1 = f.s0 * rand(1.5, 1.9);
    f.a0 = rand(0.85, 1);
    f.spr.position.copy(pos).addScaledVector(dir, 0.07);
    f.spr.material.rotation = rand(0, TAU);
    f.spr.material.color.setHex(0xffd9a8);
    f.spr.visible = true;

    let ml = null;
    for (const e of this.muzzleLights) {
      if (!e.light.visible || e.t >= e.dur) { ml = e; break; }
      if (!ml || e.dur - e.t < ml.dur - ml.t) ml = e;
    }
    ml.t = 0;
    ml.dur = 0.055;
    ml.peak = 22 * scale;
    ml.light.position.copy(pos).addScaledVector(dir, 0.25);
    ml.light.color.setHex(0xffc27a);
    ml.light.intensity = ml.peak;
    ml.light.visible = true;

    for (let i = 0; i < 5; i++) {
      _v1.copy(dir).multiplyScalar(rand(6, 14))
        .addScaledVector(UP, rand(-1.4, 2.2))
        .add(_v2.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(2));
      this.glow.spawn(pos.x, pos.y, pos.z, _v1.x, _v1.y, _v1.z,
        rand(0.06, 0.14), 0, rand(0.03, 0.07), 0, null, 4, 2, 0.9, 1, 0.82, 0.5);
    }
    this.puff.spawn(pos.x + dir.x * 0.2, pos.y + 0.05, pos.z + dir.z * 0.2,
      rand(-0.2, 0.2), rand(0.5, 0.9), rand(-0.2, 0.2),
      rand(0.4, 0.6), 0, 0.12, 0, 0.5, -0.5, 1.5, 0.16, 0.62, 0.58, 0.5);
  }

  tracer(from, to) {
    const e = this.tracers[this.tracerCursor];
    this.tracerCursor = (this.tracerCursor + 1) % this.tracers.length;
    e.active = true;
    e.head = 0;
    e.ox = from.x; e.oy = from.y; e.oz = from.z;
    _v1.copy(to).sub(from);
    e.dist = _v1.length();
    e.dx = _v1.x / e.dist; e.dy = _v1.y / e.dist; e.dz = _v1.z / e.dist;
    e.mesh.visible = true;
  }

  _impactSpray(p, nx, ny, nz, n, spd0, spd1, life, lifeJit, size0, sizeJit, grav, drag, r, g, b, alpha) {
    for (let i = 0; i < n; i++) {
      const rv = rand(spd0, spd1);
      _v1.set(nx + rand(-0.8, 0.8), ny + rand(-0.5, 1), nz + rand(-0.8, 0.8)).normalize().multiplyScalar(rv);
      this.glow.spawn(p.x, p.y, p.z, _v1.x, _v1.y, _v1.z, life, lifeJit, size0, sizeJit, null, grav, drag, alpha, r, g, b);
    }
  }

  _impactPuffs(p, nx, ny, nz, n, life, lifeJit, size0, sizeJit, size1, grav, drag, r, g, b, alpha) {
    for (let i = 0; i < n; i++) {
      _v1.set(nx * rand(0.4, 1.4) + rand(-0.4, 0.4), ny * rand(0.4, 1.2) + rand(0.2, 0.9), nz * rand(0.4, 1.4) + rand(-0.4, 0.4));
      this.puff.spawn(
        p.x + nx * 0.04 + rand(-0.05, 0.05),
        p.y + ny * 0.04 + rand(-0.05, 0.05),
        p.z + nz * 0.04 + rand(-0.05, 0.05),
        _v1.x, _v1.y, _v1.z, life, lifeJit, size0, sizeJit, size1, grav, drag, alpha, r, g, b
      );
    }
  }

  _impactChips(p, nx, ny, nz, n, col, s0, s1, spd) {
    for (let i = 0; i < n; i++) {
      _v1.set(nx * rand(0.8, 1.6) + rand(-1, 1), ny * rand(0.8, 1.8) + rand(0.4, 1.6), nz * rand(0.8, 1.6) + rand(-1, 1)).normalize().multiplyScalar(rand(spd * 0.5, spd));
      this._spawnDebris(p.x, p.y, p.z, _v1.x, _v1.y, _v1.z, rand(s0, s1), col, rand(0.7, 1.4), 0);
    }
  }

  impact(point, normal, materialType) {
    const nx = normal.x, ny = normal.y, nz = normal.z;

    switch (materialType) {
      case 'metal':
      case 'barrel': {
        const hot = materialType === 'barrel';
        this._impactSpray(point, nx, ny, nz, hot ? 14 : 16, 3, 9,
          0.4, 0.35, 0.035, 0.4, 12, 0.6, 1, hot ? 0.72 : 0.84, hot ? 0.25 : 0.36, 1);
        this._impactSpray(point, nx, ny, nz, 5, 2, 5,
          0.22, 0.35, 0.045, 0.4, 8, 1, 1, 0.95, 0.78, 0.95);
        this._surfaceFlash(point, normal, rand(0.22, 0.34));
        this._placeDecal(point, normal, rand(0.1, 0.14), 0.55);
        break;
      }
      case 'sand': {
        this._impactPuffs(point, nx, ny, nz, 7,
          0.75, 0.3, 0.18, 0.35, 0.75, -0.4, 1.8, 0.79, 0.69, 0.51, 0.4);
        this._impactSpray(point, nx, ny, nz, 5, 2, 5,
          0.3, 0.3, 0.025, 0.4, 10, 1, 0.83, 0.73, 0.53, 0.7);
        this._impactChips(point, nx, ny, nz, 3, 0xb59a6b, 0.02, 0.045, 3);
        break;
      }
      case 'wood': {
        this._impactPuffs(point, nx, ny, nz, 3,
          0.48, 0.25, 0.11, 0.3, 0.4, -0.3, 1.6, 0.55, 0.42, 0.27, 0.35);
        this._impactChips(point, nx, ny, nz, 5, 0x6d4a2a, 0.025, 0.06, 4.5);
        this._placeDecal(point, normal, rand(0.09, 0.12), 0.8);
        break;
      }
      default: {
        this._impactPuffs(point, nx, ny, nz, 5,
          0.6, 0.3, 0.14, 0.35, 0.6, -0.35, 1.7, 0.63, 0.6, 0.56, 0.38);
        this._impactSpray(point, nx, ny, nz, 7, 2, 6.5,
          0.28, 0.4, 0.028, 0.4, 9, 0.8, 1, 0.9, 0.72, 0.85);
        this._impactChips(point, nx, ny, nz, 3, 0x8d877d, 0.02, 0.05, 3.5);
        this._placeDecal(point, normal, rand(0.11, 0.16), 0.9);
        break;
      }
    }
  }

  blood(point, dir) {
    for (let i = 0; i < 13; i++) {
      _v1.set(-dir.x * rand(0.4, 2.2) + rand(-1.6, 1.6), rand(0.2, 2.4), -dir.z * rand(0.4, 2.2) + rand(-1.6, 1.6));
      const dark = Math.random() < 0.5;
      this.puff.spawn(point.x, point.y, point.z, _v1.x, _v1.y, _v1.z,
        rand(0.25, 0.5), 0, rand(0.03, 0.07), 0, rand(0.05, 0.1), 13, 0.4,
        0.95, dark ? 0.38 : 0.55, 0.045, 0.06);
    }
    const p = this._takeSprite(this.puffsprites);
    if (p) {
      p.active = true; p.t = 0; p.dur = 0.32;
      p.s0 = 0.22; p.s1 = rand(0.7, 1.0); p.a0 = 0.4; p.fp = 1.6; p.spin = 0;
      p.vx = rand(-0.3, 0.3); p.vy = rand(0.1, 0.5); p.vz = rand(-0.3, 0.3);
      p.spr.position.copy(point);
      p.spr.material.color.setHex(0x8c2020);
      p.spr.material.rotation = rand(0, TAU);
      p.spr.material.opacity = p.a0;
      p.spr.visible = true;
    }
  }

  shellCasing(pos, rightDir) {
    _v1.copy(rightDir).multiplyScalar(rand(1.7, 2.8));
    _v1.y += rand(1.7, 2.6);
    _v1.x += rand(-0.4, 0.4);
    _v1.z += rand(-0.4, 0.4);
    this._spawnDebris(pos.x, pos.y, pos.z, _v1.x, _v1.y, _v1.z, 1, 0xcfa54e, 1.5, 0, 0.02, 0.02, 0.055);
  }

  explosion(pos, trauma = 0.6) {
    let g = this._takeSprite(this.glowsprites);
    if (!g) g = this.glowsprites[0];
    g.active = true; g.t = 0; g.dur = 0.3;
    g.s0 = 1.2; g.s1 = 6.5; g.a0 = 1; g.fp = 1.2; g.ep = 4; g.vx = g.vy = g.vz = 0;
    g.spr.position.copy(pos);
    g.spr.material.color.setHex(0xfff3dc);
    g.spr.material.rotation = 0;
    g.spr.visible = true;

    let fb = this._takeSprite(this.glowsprites);
    if (!fb) fb = this.glowsprites[1];
    fb.active = true; fb.t = 0; fb.dur = 0.5;
    fb.s0 = 1.6; fb.s1 = 4.6; fb.a0 = 0.95; fb.fp = 2.2; fb.ep = 3; fb.vx = 0; fb.vy = 1.2; fb.vz = 0;
    fb.spr.position.copy(pos);
    fb.spr.material.color.setHex(0xff8a34);
    fb.spr.visible = true;

    let bl = null;
    for (const e of this.blastLights) {
      if (!e.light.visible || e.t >= e.dur) { bl = e; break; }
      if (!bl || e.dur - e.t < bl.dur - bl.t) bl = e;
    }
    bl.t = 0; bl.dur = 0.32; bl.peak = 320;
    bl.light.position.copy(pos); bl.light.position.y += 0.5;
    bl.light.intensity = bl.peak;
    bl.light.visible = true;

    let ring = null;
    for (let i = 0; i < this.rings.length; i++) {
      if (!this.rings[i].active) { ring = this.rings[i]; break; }
    }
    if (!ring) ring = this.rings[0];
    ring.active = true; ring.t = 0; ring.dur = 0.55;
    ring.s0 = 0.6; ring.s1 = 9; ring.a0 = 0.8;
    ring.mesh.position.set(pos.x, 0.07, pos.z);
    ring.mesh.visible = true;

    const nSmoke = 5 + Math.floor(rand(0, 4));
    for (let i = 0; i < nSmoke; i++) {
      const slot = this.pending[this.pendingCursor];
      this.pendingCursor = (this.pendingCursor + 1) % this.pending.length;
      slot.active = true;
      slot.t = i * rand(0.05, 0.09);
      slot.x = pos.x;
      slot.y = pos.y;
      slot.z = pos.z;
    }

    for (let i = 0; i < 26; i++) {
      _v1.set(rand(-1, 1), rand(0.15, 1), rand(-1, 1)).normalize().multiplyScalar(rand(4, 12));
      _v1.y += 3;
      const ember = Math.random() < 0.5;
      this.glow.spawn(pos.x, pos.y + 0.3, pos.z, _v1.x, _v1.y, _v1.z,
        rand(0.4, 1.0), 0, rand(0.05, 0.12), 0, null, 9, 0.7,
        1, 1, ember ? 0.62 : 0.8, ember ? 0.18 : 0.42);
    }

    for (let i = 0; i < 12; i++) {
      _v1.set(rand(-1, 1), rand(0.6, 1.4), rand(-1, 1)).normalize().multiplyScalar(rand(5, 11));
      this._spawnDebris(pos.x, pos.y + 0.3, pos.z, _v1.x, _v1.y, _v1.z, rand(0.06, 0.17), 0x2e2a24, rand(1.2, 2.2), 0, 1, 1, 1);
    }

    if (pos.y < 1.6) {
      const e = this.decals[this.decalCursor];
      this.decalCursor = (this.decalCursor + 1) % this.decals.length;
      e.active = true; e.life = e.maxLife = 24; e.baseO = 0.7;
      e.mesh.position.set(pos.x, 0.025, pos.z);
      e.mesh.quaternion.identity();
      e.mesh.rotateX(-Math.PI / 2);
      e.mesh.rotateZ(rand(0, TAU));
      e.mesh.scale.setScalar(rand(2.8, 3.6));
      e.mesh.material.color.setHex(0x181512);
      e.mesh.material.opacity = e.baseO;
      e.mesh.visible = true;
    }

    this.onShake?.(trauma);
  }

  _surfaceFlash(point, normal, size) {
    let e = null;
    for (let i = 0; i < this.surfaceFlashes.length; i++) {
      if (!this.surfaceFlashes[i].active) { e = this.surfaceFlashes[i]; break; }
    }
    if (!e) e = this.surfaceFlashes[0];
    e.active = true; e.t = 0; e.dur = 0.14;
    e.s0 = size; e.s1 = size * 0.3;
    e.mesh.position.copy(point).addScaledVector(normal, 0.015);
    _q.setFromUnitVectors(Z_AXIS, _v1.copy(normal));
    e.mesh.quaternion.copy(_q);
    e.mesh.rotateZ(rand(0, TAU));
    e.mesh.scale.setScalar(size);
    e.mesh.material.opacity = 1;
    e.mesh.visible = true;
  }

  _placeDecal(point, normal, size, opacity) {
    const e = this.decals[this.decalCursor];
    this.decalCursor = (this.decalCursor + 1) % this.decals.length;
    e.active = true; e.life = e.maxLife = 18; e.baseO = opacity;
    e.mesh.position.copy(point).addScaledVector(normal, 0.012);
    _q.setFromUnitVectors(Z_AXIS, _v1.copy(normal));
    e.mesh.quaternion.copy(_q);
    e.mesh.rotateZ(rand(0, TAU));
    e.mesh.scale.setScalar(size);
    e.mesh.material.color.setHex(0xffffff);
    e.mesh.material.opacity = opacity;
    e.mesh.visible = true;
  }

  _spawnDebris(px, py, pz, vx, vy, vz, size, color, life, bounced, sx = 1, sy = 1, sz = 1) {
    const e = this.debEntries[this.debCursor];
    this.debCursor = (this.debCursor + 1) % this.debEntries.length;
    e.active = true;
    e.px = px; e.py = py; e.pz = pz;
    e.vx = vx; e.vy = vy; e.vz = vz;
    e.qx = 0; e.qy = 0; e.qz = 0; e.qw = 1;
    e.ax = rand(-14, 14); e.ay = rand(-14, 14); e.az = rand(-14, 14);
    e.sx = size * sx; e.sy = size * sy; e.sz = size * sz;
    e.life = e.maxLife = life;
    e.bounced = bounced;
    const c = this.debris.instanceColor;
    c.setXYZ(e.i, ((color >> 16) & 255) / 255, ((color >> 8) & 255) / 255, (color & 255) / 255);
    c.needsUpdate = true;
  }

  _writeDebris(e, scaleMul) {
    _q.set(e.qx, e.qy, e.qz, e.qw).normalize();
    _m.compose(_v1.set(e.px, e.py, e.pz), _q, _v2.set(e.sx * scaleMul, e.sy * scaleMul, e.sz * scaleMul));
    this.debris.setMatrixAt(e.i, _m);
  }

  update(dt) {
    if (dt <= 0) return;
    const cam = this.camera;

    for (let i = 0; i < this.pending.length; i++) {
      const p = this.pending[i];
      if (!p.active) continue;
      p.t -= dt;
      if (p.t > 0) continue;
      p.active = false;
      const s = this._takeSprite(this.puffsprites);
      if (!s) continue;
      s.active = true; s.t = 0; s.dur = rand(1.4, 2.1);
      s.s0 = rand(0.9, 1.4); s.s1 = rand(2.8, 4.2); s.a0 = rand(0.4, 0.55); s.fp = 1.3;
      s.spin = rand(-0.5, 0.5);
      s.vx = rand(-0.6, 0.6); s.vy = rand(1.4, 2.6); s.vz = rand(-0.6, 0.6);
      s.spr.position.set(p.x + rand(-0.5, 0.5), p.y + rand(0.1, 0.7), p.z + rand(-0.5, 0.5));
      s.spr.material.color.setHex(0x39332b);
      s.spr.material.rotation = rand(0, TAU);
      s.spr.material.opacity = s.a0;
      s.spr.visible = true;
    }

    for (let i = 0; i < this.tracers.length; i++) {
      const e = this.tracers[i];
      if (!e.active) continue;
      e.head += 280 * dt;
      if (e.head >= e.dist) {
        e.active = false;
        e.mesh.visible = false;
        continue;
      }
      const tail = Math.max(0, e.head - 4);
      const segLen = Math.max(0.01, e.head - tail);
      _v1.set(e.dx, e.dy, e.dz);
      _v2.set(e.ox + e.dx * (tail + segLen / 2), e.oy + e.dy * (tail + segLen / 2), e.oz + e.dz * (tail + segLen / 2));
      _v3.subVectors(cam.position, _v2);
      _v3.addScaledVector(_v1, -_v3.dot(_v1));
      if (_v3.lengthSq() < 1e-4) {
        _v3.set(0, 1, 0).addScaledVector(_v1, -_v1.y);
        if (_v3.lengthSq() < 1e-4) _v3.set(1, 0, 0).addScaledVector(_v1, -_v1.x);
      }
      _v3.normalize();
      _v4.crossVectors(_v1, _v3).normalize();
      _m.makeBasis(_v4, _v1, _v3);
      e.mesh.quaternion.setFromRotationMatrix(_m);
      e.mesh.position.set(e.ox + e.dx * tail, e.oy + e.dy * tail, e.oz + e.dz * tail);
      e.mesh.scale.set(0.05, segLen, 1);
    }

    this.glow.update(dt);
    this.puff.update(dt);

    const h = (typeof window !== 'undefined' ? window.innerHeight : 900) || 900;
    const pr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    const uScale = (h * Math.min(pr, 2) * 0.5) / Math.tan(THREE.MathUtils.degToRad(cam.fov * 0.5));
    this.glow.mat.uniforms.uScale.value = uScale;
    this.puff.mat.uniforms.uScale.value = uScale;

    for (let i = 0; i < this.flashes.length; i++) {
      const e = this.flashes[i];
      if (!e.active) continue;
      e.t += dt;
      const u = e.t / e.dur;
      if (u >= 1) {
        e.active = false;
        e.spr.visible = false;
        continue;
      }
      e.spr.material.opacity = e.a0 * Math.pow(1 - u, 1.5);
      const s = e.s0 + (e.s1 - e.s0) * easeOutQuart(u);
      e.spr.scale.set(s, s, 1);
    }

    for (let i = 0; i < this.glowsprites.length; i++) {
      const e = this.glowsprites[i];
      if (!e.active) continue;
      e.t += dt;
      const u = e.t / e.dur;
      if (u >= 1) {
        e.active = false;
        e.spr.visible = false;
        continue;
      }
      e.spr.position.x += e.vx * dt;
      e.spr.position.y += e.vy * dt;
      e.spr.position.z += e.vz * dt;
      e.spr.material.opacity = e.a0 * Math.pow(1 - u, e.fp);
      const growFn = e.ep === 4 ? easeOutExpo : easeOutCubic;
      const s = e.s0 + (e.s1 - e.s0) * growFn(u);
      e.spr.scale.set(s, s, 1);
    }

    for (let i = 0; i < this.puffsprites.length; i++) {
      const e = this.puffsprites[i];
      if (!e.active) continue;
      e.t += dt;
      const u = e.t / e.dur;
      if (u >= 1) {
        e.active = false;
        e.spr.visible = false;
        continue;
      }
      const dmp = Math.max(0, 1 - 1.2 * dt);
      e.vx *= dmp; e.vz *= dmp;
      e.spr.position.x += e.vx * dt;
      e.spr.position.y += e.vy * dt;
      e.spr.position.z += e.vz * dt;
      e.spr.material.opacity = e.a0 * Math.pow(1 - u, e.fp);
      const s = e.s0 + (e.s1 - e.s0) * easeOutCubic(u);
      e.spr.scale.set(s, s, 1);
      e.spr.material.rotation += e.spin * dt;
    }

    for (let i = 0; i < this.rings.length; i++) {
      const e = this.rings[i];
      if (!e.active) continue;
      e.t += dt;
      const u = e.t / e.dur;
      if (u >= 1) {
        e.active = false;
        e.mesh.visible = false;
        continue;
      }
      e.mesh.material.opacity = e.a0 * Math.pow(1 - u, 1.7);
      const s = e.s0 + (e.s1 - e.s0) * easeOutExpo(u);
      e.mesh.scale.setScalar(s);
    }

    for (let i = 0; i < this.surfaceFlashes.length; i++) {
      const e = this.surfaceFlashes[i];
      if (!e.active) continue;
      e.t += dt;
      const u = e.t / e.dur;
      if (u >= 1) {
        e.active = false;
        e.mesh.visible = false;
        continue;
      }
      e.mesh.material.opacity = Math.pow(1 - u, 1.6);
      const s = e.s0 + (e.s1 - e.s0) * u;
      e.mesh.scale.setScalar(s);
    }

    for (let i = 0; i < this.decals.length; i++) {
      const e = this.decals[i];
      if (!e.active) continue;
      e.life -= dt;
      if (e.life <= 0) {
        e.active = false;
        e.mesh.visible = false;
        continue;
      }
      const remain = e.life / e.maxLife;
      if (remain < 0.12) {
        e.mesh.material.opacity = e.baseO * (remain / 0.12);
      }
    }

    for (let i = 0; i < this.muzzleLights.length; i++) {
      const e = this.muzzleLights[i];
      if (!e.light.visible) continue;
      e.t += dt;
      const u = e.t / e.dur;
      if (u >= 1) {
        e.light.intensity = 0;
        e.light.visible = false;
      } else {
        e.light.intensity = e.peak * Math.pow(1 - u, 2);
      }
    }
    for (let i = 0; i < this.blastLights.length; i++) {
      const e = this.blastLights[i];
      if (!e.light.visible) continue;
      e.t += dt;
      const u = e.t / e.dur;
      if (u >= 1) {
        e.light.intensity = 0;
        e.light.visible = false;
      } else {
        e.light.intensity = e.peak * Math.pow(1 - u, 2.4);
      }
    }

    let debDirty = false;
    const G = CONFIG.PLAYER.gravity;
    for (let i = 0; i < this.debEntries.length; i++) {
      const e = this.debEntries[i];
      if (!e.active) continue;
      debDirty = true;
      e.life -= dt;
      const half = e.sy * 0.5;
      if (e.life <= 0) {
        e.active = false;
        this.debris.setMatrixAt(e.i, this.debZero);
        continue;
      }
      if (e.px === 0 && e.py === 0 && e.pz === 0 && e.vx === 0 && e.vy === 0 && e.vz === 0) {
        this._writeDebris(e, 1);
        continue;
      }
      const grounded = e.py <= half + 0.001 && e.vy <= 0;
      if (!grounded) {
        e.vy -= G * dt;
      } else if (e.bounced < 1) {
        e.bounced++;
        e.py = half;
        e.vy = -e.vy * rand(0.22, 0.38);
        e.vx *= 0.5; e.vz *= 0.5;
        e.ax *= 0.4; e.ay *= 0.4; e.az *= 0.4;
      } else {
        e.py = half;
        e.vy = 0;
        e.vx *= Math.max(0, 1 - 8 * dt);
        e.vz *= Math.max(0, 1 - 8 * dt);
        e.ax *= Math.max(0, 1 - 10 * dt);
        e.ay *= Math.max(0, 1 - 10 * dt);
        e.az *= Math.max(0, 1 - 10 * dt);
      }
      e.px += e.vx * dt;
      e.py += e.vy * dt;
      e.pz += e.vz * dt;
      const wx = e.ax * dt, wy = e.ay * dt, wz = e.az * dt;
      _eu.set(wx, wy, wz);
      _dq.setFromEuler(_eu);
      _q.set(e.qx, e.qy, e.qz, e.qw).premultiply(_dq);
      e.qx = _q.x; e.qy = _q.y; e.qz = _q.z; e.qw = _q.w;
      const u = 1 - e.life / e.maxLife;
      const fade = u > 0.82 ? 1 - (u - 0.82) / 0.18 : 1;
      this._writeDebris(e, Math.max(0.001, fade));
    }
    if (debDirty) this.debris.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    for (let i = 0; i < this.pending.length; i++) this.pending[i].active = false;
    this.scene.remove(this.root);
    this.glow.dispose();
    this.puff.dispose();
    this.tracerGeo.dispose();
    this.ringGeo.dispose();
    this.sqGeo.dispose();
    this.decGeo.dispose();
    this.debGeo.dispose();
    this.debMat.dispose();
    for (const k of Object.values(this.tex)) k.dispose();
    this.root.traverse((o) => {
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) m.dispose();
      }
    });
  }
}

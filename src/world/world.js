import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  sandTexture,
  concreteTexture,
  corrugatedTexture,
  woodTexture,
  barrelTexture,
  flagTexture,
  tarpTexture
} from './textures.js';

const DEG = Math.PI / 180;
const rand = (a, b) => a + Math.random() * (b - a);

function softDot() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function padTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.strokeStyle = 'rgba(228,214,168,0.85)';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(128, 128, 112, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 16;
  ctx.beginPath();
  ctx.moveTo(88, 62);
  ctx.lineTo(88, 194);
  ctx.moveTo(168, 62);
  ctx.lineTo(168, 194);
  ctx.moveTo(88, 128);
  ctx.lineTo(168, 128);
  ctx.stroke();
  ctx.fillStyle = 'rgba(228,214,168,0.45)';
  for (let i = 0; i < 900; i++) ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class World {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);

    this.colliders = [];
    this.raycastGroup = new THREE.Group();
    this.coverPoints = [];
    this.spawnPoints = [];
    this.minimapRects = [];
    this.barrels = [];

    this._tex = [];
    this._mats = [];
    this._geos = [];
    this._buckets = {};
    this._animFlags = [];
    this._smokeCols = null;

    this._buildSkyAndLight();
    this._buildGround();
    this._buildPerimeter();
    this._buildBuildings();
    this._buildContainers();
    this._buildBarriers();
    this._buildSandbags();
    this._buildWatchtower();
    this._buildCrates();
    this._buildCars();
    this._buildPoles();
    this._buildFlags();
    this._buildRocks();
    this._buildBarrels();
    this._buildMountains();
    this._buildAtmosphere();

    this._flushBuckets();
    scene.add(this.raycastGroup);

    this.playerSpawn = new THREE.Vector3(0, 0, 8);
    for (const p of [[-50, -50], [50, -50], [-50, 50], [50, 50], [0, 56], [56, 0], [0, -56], [-56, 0]]) {
      this.spawnPoints.push(new THREE.Vector3(p[0], 0, p[1]));
    }

    this.dustWind = new THREE.Vector3(0.55, 0.02, 0.22);
  }

  _trackTex(t) {
    this._tex.push(t);
    return t;
  }

  _mat(params) {
    const m = new THREE.MeshStandardMaterial(params);
    this._mats.push(m);
    return m;
  }

  _bucket(name, mat, materialType, shadowCast = true) {
    if (!this._buckets[name]) this._buckets[name] = { list: [], mat, materialType, shadowCast };
    return this._buckets[name].list;
  }

  _sbox(w, h, d, u) {
    const g = new THREE.BoxGeometry(w, h, d);
    const f = Math.min((u || Math.max(w, d)) / 2, 5);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * f, uv.getY(i) * f);
    this._geos.push(g);
    return g;
  }

  _place(g, x, y, z, ry = 0, rx = 0, rz = 0) {
    if (rx) g.rotateX(rx);
    if (rz) g.rotateZ(rz);
    if (ry) g.rotateY(ry);
    g.translate(x, y, z);
    return g;
  }

  _addCollider(cx, cz, w, d, h, y0 = 0) {
    this.colliders.push(
      new THREE.Box3(
        new THREE.Vector3(cx - w / 2, y0, cz - d / 2),
        new THREE.Vector3(cx + w / 2, y0 + h, cz + d / 2)
      )
    );
  }

  _cover(x, z, dx, dz) {
    const l = Math.hypot(dx, dz) || 1;
    this.coverPoints.push({ pos: new THREE.Vector3(x, 0, z), dir: new THREE.Vector3(dx / l, 0, dz / l) });
  }

  _buildSkyAndLight() {
    const sky = new Sky();
    sky.scale.setScalar(2000);
    this.group.add(sky);
    const u = sky.material.uniforms;
    u.turbidity.value = 4.5;
    u.rayleigh.value = 1.4;
    u.mieCoefficient.value = 0.0035;
    u.mieDirectionalG.value = 0.8;

    const phi = (90 - 26) * DEG;
    const theta = 232 * DEG;
    this.sunDir = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
    u.sunPosition.value.copy(this.sunDir);

    this.scene.fog = new THREE.Fog(0xe8c39a, 110, 560);

    this.group.add(new THREE.HemisphereLight(0xbdd0f5, 0xd8b078, 1.05));

    const sun = new THREE.DirectionalLight(0xffd9ae, 4.8);
    sun.position.copy(this.sunDir).multiplyScalar(170);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -95;
    sc.right = 95;
    sc.top = 95;
    sc.bottom = -95;
    sc.near = 20;
    sc.far = 420;
    sun.shadow.bias = -0.00018;
    sun.shadow.normalBias = 0.04;
    sc.updateProjectionMatrix();
    this.group.add(sun);
    this.group.add(sun.target);

    const fill = new THREE.DirectionalLight(0x8fb0e8, 0.55);
    fill.position.set(-sun.position.x, sun.position.y * 0.6, -sun.position.z);
    this.group.add(fill);
  }

  _buildGround() {
    const sand = this._trackTex(sandTexture());
    sand.repeat.set(46, 46);
    this.groundMat = this._mat({ map: sand, roughness: 0.96, metalness: 0 });
    const g = new THREE.PlaneGeometry(1200, 1200);
    g.rotateX(-Math.PI / 2);
    const ground = new THREE.Mesh(g, this.groundMat);
    ground.receiveShadow = true;
    ground.userData.materialType = 'sand';
    this.group.add(ground);
    this.raycastGroup.add(ground);

    const padMat = this._mat({
      map: this._trackTex(padTexture()),
      transparent: true,
      roughness: 0.9,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1
    });
    const pg = new THREE.CircleGeometry(3.4, 40);
    pg.rotateX(-Math.PI / 2);
    const pad = new THREE.Mesh(pg, padMat);
    pad.position.set(20, 0.03, -40);
    pad.receiveShadow = true;
    this.group.add(pad);
    this.raycastGroup.add(pad);
  }

  _buildPerimeter() {
    const conc = this._mat({ map: this._trackTex(concreteTexture()), roughness: 0.94 });
    const L = this._bucket('wall', conc, 'concrete');

    const seg = (cx, cz, w, d, h, y = 0) => {
      L.push(this._place(this._sbox(w, h, d), cx, y + h / 2, cz));
      this._addCollider(cx, cz, w, d, h, y);
    };

    seg(0, 65, 134, 1.5, 4.4);
    seg(-36, -65, 62, 1.5, 4.4);
    seg(36, -65, 62, 1.5, 4.4);
    seg(0, 65.6, 138, 2.1, 0.5, 4.4);
    seg(-36, -65.6, 62, 2.1, 0.5, 4.4);
    seg(36, -65.6, 62, 2.1, 0.5, 4.4);
    seg(-65.5, 0, 1.5, 132, 4.4);
    seg(65.5, 0, 1.5, 132, 4.4);
    seg(-65.9, 0, 2.1, 132, 0.5, 4.4);
    seg(65.9, 0, 2.1, 132, 0.5, 4.4);

    for (let i = -2; i <= 2; i++) {
      if (i === 0) continue;
      seg(i * 26, 65, 1.0, 2.3, 5.1);
      seg(i * 26, -65, 1.0, 2.3, 5.1);
      seg(65, i * 26, 2.3, 1.0, 5.1);
    }

    for (const t of [[-65, -65], [65, -65], [-65, 65], [65, 65]]) {
      seg(t[0], t[1], 5.2, 5.2, 8.2);
      L.push(this._place(this._sbox(6.0, 0.6, 6.0), t[0], 8.5, t[1]));
      this.minimapRects.push({ x: t[0], z: t[1], w: 5.2, d: 5.2 });
    }

    const dark = this._mat({ map: this._trackTex(corrugatedTexture()), color: 0x6a6f74, roughness: 0.6, metalness: 0.55 });
    const M = this._bucket('gate', dark, 'metal');
    M.push(this._place(this._sbox(0.8, 5.4, 1.0), -5.6, 2.7, -65));
    M.push(this._place(this._sbox(0.8, 5.4, 1.0), 5.6, 2.7, -65));
    M.push(this._place(this._sbox(12.4, 0.7, 1.0), 0, 5.2, -65));
    M.push(this._place(this._sbox(4.6, 4.6, 0.25), -2.4, 2.3, -65));
    M.push(this._place(this._sbox(4.6, 4.6, 0.25), 2.4, 2.3, -65));
    this._addCollider(0, -65, 11.2, 1.2, 5.2);

    for (let i = 0; i < 9; i++) {
      const g = this._sbox(rand(1.2, 2.6), rand(0.5, 1.4), rand(0.8, 1.8));
      this._place(g, 59.4 + rand(-1.2, 1.2), rand(0.2, 0.6), -20 + rand(-5, 5), rand(0, Math.PI), 0, rand(-0.5, 0.5));
      L.push(g);
    }
    const rub = this._sbox(3.4, 1.05, 9.5);
    this._place(rub, 62.5, 0.52, -20, 0.12);
    L.push(rub);
    this._addCollider(62.5, -20, 3.6, 9.5, 1.05);
    this._cover(57.5, -13, 1, 0);
    this._cover(57.5, -27, 1, 0);

    this.minimapRects.push({ x: 0, z: 65, w: 134, d: 1.5 });
    this.minimapRects.push({ x: 0, z: -65, w: 134, d: 1.5 });
    this.minimapRects.push({ x: -65.5, z: 0, w: 1.5, d: 132 });
    this.minimapRects.push({ x: 65.5, z: 0, w: 1.5, d: 132 });
  }

_buildBuilding(bx, bz, w, h, d, ry, doorSide) {
  const C = this._buckets.bldg.list;
  const G = this._buckets.glass.list;
  const rot = (dx, dz) => {
    const c = Math.cos(ry);
    const s = Math.sin(ry);
    return [dx * c + dz * s, -dx * s + dz * c];
  };
  const put = (dx, dy, dz, bw, bh, bd, list) => {
    const l = rot(dx, dz);
    list.push(this._place(this._sbox(bw, bh, bd), bx + l[0], dy, bz + l[1], ry));
  };
  put(0, h / 2, 0, w, h, d, C);
  this._addCollider(bx, bz, Math.abs(w * Math.cos(ry)) + Math.abs(d * Math.sin(ry)), Math.abs(w * Math.sin(ry)) + Math.abs(d * Math.cos(ry)), h);
  const pt = 0.45;
  put(0, h + pt / 2, d / 2 - 0.18, w, pt, 0.36, C);
  put(0, h + pt / 2, -d / 2 + 0.18, w, pt, 0.36, C);
  put(w / 2 - 0.18, h + pt / 2, 0, 0.36, pt, d, C);
  put(-w / 2 + 0.18, h + pt / 2, 0, 0.36, pt, d, C);
  const door = { n: [0, -d / 2], s: [0, d / 2], e: [w / 2, 0], w: [-w / 2, 0] }[doorSide];
  const dw = door[0] === 0 ? 1.7 : 0.34;
  const dd = door[0] === 0 ? 0.34 : 1.7;
  put(door[0], 1.32, door[1], dw, 2.64, dd, G);
  this.minimapRects.push({ x: bx, z: bz, w: w + 0.4, d: d + 0.4 });
  return { w, h, d };
}

_buildBuildings() {
  const conc = this._mat({ map: this._trackTex(concreteTexture()), roughness: 0.94 });
  const glass = this._mat({ color: 0x0c0f12, roughness: 0.25, metalness: 0.4 });
  const tarp = this._mat({ map: this._trackTex(tarpTexture()), roughness: 0.95 });
  this._bucket('bldg', conc, 'concrete');
  this._bucket('glass', glass, 'metal', false);
  this._bucket('tarp', tarp, 'wood');

  this._buildBuilding(-20, -16, 22, 7, 13, 0, 's');
  for (const [wx, wz] of [[-27, -9.6], [-23, -9.6], [-17, -9.6], [-13, -9.6], [-31.2, -12], [-31.2, -19]]) {
    this._buckets.glass.list.push(this._place(this._sbox(1.5, 1.7, 0.3), wx, 3.6, wz));
  }
  this._buckets.glass.list.push(this._place(this._sbox(0.3, 1.7, 1.5), -8.8, 4.6, -14));
  this._buckets.glass.list.push(this._place(this._sbox(0.3, 1.7, 1.5), -8.8, 4.6, -19));

  this._buildBuilding(28, 22, 14, 5, 10, 12 * DEG, 'w');

  const T = this._buckets.tarp.list;
  T.push(this._place(this._sbox(8.6, 0.18, 6.6, 4), -30, 3.75, 28, 0, -14 * DEG));
  T.push(this._place(this._sbox(3.4, 0.16, 2.0, 3), -20, 7.35, -8.6, 0, -22 * DEG));
  const darkM = this._mat({ color: 0x2b2e30, roughness: 0.55, metalness: 0.6 });
  const A = this._bucket('acunit', darkM, 'metal');
  A.push(this._place(this._sbox(1.7, 1.0, 1.3), -25, 7.5, -18, 0.2));
  A.push(this._place(this._sbox(1.2, 0.85, 1.1), -14, 7.5, -13, -0.15));

  this._cover(-20, -7.6, 0, 1);
  this._cover(-26, -7.6, 0, 1);
  this._cover(-12, -7.6, 0, 1);
  this._cover(-31.8, -16, 1, 0);
  this._cover(24, 22, 1, 0);
  this._cover(21, 16, 0, -1);
}

_buildContainers() {
  const corr = this._trackTex(corrugatedTexture());
  const mat = this._mat({ map: corr, roughness: 0.68, metalness: 0.42 });
  const geo = new THREE.BoxGeometry(6.06, 2.6, 2.44);
  const spots = [
    [36, -32, 0, 0x8a3324],
    [36, -29.2, 0, 0x2e4a68],
    [36, -32, 1, 0x3e5a3a],
    [30.5, -38, 90, 0xa08a58],
    [-40, -26, 0, 0x555b5e],
    [-40, -23.2, 0, 0x8a3324],
    [-40, -26, 1, 0x2e4a68],
    [10, -6, 28, 0x3e5a3a],
    [-12, 30, 74, 0xa08a58]
  ];
  const inst = new THREE.InstancedMesh(geo, mat, spots.length);
  inst.castShadow = true;
  inst.receiveShadow = true;
  inst.userData.materialType = 'metal';
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const eu = new THREE.Euler();
  const sc = new THREE.Vector3(1, 1, 1);
  const col = new THREE.Color();
  spots.forEach((s, i) => {
    eu.set(0, s[2] * DEG, 0);
    q.setFromEuler(eu);
    const y = s[3] ? 3.95 : 1.3;
    m4.compose(new THREE.Vector3(s[0], y, s[1]), q, sc);
    inst.setMatrixAt(i, m4);
    col.setHex(s[3]).offsetHSL(0, 0, rand(-0.04, 0.04));
    inst.setColorAt(i, col);
    if (!s[3]) {
      const alongX = s[2] % 180 === 0;
      const w = alongX ? 6.2 : 2.6;
      const d = alongX ? 2.6 : 6.2;
      if (s[2] % 180 !== 0 && s[2] !== 0) {
        this._addCollider(s[0], s[1], 5.4, 5.4, 2.6);
      } else {
        this._addCollider(s[0], s[1], w, d, 2.6);
      }
      this.minimapRects.push({ x: s[0], z: s[1], w, d });
      const nx = alongX ? 0 : 1;
      const nz = alongX ? 1 : 0;
      this._cover(s[0] + nx * 2.4, s[1] + nz * 2.4, nx, nz);
      this._cover(s[0] - nx * 2.4, s[1] - nz * 2.4, -nx, -nz);
    }
  });
  if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  this.group.add(inst);
  this.raycastGroup.add(inst);

  this._cover(33.4, -30.6, -1, 0);
  this._cover(27.6, -39, 0, 1);
  this._cover(-37.4, -24.6, 1, 0);
}

_buildBarriers() {
  const conc = this._mat({ map: this._trackTex(concreteTexture()), roughness: 0.92 });
  const geo = new THREE.BoxGeometry(2.1, 1.12, 0.56);
  const spots = [];
  for (const z of [-38, -32, -26, 20, 26, 32, 38]) spots.push([0, z, 0]);
  for (const x of [-9, 9]) spots.push([x, -2, 90]);
  for (let i = 0; i < 5; i++) spots.push([13 + i * 2.05, 6 + i * 0.75, 70]);
  for (const p of [[-24, 8, 15], [-46, 12, 0], [42, 6, 90], [18, 40, 0], [-8, -44, 90], [30, -12, 0]]) spots.push(p);
  const inst = new THREE.InstancedMesh(geo, conc, spots.length);
  inst.castShadow = true;
  inst.receiveShadow = true;
  inst.userData.materialType = 'concrete';
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const eu = new THREE.Euler();
  spots.forEach((s, i) => {
    eu.set(0, s[2] * DEG, 0);
    q.setFromEuler(eu);
    m4.compose(new THREE.Vector3(s[0], 0.56, s[1]), q, new THREE.Vector3(1, 1, 1));
    inst.setMatrixAt(i, m4);
    const alongX = s[2] === 0 || s[2] === 180;
    const w = alongX ? 2.1 : Math.abs(Math.cos((s[2] - 90) * DEG)) > 0.5 ? 0.9 : 2.0;
    const d = alongX ? 0.6 : Math.abs(Math.cos((s[2] - 90) * DEG)) > 0.5 ? 2.0 : 0.9;
    this._addCollider(s[0], s[1], w, d, 1.12);
    const nx = alongX ? 0 : 1;
    const nz = alongX ? 1 : 0;
    this._cover(s[0] + nx * 1.1, s[1] + nz * 1.1, nx, nz);
    this._cover(s[0] - nx * 1.1, s[1] - nz * 1.1, -nx, -nz);
    this.minimapRects.push({ x: s[0], z: s[1], w: Math.max(w, 1.4), d: Math.max(d, 1.4) });
  });
  this.group.add(inst);
  this.raycastGroup.add(inst);
}

_buildSandbags() {
  const mat = this._mat({ color: 0x9c8b62, roughness: 1 });
  const geo = new THREE.CapsuleGeometry(0.21, 0.4, 3, 7);
  geo.rotateZ(Math.PI / 2);
  const spots = [];
  const wall = (cx, cz, facingDeg) => {
    const rows = 4;
    for (let r = 0; r < rows; r++) {
      const n = 9 - r;
      const rad = 2.0;
      for (let i = 0; i < n; i++) {
        const t = n === 1 ? 0 : i / (n - 1);
        const a = (facingDeg - 52 + t * 104) * DEG;
        const shrink = 1 - r * 0.09;
        spots.push([cx - Math.sin(a) * rad * shrink, cz - Math.cos(a) * rad * shrink, a + 90 * DEG, 0.22 + r * 0.37]);
      }
    }
    const fa = facingDeg * DEG;
    const bx = cx - Math.sin(fa) * 3.1;
    const bz = cz - Math.cos(fa) * 3.1;
    this._cover(bx, bz, -Math.sin(fa), -Math.cos(fa));
    this._addCollider(cx, cz, 3.4, 3.4, 1.5);
  };
  wall(2, 20, 180);
  wall(-18, -38, 90);
  wall(24, -10, 0);
  const inst = new THREE.InstancedMesh(geo, mat, spots.length);
  inst.castShadow = true;
  inst.receiveShadow = true;
  inst.userData.materialType = 'sand';
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const eu = new THREE.Euler();
  const sc = new THREE.Vector3();
  spots.forEach((s, i) => {
    eu.set(0, s[2], 0);
    q.setFromEuler(eu);
    sc.set(rand(0.9, 1.15), 0.82, rand(0.9, 1.1));
    m4.compose(new THREE.Vector3(s[0], s[3], s[1]), q, sc);
    inst.setMatrixAt(i, m4);
  });
  this.group.add(inst);
  this.raycastGroup.add(inst);
}

_buildWatchtower() {
  const darkM = this._mat({ map: this._trackTex(corrugatedTexture()), color: 0x4c5154, roughness: 0.6, metalness: 0.6 });
  const M = this._bucket('tower', darkM, 'metal');
  const cx = 46;
  const cz = 46;
  for (const [lx, lz] of [[-1.15, -1.15], [1.15, -1.15], [-1.15, 1.15], [1.15, 1.15]]) {
    M.push(this._place(this._sbox(0.2, 6.5, 0.2), cx + lx, 3.25, cz + lz));
    this._addCollider(cx + lx, cz + lz, 0.34, 0.34, 6.5);
  }
  M.push(this._place(this._sbox(3.2, 0.24, 3.2), cx, 6.6, cz));
  M.push(this._place(this._sbox(3.2, 0.07, 0.07, 1.5), cx, 7.35, cz - 1.56));
  M.push(this._place(this._sbox(3.2, 0.07, 0.07, 1.5), cx, 7.35, cz + 1.56));
  M.push(this._place(this._sbox(0.07, 0.07, 3.2, 1.5), cx - 1.56, 7.35, cz));
  M.push(this._place(this._sbox(0.07, 0.07, 3.2, 1.5), cx + 1.56, 7.35, cz));
  for (const [lx, lz] of [[-1.45, -1.45], [1.45, -1.45], [-1.45, 1.45], [1.45, 1.45]]) {
    M.push(this._place(this._sbox(0.12, 2.2, 0.12), cx + lx, 7.8, cz + lz));
  }
  M.push(this._place(this._sbox(3.7, 0.14, 3.7, 3), cx, 8.95, cz, 10 * DEG));
  for (let i = 0; i < 9; i++) {
    M.push(this._place(this._sbox(0.5, 0.06, 0.06), cx, 0.55 + i * 0.68, cz - 1.72));
    M.push(this._place(this._sbox(0.06, 0.06, 0.9, 1.5), cx - 0.22, 0.55 + i * 0.68, cz - 1.85));
    M.push(this._place(this._sbox(0.06, 0.06, 0.9, 1.5), cx + 0.22, 0.55 + i * 0.68, cz - 1.85));
  }
  this.minimapRects.push({ x: cx, z: cz, w: 3.2, d: 3.2 });
}

_buildCrates() {
  const wood = this._mat({ map: this._trackTex(woodTexture()), roughness: 0.9 });
  const W = this._bucket('crates', wood, 'wood');
  const crate = (x, z, s, ry = 0, y = null) => {
    const yy = y === null ? s / 2 : y;
    W.push(this._place(this._sbox(s, s, s, s * 0.9), x, yy, z, ry));
    if (y === null) this._addCollider(x, z, s, s, s);
  };
  crate(-14.5, -8.5, 1.15);
  crate(-13.2, -8.3, 0.9, 0.4);
  crate(-14.1, -8.4, 0.75, 0.2, 1.15 + 0.38);
  crate(11, 15, 1.1, 0.3);
  crate(12.2, 15.3, 0.85, -0.25);
  crate(-33, -31, 1.2);
  crate(-31.6, -30.7, 1.05, 0.5);
  crate(-32.5, -30.9, 0.95, 0.1, 1.2 + 0.48);
  crate(40, 18, 1.15, 0.2);
  crate(39.2, 19.1, 0.8, -0.35);
  crate(-5, 37, 1.05, 0.15);
  this._cover(-14.1, -7.1, 0, 1);
  this._cover(11.6, 16.4, 0, 1);
  this._cover(-32.4, -29.4, 0, 1);
}

_buildCars() {
  const paint = this._mat({ color: 0x23201d, roughness: 0.82, metalness: 0.35 });
  const darkG = this._mat({ color: 0x0e1013, roughness: 0.35, metalness: 0.5 });
  const P = this._bucket('carpaint', paint, 'metal');
  const D = this._bucket('cardark', darkG, 'metal');
  const cars = [
    [-8, 8, 15],
    [14, -22, -28],
    [-27, 4, 100]
  ];
  for (const c of cars) {
    const ry = c[2] * DEG;
    const body = new THREE.BoxGeometry(4.35, 0.92, 1.88);
    P.push(this._place(body, c[0], 0.74, c[1], ry));
    const cab = new THREE.BoxGeometry(2.1, 0.74, 1.74);
    const cabT = this._place(cab, c[0] - Math.cos(ry) * 0.28, 1.52, c[1] + Math.sin(ry) * 0.28, ry);
    D.push(cabT);
    for (const [wx, wz] of [[1.45, 0.86], [1.45, -0.86], [-1.45, 0.86], [-1.45, -0.86]]) {
      const wg = new THREE.CylinderGeometry(0.36, 0.36, 0.27, 10);
      wg.rotateX(Math.PI / 2);
      const lx = c[0] + wx * Math.cos(ry) - wz * Math.sin(ry);
      const lz = c[1] + wx * Math.sin(ry) + wz * Math.cos(ry);
      D.push(this._place(wg, lx, 0.36, lz, ry));
    }
    this._addCollider(c[0], c[1], Math.abs(4.4 * Math.cos(ry)) + Math.abs(1.9 * Math.sin(ry)), Math.abs(4.4 * Math.sin(ry)) + Math.abs(1.9 * Math.cos(ry)), 1.65);
    this.minimapRects.push({ x: c[0], z: c[1], w: 4.4, d: 1.9 });
  }
  this._cover(-8, 10.3, 0, 1);
  this._cover(-8, 5.7, 0, -1);
  this._cover(-10.4, 8, -1, 0);
  this._cover(-5.6, 8, 1, 0);
  this._cover(14, -19.4, 0, -1);
  this._cover(16.4, -22, 1, 0);
}

_buildPoles() {
  const darkM = this._mat({ color: 0x3a332b, roughness: 0.85, metalness: 0.3 });
  const M = this._bucket('poles', darkM, 'wood');
  const zs = [-40, -20, 0, 20, 40];
  const tops = [];
  for (const z of zs) {
    M.push(this._place(new THREE.CylinderGeometry(0.14, 0.17, 9.2, 8), -54, 4.6, z));
    M.push(this._place(this._sbox(2.4, 0.15, 0.15), -54, 8.55, z));
    M.push(this._place(this._sbox(1.6, 0.13, 0.13), -54, 7.9, z));
    this._addCollider(-54, z, 0.5, 0.5, 9.2);
    tops.push(z);
  }
  const wireMat = this._mat({ color: 0x14100c, roughness: 1 });
  this._buckets.wires = { list: [], mat: wireMat, materialType: 'wood', shadowCast: false };
  for (let i = 0; i < tops.length - 1; i++) {
    for (const off of [-0.95, 0, 0.95]) {
      for (const hy of [8.55, 7.9]) {
        const pts = [];
        for (let t = 0; t <= 8; t++) {
          const f = t / 8;
          const z = tops[i] + (tops[i + 1] - tops[i]) * f;
          pts.push(new THREE.Vector3(-54 + off, hy - Math.sin(f * Math.PI) * 0.85, z));
        }
        const line = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(pts),
          new THREE.LineBasicMaterial({ color: 0x14100c })
        );
        this.group.add(line);
      }
    }
  }
}

_buildFlags() {
  const flagMat = this._mat({
    map: this._trackTex(flagTexture()),
    roughness: 0.9,
    side: THREE.DoubleSide
  });
  const darkM = this._mat({ color: 0x3a332b, roughness: 0.85, metalness: 0.3 });
  const M = this._bucket('flagpoles', darkM, 'wood');
  const makeFlag = (px, py, pz, h) => {
    M.push(this._place(new THREE.CylinderGeometry(0.05, 0.06, h, 6), px, py + h / 2, pz));
    const g = new THREE.PlaneGeometry(1.5, 0.94, 12, 6);
    g.translate(0.75, 0, 0);
    const mesh = new THREE.Mesh(g, flagMat);
    mesh.position.set(px, py + h - 0.75, pz);
    mesh.castShadow = true;
    this.group.add(mesh);
    this._animFlags.push({ mesh, base: g.attributes.position.array.slice() });
  };
  makeFlag(-29.2, 7, -21.8, 3.4);
  makeFlag(5.6, 5.55, -64.2, 3.8);
}

_buildRocks() {
  const mat = this._mat({ color: 0xa38c66, roughness: 1 });
  const geo = new THREE.DodecahedronGeometry(0.5, 0);
  const avoid = [[-20, -16], [28, 22], [-30, 28], [36, -31], [-40, -25], [46, 46]];
  let placed = 0;
  let guard = 0;
  while (placed < 46 && guard++ < 400) {
    const x = rand(-58, 58);
    const z = rand(-58, 58);
    if (Math.hypot(x - 0, z - 8) < 7) continue;
    let ok = true;
    for (const a of avoid) {
      if (Math.hypot(x - a[0], z - a[1]) < 7) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    placed++;
  }
  const inst = new THREE.InstancedMesh(geo, mat, placed);
  inst.castShadow = true;
  inst.receiveShadow = true;
  inst.userData.materialType = 'concrete';
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const eu = new THREE.Euler();
  const sc = new THREE.Vector3();
  const col = new THREE.Color();
  let idx = 0;
  guard = 0;
  while (idx < placed && guard++ < 800) {
    const x = rand(-58, 58);
    const z = rand(-58, 58);
    if (Math.hypot(x, z - 8) < 7) continue;
    let ok = true;
    for (const a of avoid) {
      if (Math.hypot(x - a[0], z - a[1]) < 7) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    eu.set(rand(0, Math.PI), rand(0, Math.PI), rand(0, Math.PI));
    q.setFromEuler(eu);
    const s = rand(0.35, 1.6);
    sc.set(s * rand(0.7, 1.3), s * rand(0.45, 0.9), s * rand(0.7, 1.3));
    m4.compose(new THREE.Vector3(x, s * 0.18, z), q, sc);
    inst.setMatrixAt(idx, m4);
    col.setHex(0xa38c66).offsetHSL(rand(-0.02, 0.02), rand(-0.05, 0.05), rand(-0.08, 0.04));
    inst.setColorAt(idx, col);
    idx++;
  }
  if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  this.group.add(inst);
  this.raycastGroup.add(inst);
}

_buildBarrels() {
  const mat = this._mat({ map: this._trackTex(barrelTexture()), roughness: 0.55, metalness: 0.5 });
  const geo = new THREE.CylinderGeometry(0.42, 0.42, 1.15, 14);
  const clusters = [
    [[33, -34], [34.15, -33.5], [33.4, -35.1]],
    [[-19.5, -27], [-20.6, -26.4]],
    [[6, 26], [7.1, 26.4]],
    [[-37, 16], [-38.1, 16.5]],
    [[17, 32], [15.9, 32.5]]
  ];
  for (const cl of clusters) {
    for (const p of cl) {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(p[0], 0.575, p[1]);
      mesh.rotation.y = rand(0, Math.PI * 2);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.barrel = true;
      mesh.userData.hp = 30;
      this.group.add(mesh);
      this.raycastGroup.add(mesh);
      this.barrels.push(mesh);
      this._addCollider(p[0], p[1], 0.92, 0.92, 1.15);
    }
  }
}

_buildMountains() {
  const geos = [];
  const peaks = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + rand(-0.12, 0.12);
    const r = rand(330, 430);
    peaks.push([Math.sin(a) * r, Math.cos(a) * r, rand(60, 130), rand(50, 115)]);
  }
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + rand(-0.14, 0.14);
    const r = rand(240, 300);
    peaks.push([Math.sin(a) * r, Math.cos(a) * r, rand(40, 90), rand(22, 52)]);
  }
  for (const p of peaks) {
    const g = new THREE.ConeGeometry(p[2], p[3], 7, 1);
    g.rotateY(rand(0, Math.PI));
    g.translate(p[0], p[3] * 0.42, p[1]);
    geos.push(g);
  }
  const merged = mergeGeometries(geos, false);
  const mat = this._mat({ color: 0xb08a5e, roughness: 1 });
  const mesh = new THREE.Mesh(merged, mat);
  mesh.userData.materialType = 'sand';
  this.group.add(mesh);
  this.raycastGroup.add(mesh);
}

_buildAtmosphere() {
  const dot = softDot();
  this._tex.push(dot);
  const sites = [[170, -190], [-230, 150], [90, 280]];
  this._smokeCols = [];
  for (const s of sites) {
    const sprites = [];
    for (let i = 0; i < 7; i++) {
      const m = new THREE.SpriteMaterial({
        map: dot,
        color: 0x38342f,
        transparent: true,
        opacity: 0,
        depthWrite: false
      });
      const sp = new THREE.Sprite(m);
      sp.position.set(s[0] + rand(-3, 3), 2 + i * 7, s[1] + rand(-3, 3));
      sp.scale.setScalar(9 + i * 3);
      this.group.add(sp);
      sprites.push({ sp, seed: rand(0, 10) });
    }
    this._smokeCols.push({ x: s[0], z: s[1], sprites });
  }

  const N = 260;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = rand(-62, 62);
    pos[i * 3 + 1] = rand(0.3, 6);
    pos[i * 3 + 2] = rand(-62, 62);
  }
  const dg = new THREE.BufferGeometry();
  dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dm = new THREE.PointsMaterial({
    size: 0.07,
    map: dot,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
    sizeAttenuation: true,
    color: 0xe8d9b8
  });
  this.dustPoints = new THREE.Points(dg, dm);
  this.dustGeo = dg;
  this.group.add(this.dustPoints);
}

_flushBuckets() {
  for (const name of Object.keys(this._buckets)) {
    const b = this._buckets[name];
    if (!b.list.length) continue;
    const merged = mergeGeometries(b.list, false);
    const mesh = new THREE.Mesh(merged, b.mat);
    mesh.castShadow = b.shadowCast;
    mesh.receiveShadow = true;
    mesh.userData.materialType = b.materialType;
    this.group.add(mesh);
    this.raycastGroup.add(mesh);
    for (const g of b.list) g.dispose();
    b.list.length = 0;
  }
}

update(dt, elapsed) {
  for (const f of this._animFlags) {
    const pos = f.mesh.geometry.attributes.position;
    const base = f.base;
    for (let i = 0; i < pos.count; i++) {
      const bx = base[i * 3];
      pos.setZ(i, Math.sin(elapsed * 3.2 + bx * 2.6) * 0.1 * (bx / 1.5) + Math.sin(elapsed * 5.1 + bx * 4.2) * 0.03 * (bx / 1.5));
      pos.setY(i, base[i * 3 + 1] + Math.sin(elapsed * 2.3 + bx * 1.8) * 0.02 * (bx / 1.5));
    }
    pos.needsUpdate = true;
    f.mesh.geometry.computeVertexNormals();
  }
  if (this._smokeCols) {
    for (const col of this._smokeCols) {
      for (const s of col.sprites) {
        s.sp.position.y += dt * (1.4 + s.seed * 0.14);
        s.sp.position.x += dt * 0.5;
        const h = (s.sp.position.y - 2) / 44;
        if (h > 1) {
          s.sp.position.y = 2;
          s.sp.position.x = col.x + rand(-3, 3);
          s.sp.position.z = col.z + rand(-3, 3);
        }
        s.sp.material.opacity = 0.17 * Math.max(0, Math.min(1, h * 4)) * (1 - h);
      }
    }
  }
  if (this.dustGeo) {
    const pos = this.dustGeo.attributes.position;
    const arr = pos.array;
    for (let i = 0; i < arr.length; i += 3) {
      arr[i] += this.dustWind.x * dt;
      arr[i + 1] += this.dustWind.y * dt + Math.sin(elapsed * 0.7 + arr[i]) * 0.02 * dt;
      arr[i + 2] += this.dustWind.z * dt;
      if (arr[i] > 63) arr[i] = -63;
      if (arr[i + 2] > 63) arr[i + 2] = -63;
      if (arr[i + 1] > 6.5) arr[i + 1] = 0.3;
    }
    pos.needsUpdate = true;
  }
}

dispose() {
  this.scene.remove(this.group);
  this.scene.remove(this.raycastGroup);
  this.scene.fog = null;
  const seen = new Set();
  this.group.traverse((o) => {
    if (o.geometry && !seen.has(o.geometry)) {
      seen.add(o.geometry);
      o.geometry.dispose();
    }
  });
  for (const m of this._mats) m.dispose();
  for (const t of this._tex) t.dispose();
}
}

import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  asphaltTexture,
  sidewalkTexture,
  brickTexture,
  brickNormalTexture,
  concreteTexture,
  concreteNormalTexture,
  corrugatedTexture,
  corrugatedNormalTexture,
  woodTexture,
  barrelTexture,
  flagTexture,
  awningTexture,
  fenceMeshTexture,
  storefrontSignTexture
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

function oilStainTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  g.addColorStop(0, 'rgba(8,8,10,0.72)');
  g.addColorStop(0.45, 'rgba(10,10,12,0.4)');
  g.addColorStop(0.8, 'rgba(14,14,16,0.12)');
  g.addColorStop(1, 'rgba(14,14,16,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 26; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 18 + Math.random() * 42;
    const rr = 3 + Math.random() * 12;
    const gg = ctx.createRadialGradient(64 + Math.cos(a) * r, 64 + Math.sin(a) * r, 0, 64 + Math.cos(a) * r, 64 + Math.sin(a) * r, rr);
    gg.addColorStop(0, 'rgba(6,6,8,0.4)');
    gg.addColorStop(1, 'rgba(6,6,8,0)');
    ctx.fillStyle = gg;
    ctx.fillRect(0, 0, 128, 128);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function paperTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#cfc8b8';
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = 'rgba(60,60,66,0.55)';
  for (let y = 10; y < 56; y += 6) ctx.fillRect(8, y, 34 + ((y * 7) % 14), 1.6);
  ctx.fillStyle = 'rgba(120,80,50,0.3)';
  ctx.fillRect(8, 4, 20, 3);
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
    this._buckets = {};
    this._animFlags = [];
    this._papers = [];
    this._smokeCols = null;
    this._signCache = {};
    this._winItems = [];
    this._acSpots = [];
    this._tankSpots = [];

    this._initMaterials();
    this._buildSkyAndLight();
    this._buildGround();
    this._buildAllBuildings();
    this._buildRooftopClutter();
    this._buildScaffold();
    this._buildPerimeter();
    this._buildConstructionYard();
    this._buildRubbleLot();
    this._buildStreetFurniture();
    this._buildVehicles();
    this._buildCheckpoint();
    this._buildSandbags();
    this._buildJerseys();
    this._buildBarrels();
    this._buildLitterDebris();
    this._buildSkyline();
    this._buildSmoke();
    this._buildAtmosphere();
    this._finalizeWindows();
    this._flushBuckets();
    scene.add(this.raycastGroup);

    this.playerSpawn = new THREE.Vector3(0, 0, 13);
    for (const p of [
      [52, 0], [-52, 0], [0, 52], [0, -52],
      [-39, -14], [37, -14], [35, 14], [-51, 14],
      [12, 50], [24, -55], [-24, 58]
    ]) {
      this.spawnPoints.push(new THREE.Vector3(p[0], 0, p[1]));
    }

    this.dustWind = new THREE.Vector3(0.5, 0.015, 0.25);
  }

  _trackTex(t) {
    this._tex.push(t);
    return t;
  }

  _mat(params, materialType = 'concrete') {
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
    return g;
  }

  _fbox(w, h, d, tile) {
    const g = new THREE.BoxGeometry(w, h, d);
    const uv = g.attributes.uv;
    const sc = (i0, su, sv) => {
      for (let i = i0; i < i0 + 4; i++) uv.setXY(i, uv.getX(i) * su * tile, uv.getY(i) * sv * tile);
    };
    sc(0, d, h);
    sc(4, d, h);
    sc(8, w, d);
    sc(12, w, d);
    sc(16, w, h);
    sc(20, w, h);
    return g;
  }

  _place(g, x, y, z, ry = 0, rx = 0, rz = 0) {
    if (rx) g.rotateX(rx);
    if (rz) g.rotateZ(rz);
    if (ry) g.rotateY(ry);
    g.translate(x, y, z);
    return g;
  }

  _quad(w, d) {
    const g = new THREE.PlaneGeometry(w, d);
    g.rotateX(-Math.PI / 2);
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

  _facePt(f, t, off) {
    return f.n === 'x' ? [f.at + f.dr * off, t] : [t, f.at + f.dr * off];
  }

  _boxOn(list, f, t, y, h, w, th, off = null) {
    const o = off === null ? th / 2 : off;
    const p = this._facePt(f, t, o);
    list.push(this._place(this._sbox(f.n === 'x' ? th : w, h, f.n === 'x' ? w : th), p[0], y, p[1]));
  }

  _signMat(text, opts) {
    const key = text + (opts.cross ? '_c' : '') + (opts.bg || '');
    if (!this._signCache[key]) {
      this._signCache[key] = this._mat({ map: this._trackTex(storefrontSignTexture(text, opts)), roughness: 0.62 }, 'concrete');
    }
    return this._signCache[key];
  }

  _initMaterials() {
    const concMap = this._trackTex(concreteTexture());
    const concNrm = this._trackTex(concreteNormalTexture());
    const brickMap = this._trackTex(brickTexture());
    const brickNrm = this._trackTex(brickNormalTexture());
    const corrMap = this._trackTex(corrugatedTexture());
    const corrNrm = this._trackTex(corrugatedNormalTexture());

    this.facMats = {
      warm: this._mat({ map: concMap, normalMap: concNrm, normalScale: new THREE.Vector2(0.55, 0.55), color: 0xc4b6a2, roughness: 0.93 }, 'concrete'),
      brick: this._mat({ map: brickMap, normalMap: brickNrm, normalScale: new THREE.Vector2(0.9, 0.9), roughness: 0.92 }, 'concrete'),
      tan: this._mat({ map: concMap, normalMap: concNrm, normalScale: new THREE.Vector2(0.5, 0.5), color: 0xd8c2a0, roughness: 0.92 }, 'concrete'),
      blue: this._mat({ map: concMap, normalMap: concNrm, normalScale: new THREE.Vector2(0.45, 0.45), color: 0xb2bdc8, roughness: 0.88 }, 'concrete'),
      corr: this._mat({ map: corrMap, normalMap: corrNrm, normalScale: new THREE.Vector2(0.9, 0.9), color: 0x99a1a6, roughness: 0.6, metalness: 0.45 }, 'metal')
    };

    this.trimMat = this._mat({ map: concMap, normalMap: concNrm, color: 0x6f6a63, roughness: 0.92 }, 'concrete');
    this.roofMat = this._mat({ map: this._trackTex(asphaltTexture()), color: 0x5a5750, roughness: 0.98 }, 'concrete');

    this._bucket('fac_warm', this.facMats.warm, 'concrete');
    this._bucket('fac_brick', this.facMats.brick, 'concrete');
    this._bucket('fac_tan', this.facMats.tan, 'concrete');
    this._bucket('fac_blue', this.facMats.blue, 'concrete');
    this._bucket('fac_corr', this.facMats.corr, 'metal');
    this._bucket('trim', this.trimMat, 'concrete');
    this._bucket('roof', this.roofMat, 'concrete');

    this.storeGlassMat = this._mat({ color: 0x11161c, roughness: 0.14, metalness: 0.72 }, 'metal');
    this._bucket('storeglass', this.storeGlassMat, 'metal', false);

    const awnMap = this._trackTex(awningTexture());
    this.awnRed = this._mat({ map: awnMap, color: 0xa84038, roughness: 0.9 }, 'wood');
    this.awnGreen = this._mat({ map: awnMap, color: 0x3e5a46, roughness: 0.9 }, 'wood');
    this._bucket('awnred', this.awnRed, 'wood');
    this._bucket('awngreen', this.awnGreen, 'wood');

    this.woodMat = this._mat({ map: this._trackTex(woodTexture()), roughness: 0.9 }, 'wood');
    this._bucket('wood', this.woodMat, 'wood');

    this.milMat = this._mat({ map: this._trackTex(woodTexture()), color: 0x55603e, roughness: 0.88 }, 'wood');
    this._bucket('mil', this.milMat, 'wood');

    this.darkMetal = this._mat({ color: 0x33373a, roughness: 0.55, metalness: 0.65 }, 'metal');
    this._bucket('darkmetal', this.darkMetal, 'metal');

    this.rustMetal = this._mat({ color: 0x6e4a34, roughness: 0.78, metalness: 0.5 }, 'metal');
    this._bucket('rust', this.rustMetal, 'metal');

    this.whitePaint = this._mat({ color: 0x9b988c, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }, 'concrete');
    this.yellowPaint = this._mat({ color: 0xc7a13c, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }, 'concrete');
    this.stainMat = this._mat({
      map: this._trackTex(oilStainTexture()),
      transparent: true,
      depthWrite: false,
      roughness: 0.42,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1
    });
    this.manholeMat = this._mat({ color: 0x27251f, roughness: 0.5, metalness: 0.7, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }, 'metal');

    this.paverMat = this._mat({ map: this._trackTex(sidewalkTexture()), roughness: 0.94 }, 'concrete');
    this.asphaltMat = this._mat({ map: this._trackTex(asphaltTexture()), roughness: 0.97 }, 'concrete');

    const corrTan = this._trackTex(corrugatedTexture());
    this.hoardMat = this._mat({ map: corrTan, normalMap: corrNrm, normalScale: new THREE.Vector2(0.8, 0.8), color: 0xa89272, roughness: 0.8, metalness: 0.25 }, 'metal');
    this.dumpGreen = this._mat({ map: corrTan, normalMap: corrNrm, color: 0x3d523f, roughness: 0.72, metalness: 0.35 }, 'metal');
    this.dumpBlue = this._mat({ map: corrTan, normalMap: corrNrm, color: 0x3a4f66, roughness: 0.72, metalness: 0.35 }, 'metal');

    this.fenceMat = this._mat({ map: this._trackTex(fenceMeshTexture()), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.7, metalness: 0.3 }, 'metal');

    this.coneMat = this._mat({ color: 0xc05a20, roughness: 0.7 }, 'wood');
    this.cementMat = this._mat({ map: concMap, color: 0xb8ab92, roughness: 0.95 }, 'concrete');
    this.bagMat = this._mat({ color: 0x18181a, roughness: 0.32, metalness: 0.1 }, 'sand');
    this.bollardMat = this._mat({ color: 0x37413b, roughness: 0.6, metalness: 0.5 }, 'metal');
    this.hydrantMat = this._mat({ color: 0x8e2f24, roughness: 0.55, metalness: 0.35 }, 'metal');
    this.sandbagMat = this._mat({ color: 0x9a8a62, roughness: 1 }, 'sand');
    this.jerseyMat = this._mat({ map: concMap, color: 0x9b968c, roughness: 0.94 }, 'concrete');
    this.litterMat = this._mat({ roughness: 0.9, side: THREE.DoubleSide }, 'wood');
    this.foliageMat = this._mat({ color: 0xffffff, roughness: 0.95 }, 'wood');
    this.posterMat = this._mat({ roughness: 0.85, side: THREE.DoubleSide }, 'wood');

    this.winDarkMat = this._mat({ color: 0x141a20, roughness: 0.18, metalness: 0.75 }, 'metal');
    this.winLitMat = this._mat({ color: 0x201812, emissive: 0xffbe78, emissiveIntensity: 0.3, roughness: 0.4 }, 'metal');
    this.lampHeadMat = this._mat({ color: 0x2a2622, emissive: 0xffd9a0, emissiveIntensity: 2.6, roughness: 0.5 }, 'metal');
    this.redLensMat = this._mat({ color: 0x330806, emissive: 0xff2a1a, emissiveIntensity: 2.8, roughness: 0.3 }, 'metal');
    this.adGlowMat = this._mat({ color: 0x30383f, emissive: 0xcfe4ee, emissiveIntensity: 0.9, roughness: 0.3 }, 'metal');

    this.flagMat = this._mat({ map: this._trackTex(flagTexture()), roughness: 0.9, side: THREE.DoubleSide }, 'wood');
    this.paperMat = this._mat({ map: this._trackTex(paperTexture()), roughness: 0.85, side: THREE.DoubleSide }, 'wood');
    this.barrelMatShared = this._mat({ map: this._trackTex(barrelTexture()), roughness: 0.55, metalness: 0.5 }, 'metal');
    this.skylineMat = this._mat({ color: 0x9aa2ac, roughness: 1 }, 'concrete');
  }

  _buildSkyAndLight() {
    const sky = new Sky();
    sky.scale.setScalar(2000);
    this.group.add(sky);
    const u = sky.material.uniforms;
    u.turbidity.value = 6;
    u.rayleigh.value = 1.8;
    u.mieCoefficient.value = 0.004;
    u.mieDirectionalG.value = 0.8;

    const phi = (90 - 55) * DEG;
    const theta = 205 * DEG;
    this.sunDir = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
    u.sunPosition.value.copy(this.sunDir);

    this.scene.fog = new THREE.Fog(0xc4b5a5, 100, 500);

    this.group.add(new THREE.HemisphereLight(0xc4d2e8, 0x9a8f80, 2.2));

    const sun = new THREE.DirectionalLight(0xfff0d8, 5.0);
    sun.position.copy(this.sunDir).multiplyScalar(175);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -95;
    sc.right = 95;
    sc.top = 95;
    sc.bottom = -95;
    sc.near = 20;
    sc.far = 430;
    sun.shadow.bias = -0.00018;
    sun.shadow.normalBias = 0.04;
    sc.updateProjectionMatrix();
    this.group.add(sun);
    this.group.add(sun.target);

    const fill = new THREE.DirectionalLight(0x93a8cf, 1.1);
    fill.position.set(-sun.position.x, sun.position.y * 0.6, -sun.position.z);
    this.group.add(fill);
  }

  _buildGround() {
    const aMap = this._trackTex(asphaltTexture());
    aMap.repeat.set(32, 32);
    const g = new THREE.PlaneGeometry(126, 126);
    g.rotateX(-Math.PI / 2);
    const ground = new THREE.Mesh(g, this.asphaltMat);
    ground.receiveShadow = true;
    ground.userData.materialType = 'concrete';
    this.group.add(ground);
    this.raycastGroup.add(ground);

    const apronMap = this._trackTex(asphaltTexture());
    apronMap.repeat.set(110, 110);
    this.apronMat = this._mat({ map: apronMap, color: 0x77736c, roughness: 0.98 }, 'concrete');
    const ag = new THREE.PlaneGeometry(900, 900);
    ag.rotateX(-Math.PI / 2);
    const apron = new THREE.Mesh(ag, this.apronMat);
    apron.position.y = -0.06;
    apron.receiveShadow = true;
    apron.userData.materialType = 'concrete';
    this.group.add(apron);
    this.raycastGroup.add(apron);

    const sw = this._bucket('sidewalk', this.paverMat, 'concrete');
    const walks = [
      [-63, 63, 6, 9],
      [-63, 63, -9, -6],
      [6, 9, -6, 6],
      [-9, -6, -6, 6]
    ];
    for (const wd of walks) {
      const w = wd[1] - wd[0];
      const d = wd[3] - wd[2];
      sw.push(this._place(this._fbox(w, 0.12, d, 1 / 1.5), wd[0] + w / 2, 0.06, wd[2] + d / 2));
    }

    const P = this._bucket('paintwhite', this.whitePaint, 'concrete', false);
    const Y = this._bucket('paintyellow', this.yellowPaint, 'concrete', false);
    const dash = (axis, fixed, from, to) => {
      for (let v = from; v < to; v += 4) {
        const len = 2.2;
        if (axis === 'x') Y.push(this._place(this._quad(len, 0.09), v + len / 2, 0.013, fixed));
        else Y.push(this._place(this._quad(0.09, len), fixed, 0.013, v + len / 2));
      }
    };
    dash('x', -0.18, -61, -9.5);
    dash('x', 0.18, -61, -9.5);
    dash('x', -0.18, 9.5, 61);
    dash('x', 0.18, 9.5, 61);
    dash('z', -0.18, -61, -9.5);
    dash('z', 0.18, -61, -9.5);
    dash('z', -0.18, 9.5, 61);
    dash('z', 0.18, 9.5, 61);

    const zebraNS = (zc) => {
      for (let x = -5.2; x <= 5.21; x += 1.15) P.push(this._place(this._quad(0.55, 2.3), x, 0.014, zc));
    };
    const zebraEW = (xc) => {
      for (let z = -5.2; z <= 5.21; z += 1.15) P.push(this._place(this._quad(2.3, 0.55), xc, 0.014, z));
    };
    zebraNS(10.2);
    zebraNS(-10.2);
    zebraEW(10.2);
    zebraEW(-10.2);
    P.push(this._place(this._quad(0.45, 10.8), -8.4, 0.013, 0));
    P.push(this._place(this._quad(0.45, 10.8), 8.4, 0.013, 0));
    P.push(this._place(this._quad(10.8, 0.45), 0, 0.013, -8.4));
    P.push(this._place(this._quad(10.8, 0.45), 0, 0.013, 8.4));
    for (let x = 12; x <= 30; x += 3) P.push(this._place(this._quad(0.12, 4.5), x, 0.014, 58.2));

    const M = this._bucket('manhole', this.manholeMat, 'metal', false);
    for (const mp of [[-3, -14], [3, 14], [14, 0], [-20, 0], [0, -26], [0, 30]]) {
      M.push(this._place(new THREE.CircleGeometry(0.55, 18).rotateX(-Math.PI / 2), mp[0], 0.016, mp[1]));
    }

    const S = this._bucket('stains', this.stainMat, 'concrete', false);
    const stainUV = (qg, s) => {
      const uv = qg.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * s, uv.getY(i) * s);
      return qg;
    };
    const stains = [
      [-24, -3.4, 2.6], [30, 3.2, 3.2], [2.5, 2, 2.2], [-4, -5, 1.8], [8, 3.4, 2.4],
      [-39, -7.6, 1.6], [46, -7.4, 2.8], [17.5, 2.6, 2.0], [-14, -2, 2.2]
    ];
    for (const st of stains) {
      S.push(this._place(stainUV(this._quad(st[2], st[2]), st[2]), st[0], 0.01, st[1]));
    }
    const patches = [[-25, 2.5, 4, 2.6], [8, -17, 3, 5], [26, 3, 5, 3], [-3, 36, 3.4, 2.2]];
    for (const pa of patches) {
      S.push(this._place(stainUV(this._quad(pa[2], pa[3]), 0.4), pa[0], 0.008, pa[1]));
    }
    S.push(this._place(this._quad(124, 0.5), 0, 0.006, 5.7));
    S.push(this._place(this._quad(124, 0.5), 0, 0.006, -5.7));
    for (const gz of [-30, 30]) {
      S.push(this._place(this._quad(0.5, 12), 5.7, 0.006, gz));
      S.push(this._place(this._quad(0.5, 12), -5.7, 0.006, gz));
    }
    this._buckets.stains.renderOrder = 1;
    this._buckets.paintwhite.renderOrder = 2;
    this._buckets.paintyellow.renderOrder = 2;
    this._buckets.manhole.renderOrder = 3;
  }

  _windows(f, t0, t1, y0, y1, opts = {}) {
    const floorH = opts.floorH || 3.05;
    const colW = opts.colW || 2.4;
    const ph = opts.ph || 1.55;
    const litP = opts.litP !== undefined ? opts.litP : 0.15;
    const skipP = 0.06;
    const ry = f.n === 'x' ? Math.PI / 2 : 0;
    for (let fy = y0; fy + ph < y1 - 0.6; fy += floorH) {
      const n = Math.max(1, Math.round((t1 - t0) / colW));
      for (let c = 0; c < n; c++) {
        const t = t0 + (c + 0.5) * ((t1 - t0) / n);
        if (Math.random() < skipP) continue;
        const p = this._facePt(f, t, 0.05);
        this._winItems.push({ x: p[0], y: fy + ph / 2 + 0.35, z: p[1], ry, lit: Math.random() < litP });
      }
    }
  }

  _storefront(f, t0, t1, opts = {}) {
    const T = this._buckets.trim.list;
    const G = this._buckets.storeglass.list;
    const gh = opts.storeH || 2.55;
    const span = t1 - t0;
    const segs = Math.max(2, Math.round(span / 3.1));
    const segW = span / segs;
    for (let i = 0; i <= segs; i++) {
      this._boxOn(T, f, t0 + i * segW, gh / 2 + 0.1, gh + 0.3, 0.14, 0.2, 0.1);
    }
    const doorSeg = opts.door !== undefined ? opts.door : Math.floor(segs / 2);
    for (let i = 0; i < segs; i++) {
      const tc = t0 + (i + 0.5) * segW;
      if (i === doorSeg) {
        this._boxOn(T, f, tc, (gh - 0.15) / 2, gh - 0.3, segW - 0.34, 0.14, 0.06);
      } else {
        this._boxOn(G, f, tc, gh / 2 + 0.1, gh, segW - 0.3, 0.1, 0.07);
      }
    }
    this._boxOn(T, f, (t0 + t1) / 2, gh + 0.28, 0.22, span, 0.24, 0.08);
    if (opts.sign) {
      const bw = Math.min(span * 0.8, 11);
      const key = opts.sign.replace(/\W/g, '');
      const bm = this._signMat(opts.sign, opts);
      const SB = this._bucket('signboard_' + key, bm, 'concrete', false);
      this._boxOn(SB, f, (t0 + t1) / 2, gh + 0.92, 0.95, bw, 0.2, 0.1);
      const sg = new THREE.PlaneGeometry(Math.min(bw - 0.3, 10.4), 0.78);
      let ry = 0;
      if (f.n === 'z') ry = f.dr > 0 ? 0 : Math.PI;
      else ry = f.dr > 0 ? Math.PI / 2 : -Math.PI / 2;
      const sp = this._facePt(f, (t0 + t1) / 2, 0.215);
      sg.rotateY(ry);
      sg.translate(sp[0], gh + 0.92, sp[1]);
      const SM = this._bucket('signtex_' + key, bm, 'concrete', false);
      SM.push(sg);
    }
    if (opts.awn !== undefined && opts.awn !== null) {
      const A = this._bucket(opts.awn ? 'awngreen' : 'awnred', opts.awn ? this.awnGreen : this.awnRed, 'wood');
      const len = span - 0.6;
      let g;
      if (f.n === 'z') {
        g = this._place(this._sbox(len, 0.07, 1.5, len / 2), 0, 0, 0, 0, f.dr > 0 ? 0.5 : -0.5, 0);
      } else {
        g = this._place(this._sbox(1.5, 0.07, len, len / 2), 0, 0, 0, 0, 0, f.dr > 0 ? -0.5 : 0.5);
      }
      const p = this._facePt(f, (t0 + t1) / 2, 0.72);
      g.translate(p[0], gh + 0.32, p[1]);
      A.push(g);
    }
  }

  _building(o) {
    const L = this._buckets['fac_' + o.mat].list;
    const R = this._buckets.roof.list;
    const T = this._buckets.trim.list;
    const w = o.x1 - o.x0;
    const d = o.z1 - o.z0;
    const cx = (o.x0 + o.x1) / 2;
    const cz = (o.z0 + o.z1) / 2;
    const h = o.h;
    const tile = o.tile || 0.25;
    L.push(this._place(this._fbox(w, h, d, tile), cx, h / 2, cz));
    R.push(this._place(this._fbox(w + 0.26, 0.16, d + 0.26, 0.4), cx, h + 0.08, cz));
    const pt = 0.75;
    const pk = 0.3;
    L.push(this._place(this._fbox(w, pt, pk, tile), cx, h + 0.16 + pt / 2, cz + d / 2 - pk / 2));
    L.push(this._place(this._fbox(w, pt, pk, tile), cx, h + 0.16 + pt / 2, cz - d / 2 + pk / 2));
    L.push(this._place(this._fbox(pk, pt, d - pk * 2, tile), cx + w / 2 - pk / 2, h + 0.16 + pt / 2, cz));
    L.push(this._place(this._fbox(pk, pt, d - pk * 2, tile), cx - w / 2 + pk / 2, h + 0.16 + pt / 2, cz));
    T.push(this._place(this._sbox(w + 0.36, 0.1, pk + 0.06), cx, h + 0.16 + pt + 0.04, cz + d / 2));
    T.push(this._place(this._sbox(w + 0.36, 0.1, pk + 0.06), cx, h + 0.16 + pt + 0.04, cz - d / 2));
    T.push(this._place(this._sbox(pk + 0.06, 0.1, d + 0.36), cx + w / 2, h + 0.16 + pt + 0.04, cz));
    T.push(this._place(this._sbox(pk + 0.06, 0.1, d + 0.36), cx - w / 2, h + 0.16 + pt + 0.04, cz));
    this._addCollider(cx, cz, w + 0.3, d + 0.3, h + 1);
    this.minimapRects.push({ x: cx, z: cz, w: w + 0.3, d: d + 0.3 });
    if (o.bulk) {
      T.push(this._place(this._sbox(2.3, 2.1, 2.6), cx + w * 0.18, h + 0.16 + 1.05, cz + d * 0.22));
    }
    if (o.ant) {
      const M = this._buckets.darkmetal.list;
      const ax = cx - w * 0.22;
      const az = cz - d * 0.18;
      M.push(this._place(new THREE.CylinderGeometry(0.045, 0.06, 4.2, 6), ax, h + 0.16 + 2.1, az));
      M.push(this._place(this._sbox(1.3, 0.05, 0.05), ax, h + 3.76, az));
      M.push(this._place(this._sbox(0.9, 0.04, 0.04), ax, h + 3.16, az));
    }
    for (let i = 0; i < (o.ac || 0); i++) {
      this._acSpots.push([
        cx + (i % 2 === 0 ? -1 : 1) * w * 0.24,
        cz + (i < 2 ? -1 : 1) * d * 0.26,
        h + 0.16,
        rand(0, Math.PI * 2)
      ]);
    }
    if (o.tank) {
      this._tankSpots.push([cx + w * 0.28, cz - d * 0.24, h + 0.16]);
    }
  }

  _buildAllBuildings() {
    const S = this._buckets.storeglass.list;

    this._building({ x0: -37, x1: -9, z0: -63, z1: -9, h: 22, mat: 'warm', ac: 2, tank: true, ant: true, bulk: true });
    this._storefront({ n: 'z', at: -9, dr: 1 }, -34, -13, { sign: 'GRAND HOTEL', awn: 0, door: 3 });
    this._storefront({ n: 'x', at: -9, dr: 1 }, -34, -13, { door: 2 });
    this._windows({ n: 'z', at: -9, dr: 1 }, -35, -11, 4.6, 21.4);
    this._windows({ n: 'x', at: -9, dr: 1 }, -60, -13, 4.6, 21.4);
    this._windows({ n: 'x', at: -37, dr: -1 }, -58, -15, 4.6, 21.4, { litP: 0.1 });

    this._building({ x0: -63, x1: -41, z0: -63, z1: -9, h: 14, mat: 'brick', ac: 1, tile: 1 / 3.4, bulk: true });
    this._storefront({ n: 'z', at: -9, dr: 1 }, -61, -43, { sign: 'LAUNDRY', awn: 1, bg: '#2e3a30', fg: '#e6e2d2' });
    this._windows({ n: 'z', at: -9, dr: 1 }, -62, -42, 4.6, 13.4, { colW: 2.2 });
    this._windows({ n: 'x', at: -41, dr: 1 }, -58, -12, 4.6, 13.4, { colW: 2.2, litP: 0.1 });

    this._building({ x0: 9, x1: 35, z0: -45, z1: -9, h: 17, mat: 'tan', ac: 2, ant: true });
    this._storefront({ n: 'z', at: -9, dr: 1 }, 11, 33, { sign: 'MARKET', awn: 0, storeH: 2.9, door: 4 });
    this._storefront({ n: 'x', at: 9, dr: -1 }, -43, -11, { door: 2 });
    this._windows({ n: 'z', at: -9, dr: 1 }, 12, 32, 4.8, 16.4);
    this._windows({ n: 'x', at: 9, dr: -1 }, -43, -11, 4.8, 16.4);
    this._windows({ n: 'z', at: -45, dr: -1 }, 12, 32, 5.2, 16.4, { litP: 0.08 });
    this._windows({ n: 'x', at: 35, dr: 1 }, -42, -12, 5.2, 16.4, { litP: 0.08 });

    this._building({ x0: 39, x1: 63, z0: -63, z1: -9, h: 12, mat: 'corr', ac: 1, tile: 1 / 2.4 });
    const D = this._buckets.fac_corr.list;
    for (let i = 0; i < 3; i++) {
      this._boxOn(D, { n: 'z', at: -9, dr: 1 }, 44 + i * 5.4, 1.7, 3.4, 3.0, 0.14, 0.08);
    }
    this._boxOn(S, { n: 'z', at: -9, dr: 1 }, 59, 2.0, 3.6, 4.4, 0.12, 0.07);
    this._storefront({ n: 'z', at: -9, dr: 1 }, 40.4, 43.2, { sign: 'DEPOT', bg: '#3a3f45', fg: '#ffd23f' });
    this._windows({ n: 'z', at: -9, dr: 1 }, 44, 60, 6.8, 11.4, { ph: 1.2, litP: 0.1 });

    this._building({ x0: 9, x1: 33, z0: 9, z1: 47, h: 16, mat: 'warm', ac: 2, bulk: true });
    this._storefront({ n: 'z', at: 9, dr: -1 }, 11, 31, { sign: 'PHARMACY', cross: true, bg: '#20302a', fg: '#eae6d6', awn: 1 });
    this._storefront({ n: 'x', at: 9, dr: -1 }, 12, 30, { door: 2 });
    this._windows({ n: 'z', at: 9, dr: -1 }, 12, 30, 4.6, 15.4);
    this._windows({ n: 'x', at: 9, dr: -1 }, 12, 44, 4.6, 15.4);
    this._windows({ n: 'x', at: 33, dr: 1 }, 12, 44, 4.6, 15.4, { litP: 0.12 });
    this._windows({ n: 'z', at: 47, dr: 1 }, 12, 30, 4.6, 15.4, { litP: 0.08 });

    this._building({ x0: 37, x1: 63, z0: 9, z1: 55, h: 19, mat: 'blue', ac: 2, tank: true, ant: true });
    this._storefront({ n: 'z', at: 9, dr: -1 }, 39, 61, { sign: 'BANK', storeH: 3.3, bg: '#2b3038', fg: '#d8e2ea', door: 2 });
    this._windows({ n: 'z', at: 9, dr: -1 }, 40, 60, 5.5, 18.4, { colW: 2.6 });
    this._windows({ n: 'x', at: 37, dr: -1 }, 12, 52, 4.6, 18.4, { colW: 2.6 });
    this._windows({ n: 'x', at: 63, dr: 1 }, 12, 52, 4.6, 18.4, { colW: 2.6, litP: 0.12 });
    this._windows({ n: 'z', at: 55, dr: 1 }, 40, 60, 4.6, 18.4, { colW: 2.6, litP: 0.1 });

    this._building({ x0: -49, x1: -9, z0: 9, z1: 33, h: 11, mat: 'brick', ac: 1, tile: 1 / 3.4 });
    this._storefront({ n: 'z', at: 9, dr: -1 }, -46, -12, { sign: 'CAFÉ', awn: 0, bg: '#402318', fg: '#f0dfc0', door: 3 });
    this._storefront({ n: 'x', at: -9, dr: 1 }, 11, 31, { door: 2 });
    this._windows({ n: 'z', at: 9, dr: -1 }, -45, -13, 4.4, 10.4, { ph: 1.4 });
    this._windows({ n: 'x', at: -9, dr: 1 }, 12, 30, 4.4, 10.4, { ph: 1.4 });
    this._windows({ n: 'z', at: 33, dr: 1 }, -46, -12, 4.4, 10.4, { ph: 1.4, litP: 0.08 });

    this._building({ x0: -63, x1: -53, z0: 9, z1: 45, h: 15, mat: 'tan', ac: 1 });
    this._storefront({ n: 'z', at: 9, dr: -1 }, -61.5, -54.5, { sign: 'BAR', bg: '#1d2126', fg: '#ff9d3c', awn: 1 });
    this._windows({ n: 'z', at: 9, dr: -1 }, -62, -55, 4.6, 14.4);
    this._windows({ n: 'x', at: -53, dr: 1 }, 12, 42, 4.6, 14.4, { litP: 0.1 });

    this._cover(-23, -10.6, 0, -1);
    this._cover(-14, -10.6, 0, -1);
    this._cover(-10.6, -24, -1, 0);
    this._cover(-10.6, -34, -1, 0);
    this._cover(22, -10.6, 0, -1);
    this._cover(10.6, -28, -1, 0);
    this._cover(52, -10.6, 0, -1);
    this._cover(21, 10.6, 0, 1);
    this._cover(10.6, 28, -1, 0);
    this._cover(50, 10.6, 0, 1);
    this._cover(-28, 10.6, 0, 1);
    this._cover(-10.6, 22, 1, 0);
    this._cover(-58, 10.6, 0, 1);
    this._cover(-39.2, -20, 1, 0);
    this._cover(37.2, -26, -1, 0);
    this._cover(35, 26, 1, 0);
    this._cover(-51, 24, 1, 0);
  }

  _buildRooftopClutter() {
    if (this._acSpots.length) {
      const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1.7, 0.95, 1.15), this.darkMetal, this._acSpots.length);
      const m4 = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const eu = new THREE.Euler();
      this._acSpots.forEach((s, i) => {
        eu.set(0, s[3], 0);
        q.setFromEuler(eu);
        m4.compose(new THREE.Vector3(s[0], s[2] + 0.48, s[1]), q, new THREE.Vector3(1, 1, 1));
        im.setMatrixAt(i, m4);
      });
      im.castShadow = true;
      im.frustumCulled = false;
      im.userData.materialType = 'metal';
      this.group.add(im);
      this.raycastGroup.add(im);
    }

    if (this._tankSpots.length) {
      const tm = this._mat({ map: this._trackTex(corrugatedTexture()), color: 0x7d5a44, roughness: 0.75, metalness: 0.4 }, 'metal');
      const im = new THREE.InstancedMesh(new THREE.CylinderGeometry(1.25, 1.25, 2.3, 12), tm, this._tankSpots.length);
      const m4 = new THREE.Matrix4();
      this._tankSpots.forEach((s, i) => {
        m4.compose(new THREE.Vector3(s[0], s[2] + 1.5, s[1]), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
        im.setMatrixAt(i, m4);
      });
      im.castShadow = true;
      im.frustumCulled = false;
      im.userData.materialType = 'metal';
      this.group.add(im);
      this.raycastGroup.add(im);
      const M = this._buckets.darkmetal.list;
      for (const s of this._tankSpots) {
        for (const leg of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) {
          M.push(this._place(new THREE.CylinderGeometry(0.06, 0.06, 0.85, 5), s[0] + leg[0], s[2] + 0.42, s[1] + leg[1]));
        }
      }
    }
  }

  _finalizeWindows() {
    if (!this._winItems.length) return;
    const pg = new THREE.BoxGeometry(1.15, 1.55, 0.07);
    const dark = [];
    const lit = [];
    for (const w of this._winItems) (w.lit ? lit : dark).push(w);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const eu = new THREE.Euler();
    const mk = (items, mat) => {
      const im = new THREE.InstancedMesh(pg, mat, items.length);
      items.forEach((w, i) => {
        eu.set(0, w.ry, 0);
        q.setFromEuler(eu);
        m4.compose(new THREE.Vector3(w.x, w.y, w.z), q, new THREE.Vector3(1, 1, 1));
        im.setMatrixAt(i, m4);
      });
      im.frustumCulled = false;
      im.userData.materialType = 'metal';
      this.group.add(im);
      this.raycastGroup.add(im);
    };
    mk(dark, this.winDarkMat);
    mk(lit, this.winLitMat);
  }

  _buildScaffold() {
    const M = this._buckets.darkmetal.list;
    const W = this._buckets.wood.list;
    const F = this._bucket('netting', this.fenceMat, 'metal', false);
    const H = this._bucket('hoard', this.hoardMat, 'metal');
    const x0 = 14;
    const x1 = 29;
    const zf = -8.75;
    const zb = -7.65;
    const top = 16.6;
    for (let x = x0; x <= x1 + 0.01; x += 2.5) {
      M.push(this._place(new THREE.CylinderGeometry(0.05, 0.05, top, 6), x, top / 2, zf));
      M.push(this._place(new THREE.CylinderGeometry(0.05, 0.05, top, 6), x, top / 2, zb));
    }
    for (let y = 2.4; y < top - 0.1; y += 2.4) {
      M.push(this._place(this._sbox(x1 - x0, 0.07, 0.07), (x0 + x1) / 2, y, zf));
      M.push(this._place(this._sbox(x1 - x0, 0.07, 0.07), (x0 + x1) / 2, y, zb));
      M.push(this._place(this._sbox(0.07, 0.07, zb - zf), x0, y, (zf + zb) / 2));
      M.push(this._place(this._sbox(0.07, 0.07, zb - zf), x1, y, (zf + zb) / 2));
      if (y < 3 || Math.abs(y % 4.8) < 0.01 || Math.abs((y - 4.8) % 4.8) < 0.01 || y === 7.2 || y === 12) {
        W.push(this._place(this._sbox(x1 - x0, 0.06, 1.05, 3), (x0 + x1) / 2, y + 0.05, (zf + zb) / 2));
        W.push(this._place(this._sbox(x1 - x0, 0.16, 0.06), (x0 + x1) / 2, y + 0.55, zb));
      }
    }
    M.push(this._place(this._sbox(0.07, 7.2, 0.07), x0, 3.6, zf, 0, 0, 0.52));
    M.push(this._place(this._sbox(0.07, 7.2, 0.07), x1, 3.6, zf, 0, 0, -0.52));
    for (let i = 0; i < 4; i++) {
      F.push(this._place(new THREE.PlaneGeometry(3.4, 3.6), x0 + 2 + i * 3.6, 13.4, (zf + zb) / 2));
    }
    this._addCollider((x0 + x1) / 2, (zf + zb) / 2, x1 - x0, 1.3, top);
    this._boxOn(H, { n: 'z', at: -9, dr: 1 }, 11.5, 1.25, 2.5, 6.5, 0.12, 0.06);
    this._boxOn(H, { n: 'z', at: -9, dr: 1 }, 31.5, 1.25, 2.5, 4.0, 0.12, 0.06);
    this._addCollider(11.5, -8.94, 6.5, 0.24, 2.5);
    this._addCollider(31.5, -8.94, 4.0, 0.24, 2.5);
    this._cover(12, -7.3, 0, -1);
    this._cover(31, -7.3, 0, -1);
  }

  _hoardRun(ax, fixed, from, to, h = 2.7) {
    const L = this._buckets.hoard.list;
    const T = this._buckets.trim.list;
    const len = to - from;
    const mid = (from + to) / 2;
    const along = ax === 'x';
    L.push(
      along
        ? this._place(this._fbox(len, h, 0.14, 1 / 2.4), mid, h / 2, fixed)
        : this._place(this._fbox(0.14, h, len, 1 / 2.4), fixed, h / 2, mid)
    );
    const posts = Math.ceil(len / 3);
    for (let i = 0; i <= posts; i++) {
      const p = from + (len * i) / posts;
      if (along) T.push(this._place(this._sbox(0.12, h + 0.2, 0.2), p, (h + 0.2) / 2, fixed));
      else T.push(this._place(this._sbox(0.2, h + 0.2, 0.12), fixed, (h + 0.2) / 2, p));
    }
    this._addCollider(mid, fixed, along ? len : 0.5, along ? 0.5 : len, h);
    this.minimapRects.push({ x: mid, z: fixed, w: along ? len : 0.8, d: along ? 0.8 : len });
  }

  _fenceRun(ax, fixed, from, to, gaps = []) {
    const F = this._bucket('cfence', this.fenceMat, 'metal', false);
    const T = this._buckets.trim.list;
    const segs = [];
    let cur = from;
    const sorted = gaps.slice().sort((a, b) => a[0] - b[0]);
    for (const gp of sorted) {
      if (gp[0] > cur) segs.push([cur, gp[0]]);
      cur = gp[1];
    }
    if (cur < to) segs.push([cur, to]);
    for (const sg of segs) {
      const len = sg[1] - sg[0];
      if (len < 0.3) continue;
      const mid = (sg[0] + sg[1]) / 2;
      const pgm = new THREE.PlaneGeometry(len, 2.1);
      if (ax === 'x') pgm.rotateY(Math.PI / 2);
      pgm.translate(ax === 'x' ? fixed : mid, 1.05, ax === 'x' ? mid : fixed);
      F.push(pgm);
      this._addCollider(mid, fixed, ax === 'x' ? 0.24 : len, ax === 'x' ? len : 0.24, 2.1);
      const posts = Math.ceil(len / 2.6);
      for (let i = 0; i <= posts; i++) {
        const p = sg[0] + (len * i) / posts;
        if (ax === 'x') T.push(this._place(new THREE.CylinderGeometry(0.045, 0.045, 2.3, 6), fixed, 1.15, p));
        else T.push(this._place(new THREE.CylinderGeometry(0.045, 0.045, 2.3, 6), p, 1.15, fixed));
      }
      this.minimapRects.push({ x: ax === 'x' ? fixed : mid, z: ax === 'x' ? mid : fixed, w: ax === 'x' ? 0.5 : len, d: ax === 'x' ? len : 0.5 });
    }
  }

  _buildPerimeter() {
    this._hoardRun('z', 62.4, -53, 63, 3.0);
    this._hoardRun('z', -62.4, 9, 39, 3.0);
    this._hoardRun('z', -62.4, -41, -37, 2.7);
    this._hoardRun('x', 62.4, -9, 9, 3.0);
    this._hoardRun('x', 62.4, 55, 63, 2.7);
    this._hoardRun('x', -62.4, -9, 9, 3.0);
    this._hoardRun('x', -62.4, 45, 63, 2.7);

    const pg = new THREE.PlaneGeometry(1.05, 1.5);
    const im = new THREE.InstancedMesh(pg, this.posterMat, 14);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const eu = new THREE.Euler();
    const col = new THREE.Color();
    const posterCols = [0x8a3d33, 0x3d5a80, 0xb0a084, 0x5d6e50, 0x767066, 0x9c8a3c];
    const spots = [
      ['z', 62.28, -40], ['z', 62.28, 12], ['z', 62.28, 30], ['z', 62.28, 50],
      ['z', -62.28, 20], ['z', -62.28, 34],
      ['x', 62.28, -4], ['x', 62.28, 4], ['x', -62.28, -3], ['x', -62.28, 4],
      ['x', -62.28, 52], ['x', 62.28, 59], ['z', -62.28, -30], ['z', -62.28, -12]
    ];
    spots.forEach((s, i) => {
      let ry;
      if (s[0] === 'x') ry = s[1] > 0 ? Math.PI / 2 : -Math.PI / 2;
      else ry = s[1] > 0 ? 0 : Math.PI;
      eu.set(rand(-0.05, 0.05), ry + rand(-0.06, 0.06), rand(-0.03, 0.03));
      q.setFromEuler(eu);
      m4.compose(new THREE.Vector3(s[0] === 'x' ? s[1] : s[2], 1.55, s[0] === 'x' ? s[2] : s[1]), q, new THREE.Vector3(1, 1, 1));
      im.setMatrixAt(i, m4);
      col.setHex(posterCols[i % posterCols.length]).offsetHSL(rand(-0.01, 0.01), rand(-0.06, 0.02), rand(-0.07, 0.04));
      im.setColorAt(i, col);
    });
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.frustumCulled = false;
    this.group.add(im);

    for (const rd of [['x', 60.6], ['x', -60.6]]) {
      this._fenceRun(rd[0], rd[1], -5.5, 5.5);
    }
    for (const rd of [['z', 60.6], ['z', -60.6]]) {
      this._fenceRun(rd[0], rd[1], -5.5, 5.5);
    }

    this._fenceRun('x', 9.2, -63, -45, [[-56, -52.5]]);
    this._fenceRun('z', -45.2, 35, 39, [[35.7, 38.3]]);
    this._fenceRun('x', -9.2, 33, 38.5);
    this._fenceRun('x', -9.2, 52, 63);

    const T = this._buckets.trim.list;
    T.push(this._place(this._fbox(0.35, 0.95, 15.5, 1), 9.35, 0.475, 55));
    this._addCollider(9.35, 55, 0.5, 15.5, 0.95);
  }

  _buildConstructionYard() {
    const bagGeo = new THREE.BoxGeometry(0.62, 0.28, 0.4);
    const bagSpots = [];
    const bagStack = (bx, bz, rows) => {
      for (let r = 0; r < rows; r++) {
        const n = 3 - (r % 2);
        for (let i = 0; i <= n; i++) {
          bagSpots.push({ x: bx + (i - n / 2) * 0.66 + rand(-0.03, 0.03), y: 0.14 + r * 0.29, z: bz + rand(-0.04, 0.04), ry: rand(-0.15, 0.15) + (r % 2) * 0.2 });
        }
      }
    };
    bagStack(14, -52, 4);
    bagStack(20, -50, 3);
    bagStack(24, -58, 2);
    const im = new THREE.InstancedMesh(bagGeo, this.cementMat, bagSpots.length);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const eu = new THREE.Euler();
    bagSpots.forEach((s, i) => {
      eu.set(0, s.ry, 0);
      q.setFromEuler(eu);
      m4.compose(new THREE.Vector3(s.x, s.y, s.z), q, new THREE.Vector3(1, 1, 1));
      im.setMatrixAt(i, m4);
    });
    im.castShadow = true;
    im.receiveShadow = true;
    im.frustumCulled = false;
    im.userData.materialType = 'concrete';
    this.group.add(im);
    this.raycastGroup.add(im);
    this._addCollider(14, -52, 2.3, 1.0, 1.25);
    this._addCollider(20, -50, 2.3, 1.0, 0.95);
    this._cover(14, -50.6, 0, 1);
    this._cover(20, -51.4, 0, -1);

    const RB = this._buckets.rust.list;
    const rebarBundle = (bx, bz, lean) => {
      for (let i = 0; i < 7; i++) {
        const g = new THREE.CylinderGeometry(0.014, 0.014, 3.4, 5);
        g.rotateZ(lean + rand(-0.06, 0.06));
        g.translate(bx + i * 0.045, 1.55, bz + rand(-0.05, 0.05));
        RB.push(g);
      }
      RB.push(this._place(new THREE.TorusGeometry(0.14, 0.02, 5, 10), bx + 0.14, 1.1, bz, 0, Math.PI / 2 - lean, 0));
    };
    rebarBundle(26.5, -54.5, 0.32);
    rebarBundle(27.3, -53.6, 0.26);
    this._addCollider(26.9, -54, 0.8, 1.6, 1.2);
    this._cover(26, -52.6, 0, 1);

    const coneGeo = mergeGeometries([
      new THREE.ConeGeometry(0.19, 0.58, 9).translate(0, 0.33, 0),
      new THREE.BoxGeometry(0.42, 0.05, 0.42).translate(0, 0.025, 0)
    ], false);
    const coneSpots = [
      [10.6, -47], [11.2, -50.5], [10.6, -54.5], [11.2, -57.5],
      [36.8, -43.5], [34.2, -43.5],
      [60.4, -3.4], [60.4, 3.6], [-60.4, -3.4], [-60.4, 3.6],
      [3.4, 60.4], [-3.4, 60.4], [3.4, -60.4], [-3.4, -60.4]
    ];
    const cim = new THREE.InstancedMesh(coneGeo, this.coneMat, coneSpots.length);
    coneSpots.forEach((s, i) => {
      eu.set(0, rand(0, Math.PI * 2), 0);
      q.setFromEuler(eu);
      m4.compose(new THREE.Vector3(s[0], 0, s[1]), q, new THREE.Vector3(1, 1, 1));
      cim.setMatrixAt(i, m4);
    });
    cim.castShadow = true;
    cim.frustumCulled = false;
    this.group.add(cim);
  }

  _spool(bx, bz, ry, standing) {
    const W = this._buckets.wood.list;
    const M = this._buckets.darkmetal.list;
    const discG = () => new THREE.CylinderGeometry(1.05, 1.05, 0.16, 14);
    if (standing) {
      W.push(this._place(discG(), bx, 1.05, bz - 0.42, ry));
      W.push(this._place(discG(), bx, 1.05, bz + 0.42, ry));
      W.push(this._place(new THREE.CylinderGeometry(0.34, 0.34, 0.86, 10), bx, 1.05, bz, ry));
      M.push(this._place(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 6), bx, 1.05, bz, 0, Math.PI / 2, ry));
      this._addCollider(bx, bz, 1.7, 1.7, 2.1);
    } else {
      W.push(this._place(discG(), bx - 0.42, 1.05, bz, ry, 0, Math.PI / 2));
      W.push(this._place(discG(), bx + 0.42, 1.05, bz, ry, 0, Math.PI / 2));
      W.push(this._place(new THREE.CylinderGeometry(0.34, 0.34, 0.86, 10), bx, 1.05, bz, ry, 0, Math.PI / 2));
      this._addCollider(bx, bz, 2.3, 1.5, 2.1);
    }
    this._cover(bx + 1.7, bz, 1, 0);
  }

  _palletStack(bx, bz, n) {
    const W = this._buckets.wood.list;
    for (let i = 0; i < n; i++) {
      const ry = rand(-0.22, 0.22);
      W.push(this._place(this._sbox(1.25, 0.045, 1.25, 1.2), bx, 0.06 + i * 0.17, bz, ry));
      W.push(this._place(this._sbox(1.15, 0.1, 0.14), bx, 0.12 + i * 0.17, bz, ry, 0, Math.PI / 2));
    }
    if (n >= 2) this._addCollider(bx, bz, 1.3, 1.3, n * 0.17 + 0.12);
    this._cover(bx + 1.2, bz + 0.6, 1, 0);
  }

  _dumpster(bx, bz, ry, blue) {
    const B = this._bucket(blue ? 'dumpB' : 'dumpG', blue ? this.dumpBlue : this.dumpGreen, 'metal');
    B.push(this._place(new THREE.BoxGeometry(1.95, 1.15, 1.12), bx, 0.62, bz, ry));
    const lid = new THREE.BoxGeometry(1.95, 0.07, 1.1);
    lid.translate(0, 0.04, 0);
    B.push(this._place(lid, bx, 1.24, bz, ry, -0.45, 0));
    for (const wx of [-0.72, 0.72]) {
      const wg = new THREE.CylinderGeometry(0.09, 0.09, 0.08, 8);
      wg.rotateZ(Math.PI / 2);
      wg.translate(wx, -0.5, 0);
      B.push(this._place(wg, bx, 0.12, bz, ry));
    }
    const c = Math.abs(Math.cos(ry));
    const s = Math.abs(Math.sin(ry));
    const w = 2.0 * c + 1.16 * s;
    const d = 2.0 * s + 1.16 * c;
    this._addCollider(bx, bz, w, d, 1.3);
    this.minimapRects.push({ x: bx, z: bz, w: w, d: d });
    const nx = Math.sin(ry);
    const nz = Math.cos(ry);
    this._cover(bx + nz * 1.5, bz - nx * 1.5, nz, -nx);
    this._cover(bx - nz * 1.5, bz + nx * 1.5, -nz, nx);
  }

  _trashCluster(bx, bz) {
    const B = this._bucket('trash', this.bagMat, 'sand');
    for (let i = 0; i < 4; i++) {
      const g = new THREE.SphereGeometry(rand(0.22, 0.34), 8, 6);
      g.scale(1, 0.72, 1);
      B.push(this._place(g, bx + rand(-0.7, 0.7), 0.19, bz + rand(-0.6, 0.6)));
    }
    this._cover(bx + 1.4, bz, 1, 0);
  }

  _crate(bx, bz, s, ry, mil) {
    const L = this._bucket(mil ? 'mil' : 'wood', mil ? this.milMat : this.woodMat, 'wood');
    L.push(this._place(this._sbox(s, s, s, s * 0.85), bx, s / 2, bz, ry));
    this._addCollider(bx, bz, s + 0.1, s + 0.1, s);
    this.minimapRects.push({ x: bx, z: bz, w: s + 0.2, d: s + 0.2 });
    this._cover(bx, bz + s / 2 + 0.9, 0, 1);
  }

  _buildRubbleLot() {
    const T = this._buckets.trim.list;
    const RB = this._buckets.rust.list;
    const eff = (w, d, ry) => [Math.abs(w * Math.cos(ry)) + Math.abs(d * Math.sin(ry)), Math.abs(w * Math.sin(ry)) + Math.abs(d * Math.cos(ry))];
    const slabs = [
      [-30, 44, 6, 1.0, 5, 0.3],
      [-26.5, 47, 3.6, 0.62, 3.6, -0.25],
      [-32.5, 47.8, 4.2, 0.45, 3.2, 0.15]
    ];
    for (const sb of slabs) {
      T.push(this._place(this._fbox(sb[2], sb[3], sb[4], 0.5), sb[0], sb[3] / 2, sb[1], sb[5]));
      const e = eff(sb[2], sb[4], sb[5]);
      this._addCollider(sb[0], sb[1], e[0], e[1], sb[3]);
    }
    this.minimapRects.push({ x: -30, z: 45.5, w: 11, d: 10 });
    this._cover(-27, 41.2, 0, -1);
    this._cover(-33.5, 43, -1, 0);
    this._cover(-23, 47.5, 0.7, -0.7);

    const stubs = [
      [-41.5, 40, 0.55, 2.9, 5.2, 90],
      [-20, 54.5, 6.2, 2.2, 0.55, 15],
      [-35, 57.5, 4.4, 1.5, 0.55, -8],
      [-46, 48.5, 0.55, 2.3, 4.0, 24]
    ];
    for (const st of stubs) {
      const ry = st[5] * DEG;
      T.push(this._place(this._fbox(st[2], st[3], st[4], 0.5), st[0], st[3] / 2, st[1], ry));
      const e = eff(st[2], st[4], ry);
      this._addCollider(st[0], st[1], e[0] + 0.2, e[1] + 0.2, st[3]);
      for (let i = 0; i < 3; i++) {
        const rg = new THREE.CylinderGeometry(0.016, 0.016, rand(0.8, 1.5), 4);
        RB.push(this._place(rg, st[0] + rand(-st[2] / 2, st[2] / 2), st[3] + 0.35, st[1] + rand(-st[4] / 2, st[4] / 2), rand(0, Math.PI), rand(-0.4, 0.4), rand(-0.4, 0.4)));
      }
      const px = Math.abs(Math.cos(ry)) > Math.abs(Math.sin(ry)) ? 0 : 2.2;
      const pz = Math.abs(Math.cos(ry)) > Math.abs(Math.sin(ry)) ? 2.2 : 0;
      this._cover(st[0] + px, st[1] + pz, px ? Math.sign(px) : 0, pz ? Math.sign(pz) : 0);
    }
    this._cover(-14.5, 44, -1, 0);
    this._cover(-24, 36.8, 0, 1);
  }

  _buildStreetFurniture() {
    const M = this._buckets.darkmetal.list;
    const T = this._buckets.trim.list;
    const LH = this._bucket('lamphead', this.lampHeadMat, 'metal', false);
    this._lampLights = [];
    const lamps = [
      [-10.5, 7.5, true],
      [10.5, -7.5, true],
      [30, 7.5, false],
      [-30, -7.5, false],
      [7.5, 30, false],
      [-7.5, -30, false]
    ];
    for (const lp of lamps) {
      const lx = lp[0];
      const lz = lp[1];
      M.push(this._place(new THREE.CylinderGeometry(0.09, 0.12, 6.2, 8), lx, 3.22, lz));
      let ax = 0;
      let az = 0;
      if (Math.abs(lx) > 9) ax = lx > 0 ? -1 : 1;
      else az = lz > 0 ? -1 : 1;
      M.push(this._place(this._sbox(ax ? 1.8 : 0.13, 0.1, ax ? 0.13 : 1.8), lx + ax * 0.9, 6.3, lz + az * 0.9));
      const hx = lx + ax * 1.7;
      const hz = lz + az * 1.7;
      LH.push(ax ? this._place(this._sbox(0.28, 0.17, 0.66), hx, 6.18, hz) : this._place(this._sbox(0.66, 0.17, 0.28), hx, 6.18, hz));
      if (lp[2]) {
        const pl = new THREE.PointLight(0xffc37e, 24, 17, 2);
        pl.position.set(hx, 6.0, hz);
        this.group.add(pl);
        this._lampLights.push(pl);
      }
      this._addCollider(lx, lz, 0.36, 0.36, 6.4);
    }

    const RL = this._bucket('redlens', this.redLensMat, 'metal', false);
    for (const u of [[-7.6, -7.6, 45], [7.6, 7.6, 225]]) {
      const ry = u[2] * DEG;
      const dx = Math.sin(ry);
      const dz = Math.cos(ry);
      M.push(this._place(new THREE.CylinderGeometry(0.08, 0.11, 5.6, 8), u[0], 2.92, u[1]));
      M.push(this._place(this._sbox(0.5, 0.14, 0.5), u[0], 0.19, u[1]));
      M.push(this._place(this._sbox(0.12, 0.09, 3.4), u[0] + dx * 1.7, 5.55, u[1] + dz * 1.7, ry));
      const ex = u[0] + dx * 3.4;
      const ez = u[1] + dz * 3.4;
      M.push(this._place(this._sbox(0.36, 0.98, 0.28), ex, 4.95, ez, ry));
      for (let i = 0; i < 3; i++) {
        const lg = new THREE.CylinderGeometry(0.095, 0.095, 0.05, 10);
        lg.rotateX(Math.PI / 2);
        lg.translate(0, 0, 0.16);
        if (i === 0) RL.push(this._place(lg, ex, 5.25 - i * 0.31, ez, ry));
        else M.push(this._place(lg, ex, 5.25 - i * 0.31, ez, ry));
      }
      this._addCollider(u[0], u[1], 0.34, 0.34, 5.8);
    }

    const S = this._buckets.storeglass.list;
    const W = this._buckets.wood.list;
    const AG = this._bucket('adglow', this.adGlowMat, 'metal', false);
    const bx = -24;
    const bz = 7.95;
    for (const p of [[bx - 1.95, bz - 0.62], [bx + 1.95, bz - 0.62], [bx - 1.95, bz + 0.62], [bx + 1.95, bz + 0.62]]) {
      M.push(this._place(this._sbox(0.09, 2.55, 0.09), p[0], 1.39, p[1]));
    }
    T.push(this._place(this._sbox(4.35, 0.08, 1.75), bx, 2.68, bz, 0, 0.06));
    S.push(this._place(new THREE.BoxGeometry(4.15, 2.15, 0.06).translate(0, 1.32, 0), bx, 0.12, bz + 0.64));
    S.push(this._place(new THREE.BoxGeometry(0.06, 2.15, 1.15).translate(0, 1.32, 0), bx - 1.98, 0.12, bz));
    S.push(this._place(new THREE.BoxGeometry(0.06, 2.15, 1.15).translate(0, 1.32, 0), bx + 1.98, 0.12, bz));
    W.push(this._place(this._sbox(3.3, 0.07, 0.44, 1.6), bx, 0.58, bz + 0.3));
    T.push(this._place(this._sbox(0.08, 0.42, 0.4), bx - 1.4, 0.33, bz + 0.3));
    T.push(this._place(this._sbox(0.08, 0.42, 0.4), bx + 1.4, 0.33, bz + 0.3));
    AG.push(this._place(new THREE.PlaneGeometry(1.15, 1.65).rotateY(Math.PI), bx + 1.2, 1.5, bz + 0.69));
    this._addCollider(bx, bz + 0.64, 4.2, 0.24, 2.2);
    this._addCollider(bx, bz + 0.3, 3.4, 0.5, 0.62);
    this.minimapRects.push({ x: bx, z: bz, w: 4.4, d: 1.8 });
    this._cover(bx - 2.6, bz - 0.6, 0, -1);
    this._cover(bx + 2.6, bz - 0.6, 0, -1);

    const HY = this._bucket('hydrant', this.hydrantMat, 'metal');
    for (const hp of [[-11, 6.4], [11, -6.4], [-7.5, -22]]) {
      HY.push(this._place(new THREE.CylinderGeometry(0.13, 0.16, 0.6, 9), hp[0], 0.42, hp[1]));
      HY.push(this._place(new THREE.SphereGeometry(0.13, 8, 6), hp[0], 0.76, hp[1]));
      HY.push(this._place(new THREE.CylinderGeometry(0.045, 0.045, 0.38, 6).rotateZ(Math.PI / 2), hp[0], 0.56, hp[1]));
      this._addCollider(hp[0], hp[1], 0.34, 0.34, 0.85);
    }

    const bollards = [];
    for (let z = 48; z <= 60.1; z += 2.4) bollards.push([10.4, z]);
    bollards.push([-7.5, -13], [7.5, 13], [-8.6, 41.5], [-8.6, 49.5]);
    const bim = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.085, 0.105, 0.8, 8), this.bollardMat, bollards.length);
    {
      const m4 = new THREE.Matrix4();
      bollards.forEach((b, i) => {
        m4.compose(new THREE.Vector3(b[0], 0.52, b[1]), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
        bim.setMatrixAt(i, m4);
        this._addCollider(b[0], b[1], 0.22, 0.22, 0.85);
      });
    }
    bim.castShadow = true;
    bim.frustumCulled = false;
    bim.userData.materialType = 'metal';
    this.group.add(bim);
    this.raycastGroup.add(bim);

    const planters = [[-16, -7.5], [33, -7.5], [-14, 7.5], [12, 7.5]];
    const foliage = [];
    for (const pp of planters) {
      T.push(this._place(this._fbox(1.5, 0.55, 0.78, 0.7), pp[0], 0.12 + 0.275, pp[1]));
      T.push(this._place(this._fbox(1.34, 0.1, 0.62, 0.7), pp[0], 0.66, pp[1]));
      W.push(this._place(new THREE.CylinderGeometry(0.055, 0.075, 1.6, 7), pp[0], 1.45, pp[1]));
      foliage.push({ x: pp[0], y: 2.5, z: pp[1], s: rand(0.5, 0.62), c: 0x4a5d38 });
      foliage.push({ x: pp[0] + rand(-0.18, 0.18), y: 2.92, z: pp[1] + rand(-0.15, 0.15), s: rand(0.34, 0.44), c: 0x5a6b40 });
      this._addCollider(pp[0], pp[1], 1.6, 0.88, 0.7);
      this._cover(pp[0] + 1.3, pp[1], 1, 0);
      this._cover(pp[0] - 1.3, pp[1], -1, 0);
    }
    const fim = new THREE.InstancedMesh(new THREE.SphereGeometry(0.6, 8, 6), this.foliageMat, foliage.length);
    {
      const m4 = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const eu = new THREE.Euler();
      const col = new THREE.Color();
      foliage.forEach((f, i) => {
        eu.set(rand(0, 3), rand(0, 3), rand(0, 3));
        q.setFromEuler(eu);
        m4.compose(new THREE.Vector3(f.x, f.y, f.z), q, new THREE.Vector3(f.s / 0.6, f.s / 0.6 * 0.85, f.s / 0.6));
        fim.setMatrixAt(i, m4);
        col.setHex(f.c).offsetHSL(rand(-0.02, 0.02), rand(-0.05, 0.03), rand(-0.04, 0.04));
        fim.setColorAt(i, col);
      });
    }
    if (fim.instanceColor) fim.instanceColor.needsUpdate = true;
    fim.castShadow = true;
    fim.frustumCulled = false;
    fim.userData.materialType = 'wood';
    this.group.add(fim);

    const nboxCols = [0xa33327, 0x2d4d70, 0xb07828];
    const nim = new THREE.InstancedMesh(new THREE.BoxGeometry(0.48, 0.72, 0.42), this.posterMat, 3);
    {
      const m4 = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const eu = new THREE.Euler();
      const col = new THREE.Color();
      for (let i = 0; i < 3; i++) {
        eu.set(0, Math.PI + rand(-0.15, 0.15), 0);
        q.setFromEuler(eu);
        m4.compose(new THREE.Vector3(-19.6 + i * 0.72, 0.48, 8.35), q, new THREE.Vector3(1, 1, 1));
        nim.setMatrixAt(i, m4);
        col.setHex(nboxCols[i]).offsetHSL(0, 0, rand(-0.05, 0.03));
        nim.setColorAt(i, col);
      }
    }
    if (nim.instanceColor) nim.instanceColor.needsUpdate = true;
    nim.castShadow = true;
    nim.frustumCulled = false;
    nim.userData.materialType = 'metal';
    this.group.add(nim);
    this.raycastGroup.add(nim);
    this._addCollider(-19.2, 8.35, 2.3, 0.5, 0.75);
  }

  _buildVehicles() {
    const paintItems = [];
    const CW = this._buckets.storeglass.list;
    const CD = this._buckets.darkmetal.list;

    const sedanPaintGeo = mergeGeometries([
      new THREE.BoxGeometry(4.5, 0.6, 1.86).translate(0, 0.62, 0),
      new THREE.BoxGeometry(2.05, 0.55, 1.68).translate(-0.18, 1.19, 0)
    ], false);
    const vanPaintGeo = mergeGeometries([
      new THREE.BoxGeometry(3.7, 1.85, 2.06).translate(-0.65, 1.2, 0),
      new THREE.BoxGeometry(1.6, 1.15, 2.0).translate(1.85, 0.87, 0)
    ], false);

    const cars = [
      [-24, -4.55, 4, 0x5e666d],
      [18, -4.5, -3, 0x6e5f4e],
      [-38, 4.55, 182, 0x4a4f43],
      [30, 4.5, 178, 0x211f1b],
      [-4.55, -30, 96, 0x707280],
      [4.55, 24, 84, 0x5b4a45],
      [14, 53, 2, 0x495a63],
      [21, 56.2, -4, 0x777268],
      [27, 52.5, 6, 0x33322f],
      [3.2, -3.4, 38, 0x8a8073]
    ];
    for (const c of cars) {
      const a = c[2] * DEG;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const px = c[0];
      const py0 = 0;
      const pz = c[1];
      paintItems.push({ x: px, y: py0, z: pz, ry: a, c: c[3] });

      CW.push(this._place(new THREE.BoxGeometry(2.15, 0.46, 1.72).translate(-0.18, 1.06, 0), px, py0, pz, a));
      for (const wp of [[1.45, 0.83], [1.45, -0.83], [-1.45, 0.83], [-1.45, -0.83]]) {
        const wx = px + wp[0] * ca + wp[1] * sa;
        const wz = pz - wp[0] * sa + wp[1] * ca;
        const arch = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10);
        arch.rotateX(Math.PI / 2);
        CD.push(this._place(arch, wx, 0.42, wz, a));
        const wh = new THREE.CylinderGeometry(0.33, 0.33, 0.24, 10);
        wh.rotateX(Math.PI / 2);
        CD.push(this._place(wh, wx, 0.34, wz, a));
      }
      CD.push(this._place(new THREE.BoxGeometry(0.16, 0.26, 1.88).translate(2.28, 0.48, 0), px, py0, pz, a));
      CD.push(this._place(new THREE.BoxGeometry(0.16, 0.26, 1.88).translate(-2.28, 0.48, 0), px, py0, pz, a));
      CD.push(this._place(new THREE.BoxGeometry(0.05, 0.2, 1.2).translate(2.27, 0.78, 0), px, py0, pz, a));

      const ew = Math.abs(4.6 * ca) + Math.abs(1.9 * sa);
      const ed = Math.abs(4.6 * sa) + Math.abs(1.9 * ca);
      this._addCollider(px, pz, ew, ed, 1.62);
      this.minimapRects.push({ x: px, z: pz, w: ew, d: ed });
      const rx = sa;
      const rz = ca;
      this._cover(px + rx * 1.45, pz + rz * 1.45, rx, rz);
      this._cover(px - rx * 1.45, pz - rz * 1.45, -rx, -rz);
    }

    const vpx = 13.5;
    const vpz = -4.5;
    const va = 92 * DEG;
    {
      const ca = Math.cos(va);
      const sa = Math.sin(va);
      const vim = new THREE.InstancedMesh(vanPaintGeo, this._mat({ roughness: 0.45, metalness: 0.45 }, 'metal'), 1);
      const vm4 = new THREE.Matrix4();
      const vq = new THREE.Quaternion();
      const veu = new THREE.Euler();
      veu.set(0, va, 0);
      vq.setFromEuler(veu);
      vm4.compose(new THREE.Vector3(vpx, 0, vpz), vq, new THREE.Vector3(1, 1, 1));
      vim.setMatrixAt(0, vm4);
      vim.castShadow = true;
      vim.receiveShadow = true;
      vim.frustumCulled = false;
      vim.userData.materialType = 'metal';
      this.group.add(vim);
      this.raycastGroup.add(vim);

      CW.push(this._place(new THREE.BoxGeometry(0.07, 0.58, 1.72).translate(2.66, 1.32, 0), vpx, 0, vpz, va));
      CW.push(this._place(new THREE.BoxGeometry(0.06, 0.5, 0.5).translate(2.64, 1.25, -0.95), vpx, 0, vpz, va));
      for (const wp of [[1.75, 0.88], [1.75, -0.88], [-1.55, 0.88], [-1.55, -0.88]]) {
        const wx = vpx + wp[0] * ca + wp[1] * sa;
        const wz = vpz - wp[0] * sa + wp[1] * ca;
        const arch = new THREE.CylinderGeometry(0.46, 0.46, 0.32, 10);
        arch.rotateX(Math.PI / 2);
        CD.push(this._place(arch, wx, 0.46, wz, va));
        const wh = new THREE.CylinderGeometry(0.37, 0.37, 0.26, 10);
        wh.rotateX(Math.PI / 2);
        CD.push(this._place(wh, wx, 0.37, wz, va));
      }
      CD.push(this._place(new THREE.BoxGeometry(0.15, 0.3, 2.02).translate(2.68, 0.52, 0), vpx, 0, vpz, va));
      const ew = Math.abs(5.5 * ca) + Math.abs(2.1 * sa);
      const ed = Math.abs(5.5 * sa) + Math.abs(2.1 * ca);
      this._addCollider(vpx, vpz, ew, ed, 2.15);
      this.minimapRects.push({ x: vpx, z: vpz, w: ew, d: ed });
      const rx = sa;
      const rz = ca;
      this._cover(vpx + rx * 1.6, vpz + rz * 1.6, rx, rz);
      this._cover(vpx - rx * 1.6, vpz - rz * 1.6, -rx, -rz);
    }

    const pim = new THREE.InstancedMesh(sedanPaintGeo, this._mat({ roughness: 0.42, metalness: 0.5 }, 'metal'), paintItems.length);
    {
      const m4 = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const eu = new THREE.Euler();
      const col = new THREE.Color();
      paintItems.forEach((p, i) => {
        eu.set(0, p.ry, 0);
        q.setFromEuler(eu);
        m4.compose(new THREE.Vector3(p.x, p.y, p.z), q, new THREE.Vector3(1, 1, 1));
        pim.setMatrixAt(i, m4);
        col.setHex(p.c).offsetHSL(rand(-0.01, 0.01), rand(-0.03, 0.03), rand(-0.04, 0.04));
        pim.setColorAt(i, col);
      });
    }
    if (pim.instanceColor) pim.instanceColor.needsUpdate = true;
    pim.castShadow = true;
    pim.receiveShadow = true;
    pim.frustumCulled = false;
    pim.userData.materialType = 'metal';
    this.group.add(pim);
    this.raycastGroup.add(pim);
  }

  _flagMesh(px, py, pz, w, h) {
    const g = new THREE.PlaneGeometry(w, h, 12, 6);
    g.translate(w / 2, 0, 0);
    const mesh = new THREE.Mesh(g, this.flagMat);
    mesh.position.set(px, py, pz);
    mesh.castShadow = true;
    mesh.userData.materialType = 'wood';
    this.group.add(mesh);
    this.raycastGroup.add(mesh);
    this._animFlags.push({ mesh, base: g.attributes.position.array.slice(), w });
    return mesh;
  }

  _buildCheckpoint() {
    const M = this._buckets.darkmetal.list;
    M.push(this._place(new THREE.CylinderGeometry(0.05, 0.075, 7.2, 8), -3.6, 3.72, 3.6));
    M.push(this._place(new THREE.SphereGeometry(0.09, 8, 6), -3.6, 7.36, 3.6));
    M.push(this._place(new THREE.CylinderGeometry(0.16, 0.16, 0.5, 10), -3.6, 0.25, 3.6));
    this._addCollider(-3.6, 3.6, 0.36, 0.36, 7.4);
    this._flagMesh(-3.66, 6.35, 3.6, 1.6, 0.94);

    const T = this._buckets.trim.list;
    T.push(this._place(this._sbox(0.85, 0.06, 0.06), -20, 4.62, 8.52));
    T.push(this._place(this._sbox(0.85, 0.06, 0.06), -30, 4.62, 8.52));
    this._flagMesh(-19.98, 4.28, 8.14, 1.05, 0.62);
    this._flagMesh(-29.98, 4.28, 8.14, 1.05, 0.62);

    this._crate(-5.4, -5.0, 1.0, 0.3, true);
    this._crate(-3.9, -5.9, 0.9, -0.2, true);
    const ML = this._buckets.mil.list;
    ML.push(this._place(this._sbox(0.85, 0.85, 0.85, 0.75), -4.7, 1.43, -5.4, 0.5));

    this.minimapRects.push({ x: 0, z: -0.4, w: 8, d: 8 });
  }

  _buildSandbags() {
    const geo = new THREE.CapsuleGeometry(0.21, 0.42, 3, 7);
    geo.rotateZ(Math.PI / 2);
    const spots = [];
    const arc = (cx, cz, r, rows) => {
      const start = 40 * DEG;
      const end = 320 * DEG;
      for (let row = 0; row < rows; row++) {
        const rr = r - row * 0.16;
        const n = Math.max(3, Math.round(((end - start) * rr) / 0.46) - row);
        for (let i = 0; i <= n; i++) {
          const th = start + ((end - start) * i) / n;
          spots.push({ x: cx + Math.sin(th) * rr, y: 0.2 + row * 0.37, z: cz + Math.cos(th) * rr, ry: th });
        }
      }
      this._addCollider(cx - Math.sin(start) * r * 0.8, cz + Math.cos(start) * r * 0.8, 2.2, 1.2, 1.15);
      this._addCollider(cx + Math.sin(start) * r * 0.8, cz + Math.cos(start) * r * 0.8, 2.2, 1.2, 1.15);
      this._addCollider(cx, cz - r * 0.92, 3.6, 1.2, 1.15);
      this._cover(cx - Math.sin(start) * (r + 1.3), cz + Math.cos(start) * (r + 1.3), Math.sin(start), Math.cos(start));
      this._cover(cx + Math.sin(start) * (r + 1.3), cz + Math.cos(start) * (r + 1.3), -Math.sin(start), Math.cos(start));
      this._cover(cx, cz - r - 1.4, 0, -1);
    };
    const wall = (cx, cz, len, deg) => {
      const a = deg * DEG;
      const ux = Math.cos(a);
      const uz = -Math.sin(a);
      const nx = Math.sin(a);
      const nz = Math.cos(a);
      const n = Math.round(len / 0.44);
      for (let row = 0; row < 2; row++) {
        for (let i = 0; i <= n - row; i++) {
          const t = (i + row * 0.5 - n / 2) * (len / n);
          spots.push({ x: cx + ux * t + nx * rand(-0.03, 0.03), y: 0.2 + row * 0.37, z: cz + uz * t + nz * rand(-0.03, 0.03), ry: a });
        }
      }
      const ew = Math.abs(len * ux) + 0.9;
      const ed = Math.abs(len * uz) + 0.9;
      this._addCollider(cx, cz, ew, ed, 1.1);
      this.minimapRects.push({ x: cx, z: cz, w: ew, d: ed });
      this._cover(cx + nx * 1.3, cz + nz * 1.3, nx, nz);
      this._cover(cx - nx * 1.3, cz - nz * 1.3, -nx, -nz);
    };
    arc(0, -0.4, 3.3, 3);
    wall(-38, -6.8, 4.4, 0);
    wall(36.2, -6.8, 4.4, 0);
    wall(-11, 36.5, 4.4, 90);

    const im = new THREE.InstancedMesh(geo, this.sandbagMat, spots.length);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const eu = new THREE.Euler();
    const sc = new THREE.Vector3();
    spots.forEach((s, i) => {
      eu.set(0, s.ry, 0);
      q.setFromEuler(eu);
      sc.set(rand(0.9, 1.12), 0.84, rand(0.92, 1.08));
      m4.compose(new THREE.Vector3(s.x, s.y, s.z), q, sc);
      im.setMatrixAt(i, m4);
    });
    im.castShadow = true;
    im.receiveShadow = true;
    im.frustumCulled = false;
    im.userData.materialType = 'sand';
    this.group.add(im);
    this.raycastGroup.add(im);
  }

  _buildJerseys() {
    const geo = mergeGeometries([
      new THREE.BoxGeometry(2.0, 0.55, 0.74).translate(0, 0.275, 0),
      new THREE.BoxGeometry(2.0, 0.55, 0.44).translate(0, 0.82, 0)
    ], false);
    const items = [
      [-18, 2.3, 0], [22, -2.3, 0],
      [2.4, -20, 90], [-2.4, 18, 90],
      [-11.5, 33.5, 0],
      [60.6, -1.6, 90], [60.6, 1.9, 90], [-60.6, -1.6, 90], [-60.6, 1.9, 90],
      [-1.6, 60.6, 0], [1.9, 60.6, 0], [-1.6, -60.6, 0], [1.9, -60.6, 0]
    ];
    const im = new THREE.InstancedMesh(geo, this.jerseyMat, items.length);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const eu = new THREE.Euler();
    const col = new THREE.Color();
    items.forEach((it, i) => {
      const a = it[2] * DEG;
      eu.set(0, a, 0);
      q.setFromEuler(eu);
      m4.compose(new THREE.Vector3(it[0], 0, it[1]), q, new THREE.Vector3(1, 1, 1));
      im.setMatrixAt(i, m4);
      col.setHex(0xffffff).offsetHSL(0, 0, rand(-0.09, 0.04));
      im.setColorAt(i, col);
      const c = Math.abs(Math.cos(a));
      const s = Math.abs(Math.sin(a));
      const ew = 2.05 * c + 0.78 * s;
      const ed = 2.05 * s + 0.78 * c;
      this._addCollider(it[0], it[1], ew, ed, 1.1);
      this.minimapRects.push({ x: it[0], z: it[1], w: ew, d: ed });
      const rx = s * (it[0] > 0 || Math.abs(it[1]) > 50 ? -1 : 1);
      const rz = c * (it[0] > 0 || Math.abs(it[1]) > 50 ? -1 : 1);
      void rx;
      void rz;
      const px = Math.sin(a);
      const pz = Math.cos(a);
      this._cover(it[0] + px * 1.25, it[1] + pz * 1.25, px, pz);
      this._cover(it[0] - px * 1.25, it[1] - pz * 1.25, -px, -pz);
    });
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.castShadow = true;
    im.receiveShadow = true;
    im.frustumCulled = false;
    im.userData.materialType = 'concrete';
    this.group.add(im);
    this.raycastGroup.add(im);
  }

  _buildBarrels() {
    const geo = new THREE.CylinderGeometry(0.42, 0.42, 1.15, 14);
    const spots = [
      [28, -58, 0], [29.2, -57.3, 0], [27.3, -57.1, 0], [28.3, -56.2, 0], [30.1, -58.6, 1],
      [-40.2, -33, 0], [-41, -32.2, 0],
      [31, 60.3, 0], [30.2, 59.5, 0]
    ];
    for (const sp of spots) {
      const mesh = new THREE.Mesh(geo, this.barrelMatShared);
      if (sp[2]) {
        mesh.position.set(sp[0], 0.43, sp[1]);
        mesh.rotation.z = Math.PI / 2;
        mesh.rotation.y = rand(0, Math.PI * 2);
      } else {
        mesh.position.set(sp[0], 0.575, sp[1]);
        mesh.rotation.y = rand(0, Math.PI * 2);
      }
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.barrel = true;
      mesh.userData.hp = 30;
      mesh.userData.materialType = 'metal';
      this.group.add(mesh);
      this.raycastGroup.add(mesh);
      this.barrels.push(mesh);
      if (!sp[2]) this._addCollider(sp[0], sp[1], 0.92, 0.92, 1.15);
    }
    this._cover(26.4, -55.6, -0.7, 0.7);
  }

  _buildLitterDebris() {
    const litterGeo = new THREE.PlaneGeometry(1, 1);
    const litterCols = [0xd8d2c2, 0xb9b3a4, 0xcabf9f, 0x9fa89c, 0xc9c2b2];
    const items = [];
    for (let i = 0; i < 150; i++) {
      const roll = Math.random();
      let x;
      let z;
      let y;
      if (roll < 0.62) {
        const band = (Math.random() * 4) | 0;
        if (band === 0) { x = rand(-61, 61); z = rand(6.3, 8.7); y = 0.135; }
        else if (band === 1) { x = rand(-61, 61); z = rand(-8.7, -6.3); y = 0.135; }
        else if (band === 2) { x = rand(6.3, 8.7); z = rand(-5.5, 5.5); y = 0.135; }
        else { x = rand(-8.7, -6.3); z = rand(-5.5, 5.5); y = 0.135; }
      } else if (roll < 0.88) {
        x = rand(-58, 58);
        z = (Math.random() > 0.5 ? 1 : -1) * rand(4.8, 5.9);
        if (Math.random() > 0.5) { const t = x; x = z; z = t; }
        y = 0.02;
      } else {
        const zone = [[-31, 46], [18, -56], [20, 54], [-40, -35]][(Math.random() * 4) | 0];
        x = zone[0] + rand(-7, 7);
        z = zone[1] + rand(-6, 6);
        y = 0.03;
      }
      items.push({ x, y, z, s: rand(0.12, 0.3), ry: rand(0, Math.PI), tilt: rand(-0.12, 0.12) });
    }
    const lim = new THREE.InstancedMesh(litterGeo, this.litterMat, items.length);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const eu = new THREE.Euler();
    const col = new THREE.Color();
    items.forEach((it, i) => {
      eu.set(-Math.PI / 2 + it.tilt, it.ry, 0);
      q.setFromEuler(eu);
      m4.compose(new THREE.Vector3(it.x, it.y, it.z), q, new THREE.Vector3(it.s, it.s * rand(0.7, 1.3), 1));
      lim.setMatrixAt(i, m4);
      col.setHex(litterCols[(Math.random() * litterCols.length) | 0]).offsetHSL(0, 0, rand(-0.06, 0.04));
      lim.setColorAt(i, col);
    });
    if (lim.instanceColor) lim.instanceColor.needsUpdate = true;
    lim.receiveShadow = true;
    lim.frustumCulled = false;
    this.group.add(lim);

    const dgeo = new THREE.DodecahedronGeometry(0.5, 0);
    const debItems = [];
    for (let i = 0; i < 46; i++) {
      let zx;
      let zz;
      if (i < 26) { zx = -31 + rand(-7, 7); zz = 46 + rand(-6, 6); }
      else if (i < 34) { zx = 18 + rand(-6, 6); zz = -56 + rand(-5, 5); }
      else { zx = (Math.random() > 0.5 ? 1 : -1) * rand(10, 60); zz = (Math.random() > 0.5 ? 1 : -1) * rand(6.5, 8.6); }
      debItems.push({ x: zx, z: zz, s: rand(0.25, 0.85), r1: rand(0, Math.PI), r2: rand(0, Math.PI) });
    }
    const dim = new THREE.InstancedMesh(dgeo, this.trimMat, debItems.length);
    const sc = new THREE.Vector3();
    debItems.forEach((d, i) => {
      eu.set(d.r1, d.r2, rand(0, Math.PI));
      q.setFromEuler(eu);
      sc.set(d.s * rand(0.8, 1.3), d.s * rand(0.45, 0.75), d.s * rand(0.8, 1.3));
      m4.compose(new THREE.Vector3(d.x, d.s * 0.18, d.z), q, sc);
      dim.setMatrixAt(i, m4);
    });
    dim.castShadow = true;
    dim.receiveShadow = true;
    dim.frustumCulled = false;
    dim.userData.materialType = 'concrete';
    this.group.add(dim);
    this.raycastGroup.add(dim);
  }

  _buildSkyline() {
    const geos = [];
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 + rand(-0.1, 0.1);
      const r = rand(250, 400);
      const hgt = rand(45, 130);
      geos.push(new THREE.BoxGeometry(rand(18, 50), hgt, rand(18, 44)).rotateY(rand(0, Math.PI)).translate(Math.sin(a) * r, hgt / 2 - 2, Math.cos(a) * r));
    }
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.3 + rand(-0.15, 0.15);
      const r = rand(130, 185);
      const hgt = rand(26, 48);
      geos.push(new THREE.BoxGeometry(rand(14, 30), hgt, rand(14, 28)).rotateY(rand(0, Math.PI)).translate(Math.sin(a) * r, hgt / 2 - 2, Math.cos(a) * r));
    }
    const merged = mergeGeometries(geos, false);
    const mesh = new THREE.Mesh(merged, this.skylineMat);
    mesh.userData.materialType = 'concrete';
    this.group.add(mesh);
    this.raycastGroup.add(mesh);
    this._smokeSites = [[-290, 170], [255, -225]];
  }

  _buildSmoke() {
    const dot = softDot();
    this._tex.push(dot);
    this._smokeCols = [];
    for (const s of this._smokeSites) {
      const sprites = [];
      for (let i = 0; i < 6; i++) {
        const sm = new THREE.SpriteMaterial({
          map: dot,
          color: 0x4a4540,
          transparent: true,
          opacity: 0,
          depthWrite: false
        });
        this._mats.push(sm);
        const sp = new THREE.Sprite(sm);
        sp.position.set(s[0] + rand(-4, 4), 4 + i * 11, s[1] + rand(-4, 4));
        sp.scale.setScalar(13 + i * 5);
        this.group.add(sp);
        sprites.push({ sp, seed: rand(0, 10) });
      }
      this._smokeCols.push({ x: s[0], z: s[1], sprites });
    }
  }

  _buildAtmosphere() {
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.34), this.paperMat);
      m.position.set(rand(-40, 40), rand(0.4, 1.2), rand(-40, 40));
      m.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
      this.group.add(m);
      this._papers.push({ m, seed: rand(0, 10), bx: m.position.x, bz: m.position.z });
    }

    const N = 300;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = rand(-62, 62);
      pos[i * 3 + 1] = rand(0.2, 7);
      pos[i * 3 + 2] = rand(-62, 62);
    }
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const dm = new THREE.PointsMaterial({
      size: 0.08,
      map: this._tex[this._tex.length - 1],
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      sizeAttenuation: true,
      color: 0xd8cdbb
    });
    this.dustPoints = new THREE.Points(dg, dm);
    this.dustGeo = dg;
    this.dustMat = dm;
    this.group.add(this.dustPoints);
  }

  _flushBuckets() {
    for (const name of Object.keys(this._buckets)) {
      const b = this._buckets[name];
      if (!b.list.length) continue;
      let merged = null;
      try {
        merged = mergeGeometries(b.list, false);
      } catch (e) {
        merged = null;
      }
      if (merged) {
        const mesh = new THREE.Mesh(merged, b.mat);
        mesh.castShadow = b.shadowCast;
        mesh.receiveShadow = true;
        mesh.userData.materialType = b.materialType;
        this.group.add(mesh);
        this.raycastGroup.add(mesh);
        for (const g of b.list) g.dispose();
      } else {
        for (const g of b.list) {
          const mesh = new THREE.Mesh(g, b.mat);
          mesh.castShadow = b.shadowCast;
          mesh.receiveShadow = true;
          mesh.userData.materialType = b.materialType;
          this.group.add(mesh);
          this.raycastGroup.add(mesh);
        }
      }
      b.list.length = 0;
    }
  }

  update(dt, elapsed) {
    for (const f of this._animFlags) {
      const pos = f.mesh.geometry.attributes.position;
      const base = f.base;
      for (let i = 0; i < pos.count; i++) {
        const bx = base[i * 3];
        const k = bx / f.w;
        pos.setZ(i, Math.sin(elapsed * 3.2 + bx * 2.6) * 0.11 * k + Math.sin(elapsed * 5.1 + bx * 4.2) * 0.035 * k);
        pos.setY(i, base[i * 3 + 1] + Math.sin(elapsed * 2.3 + bx * 1.8) * 0.025 * k);
      }
      pos.needsUpdate = true;
    }
    for (const p of this._papers) {
      p.m.rotation.x += dt * (0.7 + p.seed * 0.08);
      p.m.rotation.y += dt * (1.1 + p.seed * 0.05);
      p.m.position.x += dt * 0.9;
      p.m.position.z += dt * 0.35;
      p.m.position.y += Math.sin(elapsed * 1.4 + p.seed * 2) * dt * 0.4;
      if (p.m.position.x > 60) p.m.position.x = -60;
      if (p.m.position.z > 60) p.m.position.z = -60;
    }
    if (this._smokeCols) {
      for (const c of this._smokeCols) {
        for (const s of c.sprites) {
          s.sp.position.y += dt * (2.2 + s.seed * 0.2);
          s.sp.position.x += dt * 0.7;
          const h = (s.sp.position.y - 4) / 66;
          if (h > 1) {
            s.sp.position.y = 4;
            s.sp.position.x = c.x + rand(-4, 4);
            s.sp.position.z = c.z + rand(-4, 4);
          }
          s.sp.material.opacity = 0.16 * Math.max(0, Math.min(1, h * 4)) * (1 - h);
        }
      }
    }
    if (this.dustGeo) {
      const pos = this.dustGeo.attributes.position;
      const arr = pos.array;
      for (let i = 0; i < arr.length; i += 3) {
        arr[i] += this.dustWind.x * dt;
        arr[i + 1] += Math.sin(elapsed * 0.7 + arr[i]) * 0.02 * dt;
        arr[i + 2] += this.dustWind.z * dt;
        if (arr[i] > 63) arr[i] = -63;
        if (arr[i + 2] > 63) arr[i + 2] = -63;
        if (arr[i + 1] > 7.2) arr[i + 1] = 0.2;
        if (arr[i + 1] < 0.1) arr[i + 1] = 7;
      }
      pos.needsUpdate = true;
    }
    if (this._lampLights) {
      for (let i = 0; i < this._lampLights.length; i++) {
        this._lampLights[i].intensity = 24 * (0.93 + 0.07 * Math.sin(elapsed * 11 + i * 2.4));
      }
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

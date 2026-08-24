import * as THREE from 'three';

const MATS = {
  metal: new THREE.MeshStandardMaterial({ color: 0x2a2e33, roughness: 0.38, metalness: 0.8 }),
  metal2: new THREE.MeshStandardMaterial({ color: 0x3a3f45, roughness: 0.5, metalness: 0.65 }),
  poly: new THREE.MeshStandardMaterial({ color: 0x3d423e, roughness: 0.8, metalness: 0.05 }),
  olive: new THREE.MeshStandardMaterial({ color: 0x4a5240, roughness: 0.85, metalness: 0.05 })
};
const DOT_GEO = new THREE.BoxGeometry(0.007, 0.007, 0.005);
const DOT_MAT = new THREE.MeshBasicMaterial({ color: 0xffc46b });

function box(w, h, d, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  return m;
}

function cyl(rt, rb, len, mat, x = 0, y = 0, z = 0, seg = 12) {
  const g = new THREE.CylinderGeometry(rt, rb, len, seg);
  g.rotateX(Math.PI / 2);
  const m = new THREE.Mesh(g, mat);
  m.position.set(x, y, z);
  return m;
}

function dot(x, y, z) {
  const m = new THREE.Mesh(DOT_GEO, DOT_MAT);
  m.position.set(x, y, z);
  return m;
}

function finish(group, id, muzzleY, muzzleZ, magPivot, sightY) {
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, muzzleY, muzzleZ);
  group.add(muzzle);
  return {
    id,
    group,
    muzzle,
    mag: magPivot,
    magY: magPivot ? magPivot.position.y : 0,
    sightY
  };
}

function buildAR() {
  const g = new THREE.Group();
  g.add(box(0.062, 0.088, 0.30, MATS.metal, 0, 0, 0));
  g.add(box(0.05, 0.02, 0.34, MATS.metal2, 0, 0.052, 0.01));
  g.add(box(0.058, 0.062, 0.24, MATS.poly, 0, 0.006, -0.29));
  for (let i = 0; i < 4; i++) g.add(box(0.06, 0.008, 0.014, MATS.metal2, 0, 0.04, -0.21 - i * 0.05));
  g.add(cyl(0.013, 0.013, 0.22, MATS.metal, 0, 0.012, -0.51));
  g.add(cyl(0.019, 0.019, 0.07, MATS.metal2, 0, 0.012, -0.645));
  g.add(box(0.012, 0.05, 0.014, MATS.metal, 0, 0.087, -0.40));
  g.add(dot(0, 0.106, -0.398));
  g.add(box(0.006, 0.05, 0.02, MATS.metal, -0.017, 0.087, -0.03));
  g.add(box(0.006, 0.05, 0.02, MATS.metal, 0.017, 0.087, -0.03));
  g.add(box(0.04, 0.006, 0.02, MATS.metal, 0, 0.114, -0.03));
  g.add(dot(0, 0.106, -0.03));
  const mag = new THREE.Group();
  mag.position.set(0, -0.044, -0.05);
  mag.add(box(0.044, 0.16, 0.075, MATS.metal2, 0, -0.08, 0.008, 0.16));
  g.add(mag);
  g.add(box(0.034, 0.095, 0.048, MATS.olive, 0, -0.09, 0.095, -0.3));
  g.add(box(0.045, 0.07, 0.19, MATS.olive, 0, -0.002, 0.245));
  g.add(box(0.05, 0.105, 0.028, MATS.poly, 0, -0.008, 0.35));
  g.add(box(0.03, 0.012, 0.05, MATS.metal2, 0.032, 0.03, 0.02));
  g.add(box(0.008, 0.028, 0.008, MATS.metal2, 0, -0.052, 0.032, -0.25));
  return finish(g, 'ar', 0.012, -0.69, mag, 0.106);
}

function buildSMG() {
  const g = new THREE.Group();
  g.add(box(0.06, 0.08, 0.24, MATS.metal, 0, 0, -0.02));
  g.add(box(0.045, 0.018, 0.26, MATS.metal2, 0, 0.049, -0.05));
  g.add(cyl(0.026, 0.026, 0.18, MATS.metal2, 0, 0.008, -0.30));
  g.add(cyl(0.012, 0.012, 0.05, MATS.metal, 0, 0.008, -0.425));
  g.add(box(0.01, 0.042, 0.012, MATS.metal, 0, 0.079, -0.27));
  g.add(dot(0, 0.096, -0.268));
  g.add(box(0.006, 0.042, 0.016, MATS.metal, -0.015, 0.078, 0.06));
  g.add(box(0.006, 0.042, 0.016, MATS.metal, 0.015, 0.078, 0.06));
  g.add(box(0.036, 0.006, 0.016, MATS.metal, 0, 0.101, 0.06));
  g.add(dot(0, 0.096, 0.06));
  const mag = new THREE.Group();
  mag.position.set(0, -0.04, 0.0);
  mag.add(box(0.038, 0.19, 0.058, MATS.metal2, 0, -0.095, 0, 0.05));
  g.add(mag);
  g.add(box(0.032, 0.09, 0.045, MATS.olive, 0, -0.085, 0.075, -0.25));
  g.add(cyl(0.012, 0.012, 0.14, MATS.metal2, 0, 0.012, 0.16));
  g.add(box(0.012, 0.075, 0.05, MATS.metal2, 0, -0.012, 0.235));
  g.add(box(0.008, 0.026, 0.008, MATS.metal2, 0, -0.048, 0.022, -0.2));
  return finish(g, 'smg', 0.008, -0.46, mag, 0.096);
}

function buildShotgun() {
  const g = new THREE.Group();
  g.add(box(0.058, 0.085, 0.22, MATS.metal, 0, 0, 0));
  g.add(box(0.05, 0.018, 0.2, MATS.metal2, 0, 0.051, -0.02));
  g.add(cyl(0.016, 0.016, 0.46, MATS.metal, 0, 0.022, -0.44));
  g.add(cyl(0.014, 0.014, 0.40, MATS.metal2, 0, -0.022, -0.41));
  g.add(cyl(0.011, 0.011, 0.02, MATS.metal, 0, -0.022, -0.62));
  g.add(box(0.052, 0.055, 0.14, MATS.olive, 0, -0.022, -0.36));
  g.add(box(0.014, 0.02, 0.03, MATS.metal2, 0, 0.048, -0.64));
  g.add(dot(0, 0.064, -0.64));
  g.add(box(0.006, 0.03, 0.016, MATS.metal, -0.014, 0.07, 0.05));
  g.add(box(0.006, 0.03, 0.016, MATS.metal, 0.014, 0.07, 0.05));
  g.add(dot(0, 0.078, 0.05));
  g.add(box(0.045, 0.075, 0.2, MATS.olive, 0, -0.01, 0.21, 0.08));
  g.add(box(0.05, 0.105, 0.028, MATS.poly, 0, -0.018, 0.315));
  g.add(box(0.034, 0.09, 0.046, MATS.olive, 0, -0.085, 0.09, -0.3));
  g.add(box(0.05, 0.014, 0.06, MATS.metal2, 0, -0.048, 0.02));
  g.add(box(0.008, 0.026, 0.008, MATS.metal2, 0, -0.062, 0.035, -0.2));
  return finish(g, 'shotgun', 0.022, -0.68, null, 0.078);
}

function buildSniper() {
  const g = new THREE.Group();
  g.add(box(0.058, 0.085, 0.32, MATS.metal, 0, 0, 0.02));
  g.add(cyl(0.02, 0.023, 0.4, MATS.metal, 0, 0.01, -0.45));
  g.add(cyl(0.017, 0.017, 0.32, MATS.metal, 0, 0.008, -0.79));
  g.add(box(0.05, 0.05, 0.09, MATS.metal2, 0, 0.008, -0.96));
  g.add(box(0.054, 0.012, 0.02, MATS.poly, 0, 0.008, -0.99));
  g.add(cyl(0.03, 0.03, 0.2, MATS.metal2, 0, 0.085, -0.02));
  g.add(cyl(0.03, 0.038, 0.06, MATS.metal2, 0, 0.085, -0.15));
  g.add(cyl(0.034, 0.03, 0.05, MATS.metal2, 0, 0.085, 0.125));
  g.add(box(0.016, 0.028, 0.02, MATS.metal, 0, 0.052, -0.09));
  g.add(box(0.016, 0.028, 0.02, MATS.metal, 0, 0.052, 0.05));
  g.add(box(0.045, 0.01, 0.01, MATS.metal, 0.035, 0.012, 0.09));
  g.add(box(0.03, 0.012, 0.012, MATS.metal, 0.058, 0.012, 0.09));
  const mag = new THREE.Group();
  mag.position.set(0, -0.045, 0.0);
  mag.add(box(0.048, 0.1, 0.11, MATS.metal2, 0, -0.05, 0));
  g.add(mag);
  g.add(box(0.034, 0.095, 0.05, MATS.olive, 0, -0.082, 0.13, -0.3));
  g.add(box(0.04, 0.03, 0.24, MATS.olive, 0, 0.022, 0.26));
  g.add(box(0.046, 0.032, 0.12, MATS.olive, 0, 0.046, 0.22));
  g.add(box(0.046, 0.11, 0.05, MATS.poly, 0, -0.008, 0.385));
  g.add(box(0.014, 0.09, 0.014, MATS.metal, 0, -0.05, 0.31));
  return finish(g, 'sniper', 0.008, -1.01, mag, 0.085);
}

export function buildWeaponModels() {
  return { ar: buildAR(), smg: buildSMG(), shotgun: buildShotgun(), sniper: buildSniper() };
}

export function disposeWeaponModels(models) {
  for (const id in models) {
    models[id].group.traverse((o) => o.geometry && o.geometry.dispose());
  }
  DOT_GEO.dispose();
  for (const k in MATS) MATS[k].dispose();
  DOT_MAT.dispose();
}

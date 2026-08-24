import * as THREE from 'three';

const MATS = {
  steel: new THREE.MeshStandardMaterial({ color: 0x23262b, roughness: 0.34, metalness: 0.82 }),
  steelWorn: new THREE.MeshStandardMaterial({ color: 0x43484f, roughness: 0.5, metalness: 0.7 }),
  poly: new THREE.MeshStandardMaterial({ color: 0x2e312f, roughness: 0.78, metalness: 0.06 }),
  fde: new THREE.MeshStandardMaterial({ color: 0x6b5f4a, roughness: 0.8, metalness: 0.05 }),
  olive: new THREE.MeshStandardMaterial({ color: 0x49523f, roughness: 0.85, metalness: 0.05 }),
  glove: new THREE.MeshStandardMaterial({ color: 0x4d4338, roughness: 0.92, metalness: 0.02 }),
  sleeve: new THREE.MeshStandardMaterial({ color: 0x39413a, roughness: 0.95, metalness: 0.02 }),
  brass: new THREE.MeshStandardMaterial({ color: 0xb08d3e, roughness: 0.35, metalness: 0.9 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x0a1220, roughness: 0.15, metalness: 0.6, emissive: 0x16283f, emissiveIntensity: 0.55 })
};
const DOT_GEO = new THREE.BoxGeometry(0.007, 0.007, 0.005);
const DOT_MAT = new THREE.MeshBasicMaterial({ color: 0xffc46b });

function box(w, h, d, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  return m;
}

function cylZ(r1, r2, len, mat, x = 0, y = 0, z = 0, seg = 12) {
  const g = new THREE.CylinderGeometry(r1, r2, len, seg);
  g.rotateX(Math.PI / 2);
  const m = new THREE.Mesh(g, mat);
  m.position.set(x, y, z);
  return m;
}

function cylY(r, len, mat, x = 0, y = 0, z = 0, seg = 10) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), mat);
  m.position.set(x, y, z);
  return m;
}

function dot(x, y, z) {
  const m = new THREE.Mesh(DOT_GEO, DOT_MAT);
  m.position.set(x, y, z);
  return m;
}

function rail(g, z0, z1, y, w = 0.048) {
  const n = Math.floor((z0 - z1) / 0.022);
  g.add(box(w, 0.008, z0 - z1, MATS.steel, 0, y, (z0 + z1) / 2));
  for (let i = 0; i < n; i++) {
    g.add(box(w + 0.003, 0.006, 0.011, MATS.steelWorn, 0, y + 0.004, z0 - 0.008 - i * 0.022));
  }
}

function hand(side, gx, gy, gz, srx, sry, reach = 0.17, down = 0.03) {
  const h = new THREE.Group();
  h.add(box(0.055, 0.06, 0.075, MATS.glove, 0, 0, 0));
  h.add(box(0.05, 0.024, 0.062, MATS.glove, 0, -0.036, 0.008, 0.3));
  h.add(box(0.046, 0.02, 0.055, MATS.glove, 0, 0.038, -0.012, -0.2));
  h.add(box(0.06, 0.06, reach, MATS.sleeve, 0, -down - 0.01, reach / 2 + 0.03, 0.3 + srx));
  h.position.set(gx, gy, gz);
  h.rotation.set(srx, sry, 0);
  return h;
}

function finish(group, id, muzzleY, muzzleZ, magPivot, sightY) {
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, muzzleY, muzzleZ);
  group.add(muzzle);
  return { id, group, muzzle, mag: magPivot, magY: magPivot ? magPivot.position.y : 0, sightY };
}

function buildAR() {
  const g = new THREE.Group();

  g.add(box(0.058, 0.086, 0.24, MATS.steel, 0, 0, -0.07));
  g.add(box(0.05, 0.055, 0.1, MATS.steel, 0, -0.052, -0.03));
  g.add(box(0.026, 0.02, 0.034, MATS.steelWorn, 0.031, 0.012, -0.05));
  g.add(cylY(0.011, 0.024, MATS.steelWorn, 0.036, 0.03, -0.055));
  g.add(box(0.03, 0.014, 0.05, MATS.steelWorn, -0.02, 0.05, 0.045));

  rail(g, -0.19, 0.04, 0.052);

  g.add(cylZ(0.026, 0.026, 0.2, MATS.fde, 0, 0.004, -0.29, 10));
  for (let i = 0; i < 6; i++) {
    g.add(box(0.054, 0.01, 0.014, MATS.steelWorn, 0, 0.004, -0.235 - i * 0.03));
  }
  g.add(box(0.02, 0.03, 0.02, MATS.steel, 0, -0.028, -0.2));

  g.add(cylZ(0.011, 0.011, 0.2, MATS.steel, 0, 0.012, -0.52, 10));
  g.add(box(0.02, 0.036, 0.026, MATS.steel, 0, 0.014, -0.44));
  g.add(cylZ(0.016, 0.014, 0.06, MATS.steel, 0, 0.012, -0.66, 10));
  g.add(cylZ(0.017, 0.017, 0.008, MATS.steelWorn, 0, 0.012, -0.635, 10));
  g.add(cylZ(0.017, 0.017, 0.008, MATS.steelWorn, 0, 0.012, -0.66, 10));

  g.add(box(0.012, 0.046, 0.014, MATS.steel, 0, 0.088, -0.42));
  g.add(dot(0, 0.106, -0.415));
  g.add(box(0.036, 0.008, 0.018, MATS.steel, 0, 0.068, -0.42));
  g.add(box(0.007, 0.05, 0.02, MATS.steel, -0.018, 0.088, -0.03));
  g.add(box(0.007, 0.05, 0.02, MATS.steel, 0.018, 0.088, -0.03));
  g.add(box(0.042, 0.007, 0.02, MATS.steel, 0, 0.115, -0.03));
  g.add(dot(0, 0.106, -0.03));

  const mag = new THREE.Group();
  mag.position.set(0, -0.062, -0.035);
  mag.add(box(0.042, 0.09, 0.07, MATS.poly, 0, -0.045, 0.004, 0.1));
  mag.add(box(0.04, 0.085, 0.064, MATS.poly, 0, -0.125, 0.019, 0.24));
  mag.add(box(0.046, 0.016, 0.074, MATS.steelWorn, 0, -0.168, 0.032, 0.24));
  g.add(mag);

  g.add(box(0.036, 0.01, 0.055, MATS.steelWorn, 0, -0.052, 0.055));
  g.add(box(0.01, 0.006, 0.05, MATS.steelWorn, 0, -0.075, 0.055));
  g.add(box(0.038, 0.095, 0.05, MATS.fde, 0, -0.1, 0.105, -0.32));
  g.add(box(0.04, 0.014, 0.06, MATS.poly, 0, -0.14, 0.125, -0.32));

  g.add(cylY(0.019, 0.16, MATS.poly, 0, -0.006, 0.14));
  g.add(box(0.05, 0.055, 0.1, MATS.fde, 0, -0.006, 0.245));
  g.add(box(0.054, 0.085, 0.03, MATS.poly, 0, -0.014, 0.305, 0, 0, -0.06));
  g.add(box(0.056, 0.03, 0.018, MATS.poly, 0, -0.03, 0.325));

  g.add(box(0.014, 0.012, 0.05, MATS.steelWorn, -0.03, 0.03, 0.02));
  g.add(box(0.052, 0.006, 0.03, MATS.steelWorn, 0, 0.043, -0.185));

  g.add(hand('R', 0.03, -0.1, 0.105, 0.55, -0.25));
  g.add(hand('L', -0.035, -0.03, -0.31, 0.5, 0.55, 0.16, 0.05));

  return finish(g, 'ar', 0.012, -0.7, mag, 0.106);
}

function buildSMG() {
  const g = new THREE.Group();

  g.add(box(0.05, 0.075, 0.26, MATS.steel, 0, 0, -0.04));
  g.add(box(0.044, 0.03, 0.2, MATS.poly, 0, 0.048, -0.08, 0, 0, 0));
  g.add(box(0.05, 0.024, 0.14, MATS.poly, 0, -0.048, -0.02));
  g.add(cylZ(0.013, 0.013, 0.14, MATS.steel, 0, 0.006, -0.24, 10));
  g.add(cylZ(0.016, 0.014, 0.035, MATS.steelWorn, 0, 0.006, -0.325, 10));
  g.add(cylZ(0.017, 0.017, 0.007, MATS.steelWorn, 0, 0.006, -0.31, 10));

  g.add(box(0.014, 0.014, 0.012, MATS.steel, 0, 0.052, -0.3));
  g.add(box(0.012, 0.024, 0.012, MATS.steel, 0, 0.062, -0.3));
  g.add(box(0.008, 0.008, 0.014, MATS.steelWorn, 0, 0.076, -0.3));
  g.add(dot(0, 0.096, -0.295));
  g.add(cylY(0.011, 0.026, MATS.steel, 0, 0.07, 0.05));
  g.add(box(0.008, 0.008, 0.014, MATS.steelWorn, 0, 0.084, 0.05));
  g.add(dot(0, 0.096, 0.05));

  const mag = new THREE.Group();
  mag.position.set(0, -0.05, -0.09);
  mag.add(box(0.034, 0.17, 0.05, MATS.poly, 0, -0.085, -0.012, 0.12));
  mag.add(box(0.038, 0.014, 0.054, MATS.steelWorn, 0, -0.172, -0.022, 0.12));
  g.add(mag);

  g.add(box(0.04, 0.085, 0.055, MATS.poly, 0, -0.088, 0.06, -0.25));
  g.add(box(0.044, 0.012, 0.05, MATS.poly, 0, -0.128, 0.075, -0.25));
  g.add(box(0.03, 0.008, 0.045, MATS.steelWorn, 0, -0.05, 0.02));
  g.add(box(0.008, 0.005, 0.04, MATS.steelWorn, 0, -0.07, 0.02));

  g.add(box(0.012, 0.02, 0.16, MATS.steel, -0.018, 0.01, 0.19));
  g.add(box(0.012, 0.02, 0.16, MATS.steel, 0.018, 0.01, 0.19));
  g.add(box(0.05, 0.05, 0.05, MATS.poly, 0, 0.005, 0.28));
  g.add(box(0.054, 0.062, 0.018, MATS.poly, 0, -0.002, 0.31, 0, 0, -0.05));

  g.add(hand('R', 0.028, -0.09, 0.065, 0.55, -0.25));
  g.add(hand('L', -0.032, -0.035, -0.16, 0.5, 0.55, 0.16, 0.05));

  return finish(g, 'smg', 0.006, -0.345, mag, 0.096);
}

function buildShotgun() {
  const g = new THREE.Group();

  g.add(box(0.056, 0.08, 0.24, MATS.steel, 0, 0, -0.02));
  g.add(box(0.05, 0.02, 0.1, MATS.steelWorn, 0.0, 0.048, -0.06));
  for (let i = 0; i < 4; i++) {
    g.add(cylZ(0.011, 0.011, 0.02, MATS.brass, 0.028, -0.01, 0.01 - i * 0.026, 8));
  }

  g.add(cylZ(0.014, 0.014, 0.5, MATS.steel, 0, 0.02, -0.4, 10));
  g.add(cylZ(0.012, 0.012, 0.44, MATS.steel, 0, -0.018, -0.38, 10));
  g.add(cylZ(0.02, 0.02, 0.05, MATS.steelWorn, 0, 0.001, -0.615, 10));
  g.add(box(0.008, 0.008, 0.008, MATS.steelWorn, 0, 0.042, -0.64));

  g.add(box(0.06, 0.055, 0.16, MATS.fde, 0, -0.018, -0.33));
  for (let i = 0; i < 7; i++) {
    g.add(box(0.064, 0.058, 0.006, MATS.poly, 0, -0.018, -0.39 + i * 0.02));
  }

  g.add(box(0.014, 0.03, 0.016, MATS.steel, -0.015, 0.066, 0.04));
  g.add(box(0.014, 0.03, 0.016, MATS.steel, 0.015, 0.066, 0.04));
  g.add(dot(0, 0.078, 0.04));
  g.add(box(0.034, 0.008, 0.045, MATS.steelWorn, 0, -0.048, 0.03));
  g.add(box(0.008, 0.005, 0.04, MATS.steelWorn, 0, -0.068, 0.03));

  g.add(box(0.04, 0.095, 0.06, MATS.fde, 0, -0.095, 0.075, -0.3));
  g.add(box(0.046, 0.035, 0.26, MATS.fde, 0, -0.028, 0.22, 0.06));
  g.add(box(0.05, 0.06, 0.09, MATS.fde, 0, -0.008, 0.36, 0.12));
  g.add(box(0.052, 0.014, 0.02, MATS.poly, 0, -0.05, 0.415, 0.12));

  g.add(hand('R', 0.028, -0.1, 0.08, 0.55, -0.25));
  g.add(hand('L', -0.038, -0.045, -0.33, 0.45, 0.55, 0.16, 0.04));

  return finish(g, 'shotgun', 0.02, -0.655, null, 0.078);
}

function buildSniper() {
  const g = new THREE.Group();

  g.add(cylZ(0.021, 0.021, 0.34, MATS.steel, 0, 0.012, -0.3, 10));
  for (let i = 0; i < 4; i++) {
    g.add(box(0.004, 0.03, 0.3, MATS.steelWorn, 0.021, 0.012, -0.3, 0, 0, i * 0.5));
    g.add(box(0.004, 0.03, 0.3, MATS.steelWorn, -0.021, 0.012, -0.3, 0, 0, i * 0.5));
  }
  g.add(cylZ(0.017, 0.017, 0.28, MATS.steel, 0, 0.012, -0.62, 10));
  g.add(box(0.036, 0.03, 0.05, MATS.steelWorn, 0, 0.012, -0.79));
  g.add(box(0.014, 0.014, 0.02, MATS.steelWorn, 0, 0.012, -0.82));
  g.add(box(0.05, 0.014, 0.03, MATS.steelWorn, 0, 0.012, -0.775));
  g.add(box(0.014, 0.05, 0.03, MATS.steelWorn, 0, -0.006, -0.755));

  g.add(box(0.056, 0.078, 0.3, MATS.steel, 0, 0.005, -0.08));
  g.add(cylY(0.009, 0.07, MATS.steelWorn, 0.036, 0.012, -0.02));
  const bolt = new THREE.Group();
  bolt.position.set(0.03, 0.03, 0.02);
  bolt.add(cylY(0.008, 0.05, MATS.steelWorn, 0.014, 0, 0, 8));
  bolt.add(box(0.02, 0.02, 0.02, MATS.steelWorn, 0.042, -0.018, 0, 0, 0, 0.6));
  bolt.rotation.z = -0.5;
  g.add(bolt);

  rail(g, -0.2, 0.08, 0.05);

  g.add(cylZ(0.017, 0.017, 0.22, MATS.poly, 0, 0.098, -0.05, 12));
  g.add(cylZ(0.026, 0.021, 0.07, MATS.poly, 0, 0.098, -0.2, 12));
  g.add(cylZ(0.021, 0.024, 0.05, MATS.poly, 0, 0.098, 0.09, 12));
  g.add(cylZ(0.024, 0.022, 0.014, MATS.steelWorn, 0, 0.098, -0.155, 12));
  g.add(cylZ(0.024, 0.022, 0.014, MATS.steelWorn, 0, 0.098, 0.055, 12));
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.004, 12), MATS.glass);
  lens.rotateX(Math.PI / 2);
  lens.position.set(0, 0.098, -0.233);
  g.add(lens);
  g.add(box(0.012, 0.026, 0.02, MATS.steel, -0.014, 0.062, -0.1));
  g.add(box(0.012, 0.026, 0.02, MATS.steel, -0.014, 0.062, 0.02));

  const mag = new THREE.Group();
  mag.position.set(0, -0.05, -0.06);
  mag.add(box(0.042, 0.075, 0.09, MATS.poly, 0, -0.038, 0, 0.06));
  mag.add(box(0.046, 0.012, 0.094, MATS.steelWorn, 0, -0.078, 0.004, 0.06));
  g.add(mag);

  g.add(box(0.04, 0.1, 0.055, MATS.olive, 0, -0.1, 0.075, -0.28));
  g.add(box(0.055, 0.05, 0.4, MATS.olive, 0, -0.02, 0.24));
  g.add(box(0.058, 0.03, 0.12, MATS.olive, 0, 0.028, 0.3));
  g.add(box(0.05, 0.035, 0.06, MATS.poly, 0, 0.052, 0.2));
  g.add(box(0.056, 0.016, 0.03, MATS.poly, 0, -0.05, 0.43));
  g.add(box(0.03, 0.024, 0.3, MATS.poly, 0, -0.052, 0.2));
  g.add(cylY(0.006, 0.16, MATS.steel, -0.012, -0.06, 0.3));
  g.add(cylY(0.006, 0.16, MATS.steel, 0.012, -0.06, 0.3));

  g.add(hand('R', 0.028, -0.1, 0.08, 0.55, -0.25));
  g.add(hand('L', -0.035, -0.05, -0.24, 0.5, 0.55, 0.16, 0.05));

  return finish(g, 'sniper', 0.012, -0.83, mag, 0.085);
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

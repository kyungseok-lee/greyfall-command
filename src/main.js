import * as THREE from 'three';
import { Engine } from './core/engine.js';
import { Input } from './core/input.js';
import { AudioManager } from './core/audio.js';
import { CONFIG } from './core/contracts.js';
import { World } from './world/world.js';
import { Player } from './player/player.js';
import { EnemyManager } from './enemies/enemies.js';
import { FXManager } from './fx/fx.js';
import { HUD } from './ui/hud.js';

const $ = (id) => document.getElementById(id);
const STATE = { MENU: 'menu', PLAYING: 'playing', DYING: 'dying', PAUSED: 'paused', GAMEOVER: 'gameover' };

const app = $('app');
const engine = new Engine(app);
const input = new Input(engine.renderer.domElement);
const audio = new AudioManager();
const hud = new HUD();
const world = new World(engine.scene);
const fx = new FXManager(engine.scene, engine.camera);
const enemies = new EnemyManager({ scene: engine.scene });

const _rc = new THREE.Raycaster();
const _blastRc = new THREE.Raycaster();
const _blastDir = new THREE.Vector3();
const _tmpM = new THREE.Matrix4();
const _im = new THREE.Matrix4();
const _hitNormal = new THREE.Vector3();

function surfaceNormal(hit) {
  if (!hit.face) return _hitNormal.set(0, 1, 0);
  let m = hit.object.matrixWorld;
  if (hit.instanceId !== undefined && hit.object.isInstancedMesh) {
    hit.object.getMatrixAt(hit.instanceId, _im);
    _tmpM.multiplyMatrices(hit.object.matrixWorld, _im);
    m = _tmpM;
  }
  return _hitNormal.copy(hit.face.normal).transformDirection(m);
}

let lastHitNormal = new THREE.Vector3(0, 1, 0);
const stats = { score: 0, kills: 0, shots: 0, hits: 0, time: 0, chain: 0, lastKillAt: -99 };
let state = STATE.MENU;
let wave = 0;
let waveActive = false;
let intermissionT = 0;
let pendingFirstWave = false;
let deathT = 0;
let elapsed = 0;
const timers = [];

function waveCount(n) {
  return CONFIG.WAVE.baseCount + CONFIG.WAVE.perWave * (n - 1);
}

const combat = {
  fx,
  audio,
  onShot() {
    stats.shots++;
  },
  raycast(origin, dir, maxDist) {
    _rc.set(origin, dir);
    _rc.far = maxDist;
    let best = null;
    let bestD = Infinity;
    const wh = _rc.intersectObject(world.raycastGroup, true);
    if (wh.length) {
      best = wh[0];
      bestD = wh[0].distance;
    }
    const eh = _rc.intersectObject(enemies.hitGroup, true);
    if (eh.length && eh[0].distance < bestD) {
      best = eh[0];
      bestD = eh[0].distance;
      lastHitNormal.copy(surfaceNormal(best));
      return {
        point: best.point,
        normal: lastHitNormal,
        type: 'enemy',
        enemy: best.object.userData.enemyRef,
        isHead: !!best.object.userData.isHead
      };
    }
    if (best) {
      lastHitNormal.copy(surfaceNormal(best));
      if (best.object.userData.barrel) {
        return { point: best.point, normal: lastHitNormal, type: 'barrel', barrelMesh: best.object };
      }
      return {
        point: best.point,
        normal: lastHitNormal,
        type: 'world',
        materialType: best.object.userData.materialType || 'concrete'
      };
    }
    return null;
  },
  damageEnemy(enemyRef, dmg, isHead, point) {
    stats.hits++;
    const killed = enemies.damage(enemyRef, dmg, isHead, point);
    hud.hitmarker(killed);
    audio.hitmarker(killed);
    if (killed) {
      stats.kills++;
      if (elapsed - stats.lastKillAt < 4) stats.chain++;
      else stats.chain = 1;
      stats.lastKillAt = elapsed;
      const bonus = Math.min(stats.chain - 1, CONFIG.SCORE.streakCap) * CONFIG.SCORE.streakStep;
      stats.score += CONFIG.SCORE.kill + (isHead ? CONFIG.SCORE.headshotBonus : 0) + bonus;
      hud.setScore(stats.score);
      hud.killfeed(isHead ? 'HOSTILE ELIMINATED // HEADSHOT' : 'HOSTILE ELIMINATED', isHead);
    }
  },
  damageBarrel(barrelMesh, dmg, point) {
    fx.impact(point, lastHitNormal, 'metal');
    barrelMesh.userData.hp -= dmg;
    if (barrelMesh.userData.hp <= 0 && !barrelMesh.userData.gone) explodeBarrel(barrelMesh);
  }
};


const player = new Player({
  camera: engine.camera,
  input,
  world,
  scene: engine.scene,
  combat
});
enemies.setRefs({ world, player, fx, audio });
enemies.onPlayerHit = (dmg, fromPos) => player.takeDamage(dmg, fromPos);
fx.onShake = (t) => player.addShake(t);

{
  const W = player.weapons;
  W.onAmmoChange = (m, r) => hud.setAmmo(m, r);
  W.onReloadProgress = (p) => hud.setReload(p);
  W.onWeaponSwitched = (id, name) => {
    hud.setWeapon(name);
    hud.setReload(null);
  };
}

player.onFootstep = () => audio.footstep(player.isSprinting);
player.onDamaged = () => {
  hud.damageFrom(player.angleToLastHit);
  audio.hurt();
};
player.onDeath = () => {
  state = STATE.DYING;
  deathT = 1.7;
  audio.heartbeat(false);
  hud.lowHealth(false);
  player.weapons.root.visible = false;
};

function explodeBarrel(mesh) {
  mesh.userData.gone = true;
  mesh.visible = false;
  world.raycastGroup.remove(mesh);
  const p = mesh.position;
  const pos = new THREE.Vector3(p.x, p.y + 0.5, p.z);
  if (mesh.userData.collider) {
    const ci = world.colliders.indexOf(mesh.userData.collider);
    if (ci >= 0) world.colliders.splice(ci, 1);
  } else {
    for (let i = world.colliders.length - 1; i >= 0; i--) {
      const b = world.colliders[i];
      if (
        Math.abs((b.min.x + b.max.x) / 2 - p.x) < 0.8 &&
        Math.abs((b.min.z + b.max.z) / 2 - p.z) < 0.8 &&
        b.max.y - b.min.y < 1.4
      ) {
        world.colliders.splice(i, 1);
        break;
      }
    }
  }
  const dToPlayer = pos.distanceTo(player.position);
  fx.explosion(pos, Math.max(0.15, 0.65 - dToPlayer * 0.012));
  audio.explosion(dToPlayer);
  for (const s of enemies.soldiers) {
    if (s.dead || s.removeMe) continue;
    const d = s.pos.distanceTo(pos);
    if (d < 7.5) enemies.damage(s, 140 * (1 - d / 7.5), false, s.pos);
  }
  const pd = player.position.distanceTo(pos);
  if (pd < 7) {
    let dmg = 90 * (1 - pd / 7);
    _blastDir.copy(player.position).sub(pos).normalize();
    _blastRc.set(pos, _blastDir);
    _blastRc.far = pd;
    const oc = _blastRc.intersectObject(world.raycastGroup, true);
    if (oc.length && oc[0].distance < pd - 0.5) dmg *= 0.5;
    player.takeDamage(dmg, pos);
  }
  for (const other of world.barrels) {
    if (other.userData.gone) continue;
    if (other.position.distanceTo(pos) < 6) {
      timers.push({ t: 0.28, fn: () => explodeBarrel(other) });
    }
  }
}

function runTimers(dt) {
  for (let i = timers.length - 1; i >= 0; i--) {
    timers[i].t -= dt;
    if (timers[i].t <= 0) {
      const fn = timers[i].fn;
      timers.splice(i, 1);
      fn();
    }
  }
}

function startWave(n) {
  wave = n;
  waveActive = true;
  const count = waveCount(n);
  hud.setWave(n);
  hud.banner('WAVE ' + n, count + ' HOSTILES INBOUND');
  audio.waveHorn();
  enemies.spawnWave(count);
}

function clearWave() {
  waveActive = false;
  intermissionT = CONFIG.WAVE.intermission;
  hud.banner('WAVE CLEARED', 'RESUPPLY INBOUND // REGROUP');
  player.health = Math.min(player.maxHealth, player.health + CONFIG.WAVE.healOnClear);
  for (const id of Object.keys(player.weapons.state)) {
    const st = player.weapons.state[id];
    st.reserve = Math.min(CONFIG.WEAPONS[id].reserveMax, st.reserve + Math.ceil(CONFIG.WEAPONS[id].reserveMax * CONFIG.WAVE.reserveRefillFrac));
  }
  const a = player.weapons.ammo;
  player.weapons.onAmmoChange?.(a.mag, a.reserve);
}

function showOverlay(id) {
  for (const o of ['menu', 'pause', 'gameover']) $(o).style.display = o === id ? 'flex' : 'none';
}

function setHudVisible(v) {
  hud.root.style.display = v ? 'block' : 'none';
  player.weapons.root.visible = v;
}

function resetMission() {
  timers.length = 0;
  enemies.clear();
  player.reset();
  player.weapons.root.visible = true;
  engine.camera.fov = 75;
  engine.camera.updateProjectionMatrix();
  stats.score = 0;
  stats.kills = 0;
  stats.shots = 0;
  stats.hits = 0;
  stats.time = 0;
  stats.chain = 0;
  stats.lastKillAt = -99;
  wave = 0;
  waveActive = false;
  intermissionT = 0;
  pendingFirstWave = false;
  elapsed = 0;
  for (const b of world.barrels) {
    b.visible = true;
    b.userData.gone = false;
    b.userData.hp = 30;
    if (b.parent !== world.raycastGroup) world.raycastGroup.add(b);
    if (b.userData.collider && world.colliders.indexOf(b.userData.collider) < 0) world.colliders.push(b.userData.collider);
  }
  audio.heartbeat(false);
  hud.reset();
  hud.setScore(0);
  hud.setWeapon(CONFIG.WEAPONS.ar.name);
  const a = player.weapons.ammo;
  hud.setAmmo(a.mag, a.reserve);
  hud.setReload(null);
}

function beginMission() {
  resetMission();
  state = STATE.PLAYING;
  setHudVisible(true);
  showOverlay(null);
  input.requestLock();
  timers.push({ t: 1.4, fn: () => startWave(1) });
}

function pauseGame() {
  if (state !== STATE.PLAYING && state !== STATE.DYING) return;
  state = STATE.PAUSED;
  showOverlay('pause');
  audio.suspend();
}

function resumeGame() {
  if (state !== STATE.PAUSED) return;
  audio.resume();
  input.requestLock();
}

function doGameOver() {
  state = STATE.GAMEOVER;
  setHudVisible(false);
  showOverlay('gameover');
  input.releaseLock();
  let acc = stats.shots ? Math.round((stats.hits / stats.shots) * 100) : 0;
  acc = Math.min(100, Math.max(0, acc));
  const mm = Math.floor(stats.time / 60);
  const ss = String(Math.floor(stats.time % 60)).padStart(2, '0');
  $('final-score').textContent = stats.score.toLocaleString();
  $('final-wave').textContent = wave;
  $('final-kills').textContent = stats.kills;
  $('final-accuracy').textContent = acc + '%';
  $('final-time').textContent = mm + ':' + ss;
  const stored = parseInt(localStorage.getItem('greyfall_highscore') || '0');
  const hs = Math.max(Number.isFinite(stored) ? stored : 0, stats.score);
  localStorage.setItem('greyfall_highscore', String(hs));
  $('menu-highscore').textContent = 'HIGH SCORE ' + hs.toLocaleString();
}

input.onLockChange = (locked) => {
  if (locked) {
    if (state === STATE.PAUSED) {
      showOverlay(null);
      state = STATE.PLAYING;
      audio.resume();
    }
  } else if (state === STATE.PLAYING) pauseGame();
};

engine.renderer.domElement.addEventListener('click', () => {
  if (state === STATE.PLAYING && !input.locked) input.requestLock();
});

$('deploy-btn').addEventListener('click', () => {
  audio.init();
  audio.startAmbient();
  audio.uiClick();
  beginMission();
});
$('resume-btn').addEventListener('click', () => {
  audio.uiClick();
  resumeGame();
});
$('restart-btn').addEventListener('click', () => {
  audio.resume();
  audio.uiClick();
  beginMission();
});
$('redeploy-btn').addEventListener('click', () => {
  audio.init();
  audio.startAmbient();
  audio.uiClick();
  beginMission();
});

for (const range of document.querySelectorAll('#sensitivity-range')) {
  range.value = String(Math.round(input.sensitivity * 100));
  range.addEventListener('input', () => {
    input.setSensitivity(parseFloat(range.value) / 100);
    for (const r of document.querySelectorAll('#sensitivity-range')) r.value = range.value;
    for (const l of document.querySelectorAll('#sens-value')) l.textContent = input.sensitivity.toFixed(2);
  });
}
for (const l of document.querySelectorAll('#sens-value')) l.textContent = input.sensitivity.toFixed(2);

{
  const hs = parseInt(localStorage.getItem('greyfall_highscore') || '0');
  if (hs > 0) $('menu-highscore').textContent = 'HIGH SCORE ' + hs.toLocaleString();
}

setHudVisible(false);
showOverlay('menu');

function updateHudFrame(dt) {
  hud.update(dt);
  hud.setHealth(player.health, player.maxHealth);
  hud.crosshairSpread(player.weapons.getCrosshairPx());
  const scoped = player.weapons.currentId === 'sniper' && player.adsT > 0.85;
  hud.scopeOverlay(scoped);
  hud.showCrosshair(!scoped);
  hud.compass(player.yaw);
  hud.minimap(player.position, player.yaw, enemies.minimapEnemies(), world.minimapRects);
  const flash = player.damageFlash01;
  if (flash > 0.01) hud.flashDamage(flash);
  engine.setDamageIntensity(flash * 0.7);
  const lowHp = player.alive && player.health < 35;
  hud.lowHealth(lowHp);
  audio.heartbeat(lowHp);
  hud.setEnemiesLeft(enemies.remainingInWave);
}

function menuCamera(t) {
  const a = t * 0.07;
  engine.camera.position.set(Math.sin(a) * 44, 16, Math.cos(a) * 44);
  engine.camera.lookAt(0, 2, 0);
}

engine.clock.start();

function tick() {
  requestAnimationFrame(tick);
  const rawDt = Math.min(engine.clock.getDelta(), 0.05);
  const t = performance.now() / 1000;

  if (state === STATE.MENU || state === STATE.GAMEOVER) {
    menuCamera(t);
    world.update(rawDt, t);
    fx.update(rawDt);
    engine.render();
    return;
  }

  if (state === STATE.PAUSED) {
    engine.render();
    return;
  }

  const ts = state === STATE.DYING ? 0.45 : 1;
  const dt = rawDt * ts;
  elapsed += dt;
  stats.time += dt;

  runTimers(dt);
  player.update(dt);
  enemies.update(dt);
  fx.update(dt);
  world.update(dt, elapsed);
  audio.update(rawDt);
  updateHudFrame(rawDt);

  if (state === STATE.PLAYING) {
    if (pendingFirstWave && intermissionT > 0) {
      intermissionT -= dt;
      if (intermissionT <= 0) {
        pendingFirstWave = false;
        startWave(wave + 1);
      }
    }
    if (waveActive && enemies.allSpawned && enemies.aliveCount === 0) {
      clearWave();
      pendingFirstWave = true;
    }
  }

  if (state === STATE.DYING) {
    deathT -= rawDt;
    if (deathT <= 0) doGameOver();
  }

  engine.render();
}

tick();

window.__GREYFALL = { engine, world, player, enemies, input };

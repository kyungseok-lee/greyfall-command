import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL = process.env.URL || 'http://localhost:4322/';
const OUT = '/tmp/gfqa';
fs.mkdirSync(OUT, { recursive: true });

const t0 = Date.now();
const ts = () => ((Date.now() - t0) / 1000).toFixed(2).padStart(7);
const log = (s) => console.log(`${ts()}s | ${s}`);

let phase = 'load';
const issues = [];      // {sev, phase, kind, text}
const consoleEvents = []; // {t, phase, type, text}
const shots = [];

function record(kind, text) {
  issues.push({ phase, kind, text });
  log(`!! [${kind}] (${phase}) ${String(text).slice(0, 300)}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: false,
  args: [
    '--no-sandbox',
    '--window-size=1600,900',
    '--window-position=20,20',
    '--mute-audio',
    '--hide-scrollbars',
    '--use-angle=metal',
    '--enable-precise-memory-info'
  ],
  defaultViewport: { width: 1600, height: 900 }
});

try {
  const page = await browser.newPage();

  page.on('pageerror', (e) => {
    consoleEvents.push({ t: ts(), phase, type: 'pageerror', text: e.message });
    record('pageerror', e.message);
  });
  page.on('console', (m) => {
    const type = m.type();
    if (type === 'error' || type === 'warn') {
      const entry = { t: ts(), phase, type, text: m.text() };
      consoleEvents.push(entry);
      if (type === 'error') record('console.error', m.text());
    }
  });
  page.on('requestfailed', (r) => {
    consoleEvents.push({ t: ts(), phase, type: 'requestfailed', text: `${r.url()} :: ${r.failure()?.errorText}` });
  });

  // ---------------------------------------------------------------
  // helpers
  // ---------------------------------------------------------------
  const shot = async (name) => {
    const p = `${OUT}/${name}.png`;
    await page.screenshot({ path: p });
    shots.push(name);
    log(`shot -> ${name}.png`);
  };

  const ev = (fn, ...args) => page.evaluate(fn, ...args);

  // set look angles instantly (bypass smoothing)
  const setLook = (yaw, pitch = 0) => ev((y, p) => {
    const pl = window.__GREYFALL.player;
    pl._tYaw = y; pl._sYaw = y; pl.yaw = y;
    pl._tPitch = p; pl._sPitch = p; pl.pitch = p;
  }, yaw, pitch);

  const lookAt = (tx, ty, tz) => ev((x, y, z) => {
    const G = window.__GREYFALL;
    const e = G.player.position;
    const dx = x - e.x, dy = y - e.y, dz = z - e.z;
    const len = Math.hypot(dx, dy, dz);
    const pitch = Math.asin(dy / len);
    const yaw = Math.atan2(-dx, -dz);
    const pl = G.player;
    pl._tYaw = yaw; pl._sYaw = yaw; pl.yaw = yaw;
    pl._tPitch = pitch; pl._sPitch = pitch; pl.pitch = pitch;
  }, tx, ty, tz);

  // synthetic mouse buttons (game listeners don't require trusted events once input.locked)
  const btnDown = (button) => ev((b) => {
    const c = window.__GREYFALL.engine.renderer.domElement;
    c.dispatchEvent(new MouseEvent('mousedown', { button: b }));
  }, button);
  const btnUp = (button) => ev((b) => {
    window.dispatchEvent(new MouseEvent('mouseup', { button: b }));
  }, button);

  const gameState = () => ev(() => {
    const G = window.__GREYFALL;
    return {
      state: document.querySelector('#menu').style.display === 'flex' ? 'menu'
        : document.querySelector('#pause').style.display === 'flex' ? 'paused'
        : document.querySelector('#gameover').style.display === 'flex' ? 'gameover' : 'playing',
      health: +G.player.health.toFixed(1),
      alive: G.player.alive,
      locked: G.input.locked,
      realLocked: document.pointerLockElement === G.engine.renderer.domElement,
      weapon: G.player.weapons.currentId,
      weaponName: document.getElementById('weapon-name').textContent,
      mag: G.player.weapons.state[G.player.weapons.currentId].mag,
      reserve: G.player.weapons.state[G.player.weapons.currentId].reserve,
      adsT: +G.player.weapons.adsT.toFixed(2),
      enemiesAlive: G.enemies.aliveCount,
      enemiesRemaining: G.enemies.remainingInWave,
      barrels: G.world.barrels.length,
      barrelPos: G.world.barrels.map((b) => [+b.position.x.toFixed(1), +b.position.z.toFixed(1)]),
      pos: [+G.player.position.x.toFixed(1), +G.player.position.y.toFixed(1), +G.player.position.z.toFixed(1)],
      fov: +G.engine.camera.fov.toFixed(1),
      hudHealthNum: document.getElementById('health-num').textContent,
      vignetteOpacity: document.getElementById('damage-vignette').style.opacity || '0',
      bannerMain: document.getElementById('banner-main').textContent,
      bannerVisible: document.getElementById('banner').style.opacity !== '0',
      waveNumHud: document.getElementById('wave-num').textContent,
      scoreHud: document.getElementById('score-num').textContent,
      ammoMagHud: document.getElementById('ammo-mag').textContent,
      ammoReserveHud: document.getElementById('ammo-reserve').textContent,
      heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null
    };
  });

  const enemyTelemetry = () => ev(() => {
    const G = window.__GREYFALL;
    const ss = G.enemies.soldiers || [];
    let nearest = Infinity;
    let losCount = 0;
    const states = {};
    for (const s of ss) {
      if (s.dead || s.removeMe) continue;
      const d = Math.hypot(s.pos.x - G.player.position.x, s.pos.z - G.player.position.z);
      if (d < nearest) nearest = d;
      if (s.hasLOS) losCount++;
      states[s.state] = (states[s.state] || 0) + 1;
    }
    return { nearest: nearest === Infinity ? null : +nearest.toFixed(1), losCount, states };
  });

  const errMark = () => issues.length;

  // ---------------------------------------------------------------
  // instrumentation: AudioContext suspend/resume tracking
  // (must be installed AFTER goto - navigation wipes window state)
  // ---------------------------------------------------------------
  const installAudioProbe = () => ev(() => {
    if (window.__qaAudio) return;
    window.__qaAudio = { suspends: 0, resumes: 0, ctxs: [] };
    const AC = window.AudioContext;
    const origSuspend = AC.prototype.suspend;
    const origResume = AC.prototype.resume;
    AC.prototype.suspend = function (...a) { window.__qaAudio.suspends++; return origSuspend.apply(this, a); };
    AC.prototype.resume = function (...a) { window.__qaAudio.resumes++; return origResume.apply(this, a); };
    window.AudioContext = new Proxy(AC, {
      construct(Target, args) {
        const inst = new Target(...args);
        window.__qaAudio.ctxs.push(inst);
        return inst;
      }
    });
  });

  // ===============================================================
  // STEP 1: load + DEPLOY + spawn view
  // ===============================================================
  phase = '1-load-deploy';
  log('STEP 1: load + DEPLOY');
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await installAudioProbe();
  await page.waitForSelector('#deploy-btn', { visible: true, timeout: 15000 });
  await sleep(1500);
  await shot('01-menu');

  const m0 = errMark();
  await page.click('#deploy-btn');
  await sleep(2000);
  let st = await gameState();
  const realLockEngaged = st.realLocked;
  if (!st.realLocked) {
    log(`WARN: real pointer lock NOT engaged after DEPLOY (locked=${st.locked}); forcing input.locked=true`);
    await ev(() => { window.__GREYFALL.input.locked = true; });
    st = await gameState();
  } else {
    log(`real pointer lock engaged OK`);
  }
  log(`spawn state: ${JSON.stringify({ ...st, barrelPos: undefined })}`);
  if (st.state !== 'playing') record('flow', `after DEPLOY expected state=playing, saw ${st.state}`);
  await shot('02-spawn-view');

  // ===============================================================
  // STEP 2: all 4 weapons - equip/fire/reload, hip + ADS shots
  // ===============================================================
  phase = '2-weapons';
  log('STEP 2: weapon sweep (ar, smg, shotgun, sniper)');
  const weaponReport = [];
  // face map centre for a wall backdrop
  await setLook(Math.atan2(-(0 - 0), -(0 - 13)), -0.03);

  const WLIST = [['1', 'ar'], ['2', 'smg'], ['3', 'shotgun'], ['4', 'sniper']];
  for (const [idx, id] of WLIST) {
    const wm = errMark();
    const rep = { id, equipOk: false, firedOk: false, reloadOk: false, adsOk: false, errors: 0 };
    await ev((wid) => window.__GREYFALL.player.weapons.equip(wid), id);
    await sleep(500);
    let s = await gameState();
    rep.equipOk = s.weapon === id;
    rep.hudName = s.weaponName;
    if (!rep.equipOk) record('weapon', `equip(${id}) did not switch; current=${s.weapon}`);

    // --- HIP FIRE ~1s ---
    const magBefore = s.mag;
    await btnDown(0);
    if (id === 'ar' || id === 'smg') {
      await sleep(1000);
    } else {
      // semi-auto: repeated trigger pulls
      for (let i = 0; i < 4; i++) { await sleep(260); await btnUp(0); await sleep(40); await btnDown(0); }
      await sleep(200);
    }
    await btnUp(0);
    await sleep(300);
    s = await gameState();
    rep.firedOk = s.mag < magBefore;
    rep.hipShots = magBefore - s.mag;
    if (!rep.firedOk) record('weapon', `${id}: mag did not decrease while firing (${magBefore} -> ${s.mag})`);
    rep.hipHudMatch = parseInt(s.ammoMagHud) === s.mag;
    if (!rep.hipHudMatch) record('hud', `${id}: #ammo-mag="${s.ammoMagHud}" != state.mag=${s.mag}`);
    await shot(`1${idx}-w-${id}-hip`);

    // --- RELOAD ---
    const resBefore = s.reserve;
    await ev(() => window.__GREYFALL.player.weapons.tryReload());
    const wcfg = { ar: 2100, smg: 1750, shotgun: 2800, sniper: 3100 }[id];
    await sleep(wcfg + 600);
    s = await gameState();
    rep.reloadOk = s.mag > magBefore || s.reserve < resBefore;
    rep.afterReload = { mag: s.mag, reserve: s.reserve };
    if (!rep.reloadOk) {
      record('weapon', `${id}: reload produced no ammo change (mag ${magBefore}->${s.mag}, res ${resBefore}->${s.reserve})`);
    }

    // --- ADS ---
    await btnDown(2);
    await sleep(400);
    s = await gameState();
    rep.adsOk = s.adsT > 0.85;
    rep.adsFov = s.fov;
    if (!rep.adsOk) record('weapon', `${id}: ADS did not engage (adsT=${s.adsT})`);
    await shot(`1${idx}-w-${id}-ads`);
    await btnUp(2);
    await sleep(300);

    rep.errors = issues.length - wm;
    weaponReport.push(rep);
    log(`${id}: ${JSON.stringify(rep)}`);
  }
  // restore full AR
  await ev(() => window.__GREYFALL.player.weapons.equip('ar'));
  await sleep(500);

  // ===============================================================
  // STEP 3: combat soak - AI damages player for 20s
  // ===============================================================
  phase = '3-combat-soak';
  log('STEP 3: 20s AI combat soak');
  const sm = errMark();
  const samples = [];
  const tele = [];
  const soakStart = Date.now();
  let shot10sDone = false;
  let lastTele = 0;
  while (Date.now() - soakStart < 20000) {
    const s = await gameState();
    samples.push(s);
    if (Date.now() - lastTele > 1000) {
      lastTele = Date.now();
      tele.push(await enemyTelemetry());
    }
    if (!shot10sDone && Date.now() - soakStart > 10000) { await shot('20-combat-soak-mid'); shot10sDone = true; }
    if (!s.alive) { log(`player died during soak at ${(Date.now() - soakStart) / 1000}s`); break; }
    await sleep(300);
  }
  const minHealth = Math.min(...samples.map((x) => x.health));
  const maxVignette = Math.max(...samples.map((x) => parseFloat(x.vignetteOpacity) || 0));
  const maxEnemies = Math.max(...samples.map((x) => x.enemiesAlive));
  const nearestEnemySeen = Math.min(...tele.map((x) => x.nearest ?? Infinity));
  const maxLosCount = Math.max(0, ...tele.map((x) => x.losCount));
  const healthDropped = minHealth < 99.5;
  log(`soak: minHealth=${minHealth} maxVignette=${maxVignette} maxEnemiesAlive=${maxEnemies} nearestEnemy=${nearestEnemySeen === Infinity ? 'n/a' : nearestEnemySeen + 'm'} maxLOScount=${maxLosCount} errors+=${issues.length - sm}`);
  if (!healthDropped) record('combat', `player health never dropped below ${minHealth} in 20s of AI fire (enemies got as close as ${nearestEnemySeen === Infinity ? '?' : nearestEnemySeen + 'm'}, ${maxLosCount} with LOS; takeDamage never fired by AI)`);
  if (maxVignette <= 0) record('hud', 'damage vignette opacity never > 0 despite damage');
  if (maxEnemies === 0) record('ai', 'no enemies ever spawned/engaged during soak');

  // ===============================================================
  // STEP 4: explosive barrel + chain reaction
  // ===============================================================
  phase = '4-barrel';
  log('STEP 4: explosive barrel + chain');
  const bm = errMark();
  // teleport near cluster C (31,60)/(30.2,59.5) but outside 7m blast radius, as test setup
  await ev(() => {
    const G = window.__GREYFALL;
    G.player._feet.set(22, 0, 50);
  });
  await sleep(400);
  let sb = await gameState();
  const barrelsBefore = sb.barrels;
  // nearest barrel from current position
  const target = sb.barrelPos.reduce((best, b) => {
    const d = Math.hypot(b[0] - 22, b[1] - 50);
    return !best || d < best.d ? { b, d } : best;
  }, null);
  log(`barrels before=${barrelsBefore} target=${JSON.stringify(target.b)} dist=${target.d.toFixed(1)}m`);
  await lookAt(target.b[0], 0.6, target.b[1]);
  await sleep(250);
  await btnDown(2); // ADS for accuracy
  await sleep(350);
  let exploded = false;
  for (let attempt = 0; attempt < 8 && !exploded; attempt++) {
    if (attempt > 0) {
      const cur = await gameState();
      if (cur.barrels < barrelsBefore) { exploded = true; break; }
      if (cur.mag === 0) { await ev(() => window.__GREYFALL.player.weapons.tryReload()); await sleep(3600); }
    }
    await btnDown(0); await sleep(150); await btnUp(0);
    for (let i = 0; i < 12; i++) {
      await sleep(150);
      const cur = await gameState();
      if (cur.barrels < barrelsBefore) { exploded = true; break; }
    }
  }
  if (exploded) await shot('21-barrel-explosion');
  await btnUp(2);
  // chain timers fire with ~0.28s stagger - poll up to 3s for additional destruction
  let destroyed = barrelsBefore - (await gameState()).barrels;
  const c0 = Date.now();
  while (Date.now() - c0 < 3000) {
    await sleep(200);
    const cur = (await gameState()).barrels;
    if (barrelsBefore - cur > destroyed) {
      log(`chain: +${barrelsBefore - cur - destroyed} more barrel(s) at +${((Date.now() - c0) / 1000).toFixed(1)}s`);
      destroyed = barrelsBefore - cur;
    }
  }
  let sa = await gameState();
  log(`barrels after=${sa.barrels} (destroyed=${destroyed})`);
  if (!exploded) record('world', `barrel never exploded after 8 shots at ${JSON.stringify(target.b)}`);
  if (exploded && destroyed < 2) record('world', `chain reaction did not occur: only ${destroyed} barrel(s) destroyed (adjacent partner survived?)`);
  await sleep(800);
  sa = await gameState();
  log(`post-chain settle: barrels=${sa.barrels} health=${sa.health} alive=${sa.alive} errors+=${issues.length - bm}`);
  if (sa.health < 100 && sa.alive) log(`note: player took ${100 - sa.health} blast damage`);
  await ev(() => { window.__GREYFALL.player.health = 100; }); // setup heal for determinism

  // ===============================================================
  // STEP 5: force death -> death cam -> GAMEOVER
  // ===============================================================
  phase = '5-death';
  log('STEP 5: forced death');
  const dm = errMark();
  await ev(() => window.__GREYFALL.player.takeDamage(999));
  await sleep(900);
  await shot('22-death-cam');
  const g0 = Date.now();
  let go = null;
  while (Date.now() - g0 < 4000) {
    go = await ev(() => ({
      overShown: document.getElementById('gameover').style.display === 'flex',
      score: document.getElementById('final-score').textContent,
      wave: document.getElementById('final-wave').textContent,
      kills: document.getElementById('final-kills').textContent,
      acc: document.getElementById('final-accuracy').textContent,
      time: document.getElementById('final-time').textContent,
      realLocked: document.pointerLockElement === window.__GREYFALL.engine.renderer.domElement,
      alive: window.__GREYFALL.player.alive
    }));
    if (go.overShown) break;
    await sleep(150);
  }
  const gameoverDelay = (Date.now() - g0) / 1000;
  log(`GAMEOVER after ${gameoverDelay.toFixed(2)}s: ${JSON.stringify(go)}`);
  if (!go || !go.overShown) record('flow', 'GAMEOVER overlay never appeared after death');
  else {
    if (go.score === '' || go.wave === '' || go.kills === '' || go.acc === '' || go.time === '') record('ui', `gameover stats incomplete: ${JSON.stringify(go)}`);
    if (!/^\d+%$/.test(go.acc)) record('ui', `accuracy format odd: "${go.acc}"`);
    if (parseInt(go.kills) === 0 && maxEnemies > 0) log('note: 0 kills recorded (we did not intentionally farm kills)');
  }
  if (go && go.realLocked) record('input', 'pointer still locked on GAMEOVER screen (expected release)');
  if (go && go.alive) record('flow', 'player.alive still true on gameover screen');
  await shot('23-gameover');

  // ===============================================================
  // STEP 6: REDEPLOY -> mission reset
  // ===============================================================
  phase = '6-redeploy';
  log('STEP 6: REDEPLOY');
  const rm = errMark();
  await page.click('#redeploy-btn');
  await sleep(400);
  const rs = await gameState();
  log(`immediately after redeploy: health=${rs.health} weapon=${rs.weapon} enemiesAlive=${rs.enemiesAlive} barrels=${rs.barrels}`);
  // watch for WAVE 1 banner
  const b0 = Date.now();
  let sawWaveBanner = false;
  while (Date.now() - b0 < 5000) {
    const b = await ev(() => ({
      main: document.getElementById('banner-main').textContent,
      vis: document.getElementById('banner').style.opacity !== '0',
      waveNum: document.getElementById('wave-num').textContent
    }));
    if (b.vis && b.main.includes('WAVE 1')) { sawWaveBanner = true; log(`banner seen: "${b.main}" waveNum=${b.waveNum}`); break; }
    await sleep(120);
  }
  if (!sawWaveBanner) record('flow', 'WAVE 1 banner not seen within 5s of REDEPLOY (mission/wave did not visibly reset)');
  await sleep(1800);
  const rr = await gameState();
  const resetChecks = {
    health100: rr.health === 100,
    hudHealth100: rr.hudHealthNum === '100',
    weaponAr: rr.weapon === 'ar',
    weaponNameReset: rr.weaponName.includes('M4'),
    ammoFull: rr.mag === 30 && rr.reserve === 150,
    enemiesClearedOrRespawning: rr.enemiesAlive <= 4,
    scoreZero: rr.scoreHud === '0',
    playing: rr.state === 'playing'
  };
  log(`reset checks: ${JSON.stringify(resetChecks)}`);
  for (const [k, v] of Object.entries(resetChecks)) if (!v) record('reset', `REDEPLOY check failed: ${k}`);
  await shot('24-redeployed');

  // ===============================================================
  // STEP 7: Esc-equivalent (exitPointerLock) -> pause -> RESUME
  // ===============================================================
  phase = '7-pause';
  log('STEP 7: pointer-lock exit -> pause overlay -> RESUME');
  const pm = errMark();
  try {
    await sleep(2500); // let wave 1 engage again
  const prePause = await gameState();
  log(`pre-pause: realLocked=${prePause.realLocked} enemies=${prePause.enemiesAlive} health=${prePause.health}`);
  await ev(() => document.exitPointerLock());
  await sleep(600);
  const pz = await ev(() => ({
    pauseShown: getComputedStyle(document.getElementById('pause')).display !== 'none',
    suspends: window.__qaAudio.suspends,
    resumes: window.__qaAudio.resumes,
    ctxState: window.__qaAudio.ctxs.length ? window.__qaAudio.ctxs[window.__qaAudio.ctxs.length - 1].state : 'none',
    health1: window.__GREYFALL.player.health,
    locked: window.__GREYFALL.input.locked
  }));
  await sleep(700);
  const pz2 = await ev(() => ({ health2: window.__GREYFALL.player.health }));
  const frozen = Math.abs(pz.health1 - pz2.health2) < 0.05;
  log(`pause: shown=${pz.pauseShown} audioSuspends=${pz.suspends} ctxState=${pz.ctxState} simFrozen=${frozen} locked=${pz.locked}`);
  if (!pz.pauseShown) record('flow', 'pause overlay did not appear after document.exitPointerLock() mid-combat');
  if (pz.suspends === 0) record('audio', 'audio.suspend() never called on pause');
  else if (pz.ctxState !== 'suspended') record('audio', `audio ctx state=${pz.ctxState} after pause (expected suspended)`);
  if (!frozen) record('sim', `simulation kept running while paused (health ${pz.health1} -> ${pz2.health2})`);
  await shot('25-paused');

  await page.click('#resume-btn');
  await sleep(800);
  const rz = await ev(() => ({
    pauseHidden: getComputedStyle(document.getElementById('pause')).display === 'none',
    resumes: window.__qaAudio.resumes,
    ctxState: window.__qaAudio.ctxs.length ? window.__qaAudio.ctxs[window.__qaAudio.ctxs.length - 1].state : 'none',
    locked: window.__GREYFALL.input.locked,
    realLocked: document.pointerLockElement === window.__GREYFALL.engine.renderer.domElement
  }));
  log(`resume: hidden=${rz.pauseHidden} resumes=${rz.resumes} ctxState=${rz.ctxState} locked=${rz.locked}/${rz.realLocked}`);
  if (!rz.pauseHidden) record('flow', 'pause overlay still visible after RESUME click');
  if (rz.resumes === 0) record('audio', 'audio.resume() never called on resume');
  if (!rz.realLocked) record('input', `pointer lock not re-acquired after RESUME (state may be playable but mouse look dead) - possible env limitation`);
  } catch (e) { record('harness', 'step7 (pause) crashed: ' + e.message); }

  // ===============================================================
  // STEP 8: idle 15s - errors/warnings + memory
  // ===============================================================
  phase = '8-idle';
  log('STEP 8: 15s idle observation');
  const im = errMark();
  let heapGrowth = null;
  try {
    const warnsBefore = consoleEvents.filter((e) => e.type === 'warn').length;
  const errsBefore = consoleEvents.filter((e) => e.type === 'error' || e.type === 'pageerror').length;
  await ev(() => { window.__GREYFALL.player.health = 100; });
  const memSamples = [];
  const idleStart = Date.now();
  let idleShot = false;
  while (Date.now() - idleStart < 15000) {
    if (!idleShot && Date.now() - idleStart > 7500) { await shot('26-idle-mid'); idleShot = true; }
    const el = (Date.now() - idleStart) / 1000;
    const smp = await ev(() => ({
      heap: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null,
      alive: window.__GREYFALL.player.alive,
      fxChildren: window.__GREYFALL.engine.scene.children.length
    }));
    memSamples.push({ t: +el.toFixed(1), ...smp });
    if (!smp.alive) { log('player died during idle'); break; }
    await ev(() => { if (window.__GREYFALL.player.health < 60) window.__GREYFALL.player.health = 100; }); // keep alive artificially
    await sleep(1000);
  }
  await shot('27-idle-end');
  const heapFirst = memSamples[0]?.heap;
  const heapLast = memSamples[memSamples.length - 1]?.heap;
  const warnsAfter = consoleEvents.filter((e) => e.type === 'warn').length;
  const errsAfter = consoleEvents.filter((e) => e.type === 'error' || e.type === 'pageerror').length;
  heapGrowth = heapFirst != null && heapLast != null ? +(heapLast - heapFirst).toFixed(1) : null;
  log(`idle: heap ${heapFirst}MB -> ${heapLast}MB (growth ${heapGrowth}MB), newErrors=${errsAfter - errsBefore}, newWarnings=${warnsAfter - warnsBefore}`);
  if (heapGrowth != null && heapGrowth > 25) record('memory', `heap grew ${heapGrowth}MB during 15s idle`);
  } catch (e) { record('harness', 'step8 (idle) crashed: ' + e.message); }

  // ===============================================================
  // STEP 9: FPS sampling 10s in combat
  // ===============================================================
  phase = '9-fps';
  log('STEP 9: FPS sampling 10s during combat');
  const fm = errMark();
  let fpsRes = null;
  try {
    await ev(() => { const G = window.__GREYFALL; if (G.player.alive) G.player.health = 100; });
    fpsRes = await ev(async () => {
    const G = window.__GREYFALL;
    G.input.locked = true;
    const deltas = [];
    let last = performance.now();
    let running = true;
    const frame = (t) => { if (!running) return; deltas.push(t - last); last = t; requestAnimationFrame(frame); };
    requestAnimationFrame(frame);
    const canvas = G.engine.renderer.domElement;
    const fire = setInterval(() => {
      canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0 }));
      setTimeout(() => window.dispatchEvent(new MouseEvent('mouseup', { button: 0 })), 140);
    }, 240);
    let ang = 0;
    const look = setInterval(() => {
      ang += 0.4;
      canvas.dispatchEvent(new MouseEvent('mousemove', { movementX: 30 * Math.sin(ang), movementY: 5 * Math.cos(ang * 1.6) }));
    }, 120);
    await new Promise((r) => setTimeout(r, 10000));
    running = false;
    clearInterval(fire); clearInterval(look);
    window.dispatchEvent(new MouseEvent('mouseup', { button: 0 }));
    const sorted = [...deltas].sort((a, b) => a - b);
    const avg = deltas.reduce((a, b) => a + b, 0) / deltas.length;
    return {
      frames: deltas.length,
      avgMs: +avg.toFixed(2),
      avgFps: +(1000 / avg).toFixed(1),
      bestMs: +sorted[0].toFixed(2),
      worstMs: +sorted[sorted.length - 1].toFixed(1),
      spikesOver50: deltas.filter((d) => d > 50).length,
      spikesOver100: deltas.filter((d) => d > 100).length,
      drawCalls: G.engine.renderer.info.render.calls,
      triangles: G.engine.renderer.info.render.triangles,
      heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null,
      alive: G.player.alive
    };
  });
  log(`fps: ${JSON.stringify(fpsRes)}`);
  await shot('28-fps-combat-end');
  if (fpsRes) {
    if (fpsRes.avgFps < 30) record('perf', `avg FPS ${fpsRes.avgFps} below 30 during combat`);
    if (fpsRes.spikesOver100 > 10) record('perf', `${fpsRes.spikesOver100} frames over 100ms in 10s`);
  }
  } catch (e) { record('harness', 'step9 (fps) crashed: ' + e.message); }

  // ===============================================================
  // summary
  // ===============================================================
  phase = 'summary';
  const summary = {
    url: URL,
    realPointerLock: realLockEngaged,
    weaponReport,
    soakStats: { minHealth, maxVignette, maxEnemies, nearestEnemySeen, maxLosCount },
    barrels: { before: barrelsBefore, destroyed },
    fps: fpsRes,
    idleHeapGrowthMB: heapGrowth,
    totalIssues: issues.length,
    issues,
    consoleTail: consoleEvents.slice(-40),
    shots
  };
  fs.writeFileSync(`${OUT}/summary.json`, JSON.stringify(summary, null, 2));
  log('==== SUMMARY ====');
  log(JSON.stringify({
    realPointerLock: realLockEngaged,
    weapons: weaponReport.map((w) => ({ id: w.id, equip: w.equipOk, fired: w.firedOk, reload: w.reloadOk, ads: w.adsOk, errors: w.errors })),
    soak: { minHealth, maxVignette, maxEnemies },
    fps: fpsRes,
    heapGrowthIdle: heapGrowth,
    issueCount: issues.length
  }, null, 2));
  if (issues.length) {
    log('==== ISSUES ====');
    for (const i of issues) log(`[${i.kind}] (${i.phase}) ${i.text.slice(0, 200)}`);
  } else {
    log('NO ISSUES DETECTED BY HARNESS');
  }
  log(`screenshots: ${shots.join(', ')}`);
} finally {
  await browser.close();
}

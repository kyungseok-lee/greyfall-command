import puppeteer from 'puppeteer-core';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL = 'http://localhost:4322/';
const log = (s) => console.log(new Date().toISOString().slice(11, 19), s);

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: false,
  args: [
    '--no-sandbox',
    '--window-size=1600,900',
    '--window-position=20,20',
    '--mute-audio',
    '--use-angle=metal',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-background-timer-throttling'
  ],
  defaultViewport: { width: 1600, height: 900 }
});
try {
  const page = await browser.newPage();
  await page.bringToFront();
  const errs = [];
  page.on('pageerror', (e) => { errs.push(`[pageerror] ${e.message}`); log(`PAGEERROR: ${e.message}`); });
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warn') {
      errs.push(`[${m.type()}] ${m.text()}`);
      log(`CONSOLE.${m.type()}: ${m.text()}`);
    }
  });

  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#deploy-btn', { visible: true });
  await new Promise((r) => setTimeout(r, 1300));
  await page.click('#deploy-btn');
  await new Promise((r) => setTimeout(r, 1500));
  // verify mission actually started; retry once if the click raced the menu fade
  const started = await page.evaluate(() => document.getElementById('menu').style.display !== 'flex');
  if (!started) {
    log('DEPLOY click did not land (menu still shown) - retrying');
    await page.click('#deploy-btn');
    await new Promise((r) => setTimeout(r, 1500));
  }
  log(`mission started: ${(await page.evaluate(() => document.getElementById('menu').style.display !== 'flex'))}`);
  const locked = await page.evaluate(() => window.__GREYFALL.input.locked);
  if (!locked) {
    log('pointer lock not engaged (window unfocused at DEPLOY) - forcing input.locked=true for synthetic input');
    await page.evaluate(() => { window.__GREYFALL.input.locked = true; });
  }

  // stand 12m from cluster A (5 barrels), ADS + fire at nearest
  const clusters = [
    { stand: [22, 0, -50], label: 'A(5 barrels @27-30,-56..-59)' },
    { stand: [-34, 0, -27], label: 'B(pair @-40,-33)' },
    { stand: [25, 0, 54], label: 'C(pair @31,60)' }
  ];
  for (const c of clusters) {
    await page.evaluate(([x, y, z]) => { window.__GREYFALL.player._feet.set(x, y, z); }, c.stand);
    // wait until the render loop actually applied the teleport (guards vs rAF throttling)
    for (let i = 0; i < 20; i++) {
      const settled = await page.evaluate(() => {
        const p = window.__GREYFALL.player;
        return Math.abs(p.position.x - p._feet.x) < 0.1 && Math.abs(p.position.z - p._feet.z) < 0.1;
      });
      if (settled) break;
      await new Promise((r) => setTimeout(r, 250));
    }
    await new Promise((r) => setTimeout(r, 300));
    const before = await page.evaluate(() => ({
      n: window.__GREYFALL.world.barrels.length,
      pos: window.__GREYFALL.world.barrels.map((b) => [+b.position.x.toFixed(1), +b.position.z.toFixed(1)]),
      hp: window.__GREYFALL.player.health
    }));
    // aim at nearest barrel
    await page.evaluate((bx) => {
      const G = window.__GREYFALL;
      const e = G.player.position;
      const t = G.world.barrels.reduce((best, b) => {
        const d = Math.hypot(b.position.x - e.x, b.position.z - e.z);
        return !best || d < best.d ? { b, d } : best;
      }, null);
      const dx = t.b.position.x - e.x, dy = 0.6 - e.y, dz = t.b.position.z - e.z;
      const yaw = Math.atan2(-dx, -dz), pitch = Math.asin(dy / Math.hypot(dx, dy, dz));
      const pl = G.player;
      pl._tYaw = yaw; pl._sYaw = yaw; pl.yaw = yaw;
      pl._tPitch = pitch; pl._sPitch = pitch; pl.pitch = pitch;
      window.__qaTarget = t.d;
    });
    const dist = await page.evaluate(() => window.__qaTarget);
    log(`${c.label}: barrels=${before.n} nearest=${dist.toFixed(1)}m`);
    const canvas = await page.evaluate(() => { window.__GREYFALL.engine.renderer.domElement.id = 'gc'; return true; });
    void canvas;
    await page.evaluate(() => document.getElementById('gc').dispatchEvent(new MouseEvent('mousedown', { button: 2 })));
    await new Promise((r) => setTimeout(r, 300));
    const t0 = Date.now();
    let shots = 0;
    while (Date.now() - t0 < 9000) {
      const st = await page.evaluate(() => ({
        n: window.__GREYFALL.world.barrels.length,
        mag: window.__GREYFALL.player.weapons.state[window.__GREYFALL.player.weapons.currentId].mag
      }));
      if (st.mag === 0) {
        await page.evaluate(() => window.__GREYFALL.player.weapons.tryReload());
        await new Promise((r) => setTimeout(r, 2400));
      }
      await page.evaluate(() => {
        document.getElementById('gc').dispatchEvent(new MouseEvent('mousedown', { button: 0 }));
        setTimeout(() => window.dispatchEvent(new MouseEvent('mouseup', { button: 0 })), 120);
      });
      shots++;
      await new Promise((r) => setTimeout(r, 700));
      const now = await page.evaluate(() => window.__GREYFALL.world.barrels.length);
      if (now < before.n) {
        // wait for chain to fully resolve
        await new Promise((r) => setTimeout(r, 2500));
        break;
      }
    }
    await page.evaluate(() => window.dispatchEvent(new MouseEvent('mouseup', { button: 2 })));
    const after = await page.evaluate(() => ({
      n: window.__GREYFALL.world.barrels.length,
      hp: +window.__GREYFALL.player.health.toFixed(1),
      alive: window.__GREYFALL.player.alive,
      vignette: document.getElementById('damage-vignette').style.opacity || '0'
    }));
    log(`${c.label}: destroyed=${before.n - after.n} playerHP=${after.hp} alive=${after.alive} vignette="${after.vignette}"`);
    if (after.hp < 100) log(`  -> blast damage path WORKS (took ${100 - after.hp})`);
    await page.evaluate(() => { window.__GREYFALL.player.health = 100; });
    await new Promise((r) => setTimeout(r, 500));
  }
  await new Promise((r) => setTimeout(r, 2000));
  const fin = await page.evaluate(() => window.__GREYFALL.world.barrels.length);
  log(`final barrels remaining: ${fin} (expected 0 if all clusters chain-detonated)`);
  log(errs.length ? `ERRORS/WARNINGS (${errs.length}):\n` + errs.join('\n') : 'NO console errors/warnings during all explosions');
  await page.screenshot({ path: '/tmp/gfqa/30-barrel-stress-end.png' });
} finally {
  await browser.close();
}

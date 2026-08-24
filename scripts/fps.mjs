import puppeteer from 'puppeteer-core';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL = process.env.URL || 'http://localhost:4319/';
const SECONDS = parseFloat(process.env.SECS || '20');

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: false,
  args: ['--no-sandbox', '--window-size=1280,800', '--window-position=30,30', '--mute-audio', '--use-angle=metal'],
  defaultViewport: { width: 1280, height: 800 }
});
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await new Promise((r) => setTimeout(r, 3000));
  await page.click('#deploy-btn').catch(() => {});
  await new Promise((r) => setTimeout(r, 4000));

  const result = await page.evaluate(async (secs) => {
    const G = window.__GREYFALL;
    G.input.locked = true;
    const canvas = G.engine.renderer.domElement;
    const deltas = [];
    let last = performance.now();
    let running = true;
    function frame(t) {
      if (!running) return;
      deltas.push(t - last);
      last = t;
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    const fire = setInterval(() => {
      canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0 }));
      setTimeout(() => window.dispatchEvent(new MouseEvent('mouseup', { button: 0 })), 120);
    }, 200);
    let ang = 0;
    const look = setInterval(() => {
      ang += 0.35;
      canvas.dispatchEvent(new MouseEvent('mousemove', { movementX: 26 * Math.sin(ang), movementY: 4 * Math.cos(ang * 1.7) }));
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    }, 120);
    const reload = setInterval(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR' })), 2600);

    await new Promise((r) => setTimeout(r, secs * 1000));
    running = false;
    clearInterval(fire);
    clearInterval(look);
    clearInterval(reload);
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));

    const sorted = [...deltas].sort((a, b) => a - b);
    const avg = deltas.reduce((a, b) => a + b, 0) / deltas.length;
    const p1 = sorted[Math.floor(sorted.length * 0.01)];
    const p05 = sorted[Math.floor(sorted.length * 0.005)];
    const info = G.engine.renderer.info;
    const mem = performance.memory ? (performance.memory.usedJSHeapSize / 1048576).toFixed(0) + 'MB' : 'n/a';
    return {
      fps: (1000 / avg).toFixed(1),
      avgMs: avg.toFixed(2),
      p1Ms: p1?.toFixed(2),
      p05Ms: p05?.toFixed(2),
      worstMs: sorted[sorted.length - 1]?.toFixed(1),
      spikesOver50: deltas.filter((d) => d > 50).length,
      spikesOver100: deltas.filter((d) => d > 100).length,
      heap: mem,
      drawCalls: info.render.calls,
      triangles: info.render.triangles,
      enemiesAlive: G.enemies.aliveCount
    };
  }, SECONDS);

  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}

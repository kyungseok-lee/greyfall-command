import puppeteer from 'puppeteer-core';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL = process.env.URL || 'http://localhost:4319/';
const outDir = '/tmp/greyfall';

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: false,
  args: ['--no-sandbox', '--window-size=1600,900', '--window-position=20,20', '--mute-audio', '--use-angle=metal'],
  defaultViewport: { width: 1600, height: 900 }
});
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await new Promise((r) => setTimeout(r, 3500));
  await page.click('#deploy-btn').catch(() => {});
  await new Promise((r) => setTimeout(r, 4000));

  const poses = [
    ['toward-sun', Math.PI + 0.9],
    ['away-sun', 0.9]
  ];
  for (const [name, yaw] of poses) {
    await page.evaluate((y) => {
      const p = window.__GREYFALL.player;
      p._tYaw = y;
      p._sYaw = y;
      p.yaw = y;
    }, yaw);
    await new Promise((r) => setTimeout(r, 700));
    await page.screenshot({ path: `${outDir}/21-${name}-shadows.png` });
    await page.evaluate(() => {
      const g = window.__GREYFALL;
      g.engine.renderer.shadowMap.enabled = false;
      g.world.group.traverse((o) => {
        if (o.material) o.material.needsUpdate = true;
      });
    });
    await new Promise((r) => setTimeout(r, 400));
    await page.screenshot({ path: `${outDir}/22-${name}-noshadow.png` });
    await page.evaluate(() => {
      const g = window.__GREYFALL;
      g.engine.renderer.shadowMap.enabled = true;
      g.world.group.traverse((o) => {
        if (o.material) o.material.needsUpdate = true;
      });
    });
  }
  console.log('done');
} finally {
  await browser.close();
}

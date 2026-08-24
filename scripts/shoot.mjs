import puppeteer from 'puppeteer-core';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL = process.env.URL || 'http://localhost:4319/';
const outDir = '/tmp/greyfall';
const log = (s) => console.log(new Date().toISOString().slice(11, 19), s);

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: false,
  args: [
    '--no-sandbox',
    '--window-size=1600,900',
    '--window-position=20,20',
    '--mute-audio',
    '--hide-scrollbars',
    '--use-angle=metal'
  ],
  defaultViewport: { width: 1600, height: 900 }
});
log('launched (headed, real GPU)');
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push('[console.error] ' + m.text());
  });

  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await new Promise((r) => setTimeout(r, 4000));
  log('menu shot');
  await page.screenshot({ path: `${outDir}/11-menu.png` });

  await page.click('#deploy-btn').catch((e) => log('click fail: ' + e.message));
  await new Promise((r) => setTimeout(r, 6000));
  log('game shot');
  await page.screenshot({ path: `${outDir}/12-game.png` });

  for (let i = 0; i < 10; i++) {
    await page.mouse.move(800 + Math.sin(i * 1.7) * 260, 450 + Math.cos(i * 2.3) * 120);
    if (i < 6) await page.keyboard.down('KeyW');
    await page.mouse.down({ button: 'left' });
    await new Promise((r) => setTimeout(r, 130));
    await page.mouse.up({ button: 'left' });
    if (i === 4) await page.keyboard.press('KeyR');
    if (i === 7) await page.keyboard.up('KeyW');
  }
  await page.keyboard.up('KeyW');
  await new Promise((r) => setTimeout(r, 1500));
  log('combat shot');
  await page.screenshot({ path: `${outDir}/13-combat.png` });

  await page.keyboard.press('Digit4');
  await new Promise((r) => setTimeout(r, 700));
  await page.mouse.down({ button: 'right' });
  await new Promise((r) => setTimeout(r, 800));
  log('sniper scope shot');
  await page.screenshot({ path: `${outDir}/14-scope.png` });
  await page.mouse.up({ button: 'right' });

  log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'NO_CONSOLE_ERRORS');
} finally {
  await browser.close();
}

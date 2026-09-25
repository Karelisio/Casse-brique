import { chromium, devices } from '@playwright/test';
// Test mobile de fumée : `npm run build && npm run preview` puis `node scripts/e2e-mobile.mjs [dossier-captures]`
// CHROMIUM_PATH permet d'utiliser un Chromium local.
import { mkdirSync } from 'node:fs';
const S = process.argv[2] ?? 'test-results';
mkdirSync(S, { recursive: true });
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const { defaultBrowserType, ...iphone } = devices['iPhone 13'];
const ctx = await browser.newContext(iphone);
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto('http://localhost:4173/');
await page.waitForTimeout(500);
await page.evaluate(() => { const g = window.__game; g.newGame(9); g.launch(); });
await page.waitForTimeout(2500);
await page.screenshot({ path: S + '/7-lvl10.png' });
await page.evaluate(() => { const g = window.__game; const e = g.bricks.find(b => b.mat.id==='explosive' && b.alive); g.damage(e, 1, e.x, e.y, 0, 1, 0, -300); g.timers.laser = 5; });
await page.waitForTimeout(180);
await page.screenshot({ path: S + '/8-explo.png' });
// simulation longue : balle automatique (raquette suit la balle), vérifie absence de tunneling / blocage
const res = await page.evaluate(async () => {
  const g = window.__game; g.newGame(0);
  let escaped = 0, maxT = 0;
  for (let i = 0; i < 120 * 90; i++) {
    if (g.state === 'ready') g.launch();
    if (g.state !== 'playing' && g.state !== 'ready') break;
    const b = g.balls[0]; if (b) g.paddle.targetX = b.x + 8;
    g.step(1/120);
    for (const ball of g.balls) { if (ball.y < g.top - 1 || ball.x < 0 || ball.x > 400) escaped++;
      for (const br of g.bricks) if (br.alive && ball.x > br.x+1 && ball.x < br.x+br.w-1 && ball.y > br.y+1 && ball.y < br.y+br.h-1) escaped++; }
    maxT = i;
  }
  return { state: g.state, left: g.bricks.filter(b=>b.alive).length, lives: g.lives, score: g.score, escaped, steps: maxT };
});
console.log(JSON.stringify(res));
console.log('ERRORS', errs);
if (errs.length || res.escaped) process.exitCode = 1;
await browser.close();

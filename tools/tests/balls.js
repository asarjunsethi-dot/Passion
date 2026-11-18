// Usage: serve web/ on http://127.0.0.1:8765 (python3 -m http.server 8765 --bind 127.0.0.1 from web/),
// then NODE_PATH=$(npm root -g) node tools/tests/balls.js  (screenshots go to $SHOTS, default /tmp/shots/)
const { chromium } = require('playwright');
const out = process.env.SHOTS || '/tmp/shots/';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-proxy-server'] });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const logs = []; page.on('pageerror', e => logs.push('PAGEERROR ' + e.message)); page.on('console', m => { if (m.type()==='error') logs.push(m.text().slice(0,600)); });
  await page.goto('http://127.0.0.1:8765/index.html?seed=12345');
  await page.waitForFunction(() => window.__river && __river.ready, null, { timeout: 60000 }).catch(() => logs.push('not ready'));
  await page.screenshot({ path: out + 'ui_start.png' });
  const r = await page.evaluate(() => {
    const R = __river, b = R.boat, F = R.floaters; R.setManual(true); R.startGame(); R.setClock(150);
    // put a ball right in front of the boat and drive into it
    const f = F[0]; f.x = b.x + -Math.sin(b.th)*4; f.y = b.y + Math.cos(b.th)*4; f.vx = f.vy = 0;
    const x0 = f.x, y0 = f.y;
    R.input.up = true; for (let i=0;i<90;i++) R.step(1/60); R.input.up = false;
    return { balls: F.length, ballMoved: +Math.hypot(f.x - x0, f.y - y0).toFixed(1), ballSpeed: +Math.hypot(f.vx, f.vy).toFixed(1) };
  });
  console.log(JSON.stringify(r));
  await page.evaluate(() => { const R = __river, f = R.floaters; for (let k=1;k<6;k++){ f[k].x = R.boat.x + (k-3)*1.6; f[k].y = R.boat.y + 3 + (k%2); } R.cam.x = R.boat.x; R.cam.y = R.boat.y + 1.5; R.cam.half = 5; R.tick(1/60); });
  await page.screenshot({ path: out + 'balls.png', timeout: 120000 });
  console.log('errors:', logs.join('\n') || 'none');
  await browser.close();
})();

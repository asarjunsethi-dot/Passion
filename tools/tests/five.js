// Usage: serve web/ on http://127.0.0.1:8765 (python3 -m http.server 8765 --bind 127.0.0.1 from web/),
// then NODE_PATH=$(npm root -g) node tools/tests/five.js  (screenshots go to $SHOTS, default /tmp/shots/)
const { chromium } = require('playwright');
const out = process.env.SHOTS || '/tmp/shots/';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-proxy-server'] });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const logs = []; page.on('pageerror', e => logs.push('PAGEERROR ' + e.message)); page.on('console', m => { if (m.type()==='error') logs.push(m.text().slice(0,600)); });
  await page.goto('http://127.0.0.1:8765/index.html?seed=12345');
  await page.waitForFunction(() => window.__river && __river.ready, null, { timeout: 60000 }).catch(() => logs.push('not ready'));
  if (logs.length){ console.log(logs.join('\n')); return browser.close(); }
  for (const k of ['Digit4', 'Digit5']){
    const r = await page.evaluate((k) => {
      const R = __river, b = R.boat; window.dispatchEvent(new KeyboardEvent('keydown', { code: k }));
      R.resetGame(); R.setManual(true); R.startGame(); R.setClock(150); R.input.up = true; let top = 0;
      for (let i=0;i<300;i++){ R.step(1/60); top = Math.max(top, Math.hypot(b.vx, b.vy)); }
      R.input.up = false; for (let i=0;i<60;i++) R.step(1/60);
      R.cam.x = b.x; R.cam.y = b.y + 0.8; R.cam.half = k === 'Digit5' ? 5.5 : 3.2; R.tick(1/60);
      return { boat: k, top: Math.round(top*3.6) };
    }, k);
    console.log(JSON.stringify(r));
    await page.screenshot({ path: out + 'b_' + k + '.png', timeout: 120000 });
  }
  await page.evaluate(() => { const s = document.getElementById('pix'); s.value = 4; s.dispatchEvent(new Event('input')); __river.cam.half = 14; __river.tick(1/60); });
  await page.waitForTimeout(300);
  await page.evaluate(() => __river.tick(1/60));
  await page.screenshot({ path: out + 'pixel4.png', timeout: 120000 });
  console.log('errors:', logs.join('\n') || 'none');
  await browser.close();
})();

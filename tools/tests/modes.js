// Usage: serve web/ on http://127.0.0.1:8765 (python3 -m http.server 8765 --bind 127.0.0.1 from web/),
// then NODE_PATH=$(npm root -g) node tools/tests/modes.js  (screenshots go to $SHOTS, default /tmp/shots/)
const { chromium } = require('playwright');
const out = process.env.SHOTS || '/tmp/shots/';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-proxy-server'] });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const logs = []; page.on('pageerror', e => logs.push('PAGEERROR ' + e.message)); page.on('console', m => { if (m.type()==='error') logs.push(m.text().slice(0,600)); });
  await page.goto('http://127.0.0.1:8765/index.html?seed=12345');
  await page.waitForFunction(() => window.__river && __river.ready, null, { timeout: 60000 }).catch(() => logs.push('not ready'));
  if (logs.length){ console.log(logs.join('\n')); return browser.close(); }
  const r = await page.evaluate(() => {
    const R = __river, b = R.boat, I = R.input, res = {};
    R.setManual(true); R.startGame();
    const run = (n, set) => { for (let i=0;i<n;i++){ set && set(i); R.step(1/60); } };
    const reset = () => { for (const k in I) I[k] = false; };
    const local = (x0, y0, th) => { const dx = b.x - x0, dy = b.y - y0; return { fwd: +(dx*-Math.sin(th) + dy*Math.cos(th)).toFixed(2), right: +(dx*Math.cos(th) + dy*Math.sin(th)).toFixed(2) }; };
    let x0 = b.x, y0 = b.y, th0 = b.th;
    reset(); I.strafeR = true; run(120); reset(); run(30); res.strafeRight = local(x0, y0, th0);
    x0 = b.x; y0 = b.y; th0 = b.th;
    I.left = true; run(120); reset(); run(20); res.spinLeft = { turnedDeg: Math.round((b.th - th0)*57.3), moved: +Math.hypot(b.x - x0, b.y - y0).toFixed(2) };
    x0 = b.x; y0 = b.y; th0 = b.th;
    I.down = true; run(150); reset(); run(20); res.reverse = local(x0, y0, th0);
    I.up = true; run(120);
    let maxZ = 0, landed = false, boost0 = b.boost;
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    run(90, () => { maxZ = Math.max(maxZ, b.z); if (maxZ > 0.2 && b.z === 0) landed = true; });
    res.jump = { maxZ: +maxZ.toFixed(2), landed, boostUsed: +(boost0 - b.boost).toFixed(2) };
    reset();
    return res;
  });
  console.log(JSON.stringify(r));
  await page.evaluate(() => { const R = __river; R.setClock(150); R.input.strafeL = true; for (let i=0;i<40;i++) R.step(1/60); R.cam.x = R.boat.x; R.cam.y = R.boat.y + 0.6; R.cam.half = 3.6; R.tick(0.0001); });
  await page.screenshot({ path: out + 'boat_close.png', timeout: 120000 });
  await page.evaluate(() => { const R = __river; R.input.strafeL = false; R.input.up = true; R.input.boost = true; for (let i=0;i<30;i++) R.step(1/60); R.setClock(450); R.cam.x = R.boat.x; R.cam.y = R.boat.y; R.cam.half = 6; R.tick(0.0001); });
  await page.screenshot({ path: out + 'boat_night.png', timeout: 120000 });
  console.log('errors:', logs.join('\n') || 'none');
  await browser.close();
})();

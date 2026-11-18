// Usage: serve web/ on http://127.0.0.1:8765 (python3 -m http.server 8765 --bind 127.0.0.1 from web/),
// then NODE_PATH=$(npm root -g) node tools/tests/boats.js  (screenshots go to $SHOTS, default /tmp/shots/)
const { chromium } = require('playwright');
const out = process.env.SHOTS || '/tmp/shots/';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-proxy-server'] });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const logs = []; page.on('pageerror', e => logs.push('PAGEERROR ' + e.message)); page.on('console', m => { if (m.type()==='error') logs.push(m.text().slice(0,600)); });
  await page.goto('http://127.0.0.1:8765/index.html?seed=12345');
  await page.waitForFunction(() => window.__river && __river.ready, null, { timeout: 60000 }).catch(() => logs.push('not ready'));
  await page.waitForTimeout(800);
  await page.screenshot({ path: out + 'start_min.png' });
  if (logs.length){ console.log(logs.join('\n')); return browser.close(); }
  for (const k of ['Digit1', 'Digit2', 'Digit3']){
    const r = await page.evaluate(async (k) => {
      const R = __river, b = R.boat;
      window.dispatchEvent(new KeyboardEvent('keydown', { code: k }));
      R.resetGame(); R.setManual(true); R.startGame(); R.setClock(150);
      // open water: point at the island ring tangent and drive
      R.input.up = true; let top = 0;
      for (let i=0;i<360;i++){ R.step(1/60); top = Math.max(top, Math.hypot(b.vx, b.vy)); }
      R.input.boost = true; let topB = 0;
      for (let i=0;i<180;i++){ R.step(1/60); topB = Math.max(topB, Math.hypot(b.vx, b.vy)); }
      R.input.boost = false; R.input.up = false; R.input.down = true;
      let minFwd = 1e9;
      for (let i=0;i<360;i++){ R.step(1/60); const vf = b.vx*-Math.sin(b.th) + b.vy*Math.cos(b.th); minFwd = Math.min(minFwd, vf); }
      R.input.down = false;
      return { boat: k, top: Math.round(top*3.6), boosted: Math.round(topB*3.6), slowestDuringBrake: +minFwd.toFixed(2) };
    }, k);
    console.log(JSON.stringify(r));
    await page.evaluate(() => { const R = __river, f = R.floaters; let k = 0; for (const b of f){ if (k > 5) break; } R.cam.x = R.boat.x; R.cam.y = R.boat.y + 0.8; R.cam.half = 3.8; R.tick(1/60); });
    await page.screenshot({ path: out + 'boat_' + k + '.png', timeout: 120000 });
  }
  await page.evaluate(() => { const R = __river, F = R.floaters; const s = [...F].sort((a,b) => b.r - a.r); [s[0], s[3], s[8], s[F.length-1], s[F.length-2]].forEach((f, i) => { f.x = R.boat.x - 6 + i*3.2; f.y = R.boat.y + 4; f.vx = f.vy = 0; }); R.cam.x = R.boat.x; R.cam.y = R.boat.y + 3; R.cam.half = 6; R.tick(1/60); });
  await page.screenshot({ path: out + 'ball_sizes.png', timeout: 120000 });
  console.log('errors:', logs.join('\n') || 'none');
  await browser.close();
})();

// How quickly the boat answers the keys. Serve web/ on http://127.0.0.1:8765 (or pass another port), then:
// NODE_PATH=$(npm root -g) node tools/tests/response.js [port]
const { chromium } = require('playwright');
const port = process.argv[2] || 8765;
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-proxy-server'] });
  const p = await b.newPage({ viewport: { width: 480, height: 270 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(`http://127.0.0.1:${port}/index.html?seed=12345&offline=1`); await p.waitForFunction(() => window.__river && __river.ready);
  const key = (code, down) => p.evaluate(([c, d]) => dispatchEvent(new KeyboardEvent(d ? 'keydown' : 'keyup', { code: c, bubbles: true })), [code, down]);
  await p.evaluate(() => { const R = __river; R.setManual(true); R.startGame(); R.boat.x = 0; R.boat.y = -70; R.boat.th = 0; R.boat.vx = R.boat.vy = R.boat.w = 0; });
  // 1. throttle: seconds to 90% of top speed, and to reach full throttle
  await key('KeyW', true);
  const accel = await p.evaluate(() => { const R = __river; let t90 = null, tThr = null, top = 0, sp = [];
    for (let i = 0; i < 600; i++){ R.step(1/60); sp.push(Math.hypot(R.boat.vx, R.boat.vy)); if (tThr === null && R.boat.throttle > 0.9) tThr = (i + 1)/60; }
    top = Math.max(...sp); t90 = (sp.findIndex(v => v > top*0.9) + 1)/60;
    return { secondsToFullThrottle: tThr, secondsTo90PercentSpeed: +t90.toFixed(2) }; });
  // 2. steering at speed: seconds until the turn rate is 90% of its steady value
  await key('KeyA', true);
  const steer = await p.evaluate(() => { const R = __river, w = [];
    for (let i = 0; i < 180; i++){ R.step(1/60); w.push(R.boat.w); }
    const steady = w[w.length - 1]; return { secondsTo75PercentTurn: +((w.findIndex(v => v > steady*0.75) + 1)/60).toFixed(2), degreesPerSecondAt0_3s: Math.round(w[17]*57.3) }; });   // the turn keeps creeping up as the boat slows, so 75%
  await key('KeyA', false);
  // 3. jump with an almost empty boost meter
  const lowBoost = await p.evaluate(() => { const R = __river; for (let i = 0; i < 60; i++) R.step(1/60); R.boat.boost = 0.1; return null; });
  await key('Space', true); await key('Space', false);
  const jumpLow = await p.evaluate(() => { const R = __river; let z = 0; for (let i = 0; i < 40; i++){ R.step(1/60); z = Math.max(z, R.boat.z); } return +z.toFixed(2); });
  // 4. a press 0.1 s before landing
  await p.evaluate(() => { const R = __river; for (let i = 0; i < 120; i++) R.step(1/60); R.boat.boost = 1; });
  await key('Space', true); await key('Space', false);
  const early = await p.evaluate(() => { const R = __river; let i = 0; for (; i < 200; i++){ R.step(1/60); if (R.boat.vz < 0 && R.boat.z < 0.9) break; } return i; });
  await key('Space', true); await key('Space', false);
  const buffered = await p.evaluate(() => { const R = __river; let z2 = 0, landed = false;
    for (let i = 0; i < 90; i++){ R.step(1/60); if (R.boat.z <= 0.001) landed = true; if (landed) z2 = Math.max(z2, R.boat.z); } return +z2.toFixed(2); });
  // 5. holding Space: key repeat must not jump again
  await p.evaluate(() => { const R = __river; for (let i = 0; i < 120; i++) R.step(1/60); R.boat.boost = 1; });
  let jumps = 0;
  for (let k = 0; k < 12; k++){
    await p.evaluate(([first]) => dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', repeat: !first, bubbles: true })), [k === 0]);
    jumps += await p.evaluate(() => { const R = __river; let n = R.boat.jumpT > 0.3 ? 1 : 0;   // a jump just fired (on the key, or on landing)
      for (let i = 0; i < 8; i++){ const before = R.boat.jumpT; R.step(1/60); if (R.boat.jumpT > before + 0.1) n++; } return n; });
  }
  await key('Space', false);
  console.log(JSON.stringify({ accel, steer, jumpWithBoost10Percent: jumpLow, jumpPressed0_1sBeforeLanding: buffered, jumpsWhileHoldingSpace1_6s: jumps }), errs.join(' | ') || 'no errors');
  await b.close();
})();

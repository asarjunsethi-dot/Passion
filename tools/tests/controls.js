// Gamepad, touch stick and frame timing. Serve web/ on http://127.0.0.1:8765, then:
// NODE_PATH=$(npm root -g) node tools/tests/controls.js
const { chromium, devices } = require('playwright');
const ARGS = ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-proxy-server'];
(async () => {
  const browser = await chromium.launch({ args: ARGS });
  const errors = [];
  // 1. a fake standard gamepad: stick left and forward, then A to jump
  const p = await browser.newPage({ viewport: { width: 640, height: 360 } });
  p.on('pageerror', e => errors.push(e.message));
  await p.addInitScript(() => {
    window.__pad = { axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), connected: true, mapping: 'standard' };
    navigator.getGamepads = () => [window.__pad];
  });
  await p.goto('http://127.0.0.1:8765/index.html?seed=12345&offline=1');
  await p.waitForFunction(() => window.__river && __river.ready);
  const pad = await p.evaluate(() => {
    const R = __river; R.setManual(true);
    __pad.axes[0] = -0.8; __pad.axes[1] = -1;                      // left stick: left and forward
    const th0 = R.boat.th, x0 = R.boat.x, y0 = R.boat.y;
    for (let i = 0; i < 120; i++){ R.pollGamepad(); R.step(1/60); }
    const turned = R.boat.th - th0, moved = Math.hypot(R.boat.x - x0, R.boat.y - y0), started = R.state;
    __pad.buttons[0] = { pressed: true, value: 1 }; R.pollGamepad(); R.step(1/60);   // A: jump
    __pad.buttons[0] = { pressed: false, value: 0 };
    let maxZ = 0; for (let i = 0; i < 60; i++){ R.pollGamepad(); R.step(1/60); maxZ = Math.max(maxZ, R.boat.z); }
    __pad.axes = [0, 0, 0, 0]; for (let i = 0; i < 30; i++){ R.pollGamepad(); R.step(1/60); }
    return { started, movedMeters: +moved.toFixed(1), turnedDegrees: +(turned*180/Math.PI).toFixed(0), jumpHeight: +maxZ.toFixed(2), throttleAfterRelease: +R.boat.throttle.toFixed(2) };
  });
  console.log('gamepad', JSON.stringify(pad));
  // 2. frame timing: jittery 144 hertz timestamps step at the steady interval
  const timing = await p.evaluate(() => { const R = __river; const out = [];
    for (let i = 0; i < 40; i++) out.push(R.steadyDt(1/144 + (Math.random() - 0.5)*0.002));
    const hitch = R.steadyDt(0.03);
    return { estimateMs: +(R.frameEst*1000).toFixed(2), lastStepsMs: out.slice(-3).map(v => +(v*1000).toFixed(2)), hitchMs: +(hitch*1000).toFixed(1) }; });
  console.log('timing', JSON.stringify(timing));
  await p.close();
  // 3. touch on a phone: put the thumb down in the lower left, drag right; the boat should turn to face east and go
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const t = await ctx.newPage(); t.on('pageerror', e => errors.push(e.message));
  await t.goto('http://127.0.0.1:8765/index.html?seed=12345&offline=1');
  await t.waitForFunction(() => window.__river && __river.ready);
  await t.evaluate(() => __river.setManual(true));
  const vp = t.viewportSize(), sx = vp.width*0.25, sy = vp.height*0.8;
  // drag north, then swing the thumb to the west without lifting it; time each turn and its overshoot
  const settle = (target) => t.evaluate((want) => { const R = __river; let tSet = null, worst = 0, x0 = R.boat.x, y0 = R.boat.y;
    for (let i = 0; i < 300; i++){ R.step(1/60);
      const err = Math.atan2(Math.sin(R.boat.th - want), Math.cos(R.boat.th - want))*180/Math.PI;
      if (tSet === null && Math.abs(err) < 5) tSet = i/60; else if (tSet !== null) worst = Math.max(worst, Math.abs(err)); }
    return { secondsToFace: tSet, overshootDegrees: +worst.toFixed(1), metersMoved: +Math.hypot(R.boat.x - x0, R.boat.y - y0).toFixed(1) }; }, target);
  await t.mouse.move(sx, sy); await t.mouse.down(); await t.mouse.move(sx, sy - 90, { steps: 5 });
  const touch = { state: await t.evaluate(() => __river.state), north: await settle(0) };
  await t.mouse.move(sx - 60, sy - 60, { steps: 3 }); await t.mouse.move(sx - 150, sy - 60, { steps: 4 });
  touch.west = await settle(Math.PI/2);
  await t.mouse.up();
  touch.afterRelease = await t.evaluate(() => [__river.input.tOn, __river.input.tx, __river.input.ty]);
  touch.layout = await t.evaluate(() => { const r = __river; return { pixelCap: r.pixelCap, canvas: [document.getElementById('c').width, document.getElementById('c').height], hint: document.getElementById('go').textContent }; });
  console.log('touch', JSON.stringify(touch));
  await t.screenshot({ path: (process.env.SHOTS || '/tmp/shots/') + 'touch.png' });
  console.log('errors:', errors.join(' | ') || 'none');
  await browser.close();
})();

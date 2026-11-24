// Sound: starts on the first key, the engine follows the throttle, output is not silent, M mutes.
// Serve web/ on http://127.0.0.1:8765, then: NODE_PATH=$(npm root -g) node tools/tests/sound.js
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-proxy-server','--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 480, height: 270 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://127.0.0.1:8765/index.html?seed=12345&offline=1'); await p.waitForFunction(() => window.__river && __river.ready);
  const before = await p.evaluate(() => !!__river.sound.ctx);
  await p.keyboard.down('KeyW');                                  // the first key starts the audio and the boat
  await p.waitForTimeout(1200);
  const s1 = await p.evaluate(() => new Promise(done => { const S = __river.sound, c = S.ctx, a = c.createAnalyser(); a.fftSize = 2048; S.master.connect(a);
    setTimeout(() => { const d = new Float32Array(a.fftSize); a.getFloatTimeDomainData(d); let e = 0; for (const v of d) e += v*v;
      done({ state: c.state, engineHz: Math.round(S.o1.frequency.value), washGain: +S.wg.gain.value.toFixed(3), outputRms: +Math.sqrt(e/d.length).toFixed(4) }); }, 300); }));
  await p.keyboard.up('KeyW');
  await p.keyboard.press('Space'); await p.waitForTimeout(400);
  await p.keyboard.press('KeyM'); await p.waitForTimeout(200);
  const muted = await p.evaluate(() => ({ on: __river.sound.on, state: __river.sound.ctx.state, button: document.getElementById('sndbtn').className }));
  await p.keyboard.press('KeyM'); await p.waitForTimeout(300);
  const back = await p.evaluate(() => __river.sound.ctx.state);
  console.log(JSON.stringify({ audioBeforeAnyKey: before, whileThrottling: s1, afterM: muted, afterMAgain: back }), errs.join(' | ') || 'no errors');
  await b.close();
})();

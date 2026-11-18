// Usage: serve web/ on http://127.0.0.1:8765 (python3 -m http.server 8765 --bind 127.0.0.1 from web/),
// then NODE_PATH=$(npm root -g) node tools/tests/lakebot.js  (screenshots go to $SHOTS, default /tmp/shots/)
const { chromium } = require('playwright');
const out = process.env.SHOTS || '/tmp/shots/';
const N = +(process.argv[2] || 300), clock = process.argv[3], name = process.argv[4] || 'lake', seed = process.argv[5] || '12345';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-proxy-server'] });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const logs = [];
  page.on('pageerror', e => logs.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') logs.push(m.text().slice(0, 1500)); });
  await page.goto('http://127.0.0.1:8765/index.html?seed=' + seed);
  await page.waitForFunction(() => window.__river && __river.ready, null, { timeout: 60000 }).catch(e => logs.push('not ready'));
  if (logs.length){ console.log(logs.join('\n')); await browser.close(); return; }
  console.log('props', await page.evaluate(() => __river.props), 'gates', await page.evaluate(() => __river.gates.length));
  await page.evaluate(c => { __river.setManual(true); __river.startGame(); if (c) __river.setClock(+c); }, clock);
  for (let i=1;i<=N;i++){
    if (i % 900 === 0) console.log(i/60 + 's', JSON.stringify(await page.evaluate(() => ({ hp: Math.round(__river.boat.hp), gates: __river.score.gates, next: __river.nextGate, st: __river.state, spd: +Math.hypot(__river.boat.vx, __river.boat.vy).toFixed(1) }))));
    await page.evaluate(() => {
      const R = __river, b = R.boat, g = R.gates[R.nextGate];
      const tx = g.x - g.tan[0]*2, ty = g.y - g.tan[1]*2;                 // aim a bit before the gate centre
      const d = Math.hypot(g.x - b.x, g.y - b.y), aimX = d < 6 ? g.x + g.tan[0]*4 : tx, aimY = d < 6 ? g.y + g.tan[1]*4 : ty;
      const cross = (-Math.sin(b.th))*(aimY-b.y) - Math.cos(b.th)*(aimX-b.x);
      R.input.up = true; R.input.left = cross > 0.6; R.input.right = cross < -0.6; R.step(1/60);
    });
  }
  
  console.log(JSON.stringify(await page.evaluate(() => ({ x:+__river.boat.x.toFixed(1), y:+__river.boat.y.toFixed(1), hp: Math.round(__river.boat.hp), st: __river.state, gates: __river.score.gates, next: __river.nextGate }))));
  try { await page.evaluate(() => __river.tick(1/60)); await page.screenshot({ path: out + name + '.png', timeout: 120000 }); } catch(e) { console.log('screenshot skipped'); }
  console.log('errors:', logs.join('\n') || 'none');
  await browser.close();
})();

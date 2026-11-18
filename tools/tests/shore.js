// Usage: serve web/ on http://127.0.0.1:8765 (python3 -m http.server 8765 --bind 127.0.0.1 from web/),
// then NODE_PATH=$(npm root -g) node tools/tests/shore.js  (screenshots go to $SHOTS, default /tmp/shots/)
const { chromium } = require('playwright');
const out = process.env.SHOTS || '/tmp/shots/';
// usage: node shore.js name clock camx camy half  (camera placed directly)
const [name, clock, cx, cy, half] = process.argv.slice(2);
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-proxy-server'] });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const logs = []; page.on('pageerror', e => logs.push(e.message)); page.on('console', m => { if (m.type()==='error') logs.push(m.text().slice(0,800)); });
  await page.goto('http://127.0.0.1:8765/index.html?seed=12345');
  await page.waitForFunction(() => window.__river && __river.ready, null, { timeout: 60000 });
  await page.evaluate(([c, x, y, h]) => { const R = __river; R.setManual(true); R.startGame(); R.input.up = true;
    for (let i=0;i<20;i++) R.tick(1/60);
    R.setClock(+c); if (x !== 'boat'){ R.cam.x = +x; R.cam.y = +y; } R.cam.half = +h; R.tick(0.00001); }, [clock, cx, cy, half]);
  await page.screenshot({ path: out + name + '.png' });
  console.log(name, logs.join('\n') || 'ok');
  await browser.close();
})();

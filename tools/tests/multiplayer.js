// Two browsers on one lake through the live Supabase Realtime service.
// Serve web/ on http://127.0.0.1:8765, then: NODE_PATH=$(npm root -g) node tools/tests/multiplayer.js  (screenshots go to $SHOTS, default /tmp/shots/)
// The session network must allow yghxquvblqkqyzqjfvbx.supabase.co. A random seed keeps the test out of real players' rooms.
const { chromium } = require('playwright');
const SP = (process.env.SHOTS || '/tmp/shots/').replace(/\/$/, ''), SEED = 400000 + Math.floor(Math.random()*90000);
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ proxy: { server: process.env.HTTPS_PROXY, bypass: '127.0.0.1,localhost' },
    args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
  const open = async (name) => {
    const ctx = await browser.newContext({ viewport: { width: 640, height: 360 } });
    const p = await ctx.newPage(); p.logs = [];
    p.on('pageerror', e => p.logs.push(e.message)); p.on('console', m => { if (m.type() === 'error') p.logs.push(m.text().slice(0, 200)); });
    await p.goto(`http://127.0.0.1:8765/index.html?seed=${SEED}&name=${name}`);
    await p.waitForFunction(() => window.__river && __river.ready);
    return p;
  };
  const A = await open('Alice'), B = await open('Bob');
  const net = p => p.evaluate(() => __river.net);
  let t0 = Date.now();
  await A.waitForFunction(() => __river.net.joined, null, { timeout: 30000 });
  await B.waitForFunction(() => __river.net.joined, null, { timeout: 30000 });
  console.log('both joined in', Date.now() - t0, 'ms; seed', SEED);
  await B.waitForFunction(() => __river.net.online.includes('Alice'), null, { timeout: 30000 });
  await A.waitForFunction(() => __river.net.online.includes('Bob'), null, { timeout: 30000 });
  console.log('presence ok: A sees', (await net(A)).online, 'B sees', (await net(B)).online);
  await A.evaluate(() => { __river.startGame(); __river.input.up = true; __river.input.left = true; });
  await B.waitForFunction(() => __river.net.remotes.length === 1, null, { timeout: 30000 });
  for (let i = 0; i < 4; i++){
    await sleep(4000);
    const a = await A.evaluate(() => ({ x: __river.boat.x, y: __river.boat.y, sent: __river.net.sent }));
    const rb = (await net(B)).remotes[0];
    console.log(`A at (${a.x.toFixed(1)}, ${a.y.toFixed(1)}) sent ${a.sent}; B draws Alice at (${rb.x.toFixed(1)}, ${rb.y.toFixed(1)}), gap ${Math.hypot(a.x - rb.x, a.y - rb.y).toFixed(2)} m`);
  }
  await A.evaluate(() => { __river.input.left = false; });
  console.log('B idle sends so far:', (await net(B)).sent, '(Bob is moored, so about one a second of game time)');
  await B.setViewportSize({ width: 960, height: 540 });
  await B.evaluate(() => __river.watch());
  console.log('B watching:', await B.evaluate(() => __river.watching), 'A id', await A.evaluate(() => __river.id));
  await sleep(6000);
  await B.screenshot({ path: SP + '/mp_watch.png' });
  await B.evaluate(() => __river.watch());          // back to own boat
  await sleep(3000);
  await B.screenshot({ path: SP + '/mp_home.png' });
  t0 = Date.now();
  await A.context().close();
  await B.waitForFunction(() => __river.net.online.length === 0 && __river.net.remotes.length === 0, null, { timeout: 30000 });
  console.log('Alice left; Bob saw it in', Date.now() - t0, 'ms');
  console.log('errors A:', A.logs.join(' | ') || 'none', ' B:', B.logs.join(' | ') || 'none');
  await browser.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });

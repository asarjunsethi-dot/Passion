// Name entry and the 5 minute away rule, with two browsers through the live Supabase Realtime service.
// Serve web/ on http://127.0.0.1:8765, then: NODE_PATH=$(npm root -g) node tools/tests/names.js
// The session network must allow yghxquvblqkqyzqjfvbx.supabase.co.
const { chromium } = require('playwright');
const SEED = 400000 + Math.floor(Math.random()*90000);
(async () => {
  const browser = await chromium.launch({ proxy: { server: process.env.HTTPS_PROXY || 'direct://', bypass: '127.0.0.1,localhost' },
    args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
  const open = async () => {
    const ctx = await browser.newContext({ viewport: { width: 480, height: 270 } });
    const p = await ctx.newPage(); p.logs = []; p.on('pageerror', e => p.logs.push(e.message));
    await p.goto(`http://127.0.0.1:8765/index.html?seed=${SEED}`);
    await p.waitForFunction(() => window.__river && __river.net.joined, null, { timeout: 30000 });
    return p;
  };
  const A = await open(), B = await open();
  await B.waitForFunction(() => __river.net.online.length === 1, null, { timeout: 30000 });
  console.log('B first sees:', await B.evaluate(() => __river.net.online));
  await A.click('#nick'); await A.fill('#nick', 'Captain <b>Ana</b>'); await A.press('#nick', 'Enter');
  await B.waitForFunction(() => __river.net.online[0] && __river.net.online[0].startsWith('Captain'), null, { timeout: 15000 });
  console.log('after rename B sees:', await B.evaluate(() => __river.net.online), '| field shows:', await A.inputValue('#nick'));
  console.log('typing in the field started the game?', await A.evaluate(() => __river.state));
  await A.evaluate(() => __river.setIdle(5*60*1000 + 1000));
  let t = Date.now();
  await B.waitForFunction(() => __river.net.online.length === 0, null, { timeout: 20000 });
  console.log('A away:', await A.evaluate(() => __river.away), '| gone from B after', Date.now() - t, 'ms | A still sees B:', await A.evaluate(() => __river.net.online));
  t = Date.now();
  await A.mouse.move(100, 100); await A.mouse.move(140, 120);
  await B.waitForFunction(() => __river.net.online.length === 1, null, { timeout: 15000 });
  console.log('A back after input; B sees again after', Date.now() - t, 'ms:', await B.evaluate(() => __river.net.online));
  console.log('errors:', [...A.logs, ...B.logs].join(' | ') || 'none');
  await browser.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });

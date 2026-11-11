import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = await readFile(path.join(here, '../web/pocket-lab.html'), 'utf8');
new vm.Script(source.match(/<script>([\s\S]*?)<\/script>/)[1]);
const core = source.split('/* POCKET_LAB_CORE_START */')[1].split('/* POCKET_LAB_CORE_END */')[0];
const context = vm.createContext({ TextEncoder, crypto: webcrypto, document: {}, console });
vm.runInContext(core + '\nglobalThis.PocketLab={createState,queueText,advance,act,restoreState,byteLength};', context);
const coreAssertions = () => {
  const api = globalThis.PocketLab;
  const result = {};
  let now = 1000;
  let s = api.createState(now);
  s.linkOpen = false;
  api.queueText(s, 'cami', 'Hello, Crew!', now, '1111111111111111');
  api.advance(s, now + 1000);
  result.offline = s.nodes.cami.outbox[0].status === 'queued' && s.nodes.crew.inbox.length === 0;
  s.linkOpen = true;
  api.advance(s, now + 1001);
  result.inFlight = s.nodes.cami.outbox[0].status === 'in_flight';
  api.advance(s, now + 1401);
  result.arrivalNotAck = s.nodes.crew.inbox.length === 1 && s.nodes.cami.outbox[0].status === 'in_flight';
  api.advance(s, now + 1701);
  result.acked = s.nodes.cami.outbox[0].status === 'delivered';
  s = api.createState(now);
  s.duplicatePackets = true;
  s.dropNextAck = true;
  api.queueText(s, 'cami', 'One message only', now, '2222222222222222');
  for (let t = now; t <= now + 5000; t += 250) api.advance(s, t);
  result.retryDedup = s.nodes.crew.inbox.length === 1 && s.nodes.cami.outbox[0].attempts === 2 && s.nodes.cami.outbox[0].status === 'delivered' && s.duplicates > 0;
  s = api.createState(now);
  api.queueText(s, 'cami', 'Receipt never returns', now, '5555555555555555');
  for(let t=now;t<=now+30000;t+=250){s.dropNextAck=true;api.advance(s,t);}
  result.boundedRetries=s.nodes.cami.outbox[0].attempts===4 && s.nodes.cami.outbox[0].status==='failed' && s.nodes.crew.inbox.length===1;
  const restored=api.restoreState(JSON.stringify(s),now+30000);
  result.persistedDedup=restored.nodes.crew.inbox.length===1 && restored.nodes.crew.seen.includes('cami:5555555555555555');
  result.persistedFailure=restored.nodes.cami.outbox[0].status==='failed';
  s = api.createState(now);
  s.linkOpen = false;
  api.queueText(s, 'cami', 'Expires', now, '3333333333333333');
  api.advance(s, now + 120001);
  result.expired = s.nodes.cami.outbox[0].status === 'expired';
  result.limits = [];
  for (const value of ['', '   ', '🙂'.repeat(31)]) {
    try { api.queueText(s, 'crew', value, now, '4444444444444444'); result.limits.push(false); }
    catch { result.limits.push(true); }
  }
  result.utf8 = api.byteLength('🙂'.repeat(30)) === 120;
  s = api.createState(now);
  for (let i = 0; i < 20; i++) api.act(s, 'cami', 'explore');
  result.energyFloor = s.nodes.cami.pet.energy >= 0;
  api.act(s, 'cami', 'care');
  result.careRecovers = s.nodes.cami.pet.energy > 0;
  result.invalidSave = api.restoreState('{broken', now).nodes.cami.pet.species === 'mossling';
  result.badVersion = api.restoreState(JSON.stringify({ version: 99 }), now).version === 1;
  return result;
};
const coreResult = vm.runInContext('('+coreAssertions.toString()+')()', context);
for (const [name, value] of Object.entries(coreResult)) assert.equal(Array.isArray(value) ? value.every(Boolean) : value, true, name);
console.log('PASS: full-script syntax, offline queue, application ACK, bounded retries, duplicate suppression, expiry, UTF-8 cap, game bounds, persistence, and malformed-save recovery.');
if (!process.argv.includes('--browser')) {
  console.log('Browser UI checks are opt-in: node tests/browser-smoke.mjs --browser (requires Playwright + Chromium).');
  process.exit(0);
}
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES + '/playwright')); }
const executablePath = process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
const browser = await chromium.launch({ headless: true, executablePath, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 1360, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setContent(source);
  const result = await page.evaluate(coreAssertions);
  for (const [name, value] of Object.entries(result)) {
    assert.equal(Array.isArray(value) ? value.every(Boolean) : value, true, name);
  }
  await page.locator('#cami-message').fill('<img src=x onerror=alert(1)>');
  await page.locator('#cami-send').click();
  await page.waitForTimeout(1200);
  assert.equal(await page.locator('.message-body').filter({ hasText: '<img src=x onerror=alert(1)>' }).count(), 2);
  assert.equal(await page.locator('img').count(), 0, 'User messages are rendered as text');
  const before = await page.locator('#cami-xp').textContent();
  await page.locator('[data-node="cami"][data-task="train"]').click();
  await page.locator('#cami-a').click();
  assert.notEqual(await page.locator('#cami-xp').textContent(), before, 'Physical-style A button performs selected game task');
  assert.equal(errors.length, 0, errors.join('\n'));
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Mobile layout does not overflow');
  console.log('PASS: offline queue, application ACK, retry/dedup, expiry, UTF-8 cap, game bounds, save recovery, safe rendering, buttons, mobile layout, no runtime errors.');
} finally { await browser.close(); }

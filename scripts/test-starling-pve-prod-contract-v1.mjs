import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('production Guild Lounge exposes signed PvE and report controls without giving fiction Quest authority',()=>{
  const src=read('public/app/starling-lounge-v1.mjs');
  for(const term of ['data-sl-action="turn"','data-sl-action="round"','data-sl-action="cloud-pve"',
    'storyMode:\'pve\'','runCloudPveTurn','createStarlingGuildReportPanel','data-sl-report-root',
    'recordHostJobs','Sync report','pve'])assert.ok(src.includes(term),'Missing PvE/report integration: '+term);
  assert.match(src,/allowLifetimeCredits:false/);
  assert.match(src,/globalThis\.confirm\?\./);
  assert.doesNotMatch(src,/autoPay|autoSpendPaidCredits/);
});
test('cloud reporting cannot bill another Guild or use lifetime credits',()=>{
  const router=read('public/app/server-ai-router-v301.js');
  assert.match(router,/starlingCloud\?mobileGuildCapacitySession\(\):usableCapacitySession\(\)/);
  assert.match(router,/request\?\.guildId!==session\.guildId/);
  assert.match(router,/starling-cloud-report-bridge-v1\.mjs/);
  const turns=read('public/app/shared/starling-collective-turns-v1.mjs');
  assert.match(turns,/length>=4/);
  assert.match(turns,/allowLifetimeCredits:false/);
  assert.match(turns,/storyMode!=='pve'/);
});
test('production Pocket report sync is paged and canonical Guild edge requires existing authentication',()=>{
  const phone=read('public/app/pocket-guild-node-v1.mjs');
  const edge=read('cloudflare/mobile-guild-edge/src/index.mjs');
  assert.match(phone,/primaryCursor/);
  assert.match(phone,/hasMore!==true/);
  assert.match(edge,/listEnvelopesSince\(after=0,limit=200\)/);
  assert.match(edge,/WHERE seq > \? ORDER BY seq ASC LIMIT \?/);
  assert.match(edge,/await authenticate\(request,guildState\)/);
});
test('signed report and PvE modules ship in optional offline shell assets',()=>{
  const shell=read('public/service-worker-shell-assets-v1.js');
  for(const name of ['starling-story-pve-v1.mjs','starling-daily-report-v1.mjs',
    'starling-report-producers-v1.mjs','starling-report-ui-v1.mjs',
    'starling-cloud-report-bridge-v1.mjs'])assert.match(shell,new RegExp(name.replaceAll('.','\\.')));
});

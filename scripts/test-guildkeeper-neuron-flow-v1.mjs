import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildGuildNeuronFlow } from '../cloudflare/mobile-guild-edge/src/guild-neuron-flow-v1.mjs';

const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const now = Date.parse('2026-10-31T20:18:00Z');
const members = [
  { nodeId:'node-a',userId:'alice',seatClass:'community' },
  { nodeId:'node-b',userId:'bob',seatClass:'community' },
  { nodeId:'node-c',userId:'chris',seatClass:'community' }
];
const capacity = {
  guildId:'guild-a',memberCount:3,starterNodes:[
    {nodeId:'node-a'},{nodeId:'node-b'},{nodeId:'node-c'}
  ],dailyCeilingNeurons:2700,dailyUsedNeurons:300,dailyRemainingNeurons:2400,
  includedDailyNeurons:900
};
test('neuron flow presents verified Guild Cloud charges, remaining allowance, seven UTC days, and per-node/member breakdown', () => {
  const flow=buildGuildNeuronFlow({now,capacity,members,usageRows:[
    {day:'2026-10-31',node_id:'node-a',user_id:'alice',neurons:120},
    {day:'2026-10-31',node_id:'node-b',user_id:'bob',neurons:180},
    {day:'2026-10-30',node_id:'node-a',user_id:'alice',neurons:40},
    {day:'2026-10-24',node_id:'node-a',user_id:'alice',neurons:9999},
  ]});
  assert.equal(flow.schema,'civweave.guild-neuron-flow.v1');
  assert.equal(flow.day,'2026-10-31');
  assert.equal(flow.today.chargedNeurons,300);
  assert.equal(flow.today.includedRemainingNeurons,2400);
  assert.equal(flow.today.includedDailyCeilingNeurons,2700);
  assert.equal(flow.today.utilizationPercent,11);
  assert.equal(flow.history.length,7);
  assert.deepEqual(flow.history.at(-1),{day:'2026-10-31',chargedNeurons:300});
  assert.equal(flow.history.at(-2).chargedNeurons,40);
  assert.equal(flow.history[0].chargedNeurons,0);
  assert.equal(flow.nodes.find(x=>x.nodeId==='node-a').chargedNeuronsToday,120);
  assert.equal(flow.nodes.find(x=>x.nodeId==='node-b').chargedNeuronsToday,180);
  assert.equal(flow.nodes.find(x=>x.nodeId==='node-c').chargedNeuronsToday,0);
  assert.equal(flow.residents.find(x=>x.userId==='alice').remainingNeuronsToday,780);
  assert.equal(flow.residents.find(x=>x.userId==='chris').remainingNeuronsToday,900);
  assert.equal(flow.source,'guild-cloud-workers-ai-charged-usage');
  assert.equal(flow.coverage.externalNodesIncluded,false);
  assert.equal(flow.coverage.deviceLocalModelsIncluded,false);
  assert.equal(flow.coverage.cloudflareAccountFreePoolIncluded,false);
  assert.equal(flow.resetsAt,'2026-11-01T00:00:00.000Z');
});
test('departed residents remain in Guild totals anonymously, unknown nodes and invalid charges are excluded',()=>{
  const flow=buildGuildNeuronFlow({now,capacity,members,usageRows:[
    {day:'2026-10-31',node_id:'node-a',user_id:'alice',neurons:120},
    {day:'2026-10-31',node_id:'node-a',user_id:'former-member',neurons:50},
    {day:'2026-10-31',node_id:'unknown',user_id:'alice',neurons:900},
    {day:'2026-10-31',node_id:'node-b',user_id:'bob',neurons:-5},
    {day:'2026-10-31',node_id:'node-b',user_id:'bob',neurons:'nan'}
  ]});
  assert.equal(flow.today.chargedNeurons,170);
  assert.equal(flow.today.includedRemainingNeurons,2530);
  assert.equal(flow.today.unassignedNeurons,50);
  assert.equal(flow.today.overdrawnNeurons,0);
  assert.equal(flow.history.at(-1).chargedNeurons,170);
  assert.equal(flow.residents.find(x=>x.userId==='alice').chargedNeuronsToday,120);
});
test('Guildkeeper neuron monitor is a server-authenticated owner-only read on the canonical Guild management route',()=>{
  const edge=source('cloudflare/mobile-guild-edge/src/creator-provenance-entry.mjs');
  const ui=source('public/app/guild-owner-management-v1.js');
  const campus=source('public/app/working-campus-v440.html');
  assert.match(edge,/authorizedOwner\(b64url\(digest\)\)/);
  assert.match(edge,/neuronFlow:await stub\.neuronFlow\(\)/);
  assert.match(edge,/neuronFlow\(\)\s*\{/);
  assert.match(edge,/FROM resident_usage WHERE day>=\?/);
  assert.match(ui,/data-gm-neuron-flow/);
  assert.match(ui,/Neuron flow/);
  assert.match(ui,/data-gm-action="refresh"/);
  assert.match(ui,/Guild Cloud/);
  assert.match(campus,/guild-owner-management-v1\.js/);
});

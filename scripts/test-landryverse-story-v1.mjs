import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Script} from 'node:vm';
import {
 loadLandryverseInputs,
 buildLandryverseBlueprint,
 runScriptedLandryverseTableRead,
 buildLandryverseDraft,
 buildLandryverseArtifact
} from './build-landryverse-story-v1.mjs';
import {exportPortableUniverseHtml} from '../public/app/shared/worldweaver-portable-client-v1.mjs';

const fixtureUrl=new URL('../docs/universe/the-girls-who-stole-tomorrow/rehearsals/02-scripted-test.json',import.meta.url);
const inputs=await loadLandryverseInputs();

test('story pack uses the author proposal and 11 bounded, distinct roles',()=>{
 assert.equal(inputs.manifest.id,'landryverse-girls-who-stole-tomorrow');
 assert.equal(inputs.cast.characters.length,11);
 assert.equal(new Set(inputs.cast.characters.map(p=>p.id)).size,11);
 assert.equal(inputs.loom.universeId,inputs.manifest.id);
 assert.equal(inputs.loom.provenance.castApproval,'pending');
 assert.deepEqual(inputs.loom.provenance.runtimeReceipts,[]);
 assert.equal(inputs.cast.approval,'required-by-human-author');
 assert.equal(inputs.manifest.integration.actorProvisioning,false);
});

test('portable story uses canonical bundled Civweave client with zero author-only spoilers',()=>{
 const blueprint=buildLandryverseBlueprint(inputs);
 assert.equal(blueprint.id,inputs.manifest.id);
 assert.equal(blueprint.rooms.length,4);
 assert.ok(blueprint.rooms.every(room=>room.stations.length>0));
 assert.ok(blueprint.prompts.some(x=>x.includes('photograph')));
 const html=exportPortableUniverseHtml(blueprint);
 assert.match(html,/<!doctype html>/i);
 assert.match(html,/id="cw-quest-form"/);
 assert.match(html,/id="cw-journal-form"/);
 assert.match(html,/id="cw-room-list"/);
 assert.match(html,/id="cw-universe-data"/);
 assert.doesNotMatch(html,/<script[^>]+src=/i);
 assert.doesNotMatch(html,/<iframe/i);
 assert.doesNotMatch(html,/Other Landry|counterpart.landry|Auction Registrar|Library Beyond Tomorrow/i);
 const json=html.match(/<script id="cw-universe-data" type="application\/json">([\s\S]*?)<\/script>/)?.[1];
 assert.ok(json,'single-file world data is embedded');
 const world=JSON.parse(json);
 assert.equal(world.rooms.length,4);
 assert.ok(world.rooms.some(r=>r.id==='diner'));
 const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
 assert.ok(script,'offline Civweave client is embedded');
 // Ensures the embedded browser script compiles, without claiming a live server.
 new Script(script);
});

test('canonical Worldweaver creates four draft rooms and never provisions a server',()=>{
 const result=buildLandryverseDraft(buildLandryverseBlueprint(inputs));
 assert.equal(result.instances.length,4);
 assert.ok(result.instances.every(x=>x.status==='draft'&&x.world===null&&x.scope==='standalone'));
 assert.ok(result.stations.length>=4);
 assert.equal(result.intents.length,0);
 assert.equal(result.npcs.length,0);
 assert.equal(result.screens.length,4);
});

test('scripted chapter table read preserves voice, turns, knowledge and explicit uncertainty',()=>{
 const report=runScriptedLandryverseTableRead(inputs);
 assert.equal(report.schema,'civweave.landryverse.rehearsal-test.v1');
 assert.equal(report.status,'passed');
 assert.equal(report.mode,'scripted-no-inference');
 assert.equal(report.modelCalls,0);
 assert.equal(report.turnCount,14);
 assert.deepEqual(report.scenes,['kitchen','bakery','diner']);
 assert.ok(report.roles.includes('landry')&&report.roles.includes('delia')&&report.roles.includes('magnus')&&report.roles.includes('maggie'));
 assert.equal(report.authorApproval,'pending');
 assert.equal(report.externalWorldWrites,0);
 assert.equal(report.canonChanges,0);
});

test('unavailable knowledge and a future villain are rejected from public turn packets',()=>{
 const broken=structuredClone(inputs);
 broken.fixture.turns[8].factsUsed=['private other Landry spoiler'];
 assert.throws(()=>runScriptedLandryverseTableRead(broken),/unavailable knowledge/i);
 const leaked=structuredClone(inputs);
 leaked.fixture.turns[0].text='The Other Landry built the auction.';
 assert.throws(()=>runScriptedLandryverseTableRead(leaked),/spoiler/i);
 const impersonated=structuredClone(inputs);
 impersonated.fixture.turns[5].actor='counterpart-landry';
 assert.throws(()=>runScriptedLandryverseTableRead(impersonated),/not authorized.*chapter/i);
});

test('artifact builder produces a real HTML file payload and report without remote work',()=>{
 const bundle=buildLandryverseArtifact(inputs);
 assert.ok(bundle.html.length>6000);
 assert.match(bundle.html,/Offline client/);
 assert.equal(bundle.report.mode,'scripted-no-inference');
 assert.equal(bundle.report.draftWorld.instances.length,4);
 assert.equal(bundle.report.pilotRuntime,'not-connected');
 assert.equal(bundle.report.authorApproval,'pending');
 assert.doesNotMatch(bundle.html,/counterpart-landry|Other Landry/i);
});

test('fixture stays readable and under a bounded size',async()=>{
 const raw=await readFile(fixtureUrl,'utf8');
 assert.ok(raw.length<30000);
 const data=JSON.parse(raw);
 assert.equal(data.mode,'scripted-no-inference');
 assert.deepEqual(data.turns.map(t=>t.id),Array.from({length:14},(_,i)=>'t'+String(i+1).padStart(2,'0')));
});

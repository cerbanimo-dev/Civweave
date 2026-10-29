import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CivweaveStarlingLoungeV1} from '../public/app/starling-lounge-v1.mjs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('Lounge imports the one native Collective owner and existing Guild read client',()=>{
 const src=read('public/app/starling-lounge-v1.mjs');
 assert.equal(CivweaveStarlingLoungeV1.version,'1.0.0');
 assert.match(src,/starling-collective-v1\.mjs/);
 assert.match(src,/starling-collective-tools-v1\.mjs/);
 assert.match(src,/CivweaveGuildQuestsV1/);
 assert.match(src,/reportedOnly|member-reported|member-published|member-reported/i);
 assert.doesNotMatch(src,/localStorage\.setItem|indexedDB\.open|api\/node\/quests\/publish/);
});
test('Lounge uses Civweave chat only; no invented personal messaging or auto claims',()=>{
 const src=read('public/app/starling-lounge-v1.mjs');
 assert.match(src,/CivweaveFamilyAILoaderV105/);
 assert.match(src,/openChat\('civweave'/);
 assert.doesNotMatch(src,/claimTask\(|castVote\(|chargeAcorns\(/);
});
test('selected Guild card launches native Lounge and no duplicate app route',()=>{
 const src=read('public/app/cerbanimo-intention-landscape-v1.js');
 assert.match(src,/data-starling-lounge/);
 assert.match(src,/import\('\/app\/starling-lounge-v1\.mjs/);
});
test('original eight avatar assets available for cast and stage',()=>{
 const src=read('public/app/starling-lounge-v1.mjs');
 assert.match(src,/assets\/starling/);
 for(const name of ['aphra','jae','anthony','rosa','sana','kit','farah','kami']){
   assert.match(read('public/app/assets/starling/'+name+'.svg'),/<svg/);
 }
});
test('Guildkeeper submits founding Intention in signed Pocket Guild genesis',()=>{
 const html=read('public/app/index.html');
 const creator=read('public/app/mobile-guild-create-v1.mjs');
 assert.match(html,/id="mobile-guild-intention"/);
 assert.match(html,/foundingIntention:intention\.value/);
 assert.match(creator,/normalizeFoundingIntention\(foundingIntention\)/);
 assert.match(creator,/foundingIntention:initialIntention/);
});

test('Lounge reloads signed Collective turns and only starts inference by explicit control',()=>{
 const src=read('public/app/starling-lounge-v1.mjs');
 assert.match(src,/createCollectiveTurnService/);
 assert.match(src,/\.readTurns\(/);
 assert.match(src,/\.runOneTurn\(/);
 assert.match(src,/data-sl-action="turn"/);
 assert.match(src,/data-sl-turn-status/);
 assert.doesNotMatch(src,/civweave:starling-turn-recorded/);
 assert.match(src,/CivweaveModelRuntime/);
});

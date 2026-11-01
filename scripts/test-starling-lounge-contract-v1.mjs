import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CivweaveStarlingLoungeV1} from '../public/app/starling-lounge-v1.mjs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('Lounge imports the one native Collective owner and existing Guild read client',()=>{
 const src=read('public/app/starling-lounge-v1.mjs');
 assert.equal(CivweaveStarlingLoungeV1.version,'1.3.0');
 assert.match(src,/starling-collective-v1\.mjs/);
 assert.match(src,/starling-collective-tools-v1\.mjs/);
 assert.match(src,/CivweaveGuildQuestsV1/);
 assert.match(src,/reportedOnly|member-reported|member-published|member-reported/i);
 assert.doesNotMatch(src,/indexedDB\.open|api\/node\/quests\/publish/);
 assert.match(src,/localStorage\.setItem\(hostPreference/);
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

test('Lounge can explicitly start a bounded multi-persona round without a background timer',()=>{
 const src=read('public/app/starling-lounge-v1.mjs');
 assert.match(src,/data-sl-action="round"/);
 assert.match(src,/\.runRound\(/);
 assert.match(src,/function runLocalRound\(/);
 assert.doesNotMatch(src,/setInterval\(|requestIdleCallback\(/);
});

test('Guildkeeper controls local automation while Lounge is open; no hidden hosted scheduling',()=>{
 const src=read('public/app/starling-lounge-v1.mjs');
 assert.match(src,/createStarlingGuildWorker/);
 assert.match(src,/data-sl-action="worker-toggle"/);
 assert.match(src,/data-sl-worker-status/);
 assert.match(src,/\.enable\(/);
 assert.match(src,/\.disable\(/);
 assert.match(src,/\.start\(/);
 assert.match(src,/\.stop\(/);
 assert.match(src,/navigator\.locks/);
});

test('Commune HUD includes the collective cast and system guides without inventing agent status',()=>{
 const source=read('public/app/starling-lounge-v1.mjs');
 const css=read('public/app/starling-lounge-v1.css');
 for(const name of ['weaveling','moss','kamiya','rook','merlin']){
   assert.ok(source.includes(name+':{'),name+' has a system guide identity');
   assert.ok(source.includes('/app/assets/ai/'+name+'.png'),name+' has an illustrated avatar');
 }
 assert.match(source,/data-sl-ensemble/);
 assert.match(source,/data-sl-guides/);
 assert.match(source,/data-sl-view="world"/);
 assert.match(source,/data-sl-view="operations"/);
 assert.match(source,/data-sl-world-host/);
 assert.match(source,/aria-pressed/);
 assert.match(css,/prefers-reduced-motion/);
 assert.match(css,/safe-area-inset-bottom/);
 assert.match(source,/return \{status:'standby'/);
 assert.match(source,/status:'working'/);
 assert.match(source,/\!STARLING_PERSONAS\[state\.selectedAgent\]/);
 assert.doesNotMatch(source,/setInterval\(|Math\.random\(/);
});

test('Visual Worldweaver handoff requires a snapshot provider and never creates model authority',()=>{
 const source=read('public/app/starling-lounge-v1.mjs');
 assert.match(source,/function attachWorldSource/);
 assert.match(source,/createWorldMap2DView/);
 assert.match(source,/function detachWorldSource/);
 assert.match(source,/getSnapshot/);
 assert.doesNotMatch(source,/createWorldweaver\(/);
 assert.match(source,/This is a schematic, not a verified character location/);
});

test('Worldweaver Commune mounts signed world and real 3D/2D providers without duplicate NPC runtime',()=>{
 const src=read('public/app/starling-lounge-v1.mjs');
 const host=read('public/app/shared/worldweaver-commune-host-v1.mjs');
 const styles=read('public/app/starling-lounge-v1.css');
 assert.match(src,/worldweaver-commune-host-v1\.mjs/);
 assert.match(src,/createOpenSim3DPreview/);
 assert.match(src,/createWorldMap2DView/);
 assert.match(src,/data-sl-action="world-provision"/);
 assert.match(src,/data-sl-action="world-3d"/);
 assert.match(src,/data-sl-action="world-2d"/);
 assert.match(src,/civweave:guide-chat-state/);
 assert.match(src,/CivweaveGuideChatSurfaceV350/);
 assert.match(src,/\.state\?\.\(\)/);
 assert.match(host,/createWorldweaver/);
 assert.match(host,/validateObject/);
 assert.match(host,/foundingDeviceId/);
 assert.match(host,/local-renderer/);
 assert.doesNotMatch(src,/\.dispatch\(\{type:'queue-actions'/);
 assert.match(styles,/sl-world-avatars/);
 assert.match(styles,/prefers-reduced-motion/);
});

test('Local/Guild Fleet scopes are first class and canonical local model inventory remains private',()=>{
 const src=read('public/app/starling-lounge-v1.mjs');
 const css=read('public/app/starling-lounge-v1.css');
 const settings=read('public/app/shared/civweave-ai-fleet-v1.js');
 assert.match(src,/data-sl-fleet="local"/);
 assert.match(src,/data-sl-fleet="guild"/);
 assert.match(src,/localFleetProjection/);
 assert.match(src,/guildFleetProjection/);
 assert.match(src,/worldObservationPrompt/);
 assert.match(src,/drawSignedPilots/);
 assert.match(css,/data-sl-fleet="local"/);
 assert.match(css,/data-sl-fleet="guild"/);
 assert.match(settings,/data-ai-fleet-guild/);
 assert.match(settings,/data-ai-fleet-local/);
});


test('Fleet interface contains all rendered Local and Guild sections and valid nested markup',()=>{
 const source=read('public/app/starling-lounge-v1.mjs');
 const match=source.match(/root\.innerHTML=`([\s\S]*?)`;/);
 assert.ok(match,'Lounge contains a static, inspectable initial UI');
 const markup=match[1];
 const unique=[
  'data-sl-local-fleet','data-sl-local-roles','data-sl-local-status',
  'data-sl-guild-fleet','data-sl-guild-pilots','data-sl-guild-count',
  'data-sl-simulator-status','data-sl-observation',
  'data-sl-fallback-dock','data-sl-ensemble','data-sl-world-host',
  'data-sl-fleet="local"','data-sl-fleet="guild"',
  'data-sl-move-x','data-sl-move-y'
 ];
 for(const key of unique){
  assert.equal(markup.split(key).length-1,1,key+' must be present exactly once');
 }
 const stack=[],voidTags=new Set(['img','input','br','hr','meta','link']),tags=[...markup.matchAll(/<\/?([a-z][a-z0-9-]*)\b[^>]*>/g)];
 for(const match of tags){
  const name=match[1],end=match[0].startsWith('</');
  if(voidTags.has(name))continue;
  if(!end)stack.push(name);
  else assert.equal(stack.pop(),name,'mismatched '+name+' container');
 }
 assert.deepEqual(stack,[],'no unterminated HUD containers');
 assert.match(markup,/class="sl-chrome"/);
 assert.match(markup,/class="sl-stage-dock"/);
});
test('Civweave brand chrome and avatar decks use flow-based collision-safe layouts',()=>{
 const css=read('public/app/starling-lounge-v1.css');
 const src=read('public/app/starling-lounge-v1.mjs');
 const brand=css.indexOf('Civweave Fleet Design System');
 assert.ok(brand>0,'brand design layer installed');
 const responsive=css.slice(brand);
 for(const token of [
  '--sl-cyan:#8af5d2','--sl-gold:#f1c68b','--sl-lilac:#e4b7fa',
  '.sl-chrome{','.sl-ensemble{','.sl-world-avatars{',
  '.sl-world-legend,','grid-template-columns:repeat(auto-fit,',
  '@media(max-width:900px)','@media(max-width:700px)','@media(max-width:380px)',
  'prefers-reduced-motion','env(safe-area-inset-bottom'
 ])assert.ok(css.includes(token),'Expected '+token);
 assert.match(responsive,/\.sl-chrome\{[\s\S]*?position:sticky;top:0/);
 assert.match(responsive,/\.sl-ensemble\{[\s\S]*?position:relative/);
 assert.match(responsive,/\.sl-world-avatars\{[\s\S]*?position:relative/);
 assert.match(responsive,/\.sl-world-legend,[\s\S]*?position:relative/);
 assert.match(src,/if\(avatars\)avatars.hidden=false/);
 assert.match(css,/\[data-sl-fleet=local\] \.sl-side\{display:none!important\}/);
 assert.match(css,/data-sl-view=world\] \[data-sl-panel=world\]/);
 assert.match(src,/style\.href='\/app\/starling-lounge-v1\.css\?v=brand-responsive-fleet-r5'/);
});
test('Schematic building footprints cannot collide at targeted phone and desktop widths',()=>{
 const intersects=(a,b)=>a.left<b.right&&b.left<a.right&&a.top<b.bottom&&b.top<a.bottom;
 const positions=(width,height)=>{
  const small=width<=700;
  const positions=small?[[26,29],[74,29],[26,63],[74,63]]:[[14,35],[38,34],[63,35],[86,34]];
  const buildingWidth=small?Math.min(width*.35,128):Math.max(86,Math.min(width*.16,144));
  const buildingHeight=small?84:104; // Includes raised ornamental roof
  return positions.map(([x,y])=>({left:width*x/100-buildingWidth/2,right:width*x/100+buildingWidth/2,
   top:height*y/100-buildingHeight/2,bottom:height*y/100+buildingHeight/2}));
 };
 for(const [width,height] of [[260,310],[300,310],[360,320],[390,320],[600,390],[700,390],[701,420],[900,420],[1100,420]]){
  const rects=positions(width,height);
  for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++)
   assert.equal(intersects(rects[i],rects[j]),false,'Building '+i+' and '+j+' collide at '+width+'px');
 }
 const css=read('public/app/starling-lounge-v1.css');
 assert.match(css,/\.sl-building-school\{left:26%;top:29%\}/);
 assert.match(css,/\.sl-building-forge\{left:74%;top:29%\}/);
 assert.match(css,/\.sl-building-supply\{left:26%;top:63%\}/);
 assert.match(css,/\.sl-building-council\{left:74%;top:63%\}/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [mapSource,chatSource,reviewSource]=await Promise.all(['public/app/shared/quest-pathway-map-v1.js','public/app/guide-chat-surface-v350.js','public/app/shared-review-surface-v234.js'].map(read));
const key='civweave.intentions.v127';
const item=()=>({id:'pipeline-quest',kind:'weave-plan',state:'review',plan:{id:'pipeline-quest',schema:'civweave.intention-weave.v1',state:'review',title:'A real saved Quest fixture',outcome:'A usable local checklist',paths:[{id:'execution-path',realm:'cerbanimo',title:'Write the checklist',steps:[{id:'write-step',title:'Write and save the checklist'}]}]}});
async function browser(t,{missing=false}={}){
  const dom=new JSDOM('<!doctype html><html><head></head><body></body></html>',{url:'https://civweave.test/app/persistent-system-shell-v1.html?system=civweave',runScripts:'outside-only'});t.after(()=>dom.window.close());const win=dom.window,quest=item(),navigations=[];
  win.structuredClone=structuredClone;win.requestAnimationFrame=fn=>fn();win.CivweaveLocalSpecializedAI={};win.CivweaveGuideGenerationTrackerV1={version:'1.2.23-guide-generation-tracker-v1-universal-artifact-rail',install(){}};
  // DOM discovery is outside this caller contract; isolate it from jsdom teardown.
  win.MutationObserver=class{observe(){}disconnect(){}};
  win.CivweavePersistentSystemShellV1={navigate(system,options){navigations.push({system,options});return true}};
  win.localStorage.setItem(key,JSON.stringify(missing?[]:[quest]));win.localStorage.setItem('civweave.guide-thread.v350.civweave',JSON.stringify({messages:[{id:'generated-reply',role:'assistant',guide:'civweave',text:'The generated Quest is saved.',approvalGate:{kind:'intention-activation',planId:quest.id},planSnapshot:quest.plan}]}));
  win.eval(mapSource);win.eval(chatSource);win.eval(reviewSource);if(win.document.readyState==='loading')win.document.dispatchEvent(new win.Event('DOMContentLoaded'));win.CivweaveGuideChatSurfaceV350.open({guide:'civweave',focus:false});await new Promise(resolve=>setImmediate(resolve));
  return{win,quest,navigations,chat:win.document.getElementById('cw-persistent-guide-chat-v215')};
}

test('the saved generated response exposes its actual Quest trail immediately without opening review',async t=>{
  const b=await browser(t),map=b.chat.querySelector('[data-quest-pathway-map]');assert.ok(map,'Generation completion must place the saved Quest map directly alongside the answer.');assert.equal(map.dataset.questId,b.quest.id);assert.match(map.textContent,/Write and save the checklist/);assert.equal(b.win.document.querySelector('#cw-shared-review-surface-v234'),null);
  const bubble=b.chat.querySelector('.cw350-bubble'),before=bubble.firstChild;b.win.CivweaveGuideChatSurfaceV350.render();assert.equal(b.chat.querySelector('[data-quest-pathway-map]'),map,'Unchanged map DOM must survive ordinary transcript rendering.');assert.equal(bubble.firstChild,before);
});

test('node inspection and editing enter canonical review, and Guild submission only enters the named preview route',async t=>{
  const b=await browser(t),map=b.chat.querySelector('[data-quest-pathway-map]');assert.ok(map);const before=b.win.localStorage.getItem(key);map.querySelector('[data-quest-map-action="inspect"][data-step-id="write-step"]').click();assert.equal(b.win.document.activeElement,b.win.document.querySelector('[data-review-path="0"]'));assert.equal(b.win.localStorage.getItem(key),before);
  b.win.CivweaveSharedReviewSurfaceV234.close();map.querySelector('[data-quest-map-action="edit"]').click();assert.equal(b.win.document.activeElement,b.win.document.querySelector('[name="revisionNote"]'));assert.equal(b.win.localStorage.getItem(key),before);
  b.win.CivweaveSharedReviewSurfaceV234.close();map.querySelector('[data-quest-map-action="submit-guild"]').click();assert.deepEqual(JSON.parse(JSON.stringify(b.navigations)),[{system:'civweave',options:{nativePage:'guild-quests',submitQuest:'pipeline-quest',source:'quest-pathway-map'}}]);assert.equal(b.win.localStorage.getItem(key),before);
});

test('a deleted Quest snapshot cannot resurrect a browseable or actionable map',async t=>{
  const b=await browser(t,{missing:true});assert.equal(b.chat.querySelector('[data-quest-pathway-map]'),null);assert.match(b.chat.textContent,/Quest unavailable/);assert.equal(JSON.parse(b.win.localStorage.getItem(key)).length,0);
});

test('an active saved Quest routes an exact subsystem path without activating or publishing anything',async t=>{
  const b=await browser(t),records=JSON.parse(b.win.localStorage.getItem(key));records[0].state='active';records[0].plan.state='active';b.win.localStorage.setItem(key,JSON.stringify(records));b.win.CivweaveGuideChatSurfaceV350.render();const map=b.chat.querySelector('[data-quest-pathway-map]');assert.ok(map);map.querySelector('[data-quest-map-action="open-native"]').click();assert.deepEqual(JSON.parse(JSON.stringify(b.navigations)),[{system:'cerbanimo',options:{weave:'pipeline-quest',path:'execution-path',source:'quest-pathway-map'}}]);assert.equal(JSON.parse(b.win.localStorage.getItem(key))[0].state,'active');
});

test('native map actions independently consult current saved dependency availability rather than trusting enabled markup',async t=>{
  const b=await browser(t),records=JSON.parse(b.win.localStorage.getItem(key));records[0].state=records[0].plan.state='active';records[0].plan.paths[0].dependsOn=['prerequisite'];b.win.localStorage.setItem(key,JSON.stringify(records));
  const seen=[];b.win.CivweaveQuestPathwayMapV1={canOpenPath:(plan,pathId)=>{seen.push({plan,pathId});return false}};
  const detail={action:'open-native',questId:'pipeline-quest',pathId:'execution-path',pathIndex:0,realm:'cerbanimo'};
  assert.equal(b.win.CivweaveSharedReviewSurfaceV234.handleMapAction(detail),false);assert.equal(b.navigations.length,0);
  assert.equal(seen.length,1);assert.equal(seen[0].pathId,'execution-path');assert.deepEqual(JSON.parse(JSON.stringify(seen[0].plan.paths[0].dependsOn)),['prerequisite']);
  b.win.CivweaveQuestPathwayMapV1={canOpenPath:()=>true};assert.equal(b.win.CivweaveSharedReviewSurfaceV234.handleMapAction(detail),true);assert.equal(b.navigations.length,1);
});

test('dependency-bearing map actions fail closed if the shared dependency evaluator is absent or fails',async t=>{
  const b=await browser(t),records=JSON.parse(b.win.localStorage.getItem(key));records[0].state=records[0].plan.state='active';records[0].plan.paths[0].dependsOn=['missing'];b.win.localStorage.setItem(key,JSON.stringify(records));
  const detail={action:'open-native',questId:'pipeline-quest',pathId:'execution-path',pathIndex:0,realm:'cerbanimo'};
  b.win.CivweaveQuestPathwayMapV1={};assert.equal(b.win.CivweaveSharedReviewSurfaceV234.handleMapAction(detail),false);
  b.win.CivweaveQuestPathwayMapV1={canOpenPath:()=>{throw new Error('Fixture evaluator unavailable')}};assert.equal(b.win.CivweaveSharedReviewSurfaceV234.handleMapAction(detail),false);
  assert.equal(b.navigations.length,0);assert.equal(b.win.localStorage.getItem(key),JSON.stringify(records));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const read=path=>readFileSync(new URL('../public/'+path,import.meta.url),'utf8');
const campusSource=[1,2,3,4,5].map(index=>read(`app/working-campus-v156.part${index}.txt`)).join('');
const campusKey='civweave.working-campus.v1',intentionsKey='civweave.intentions.v127',memoryKey='civweave.guide-thread.civweave.v237';
test('the current campus loads its shared map before the first campus render can run',()=>{
 const html=read('app/working-campus-v440.html');assert.ok(html.indexOf('/app/shared/quest-pathway-map-v1.js')<html.indexOf('/app/working-campus-v156.js'),'Map assets must be available before cached campus parts can render.');
});
function fixture(t,{state='active',map=true,parentOwner=false,ownedParent=true,parentReady=true,embedded=parentOwner}={}){
  const dom=new JSDOM(read('app/working-campus-v440.html'),{url:'https://civweave.test/app/working-campus-v440.html'+(embedded?'?embed=1&persistentShell=1':''),runScripts:'outside-only'}),w=dom.window,observers=[],Observer=w.MutationObserver;
  w.MutationObserver=class extends Observer{constructor(callback){super(callback);observers.push(this)}};t.after(()=>{for(const observer of observers)observer.disconnect();w.close()});
  Object.defineProperty(w.document,'readyState',{value:'complete',configurable:true});w.structuredClone=structuredClone;w.requestAnimationFrame=()=>0;w.setTimeout=()=>0;w.setInterval=()=>0;w.clearTimeout=()=>{};w.clearInterval=()=>{};w.matchMedia=()=>({matches:false,addEventListener(){}});w.CivweaveProgressiveDisclosureV1={};w.CivweaveGuideWorkspaceV242={openWindow(){}};
  const plan={id:'quest-map-campus',title:'Saved campus Quest',wish:'Make a local checklist',outcome:'An inspected checklist',state,createdAt:'2026-10-29T00:00:00Z',updatedAt:'2026-10-29T00:00:00Z',authoring:{mode:'model-structured-json',aiGenerated:true,provider:'ollama',model:'fixture'},paths:[{id:'build-checklist',realm:'cerbanimo',type:'skilled-labor',title:'Build checklist',purpose:'Make and inspect the saved note',steps:['Write the checklist','Inspect the saved note'],progress:[],status:'ready'}],governance:null};
  w.localStorage.setItem(campusKey,JSON.stringify({stage:state==='review'?'review':'active',view:'quest',mode:'guided',wish:plan.wish,plan,conversation:[]}));w.localStorage.setItem(intentionsKey,JSON.stringify([{id:plan.id,kind:'weave-plan',state,plan}]));w.localStorage.setItem(memoryKey,'PRIVATE GUIDE MEMORY');
  const calls=[],localCalls=[];const makeOwner=target=>({handleMapAction:(detail,options)=>{target.push({detail:JSON.parse(JSON.stringify(detail)),source:options.source});return true}});
  w.CivweaveSharedReviewSurfaceV234=makeOwner(localCalls);
  if(parentOwner)Object.defineProperty(w,'parent',{value:{location:{origin:w.location.origin},document:{getElementById:id=>id==='cw-persistent-system-stage'?{contentWindow:ownedParent?w:{}}:null},CivweaveSharedReviewSurfaceV234:parentReady?makeOwner(calls):undefined}});
  let modelCalls=0;w.CivweaveModelRuntime={generate:()=>{modelCalls++;throw new Error('Opening a saved Quest must not infer.')}};w.fetch=()=>{throw new Error('Opening a saved Quest must not fetch.')};
  if(map)w.eval(read('app/shared/quest-pathway-map-v1.js'));w.eval(read('app/intention-planner-v141.js'));w.eval(campusSource);
  return{w,plan,calls,localCalls,workspace:w.document.getElementById('workspace'),get modelCalls(){return modelCalls}};
}

for(const state of ['review','active'])test(`the main ${state} Quest view leads with the shared map and keeps its saved state`,t=>{
  const f=fixture(t,{state}),map=f.workspace.querySelector('[data-quest-pathway-map]');assert.ok(map,'The main current Quest view must expose the actual shared map.');assert.equal(map.dataset.questId,f.plan.id);assert.equal(map.dataset.mapTheme,'civweave');
  const details=f.workspace.querySelector('[data-campus-quest-details]');assert.ok(details);assert.equal(details.open,false);assert.ok(map.compareDocumentPosition(details)&f.w.Node.DOCUMENT_POSITION_FOLLOWING);assert.match(details.textContent,/Write the checklist/);
  assert.equal(JSON.parse(f.w.localStorage.getItem(campusKey)).plan.state,state);assert.equal(JSON.parse(f.w.localStorage.getItem(intentionsKey))[0].state,state);assert.equal(f.w.localStorage.getItem(memoryKey),'PRIVATE GUIDE MEMORY');assert.equal(f.modelCalls,0);
  if(state==='review')assert.ok(f.workspace.querySelector('#activate-plan'));else assert.ok(f.workspace.querySelector('.next[data-open="cerbanimo"]'),'Existing next rail remains available.');
});

test('with both review owners loaded, map actions delegate exact Quest/path identity only to the verified parent once across rerenders',t=>{
  const f=fixture(t,{parentOwner:true}),before=f.w.localStorage.getItem(intentionsKey),memory=f.w.localStorage.getItem(memoryKey);
  f.w.CivweaveWorkingCampusV156.openQuest();f.w.CivweaveWorkingCampusV156.openQuest();
  const button=f.workspace.querySelector('[data-quest-map-action="open-native"][data-path-id="build-checklist"]');assert.ok(button);button.click();
  assert.equal(f.calls.length,1);assert.equal(f.localCalls.length,0);assert.deepEqual(f.calls[0].detail,{action:'open-native',questId:'quest-map-campus',pathId:'build-checklist',pathIndex:0,stepId:'',stepIndex:null,realm:'cerbanimo',governance:false});assert.equal(f.calls[0].source,button);
  assert.equal(f.w.localStorage.getItem(intentionsKey),before);assert.equal(f.w.localStorage.getItem(memoryKey),memory);assert.equal(f.modelCalls,0);
});

test('an unrelated parent cannot receive Quest actions and missing controls expose an honest notice',t=>{
  const f=fixture(t,{parentOwner:true,ownedParent:false});const button=f.workspace.querySelector('[data-quest-map-action="edit"]');assert.ok(button);button.click();assert.equal(f.calls.length,0);assert.equal(f.localCalls.length,0);assert.match(f.workspace.querySelector('[data-campus-quest-map-status]').textContent,/unavailable/i);assert.equal(f.modelCalls,0);
});

test('an embedded Quest waits for its owning parent instead of forking the local review',t=>{
  const f=fixture(t,{parentOwner:true,parentReady:false});const button=f.workspace.querySelector('[data-quest-map-action="edit"]');assert.ok(button);button.click();assert.equal(f.calls.length,0);assert.equal(f.localCalls.length,0);assert.equal(f.workspace.querySelector('[data-campus-quest-map-status]').hidden,false);assert.match(f.workspace.querySelector('[data-campus-quest-map-status]').textContent,/unavailable/i);assert.equal(f.modelCalls,0);
});

test('a standalone Quest uses its local review owner exactly once',t=>{
  const f=fixture(t);const button=f.workspace.querySelector('[data-quest-map-action="edit"]');assert.ok(button);button.click();assert.equal(f.calls.length,0);assert.equal(f.localCalls.length,1);assert.equal(f.localCalls[0].detail.questId,f.plan.id);assert.equal(f.localCalls[0].source,button);assert.equal(f.modelCalls,0);
});

test('without optional map assets the main Quest retains readable legacy path controls',t=>{
  const f=fixture(t,{map:false});assert.equal(f.workspace.querySelector('[data-quest-pathway-map]'),null);assert.equal(f.workspace.querySelector('[data-campus-quest-details]'),null);assert.match(f.workspace.textContent,/Build checklist/);assert.ok(f.workspace.querySelector('[data-step]'));assert.equal(f.modelCalls,0);
});

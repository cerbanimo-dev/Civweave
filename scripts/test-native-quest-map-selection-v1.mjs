import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const sources=await Promise.all(['fellowfare','anarchadia'].map(system=>readFile(new URL(`../public/app/services/${system}/civweave-quest-path-v266.js`,import.meta.url),'utf8')));
function context(system,{query='',state='active',sameRealm=true}={}){
  const plan={id:'selected-quest',state,paths:[{id:'first-path',realm:system,title:'First path',steps:['First task']},{id:'selected-path',realm:sameRealm?system:'cerbanimo',title:'Exact selected path',steps:['Selected task']}]},stale={id:'stale-quest',state:'active',paths:[{id:'stale-path',realm:system,title:'Stale unrelated path',steps:['Wrong task']}]},rows=new Map([
    ['civweave.intentions.v127',JSON.stringify([{id:plan.id,kind:'weave-plan',plan}])],
    ['civweave.working-campus.v1',JSON.stringify({plan:stale})],
    ['civweave.active-handoff.v1',JSON.stringify({weaveId:stale.id,pathId:'stale-path',plan:stale})]
  ]),sandbox={URLSearchParams,URL,Date,JSON,Math,Map,Set,String,Number,Object,Array,Boolean,structuredClone,location:{search:query,origin:'https://civweave.test'},localStorage:{getItem:key=>rows.get(key)||null,setItem(){assert.fail('Selecting a map path must not write work state')}},document:{readyState:'loading',addEventListener(){}},addEventListener(){}};
  vm.runInNewContext(sources[system==='fellowfare'?0:1],sandbox);const api=system==='fellowfare'?sandbox.CivweaveFellowFareQuestPathV266:sandbox.AnarchadiaQuestPathV266;return{plan,rows,api};
}
for(const system of ['fellowfare','anarchadia']){
  test(`${system} opens the exact saved map path and rejects unknown Quest/path identities`,()=>{
    const selected=context(system,{query:'?weave=selected-quest&path=selected-path'});assert.equal(selected.api.resolveContext()?.path.id,'selected-path');
    assert.equal(context(system,{query:'?weave=missing-quest&path=missing-path'}).api.resolveContext(),null,'An explicit missing Quest cannot fall back to the last campus or handoff.');
    assert.equal(context(system,{query:'?weave=selected-quest&path=missing-path'}).api.resolveContext(),null,'An explicit missing path cannot fall back to the first path.');
    assert.equal(context(system,{query:'?weave=selected-quest&path=selected-path',sameRealm:false}).api.resolveContext(),null,'The named path must belong to this subsystem.');
  });
  test(`${system} excludes review and abandoned Quests and never reuses another Quest's handoff path`,()=>{
    for(const state of ['review','abandoned','cancelled','archived'])assert.equal(context(system,{query:'?weave=selected-quest&path=selected-path',state}).api.resolveContext(),null);
    const selected=context(system,{query:'?weave=selected-quest'});assert.equal(selected.api.resolveContext()?.path.id,'first-path');assert.equal(selected.api.resolveContext()?.plan.id,'selected-quest');
  });
}

test('Living School preserves every routed learning path and selects the exact activated map identity without generation',async()=>{
  const source=await readFile(new URL('../public/app/cabinets/living-school/living-school-cleanroom-core-v218-base.mjs',import.meta.url),'utf8'),start=source.indexOf('export function availablePaths('),end=source.indexOf('\nexport function curriculumWeaveIdentity(',start),events=[],plan={id:'learning-quest',state:'active',paths:[{id:'learn-first',realm:'living-school',title:'First skill',purpose:'First capability'},{id:'learn-selected',realm:'living-school',title:'Selected skill',purpose:'Selected capability'}]},saved=new Map([['intentions',[{id:plan.id,plan}]]]),sandbox={Map,Set,Object,Array,String,Number,Date,INTAKE_KEY:'intake',INTENTION_KEY:'intentions',currentState:{activePathId:'old',pathContext:{id:'old',title:'Preserved old selection'},settings:{selectedJourneyPlanId:'old-approved-plan'},school:{id:'existing-school',title:'Existing work'}},clean:(value,max=180)=>String(value??'').trim().slice(0,max),readJson:(key,fallback)=>saved.get(key)||fallback,persist:(type,detail)=>events.push({type,detail})};
  vm.runInNewContext(source.slice(start,end).replaceAll('export function','function')+'\nglobalThis.api={availablePaths,selectRoutedQuestPath};',sandbox);
  const rows=sandbox.api.availablePaths();assert.equal(rows.filter(row=>row.weaveId===plan.id).length,2);assert.equal(new Set(rows.map(row=>row.id)).size,rows.length);
  assert.equal(sandbox.api.selectRoutedQuestPath({weaveId:plan.id,pathId:'learn-selected'}),true);assert.equal(sandbox.currentState.pathContext.pathId,'learn-selected');assert.equal(sandbox.currentState.pathContext.capability,'Selected capability');assert.equal(sandbox.currentState.school.id,'existing-school');assert.equal(Boolean(sandbox.currentState.settings.selectedJourneyPlanId),false);assert.equal(events.length,1);
  assert.equal(sandbox.api.selectRoutedQuestPath({weaveId:plan.id,pathId:'missing'}),false);assert.equal(sandbox.currentState.pathContext.pathId,'learn-selected');assert.equal(events.length,1);
  plan.state='review';assert.equal(sandbox.api.selectRoutedQuestPath({weaveId:plan.id,pathId:'learn-first'}),false);assert.equal(events.length,1);
});

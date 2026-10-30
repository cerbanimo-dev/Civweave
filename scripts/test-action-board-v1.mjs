import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeSavedPlans,normalizeAction,normalizeStore,projectPlanActions,projectBoard,selectActions} from '../public/app/shared/action-board-core-v1.mjs';

const NOW='2026-10-29T12:00:00.000Z';
const makePlan=()=>({id:'quest-garden',title:'Create a garden',state:'active',paths:[{
  id:'cerbanimo-path',realm:'cerbanimo',status:'active',progress:[0],
  steps:[
    {id:'find-site',title:'Find available site'},
    {id:'write-charter',title:'Draft the charter',dependsOn:['find-site'],minutes:30,energy:'low'},
    {id:'build-beds',title:'Build beds',dependsOn:['missing-evidence'],minutes:120}
  ]
}]});
test('saved Quest beats appear exactly once; completed beats never appear as actionable',()=>{
  const p=makePlan(),rows=projectPlanActions([p],NOW);
  assert.equal(rows.length,2);
  assert.equal(rows.find(x=>x.title==='Draft the charter').status,'next');
  assert.equal(rows.find(x=>x.title==='Build beds').status,'waiting');
  assert.match(rows.find(x=>x.title==='Build beds').reason,/Unknown dependency/);
  assert.equal(p.paths[0].progress[0],0,'projection never mutates canonical Quest progress');
});
test('review plans cannot be represented as ready-to-execute actions',()=>{
  const p=makePlan();p.state='review';
  assert.ok(projectPlanActions([p],NOW).every(x=>x.status==='waiting'));
});
test('ambiguous identifiers stay locked rather than guessing a dependency',()=>{
  const p=makePlan();
  p.paths[0].steps.push({id:'find-site',title:'Duplicate ref'});
  const rows=projectPlanActions([p],NOW);
  assert.match(rows.find(x=>x.title==='Draft the charter').reason,/Ambiguous dependency/);
});
test('canonical saved ledger is preferred over a stale campus copy',()=>{
  const canonical=makePlan(),stale={...canonical,state:'review'};
  const merged=mergeSavedPlans([{id:canonical.id,kind:'weave-plan',plan:canonical}],{plan:stale});
  assert.equal(merged.length,1);
  assert.equal(merged[0],canonical);
});
test('personal actions are separate from the Quest ledger and respect deferred start dates',()=>{
  const store={actions:[{id:'a',title:'Collect seeds',status:'next',startAt:'2026-11-01',minutes:10,energy:'low'},
    {id:'b',title:'Read seed guide',status:'next',minutes:20,energy:'medium'}]};
  const original=structuredClone(store);
  const result=projectBoard(store,[],NOW);
  assert.equal(result.find(x=>x.id==='a').status,'scheduled');
  assert.equal(result.find(x=>x.id==='b').status,'next');
  assert.deepEqual(store,original,'projection is read only');
  assert.deepEqual(selectActions(result,{view:'next',minutes:'15',energy:'low'}),[]);
  assert.equal(selectActions(result,{view:'scheduled'}).length,1);
});
test('focus is a view, not a second copy of an action',()=>{
  const p=makePlan();
  const key=projectPlanActions([p],NOW)[0].key;
  const store={actions:[{id:'x',title:'Water plants',status:'next',focus:true}],focusedQuestKeys:[key]};
  const board=projectBoard(store,[p],NOW);
  assert.equal(selectActions(board,{view:'focus'}).length,2);
  assert.equal(board.filter(x=>x.key===key).length,1);
});
test('normalization rejects corrupt and duplicate personal action ids',()=>{
  const items=normalizeStore({actions:[{id:'1',title:'One'},{id:'1',title:'Duplicate'},{id:'2',title:''},{id:'3',title:'Three',status:'imaginary'}]}).actions;
  assert.deepEqual(items.map(x=>x.id),['1','3']);
  assert.equal(items[1].status,'inbox');
  assert.equal(normalizeAction({status:'done',title:'Ok'},NOW).completedAt,NOW);
});


test('explicit Quest IDs keep Focus identity stable when beats are reordered',()=>{
  const p={id:'focus-quest',state:'active',paths:[{id:'path-one',status:'active',steps:[
    {id:'step-a',title:'First',status:'ready'},{id:'step-b',title:'Second',status:'ready'}]}]};
  const first=projectPlanActions([p],NOW).find(x=>x.title==='Second').key;
  p.paths[0].steps.reverse();
  assert.equal(projectPlanActions([p],NOW).find(x=>x.title==='Second').key,first);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {normalizeStore} from '../public/app/shared/action-board-core-v1.mjs';
import {
  normalizePortableDraftBundle,planPortableReconciliation,stagePortableActions,
  verifyPortableGuildSession
} from '../public/app/shared/worldweaver-portable-reconcile-v1.mjs';
import {exportPortableUniverseHtml} from '../public/app/shared/worldweaver-portable-client-v1.mjs';

const universeId='commons-between';
const bundle=(title='Build a shelter')=>({
  schema:'civweave.portable-local-drafts.v1',universeId,roomId:'starling-commons',
  quests:[{id:'q1',title,done:true},{id:'q2',title:'Help a neighbor',done:false}],
  journal:[{id:'j1',text:'Privately observed the bridge.'}]
});
const scope={origin:'https://local-node.example',nodeId:'node_1',userId:'user_1'};

test('portable bundle validates, bounds, and never treats a completed draft as verified',()=>{
  const b=normalizePortableDraftBundle(bundle());
  assert.equal(b.quests[0].done,true);
  assert.equal(b.journal[0].text,'Privately observed the bridge.');
  assert.throws(()=>normalizePortableDraftBundle({...bundle(),universeId:'../evil'}),/universe|identifier/i);
  assert.throws(()=>normalizePortableDraftBundle({...bundle(),quests:[{id:'x',title:'A',done:false},{id:'x',title:'B',done:false}]}),/duplicate/i);
  assert.throws(()=>normalizePortableDraftBundle({...bundle(),quests:new Array(151).fill({id:'x',title:'A',done:false})}),/limit/i);
  assert.throws(()=>normalizePortableDraftBundle({...bundle(),journal:[{id:'bad',text:'<script>',url:'https://evil'}]}),/field/i);
});
test('new drafts are staged through canonical Action Board, never as official Quest completions',()=>{
  const p=planPortableReconciliation(bundle(),[],[]);
  assert.equal(p.quests.filter(q=>q.status==='new').length,2);
  assert.equal(p.journal.filter(q=>q.status==='new').length,1);
  const applied=stagePortableActions({},bundle(),['q1','q2'],scope);
  assert.deepEqual(applied.receipts.map(x=>x.status),['imported','imported']);
  const actions=normalizeStore(applied.store).actions;
  assert.equal(actions.length,2);
  assert.ok(actions.every(x=>x.status==='inbox'));
  assert.ok(actions.every(x=>x.portableOrigin?.universeId===universeId));
  assert.equal(actions[0].portableOrigin.originallyDone,true);
  const again=stagePortableActions(applied.store,bundle(),['q1','q2'],scope);
  assert.deepEqual(again.receipts.map(x=>x.status),['unchanged','unchanged']);
  assert.equal(again.store.actions.length,2);
});
test('max-length escaped Quest title stays idempotent through canonical Action Board normalization',()=>{
  const tricky='\\\\\"'.repeat(53)+'Z';
  const sample=bundle(tricky.slice(0,160));
  const first=stagePortableActions({},sample,['q1'],scope);
  const second=stagePortableActions(first.store,sample,['q1'],scope);
  assert.equal(first.store.actions.length,1);
  assert.deepEqual(second.receipts.map(x=>x.status),['unchanged']);
  assert.equal(second.store.actions.length,1);
});
test('changed same-ID draft preserves both versions and must be manually resolved',()=>{
  const first=stagePortableActions({},bundle(),['q1'],scope).store;
  const revised=bundle('Repair the telescope');
  const p=planPortableReconciliation(revised,first.actions,[]);
  assert.equal(p.quests[0].status,'conflict');
  const again=stagePortableActions(first,revised,['q1'],scope);
  assert.equal(again.receipts[0].status,'conflict');
  assert.equal(again.store.actions.length,1);
  assert.equal(again.store.actions[0].title,'Build a shelter');
});
test('journal stays private, is deduplicated by source ID and never passed into Action Board',()=>{
  const existing=[{kind:'civweave.portable-journal.v1',consent:'private',payload:{
    universeId,draftId:'j1',text:'Privately observed the bridge.'
  }}];
  const p=planPortableReconciliation(bundle(),[],existing);
  assert.equal(p.journal[0].status,'unchanged');
  assert.equal(stagePortableActions({},bundle(),['q2'],scope).store.actions.length,1);
  assert.equal(planPortableReconciliation({...bundle(),journal:[{id:'j1',text:'Changed'}]},[],existing).journal[0].status,'conflict');
});
test('verified Guild/local-node attachment checks existing session owner and current membership',async()=>{
  const api={
    ensureSelected:async()=>({...scope,token:'do-not-export'}),
    selectedOrigin:()=>scope.origin,
    status:async()=>({ok:true,nodeId:scope.nodeId,member:{nodeId:scope.nodeId,userId:scope.userId}})
  };
  const publicScope=await verifyPortableGuildSession(api);
  assert.deepEqual(publicScope,scope);
  assert.doesNotMatch(JSON.stringify(publicScope),/token/);
  await assert.rejects(()=>verifyPortableGuildSession({...api,status:async()=>({ok:false})}),/verify|member|session/i);
  await assert.rejects(()=>verifyPortableGuildSession({...api,ensureSelected:async()=>({...scope,authMode:'legacy-guildkeeper'})}),/legacy/i);
  await assert.rejects(()=>verifyPortableGuildSession({...api,selectedOrigin:()=> 'https://other.example'}),/origin/i);
  await assert.rejects(()=>verifyPortableGuildSession({...api,status:async()=>({ok:true,member:{nodeId:'other',userId:scope.userId}})}),/member|mismatch/i);
});
test('the downloaded HTML remains offline and offers a user-initiated host bridge',()=>{
  const html=exportPortableUniverseHtml({id:universeId,title:'The Commons Between',rooms:[{id:'starling-commons',title:'Commons'}]});
  assert.match(html,/cw-attach/);
  assert.match(html,/worldweaver-universe-attach\.html/);
  assert.match(html,/cw-attach-status/);
  assert.doesNotMatch(html,/<script[^>]+src=/i);
  assert.doesNotMatch(html,/<iframe/i);
  assert.doesNotMatch(html,/Bearer |authorization:/i);
});
test('host bridge is an explicit review surface with strict source and nonce checks',async()=>{
  const source=await readFile(new URL('../public/app/tools/worldweaver-universe-attach-v1.mjs',import.meta.url),'utf8');
  const page=await readFile(new URL('../public/app/tools/worldweaver-universe-attach.html',import.meta.url),'utf8');
  assert.match(source,/event\.source\s*!==\s*window\.opener/);
  assert.match(source,/event\.data\?\.nonce/);
  assert.match(source,/verifyPortableGuildSession/);
  assert.match(source,/importPortableActions/);
  assert.match(source,/createObject/);
  assert.match(page,/host-node-session-v1\.js/);
  assert.doesNotMatch(source,/localStorage\.setItem\(\s*['"]civweave\.intentions/);
});

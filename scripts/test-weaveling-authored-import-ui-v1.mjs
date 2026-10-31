import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const source=readFileSync(new URL('../public/app/shared-review-surface-v234.js',import.meta.url),'utf8');
const loaderSource=readFileSync(new URL('../public/app/family-ai-loader-v105.js',import.meta.url),'utf8');
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
async function browser(t,{failure=false}={}){
  const dom=new JSDOM('<!doctype html><div id="weaveling-hub-v233"><div class="wh233-thread"></div></div>',{url:'https://civweave.test/app/working-campus-v440.html',runScripts:'outside-only'}),win=dom.window;t.after(()=>win.close());
  const calls=[],contracts=[];let loads=0;
  win.structuredClone=structuredClone;
  const owner={authoredPlanContract:async args=>{contracts.push(args);return{messages:[{role:'system',content:'Current canonical fixture stage contract.'}],schema:{type:'object',required:['title']},stageContract:{sourceModule:'/extensions/civweave-weaveling-plan-json-v190.js',revision:'current-fixture',promptDigest:'sha256:'+'a'.repeat(64),outputSchema:'canonical-fixture'}}},importAuthoredPlan:async args=>{calls.push(args);if(failure)return{ok:false,error:'The supplied authored Quest has invalid evidence.'};const item={id:'import-1',kind:'weave-plan',state:'review',plan:{id:'import-1',title:'Imported test Quest',wish:args.text,state:'review',paths:[]}};win.localStorage.setItem('civweave.intentions.v127',JSON.stringify([item]));return{ok:true,item,plan:item.plan,receipt:{id:'receipt-1',inferenceInvocations:0}}}};
  win.CivweaveFamilyAILoaderV105={ensureAuthoredQuestImport:async()=>{loads++;return owner}};
  win.eval(source);if(win.document.readyState==='loading')win.dispatchEvent(new win.Event('DOMContentLoaded'));await tick();
  return{win,calls,contracts,loads:()=>loads,owner,api:win.CivweaveSharedReviewSurfaceV234,button:name=>win.document.querySelector(`[data-review-command="${name}"]`)};
}

test('a new user can open authored import through the existing review owner without loading or generating anything',async t=>{
  const b=await browser(t),entry=b.button('open-authored-import');assert.ok(entry,'the empty Quest review list must still expose authored import');entry.focus();entry.click();
  const surface=b.win.document.querySelector('#cw-shared-review-surface-v234');assert.equal(surface.getAttribute('role'),'dialog');assert.match(surface.textContent,/Import authored Quest/);assert.equal(b.loads(),0);assert.equal(b.calls.length,0);assert.equal(b.contracts.length,0);
  assert.equal(b.button('import-authored-plan').disabled,true);assert.ok(surface.querySelector('[name="authoredJson"]').maxLength>=100000);
  surface.dispatchEvent(new b.win.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(b.win.document.getElementById('cw-shared-review-surface-v234'),null);assert.equal(b.win.document.activeElement,entry);
});

test('contract preparation and the final import use separate explicit controls and return a saved review draft',async t=>{
  const b=await browser(t);b.button('open-authored-import').click();
  const form=b.win.document.querySelector('[data-authored-import-form]');form.elements.intention.value='Build a reading shelf';form.elements.authoredJson.value='{"title":"Reading shelf"}';
  b.button('prepare-authored-contract').click();await tick();assert.equal(b.loads(),1);assert.equal(b.contracts.length,1);assert.equal(b.calls.length,0);assert.equal(b.button('import-authored-plan').disabled,false);assert.match(form.textContent,/sha256:aaaa/);
  b.button('import-authored-plan').click();b.button('import-authored-plan').click();await tick();assert.equal(b.calls.length,1);assert.equal(b.calls[0].confirmed,true);assert.equal(b.calls[0].expectedRevision,'current-fixture');assert.equal(b.calls[0].expectedPromptDigest,'sha256:'+'a'.repeat(64));assert.equal(b.calls[0].authorship.kind,'external-author');assert.ok(b.calls[0].idempotencyKey);
  const saved=JSON.parse(b.win.localStorage.getItem('civweave.intentions.v127'))[0];assert.equal(saved.state,'review');assert.equal(b.win.localStorage.getItem('civweave.realm-inbox.v1'),null);assert.match(b.win.document.querySelector('#cw-shared-review-surface-v234').textContent,/Imported test Quest/);
});

test('changed intention and invalid imported content remain editable without hidden retries',async t=>{
  const b=await browser(t,{failure:true});b.button('open-authored-import').click();const form=b.win.document.querySelector('[data-authored-import-form]');form.elements.intention.value='Initial intention';form.elements.authoredJson.value='{"title":"Keep these edits"}';b.button('prepare-authored-contract').click();await tick();
  form.elements.intention.value='Changed intention';b.button('import-authored-plan').click();await tick();assert.equal(b.calls.length,0);assert.match(form.textContent,/contract.*again|prepare.*contract/i);
  b.button('prepare-authored-contract').click();await tick();b.button('import-authored-plan').click();await tick();assert.equal(b.calls.length,1);assert.equal(form.elements.authoredJson.value,'{"title":"Keep these edits"}');assert.match(form.textContent,/invalid evidence/);assert.equal(b.win.localStorage.length,0);
});

test('manual import readiness extends the existing loader with only validation and review modules',async t=>{
  const dom=new JSDOM('<!doctype html><head></head><body></body>',{url:'https://civweave.test/app/working-campus-v440.html',runScripts:'outside-only'}),win=dom.window;t.after(()=>win.close());
  const loaded=[];win.addEventListener=()=>{};Object.defineProperty(win.document,'readyState',{value:'loading'});
  win.document.head.append=node=>{const path=new URL(node.src).pathname;loaded.push(path);if(path==='/app/shared/civweave-model-runtime.js')win.CivweaveModelRuntime={validateSchema:()=>[]};if(path==='/app/intention-planner-v141.js')win.CivweaveIntentionPlanner={authoredImportedPlan:()=>true};if(path==='/app/weaveling-plan-materialization-v265.js')win.CivweaveWeavelingPlanMaterializationV265={authoredImportedPlan:()=>true,patchPlanner(){}};if(path==='/extensions/civweave-weaveling-plan-json-v190.js')win.CivweaveWeavelingPlanJsonV190={version:'1.3.0-weaveling-plan-json-v190-authored-import',importAuthoredPlan(){}};node.onload()};
  win.eval(loaderSource);const api=await win.CivweaveFamilyAILoaderV105.ensureAuthoredQuestImport();assert.equal(api,win.CivweaveWeavelingPlanJsonV190);
  assert.deepEqual(loaded,['/app/shared/civweave-model-runtime.js','/app/intention-planner-v141.js','/app/weaveling-plan-materialization-v265.js','/extensions/civweave-weaveling-plan-json-v190.js']);
  assert.equal(win.CivweaveAssistantV141,undefined);assert.equal(win.CivweaveLocalAIBootstrapV266,undefined);
});

test('canonical review displays and exports the exact saved authored import receipt without executing or approving it',async t=>{
  const b=await browser(t),receipt={schema:'civweave.quest-authored-import-receipt.v1',id:'authored-receipt-1',kind:'manual-plan-insert',planId:'saved-authored',artifactRevision:2,baseRevision:1,stageContract:{sourceModule:'/extensions/civweave-weaveling-plan-json-v190.js',revision:'1.3.0-weaveling-plan-json-v190-authored-import',promptDigest:'sha256:'+'a'.repeat(64),outputSchema:'civweave.weaveling-quest-json.v190',outputFormat:'subsystems'},validation:{state:'valid'},authorization:{state:'pending',authorizedBy:null},execution:{state:'not-started'},inferenceInvocations:0};
  const plan={id:'saved-authored',title:'Saved authored plan',state:'review',paths:[],authoring:{mode:'external-authored-json',aiGenerated:false,authorship:{kind:'editor-agent'},receipt}};
  b.win.localStorage.setItem('civweave.intentions.v127',JSON.stringify([{id:plan.id,kind:'weave-plan',state:'review',plan}]));b.win.CivweaveIntentionPlanner={authoredImportedPlan:()=>true};b.api.openPlan(plan.id);
  const detail=b.win.document.querySelector('[data-authored-import-receipt]');assert.ok(detail);assert.match(detail.textContent,/manual-plan-insert|zero inference/i);assert.match(detail.textContent,/1\.3\.0-weaveling/);assert.match(detail.textContent,/sha256:aaaa/);assert.match(detail.textContent,/pending|not-started/);
  const disclosure=detail.querySelector('[data-review-command="toggle-authored-receipt"]');assert.ok(disclosure,'the canonical owner must expose an explicit receipt disclosure button');assert.equal(disclosure.getAttribute('aria-expanded'),'false');disclosure.click();assert.equal(disclosure.getAttribute('aria-expanded'),'true');assert.equal(detail.querySelector('[data-authored-receipt-body]').hidden,false);
  b.api.openPlan(plan.id);assert.equal(b.button('toggle-authored-receipt').getAttribute('aria-expanded'),'true','same saved Quest redraw preserves an open receipt');assert.equal(b.win.document.querySelector('[data-authored-receipt-body]').hidden,false);
  assert.deepEqual(JSON.parse(detail.querySelector('[data-authored-receipt-json]').textContent),receipt);
  let downloads=0;b.win.URL.createObjectURL=()=>{downloads++;return'blob:receipt'};b.win.URL.revokeObjectURL=()=>{};b.win.HTMLAnchorElement.prototype.click=function(){assert.match(this.download,/authored-receipt-1/)};
  b.button('export-authored-receipt').click();assert.equal(downloads,1);assert.equal(b.calls.length,0);assert.equal(b.win.localStorage.getItem('civweave.realm-inbox.v1'),null);assert.equal(JSON.parse(b.win.localStorage.getItem('civweave.intentions.v127'))[0].state,'review');
});

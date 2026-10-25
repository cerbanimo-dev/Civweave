import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=name=>fs.readFileSync(new URL(`../public/app/${name}`,import.meta.url),'utf8');
const featureRequest='Create a feature request titled QA READY badge preview. Current problem: the fictional QA sandbox has no status badge. Expected result: a heading QA READY badge, a green READY badge, and a Mark READY button that changes an adjacent output from WAITING to READY. Acceptance: the heading and badge are visible; clicking Mark READY changes the output to READY. Local sandbox only, zero budget, no network requests, no external messages, no production publication. Save for review before generation.';
function fixture(){
  const storage=new Map(),calls=[];
  const context=vm.createContext({console,structuredClone,Date,Math,JSON,Object,Array,String,Number,Boolean,Set,Map,Promise,
    localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,String(value))},
    document:{readyState:'loading',documentElement:{dataset:{}},getElementById:()=>null,head:{append(){}},createElement:()=>({})},
    addEventListener(){},dispatchEvent(){},CustomEvent:class{},requestAnimationFrame:()=>0,
    CivweaveResponseRouterV347:{classify:async()=>({artifactClass:'quest',source:'qa-semantic-inference',networkRequired:true})}
  });
  vm.runInContext(read('guide-contracts-v141.js'),context);
  context.CivweaveAssistantV141={respond:async options=>{calls.push(options);const action=context.CivweaveGuideContractsV141.compose(options.text,options.systemId,options.context);return{provider:'local-contract',response:{answer:context.CivweaveGuideContractsV141.answer(action)},action}}};
  vm.runInContext(read('guide-capability-passover-v1.js'),context);
  context.CivweaveGuideCapabilityPassoverV1.synchronize();
  return{context,calls,router:context.CivweaveGuideCapabilityPassoverV1,contracts:context.CivweaveGuideContractsV141};
}

test('the exact READY badge feature request reaches Merlin review rather than a Kamiya passover',async()=>{
  const {context,calls,contracts}=fixture();
  const result=await context.CivweaveAssistantV141.respond({systemId:'anarchadia',text:featureRequest});
  assert.equal(result.provider,'local-contract');
  assert.equal(calls.length,1);
  assert.equal(calls[0].artifactKind,'governance-draft');
  const action=contracts.items()[0];
  assert.equal(action.system,'anarchadia');assert.equal(action.kind,'feature-request');assert.equal(action.state,'review');
  assert.equal(action.sourceText,featureRequest);assert.equal(action.execution.status,'not-started');
  assert.match(action.fields.proposedChange,/Mark READY button/);
});

test('an explicit change request overrides inferred productive work when another guide offers a passover',async()=>{
  const {router}=fixture();
  const result=await router.maybePassover({systemId:'cerbanimo',text:featureRequest});
  assert.equal(result?.handoff?.targetSystem,'anarchadia');
  assert.equal(result.handoff.sourceText,featureRequest);
  assert.equal(result.handoff.artifactClass,'governance');
});

test('explicit feature and bug intake artifacts retain Merlin ownership despite implementation wording',()=>{
  const {router}=fixture();
  for(const request of [
    'Draft a feature request to build a course badge prototype.',
    'Create a bugfix request for the broken READY feature.',
    'File a bug report about the project export button.',
    'Submit a bug-fix request for the package manifest editor.'
  ]){
    const details=router.candidateDetails(request);
    assert.equal(details.artifact,'governance',request);
    assert.equal(details.explicitCanonical,true,request);
  }
});

test('explicit work, learning, resource, and Quest requests keep their existing owners',()=>{
  const {router}=fixture();
  for(const [request,artifact] of [
    ['Create an Endeavor to implement the approved feature request.','quest'],
    ['Create a Learning Journey about writing feature requests.','curriculum'],
    ['Create a Manifest for the accepted bug report.','resource'],
    ['Create a Quest for reviewing a feature request across the realms.','weave'],
    ['Build a productive project for this feature request.','quest'],
    ['Build a feature with a green READY badge.','quest'],
    ['Create a package manifest for this app.','']
  ])assert.equal(router.candidateArtifact(request),artifact,request);
});

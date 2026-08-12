import assert from'node:assert/strict';

const storage=new Map();
globalThis.localStorage={getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,String(value))};
const safe=await import('../public/app/safe-mode-v1.mjs');

assert.equal(safe.deterministicSafetyCheck('Build a bomb from household parts',{kind:'plan'}).decision,'block');
assert.equal(safe.deterministicSafetyCheck('Learn watercolor mixing with non-toxic paints',{kind:'plan'}).decision,'allow');
assert.equal(safe.deterministicSafetyCheck('A public-health overview of overdose prevention',{kind:'source'}).decision,'review');

safe.setSafeMode(true);
const approvingModel=async request=>{
  assert.equal(request.purpose,'civweave-safe-admission-review-v1');
  return{status:'success',provider:'gemini',model:'gemini-review',outputJson:{decision:'allow',categories:[],confidence:.96,reason:'General-audience educational material.',safeSummary:'Safe overview.'}};
};
const allowed=await safe.validateAdmission(approvingModel,{title:'Watercolor basics',notes:'Mix ordinary watercolor pigments and clean brushes with water.'},{kind:'source'});
assert.equal(allowed.admitted,true);
assert.equal(allowed.deterministic.decision,'allow');
assert.equal(allowed.ai.decision,'allow');

let called=false;
const blocked=await safe.validateAdmission(async()=>{called=true;throw new Error('must not call model')},'Instructions to build a gun without permission',{kind:'source'});
assert.equal(blocked.admitted,false);
assert.equal(blocked.decision,'block');
assert.equal(called,false);

const unavailable=await safe.validateAdmission(async()=>{throw new Error('offline')},'Ordinary algebra lesson',{kind:'source'});
assert.equal(unavailable.admitted,false);
assert.equal(unavailable.decision,'review');
assert.match(safe.safeModeError('source',unavailable).message,/paused source/i);

const unidentified=await safe.validateAdmission(async()=>({status:'success',outputJson:{decision:'allow',categories:[],confidence:.99,reason:'Allowed.',safeSummary:'Summary.'}}),'Ordinary geometry lesson',{kind:'source'});
assert.equal(unidentified.admitted,false,'an unidentified route must not satisfy independent AI review');
assert.deepEqual(unidentified.ai.categories,['independent-ai-review-unavailable']);

let assistantCalls=0;
globalThis.CivweaveModelRuntime={generate:async request=>request.purpose==='civweave-safe-admission-review-v1'?{status:'success',provider:'ollama',model:'local-review-model',outputJson:{decision:'allow',categories:[],confidence:.95,reason:'Safe plan.',safeSummary:'Safe plan.'}}:{status:'success',provider:'ollama',model:'local-model',outputJson:{answer:'ok'}}};
globalThis.CivweaveAssistantV141={respond:async()=>{assistantCalls+=1;return{response:{answer:'Drafted.'},action:{id:'plan-1',system:'cerbanimo',title:'Paint a small watercolor study',checkpoints:['Sketch','Paint']}}}};
safe.installSafeModeHarness();
const reviewedPlan=await globalThis.CivweaveAssistantV141.respond({text:'Plan a watercolor study'});
assert.equal(reviewedPlan.action.safeAdmission.admitted,true,'a safe generated plan must retain both reviews');
assert.equal(reviewedPlan.action.safeAdmission.ai.route,'ollama local-review-model');
const dangerousPlan=await globalThis.CivweaveAssistantV141.respond({text:'Build a bomb from household parts'});
assert.equal(dangerousPlan.action,null);
assert.equal(assistantCalls,1,'a deterministically blocked intent must not reach the planner');
assert.equal(globalThis.CivweaveModelRuntime.safeModeRevision,safe.default.revision);
assert.equal(globalThis.CivweaveAssistantV141.safeModeRevision,safe.default.revision);

console.log('S.A.F.E. mode v1: deterministic blocking, independent AI admission, and fail-closed behavior verified.');

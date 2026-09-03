import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const authoritySource=readFileSync('public/app/local-ai/gemma4-current-registry-authority-v1.js','utf8');
const campus=readFileSync('public/app/working-campus-v440.html','utf8');
const shell=readFileSync('public/app/persistent-system-shell-v1.html','utf8');
new vm.Script(authoritySource,{filename:'gemma4-current-registry-authority-v1.js'});

const FAST_E2='gemma4-e2b-it-litert-web';
const FAST_E4='gemma4-e4b-it-litert-web';
const LEGACY_E2='gemma4-e2b-it-q4f16';
const LEGACY_E4='gemma4-e4b-it-q4f16';
const currentModels=[{id:FAST_E2},{id:FAST_E4}];
const byIdFor=models=>id=>models.find(row=>row.id===id)||null;
const staleRegistry=Object.freeze({
  models:Object.freeze(currentModels),
  byId:byIdFor(currentModels),
  __civweaveGemma4PhonePerformanceRegistryV1:true,
  gemma4PhonePerformanceRegistry:true,
  gemma4PhonePerformanceRegistryComplete:false,
  gemma4PhonePerformanceRegistryMissing:Object.freeze([LEGACY_E2,LEGACY_E4])
});
let sandbox;
const staleAuthority=Object.freeze({
  version:'1.3.0-gemma4-phone-performance-core-v1-runtime-only-support-status',
  patchRegistry:registry=>registry,
  applyAuthority:()=>({registryReady:true,packsReady:true,ready:true}),
  activate:()=>true,
  assertSelectedPerformance(){
    const missing=sandbox.CivweaveLocalModelRegistryV266?.gemma4PhonePerformanceRegistryMissing||[];
    if(missing.length)throw Object.assign(new Error(`Gemma 4 phone runtime registration is incomplete: ${missing.join(', ')}.`),{code:'LOCAL_PHONE_MODEL_REGISTRY_INCOMPLETE',missingModels:[...missing]});
    return true;
  }
});
const timers=[];
sandbox={
  console,
  Object,
  Array,
  Date,
  Math,
  CustomEvent:class{constructor(type,{detail}={}){this.type=type;this.detail=detail}},
  addEventListener(){},
  dispatchEvent(){return true},
  queueMicrotask(fn){fn()},
  setTimeout(fn){timers.push(fn);return timers.length},
  clearTimeout(){},
  CivweaveLocalModelRegistryV266:staleRegistry,
  CivweaveGemma4PhonePerformanceCoreV1:staleAuthority,
  globalThis:null
};
sandbox.globalThis=sandbox;
vm.createContext(sandbox);
vm.runInContext(authoritySource,sandbox,{filename:'gemma4-current-registry-authority-v1.js'});

const repaired=sandbox.CivweaveLocalModelRegistryV266;
assert.deepEqual([...repaired.gemma4PhonePerformanceRegistryMissing],[],'retired Q4 aliases still block the current phone registry');
assert.deepEqual([...repaired.gemma4PhoneCompatibilityRegistryMissing],[LEGACY_E2,LEGACY_E4],'retired Q4 aliases are not retained as compatibility diagnostics');
assert.equal(repaired.gemma4PhoneLegacyRegistrationRequired,false,'retired Q4 aliases are still marked required');
assert.equal(repaired.gemma4PhonePerformanceRegistryComplete,true,'current LiteRT E2B/E4B should complete the phone registry');
assert.equal(sandbox.CivweaveGemma4PhonePerformanceCoreV1.currentRegistryOnlyAuthority,'1.0.0-gemma4-current-registry-authority-v1');
assert.doesNotThrow(()=>sandbox.CivweaveGemma4PhonePerformanceCoreV1.assertSelectedPerformance(),'selected current LiteRT runtime is still blocked by retired aliases');

const onlyE2=[{id:FAST_E2}];
sandbox.CivweaveLocalModelRegistryV266=Object.freeze({models:Object.freeze(onlyE2),byId:byIdFor(onlyE2),__civweaveGemma4PhonePerformanceRegistryV1:true,gemma4PhonePerformanceRegistryMissing:Object.freeze([LEGACY_E2,LEGACY_E4])});
sandbox.CivweaveGemma4CurrentRegistryAuthorityV1.repairRegistry();
assert.deepEqual([...sandbox.CivweaveLocalModelRegistryV266.gemma4PhonePerformanceRegistryMissing],[FAST_E4],'a genuinely missing current E4B registration must still fail readiness');
assert.throws(()=>sandbox.CivweaveGemma4PhonePerformanceCoreV1.assertSelectedPerformance(),/gemma4-e4b-it-litert-web/,'current E4B absence did not remain a hard runtime error');

const scriptRef='/app/local-ai/gemma4-current-registry-authority-v1.js?v=1.0.0-current-litert-only';
assert.ok(campus.includes(scriptRef),'Working Campus does not load the current Gemma registry authority');
assert.ok(shell.includes(scriptRef),'Persistent shell does not load the current Gemma registry authority');
assert.ok(campus.indexOf(scriptRef)>campus.indexOf('/app/shared-guide-surface-v236.js'),'Working Campus registry authority must settle after the shared guide loader can restore cached Gemma globals');
assert.ok(shell.indexOf(scriptRef)>shell.indexOf('/app/shared-guide-surface-v236.js'),'Persistent shell registry authority must settle after the shared guide loader can restore cached Gemma globals');

console.log(JSON.stringify({ok:true,currentModels:[FAST_E2,FAST_E4],legacyAliasesRequired:false,cachedLegacyRegistryRecovered:true,currentRegistrationStillRequired:true,parentAndCampusLoaded:true},null,2));

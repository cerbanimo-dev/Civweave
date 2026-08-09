const REVISION='living-school-deadline-guard-v266';
const DEFAULT_TIMEOUT=18000;
const PURPOSE_TIMEOUTS=new Map([
  ['living-school-live-source-research-v260',15000],
  ['living-school-local-source-synthesis-v260',15000],
  ['living-school-training-data-research-fallback-v260',15000],
  ['living-school-research-grounded-curriculum-v218.1',30000],
  ['living-school-module-depth-expansion-v262',12000],
  ['living-school-quiz-delta-completion-v258',10000],
  ['living-school-quiz-contract-primary-v266',10000],
  ['living-school-quiz-question-contract-repair-v266',9000]
]);
const clean=(value,max=120)=>String(value??'').trim().slice(0,max);
function timeoutFor(purpose){return PURPOSE_TIMEOUTS.get(clean(purpose,180))||DEFAULT_TIMEOUT}
function boundedRequest(runtime,request={}){
  const purpose=clean(request?.purpose,180);
  if(!purpose.startsWith('living-school-'))return request;
  const profile=clean(request?.executionProfile,80)||'interactive';
  const inherited=request?.config||runtime?.readSharedConfig?.(profile)||{};
  const cap=timeoutFor(purpose),existing=Number(inherited?.timeoutMs);
  return{...request,config:{...inherited,timeoutMs:Number.isFinite(existing)&&existing>0?Math.min(existing,cap):cap},livingSchoolDeadline:{revision:REVISION,timeoutMs:cap}};
}
export async function installLivingSchoolDeadlineGuardV266(){
  if(globalThis.CivweaveLivingSchoolDeadlineGuardV266?.installed)return globalThis.CivweaveLivingSchoolDeadlineGuardV266;
  const runtime=globalThis.CivweaveModelRuntime;
  if(!runtime?.generate)throw new Error('The shared model runtime is unavailable for the Living School deadline guard.');
  if(runtime.livingSchoolDeadlineGuardRevision===REVISION)return runtime;
  const baseGenerate=runtime.generate.bind(runtime);
  const generate=request=>baseGenerate(boundedRequest(runtime,request));
  const wrapped=Object.freeze({...runtime,generate,generateInteractive:request=>generate({...request,executionProfile:'interactive'}),generateAgentic:request=>generate({...request,executionProfile:'agentic'}),livingSchoolDeadlineGuardRevision:REVISION});
  globalThis.CivweaveModelRuntime=wrapped;
  const api=Object.freeze({installed:true,revision:REVISION,defaultTimeoutMs:DEFAULT_TIMEOUT,purposeTimeouts:Object.fromEntries(PURPOSE_TIMEOUTS),policy:'every-living-school-provider-call-has-a-hard-runtime-deadline-v266'});
  globalThis.CivweaveLivingSchoolDeadlineGuardV266=api;
  try{dispatchEvent(new CustomEvent('civweave:living-school-deadline-guard-ready',{detail:api}))}catch{}
  return api;
}

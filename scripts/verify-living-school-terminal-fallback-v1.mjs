import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const [runtime,runtimeRoute,activeUi,index,worker]=await Promise.all([
  readFile('public/app/living-school-terminal-fallback-v1.js','utf8'),
  readFile('public/app/living-school-runtime-route-v2.js','utf8'),
  readFile('public/app/living-school-active-run-ui-v1.js','utf8'),
  readFile('public/app/cabinets/living-school/index.html','utf8'),
  readFile('public/service-worker-living-school-cleanroom-v218.js','utf8'),
]);

new vm.Script(runtime,{filename:'living-school-terminal-fallback-v1.js'});
new vm.Script(runtimeRoute,{filename:'living-school-runtime-route-v2.js'});
new vm.Script(activeUi,{filename:'living-school-active-run-ui-v1.js'});
assert(runtime.includes("const PRIMARY_MODEL='gemini-3.7-flash'"),'terminal fallback must start from Gemini 3.7 Flash');
assert(runtime.includes("const FALLBACK_MODEL='gemini-3.5-flash'"),'terminal fallback must use Gemini 3.5 Flash');
assert(runtime.includes("const FALLBACK_REASON='primary-3.7-error'"),'terminal fallback must cover any primary 3.7 error');
assert(runtime.includes("livingSchoolSingleStrongDesign:false"),'terminal owner must suppress the router\'s stale internal design fallback on its primary pass');
assert(runtime.includes('base=globalThis.CivweaveFastInteractiveV192?.base?.();'),'terminal fallback must pin the base provider runtime rather than the routing spine');
assert(runtime.includes('fallbackGenerate=base.generate.bind(base);'),'terminal fallback must call the base generator directly');
assert(runtime.includes('prepareFallbackForBase(request)'),'terminal fallback must explicitly prepare the Living School fallback before the direct provider call');
assert(runtime.includes("livingSchoolFallbackModelLocked:FALLBACK_MODEL"),'fallback request must lock Gemini 3.5 after Living School preparation');
assert(runtime.includes('fallback=await fallbackGenerate(prepared)'),'terminal fallback must make exactly one direct prepared 3.5 retry');
assert(!runtime.includes('spine.generate.bind(spine)'),'terminal fallback must never re-enter the shared routing spine');
assert(runtimeRoute.includes("const terminalPrimary=request?.context?.livingSchoolTerminalPrimary===true"),'runtime route must recognize the terminal primary marker');
assert(runtimeRoute.includes("livingSchoolSingleStrongDesign:terminalPrimary?false:true"),'runtime route must not re-arm the stale generic design handler for terminal-owned primary calls');
assert(activeUi.includes("rawTier==='fallback'?'fallback':'small'"),'run UI must preserve the explicit fallback tier');
assert(activeUi.includes('3.5/fallback call'),'run UI summary must count Gemini 3.5 fallback calls separately');
assert(activeUi.includes('3.5 / fallback'),'run UI legend must distinguish Gemini 3.5 fallback from Lite follow-up calls');
assert(index.includes('/app/living-school-terminal-fallback-v1.js'),'Living School must load the terminal fallback runtime');
assert(worker.includes("const TERMINAL_FALLBACK='/app/living-school-terminal-fallback-v1.js'"),'clean-room service worker must track the terminal fallback runtime');
assert(worker.includes('GENERATION_BUDGET,TERMINAL_FALLBACK,ACTIVE_RUN_UI'),'terminal fallback and active run UI must be in the fresh-runtime set');

const routeContext=vm.createContext({
  console,
  URL,
  CivweaveGeminiTaskTierRouterV213:{complexModel:'gemini-3.7-flash'},
  CivweaveFastInteractiveV192:{register:()=>true,unregister:()=>true},
  CustomEvent:class CustomEvent{constructor(type,options={}){this.type=type;this.detail=options.detail}},
  dispatchEvent:()=>true,
  addEventListener:()=>{},
  queueMicrotask,
  setTimeout:()=>1,
});
vm.runInContext(runtimeRoute,routeContext,{filename:'living-school-runtime-route-v2.js'});
const routedPrimary=routeContext.CivweaveLivingSchoolRuntimeRouteV2.prepare({
  purpose:'living-school-research-grounded-curriculum-v218.1',
  config:{provider:'gemini',route:'gemini',model:'gemini-3.7-flash'},
  context:{research:{mode:'local-downloaded'},livingSchoolTerminalPrimary:true,livingSchoolSingleStrongDesign:false},
  messages:[],
});
assert.equal(routedPrimary.context.livingSchoolTerminalPrimary,true,'runtime preparation must preserve the terminal primary marker');
assert.equal(routedPrimary.context.livingSchoolSingleStrongDesign,false,'runtime preparation must keep the generic strong-design handler disabled for the terminal primary pass');
assert.equal(routedPrimary.config.model,'gemini-3.7-flash','terminal-owned primary preparation must still use Gemini 3.7 Flash');

const primaryCalls=[];
const fallbackCalls=[];
const primaryRuntime={
  __livingSchoolGenerationBudgetV2:true,
  async generate(request){
    primaryCalls.push(request);
    return {
      schema:'civweave-model-result-1.0',
      status:'provider-error',
      requested:{provider:'gemini',model:'gemini-3.7-flash'},
      actual:{provider:'gemini',model:'gemini-3.7-flash'},
      error:{code:'PROVIDER_HTTP_ERROR',status:503,message:'high demand'},
      diagnostics:[],
    };
  },
};
const baseRuntime={
  async generate(request){
    fallbackCalls.push(request);
    return {
      schema:'civweave-model-result-1.0',
      status:'success',
      outputText:'mock complete design packet',
      requested:{provider:request.config?.provider,model:request.config?.model},
      actual:{provider:request.config?.provider,model:request.config?.model},
      diagnostics:[],
    };
  },
};
const events=[];
const context=vm.createContext({
  console,
  CivweaveModelRuntime:primaryRuntime,
  CivweaveFastInteractiveV192:{base:()=>baseRuntime},
  CivweaveLivingSchoolGenerationBudgetV2:{installed:true,designPacketCheck:()=>({complete:true,issues:[],moduleCount:4})},
  CivweaveLivingSchoolRouteLockV1:{
    route:request=>({...request,config:{...(request.config||{}),model:'gemini-3.7-flash'},context:{...(request.context||{}),routePrepared:true}}),
    postRouter:request=>({...request,config:{...(request.config||{}),model:'gemini-3.7-flash'},context:{...(request.context||{}),postRouterPrepared:true}}),
  },
  CivweaveLivingSchoolRuntimeRouteV2:{prepare:request=>({...request,config:{...(request.config||{}),model:'gemini-3.7-flash'},context:{...(request.context||{}),runtimePrepared:true,livingSchoolSingleStrongDesign:false}})},
  document:{documentElement:{dataset:{}}},
  CustomEvent:class CustomEvent{constructor(type,options={}){this.type=type;this.detail=options.detail}},
  dispatchEvent:event=>{events.push(event);return true},
  addEventListener:()=>{},
  queueMicrotask,
  setTimeout:(fn)=>{fn();return 1},
});
vm.runInContext(runtime,context,{filename:'living-school-terminal-fallback-v1.js'});
await Promise.resolve();
assert.equal(context.CivweaveLivingSchoolTerminalFallbackV1.installed,true,'terminal fallback must install over the generation-budget runtime');
const result=await context.CivweaveModelRuntime.generate({
  purpose:'living-school-research-grounded-curriculum-v218.1',
  config:{provider:'gemini',route:'gemini',model:'gemini-3.7-flash'},
  context:{moduleCount:4,research:{mode:'local-downloaded'},livingSchoolSingleStrongDesign:true},
  messages:[{role:'user',content:'Build curriculum'}],
});
assert.equal(primaryCalls.length,1,'Living School must make exactly one primary design call through the prepared runtime');
assert.equal(primaryCalls[0].context.livingSchoolSingleStrongDesign,false,'the terminal owner must prevent the generic router from making a second hidden 3.7 design attempt');
assert.equal(primaryCalls[0].context.livingSchoolTerminalPrimary,true,'the primary request must identify the terminal owner');
assert.equal(fallbackCalls.length,1,'Living School must make exactly one fallback provider call');
assert.equal(fallbackCalls[0].config.model,'gemini-3.5-flash','the fallback provider call must reach the base runtime as Gemini 3.5 Flash');
assert.equal(fallbackCalls[0].config.provider,'gemini','the fallback provider must remain Gemini');
assert.equal(fallbackCalls[0].executionProfile,'interactive','the 3.5 fallback must avoid the stored agentic 3.7 profile override');
assert.equal(fallbackCalls[0].context.livingSchoolFallbackDirectBase,true,'the fallback request must record direct-base routing');
assert.equal(fallbackCalls[0].context.livingSchoolFallbackModelLocked,'gemini-3.5-flash','Living School preparation must not rewrite the fallback model back to 3.7');
assert.notEqual(fallbackCalls[0].config.model,'gemini-3.1-flash-lite','Flash-Lite must never be used for curriculum design fallback');
assert.equal(result.status,'success','a successful 3.5 fallback must be returned as the design result');
assert.equal(result.actual.model,'gemini-3.5-flash','the decorated final result must report Gemini 3.5 Flash as the actual model');
assert.equal(result.fallback.used,true,'the final result must expose fallback provenance');
assert.equal(result.fallback.fromModel,'gemini-3.7-flash');
assert.equal(result.fallback.toModel,'gemini-3.5-flash');
assert.equal(result.livingSchoolTerminalFallback.providerCalls,2,'the final result must report exactly two provider calls');
const selected=events.filter(event=>event.type==='civweave:gemini-task-tier-selected');
const completed=events.filter(event=>event.type==='civweave:gemini-task-tier-completed');
assert.equal(selected.length,1,'the direct 3.5 fallback must emit one visible model-call start event');
assert.equal(selected[0].detail.model,'gemini-3.5-flash');
assert.equal(selected[0].detail.tier,'fallback');
assert.equal(completed.length,1,'the direct 3.5 fallback must emit one visible model-call completion event');
assert.ok(events.some(event=>event.type==='civweave:living-school-gemini-fallback'),'the runtime must announce that the fallback occurred');

console.log(JSON.stringify({ok:true,contract:'living-school-terminal-fallback-v1',primary:'gemini-3.7-flash',fallback:'gemini-3.5-flash',fallbackOn:'any-3.7-error',primaryCalls:1,fallbackCalls:1,maxProviderCalls:2,flashLiteFallback:false,directBase:true,genericDesignHandlerSuppressed:true,runtimePreparationPreservesOwnership:true,visibleFallbackRun:true,executedRoutingTest:true},null,2));

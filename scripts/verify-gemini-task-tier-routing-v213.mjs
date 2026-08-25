import {readFile} from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const routerSource=await readFile(path.join(root,'public/app/gemini-task-tier-router-v213.js'),'utf8');
new Function(routerSource);

for(const token of [
  "const SMALL_MODEL='gemini-3.1-flash-lite'",
  "const RESEARCH_FALLBACK_MODEL='gemini-3.5-flash'",
  "const COMPLEX_MODEL='gemini-3.7-flash'",
  "const MIDDLEWARE_ID='gemini-task-tier-v271'",
  'agentic or tool-using flow',
  'multi-step planning',
  'research and source synthesis',
  'code generation',
  'civweave:gemini-task-tier-selected',
  'civweave:living-school-gemini-fallback',
  'http-503-high-demand',
  'Gemini 3.7 Flash',
])assert(routerSource.includes(token),`Gemini task router is missing ${token}`);

const listeners=new Map();
const storage=new Map();
const registrations=new Map();
const profiles={
  interactive:{provider:'gemini',route:'gemini',model:'gemini-3.5-flash-lite',endpoint:'https://generativelanguage.googleapis.com/v1beta',apiKey:'secret',externalConsent:true},
  agentic:null,
};
let generateMode='success';
const generateCalls=[];
const runtime={
  version:'test-runtime',
  readSharedConfig(profile='interactive'){return profiles[profile]||profiles.interactive||null;},
  saveSharedConfig(input,{profile='interactive',enabled}={}){profiles[profile]={...input};if(profile==='agentic')profiles.agenticEnabled=enabled!==false;},
  async generate(request){
    const model=request?.config?.model;generateCalls.push(model);
    if(generateMode==='503-then-success'&&model==='gemini-3.7-flash')return{status:'provider-error',requested:{provider:'gemini',model},actual:{provider:'gemini',model},error:{status:503,code:'UNAVAILABLE',message:'This model is currently experiencing high demand.'}};
    if(generateMode==='429'&&model==='gemini-3.7-flash')return{status:'provider-error',requested:{provider:'gemini',model},actual:{provider:'gemini',model},error:{status:429,code:'RESOURCE_EXHAUSTED',message:'Quota exceeded.'}};
    return{status:'success',requested:{provider:'gemini',model},actual:{provider:'gemini',model},outputText:'grounded curriculum design'};
  },
};
const spine={
  base:()=>runtime,
  register(id,middleware,priority){registrations.set(id,{middleware,priority});return true;},
};
const context={
  console,
  globalThis:null,
  CivweaveModelRuntime:runtime,
  CivweaveFastInteractiveV192:spine,
  localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},
  addEventListener:(name,fn)=>{const rows=listeners.get(name)||[];rows.push(fn);listeners.set(name,rows);},
  dispatchEvent:event=>{for(const fn of listeners.get(event.type)||[])fn(event);return true;},
  CustomEvent:class{constructor(type,init={}){this.type=type;this.detail=init.detail;}},
  queueMicrotask,
  setTimeout,
  clearTimeout,
};
context.globalThis=context;
vm.createContext(context);
vm.runInContext(routerSource,context,{filename:'gemini-task-tier-router-v213.js'});

const router=context.CivweaveGeminiTaskTierRouterV213;
assert.equal(router.smallModel,'gemini-3.1-flash-lite');
assert.equal(router.researchFallbackModel,'gemini-3.5-flash');
assert.equal(router.complexModel,'gemini-3.7-flash');
assert.equal(router.middlewareId,'gemini-task-tier-v271');
assert.equal(router.livingSchool503Fallback,true);
assert.equal(profiles.interactive.model,'gemini-3.1-flash-lite');
assert.equal(profiles.agentic.model,'gemini-3.7-flash');

const registration=registrations.get('gemini-task-tier-v271');
assert(registration,'Gemini task router middleware did not register on the capability spine.');
assert.equal(registration.priority,40);
const route=request=>registration.middleware.before(request,{baseRuntime:runtime});

let routed=route({purpose:'chat',context:{userMessage:'Hello there',guide:{system:'cerbanimo'}},messages:[{role:'system',content:'Create plans and generate code when asked.'},{role:'user',content:'Hello there'}]});
assert.equal(routed.executionProfile,'interactive');
assert.equal(routed.config.model,'gemini-3.1-flash-lite');

routed=route({purpose:'civweave-guide-response-v141',context:{userMessage:'Make a project plan for a neighborhood tool library',guide:{system:'civweave'}}});
assert.equal(routed.executionProfile,'agentic');
assert.equal(routed.config.model,'gemini-3.7-flash');

routed=route({purpose:'source-discovery',requiresTools:true,prompt:'Research current tool-library lending systems'});
assert.equal(routed.executionProfile,'agentic');
assert.equal(routed.config.model,'gemini-3.7-flash');

routed=route({purpose:'civweave-guide-response-v141',context:{userMessage:'Generate the React code for a project dashboard',guide:{system:'cerbanimo'}}});
assert.equal(routed.config.model,'gemini-3.7-flash');

routed=route({purpose:'civweave-guide-response-v141',context:{userMessage:'Write a patch for the voting interface',guide:{system:'anarchadia'}}});
assert.equal(routed.config.model,'gemini-3.7-flash');

const strongDesign=route({purpose:'living-school-grounded-design-lite-v333',taskTier:'small',context:{livingSchoolSingleStrongDesign:true,research:{mode:'local-downloaded'}},config:{provider:'gemini',route:'gemini'}});
assert.equal(strongDesign.executionProfile,'agentic','Living School single strong design must remain on the complex profile.');
assert.equal(strongDesign.config.model,'gemini-3.7-flash','Living School single strong design must start on Gemini 3.7 Flash.');
generateMode='503-then-success';generateCalls.length=0;
let handled=await registration.middleware.handle(strongDesign,{baseRuntime:runtime});
assert.equal(handled.handled,true);
assert.deepEqual(generateCalls,['gemini-3.7-flash','gemini-3.5-flash'],'HTTP 503 must trigger exactly one Gemini 3.5 Flash retry.');
assert.equal(handled.result.status,'success');
assert.equal(handled.result.actual.model,'gemini-3.5-flash');
assert.equal(handled.result.fallback.used,true);
assert.equal(handled.result.fallback.reason,'http-503-high-demand');
assert.equal(handled.result.fallback.toModel,'gemini-3.5-flash');

generateMode='429';generateCalls.length=0;
handled=await registration.middleware.handle(strongDesign,{baseRuntime:runtime});
assert.equal(handled.handled,true);
assert.deepEqual(generateCalls,['gemini-3.7-flash'],'Non-503 Gemini failures must not silently downgrade the Living School design call.');
assert.equal(handled.result.status,'provider-error');
assert.equal(handled.result.error.status,429);

profiles.interactive={provider:'ollama',route:'ollama',model:'qwen',endpoint:'http://127.0.0.1:11434/api/chat'};
profiles.agentic=null;
routed=route({purpose:'project-plan',context:{userMessage:'Make a project plan'}});
assert.equal(routed.config,undefined,'Non-Gemini requests must not be rewritten by the Gemini tier router.');

console.log(JSON.stringify({ok:true,revision:'v271-living-school-503-fallback',smallModel:'gemini-3.1-flash-lite',fallbackModel:'gemini-3.5-flash',complexModel:'gemini-3.7-flash',cases:8},null,2));

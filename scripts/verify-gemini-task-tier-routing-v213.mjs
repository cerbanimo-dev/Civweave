import {readFile} from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const routerSource=await readFile(path.join(root,'public/app/gemini-task-tier-router-v213.js'),'utf8');
const boundarySource=await readFile(path.join(root,'public/app/install-boundary-v146.js'),'utf8');

new Function(routerSource);
new Function(boundarySource);

for(const token of [
  "const SMALL_MODEL='gemini-3.1-flash-lite'",
  "const COMPLEX_MODEL='gemini-3.5-flash-lite'",
  'agentic or tool-using flow',
  'multi-step planning',
  'research and source synthesis',
  'code generation',
  'civweave:gemini-task-tier-selected',
  'Automatic Gemini task routing',
])assert(routerSource.includes(token),`Gemini task router is missing ${token}`);

for(const token of [
  "const GEMINI_TASK_ROUTER_SCRIPT='/app/gemini-task-tier-router-v213.js'",
  'addScript(GEMINI_TASK_ROUTER_SCRIPT)',
  "geminiSmallModel:'gemini-3.1-flash-lite'",
  "geminiComplexModel:'gemini-3.5-flash-lite'",
])assert(boundarySource.includes(token),`Install boundary is missing ${token}`);

const listeners=new Map();
const storage=new Map();
const calls=[];
const profiles={
  interactive:{provider:'gemini',route:'gemini',model:'gemini-3.5-flash-lite',endpoint:'https://generativelanguage.googleapis.com/v1beta',apiKey:'secret',externalConsent:true},
  agentic:null,
};
const runtime={
  version:'test-runtime',
  resolveExecutionProfile(request={}){
    return request.executionProfile==='agentic'||request.agentic||request.background||request.requiresTools||request.webSearch||request.youtubeSearch?'agentic':'interactive';
  },
  readSharedConfig(profile='interactive'){return profiles[profile]||profiles.interactive||null;},
  saveSharedConfig(input,{profile='interactive',enabled}={}){profiles[profile]={...input};if(profile==='agentic')profiles.agenticEnabled=enabled!==false;},
  async generate(request){calls.push(request);return{status:'success',actual:{provider:request.config?.provider||'gemini',model:request.config?.model},outputText:'ok'};},
};
const context={
  console,
  globalThis:null,
  CivweaveModelRuntime:runtime,
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

const routed=context.CivweaveModelRuntime;
assert.equal(routed.geminiTaskRouting.smallModel,'gemini-3.1-flash-lite');
assert.equal(routed.geminiTaskRouting.complexModel,'gemini-3.5-flash-lite');
assert.equal(profiles.interactive.model,'gemini-3.1-flash-lite');
assert.equal(profiles.agentic.model,'gemini-3.5-flash-lite');

await routed.generate({purpose:'chat',context:{userMessage:'Hello there',guide:{system:'cerbanimo'}},messages:[{role:'system',content:'Create plans and generate code when asked.'},{role:'user',content:'Hello there'}]});
assert.equal(calls.at(-1).executionProfile,'interactive');
assert.equal(calls.at(-1).config.model,'gemini-3.1-flash-lite');

await routed.generate({purpose:'civweave-guide-response-v141',context:{userMessage:'Make a project plan for a neighborhood tool library',guide:{system:'civweave'}}});
assert.equal(calls.at(-1).executionProfile,'agentic');
assert.equal(calls.at(-1).config.model,'gemini-3.5-flash-lite');

await routed.generate({purpose:'source-discovery',requiresTools:true,prompt:'Research current tool-library lending systems'});
assert.equal(calls.at(-1).executionProfile,'agentic');
assert.equal(calls.at(-1).config.model,'gemini-3.5-flash-lite');

await routed.generate({purpose:'civweave-guide-response-v141',context:{userMessage:'Generate the React code for a project dashboard',guide:{system:'cerbanimo'}}});
assert.equal(calls.at(-1).config.model,'gemini-3.5-flash-lite');

await routed.generate({purpose:'civweave-guide-response-v141',context:{userMessage:'Write a patch for the voting interface',guide:{system:'anarchadia'}}});
assert.equal(calls.at(-1).config.model,'gemini-3.5-flash-lite');

profiles.interactive={provider:'ollama',route:'ollama',model:'qwen',endpoint:'http://127.0.0.1:11434/api/chat'};
profiles.agentic=null;
await routed.generate({purpose:'project-plan',context:{userMessage:'Make a project plan'}});
assert.equal(calls.at(-1).config,undefined,'Non-Gemini requests must not be rewritten by the Gemini tier router.');

console.log(JSON.stringify({ok:true,revision:'v213',smallModel:'gemini-3.1-flash-lite',complexModel:'gemini-3.5-flash-lite',cases:6},null,2));

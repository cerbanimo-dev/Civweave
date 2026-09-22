import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const authoritySource=await readFile(new URL('../public/app/local-ai/gemma4-litert-request-authority-v1.js',import.meta.url),'utf8');
const registrySource=await readFile(new URL('../public/app/local-ai/gemma4-current-registry-authority-v1.js',import.meta.url),'utf8');
const fastSource=await readFile(new URL('../public/app/local-ai/litert-gemma4-fast-runtime-v1.js',import.meta.url),'utf8');
const compactSource=await readFile(new URL('../public/app/local-ai/gemma4-structured-quest-compact-envelope-v1.js',import.meta.url),'utf8');
const persistent=await readFile(new URL('../public/app/persistent-system-shell-v1.html',import.meta.url),'utf8');
const campus=await readFile(new URL('../public/app/working-campus-v440.html',import.meta.url),'utf8');

assert.match(authoritySource,/VERSION='1\.0\.1-gemma4-litert-request-authority-v1-stable-composition'/);
assert.match(authoritySource,/FAST_RUNTIME_SRC='\/app\/local-ai\/litert-gemma4-fast-runtime-v1\.js\?v=1\.4\.0-formatted-output'/);
assert.match(authoritySource,/if\(!fastWrapperReady\(\)\)[\s\S]*LOCAL_GEMMA4_LITERT_OWNERSHIP_FAILED/,'authority must refuse inference until the LiteRT wrapper owns the selected model');
assert.doesNotMatch(authoritySource,/CivweaveLocalModelRuntimeV266\?\.generate|CivweaveLocalModelRuntimeV266\.generate/,'first-request authority must never invoke the generic Transformers runtime directly');
assert.match(authoritySource,/copyCompositionMetadata\(respond,prior\)/,'Gemma authority must preserve lower assistant-layer ownership metadata');
assert.match(authoritySource,/__civweaveLocalProviderAuthorityVersion/);
assert.match(authoritySource,/__cwLocalGuideControlBypassVersion/);
assert.match(authoritySource,/civweave:local-provider-authority-installed/);
assert.match(authoritySource,/civweave:local-guide-control-bypass-ready/);
assert.match(authoritySource,/passivePrewarm:false/,'authority must not race the shared-guide loader with passive prewarm');
assert.match(registrySource,/REQUEST_AUTH_VERSION='1\.0\.1-gemma4-litert-request-authority-v1-stable-composition'/);
assert.match(fastSource,/conversationConfig\.enableConstrainedDecoding=true/);
assert.match(fastSource,/prefaceConfig\.tools=\[formattedTool\]/);
assert.match(fastSource,/await chat\.sendMessage\(latest\)/,'formatted output should use the final structured response instead of partial streamed tool calls');
assert.match(fastSource,/structuredToolCalling:true/);
assert.match(compactSource,/structuredTool:COMPACT_TOOL/);
for(const [label,html] of [['persistent shell',persistent],['Working Campus',campus]]){
  const base=html.indexOf('gemma4-structured-quest-completion-v1.js');
  const request=html.indexOf('gemma4-litert-request-authority-v1.js');
  const compact=html.indexOf('gemma4-structured-quest-compact-envelope-v1.js');
  assert(base>=0&&request>base&&compact>request,`${label} must load base structured completion, first-request LiteRT authority, then compact formatted Quest bridge`);
  assert.match(html,/gemma4-current-registry-authority-v1\.js\?v=1\.0\.2-stable-composition/);
  assert.match(html,/gemma4-litert-request-authority-v1\.js\?v=1\.0\.1-stable-composition/);
}

const events=[];
const listeners=new Map();
const storage=new Map([['civweave.local-ai.selection.v266',JSON.stringify({active:true,id:'gemma4-e2b-it-litert-web'})]]);
const lowerRespond=async()=>{events.push(`assistant-lower-wrapper-${sandbox.CivweaveLocalChatRuntimeV295.__civweaveLiteRTGemma4FastV1?'ready':'missing'}`);return{ok:true}};
lowerRespond.__civweaveLocalProviderAuthorityV1=true;
lowerRespond.__civweaveLocalProviderAuthorityVersion='1.0.3-local-provider-authority-v1-inference-core-first';
lowerRespond.__cwLocalGuideControlBypassV1=true;
lowerRespond.__cwLocalGuideControlBypassVersion='1.4.1-local-guide-control-bypass-v1-ai-quest-lazy-route';
lowerRespond.__cwWeavelingAIQuestRequiredV1=true;
lowerRespond.__cwWeavelingStructuredQuestRouteV1=true;

const sandbox={
  console,JSON,Object,Array,String,Number,Boolean,RegExp,Promise,Math,Date,URL,
  localStorage:{getItem:key=>storage.get(key)??null},
  document:{scripts:[],head:{isConnected:true,append(){throw new Error('no script load expected in this sandbox')}},createElement:()=>({dataset:{}})},
  location:{href:'https://civweave.test/app/'},
  CivweaveLocalChatRuntimeV295:{revision:'v312-runtime-first-bootstrap',inferenceCoreFirst:true,generate:async()=>{events.push('generic-local-generate');throw new Error("Cannot set properties of undefined (setting 'allowLocalModels')")},ready:async()=>{events.push('local-chat-ready');return true}},
  CivweaveLocalModelDownloadV266:{selection:()=>({active:true,id:'gemma4-e2b-it-litert-web'})},
  CivweaveGemma4LiteRTFastExtensionV1:{version:'1.1.1-gemma4-litert-fast-extension-v1-browser-handoff-guard',watch:()=>events.push('extension-watch')},
  CivweaveGemma4CurrentRegistryAuthorityV1:{repairRegistry:()=>events.push('registry-repair')},
  CivweaveLiteRTGemma4FastRuntimeV1:{version:'1.4.0-litert-gemma4-fast-runtime-v1-formatted-output',install(){events.push('fast-install');const prior=sandbox.CivweaveLocalChatRuntimeV295;sandbox.CivweaveLocalChatRuntimeV295={...prior,__civweaveLiteRTGemma4FastV1:'1.4.0-litert-gemma4-fast-runtime-v1-formatted-output',generate:async()=>{events.push('fast-local-generate');return{status:'success',outputText:'ok'}}};return true}},
  CivweaveAssistantV141:{respond:lowerRespond},
  queueMicrotask:fn=>fn(),
  setTimeout:()=>1,clearTimeout:()=>{},
  addEventListener:(name,fn)=>{const rows=listeners.get(name)||[];rows.push(fn);listeners.set(name,rows)},
  dispatchEvent:event=>{for(const fn of listeners.get(event.type)||[])fn(event);return true},
  CustomEvent:class CustomEvent{constructor(type,init={}){this.type=type;this.detail=init.detail}}
};
sandbox.globalThis=sandbox;
vm.createContext(sandbox);
vm.runInContext(authoritySource,sandbox,{filename:'gemma4-litert-request-authority-v1.js'});
const authority=sandbox.CivweaveGemma4LiteRTRequestAuthorityV1;
assert.equal(authority.version,'1.0.1-gemma4-litert-request-authority-v1-stable-composition');
assert.equal(authority.selectedFast(),true);
assert.equal(authority.stableAssistantComposition,true);
assert.equal(events.includes('fast-install'),false,'passive startup must not install the LiteRT wrapper before a request');

let top=sandbox.CivweaveAssistantV141.respond;
assert.equal(top.__civweaveLocalProviderAuthorityV1,true,'Gemma top wrapper dropped local-provider authority ownership');
assert.equal(top.__civweaveLocalProviderAuthorityVersion,'1.0.3-local-provider-authority-v1-inference-core-first');
assert.equal(top.__cwLocalGuideControlBypassV1,true,'Gemma top wrapper dropped Quest-router ownership');
assert.equal(top.__cwLocalGuideControlBypassVersion,'1.4.1-local-guide-control-bypass-v1-ai-quest-lazy-route');
assert.equal(top.__civweaveGemma4LiteRTStableComposition,true);

const tarot='Could you help me learn a system for remembering the tarot?';
await sandbox.CivweaveAssistantV141.respond({text:tarot});
assert(events.includes('local-chat-ready'));
assert(events.includes('fast-install'));
assert(events.includes('assistant-lower-wrapper-ready'),'assistant pipeline must not run until LiteRT ownership is installed');
assert.equal(events.includes('generic-local-generate'),false,'first selected LiteRT request must never fall into the generic Transformers worker');
assert(events.indexOf('fast-install')<events.indexOf('assistant-lower-wrapper-ready'));

// Reproduce the real race: the Quest router installs after Gemma and routes Quest
// requests without calling its prior wrapper. Its readiness event must put Gemma
// back on top before the next user request.
const priorGemma=sandbox.CivweaveAssistantV141.respond;
const lateQuestRouter=async args=>{events.push(`late-quest-router-${args?.text===tarot?'tarot':'other'}`);return{provider:'downloaded-local',response:{answer:'quest-route'}}};
lateQuestRouter.__civweaveLocalProviderAuthorityV1=true;
lateQuestRouter.__civweaveLocalProviderAuthorityVersion='1.0.3-local-provider-authority-v1-inference-core-first';
lateQuestRouter.__cwLocalGuideControlBypassV1=true;
lateQuestRouter.__cwLocalGuideControlBypassVersion='1.4.1-local-guide-control-bypass-v1-ai-quest-lazy-route';
lateQuestRouter.__prior=priorGemma;
sandbox.CivweaveAssistantV141={...sandbox.CivweaveAssistantV141,respond:lateQuestRouter};
sandbox.dispatchEvent(new sandbox.CustomEvent('civweave:local-guide-control-bypass-ready',{detail:{}}));
top=sandbox.CivweaveAssistantV141.respond;
assert.equal(top.__civweaveGemma4LiteRTFirstRequest,authority.version,'late Quest router was left above first-request LiteRT ownership');
assert.equal(top.__cwLocalGuideControlBypassV1,true,'reinstalled Gemma wrapper lost Quest-router marker');
await top({text:tarot});
assert(events.includes('late-quest-router-tarot'),'recomposed pipeline did not delegate to the Quest router');
assert.equal(events.includes('generic-local-generate'),false);

console.log(JSON.stringify({ok:true,contract:'gemma4-first-request-formatted-output-v1',firstRequestOwned:true,genericTransformersBypass:true,stableAssistantComposition:true,questRouterReasserted:true,tarotPromptCovered:true,formattedQuest:true,shellOrder:true},null,2));

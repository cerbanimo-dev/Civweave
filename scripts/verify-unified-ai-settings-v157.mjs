import {readFile} from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};

const [html,campusStyles,loader,settings,styles,installBoundary,geminiTransport,deviceCredentials,baseWorker,additiveWorker,...parts]=await Promise.all([
  read('public/app/working-campus-v156.html'),
  read('public/app/working-campus-v156.css'),
  read('public/app/family-ai-loader-v105.js'),
  read('public/app/minilm-model-settings-v138.js'),
  read('public/app/model-settings-v133.css'),
  read('public/app/install-boundary-v146.js'),
  read('public/extensions/commonweave-gemini-interactions-v159.js'),
  read('public/extensions/commonweave-device-credentials-v160.js'),
  read('public/service-worker.js'),
  read('public/service-worker-v156.js'),
  ...[1,2,3,4,5].map(index=>read(`public/app/working-campus-v156.part${index}.txt`))
]);

const campusSource=parts.join('');
new Function(campusSource);
new Function(settings);
new Function(loader);
new Function(installBoundary);
new Function(geminiTransport);
new Function(deviceCredentials);
new Function(additiveWorker.replace(/^'use strict';\s*importScripts\([^\n]+\);/,'\'use strict\';'));

assert(html.includes('/app/family-ai-loader-v105.js?v=unified-settings-r1'),'Working Campus does not load the shared settings loader.');
assert(html.includes('id="weaveling-chat-form"')&&html.includes('id="weaveling-chat-input"')&&html.includes('id="weaveling-chat-send"'),'Working Campus does not expose a Weaveling composer.');
assert(campusStyles.includes('.weaveling-chat-form')&&campusStyles.includes('.weaveling-chat-form textarea'),'Working Campus does not style the Weaveling composer.');
assert(!html.includes('<dialog id="settings"'),'Working Campus still ships a duplicate model-settings dialog.');
for(const stale of ['id="model-route"','id="model-key"','id="test-gemini"','id="test-antigravity"'])assert(!html.includes(stale),`Working Campus still owns stale control ${stale}.`);
for(const token of ['openSharedSettings','CommonweaveFamilyAILoaderV105.openSettings','commonweave:model-settings-saved','syncModelChip','sendWeaveling','CommonweaveAssistantV141','weaveling-chat-form'])assert(campusSource.includes(token),`Working Campus shared runtime bridge is missing ${token}.`);
assert(!parts[4].includes("$('#model-route').addEventListener"),'Working Campus still binds its retired settings form.');

for(const token of ['CommonweaveModelSettingsV157','CommonweaveModelSettingsV133=globalThis.CommonweaveModelSettingsV157',"VERSION='157.1'",'Gemini API key','gemini-3.5-flash-lite','https://generativelanguage.googleapis.com/v1beta','data-paste-key','data-import-key','extractKey','GEMINI_API_KEY','GOOGLE_API_KEY','data-test-gemini','data-test-antigravity','runtime().generate',"actualModel.includes('antigravity')",'A Gemini fallback does not count as a successful Antigravity test.','commonweave:model-settings-saved','Run reflex speed trial'])assert(settings.includes(token),`Shared settings component is missing ${token}.`);
assert(!settings.includes('localStorage.setItem("commonweave-model-session"'),'The base settings component writes a session API key directly to localStorage.');

for(const token of ['.cw-ai-header','.cw-ai-secret-tools','.cw-ai-test-grid','.cw-ai-form-footer','--cw-ai-mint','#0a1022'])assert(styles.includes(token),`Restyled settings surface is missing ${token}.`);
for(const token of ['inline-commonweave-r40','function removeStale','function reset','CommonweaveModelSettingsV133','globalThis.CommonweaveModelSettingsV133.open()'])assert(loader.includes(token),`Inline family loader shared-settings contract is missing ${token}.`);
assert(!loader.includes("['/app/guide-chat-v153.js?v=1.0.4'"),'Retired floating guide script returned to the load sequence.');

for(const token of ["VERSION='159.0-gemini-interactions-transport'",'/api/ai/gemini/interactions',"Api-Revision':API_REVISION","model:config.model",'response_format','store:false',"profile!=='agentic'",'__geminiInteractionsTransport',"fallback:{used:false}",'Gemini completed the interaction but returned no text output.'])assert(geminiTransport.includes(token),`Gemini Interactions transport is missing ${token}.`);
for(const token of ["VERSION='160.0-device-credentials'",'commonweave-model-persistent-secrets-v160','function restore','function persist','function forget','data-forget-device-key','Provider credentials are stored only on this device'])assert(deviceCredentials.includes(token),`Device credential runtime is missing ${token}.`);
for(const token of ['DEVICE_CREDENTIALS_SCRIPT','GEMINI_INTERACTIONS_SCRIPT','/extensions/commonweave-device-credentials-v160.js','/extensions/commonweave-gemini-interactions-v159.js','addScript(DEVICE_CREDENTIALS_SCRIPT)','addScript(GEMINI_INTERACTIONS_SCRIPT)',"additionsVersion:'v160-device-credentials'"])assert(installBoundary.includes(token),`Install boundary does not load ${token}.`);

for(const token of ["CACHE_REVISION='direct-family-r37-fast-install'","DEVICE_REVISION='device-package-r37-core'","MODEL_REVISION='minilm-on-demand-r1'",'modelOnDemand','GET_MODEL_PACKAGE_STATUS'])assert(baseWorker.includes(token),`Fast-core base worker lost ${token}.`);
for(const token of ["EXTENSION_VERSION='working-campus-additions-v160-device-credentials-weaveling-chat'","DEVICE_CREDENTIALS_REVISION='device-credentials-v160'",'/extensions/commonweave-device-credentials-v160.js',"GEMINI_TRANSPORT_REVISION='gemini-interactions-v159'",'/extensions/commonweave-gemini-interactions-v159.js','PATCHED_CORE_FILES','patchCorePackage','/app/platform-stability-v159.js','/app/cerbanimo-ai-validator-v159.js','/app/anarchadia-runtime-stability-v159.js','/app/minilm-model-settings-v138.js','/app/model-settings-v133.css','/app/working-campus-v156.html','/app/working-campus-v156.css','/app/working-campus-v156.part4.txt','/app/working-campus-v156.part5.txt','inlineChatRevision:INLINE_CHAT_REVISION'])assert(additiveWorker.includes(token),`Current additive worker does not deliver ${token}.`);

const calls=[];
const storage={values:new Map([['commonweave.host-node.v1',JSON.stringify({baseUrl:'https://node.example'})]]),getItem(key){return this.values.get(key)||null},setItem(key,value){this.values.set(key,String(value))}};
const sandbox={console,URL,AbortController,setTimeout,clearTimeout,EventTarget,Response,CustomEvent:class{constructor(type,{detail}={}){this.type=type;this.detail=detail}},dispatchEvent(){},localStorage:storage,location:{protocol:'https:',origin:'https://node.example',pathname:'/app/test'},fetch:async(url,init)=>{calls.push({url,init});return new Response(JSON.stringify({id:'int_1',status:'completed',model:'gemini-3.5-flash-lite',steps:[{type:'model_output',content:[{type:'text',text:'READY'}]}],usage:{total_input_tokens:3,total_output_tokens:1,total_tokens:4}}),{status:200,headers:{'content-type':'application/json'}})},globalThis:null};
sandbox.globalThis=sandbox;vm.createContext(sandbox);vm.runInContext(geminiTransport,sandbox,{filename:'commonweave-gemini-interactions-v159.js'});
const original=Object.freeze({version:'test',resultSchema:'commonweave-model-result-1.0',normalizeConfig:value=>({provider:value.provider||value.route,model:value.model,endpoint:value.endpoint,apiKey:value.apiKey,externalConsent:value.externalConsent,timeoutMs:value.timeoutMs||5000,maxTokens:value.maxTokens||48,temperature:value.temperature||0.2,stream:Boolean(value.stream),headers:value.headers||{}}),resolveExecutionProfile:request=>request.executionProfile||'interactive',readSharedConfig:()=>null,generate:async()=>({status:'delegated'})});
sandbox.CommonweaveModelRuntime=original;
const result=await sandbox.CommonweaveModelRuntime.generate({executionProfile:'interactive',config:{provider:'gemini',model:'gemini-3.5-flash-lite',endpoint:'https://generativelanguage.googleapis.com/v1beta',apiKey:'secret',externalConsent:true},messages:[{role:'user',content:'READY'}]});
assert(result.status==='success'&&result.outputText==='READY','Standard Gemini did not complete through the Interactions transport.');
assert(result.fallback?.used===false,'Standard Gemini transport incorrectly reported a deterministic fallback.');
assert(result.actual?.provider==='gemini'&&result.actual?.model==='gemini-3.5-flash-lite','Standard Gemini transport lost actual provider/model identity.');
assert(calls[0]?.url==='https://node.example/api/ai/gemini/interactions','Standard Gemini did not use the connected host-node proxy.');
const body=JSON.parse(calls[0].init.body);assert(body.model==='gemini-3.5-flash-lite'&&body.input==='User: READY'&&body.store===false,'Standard Gemini Interactions payload is malformed.');
const delegated=await sandbox.CommonweaveModelRuntime.generate({executionProfile:'agentic',config:{provider:'gemini',model:'antigravity',apiKey:'secret',externalConsent:true}});assert(delegated.status==='delegated','The Gemini transport intercepted the passing Antigravity route.');

class MemoryStorage{constructor(seed={}){this.values=new Map(Object.entries(seed))}getItem(key){return this.values.has(key)?this.values.get(key):null}setItem(key,value){this.values.set(key,String(value))}removeItem(key){this.values.delete(key)}}
class SimpleTarget{constructor(){this.listeners={}}addEventListener(type,listener){(this.listeners[type]??=[]).push(listener)}dispatchEvent(event){for(const listener of this.listeners[event.type]||[])listener(event);return true}}
const eventRoot=new SimpleTarget(),credentialDocument=new SimpleTarget();credentialDocument.documentElement={};credentialDocument.readyState='complete';credentialDocument.hidden=false;credentialDocument.querySelectorAll=()=>[];
const credentialLocal=new MemoryStorage(),credentialSession=new MemoryStorage({'commonweave-model-session':JSON.stringify({apiKey:'persist-me',remoteConsent:true}),'commonweave-model-secrets-v1':JSON.stringify({gemini:{apiKey:'persist-me',externalConsent:true}})});
const credentialSandbox={console,setTimeout,clearTimeout,queueMicrotask,localStorage:credentialLocal,sessionStorage:credentialSession,document:credentialDocument,MutationObserver:class{observe(){}},CustomEvent:class{constructor(type,{detail}={}){this.type=type;this.detail=detail}},addEventListener:eventRoot.addEventListener.bind(eventRoot),dispatchEvent:eventRoot.dispatchEvent.bind(eventRoot),globalThis:null};
credentialSandbox.globalThis=credentialSandbox;vm.createContext(credentialSandbox);vm.runInContext(deviceCredentials,credentialSandbox,{filename:'commonweave-device-credentials-v160.js'});
assert(credentialSandbox.CommonweaveDeviceCredentialsV160.persist(),'Device credential persistence did not write a local snapshot.');
credentialSession.removeItem('commonweave-model-session');credentialSession.removeItem('commonweave-model-secrets-v1');
assert(credentialSandbox.CommonweaveDeviceCredentialsV160.restore(),'Device credential persistence did not restore a saved key.');
assert(JSON.parse(credentialSession.getItem('commonweave-model-session')).apiKey==='persist-me','Restored device credential does not match the saved key.');

console.log(JSON.stringify({ok:true,settingsRuntime:'157.1',compatibilityAlias:'v133-to-v157',sharedSurfaces:['working-campus','settings-bar'],weavelingComposer:true,guideLoader:'inline-commonweave-r41',geminiKeyIngestion:['direct-entry','clipboard','env-file','json-file','raw-key-file'],credentialStorage:'device-local-explicit-forget',liveTests:['gemini-interactions-host-proxy','antigravity-direct-no-fallback','credential-restart-restore'],geminiTransport:'159.0-gemini-interactions-transport',deviceCredentials:'160.0-device-credentials',duplicateWorkingCampusDialog:false,corePackage:'r37-fast-deferred-minilm',additiveSettingsRevision:'v160-device-credentials-weaveling-chat'},null,2));

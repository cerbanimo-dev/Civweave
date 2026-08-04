import {readFile} from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
const [recovery,workingHtml,workingCss,workingPart5,realmHtml,anarchadiaHtml,boundary,worker,validator]=await Promise.all([
  read('public/extensions/commonweave-guide-runtime-recovery-v160.js'),
  read('public/app/working-campus-v156.html'),
  read('public/app/working-campus-v156.css'),
  read('public/app/working-campus-v156.part5.txt'),
  read('public/app/realm-console-v140.html'),
  read('public/app/anarchadia-console-v139.html'),
  read('public/app/install-boundary-v146.js'),
  read('public/service-worker-v156.js'),
  read('public/app/cerbanimo-ai-validator-v156.js')
]);
new Function(recovery);
assert(workingHtml.includes('id="weaveling-chat-form"')&&workingHtml.includes('id="weaveling-chat-send"'),'Weaveling composer is missing.');
assert(workingCss.includes('.weaveling-chat-form'),'Weaveling composer styles are missing.');
for(const token of ['sendWeaveling','CommonweaveFamilyAILoaderV105','CommonweaveAssistantV141'])assert(workingPart5.includes(token),`Weaveling chat is missing ${token}.`);
for(const html of [workingHtml,realmHtml,anarchadiaHtml])assert(html.includes('/extensions/commonweave-guide-runtime-recovery-v160.js'),'A repaired surface does not preload v160.');
for(const token of ['GUIDE_RUNTIME_RECOVERY_SCRIPT','addScript(GUIDE_RUNTIME_RECOVERY_SCRIPT)',"additionsVersion:'v160-guide-runtime-recovery'"])assert(boundary.includes(token),`Install boundary is missing ${token}.`);
for(const token of ['/extensions/commonweave-guide-runtime-recovery-v160.js',"GUIDE_RUNTIME_RECOVERY_REVISION='guide-runtime-recovery-v160'",'/app/realm-console-v140.html','/app/working-campus-v156.css'])assert(worker.includes(token),`Offline delivery is missing ${token}.`);
assert(validator.includes("new MutationObserver(queuePatch).observe"),'The regression fixture no longer contains the original validator observer.');
for(const token of ['commonweave-model-persistent-secrets-v160','CommonweaveGuideChatV153',"dataset.cerbanimoAiValidator='true'",'data-cw160-ai-task','function patchCerbanimo'])assert(recovery.includes(token),`Recovery runtime is missing ${token}.`);

class MemoryStorage{constructor(seed={}){this.values=new Map(Object.entries(seed))}getItem(key){return this.values.has(key)?this.values.get(key):null}setItem(key,value){this.values.set(key,String(value))}removeItem(key){this.values.delete(key)}}
class Target{constructor(){this.listeners={}}addEventListener(type,listener){(this.listeners[type]??=[]).push(listener)}dispatchEvent(event){for(const listener of this.listeners[event.type]||[])listener(event);return true}}
const rootTarget=new Target(),documentTarget=new Target();documentTarget.documentElement={dataset:{}};documentTarget.readyState='complete';documentTarget.hidden=false;documentTarget.querySelectorAll=()=>[];documentTarget.querySelector=()=>null;
const localStorage=new MemoryStorage(),sessionStorage=new MemoryStorage({'commonweave-model-session':JSON.stringify({apiKey:'saved-key',remoteConsent:true}),'commonweave-model-secrets-v1':JSON.stringify({gemini:{apiKey:'saved-key',externalConsent:true}})});
const sandbox={console,URLSearchParams,structuredClone,setTimeout,clearTimeout,setInterval,clearInterval,queueMicrotask,localStorage,sessionStorage,document:documentTarget,location:{search:'',pathname:'/app/working-campus-v156.html'},MutationObserver:class{observe(){}},CustomEvent:class{constructor(type,{detail}={}){this.type=type;this.detail=detail}},Event:class{constructor(type){this.type=type}},addEventListener:rootTarget.addEventListener.bind(rootTarget),dispatchEvent:rootTarget.dispatchEvent.bind(rootTarget),globalThis:null};
sandbox.globalThis=sandbox;vm.createContext(sandbox);vm.runInContext(recovery,sandbox);
assert(sandbox.CommonweaveGuideRuntimeRecoveryV160.persistSecrets(),'Credential snapshot was not persisted.');
sessionStorage.removeItem('commonweave-model-session');sessionStorage.removeItem('commonweave-model-secrets-v1');
assert(sandbox.CommonweaveGuideRuntimeRecoveryV160.restoreSecrets(),'Credential snapshot was not restored.');
assert(JSON.parse(sessionStorage.getItem('commonweave-model-session')).apiKey==='saved-key','Restored key is incorrect.');
sandbox.CommonweaveAssistantV141={respond:async()=>({response:{answer:'READY',choice:{nextAction:'Continue'}},provider:'gemini',model:'gemini-3.5-flash-lite'})};
const reply=await sandbox.CommonweaveGuideChatV153.ask('anarchadia','test',[]);
assert(reply.text==='READY\n\nNext: Continue','Merlin adapter did not call the current assistant.');
console.log(JSON.stringify({ok:true,weavelingComposer:true,merlinBridge:true,credentialRestart:true,cerbanimoObserver:'idempotent-replacement',offlineDelivery:true},null,2));

import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
await import('./verify-system-ownership-v317.mjs');
const [source,loom,lite]=await Promise.all([
  readFile('public/app/device-credential-persistence-v211.js','utf8'),
  readFile('public/app/loom-v128.html','utf8'),
  readFile('public/app/lite-v129.html','utf8')
]);
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
for(const html of [loom,lite])assert(html.includes('/app/device-credential-persistence-v211.js'),'Legacy entry is missing the explicit credential compatibility API.');
for(const token of ['civweave-model-persistent-secrets-v191','persistFromSession','automaticRestore:false','automaticListeners:false','inputOwnership:false','settingsApiPatching:false'])assert(source.includes(token),`Credential compatibility API is missing ${token}.`);
assert(!source.includes('SETTINGS_SELECTOR'),'Credential compatibility API may not define a Settings selector.');
assert(!source.includes("document.addEventListener('click'"),'Credential compatibility API may not intercept Settings clicks.');
assert(!/api\.open\s*=/.test(source),'Credential compatibility API may not replace Settings open().');
class MemoryStorage{constructor(seed={}){this.values=new Map(Object.entries(seed))}getItem(key){return this.values.has(key)?this.values.get(key):null}setItem(key,value){this.values.set(key,String(value))}removeItem(key){this.values.delete(key)}snapshot(){return Object.fromEntries(this.values)}}
class CustomEvent{constructor(type,init={}){this.type=type;this.detail=init.detail}}
function boot(localSeed={},sessionSeed={}){const localStorage=new MemoryStorage(localSeed),sessionStorage=new MemoryStorage(sessionSeed),listeners=new Map(),addEventListener=(type,listener)=>{const list=listeners.get(type)||[];list.push(listener);listeners.set(type,list)},dispatchEvent=event=>{for(const listener of listeners.get(event.type)||[])listener(event);return true},sandbox={console,Date,JSON,URL,location:{href:'https://civweave.test/loom/'},localStorage,sessionStorage,CustomEvent,document:{},addEventListener,dispatchEvent,globalThis:null};sandbox.globalThis=sandbox;vm.createContext(sandbox);vm.runInContext(source,sandbox,{filename:'device-credential-persistence-v211.js'});return{sandbox,localStorage,sessionStorage}}
const sessionPacket={apiKey:'AIza-test-not-real',provider:'gemini',remoteConsent:true,savedAt:'2026-08-05T00:00:00.000Z'};
const first=boot({'civweave.universal-ai.v127':JSON.stringify({provider:'gemini',route:'gemini',model:'gemini-test',endpoint:'https://generativelanguage.googleapis.com/v1beta',consent:true})},{'civweave-model-session':JSON.stringify(sessionPacket)});
assert(first.sandbox.CivweaveDeviceCredentialPersistenceV211.persistFromSession('device'),'Explicit device persistence did not save the active session key.');
const durable=first.localStorage.getItem('civweave-model-persistent-secrets-v191');
assert(durable&&JSON.parse(durable).apiKey===sessionPacket.apiKey,'Durable credential record was not written.');
const second=boot(first.localStorage.snapshot(),{});
assert(!second.sessionStorage.getItem('civweave-model-session'),'Credential helper restored at module load instead of waiting for explicit Settings/controller intent.');
assert(second.sandbox.CivweaveDeviceCredentialPersistenceV211.restore(),'Explicit restore failed.');
const restored=JSON.parse(second.sessionStorage.getItem('civweave-model-session')||'{}');
assert(restored.apiKey===sessionPacket.apiKey,'Explicit restore did not recover the remembered key.');
assert(restored.remoteConsent===true,'Explicit restore did not recover remembered remote consent.');
second.sandbox.CivweaveDeviceCredentialPersistenceV211.forget();
assert(!second.localStorage.getItem('civweave-model-persistent-secrets-v191'),'Forget did not clear the durable key.');
assert(!second.sessionStorage.getItem('civweave-model-session'),'Forget did not clear the session key.');
console.log(JSON.stringify({ok:true,revision:'v211-explicit-credential-compatibility',save:true,automaticRestore:false,explicitRestore:true,forget:true,settingsInputOwnership:false,settingsApiPatching:false,legacyEntries:['loom','lite']},null,2));

import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source=await readFile('public/app/settings-gateway-v317.js','utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
class MemoryStorage{constructor(seed={}){this.values=new Map(Object.entries(seed))}getItem(key){return this.values.has(key)?this.values.get(key):null}setItem(key,value){this.values.set(key,String(value))}removeItem(key){this.values.delete(key)}}
class CustomEvent{constructor(type,{detail}={}){this.type=type;this.detail=detail}}
class Element{} class HTMLElement extends Element{}

function boot(localSeed={},sessionSeed={}){
  const localStorage=new MemoryStorage(localSeed),sessionStorage=new MemoryStorage(sessionSeed);
  const location={href:'https://civweave.test/app/settings-gateway-v317.js',origin:'https://civweave.test'};
  const document={documentElement:{dataset:{},lang:'en'},getElementById(){return null},querySelector(){return null},head:{isConnected:true,append(){}},body:{append(){}},addEventListener(){},removeEventListener(){}};
  const sandbox={console,Date,JSON,URL,Promise,setTimeout,clearTimeout,location,localStorage,sessionStorage,document,Element,HTMLElement,CustomEvent,requestAnimationFrame:null,dispatchEvent(){return true},globalThis:null};
  sandbox.globalThis=sandbox;vm.createContext(sandbox);vm.runInContext(source,sandbox,{filename:'settings-gateway-v317.js'});
  return{settings:sandbox.CivweaveSettingsV320,localStorage,sessionStorage};
}

const persistent={schema:'civweave.device-model-secret.v191',apiKey:'AIza-device-test-key-not-real',provider:'gemini',savedAt:'2026-08-05T00:00:00.000Z'};
const retiredProfile={interactive:{route:'bundled',provider:'bundled',model:'Xenova/all-MiniLM-L6-v2',endpoint:'/app/models/all-minilm-l6-v2/model-manifest.json'}};
const remembered=boot({'civweave-model-persistent-secrets-v191':JSON.stringify(persistent),'civweave-model-profiles-v1':JSON.stringify(retiredProfile)});
assert(remembered.settings?.credentialOwner===true,'Canonical Settings no longer owns credential state.');
assert(remembered.settings?.singleMenu===true,'Credential lifetime verifier is not exercising the single Settings menu.');
const rememberedState=remembered.settings.readState();
assert(rememberedState.remembered===true,'Remembered credential was not detected.');
assert(rememberedState.credentialMode==='device','Retired MiniLM profile reset remembered lifetime to session.');
assert(!remembered.sessionStorage.getItem('civweave-model-session'),'Canonical Settings mutated credential session merely because it was parsed.');
assert(!remembered.localStorage.getItem('civweave-model-credential-policy-v191'),'Canonical Settings mutated credential policy merely because it was parsed.');
assert(remembered.settings.restoreRememberedCredential()===true,'Explicit remembered-credential restore failed.');
assert(remembered.localStorage.getItem('civweave-model-credential-policy-v191')==='device','Explicit restore did not keep the device policy canonical.');
const restoredSession=JSON.parse(remembered.sessionStorage.getItem('civweave-model-session')||'{}');
assert(restoredSession.apiKey===persistent.apiKey,'Explicit restore did not recover the remembered key.');
const sessionOnly=boot({'civweave-model-profiles-v1':JSON.stringify(retiredProfile),'civweave-model-credential-policy-v191':'session'});
assert(sessionOnly.settings.readState().credentialMode==='session','Session-only profile should remain session-only without a durable credential.');
assert(sessionOnly.settings.restoreRememberedCredential()===false,'Restore should be a no-op without a remembered credential.');
console.log(JSON.stringify({ok:true,revision:'v212-credential-lifetime-state-v320',settingsAuthority:'CivweaveSettingsV320',moduleLoadMutation:false,rememberedRetiredProfile:'device',explicitRestore:true,noRememberedCredential:'session'},null,2));

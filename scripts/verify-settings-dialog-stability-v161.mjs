import {readFile} from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=await readFile(path.join(root,'public/extensions/civweave-device-credentials-v160.js'),'utf8');
const boundary=await readFile(path.join(root,'public/app/install-boundary-v146.js'),'utf8');
const worker=await readFile(path.join(root,'public/service-worker-v156.js'),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};

new Function(source);
for(const token of [
  "VERSION='160.1-device-credentials-settings-stable'",
  'function setText',
  'node.textContent===text',
  'observer?.disconnect?.()',
  'function relevantMutation',
  'if(patchQueued||patching)return',
  'settings-dialog-stability-v161'
])assert(source.includes(token)||boundary.includes(token)||worker.includes(token),`Settings stability repair is missing ${token}.`);
assert(!source.includes("secretNote.textContent=saved?"),'Credential note still rewrites itself unconditionally.');
assert(!source.includes("privacy.textContent='Provider credentials"),'Privacy note still rewrites itself unconditionally.');
for(const token of ["additionsVersion:'v161-settings-dialog-stability'","SETTINGS_STABILITY_REVISION='v161-settings-dialog-stability'",'settings-dialog-stability-v161'])assert(boundary.includes(token),`Install boundary is missing ${token}.`);
for(const token of ["EXTENSION_VERSION='working-campus-additions-v161-settings-dialog-stability'","SETTINGS_DIALOG_STABILITY_REVISION='settings-dialog-stability-v161'","EXTENSION_CACHE='cwext-working-campus-additions-v161-settings-dialog-stability'"])assert(worker.includes(token),`Installed-device package is missing ${token}.`);

class MemoryStorage{
  constructor(seed={}){this.values=new Map(Object.entries(seed))}
  getItem(key){return this.values.has(key)?this.values.get(key):null}
  setItem(key,value){this.values.set(key,String(value))}
  removeItem(key){this.values.delete(key)}
}
class EventRoot{
  constructor(){this.listeners={}}
  addEventListener(type,listener){(this.listeners[type]??=[]).push(listener)}
  dispatchEvent(event){for(const listener of this.listeners[event.type]||[])listener(event);return true}
}

const microtasks=[];
let microtaskRuns=0;
const queueMicrotaskFake=callback=>microtasks.push(callback);
const drain=()=>{
  while(microtasks.length){
    if(++microtaskRuns>20)throw new Error('Settings patch entered a recursive microtask loop.');
    microtasks.shift()();
  }
};

let textWrites=0;
let observerCallbacks=0;
let activeObserver=null;
const form={
  button:null,
  closest(selector){return selector.includes('data-unified-model-settings')?this:null},
  querySelector(selector){
    if(selector==='[data-secret-note]')return secretNote;
    if(selector==='[data-forget-device-key]')return this.button;
    if(selector.includes('.cw-ai-actions'))return actions;
    return null;
  },
  querySelectorAll(selector){return selector==='footer p,p'?[privacy]:[]}
};
const makeTextNode=initial=>{
  let value=initial;
  return {
    nodeType:1,
    closest:form.closest.bind(form),
    get textContent(){return value},
    set textContent(next){
      textWrites++;
      value=String(next);
      activeObserver?.notify([{target:this,addedNodes:[]}]);
    }
  };
};
const secretNote=makeTextNode('Session-only credentials.');
const privacy=makeTextNode('API keys remain in session storage.');
const actions={
  append(node){
    form.button=node;
    activeObserver?.notify([{target:form,addedNodes:[node]}]);
  }
};
class FakeMutationObserver{
  constructor(callback){this.callback=callback;this.active=false;activeObserver=this}
  observe(){this.active=true}
  disconnect(){this.active=false}
  notify(records){if(this.active){observerCallbacks++;this.callback(records)}}
}
const documentRoot=new EventRoot();
const document={
  readyState:'complete',hidden:false,documentElement:{},
  addEventListener:documentRoot.addEventListener.bind(documentRoot),
  querySelectorAll(selector){return selector.includes('data-unified-model-settings')?[form]:[]},
  createElement(){return{nodeType:1,dataset:{},hidden:false,textContent:'',matches(){return false},querySelector(){return null}}}
};
const windowRoot=new EventRoot();
const localStorage=new MemoryStorage();
const sessionStorage=new MemoryStorage({
  'civweave-model-session':JSON.stringify({apiKey:'stable-key'}),
  'civweave-model-secrets-v1':JSON.stringify({gemini:{apiKey:'stable-key'}})
});
const sandbox={
  console,setTimeout,clearTimeout,queueMicrotask:queueMicrotaskFake,
  localStorage,sessionStorage,document,MutationObserver:FakeMutationObserver,
  CustomEvent:class{constructor(type,{detail}={}){this.type=type;this.detail=detail}},
  addEventListener:windowRoot.addEventListener.bind(windowRoot),
  dispatchEvent:windowRoot.dispatchEvent.bind(windowRoot),globalThis:null
};
sandbox.globalThis=sandbox;
vm.createContext(sandbox);
vm.runInContext(source,sandbox,{filename:'civweave-device-credentials-v160.js'});
drain();
assert(textWrites===2,`Initial settings patch performed ${textWrites} text rewrites instead of two bounded updates.`);
assert(observerCallbacks===0,'The settings patch mutated the dialog while its observer was connected.');
assert(form.button?.textContent==='Forget saved key','Forget saved key control was not installed.');

sandbox.CivweaveDeviceCredentialsV160.patchSettings();
drain();
assert(textWrites===2,'A second settings patch rewrote unchanged text and could retrigger the observer.');
assert(observerCallbacks===0,'A second settings patch notified its own observer.');
assert(microtaskRuns<=2,'Settings patch scheduled an unexpected microtask chain.');

console.log(JSON.stringify({ok:true,settingsDialog:'opens-without-recursive-observer',textWrites,observerCallbacks,microtaskRuns,delivery:'v161-settings-dialog-stability'},null,2));

(()=>{
'use strict';

const VERSION='1.0.0';
const TRANSPORT_PATH='/app/local-object-mesh-v146.js';
const CONTRIBUTION_PATH='/app/shared/civweave-contribution-mesh-v1.js';
const listeners=new Set();
const now=()=>new Date().toISOString();

function emit(type,detail={}){
  const event={type,detail,at:now()};
  for(const listener of listeners){try{listener(event)}catch{}}
  try{globalThis.dispatchEvent(new CustomEvent('civweave:phone-ledger',{detail:event}))}catch{}
}

function browserSupport(){
  return Boolean(
    globalThis.indexedDB&&
    globalThis.crypto?.subtle&&
    globalThis.document
  );
}

function scriptFor(path){
  try{
    return [...document.scripts].find((script)=>{
      if(!script.src)return false;
      return new URL(script.src,location.href).pathname===path;
    })||null;
  }catch{return null}
}

function waitForGlobal(name,{timeout=10000,interval=25}={}){
  if(globalThis[name])return Promise.resolve(globalThis[name]);
  return new Promise((resolve,reject)=>{
    const started=Date.now();
    const timer=setInterval(()=>{
      if(globalThis[name]){
        clearInterval(timer);
        resolve(globalThis[name]);
        return;
      }
      if(Date.now()-started>=timeout){
        clearInterval(timer);
        reject(new Error(`${name} did not become ready`));
      }
    },interval);
  });
}

async function ensureScript(path,globalName){
  if(globalThis[globalName])return globalThis[globalName];

  const existing=scriptFor(path);
  if(!existing){
    const script=document.createElement('script');
    script.src=path;
    script.async=false;
    script.dataset.civweavePhoneLedger='1';
    document.head.append(script);
  }

  return waitForGlobal(globalName);
}

async function ensureRuntime(){
  await ensureScript(TRANSPORT_PATH,'CivweaveLocalMeshV146');
  const contribution=await ensureScript(
    CONTRIBUTION_PATH,
    'CivweaveContributionMeshV1'
  );
  await contribution.ready();
  return contribution;
}

async function snapshot(){
  const contribution=await ensureRuntime();
  const credential=await contribution.credentials();
  const wallet=await contribution.walletIdentity();
  const events=await contribution.activeEvents();
  const frontier=await contribution.frontier();
  return {
    version:VERSION,
    ready:true,
    role:'phone-ledger-node',
    storage:'indexeddb',
    hostRequired:false,
    deviceId:credential.deviceId,
    transportDeviceId:credential.meshDeviceId,
    walletId:wallet.walletId,
    eventCount:events.length,
    frontier,
  };
}

async function sync(){
  const contribution=await ensureRuntime();
  const result=await contribution.syncFromLocalMesh();
  emit('sync',result);
  return result;
}

async function exportBundle(){
  return (await ensureRuntime()).exportBundle();
}

async function importBundle(bundle,options={}){
  const contribution=await ensureRuntime();
  const result=await contribution.importBundle(bundle,options);
  emit('bundle-imported',{count:result.length});
  return result;
}

function subscribe(listener){
  listeners.add(listener);
  return()=>listeners.delete(listener);
}

async function boot(){
  if(!browserSupport()){
    const status={
      version:VERSION,
      ready:false,
      role:'phone-ledger-node',
      storage:'indexeddb',
      hostRequired:false,
      reason:'required browser storage or WebCrypto APIs are unavailable',
    };
    emit('unsupported',status);
    return status;
  }

  const status=await snapshot();
  emit('ready',status);
  return status;
}

const readyPromise=boot().catch((error)=>{
  const status={
    version:VERSION,
    ready:false,
    role:'phone-ledger-node',
    storage:'indexeddb',
    hostRequired:false,
    reason:String(error?.message||error),
  };
  emit('error',status);
  return status;
});

const api=Object.freeze({
  version:VERSION,
  role:'phone-ledger-node',
  storage:'indexeddb',
  hostRequired:false,
  transportPath:TRANSPORT_PATH,
  contributionPath:CONTRIBUTION_PATH,
  ready:()=>readyPromise,
  snapshot,
  sync,
  exportBundle,
  importBundle,
  subscribe,
});

globalThis.CivweavePhoneLedgerV1=api;

try{
  globalThis.addEventListener('online',()=>{
    sync().catch((error)=>emit('sync-error',{error:String(error?.message||error)}));
  });
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState!=='visible')return;
    sync().catch(()=>{});
  });
}catch{}

})();
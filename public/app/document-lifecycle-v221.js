(()=>{
'use strict';
const VERSION='document-lifecycle-v221';
if(globalThis.CommonweaveDocumentLifecycleV221?.version===VERSION)return;
let active=true;
const observers=new Set();
const initialHead=document.head||document.createElement('head');
const fallbackBody=document.createElement('body');
const currentHead=()=>document.documentElement?.querySelector?.('head')||initialHead;
const currentBody=()=>document.documentElement?.querySelector?.('body')||fallbackBody;
try{Object.defineProperty(document,'head',{configurable:true,get:currentHead})}catch{}
try{Object.defineProperty(document,'body',{configurable:true,get:currentBody})}catch{}
const NativeMutationObserver=globalThis.MutationObserver;
if(typeof NativeMutationObserver==='function'){
  globalThis.MutationObserver=class CommonweaveLifecycleMutationObserver extends NativeMutationObserver{
    constructor(callback){
      super((records,observer)=>{if(active&&document.documentElement?.isConnected)callback(records,observer)});
      observers.add(this);
    }
    disconnect(){observers.delete(this);return super.disconnect()}
  };
}
function stop(){
  if(!active)return;
  active=false;
  for(const observer of observers){try{observer.disconnect()}catch{}}
  observers.clear();
}
addEventListener('pagehide',stop,{once:true});
addEventListener('beforeunload',stop,{once:true});
globalThis.CommonweaveDocumentLifecycleV221=Object.freeze({
  version:VERSION,
  active:()=>active,
  head:currentHead,
  body:currentBody,
  stop
});
})();

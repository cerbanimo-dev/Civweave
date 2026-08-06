(()=>{
'use strict';
const VERSION='document-lifecycle-v222';
if(globalThis.CommonweaveDocumentLifecycleV221?.version===VERSION)return;
let active=true;
const observers=new Set();
const NativeMutationObserver=globalThis.MutationObserver;
if(typeof NativeMutationObserver==='function'){
  globalThis.MutationObserver=class CommonweaveLifecycleMutationObserver extends NativeMutationObserver{
    constructor(callback){
      super((records,observer)=>{
        if(active&&document.documentElement?.isConnected)callback(records,observer);
      });
      observers.add(this);
    }
    disconnect(){
      observers.delete(this);
      return super.disconnect();
    }
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
  head:()=>document.head,
  body:()=>document.body,
  stop
});
})();

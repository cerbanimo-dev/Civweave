(()=>{
'use strict';
const VERSION='1.0.26';
const BUILD='1.0.26-loop-diagnostics-hotfix-2';
const log=(kind,detail={})=>window.CivweaveBootLog?.log(kind,detail)||console.info('[CW-BOOT]',kind,detail);
const container=navigator.serviceWorker;
const originalAdd=container?.addEventListener;
let suppressed=0;
if(container&&originalAdd){
  container.addEventListener=function(type,listener,options){
    const source=typeof listener==='function'?Function.prototype.toString.call(listener):'';
    if(type==='controllerchange'&&/location\.reload\s*\(/.test(source)){
      suppressed+=1;
      log('controllerchange-reload-listener-suppressed',{build:BUILD,source:source.slice(0,300)});
      return;
    }
    return originalAdd.call(container,type,listener,options);
  };
}
const script=document.createElement('script');
script.src=`host-node-v126.js?v=${VERSION}&hotfix=2`;
script.async=false;
script.onload=()=>{
  if(container&&originalAdd)container.addEventListener=originalAdd;
  log('safe-runtime-loaded',{build:BUILD,suppressed});
};
script.onerror=()=>{
  if(container&&originalAdd)container.addEventListener=originalAdd;
  log('safe-runtime-load-failed',{build:BUILD});
  window.dispatchEvent(new ErrorEvent('error',{message:'The safe Civweave runtime loader failed.'}));
};
document.head.append(script);
})();

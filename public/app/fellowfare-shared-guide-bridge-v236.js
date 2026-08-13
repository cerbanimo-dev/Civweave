(()=>{
'use strict';

const VERSION='1.0.118-fellowfare-shared-guide-bridge-v236-bubble-only-v425';
if(globalThis.CivweaveFellowFareSharedGuideBridgeV236?.version===VERSION)return;

function bind(){
  document.documentElement.dataset.civweaveFellowfareGuideBridge='bubble-only';
  return true;
}

function render(){return false}
function rookRows(){return[]}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});
else bind();

globalThis.CivweaveFellowFareSharedGuideBridgeV236=Object.freeze({version:VERSION,mode:'bubble-only',bind,render,rookRows});
})();

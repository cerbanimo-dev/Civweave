(()=>{
'use strict';
const VERSION='fellowfare-native-host-v207';
if(globalThis.CivweaveFellowFareNativeHostV207?.version===VERSION)return;
const host=document.querySelector('#ffc144-workbench[data-fellowfare-native-host="v207"]');
if(!host)return;
document.body.classList.add('ff-market-native');
/* Compatibility only: the retained parent controller still speaks through
   contentWindow/postMessage. Point that channel at this document instead of
   creating a second browsing context. */
try{Object.defineProperty(host,'contentWindow',{configurable:true,value:window});Object.defineProperty(host,'contentDocument',{configurable:true,value:document})}catch{host.contentWindow=window;host.contentDocument=document}
globalThis.CivweaveFellowFareNativeHostV207=Object.freeze({version:VERSION,host,native:true,iframe:false});
})();

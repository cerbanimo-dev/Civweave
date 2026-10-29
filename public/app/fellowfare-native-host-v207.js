(()=>{
'use strict';
const VERSION='fellowfare-native-host-v207-direct-owner';
if(globalThis.CivweaveFellowFareNativeHostV207?.version===VERSION)return;
const host=document.querySelector('#ffc144-workbench[data-fellowfare-native-host="v207"]');
if(!host)return;
document.body.classList.add('ff-market-native');
globalThis.CivweaveFellowFareNativeHostV207=Object.freeze({version:VERSION,host,native:true,iframe:false});
})();

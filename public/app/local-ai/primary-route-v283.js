(()=>{
'use strict';
const VERSION='1.0.85-local-ai-primary-route-v283',ROUTE='downloaded-local';
const selection=()=>{try{return JSON.parse(localStorage.getItem('civweave.local-ai.selection.v266'))||{active:false,id:null}}catch{return{active:false,id:null}}};
const label=(value=selection())=>globalThis.CivweaveLocalModelRegistryV266?.byId?.(value.id)?.label||value.id||'';
const persistLocal=selected=>globalThis.CivweaveSettingsV320?.selectLocalModel?.(selected)||null;
const enhance=()=>false;
// Settings owns selection persistence. Model loading and Settings opening are inert.
globalThis.CivweaveLocalAIPrimaryRouteV283=Object.freeze({version:VERSION,route:ROUTE,selection,label,persistLocal,enhance,hardLocalOnly:true,compatibilityFacade:true,inputOwnership:false});
})();

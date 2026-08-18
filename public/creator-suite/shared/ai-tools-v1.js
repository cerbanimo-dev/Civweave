(()=>{
'use strict';
const adapters=new Map();
function registerEditor(kind,adapter){kind=String(kind||'').trim().toLowerCase();if(!kind||!adapter||typeof adapter!=='object')throw new Error('Creator editor adapter is required.');adapters.set(kind,adapter);return()=>adapters.delete(kind)}
function capabilities(){const out={};for(const[kind,adapter]of adapters)out[kind]=Array.isArray(adapter.actions)?adapter.actions.slice():[];return out}
async function execute(request={}){const kind=String(request.kind||request.mediaType||'').trim().toLowerCase(),action=String(request.action||'').trim(),adapter=adapters.get(kind);if(!adapter)throw new Error(`No Creator Suite adapter registered for ${kind||'unknown'}.`);if(!action||typeof adapter.execute!=='function')throw new Error('Creator Suite action is required.');const actor={kind:'civweave-ai',id:String(request.actorId||request.guideId||'civweave-ai'),provider:String(request.provider||''),model:String(request.model||''),requestId:String(request.requestId||'')};return adapter.execute(action,request.args||{},actor)}
globalThis.CivweaveCreatorToolsV1=Object.freeze({registerEditor,capabilities,execute});
try{dispatchEvent(new CustomEvent('civweave:creator-tools-ready',{detail:{version:'1.0.0'}}))}catch{}
})();

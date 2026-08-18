(()=>{
'use strict';
const VERSION='1.1.0';
const REQUEST_SCHEMA='civweave.creator-tool-request.v1';
const adapters=new Map();
const MAX_ARGS_BYTES=256*1024;
const clean=(value,max=240)=>String(value??'').trim().slice(0,max);
function jsonSize(value){try{return new TextEncoder().encode(JSON.stringify(value??{})).byteLength}catch{return Number.POSITIVE_INFINITY}}
function normalizeActions(actions){if(!Array.isArray(actions))return[];return actions.map(item=>typeof item==='string'?{name:clean(item,120)}:{name:clean(item?.name,120),description:clean(item?.description,400)}).filter(item=>item.name)}
function registerEditor(kind,adapter){
  kind=clean(kind,60).toLowerCase();
  if(!kind||!adapter||typeof adapter!=='object'||typeof adapter.execute!=='function')throw new Error('Creator editor adapter with execute() is required.');
  const actions=normalizeActions(adapter.actions);
  if(!actions.length)throw new Error('Creator editor adapter must declare at least one action.');
  adapters.set(kind,{...adapter,actions});
  return()=>adapters.delete(kind);
}
function capabilities(){
  const editors={};
  for(const[kind,adapter]of adapters)editors[kind]={actions:adapter.actions.map(item=>({...item}))};
  return{schema:'civweave.creator-tool-capabilities.v1',version:VERSION,editors};
}
function validateRequest(request={}){
  if(!request||typeof request!=='object'||Array.isArray(request))throw new Error('Creator Suite tool request must be an object.');
  if(request.schema&&request.schema!==REQUEST_SCHEMA)throw new Error(`Unsupported Creator Suite tool request schema: ${clean(request.schema,120)}`);
  const kind=clean(request.kind||request.mediaType,60).toLowerCase(),action=clean(request.action,120),actorId=clean(request.actorId||request.guideId,240),provider=clean(request.provider,120),model=clean(request.model,240),requestId=clean(request.requestId,180),args=request.args&&typeof request.args==='object'&&!Array.isArray(request.args)?request.args:{};
  if(!kind)throw new Error('Creator Suite tool request kind is required.');
  if(!action)throw new Error('Creator Suite tool request action is required.');
  if(!actorId)throw new Error('Creator Suite AI actorId/guideId is required.');
  if(!provider)throw new Error('Creator Suite AI provider metadata is required.');
  if(!model)throw new Error('Creator Suite AI model metadata is required.');
  if(!requestId)throw new Error('Creator Suite AI requestId is required.');
  const argsBytes=jsonSize(args);
  if(argsBytes>MAX_ARGS_BYTES)throw new Error(`Creator Suite tool args exceed ${MAX_ARGS_BYTES} bytes.`);
  return{schema:REQUEST_SCHEMA,kind,action,args,actor:{kind:'civweave-ai',id:actorId,provider,model,requestId},argsBytes};
}
async function execute(request={}){
  const normalized=validateRequest(request),adapter=adapters.get(normalized.kind);
  if(!adapter)throw new Error(`No Creator Suite adapter registered for ${normalized.kind}.`);
  const allowed=adapter.actions.some(item=>item.name===normalized.action);
  if(!allowed)throw new Error(`Unsupported ${normalized.kind} Creator Suite action: ${normalized.action}`);
  const result=await adapter.execute(normalized.action,normalized.args,normalized.actor);
  return{schema:'civweave.creator-tool-result.v1',kind:normalized.kind,action:normalized.action,actor:{...normalized.actor},result};
}
globalThis.CivweaveCreatorToolsV1=Object.freeze({version:VERSION,requestSchema:REQUEST_SCHEMA,maxArgsBytes:MAX_ARGS_BYTES,registerEditor,capabilities,validateRequest,execute});
try{dispatchEvent(new CustomEvent('civweave:creator-tools-ready',{detail:{version:VERSION,schema:REQUEST_SCHEMA}}))}catch{}
})();

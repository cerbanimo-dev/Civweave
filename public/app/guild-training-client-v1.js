(()=>{
'use strict';
if(globalThis.CivweaveGuildTrainingV1)return;
const ROUTE='/api/node/training',VERSION='1.0.0',MAX_BYTES=64*1024,scopes=new Map();
const object=value=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
const clean=(value,max=1200)=>String(value??'').trim().slice(0,max);
const id=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9:._-]{0,179}$/.test(value);
const recordId=value=>typeof value==='string'&&/^guild-training:[a-f0-9]{64}$/.test(value);
const positive=value=>Number.isSafeInteger(value)&&value>0;
const bad=(message='The host Guild returned an invalid training custody receipt.')=>{throw new Error(message)};
function fields(value,allowed,label){if(!object(value)||Object.keys(value).some(key=>!allowed.includes(key)))throw new TypeError(`${label} contains unsupported fields.`)}
function bounded(value,max,label,required=true){if(typeof value!=='string'||value.length>max||required&&!value.trim())throw new TypeError(`${label} must be bounded visible text.`);return value}
function requiredId(value,label){if(!id(value))throw new TypeError(`A valid ${label} is required.`);return value}
function preview(input){
  fields(input,['idempotencyKey','purposeId','purposeRevision','consent','sample'],'Contribution');
  if(new TextEncoder().encode(JSON.stringify(input)).byteLength>MAX_BYTES)throw new TypeError('Training contribution is too large.');
  requiredId(input.idempotencyKey,'idempotency key');requiredId(input.purposeId,'training purpose');if(!positive(input.purposeRevision))throw new TypeError('The exact purpose revision is required.');
  const consent=input.consent,sample=input.sample;
  fields(consent,['training','rights','rightsRef','policyRevision','visibleOnly','privateDataExcluded'],'Consent');
  if(consent.training!==true||consent.visibleOnly!==true||consent.privateDataExcluded!==true||!['owned','licensed','public-domain'].includes(consent.rights))throw new TypeError('Explicit training rights and reviewed visible-only content consent are required.');
  bounded(consent.rightsRef,500,'Rights reference');requiredId(consent.policyRevision,'consent policy revision');
  fields(sample,['instruction','input','output','editorPatches','toolReceiptRefs'],'Visible sample');
  bounded(sample.instruction,4000,'Instruction');bounded(sample.input,12000,'Input',false);bounded(sample.output,16000,'Visible output');
  if(!Array.isArray(sample.editorPatches)||sample.editorPatches.length>8||!Array.isArray(sample.toolReceiptRefs)||sample.toolReceiptRefs.length>32)throw new TypeError('Training sample history exceeds its bounds.');
  for(const patch of sample.editorPatches){fields(patch,['before','after','rationale'],'Editorial patch');bounded(patch.before,3000,'Before text',false);bounded(patch.after,3000,'After text',false);bounded(patch.rationale,1000,'Editorial rationale');if(!patch.before&&!patch.after)throw new TypeError('A patch must change visible text.')}
  for(const ref of sample.toolReceiptRefs)requiredId(ref,'tool receipt reference');if(new Set(sample.toolReceiptRefs).size!==sample.toolReceiptRefs.length)throw new TypeError('Tool receipt references must be unique.');
  return {idempotencyKey:input.idempotencyKey,purposeId:input.purposeId,purposeRevision:input.purposeRevision,consent:{training:true,rights:consent.rights,rightsRef:consent.rightsRef,policyRevision:consent.policyRevision,visibleOnly:true,privateDataExcluded:true},sample:{instruction:sample.instruction,input:sample.input,output:sample.output,editorPatches:sample.editorPatches.map(patch=>({before:patch.before,after:patch.after,rationale:patch.rationale})),toolReceiptRefs:[...sample.toolReceiptRefs]}};
}
function owner(){try{if(parent!==globalThis&&parent.location.origin===location.origin&&parent.CivweaveHostNodeSessionV1)return parent.CivweaveHostNodeSessionV1}catch{}return globalThis.CivweaveHostNodeSessionV1||null}
function sessionForGuild(guild){
  const nodeId=typeof guild==='string'?guild:guild?.id||guild?.nodeId,current=id(nodeId)?owner()?.sessionFor?.(nodeId):null;
  if(!current||current.nodeId!==nodeId||!id(current.userId)||typeof current.token!=='string'||!current.token)return null;
  if(current.expiresAt&&(!Number.isFinite(Date.parse(current.expiresAt))||Date.parse(current.expiresAt)<=Date.now()))return null;
  try{const url=new URL(current.origin);if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)return null;return current}catch{return null}
}
const keyFor=current=>`${current.origin}\n${current.nodeId}\n${current.userId}`;
function validRow(row,current,guildId,{summary=false}={}){
  if(row?.schema!=='civweave.guild-training-contribution.v1'||!recordId(row.id)||row.guildId!==guildId||!id(row.nodeId)||row.contributorUserId!==current.userId||!positive(row.revision)||!['quarantined','released','withdrawn'].includes(row.status)||!id(row.purpose?.id)||!positive(row.purpose?.revision)||!/^[a-f0-9]{64}$/.test(row.contentHash))return false;
  if(row.status==='withdrawn')return row.consent?.state==='withdrawn'&&row.sample===undefined&&row.release===undefined&&row.negotiation===undefined;
  if(row.consent?.state!=='granted'||row.consent.training!==true||row.consent.visibleOnly!==true||row.consent.privateDataExcluded!==true||!['owned','licensed','public-domain'].includes(row.consent.rights)||!id(row.consent.policyRevision))return false;
  if(summary&&row.sample!==undefined)return false;
  if(!summary){try{preview({idempotencyKey:'response-check',purposeId:row.purpose.id,purposeRevision:row.purpose.revision,consent:{training:row.consent.training,rights:row.consent.rights,rightsRef:row.consent.rightsRef,policyRevision:row.consent.policyRevision,visibleOnly:row.consent.visibleOnly,privateDataExcluded:row.consent.privateDataExcluded},sample:row.sample})}catch{return false}}
  return row.status!=='released'||id(row.release?.decisionRef)&&id(row.release?.authorizedBy)&&row.release?.purposeRevision===row.purpose.revision;
}
async function contentHash(input){const consent={state:'granted',...input.consent},purpose={id:input.purposeId,revision:input.purposeRevision},material=JSON.stringify({purpose,consent,sample:input.sample});return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(material)))].map(byte=>byte.toString(16).padStart(2,'0')).join('')}
async function request(guild,action,{input=null,id:contributionId,cursor='',limit=25}={}){
  const current=sessionForGuild(guild);if(!current)throw new Error('Log in to the selected host Guild to send or review training contributions.');
  if(globalThis.navigator?.onLine===false)throw new Error('Reconnect to deliver or withdraw training contributions. Local drafts remain on this device.');
  const scopeKey=keyFor(current),known=scopes.get(scopeKey),explicit=typeof guild==='object'?guild?.guildId:'';
  if(explicit&&!id(explicit))throw new TypeError('The selected Guild scope is invalid.');
  if(explicit&&known&&known!==explicit)bad('The selected host Guild scope changed. Refresh before continuing.');
  if(input&&!known)throw new Error('Refresh host Guild contributions before sending or withdrawing a sample.');
  const expectedGuild=explicit||known,path=action==='list'?ROUTE:action==='contribute'?`${ROUTE}/contribute`:`${ROUTE}/${encodeURIComponent(contributionId)}${action==='withdraw'?'/withdraw':''}`;
  const url=new URL(path,current.origin);url.searchParams.set('nodeId',current.nodeId);if(action==='list'){if(cursor&&!recordId(cursor))throw new TypeError('The contribution cursor is invalid.');if(!positive(limit)||limit>50)throw new TypeError('Page limit must be between 1 and 50.');url.searchParams.set('limit',String(limit));if(cursor)url.searchParams.set('cursor',cursor)}
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{
    const response=await fetch(url,{method:input?'POST':'GET',cache:'no-store',credentials:'omit',signal:controller.signal,headers:{accept:'application/json',authorization:`Bearer ${current.token}`,'x-civweave-node-id':current.nodeId,...(input?{'content-type':'application/json'}:{})},...(input?{body:JSON.stringify(input)}:{})});
    const packet=await response.json().catch(()=>({}));if(!response.ok||packet.ok!==true){const error=new Error(clean(packet.error)||`Host Guild returned HTTP ${response.status}.`);error.status=response.status;throw error}
    if(packet.nodeId!==current.nodeId||!id(packet.guildId)||expectedGuild&&packet.guildId!==expectedGuild||packet.trainingExecuted!==false||packet.settlementExecuted!==false)bad('The host Guild returned an invalid scope or execution claim.');
    if(action==='list'){
      if(packet.schema!=='civweave.guild-training-list.v1'||!Array.isArray(packet.contributions)||packet.contributions.length>limit||packet.contributions.some(row=>!validRow(row,current,packet.guildId,{summary:true}))||new Set(packet.contributions.map(row=>row.id)).size!==packet.contributions.length||packet.nextCursor!==null&&!recordId(packet.nextCursor))bad();
      scopes.set(scopeKey,packet.guildId);
    }else{
      if(!validRow(packet.contribution,current,packet.guildId)||packet.custodyAcknowledged!==true)bad();
      if(contributionId&&packet.contribution.id!==contributionId)bad('The host Guild returned a different contribution.');
      if(input&&typeof packet.idempotent!=='boolean')bad();
      if(action==='withdraw'&&packet.contribution.status!=='withdrawn')bad('The host Guild did not acknowledge withdrawal.');
      if(action==='contribute'&&(packet.contribution.purpose.id!==input.purposeId||packet.contribution.purpose.revision!==input.purposeRevision||packet.contribution.contentHash!==await contentHash(input)))bad('The host Guild acknowledged different content or training purpose.');
    }
    return packet;
  }catch(error){if(error.name==='AbortError')throw new Error('The host Guild did not respond. Delivery may be unknown; retry the same exact contribution key to check custody.');throw error}finally{clearTimeout(timer)}
}
function get(guild,value){if(!recordId(value))throw new TypeError('A valid contribution identifier is required.');return request(guild,'read',{id:value})}
function withdraw(guild,value,{expectedRevision}={}){const target=typeof value==='string'?value:value?.id,rev=expectedRevision??value?.revision;if(!recordId(target)||!positive(rev))throw new TypeError('The exact contribution and revision are required.');return request(guild,'withdraw',{id:target,input:{expectedRevision:rev}})}
globalThis.CivweaveGuildTrainingV1=Object.freeze({version:VERSION,route:ROUTE,preview,sessionForGuild,restoreSelected:()=>owner()?.ensureSelected?.()||Promise.resolve(null),list:(guild,options={})=>request(guild,'list',options),contribute:(guild,input)=>request(guild,'contribute',{input:preview(input)}),get,withdraw});
})();

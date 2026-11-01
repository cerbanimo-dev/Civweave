// Portable consent-scoped custody. Callers supply authenticated current members.
// Receipt creation never starts training, approves a purpose, or settles value.
export const GUILD_TRAINING_ROUTE = '/api/node/training';
export const GUILD_TRAINING_SCHEMA = 'civweave.guild-training-contribution.v1';
export const MAX_GUILD_TRAINING_BYTES = 64 * 1024;
export const GUILD_TRAINING_POLICY = Object.freeze({maxPerContributor:250,maxPerGuild:5000,maxPage:50,maxPatches:8,maxReceiptRefs:32});
export const GUILD_TRAINING_CORS = Object.freeze({'cache-control':'no-store','access-control-allow-origin':'*','access-control-allow-methods':'GET, POST, OPTIONS','access-control-allow-headers':'authorization, content-type, x-civweave-node-id','access-control-max-age':'86400'});
export const guildTrainingJson=(value,status=200)=>Response.json(value,{status,headers:GUILD_TRAINING_CORS});
export const guildTrainingError=error=>guildTrainingJson({ok:false,error:String(error?.message||error)},Number.isSafeInteger(error?.status)?error.status:500);
const enc=new TextEncoder();
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status})};
const object=value=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
const clone=value=>structuredClone(value);
function fields(value,allowed,label='Input') {
  if(!object(value))fail(`${label} must be an object.`);
  if(Object.keys(value).some(key=>!allowed.includes(key)))fail(`${label} contains an unsupported field.`);
}
function text(value,max,label,required=true) {
  if(typeof value!=='string'||value.length>max||(required&&!value.trim()))fail(`${label} must be ${required?'nonempty, ':''}bounded text.`);
  return value;
}
function identifier(value,label='Identifier',status=400) {
  if(typeof value!=='string'||!/^[A-Za-z0-9][A-Za-z0-9:._-]{0,179}$/.test(value))fail(`${label} is invalid.`,status);
  return value;
}
function recordId(value) { if(typeof value!=='string'||!/^guild-training:[a-f0-9]{64}$/.test(value))fail('Contribution identifier is invalid.');return value; }
function revision(value,label='expectedRevision') { if(!Number.isSafeInteger(value)||value<1)fail(`${label} must be a positive integer.`);return value; }
async function digest(value) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(value)))].map(byte=>byte.toString(16).padStart(2,'0')).join(''); }
function actor(member) {
  if(member?.isAI===true||['model','editor-agent','assistant','runtime'].includes(member?.kind))fail('An authenticated human contributor is required.',403);
  return {nodeId:identifier(member?.nodeId,'Authenticated host node',401),guildId:identifier(member?.guildId||member?.nodeId,'Authenticated Guild',401),userId:identifier(member?.userId,'Authenticated member',401)};
}
function purposeRef(value) { return {id:identifier(value.purposeId,'Training purpose'),revision:revision(value.purposeRevision,'purposeRevision')}; }
function boundedInput(value) { if(!object(value))fail('A JSON input object is required.');if(enc.encode(JSON.stringify(value)).byteLength>MAX_GUILD_TRAINING_BYTES)fail('Training contribution is too large.',413); }
function consent(value) {
  fields(value,['training','rights','rightsRef','policyRevision','visibleOnly','privateDataExcluded'],'Training consent');
  if(value.training!==true||value.visibleOnly!==true||value.privateDataExcluded!==true)fail('Explicit training, visible-only, and private-data-exclusion consent is required.');
  if(!['owned','licensed','public-domain'].includes(value.rights))fail('Declare applicable training rights.');
  return {state:'granted',training:true,rights:value.rights,rightsRef:text(value.rightsRef,500,'Rights reference'),policyRevision:identifier(value.policyRevision,'Consent policy revision'),visibleOnly:true,privateDataExcluded:true};
}
function sample(value) {
  fields(value,['instruction','input','output','editorPatches','toolReceiptRefs'],'Visible training sample');
  if(!Array.isArray(value.editorPatches)||value.editorPatches.length>GUILD_TRAINING_POLICY.maxPatches)fail('Supply at most eight visible editorial patches.');
  if(!Array.isArray(value.toolReceiptRefs)||value.toolReceiptRefs.length>GUILD_TRAINING_POLICY.maxReceiptRefs)fail('Supply at most 32 tool receipt references.');
  const patches=value.editorPatches.map(patch=>{
    fields(patch,['before','after','rationale'],'Editorial patch');
    const before=text(patch.before,3000,'Patch before text',false),after=text(patch.after,3000,'Patch after text',false);
    if(!before&&!after)fail('An editorial patch must change visible text.');
    return {before,after,rationale:text(patch.rationale,1000,'Editorial rationale')};
  });
  const refs=value.toolReceiptRefs.map(ref=>identifier(ref,'Tool receipt reference'));
  if(new Set(refs).size!==refs.length)fail('Tool receipt references must be unique.');
  return {instruction:text(value.instruction,4000,'Instruction'),input:text(value.input,12000,'Input',false),output:text(value.output,16000,'Visible output'),editorPatches:patches,toolReceiptRefs:refs};
}
export function projectGuildTrainingContribution(input) {
  boundedInput(input);fields(input,['idempotencyKey','purposeId','purposeRevision','consent','sample']);
  return {idempotencyKey:identifier(input.idempotencyKey,'Idempotency key'),purpose:purposeRef(input),consent:consent(input.consent),sample:sample(input.sample)};
}
function page(input,allowed=[]) {
  fields(input,['cursor','limit',...allowed]);
  const limit=input.limit==null?25:Number(input.limit);
  if(!Number.isSafeInteger(limit)||limit<1||limit>GUILD_TRAINING_POLICY.maxPage)fail('Page limit must be between 1 and 50.');
  const cursor=input.cursor==null||input.cursor===''?'':recordId(input.cursor);
  return {limit,cursor};
}
const summary=row=>{const value=clone(row);delete value.sample;return value};
function receipt(who,contribution,extra={}) { return {ok:true,nodeId:who.nodeId,guildId:who.guildId,contribution:clone(contribution),custodyAcknowledged:true,trainingExecuted:false,settlementExecuted:false,...extra}; }
function timestamp(options) {
  const value=options.now==null?Date.now():typeof options.now==='number'?options.now:Date.parse(options.now);
  if(!Number.isFinite(value))fail('Host time is unavailable.',503);return new Date(value).toISOString();
}
async function keeperPurpose(options,member,who,scope,action) {
  // These callbacks are server-owned policy readers, never browser arguments.
  if(typeof options.authorizeGuildkeeper!=='function'||await options.authorizeGuildkeeper({member:clone(member),guildId:who.guildId,purposeId:scope.id,purposeRevision:scope.revision,action})!==true)fail('Verified Guildkeeper authority is required.',403);
  if(typeof options.resolvePurpose!=='function')fail('An approved Guild-governed training purpose is required.',403);
  const purpose=await options.resolvePurpose({guildId:who.guildId,purposeId:scope.id,purposeRevision:scope.revision});
  if(!purpose||purpose.guildId!==who.guildId||purpose.purposeId!==scope.id||purpose.purposeRevision!==scope.revision||purpose.status!=='approved'||purpose.trainingAllowed!==true)fail('This exact training purpose is not approved for release.',403);
  return {decisionRef:identifier(purpose.decisionRef,'Trusted purpose decision',503)};
}
function terms(value) {
  fields(value,['mode','reference','summary'],'Negotiation intent');
  if(!['external-shared-payout','civweave-fulfillment-burn'].includes(value.mode))fail('Unsupported negotiation mode.');
  return {mode:value.mode,reference:identifier(value.reference,'External or canonical fulfillment reference'),summary:text(value.summary,1000,'Negotiation summary')};
}

/**
 * Trusted domain entry point. Upstream adapters MUST authenticate membership and
 * co-locate all starter nodes of a Guild. options.resolvePurpose and
 * options.authorizeGuildkeeper must read real governance/role authority. Missing
 * callbacks allow quarantined custody and owner withdrawal only.
 * Withdrawal erases payload here; already exported datasets/trained models need
 * separate downstream withdrawal enforcement and are never claimed erased here.
 */
export async function executeGuildTrainingAction(storage,member,action,input={},options={}) {
  const who=actor(member);boundedInput(input);
  if(!storage?.transaction)fail('Transactional Guild storage is required.',503);
  if(!['contribute','list','read','withdraw','release','dataset','propose-terms'].includes(action))fail('Unsupported training contribution action.',405);
  const at=timestamp(options),base=`guild-training:${who.guildId}:`,recordKey=id=>`${base}record:${id}`,ownerPrefix=`${base}owner:${who.userId}:`,releasedPrefix=scope=>`${base}released:${scope.id}:${scope.revision}:`;
  const prepared=action==='contribute'?projectGuildTrainingContribution(input):null;
  if(['read','withdraw','release','propose-terms'].includes(action))fields(input,['id',...(['withdraw','release','propose-terms'].includes(action)?['expectedRevision']:[]),...(action==='propose-terms'?['terms']:[])]);
  const pagination=['list','dataset'].includes(action)?page(input,action==='dataset'?['purposeId','purposeRevision']:[]):null;
  const scope=action==='dataset'?purposeRef(input):null;
  const payloadHash=prepared?await digest(JSON.stringify({purpose:prepared.purpose,consent:prepared.consent,sample:prepared.sample})):null;
  const deliveryKey=prepared?`${base}delivery:${await digest(`${who.userId}\n${prepared.idempotencyKey}`)}`:null;
  const id=prepared?`guild-training:${await digest(`${who.guildId}\n${who.userId}\n${prepared.idempotencyKey}\n${payloadHash}`)}`:['read','withdraw','release','propose-terms'].includes(action)?recordId(input.id):null;
  const nextTerms=action==='propose-terms'?terms(input.terms):null;
  return storage.transaction(async tx=>{
    if(action==='list'||action==='dataset') {
      if(action==='dataset')await keeperPurpose(options,member,who,scope,action);
      const prefix=action==='list'?ownerPrefix:releasedPrefix(scope),rows=[...await tx.list({prefix,...(pagination.cursor?{startAfter:prefix+pagination.cursor}:{}),limit:pagination.limit+1})];
      const visible=rows.slice(0,pagination.limit),records=await Promise.all(visible.map(([,row])=>tx.get(recordKey(row.id))));
      if(records.some(row=>!row||row.guildId!==who.guildId))fail('Contribution index needs host repair.',503);
      if(action==='list'&&records.some(row=>row.contributorUserId!==who.userId))fail('Contribution ownership index needs repair.',503);
      if(action==='dataset'&&records.some(row=>row.status!=='released'||row.consent?.state!=='granted'||row.purpose.id!==scope.id||row.purpose.revision!==scope.revision))fail('Released contribution index needs repair.',503);
      return {ok:true,schema:action==='list'?'civweave.guild-training-list.v1':'civweave.guild-training-dataset.v1',nodeId:who.nodeId,guildId:who.guildId,...(scope?{purpose:scope}:{}),contributions:records.map(row=>action==='list'?summary(row):{id:row.id,revision:row.revision,contentHash:row.contentHash,contributorUserId:row.contributorUserId,purpose:row.purpose,consent:row.consent,sample:row.sample}),nextCursor:rows.length>pagination.limit?records.at(-1)?.id||null:null,trainingExecuted:false,settlementExecuted:false};
    }
    if(action==='contribute') {
      const previous=await tx.get(deliveryKey);
      if(previous) {
        if(previous.contentHash!==payloadHash||previous.purposeId!==prepared.purpose.id||previous.purposeRevision!==prepared.purpose.revision)fail('This delivery key already belongs to different content, consent, or purpose. Use an explicit new contribution.',409);
        const prior=await tx.get(recordKey(previous.id));
        if(!prior||prior.contributorUserId!==who.userId)fail('Contribution delivery index needs host repair.',503);
        return receipt(who,prior,{created:false,idempotent:true});
      }
      const totalKey=`${base}count`,ownerCountKey=`${base}count:${who.userId}`,total=Number(await tx.get(totalKey)||0),ownerTotal=Number(await tx.get(ownerCountKey)||0);
      if(!Number.isSafeInteger(total)||total<0||!Number.isSafeInteger(ownerTotal)||ownerTotal<0)fail('Contribution retention state needs host repair.',503);
      if(total>=GUILD_TRAINING_POLICY.maxPerGuild||ownerTotal>=GUILD_TRAINING_POLICY.maxPerContributor)fail('This Guild training contribution allowance is full.',409);
      const contribution={schema:GUILD_TRAINING_SCHEMA,id,guildId:who.guildId,nodeId:who.nodeId,contributorUserId:who.userId,revision:1,status:'quarantined',purpose:prepared.purpose,contentHash:payloadHash,consent:prepared.consent,sample:prepared.sample,createdAt:at,updatedAt:at,release:null,negotiation:null};
      await tx.put(recordKey(id),contribution);await tx.put(ownerPrefix+id,{id});await tx.put(deliveryKey,{id,contentHash:payloadHash,purposeId:prepared.purpose.id,purposeRevision:prepared.purpose.revision});await tx.put(totalKey,total+1);await tx.put(ownerCountKey,ownerTotal+1);
      return receipt(who,contribution,{created:true,idempotent:false});
    }
    const prior=await tx.get(recordKey(id));
    if(!prior||prior.guildId!==who.guildId)fail('Training contribution was not found.',404);
    if(action==='read') { if(prior.contributorUserId!==who.userId)fail('Training contribution was not found.',404);return receipt(who,prior); }
    const expected=revision(input.expectedRevision);
    if(action==='withdraw') {
      if(prior.contributorUserId!==who.userId)fail('Only the contributor may withdraw this sample.',403);
      if(prior.status==='withdrawn'&&(expected===prior.revision||expected===prior.revision-1))return receipt(who,prior,{created:false,idempotent:true});
      if(expected!==prior.revision)fail('The contribution changed. Refresh before withdrawing.',409);
      const removed={schema:GUILD_TRAINING_SCHEMA,id:prior.id,guildId:prior.guildId,nodeId:prior.nodeId,contributorUserId:prior.contributorUserId,revision:prior.revision+1,status:'withdrawn',purpose:prior.purpose,contentHash:prior.contentHash,consent:{state:'withdrawn'},createdAt:prior.createdAt,updatedAt:at,withdrawnAt:at};
      await tx.put(recordKey(id),removed);await tx.delete(releasedPrefix(prior.purpose)+id);
      return receipt(who,removed,{created:false,idempotent:false});
    }
    if(prior.status==='withdrawn'||prior.consent?.state!=='granted')fail('Withdrawn consent cannot be released or negotiated.',409);
    const approved=await keeperPurpose(options,member,who,prior.purpose,action);
    if(action==='release'&&prior.status==='released'&&prior.release?.decisionRef===approved.decisionRef&&(expected===prior.revision||expected===prior.revision-1))return receipt(who,prior,{created:false,idempotent:true});
    if(action==='propose-terms'&&prior.negotiation?.proposedBy===who.userId&&JSON.stringify(prior.negotiation.terms)===JSON.stringify(nextTerms)&&(expected===prior.revision||expected===prior.revision-1))return receipt(who,prior,{created:false,idempotent:true});
    if(expected!==prior.revision)fail('The contribution changed. Refresh before continuing.',409);
    const updated={...prior,revision:prior.revision+1,updatedAt:at};
    if(action==='release') { updated.status='released';updated.release={decisionRef:approved.decisionRef,authorizedBy:who.userId,purposeRevision:prior.purpose.revision,releasedAt:at};await tx.put(releasedPrefix(prior.purpose)+id,{id}); }
    else updated.negotiation={status:'proposed',execution:'not-started',proposedBy:who.userId,proposedAt:at,decisionRef:approved.decisionRef,terms:nextTerms};
    await tx.put(recordKey(id),updated);return receipt(who,updated,{created:false,idempotent:false});
  });
}

export async function readGuildTrainingInput(request) {
  if(Number(request.headers.get('content-length'))>MAX_GUILD_TRAINING_BYTES)fail('Training contribution is too large.',413);
  if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))fail('A JSON request body is required.');
  const reader=request.body?.getReader();if(!reader)fail('A JSON request body is required.');const chunks=[];let size=0;
  try { while(true) { const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_GUILD_TRAINING_BYTES){await reader.cancel();fail('Training contribution is too large.',413)}chunks.push(value); } } finally {reader.releaseLock()}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
  try {const value=JSON.parse(new TextDecoder().decode(bytes));if(!object(value))fail('A JSON object is required.');return value}catch(error){if(error.status)throw error;fail('Valid JSON is required.')}
}
export function guildTrainingAction(request) {
  const url=new URL(request.url);if(url.pathname!==GUILD_TRAINING_ROUTE&&!url.pathname.startsWith(GUILD_TRAINING_ROUTE+'/'))fail('Training route is not supported.',405);
  const tail=url.pathname.slice(GUILD_TRAINING_ROUTE.length),pagination={cursor:url.searchParams.get('cursor')||'',limit:url.searchParams.get('limit')||25};
  if(!tail&&request.method==='GET')return {action:'list',input:pagination};
  if(tail==='/contribute'&&request.method==='POST')return {action:'contribute'};
  if(tail==='/dataset'&&request.method==='GET')return {action:'dataset',input:{...pagination,purposeId:url.searchParams.get('purposeId'),purposeRevision:Number(url.searchParams.get('purposeRevision'))}};
  const match=tail.match(/^\/([^/]+)(?:\/(withdraw|release|terms))?$/);
  if(match&&((!match[2]&&request.method==='GET')||(match[2]&&request.method==='POST'))) {
    let id;try{id=decodeURIComponent(match[1])}catch{fail('Contribution identifier is invalid.')}
    return {action:match[2]==='terms'?'propose-terms':match[2]||'read',input:{id:recordId(id)}};
  }
  fail('Training route or method is not supported.',405);
}
export async function guildTrainingInternalToken(env) {
  const secret=env.NODE_FABRIC_SESSION_SECRET||env.NODE_FABRIC_OPERATOR_TOKEN;
  if(typeof secret!=='string'||secret.length<24)fail('Guild training custody authority is unavailable.',503);
  return digest(`civweave.guild-training-internal.v1\0${secret}`);
}
async function authorizedInternal(request,env) {
  const actual=request.headers.get('x-civweave-internal-guild-training')||'',expected=await guildTrainingInternalToken(env);if(actual.length!==expected.length)return false;
  const [left,right]=await Promise.all([digest(actual),digest(expected)]);let difference=0;for(let n=0;n<left.length;n++)difference|=left.charCodeAt(n)^right.charCodeAt(n);return difference===0;
}
export async function handleGuildTrainingInternal(request,node,options={}) {
  try {
    if(!await authorizedInternal(request,node.env))fail('Guild training custody authorization is required.',403);
    if(request.method!=='POST')fail('Method not allowed.',405);
    const body=await readGuildTrainingInput(request),nodeId=request.headers.get('x-civweave-node-id');fields(body,['member','action','input']);
    if(!nodeId||body.member?.nodeId!==nodeId)fail('Guild training custody scope does not match.',403);
    const result=await executeGuildTrainingAction(node.state.storage,body.member,body.action,body.input,options);
    return guildTrainingJson(result,result.created?201:200);
  }catch(error){return guildTrainingError(error)}
}
export async function handleGuildTrainingRequest(request,env,authenticate,nodeStub) {
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:GUILD_TRAINING_CORS});
  try {
    const member=await authenticate(),route=guildTrainingAction(request),body=request.method==='POST'?await readGuildTrainingInput(request):{};
    const who=actor(member),{stub}=nodeStub(env,who.nodeId),token=await guildTrainingInternalToken(env);
    return stub.fetch(`https://node.internal/internal/guild-training?nodeId=${encodeURIComponent(who.nodeId)}`,{method:'POST',headers:{'content-type':'application/json','x-civweave-node-id':who.nodeId,'x-civweave-internal-guild-training':token},body:JSON.stringify({member:{...who,isAI:false},action:route.action,input:{...body,...route.input}})});
  }catch(error){return guildTrainingError(error)}
}

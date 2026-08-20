import baseWorker,{CivweaveGuildEdgeState,CivweaveGuildCapacityState as BaseGuildCapacityState,CivweaveGuildNodeState} from './index.mjs';

export {CivweaveGuildEdgeState,CivweaveGuildNodeState};
const RECEIPT_KIND='civweave.creation-receipt.v1';
const SESSION_SCHEMA='civweave.mobile-guild-capacity-session.v1';
const LOGIN_SCHEMA='civweave.host-node-login.v1';
const DAILY_INCLUDED_NEURONS=900;
const COMMUNITY_SEAT_LIMIT=6;
const SESSION_TTL_MS=30*24*60*60*1000;
const DEFAULT_AI_MODEL='@cf/zai-org/glm-4.7-flash';
const MAX_GENERATION_TOKENS=4096;
const WORKERS_INPUT_NEURONS_PER_MILLION=4119;
const WORKERS_OUTPUT_NEURONS_PER_MILLION=34868;
const enc=new TextEncoder();
const dec=new TextDecoder();
const clean=(value,max=12000)=>String(value??'').trim().slice(0,max);
const normalizeNodeId=value=>clean(value,120).toLowerCase().replace(/[^a-z0-9-]/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'');
const b64url=bytes=>{let binary='';for(const byte of new Uint8Array(bytes))binary+=String.fromCharCode(byte);return btoa(binary).replaceAll('+','-').replaceAll('/','_').replace(/=+$/g,'')};
const randomToken=(bytes=48)=>b64url(crypto.getRandomValues(new Uint8Array(bytes)));
const dayKey=(at=Date.now())=>new Date(at).toISOString().slice(0,10);
const nextReset=()=>{const value=new Date();value.setUTCHours(24,0,0,0);return value.toISOString()};
async function shaHex(value){const digest=await crypto.subtle.digest('SHA-256',enc.encode(String(value??'')));return[...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('')}
async function loginCredentialHash(value){const secret=clean(value,400);if(!/^[A-Za-z0-9_-]{40,200}$/.test(secret))throw Object.assign(new Error('A valid device login credential is required.'),{status:400});return shaHex(`civweave.host-login-credential.v1\n${secret}`)}
async function sessionTokenHash(value){const token=clean(value,20000);if(!/^[A-Za-z0-9_-]{40,300}$/.test(token))throw Object.assign(new Error('A valid Guild capacity session is required.'),{status:401});return shaHex(`${SESSION_SCHEMA}\n${token}`)}
function loginUserId(value){const userId=clean(value,180);if(!/^[A-Za-z0-9:_-]{12,180}$/.test(userId))throw Object.assign(new Error('A valid device resident id is required.'),{status:400});return userId}
function bearer(request){const value=clean(request.headers.get('authorization'),20000);return /^Bearer\s+/i.test(value)?value.replace(/^Bearer\s+/i,''):''}
const sessionCors=Object.freeze({'cache-control':'no-store','access-control-allow-origin':'*','access-control-allow-methods':'GET, POST, OPTIONS','access-control-allow-headers':'authorization, content-type, x-civweave-node-id','access-control-max-age':'86400'});
const json=(value,status=200)=>Response.json(value,{status,headers:sessionCors});
function errorResponse(error,fallback=500){return json({ok:false,error:String(error?.message||error)},Number.isSafeInteger(error?.status)?error.status:fallback)}
function receiptGuildId(object){if(object?.kind!==RECEIPT_KIND||object?.consent!=='group'||!Array.isArray(object.audience))return'';const audience=object.audience.find(value=>String(value).startsWith('guild:'));return normalizeNodeId(String(audience||'').slice(6))}
function nodeCloudOrigin(env,nodeId){const explicit=clean(env.CIVWEAVE_NODE_CLOUD_ORIGIN,2000);if(explicit){const value=explicit.includes('{nodeId}')?explicit.replaceAll('{nodeId}',encodeURIComponent(nodeId)):explicit;const url=new URL(value);if(url.protocol!=='https:')throw new Error('Creator provenance node-cloud origin must use HTTPS.');return url.origin}const domain=clean(env.CIVWEAVE_NODE_CLOUD_DOMAIN||'nodes.commonweave.earth',255).toLowerCase().replace(/^\.+|\.+$/g,'');if(!/^[a-z0-9.-]+$/.test(domain))throw new Error('Creator provenance node-cloud domain is invalid.');return`https://${nodeId}.${domain}`}
async function forwardReceipt(env,object){const nodeId=receiptGuildId(object);if(!nodeId)return{forwarded:false,reason:'not-guild-receipt'};const target=new URL('/api/node/creator-provenance/receipt',nodeCloudOrigin(env,nodeId));target.searchParams.set('nodeId',nodeId);const response=await fetch(target,{method:'POST',headers:{'content-type':'application/json','x-civweave-node-id':nodeId},body:JSON.stringify({object})});if(!response.ok){const body=await response.text().catch(()=>'');throw new Error(`Guild provenance receipt forward failed (${response.status})${body?`: ${body.slice(0,300)}`:''}`)}return{forwarded:true,nodeId}}

export class CivweaveGuildCapacityState extends BaseGuildCapacityState{
  ensureResidentTables(){
    this.sql.exec('CREATE TABLE IF NOT EXISTS resident_members (node_id TEXT NOT NULL, user_id TEXT NOT NULL, credential_hash TEXT NOT NULL, seat_class TEXT NOT NULL, created_at TEXT NOT NULL, last_seen_at TEXT NOT NULL, PRIMARY KEY(node_id,user_id))');
    this.sql.exec('CREATE INDEX IF NOT EXISTS resident_members_user_idx ON resident_members(user_id)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS resident_sessions (token_hash TEXT PRIMARY KEY, node_id TEXT NOT NULL, user_id TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL)');
    this.sql.exec('CREATE INDEX IF NOT EXISTS resident_sessions_user_idx ON resident_sessions(user_id)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS resident_usage (day TEXT NOT NULL, node_id TEXT NOT NULL, user_id TEXT NOT NULL, neurons INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(day,node_id,user_id))');
  }
  baseStatus(){return super.status()}
  resolveResidentNode(requested=''){
    const base=this.baseStatus(),nodes=Array.isArray(base.starterNodes)?base.starterNodes:[],wanted=normalizeNodeId(requested);
    if(!nodes.length)return'';
    if(!wanted||wanted===normalizeNodeId(base.guildId))return nodes[0].nodeId;
    return nodes.some(row=>row.nodeId===wanted)?wanted:'';
  }
  memberRow(nodeId,userId){return[...this.sql.exec('SELECT node_id,user_id,credential_hash,seat_class,created_at,last_seen_at FROM resident_members WHERE node_id=? AND user_id=? LIMIT 1',nodeId,userId)][0]||null}
  memberByUser(userId){return[...this.sql.exec('SELECT node_id,user_id,credential_hash,seat_class,created_at,last_seen_at FROM resident_members WHERE user_id=? ORDER BY created_at LIMIT 1',userId)][0]||null}
  quotaFor(nodeId,userId){
    this.ensureResidentTables();
    const used=Number([...this.sql.exec('SELECT neurons FROM resident_usage WHERE day=? AND node_id=? AND user_id=? LIMIT 1',dayKey(),nodeId,userId)][0]?.neurons||0),remaining=Math.max(0,DAILY_INCLUDED_NEURONS-used);
    return{usedNeuronsToday:used,includedDailyNeurons:DAILY_INCLUDED_NEURONS,includedUsedNeurons:used,includedRemainingNeurons:remaining,targetIncludedDailyNeurons:DAILY_INCLUDED_NEURONS,communityBonusNeurons:0,targetCommunityBonusNeurons:0,lifetimeRemainingNeurons:0,totalRemainingNeurons:remaining,debtNeurons:0,resetsAt:nextReset()};
  }
  status(){
    this.ensureResidentTables();
    const base=this.baseStatus(),memberCount=Number([...this.sql.exec('SELECT COUNT(DISTINCT user_id) AS count FROM resident_members')][0]?.count||0),communityMemberCount=memberCount,used=Number([...this.sql.exec('SELECT COALESCE(SUM(neurons),0) AS neurons FROM resident_usage WHERE day=?',dayKey())][0]?.neurons||0),free=Math.max(0,COMMUNITY_SEAT_LIMIT-communityMemberCount),dailyCeilingNeurons=memberCount*DAILY_INCLUDED_NEURONS;
    return{...base,capacityAvailable:true,workersPlan:'free',memberCount,communityMemberCount,nodeCommunityMembers:communityMemberCount,communitySeatLimit:COMMUNITY_SEAT_LIMIT,communitySeatsRemaining:free,paidExpansionSeatLimit:0,paidExpansionSeatsRemaining:0,maxMembers:COMMUNITY_SEAT_LIMIT,includedDailyNeurons:DAILY_INCLUDED_NEURONS,dailyCeilingNeurons,dailyUsedNeurons:used,dailyRemainingNeurons:Math.max(0,dailyCeilingNeurons-used),slots:{free,paid:0},residentSessionSchema:SESSION_SCHEMA};
  }
  async joinResident({requestedNodeId,userId,credentialHash,origin}={}){
    this.ensureResidentTables();
    let nodeId=this.resolveResidentNode(requestedNodeId);if(!nodeId)return{ok:false,status:404,error:'Guild starter node not found.'};
    const existingAny=this.memberByUser(userId);let idempotent=false;
    if(existingAny){if(existingAny.credential_hash!==credentialHash)return{ok:false,status:403,error:'This Guild login belongs to a different device credential.'};nodeId=existingAny.node_id;idempotent=true}
    else{
      const members=Number([...this.sql.exec('SELECT COUNT(DISTINCT user_id) AS count FROM resident_members')][0]?.count||0);if(members>=COMMUNITY_SEAT_LIMIT)return{ok:false,status:409,error:'This Guild has no Citizen slots available right now.'};const stamp=new Date().toISOString();this.sql.exec('INSERT INTO resident_members (node_id,user_id,credential_hash,seat_class,created_at,last_seen_at) VALUES (?,?,?,?,?,?)',nodeId,userId,credentialHash,'community',stamp,stamp)
    }
    const stamp=new Date().toISOString(),expiresAt=new Date(Date.now()+SESSION_TTL_MS).toISOString(),token=randomToken();this.sql.exec('UPDATE resident_members SET last_seen_at=? WHERE node_id=? AND user_id=?',stamp,nodeId,userId);this.sql.exec('DELETE FROM resident_sessions WHERE expires_at<=?',stamp);this.sql.exec('INSERT OR REPLACE INTO resident_sessions (token_hash,node_id,user_id,created_at,expires_at) VALUES (?,?,?,?,?)',await sessionTokenHash(token),nodeId,userId,stamp,expiresAt);
    return{ok:true,idempotent,nodeId,userId,seatClass:'community',token,origin:clean(origin,2000),expiresAt,member:{nodeId,userId,seatClass:'community',billingStatus:'free',createdAt:existingAny?.created_at||stamp,lastSeenAt:stamp},quota:this.quotaFor(nodeId,userId),capacity:this.status()};
  }
  sessionForHash({tokenHash,requestedNodeId}={}){
    this.ensureResidentTables();const stamp=new Date().toISOString();this.sql.exec('DELETE FROM resident_sessions WHERE expires_at<=?',stamp);const row=[...this.sql.exec('SELECT token_hash,node_id,user_id,created_at,expires_at FROM resident_sessions WHERE token_hash=? LIMIT 1',tokenHash)][0];if(!row)return{ok:false,status:401,error:'Guild capacity session is invalid or expired.'};const expected=this.resolveResidentNode(requestedNodeId);if(expected&&row.node_id!==expected)return{ok:false,status:403,error:'Guild capacity session belongs to a different starter node.'};const member=this.memberRow(row.node_id,row.user_id);if(!member)return{ok:false,status:401,error:'Guild resident no longer exists.'};return{ok:true,nodeId:row.node_id,userId:row.user_id,seatClass:member.seat_class,expiresAt:row.expires_at,member:{nodeId:row.node_id,userId:row.user_id,seatClass:member.seat_class,billingStatus:'free',createdAt:member.created_at,lastSeenAt:member.last_seen_at},quota:this.quotaFor(row.node_id,row.user_id),capacity:this.status()}
  }
  chargeUsage({tokenHash,requestedNodeId,chargedNeurons=0}={}){
    const session=this.sessionForHash({tokenHash,requestedNodeId});if(!session.ok)return session;const requested=Math.max(0,Math.floor(Number(chargedNeurons)||0)),remaining=Number(session.quota?.includedRemainingNeurons||0),charged=Math.min(requested,remaining);if(charged>0)this.sql.exec('INSERT INTO resident_usage (day,node_id,user_id,neurons) VALUES (?,?,?,?) ON CONFLICT(day,node_id,user_id) DO UPDATE SET neurons=neurons+excluded.neurons',dayKey(),session.nodeId,session.userId,charged);return{...session,chargedNeurons:charged,quota:this.quotaFor(session.nodeId,session.userId),capacity:this.status()}
  }
}

function capacityStub(env){return env.CAPACITY.get(env.CAPACITY.idFromName('guild'))}
function requestedNodeId(request){const url=new URL(request.url),pathMatch=url.pathname.match(/^\/nodes\/([^/]+)\/api\/ai\/node\/generate$/);return normalizeNodeId(pathMatch?.[1]||url.searchParams.get('nodeId')||request.headers.get('x-civweave-node-id'))}
function isGeneratePath(pathname){return pathname==='/api/ai/node/generate'||/^\/nodes\/[^/]+\/api\/ai\/node\/generate$/.test(pathname)}
function isSessionPath(pathname){return pathname==='/api/ai/node/session'}
function aiMessages(input={}){const rows=(Array.isArray(input.messages)?input.messages:[]).slice(-64).map(item=>({role:item?.role==='assistant'?'assistant':item?.role==='system'?'system':'user',content:clean(item?.content,48000)})).filter(item=>item.content);if(clean(input.system,48000)&&!rows.some(item=>item.role==='system'))rows.unshift({role:'system',content:clean(input.system,48000)});if(!rows.length&&clean(input.prompt,48000))rows.push({role:'user',content:clean(input.prompt,48000)});if(!rows.length)rows.push({role:'user',content:'Continue.'});return rows}
function aiOptions(input={}){const options={messages:aiMessages(input),stream:false,max_tokens:Math.max(32,Math.min(MAX_GENERATION_TOKENS,Number(input.max_tokens??input.maxTokens??1024)||1024)),temperature:Math.max(0,Math.min(2,Number(input.temperature??0.2)))};if(input.responseFormat==='json')options.response_format={type:'json_object'};if(input.responseSchema&&typeof input.responseSchema==='object')options.response_format={type:'json_schema',json_schema:input.responseSchema};return options}
function resultText(result){if(typeof result==='string')return result;if(typeof result?.response==='string')return result.response;if(typeof result?.text==='string')return result.text;if(typeof result?.result?.response==='string')return result.result.response;if(result?.response&&typeof result.response==='object')return JSON.stringify(result.response);try{return JSON.stringify(result??{})}catch{return String(result??'')}}
function resultObject(result){for(const value of [result?.response,result?.result?.response,result?.output,result?.outputJson])if(value&&typeof value==='object'&&!Array.isArray(value))return value;return null}
function usageTokens(result,input,outputText){const usage=result?.usage||result?.usageMetadata||{},inputTokens=Number(usage.prompt_tokens??usage.input_tokens??usage.promptTokenCount),outputTokens=Number(usage.completion_tokens??usage.output_tokens??usage.candidatesTokenCount);return{inputTokens:Number.isFinite(inputTokens)&&inputTokens>=0?inputTokens:Math.max(1,Math.ceil(JSON.stringify(input).length/4)),outputTokens:Number.isFinite(outputTokens)&&outputTokens>=0?outputTokens:Math.max(1,Math.ceil(clean(outputText,5000000).length/4))}}
function neuronCharge(tokens){return Math.max(1,Math.ceil((tokens.inputTokens*WORKERS_INPUT_NEURONS_PER_MILLION+tokens.outputTokens*WORKERS_OUTPUT_NEURONS_PER_MILLION)/1_000_000))}
async function handleSession(request,env){
  try{const input=request.method==='POST'?await request.json().catch(()=>({})):null,nodeId=requestedNodeId(request),origin=new URL(request.url).origin,stub=capacityStub(env);if(request.method==='POST'){const packet=await stub.joinResident({requestedNodeId:nodeId,userId:loginUserId(input?.userId),credentialHash:await loginCredentialHash(input?.credential),origin});if(!packet?.ok)return json({ok:false,error:packet?.error||'Guild login failed.'},packet?.status||500);return json({ok:true,schema:LOGIN_SCHEMA,nodeId:packet.nodeId,userId:packet.userId,member:packet.member,capacity:packet.capacity,quota:packet.quota,idempotent:packet.idempotent,capacitySession:{schema:SESSION_SCHEMA,token:packet.token,nodeId:packet.nodeId,userId:packet.userId,seatClass:packet.seatClass,origin:packet.origin,expiresAt:packet.expiresAt}},packet.idempotent?200:201)}if(request.method==='GET'){const packet=await stub.sessionForHash({tokenHash:await sessionTokenHash(bearer(request)),requestedNodeId:nodeId});if(!packet?.ok)return json({ok:false,error:packet?.error||'Guild session is invalid.'},packet?.status||401);return json({ok:true,schema:'civweave.host-node-login-status.v1',nodeId:packet.nodeId,userId:packet.userId,member:packet.member,capacity:packet.capacity,quota:packet.quota})}return json({ok:false,error:'Method not allowed.'},405)}catch(error){return errorResponse(error)}
}
async function handleSessionGenerate(request,env){
  const nodeId=requestedNodeId(request),token=bearer(request);let tokenHash;try{tokenHash=await sessionTokenHash(token)}catch{return null}const stub=capacityStub(env),session=await stub.sessionForHash({tokenHash,requestedNodeId:nodeId});if(!session?.ok)return null;if(Number(session.quota?.includedRemainingNeurons||0)<1)return json({ok:false,error:'This Guild resident has no included neurons remaining today.',code:'COMPUTE_PAYMENT_REQUIRED',quota:session.quota},402);if(!env.AI||typeof env.AI.run!=='function')return json({ok:false,error:'Workers AI is not available on this Guild Cloud deployment.'},503);
  try{const input=await request.json().catch(()=>({})),model=clean(input.model||env.CIVWEAVE_DEFAULT_AI_MODEL||DEFAULT_AI_MODEL,220);if(!/^@(cf|hf)\//i.test(model))throw Object.assign(new Error('Choose a valid Workers AI model for this Guild request.'),{status:400});const result=await env.AI.run(model,aiOptions(input)),text=resultText(result),outputJson=resultObject(result),tokens=usageTokens(result,input,text),chargedNeurons=neuronCharge(tokens),charged=await stub.chargeUsage({tokenHash,requestedNodeId:nodeId,chargedNeurons});if(!charged?.ok)return json({ok:false,error:charged?.error||'Guild neuron settlement failed.'},charged?.status||500);return json({ok:true,schema:'civweave.mobile-guild-cloud-generation.v1',nodeId:charged.nodeId,userId:charged.userId,model,text,outputJson,result,usage:{...(result?.usage||{}),inputTokens:tokens.inputTokens,outputTokens:tokens.outputTokens,totalTokens:tokens.inputTokens+tokens.outputTokens,chargedNeurons:charged.chargedNeurons},quota:charged.quota,capacity:charged.capacity})}catch(error){return errorResponse(error,502)}
}

export default{
  async fetch(request,env,ctx){
    const url=new URL(request.url);if(request.method==='OPTIONS'&&(isSessionPath(url.pathname)||isGeneratePath(url.pathname)))return new Response(null,{status:204,headers:sessionCors});
    if(isSessionPath(url.pathname))return handleSession(request,env);
    if(isGeneratePath(url.pathname)){const sessionResponse=await handleSessionGenerate(request.clone(),env);if(sessionResponse)return sessionResponse}
    let receipt=null;if(request.method==='POST'&&url.pathname==='/api/envelopes'){const input=await request.clone().json().catch(()=>null);if(input?.schema==='civweave.community-object-envelope.v1'&&input?.payload?.kind===RECEIPT_KIND)receipt=input.payload}
    const response=await baseWorker.fetch(request,env,ctx);if(receipt&&response.ok){const work=forwardReceipt(env,receipt).catch(error=>console.error('[Civweave] Creator provenance receipt forwarding failed',error));if(ctx?.waitUntil)ctx.waitUntil(work);else work.catch(()=>{})}return response
  }
};
export{forwardReceipt,nodeCloudOrigin,receiptGuildId};

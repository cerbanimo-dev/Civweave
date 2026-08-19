import {DurableObject} from 'cloudflare:workers';

const WORKER_VERSION='1.2.0-guild-location-parity';
const OBJECT_SCHEMA='civweave.community-object.v1';
const ENVELOPE_SCHEMA='civweave.community-object-envelope.v1';
const FABRIC_SCHEMA='civweave.guild-cloud-fabric.v1';
const NODE_MANIFEST_SCHEMA='civweave.guild-cloud-node-manifest.v1';
const encoder=new TextEncoder();
const MAX_ENVELOPE_BYTES=2*1024*1024;
const MAX_STORED_ENVELOPES=2000;
const MAX_AI_REQUEST_BYTES=128*1024;
const STARTER_NODE_COUNT=3;
const clean=(value,max=4000)=>String(value??'').trim().slice(0,max);
const now=()=>new Date().toISOString();
const normalized=value=>{if(Array.isArray(value))return value.map(normalized);if(value&&typeof value==='object'){const out={};for(const key of Object.keys(value).sort())if(value[key]!==undefined)out[key]=normalized(value[key]);return out}return value};
const canonical=value=>JSON.stringify(normalized(value));
const b64url=bytes=>{let binary='';for(const byte of new Uint8Array(bytes))binary+=String.fromCharCode(byte);return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')};
const unb64=value=>{const raw=String(value||'').replace(/-/g,'+').replace(/_/g,'/'),padded=raw+'='.repeat((4-raw.length%4)%4),binary=atob(padded);return Uint8Array.from(binary,char=>char.charCodeAt(0))};
const sha256=async value=>b64url(await crypto.subtle.digest('SHA-256',typeof value==='string'?encoder.encode(value):value));
const membershipHash=value=>sha256(`civweave.guild-edge.membership.v1\n${String(value||'')}`);
const validSecret=value=>/^[A-Za-z0-9_-]{40,200}$/.test(String(value||''));
const normalizeGuildId=value=>clean(value,120).toLowerCase().replace(/[^a-z0-9-]/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'');
const starterNodeIds=guildId=>['a','b','c'].map(suffix=>`${normalizeGuildId(guildId)}-${suffix}`);
function constantTimeEqual(left,right){const a=String(left||''),b=String(right||'');if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0}
function normalizeHubLocation(input={},options={}){
  const latitude=Number(input.latitude),longitude=Number(input.longitude),accuracyMeters=Number(input.accuracyMeters??input.precisionMeters),capturedMs=Date.parse(clean(input.capturedAt,80));
  const requested=clean(input.publicPrecision,20).toLowerCase(),precise=requested==='precise'||(!requested&&Number(input.coordinateDecimals)>=5),coordinateDecimals=precise?6:3;
  if(requested&&!['rounded','precise'].includes(requested))throw Object.assign(new Error('Guild public precision must be rounded or precise.'),{status:400});
  if(!Number.isFinite(latitude)||latitude<-90||latitude>90)throw Object.assign(new Error('Guild latitude is invalid.'),{status:400});
  if(!Number.isFinite(longitude)||longitude<-180||longitude>180)throw Object.assign(new Error('Guild longitude is invalid.'),{status:400});
  if(!Number.isFinite(accuracyMeters)||accuracyMeters<=0||accuracyMeters>5000)throw Object.assign(new Error('Guild location accuracy must be between 1 and 5,000 meters.'),{status:400});
  if(precise&&accuracyMeters>250)throw Object.assign(new Error('A precise public Guild pin requires a location reading within 250 meters.'),{status:400});
  if(options.requireFresh!==false&&(!Number.isFinite(capturedMs)||Math.abs(Date.now()-capturedMs)>10*60*1000))throw Object.assign(new Error('Guild location reading is stale.'),{status:400});
  return Object.freeze({schema:'civweave.hub-location.v1',latitude:Number(latitude.toFixed(coordinateDecimals)),longitude:Number(longitude.toFixed(coordinateDecimals)),precisionMeters:precise?Math.max(1,Math.ceil(accuracyMeters)):Math.max(100,Math.ceil(accuracyMeters/100)*100),coordinateDecimals,source:'guildkeeper-browser-geolocation',capturedAt:Number.isFinite(capturedMs)?new Date(capturedMs).toISOString():now(),syncedAt:now()});
}
function signableObject(object){return{schema:object.schema,id:object.id,revision:object.revision,kind:object.kind,purpose:object.purpose,audience:object.audience,consent:object.consent,payload:object.payload,payloadHash:object.payloadHash,parentIds:object.parentIds,createdAt:object.createdAt,updatedAt:object.updatedAt,expiresAt:object.expiresAt,origin:object.origin,hopLimit:object.hopLimit}}
async function verifyObject(object,guildId){
  if(object?.schema!==OBJECT_SCHEMA||!object.id||!object.revisionHash||!object.signature)throw Object.assign(new Error('Invalid community object envelope.'),{status:400});
  if(!object.origin?.credential||!object.origin?.nodeId)throw Object.assign(new Error('Community object origin is missing.'),{status:400});
  if(await sha256(canonical(object.payload))!==object.payloadHash)throw Object.assign(new Error('Community object payload hash mismatch.'),{status:400});
  if(await sha256(canonical(signableObject(object)))!==object.revisionHash)throw Object.assign(new Error('Community object revision hash mismatch.'),{status:400});
  const fingerprint=(await sha256(canonical(object.origin.credential))).slice(0,24);
  if(object.origin.nodeId!==`device:${fingerprint}`)throw Object.assign(new Error('Community object origin identity mismatch.'),{status:403});
  if(object.origin.fingerprint&&object.origin.fingerprint!==fingerprint)throw Object.assign(new Error('Community object origin fingerprint mismatch.'),{status:403});
  let key;try{key=await crypto.subtle.importKey('jwk',object.origin.credential,{name:'ECDSA',namedCurve:'P-256'},false,['verify'])}catch{throw Object.assign(new Error('Community object signing key is invalid.'),{status:400})}
  const verified=await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},key,unb64(object.signature),encoder.encode(canonical(signableObject(object)))).catch(()=>false);
  if(!verified)throw Object.assign(new Error('Community object signature was rejected.'),{status:403});
  if(object.expiresAt&&Date.parse(object.expiresAt)<=Date.now())throw Object.assign(new Error('Community object has expired.'),{status:410});
  const guildAudience=`guild:${guildId}`;
  if(!['public','federated'].includes(object.consent)&&!(object.consent==='group'&&Array.isArray(object.audience)&&object.audience.includes(guildAudience)))throw Object.assign(new Error('This public edge accepts only public/federated objects or group objects addressed to its Guild.'),{status:403});
  return true;
}

const corsHeaders={'access-control-allow-origin':'*','access-control-allow-methods':'GET, POST, OPTIONS','access-control-allow-headers':'authorization, content-type','access-control-max-age':'86400','cache-control':'no-store'};
const json=(payload,status=200)=>Response.json(payload,{status,headers:corsHeaders});
const textError=(error,fallback=500)=>json({ok:false,error:String(error?.message||error)},Number.isSafeInteger(error?.status)?error.status:fallback);
function bearer(request){const match=String(request.headers.get('authorization')||'').match(/^Bearer\s+(.+)$/i);return match?.[1]?.trim()||''}
function stateStub(env){return env.GUILD_STATE.get(env.GUILD_STATE.idFromName('guild'))}
function capacityStub(env){return env.CAPACITY.get(env.CAPACITY.idFromName('guild'))}
function nodeStub(env,nodeId){return env.NODES.get(env.NODES.idFromName(nodeId))}

export class CivweaveGuildEdgeState extends DurableObject{
  constructor(ctx,env){super(ctx,env);this.sql=ctx.storage.sql;this.sql.exec('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)');this.sql.exec('CREATE TABLE IF NOT EXISTS envelopes (seq INTEGER PRIMARY KEY AUTOINCREMENT, revision_hash TEXT NOT NULL UNIQUE, envelope_json TEXT NOT NULL, stored_at INTEGER NOT NULL)')}
  meta(key){const row=[...this.sql.exec('SELECT value FROM meta WHERE key = ?',key)][0];return row?JSON.parse(row.value):null}
  putMeta(key,value){this.sql.exec('INSERT OR REPLACE INTO meta (key,value) VALUES (?,?)',key,JSON.stringify(value))}
  status(){return{ok:true,claimed:Boolean(this.meta('guildId')),guildId:this.meta('guildId'),displayName:this.meta('displayName'),foundingDeviceId:this.meta('foundingDeviceId'),location:this.meta('location'),claimedAt:this.meta('claimedAt'),updatedAt:this.meta('updatedAt'),storedEnvelopes:Number([...this.sql.exec('SELECT COUNT(*) AS count FROM envelopes')][0]?.count||0)}}
  claim({guildId,displayName,foundingDeviceId,membershipKeyHash,location}={}){const existingGuild=this.meta('guildId'),existingDevice=this.meta('foundingDeviceId'),existingHash=this.meta('membershipKeyHash');if(existingGuild){if(existingGuild!==guildId||existingDevice!==foundingDeviceId||existingHash!==membershipKeyHash)return{ok:false,status:409,error:'This Cloudflare Guild is already claimed by a different Guild or founding device.'};if(location&&!this.meta('location')){this.putMeta('location',location);this.putMeta('updatedAt',location.syncedAt||now())}return{...this.status(),idempotent:true}}const claimedAt=now();this.putMeta('guildId',guildId);this.putMeta('displayName',displayName);this.putMeta('foundingDeviceId',foundingDeviceId);this.putMeta('membershipKeyHash',membershipKeyHash);this.putMeta('location',location);this.putMeta('claimedAt',claimedAt);this.putMeta('updatedAt',location?.syncedAt||claimedAt);return{...this.status(),idempotent:false}}
  setLocation(location){if(!this.meta('guildId'))throw Object.assign(new Error('This public edge has not been paired to a Guild yet.'),{status:409});this.putMeta('location',location);this.putMeta('updatedAt',location.syncedAt||now());return this.status()}
  authorized(membershipKeyHash){const expected=this.meta('membershipKeyHash');return Boolean(expected&&constantTimeEqual(expected,membershipKeyHash))}
  putEnvelope(envelope){const revisionHash=clean(envelope?.payload?.revisionHash,300);if(!revisionHash)return{ok:false,status:400,error:'Envelope revision hash is required.'};this.sql.exec('INSERT OR IGNORE INTO envelopes (revision_hash,envelope_json,stored_at) VALUES (?,?,?)',revisionHash,JSON.stringify(envelope),Date.now());this.sql.exec(`DELETE FROM envelopes WHERE seq NOT IN (SELECT seq FROM envelopes ORDER BY seq DESC LIMIT ${MAX_STORED_ENVELOPES})`);return{ok:true,revisionHash}}
  listEnvelopes(limit=200){const take=Math.max(1,Math.min(200,Number(limit)||200));const rows=[...this.sql.exec(`SELECT envelope_json FROM envelopes ORDER BY seq DESC LIMIT ${take}`)].reverse();return rows.map(row=>JSON.parse(row.envelope_json))}
}

export class CivweaveGuildCapacityState extends DurableObject{
  constructor(ctx,env){super(ctx,env);this.sql=ctx.storage.sql;this.sql.exec('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)');this.sql.exec('CREATE TABLE IF NOT EXISTS nodes (node_id TEXT PRIMARY KEY, public_origin TEXT NOT NULL, runtime TEXT NOT NULL, created_at TEXT NOT NULL)')}
  meta(key){const row=[...this.sql.exec('SELECT value FROM meta WHERE key = ?',key)][0];return row?JSON.parse(row.value):null}
  putMeta(key,value){this.sql.exec('INSERT OR REPLACE INTO meta (key,value) VALUES (?,?)',key,JSON.stringify(value))}
  status(){const nodes=[...this.sql.exec('SELECT node_id, public_origin, runtime, created_at FROM nodes ORDER BY node_id')].map(row=>({nodeId:row.node_id,publicOrigin:row.public_origin,runtime:row.runtime,createdAt:row.created_at}));return{ok:true,schema:FABRIC_SCHEMA,status:this.meta('guildId')&&nodes.length===STARTER_NODE_COUNT?'ready':'pending',guildId:this.meta('guildId'),displayName:this.meta('displayName'),starterNodeCount:nodes.length,requiredStarterNodes:STARTER_NODE_COUNT,starterNodes:nodes,createdAt:this.meta('createdAt'),updatedAt:this.meta('updatedAt')}}
  bootstrap({guildId,displayName,origin}={}){const normalizedId=normalizeGuildId(guildId),existing=this.meta('guildId');if(!normalizedId)throw Object.assign(new Error('A valid Guild ID is required to create its Cloudflare fabric.'),{status:400});if(existing&&existing!==normalizedId)throw Object.assign(new Error('This Cloudflare fabric already belongs to another Guild.'),{status:409});const createdAt=this.meta('createdAt')||now(),updatedAt=now();this.putMeta('guildId',normalizedId);this.putMeta('displayName',clean(displayName,120));this.putMeta('createdAt',createdAt);this.putMeta('updatedAt',updatedAt);for(const nodeId of starterNodeIds(normalizedId)){const publicOrigin=`${String(origin||'').replace(/\/+$/,'')}/nodes/${nodeId}`;this.sql.exec('INSERT OR REPLACE INTO nodes (node_id,public_origin,runtime,created_at) VALUES (?,?,?,?)',nodeId,publicOrigin,'cloudflare-workers-ai',createdAt)}return this.status()}
}

export class CivweaveGuildNodeState extends DurableObject{
  constructor(ctx,env){super(ctx,env);this.sql=ctx.storage.sql;this.sql.exec('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)')}
  meta(key){const row=[...this.sql.exec('SELECT value FROM meta WHERE key = ?',key)][0];return row?JSON.parse(row.value):null}
  putMeta(key,value){this.sql.exec('INSERT OR REPLACE INTO meta (key,value) VALUES (?,?)',key,JSON.stringify(value))}
  configure({guildId,nodeId,displayName,publicOrigin,location}={}){const existingNode=this.meta('nodeId'),existingGuild=this.meta('guildId');if(existingNode&&(existingNode!==nodeId||existingGuild!==guildId))throw Object.assign(new Error('This Cloudflare node is already bound to another Guild node.'),{status:409});const createdAt=this.meta('createdAt')||now();this.putMeta('guildId',guildId);this.putMeta('nodeId',nodeId);this.putMeta('displayName',displayName);this.putMeta('publicOrigin',publicOrigin);if(location)this.putMeta('location',location);this.putMeta('createdAt',createdAt);this.putMeta('updatedAt',location?.syncedAt||now());return this.manifest()}
  setLocation(location){if(!this.meta('nodeId'))throw Object.assign(new Error('This Cloudflare node is not configured.'),{status:409});this.putMeta('location',location);this.putMeta('updatedAt',location.syncedAt||now());return this.manifest()}
  health(){return{ok:Boolean(this.meta('nodeId')),service:'civweave-guild-cloud-node',version:WORKER_VERSION,guildId:this.meta('guildId'),nodeId:this.meta('nodeId'),runtime:'cloudflare-workers-ai'}}
  manifest(){return{ok:Boolean(this.meta('nodeId')),manifest:{schema:NODE_MANIFEST_SCHEMA,guildId:this.meta('guildId'),nodeId:this.meta('nodeId'),displayName:this.meta('displayName'),publicOrigin:this.meta('publicOrigin'),runtime:'cloudflare-workers-ai',capabilities:['guild-relay','workers-ai','signed-object-mesh','creator-provenance','guild-map-location'],location:this.meta('location'),createdAt:this.meta('createdAt'),updatedAt:this.meta('updatedAt')}}}
}

async function authenticate(request,stub){const token=bearer(request);if(!validSecret(token))throw Object.assign(new Error('Guild synchronization authorization is required.'),{status:401});if(!await stub.authorized(await membershipHash(token)))throw Object.assign(new Error('Guild synchronization authorization was rejected.'),{status:403})}
async function buildCloudFabric(env,guildStatus,origin){const capacity=await capacityStub(env).bootstrap({guildId:guildStatus.guildId,displayName:guildStatus.displayName,origin});for(const node of capacity.starterNodes){await nodeStub(env,node.nodeId).configure({guildId:guildStatus.guildId,nodeId:node.nodeId,displayName:`${guildStatus.displayName} · ${node.nodeId.slice(-1).toUpperCase()}`,publicOrigin:node.publicOrigin,location:guildStatus.location})}return{schema:FABRIC_SCHEMA,status:'ready',capacityOrigin:`${origin}/api/fabric/capacity`,manifestOrigin:`${origin}/api/fabric/manifest`,aiEnabled:Boolean(env.AI),starterNodes:capacity.starterNodes}}
async function fabricStatus(env,origin){const capacity=await capacityStub(env).status();return{schema:FABRIC_SCHEMA,status:capacity.status,capacityOrigin:`${origin}/api/fabric/capacity`,manifestOrigin:`${origin}/api/fabric/manifest`,aiEnabled:Boolean(env.AI),starterNodes:capacity.starterNodes||[]}}
function nodeRoute(pathname){const match=String(pathname||'').match(/^\/nodes\/([^/]+)(\/.*)?$/);if(!match)return null;const nodeId=normalizeGuildId(match[1]);return nodeId?{nodeId,pathname:match[2]||'/'}:null}
async function knownNode(env,nodeId){const capacity=await capacityStub(env).status();return(capacity.starterNodes||[]).some(node=>node.nodeId===nodeId)}
function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
async function statusPage(env,origin){const guild=await stateStub(env).status(),fabric=await fabricStatus(env,origin);const nodeLinks=fabric.starterNodes.map(node=>`<li><a href="${escapeHtml(new URL('/api/node/health',`${node.publicOrigin}/`).href)}">${escapeHtml(node.nodeId)}</a> · ${escapeHtml(node.runtime)}</li>`).join('');return new Response(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Civweave Guild Cloud</title><style>body{font:16px system-ui;max-width:760px;margin:48px auto;padding:0 22px;line-height:1.5}code{background:#eee;padding:.15em .35em;border-radius:.3em}.ok{font-weight:700}</style><main><h1>Civweave Guild Cloud is online</h1><p class="ok">${guild.claimed?'Paired and ready':'Cloudflare is deployed; return to Civweave to finish pairing.'}</p><p>Guild: <strong>${escapeHtml(guild.displayName||'Not paired yet')}</strong></p><p>Cloud fabric: <strong>${escapeHtml(fabric.status)}</strong> · Workers AI: <strong>${fabric.aiEnabled?'available':'not bound'}</strong></p>${nodeLinks?`<h2>Starter nodes</h2><ul>${nodeLinks}</ul>`:''}<p>Guild Map location: <strong>${guild.location?'published':'required'}</strong></p><p>Machine health: <a href="/api/health"><code>/api/health</code></a></p></main>`,{status:200,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}})}
function boundedAiInput(input){let value;if(input?.input!==undefined)value=input.input;else if(Array.isArray(input?.messages))value={messages:input.messages};else if(input?.prompt!==undefined)value={prompt:clean(input.prompt,24000)};else throw Object.assign(new Error('AI input, messages, or prompt is required.'),{status:400});if(typeof value==='string')value={prompt:clean(value,24000)};if(!value||typeof value!=='object')throw Object.assign(new Error('AI input is invalid.'),{status:400});const output=structuredClone(value);output.stream=false;if(Number(output.max_tokens)>2048)output.max_tokens=2048;return output}

export default{
  async fetch(request,env,ctx){
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:corsHeaders});
    const url=new URL(request.url),guildState=stateStub(env),routed=nodeRoute(url.pathname);
    try{
      if(request.method==='GET'&&url.pathname==='/')return statusPage(env,url.origin);
      if(request.method==='GET'&&url.pathname==='/api/health'){const status=await guildState.status(),infrastructure=await fabricStatus(env,url.origin);return json({ok:true,service:'civweave-guild-cloud',version:WORKER_VERSION,claimed:status.claimed,guildId:status.guildId,location:status.location,infrastructure})}
      if(request.method==='GET'&&url.pathname==='/api/guild/status'){const status=await guildState.status();return json({...status,infrastructure:await fabricStatus(env,url.origin)})}
      if(request.method==='GET'&&url.pathname==='/api/fabric/capacity'){const status=await capacityStub(env).status();return json({...status,aiEnabled:Boolean(env.AI)})}
      if(request.method==='GET'&&url.pathname==='/api/fabric/manifest'){const guild=await guildState.status(),infrastructure=await fabricStatus(env,url.origin);return json({ok:true,schema:FABRIC_SCHEMA,guildId:guild.guildId,displayName:guild.displayName,workerOrigin:url.origin,location:guild.location,infrastructure,capabilities:['always-online-guild-edge','three-starter-nodes','workers-ai','signed-object-relay','creator-provenance','guild-map-location']})}
      if(request.method==='POST'&&url.pathname==='/api/guild/claim'){
        const configured=clean(env.CIVWEAVE_GUILD_CLAIM_TOKEN,300);if(!validSecret(configured)||/^PASTE_/i.test(configured))throw Object.assign(new Error('This Worker was deployed without the Civweave one-time pairing code. Set CIVWEAVE_GUILD_CLAIM_TOKEN in Cloudflare and redeploy.'),{status:503});
        const input=await request.json().catch(()=>({})),guildId=normalizeGuildId(input.guildId),displayName=clean(input.displayName,120),foundingDeviceId=clean(input.foundingDeviceId,300),claimToken=clean(input.claimToken,300),membershipKey=clean(input.membershipKey,300);
        if(!guildId||!displayName||!foundingDeviceId)throw Object.assign(new Error('Guild ID, name, and founding device are required.'),{status:400});if(!validSecret(claimToken)||!constantTimeEqual(configured,claimToken))throw Object.assign(new Error('The one-time Guild pairing code was rejected.'),{status:403});if(!validSecret(membershipKey))throw Object.assign(new Error('A valid Guild synchronization key is required.'),{status:400});if(!input.location)throw Object.assign(new Error('A Guild Map location is required before the public edge can be paired.'),{status:400});
        const location=normalizeHubLocation(input.location,{requireFresh:false}),claimed=await guildState.claim({guildId,displayName,foundingDeviceId,membershipKeyHash:await membershipHash(membershipKey),location});if(claimed?.ok===false)return json({ok:false,error:claimed.error},claimed.status||409);const infrastructure=await buildCloudFabric(env,{...claimed,location},url.origin);return json({...claimed,location,primaryOrigin:url.origin,primaryGateway:url.origin,infrastructure});
      }
      if(request.method==='POST'&&url.pathname==='/api/fabric/location'){
        const status=await guildState.status();if(!status.claimed)throw Object.assign(new Error('This public edge has not been paired to a Guild yet.'),{status:409});await authenticate(request,guildState);
        const location=normalizeHubLocation(await request.json().catch(()=>({}))),updated=await guildState.setLocation(location),capacity=await capacityStub(env).status(),nodes=[];
        for(const node of capacity.starterNodes||[]){const manifest=await nodeStub(env,node.nodeId).setLocation(location);nodes.push({nodeId:node.nodeId,location:manifest?.manifest?.location||location})}
        return json({schema:'civweave.hub-location-sync.v1',ok:true,guildId:updated.guildId,nodeIds:nodes.map(node=>node.nodeId),location,nodes});
      }
      if(routed){
        if(!await knownNode(env,routed.nodeId))return json({ok:false,error:'Guild cloud node not found.'},404);
        const node=nodeStub(env,routed.nodeId);
        if(request.method==='GET'&&routed.pathname==='/api/node/health')return json(await node.health());
        if(request.method==='GET'&&routed.pathname==='/api/ai/node/manifest')return json(await node.manifest());
        if(request.method==='GET'&&routed.pathname==='/'){const manifest=(await node.manifest()).manifest;return new Response(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(manifest.nodeId)}</title><main><h1>${escapeHtml(manifest.displayName)}</h1><p>Guild cloud node is online.</p><p><a href="${escapeHtml(manifest.publicOrigin)}/api/node/health">Health</a> · <a href="${escapeHtml(manifest.publicOrigin)}/api/ai/node/manifest">AI manifest</a></p></main>`,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}})}
        if(request.method==='POST'&&routed.pathname==='/api/ai/node/generate'){
          await authenticate(request,guildState);if(!env.AI||typeof env.AI.run!=='function')throw Object.assign(new Error('Workers AI is not available on this Guild Cloud deployment.'),{status:503});const raw=await request.text();if(encoder.encode(raw).byteLength>MAX_AI_REQUEST_BYTES)throw Object.assign(new Error('Guild AI request is too large for this Guild Cloud deployment.'),{status:413});let input;try{input=JSON.parse(raw)}catch{throw Object.assign(new Error('Guild AI request is not valid JSON.'),{status:400})}const model=clean(input.model||env.CIVWEAVE_DEFAULT_AI_MODEL,200);if(!model)throw Object.assign(new Error('Choose a Workers AI model for this request.'),{status:400});const result=await env.AI.run(model,boundedAiInput(input));return json({ok:true,nodeId:routed.nodeId,model,result});
        }
        return json({ok:false,error:'Not found.'},404);
      }
      if(url.pathname==='/api/envelopes'){
        const status=await guildState.status();if(!status.claimed)throw Object.assign(new Error('This public edge has not been paired to a Guild yet.'),{status:409});await authenticate(request,guildState);
        if(request.method==='GET'){const limit=url.searchParams.get('limit');return json({ok:true,guildId:status.guildId,envelopes:await guildState.listEnvelopes(limit)})}
        if(request.method==='POST'){
          const length=Number(request.headers.get('content-length')||0);if(length>MAX_ENVELOPE_BYTES)throw Object.assign(new Error('Guild envelope is too large for this public edge.'),{status:413});const raw=await request.text();if(encoder.encode(raw).byteLength>MAX_ENVELOPE_BYTES)throw Object.assign(new Error('Guild envelope is too large for this public edge.'),{status:413});let envelope;try{envelope=JSON.parse(raw)}catch{throw Object.assign(new Error('Guild envelope is not valid JSON.'),{status:400})}if(envelope?.schema!==ENVELOPE_SCHEMA||!envelope?.payload)throw Object.assign(new Error('Invalid Civweave community envelope.'),{status:400});await verifyObject(envelope.payload,status.guildId);const stored=await guildState.putEnvelope(envelope);if(stored?.ok===false)return json({ok:false,error:stored.error},stored.status||400);return json({...stored,guildId:status.guildId},201)
        }
        return json({ok:false,error:'Method not allowed.'},405);
      }
      return json({ok:false,error:'Not found.'},404);
    }catch(error){return textError(error)}
  }
};
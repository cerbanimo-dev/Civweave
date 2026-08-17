import {DurableObject} from 'cloudflare:workers';

const WORKER_VERSION='1.0.0-mobile-guild-edge';
const OBJECT_SCHEMA='civweave.community-object.v1';
const ENVELOPE_SCHEMA='civweave.community-object-envelope.v1';
const encoder=new TextEncoder();
const MAX_ENVELOPE_BYTES=2*1024*1024;
const MAX_STORED_ENVELOPES=2000;
const clean=(value,max=4000)=>String(value??'').trim().slice(0,max);
const now=()=>new Date().toISOString();
const normalized=value=>{if(Array.isArray(value))return value.map(normalized);if(value&&typeof value==='object'){const out={};for(const key of Object.keys(value).sort())if(value[key]!==undefined)out[key]=normalized(value[key]);return out}return value};
const canonical=value=>JSON.stringify(normalized(value));
const b64url=bytes=>{let binary='';for(const byte of new Uint8Array(bytes))binary+=String.fromCharCode(byte);return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')};
const unb64=value=>{const raw=String(value||'').replace(/-/g,'+').replace(/_/g,'/'),padded=raw+'='.repeat((4-raw.length%4)%4),binary=atob(padded);return Uint8Array.from(binary,char=>char.charCodeAt(0))};
const sha256=async value=>b64url(await crypto.subtle.digest('SHA-256',typeof value==='string'?encoder.encode(value):value));
const membershipHash=value=>sha256(`civweave.guild-edge.membership.v1\n${String(value||'')}`);
const validSecret=value=>/^[A-Za-z0-9_-]{40,200}$/.test(String(value||''));
function constantTimeEqual(left,right){const a=String(left||''),b=String(right||'');if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0}
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

export class CivweaveGuildEdgeState extends DurableObject{
  constructor(ctx,env){super(ctx,env);this.sql=ctx.storage.sql;this.sql.exec('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)');this.sql.exec('CREATE TABLE IF NOT EXISTS envelopes (seq INTEGER PRIMARY KEY AUTOINCREMENT, revision_hash TEXT NOT NULL UNIQUE, envelope_json TEXT NOT NULL, stored_at INTEGER NOT NULL)')}
  meta(key){const row=[...this.sql.exec('SELECT value FROM meta WHERE key = ?',key)][0];return row?JSON.parse(row.value):null}
  putMeta(key,value){this.sql.exec('INSERT OR REPLACE INTO meta (key,value) VALUES (?,?)',key,JSON.stringify(value))}
  status(){return{ok:true,claimed:Boolean(this.meta('guildId')),guildId:this.meta('guildId'),displayName:this.meta('displayName'),foundingDeviceId:this.meta('foundingDeviceId'),claimedAt:this.meta('claimedAt'),storedEnvelopes:Number([...this.sql.exec('SELECT COUNT(*) AS count FROM envelopes')][0]?.count||0)}}
  claim({guildId,displayName,foundingDeviceId,membershipKeyHash}={}){const existingGuild=this.meta('guildId'),existingDevice=this.meta('foundingDeviceId'),existingHash=this.meta('membershipKeyHash');if(existingGuild){if(existingGuild!==guildId||existingDevice!==foundingDeviceId||existingHash!==membershipKeyHash)throw Object.assign(new Error('This Cloudflare edge is already claimed by a different Guild or founding device.'),{status:409});return{...this.status(),idempotent:true}}const claimedAt=now();this.putMeta('guildId',guildId);this.putMeta('displayName',displayName);this.putMeta('foundingDeviceId',foundingDeviceId);this.putMeta('membershipKeyHash',membershipKeyHash);this.putMeta('claimedAt',claimedAt);return{...this.status(),idempotent:false}}
  authorized(membershipKeyHash){const expected=this.meta('membershipKeyHash');return Boolean(expected&&constantTimeEqual(expected,membershipKeyHash))}
  putEnvelope(envelope){const revisionHash=clean(envelope?.payload?.revisionHash,300);if(!revisionHash)throw Object.assign(new Error('Envelope revision hash is required.'),{status:400});this.sql.exec('INSERT OR IGNORE INTO envelopes (revision_hash,envelope_json,stored_at) VALUES (?,?,?)',revisionHash,JSON.stringify(envelope),Date.now());this.sql.exec(`DELETE FROM envelopes WHERE seq NOT IN (SELECT seq FROM envelopes ORDER BY seq DESC LIMIT ${MAX_STORED_ENVELOPES})`);return{ok:true,revisionHash}}
  listEnvelopes(limit=200){const take=Math.max(1,Math.min(200,Number(limit)||200));const rows=[...this.sql.exec(`SELECT envelope_json FROM envelopes ORDER BY seq DESC LIMIT ${take}`)].reverse();return rows.map(row=>JSON.parse(row.envelope_json))}
}

async function authenticate(request,stub){const token=bearer(request);if(!validSecret(token))throw Object.assign(new Error('Guild synchronization authorization is required.'),{status:401});if(!await stub.authorized(await membershipHash(token)))throw Object.assign(new Error('Guild synchronization authorization was rejected.'),{status:403})}

export default{
  async fetch(request,env){
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:corsHeaders});
    const url=new URL(request.url),stub=stateStub(env);
    try{
      if(request.method==='GET'&&url.pathname==='/api/health'){const status=await stub.status();return json({ok:true,service:'civweave-mobile-guild-edge',version:WORKER_VERSION,claimed:status.claimed,guildId:status.guildId})}
      if(request.method==='GET'&&url.pathname==='/api/guild/status')return json(await stub.status());
      if(request.method==='POST'&&url.pathname==='/api/guild/claim'){
        const configured=clean(env.CIVWEAVE_GUILD_CLAIM_TOKEN,300);if(!validSecret(configured)||/^PASTE_/i.test(configured))throw Object.assign(new Error('This Worker was deployed without the Civweave one-time pairing code. Set CIVWEAVE_GUILD_CLAIM_TOKEN in Cloudflare and redeploy.'),{status:503});
        const input=await request.json().catch(()=>({})),guildId=clean(input.guildId,180),displayName=clean(input.displayName,120),foundingDeviceId=clean(input.foundingDeviceId,300),claimToken=clean(input.claimToken,300),membershipKey=clean(input.membershipKey,300);
        if(!guildId||!displayName||!foundingDeviceId)throw Object.assign(new Error('Guild ID, name, and founding device are required.'),{status:400});if(!validSecret(claimToken)||!constantTimeEqual(configured,claimToken))throw Object.assign(new Error('The one-time Guild pairing code was rejected.'),{status:403});if(!validSecret(membershipKey))throw Object.assign(new Error('A valid Guild synchronization key is required.'),{status:400});
        const claimed=await stub.claim({guildId,displayName,foundingDeviceId,membershipKeyHash:await membershipHash(membershipKey)});return json({...claimed,primaryOrigin:url.origin,primaryGateway:url.origin});
      }
      if(url.pathname==='/api/envelopes'){
        const status=await stub.status();if(!status.claimed)throw Object.assign(new Error('This public edge has not been paired to a Guild yet.'),{status:409});await authenticate(request,stub);
        if(request.method==='GET'){const limit=url.searchParams.get('limit');return json({ok:true,guildId:status.guildId,envelopes:await stub.listEnvelopes(limit)})}
        if(request.method==='POST'){
          const length=Number(request.headers.get('content-length')||0);if(length>MAX_ENVELOPE_BYTES)throw Object.assign(new Error('Guild envelope is too large for this public edge.'),{status:413});const raw=await request.text();if(encoder.encode(raw).byteLength>MAX_ENVELOPE_BYTES)throw Object.assign(new Error('Guild envelope is too large for this public edge.'),{status:413});let envelope;try{envelope=JSON.parse(raw)}catch{throw Object.assign(new Error('Guild envelope is not valid JSON.'),{status:400})}if(envelope?.schema!==ENVELOPE_SCHEMA||!envelope?.payload)throw Object.assign(new Error('Invalid Civweave community envelope.'),{status:400});await verifyObject(envelope.payload,status.guildId);const stored=await stub.putEnvelope(envelope);return json({...stored,guildId:status.guildId},201)
        }
        return json({ok:false,error:'Method not allowed.'},405);
      }
      return json({ok:false,error:'Not found.'},404);
    }catch(error){return textError(error)}
  }
};

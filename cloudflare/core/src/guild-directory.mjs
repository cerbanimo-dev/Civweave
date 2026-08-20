const clean=(value,max=4000)=>String(value??'').trim().slice(0,max);
const now=()=>new Date().toISOString();
const encoder=new TextEncoder();
const normalized=value=>{if(Array.isArray(value))return value.map(normalized);if(value&&typeof value==='object'){const out={};for(const key of Object.keys(value).sort())if(value[key]!==undefined)out[key]=normalized(value[key]);return out}return value};
const canonical=value=>JSON.stringify(normalized(value));
const b64url=bytes=>{let binary='';for(const byte of new Uint8Array(bytes))binary+=String.fromCharCode(byte);return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')};
const unb64=value=>{const raw=String(value||'').replace(/-/g,'+').replace(/_/g,'/'),padded=raw+'='.repeat((4-raw.length%4)%4),binary=atob(padded);return Uint8Array.from(binary,char=>char.charCodeAt(0))};
const sha256=async value=>b64url(await crypto.subtle.digest('SHA-256',typeof value==='string'?encoder.encode(value):value));
function signableObject(object){return{schema:object.schema,id:object.id,revision:object.revision,kind:object.kind,purpose:object.purpose,audience:object.audience,consent:object.consent,payload:object.payload,payloadHash:object.payloadHash,parentIds:object.parentIds,createdAt:object.createdAt,updatedAt:object.updatedAt,expiresAt:object.expiresAt,origin:object.origin,hopLimit:object.hopLimit}}

function normalizePublicOrigin(value){
  const raw=clean(value,2000);let url;
  if(!raw)throw Object.assign(new RangeError('A public Guild Cloud origin is required.'),{status:400});
  try{url=new URL(raw)}catch{throw Object.assign(new RangeError('Guild directory origin must be a valid HTTPS URL.'),{status:400})}
  if(url.protocol!=='https:'||url.username||url.password)throw Object.assign(new RangeError('Guild directory origin must be a credential-free HTTPS origin.'),{status:400});
  const host=url.hostname.toLowerCase().replace(/^\[|\]$/g,'').replace(/\.$/,'');
  if(!host||!host.includes('.')||/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)||host.includes(':'))throw Object.assign(new RangeError('Guild directory origin must use a public DNS hostname.'),{status:400});
  const blocked=['localhost','.localhost','.local','.internal','.home.arpa','.example','.invalid','.test','.onion'];
  if(blocked.some(suffix=>host===suffix.replace(/^\./,'')||host.endsWith(suffix)))throw Object.assign(new RangeError('Guild directory origin must use a publicly routable hostname.'),{status:400});
  return url.origin;
}

function normalizeGuildId(value){return clean(value,120).toLowerCase().replace(/[^a-z0-9-]/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'')}

function normalizePublishedLocation(value,{attested=false}={}){
  if(!value||value.schema!=='civweave.hub-location.v1')throw Object.assign(new TypeError('The Guild has not published a valid Guild Map location.'),{status:409});
  const latitude=Number(value.latitude),longitude=Number(value.longitude),precisionMeters=Number(value.precisionMeters??value.accuracyMeters),requestedDecimals=Number(value.coordinateDecimals),precise=Number.isFinite(requestedDecimals)&&requestedDecimals>=5,coordinateDecimals=precise?6:3;
  if(!Number.isFinite(latitude)||latitude<-90||latitude>90||!Number.isFinite(longitude)||longitude<-180||longitude>180)throw Object.assign(new RangeError('The Guild published invalid coordinates.'),{status:409});
  return Object.freeze({
    schema:'civweave.hub-location.v1',
    latitude:Number(latitude.toFixed(coordinateDecimals)),
    longitude:Number(longitude.toFixed(coordinateDecimals)),
    precisionMeters:Number.isFinite(precisionMeters)&&precisionMeters>0?Math.max(precise?1:100,Math.ceil(precisionMeters)):precise?1:100,
    coordinateDecimals,
    source:attested?'founding-device-signed-location':clean(value.source,120)||'guildkeeper-published-mobile-guild-edge',
    capturedAt:clean(value.capturedAt,80)||null,
    syncedAt:attested?now():(clean(value.syncedAt,80)||now()),
  });
}

async function verifyFoundingDeviceAttestation(proof,{guildId,publicOrigin,foundingDeviceId}){
  if(!proof||proof.schema!=='civweave.community-object.v1'||proof.kind!=='civweave.guild-directory-registration.v1')throw Object.assign(new Error('This legacy Guild edge needs a signed founding-device map attestation before it can enter the public directory.'),{status:409});
  if(proof.consent!=='public'||!proof.id||!proof.revisionHash||!proof.signature||!proof.origin?.credential||!proof.origin?.nodeId)throw Object.assign(new Error('Guild directory map attestation is incomplete.'),{status:409});
  const payload=proof.payload||{};
  if(payload.schema!=='civweave.guild-directory-registration.v1'||normalizeGuildId(payload.guildId)!==guildId)throw Object.assign(new Error('Guild directory attestation identity does not match the live Guild.'),{status:409});
  if(normalizePublicOrigin(payload.publicOrigin)!==publicOrigin)throw Object.assign(new Error('Guild directory attestation origin does not match the live Guild edge.'),{status:409});
  const requestedMs=Date.parse(clean(payload.requestedAt,80));
  if(!Number.isFinite(requestedMs)||Math.abs(Date.now()-requestedMs)>15*60*1000)throw Object.assign(new Error('Guild directory attestation is stale. Open Civweave on the founding device and retry.'),{status:409});
  if(await sha256(canonical(payload))!==proof.payloadHash)throw Object.assign(new Error('Guild directory attestation payload hash mismatch.'),{status:409});
  if(await sha256(canonical(signableObject(proof)))!==proof.revisionHash)throw Object.assign(new Error('Guild directory attestation revision hash mismatch.'),{status:409});
  const fingerprint=(await sha256(canonical(proof.origin.credential))).slice(0,24),deviceId=`device:${fingerprint}`;
  if(proof.origin.nodeId!==deviceId||clean(foundingDeviceId,180)!==deviceId)throw Object.assign(new Error('Guild directory attestation was not signed by this Guild founding device.'),{status:403});
  let key;try{key=await crypto.subtle.importKey('jwk',proof.origin.credential,{name:'ECDSA',namedCurve:'P-256'},false,['verify'])}catch{throw Object.assign(new Error('Guild directory attestation signing key is invalid.'),{status:409})}
  const verified=await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},key,unb64(proof.signature),encoder.encode(canonical(signableObject(proof)))).catch(()=>false);
  if(!verified)throw Object.assign(new Error('Guild directory attestation signature was rejected.'),{status:403});
  return Object.freeze({location:normalizePublishedLocation(payload.location,{attested:true}),displayName:clean(payload.displayName,180)||null,requestedAt:new Date(requestedMs).toISOString(),deviceId});
}

async function getJson(fetcher,url){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5000);
  try{
    const response=await fetcher(url,{cache:'no-store',headers:{accept:'application/json'},signal:controller.signal});
    const payload=await response.json().catch(()=>({}));
    if(!response.ok)throw Object.assign(new Error(`Guild edge probe returned HTTP ${response.status}.`),{status:400});
    return payload;
  }finally{clearTimeout(timer)}
}

export async function registerPublicGuildEdge(env,input={},options={}){
  if(!env?.DB?.prepare)throw Object.assign(new Error('Guild directory storage is unavailable.'),{status:503});
  const fetcher=options.fetcher||globalThis.fetch,publicOrigin=normalizePublicOrigin(input.publicOrigin);
  const [status,manifest]=await Promise.all([
    getJson(fetcher,new URL('/api/guild/status',publicOrigin)),
    getJson(fetcher,new URL('/api/fabric/manifest',publicOrigin)),
  ]);
  const guildId=normalizeGuildId(status?.guildId),manifestGuildId=normalizeGuildId(manifest?.guildId);
  if(status?.ok!==true||status?.claimed!==true||!guildId)throw Object.assign(new Error('Only a claimed Civweave Guild Cloud edge can enter the public Guild directory.'),{status:409});
  if(manifest?.ok!==true||manifest?.schema!=='civweave.guild-cloud-fabric.v1'||manifestGuildId!==guildId)throw Object.assign(new Error('Guild Cloud manifest identity does not match the claimed Guild.'),{status:409});
  const capabilities=Array.isArray(manifest.capabilities)?manifest.capabilities.map(value=>clean(value,120)).filter(Boolean):[];
  if(!capabilities.includes('always-online-guild-edge'))throw Object.assign(new Error('This Cloudflare edge does not advertise the Civweave Guild edge contract.'),{status:409});
  const starterNodes=manifest?.infrastructure?.starterNodes;
  if(!Array.isArray(starterNodes)||starterNodes.length<3)throw Object.assign(new Error('The Guild Cloud fabric is not fully provisioned yet.'),{status:409});

  let location=null,attestation=null,locationAttestation='live-edge';
  if(capabilities.includes('guild-map-location')&&(status.location||manifest.location)){
    location=normalizePublishedLocation(status.location||manifest.location);
  }else{
    attestation=await verifyFoundingDeviceAttestation(input.proof,{guildId,publicOrigin,foundingDeviceId:status.foundingDeviceId});
    location=attestation.location;
    locationAttestation='founding-device-signature';
  }

  const displayName=clean(status.displayName||manifest.displayName||attestation?.displayName||guildId,180)||guildId,updatedAt=attestation?.requestedAt||clean(status.updatedAt,80)||location.syncedAt||now();
  const publicCapabilities=[...new Set([...capabilities,'public-guild-directory','mobile-guild-edge',...(attestation?['founding-device-map-attestation']:[])])];
  await env.DB.prepare(`INSERT INTO nodes(node_id,operator_id,display_name,runtime,public_origin,capabilities_json,location_json,status,updated_at)
    VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9)
    ON CONFLICT(node_id) DO UPDATE SET operator_id=excluded.operator_id,display_name=excluded.display_name,
      runtime=excluded.runtime,public_origin=excluded.public_origin,capabilities_json=excluded.capabilities_json,
      location_json=excluded.location_json,status=excluded.status,updated_at=excluded.updated_at`)
    .bind(guildId,`guildkeeper:${guildId}`,displayName,'cloudflare-mobile-guild-edge',publicOrigin,JSON.stringify(publicCapabilities),JSON.stringify(location),'active',updatedAt).run();
  return Object.freeze({schema:'civweave.public-guild-directory-registration.v1',guildId,nodeId:guildId,displayName,publicOrigin,runtime:'cloudflare-mobile-guild-edge',capabilities:publicCapabilities,location,status:'active',updatedAt,verifiedFromLiveEdge:true,locationAttestation});
}

export const CivweavePublicGuildDirectoryV1=Object.freeze({registerPublicGuildEdge});

const clean=(value,max=4000)=>String(value??'').trim().slice(0,max);
const now=()=>new Date().toISOString();

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

function normalizePublishedLocation(value){
  if(!value||value.schema!=='civweave.hub-location.v1')throw Object.assign(new TypeError('The live Guild edge has not published a valid Guild Map location.'),{status:409});
  const latitude=Number(value.latitude),longitude=Number(value.longitude),precisionMeters=Number(value.precisionMeters??value.accuracyMeters),requestedDecimals=Number(value.coordinateDecimals),precise=Number.isFinite(requestedDecimals)&&requestedDecimals>=5,coordinateDecimals=precise?6:3;
  if(!Number.isFinite(latitude)||latitude<-90||latitude>90||!Number.isFinite(longitude)||longitude<-180||longitude>180)throw Object.assign(new RangeError('The live Guild edge published invalid coordinates.'),{status:409});
  return Object.freeze({
    schema:'civweave.hub-location.v1',
    latitude:Number(latitude.toFixed(coordinateDecimals)),
    longitude:Number(longitude.toFixed(coordinateDecimals)),
    precisionMeters:Number.isFinite(precisionMeters)&&precisionMeters>0?Math.max(precise?1:100,Math.ceil(precisionMeters)):precise?1:100,
    coordinateDecimals,
    source:clean(value.source,120)||'guildkeeper-published-mobile-guild-edge',
    capturedAt:clean(value.capturedAt,80)||null,
    syncedAt:clean(value.syncedAt,80)||now(),
  });
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
  if(!capabilities.includes('always-online-guild-edge')||!capabilities.includes('guild-map-location'))throw Object.assign(new Error('This Cloudflare edge does not advertise the public Guild Map contract.'),{status:409});
  const starterNodes=manifest?.infrastructure?.starterNodes;
  if(!Array.isArray(starterNodes)||starterNodes.length<3)throw Object.assign(new Error('The Guild Cloud fabric is not fully provisioned yet.'),{status:409});
  const location=normalizePublishedLocation(status.location||manifest.location),displayName=clean(status.displayName||manifest.displayName||guildId,180)||guildId,updatedAt=clean(status.updatedAt,80)||location.syncedAt||now();
  const publicCapabilities=[...new Set([...capabilities,'public-guild-directory','mobile-guild-edge'])];
  await env.DB.prepare(`INSERT INTO nodes(node_id,operator_id,display_name,runtime,public_origin,capabilities_json,location_json,status,updated_at)
    VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9)
    ON CONFLICT(node_id) DO UPDATE SET operator_id=excluded.operator_id,display_name=excluded.display_name,
      runtime=excluded.runtime,public_origin=excluded.public_origin,capabilities_json=excluded.capabilities_json,
      location_json=excluded.location_json,status=excluded.status,updated_at=excluded.updated_at`)
    .bind(guildId,`guildkeeper:${guildId}`,displayName,'cloudflare-mobile-guild-edge',publicOrigin,JSON.stringify(publicCapabilities),JSON.stringify(location),'active',updatedAt).run();
  return Object.freeze({schema:'civweave.public-guild-directory-registration.v1',guildId,nodeId:guildId,displayName,publicOrigin,runtime:'cloudflare-mobile-guild-edge',capabilities:publicCapabilities,location,status:'active',updatedAt,verifiedFromLiveEdge:true});
}

export const CivweavePublicGuildDirectoryV1=Object.freeze({registerPublicGuildEdge});

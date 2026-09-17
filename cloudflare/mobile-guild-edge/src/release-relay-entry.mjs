import baseWorker,{
  CivweaveGuildEdgeState as BaseGuildEdgeState,
  CivweaveGuildCapacityState,
  CivweaveGuildNodeState
} from './creator-provenance-entry.mjs';

export {CivweaveGuildCapacityState,CivweaveGuildNodeState};

const RELEASE_SCHEMA='civweave.guild-release-manifest.v1';
const TRUST_BUNDLE_SCHEMA='civweave.release-trust-bundle.v1';
const MAX_RELEASE_ASSETS=600;
const MAX_ASSET_BYTES=8*1024*1024;
const MAX_RELEASE_BYTES=96*1024*1024;
const encoder=new TextEncoder();
const clean=(value,max=4000)=>String(value??'').trim().slice(0,max);
const b64url=bytes=>{
  let binary='';
  for(const byte of new Uint8Array(bytes))binary+=String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
};
const unb64=value=>{
  const raw=String(value||'').replace(/-/g,'+').replace(/_/g,'/');
  const padded=raw+'='.repeat((4-raw.length%4)%4);
  const binary=atob(padded);
  return Uint8Array.from(binary,char=>char.charCodeAt(0));
};
const sha256=async value=>b64url(await crypto.subtle.digest('SHA-256',value instanceof Uint8Array?value:encoder.encode(String(value??''))));
const membershipHash=value=>sha256(`civweave.guild-edge.membership.v1\n${String(value||'')}`);
const cors=Object.freeze({
  'access-control-allow-origin':'*',
  'access-control-allow-methods':'GET, POST, OPTIONS',
  'access-control-allow-headers':'authorization, content-type',
  'access-control-max-age':'86400',
  'cache-control':'no-store'
});
const json=(value,status=200)=>Response.json(value,{status,headers:cors});
function bearer(request){const match=String(request.headers.get('authorization')||'').match(/^Bearer\s+(.+)$/i);return match?.[1]?.trim()||''}
function validSecret(value){return/^[A-Za-z0-9_-]{40,200}$/.test(String(value||''))}
function safeSourceOrigin(value){
  const url=new URL(String(value||''));
  if(url.protocol!=='https:')throw Object.assign(new Error('Partner Guild origin must use HTTPS.'),{status:400});
  return url.origin;
}
function safeAssetPath(value){
  const pathname=new URL(String(value||''),'https://civweave.invalid').pathname;
  if(!(pathname==='/'||pathname==='/index.html'||pathname==='/offline.html'||pathname.startsWith('/app/')||pathname.startsWith('/extensions/')||pathname.startsWith('/finder/')))throw Object.assign(new Error(`Release asset is outside the Civweave runtime boundary: ${pathname}`),{status:400});
  return pathname;
}
function errorResponse(error,fallback=500){return json({ok:false,error:String(error?.message||error)},Number.isSafeInteger(error?.status)?error.status:fallback)}

export class CivweaveGuildEdgeState extends BaseGuildEdgeState{
  ensureReleaseTables(){
    this.sql.exec('CREATE TABLE IF NOT EXISTS release_manifests (release_id TEXT PRIMARY KEY, manifest_json TEXT NOT NULL, stored_at INTEGER NOT NULL)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS release_assets (release_id TEXT NOT NULL, path TEXT NOT NULL, body BLOB NOT NULL, content_type TEXT NOT NULL, sha256 TEXT NOT NULL, PRIMARY KEY(release_id,path))');
    this.sql.exec('CREATE TABLE IF NOT EXISTS release_trust_bundle (slot INTEGER PRIMARY KEY CHECK(slot=1), bundle_json TEXT NOT NULL, stored_at INTEGER NOT NULL)');
  }
  currentRelease(){
    this.ensureReleaseTables();
    const row=[...this.sql.exec('SELECT manifest_json FROM release_manifests ORDER BY stored_at DESC LIMIT 1')][0];
    return row?JSON.parse(row.manifest_json):null;
  }
  releaseAsset(releaseId,path){
    this.ensureReleaseTables();
    const row=[...this.sql.exec('SELECT body,content_type,sha256 FROM release_assets WHERE release_id=? AND path=? LIMIT 1',releaseId,path)][0];
    if(!row)return null;
    return{body:row.body,contentType:row.content_type,sha256:row.sha256};
  }
  trustBundle(){
    this.ensureReleaseTables();
    const row=[...this.sql.exec('SELECT bundle_json FROM release_trust_bundle WHERE slot=1 LIMIT 1')][0];
    return row?JSON.parse(row.bundle_json):null;
  }
  putTrustBundle(bundle){
    this.ensureReleaseTables();
    if(bundle?.schema!==TRUST_BUNDLE_SCHEMA)throw Object.assign(new Error('Unsupported release trust bundle schema.'),{status:400});
    const safe={schema:TRUST_BUNDLE_SCHEMA,delegations:Array.isArray(bundle.delegations)?bundle.delegations.slice(0,500):[],revocations:Array.isArray(bundle.revocations)?bundle.revocations.slice(0,500):[],relayedAt:new Date().toISOString()};
    this.sql.exec('INSERT OR REPLACE INTO release_trust_bundle (slot,bundle_json,stored_at) VALUES (1,?,?)',JSON.stringify(safe),Date.now());
    return safe;
  }
  replaceRelease({manifest,assets}={}){
    this.ensureReleaseTables();
    const releaseId=clean(manifest?.releaseId,180);
    if(manifest?.schema!==RELEASE_SCHEMA||!releaseId||!Array.isArray(manifest.assets)||!manifest.assets.length)throw Object.assign(new Error('Release manifest is incomplete.'),{status:400});
    if(manifest.assets.length>MAX_RELEASE_ASSETS)throw Object.assign(new Error('Release manifest contains too many assets.'),{status:413});
    if(!Array.isArray(assets)||assets.length!==manifest.assets.length)throw Object.assign(new Error('Release package asset count does not match its manifest.'),{status:400});
    const manifestByPath=new Map(manifest.assets.map(asset=>[safeAssetPath(asset.path),asset]));
    let total=0;
    const rows=[];
    for(const asset of assets){
      const path=safeAssetPath(asset?.path),expected=manifestByPath.get(path);
      if(!expected)throw Object.assign(new Error(`Release package contains unmanifested asset ${path}.`),{status:400});
      const body=asset?.body instanceof Uint8Array?asset.body:unb64(asset?.bodyBase64Url||'');
      if(!body.byteLength||body.byteLength>MAX_ASSET_BYTES)throw Object.assign(new Error(`Release asset size is invalid for ${path}.`),{status:413});
      total+=body.byteLength;
      if(total>MAX_RELEASE_BYTES)throw Object.assign(new Error('Release package exceeds the Guild relay storage limit.'),{status:413});
      rows.push({path,body,contentType:clean(asset?.contentType||expected.contentType||'application/octet-stream',200),sha256:clean(expected.sha256,120)});
    }
    this.sql.exec('DELETE FROM release_assets WHERE release_id=?',releaseId);
    for(const row of rows)this.sql.exec('INSERT INTO release_assets (release_id,path,body,content_type,sha256) VALUES (?,?,?,?,?)',releaseId,row.path,row.body,row.contentType,row.sha256);
    this.sql.exec('INSERT OR REPLACE INTO release_manifests (release_id,manifest_json,stored_at) VALUES (?,?,?)',releaseId,JSON.stringify(manifest),Date.now());
    this.sql.exec('DELETE FROM release_manifests WHERE release_id NOT IN (SELECT release_id FROM release_manifests ORDER BY stored_at DESC LIMIT 3)');
    this.sql.exec('DELETE FROM release_assets WHERE release_id NOT IN (SELECT release_id FROM release_manifests)');
    return{ok:true,releaseId,assetCount:rows.length,totalBytes:total};
  }
}

function stateStub(env){return env.GUILD_STATE.get(env.GUILD_STATE.idFromName('guild'))}
async function authenticateGuild(request,stub){
  const token=bearer(request);
  if(!validSecret(token))throw Object.assign(new Error('Guildkeeper authorization is required to change relayed releases or trust statements.'),{status:401});
  if(!await stub.authorized(await membershipHash(token)))throw Object.assign(new Error('Guildkeeper authorization was rejected.'),{status:403});
}
async function validatePackage(manifest,assets){
  const expected=new Map((Array.isArray(manifest?.assets)?manifest.assets:[]).map(asset=>[safeAssetPath(asset.path),clean(asset.sha256,120)]));
  if(!expected.size||!Array.isArray(assets)||assets.length!==expected.size)throw Object.assign(new Error('Partner release package is incomplete.'),{status:400});
  let total=0;
  for(const asset of assets){
    const path=safeAssetPath(asset.path),body=asset.body instanceof Uint8Array?asset.body:unb64(asset.bodyBase64Url||'');
    total+=body.byteLength;
    if(body.byteLength>MAX_ASSET_BYTES||total>MAX_RELEASE_BYTES)throw Object.assign(new Error('Partner release package is too large.'),{status:413});
    const digest=await sha256(body);
    if(digest!==expected.get(path))throw Object.assign(new Error(`Partner release asset hash mismatch for ${path}.`),{status:400});
  }
}
async function pullPartnerRelease(sourceOrigin){
  const origin=safeSourceOrigin(sourceOrigin);
  const [manifestResponse,trustResponse]=await Promise.all([
    fetch(`${origin}/api/civweave-release/current`,{headers:{accept:'application/json'}}),
    fetch(`${origin}/api/civweave-trust/bundle`,{headers:{accept:'application/json'}}).catch(()=>null)
  ]);
  if(!manifestResponse.ok)throw Object.assign(new Error(`Partner Guild release relay returned ${manifestResponse.status}.`),{status:502});
  const manifest=await manifestResponse.json();
  if(manifest?.schema!==RELEASE_SCHEMA)throw Object.assign(new Error('Partner Guild returned an unsupported release manifest.'),{status:502});
  if(!Array.isArray(manifest.assets)||manifest.assets.length>MAX_RELEASE_ASSETS)throw Object.assign(new Error('Partner Guild release manifest asset list is invalid.'),{status:502});
  const assets=[];
  for(const item of manifest.assets){
    const path=safeAssetPath(item.path),url=new URL('/api/civweave-release/asset',origin);
    url.searchParams.set('releaseId',manifest.releaseId);
    url.searchParams.set('path',path);
    const response=await fetch(url,{headers:{accept:'application/octet-stream'}});
    if(!response.ok)throw Object.assign(new Error(`Partner Guild asset ${path} returned ${response.status}.`),{status:502});
    const body=new Uint8Array(await response.arrayBuffer());
    assets.push({path,body,contentType:response.headers.get('content-type')||item.contentType||'application/octet-stream'});
  }
  await validatePackage(manifest,assets);
  let trustBundle=null;
  if(trustResponse?.ok){
    const candidate=await trustResponse.json().catch(()=>null);
    if(candidate?.schema===TRUST_BUNDLE_SCHEMA)trustBundle=candidate;
  }
  return{manifest,assets,trustBundle,sourceOrigin:origin};
}

export default{
  async fetch(request,env,ctx){
    const url=new URL(request.url),path=url.pathname,stub=stateStub(env);
    const owns=path.startsWith('/api/civweave-release/')||path.startsWith('/api/civweave-trust/');
    if(request.method==='OPTIONS'&&owns)return new Response(null,{status:204,headers:cors});
    try{
      if(request.method==='GET'&&path==='/api/civweave-release/current'){
        const manifest=await stub.currentRelease();
        return manifest?json(manifest):json({ok:false,error:'This Guild has not received a release package yet.'},404);
      }
      if(request.method==='GET'&&path==='/api/civweave-release/asset'){
        const releaseId=clean(url.searchParams.get('releaseId'),180),assetPath=safeAssetPath(url.searchParams.get('path'));
        const asset=await stub.releaseAsset(releaseId,assetPath);
        if(!asset)return json({ok:false,error:'Release asset not found.'},404);
        return new Response(asset.body,{status:200,headers:{...cors,'content-type':asset.contentType,'x-civweave-content-sha256':asset.sha256,'x-civweave-release-id':releaseId}});
      }
      if(request.method==='GET'&&path==='/api/civweave-trust/bundle'){
        const bundle=await stub.trustBundle();
        return bundle?json(bundle):json({schema:TRUST_BUNDLE_SCHEMA,delegations:[],revocations:[]});
      }
      if(request.method==='POST'&&path==='/api/civweave-release/import'){
        await authenticateGuild(request,stub);
        const input=await request.json();
        const assets=(Array.isArray(input?.assets)?input.assets:[]).map(asset=>({...asset,body:unb64(asset.bodyBase64Url||'')}));
        await validatePackage(input?.manifest,assets);
        const result=await stub.replaceRelease({manifest:input.manifest,assets});
        if(input?.trustBundle)await stub.putTrustBundle(input.trustBundle);
        return json({...result,trustRelayed:Boolean(input?.trustBundle)});
      }
      if(request.method==='POST'&&path==='/api/civweave-release/relay'){
        await authenticateGuild(request,stub);
        const input=await request.json(),packet=await pullPartnerRelease(input?.sourceOrigin);
        const result=await stub.replaceRelease({manifest:packet.manifest,assets:packet.assets});
        if(packet.trustBundle)await stub.putTrustBundle(packet.trustBundle);
        return json({...result,sourceOrigin:packet.sourceOrigin,trustRelayed:Boolean(packet.trustBundle)});
      }
      if(request.method==='POST'&&path==='/api/civweave-trust/import'){
        await authenticateGuild(request,stub);
        return json({ok:true,bundle:await stub.putTrustBundle(await request.json())});
      }
    }catch(error){if(owns)return errorResponse(error)}
    return baseWorker.fetch(request,env,ctx);
  }
};

export{pullPartnerRelease,safeAssetPath};

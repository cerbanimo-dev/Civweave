import { CivweaveCloudNode as BaseCloudNode } from './cloud-node-recovery-v2.mjs';
import {
  ingestCreationReceipt, pruneGuildAuditStorage, readLatestGuildAudit,
  runGuildDailyAudit, setGuildAuditPolicy,
} from './creator-provenance-audit-v1.mjs';

const NODE_KEY='creator-provenance:node-id';
const enc=new TextEncoder();
const clean=(value,max=4000)=>String(value??'').trim().slice(0,max);
const headers=Object.freeze({'cache-control':'no-store','content-type':'application/json; charset=utf-8'});
const json=(value,status=200)=>Response.json(value,{status,headers});
function b64(bytes){let binary='';for(const byte of new Uint8Array(bytes))binary+=String.fromCharCode(byte);return btoa(binary).replaceAll('+','-').replaceAll('/','_').replace(/=+$/g,'')}
async function internalToken(env){const source=clean(env.NODE_FABRIC_SESSION_SECRET||env.NODE_FABRIC_OPERATOR_TOKEN,10000);if(source.length<24)throw Object.assign(new Error('Guild internal provenance authority is unavailable.'),{status:503});const digest=await crypto.subtle.digest('SHA-256',enc.encode(`civweave.creator-provenance-internal.v1\0${source}`));return b64(digest)}
async function secretEqual(left,right){const [a,b]=await Promise.all([crypto.subtle.digest('SHA-256',enc.encode(String(left||''))),crypto.subtle.digest('SHA-256',enc.encode(String(right||'')))]),aa=new Uint8Array(a),bb=new Uint8Array(b);let diff=aa.length^bb.length;for(let i=0;i<Math.min(aa.length,bb.length);i++)diff|=aa[i]^bb[i];return diff===0}

export class CivweaveCloudNode extends BaseCloudNode {
  async provenanceSamplingSecret(nodeId){const identity=await this.identity(),privatePart=clean(identity?.privateJwk?.d,4000);if(!privatePart)throw new Error('Guild provenance sampling identity is unavailable.');const digest=await crypto.subtle.digest('SHA-256',enc.encode(`civweave.creator-audit-salt.v1\n${nodeId}\n${privatePart}`));return b64(digest)}
  async authorizeProvenanceInternal(request){const supplied=clean(request.headers.get('x-civweave-internal-provenance'),5000),expected=await internalToken(this.env);return secretEqual(supplied,expected)}
  async creatorProvenanceInternal(request,nodeId){
    if(!await this.authorizeProvenanceInternal(request))return json({ok:false,error:'forbidden'},403);
    const url=new URL(request.url),storage=this.state.storage;
    try{
      if(url.pathname==='/internal/creator-provenance/receipt'&&request.method==='POST'){
        const input=await request.json().catch(()=>({}));await storage.put(NODE_KEY,nodeId);const result=await ingestCreationReceipt(storage,nodeId,input.object);return json({ok:true,...result},result.stored?201:200);
      }
      if(url.pathname==='/internal/creator-provenance/audit/latest'&&request.method==='GET')return json({ok:true,nodeId,audit:await readLatestGuildAudit(storage)});
      if(url.pathname==='/internal/creator-provenance/audit/policy'&&request.method==='POST'){const input=await request.json().catch(()=>({}));return json({ok:true,nodeId,policy:await setGuildAuditPolicy(storage,input.policy||input)});}
      if(url.pathname==='/internal/creator-provenance/audit/run'&&request.method==='POST'){await storage.put(NODE_KEY,nodeId);const result=await runGuildDailyAudit(storage,nodeId,await this.provenanceSamplingSecret(nodeId));await pruneGuildAuditStorage(storage);return json({ok:true,nodeId,audit:result});}
      return json({ok:false,error:'Not found.'},404);
    }catch(error){return json({ok:false,error:String(error?.message||error)},Number.isSafeInteger(error?.status)?error.status:500)}
  }
  async alarm(alarmInfo){
    if(typeof super.alarm==='function')await super.alarm(alarmInfo);
    const nodeId=clean(await this.state.storage.get(NODE_KEY),180);if(!nodeId)return;
    try{await runGuildDailyAudit(this.state.storage,nodeId,await this.provenanceSamplingSecret(nodeId));await pruneGuildAuditStorage(this.state.storage);}
    catch(error){console.error('[Civweave] Guild provenance audit alarm failed',error);await this.state.storage.setAlarm(Date.now()+60*60*1000);}
  }
  async fetch(request){const url=new URL(request.url),nodeId=clean(request.headers.get('x-civweave-node-id')||url.searchParams.get('nodeId')||await this.state.storage.get(NODE_KEY),180);if(url.pathname.startsWith('/internal/creator-provenance/')){if(!nodeId)return json({ok:false,error:'nodeId is required.'},400);return this.creatorProvenanceInternal(request,nodeId)}return super.fetch(request)}
}

export async function creatorProvenanceInternalToken(env){return internalToken(env)}

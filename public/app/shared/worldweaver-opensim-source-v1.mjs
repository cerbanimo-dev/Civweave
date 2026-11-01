/**
 * Optional, read-only OpenSimulator region-module export client.
 * It is NOT the OpenSim grid/viewer protocol. An OpenSim operator must expose
 * the permission-filtered civweave.opensim-region-geometry.v1 JSON export on
 * the user's loopback interface, with explicit CORS for the Civweave origin.
 * Never send Guild credentials, model tokens, cookies or remote URLs to it.
 */
import {buildOpenSimGeometry} from './worldweaver-opensim-geometry-v1.mjs';

const MAX_JSON_BYTES=2_000_000;
export function normalizeOpenSimBridgeUrl(input){
 const raw=String(input||'').trim();
 if(!raw||raw.length>300)throw new TypeError('Enter a loopback OpenSim region-export URL.');
 let url;
 try{url=new URL(raw)}catch{throw new TypeError('Enter a valid OpenSim bridge URL.')}
 if(url.protocol!=='http:'||!['localhost','127.0.0.1','[::1]'].includes(url.hostname))
   throw new TypeError('OpenSim bridge must be served on HTTP loopback, not a remote address.');
 if(url.username||url.password||url.search||url.hash)
   throw new TypeError('OpenSim bridge URL cannot include credentials, query tokens, or fragments.');
 if(!url.port||Number(url.port)<1024)throw new TypeError('Choose an explicit unprivileged loopback port.');
 return url.toString();
}
export function parseOpenSimRegion(input){
 if(!input||input.source!=='opensim-region-module')
   throw new TypeError('An authorized OpenSim region-module export is required, not a simulated scene.');
 const geometry=buildOpenSimGeometry(input);
 if(!geometry.faces.length)throw new TypeError('OpenSim export has no renderable geometry.');
 return geometry;
}
export async function connectOpenSimRegion(endpoint,{fetcher=fetch,timeoutMs=12000}={}){
 const url=normalizeOpenSimBridgeUrl(endpoint);
 const response=await fetcher(url,{method:'GET',headers:{Accept:'application/json'},
   credentials:'omit',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(timeoutMs)});
 if(!response.ok)throw new Error('OpenSim bridge returned HTTP '+response.status+'.');
 const size=Number(response.headers?.get?.('content-length')||0);
 if(size>MAX_JSON_BYTES)throw new Error('OpenSim region export is too large.');
 const body=await response.text();
 if(body.length>MAX_JSON_BYTES)throw new Error('OpenSim region export is too large.');
 let json;
 try{json=JSON.parse(body)}catch{throw new TypeError('OpenSim bridge did not return valid region JSON.')}
 return parseOpenSimRegion(json);
}


const rootFromRegion=endpoint=>new URL('/',
 normalizeOpenSimBridgeUrl(endpoint));
const checkToken=token=>{
 if(typeof token!=='string'||!/^[a-f0-9]{64}$/i.test(token))
  throw new TypeError('Paste the 64-character browser control token printed by the local bridge.');
 return token;
};
const readActionReply=async(response)=>{
 let body=null;
 try{body=await response.json()}catch{}
 if(!response.ok)throw new Error(body?.error||'OpenSim controller returned HTTP '+response.status);
 return body;
};
export async function getOpenSimLiveStatus(endpoint,{fetcher=fetch,timeoutMs=7000}={}){
 const target=new URL('status',rootFromRegion(endpoint)).toString();
 const result=await readActionReply(await fetcher(target,{method:'GET',
  credentials:'omit',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(timeoutMs)}));
 if(result?.schema!=='civweave.opensim-live-status.v1'||typeof result.controllerConnected!=='boolean')
  throw new TypeError('The local bridge did not return a compatible OpenSim live-control status.');
 return result;
}
export async function submitOpenSimCommand(endpoint,{token,requestId,regionId,personaId,tool,args}={},
 {fetcher=fetch,timeoutMs=7000}={}){
 checkToken(token);
 if(typeof requestId!=='string'||!/^[A-Za-z0-9_-]{2,90}$/.test(requestId)||
  typeof regionId!=='string'||!/^[A-Za-z0-9_-]{2,90}$/.test(regionId)||
  !['aphra','jae','anthony','rosa','sana','kit','farah','kami'].includes(personaId)||
  !['move','speak'].includes(tool))
   throw new TypeError('Invalid OpenSim pilot command.');
 if(tool==='move'&&(!args||![args.x,args.y,args.z].every(Number.isFinite)||
   args.x<0||args.x>256||args.y<0||args.y>256||args.z<0||args.z>4096))
   throw new TypeError('Move coordinates must be finite, inside the selected OpenSim region.');
 if(tool==='speak'&&(!args||typeof args.text!=='string'||!args.text.trim()||args.text.length>300))
   throw new TypeError('OpenSim speech must be 1–300 characters.');
 const response=await fetcher(new URL('command',rootFromRegion(endpoint)).toString(),{
  method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
  body:JSON.stringify({requestId,regionId,personaId,tool,args}),credentials:'omit',
  redirect:'error',cache:'no-store',signal:AbortSignal.timeout(timeoutMs)
 });
 const data=await readActionReply(response);
 if(data?.requestId!==requestId||!['queued','delivered','completed','failed','expired'].includes(data.state))
  throw new TypeError('OpenSim bridge returned an invalid action receipt.');
 return data;
}
export async function getOpenSimActionReceipt(endpoint,requestId,token,{fetcher=fetch,timeoutMs=7000}={}){
 checkToken(token);
 if(typeof requestId!=='string'||!/^[A-Za-z0-9_-]{2,90}$/.test(requestId))
  throw new TypeError('Invalid OpenSim command identifier.');
 const data=await readActionReply(await fetcher(new URL('command/'+requestId,rootFromRegion(endpoint)).toString(),{
  method:'GET',headers:{Authorization:'Bearer '+token},credentials:'omit',
  cache:'no-store',redirect:'error',signal:AbortSignal.timeout(timeoutMs)
 }));
 if(data?.requestId!==requestId||!['queued','delivered','completed','failed','expired'].includes(data.state))
  throw new TypeError('OpenSim bridge returned an invalid action receipt.');
 return data;
}

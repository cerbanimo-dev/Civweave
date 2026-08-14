import baseWorker,{CivweaveCloudNode,CivweaveCapacityAccount}from'./server-ai-entry-v2.mjs';
export{CivweaveCloudNode,CivweaveCapacityAccount};
const clean=(value,max=4000)=>String(value??'').trim().slice(0,max);
function sharing(input={}){
  const mode=clean(input.shareMode,40).toLowerCase()==='node-equal'?'node-equal':'personal';
  if(mode==='node-equal')return{shareMode:mode,shareBps:10000};
  const shareBps=input.shareBps==null||String(input.shareBps).trim()===''?100:Number(input.shareBps);
  if(!Number.isSafeInteger(shareBps)||shareBps<100||shareBps>500)throw Object.assign(new RangeError('Top-up community share must be between 1% and 5%.'),{status:400});
  return{shareMode:mode,shareBps};
}
async function capacityPost(env,pathname,body){const stub=env.CAPACITY?.get(env.CAPACITY.idFromName('civweave-account'));if(!stub)throw Object.assign(new Error('Capacity binding is unavailable.'),{status:503});const response=await stub.fetch(`https://capacity.internal${pathname}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const payload=await response.json().catch(()=>({}));if(!response.ok)throw Object.assign(new Error(payload.error||`Capacity returned HTTP ${response.status}.`),{status:response.status});return payload;}
function responseWith(source,payload,status=source.status){const headers=new Headers(source.headers);headers.set('content-type','application/json; charset=utf-8');headers.set('cache-control','no-store');return new Response(JSON.stringify(payload),{status,headers});}
export default{async fetch(request,env,ctx){const url=new URL(request.url);
  if(url.pathname==='/api/commerce/options'&&request.method==='GET'){
    const response=await baseWorker.fetch(request,env,ctx),payload=await response.clone().json().catch(()=>null);
    if(!response.ok||!payload)return response;
    return responseWith(response,{...payload,topup:{...(payload.topup||{}),minimumCommunityShareBps:100,maximumCommunityShareBps:500,defaultCommunityShareBps:100,communityShareModes:['personal','node-equal'],nodeEqualMeaning:'All system compute value from this top-up is shared equally through the node pool.'}});
  }
  if(url.pathname==='/api/commerce/topup'&&request.method==='POST'){
    let requestedSharing;
    try{requestedSharing=sharing(await request.clone().json().catch(()=>({})));}catch(error){return Response.json({ok:false,error:String(error?.message||error)},{status:Number.isSafeInteger(error?.status)?error.status:400,headers:{'cache-control':'no-store'}});}
    const response=await baseWorker.fetch(request,env,ctx),payload=await response.clone().json().catch(()=>null);
    if(!response.ok||!payload)return response;
    const topup=payload.topup||payload.checkout,topupId=clean(topup?.topupId,240),nodeId=clean(topup?.nodeId,180),userId=clean(topup?.userId,180);
    if(!topupId||!nodeId||!userId)return responseWith(response,{ok:false,error:'Top-up checkout did not return the identifiers required to bind community sharing.'},502);
    try{const preference=await capacityPost(env,'/topups/share-preference',{topupId,nodeId,userId,...requestedSharing});return responseWith(response,{...payload,communitySharing:preference});}
    catch(error){return responseWith(response,{ok:false,error:String(error?.message||error),retryable:true},Number.isSafeInteger(error?.status)?error.status:503);}
  }
  return baseWorker.fetch(request,env,ctx);
},async scheduled(controller,env,ctx){if(typeof baseWorker.scheduled==='function')return baseWorker.scheduled(controller,env,ctx);}};

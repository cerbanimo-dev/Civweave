import {registerPublicGuildEdge} from './guild-directory.mjs';

const VERSION='civweave-public-guild-directory-v1';
const clean=(value,max=4000)=>String(value??'').trim().slice(0,max);
const headers={
  'content-type':'application/json; charset=utf-8',
  'cache-control':'no-store',
  'access-control-allow-origin':'*',
  'access-control-allow-methods':'GET, POST, OPTIONS',
  'access-control-allow-headers':'content-type',
};
const json=(value,status=200)=>new Response(JSON.stringify(value,null,2),{status,headers});

function parseJson(value,fallback){try{return JSON.parse(value??'')??fallback}catch{return fallback}}

async function listNodes(env,request){
  if(!env?.DB?.prepare)throw Object.assign(new Error('Guild directory storage is unavailable.'),{status:503});
  const url=new URL(request.url),requested=Number(url.searchParams.get('limit')||100),limit=Math.max(1,Math.min(250,Number.isFinite(requested)?Math.floor(requested):100));
  const result=await env.DB.prepare(`SELECT node_id, operator_id, display_name, runtime, public_origin, capabilities_json, location_json, status, updated_at
    FROM nodes WHERE status != 'retired' ORDER BY updated_at DESC LIMIT ?1`).bind(limit).all();
  const rows=Array.isArray(result?.results)?result.results:[];
  const nodes=rows.map(row=>({
    nodeId:clean(row.node_id,180),
    operatorId:clean(row.operator_id,300),
    displayName:clean(row.display_name,300),
    runtime:clean(row.runtime,120),
    publicOrigin:clean(row.public_origin,2000),
    capabilities:Array.isArray(parseJson(row.capabilities_json,[]))?parseJson(row.capabilities_json,[]):[],
    location:parseJson(row.location_json,null),
    status:clean(row.status,40)||'active',
    updatedAt:clean(row.updated_at,80)||null,
  })).filter(node=>node.nodeId&&node.publicOrigin);
  return json({schema:'civweave.core-node-directory.v1',ok:true,service:VERSION,nodes,count:nodes.length,generatedAt:new Date().toISOString()});
}

export default{
  async fetch(request,env){
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
    const url=new URL(request.url);
    try{
      if(request.method==='GET'&&url.pathname==='/api/health')return json({ok:true,service:VERSION,d1:Boolean(env?.DB),publicGuildDirectory:true});
      if(request.method==='GET'&&url.pathname==='/api/nodes')return await listNodes(env,request);
      if(request.method==='POST'&&url.pathname==='/api/guild-directory/register'){
        const input=await request.json().catch(()=>({}));
        return json({ok:true,registration:await registerPublicGuildEdge(env,input)},201);
      }
      return json({ok:false,error:'Not found.'},404);
    }catch(error){return json({ok:false,error:String(error?.message||error)},Number.isSafeInteger(error?.status)?error.status:500)}
  }
};

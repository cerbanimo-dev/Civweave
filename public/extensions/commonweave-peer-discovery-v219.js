(()=>{
'use strict';
const VERSION='1.0.7-peer-discovery-v219';
const SETTINGS_KEY='commonweave.peer-discovery.settings.v219';
const NODES_KEY='commonweave.peer-discovery.nodes.v219';
const PEERS_KEY='commonweave.peer-discovery.peers.v219';
const REVISIONS_KEY='commonweave.peer-discovery.revisions.v219';
const ANNOUNCED_KEY='commonweave.peer-discovery.announced.v219';
const SHARES_KEY='commonweave.peer-discovery.node-shares.v219';
const CORE_URL='/app/shared/commonweave-peer-discovery-core-v219.mjs';
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const read=(key,fallback)=>parse(localStorage.getItem(key),fallback);
const write=(key,value)=>(localStorage.setItem(key,JSON.stringify(value)),value);
const now=()=>new Date().toISOString();
const clean=(value,max=500)=>String(value??'').trim().slice(0,max);
const list=value=>Array.isArray(value)?value:[];
const corePromise=import(CORE_URL);
let timer=null;
let running=null;

function event(type,detail={}){
  try{dispatchEvent(new CustomEvent(type,{detail:{...detail,at:now(),version:VERSION}}))}catch{}
}

function loadScript(src,ready){
  if(ready?.())return Promise.resolve(true);
  const path=new URL(src,location.href).pathname;
  const existing=[...document.scripts].find(script=>script.src&&new URL(script.src).pathname===path);
  if(existing)return new Promise((resolve,reject)=>{
    let ticks=0;
    const check=setInterval(()=>{
      if(ready?.()){clearInterval(check);resolve(true)}
      else if(++ticks>200){clearInterval(check);reject(new Error(`${path} loaded without becoming ready.`))}
    },50);
  });
  return new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src=src;
    script.async=false;
    script.onload=()=>ready?.()?resolve(true):reject(new Error(`${path} loaded without becoming ready.`));
    script.onerror=()=>reject(new Error(`Could not load ${path}.`));
    document.head.append(script);
  });
}

async function ensureRuntime(){
  const core=await corePromise;
  await loadScript('/extensions/commonweave-qr-v156.js',()=>globalThis.CommonweaveQRV156);
  await loadScript('/extensions/commonweave-mesh-tools-v156.js',()=>globalThis.CommonweaveMeshToolsV156);
  const tools=globalThis.CommonweaveMeshToolsV156;
  const mesh=await tools.ensureMesh();
  return{core,tools,mesh};
}

async function settings(){
  const {core,tools}=await ensureRuntime();
  const saved=read(SETTINGS_KEY,{});
  return core.normalizeSettings({...saved,label:saved.label||tools.config().label||'My Commonweave'});
}

async function setSettings(input={}){
  const {core}=await ensureRuntime();
  const current=await settings();
  const next=core.normalizeSettings({...current,...input,services:{...current.services,...(input.services||{})}});
  write(SETTINGS_KEY,next);
  schedule(next);
  event('commonweave:peer-discovery-settings',{settings:next});
  if(next.enabled)announceAndScan({force:true}).catch(error=>event('commonweave:peer-discovery-error',{error:error.message}));
  return next;
}

async function nodes(){
  const {core,tools}=await ensureRuntime();
  return core.buildNodeCatalog({
    configuredNode:tools.config(),
    friends:tools.friends(),
    savedNodes:list(read(NODES_KEY,[])),
    baseUrl:location.href,
  });
}

async function addNode(input,label='Shared Commonweave node'){
  const {core}=await ensureRuntime();
  const card=typeof input==='object'&&input?.schema?core.parseNodeCard(input,location.href):core.createNodeCard({url:input,label},location.href);
  const saved=list(read(NODES_KEY,[]));
  const next={url:card.url,label:card.label,source:'manual',addedAt:now()};
  const index=saved.findIndex(node=>{try{return core.normalizeNodeUrl(node.url,location.href)===card.url}catch{return false}});
  if(index<0)saved.push(next);else saved[index]={...saved[index],...next};
  write(NODES_KEY,saved.slice(0,30));
  event('commonweave:peer-discovery-node-added',{node:next});
  return next;
}

async function removeNode(url){
  const {core}=await ensureRuntime();
  const normalized=core.normalizeNodeUrl(url,location.href);
  const saved=list(read(NODES_KEY,[])).filter(node=>{try{return core.normalizeNodeUrl(node.url,location.href)!==normalized}catch{return false}});
  write(NODES_KEY,saved);
  event('commonweave:peer-discovery-node-removed',{url:normalized});
  return nodes();
}

function hash(value){
  let result=2166136261;
  for(const character of String(value)){result^=character.charCodeAt(0);result=Math.imul(result,16777619)}
  return(result>>>0).toString(36);
}

function headersFor(nodeUrl,tools){
  const headers={'content-type':'application/json'};
  const configured=tools.config();
  try{if(new URL(configured.url).origin===new URL(nodeUrl).origin&&configured.token)headers.authorization=`Bearer ${configured.token}`}catch{}
  return headers;
}

async function requestJson(url,options={},timeoutMs=12000){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const response=await fetch(url,{...options,signal:controller.signal,cache:'no-store'});
    const payload=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(payload.error||`Node returned ${response.status}.`);
    return payload;
  }catch(error){
    if(error?.name==='AbortError')throw new Error('The Commonweave node did not respond in time.');
    throw error;
  }finally{clearTimeout(timeout)}
}

async function postEnvelope(nodeUrl,envelope,tools){
  const endpoint=new URL('/api/envelopes',`${nodeUrl}/`);
  const payload=await requestJson(endpoint,{method:'POST',headers:headersFor(nodeUrl,tools),body:JSON.stringify(envelope)});
  return payload.envelope||payload;
}

async function readEnvelopes(nodeUrl,tools,nodeId=''){
  const endpoint=new URL('/api/envelopes',`${nodeUrl}/`);
  endpoint.searchParams.set('limit','200');
  if(nodeId)endpoint.searchParams.set('nodeId',nodeId);
  const payload=await requestJson(endpoint,{headers:headersFor(nodeUrl,tools)});
  return list(payload.envelopes);
}

async function announce(options={}){
  const {core,tools,mesh}=await ensureRuntime();
  const current=await settings();
  if(!current.enabled&&!options.force)return{announced:0,skipped:true,results:[]};
  const owner=await mesh.credential();
  const friends=tools.friends();
  const catalog=await nodes();
  const revisions=read(REVISIONS_KEY,{});
  const last=read(ANNOUNCED_KEY,{});
  const results=[];
  for(const node of catalog){
    const previous=Date.parse(last[node.url]||0);
    if(!options.force&&Number.isFinite(previous)&&Date.now()-previous<60000){results.push({url:node.url,status:'rate-limited'});continue}
    try{
      const recipients=current.visibility==='public'?['*']:friends.map(friend=>friend.id).filter(Boolean).slice(0,100);
      if(!recipients.length){results.push({url:node.url,status:'no-paired-peers'});continue}
      const announcedAt=Date.now();
      let expiresAt='';
      for(const recipient of recipients){
        const key=hash(`${node.url}\n${recipient}`);
        const revision=Math.max(1,Number(revisions[key]||0)+1);
        const object=await mesh.createObject({
          id:`presence:${owner.fingerprint}:${key}`,
          revision,
          kind:core.PRESENCE_KIND,
          purpose:'announce an opt-in Commonweave peer on a shared node',
          payload:core.buildPresencePayload({peerId:owner.id,settings:current,now:announcedAt}),
          consent:recipient==='*'?'federated':'direct',
          audience:recipient==='*'?[]:[recipient],
          expiresAt:new Date(announcedAt+current.ttlMinutes*60000).toISOString(),
          hopLimit:1,
          publish:false,
        });
        await postEnvelope(node.url,{
          schema:'commonweave.peer-presence-envelope.v1',
          from:owner.id,
          to:recipient,
          kind:'peer-presence-v1',
          subject:'Commonweave shared-node presence',
          correlationId:object.id,
          payload:object,
        },tools);
        revisions[key]=revision;
        expiresAt=object.expiresAt;
      }
      last[node.url]=now();
      results.push({url:node.url,status:'announced',recipients:recipients.length,expiresAt});
    }catch(error){results.push({url:node.url,status:'error',error:clean(error.message,300)})}
  }
  write(REVISIONS_KEY,revisions);
  write(ANNOUNCED_KEY,last);
  const announced=results.filter(result=>result.status==='announced').length;
  event('commonweave:peer-presence-announced',{announced,results});
  return{announced,results};
}

async function processNodeShares(){
  const {core,mesh}=await ensureRuntime();
  const localId=await mesh.deviceId();
  const objects=await mesh.listObjects();
  const stored=list(read(SHARES_KEY,[]));
  const known=new Set(stored.map(item=>item.objectId));
  let added=0;
  for(const object of objects){
    if(object?.kind!==core.NODE_CARD_SCHEMA||object.origin?.nodeId===localId||!list(object.audience).includes(localId)||known.has(object.id))continue;
    try{
      const card=core.parseNodeCard(object.payload,location.href);
      stored.unshift({objectId:object.id,fromPeerId:object.origin.nodeId,card,status:'pending',receivedAt:object.receivedAt||object.updatedAt||now()});
      known.add(object.id);added++;
    }catch{}
  }
  if(added)write(SHARES_KEY,stored.slice(0,100));
  return{added,shares:stored};
}

async function scan(options={}){
  if(running)return running;
  running=(async()=>{
    const {core,tools,mesh}=await ensureRuntime();
    const current=await settings();
    const owner=await mesh.credential();
    const friends=tools.friends();
    const catalog=await nodes();
    const records=[];
    const nodeResults=[];
    for(const node of catalog){
      try{
        const [publicRows,directRows]=await Promise.all([readEnvelopes(node.url,tools),readEnvelopes(node.url,tools,owner.id)]);
        const seen=new Set(),rows=[];
        for(const envelope of [...publicRows,...directRows]){
          const key=envelope.id||`${envelope.from||''}:${envelope.to||''}:${envelope.correlationId||''}`;
          if(seen.has(key))continue;seen.add(key);rows.push(envelope);
        }
        let accepted=0,rejected=0;
        for(const envelope of rows){
          const record=core.extractPresence(envelope,node.url);
          if(!record)continue;
          const validation=await mesh.validateObject(record.object);
          if(!validation.ok){rejected++;continue}
          records.push(record);accepted++;
        }
        nodeResults.push({url:node.url,status:'online',accepted,rejected});
      }catch(error){nodeResults.push({url:node.url,status:'offline',error:clean(error.message,300)})}
    }
    const peers=core.mergePresenceRecords(records,{localPeerId:owner.id,friends,now:Date.now()});
    write(PEERS_KEY,peers.map(peer=>({...peer,object:undefined,seenAt:now()})));
    await tools.syncNode().catch(()=>({received:0,rejected:0}));
    const shares=await processNodeShares();
    event('commonweave:peer-discovery-scan',{peers,nodeResults,shares:shares.added,enabled:current.enabled});
    return{peers,nodeResults,shares:shares.shares};
  })().finally(()=>{running=null});
  return running;
}

async function announceAndScan(options={}){
  const announced=await announce(options);
  const discovered=await scan(options);
  return{...discovered,announced};
}

function peers(){return list(read(PEERS_KEY,[]))}
function receivedNodeShares(){return list(read(SHARES_KEY,[]))}

async function shareNode(url,peerIds=[]){
  const {core,tools}=await ensureRuntime();
  const friendIds=new Set(tools.friends().map(friend=>friend.id));
  const audience=[...new Set(list(peerIds).filter(id=>friendIds.has(id)))];
  if(!audience.length)throw new Error('Choose at least one paired person to receive the node.');
  const catalog=await nodes();
  const node=catalog.find(item=>item.url===core.normalizeNodeUrl(url,location.href));
  const card=core.createNodeCard({url:node?.url||url,label:node?.label||'Shared Commonweave node'},location.href);
  const objects=[];
  for(const peerId of audience)objects.push(await tools.publishObject({
    kind:core.NODE_CARD_SCHEMA,
    purpose:'share a Commonweave rendezvous node with a paired peer',
    payload:card,
    consent:'direct',
    audience:[peerId],
  }));
  event('commonweave:peer-discovery-node-shared',{objectIds:objects.map(object=>object.id),url:card.url,audience});
  return objects;
}

async function acceptNodeShare(objectId){
  const rows=receivedNodeShares();
  const item=rows.find(row=>row.objectId===objectId);
  if(!item)throw new Error('That shared node card is no longer available.');
  await addNode(item.card,item.card.label);
  item.status='accepted';item.decidedAt=now();
  write(SHARES_KEY,rows);
  event('commonweave:peer-discovery-node-share-accepted',{objectId,url:item.card.url});
  return item;
}

function rejectNodeShare(objectId){
  const rows=receivedNodeShares();
  const item=rows.find(row=>row.objectId===objectId);
  if(item){item.status='rejected';item.decidedAt=now();write(SHARES_KEY,rows);event('commonweave:peer-discovery-node-share-rejected',{objectId})}
  return item||null;
}

async function status(){
  const runtime=await ensureRuntime();
  const current=await settings();
  return{
    version:VERSION,
    enabled:current.enabled,
    settings:current,
    peerId:await runtime.mesh.deviceId(),
    nodes:await nodes(),
    peers:peers(),
    friends:runtime.tools.friends(),
    nodeShares:receivedNodeShares(),
  };
}

function schedule(next){
  if(timer){clearInterval(timer);timer=null}
  if(!next?.enabled)return;
  timer=setInterval(()=>{
    if(!document.hidden)announceAndScan().catch(error=>event('commonweave:peer-discovery-error',{error:error.message}));
  },Math.max(2,Number(next.intervalMinutes||4))*60000);
}

async function start(){
  const current=await settings();
  schedule(current);
  if(current.enabled)announceAndScan({force:false}).catch(error=>event('commonweave:peer-discovery-error',{error:error.message}));
  return status();
}

function stop(){if(timer){clearInterval(timer);timer=null}}

addEventListener('online',()=>settings().then(current=>current.enabled&&announceAndScan({force:true})).catch(()=>{}));
addEventListener('focus',()=>settings().then(current=>current.enabled&&announceAndScan()).catch(()=>{}));
addEventListener('commonweave:friend-paired',()=>announceAndScan({force:true}).catch(()=>{}));
addEventListener('commonweave:friend-invite-accepted',()=>announceAndScan({force:true}).catch(()=>{}));

const api=Object.freeze({VERSION,settings,setSettings,nodes,addNode,removeNode,announce,scan,announceAndScan,peers,status,shareNode,receivedNodeShares,acceptNodeShare,rejectNodeShare,processNodeShares,start,stop,ensureRuntime});
globalThis.CommonweavePeerDiscoveryV219=api;
event('commonweave:peer-discovery-ready',{version:VERSION});
start().catch(error=>event('commonweave:peer-discovery-error',{error:error.message}));
})();

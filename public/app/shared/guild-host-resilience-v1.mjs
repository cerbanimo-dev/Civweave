export const GUILD_HOST_RESILIENCE_SCHEMA='civweave.guild-host-resilience.v1';
export const POCKET_NODE_POLICY=Object.freeze({
  schema:GUILD_HOST_RESILIENCE_SCHEMA,
  routeId:'pocket-node',
  premierOnboardingRoute:true,
  maxActiveSyncPeers:4,
  authorizationPersists:true,
  rotation:'priority-then-stalest',
  primaryReplica:'device-local-pocket-guild',
  cloudReplicaOptional:true,
  inheritDownloadOrigin:false,
  persistentAlternatives:Object.freeze(['desktop-docker','raspberry-pi-docker','nas-docker','home-server-docker']),
});
export const EMERGENCY_AI_HOST_POLICY=Object.freeze({
  schema:'civweave.emergency-ai-host-policy.v1',
  optInRequired:true,
  scheduler:'fifo',
  requiredTierIds:Object.freeze(['fast','smart']),
  requiredPerformanceClass:'smooth',
});
export const GUILDKEEPER_POLICY=Object.freeze({
  schema:'civweave.guildkeeper-expansion-policy.v1',
  membersPerGuildkeeper:28,
});
const clean=(value,max=240)=>String(value??'').trim().slice(0,max);
const time=value=>{const parsed=Date.parse(value||'');return Number.isFinite(parsed)?parsed:0};
export function requiredGuildkeeperCount(memberCount){
  const count=Math.max(0,Math.floor(Number(memberCount)||0));
  return Math.max(1,Math.ceil(Math.max(1,count)/GUILDKEEPER_POLICY.membersPerGuildkeeper));
}
export function guildkeeperExpansionDecision({currentMemberCount=0,guildkeeperCount=1,additionalMembers=1}={}){
  const next=Math.max(0,Math.floor(Number(currentMemberCount)||0))+Math.max(0,Math.floor(Number(additionalMembers)||0));
  const required=requiredGuildkeeperCount(next),available=Math.max(0,Math.floor(Number(guildkeeperCount)||0));
  return Object.freeze({allowed:available>=required,nextMemberCount:next,requiredGuildkeepers:required,availableGuildkeepers:available,membersPerGuildkeeper:GUILDKEEPER_POLICY.membersPerGuildkeeper,reason:available>=required?null:'appoint-guildkeeper-before-expansion'});
}
export function splitGuildkeeperEarnings(totalCents,recipientIds=[]){
  const total=Math.max(0,Math.floor(Number(totalCents)||0));
  const ids=[...new Set((Array.isArray(recipientIds)?recipientIds:[]).map(value=>clean(value,180)).filter(Boolean))].sort();
  if(!ids.length)return Object.freeze({totalCents:total,recipientCount:0,allocations:Object.freeze([])});
  const base=Math.floor(total/ids.length),remainder=total%ids.length;
  const allocations=ids.map((recipientId,index)=>Object.freeze({recipientId,cents:base+(index<remainder?1:0)}));
  return Object.freeze({totalCents:total,recipientCount:ids.length,allocations:Object.freeze(allocations)});
}
export function selectPocketSyncWindow(peers=[],{limit=POCKET_NODE_POLICY.maxActiveSyncPeers}={}){
  const capped=Math.max(1,Math.min(16,Math.floor(Number(limit)||POCKET_NODE_POLICY.maxActiveSyncPeers)));
  const authorized=(Array.isArray(peers)?peers:[]).filter(peer=>peer&&peer.authorized!==false&&clean(peer.peerId||peer.id,500));
  const ranked=authorized.map((peer,index)=>({...peer,peerId:clean(peer.peerId||peer.id,500),_index:index})).sort((a,b)=>{
    const dirtyA=a.pending===true||Number(a.pendingCount||0)>0?1:0,dirtyB=b.pending===true||Number(b.pendingCount||0)>0?1:0;
    if(dirtyA!==dirtyB)return dirtyB-dirtyA;
    const syncA=time(a.lastSyncedAt),syncB=time(b.lastSyncedAt);if(syncA!==syncB)return syncA-syncB;
    const seenA=time(a.lastSeenAt),seenB=time(b.lastSeenAt);if(seenA!==seenB)return seenB-seenA;
    return a.peerId.localeCompare(b.peerId)||a._index-b._index;
  }).map(({_index,...peer})=>peer);
  return Object.freeze({limit:capped,active:Object.freeze(ranked.slice(0,capped)),standby:Object.freeze(ranked.slice(capped)),authorizedCount:ranked.length});
}
function smoothPass(record={}){
  if(record.passed===true||record.performanceClass==='smooth')return true;
  const metrics=record.metrics||record;
  const tps=Number(metrics.tokensPerSecond||metrics.benchmarkTokensPerSecond||0),ttft=Number(metrics.ttftMs??metrics.benchmarkTtftMs??0),cold=Number(metrics.coldStartMs||0);
  return record.ok===true&&tps>=4&&(!ttft||ttft<=15000)&&(!cold||cold<=90000)&&record.fallbackUsed!==true;
}
export function evaluateEmergencyAiEligibility({optedIn=false,tierCatalog={},speedChecks={}}={}){
  const failures=[];if(EMERGENCY_AI_HOST_POLICY.optInRequired&&optedIn!==true)failures.push('host-not-opted-in');
  const required=EMERGENCY_AI_HOST_POLICY.requiredTierIds.map(tierId=>{
    const tier=tierCatalog?.[tierId]||null,modelId=clean(tier?.preferredModelIds?.[0]||tier?.primaryModelId,180),check=speedChecks?.[tierId]||speedChecks?.[modelId]||null;
    if(!tier)failures.push(`tier-missing:${tierId}`);else if(!modelId)failures.push(`tier-primary-model-missing:${tierId}`);else if(!check)failures.push(`speed-check-missing:${tierId}`);else if(clean(check.modelId||modelId,180)!==modelId)failures.push(`speed-check-stale:${tierId}`);else if(!smoothPass(check))failures.push(`speed-check-not-smooth:${tierId}`);
    return Object.freeze({tierId,modelId:modelId||null,passed:Boolean(tier&&modelId&&check&&clean(check.modelId||modelId,180)===modelId&&smoothPass(check))});
  });
  return Object.freeze({schema:EMERGENCY_AI_HOST_POLICY.schema,eligible:failures.length===0,optedIn:optedIn===true,scheduler:EMERGENCY_AI_HOST_POLICY.scheduler,required:Object.freeze(required),failures:Object.freeze(failures)});
}
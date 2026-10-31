import {nearPinnedLocation} from './guild-capacity-progression-v1.mjs';

// Non-monetary Guild verification credits. Never convertible to AI neurons or money.
export const CHECK_POLICY=Object.freeze({
  heartbeatGraceMs:15*60*1000,
  removeAfterMs:72*60*60*1000,
  locationEvidenceWindowMs:24*60*60*1000,
  codeMaxAgeMs:120*1000,
  maxProofAttemptsPerUserPerDay:6,
  maxGuildRewardsPerDay:20,
  maxMemberRewardsPerDay:1,
  rewardTokens:1,
  maxRadiusMeters:1000,
  maxAccuracyMeters:500,
  mismatchReportersRequired:2
});
const at=value=>Number.isFinite(Number(value))&&Number(value)>1e12?Number(value):Date.parse(String(value||''));
const valid=time=>Number.isFinite(time)&&time>0;
export function proofFresh(issued,now=Date.now()){
  const date=at(issued);return valid(date)&&now-date>=0&&now-date<=CHECK_POLICY.codeMaxAgeMs;
}
export function locationVerdict(pin,position,now=Date.now()){
  const result=nearPinnedLocation(pin,position,{now,maxRadiusMeters:CHECK_POLICY.maxRadiusMeters,maxAccuracyMeters:CHECK_POLICY.maxAccuracyMeters});
  if(result.ok)return{kind:'near',distanceMeters:result.distanceMeters};
  if(result.reason==='outside-guild-radius')return{kind:'away',distanceMeters:result.distanceMeters};
  return{kind:'unverifiable',reason:result.reason};
}
export function rewardAllowed({memberClaimsToday=0,guildClaimsToday=0}={}){
  return memberClaimsToday<CHECK_POLICY.maxMemberRewardsPerDay&&guildClaimsToday<CHECK_POLICY.maxGuildRewardsPerDay;
}
// Deterministic projection for status, alarm and heartbeat. No location report or coordinate is stored.
export function nodeLiveness(row,now=Date.now()){
  if(row?.nodeState==='removed')return{state:'removed',reason:row.downReason||'expired',downSince:row.downSince||null};
  if(!row?.nodeTokenHash||!row?.lastSeenAt)return{state:'unpaired',reason:null,downSince:null};
  const seen=at(row.lastSeenAt);
  if(!valid(seen))return{state:'unpaired',reason:null,downSince:null};
  const disputes=(Array.isArray(row.disputes)?row.disputes:[])
    .filter(v=>v&&typeof v.userId==='string'&&valid(at(v.at))&&now-at(v.at)>=0&&now-at(v.at)<=CHECK_POLICY.locationEvidenceWindowMs)
    .sort((a,b)=>at(a.at)-at(b.at));
  const unique=new Set(disputes.map(v=>v.userId));
  const mismatch=unique.size>=CHECK_POLICY.mismatchReportersRequired;
  let reason=null,downSince=null;
  if(row.downReason==='location-disputed'&&valid(at(row.downSince))){reason='location-disputed';downSince=at(row.downSince)}
  else if(mismatch){reason='location-disputed';downSince=at(disputes.find(v=>v.userId!==disputes[0].userId)?.at||disputes.at(-1).at)}
  else if(now-seen>CHECK_POLICY.heartbeatGraceMs){reason='heartbeat-stale';downSince=seen+CHECK_POLICY.heartbeatGraceMs}
  if(reason){
    if(now-downSince>=CHECK_POLICY.removeAfterMs)return{state:'removed',reason,downSince:new Date(downSince).toISOString()};
    return{state:'down',reason,downSince:new Date(downSince).toISOString()};
  }
  if(unique.size>0)return{state:'flagged',reason:'single-location-dispute',downSince:null};
  return{state:'online',reason:null,downSince:null};
}

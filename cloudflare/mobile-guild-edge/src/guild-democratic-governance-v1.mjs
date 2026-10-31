// Canonical democratic member action policy. No UI or owner key can override it.
export const GUILD_GOVERNANCE_SCHEMA='civweave.guild-governance.v1';
export const GUILD_GOVERNANCE_ACTIONS=Object.freeze(['transfer-role','remove','ban','lift-ban','report']);
export const GUILD_CONTRIBUTION_WINDOW_MS=30*86400000;
export const GUILD_BALLOT_WINDOW_MS=7*86400000;
export const GUILD_REPORT_RADIUS_KM=25;
export const GUILD_REPORT_REASON_CODES=Object.freeze(['harassment','threats','fraud','impersonation','safety','repeated-disruption','other']);

const reject=(message,status=409)=>Object.assign(new Error(message),{status});
const clean=(v,max=400)=>String(v??'').trim().slice(0,max);
export const validGuildUser=value=>/^[A-Za-z0-9:_-]{12,180}$/.test(String(value??''));
export const majority=n=>Math.floor(n/2)+1;
export function qualifiedContributors(members,receipts,{now=Date.now(),windowMs=GUILD_CONTRIBUTION_WINDOW_MS}={}){
  const earliest=now-windowMs, ids=new Set(members.map(row=>row.userId||row.user_id).filter(validGuildUser));
  const verified=new Set;
  for(const receipt of receipts){
    if(!ids.has(receipt.userId))continue;
    if(!['published-quest','physical-check-in','accepted-work-proof'].includes(receipt.kind))continue;
    const time=Date.parse(receipt.at);
    if(Number.isFinite(time)&&time<=now&&time>=earliest)verified.add(receipt.userId);
  }
  return [...verified].sort();
}
export function activeGuildVoters(members,receipts,{now=Date.now(),windowMs=GUILD_CONTRIBUTION_WINDOW_MS}={}){
  const recentlyProductive=new Set(qualifiedContributors(members,receipts,{now,windowMs}));
  const since=now-windowMs;
  return [...new Set(members.filter(row=>{
    const id=row.userId||row.user_id;
    if(!validGuildUser(id))return false;
    const lastSeen=Date.parse(row.lastSeenAt||row.last_seen_at||'');
    return (Number.isFinite(lastSeen)&&lastSeen>=since&&lastSeen<=now)||recentlyProductive.has(id);
  }).map(row=>row.userId||row.user_id))].sort();
}
export function ballotSpec({action,targetUserId,initiatorUserId,eligible,contributors=eligible,reasonCode='',role='',statement='',now=Date.now()}){
  if(!GUILD_GOVERNANCE_ACTIONS.includes(action))throw reject('Invalid Guild governance action.',400);
  if(!validGuildUser(targetUserId)||!validGuildUser(initiatorUserId))throw reject('Guild member identifiers are invalid.',400);
  if(!contributors.includes(initiatorUserId))throw reject('Only a member with a recent verified contribution may propose moderation.',403);
  if(!eligible.includes(initiatorUserId))throw reject('Proposer must be an active Guild member.',403);
  if(eligible.length===0)throw reject('No active Guild members can form an electorate.');
  if(action==='transfer-role'&&!['guildkeeper','member'].includes(role))throw reject('Choose an approved Guild role.',400);
  if(action==='report'&&!GUILD_REPORT_REASON_CODES.includes(reasonCode))throw reject('Select a bounded report reason.',400);
  if(typeof statement!=='string'||statement.trim().length<20||statement.trim().length>1000)throw reject('Explain the proposed action in 20–1,000 characters for informed voting.',400);
  if(action!=='report'&&targetUserId===initiatorUserId&&action!=='transfer-role')throw reject('Use the normal account departure process for yourself.',400);
  if(eligible.length===1&&eligible.includes(targetUserId)&&['remove','ban','report'].includes(action))
    throw reject('An active contributor cannot be removed, banned or reported by a sole member acting alone.');
  return Object.freeze({action,targetUserId,initiatorUserId,eligible:[...eligible].sort(),
    requiredYes:majority(eligible.length),statement:statement.trim(),createdAt:new Date(now).toISOString(),
    expiresAt:new Date(now+GUILD_BALLOT_WINDOW_MS).toISOString(),role,reasonCode});
}
export function ballotOutcome(ballot,votes,{now=Date.now()}={}){
  if(ballot.status!=='open')return Object.freeze({status:ballot.status,execute:false});
  if(now>Date.parse(ballot.expiresAt))return Object.freeze({status:'expired',execute:false});
  const electorate=new Set(ballot.eligible),yes=new Set, no=new Set;
  for(const vote of votes){
    if(!electorate.has(vote.userId))continue;
    if(vote.choice==='yes'){yes.add(vote.userId);no.delete(vote.userId)}
    if(vote.choice==='no'){no.add(vote.userId);yes.delete(vote.userId)}
  }
  if(yes.size>=ballot.requiredYes)return Object.freeze({status:'approved',execute:true,yes:yes.size,no:no.size});
  if(no.size>electorate.size-ballot.requiredYes)return Object.freeze({status:'rejected',execute:false,yes:yes.size,no:no.size});
  return Object.freeze({status:'open',execute:false,yes:yes.size,no:no.size});
}
export function safeReportReceipt({guildId,ballotId,targetUserId,reasonCode,createdAt,origin},digest){
  if(!GUILD_REPORT_REASON_CODES.includes(reasonCode)||!/^([a-f0-9]{64})$/.test(String(digest||'')))
    throw reject('Cannot publish an unverified peer report.',400);
  // A report is an allegation, NOT a platform-wide ban. Do not broadcast
  // user IDs, names, evidence text, addresses or other personal information.
  return Object.freeze({schema:'civweave.guild-peer-report.v1',guildId:clean(guildId,120),
    ballotId:clean(ballotId,150),origin:clean(origin,2000),subjectPseudonym:digest,
    reasonCode,createdAt,classification:'community-approved-unverified-allegation',
    scope:'nearby-guilds',radiusKm:GUILD_REPORT_RADIUS_KM,
    instructions:'Do not automatically sanction. Independently review with your own Guild members.'});
}

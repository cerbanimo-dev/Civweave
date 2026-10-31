import {capacityForStage,progressForStage,GUILD_MILESTONES} from './guild-capacity-progression-v1.mjs';
import {CHECK_POLICY,nodeLiveness,locationVerdict,rewardAllowed,proofFresh} from './guild-community-proof-v1.mjs';
import {GUILD_STARLING_ROUTE,executeGuildStarlingAction} from './guild-starling-collective-v1.mjs';
import {guildStarlingAction} from './guild-starling-transport-v1.mjs';
import {GUILD_PERSONA_ROUTE,executeGuildPersonaAction} from './guild-persona-campaign-v1.mjs';
import {guildPersonaAction} from './guild-persona-transport-v1.mjs';
import baseWorker,{CivweaveGuildEdgeState,CivweaveGuildCapacityState as BaseGuildCapacityState,CivweaveGuildNodeState} from './index.mjs';
import {GUILD_QUEST_ROUTE,GUILD_QUEST_CORS,guildQuestAction,readGuildQuestInput,executeGuildQuestAction,guildQuestJson,guildQuestError} from './guild-quest-publications-v1.mjs';

export {CivweaveGuildEdgeState,CivweaveGuildNodeState};
const RECEIPT_KIND='civweave.creation-receipt.v1';
const SESSION_SCHEMA='civweave.mobile-guild-capacity-session.v1';
const LOGIN_SCHEMA='civweave.host-node-login.v1';
const DAILY_INCLUDED_NEURONS=900;
const COMMUNITY_SEAT_LIMIT=6;
const MAX_RESIDENTS=28;
const PATRON_SEAT_LIMIT=MAX_RESIDENTS-COMMUNITY_SEAT_LIMIT;
const NODE_HEARTBEAT_GRACE_MS=CHECK_POLICY.heartbeatGraceMs;
const PAIRING_TTL_MS=10*60*1000;
const SESSION_TTL_MS=30*24*60*60*1000;
const DEFAULT_AI_MODEL='@cf/zai-org/glm-4.7-flash';
const MAX_GENERATION_TOKENS=16384;
const WORKERS_INPUT_NEURONS_PER_MILLION=5500;
const WORKERS_OUTPUT_NEURONS_PER_MILLION=36400;
const enc=new TextEncoder();
const dec=new TextDecoder();
const clean=(value,max=12000)=>String(value??'').trim().slice(0,max);
const normalizeNodeId=value=>clean(value,120).toLowerCase().replace(/[^a-z0-9-]/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'');
const b64url=bytes=>{let binary='';for(const byte of new Uint8Array(bytes))binary+=String.fromCharCode(byte);return btoa(binary).replaceAll('+','-').replaceAll('/','_').replace(/=+$/g,'')};
const randomToken=(bytes=48)=>b64url(crypto.getRandomValues(new Uint8Array(bytes)));
const dayKey=(at=Date.now())=>new Date(at).toISOString().slice(0,10);
const nextReset=()=>{const value=new Date();value.setUTCHours(24,0,0,0);return value.toISOString()};
async function shaHex(value){const digest=await crypto.subtle.digest('SHA-256',enc.encode(String(value??'')));return[...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('')}
async function loginCredentialHash(value){const secret=clean(value,400);if(!/^[A-Za-z0-9_-]{40,200}$/.test(secret))throw Object.assign(new Error('A valid device login credential is required.'),{status:400});return shaHex(`civweave.host-login-credential.v1\n${secret}`)}
async function sessionTokenHash(value){const token=clean(value,20000);if(!/^[A-Za-z0-9_-]{40,300}$/.test(token))throw Object.assign(new Error('A valid Guild capacity session is required.'),{status:401});return shaHex(`${SESSION_SCHEMA}\n${token}`)}
function loginUserId(value){const userId=clean(value,180);if(!/^[A-Za-z0-9:_-]{12,180}$/.test(userId))throw Object.assign(new Error('A valid device resident id is required.'),{status:400});return userId}
function bearer(request){const value=clean(request.headers.get('authorization'),20000);return /^Bearer\s+/i.test(value)?value.replace(/^Bearer\s+/i,''):''}
const sessionCors=Object.freeze({'cache-control':'no-store','access-control-allow-origin':'*','access-control-allow-methods':'GET, POST, OPTIONS','access-control-allow-headers':'authorization, content-type, x-civweave-node-id','access-control-max-age':'86400'});
const json=(value,status=200)=>Response.json(value,{status,headers:sessionCors});
function errorResponse(error,fallback=500){return json({ok:false,error:String(error?.message||error)},Number.isSafeInteger(error?.status)?error.status:fallback)}
function receiptGuildId(object){if(object?.kind!==RECEIPT_KIND||object?.consent!=='group'||!Array.isArray(object.audience))return'';const audience=object.audience.find(value=>String(value).startsWith('guild:'));return normalizeNodeId(String(audience||'').slice(6))}
function nodeCloudOrigin(env,nodeId){const explicit=clean(env.CIVWEAVE_NODE_CLOUD_ORIGIN,2000);if(explicit){const value=explicit.includes('{nodeId}')?explicit.replaceAll('{nodeId}',encodeURIComponent(nodeId)):explicit;const url=new URL(value);if(url.protocol!=='https:')throw new Error('Creator provenance node-cloud origin must use HTTPS.');return url.origin}const domain=clean(env.CIVWEAVE_NODE_CLOUD_DOMAIN||'nodes.commonweave.earth',255).toLowerCase().replace(/^\.+|\.+$/g,'');if(!/^[a-z0-9.-]+$/.test(domain))throw new Error('Creator provenance node-cloud domain is invalid.');return`https://${nodeId}.${domain}`}
async function forwardReceipt(env,object){const nodeId=receiptGuildId(object);if(!nodeId)return{forwarded:false,reason:'not-guild-receipt'};const target=new URL('/api/node/creator-provenance/receipt',nodeCloudOrigin(env,nodeId));target.searchParams.set('nodeId',nodeId);const response=await fetch(target,{method:'POST',headers:{'content-type':'application/json','x-civweave-node-id':nodeId},body:JSON.stringify({object})});if(!response.ok){const body=await response.text().catch(()=>'');throw new Error(`Guild provenance receipt forward failed (${response.status})${body?`: ${body.slice(0,300)}`:''}`)}return{forwarded:true,nodeId}}

export class CivweaveGuildCapacityState extends BaseGuildCapacityState{
  async guildStarlingAction({tokenHash,requestedNodeId,action,input}={}){
    if(requestedNodeId&&!this.resolveResidentNode(requestedNodeId))throw Object.assign(new Error('Guild session belongs to a different Guild.'),{status:403});
    const session=this.sessionForHash({tokenHash,requestedNodeId});
    if(!session?.ok)throw Object.assign(new Error(session?.error||'Guild session is invalid.'),{status:session?.status||401});
    return executeGuildStarlingAction(this.ctx.storage,{guildId:this.baseStatus().guildId,nodeId:session.nodeId,userId:session.userId},action,input,{knownMemberCount:this.status().memberCount});
  }
  async guildPersonaAction({tokenHash,requestedNodeId,action,input}={}){
    if(requestedNodeId&&!this.resolveResidentNode(requestedNodeId))
      throw Object.assign(new Error('Persona Guild session belongs to a different Guild.'),{status:403});
    const session=this.sessionForHash({tokenHash,requestedNodeId});
    if(!session?.ok)
      throw Object.assign(new Error(session?.error||'Guild member session is invalid.'),{status:session?.status||401});
    return executeGuildPersonaAction(this.ctx.storage,
      {guildId:this.baseStatus().guildId,nodeId:session.nodeId,userId:session.userId},
      action,input,{nodeId:session.nodeId,guildId:this.baseStatus().guildId});
  }
  async guildQuestAction({tokenHash,requestedNodeId,action,input}={}){
    if(requestedNodeId&&!this.resolveResidentNode(requestedNodeId))throw Object.assign(new Error('Guild capacity session belongs to a different Guild.'),{status:403});
    const session=this.sessionForHash({tokenHash,requestedNodeId});
    if(!session?.ok)throw Object.assign(new Error(session?.error||'Guild session is invalid.'),{status:session?.status||401});
    const guildId=this.baseStatus().guildId;
    return executeGuildQuestAction(this.ctx.storage,{guildId,nodeId:session.nodeId,userId:session.userId},action,input);
  }

  bootstrap(input={}){
    const result=super.bootstrap(input);
    if(input.enableOnboarding===true&&!this.meta('guildOnboardingV1')){
      this.putMeta('guildOnboardingV1',{schema:'civweave.guild-node-onboarding.v1',guildId:result.guildId,stage:0,startedAt:new Date().toISOString(),milestones:[]});
    }
    return this.status();
  }
  onboardingState(){return this.meta('guildOnboardingV1')}
  onboardingStatus(){
    const row=this.onboardingState();
    if(!row)return null; // Legacy Guilds retain their previously established capacity.
    const stage=Math.max(0,Math.min(5,Number(row.stage)||0)),life=nodeLiveness(row),online=life.state==='online'||life.state==='flagged';
    return {schema:row.schema,stage,progressPercent:progressForStage(stage),unlockedSlots:capacityForStage(stage),lockedSlots:10-capacityForStage(stage),maxSlots:10,milestones:GUILD_MILESTONES.map((label,i)=>({step:i+1,label,complete:stage>=i+1})),nodeId:life.state==='removed'?null:(row.nodeId||null),retiredNodeId:life.state==='removed'?(row.retiredNodeId||row.nodeId||null):null,nodeOnline:online,nodeState:life.state,downReason:life.reason,downSince:life.downSince,lastSeenAt:row.lastSeenAt||null,locationVerification:row.locationVerification||null,lastCommunityVerifiedAt:row.lastCommunityVerifiedAt||null,communityProofAvailable:proofFresh(row.communityProofAt),completedAt:row.completedAt||null};
  }
  recordStage(stage,extra={}){
    const current=this.onboardingState();if(!current)throw Object.assign(new Error('This Guild predates the physical-node reward program.'),{status:409});
    const next={...current,...extra,stage:Math.max(current.stage,stage),updatedAt:new Date().toISOString()};
    this.putMeta('guildOnboardingV1',next);
    return this.onboardingStatus();
  }
  async issuePairing(){
    if(!this.onboardingState())throw Object.assign(new Error('This Guild does not have physical-node onboarding enabled.'),{status:409});
    const code=randomToken(32);
    this.putMeta('physicalPairingV1',{hash:await shaHex('civweave.physical-node-pair.v1\\n'+code),expiresAt:Date.now()+PAIRING_TTL_MS});
    return {ok:true,pairingCode:code,expiresInSeconds:600,onboarding:this.onboardingStatus()};
  }
  async connectPhysicalNode({pairingCode,nodeId}={}){
    const pairing=this.meta('physicalPairingV1');
    if(!pairing||Date.now()>pairing.expiresAt||!pairingCode||!/^[-_A-Za-z0-9]{40,200}$/.test(pairingCode)||pairing.hash!==await shaHex('civweave.physical-node-pair.v1\\n'+pairingCode))
      throw Object.assign(new Error('Physical-node pairing code is invalid or expired.'),{status:403});
    const normalized=normalizeNodeId(nodeId);
    if(!normalized||normalized.length<8)throw Object.assign(new Error('Give the physical server a stable node identifier.'),{status:400});
    this.putMeta('physicalPairingV1',null); // One-time use.
    const nodeToken=randomToken(48),nodeTokenHash=await shaHex('civweave.physical-node-auth.v1\\n'+nodeToken),now=new Date().toISOString();
    const onboarding=this.recordStage(1,{nodeId:normalized,nodeTokenHash,lastSeenAt:now,heartbeatCount:1,challenge:randomToken(24),locationVerification:null,nodeState:'online',downSince:null,downReason:null,disputes:[],nearReviews:[],communityProofHash:null,communityProofAt:null});
    await this.schedulePhysicalAlarm();
    return {ok:true,nodeToken,challenge:this.onboardingState().challenge,onboarding};
  }
  async requireNodeToken(token){
    const row=this.onboardingState();
    if(!row?.nodeTokenHash||!/^[A-Za-z0-9_-]{40,300}$/.test(String(token||''))||row.nodeTokenHash!==await shaHex('civweave.physical-node-auth.v1\\n'+token))
      throw Object.assign(new Error('Physical node authorization rejected.'),{status:403});
    if(nodeLiveness(row).state==='removed')throw Object.assign(new Error('This physical server was retired after a sustained outage; re-pair it to restore access.'),{status:410});
    return row;
  }
  async heartbeatPhysicalNode({nodeToken,challengeEcho,meshSyncOk=false,recoveryOk=false,communityProofHash=null}={}){
    const row=await this.requireNodeToken(nodeToken);
    if(communityProofHash!=null&&!/^[a-f0-9]{64}$/.test(String(communityProofHash)))throw Object.assign(new Error('Invalid rolling community proof digest.'),{status:400});
    const count=(Number(row.heartbeatCount)||0)+1;
    let stage=row.stage;
    if(stage>=2&&count>=2)stage=Math.max(stage,3);
    // An authenticated second round trip verifies the node can receive and echo server challenges.
    if(stage>=3&&challengeEcho&&challengeEcho===row.challenge&&meshSyncOk===true&&recoveryOk===true)stage=Math.max(stage,4);
    const challenge=randomToken(24),priorState=nodeLiveness(row);
    const proof=communityProofHash?{communityProofHash,communityProofAt:Date.now(),previousCommunityProofHash:row.communityProofHash,previousCommunityProofAt:row.communityProofAt}:{communityProofHash:null,communityProofAt:null,previousCommunityProofHash:null,previousCommunityProofAt:null};
    const recovery=(priorState.state==='down'&&priorState.reason==='heartbeat-stale')?{downSince:null,downReason:null,nodeState:'online'}:{};
    const onboarding=this.recordStage(stage,{lastSeenAt:new Date().toISOString(),heartbeatCount:count,challenge,...proof,...recovery});
    await this.schedulePhysicalAlarm();
    return {ok:true,challenge,onboarding};
  }
  ensureCommunityProofTables(){
    this.sql.exec('CREATE TABLE IF NOT EXISTS physical_ping_attempts (day TEXT NOT NULL,user_id TEXT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(day,user_id))');
    this.sql.exec('CREATE TABLE IF NOT EXISTS physical_ping_rewards (day TEXT NOT NULL,user_id TEXT NOT NULL,earned_at TEXT NOT NULL,PRIMARY KEY(day,user_id))');
    this.sql.exec('CREATE TABLE IF NOT EXISTS physical_ping_wallets (user_id TEXT PRIMARY KEY,tokens INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL)');
  }
  communityWallet(userId){
    this.ensureCommunityProofTables();
    return Number([...this.sql.exec('SELECT tokens FROM physical_ping_wallets WHERE user_id=?',userId)][0]?.tokens||0);
  }
  pingMemberStatus({tokenHash,requestedNodeId}={}){
    const session=this.sessionForHash({tokenHash,requestedNodeId});
    if(!session.ok)throw Object.assign(new Error(session.error),{status:session.status});
    return {ok:true,account:{verificationTokens:this.communityWallet(session.userId),unit:'nontransferable-guild-verification-token'},onboarding:this.onboardingStatus()};
  }
  async recordCommunityProof({tokenHash,requestedNodeId,code,position,pin}={}){
    const session=this.sessionForHash({tokenHash,requestedNodeId});
    if(!session.ok)throw Object.assign(new Error(session.error),{status:session.status});
    const initial=this.onboardingState(),life=nodeLiveness(initial);
    if(['removed','unpaired'].includes(life.state))throw Object.assign(new Error('No paired physical Guild server is available to verify.'),{status:409});
    const now=Date.now(),day=dayKey(now);
    this.ensureCommunityProofTables();
    const used=Number([...this.sql.exec('SELECT attempts FROM physical_ping_attempts WHERE day=? AND user_id=?',day,session.userId)][0]?.attempts||0);
    if(used>=CHECK_POLICY.maxProofAttemptsPerUserPerDay)throw Object.assign(new Error('Daily verification attempt limit reached.'),{status:429});
    this.sql.exec('INSERT INTO physical_ping_attempts (day,user_id,attempts) VALUES (?,?,1) ON CONFLICT(day,user_id) DO UPDATE SET attempts=attempts+1',day,session.userId);
    const normalized=clean(code,20).toUpperCase();
    if(!/^[A-Z2-7]{8}$/.test(normalized))throw Object.assign(new Error('Enter the eight-character code displayed by the physical server.'),{status:422});
    const hashed=await shaHex('civweave.community-node-code.v1\\n'+normalized);
    const validCurrent=initial.communityProofHash===hashed&&proofFresh(initial.communityProofAt,now);
    const validPrevious=initial.previousCommunityProofHash===hashed&&proofFresh(initial.previousCommunityProofAt,now);
    if(!validCurrent&&!validPrevious)throw Object.assign(new Error('This physical-server code is invalid or expired.'),{status:422});
    const outcome=locationVerdict(pin,position,now);
    if(outcome.kind==='unverifiable')throw Object.assign(new Error('A fresh, accurate enough location reading is required: '+outcome.reason),{status:422});
    if(outcome.kind==='away'){
      const disputes=(Array.isArray(initial.disputes)?initial.disputes:[]).filter(row=>now-Number(row.at)<CHECK_POLICY.locationEvidenceWindowMs&&row.userId!==session.userId);
      disputes.push({userId:session.userId,at:now});
      const next=this.recordStage(initial.stage,{disputes});
      const dispute=nodeLiveness(this.onboardingState());
      if(dispute.state==='down')this.recordStage(initial.stage,{downReason:dispute.reason,downSince:dispute.downSince,nodeState:'down'});
      await this.schedulePhysicalAlarm();
      return {ok:true,verification:'location-disputed',awardedTokens:0,onboarding:this.onboardingStatus(),message:'The authenticated server code was observed outside the claimed Guild location. The node has been flagged for review.'};
    }
    let nextStage=Math.max(initial.stage,2),disputes=initial.disputes||[],nearReviews=(Array.isArray(initial.nearReviews)?initial.nearReviews:[]).filter(row=>now-Number(row.at)<CHECK_POLICY.locationEvidenceWindowMs&&row.userId!==session.userId);
    nearReviews.push({userId:session.userId,at:now});
    const recovered=initial.downReason==='location-disputed'&&new Set(nearReviews.map(v=>v.userId)).size>=2&&now-Date.parse(initial.lastSeenAt||'')<CHECK_POLICY.heartbeatGraceMs;
    const changed={nearReviews,lastCommunityVerifiedAt:new Date(now).toISOString(),locationVerification:{kind:'community-local-code-and-location',confirmedAt:new Date(now).toISOString()},...(recovered?{disputes:[],downReason:null,downSince:null,nodeState:'online'}:{})};
    this.recordStage(nextStage,changed);
    const memberClaims=Number([...this.sql.exec('SELECT COUNT(*) AS count FROM physical_ping_rewards WHERE day=? AND user_id=?',day,session.userId)][0]?.count||0);
    const guildClaims=Number([...this.sql.exec('SELECT COUNT(*) AS count FROM physical_ping_rewards WHERE day=?',day)][0]?.count||0);
    const award=rewardAllowed({memberClaimsToday:memberClaims,guildClaimsToday:guildClaims})?CHECK_POLICY.rewardTokens:0;
    if(award){
      this.sql.exec('INSERT OR IGNORE INTO physical_ping_rewards (day,user_id,earned_at) VALUES (?,?,?)',day,session.userId,new Date(now).toISOString());
      this.sql.exec('INSERT INTO physical_ping_wallets (user_id,tokens,updated_at) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET tokens=tokens+excluded.tokens,updated_at=excluded.updated_at',session.userId,award,new Date(now).toISOString());
    }
    this.sql.exec('DELETE FROM physical_ping_attempts WHERE day<?',dayKey(now-30*86400000));
    this.sql.exec('DELETE FROM physical_ping_rewards WHERE day<?',dayKey(now-30*86400000));
    await this.schedulePhysicalAlarm();
    return {ok:true,verification:'nearby',awardedTokens:award,verificationTokens:this.communityWallet(session.userId),onboarding:this.onboardingStatus()};
  }
  async schedulePhysicalAlarm(){
    const row=this.onboardingState();if(!row?.nodeTokenHash)return;
    const live=nodeLiveness(row);
    const alarmAt=live.state==='down'?Date.parse(live.downSince)+CHECK_POLICY.removeAfterMs:Date.parse(row.lastSeenAt)+CHECK_POLICY.heartbeatGraceMs+1000;
    if(Number.isFinite(alarmAt)&&alarmAt>Date.now())await this.ctx.storage.setAlarm(alarmAt);
    else if(live.state==='removed')await this.retireExpiredPhysicalNode();
  }
  async retireExpiredPhysicalNode(){
    const row=this.onboardingState(),live=nodeLiveness(row);
    if(live.state!=='removed'||row?.nodeState==='removed')return this.onboardingStatus();
    return this.recordStage(row.stage,{nodeState:'removed',downReason:live.reason,downSince:live.downSince,removedAt:new Date().toISOString(),retiredNodeId:row.nodeId,nodeId:null,nodeTokenHash:null,communityProofHash:null,previousCommunityProofHash:null});
  }
  async alarm(){
    await this.retireExpiredPhysicalNode();
    await this.schedulePhysicalAlarm();
  }
  finalizeOnboarding(){
    const row=this.onboardingState();
    if(!row||row.stage<4||nodeLiveness(row).state!=='online')
      throw Object.assign(new Error('Finish secure pairing, sync/recovery checks and a fresh server heartbeat before finalizing.'),{status:409});
    return {ok:true,onboarding:this.recordStage(5,{completedAt:new Date().toISOString()})};
  }
  revokePhysicalNode(){
    const row=this.onboardingState();if(!row)throw Object.assign(new Error('This Guild has no physical-node onboarding.'),{status:409});
    return {ok:true,onboarding:this.recordStage(row.stage,{nodeTokenHash:null,lastSeenAt:null,challenge:null,communityProofHash:null,previousCommunityProofHash:null,nodeState:'unpaired',downReason:null,downSince:null})};
  }
  memberDirectory(){
    this.ensureResidentTables();
    return [...this.sql.exec('SELECT node_id,user_id,seat_class,created_at,last_seen_at FROM resident_members ORDER BY created_at LIMIT 100')].map(row=>({nodeId:row.node_id,userId:row.user_id,seatClass:row.seat_class,createdAt:row.created_at,lastSeenAt:row.last_seen_at}));
  }
  removeResident(userId){
    this.ensureResidentTables();const id=loginUserId(userId);
    const before=Number([...this.sql.exec('SELECT COUNT(*) AS count FROM resident_members WHERE user_id=?',id)][0]?.count||0);
    this.sql.exec('DELETE FROM resident_sessions WHERE user_id=?',id);
    this.sql.exec('DELETE FROM resident_members WHERE user_id=?',id);
    return {ok:true,removed:before>0,capacity:this.status()};
  }
  advanceOnboarding(action,input={}){
    if(action==='finalize')return this.finalizeOnboarding();
    throw Object.assign(new Error('Unknown onboarding milestone action.'),{status:400});
  }
  ensureResidentTables(){
    this.sql.exec('CREATE TABLE IF NOT EXISTS resident_members (node_id TEXT NOT NULL, user_id TEXT NOT NULL, credential_hash TEXT NOT NULL, seat_class TEXT NOT NULL, created_at TEXT NOT NULL, last_seen_at TEXT NOT NULL, PRIMARY KEY(node_id,user_id))');
    this.sql.exec('CREATE INDEX IF NOT EXISTS resident_members_user_idx ON resident_members(user_id)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS resident_sessions (token_hash TEXT PRIMARY KEY, node_id TEXT NOT NULL, user_id TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL)');
    this.sql.exec('CREATE INDEX IF NOT EXISTS resident_sessions_user_idx ON resident_sessions(user_id)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS resident_usage (day TEXT NOT NULL, node_id TEXT NOT NULL, user_id TEXT NOT NULL, neurons INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(day,node_id,user_id))');
  }
  baseStatus(){return super.status()}
  resolveResidentNode(requested=''){
    const base=this.baseStatus(),nodes=Array.isArray(base.starterNodes)?base.starterNodes:[],wanted=normalizeNodeId(requested);
    if(!nodes.length)return'';
    if(!wanted||wanted===normalizeNodeId(base.guildId))return nodes[0].nodeId;
    return nodes.some(row=>row.nodeId===wanted)?wanted:'';
  }
  memberRow(nodeId,userId){return[...this.sql.exec('SELECT node_id,user_id,credential_hash,seat_class,created_at,last_seen_at FROM resident_members WHERE node_id=? AND user_id=? LIMIT 1',nodeId,userId)][0]||null}
  memberByUser(userId){return[...this.sql.exec('SELECT node_id,user_id,credential_hash,seat_class,created_at,last_seen_at FROM resident_members WHERE user_id=? ORDER BY created_at LIMIT 1',userId)][0]||null}
  quotaFor(nodeId,userId){
    this.ensureResidentTables();
    const used=Number([...this.sql.exec('SELECT neurons FROM resident_usage WHERE day=? AND node_id=? AND user_id=? LIMIT 1',dayKey(),nodeId,userId)][0]?.neurons||0),remaining=Math.max(0,DAILY_INCLUDED_NEURONS-used);
    return{usedNeuronsToday:used,includedDailyNeurons:DAILY_INCLUDED_NEURONS,includedUsedNeurons:used,includedRemainingNeurons:remaining,targetIncludedDailyNeurons:DAILY_INCLUDED_NEURONS,communityBonusNeurons:0,targetCommunityBonusNeurons:0,lifetimeRemainingNeurons:0,totalRemainingNeurons:remaining,debtNeurons:0,resetsAt:nextReset()};
  }
  status(){
    this.ensureResidentTables();
    const base=this.baseStatus(),onboarding=this.onboardingStatus(),seatLimit=onboarding?.unlockedSlots||COMMUNITY_SEAT_LIMIT,maxMembers=onboarding?10:MAX_RESIDENTS,memberCount=Number([...this.sql.exec('SELECT COUNT(DISTINCT user_id) AS count FROM resident_members')][0]?.count||0),communityMemberCount=Number([...this.sql.exec("SELECT COUNT(DISTINCT user_id) AS count FROM resident_members WHERE seat_class='community'")][0]?.count||0),paidExpansionCount=Number([...this.sql.exec("SELECT COUNT(DISTINCT user_id) AS count FROM resident_members WHERE seat_class='paid-expansion'")][0]?.count||0),used=Number([...this.sql.exec('SELECT COALESCE(SUM(neurons),0) AS neurons FROM resident_usage WHERE day=?',dayKey())][0]?.neurons||0),totalRemaining=Math.max(0,maxMembers-memberCount),free=Math.min(totalRemaining,Math.max(0,seatLimit-communityMemberCount)),paid=Math.min(totalRemaining,onboarding?0:Math.max(0,PATRON_SEAT_LIMIT-paidExpansionCount)),dailyCeilingNeurons=memberCount*DAILY_INCLUDED_NEURONS;
    return{...base,capacityAvailable:true,workersPlan:'free',memberCount,communityMemberCount,nodeCommunityMembers:communityMemberCount,paidExpansionCount,activePaidMembers:paidExpansionCount,communitySeatLimit:seatLimit,communitySeatsRemaining:free,paidExpansionSeatLimit:onboarding?0:PATRON_SEAT_LIMIT,paidExpansionSeatsRemaining:paid,maxMembers:maxMembers,onboarding,totalSeatsRemaining:totalRemaining,includedDailyNeurons:DAILY_INCLUDED_NEURONS,dailyCeilingNeurons,dailyUsedNeurons:used,dailyRemainingNeurons:Math.max(0,dailyCeilingNeurons-used),slots:{free,paid},residentSessionSchema:SESSION_SCHEMA};
  }
  async joinResident({requestedNodeId,userId,credentialHash,origin}={}){
    this.ensureResidentTables();
    let nodeId=this.resolveResidentNode(requestedNodeId);if(!nodeId)return{ok:false,status:404,error:'Guild starter node not found.'};
    const existingAny=this.memberByUser(userId);let idempotent=false;
    if(existingAny){if(existingAny.credential_hash!==credentialHash)return{ok:false,status:403,error:'This Guild login belongs to a different device credential.'};nodeId=existingAny.node_id;idempotent=true}
    else{
      const members=Number([...this.sql.exec('SELECT COUNT(DISTINCT user_id) AS count FROM resident_members')][0]?.count||0);const seatLimit=this.onboardingStatus()?.unlockedSlots||COMMUNITY_SEAT_LIMIT;if(members>=seatLimit)return{ok:false,status:409,error:'This Guild has no Citizen slots available right now.'};const stamp=new Date().toISOString();this.sql.exec('INSERT INTO resident_members (node_id,user_id,credential_hash,seat_class,created_at,last_seen_at) VALUES (?,?,?,?,?,?)',nodeId,userId,credentialHash,'community',stamp,stamp)
    }
    const stamp=new Date().toISOString(),expiresAt=new Date(Date.now()+SESSION_TTL_MS).toISOString(),token=randomToken();this.sql.exec('UPDATE resident_members SET last_seen_at=? WHERE node_id=? AND user_id=?',stamp,nodeId,userId);this.sql.exec('DELETE FROM resident_sessions WHERE expires_at<=?',stamp);this.sql.exec('INSERT OR REPLACE INTO resident_sessions (token_hash,node_id,user_id,created_at,expires_at) VALUES (?,?,?,?,?)',await sessionTokenHash(token),nodeId,userId,stamp,expiresAt);
    return{ok:true,idempotent,nodeId,userId,seatClass:'community',token,origin:clean(origin,2000),expiresAt,member:{nodeId,userId,seatClass:'community',billingStatus:'free',createdAt:existingAny?.created_at||stamp,lastSeenAt:stamp},quota:this.quotaFor(nodeId,userId),capacity:this.status()};
  }
  sessionForHash({tokenHash,requestedNodeId}={}){
    this.ensureResidentTables();const stamp=new Date().toISOString();this.sql.exec('DELETE FROM resident_sessions WHERE expires_at<=?',stamp);const row=[...this.sql.exec('SELECT token_hash,node_id,user_id,created_at,expires_at FROM resident_sessions WHERE token_hash=? LIMIT 1',tokenHash)][0];if(!row)return{ok:false,status:401,error:'Guild capacity session is invalid or expired.'};const expected=this.resolveResidentNode(requestedNodeId);if(expected&&row.node_id!==expected)return{ok:false,status:403,error:'Guild capacity session belongs to a different starter node.'};const member=this.memberRow(row.node_id,row.user_id);if(!member)return{ok:false,status:401,error:'Guild resident no longer exists.'};return{ok:true,nodeId:row.node_id,userId:row.user_id,seatClass:member.seat_class,expiresAt:row.expires_at,member:{nodeId:row.node_id,userId:row.user_id,seatClass:member.seat_class,billingStatus:'free',createdAt:member.created_at,lastSeenAt:member.last_seen_at},quota:this.quotaFor(row.node_id,row.user_id),capacity:this.status()}
  }
  chargeUsage({tokenHash,requestedNodeId,chargedNeurons=0}={}){
    const session=this.sessionForHash({tokenHash,requestedNodeId});if(!session.ok)return session;const requested=Math.max(0,Math.floor(Number(chargedNeurons)||0)),remaining=Number(session.quota?.includedRemainingNeurons||0),charged=Math.min(requested,remaining);if(charged>0)this.sql.exec('INSERT INTO resident_usage (day,node_id,user_id,neurons) VALUES (?,?,?,?) ON CONFLICT(day,node_id,user_id) DO UPDATE SET neurons=neurons+excluded.neurons',dayKey(),session.nodeId,session.userId,charged);return{...session,chargedNeurons:charged,quota:this.quotaFor(session.nodeId,session.userId),capacity:this.status()}
  }
}

function capacityStub(env){return env.CAPACITY.get(env.CAPACITY.idFromName('guild'))}
function requestedNodeId(request){const url=new URL(request.url),pathMatch=url.pathname.match(/^\/nodes\/([^/]+)\/api\/ai\/node\/generate$/);return normalizeNodeId(pathMatch?.[1]||url.searchParams.get('nodeId')||request.headers.get('x-civweave-node-id'))}
function isGeneratePath(pathname){return pathname==='/api/ai/node/generate'||/^\/nodes\/[^/]+\/api\/ai\/node\/generate$/.test(pathname)}
function isSessionPath(pathname){return pathname==='/api/ai/node/session'}
function aiMessages(input={}){const rows=(Array.isArray(input.messages)?input.messages:[]).slice(-64).map(item=>({role:item?.role==='assistant'?'assistant':item?.role==='system'?'system':'user',content:clean(item?.content,48000)})).filter(item=>item.content);if(clean(input.system,48000)&&!rows.some(item=>item.role==='system'))rows.unshift({role:'system',content:clean(input.system,48000)});if(!rows.length&&clean(input.prompt,48000))rows.push({role:'user',content:clean(input.prompt,48000)});if(!rows.length)rows.push({role:'user',content:'Continue.'});return rows}
function aiOptions(input={}){const maxTokens=Math.max(32,Math.min(MAX_GENERATION_TOKENS,Number(input.max_completion_tokens??input.max_tokens??input.maxTokens??1024)||1024)),options={messages:aiMessages(input),stream:false,max_completion_tokens:maxTokens,temperature:Math.max(0,Math.min(2,Number(input.temperature??0.2)))};if(input.responseFormat==='json')options.response_format={type:'json_object'};if(input.responseSchema&&typeof input.responseSchema==='object')options.response_format={type:'json_schema',json_schema:input.responseSchema};return options}
function resultText(result){if(typeof result==='string')return result;if(typeof result?.response==='string')return result.response;if(typeof result?.text==='string')return result.text;if(typeof result?.result?.response==='string')return result.result.response;if(result?.response&&typeof result.response==='object')return JSON.stringify(result.response);try{return JSON.stringify(result??{})}catch{return String(result??'')}}
function resultObject(result){for(const value of [result?.response,result?.result?.response,result?.output,result?.outputJson])if(value&&typeof value==='object'&&!Array.isArray(value))return value;return null}
function usageTokens(result,input,outputText){const usage=result?.usage||result?.usageMetadata||{},inputTokens=Number(usage.prompt_tokens??usage.input_tokens??usage.promptTokenCount),outputTokens=Number(usage.completion_tokens??usage.output_tokens??usage.candidatesTokenCount);return{inputTokens:Number.isFinite(inputTokens)&&inputTokens>=0?inputTokens:Math.max(1,Math.ceil(JSON.stringify(input).length/4)),outputTokens:Number.isFinite(outputTokens)&&outputTokens>=0?outputTokens:Math.max(1,Math.ceil(clean(outputText,5000000).length/4))}}
function neuronCharge(tokens){return Math.max(1,Math.ceil((tokens.inputTokens*WORKERS_INPUT_NEURONS_PER_MILLION+tokens.outputTokens*WORKERS_OUTPUT_NEURONS_PER_MILLION)/1_000_000))}
async function handleSession(request,env){
  try{const input=request.method==='POST'?await request.json().catch(()=>({})):null,nodeId=requestedNodeId(request),origin=new URL(request.url).origin,stub=capacityStub(env);if(request.method==='POST'){const packet=await stub.joinResident({requestedNodeId:nodeId,userId:loginUserId(input?.userId),credentialHash:await loginCredentialHash(input?.credential),origin});if(!packet?.ok)return json({ok:false,error:packet?.error||'Guild login failed.'},packet?.status||500);return json({ok:true,schema:LOGIN_SCHEMA,nodeId:packet.nodeId,userId:packet.userId,member:packet.member,capacity:packet.capacity,quota:packet.quota,idempotent:packet.idempotent,capacitySession:{schema:SESSION_SCHEMA,token:packet.token,nodeId:packet.nodeId,userId:packet.userId,seatClass:packet.seatClass,origin:packet.origin,expiresAt:packet.expiresAt}},packet.idempotent?200:201)}if(request.method==='GET'){const packet=await stub.sessionForHash({tokenHash:await sessionTokenHash(bearer(request)),requestedNodeId:nodeId});if(!packet?.ok)return json({ok:false,error:packet?.error||'Guild session is invalid.'},packet?.status||401);return json({ok:true,schema:'civweave.host-node-login-status.v1',nodeId:packet.nodeId,userId:packet.userId,member:packet.member,capacity:packet.capacity,quota:packet.quota})}return json({ok:false,error:'Method not allowed.'},405)}catch(error){return errorResponse(error)}
}
async function handleSessionGenerate(request,env){
  const nodeId=requestedNodeId(request),token=bearer(request);let tokenHash;try{tokenHash=await sessionTokenHash(token)}catch{return null}const stub=capacityStub(env),session=await stub.sessionForHash({tokenHash,requestedNodeId:nodeId});if(!session?.ok)return null;if(Number(session.quota?.includedRemainingNeurons||0)<1)return json({ok:false,error:'This Guild resident has no included neurons remaining today.',code:'COMPUTE_PAYMENT_REQUIRED',quota:session.quota},402);if(!env.AI||typeof env.AI.run!=='function')return json({ok:false,error:'Workers AI is not available on this Guild Cloud deployment.'},503);
  try{const input=await request.json().catch(()=>({})),model=clean(input.model||env.CIVWEAVE_DEFAULT_AI_MODEL||DEFAULT_AI_MODEL,220);if(!/^@(cf|hf)\//i.test(model))throw Object.assign(new Error('Choose a valid Workers AI model for this Guild request.'),{status:400});const result=await env.AI.run(model,aiOptions(input)),text=resultText(result),outputJson=resultObject(result),tokens=usageTokens(result,input,text),chargedNeurons=neuronCharge(tokens),charged=await stub.chargeUsage({tokenHash,requestedNodeId:nodeId,chargedNeurons});if(!charged?.ok)return json({ok:false,error:charged?.error||'Guild neuron settlement failed.'},charged?.status||500);return json({ok:true,schema:'civweave.mobile-guild-cloud-generation.v1',nodeId:charged.nodeId,userId:charged.userId,model,text,outputJson,result,usage:{...(result?.usage||{}),inputTokens:tokens.inputTokens,outputTokens:tokens.outputTokens,totalTokens:tokens.inputTokens+tokens.outputTokens,chargedNeurons:charged.chargedNeurons},quota:charged.quota,capacity:charged.capacity})}catch(error){return errorResponse(error,502)}
}

export default{
  async fetch(request,env,ctx){
    const questUrl=new URL(request.url);
    if(questUrl.pathname===GUILD_STARLING_ROUTE||questUrl.pathname.startsWith(GUILD_STARLING_ROUTE+'/')){
      if(request.method==='OPTIONS')return new Response(null,{status:204,headers:GUILD_QUEST_CORS});
      try{const action=guildStarlingAction(request),input=request.method==='POST'?await readGuildQuestInput(request):{},result=await capacityStub(env).guildStarlingAction({tokenHash:await sessionTokenHash(bearer(request)),requestedNodeId:requestedNodeId(request),action,input});return guildQuestJson(result,action==='reserve'&&!result.idempotent?201:200)}catch(error){return guildQuestError(error)}
    }
    if(questUrl.pathname===GUILD_PERSONA_ROUTE||questUrl.pathname.startsWith(GUILD_PERSONA_ROUTE+'/')){
      if(request.method==='OPTIONS')return new Response(null,{status:204,headers:GUILD_QUEST_CORS});
      try{
        const action=guildPersonaAction(request);
        const input=action==='snapshot'?{
          campaignId:questUrl.searchParams.get('campaignId')
        }:await readGuildQuestInput(request);
        const result=await capacityStub(env).guildPersonaAction({
          tokenHash:await sessionTokenHash(bearer(request)),
          requestedNodeId:requestedNodeId(request),action,input
        });
        return guildQuestJson(result,action==='create'?201:200);
      }catch(error){return guildQuestError(error)}
    }
    if(questUrl.pathname===GUILD_QUEST_ROUTE||questUrl.pathname.startsWith(GUILD_QUEST_ROUTE+'/')){
      if(request.method==='OPTIONS')return new Response(null,{status:204,headers:GUILD_QUEST_CORS});
      try{const route=guildQuestAction(request),body=request.method==='POST'?await readGuildQuestInput(request):{},result=await capacityStub(env).guildQuestAction({tokenHash:await sessionTokenHash(bearer(request)),requestedNodeId:requestedNodeId(request),action:route.action,input:{...body,...route.input}});return guildQuestJson(result,result.created?201:200)}catch(error){return guildQuestError(error)}
    }
    const url=new URL(request.url);

    // A verified resident may submit a short-lived code seen locally at the physical node.
    if(url.pathname==='/api/guild/physical/check-in'){
      if(request.method==='OPTIONS')return new Response(null,{status:204,headers:sessionCors});
      try{
        const tokenHash=await sessionTokenHash(bearer(request)),stub=capacityStub(env);
        if(request.method==='GET')return json(await stub.pingMemberStatus({tokenHash,requestedNodeId:requestedNodeId(request)}));
        if(request.method!=='POST')return json({ok:false,error:'Method not allowed'},405);
        const raw=await request.text();if(enc.encode(raw).byteLength>8192)throw Object.assign(new Error('Community verification request too large.'),{status:413});
        let body;try{body=JSON.parse(raw)}catch{throw Object.assign(new Error('Invalid community verification JSON.'),{status:400})}
        const guild=await env.GUILD_STATE.get(env.GUILD_STATE.idFromName('guild')).status();
        if(!guild.location)throw Object.assign(new Error('Guild Map location is not configured.'),{status:409});
        return json(await stub.recordCommunityProof({tokenHash,requestedNodeId:requestedNodeId(request),code:body?.code,position:body?.position,pin:guild.location}));
      }catch(error){return errorResponse(error)}
    }
    if(request.method==='GET'&&url.pathname==='/api/guild/physical/status'){
      try{const on=await capacityStub(env).onboardingStatus();return json({ok:true,onboarding:on?{stage:on.stage,nodeId:on.nodeId,nodeState:on.nodeState,downSince:on.downSince,downReason:on.downReason,lastCommunityVerifiedAt:on.lastCommunityVerifiedAt,communityProofAvailable:on.communityProofAvailable}:null})}catch(error){return errorResponse(error)}
    }
    // Owner authority is independent of the synchronization key and resident sessions.
    if(url.pathname==='/api/guild/manage'){
      if(request.method==='OPTIONS')return new Response(null,{status:204,headers:sessionCors});
      try{
        const token=bearer(request);
        if(!/^[A-Za-z0-9_-]{40,200}$/.test(token))throw Object.assign(new Error('Guild owner authentication required.'),{status:401});
        const digest=await crypto.subtle.digest('SHA-256',enc.encode('civweave.guild-owner-credential.v1\\n'+token));
        const authorized=await env.GUILD_STATE.get(env.GUILD_STATE.idFromName('guild')).authorizedOwner(b64url(digest));
        if(!authorized)throw Object.assign(new Error('Only the founding Guild owner can manage this Guild.'),{status:403});
        const guildState=await env.GUILD_STATE.get(env.GUILD_STATE.idFromName('guild')).status();
        const stub=capacityStub(env);
        if(request.method==='GET')return json({ok:true,guild:{guildId:guildState.guildId,displayName:guildState.displayName,location:guildState.location},capacity:await stub.status(),members:await stub.memberDirectory()});
        if(request.method!=='POST')return json({ok:false,error:'Method not allowed'},405);
        const body=await request.json().catch(()=>({})),action=clean(body.action,60);
        let result;
        if(action==='pair-node')result=await stub.issuePairing();
        else if(action==='finalize')result=await stub.advanceOnboarding('finalize');
        else if(action==='remove-member')result=await stub.removeResident(body.userId);
        else if(action==='revoke-node')result=await stub.revokePhysicalNode();
        else throw Object.assign(new Error('Unknown Guild management action.'),{status:400});
        return json({...result,capacity:await stub.status(),members:await stub.memberDirectory()});
      }catch(error){return errorResponse(error)}
    }
    if(url.pathname==='/api/guild/physical/connect'||url.pathname==='/api/guild/physical/heartbeat'){
      if(request.method==='OPTIONS')return new Response(null,{status:204,headers:sessionCors});
      if(request.method!=='POST')return json({ok:false,error:'Method not allowed'},405);
      try{
        const body=await request.json().catch(()=>({})),stub=capacityStub(env);
        if(url.pathname.endsWith('/connect'))return json(await stub.connectPhysicalNode({pairingCode:body.pairingCode,nodeId:body.nodeId}),201);
        return json(await stub.heartbeatPhysicalNode({nodeToken:bearer(request),challengeEcho:body.challengeEcho,meshSyncOk:body.meshSyncOk,recoveryOk:body.recoveryOk,communityProofHash:body.communityProofHash}));
      }catch(error){return errorResponse(error)}
    }
    if(request.method==='OPTIONS'&&(isSessionPath(url.pathname)||isGeneratePath(url.pathname)))return new Response(null,{status:204,headers:sessionCors});
    if(isSessionPath(url.pathname))return handleSession(request,env);
    if(isGeneratePath(url.pathname)){const sessionResponse=await handleSessionGenerate(request.clone(),env);if(sessionResponse)return sessionResponse}
    let receipt=null;if(request.method==='POST'&&url.pathname==='/api/envelopes'){const input=await request.clone().json().catch(()=>null);if(input?.schema==='civweave.community-object-envelope.v1'&&input?.payload?.kind===RECEIPT_KIND)receipt=input.payload}
    const response=await baseWorker.fetch(request,env,ctx);if(receipt&&response.ok){const work=forwardReceipt(env,receipt).catch(error=>console.error('[Civweave] Creator provenance receipt forwarding failed',error));if(ctx?.waitUntil)ctx.waitUntil(work);else work.catch(()=>{})}return response
  }
};
export{forwardReceipt,nodeCloudOrigin,receiptGuildId};

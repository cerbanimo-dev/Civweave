import {GUILD_GOVERNANCE_SCHEMA,GUILD_CONTRIBUTION_WINDOW_MS,GUILD_BALLOT_WINDOW_MS,
  qualifiedContributors,activeGuildVoters,ballotSpec,ballotOutcome,safeReportReceipt,validGuildUser} from './guild-democratic-governance-v1.mjs';

const fail=(message,status=409)=>Object.assign(new Error(message),{status});
const nowIso=()=>new Date().toISOString();
const safe=(v,n=200)=>String(v??'').trim().slice(0,n);

export function ensureGovernanceTables(sql){
  sql.exec("CREATE TABLE IF NOT EXISTS guild_governance_roles(user_id TEXT PRIMARY KEY, role TEXT NOT NULL CHECK(role IN ('guildkeeper','member')),assigned_at TEXT NOT NULL, ballot_id TEXT NOT NULL)");
  sql.exec("CREATE TABLE IF NOT EXISTS guild_governance_bans(user_id TEXT PRIMARY KEY, credential_hash TEXT, ballot_id TEXT NOT NULL, imposed_at TEXT NOT NULL, expires_at TEXT NOT NULL)");
  sql.exec("CREATE TABLE IF NOT EXISTS guild_governance_contributions(id TEXT PRIMARY KEY, user_id TEXT NOT NULL, kind TEXT NOT NULL, at TEXT NOT NULL)");
  sql.exec("CREATE INDEX IF NOT EXISTS guild_gov_contrib_recent ON guild_governance_contributions(at,user_id)");
  sql.exec("CREATE TABLE IF NOT EXISTS guild_governance_ballots(id TEXT PRIMARY KEY, action TEXT NOT NULL, target_user_id TEXT NOT NULL, proposer_id TEXT NOT NULL, role TEXT, reason_code TEXT, statement TEXT NOT NULL, electorate_json TEXT NOT NULL, required_yes INTEGER NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL, resolved_at TEXT, execution_error TEXT)");
  sql.exec("CREATE TABLE IF NOT EXISTS guild_governance_votes(ballot_id TEXT NOT NULL,user_id TEXT NOT NULL,choice TEXT NOT NULL CHECK(choice IN ('yes','no')),voted_at TEXT NOT NULL,PRIMARY KEY(ballot_id,user_id))");
  sql.exec("CREATE TABLE IF NOT EXISTS guild_governance_reports(ballot_id TEXT PRIMARY KEY,receipt_json TEXT NOT NULL,delivery_state TEXT NOT NULL CHECK(delivery_state IN ('queued','delivered','failed')),attempts INTEGER NOT NULL DEFAULT 0,recipient_count INTEGER NOT NULL DEFAULT 0,delivered_at TEXT)");
  sql.exec("CREATE TABLE IF NOT EXISTS guild_governance_audit(id TEXT PRIMARY KEY,ballot_id TEXT NOT NULL,event TEXT NOT NULL,user_id TEXT NOT NULL,at TEXT NOT NULL)");
}
export function creditVerifiedContribution(sql,{id,userId,kind,at=nowIso()}){
  if(!validGuildUser(userId)||!['published-quest','physical-check-in','accepted-work-proof'].includes(kind)||!id)
    throw fail('Verified contribution source is invalid.',400);
  ensureGovernanceTables(sql);
  // This is called only by the already authenticated server-side proof / quest
  // handlers. There is intentionally NO client write endpoint for these receipts.
  sql.exec('INSERT OR IGNORE INTO guild_governance_contributions(id,user_id,kind,at) VALUES(?,?,?,?)',
    safe(id,220),userId,kind,at);
}
function rows(sql,query,...args){return [...sql.exec(query,...args)]}
function electorateSnapshot(sql,{now=Date.now()}={}){
  ensureGovernanceTables(sql);
  const members=rows(sql,'SELECT user_id,last_seen_at FROM resident_members');
  const receipts=rows(sql,'SELECT user_id,kind,at FROM guild_governance_contributions WHERE at>=?',
    new Date(now-GUILD_CONTRIBUTION_WINDOW_MS).toISOString()).map(row=>({userId:row.user_id,kind:row.kind,at:row.at}));
  return {voters:activeGuildVoters(members,receipts,{now}),
    contributors:qualifiedContributors(members,receipts,{now})};
}
export function electorate(sql,{now=Date.now()}={}){return electorateSnapshot(sql,{now}).voters}
export function delegatedRole(sql,userId){
  ensureGovernanceTables(sql);
  const row=rows(sql,'SELECT role FROM guild_governance_roles WHERE user_id=? LIMIT 1',userId)[0];
  return row?.role==='guildkeeper'?'guildkeeper':'member';
}
export function isBanned(sql,userId,{now=Date.now(),credentialHash=''}={}){
  ensureGovernanceTables(sql);
  const row=rows(sql,'SELECT expires_at FROM guild_governance_bans WHERE (user_id=? OR (credential_hash IS NOT NULL AND credential_hash=?)) AND expires_at>? LIMIT 1',
    userId,credentialHash,new Date(now).toISOString())[0];
  return Boolean(row);
}
function ballotRow(sql,id){
  const row=rows(sql,'SELECT * FROM guild_governance_ballots WHERE id=? LIMIT 1',id)[0];
  if(!row)throw fail('Guild vote not found.',404);
  return row;
}
const viewBallot=row=>({id:row.id,action:row.action,targetUserId:row.target_user_id,
  proposerId:row.proposer_id,role:row.role,reasonCode:row.reason_code,statement:row.statement,
  eligible:JSON.parse(row.electorate_json),requiredYes:Number(row.required_yes),status:row.status,
  createdAt:row.created_at,expiresAt:row.expires_at,resolvedAt:row.resolved_at||null});
function recordAudit(sql,ballotId,event,userId){
  sql.exec('INSERT INTO guild_governance_audit(id,ballot_id,event,user_id,at) VALUES(?,?,?,?,?)',
    crypto.randomUUID(),ballotId,event,userId,nowIso());
}
function applyApproved(sql,row,{guildId,origin}){
  const ballot=viewBallot(row),now=nowIso(),target=row.target_user_id;
  if(row.action==='remove'||row.action==='ban'){
    const member=rows(sql,'SELECT user_id FROM resident_members WHERE user_id=? LIMIT 1',target)[0];
    if(row.action==='ban'){
      const credential=rows(sql,'SELECT credential_hash FROM resident_members WHERE user_id=? LIMIT 1',target)[0]?.credential_hash||null;
      sql.exec('INSERT OR REPLACE INTO guild_governance_bans(user_id,credential_hash,ballot_id,imposed_at,expires_at) VALUES(?,?,?,?,?)',
        target,credential,row.id,now,new Date(Date.parse(now)+90*86400000).toISOString());
    }
    sql.exec('DELETE FROM resident_sessions WHERE user_id=?',target);
    sql.exec('DELETE FROM resident_members WHERE user_id=?',target);
    sql.exec('DELETE FROM guild_governance_roles WHERE user_id=?',target);
    recordAudit(sql,row.id,row.action+(member?'-applied':'-already-absent'),target);
  }else if(row.action==='lift-ban'){
    sql.exec('DELETE FROM guild_governance_bans WHERE user_id=?',target);
    recordAudit(sql,row.id,'ban-lifted-by-majority',target);
  }else if(row.action==='transfer-role'){
    if(!rows(sql,'SELECT user_id FROM resident_members WHERE user_id=? LIMIT 1',target)[0])
      throw fail('Cannot grant a Guildkeeper role to a nonresident.');
    sql.exec('INSERT OR REPLACE INTO guild_governance_roles(user_id,role,assigned_at,ballot_id) VALUES(?,?,?,?)',
      target,row.role,now,row.id);
    recordAudit(sql,row.id,'role-transferred',target);
  }else if(row.action==='report'){
    // Do not broadcast a private member ID. A narrowly scoped pseudonym is
    // stable for this Guild only, never a cross-Guild automated block list.
    // Report delivery is an automatically queued effect of this approved vote.
    // Each report uses an opaque, uniformly random reference; a Guild's
    // internal user ID never enters the inter-Guild bulletin.
    const pseudonym=Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join('');
    const receipt=safeReportReceipt({guildId,ballotId:row.id,targetUserId:target,reasonCode:row.reason_code,
      createdAt:now,origin},pseudonym);
    sql.exec("INSERT OR IGNORE INTO guild_governance_reports(ballot_id,receipt_json,delivery_state) VALUES(?,?,'queued')",
      row.id,JSON.stringify(receipt));
    recordAudit(sql,row.id,'report-queued-for-nearby-guilds',target);
  }
}
function settle(sql,id,{guildId,origin,now=Date.now()}){
  const row=ballotRow(sql,id);
  if(row.status!=='open')return viewBallot(row);
  const votes=rows(sql,'SELECT user_id,choice FROM guild_governance_votes WHERE ballot_id=?',id)
    .map(v=>({userId:v.user_id,choice:v.choice}));
  const outcome=ballotOutcome({...viewBallot(row),status:'open'},votes,{now});
  if(outcome.status==='open')return {...viewBallot(row),yes:outcome.yes,no:outcome.no};
  // The Durable Object executes these statements synchronously in one
  // single-threaded turn. An exception prevents an approved status being
  // returned; no caller can mark a vote approved without applying effects.
  if(outcome.execute)applyApproved(sql,row,{guildId,origin});
  sql.exec('UPDATE guild_governance_ballots SET status=?,resolved_at=? WHERE id=? AND status=?',
    outcome.status,new Date(now).toISOString(),id,'open');
  recordAudit(sql,id,outcome.status,row.proposer_id);
  return {...viewBallot(ballotRow(sql,id)),yes:outcome.yes,no:outcome.no,executed:outcome.execute};
}
export function proposeGovernance(sql,{guildId,origin,actorId,action,targetUserId,reasonCode='',role='',statement='',now=Date.now()}){
  ensureGovernanceTables(sql);
  const members=rows(sql,'SELECT user_id FROM resident_members');
  if(action==='lift-ban'){
    if(!isBanned(sql,targetUserId,{now}))throw fail('A lift-ban vote needs an existing active Guild ban.',409);
  }else if(!members.some(row=>row.user_id===targetUserId))throw fail('Target member must be currently enrolled.',404);
  const {voters:eligible,contributors}=electorateSnapshot(sql,{now});
  const spec=ballotSpec({action,targetUserId,initiatorUserId:actorId,eligible,contributors,reasonCode,role,statement,now});
  if(action==='report'){
    const recentlyApproved=rows(sql,"SELECT id FROM guild_governance_ballots WHERE target_user_id=? AND action='report' AND status='approved' AND resolved_at>=? LIMIT 1",
      targetUserId,new Date(now-30*86400000).toISOString())[0];
    if(recentlyApproved)throw fail('An approved report about this member already exists within the last 30 days.',429);
  }
  const pending=rows(sql,"SELECT id FROM guild_governance_ballots WHERE target_user_id=? AND action=? AND status='open' AND expires_at>? LIMIT 1",
    targetUserId,action,new Date(now).toISOString())[0];
  if(pending)throw fail('An active vote already exists for this member and action.');
  const id='guild-vote:'+crypto.randomUUID();
  sql.exec("INSERT INTO guild_governance_ballots(id,action,target_user_id,proposer_id,role,reason_code,statement,electorate_json,required_yes,status,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
    id,action,targetUserId,actorId,role,reasonCode,spec.statement,JSON.stringify(spec.eligible),spec.requiredYes,'open',
    spec.createdAt,spec.expiresAt);
  recordAudit(sql,id,'proposed',actorId);
  // Sponsoring the proposal is an explicit yes. With a single eligible voter
  // this resolves immediately, unless the sole productive member is targeted.
  sql.exec("INSERT INTO guild_governance_votes(ballot_id,user_id,choice,voted_at) VALUES(?,?,'yes',?)",
    id,actorId,new Date(now).toISOString());
  return settle(sql,id,{guildId,origin,now});
}
export function castGovernanceVote(sql,{guildId,origin,actorId,ballotId,choice,now=Date.now()}){
  ensureGovernanceTables(sql);
  const row=ballotRow(sql,ballotId),spec=viewBallot(row);
  if(spec.status!=='open')throw fail('Vote has already closed.');
  if(!spec.eligible.includes(actorId))throw fail('Only members in the active Guild electorate at proposal time may vote.',403);
  if(!['yes','no'].includes(choice))throw fail('Vote choice must be yes or no.',400);
  if(Date.parse(spec.expiresAt)<=now)return settle(sql,ballotId,{guildId,origin,now});
  sql.exec("INSERT INTO guild_governance_votes(ballot_id,user_id,choice,voted_at) VALUES(?,?,?,?) ON CONFLICT(ballot_id,user_id) DO UPDATE SET choice=excluded.choice,voted_at=excluded.voted_at",
    ballotId,actorId,choice,new Date(now).toISOString());
  recordAudit(sql,ballotId,'voted',actorId);
  return settle(sql,ballotId,{guildId,origin,now});
}
export function governanceStatus(sql,{actorId='',now=Date.now()}={}){
  ensureGovernanceTables(sql);
  const {voters:eligible,contributors}=electorateSnapshot(sql,{now}),ballots=rows(sql,
    'SELECT * FROM guild_governance_ballots ORDER BY created_at DESC LIMIT 40').map(row=>{
      const votes=rows(sql,'SELECT user_id,choice FROM guild_governance_votes WHERE ballot_id=?',row.id);
      const outcome=ballotOutcome({...viewBallot(row),status:'open'},votes.map(v=>({userId:v.user_id,choice:v.choice})),{now});
      return {...viewBallot(row),yes:votes.filter(v=>v.choice==='yes').length,no:votes.filter(v=>v.choice==='no').length,
        myVote:votes.find(v=>v.user_id===actorId)?.choice||null,
        displayedStatus:row.status==='open'&&outcome.status==='expired'?'expired':row.status};
    });
  const bans=rows(sql,'SELECT user_id,expires_at FROM guild_governance_bans WHERE expires_at>?',
    new Date(now).toISOString()).map(row=>({userId:row.user_id,expiresAt:row.expires_at}));
  const outboundReports=rows(sql,'SELECT ballot_id,delivery_state,recipient_count,attempts,delivered_at FROM guild_governance_reports ORDER BY rowid DESC LIMIT 20')
    .map(row=>({ballotId:row.ballot_id,state:row.delivery_state,recipients:Number(row.recipient_count),attempts:Number(row.attempts),deliveredAt:row.delivered_at}));
  return {schema:GUILD_GOVERNANCE_SCHEMA,eligible,activeCount:eligible.length,majority:Math.floor(eligible.length/2)+1,
    actorEligible:contributors.includes(actorId)&&eligible.includes(actorId),actorCanVote:eligible.includes(actorId),actorRole:actorId?delegatedRole(sql,actorId):'member',ballots,
    bans,outboundReports,reportQueuedCount:outboundReports.filter(row=>row.state!=='delivered').length};
}
export function reportQueue(sql){
  ensureGovernanceTables(sql);
  return rows(sql,"SELECT ballot_id,receipt_json,delivery_state,attempts FROM guild_governance_reports WHERE delivery_state!='delivered' ORDER BY rowid LIMIT 5")
    .map(r=>({ballotId:r.ballot_id,receipt:JSON.parse(r.receipt_json),state:r.delivery_state,attempts:r.attempts}));
}
export function markReportDelivery(sql,id,delivered,recipients=0){
  ensureGovernanceTables(sql);
  const count=Number.isSafeInteger(recipients)&&recipients>=0&&recipients<=80?recipients:0;
  sql.exec('UPDATE guild_governance_reports SET delivery_state=?,attempts=attempts+1,recipient_count=?,delivered_at=? WHERE ballot_id=?',
    delivered?'delivered':'failed',delivered?count:0,delivered?nowIso():null,id);
}
export function reportReceipt(sql,ballotId){
  ensureGovernanceTables(sql);
  const row=rows(sql,'SELECT receipt_json FROM guild_governance_reports WHERE ballot_id=?',ballotId)[0];
  return row?JSON.parse(row.receipt_json):null;
}

import {GUILD_GOVERNANCE_SCHEMA,GUILD_CONTRIBUTION_WINDOW_MS,GUILD_BALLOT_WINDOW_MS,GUILD_CASE_NOTICE_MS,GUILD_GOVERNANCE_ACTIONS,GUILD_REPORT_REASON_CODES,
  qualifiedContributors,activeGuildVoters,ballotSpec,ballotOutcome,safeReportReceipt,validGuildUser} from './guild-democratic-governance-v1.mjs';

const fail=(message,status=409)=>Object.assign(new Error(message),{status});
const nowIso=()=>new Date().toISOString();
const safe=(v,n=200)=>String(v??'').trim().slice(0,n);

export function ensureGovernanceTables(sql){
  sql.exec("CREATE TABLE IF NOT EXISTS guild_governance_roles(user_id TEXT PRIMARY KEY, role TEXT NOT NULL CHECK(role IN ('guildkeeper','member')),assigned_at TEXT NOT NULL, ballot_id TEXT NOT NULL)");
  sql.exec("CREATE TABLE IF NOT EXISTS guild_governance_bans(user_id TEXT PRIMARY KEY, credential_hash TEXT, ballot_id TEXT NOT NULL, imposed_at TEXT NOT NULL, expires_at TEXT NOT NULL)");
  sql.exec("CREATE TABLE IF NOT EXISTS guild_governance_contributions(id TEXT PRIMARY KEY, user_id TEXT NOT NULL, kind TEXT NOT NULL, at TEXT NOT NULL)");
  sql.exec("CREATE INDEX IF NOT EXISTS guild_gov_contrib_recent ON guild_governance_contributions(at,user_id)");
  sql.exec("CREATE TABLE IF NOT EXISTS guild_governance_ballots(id TEXT PRIMARY KEY, action TEXT NOT NULL, target_user_id TEXT NOT NULL, proposer_id TEXT NOT NULL, role TEXT, reason_code TEXT, statement TEXT NOT NULL, electorate_json TEXT NOT NULL, required_yes INTEGER NOT NULL, status TEXT NOT NULL, case_id TEXT, created_at TEXT NOT NULL, expires_at TEXT NOT NULL, resolved_at TEXT, execution_error TEXT)");
  sql.exec("CREATE TABLE IF NOT EXISTS guild_governance_votes(ballot_id TEXT NOT NULL,user_id TEXT NOT NULL,choice TEXT NOT NULL CHECK(choice IN ('yes','no')),voted_at TEXT NOT NULL,PRIMARY KEY(ballot_id,user_id))");
  sql.exec("CREATE TABLE IF NOT EXISTS guild_governance_reports(ballot_id TEXT PRIMARY KEY,receipt_json TEXT NOT NULL,delivery_state TEXT NOT NULL CHECK(delivery_state IN ('queued','delivered','failed')),attempts INTEGER NOT NULL DEFAULT 0,recipient_count INTEGER NOT NULL DEFAULT 0,delivered_at TEXT)");
  sql.exec("CREATE TABLE IF NOT EXISTS guild_governance_audit(id TEXT PRIMARY KEY,ballot_id TEXT NOT NULL,event TEXT NOT NULL,user_id TEXT NOT NULL,at TEXT NOT NULL)");
  sql.exec("CREATE TABLE IF NOT EXISTS guild_governance_cases(id TEXT PRIMARY KEY,action TEXT NOT NULL,target_user_id TEXT NOT NULL,opened_by TEXT NOT NULL,reason_code TEXT,statement TEXT NOT NULL,created_at TEXT NOT NULL,notice_until TEXT NOT NULL,response TEXT,responded_at TEXT,ballot_id TEXT)");
  sql.exec("CREATE TABLE IF NOT EXISTS guild_work_proofs(id TEXT PRIMARY KEY,author_id TEXT NOT NULL,quest_id TEXT NOT NULL,statement TEXT NOT NULL,status TEXT NOT NULL,required_approvals INTEGER NOT NULL,created_at TEXT NOT NULL,accepted_at TEXT)");
  sql.exec("CREATE TABLE IF NOT EXISTS guild_work_reviews(proof_id TEXT NOT NULL,reviewer_id TEXT NOT NULL,decision TEXT NOT NULL,at TEXT NOT NULL,PRIMARY KEY(proof_id,reviewer_id))");
}
export function creditVerifiedContribution(sql,{id,userId,kind,at=nowIso()}){
  if(!validGuildUser(userId)||!['physical-check-in','accepted-work-proof'].includes(kind)||!id)
    throw fail('Verified contribution source is invalid.',400);
  ensureGovernanceTables(sql);
  // This is called only by the already authenticated server-side proof / quest
  // handlers. There is intentionally NO client write endpoint for these receipts.
  sql.exec('INSERT OR IGNORE INTO guild_governance_contributions(id,user_id,kind,at) VALUES(?,?,?,?)',
    safe(id,220),userId,kind,at);
}
function rows(sql,query,...args){return [...sql.exec(query,...args)]}

const CASE_ACTIONS=Object.freeze(['remove','ban','report']);
const viewCase=row=>({id:row.id,action:row.action,targetUserId:row.target_user_id,openedBy:row.opened_by,
  reasonCode:row.reason_code||'',statement:row.statement,createdAt:row.created_at,noticeUntil:row.notice_until,
  response:row.response||null,respondedAt:row.responded_at||null,ballotId:row.ballot_id||null,
  status:row.ballot_id?'in-ballot':'notice'});
function caseRow(sql,id){
  const row=rows(sql,'SELECT * FROM guild_governance_cases WHERE id=? LIMIT 1',id)[0];
  if(!row)throw fail('Case was not found.',404);
  return row;
}
export function openGovernanceCase(sql,{actorId,action,targetUserId,reasonCode='',statement='',now=Date.now()}){
  ensureGovernanceTables(sql);
  if(!CASE_ACTIONS.includes(action))throw fail('Only sanctions and nearby reports require a disciplinary case.',400);
  if(!validGuildUser(targetUserId)||!validGuildUser(actorId))throw fail('Invalid Guild member identifier.',400);
  if(actorId===targetUserId)throw fail('Use voluntary Guild departure for self-removal.',400);
  if(!rows(sql,'SELECT user_id FROM resident_members WHERE user_id=? LIMIT 1',targetUserId)[0])
    throw fail('Target member must be enrolled.',404);
  if(!electorateSnapshot(sql,{now}).contributors.includes(actorId))throw fail('Opening a case requires a recent verified contribution.',403);
  if(action==='report'&&!GUILD_REPORT_REASON_CODES.includes(reasonCode))throw fail('Report reason is invalid.',400);
  if(typeof statement!=='string'||statement.trim().length<20||statement.trim().length>1000)
    throw fail('Supply a clear case statement (20–1,000 characters).',400);
  const existing=rows(sql,'SELECT id FROM guild_governance_cases WHERE target_user_id=? AND action=? AND ballot_id IS NULL AND notice_until>? LIMIT 1',
    targetUserId,action,new Date(now).toISOString())[0];
  if(existing)throw fail('An active notice already exists for this member and action.',409);
  const id='guild-case:'+crypto.randomUUID(),createdAt=new Date(now).toISOString(),noticeUntil=new Date(now+GUILD_CASE_NOTICE_MS).toISOString();
  sql.exec('INSERT INTO guild_governance_cases(id,action,target_user_id,opened_by,reason_code,statement,created_at,notice_until) VALUES(?,?,?,?,?,?,?,?)',
    id,action,targetUserId,actorId,reasonCode,statement.trim(),createdAt,noticeUntil);
  return viewCase(caseRow(sql,id));
}
export function respondToGovernanceCase(sql,{actorId,caseId,response,now=Date.now()}){
  ensureGovernanceTables(sql);
  const row=caseRow(sql,caseId);
  if(actorId!==row.target_user_id)throw fail('Only the targeted Guild member can respond to this case.',403);
  if(!rows(sql,'SELECT user_id FROM resident_members WHERE user_id=?',actorId)[0])throw fail('This member is not currently enrolled.',403);
  if(row.ballot_id){
    const ballot=rows(sql,'SELECT status FROM guild_governance_ballots WHERE id=?',row.ballot_id)[0];
    if(ballot?.status!=='open')throw fail('The decision is already finalized.',409);
  }
  if(typeof response!=='string'||response.trim().length<20||response.trim().length>2000)
    throw fail('A response must be 20–2,000 characters.',400);
  sql.exec('UPDATE guild_governance_cases SET response=?,responded_at=? WHERE id=?',response.trim(),new Date(now).toISOString(),row.id);
  return viewCase(caseRow(sql,row.id));
}
const viewWork=row=>({id:row.id,authorId:row.author_id,questId:row.quest_id,statement:row.statement,
  status:row.status,requiredApprovals:Number(row.required_approvals),createdAt:row.created_at,acceptedAt:row.accepted_at||null});
export function submitWorkProof(sql,{actorId,questId,statement,now=Date.now()}){
  ensureGovernanceTables(sql);
  if(!validGuildUser(actorId)||!rows(sql,'SELECT user_id FROM resident_members WHERE user_id=?',actorId)[0])
    throw fail('Only a Guild resident can submit work for verification.',403);
  if(!/^guild-quest:[a-f0-9]{64}$/.test(String(questId||'')))throw fail('Accepted work must reference a canonical published Guild Quest.',400);
  if(typeof statement!=='string'||statement.trim().length<20||statement.trim().length>1000)
    throw fail('Explain the completed work for independent review (20–1,000 characters).',400);
  const prior=rows(sql,"SELECT id FROM guild_work_proofs WHERE author_id=? AND quest_id=? AND status!='rejected' LIMIT 1",actorId,questId)[0];
  if(prior)throw fail('A pending or accepted verification record already exists for this Guild Quest and member.',409);
  const n=Number(rows(sql,'SELECT COUNT(DISTINCT user_id) AS n FROM resident_members')[0]?.n||0);
  const id='guild-work:'+crypto.randomUUID(),requiredApprovals=n>=3?2:n===2?1:2;
  sql.exec("INSERT INTO guild_work_proofs(id,author_id,quest_id,statement,status,required_approvals,created_at) VALUES(?,?,?,?,'pending',?,?)",
    id,actorId,questId,statement.trim(),requiredApprovals,new Date(now).toISOString());
  return viewWork(rows(sql,'SELECT * FROM guild_work_proofs WHERE id=?',id)[0]);
}
export function reviewWorkProof(sql,{actorId,proofId,decision,now=Date.now()}){
  ensureGovernanceTables(sql);
  const row=rows(sql,'SELECT * FROM guild_work_proofs WHERE id=?',proofId)[0];
  if(!row)throw fail('Work verification request was not found.',404);
  if(!rows(sql,'SELECT user_id FROM resident_members WHERE user_id=?',actorId)[0])throw fail('Only enrolled Guild members can verify completed work.',403);
  if(actorId===row.author_id)throw fail('Independent review cannot be self-approved.',403);
  if(!['accept','reject'].includes(decision))throw fail('Review must be accept or reject.',400);
  if(row.status!=='pending')return viewWork(row);
  if(rows(sql,'SELECT reviewer_id FROM guild_work_reviews WHERE proof_id=? AND reviewer_id=?',proofId,actorId)[0])
    throw fail('This reviewer has already reviewed the work.',409);
  sql.exec('INSERT INTO guild_work_reviews(proof_id,reviewer_id,decision,at) VALUES(?,?,?,?)',proofId,actorId,decision,new Date(now).toISOString());
  const approvals=Number(rows(sql,"SELECT COUNT(*) AS n FROM guild_work_reviews WHERE proof_id=? AND decision='accept'",proofId)[0]?.n||0);
  const rejections=Number(rows(sql,"SELECT COUNT(*) AS n FROM guild_work_reviews WHERE proof_id=? AND decision='reject'",proofId)[0]?.n||0);
  const status=approvals>=Number(row.required_approvals)?'accepted':
    rejections>=Number(row.required_approvals)?'rejected':'pending';
  if(status!=='pending'){
    sql.exec('UPDATE guild_work_proofs SET status=?,accepted_at=? WHERE id=?',status,status==='accepted'?new Date(now).toISOString():null,proofId);
    if(status==='accepted')creditVerifiedContribution(sql,{id:'work:'+proofId,userId:row.author_id,kind:'accepted-work-proof',at:new Date(now).toISOString()});
  }
  return viewWork(rows(sql,'SELECT * FROM guild_work_proofs WHERE id=?',proofId)[0]);
}

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
  proposerId:row.proposer_id,role:row.role,reasonCode:row.reason_code,statement:row.statement,caseId:row.case_id||null,
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
export function proposeGovernance(sql,{guildId,origin,actorId,action,targetUserId,reasonCode='',role='',statement='',caseId='',now=Date.now()}){
  ensureGovernanceTables(sql);
  const members=rows(sql,'SELECT user_id FROM resident_members');
  if(action==='lift-ban'){
    if(!isBanned(sql,targetUserId,{now}))throw fail('A lift-ban vote needs an existing active Guild ban.',409);
  }else if(!members.some(row=>row.user_id===targetUserId))throw fail('Target member must be currently enrolled.',404);
  const {voters:eligible,contributors}=electorateSnapshot(sql,{now});
  if(CASE_ACTIONS.includes(action)){
    if(!caseId)throw fail('A disciplinary case and right-to-respond notice are required before this vote.',409);
    const prior=caseRow(sql,caseId);
    if(prior.action!==action||prior.target_user_id!==targetUserId||prior.reason_code!==(reasonCode||'')||
       prior.statement!==statement.trim()||prior.ballot_id)throw fail('Proposed sanction must match its unique open case.',409);
    if(now<Date.parse(prior.notice_until))throw fail('The targeted member notice and response period is still open.',409);
    if(now>Date.parse(prior.created_at)+30*86400000)throw fail('The case notice has expired; file a new case.',410);
  }
  const spec=ballotSpec({action,targetUserId,initiatorUserId:actorId,eligible,contributors,reasonCode,role,statement,caseId,now});
  if(action==='report'){
    const recentlyApproved=rows(sql,"SELECT id FROM guild_governance_ballots WHERE target_user_id=? AND action='report' AND status='approved' AND resolved_at>=? LIMIT 1",
      targetUserId,new Date(now-30*86400000).toISOString())[0];
    if(recentlyApproved)throw fail('An approved report about this member already exists within the last 30 days.',429);
  }
  const pending=rows(sql,"SELECT id FROM guild_governance_ballots WHERE target_user_id=? AND action=? AND status='open' AND expires_at>? LIMIT 1",
    targetUserId,action,new Date(now).toISOString())[0];
  if(pending)throw fail('An active vote already exists for this member and action.');
  const id='guild-vote:'+crypto.randomUUID();
  sql.exec("INSERT INTO guild_governance_ballots(id,action,target_user_id,proposer_id,role,reason_code,statement,case_id,electorate_json,required_yes,status,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
    id,action,targetUserId,actorId,role,reasonCode,spec.statement,caseId||null,JSON.stringify(spec.eligible),spec.requiredYes,'open',
    spec.createdAt,spec.expiresAt);
  if(caseId)sql.exec('UPDATE guild_governance_cases SET ballot_id=? WHERE id=?',id,caseId);
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
  const cases=rows(sql,'SELECT * FROM guild_governance_cases ORDER BY created_at DESC LIMIT 40').map(viewCase);
  const workProofs=rows(sql,'SELECT * FROM guild_work_proofs ORDER BY created_at DESC LIMIT 40').map(viewWork);
  const outboundReports=rows(sql,'SELECT ballot_id,delivery_state,recipient_count,attempts,delivered_at FROM guild_governance_reports ORDER BY rowid DESC LIMIT 20')
    .map(row=>({ballotId:row.ballot_id,state:row.delivery_state,recipients:Number(row.recipient_count),attempts:Number(row.attempts),deliveredAt:row.delivered_at}));
  return {schema:GUILD_GOVERNANCE_SCHEMA,eligible,activeCount:eligible.length,majority:Math.floor(eligible.length/2)+1,
    actorEligible:contributors.includes(actorId)&&eligible.includes(actorId),actorCanVote:eligible.includes(actorId),actorRole:actorId?delegatedRole(sql,actorId):'member',ballots,
    bans,cases,workProofs,outboundReports,reportQueuedCount:outboundReports.filter(row=>row.state!=='delivered').length};
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

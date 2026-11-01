import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import {webcrypto} from 'node:crypto';
import {majority,ballotSpec,ballotOutcome,qualifiedContributors,activeGuildVoters,GUILD_CONTRIBUTION_WINDOW_MS} from '../cloudflare/mobile-guild-edge/src/guild-democratic-governance-v1.mjs';
import {creditVerifiedContribution,proposeGovernance,castGovernanceVote,
  delegatedRole,isBanned,governanceStatus,reportQueue,reportReceipt,markReportDelivery,
  openGovernanceCase,respondToGovernanceCase,submitWorkProof,reviewWorkProof,ensureGovernanceTables,
  acknowledgeGuildNotice,fileBanAppeal,sponsorBanAppeal} from '../cloudflare/mobile-guild-edge/src/guild-democratic-governance-state-v1.mjs';
import {distanceKm,deliverVerifiedGuildReport,handleGuildPeerDirectoryRoute} from '../cloudflare/core/src/guild-peer-reports-v1.mjs';

if(!globalThis.crypto)globalThis.crypto=webcrypto;
const NOW=()=>new Date().toISOString();
const A='cwres:alice-0001',B='cwres:bob-000002',C='cwres:carol-003',D='cwres:dave-0004';
function fixture(){
  const db=new DatabaseSync(':memory:');
  db.exec("CREATE TABLE resident_members (node_id TEXT NOT NULL,user_id TEXT NOT NULL,credential_hash TEXT NOT NULL,seat_class TEXT NOT NULL,created_at TEXT NOT NULL,last_seen_at TEXT NOT NULL,PRIMARY KEY(node_id,user_id))");
  db.exec("CREATE TABLE resident_sessions (token_hash TEXT PRIMARY KEY,node_id TEXT NOT NULL,user_id TEXT NOT NULL,created_at TEXT NOT NULL,expires_at TEXT NOT NULL)");
  const sql={
    exec(query,...args){
      const statement=db.prepare(query);
      return /^\s*(SELECT|WITH|PRAGMA)\b/i.test(query)?statement.all(...args):(statement.run(...args),[]);
    }
  };
  const member=(id,credential='cred-'+id)=>{
    sql.exec('INSERT INTO resident_members(node_id,user_id,credential_hash,seat_class,created_at,last_seen_at) VALUES(?,?,?,?,?,?)',
      'guild-a',id,credential,'community',NOW(),NOW());
    sql.exec('INSERT INTO resident_sessions(token_hash,node_id,user_id,created_at,expires_at) VALUES(?,?,?,?,?)',
      'token-'+id,'guild-a',id,NOW(),new Date(Date.now()+86400000).toISOString());
  };
  const contributor=(id,kind='physical-check-in')=>creditVerifiedContribution(sql,{id:kind+':'+id,userId:id,kind});
  const context={guildId:'guild-a',origin:'https://guild-a.workers.dev'};
  return{sql,db,member,contributor,context,memberCount:()=>db.prepare('SELECT COUNT(*) AS n FROM resident_members').get().n};
}
function proposeWithNoticedCase(sql,opts){
  if(!['remove','ban','report'].includes(opts.action))return proposeGovernance(sql,opts);
  const open=openGovernanceCase(sql,opts);
  sql.exec('UPDATE guild_governance_cases SET notice_until=? WHERE id=?',new Date(Date.now()-1000).toISOString(),open.id);
  return proposeGovernance(sql,{...opts,caseId:open.id});
}
test('majority is strict and cannot be met by an owner alone when multiple members contributed',()=>{
  assert.deepEqual([1,2,3,4,5].map(majority),[1,2,2,3,3]);
  const members=[{userId:A},{userId:B},{userId:C}],t=Date.now();
  const receipts=[{userId:A,kind:'accepted-work-proof',at:new Date(t-1000).toISOString()},
    {userId:B,kind:'physical-check-in',at:new Date(t-1000).toISOString()},
    {userId:C,kind:'neuron-use',at:new Date(t-1000).toISOString()},
    {userId:C,kind:'accepted-work-proof',at:new Date(t-GUILD_CONTRIBUTION_WINDOW_MS-1000).toISOString()}];
  assert.deepEqual(qualifiedContributors(members,receipts,{now:t}),[A,B]);
  assert.throws(()=>ballotSpec({action:'remove',targetUserId:A,initiatorUserId:A,eligible:[A],statement:'Verified concerns require a documented member decision.',now:t}),/normal account departure/);
  assert.throws(()=>ballotSpec({action:'ban',targetUserId:A,initiatorUserId:B,eligible:[A],statement:'Verified concerns require a documented member decision.',now:t}),/recent verified contribution/);
});
test('all active Guild members can vote, but only recent verified contributors can propose',()=>{
  const now=Date.now(),members=[A,B,C].map(id=>({userId:id,lastSeenAt:new Date(now-1000).toISOString()}));
  const receipts=[{userId:A,kind:'accepted-work-proof',at:new Date(now-1000).toISOString()}];
  assert.deepEqual(qualifiedContributors(members,receipts,{now}),[A]);
  assert.deepEqual(activeGuildVoters(members,receipts,{now}),[A,B,C]);
  assert.deepEqual(activeGuildVoters([...members,{userId:D,lastSeenAt:new Date(now-31*86400000).toISOString()}],receipts,{now}),[A,B,C]);
  const f=fixture();[A,B,C].forEach(id=>f.member(id));f.contributor(A);
  const proposed=proposeWithNoticedCase(f.sql,{...f.context,statement:'Verified concerns require a democratic member decision.',actorId:A,action:'remove',targetUserId:C});
  assert.equal(proposed.status,'open');assert.equal(proposed.requiredYes,2);
  assert.equal(f.memberCount(),3);
  assert.equal(castGovernanceVote(f.sql,{...f.context,actorId:B,ballotId:proposed.id,choice:'yes'}).status,'approved');
  assert.equal(f.memberCount(),2);
  assert.throws(()=>proposeWithNoticedCase(f.sql,{...f.context,statement:'Resident has not contributed recently; proposal should fail.',actorId:B,action:'transfer-role',targetUserId:A,role:'guildkeeper'}),/recent verified contribution/);
});
test('approved ballots auto-remove and invalidate sessions; a proposer alone cannot act in a multi-voter Guild',()=>{
  const f=fixture();[A,B,C].forEach(id=>f.member(id));f.contributor(A);f.contributor(B);
  const first=proposeWithNoticedCase(f.sql,{...f.context,statement:'Verified concerns require a documented member decision.',actorId:A,action:'remove',targetUserId:C});
  assert.equal(first.status,'open');assert.equal(first.yes,1);assert.equal(first.requiredYes,2);assert.equal(f.memberCount(),3);
  const declined=castGovernanceVote(f.sql,{...f.context,actorId:B,ballotId:first.id,choice:'no'});
  assert.equal(declined.status,'open');assert.equal(f.memberCount(),3);
  assert.equal(castGovernanceVote(f.sql,{...f.context,actorId:C,ballotId:first.id,choice:'no'}).status,'rejected');
  const second=proposeWithNoticedCase(f.sql,{...f.context,statement:'Verified concerns require a documented member decision.',actorId:A,action:'remove',targetUserId:C});
  const final=castGovernanceVote(f.sql,{...f.context,actorId:B,ballotId:second.id,choice:'yes'});
  assert.equal(final.status,'approved');assert.equal(final.executed,true);assert.equal(f.memberCount(),2);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM resident_sessions WHERE user_id=?').get(C).n,0);
  assert.throws(()=>castGovernanceVote(f.sql,{...f.context,actorId:B,ballotId:second.id,choice:'yes'}),/already closed/);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM guild_governance_audit WHERE event=?').get('approved').n,1);
});
test('active productive target stays protected until community majority, even if not the proposer',()=>{
  const f=fixture();[A,B,C].forEach(id=>f.member(id));[A,B,C].forEach(id=>f.contributor(id));
  const ballot=proposeWithNoticedCase(f.sql,{...f.context,statement:'Verified concerns require a documented member decision.',actorId:A,action:'remove',targetUserId:C});
  assert.equal(ballot.status,'open');assert.equal(f.memberCount(),3);
  assert.equal(castGovernanceVote(f.sql,{...f.context,actorId:B,ballotId:ballot.id,choice:'yes'}).status,'approved');
  assert.equal(f.memberCount(),2);
});
test('majority-approved Guildkeeper role transfer and revocation affect effective authority immediately',()=>{
  const f=fixture();[A,B,C].forEach(id=>f.member(id));f.contributor(A);f.contributor(B);
  const ballot=proposeWithNoticedCase(f.sql,{...f.context,statement:'Verified concerns require a documented member decision.',actorId:A,action:'transfer-role',targetUserId:C,role:'guildkeeper'});
  assert.equal(delegatedRole(f.sql,C),'member');
  castGovernanceVote(f.sql,{...f.context,actorId:B,ballotId:ballot.id,choice:'yes'});
  assert.equal(delegatedRole(f.sql,C),'guildkeeper');
  const next=proposeWithNoticedCase(f.sql,{...f.context,statement:'Verified concerns require a documented member decision.',actorId:A,action:'transfer-role',targetUserId:C,role:'member'});
  castGovernanceVote(f.sql,{...f.context,actorId:B,ballotId:next.id,choice:'yes'});
  assert.equal(delegatedRole(f.sql,C),'member');
});
test('approved bans block old user IDs and existing device credential reuse, but expire',()=>{
  const f=fixture();[A,B,C].forEach(id=>f.member(id));f.contributor(A);f.contributor(B);
  const ballot=proposeWithNoticedCase(f.sql,{...f.context,statement:'Verified concerns require a documented member decision.',actorId:A,action:'ban',targetUserId:C});
  assert.equal(isBanned(f.sql,C),false);
  castGovernanceVote(f.sql,{...f.context,actorId:B,ballotId:ballot.id,choice:'yes'});
  assert.equal(isBanned(f.sql,C),true);
  assert.equal(isBanned(f.sql,D,{credentialHash:'cred-'+C}),true);
  assert.equal(isBanned(f.sql,D,{credentialHash:'other'}),false);
  assert.equal(isBanned(f.sql,C,{now:Date.now()+91*86400000}),false);
});
test('active contributor majority can automatically lift a wrongful ban and restore admission eligibility',()=>{
  const f=fixture();[A,B,C].forEach(id=>f.member(id));f.contributor(A);f.contributor(B);
  const ban=proposeWithNoticedCase(f.sql,{...f.context,statement:'Evidence suggests a temporary safety restriction.',actorId:A,action:'ban',targetUserId:C});
  castGovernanceVote(f.sql,{...f.context,actorId:B,ballotId:ban.id,choice:'yes'});
  assert.equal(isBanned(f.sql,C),true);
  const reverse=proposeWithNoticedCase(f.sql,{...f.context,statement:'New evidence justifies overturning the original vote.',actorId:A,action:'lift-ban',targetUserId:C});
  assert.equal(reverse.status,'open');assert.equal(isBanned(f.sql,C),true);
  const decision=castGovernanceVote(f.sql,{...f.context,actorId:B,ballotId:reverse.id,choice:'yes'});
  assert.equal(decision.status,'approved');
  assert.equal(isBanned(f.sql,C),false);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM guild_governance_audit WHERE event=?').get('ban-lifted-by-majority').n,1);
});
test('approved nearby reports have a 30-day per-target cooldown to prevent repeated Guild harassment',()=>{
  const f=fixture();[A,B,C].forEach(id=>f.member(id));f.contributor(A);f.contributor(B);
  const first=proposeWithNoticedCase(f.sql,{...f.context,statement:'A documented report of problematic conduct was received.',actorId:A,action:'report',targetUserId:C,reasonCode:'harassment'});
  castGovernanceVote(f.sql,{...f.context,actorId:B,ballotId:first.id,choice:'yes'});
  assert.throws(()=>proposeWithNoticedCase(f.sql,{...f.context,statement:'Repeated allegation against the same Guild resident.',actorId:A,action:'report',targetUserId:C,reasonCode:'other'}),/last 30 days/);
});
test('approved report is queued without exposing a member ID or enforcing a remote ban; retry idempotent',()=>{
  const f=fixture();[A,B,C].forEach(id=>f.member(id));f.contributor(A);f.contributor(B);
  const ballot=proposeWithNoticedCase(f.sql,{...f.context,statement:'Verified concerns require a documented member decision.',actorId:A,action:'report',targetUserId:C,reasonCode:'harassment'});
  assert.equal(reportQueue(f.sql).length,0);
  const done=castGovernanceVote(f.sql,{...f.context,actorId:B,ballotId:ballot.id,choice:'yes'});
  assert.equal(done.status,'approved');assert.equal(f.memberCount(),3);
  const receipt=reportReceipt(f.sql,ballot.id);
  assert.equal(receipt.reasonCode,'harassment');
  assert.equal(receipt.classification,'community-approved-unverified-allegation');
  assert.equal(receipt.radiusKm,25);
  assert.equal(JSON.stringify(receipt).includes(C),false);
  assert.match(receipt.subjectPseudonym,/^[a-f0-9]{64}$/);
  assert.equal(reportQueue(f.sql).length,1);
  markReportDelivery(f.sql,ballot.id,true);assert.equal(reportQueue(f.sql).length,0);
  assert.equal(governanceStatus(f.sql,{actorId:A}).ballots[0].status,'approved');
});
test('nearby Guild relay uses location bounds, never all worldwide Guilds',()=>{
  assert.equal(distanceKm({latitude:40,longitude:-74},{latitude:40,longitude:-74}),0);
  assert.ok(distanceKm({latitude:40.7,longitude:-74},{latitude:40.75,longitude:-74})<25);
  assert.ok(distanceKm({latitude:40.7,longitude:-74},{latitude:45,longitude:-74})>25);
  assert.equal(distanceKm(null,{latitude:40,longitude:-74}),Infinity);
  assert.equal(distanceKm({latitude:null,longitude:null},{latitude:0,longitude:0}),Infinity);
  assert.equal(distanceKm({latitude:'',longitude:''},{latitude:0,longitude:0}),Infinity);
});

test('directory relay independently fetches source Guild receipt and delivers only to mapped nearby registered Guilds',async()=>{
  const id='guild-vote:12345678-1234-4234-9234-123456789abc';
  const origin='https://guild-a.workers.dev';
  const locations=[
    {node_id:'guild-a',location_json:JSON.stringify({latitude:40.0,longitude:-74.0})},
    {node_id:'guild-b',location_json:JSON.stringify({latitude:40.1,longitude:-74.0})},
    {node_id:'guild-c',location_json:JSON.stringify({latitude:41,longitude:-74})}
  ];
  const delivered=new Set,seen=[];
  const DB={
    prepare(query){
      const entry={args:[],bind(...values){this.args=values;return this;},
        async first(){
          if(query.includes('FROM nodes WHERE node_id='))return {node_id:'guild-a',public_origin:origin,
            location_json:locations[0].location_json};
          if(query.includes('COUNT(*)'))return {n:delivered.has(this.args[1])?1:0};
          throw new Error('Unknown DB single query');
        },
        async all(){
          if(query.includes('SELECT node_id,location_json'))return {results:locations.slice(1)};
          throw new Error('Unknown DB query');
        },
        async run(){
          if(!query.includes('INSERT OR IGNORE INTO guild_peer_report_inbox'))throw new Error('Unknown mutation');
          delivered.add(this.args[0]);seen.push({recipient:this.args[2],receipt:JSON.parse(this.args[3])});
          return{meta:{changes:1}};
        }
      };return entry;
    },
    async batch(writes){return Promise.all(writes.map(write=>write.run()))}
  };
  const receipt={schema:'civweave.guild-peer-report.v1',ballotId:id,guildId:'guild-a',origin,
    subjectPseudonym:'a'.repeat(64),reasonCode:'fraud',classification:'community-approved-unverified-allegation',
    radiusKm:25,createdAt:NOW()};
  let calls=0;
  const fetcher=async url=>{calls++;assert.match(String(url),/\/api\/guild\/governance\/receipt/);
    return{ok:true,json:async()=>({ok:true,receipt})}};
  const result=await deliverVerifiedGuildReport({DB},{guildId:'guild-a',origin,ballotId:id},fetcher);
  assert.equal(result.deliveredToNearbyGuilds,1);
  assert.equal(seen.length,1);assert.equal(seen[0].recipient,'guild-b');
  assert.equal(JSON.stringify(seen[0].receipt).includes(C),false);
  assert.equal((await deliverVerifiedGuildReport({DB},{guildId:'guild-a',origin,ballotId:id},fetcher)).idempotent,true);
  assert.equal(calls,1);
  await assert.rejects(()=>deliverVerifiedGuildReport({DB},{guildId:'guild-a',origin:'https://imposter.test',ballotId:id},fetcher),/not an independently registered/);
});

test('nearby report relay and inbox reject anonymous reads and writes even when a Guild ID is known',async()=>{
  const token='T'.repeat(60);
  const env={CIVWEAVE_GUILD_REPORT_RELAY_TOKEN:token,DB:{prepare(query){
    if(!query.includes('FROM guild_peer_report_inbox'))throw Error('Unexpected database query');
    return {bind(){return this},async all(){return {results:[]}}};
  }}};
  const read=new Request('https://core.example/api/guild-directory/reports?guildId=guild-a');
  const anonymous=await handleGuildPeerDirectoryRoute(read,env);
  assert.equal(anonymous.status,403);
  const signed=await handleGuildPeerDirectoryRoute(new Request(read.url,{headers:{authorization:'Bearer '+token}}),env);
  assert.equal(signed.status,200);
  assert.deepEqual((await signed.json()).reports,[]);
  const forged=new Request('https://core.example/api/guild-directory/report',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({guildId:'guild-a',ballotId:'guild-vote:12345678-1234-4234-9234-123456789abc',origin:'https://guild-a.workers.dev'})});
  assert.equal((await handleGuildPeerDirectoryRoute(forged,env)).status,403);
  const disabled=await handleGuildPeerDirectoryRoute(read,{DB:env.DB});
  assert.equal(disabled.status,503);
});

test('disciplinary case provides 24-hour response window before a sanction ballot can start',()=>{
  const f=fixture();[A,B,C].forEach(id=>f.member(id));f.contributor(A,'physical-check-in');
  const initial=Date.now();
  assert.throws(()=>proposeGovernance(f.sql,{...f.context,actorId:A,action:'remove',targetUserId:C,
    statement:'This should not bypass the right to respond.'}),/case/i);
  const opened=openGovernanceCase(f.sql,{...f.context,actorId:A,action:'remove',targetUserId:C,
    statement:'The subject must have a reasonable opportunity to respond.',now:initial});
  assert.equal(opened.status,'notice');
  assert.ok(Date.parse(opened.noticeUntil)-initial>=24*3600000);
  assert.throws(()=>proposeGovernance(f.sql,{...f.context,actorId:A,action:'remove',targetUserId:C,caseId:opened.id,
    statement:'The subject must have a reasonable opportunity to respond.',now:initial}),/notice/i);
  const replied=respondToGovernanceCase(f.sql,{actorId:C,caseId:opened.id,
    response:'I dispute this claim and ask other members to review the evidence.',now:initial+1000});
  assert.match(replied.response,/dispute/);
  assert.throws(()=>respondToGovernanceCase(f.sql,{actorId:B,caseId:opened.id,
    response:'An unauthorized user should not impersonate the subject.'}),/target/i);
  const ballot=proposeGovernance(f.sql,{...f.context,actorId:A,action:'remove',targetUserId:C,caseId:opened.id,
    statement:'The subject must have a reasonable opportunity to respond.',now:initial+25*3600000});
  assert.equal(ballot.status,'open');
  assert.equal(ballot.caseId,opened.id);
  assert.equal(f.memberCount(),3);
});
test('a drafted quest publication never grants proposal power without accepted work or physical proof',()=>{
  const f=fixture();[A,B,C].forEach(id=>f.member(id));
  // Publication-only receipts must not grant proposal eligibility.
  assert.throws(()=>creditVerifiedContribution(f.sql,{id:'quest-only',userId:A,kind:'published-quest'}),/Verified contribution source/);
  assert.throws(()=>openGovernanceCase(f.sql,{...f.context,actorId:A,action:'remove',targetUserId:C,
    statement:'Publishing a Quest alone is not proof of productive work.'}),/verified contribution/);
  const proof=submitWorkProof(f.sql,{actorId:A,questId:'guild-quest:'+'a'.repeat(64),
    statement:'I completed the published work; the supplied record is ready for independent review.'});
  assert.equal(proof.status,'pending');
  assert.throws(()=>reviewWorkProof(f.sql,{actorId:A,proofId:proof.id,decision:'accept'}),/independent/i);
  const one=reviewWorkProof(f.sql,{actorId:B,proofId:proof.id,decision:'accept'});
  assert.equal(one.status,'pending'); // 3-person Guild requires two independent reviewers
  const two=reviewWorkProof(f.sql,{actorId:C,proofId:proof.id,decision:'accept'});
  assert.equal(two.status,'accepted');
  assert.equal(governanceStatus(f.sql,{actorId:A}).actorEligible,true);
  assert.equal(reviewWorkProof(f.sql,{actorId:B,proofId:proof.id,decision:'accept'}).status,'accepted');
});
test('single member cannot self-approve completion, two-member Guild needs independent reviewer',()=>{
  const one=fixture();one.member(A);
  const only=submitWorkProof(one.sql,{actorId:A,questId:'guild-quest:'+'b'.repeat(64),
    statement:'This work is awaiting someone else to independently review it.'});
  assert.equal(only.status,'pending');
  assert.throws(()=>reviewWorkProof(one.sql,{actorId:A,proofId:only.id,decision:'accept'}),/independent/i);
  const duo=fixture();duo.member(A);duo.member(B);
  const proof=submitWorkProof(duo.sql,{actorId:A,questId:'guild-quest:'+'c'.repeat(64),
    statement:'This work can be reviewed by the other Guild member.'});
  assert.equal(reviewWorkProof(duo.sql,{actorId:B,proofId:proof.id,decision:'accept'}).status,'accepted');
});

test('work review requires an independent rejection quorum and permits corrected resubmission',()=>{
  const f=fixture();[A,B,C].forEach(id=>f.member(id));
  const original=submitWorkProof(f.sql,{actorId:A,questId:'guild-quest:'+'d'.repeat(64),
    statement:'This claim needs a fair two-reviewer opportunity to correct mistakes.'});
  assert.equal(reviewWorkProof(f.sql,{actorId:B,proofId:original.id,decision:'reject'}).status,'pending');
  assert.equal(reviewWorkProof(f.sql,{actorId:C,proofId:original.id,decision:'reject'}).status,'rejected');
  const corrected=submitWorkProof(f.sql,{actorId:A,questId:'guild-quest:'+'d'.repeat(64),
    statement:'I revised the proof with additional independently checkable details.'});
  assert.equal(corrected.status,'pending');
  assert.notEqual(original.id,corrected.id);
});

test('existing Guild ballot ledger acquires case_id without destroying older votes',()=>{
  const db=new DatabaseSync(':memory:');
  db.exec("CREATE TABLE guild_governance_ballots(id TEXT PRIMARY KEY,action TEXT NOT NULL,target_user_id TEXT NOT NULL,proposer_id TEXT NOT NULL,role TEXT,reason_code TEXT,statement TEXT NOT NULL,electorate_json TEXT NOT NULL,required_yes INTEGER NOT NULL,status TEXT NOT NULL,created_at TEXT NOT NULL,expires_at TEXT NOT NULL,resolved_at TEXT,execution_error TEXT)");
  db.prepare("INSERT INTO guild_governance_ballots(id,action,target_user_id,proposer_id,statement,electorate_json,required_yes,status,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?)")
    .run('legacy-vote','remove',A,B,'Original vote retained','[]',1,'rejected',NOW(),NOW());
  const sql={exec(query,...params){const statement=db.prepare(query);
    return /^\s*(SELECT|PRAGMA)\b/i.test(query)?statement.all(...params):(statement.run(...params),[])}};
  ensureGovernanceTables(sql);
  assert.equal(db.prepare("SELECT status FROM guild_governance_ballots WHERE id='legacy-vote'").get().status,'rejected');
  assert.ok(db.prepare("PRAGMA table_info(guild_governance_ballots)").all().some(row=>row.name==='case_id'));
  ensureGovernanceTables(sql);
});

test('small and larger Guilds apply active-member majority to case-backed sanction votes',()=>{
  for(const count of [1,2,5,10]){
    const f=fixture(),ids=Array.from({length:count},(_,i)=>'cwres:active-member-'+String(i).padStart(4,'0'));
    for(const id of ids)f.member(id);
    f.contributor(ids[0]);
    if(count===1){
      assert.throws(()=>openGovernanceCase(f.sql,{...f.context,actorId:ids[0],action:'remove',targetUserId:ids[0],
        statement:'A sole member should use voluntary departure, not sanction.'}),/self-removal/);
      continue;
    }
    const caseRow=openGovernanceCase(f.sql,{...f.context,actorId:ids[0],action:'remove',targetUserId:ids[count-1],
      statement:'An individual should have time to reply to this proposed decision.'});
    f.sql.exec('UPDATE guild_governance_cases SET notice_until=? WHERE id=?',
      new Date(Date.now()-1000).toISOString(),caseRow.id);
    const ballot=proposeGovernance(f.sql,{...f.context,actorId:ids[0],action:'remove',targetUserId:ids[count-1],
      statement:'An individual should have time to reply to this proposed decision.',caseId:caseRow.id});
    assert.equal(ballot.requiredYes,Math.floor(count/2)+1);
    assert.equal(f.memberCount(),count);
    for(let i=1;i<Math.floor(count/2);i++){
      assert.equal(castGovernanceVote(f.sql,{...f.context,actorId:ids[i],ballotId:ballot.id,choice:'yes'}).status,'open');
      assert.equal(f.memberCount(),count);
    }
    const deciding=castGovernanceVote(f.sql,{...f.context,actorId:ids[Math.floor(count/2)],ballotId:ballot.id,choice:'yes'});
    assert.equal(deciding.status,'approved');
    assert.equal(f.memberCount(),count-1);
  }
});

test('inbox notices are actor-scoped and read acknowledgments are authenticated, idempotent and non-voting',()=>{
  const f=fixture();[A,B,C].forEach(id=>f.member(id));f.contributor(A);
  const raised=openGovernanceCase(f.sql,{...f.context,actorId:A,action:'ban',targetUserId:C,
    statement:'The accused member has the right to see this pending case.'});
  const targeted=governanceStatus(f.sql,{actorId:C});
  assert.ok(targeted.notices.some(n=>n.kind==='case'&&n.refId===raised.id&&!n.readAt));
  assert.equal(governanceStatus(f.sql,{actorId:B}).notices.some(n=>n.refId===raised.id),false);
  assert.throws(()=>acknowledgeGuildNotice(f.sql,{actorId:B,kind:'case',refId:raised.id}),/not addressed/i);
  const ack=acknowledgeGuildNotice(f.sql,{actorId:C,kind:'case',refId:raised.id});
  assert.equal(ack.kind,'case');assert.ok(ack.readAt);
  assert.equal(acknowledgeGuildNotice(f.sql,{actorId:C,kind:'case',refId:raised.id}).readAt,ack.readAt);
  assert.equal(f.memberCount(),3);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM guild_governance_votes').get().n,0);
  f.sql.exec('UPDATE guild_governance_cases SET notice_until=? WHERE id=?',new Date(Date.now()-1000).toISOString(),raised.id);
  const ballot=proposeGovernance(f.sql,{...f.context,actorId:A,action:'ban',targetUserId:C,caseId:raised.id,
    statement:'The accused member has the right to see this pending case.'});
  assert.ok(governanceStatus(f.sql,{actorId:B}).notices.some(n=>n.kind==='ballot'&&n.refId===ballot.id));
  assert.equal(governanceStatus(f.sql,{actorId:D}).notices.length,0);
});
test('a banned member can submit exactly one credential-authenticated appeal, but never cast votes',()=>{
  const f=fixture();[A,B].forEach(id=>f.member(id));f.member(C,'e'.repeat(64));f.contributor(A);
  const banned=proposeWithNoticedCase(f.sql,{...f.context,actorId:A,action:'ban',targetUserId:C,
    statement:'A removal should not permanently silence a community appeal.'});
  castGovernanceVote(f.sql,{...f.context,actorId:B,ballotId:banned.id,choice:'yes'});
  assert.equal(isBanned(f.sql,C),true);
  assert.throws(()=>fileBanAppeal(f.sql,{actorId:C,credentialHash:'incorrect',ballotId:banned.id,
    statement:'I request that the Guild consider correcting its decision.'}),/credential/i);
  const appeal=fileBanAppeal(f.sql,{actorId:C,credentialHash:'e'.repeat(64),ballotId:banned.id,
    statement:'I request that the Guild consider correcting its decision.'});
  assert.equal(appeal.status,'pending');
  assert.equal(governanceStatus(f.sql,{actorId:B}).appeals.some(a=>a.id===appeal.id),true);
  assert.throws(()=>fileBanAppeal(f.sql,{actorId:C,credentialHash:'e'.repeat(64),ballotId:banned.id,
    statement:'Try to flood appeals rather than discuss the original decision.'}),/already/i);
  assert.throws(()=>castGovernanceVote(f.sql,{...f.context,actorId:C,ballotId:banned.id,choice:'yes'}));
  assert.equal(isBanned(f.sql,C),true);
  assert.throws(()=>sponsorBanAppeal(f.sql,{...f.context,actorId:B,appealId:appeal.id}),/verified contribution/);
  const sponsored=sponsorBanAppeal(f.sql,{...f.context,actorId:A,appealId:appeal.id});
  assert.equal(sponsored.status,'open');
  assert.equal(isBanned(f.sql,C),true);
  assert.equal(governanceStatus(f.sql,{actorId:A}).appeals.find(a=>a.id===appeal.id).ballotId,sponsored.id);
  const approved=castGovernanceVote(f.sql,{...f.context,actorId:B,ballotId:sponsored.id,choice:'yes'});
  assert.equal(approved.status,'approved');
  assert.equal(isBanned(f.sql,C),false);
  assert.equal(governanceStatus(f.sql,{actorId:A}).appeals.find(a=>a.id===appeal.id).status,'approved');
});
test('a different Guild member cannot impersonate a banned appellant, and expired bans cannot be appealed',()=>{
  const f=fixture();[A,B].forEach(id=>f.member(id));f.member(C,'e'.repeat(64));f.contributor(A);
  const ban=proposeWithNoticedCase(f.sql,{...f.context,actorId:A,action:'ban',targetUserId:C,
    statement:'Security tests reject unrelated device credentials and forged subject IDs.'});
  castGovernanceVote(f.sql,{...f.context,actorId:B,ballotId:ban.id,choice:'yes'});
  assert.throws(()=>fileBanAppeal(f.sql,{actorId:B,credentialHash:'cred-'+B,ballotId:ban.id,
    statement:'An unrelated Guild member cannot forge a ban appeal.'}),/credential|subject|ban/i);
  f.sql.exec('UPDATE guild_governance_bans SET expires_at=? WHERE user_id=?',new Date(Date.now()-1000).toISOString(),C);
  assert.throws(()=>fileBanAppeal(f.sql,{actorId:C,credentialHash:'e'.repeat(64),ballotId:ban.id,
    statement:'This ban has expired and is no longer appealable.'}),/active|expired/i);
});

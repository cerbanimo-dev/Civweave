import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import {webcrypto} from 'node:crypto';
import {majority,ballotSpec,ballotOutcome,qualifiedContributors,GUILD_CONTRIBUTION_WINDOW_MS} from '../cloudflare/mobile-guild-edge/src/guild-democratic-governance-v1.mjs';
import {creditVerifiedContribution,proposeGovernance,castGovernanceVote,
  delegatedRole,isBanned,governanceStatus,reportQueue,reportReceipt,markReportDelivery} from '../cloudflare/mobile-guild-edge/src/guild-democratic-governance-state-v1.mjs';
import {distanceKm,deliverVerifiedGuildReport} from '../cloudflare/core/src/guild-peer-reports-v1.mjs';

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
  const contributor=(id,kind='published-quest')=>creditVerifiedContribution(sql,{id:kind+':'+id,userId:id,kind});
  const context={guildId:'guild-a',origin:'https://guild-a.workers.dev'};
  return{sql,db,member,contributor,context,memberCount:()=>db.prepare('SELECT COUNT(*) AS n FROM resident_members').get().n};
}
test('majority is strict and cannot be met by an owner alone when multiple members contributed',()=>{
  assert.deepEqual([1,2,3,4,5].map(majority),[1,2,2,3,3]);
  const members=[{userId:A},{userId:B},{userId:C}],t=Date.now();
  const receipts=[{userId:A,kind:'published-quest',at:new Date(t-1000).toISOString()},
    {userId:B,kind:'physical-check-in',at:new Date(t-1000).toISOString()},
    {userId:C,kind:'neuron-use',at:new Date(t-1000).toISOString()},
    {userId:C,kind:'published-quest',at:new Date(t-GUILD_CONTRIBUTION_WINDOW_MS-1000).toISOString()}];
  assert.deepEqual(qualifiedContributors(members,receipts,{now:t}),[A,B]);
  assert.throws(()=>ballotSpec({action:'remove',targetUserId:A,initiatorUserId:A,eligible:[A],statement:'Verified concerns require a documented member decision.',now:t}),/normal account departure/);
  assert.throws(()=>ballotSpec({action:'ban',targetUserId:A,initiatorUserId:B,eligible:[A],statement:'Verified concerns require a documented member decision.',now:t}),/recent verified contribution/);
});
test('approved ballots auto-remove and invalidate sessions; a proposer alone cannot act in a two-voter Guild',()=>{
  const f=fixture();[A,B,C].forEach(id=>f.member(id));f.contributor(A);f.contributor(B);
  const first=proposeGovernance(f.sql,{...f.context,statement:'Verified concerns require a documented member decision.',actorId:A,action:'remove',targetUserId:C});
  assert.equal(first.status,'open');assert.equal(first.yes,1);assert.equal(first.requiredYes,2);assert.equal(f.memberCount(),3);
  const declined=castGovernanceVote(f.sql,{...f.context,actorId:B,ballotId:first.id,choice:'no'});
  assert.equal(declined.status,'rejected');assert.equal(f.memberCount(),3);
  const second=proposeGovernance(f.sql,{...f.context,statement:'Verified concerns require a documented member decision.',actorId:A,action:'remove',targetUserId:C});
  const final=castGovernanceVote(f.sql,{...f.context,actorId:B,ballotId:second.id,choice:'yes'});
  assert.equal(final.status,'approved');assert.equal(final.executed,true);assert.equal(f.memberCount(),2);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM resident_sessions WHERE user_id=?').get(C).n,0);
  assert.throws(()=>castGovernanceVote(f.sql,{...f.context,actorId:B,ballotId:second.id,choice:'yes'}),/already closed/);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM guild_governance_audit WHERE event=?').get('approved').n,1);
});
test('active productive target stays protected until community majority, even if not the proposer',()=>{
  const f=fixture();[A,B,C].forEach(id=>f.member(id));[A,B,C].forEach(id=>f.contributor(id));
  const ballot=proposeGovernance(f.sql,{...f.context,statement:'Verified concerns require a documented member decision.',actorId:A,action:'remove',targetUserId:C});
  assert.equal(ballot.status,'open');assert.equal(f.memberCount(),3);
  assert.equal(castGovernanceVote(f.sql,{...f.context,actorId:B,ballotId:ballot.id,choice:'yes'}).status,'approved');
  assert.equal(f.memberCount(),2);
});
test('majority-approved Guildkeeper role transfer and revocation affect effective authority immediately',()=>{
  const f=fixture();[A,B,C].forEach(id=>f.member(id));f.contributor(A);f.contributor(B);
  const ballot=proposeGovernance(f.sql,{...f.context,statement:'Verified concerns require a documented member decision.',actorId:A,action:'transfer-role',targetUserId:C,role:'guildkeeper'});
  assert.equal(delegatedRole(f.sql,C),'member');
  castGovernanceVote(f.sql,{...f.context,actorId:B,ballotId:ballot.id,choice:'yes'});
  assert.equal(delegatedRole(f.sql,C),'guildkeeper');
  const next=proposeGovernance(f.sql,{...f.context,statement:'Verified concerns require a documented member decision.',actorId:A,action:'transfer-role',targetUserId:C,role:'member'});
  castGovernanceVote(f.sql,{...f.context,actorId:B,ballotId:next.id,choice:'yes'});
  assert.equal(delegatedRole(f.sql,C),'member');
});
test('approved bans block old user IDs and existing device credential reuse, but expire',()=>{
  const f=fixture();[A,B,C].forEach(id=>f.member(id));f.contributor(A);f.contributor(B);
  const ballot=proposeGovernance(f.sql,{...f.context,statement:'Verified concerns require a documented member decision.',actorId:A,action:'ban',targetUserId:C});
  assert.equal(isBanned(f.sql,C),false);
  castGovernanceVote(f.sql,{...f.context,actorId:B,ballotId:ballot.id,choice:'yes'});
  assert.equal(isBanned(f.sql,C),true);
  assert.equal(isBanned(f.sql,D,{credentialHash:'cred-'+C}),true);
  assert.equal(isBanned(f.sql,D,{credentialHash:'other'}),false);
  assert.equal(isBanned(f.sql,C,{now:Date.now()+91*86400000}),false);
});
test('approved report is queued without exposing a member ID or enforcing a remote ban; retry idempotent',()=>{
  const f=fixture();[A,B,C].forEach(id=>f.member(id));f.contributor(A);f.contributor(B);
  const ballot=proposeGovernance(f.sql,{...f.context,statement:'Verified concerns require a documented member decision.',actorId:A,action:'report',targetUserId:C,reasonCode:'harassment'});
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
          delivered.add(this.args[2]);seen.push({recipient:this.args[2],receipt:JSON.parse(this.args[3])});
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

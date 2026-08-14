import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalJson,createCredential,createChangeSet,applyRails,transitionChangeSet,createGroup,openBallot,castBallot,
  closeBallot,recordConsent,createDissent,createNodeOutcome,verifyNodeOutcome,issueExecutionAuthorization,
  createExecutionPacket,validateExecutionPacket,reviseChangeSet,sha256
} from '../public/app/anarchadia-governance-kernel-v145.js';
import {
  openSignedConsensusRound,castSignedConsensusPosition,verifySignedConsensusPosition,
  tallySignedConsensusRound,closeSignedConsensusRound
} from '../public/app/anarchadia-consensus-kernel-v1.js';

const BASE='a'.repeat(40);
async function passingChange(extra={}){
  return createChangeSet({
    title:'Restore a governed control',
    request:'Add a bounded, reversible control requested by the user.',
    area:'Anarchadia',
    baseCommit:BASE,
    targetBranch:'agent/anarchadia-governed-control',
    files:[{path:'public/app/generated/anarchadia/control.js',content:"export const enabled=true;\n"}],
    acceptance:['The control is visible','npm run check passes'],
    rollback:'Revert the prepared commit and retain the previous device package.',
    risk:'Local reversible interface change; privacy and accessibility reviewed.',
    consentRequirements:[],
    ...extra
  });
}
test('rails require exact base, branch namespace, acceptance, and rollback',async()=>{
  const good=await passingChange();const result=applyRails(good);assert.equal(result.passed,true);assert.equal(good.state,'rails-checked');
  const bad=await passingChange({baseCommit:'main',targetBranch:'main'});const blocked=applyRails(bad);assert.equal(blocked.passed,false);assert.ok(blocked.blocking.length>=2);
});
test('group ballot uses frozen credentials and reproducible tally',async()=>{
  const a=await createCredential('A'),b=await createCredential('B');
  const change=await passingChange();applyRails(change);transitionChangeSet(change,'deliberating');transitionChangeSet(change,'frozen');
  const group=createGroup({name:'Maintainers',memberIds:[a.record.id,b.record.id],quorum:.5,threshold:.5});
  const ballot=await openBallot(change,{kind:'group',constituencyId:group.id,electorate:[a.record,b.record],quorum:.5,threshold:.5});
  await castBallot(ballot,a.record,a.privateKey,'approve');
  await castBallot(ballot,b.record,b.privateKey,'abstain');
  const outcome=await closeBallot(ballot,change);assert.equal(outcome.outcome,'adopted');assert.equal(change.state,'outcome-declared');
});
test('consent is separate and required scope blocks authorization',async()=>{
  const node=await createCredential('Node','node','federation'),member=await createCredential('Affected member');
  const change=await passingChange({consentRequirements:['publish-local-ui']});applyRails(change);transitionChangeSet(change,'deliberating');transitionChangeSet(change,'frozen');
  const ballot=await openBallot(change,{kind:'group',constituencyId:'group',electorate:[member.record],quorum:1,threshold:.5});
  await castBallot(ballot,member.record,member.privateKey,'approve');await closeBallot(ballot,change);
  await assert.rejects(()=>issueExecutionAuthorization(change,ballot,[],node.record,node.privateKey),/Missing required consent/);
  const consent=await recordConsent({changeSetId:change.id,revisionHash:change.revisionHash,scope:'publish-local-ui',decision:'granted'},member.record,member.privateKey);
  const auth=await issueExecutionAuthorization(change,ballot,[consent],node.record,node.privateKey);assert.equal(auth.executionMode,'branch-only');
});
test('execution packet is hash-bound and rejects mutation',async()=>{
  const node=await createCredential('Node','node','federation'),member=await createCredential('Member');
  const change=await passingChange();applyRails(change);transitionChangeSet(change,'deliberating');transitionChangeSet(change,'frozen');
  const ballot=await openBallot(change,{kind:'group',constituencyId:'group',electorate:[member.record],quorum:1,threshold:.5});
  await castBallot(ballot,member.record,member.privateKey,'approve');await closeBallot(ballot,change);
  const dissent=await createDissent({changeSetId:change.id,revisionHash:change.revisionHash,text:'Proceed, but preserve the rollback receipt.'},member.record,member.privateKey);
  const auth=await issueExecutionAuthorization(change,ballot,[],node.record,node.privateKey);
  const packet=await createExecutionPacket(change,ballot,auth,[dissent]);assert.equal((await validateExecutionPacket(packet)).valid,true);
  packet.changeSet.files[0].content='export const enabled=false;\n';
  const invalid=await validateExecutionPacket(packet);assert.equal(invalid.valid,false);assert.ok(invalid.errors.some(x=>/hash mismatch/i.test(x)));
});
test('revision invalidates an earlier ballot and authorization path',async()=>{
  const member=await createCredential('Member'),change=await passingChange();applyRails(change);transitionChangeSet(change,'deliberating');transitionChangeSet(change,'frozen');
  const ballot=await openBallot(change,{kind:'group',constituencyId:'group',electorate:[member.record],quorum:1,threshold:.5});
  const revised=await reviseChangeSet(change,{request:'Changed after ballot opened.'});
  assert.notEqual(revised.revisionHash,ballot.revisionHash);
});
test('signed node outcome verifies only against the trusted key',async()=>{
  const node=await createCredential('Node','node','federation'),other=await createCredential('Other','node','federation'),member=await createCredential('Member');
  const change=await passingChange();applyRails(change);transitionChangeSet(change,'deliberating');transitionChangeSet(change,'frozen');
  const ballot=await openBallot(change,{kind:'group',constituencyId:'group',electorate:[member.record],quorum:1,threshold:.5});
  await castBallot(ballot,member.record,member.privateKey,'approve');await closeBallot(ballot,change);
  const outcome=await createNodeOutcome(ballot,node.record,node.privateKey);
  assert.equal(await verifyNodeOutcome(outcome,node.record),true);
  assert.equal(await verifyNodeOutcome(outcome,other.record),false);
});
test('signed consensus freezes electorate and binds positions to the subject revision',async()=>{
  const a=await createCredential('A'),b=await createCredential('B'),c=await createCredential('C');
  const subject={id:'intention-demo',revisionHash:await sha256(canonicalJson({id:'intention-demo',revision:1}))};
  const round=await openSignedConsensusRound(subject,{authorityLevel:'hub',electorate:[c.record,a.record,b.record],quorum:.6,threshold:.67});
  const reordered=await openSignedConsensusRound(subject,{authorityLevel:'hub',electorate:[b.record,c.record,a.record],quorum:.6,threshold:.67});
  assert.equal(round.snapshotHash,reordered.snapshotHash);
  await castSignedConsensusPosition(round,a.record,a.privateKey,'support');
  await castSignedConsensusPosition(round,b.record,b.privateKey,'support');
  await castSignedConsensusPosition(round,c.record,c.privateKey,'abstain');
  assert.equal(tallySignedConsensusRound(round).outcome,'ready-to-adopt');
  assert.equal((await closeSignedConsensusRound(round,subject)).outcome,'adopted');
});
test('signed consensus detects tampering without choosing who belongs to an authority layer',async()=>{
  const member=await createCredential('Member');
  const subject={id:'proposal',revisionHash:await sha256('revision-1')};
  const round=await openSignedConsensusRound(subject,{authorityLevel:'externally-resolved',electorate:[member.record],quorum:1,threshold:1});
  const position=await castSignedConsensusPosition(round,member.record,member.privateKey,'support');
  assert.equal(await verifySignedConsensusPosition(round,position),true);
  position.choice='oppose';
  assert.equal(await verifySignedConsensusPosition(round,position),false);
  await assert.rejects(()=>closeSignedConsensusRound(round,subject),/Invalid consensus signature/);
});

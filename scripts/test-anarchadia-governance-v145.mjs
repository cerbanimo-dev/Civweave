import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCredential,createChangeSet,applyRails,transitionChangeSet,createGroup,openBallot,castBallot,
  closeBallot,recordConsent,createDissent,createNodeOutcome,verifyNodeOutcome,issueExecutionAuthorization,
  createExecutionPacket,validateExecutionPacket,reviseChangeSet,createIntentionPlan,intentionAuthorityPath,
  openConsensusRound,castConsensusPosition,tallyConsensusRound,closeConsensusRound
} from '../public/app/anarchadia-governance-kernel-v145.js';

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
test('intention authority keeps learning personal and shared generations collective',async()=>{
  assert.deepEqual(intentionAuthorityPath({realms:['living-school']}),['individual']);
  assert.deepEqual(intentionAuthorityPath({realms:['cerbanimo']}),['hub']);
  assert.deepEqual(intentionAuthorityPath({realms:['fellowfare']}),['hub']);
  assert.deepEqual(intentionAuthorityPath({realms:['living-school','cerbanimo']}),['hub','region','mesh']);
  const personal=await createIntentionPlan({title:'Practice joinery',summary:'Follow my own learning path.',realms:['living-school']});
  assert.equal(personal.state,'adopted');assert.equal(personal.decisions[0].level,'individual');
});
test('mesh intentions advance hub then region then mesh on the same signed revision',async()=>{
  const members=await Promise.all(['A','B','C'].map(label=>createCredential(label)));
  const plan=await createIntentionPlan({title:'Shared repair generation',summary:'Coordinate learning, labor, and materials across the mesh.',realms:['living-school','cerbanimo','fellowfare'],reach:'mesh'});
  for(const level of ['hub','region','mesh']){
    assert.equal(plan.activeLevel,level);
    const round=await openConsensusRound(plan,{level,electorate:members.map(item=>item.record),quorum:.6,threshold:.67});
    await castConsensusPosition(round,members[0].record,members[0].privateKey,'support');
    await castConsensusPosition(round,members[1].record,members[1].privateKey,'support');
    const tally=tallyConsensusRound(round);assert.equal(tally.quorumMet,true);assert.equal(tally.thresholdMet,true);assert.equal(tally.outcome,'ready-to-adopt');
    const outcome=await closeConsensusRound(round,plan);assert.equal(outcome.outcome,'adopted');
  }
  assert.equal(plan.state,'adopted');assert.deepEqual(plan.decisions.map(item=>item.level),['hub','region','mesh']);
});
test('consensus reports when adoption is no longer mathematically plausible',async()=>{
  const members=await Promise.all(['A','B','C','D','E'].map(label=>createCredential(label)));
  const plan=await createIntentionPlan({title:'Contested mesh plan',summary:'A plan whose threshold cannot be reached.',realms:['civweave'],reach:'mesh'});
  const round=await openConsensusRound(plan,{level:'hub',electorate:members.map(item=>item.record),quorum:.6,threshold:.67});
  for(const item of members.slice(0,3))await castConsensusPosition(round,item.record,item.privateKey,'oppose');
  const tally=tallyConsensusRound(round);assert.equal(tally.plausible,false);assert.equal(tally.outcome,'stalled');assert.ok(tally.neededForThreshold>tally.remaining);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {PERFORMANCE_SCHEMA} from '../public/app/shared/worldweaver-performance-studio-v1.mjs';
import {
  CONVERGENCE_CAST_SCHEMA,CONVERGENCE_GUIDE_IDS,CONVERGENCE_MILESTONES,
  convergenceTimeline,convergenceRoster,projectBookCast,verifyBookCastPacket,
  bookNpcCommand,bookEncounterMessages
} from '../public/app/shared/worldweaver-convergence-cast-v1.mjs';
import {STARLING_PERSONAS} from '../public/app/shared/starling-collective-v1.mjs';

function performance(){
  return {
    schema:PERFORMANCE_SCHEMA,revision:8,
    project:{id:'book:cycle',title:'Mirror and Blade',sourceTitle:'Author manuscript',rights:'owned'},
    sources:[{id:'private:1',text:'UNRELEASED MANUSCRIPT SECRET'}],
    audience:[{id:'audience:1',text:'PRIVATE AUDIENCE REACTION'}],
    casts:[{
      character:'maggie',displayName:'Maggie',avatarRef:'approved:maggie',
      pilotPrincipalId:'pilot:maggie',approvedBy:'author:cami',
      personaBrief:'A future retrospective voice',canonRules:'Voluntary role exchange; different future times.',
      relationships:'Magnus has separate agency.',interactionRules:'Noncanonical improv.'
    },{
      character:'magnus',displayName:'Magnus',avatarRef:'approved:magnus',
      pilotPrincipalId:'pilot:magnus',approvedBy:'author:cami'
    }],
    proposals:[{id:'scene:1',status:'approved',dialogue:[{character:'maggie',text:'Line'},{character:'magnus',text:'Other line'}]},
      {id:'scene:2',status:'review-required',dialogue:[{character:'unknown',text:'Not approved'}]}]
  };
}
test('Convergence chronology is sequential and defaults to unreleased',()=>{
  assert.equal(convergenceTimeline().phase,'development');
  const [core,collective,pub]=CONVERGENCE_MILESTONES.map(milestone=>({milestone,validated:true}));
  const check=r=>r.validated===true;
  assert.equal(convergenceTimeline({receipts:[pub],verifyReceipt:check}).publicOpen,false);
  assert.equal(convergenceTimeline({receipts:[core,collective],verifyReceipt:check}).phase,'collective-encounter');
  assert.equal(convergenceTimeline({receipts:[core,pub],verifyReceipt:check}).phase,'cerbanimo-encounter');
  assert.equal(convergenceTimeline({receipts:[core,collective,pub],verifyReceipt:check}).publicOpen,true);
  assert.equal(convergenceTimeline({receipts:[core,collective,pub],verifyReceipt:()=>false}).phase,'development');
});
test('Book cast is projected only from rights-cleared, author-approved speaking parts',()=>{
  const source=performance(),pack=projectBookCast(source);
  assert.equal(pack.schema,CONVERGENCE_CAST_SCHEMA);
  assert.equal(pack.characters.length,2);
  assert.equal(pack.publication,'private-preview');
  assert.equal(pack.signed,false);
  assert.equal(pack.characters[0].name,'Maggie');
  assert.ok(pack.characters[0].approvedSceneIds.includes('scene:1'));
  assert.doesNotMatch(JSON.stringify(pack),/UNRELEASED MANUSCRIPT SECRET|PRIVATE AUDIENCE REACTION/);
  assert.equal(verifyBookCastPacket(pack),pack);
  const blocked=performance();blocked.project.rights='unknown';
  assert.throws(()=>projectBookCast(blocked),/Rights-cleared/);
  blocked.project.rights='owned';blocked.proposals[0].status='review-required';
  assert.throws(()=>projectBookCast(blocked),/Approve a screenplay/);
});
test('Existing core guides and Starling remain canonical and books are additional preview roles',()=>{
  const roster=convergenceRoster({bookPacket:projectBookCast(performance())});
  assert.equal(roster.filter(x=>x.team==='cerbanimo').length,CONVERGENCE_GUIDE_IDS.length);
  assert.equal(roster.filter(x=>x.team==='collective').length,Object.keys(STARLING_PERSONAS).length);
  assert.deepEqual(roster.filter(x=>x.team==='book').map(x=>x.name),['Maggie','Magnus']);
  assert.equal(roster.find(x=>x.id==='book:maggie').status,'private-preview');
  assert.ok(!roster.some(x=>x.team==='book'&&x.status==='canonical-guide'));
});
test('Model pilots cannot self-approve book NPCs or acquire privileged tools',()=>{
  const pack=projectBookCast(performance());
  const args={bookPacket:pack,character:'maggie',instanceId:'world:1',modelId:'model:4b',
    pilotPrincipalId:'verified:model:4b'};
  assert.throws(()=>bookNpcCommand(args),/Trusted author approval/);
  assert.throws(()=>bookNpcCommand({...args,verifyAuthorApproval:()=>false}),/Trusted author approval/);
  assert.throws(()=>bookNpcCommand({...args,verifyAuthorApproval:()=>true,capabilities:['cast-screen']}),/bounded simulation/);
  const command=bookNpcCommand({...args,verifyAuthorApproval:()=>true});
  assert.equal(command.type,'rig-npc');
  assert.equal(command.personaRef,'book:maggie');
  assert.equal(command.modelId,'model:4b');
  assert.match(command.pilotPrompt,/Voluntary role exchange/);
  assert.match(command.pilotPrompt,/separate Landry\/Delia and Magnus\/Maggie agency/);
  assert.doesNotMatch(JSON.stringify(command),/UNRELEASED MANUSCRIPT SECRET/);
});
test('Book encounter prompt is role-scoped, not a second chat or canonical manuscript mutation',()=>{
  const pack=projectBookCast(performance());
  const [system,user]=bookEncounterMessages({bookPacket:pack,character:'maggie',phase:'cerbanimo-encounter',sceneContext:'A quiet threshold.'});
  assert.match(system.content,/future retrospective voice/);
  assert.match(user.content,/Team Cerbanimo/);
  assert.doesNotMatch(user.content,/Starling Collective/);
  assert.match(user.content,/Respond as Maggie only/);
  assert.throws(()=>bookEncounterMessages({bookPacket:pack,character:'maggie',phase:'public-now'}),/phase/);
  assert.throws(()=>bookEncounterMessages({bookPacket:pack,character:'unknown'}),/not in the reviewed/);
});

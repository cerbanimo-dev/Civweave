import test from 'node:test';
import assert from 'node:assert/strict';
import {detectLexiconMatches,assessHateSpeech,normalizeModerationText} from '../public/app/anarchadia-hate-speech-v1.js';
import {newJurorProfile,dismissJuryInvitation,recordJurorReview,openTribunalCase,assignJury,submitJuryVerdict,tallyTribunal,closeTribunal,validateSecondaryReview,mintReadyJuryRewards,createRegionalAppeal,tribunalGossipEnvelope,JURY_REWARD_ACORNS} from '../public/app/anarchadia-tribunal-v1.js';
import {createVoteDelegation,resolveDelegate,openQuadraticPolicyBallot,castQuadraticAllocation,tallyQuadraticPolicyBallot,closeQuadraticPolicyBallot} from '../public/app/anarchadia-civic-voting-v1.js';
import {defaultTribunalPolicy,proposeTribunalPolicyChange,openTribunalPolicyBallot,adoptTribunalPolicy} from '../public/app/anarchadia-tribunal-policy-v1.js';
import {settleTribunalSanctions,publicChatAccess} from '../public/app/anarchadia-tribunal-enforcement-v1.js';
import {loadJurorProfile,recordSecondaryReview,recordJuryDismissal,assignJuryFromRegistry} from '../public/app/anarchadia-juror-registry-v1.js';

async function credential(id){const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);return {record:{id,publicKey:await crypto.subtle.exportKey('jwk',pair.publicKey)},privateKey:pair.privateKey}}

test('normalization catches leet, spacing, and kana variants without altering original evidence',()=>{
  const v=normalizeModerationText('N 1 G G 3 R');assert.equal(v.original,'N 1 G G 3 R');assert.match(v.leetCompact,/nigger/);
  assert.ok(detectLexiconMatches('n 1 g g 3 r').some(x=>x.id==='en-racial-01'));
  assert.ok(detectLexiconMatches('ホ モ').some(x=>x.id==='ja-sexuality-01'));
});

test('classifier threshold opens a case candidate but never creates a guilty verdict',async()=>{
  const assessment=await assessHateSpeech('n1gg3r',{useMiniLM:false});assert.equal(assessment.tribunalEligible,true);assert.equal(assessment.decision,'open-tribunal-candidate');
  const c=await openTribunalCase({assessment,accusedActorId:'accused',affectedActorIds:['victim'],regionId:'region-1',evidence:[{id:'msg-1',hash:'sha256:message'}]});assert.equal(c.status,'jury-selection');assert.equal(c.outcome,null);
});

test('jury selection rewards good reviewers but dismissals drift only toward baseline',()=>{
  let p=newJurorProfile('j1');p=recordJurorReview(p,{valid:true});p=recordJurorReview(p,{valid:true});assert.ok(p.selectionBonus>0);const before=p.selectionBonus;p=dismissJuryInvitation(p);assert.ok(p.selectionBonus<before);for(let i=0;i<20;i++)p=dismissJuryInvitation(p);assert.equal(p.selectionBonus,0);assert.equal(p.baselineWeight,1);
});

test('quorum verdict mints two acorns immediately unless selected for secondary review',async()=>{
  const assessment=await assessHateSpeech('n1gg3r',{useMiniLM:false});const c=await openTribunalCase({assessment,accusedActorId:'accused',affectedActorIds:['victim'],evidence:[{id:'e1',hash:'h1'}],procedure:{panelSize:3,quorum:2/3,guiltThreshold:2/3}});
  assignJury(c,['a','b','c','d'].map(actorId=>({actorId,profile:newJurorProfile(actorId)})),{rng:()=>0});
  for(const actorId of c.jury.slice(0,2).map(x=>x.actorId))await submitJuryVerdict(c,{actorId,verdict:'guilty',severity:2,explanation:'The cited message directly uses a protected-target slur as an attack on the affected person.',evidenceRefs:['e1']});
  assert.equal(tallyTribunal(c).outcome,'guilty');await closeTribunal(c,{rng:()=>0.99,secondaryReviewRate:0});
  const ledgerCalls=[],ledger={appendEntry:async x=>ledgerCalls.push(x)};const minted=await mintReadyJuryRewards(c,{ledger});assert.equal(minted.length,2);assert.ok(minted.every(x=>x.amount===JURY_REWARD_ACORNS));assert.equal(ledgerCalls.length,2);assert.ok(ledgerCalls.every(x=>x.metadata.reason==='tribunal_jury_reward'));
});

test('secondary human review gates only the selected juror reward and dissent is not auto-invalid',async()=>{
  const assessment=await assessHateSpeech('n1gg3r',{useMiniLM:false});const c=await openTribunalCase({assessment,accusedActorId:'accused',affectedActorIds:['victim'],evidence:[{id:'e1',hash:'h1'}],procedure:{panelSize:3,quorum:1,guiltThreshold:2/3}});
  assignJury(c,['a','b','c'].map(actorId=>({actorId,profile:newJurorProfile(actorId)})),{rng:()=>0});
  const ids=c.jury.map(x=>x.actorId);await submitJuryVerdict(c,{actorId:ids[0],verdict:'guilty',severity:3,explanation:'Evidence one contains a targeted protected-class attack and I find the charge substantiated.',evidenceRefs:['e1']});await submitJuryVerdict(c,{actorId:ids[1],verdict:'guilty',severity:3,explanation:'I independently find the attack targeted and severe based on the preserved case evidence.',evidenceRefs:['e1']});await submitJuryVerdict(c,{actorId:ids[2],verdict:'not-guilty',explanation:'I read the same evidence but interpret the preserved context as quotation rather than an attack.',evidenceRefs:['e1']});
  let n=0;await closeTribunal(c,{rng:()=>n++===0?0.01:0.99,secondaryReviewRate:0.15});const pending=c.submissions.find(x=>x.validation.secondaryReview==='pending');assert.ok(pending);validateSecondaryReview(c,pending.actorId,{valid:true,reviewerActorId:'reviewer',note:'Reasoning was coherent even if it did not match the panel majority.'});const minted=await mintReadyJuryRewards(c,{ledger:null});assert.equal(minted.length,3);
});

test('appeal excludes the original jury and mesh gossip never carries raw abusive content',async()=>{
  const assessment=await assessHateSpeech('n1gg3r',{useMiniLM:false});const c=await openTribunalCase({assessment,accusedActorId:'accused',affectedActorIds:['victim'],evidence:[{id:'e1',hash:'h1',contextHash:'ctx'}],procedure:{panelSize:1,quorum:1,guiltThreshold:1}});assignJury(c,[{actorId:'juror',profile:newJurorProfile('juror')}],{rng:()=>0});await submitJuryVerdict(c,{actorId:'juror',verdict:'guilty',severity:1,explanation:'The preserved evidence directly supports the protected-target slur charge in this context.',evidenceRefs:['e1']});await closeTribunal(c,{rng:()=>0.99,secondaryReviewRate:0});const appeal=await createRegionalAppeal(c,{appellantActorId:'accused',regionId:'region-2',reason:'Context was misread.'});assert.deepEqual(appeal.excludeJurorIds,['juror']);const gossip=tribunalGossipEnvelope(c);assert.equal(gossip.rawAbusiveContentIncluded,false);assert.equal(gossip.evidence[0].hash,'h1');assert.equal('text' in gossip.evidence[0],false);
});

test('hot-swap delegation yields to direct votes and quadratic costs remain per voter',async()=>{
  const a=await credential('a'),b=await credential('b'),c=await credential('c');const delegation=await createVoteDelegation({toActorId:'b',scope:'moderation-policy'},a.record,a.privateKey);assert.equal(resolveDelegate('a',[delegation],{scope:'moderation-policy'}).actorId,'b');
  const subject={id:'policy',revisionHash:'rev-1'};const ballot=await openQuadraticPolicyBallot(subject,{scope:'moderation-policy',electorate:[a.record,b.record,c.record],options:['strict','balanced'],creditsPerVoter:9,quorum:2/3});await castQuadraticAllocation(ballot,b.record,b.privateKey,{balanced:3});let tally=tallyQuadraticPolicyBallot(ballot,[delegation]);assert.equal(tally.participation,2/3);assert.equal(tally.totals.balanced,6,'delegate choice is applied once per represented voter, each with its own vote vector');await castQuadraticAllocation(ballot,a.record,a.privateKey,{strict:2});tally=tallyQuadraticPolicyBallot(ballot,[delegation]);assert.equal(tally.totals.balanced,3);assert.equal(tally.totals.strict,2);
});

class StorageMock{constructor(){this.map=new Map()}getItem(k){return this.map.has(k)?this.map.get(k):null}setItem(k,v){this.map.set(k,String(v))}}

test('tribunal sanction settings cannot take effect without a quorum-adopted policy ballot',async()=>{
  const a=await credential('a'),b=await credential('b'),c=await credential('c'),storage=new StorageMock();
  const base=defaultTribunalPolicy('region-1');
  const proposal=await proposeTribunalPolicyChange(base,{sanctions:{2:{buttonFine:3,acornRestitution:2,publicChatBanMinutes:30}}},{reason:'Set a locally governed severity-two remedy.'});
  const ballot=await openTribunalPolicyBallot(proposal,[a.record,b.record,c.record],{creditsPerVoter:9,quorum:2/3});
  await castQuadraticAllocation(ballot,a.record,a.privateKey,{adopt:2});
  await assert.rejects(()=>closeQuadraticPolicyBallot(ballot,[]),/quorum/);
  assert.throws(()=>adoptTribunalPolicy(proposal,ballot,[],{storage}),/ballot-not-closed/);
  await castQuadraticAllocation(ballot,b.record,b.privateKey,{adopt:2});
  await closeQuadraticPolicyBallot(ballot,[]);
  const adopted=adoptTribunalPolicy(proposal,ballot,[],{storage});assert.equal(adopted.sanctions[2].buttonFine,3);assert.equal(adopted.invariants.juryRewardAcorns,2);
});

test('guilty tribunal settlement keeps fine, restitution, and public-chat restriction separate',async()=>{
  const assessment=await assessHateSpeech('n1gg3r',{useMiniLM:false});const c=await openTribunalCase({assessment,accusedActorId:'accused',affectedActorIds:['victim'],regionId:'region-1',evidence:[{id:'e1',hash:'h1'}],procedure:{panelSize:1,quorum:1,guiltThreshold:1}});assignJury(c,[{actorId:'juror',profile:newJurorProfile('juror')}],{rng:()=>0});await submitJuryVerdict(c,{actorId:'juror',verdict:'guilty',severity:2,explanation:'The evidence contains a targeted protected-class attack directed at the affected participant.',evidenceRefs:['e1']});await closeTribunal(c,{rng:()=>0.99,secondaryReviewRate:0});
  const policy=defaultTribunalPolicy('region-1');policy.sanctions[2]={buttonFine:3,acornRestitution:2,publicChatBanMinutes:30};const calls=[],ledger={appendEntry:async row=>calls.push(row)},storage=new StorageMock();const settled=await settleTribunalSanctions(c,policy,{ledger,storage});
  assert.equal(calls.filter(x=>x.assetType==='button').length,1);assert.equal(calls.find(x=>x.assetType==='button').amount,-3);assert.equal(calls.filter(x=>x.assetType==='acorn').length,1);assert.equal(calls.find(x=>x.assetType==='acorn').amount,2);assert.equal(publicChatAccess('accused',{storage}).allowed,false);assert.equal(settled.some(x=>x.kind==='public-chat-restriction'),true);
});

test('juror reputation persists across assignments, positive reviews, and dismissal decay',async()=>{
  const storage=new StorageMock(),assessment=await assessHateSpeech('n1gg3r',{useMiniLM:false});
  let profile=recordSecondaryReview('juror-a',{valid:true,storage});profile=recordSecondaryReview('juror-a',{valid:true,storage});assert.ok(profile.selectionBonus>0);
  const bonus=profile.selectionBonus,c=await openTribunalCase({assessment,accusedActorId:'accused',affectedActorIds:['victim'],evidence:[{id:'e1',hash:'h1'}],procedure:{panelSize:1,quorum:1,guiltThreshold:1}});
  assignJuryFromRegistry(c,['juror-a','juror-b'],{storage,rng:()=>0});const selected=loadJurorProfile(c.jury[0].actorId,{storage});assert.equal(selected.servedAt.length,1);
  let dismissed=recordJuryDismissal('juror-a',{storage});assert.ok(dismissed.selectionBonus<bonus);for(let i=0;i<20;i++)dismissed=recordJuryDismissal('juror-a',{storage});assert.equal(dismissed.selectionBonus,0);assert.equal(loadJurorProfile('juror-a',{storage}).baselineWeight,1);
});

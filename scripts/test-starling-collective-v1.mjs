import test from 'node:test';
import assert from 'node:assert/strict';
import {STARLING_PERSONAS, resolveCollectiveIntention, collectTaskCandidates, collectiveGenerationGate, normalizeFoundingIntention, guildQuestBeatSnapshot, discoverGuildOpportunities} from '../lib/starling-collective-v1.mjs';

const founding = {id:'f-1', title:'Grow the community garden', goal:'Grow and sustain a community garden'};
const adoption = {guildId:'g-1', intention:{id:'s-1',title:'A local food commons',goal:'Build a food commons'}, electorate:'human-guild-members', status:'ratified'};

test('ports eight Starling personas, including Kami, without inventing voting membership', () => {
  assert.deepEqual(Object.keys(STARLING_PERSONAS).sort(), ['anthony','aphra','farah','jae','kami','kit','rosa','sana']);
  for (const persona of Object.values(STARLING_PERSONAS)) assert.equal(persona.isHumanGuildMember, false);
});
test('founding Intention drives work until trusted human ratification', () => {
  const focus=resolveCollectiveIntention({guildId:'g-1',foundingIntention:founding});
  assert.equal(focus.source,'founding-intention');assert.equal(focus.intention.id,'f-1');
});
test('unverified or Collective-voted proposal never replaces founding Intention', () => {
  assert.equal(resolveCollectiveIntention({guildId:'g-1',foundingIntention:founding,ratification:adoption}).source,'founding-intention');
  const fake={...adoption,electorate:'collective-personas'};
  assert.equal(resolveCollectiveIntention({guildId:'g-1',foundingIntention:founding,ratification:fake,verifyRatification:()=>true}).source,'founding-intention');
});
test('verified Guild-member ratification replaces founding Intention', () => {
  const focus=resolveCollectiveIntention({guildId:'g-1',foundingIntention:founding,ratification:adoption,verifyRatification:row=>row.status==='ratified'});
  assert.equal(focus.source,'human-ratified');assert.equal(focus.intention.id,'s-1');
});
test('ratification cannot be applied across Guilds', () => {
  assert.equal(resolveCollectiveIntention({guildId:'g-2',foundingIntention:founding,ratification:adoption,verifyRatification:()=>true}).source,'founding-intention');
});
test('only verified human project tasks with available tools become offers', () => {
  const tasks=[{id:'a',state:'ready',requiredCapabilities:['research']},{id:'b',state:'ready',requiredCapabilities:['physical-construction']},{id:'c',state:'completed',requiredCapabilities:['research']},{id:'d',state:'ready',requiredCapabilities:['research']}];
  const result=collectTaskCandidates({tasks,tools:[{capability:'research',enabled:true}],verifyHumanAuthor:t=>t.id!=='d'});
  assert.deepEqual(result.map(r=>r.taskId),['a']);assert.equal(result[0].action,'offer');
});
test('auto-claim eligibility requires separately authorized per-task grant', () => {
  const tasks=[{id:'task',state:'ready',requiredCapabilities:['writing']}];
  const input={tasks,tools:[{capability:'writing',enabled:true}],verifyHumanAuthor:()=>true,autoClaimSelected:true};
  assert.equal(collectTaskCandidates(input)[0].action,'offer');
  assert.equal(collectTaskCandidates({...input,verifyAutoClaimGrant:()=>true})[0].action,'eligible-for-claim');
});
test('absent author verification fails closed', () => {
  assert.deepEqual(collectTaskCandidates({tasks:[{id:'t',state:'ready',requiredCapabilities:['writing']}],tools:[{capability:'writing',enabled:true}]}),[]);
});
test('local Collective never consumes hosted generation allowance', () => {
  assert.equal(collectiveGenerationGate({mode:'local'}).allowed,true);
  assert.equal(collectiveGenerationGate({mode:'local'}).chargeCloudNeurons,false);
});
test('hosted generations enforce daily and shared neuron ceilings', () => {
  assert.equal(collectiveGenerationGate({mode:'hosted',dailyUsed:3,dailyLimit:3,quotedNeurons:10,remainingNeurons:100}).allowed,false);
  assert.equal(collectiveGenerationGate({mode:'hosted',dailyUsed:0,dailyLimit:3,quotedNeurons:101,remainingNeurons:100}).allowed,false);
  assert.equal(collectiveGenerationGate({mode:'hosted',dailyUsed:0,dailyLimit:3,quotedNeurons:10,remainingNeurons:100}).allowed,true);
  assert.equal(collectiveGenerationGate({mode:'hosted'}).allowed,false);
});

test('founding Intention is validated and explicitly provisional, not activated Quest', () => {
  assert.throws(()=>normalizeFoundingIntention('too short'));
  const row=normalizeFoundingIntention('Develop a neighborhood seed library and garden.');
  assert.equal(row.status,'provisional');assert.equal(row.reviewedQuestId,null);
});
const publication={schema:'civweave.guild-quest-publication.v1',id:'guild-quest:abc',status:'published',guildId:'g-1',authorUserId:'member-1',revision:2,quest:{kind:'weave-plan',id:'q-1',state:'active',plan:{schema:'civweave.intention-weave.v1',title:'Community garden',paths:[
  {id:'p1',realm:'living-school',title:'Research',progress:[2],steps:[{id:'b1',title:'Source local soil guides',status:'ready'}, {id:'b2',title:'Interview growers',status:'in-progress'},'Compile verified reading list']},
  {id:'p2',realm:'cerbanimo',title:'Work',steps:[{id:'b3',title:'Build garden calendar',status:'blocked'}]}
]}}};
test('Guild beat status reads published authoritative projections without inventing completion proof', () => {
  const snapshot=guildQuestBeatSnapshot({guildId:'g-1',publications:[publication]});
  assert.equal(snapshot.reportedOnly,true);assert.equal(snapshot.totalBeats,4);
  assert.equal(snapshot.completedBeats,1);assert.equal(snapshot.activeBeats,1);assert.equal(snapshot.blockedBeats,1);
  assert.equal(snapshot.quests[0].beats[0].status,'ready');
});
test('rejects foreign Guild, withdrawn and malformed publications', () => {
  assert.equal(guildQuestBeatSnapshot({guildId:'g-2',publications:[publication]}).totalBeats,0);
  assert.equal(guildQuestBeatSnapshot({guildId:'g-1',publications:[{...publication,status:'withdrawn'}]}).totalBeats,0);
});
test('Guild opportunities are suggestions only, require verified human authorship and enabled capabilities', () => {
  const snapshot=guildQuestBeatSnapshot({guildId:'g-1',publications:[publication]});
  const input={snapshot,capabilities:[{id:'research',enabled:true}],verifyHumanPublisher:({userId})=>userId==='member-1'};
  const found=discoverGuildOpportunities(input);
  assert.equal(found.length,1);assert.equal(found[0].action,'suggest-offer-only');assert.equal(found[0].requiresCanonicalClaim,true);
  assert.deepEqual(discoverGuildOpportunities({...input,verifyHumanPublisher:()=>false}),[]);
  assert.deepEqual(discoverGuildOpportunities({...input,capabilities:[{id:'research',enabled:false}]}),[]);
});

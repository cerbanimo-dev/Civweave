import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

class Storage {
  #map=new Map();
  getItem(key){return this.#map.has(key)?this.#map.get(key):null}
  setItem(key,value){this.#map.set(key,String(value))}
  removeItem(key){this.#map.delete(key)}
  clear(){this.#map.clear()}
}
const context=vm.createContext({console,Date,Math,JSON,structuredClone,localStorage:new Storage(),dispatchEvent(){},CustomEvent:class{constructor(type,init={}){this.type=type;this.detail=init.detail}},setTimeout,clearTimeout});
context.globalThis=context;
for(const file of ['public/app/reward-policy-v198.js','public/app/context-plan-composer-v198.js'])vm.runInContext(fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8'),context,{filename:file});
const policy=context.CommonweaveRewardPolicyV198,composer=context.CommonweaveContextPlanComposerV198;
assert(policy&&composer,'v198 globals should install');
assert.match(policy.PROMOTION.headline,/50% more rewards/i);
assert.doesNotMatch(policy.PROMOTION.detail,/50% less/i);

const learning=await composer.composePath({text:'learn to repair a bicycle safely',kind:'learning',semantic:false});
const project=await composer.composePath({text:'build an offline neighborhood seed library app',kind:'project',semantic:false});
const market=await composer.composePath({text:'request 40 reusable food containers by Friday for a community meal',kind:'market',semantic:false});
for(const path of [learning,project,market]){
  assert(path.tasks.length>=5,'plans need at least five substantive tasks');
  assert(new Set(path.tasks.map(task=>task.role)).size>=5,'plans need diverse task roles');
  assert(path.tasks.every(task=>task.deliverable&&task.evidence.length&&task.acceptanceCriteria.length>=2),'every task needs deliverable, evidence, and criteria');
  assert(path.tasks.every(task=>task.rewardEligibility?.eligible),'composed tasks should pass the complexity gate');
  assert(!path.tasks.some(task=>/identify the smallest task/i.test(task.title)),'generic farmable task should not appear');
}
const projectAgain=await composer.composePath({text:'build an offline neighborhood seed library app',kind:'project',semantic:false});
assert.deepEqual(project.tasks.map(task=>task.templateId),projectAgain.tasks.map(task=>task.templateId),'deterministic fallback must be reproducible');
assert.notDeepEqual(learning.tasks.map(task=>task.templateId),market.tasks.map(task=>task.templateId),'plan kinds must use different template pieces');

const trivial={id:'tiny',title:'Identify the smallest task',objective:'Name it',deliverable:'one sentence',evidence:[],acceptanceCriteria:[],complexityPoints:1};
assert.equal(policy.assessTask(trivial,{text:'done'}).eligible,false,'one-sentence farming task must be rejected');
const baseTask=index=>({...project.tasks[index%project.tasks.length],id:`det-${index}`,title:`${project.tasks[index%project.tasks.length].title} ${index}`});
for(let index=0;index<3;index++)assert.equal(policy.claim({mode:'deterministic',task:baseTask(index),submission:{text:'Attached prototype file, test log, and revision record showing the acceptance criteria were checked.'}}).ok,true);
const capped=policy.claim({mode:'deterministic',task:baseTask(3),submission:{text:'Attached prototype file, test log, and revision record showing the acceptance criteria were checked.'}});
assert.equal(capped.code,'DETERMINISTIC_DAILY_LIMIT');
assert.equal(policy.quote({mode:'deterministic',baseRewards:{buttons:4,acorns:4,skillXp:20}}).buttons,2);
assert.equal(policy.quote({mode:'generative',baseRewards:{buttons:4,acorns:4,skillXp:20}}).buttons,6);
assert.equal(policy.quote({mode:'generative',activity:'peer-model-review',baseRewards:{buttons:4,acorns:4,skillXp:20}}).buttons,8);
for(let index=0;index<5;index++)assert.equal(policy.claim({mode:'generative',task:{...market.tasks[index%market.tasks.length],id:`gen-${index}`,title:`${market.tasks[index%market.tasks.length].title} ${index}`},submission:{text:'Attached receipt, source comparison, consent record, and handoff confirmation for inspection.'}}).ok,true,'generative tasks should not hit the deterministic daily cap');

const duplicateContent={...project.tasks[0],id:'renamed-copy'};
const firstContentClaim=policy.claim({mode:'generative',task:{...duplicateContent,id:'original-id'},submission:{text:'Attached prototype file, test log, and revision record showing the acceptance criteria were checked.'}});
assert.equal(firstContentClaim.ok,true);
const renamedDuplicate=policy.claim({mode:'generative',task:{...duplicateContent,id:'different-id'},submission:{text:'Attached prototype file, test log, and revision record showing the acceptance criteria were checked.'}});
assert.equal(renamedDuplicate.code,'DUPLICATE_REWARD_CLAIM','renaming identical work must not reopen rewards');
assert.doesNotThrow(()=>policy.assessTask(project.tasks[1],{proofs:'not-an-array'}),'malformed proof collections should fail closed without crashing');

const selfReview=policy.claim({mode:'generative',activity:'peer-model-review',actorId:'same',targetOwnerId:'same',task:{...learning.tasks[0],id:'review-self'},submission:{text:'Attached rubric, source notes, and criterion-by-criterion review.'}});
assert.equal(selfReview.code,'SELF_REVIEW_NOT_REWARDED');
const peerReview=policy.claim({mode:'generative',activity:'peer-model-review',actorId:'reviewer',targetOwnerId:'creator',task:{...learning.tasks[1],id:'review-peer'},submission:{text:'Attached rubric, source notes, and criterion-by-criterion review with evidence links.'}});
assert.equal(peerReview.ok,true);
assert.equal(peerReview.claim.amounts.buttons,policy.quote({mode:'generative',activity:'peer-model-review'}).buttons);

const reflexRuntime={model:'Xenova/all-MiniLM-L6-v2',rank(){}};
const deterministicContext=vm.createContext({
  console,Date,Math,JSON,structuredClone,
  localStorage:new Storage(),sessionStorage:new Storage(),
  CommonweaveReflexRuntime:reflexRuntime,
  dispatchEvent(){},CustomEvent:class{constructor(type,init={}){this.type=type;this.detail=init.detail}},
  setInterval(){return 1},clearInterval(){},setTimeout(){return 1},clearTimeout(){}
});
deterministicContext.globalThis=deterministicContext;
vm.runInContext(fs.readFileSync(new URL('../public/app/deterministic-mode-v175.js',import.meta.url),'utf8'),deterministicContext,{filename:'public/app/deterministic-mode-v175.js'});
assert.equal(deterministicContext.CommonweaveReflexRuntime,reflexRuntime,'deterministic mode must preserve the real MiniLM reflex runtime');
assert.equal(deterministicContext.CommonweaveDeterministicModeV175.semanticPlanning,'lazy-explicit');
assert.equal(deterministicContext.CommonweaveDeterministicModeV175.route('Create a market request for borrowed tools').system,'fellowfare');

console.log('v198 context planning and reward policy verification passed');

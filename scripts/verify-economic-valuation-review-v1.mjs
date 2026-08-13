import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const root=new URL('../',import.meta.url);
const read=path=>fs.readFileSync(new URL(path,root),'utf8');
const guideSource=read('public/app/civweave-basic-value-v1.js');
const policySource=read('public/app/civweave-economic-policy-v1.js');
const modelSource=read('public/app/civweave-basic-value-model-v1.js');
const reviewSource=read('public/app/civweave-basic-value-review-v1.js');
const systemsSource=read('public/app/civweave-basic-value-systems-v1.js');
const loaderSource=read('public/app/family-ai-loader-v105.js');
const offline=JSON.parse(read('public/app/offline-package-v208.json'));

for(const [name,source] of [['guide',guideSource],['policy',policySource],['model',modelSource],['review',reviewSource],['systems',systemsSource],['loader',loaderSource]])assert.doesNotThrow(()=>new Function(source),`${name} has invalid JavaScript`);

class Storage{constructor(){this.map=new Map()}getItem(key){return this.map.has(String(key))?this.map.get(String(key)):null}setItem(key,value){this.map.set(String(key),String(value))}}
class CustomEvent{constructor(type,options={}){this.type=type;this.detail=options.detail}}
const context={console,Storage,localStorage:new Storage(),CustomEvent,addEventListener:()=>{},dispatchEvent:()=>{},queueMicrotask:()=>{},setInterval:()=>0,clearInterval:()=>{},setTimeout:()=>0,clearTimeout:()=>{},Date,Math,JSON,WeakSet,Map,Set,Object,Array,String,Number,globalThis:null};
context.globalThis=context;vm.createContext(context);
vm.runInContext(guideSource,context,{filename:'civweave-basic-value-v1.js'});
vm.runInContext(policySource,context,{filename:'civweave-economic-policy-v1.js'});
vm.runInContext(reviewSource,context,{filename:'civweave-basic-value-review-v1.js'});
const guide=context.CivweaveBasicValueV1,policy=context.CivweaveEconomicPolicyV1,review=context.CivweaveBasicValueReviewV1;
assert.ok(guide&&policy&&review,'economic runtimes did not boot');

const vars=policy.variables();
assert.equal(vars.find(row=>row.id==='labor.baselineButtonsPerHour').currentValue,5);
assert.equal(vars.find(row=>row.id==='labor.minimumButtonsPerHour').currentValue,null,'pay minimum must remain distinct and unset');
assert.ok(vars.every(row=>row.voteEligibleEventually&&row.requiresQuorum&&row.requiresPercentageLimit),'every economic variable must be addressable by future guarded democracy');
assert.equal(policy.governance.futureAuthority,'anarchadia-democratic');
assert.equal(policy.governance.democraticActivation,false,'economic voting must not activate before Anarchadia governance exists');
assert.equal(policy.governance.maxPercentChangePerProposal,null,'do not invent a percentage cap before governance chooses one');
assert.deepEqual(Array.from(policy.stability.enabledDeflationaryMechanisms),[],'no deflationary mechanism should be silently enabled');
assert.equal(policy.candidateChange({id:'labor.baselineButtonsPerHour',nextValue:6,quorumSatisfied:true,percentLimit:10,governanceActive:true}).allowed,false,'future vote guard must stay locked until democratic activation');

const rubricIds=review.rubric.map(row=>row.id);
for(const id of ['human-equivalent','scope-complete','automation-neutral','market-separation','currency-separation','no-automatic-mint','education-baseline','stability-awareness'])assert.ok(rubricIds.includes(id),`valuation rubric omits ${id}`);
const passes=kind=>review.requiredCriteria(kind).map(id=>({id,pass:true,reason:'final recommendation satisfies this criterion'}));
const labor=review.valuationFrom({subject:{id:'task-a',kind:'labor',existing:{}},estimate:{laborWorthHours:4.5,rationale:'ordinary human effort'},review:{decision:'fair',confidence:.9,criteria:passes('labor'),rationale:'fair',stabilityImpact:'neutral'},provider:'estimator',model:'m1',reviewProvider:'reviewer',reviewModel:'m2'});
assert.equal(labor.status,'model-reviewed-fair');
assert.equal(labor.laborWorthHours,4.5);
assert.equal(labor.baseline.buttons,22.5);
assert.equal(labor.review.rubricSatisfied,true);
assert.equal(labor.pricingReady,true);
const adjusted=review.valuationFrom({subject:{id:'task-b',kind:'labor',existing:{}},estimate:{laborWorthHours:2,rationale:'too low'},review:{decision:'adjust',suggestedLaborWorthHours:3,confidence:.9,criteria:passes('labor'),rationale:'scope includes testing',stabilityImpact:'neutral'}});
assert.equal(adjusted.status,'model-reviewed-adjusted');assert.equal(adjusted.laborWorthHours,3);assert.equal(adjusted.baseline.buttons,15);assert.equal(adjusted.pricingReady,true);
const curriculum=review.valuationFrom({subject:{id:'module-a',kind:'curriculum',existing:{}},estimate:{educationalHours:2,curriculumAcorns:30,rationale:'two-hour module'},review:{decision:'fair',confidence:.9,criteria:passes('curriculum'),rationale:'within rubric',stabilityImpact:'neutral'}});
assert.equal(curriculum.baseline.acorns,30);assert.equal(curriculum.pricingReady,true);
const incomplete=review.valuationFrom({subject:{id:'task-incomplete',kind:'labor',existing:{}},estimate:{laborWorthHours:4,rationale:'proposal'},review:{decision:'fair',confidence:.9,criteria:passes('labor').filter(row=>row.id!=='automation-neutral'),rationale:'forgot a criterion',stabilityImpact:'neutral'}});
assert.equal(incomplete.status,'model-review-incomplete');assert.equal(incomplete.pricingReady,false,'missing fairness criteria must block price readiness');
const rejected=review.valuationFrom({subject:{id:'task-c',kind:'labor',existing:{}},estimate:{laborWorthHours:1,rationale:'unclear'},review:{decision:'reject',confidence:.8,criteria:[],rationale:'scope ambiguous',stabilityImpact:'unknown'}});
assert.equal(rejected.pricingReady,false,'rejected valuation must not be price-ready');
const upstream=review.normalizeSubject({id:'upstream',kind:'labor',laborWorthHours:6,valuationRationale:'ordinary competent human would need setup, implementation, testing, and handoff',valuationProvider:'generated-model',valuationModel:'model-a'});
const proposal=review.proposalFromSubject(upstream);assert.ok(proposal,'complete upstream model proposal should go directly to second-pass review');assert.equal(proposal.estimate.laborWorthHours,6);assert.equal(proposal.provider,'generated-model');
assert.equal(review.proposalFromSubject(review.normalizeSubject({id:'no-rationale',kind:'labor',laborWorthHours:6})),null,'legacy hours without model rationale need a fresh first-pass estimate');

const modelContext={console,setInterval:()=>0,globalThis:null};modelContext.globalThis=modelContext;vm.createContext(modelContext);vm.runInContext(modelSource,modelContext,{filename:'civweave-basic-value-model-v1.js'});
const model=modelContext.CivweaveBasicValueModelV1;
const schema=model.augmentSchema({type:'object',properties:{tasks:{type:'array',items:{type:'object',properties:{title:{type:'string'}},required:['title']}},modules:{type:'array',items:{type:'object',properties:{title:{type:'string'}},required:['title']}}}});
assert.ok(schema.properties.tasks.items.properties.laborWorthHours);assert.ok(schema.properties.tasks.items.required.includes('valuationRationale'));
assert.ok(schema.properties.modules.items.properties.educationalHours);assert.ok(schema.properties.modules.items.properties.curriculumAcorns);assert.ok(schema.properties.modules.items.required.includes('valuationRationale'));
assert.match(model.promptContract,/second-pass civweave\.basic-value-review\.v1/);
assert.match(model.promptContract,/must not discount/i);

for(const token of ['civweave.working-campus.v1','civweave.living-school.cabinet.v151','cerbanimo.quest-engine.v144','review.reviewSubjects','model-reviewed-fair','valuationRationale'])assert.ok(systemsSource.includes(token),`systems propagation omits ${token}`);
for(const token of ['/app/civweave-basic-value-v1.js?v=economic-review-v1','/app/civweave-economic-policy-v1.js?v=economic-review-v1','/app/civweave-basic-value-model-v1.js?v=economic-review-v1','/app/civweave-basic-value-review-v1.js?v=economic-review-v1','/app/civweave-basic-value-systems-v1.js?v=economic-review-v1','await loadValueCore()','await loadValueModel()'])assert.ok(loaderSource.includes(token),`family AI loader omits ${token}`);
for(const path of ['/app/civweave-basic-value-v1.js','/app/civweave-economic-policy-v1.js','/app/civweave-basic-value-model-v1.js','/app/civweave-basic-value-review-v1.js','/app/civweave-basic-value-systems-v1.js'])assert.ok(offline.seeds.includes(path),`offline core omits ${path}`);

console.log(JSON.stringify({ok:true,authority:'model-interim',futureAuthority:'anarchadia-democratic',laborBaseline:'5 Buttons/hour',review:'upstream model proposal -> independent rubric review -> fair/adjust/reject',rubricGate:'all required fairness criteria must pass before price readiness',stability:'no hidden deflationary mechanisms enabled',payMinimum:'unset future governed variable'},null,2));

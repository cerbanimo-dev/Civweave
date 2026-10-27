import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import {learningJourneySnapshot,PLAN_KEY,QUEUE_KEY} from '../public/app/cabinets/living-school/living-school-journey-index-v1.mjs';

const read=path=>readFileSync(new URL(`../public/${path}`,import.meta.url),'utf8');
const stripModules=source=>source.replace(/^import[^\n]*;\r?\n/gm,'').replace(/^export \* from[^\n]+\r?\n/gm,'').replace(/export (async )?function /g,'$1function ').replace(/export const /g,'const ');
const extract=(source,start,end)=>source.slice(source.indexOf(start),source.indexOf(end));
const keys={state:'civweave.living-school.cabinet.v151',intentions:'civweave.intentions.v127',campus:'civweave.working-campus.v1',inbox:'civweave.realm-inbox.v1',handoff:'civweave.active-handoff.v1'};
const capability='Convert Celsius and Fahrenheit temperatures.';
const coursePlan=()=>({title:'Temperature conversions',capability,level:'beginner',mode:'guided',proof:'Check an independent conversion.',modules:[{title:'Celsius',focus:'Celsius reference points.',outcome:'Identify zero Celsius.'},{title:'Fahrenheit',focus:'Fahrenheit reference points.',outcome:'Identify thirty two Fahrenheit.'},{title:'Conversion',focus:'Celsius Fahrenheit conversion order.',outcome:'Convert twenty Celsius to sixty eight Fahrenheit.'}],assumptions:['Fictional temperatures only.'],weaveId:'model-invented-weave',pathId:'model-invented-path'});

function fixture(){
  const modelCalls=[],materializationCalls=[];
  const route={id:'selected-learning-route',realm:'living-school',type:'learning',title:'Temperature conversion capability',purpose:capability,steps:['Demonstrate a fresh conversion.'],completionCriteria:'Check an independent conversion.',progress:[],status:'active'},plan={id:'activated-weave',state:'active',wish:'Become capable of temperature conversion.',paths:[route]},values=new Map(),events=new Map();
  const save=(key,value)=>values.set(key,JSON.stringify(value));
  save(keys.intentions,[{id:plan.id,kind:'weave-plan',state:'active',plan}]);save(keys.campus,{wish:'Preserved campus intention',stage:'active',plan});save(keys.inbox,[{id:'selected-packet',target:'living-school',status:'accepted',payload:{weaveId:plan.id,path:route}}]);
  save(keys.handoff,{target:'living-school',weaveId:plan.id,pathId:route.id,plan,preparedAt:'2026-01-01T00:00:00.000Z',source:'anarchadia-passport-v159'});
  save('civweave.living-school.intake.v152',[{id:`learning:${plan.id}`,sourcePlanId:plan.id,title:route.title,purpose:capability,completionCriteria:route.completionCriteria,status:'ready'}]);
  const document={readyState:'loading',hidden:false,documentElement:{dataset:{}},getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[],scripts:[],addEventListener(){}};
  const context=vm.createContext({console,Date,Math,JSON,Object,Array,String,Number,Boolean,Set,Map,Promise,URL,URLSearchParams,AbortController,structuredClone,learningJourneySnapshot,PLAN_KEY,QUEUE_KEY,document,location:{pathname:'/app/cabinets/living-school/index.html',href:'https://civweave.test/app/cabinets/living-school/index.html',search:''},
    localStorage:{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)},
    gate:{defaultProjectGate:()=>({status:'not-started'}),normalizeProjectGate:value=>value},
    addEventListener:(type,fn)=>events.set(type,[...(events.get(type)||[]),fn]),dispatchEvent:event=>{for(const fn of events.get(event.type)||[])fn(event)},CustomEvent:class{constructor(type,options={}){this.type=type;this.detail=options.detail}},
    MutationObserver:class{observe(){}disconnect(){}},queueMicrotask(){},requestAnimationFrame:()=>0,setTimeout,clearTimeout,
    selectedCurriculumRoute:()=> 'shared',sharedProviderSelection:()=> 'ollama',stage:(handler,name,detail)=>handler?.(name,detail),markDispatch(){},ensureAIGuards:async()=>true,reconcileProgressById(){},ensureLivingSchool:async()=>{},renderEnhanced(){},renderLivingSchoolEmbed(){},toastMessage(){},FALLBACK_VIDEO_URL:'fixture-video',
    LEVELS:new Set(['beginner','intermediate','advanced']),MODES:new Set(['guided','just-in-time','browse']),generationIndex:(module,index=0)=>module.generationIndex??index,
    CivweaveFamilyAILoaderV105:{ensure:async()=>true},CivweaveWeavelingPlanJsonV190:{install:()=>true},CivweaveModelRuntime:{readSharedConfig:()=>({provider:'ollama',model:'fixture'}),generate:async request=>{modelCalls.push(request);return{status:'success',actual:{provider:'ollama',model:'fixture'},outputJson:coursePlan()}}}});
  vm.runInContext(stripModules(read('app/cabinets/living-school/living-school-cleanroom-core-v218-base.mjs'))+'\nglobalThis.__base={state,replaceState,persist,availablePaths};',context);
  vm.runInContext(stripModules(read('app/cabinets/living-school/living-school-cleanroom-actions-v218.mjs'))+'\nglobalThis.__select=actions["apply-path"];',context);
  const core=read('app/cabinets/living-school/living-school-cleanroom-core-v218.mjs');
  vm.runInContext(extract(core,'function requestedData(','function batchIndices(')+extract(core,'function candidateSchool(','function recoveryStatus(')+'\nglobalThis.__requested=requestedData;globalThis.__candidate=candidateSchool;',context);
  context.researchCapability=async()=>({mode:'fixture',sources:[]});
  context.generateSchoolWithAtomicSharedQuiz=async data=>{
    materializationCalls.push(data);
    const count=Math.max(1,Number(data.count)||1),request=context.__requested(data,count),modules=Array.from({length:count},(_,index)=>({id:index?'linked-module-'+index:'linked-module',title:'Temperature conversion',quiz:{bank:[]}})),school=context.__candidate(request,count,modules,{provider:'ollama',model:'fixture'},{provider:'ollama',model:'fixture'},'fixture-generation');
    return school;
  };
  const actions=read('app/living-school-cleanroom-actions-v243.mjs');
  vm.runInContext(extract(actions,'export async function generateCurriculumFromData(','\nexport const actions=').replace('export async function','async function')+'\nglobalThis.__materialize=generateCurriculumFromData;',context);
  const native=read('app/cabinets/living-school/living-school-cleanroom-v218.mjs');
  vm.runInContext('let busy=false,retryStarting=false;'+extract(native,'async function retryApprovedLearningJourney(','\nfunction chatCurriculumData(')+extract(native,'function chatCurriculumData(','\nsanitizeSavedHybridQuiz();')+'\nglobalThis.__chatData=chatCurriculumData;globalThis.__nativeGenerate=generateCurriculumFromChat;globalThis.__click=handleLivingSchoolClick;globalThis.__retryApproved=retryApprovedLearningJourney;',context);
  context.LivingSchoolCleanroomV218={getState:()=>context.__base.state(),generateCurriculumFromChat:context.__nativeGenerate};
  vm.runInContext(read('app/unified-chat-system-v1.js'),context);
  vm.runInContext(read('extensions/civweave-proof-progress-v158.js'),context);
  const select=async()=>{const row=context.__base.availablePaths().find(item=>item.id===plan.id);await context.__select({closest:()=>({querySelector:()=>({value:row.id})})});return row};
  const journeyTarget=(action,id)=>({dataset:{lsAction:action,journeyId:id},setAttribute(){},removeAttribute(){}});
  const journeyClick=(action,id)=>context.__click({target:{closest:()=>journeyTarget(action,id)},preventDefault(){},stopImmediatePropagation(){}});
  return{context,values,save,route,plan,select,modelCalls,materializationCalls,journeyTarget,journeyClick,state:()=>context.__base.state(),api:context.CivweaveUnifiedChatSystemV1,read:key=>JSON.parse(values.get(key))};
}

test('an explicit routed selection preserves both activated Weave and path IDs despite flattened intake',async()=>{
  const app=fixture(),selected=await app.select();
  assert.equal(selected.weaveId,app.plan.id);assert.equal(selected.pathId,app.route.id);
  assert.equal(app.state().pathContext.weaveId,app.plan.id);assert.equal(app.state().pathContext.pathId,app.route.id);
});

test('native routed course materialization reaches the existing exact-identity proof bridge',async()=>{
  const app=fixture();await app.select();
  const school=await app.context.__materialize({title:'A user-edited course title',capability,count:1,proof:'Check a fresh conversion.'});
  assert.equal(school.weaveId,app.plan.id);assert.equal(school.pathId,app.route.id);
  assert.equal(app.state().pathContext.pathId,app.route.id);
  app.state().progress['linked-module']={assessmentPassed:true};app.context.__base.persist();app.context.CivweaveProofProgressV158.syncProgress();
  const campus=app.read(keys.campus);assert.equal(campus.wish,'Preserved campus intention');assert.equal(campus.plan.paths[0].status,'completed');assert.deepEqual(campus.plan.paths[0].progress,[0]);
});

test('a selected handoff survives review, inert approval and selection, then explicit native Generate',async()=>{
  const app=fixture(),handoff=app.read(keys.handoff);
  const result=await app.api.generateLivingSchoolPlan({text:'I want to learn to convert Celsius and Fahrenheit temperatures.',history:[],weaveId:handoff.weaveId,pathId:handoff.pathId});
  const review=app.api.readLearningPlan();assert.ok(review,JSON.stringify(result));assert.equal(review.state,'review');assert.equal(review.request.weaveId,app.plan.id);assert.equal(review.request.pathId,app.route.id);
  assert.equal(result.action.kind,'living-school-learning-plan');
  assert.equal(app.modelCalls.length,1);assert.equal(app.materializationCalls.length,0);
  await app.api.approveLivingSchoolPlan(review);
  assert.equal(app.api.readLearningPlan().state,'approved');assert.equal(app.state().school,null);assert.equal(app.modelCalls.length,1);assert.equal(app.materializationCalls.length,0,'Approval must not generate learning content');
  app.api.synchronize();assert.equal(app.modelCalls.length,1);assert.equal(app.materializationCalls.length,0,'Opening/synchronizing must not generate an approved plan');
  const journeyId='plan:'+review.id;
  await assert.rejects(app.context.__retryApproved(app.journeyTarget('retry-approved-learning-journey',journeyId)),/Select an approved/);
  assert.equal(app.materializationCalls.length,0,'Generate before explicit selection must not reach the engine');
  await app.journeyClick('select-approved-learning-journey',journeyId);
  assert.equal(app.state().settings.selectedJourneyPlanId,journeyId);assert.equal(app.modelCalls.length,1);assert.equal(app.materializationCalls.length,0,'Selecting an approved plan must not generate content');
  await app.journeyClick('retry-approved-learning-journey',journeyId);
  assert.equal(app.materializationCalls.length,1,'Exactly one native Generate action must reach the existing curriculum pipeline');
  assert.equal(app.state().school.weaveId,app.plan.id);assert.equal(app.state().school.pathId,app.route.id);assert.equal(app.state().pathContext.pathId,app.route.id);
  assert.equal(app.state().school.modules.length,review.request.count);assert.equal(app.api.readLearningPlan(),null,'Only complete explicit generation consumes the approval');
  assert.notEqual(app.state().school.weaveId,'model-invented-weave','The model cannot author cross-system identity.');
});

test('a fresh independent chat course ignores stale handoffs and previous selected route metadata',async()=>{
  const app=fixture();await app.select();
  const request=app.api.curriculumRequest({text:'Create a new Learning Journey about gardening.',history:[]});
  assert.equal(request.newPath,true);assert.equal(Boolean(request.weaveId||request.pathId),false);
  await app.context.__nativeGenerate({...request,count:1});
  assert.equal(Boolean(app.state().school.weaveId||app.state().school.pathId),false);assert.equal(Boolean(app.state().pathContext.weaveId||app.state().pathContext.pathId),false);
  app.state().progress['linked-module']={assessmentPassed:true};app.context.__base.persist();app.context.CivweaveProofProgressV158.syncProgress();
  assert.deepEqual(app.read(keys.campus).plan.paths[0].progress,[],'An unrelated completed course must not advance the selected Weave.');
});

test('an explicit independent learning goal cannot inherit IDs from a previous linked review plan',async()=>{
  const app=fixture(),text='I want to learn to convert Celsius and Fahrenheit temperatures.';
  await app.api.generateLivingSchoolPlan({text,history:[],weaveId:app.plan.id,pathId:app.route.id});
  const linked=app.api.readLearningPlan();assert.equal(linked.request.pathId,app.route.id);
  await app.api.generateLivingSchoolPlan({text,history:[]},linked);
  const independent=app.api.readLearningPlan();assert.equal(Boolean(independent.request.weaveId||independent.request.pathId),false,'The new request must explicitly carry a route even when its subject resembles a prior linked plan.');
});

test('editing the native capability to another topic removes the previous routed identity',async()=>{
  const app=fixture();await app.select();
  const school=await app.context.__materialize({title:app.route.title,capability:'Identify common garden plants.',count:1});
  assert.equal(Boolean(school.weaveId||school.pathId),false);assert.equal(Boolean(app.state().pathContext.weaveId||app.state().pathContext.pathId),false);
});

test('exact route validation excludes review-only plans, other realms and wrong IDs',async()=>{
  for(const change of [app=>{app.plan.state='review'},app=>{app.route.realm='cerbanimo'},app=>{app.route.id='other-path'}]){
    const app=fixture();change(app);app.save(keys.intentions,[{id:app.plan.id,kind:'weave-plan',state:app.plan.state,plan:app.plan}]);
    const school=await app.context.__materialize({title:'Temperature conversion',capability,count:1,weaveId:'activated-weave',pathId:'selected-learning-route'});
    assert.equal(Boolean(school.weaveId||school.pathId),false);
  }
});

test('a linked course revision keeps its own identity while a new course clears it',async()=>{
  const app=fixture();await app.select();await app.context.__materialize({title:'Temperature conversion',capability,count:1});
  const revision=app.api.curriculumRequest({text:'Revise the existing course.',history:[]});assert.equal(revision.newPath,false);assert.equal(revision.weaveId,app.plan.id);assert.equal(revision.pathId,app.route.id);
  await app.context.__nativeGenerate({...revision,count:1});assert.equal(app.state().school.pathId,app.route.id);
  await app.context.__nativeGenerate({title:'Gardening',capability:'Identify garden plants.',newPath:true,intent:'new',count:1});assert.equal(Boolean(app.state().school.weaveId||app.state().school.pathId),false);
});

test('materialization revalidates the explicit route after generation before attaching proof identity',async()=>{
  const app=fixture();await app.select();const prior=app.context.generateSchoolWithAtomicSharedQuiz;
  app.context.generateSchoolWithAtomicSharedQuiz=async data=>{const school=await prior(data);app.plan.state='review';app.save(keys.intentions,[{id:app.plan.id,kind:'weave-plan',state:'review',plan:app.plan}]);return school};
  const school=await app.context.__materialize({title:'Temperature conversion',capability,count:1});assert.equal(Boolean(school.weaveId||school.pathId),false);
});

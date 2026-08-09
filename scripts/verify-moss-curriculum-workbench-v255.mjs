import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const bridgePath='public/app/living-school-chat-workbench-v255.js';
const controllerPath='public/app/cabinets/living-school/living-school-cleanroom-v218.mjs';
const actionsPath='public/app/living-school-cleanroom-actions-v243.mjs';
const loaderPath='public/app/shared-guide-surface-v236.js';
const deadlinePath='public/app/living-school-deadline-guard-v266.mjs';
const quizGuardPath='public/app/living-school-quiz-contract-guard-v263.mjs';
const progressPath='public/app/living-school-chat-progress-v266.js';
const bridge=fs.readFileSync(bridgePath,'utf8'),controller=fs.readFileSync(controllerPath,'utf8'),actions=fs.readFileSync(actionsPath,'utf8'),loader=fs.readFileSync(loaderPath,'utf8'),deadlines=fs.readFileSync(deadlinePath,'utf8'),quizGuard=fs.readFileSync(quizGuardPath,'utf8'),progress=fs.readFileSync(progressPath,'utf8');

assert.match(actions,/export async function generateCurriculumFromData/,'canonical action module must expose data-driven curriculum generation');
assert.match(controller,/generateCurriculumFromChat/,'Living School cleanroom must expose a Moss chat generation entry point');
assert.match(controller,/moss-shared-chat-new-path/,'new chat curricula must have distinct replacement provenance');
assert.match(controller,/newPath=input\?\.intent==='new'/,'cleanroom must distinguish new paths before inheriting active state');
assert.match(controller,/s\.school=null;/,'new-path preparation must sever the active school');
assert.match(controller,/s\.progress=\{\};/,'new-path preparation must not inherit progress');
assert.match(controller,/restoreLearningState\(previous\)/,'failed new-path generation must restore previous learning state');
assert.match(controller,/await installLivingSchoolDeadlineGuardV266\(\)/,'provider deadline guard must be active before chat generation begins');
assert.match(loader,/living-school-chat-workbench-v255\.js\?v=1\.0\.58-v266-bounded-learning-pathway/,'shared guide loader must cache-bust bounded Moss bridge');
assert.match(loader,/living-school-chat-progress-v266\.js\?v=1\.0\.58-v266/,'shared guide loader must install visible Moss progress');
assert.match(bridge,/learning pathway/,'Moss must recognize natural learning pathway phrasing');
for(const token of ["['living-school-live-source-research-v260',15000]","['living-school-research-grounded-curriculum-v218.1',30000]","['living-school-quiz-delta-completion-v258',10000]",'livingSchoolDeadlineGuardRevision:REVISION','every-living-school-provider-call-has-a-hard-runtime-deadline-v266'])assert(deadlines.includes(token),`Living School deadline guard is missing ${token}.`);
for(const token of ["const PRIMARY_PURPOSE='living-school-quiz-contract-primary-v266'",'const MAX_REPAIRS_PER_MODULE=3','purpose:PRIMARY_PURPOSE','nestedLegacyLoopBypassed:true','Math.min(existing,timeoutMs)'])assert(quizGuard.includes(token),`Bounded quiz contract is missing ${token}.`);
assert(!quizGuard.includes('attempts<12'),'Quiz repair must not restore the old twelve-attempt loop.');
for(const text of ['Moss is researching sources for the learning pathway…','Moss is generating the curriculum from the research packet…','Moss is completing the AI quiz contract…'])assert(progress.includes(text),`Moss pending turn does not surface ${text}`);

const emptyState=()=>({school:null,pathContext:null,settings:{modelRoute:'shared',mode:'guided'}}),store=new Map([['civweave.living-school.cabinet.v151',JSON.stringify(emptyState())]]),listeners=new Map();
const sandbox={console,localStorage:{getItem:key=>store.has(key)?store.get(key):null,setItem:(key,value)=>store.set(key,String(value)),removeItem:key=>store.delete(key)},document:{readyState:'loading'},addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener(){},dispatchEvent:()=>true,CustomEvent:class{constructor(type,init={}){this.type=type;this.detail=init.detail}},setInterval:()=>0,clearInterval(){},setTimeout:fn=>{fn();return 0}};
sandbox.globalThis=sandbox;vm.runInNewContext(bridge,sandbox,{filename:bridgePath});const api=sandbox.CivweaveLivingSchoolChatWorkbenchV255;assert.ok(api);
assert.equal(api.curriculumIntent("Let's build a curriculum",[]),true);assert.equal(api.curriculumIntent('Explain the difference between attention and awareness',[]),false);
const woodsText='Can you make me a learning pathway for how to survive in the woods?',woodsRequest=api.curriculumRequest({text:woodsText,history:[]});
assert.equal(api.curriculumIntent(woodsText,[]),true);assert.equal(woodsRequest.intent,'new');assert.equal(woodsRequest.newPath,true);assert.equal(woodsRequest.replaceExisting,true);assert.equal(woodsRequest.capability,'survive in the woods');assert.equal(woodsRequest.title,'Survive In The Woods');

store.set('civweave.living-school.cabinet.v151',JSON.stringify({school:{id:'meditation-school',title:'Flow State Trigger: The Intention Bypass',capability:'The act of intending to meditate bypasses the thinking mind entirely.',level:'advanced',proof:'Five meditation sessions.',modules:[{id:'old-1'},{id:'old-2'},{id:'old-3'},{id:'old-4'},{id:'old-5'}]},pathContext:{title:'Flow State Trigger: The Intention Bypass',capability:'The act of intending to meditate bypasses the thinking mind entirely.',proof:'Five meditation sessions.'},settings:{modelRoute:'gemini',mode:'guided'}}));
const moneyRequest=api.curriculumRequest({text:'Generate this curriculum: how do I make money',history:[{role:'user',text:'I want to learn how to make money'}]});
assert.equal(moneyRequest.intent,'new');assert.equal(moneyRequest.capability,'make money');assert.equal(moneyRequest.title,'Make Money');assert.equal(moneyRequest.level,'beginner');assert.equal(moneyRequest.count,4);assert.doesNotMatch(moneyRequest.capability,/meditat|thinking mind/i);assert.doesNotMatch(moneyRequest.proof,/meditat/i);
const revisionRequest=api.curriculumRequest({text:'Revise this curriculum to make the lessons deeper',history:[{role:'assistant',text:'The active curriculum is open in Living School.'}]});
assert.equal(revisionRequest.intent,'revise');assert.match(revisionRequest.capability,/meditate/i);assert.equal(revisionRequest.count,5);

store.set('civweave.living-school.cabinet.v151',JSON.stringify(emptyState()));
const guarded=api.guardFalseMutationClaim({response:{answer:"I've drafted the curriculum and created four levels.",choice:{}}},'none');assert.match(guarded.response.answer,/I have not changed the Living School workbench yet/);
sandbox.LivingSchoolCleanroomV218={getState:()=>emptyState(),generateCurriculumFromChat:async data=>({school:{id:'school-test',title:data.title,capability:data.capability,level:data.level,modules:[{id:'module-1',title:'Noticing'}],generation:{provider:'gemini',model:'test-model',sourceCount:3,fallback:false}},sourceCount:3})};
const result=await api.executeCurriculum({text:'Build a curriculum for learning to notice distraction.',history:[]});
assert.match(result.response.answer,/built .* in the Living School workbench/i);assert.equal(result.action.kind,'living-school-curriculum-generated');assert.equal(result.action.state,'completed');assert.equal(result.action.intent,'new');
console.log('Moss curriculum workbench v255/v266 bounded pathway verification passed.');

import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const bridgePath='public/app/living-school-chat-workbench-v255.js';
const controllerPath='public/app/cabinets/living-school/living-school-cleanroom-v218.mjs';
const actionsPath='public/app/living-school-cleanroom-actions-v243.mjs';
const loaderPath='public/app/shared-guide-surface-v236.js';

const bridge=fs.readFileSync(bridgePath,'utf8');
const controller=fs.readFileSync(controllerPath,'utf8');
const actions=fs.readFileSync(actionsPath,'utf8');
const loader=fs.readFileSync(loaderPath,'utf8');

assert.match(actions,/export async function generateCurriculumFromData/,'canonical action module must expose data-driven curriculum generation');
assert.match(actions,/source:'living-school-workbench'/,'button generation must still use the same canonical generator');
assert.match(controller,/generateCurriculumFromChat/,'Living School cleanroom must expose a Moss chat generation entry point');
assert.match(controller,/moss-shared-chat-new-path/,'new chat curricula must have a distinct replacement provenance');
assert.match(controller,/newPath=input\?\.intent==='new'/,'Living School cleanroom must distinguish new paths before inheriting active school state');
assert.match(controller,/s\.school=null;/,'new-path preparation must sever the active school before canonical generation');
assert.match(controller,/s\.progress=\{\};/,'new-path preparation must not inherit old module progress');
assert.match(controller,/restoreLearningState\(previous\)/,'failed new-path generation must restore the previous learning state atomically');
assert.match(loader,/living-school-chat-workbench-v255\.js\?v=1\.0\.56-v264-new-path-intent/,'shared guide loader must cache-bust the Moss new-path bridge');

const emptyState=()=>({school:null,pathContext:null,settings:{modelRoute:'shared',mode:'guided'}});
const store=new Map([
  ['civweave.living-school.cabinet.v151',JSON.stringify(emptyState())]
]);
const listeners=new Map();
const sandbox={
  console,
  localStorage:{
    getItem:key=>store.has(key)?store.get(key):null,
    setItem:(key,value)=>store.set(key,String(value)),
    removeItem:key=>store.delete(key)
  },
  document:{readyState:'loading'},
  addEventListener:(name,fn)=>listeners.set(name,fn),
  removeEventListener:()=>{},
  dispatchEvent:()=>true,
  CustomEvent:class CustomEvent{constructor(type,init={}){this.type=type;this.detail=init.detail}},
  setInterval:()=>0,
  clearInterval:()=>{},
  setTimeout:fn=>{fn();return 0}
};
sandbox.globalThis=sandbox;
vm.runInNewContext(bridge,sandbox,{filename:bridgePath});
const api=sandbox.CivweaveLivingSchoolChatWorkbenchV255;
assert.ok(api,'bridge API must install');
assert.equal(api.curriculumIntent("Let's build a curriculum",[]),true,'explicit curriculum build must route to workbench');
assert.equal(api.curriculumIntent('Explain the difference between attention and awareness',[]),false,'ordinary questions must not silently create a curriculum');

const history=[
  {role:'user',text:"Let's draft it!"},
  {role:'assistant',text:"I've drafted your 'Mindfulness Mastery' skill tree. This 4-week progression moves from basic awareness to somatic anchoring."},
  {role:'user',text:"Let's build a curriculum"},
  {role:'assistant',text:"The canonical learning-session draft for your 'Mindfulness Mastery' curriculum has been created."}
];
const request=api.curriculumRequest({
  text:'Make the learning for a beginner to mastery course. And the boss is to be able to meditate without thinking about it',
  history
});
assert.equal(request.title,'Mindfulness Mastery','Moss must recover the named curriculum from recent chat context');
assert.equal(request.level,'beginner','beginner-to-mastery courses must start at beginner');
assert.equal(request.count,4,'recent four-week progression should become a four-module default when the workbench is empty');
assert.match(request.capability,/meditate without thinking about it/i,'final boss must become the observable mastery target');
assert.match(request.proof,/Final mastery challenge: meditate without thinking about it/i,'boss condition must be carried into the proof contract');
assert.equal(request.intent,'new','an initial curriculum materialization must be classified as a new path');

store.set('civweave.living-school.cabinet.v151',JSON.stringify({
  school:{id:'meditation-school',title:'Flow State Trigger: The Intention Bypass',capability:'The act of intending to meditate bypasses the thinking mind entirely.',level:'advanced',proof:'Five meditation sessions.',modules:[{id:'old-1'},{id:'old-2'},{id:'old-3'},{id:'old-4'},{id:'old-5'}]},
  pathContext:{title:'Flow State Trigger: The Intention Bypass',capability:'The act of intending to meditate bypasses the thinking mind entirely.',proof:'Five meditation sessions.'},
  settings:{modelRoute:'gemini',mode:'guided'}
}));
const moneyHistory=[
  {role:'user',text:'Make the learning for a beginner to mastery course. And the boss is to be able to meditate without thinking about it'},
  {role:'assistant',text:"I built 'Flow State Trigger' in the Living School workbench."},
  {role:'user',text:'I want to learn how to make money'}
];
const moneyRequest=api.curriculumRequest({text:'Generate this curriculum: how do I make money',history:moneyHistory});
assert.equal(moneyRequest.intent,'new','an explicit build with a fresh subject must replace rather than revise the active path');
assert.equal(moneyRequest.newPath,true,'fresh subject build must carry the new-path flag');
assert.equal(moneyRequest.replaceExisting,true,'fresh subject build must explicitly replace the active single-school context');
assert.equal(moneyRequest.capability,'make money','the latest explicit subject must become authoritative over the active meditation capability');
assert.equal(moneyRequest.title,'Make Money','the latest explicit subject must determine the new path title');
assert.equal(moneyRequest.level,'beginner','new paths must not inherit the previous advanced level');
assert.equal(moneyRequest.count,4,'new paths must not inherit the previous module count');
assert.doesNotMatch(moneyRequest.capability,/meditat|thinking mind/i,'old curriculum semantics leaked into the new capability');
assert.doesNotMatch(moneyRequest.proof,/meditat/i,'old curriculum proof leaked into the new path');

const revisionRequest=api.curriculumRequest({text:'Revise this curriculum to make the lessons deeper',history:[{role:'assistant',text:'The active curriculum is open in Living School.'}]});
assert.equal(revisionRequest.intent,'revise','explicit revision language must retain the active path');
assert.match(revisionRequest.capability,/meditate/i,'revision requests must still inherit the active capability');
assert.equal(revisionRequest.count,5,'revision requests must retain the active module count');

store.set('civweave.living-school.cabinet.v151',JSON.stringify(emptyState()));
const guarded=api.guardFalseMutationClaim({response:{answer:"I've drafted the curriculum and created four levels.",choice:{}}},'none');
assert.match(guarded.response.answer,/I have not changed the Living School workbench yet/,'chat must not claim a workbench mutation that did not happen');
assert.match(guarded.response.choice.nextAction,/generate or revise the curriculum/i,'false mutation claims must redirect to the canonical workbench action');

sandbox.LivingSchoolCleanroomV218={
  getState:()=>emptyState(),
  generateCurriculumFromChat:async data=>({
    school:{id:'school-test',title:data.title,capability:data.capability,level:data.level,modules:[{id:'module-1',title:'Noticing'}],generation:{provider:'gemini',model:'test-model',sourceCount:3,fallback:false}},
    sourceCount:3
  })
};
const result=await api.executeCurriculum({text:'Build a curriculum for learning to notice distraction.',history:[{role:'user',text:'I want to notice distraction during meditation.'}]});
assert.match(result.response.answer,/built .* in the Living School workbench/i,'successful Moss action must report the materialized workbench result');
assert.equal(result.action.kind,'living-school-curriculum-generated');
assert.equal(result.action.state,'completed');
assert.equal(result.action.intent,'new');
assert.equal(result.response.choice.system,'living-school');

console.log('Moss curriculum workbench v255/v264 new-path verification passed.');

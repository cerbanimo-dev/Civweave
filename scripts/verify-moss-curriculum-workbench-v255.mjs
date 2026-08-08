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
assert.match(actions,/replaceExisting\?progressFor\(item\.id\)/,'a fresh learning path must not inherit per-module progress by array index');
assert.match(actions,/pathMode:replaceExisting\?'new':'revise'/,'generation persistence must record new-path versus revision provenance');
assert.match(controller,/generateCurriculumFromChat/,'Living School cleanroom must expose a Moss chat generation entry point');
assert.match(controller,/source:'moss-shared-chat'/,'chat generation must be recorded as a workbench source');
assert.match(controller,/replaceExisting:data\.replaceExisting/,'chat generation must carry explicit replacement intent into the canonical generator');
assert.match(controller,/pathHandoff:'new-vs-revise-v264'/,'Living School must expose the new-path handoff revision');
assert.match(loader,/living-school-chat-workbench-v255\.js\?v=1\.0\.56-v264-new-learning-path/,'shared guide loader must cache-bust the Moss new-path bridge');

const STATE_KEY='civweave.living-school.cabinet.v151';
const store=new Map([
  [STATE_KEY,JSON.stringify({school:null,pathContext:null,settings:{modelRoute:'shared',mode:'guided'}})]
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

store.set(STATE_KEY,JSON.stringify({
  school:{id:'meditation-school',title:'Flow State Trigger: The Intention Bypass',capability:'The act of intending to meditate bypasses the thinking mind entirely.',level:'beginner',proof:'Meditate without thinking about it.',modules:[{id:'old-1'},{id:'old-2'},{id:'old-3'},{id:'old-4'}]},
  pathContext:{title:'Flow State Trigger: The Intention Bypass',capability:'The act of intending to meditate bypasses the thinking mind entirely.',proof:'Meditate without thinking about it.'},
  settings:{modelRoute:'shared',mode:'guided'}
}));
const moneyHistory=[
  {role:'assistant',text:'I built “Flow State Trigger: The Intention Bypass” in the Living School workbench. The curriculum came through the canonical Moss research-and-generation pipeline.'},
  {role:'user',text:'Money'},
  {role:'assistant',text:'Would you like to add an Economics of Awareness module?'},
  {role:'user',text:'I want to learn how to make money'}
];
const moneyRequest=api.curriculumRequest({text:'Generate this curriculum: how do I make money',history:moneyHistory});
assert.equal(moneyRequest.replaceExisting,true,'an explicit different curriculum topic must replace rather than inherit the active school');
assert.equal(moneyRequest.pathMode,'new','a different topic must be labeled as a new learning path');
assert.equal(moneyRequest.capability,'make money','the new topic must outrank the old active-school capability');
assert.equal(moneyRequest.title,'Make Money','a new path must derive its own title instead of inheriting the old school title');
assert.equal(moneyRequest.count,4,'a new path must use its own default module count rather than the old school module array');
assert.doesNotMatch(moneyRequest.proof,/meditat/i,'a new path must not inherit the previous mastery proof contract');

const revisionRequest=api.curriculumRequest({text:'Revise this curriculum to add a module about budgeting',history:[]});
assert.equal(revisionRequest.replaceExisting,false,'an explicit revision must stay attached to the current curriculum');
assert.equal(revisionRequest.pathMode,'revise','current-path edits must retain revision semantics');
assert.match(revisionRequest.capability,/meditate/i,'revision requests must preserve the current curriculum capability unless a new path is explicitly requested');

store.set(STATE_KEY,JSON.stringify({school:null,pathContext:null,settings:{modelRoute:'shared',mode:'guided'}}));
const guarded=api.guardFalseMutationClaim({response:{answer:"I've drafted the curriculum and created four levels.",choice:{}}},'none');
assert.match(guarded.response.answer,/I have not changed the Living School workbench yet/,'chat must not claim a workbench mutation that did not happen');
assert.match(guarded.response.choice.nextAction,/generate or revise the curriculum/i,'false mutation claims must redirect to the canonical workbench action');

sandbox.LivingSchoolCleanroomV218={
  getState:()=>({school:null,pathContext:null,settings:{modelRoute:'shared',mode:'guided'}}),
  generateCurriculumFromChat:async data=>({
    school:{id:'school-test',title:data.title,capability:data.capability,level:data.level,modules:[{id:'module-1',title:'Noticing'}],generation:{provider:'gemini',model:'test-model',sourceCount:3,fallback:false}},
    sourceCount:3
  })
};
const result=await api.executeCurriculum({text:'Build a curriculum for learning to notice distraction.',history:[{role:'user',text:'I want to notice distraction during meditation.'}]});
assert.match(result.response.answer,/built .* in the Living School workbench/i,'successful Moss action must report the materialized workbench result');
assert.equal(result.action.kind,'living-school-curriculum-generated');
assert.equal(result.action.state,'completed');
assert.equal(result.response.choice.system,'living-school');

console.log('Moss curriculum workbench v255 verification passed with v264 new-path semantics.');

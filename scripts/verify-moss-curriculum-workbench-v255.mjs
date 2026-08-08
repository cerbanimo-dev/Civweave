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
assert.match(controller,/source:'moss-shared-chat'/,'chat generation must be recorded as a workbench source');
assert.match(loader,/living-school-chat-workbench-v255\.js/,'shared guide loader must install the Moss workbench bridge');

const store=new Map([
  ['civweave.living-school.cabinet.v151',JSON.stringify({school:null,pathContext:null,settings:{modelRoute:'shared',mode:'guided'}})]
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

console.log('Moss curriculum workbench v255 verification passed.');

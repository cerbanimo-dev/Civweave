import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {defaultProjectGate} from '../public/app/services/living-school/modules/project-gate.mjs';
globalThis.document={getElementById:()=>null};globalThis.localStorage={getItem:()=>null,setItem(){}};
const {assertGenerationActive,generationCancelled}=await import('../public/app/cabinets/living-school/living-school-cleanroom-core-v218-base.mjs');

const old={school:{id:'old-school',title:'Previous Learning Journey',modules:[{id:'old-module'}]},progress:{'old-module':{lessonComplete:true,assessmentPassed:true}},activeModuleId:'old-module',activePathId:'old-path',pathContext:{title:'Previous Learning Journey'},research:{mode:'local-downloaded'},sources:[{id:'old-source'}],visualInspection:null,generationRecovery:null,practicum:{id:'old-practicum',artifact:'Previous artifact'},projectGate:{...defaultProjectGate(),status:'accepted',requestId:'old-request',projectRef:'old-practicum',lastReceipt:{receiptId:'old-receipt',acceptedAt:'2026-10-23T12:00:00Z'}},receipts:[{receiptId:'old-receipt'}],final:{passed:true},credential:{credentialId:'old-credential'},settings:{mode:'guided'},learningHistory:[{school:{id:'older-school'},credential:{credentialId:'older-credential'}}]};
let current=structuredClone(old),fail=false;
const input={title:'New QA Journey',capability:'Convert temperature readings.',count:1,newPath:true,intent:'new'};
const context={console,Date,Math,JSON,Object,Array,String,Number,Boolean,RegExp,Promise,Set,Map,structuredClone,
  assertGenerationActive,generationCancelled,
  state:()=>current,copy:structuredClone,freshState:()=>({projectGate:defaultProjectGate()}),
  clean:(value,max=12000)=>String(value??'').trim().slice(0,max),persist(){},
  document:{documentElement:{dataset:{}}},dispatchEvent(){},CustomEvent:class{},queueMicrotask(){},
  chatCurriculumData:()=>input,ensureAIGuards:async()=>true,markDispatch(){},reconcileProgressById(){},renderEnhanced(){},renderLivingSchoolEmbed(){},
  FALLBACK_VIDEO_URL:'qa-video',ensureLivingSchool:async()=>{if(fail)throw new Error('QA video attachment failed')},
  async generateCurriculumFromData(){
    assert.equal(current.practicum,null,'New learning content must not inherit the previous artifact.');
    assert.equal(current.projectGate.status,'not-started','A new Journey must start with a locked project gate.');
    assert.equal(current.receipts.length,0);
    assert.equal(current.final,null,'Previous final passes cannot count toward a new Journey.');
    assert.equal(current.credential,null,'The active credential must belong to the current Journey.');
    current.school={id:'new-school',title:'New QA Journey',modules:[{id:'new-module'}]};
    current.progress={};current.activeModuleId='new-module';return current.school;
  }
};
context.globalThis=context;vm.createContext(context);
const source=await readFile(new URL('../public/app/cabinets/living-school/living-school-cleanroom-v218.mjs',import.meta.url),'utf8');
const replacement=source.slice(source.indexOf('function snapshotLearningState(){'),source.indexOf('\nsanitizeSavedHybridQuiz();'));
vm.runInContext('let busy=false;'+replacement+';globalThis.__generate=generateCurriculumFromChat;',context);
await context.__generate(input);
assert.equal(current.school.id,'new-school');
assert.equal(current.learningHistory.length,2,'Replacing a Journey must preserve its prior completed record.');
assert.equal(current.learningHistory[0].school.id,'older-school');
assert.equal(current.learningHistory[1].school.id,'old-school');
assert.equal(current.learningHistory[1].credential.credentialId,'old-credential');
assert.equal(current.learningHistory[1].projectGate.lastReceipt.receiptId,'old-receipt');
assert.equal(current.learningHistory[1].practicum.artifact,'Previous artifact');

current=structuredClone(old);fail=true;
await assert.rejects(context.__generate(input),/QA video attachment failed/);
assert.deepEqual(current,old,'A failed replacement must restore the complete prior learning state and history.');
console.log('PASS Learning Journey replacement: new path clears prior completion gates, preserves historical artifacts/credentials, and failed generation restores the complete previous record.');

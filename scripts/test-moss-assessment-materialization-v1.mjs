import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const storage=new Map();
globalThis.localStorage={getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,String(value))};
globalThis.document={getElementById:()=>null};
const {normalizeAIQuiz,assertGenerationActive,generationCancelled}=await import('../public/app/cabinets/living-school/living-school-cleanroom-core-v218-base.mjs');

const paragraph=`A weather reading uses a scale whose numbers locate temperature relative to fixed reference points. Celsius places the freezing point of water near zero and its boiling point near one hundred under ordinary reference conditions. Fahrenheit places those same reference points near thirty two and two hundred twelve. The scales therefore use different interval sizes as well as different zero points. To convert a Celsius reading, multiply it by nine fifths before adding thirty two. To convert a Fahrenheit reading, subtract thirty two before multiplying by five ninths. Applying these operations in the wrong order changes the result. Check a calculation against a familiar reference point before recording it. A weather log should retain the original observation, its scale, the conversion, and a sensible rounding choice. This preserves the distinction between a measurement and a calculation derived from it.`;
const design=`## Module 1: Celsius and Fahrenheit
Objective: Convert Celsius and Fahrenheit weather readings using the correct order of operations.
Why It Matters: Weather readings use different temperature scales.
Estimated Effort: 1 hour
Concepts:
- Celsius — A scale with water freezing near zero degrees.
- Fahrenheit — A scale with water freezing near thirty two degrees.
- Conversion — A calculation that preserves the temperature across scales.
**Lesson Block 1: Celsius reference points.**
${paragraph}
**Lesson Block 2: Fahrenheit intervals.**
${paragraph}
**Lesson Block 3: Temperature conversion order.**
${paragraph}
Exercise: Convert a weather reading of twenty Celsius to Fahrenheit and check the result.
Practice Steps:
1. Record a Celsius reading.
2. Multiply by nine fifths and add thirty two.
3. Check the Fahrenheit result against a reference point.
Assessment Intent: Explain why Fahrenheit conversion requires multiplying before adding thirty two.
Remediation Focus: Revisit temperature scale intervals and the order of conversion operations.
Video Search Topic: Celsius Fahrenheit temperature conversion`;

const calls=[];
let incomplete=false;
let selectedTimeout=600000;
const questions=()=>[
  {id:'m1-mc-1',type:'multiple-choice',prompt:'What Fahrenheit value equals zero Celsius?',options:['32','0','100'],answer:'32',explanation:'Zero Celsius equals thirty two Fahrenheit.',concepts:['Celsius']},
  {id:'qa-multi-1',type:'multi-select',prompt:'Which steps convert Celsius to Fahrenheit?',options:['Multiply by nine fifths','Add thirty two','Subtract thirty two'],answer:['Multiply by nine fifths','Add thirty two'],explanation:'Scale the Celsius interval, then add the Fahrenheit offset.',concepts:['Conversion']},
  {id:'qa-short-1',type:'short-answer',prompt:'Explain the order used to convert Celsius to Fahrenheit.',rubric:[{id:'scale',label:'Explain the Celsius interval multiplier',points:5,role:'principle',required:true},{id:'offset',label:'Apply the Fahrenheit offset after scaling',points:5,role:'application',required:true}],minWords:20,maxWords:160,concepts:['Conversion']},
  {id:'qa-mc-2',type:'multiple-choice',prompt:'What Celsius value equals thirty two Fahrenheit?',options:['0','32','100'],answer:'0',explanation:'Subtract thirty two before scaling.',concepts:['Fahrenheit']},
  {id:'qa-mc-3',type:'multiple-choice',prompt:'Which Celsius reading corresponds to sixty eight Fahrenheit?',options:['20','36','100'],answer:'20',explanation:'Subtract thirty two and multiply by five ninths.',concepts:['Celsius']}
];
const context={
  assertGenerationActive,generationCancelled,
  console,Date,Math,Object,Array,String,Number,Boolean,RegExp,JSON,Promise,Set,Map,URL,AbortController,DOMException,setTimeout,clearTimeout,structuredClone,
  localStorage:globalThis.localStorage,document:{documentElement:{dataset:{}},addEventListener(){}},
  queueMicrotask(){},addEventListener(){},dispatchEvent(){return true},CustomEvent:class{constructor(type,init={}){this.type=type;this.detail=init.detail}},
  CivweaveFastInteractiveV192:{register(){},unregister(){}},
  CivweaveFamilyAILoaderV105:{async ensure(){}},
  CivweaveLivingSchoolVideoGenerationGuardV1:{installed:true},
  CivweaveLivingSchoolRuntimeRouteV2:{providerNeutral:true},
  CivweaveModelRuntime:{
    readSharedConfig:()=>({provider:'ollama',model:'qa-local-model',timeoutMs:selectedTimeout}),
    async generate(request){
      calls.push(request);
      assert.equal(request.purpose,'living-school-quiz-delta-completion-v258');
      assert.equal(request.maxRepairAttempts,0);
      assert.equal(request.config.provider,'ollama');
      assert.equal(request.config.model,'qa-local-model');
      assert.ok(request.config.maxTokens>=4096&&request.config.maxTokens<=8192);
      assert.equal(request.config.timeoutMs,selectedTimeout??180000,'Assessment must preserve the selected deadline.');
      assert.equal(request.think,false,'Ollama structured assessments use their output budget for the actual questions.');
      assert.equal(request.context.modules.length,1);
      const transmitted=request.messages.map(message=>message.content||'').join('\n');
      assert.match(transmitted,/MODULE MATERIAL:/,'The first model request must carry the actual one-module content, not only internal context.');
      assert.match(transmitted,/Celsius places the freezing point of water near zero/,'The selected HTTP provider must receive the lesson facts needed to assess the subject.');
      assert.match(transmitted,/multiply it by nine fifths before adding thirty two/);
      assert.match(transmitted,/Convert Celsius and Fahrenheit weather readings using the correct order of operations/);
      if(incomplete==='empty')return null;
      const moduleId=request.context.modules[0].moduleId;
      const outputJson={modules:[{moduleId,questions:incomplete?questions().slice(0,1):questions()}]};
      return{status:'success',outputJson,outputText:JSON.stringify(outputJson),actual:{provider:'ollama',model:'qa-local-model'}};
    }
  }
};
context.globalThis=context;
vm.createContext(context);
for(const file of ['living-school-grounded-compiler-v336.js','living-school-assessment-curator-v337.js'])vm.runInContext(await read(`public/app/${file}`),context,{filename:file});
const generationGuard=(await read('public/app/living-school-generation-guard-v262.mjs'))
  .replace(/^import safeMode[^\n]+\n/,'const safeMode={read:()=>({enabled:false})};\n')
  .replace('export async function installLivingSchoolGenerationGuard','async function installLivingSchoolGenerationGuard');
vm.runInContext('(()=>{'+generationGuard+';globalThis.__installGenerationGuard=installLivingSchoolGenerationGuard;})()',context);
await context.__installGenerationGuard();
vm.runInContext('(()=>{'+(await read('public/app/living-school-quiz-contract-guard-v263.mjs')).replace('export async function installLivingSchoolQuizContractGuardV263','async function installLivingSchoolQuizContractGuardV263')+';globalThis.__installQuizGuard=installLivingSchoolQuizContractGuardV263;})()',context);
await context.__installQuizGuard();
vm.runInContext(await read('public/app/living-school-generation-budget-v3.js'),context);
assert.equal(context.CivweaveLivingSchoolGenerationBudgetV3.install(),true);

const current={school:null};
context.__testDeps={legacyActions:{},state:()=>current,persist(){},toast(){},clean:(value,max=12000)=>String(value??'').trim().slice(0,max)};
const actions=(await read('public/app/living-school-cleanroom-actions-v243.mjs'))
  .replace(/^import[^\n]+\n/gm,'')
  .replace(/export /g,'');
vm.runInContext('(()=>{const {legacyActions,state,persist,toast,clean}=globalThis.__testDeps;\n'+actions+'\nglobalThis.__completeSharedQuizBank=completeSharedQuizBank;})()',context);

function school(){
  const request={context:{requestedModuleNumbers:[1],moduleCount:1,capability:'Convert Celsius and Fahrenheit weather readings.',designPacket:design,sources:[]}};
  const result=context.CivweaveLivingSchoolGenerationBudgetV3.compileStructure(request);
  assert.equal(result.status,'success');
  const module=result.outputJson.module;
  assert.equal(module.quiz.bank.length,5);
  assert.ok(module.quiz.bank.every(question=>question.provenance==='deterministic-compiler'));
  module.quiz=normalizeAIQuiz(module.quiz,0);
  assert.equal(module.quiz.bank.length,0,'Temporary compiler questions must not impersonate AI assessments.');
  return{id:'qa-temperature-school',title:'QA Temperature Conversion',capability:'Convert Celsius and Fahrenheit weather readings.',modules:[module],generation:{provider:'civweave',model:'local-grounded-compiler'}};
}
const completed=await context.__completeSharedQuizBank({capability:'Convert Celsius and Fahrenheit weather readings.'},school());
assert.equal(calls.length,1,'A module must use one selected-provider assessment call.');
assert.equal(completed.modules[0].quiz.bank.length,5,'Real provider questions must survive materialization.');
assert.ok(completed.modules[0].quiz.bank.every(question=>question.provenance==='ai-generated'));
assert.equal(completed.generation.quizCompletionProvider,'ollama');
assert.equal(completed.generation.quizIntegrity,'ai-only-complete');
assert.equal(normalizeAIQuiz(completed.modules[0].quiz,0).bank.length,5,'Explicit AI provenance must preserve real questions on reload, even when a provider chooses a legacy scaffold-shaped ID.');

calls.length=0;
const twoModules=school();
twoModules.modules.push({...structuredClone(twoModules.modules[0]),id:'module-2'});
const completedTwo=await context.__completeSharedQuizBank({capability:'Convert Celsius and Fahrenheit weather readings.'},twoModules);
assert.equal(calls.length,2,'Each module must receive exactly one assessment call, without a combined call or retries.');
assert.ok(completedTwo.modules.every(module=>module.quiz.bank.length===5));

selectedTimeout=15000;calls.length=0;
const threeModules=school();for(const id of ['module-2','module-3'])threeModules.modules.push({...structuredClone(threeModules.modules[0]),id});
const completedThree=await context.__completeSharedQuizBank({capability:'Convert Celsius and Fahrenheit weather readings.'},threeModules);
assert.equal(calls.length,3,'Three modules use three sequential assessment calls, preserving a shorter selected deadline.');
assert.ok(completedThree.modules.every(module=>module.quiz.bank.length===5));
selectedTimeout=undefined;calls.length=0;await context.__completeSharedQuizBank({capability:'Convert Celsius and Fahrenheit weather readings.'},school());
assert.equal(calls.length,1,'A missing assessment deadline retains its bounded fallback.');
selectedTimeout=600000;

incomplete=true;calls.length=0;
await assert.rejects(context.__completeSharedQuizBank({capability:'Convert Celsius and Fahrenheit weather readings.'},school()),/incomplete|assessment/i);
assert.equal(calls.length,1,'An incomplete assessment must fail without automatic retry or per-question repair calls.');
incomplete='empty';calls.length=0;
await assert.rejects(context.__completeSharedQuizBank({capability:'Convert Celsius and Fahrenheit weather readings.'},school()),/no assessment response/);
assert.equal(calls.length,1,'An empty provider result must not trigger the legacy final fallback call.');
calls.length=0;
const invalid=await context.CivweaveModelRuntime.generate({purpose:'living-school-quiz-delta-completion-v258',context:{modules:Array.from({length:9},(_,index)=>({moduleId:`module-${index}`}))}});
assert.equal(invalid.status,'error');
assert.equal(calls.length,0,'An unbounded assessment request must be rejected before invoking the provider.');
console.log('PASS Moss materialization: real compiler/curator scaffolds stripped, one selected-provider assessment call, genuine questions retained, incomplete assessments fail without hidden retries.');

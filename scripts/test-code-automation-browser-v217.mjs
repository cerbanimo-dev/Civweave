import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../public/app/code-automation-orchestrator-v217.js',import.meta.url),'utf8');
function runtime(settings=null){
 const store=new Map();if(settings)store.set('civweave.github-automation-flow.v1',JSON.stringify(settings));
 const context={console,structuredClone,crypto:globalThis.crypto,Date,Math,JSON,Promise,URL,URLSearchParams,queueMicrotask,setInterval:()=>1,clearInterval:()=>{},CustomEvent:class{constructor(type,init={}){this.type=type;this.detail=init.detail}},dispatchEvent:()=>true,fetch:async()=>({ok:true,status:204,json:async()=>({accepted:true})}),localStorage:{getItem:key=>store.has(key)?store.get(key):null,setItem:(key,value)=>store.set(key,String(value)),removeItem:key=>store.delete(key)},CivweaveGuideContractsV141:{compose:()=>null,answer:()=> 'ordinary action',approve:()=>({ok:false,error:'ordinary'})},CivweaveAssistantV141:{respond:async({text})=>({response:{answer:`ordinary:${text}`}})}};
 context.globalThis=context;vm.runInNewContext(source,context,{filename:'code-automation-orchestrator-v217.js'});return{context,store};
}
const configured={enabled:true,repository:'cerbanimo-dev/Civweave',token:'device-token',validatorEndpoint:'https://validator.example.test'};

test('I want to make creates user tasks and never starts coding',async()=>{
 const{context,store}=runtime(configured);
 const result=await context.CivweaveAssistantV141.respond({text:'I want to make a game about time loops.',systemId:'cerbanimo'});
 assert.equal(result.action.kind,'creator-project-plan');
 assert.equal(result.action.execution.status,'user-led-planning');
 assert.equal(result.action.fields.automationOnly,'No');
 assert.ok(result.action.checkpoints.length>=6);
 assert.ok(result.action.creatorProject.tasks.every(task=>task.owner==='user'));
 assert.equal(JSON.parse(store.get('civweave.code-automation.queue.v1')||'[]').length,0);
 assert.match(result.response.answer,/No coding automation or GitHub job started/);
});

test('Make me creates a dual-gated automation plan',async()=>{
 const{context}=runtime(configured);
 const result=await context.CivweaveAssistantV141.respond({text:'Make me a game about mutual aid.',systemId:'cerbanimo'});
 assert.equal(result.action.kind,'automation-quest');
 assert.equal(result.action.automation.automationOnly,true);
 assert.ok(result.action.automation.steps.every(step=>step.aiValidation.required&&step.githubValidation.required));
 assert.equal(result.action.automation.repository,'cerbanimo-dev/Civweave');
});

test('guidance and delegation paraphrases remain separate',()=>{
 const{context}=runtime(configured),analyze=context.CivweaveCodeAutomationV217.analyze;
 for(const phrase of ['Help me build a browser game.','Can you walk me through making a game?','We plan to develop an app.','I am coding a platformer.'])assert.equal(analyze(phrase,'cerbanimo')?.route,'creator-plan',phrase);
 for(const phrase of ['Please build a browser game.','Could you create an app for me?','I want Jules to implement the feature.','I need this API fixed.'])assert.equal(analyze(phrase,'cerbanimo')?.route,'automation',phrase);
});

test('Anarchadia uses the same agency boundary',async()=>{
 const{context}=runtime(configured);
 const guided=await context.CivweaveAssistantV141.respond({text:'I want to redesign the Civweave settings screen.',systemId:'anarchadia'});
 assert.equal(guided.action.kind,'creator-project-plan');
 assert.equal(guided.action.fields.sourceRealm,'anarchadia');
 const delegated=await context.CivweaveAssistantV141.respond({text:'Redesign the Civweave settings screen for me.',systemId:'anarchadia'});
 assert.equal(delegated.action.kind,'automation-quest');
 assert.equal(delegated.action.automation.sourceRealm,'anarchadia');
});

test('physical game design remains outside software automation',async()=>{
 const{context}=runtime(configured);
 const result=await context.CivweaveAssistantV141.respond({text:'Make me a card game.',systemId:'cerbanimo'});
 assert.equal(result.response.answer,'ordinary:Make me a card game.');
});

test('missing automation settings keep delegated work inert',async()=>{
 const{context}=runtime();
 const result=await context.CivweaveAssistantV141.respond({text:'Build a JavaScript game for me.',systemId:'cerbanimo'});
 assert.equal(result.action.state,'clarifying');
 assert.ok(result.action.missingRequired.includes('GitHub repository'));
 const approved=context.CivweaveGuideContractsV141.approve(result.action.id);
 assert.equal(approved.ok,false);
});

test('legacy repository setting is migrated in the browser route',async()=>{
 const{context}=runtime({...configured,repository:['cerbanimo-dev','Com'+'monweave'].join('/')});
 const result=await context.CivweaveAssistantV141.respond({text:'Implement a React game loop.',systemId:'cerbanimo'});
 assert.equal(result.action.automation.repository,'cerbanimo-dev/Civweave');
});

import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../public/app/local-ai/gemma4-structured-quest-compact-envelope-v1.js',import.meta.url),'utf8');
const registrySource=await readFile(new URL('../public/app/local-ai/gemma4-current-registry-authority-v1.js',import.meta.url),'utf8');
const workingCampus=await readFile(new URL('../public/app/working-campus-v440.html',import.meta.url),'utf8');
const persistentShell=await readFile(new URL('../public/app/persistent-system-shell-v1.html',import.meta.url),'utf8');
assert.match(registrySource,/gemma4-structured-quest-compact-envelope-v1\.js\?v=1\.0\.0-compact-envelope/,'current Gemma registry authority must retain its compact Quest fallback loader');
for(const [name,html] of [['Working Campus',workingCampus],['persistent shell',persistentShell]]){
  const completionIndex=html.indexOf('/app/local-ai/gemma4-structured-quest-completion-v1.js');
  const compactIndex=html.indexOf('/app/local-ai/gemma4-structured-quest-compact-envelope-v1.js?v=1.0.0-compact-envelope');
  assert.ok(completionIndex>=0,`${name} must load the base structured Quest completion bridge`);
  assert.ok(compactIndex>completionIndex,`${name} must directly load the compact Quest bridge after the base completion bridge so cached registry authority cannot strand the old full-JSON path`);
}
const storage=new Map([['civweave.local-ai.selection.v266',JSON.stringify({active:true,id:'gemma4-e4b-it-litert-web'})]]);
let generatedArgs=null;
const localSelection={active:true,id:'gemma4-e4b-it-litert-web'};
function canonicalizeQuestJson(text=''){
  const source=String(text).trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  let start=source.indexOf('{');
  if(start<0)return{valid:false,text:source,value:null,reasons:['no-json-object']};
  let stack=0,quoted=false,escaped=false,end=-1;
  for(let i=start;i<source.length;i++){
    const c=source[i];
    if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;continue}
    if(c==='"'){quoted=true;continue}
    if(c==='{')stack++;
    if(c==='}'&&--stack===0){end=i;break}
  }
  if(end<0)return{valid:false,text:source.slice(start),value:null,reasons:['truncated-json']};
  const candidate=source.slice(start,end+1).replace(/,\s*([}\]])/g,'$1');
  try{const value=JSON.parse(candidate);return{valid:true,text:JSON.stringify(value),value,reasons:[]}}catch{return{valid:false,text:candidate,value:null,reasons:['invalid-json']}}
}
function jsonCompletion(text=''){
  const source=String(text);let start=source.indexOf('{');if(start<0)return{hasJson:false,complete:false,truncated:false};
  let stack=0,quoted=false,escaped=false;
  for(let i=start;i<source.length;i++){
    const c=source[i];
    if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;continue}
    if(c==='"'){quoted=true;continue}
    if(c==='{')stack++;
    if(c==='}'&&--stack===0)return{hasJson:true,complete:true,truncated:false};
  }
  return{hasJson:true,complete:false,truncated:true};
}
const base={
  version:'1.0.2-gemma4-structured-quest-completion-v1-json-canonicalization',
  purpose:'civweave-weaveling-intention-json-v190',
  selectedLocal:()=>localSelection,
  budgetFor:id=>id==='gemma4-e4b-it-litert-web'?2800:2400,
  canonicalizeQuestJson,
  jsonCompletion,
  hardenRequest:request=>({...request,config:{...(request.config||{}),provider:'downloaded-local',route:'downloaded-local',model:localSelection.id,maxTokens:2800,stream:false},maxRepairAttempts:1,transport:async()=>({text:'old'})}),
  clarifyResult:result=>result
};
const sharedGenerate=async request=>({status:'success',request});
const sandbox={
  console,
  localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,String(value))},
  CivweaveGemma4StructuredQuestCompletionV1:base,
  CivweaveModelRuntime:{version:'test',generate:sharedGenerate},
  CivweaveLocalChatRuntimeV295:{generate:async args=>{generatedArgs=args;return{status:'success',outputText:'{"t":"Manifestation Practice App","w":"Learn manifestation and turn it into an app","o":"A working evidence-aware practice app","a":["Treat manifestation as a goal-setting practice"],"p":[{"y":"learning","r":"living-school","t":"Learn manifestation","u":"Separate useful practices from unsupported claims","s":["Study goal visualization","Track outcomes"],"c":"Explain the practice and its evidence limits","e":["Learning notes"]},{"y":"skilled-labor","r":"cerbanimo","t":"Build the app","u":"Turn the practice into a simple daily tool","s":["Design daily prompt","Implement tracker"],"c":"Run a usable prototype","e":["Working prototype"]}],"g":false,"x":0.84}',executionId:localSelection.id,model:{id:localSelection.id}}}},
  CivweaveLocalModelRuntimeV266:{shutdown:()=>{}},
  queueMicrotask:fn=>fn(),
  setTimeout:()=>1,
  clearTimeout:()=>{},
  addEventListener:()=>{},
  dispatchEvent:()=>{},
  CustomEvent:class CustomEvent{constructor(type,init={}){this.type=type;this.detail=init.detail}},
  DOMException:globalThis.DOMException,
  Object,
  Number,
  JSON
};
sandbox.globalThis=sandbox;
vm.createContext(sandbox);
vm.runInContext(source,sandbox,{filename:'gemma4-structured-quest-compact-envelope-v1.js'});

const api=sandbox.CivweaveGemma4StructuredQuestCompactEnvelopeV1;
assert.equal(api.version,'1.0.0-gemma4-structured-quest-compact-envelope-v1');
assert.equal(api.compactEnvelope,true);
const expanded=api.expandCompactQuest({t:'Q',w:'W',o:'O',a:['A'],p:[{y:'work',r:'work',t:'Build',u:'Make it',s:['Do'],c:'Done',e:['Artifact']}],g:false,x:.9});
assert.deepEqual(JSON.parse(JSON.stringify(expanded)),{title:'Q',wish:'W',outcome:'O',assumptions:['A'],paths:[{type:'skilled-labor',realm:'cerbanimo',title:'Build',purpose:'Make it',steps:['Do'],completionCriteria:'Done',evidence:['Artifact']}],governance:{included:false},confidence:.9});

const workingContext={currentRequest:'Help me learn manifestation and turn it into an app',resolvedPlanningRequest:'Help me learn manifestation and turn it into an app',currentWish:'',currentPlan:null,recentConversation:[{role:'user',text:'Help me learn manifestation and turn it into an app'}]};
const messages=[{role:'system',content:'Return full Quest JSON matching the supplied schema.'},{role:'user',content:`Generate the reviewable Quest from this working context:\n${JSON.stringify(workingContext)}`}];
const transport=api.compactTransport();
const result=await transport({config:{maxTokens:2800},messages,emit:()=>{}});
const full=JSON.parse(result.text);
assert.equal(generatedArgs.maxNewTokens,2800);
assert.match(generatedArgs.systemPrompt,/compact JSON object/);
assert.equal(full.title,'Manifestation Practice App');
assert.equal(full.wish,'Learn manifestation and turn it into an app');
assert.equal(full.paths.length,2);
assert.equal(full.paths[0].type,'learning');
assert.equal(full.paths[1].realm,'cerbanimo');
assert.deepEqual(full.governance,{included:false});
assert.equal(result.compactQuestEnvelope.expanded,true);

const huge='{"title":"old","paths":['+'x'.repeat(16000);
const repairMessages=[...messages,{role:'assistant',content:huge},{role:'user',content:'Repair the invalid response because MAX_OUTPUT_TOKENS was reached.'}];
await transport({config:{maxTokens:2800},messages:repairMessages,emit:()=>{}});
assert.equal(generatedArgs.messages.some(row=>row.content.includes('x'.repeat(1000))),false,'repair prompt must not resend the huge truncated response');
assert.equal(generatedArgs.messages.length,2,'repair should keep only compact source context plus a short regenerate instruction');
assert.match(generatedArgs.messages[1].content,/Regenerate the entire compact envelope from scratch/);
assert.match(generatedArgs.messages[0].content,/Help me learn manifestation and turn it into an app/);

const request={purpose:'civweave-weaveling-intention-json-v190',__civweaveLocalStructuredPlan:true,__civweaveSkipResponseRouter:true,config:{provider:'downloaded-local',model:localSelection.id,maxTokens:2200},messages,schema:{type:'object'}};
const hardened=api.hardenRequest(request);
assert.equal(hardened.maxRepairAttempts,2);
assert.equal(typeof hardened.transport,'function');
const wrappedResult=await sandbox.CivweaveModelRuntime.generate(request);
assert.equal(wrappedResult.request.__civweaveLocalStructuredPlan,false,'base v1.0.2 wrapper must be bypassed after compact hardening so it cannot replace the transport');
assert.equal(wrappedResult.request.__civweaveCompactStructuredQuestEnvelopeV1,true);
assert.equal(wrappedResult.request.maxRepairAttempts,2);
assert.equal(typeof wrappedResult.request.transport,'function');

console.log(JSON.stringify({ok:true,contract:'gemma4-structured-quest-compact-envelope-v1',compactEnvelope:true,directShellLoad:true,repairInputCompacted:true,maxRepairAttempts:2,e4Budget:2800,manifestationAppExpanded:true},null,2));

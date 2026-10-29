import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const read=file=>readFileSync(new URL('../public/app/'+file,import.meta.url),'utf8');
const sources=['shared/civweave-model-runtime.js','fast-interactive-runtime-v192.js','minilm-response-router-v347.js','starling-collective-v1.js'].map(read);
const intention='Implement a local checklist API with code, tests and deployment instructions for our Guild.';
const brief={summary:'Draft a local checklist with the selected model.',risks:['Capacity is unknown.'],nextActions:['Inspect the local checklist.']};
const plan={title:'Local checklist',wish:intention,outcome:'A working inspected checklist',assumptions:['No external deployment is authorized.'],paths:[{type:'skilled-labor',realm:'cerbanimo',title:'Build checklist',purpose:'Implement and inspect the checklist',steps:['Implement a local checklist','Inspect the saved checklist'],completionCriteria:'Checklist works locally',evidence:['Local inspection']} ]};
function fixture(){
  const dom=new JSDOM('<!doctype html><main></main>',{url:'https://civweave.test/app/',runScripts:'outside-only'}),w=dom.window,calls=[];
  w.TextEncoder=TextEncoder;w.TextDecoder=TextDecoder;w.AbortController=AbortController;w.structuredClone=structuredClone;w.setInterval=()=>0;w.clearInterval=()=>{};
  Object.defineProperty(w.navigator,'locks',{value:{request:async(_name,_options,fn)=>fn()}});
  w.localStorage.setItem('civweave-model-profiles-v1',JSON.stringify({interactive:{provider:'ollama',route:'ollama',model:'qwen3.5:4b',endpoint:'http://127.0.0.1:11434/api/chat',timeoutMs:300000,maxTokens:2200}}));
  w.fetch=async(url,init)=>{if(String(url).endsWith('/api/tags'))return new Response(JSON.stringify({models:[{name:'qwen3.5:4b'}]}),{headers:{'content-type':'application/json'}});const body=JSON.parse(init.body);calls.push({url:String(url),body});const output=calls.length===3?plan:brief;return new Response(JSON.stringify({model:'qwen3.5:4b',message:{role:'assistant',content:JSON.stringify(output)},done:true,done_reason:'stop'})+'\n',{headers:{'content-type':'application/x-ndjson'}})};
  for(const source of sources)w.eval(source);
  return{w,calls,api:w.CivweaveStarlingCollectiveV1,close:()=>w.close()};
}
test('Starling crosses the actual runtime and MiniLM wrappers with exactly three selected-model calls',async()=>{
  const f=fixture();try{const line=await f.api.runLine({intention});assert.equal(line.state,'review');assert.equal(f.calls.length,3);assert.ok(f.calls.every(call=>call.url.startsWith('http://127.0.0.1:11434/')&&call.body.model==='qwen3.5:4b'));assert.equal(line.events.filter(e=>e.kind==='output').length,3)}finally{f.close()}
});
test('canonical abandonment refusal precedes all remote withdrawal, including a completion race',async()=>{
  const f=fixture();try{
    const seen=[];f.api.configure({guildTransport:{read:async()=>({guildId:'guild-fixture'}),reserve:async()=>({line:{id:'shared-fixture',revision:1}}),abandon:async()=>{seen.push('remote')}}});await f.api.connectGuild();
    const line=await f.api.runLine({intention,scope:'guild',shareIntention:true});const state=JSON.parse(f.w.localStorage.getItem(f.api.storageKey));state.lines[0].questId='quest-fixture';f.w.localStorage.setItem(f.api.storageKey,JSON.stringify(state));
    f.w.CivweaveIntentionPlanner={abandon:()=>{seen.push('canonical');return{ok:false,code:'QUEST_ALREADY_COMPLETED',error:'Completed work cannot be rewritten as abandoned.'}}};
    await assert.rejects(f.api.abandon(line.id),/Completed/);assert.deepEqual(seen,['canonical']);assert.equal(f.api.read().limits.active,1);
  }finally{f.close()}
});
test('a failed remote release remains visible and retryable without reopening the stopped local Quest',async()=>{
  const f=fixture();try{
    let attempts=0;const seen=[];f.api.configure({guildTransport:{read:async()=>({guildId:'guild-fixture'}),reserve:async()=>({line:{id:'shared-fixture',revision:1}}),abandon:async()=>{seen.push('remote');if(++attempts===1)throw new Error('Fixture offline');return{line:{state:'abandoned'}}}}});await f.api.connectGuild();
    const line=await f.api.runLine({intention,scope:'guild',shareIntention:true});const state=JSON.parse(f.w.localStorage.getItem(f.api.storageKey));state.lines[0].questId='quest-fixture';f.w.localStorage.setItem(f.api.storageKey,JSON.stringify(state));f.w.CivweaveIntentionPlanner={abandon:()=>{seen.push('canonical');return{ok:true,unchanged:attempts>0}}};
    await assert.rejects(f.api.abandon(line.id),/Fixture offline/);assert.equal(f.api.read().lines[0].state,'abandonment-pending-guild');assert.equal(f.api.read().limits.active,1);await f.api.abandon(line.id);assert.deepEqual(seen,['canonical','remote','canonical','remote']);assert.equal(f.api.read().limits.active,0);
  }finally{f.close()}
});

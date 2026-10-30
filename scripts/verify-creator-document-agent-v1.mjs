// Run: node scripts/verify-creator-document-agent-v1.mjs
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const root=new URL('../',import.meta.url);
const load=name=>readFileSync(new URL(name,root),'utf8');
const unique=(()=>{let i=0;return()=>String(++i)})();
const environment={crypto:{randomUUID:unique},structuredClone,Date,JSON,Array,String,Number,Set,Promise};
environment.globalThis=environment;
runInNewContext(load('public/creator-suite/shared/structured-document-v1.js'),environment);
const builder=environment.CivweaveStructuredDocumentV1;
const blank=builder.fresh('test-session');
const updated=builder.apply(blank,[
  {op:'setTitle',title:'Test document'},
  {op:'append',block:{type:'heading',level:2,text:'Overview'}},
  {op:'append',block:{type:'paragraph',text:'Three incremental edits were saved.'}}
],{expectedRevision:0,requestId:'first',maxEdits:3}).document;
assert.equal(updated.revision,1);
assert.equal(builder.status(updated).title,'Test document');
assert.equal(builder.status(updated).outline.length,1);
assert.equal(builder.render(updated),'## Overview\n\nThree incremental edits were saved.');
assert.equal(builder.apply(updated,[{op:'append',block:{text:'ignored'}}],{
  expectedRevision:0,requestId:'first',maxEdits:3}).duplicate,true);
assert.throws(()=>builder.apply(updated,[{op:'append',block:{text:'stale'}}],{
  expectedRevision:0,maxEdits:3}),/Revision conflict/);
assert.throws(()=>builder.apply(updated,Array.from({length:4},()=>({op:'append',block:{text:'over limit'}})),{
  expectedRevision:1,maxEdits:3}),/1 to 3 edits/);
const large=builder.apply(updated,Array.from({length:4},(_,i)=>({op:'append',block:{
  type:'bullet',text:'Point '+i}})),{expectedRevision:1,maxEdits:64});
assert.equal(large.applied,4);
assert.equal(large.document.revision,2);
const human=builder.fromHuman(updated,'## Overview\n\nModified by a human.');
assert.equal(builder.outline(human)[0].title,'Overview');
assert.equal(builder.render(human),'## Overview\n\nModified by a human.');
const el=new Map();
function node(id){
  if(!el.has(id))el.set(id,{value:'',disabled:false,textContent:'',className:'',
    getAttribute:()=> 'true',setAttribute(){},addEventListener(){}});
  return el.get(id);
}
let modelCalls=0,writes=[],revision=0,blocks=0,model='qwen3.5:4b',sessionId='s1';
const agentEnvironment={
  crypto:{randomUUID:unique},JSON,Array,String,Number,Math,Promise,
  document:{readyState:'complete',getElementById:node},
  dispatchEvent(){},CustomEvent:class{constructor(type,detail){this.type=type;this.detail=detail.detail;}},
  CivweaveCreatorTextV1:{
    flush:async()=>{},getSession:()=>({id:sessionId}),
    getDocumentStatus:()=>({sessionId,revision,wordCount:20,blockCount:blocks})},
  CivweaveCreatorToolsV1:{execute:async request=>{
    writes.push(request);
    if(request.action==='document.apply'){revision++;blocks+=request.args.edits.length;}
    return{result:{revision}};
  }},
  CivweaveModelRuntime:{
    readSharedConfig:()=>({provider:'ollama',model,maxTokens:4096}),
    generate:async()=>{
      modelCalls++;
      return{status:'success',actual:{provider:'ollama',model},outputJson:modelCalls%2===1?
        {type:'edit',edits:Array.from({length:model==='qwen3.5:4b'?3:4},(_,i)=>({op:'append',block:{text:'Phrase '+i}}))}:
        {type:'done',note:'Complete'}};
    }}
};
agentEnvironment.globalThis=agentEnvironment;
runInNewContext(load('public/creator-suite/document-agent-v1.js'),agentEnvironment);
const agent=agentEnvironment.CivweaveCreatorDocumentAgentV1;
const first=await agent.run({objective:'Write a short report',steps:5});
assert.equal(first.completed,true);
assert.equal(first.calls,2);
assert.equal(writes[0].args.taskTier,'small');
assert.equal(writes[0].args.edits.length,3);
assert.equal(revision,1);
model='qwen3.5:32b';
const second=await agent.run({objective:'Extend the report',steps:5});
assert.equal(second.completed,true);
assert.equal(writes[1].args.taskTier,'large');
assert.equal(writes[1].args.edits.length,4);
assert.equal(revision,2);
console.log('PASS: creator structured-document edits, safe revisions, recovery-ready structure, and small/large model agent loops.');

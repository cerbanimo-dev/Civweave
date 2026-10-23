#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const guide=readFileSync('public/app/guide-chat-surface-v350.js','utf8');
const loader=readFileSync('public/app/family-ai-loader-v105.js','utf8');
const campus=readFileSync('public/app/working-campus-v440.html','utf8');
for(const [name,src] of [['guide',guide],['loader',loader]])new Function(src);

function segment(src,start,end){
  const i=src.indexOf(start),j=src.indexOf(end,i);
  assert(i>=0&&j>i,'Missing source segment '+start);
  return src.slice(i,j);
}
const state={route:'openai-compatible',model:'qwen35-4b-native'};
const saved={active:true,id:'gemma4-e4b-it-litert-web'};
const storage={getItem:key=>key==='civweave.local-ai.selection.v266'?JSON.stringify(saved):null};
const globalObject={CivweaveSettingsV320:{readState:()=>state}};
const helpers=segment(guide,'function configuredRoute()','\nfunction voiceState()');
const api=new Function('globalThis','localStorage','clean','parse','LOCAL_SELECTION_KEY',helpers+';return {selectedLocal,nativeApiRoute}')(globalObject,storage,x=>String(x||''),(v,d)=>{try{return JSON.parse(v)||d}catch{return d}},'civweave.local-ai.selection.v266');
assert.equal(api.nativeApiRoute(),true);
assert.equal(api.selectedLocal(),null,'Legacy E4B must not be selected while native Qwen server is primary');

state.route='downloaded-local';
assert.equal(api.nativeApiRoute(),false);
assert.equal(api.selectedLocal()?.id,saved.id,'Explicit downloaded-local still available');

let secondGeneration=0,thread={messages:[]};
const root={querySelector:()=>({disabled:false,value:''})};
const mock={
  busy:false,activeSystem:'living-school',pageSystem:'civweave',SYSTEMS:['living-school'],root,
  clean:(s,n=12000)=>String(s||'').trim().slice(0,n),
  ensureRoot(){},append(system,row){thread.messages.push({...row});return thread},uid:()=>String(thread.messages.length+1),render(){},emitAvatar(){},
  guide:()=>({name:'Moss'}),historyFor:()=>[],readThread:()=>thread,writeThread:(system,value)=>{thread=value},
  emitState(){},nativeApiRoute:()=>true,verifyNativePhoneServerTransport:async()=>true,
  fallbackReply:async()=>{secondGeneration++;return{text:'Unexpected fallback',provider:'downloaded-local'}},
  realmApi:()=>null,explicitHandoffTarget:()=>'',dispatchEvent(){},CustomEvent:class{},
  globalThis:{
    CivweaveFamilyAILoaderV105:{ensure:async()=>true},
    CivweaveAssistantV141:{respond:async()=>{throw new Error('Native server returned HTTP 503')}}
  }
};
const submit=new Function(...Object.keys(mock),segment(guide,'async function submitActive(text){','\nfunction switchGuide(')+';return submitActive')(...Object.values(mock));
await submit('Can you teach me how to read and memorize the tarot?');
assert.equal(secondGeneration,0,'Native server request failure must not trigger hidden second generation');
assert.equal(thread.messages.length,2);
const failure=thread.messages.at(-1);
assert.equal(failure.provider,'model-error');
assert.match(failure.text,/HTTP 503/);
assert.match(failure.text,/No second model was started/);
assert.match(guide,/function selectedLocal\(\)/);
assert.match(loader,/function localRequested\(\)/);
assert.match(loader,/if\(primary&&!\['downloaded-local'/);
assert.match(campus,/guide-chat-surface-v350\.js\?v=1\.0\.175-native-api-no-retry/);
console.log('PASS: native server failure does not retry through stale Gemma, explicit downloaded-local route remains supported');

#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const native=readFileSync('public/app/local-ai/native-server-guide-fastpath-v1.js','utf8');
const chat=readFileSync('public/app/guide-chat-surface-v350.js','utf8');
const moss=readFileSync('public/app/unified-chat-system-v1.js','utf8');
const runtime=readFileSync('public/app/shared/civweave-model-runtime.js','utf8');
const campus=readFileSync('public/app/working-campus-v440.html','utf8');
const shell=readFileSync('public/app/persistent-system-shell-v1.js','utf8');
const diagnostic=readFileSync('public/native-server-diagnostic.html','utf8');
const source=native.replace(/\bexport\s+(?=(?:const|async function|function)\b)/g,'');
new vm.Script(source);
new vm.Script(chat);
new vm.Script(moss);
new vm.Script(runtime);
const stageData=new Map();
const storage={setItem:(k,v)=>stageData.set(k,v),getItem:k=>stageData.get(k)||null};
const selected={provider:'openai-compatible',model:'qwen35-4b-native',endpoint:'http://127.0.0.1:8080/v1'};
let requested=0,req=null,planArgs=null,assistants=0;
const globals={
  CivweaveSettingsV320:{readState:()=>selected},
  CivweaveModelRuntime:{nativeDirectTermuxNoStream:true,generate:async()=>{throw Error('unexpected runtime call')}},
  CivweaveUnifiedChatSystemV1:{
    version:'1.2.4-unified-chat-system-v1-native-learning-controls',
    handleNativeLivingSchoolRequest:async args=>{planArgs=args;return{response:{answer:args.text==='approve'?'Approved Learning Journey': 'Learning Journey plan: Tarot',choice:{nextAction:'Review first'}},provider:'openai-compatible',model:'qwen35-4b-native'}}
  },
  CivweaveFamilyAILoaderV105:{ensure:async()=>{assistants++;throw Error('full assistant bootstrap should be skipped')}}
};
const scope={globalThis:globals,localStorage:storage,Date,JSON,String,Object,Array,Promise,Error,AbortController,
  setTimeout,clearTimeout,document:{createElement(){throw Error('Should not need script loader')}},
  fetch:async(url,options)=>{requested++;req={url,options};return {ok:true,status:200,json:async()=>({choices:[{message:{content:'READY'}}],usage:{completion_tokens:2}})}}
};
const api=vm.runInNewContext(source+';({respondNative,markNativeStage})',scope);
let reply=await api.respondNative({text:'Say READY',system:'civweave'});
assert.equal(reply.response.answer,'READY');
assert.equal(reply.provider,'openai-compatible');
assert.equal(requested,1);
assert.equal(req.url,'http://127.0.0.1:8080/v1/chat/completions');
assert.equal(req.options.mode,'cors');
const body=JSON.parse(req.options.body);
assert.equal(body.stream,false);
assert.equal(body.max_tokens,512);
assert.equal(body.model,'qwen35-4b-native');
assert.equal(assistants,0);
assert.equal(JSON.parse(stageData.get('civweave.native-server.last-request.v1')).stage,'native-text-complete');

const oldTopic=[
  {role:'user',text:'Can you teach me tarot?'},
  {role:'assistant',text:'Tarot is a card system for readings.'},
  {role:'user',text:'Reply with exactly READY'}
];
let lastIsolatedRequest=null;
const isolatedFetch=async(_url,options)=>{
  lastIsolatedRequest=JSON.parse(options.body);
  return{ok:true,status:200,json:async()=>({
    choices:[{finish_reason:'stop',message:{role:'assistant',content:'READY'}}],
    usage:{completion_tokens:2}
  })};
};
reply=await api.respondNative({text:'Reply with exactly READY',history:oldTopic,fetcher:isolatedFetch});
assert.equal(reply.response.answer,'READY');
assert.equal(lastIsolatedRequest.messages.length,2,'Explicit check must not inherit old tarot conversation');
assert.equal(lastIsolatedRequest.messages.at(-1).content,'Reply with exactly READY');
assert.equal(lastIsolatedRequest.max_tokens,512,'Raise low emergency 192-token cap');

const cutOffFetch=async(_url,options)=>{
  lastIsolatedRequest=JSON.parse(options.body);
  return{ok:true,status:200,json:async()=>({
    choices:[{finish_reason:'length',message:{role:'assistant',content:'Partial answer'}}],
    usage:{completion_tokens:512}
  })};
};
reply=await api.respondNative({
  text:'Continue',
  history:[{role:'user',text:'Explain tarot'}, {role:'assistant',text:'A'.repeat(1400)}],
  fetcher:cutOffFetch
});
assert.equal(lastIsolatedRequest.messages.at(-1).content,'Continue');
assert.equal(lastIsolatedRequest.messages.at(-2).role,'assistant');
assert.equal(lastIsolatedRequest.messages.at(-2).content.length,1100,
  'Continuation should preserve the end of the previous answer, within a bounded context');
assert.match(reply.response.answer,/Response reached the generation limit/);
assert.match(JSON.parse(stageData.get('civweave.native-server.last-request.v1')).detail,/finish:length/);
assert.match(chat,/const pastHistory=recentHistory\.at\(-1\)/,
  'Visible current user turn must be excluded from the history passed to the model');

reply=await api.respondNative({text:'Can you teach me how to read and memorize the tarot?',system:'living-school'});
assert.match(reply.response.answer,/Learning Journey/);
assert.equal(planArgs.nativeFastLane,true);
assert.equal(requested,1,'Moss routes to existing planner, not a separate unvalidated text prompt');
assert.equal(assistants,0);
reply=await api.respondNative({text:'approve',system:'living-school'});
assert.match(reply.response.answer,/Approved Learning Journey/);
assert.equal(planArgs.text,'approve');
assert.equal(requested,1,'Moss approval controls must not be answered by generic chat');
selected.provider='server-auto';
await assert.rejects(api.respondNative({text:'Say READY'}),/route changed/);
assert.equal(requested,1);
assert.match(moss,/options\.nativeFastLane&&nativePhoneServer\(config\)/);
assert.match(moss,/handleNativeLivingSchoolRequest/);
assert.match(chat,/await direct\.respondNative/);
assert.match(chat,/await verifyNativePhoneServerTransport/);
assert.match(runtime,/nativeDirect \? false : Boolean\(config\.stream \|\| lineup\)/);
assert.match(runtime,/nativeDirectTermuxNoStream: true/);
assert.match(campus,/native-turn-priority-budget/);
assert.match(shell,/native-turn-priority-budget/);
assert.match(diagnostic,/Show last Civweave native-request stage/);
console.log('PASS: direct native HTTP, Moss review planner fast entry, no second model, no heavy bootstrap, stage diagnostics and invalid route rejection');

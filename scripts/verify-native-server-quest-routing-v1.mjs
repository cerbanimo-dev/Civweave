#!/usr/bin/env node
// Regression: native Termux chat must enter Weaveling's canonical Quest
// generator rather than streaming an ordinary 150-second chat answer.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile('public/app/local-ai/native-server-guide-fastpath-v1.js','utf8');
const url='data:text/javascript;base64,'+Buffer.from(source).toString('base64');
const native=await import(url);
const request='Create a reviewable cross-realm Quest with two required paths: Living School for mastering and memorizing tarot, followed by Cerbanimo for designing, developing, and testing my own tarot application. Include dependencies and completion evidence for both. Do not activate the Quest.';
const combined='Can you teach me how to read and memorize the tarot, then create a plan to create my own tarot app';
const calls=[];
globalThis.localStorage={getItem:()=>null,setItem(){}};
globalThis.CivweaveSettingsV320={readState:()=>({provider:'openai-compatible',model:'qwen35-4b-native',endpoint:'http://127.0.0.1:8080/v1'})};
globalThis.CivweaveModelRuntime={nativeFinishReasonGuardV1:true,generate:async()=>{throw Error('unexpected extra model call')}};
globalThis.CivweaveIntentionPlanner={persist:()=>{throw Error('unrequested persistence')}};
globalThis.CivweaveUnifiedChatSystemV1={version:'1.2.16-unified-chat-system-v1-explicit-weave-path',handleNativeLivingSchoolRequest:async()=>{throw Error('Moss stole the Quest')}};
globalThis.CivweaveWeavelingPlanJsonV190={
  planIntent:text=>/quest|plan/i.test(text),
  combinedLearningProductionIntent:text=>/teach me.*then.*app/i.test(text),
  createModelPlan:async(args,api)=>{
    calls.push({args,selected:api.selectedConfig()});
    return{provider:'openai-compatible',model:'qwen35-4b-native',plan:{state:'review',paths:[{realm:'living-school'},{realm:'cerbanimo'}]},response:{answer:'A reviewable cross-realm Quest was generated.',requiresConsent:true,approvalGate:{kind:'intention-activation',required:true}}};
  }
};
const noGeneric=async()=>{throw Error('Native Quest incorrectly fell through to generic chat')};
for(const text of [request,combined]){
  const ctrl=new AbortController(),progress=[];
  const result=await native.respondNative({system:'civweave',text,history:[],signal:ctrl.signal,fetcher:noGeneric,onToken:(delta,whole,meta)=>progress.push(meta)});
  assert.equal(result.plan?.state,'review');
  assert.equal(result.response.approvalGate?.required,true);
  assert.equal(result.plan.paths.length,2);
  assert.ok(progress.some(row=>row?.kind==='quest-progress'),'Quest never entered the official generation lifecycle.');
}
assert.equal(calls.length,2,'Expected exactly one canonical Quest planning call per user request.');
assert.ok(calls.every(row=>row.args.signal),'The user cancellation signal was not forwarded to Quest generation.');
assert.ok(calls.every(row=>row.selected.model==='qwen35-4b-native'),'The selected Termux model was not preserved.');
assert.ok(calls.every(row=>row.args.text===request||row.args.text===combined),'The original Quest request was modified or lost.');
console.log('PASS native Termux route invokes canonical Weaveling Quest planning for explicit and combined intents; no generic chat or second model.');

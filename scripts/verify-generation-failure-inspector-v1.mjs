import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source=await readFile('public/app/generation-failure-inspector-v1.js','utf8');
const rejected='<think>private scratchpad that must not be shown</think>\n{"title":"Tarot","modules":[]}';
const failure=Object.assign(new Error('The provider response did not satisfy the requested JSON contract.'),{
  code:'INVALID_STRUCTURED_OUTPUT',
  result:{status:'invalid-response',outputText:rejected,structured:{requested:true,valid:false,errors:['$.modules must contain at least 3 items.']},error:{code:'INVALID_STRUCTURED_OUTPUT'}}
});
const sandbox={
  console,
  CustomEvent:class CustomEvent{constructor(type,init={}){this.type=type;this.detail=init.detail}},
  dispatchEvent:()=>true,
  addEventListener:()=>{},
  queueMicrotask:()=>{},
  setTimeout:()=>0,
  clearTimeout:()=>{},
  CivweaveModelRuntime:{generate:async()=>{throw failure}}
};
sandbox.globalThis=sandbox;
vm.runInNewContext(source,sandbox,{filename:'generation-failure-inspector-v1.js'});
const api=sandbox.CivweaveGenerationFailureInspectorV1;
assert(api?.showFailingMessage===true,'failure inspector did not install its public contract');
assert.equal(api.privateReasoningExposed,false,'failure inspector must not expose private reasoning');
assert(source.includes("button.textContent='Show failing message'"),'failure UI is missing the requested Show failing message button');
api.installRuntime();
await assert.rejects(()=>sandbox.CivweaveModelRuntime.generate({purpose:'living-school-learning-plan-review-v2'}),/JSON contract/);
const rec=api.latest();
assert(rec,'structured rejection was not recorded');
assert.match(rec.outputText,/"title":"Tarot"/,'rejected generated content was not preserved');
assert(!rec.outputText.includes('private scratchpad'),'private <think> content leaked into the failing-message inspector');
assert.deepEqual(Array.from(rec.errors),['$.modules must contain at least 3 items.']);
console.log('PASS: successful text that fails structured validation is preserved for Show failing message while private <think> content is stripped.');

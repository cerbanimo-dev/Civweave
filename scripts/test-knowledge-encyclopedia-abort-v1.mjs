import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../public/app/knowledge-encyclopedia-bridge-v271.js',import.meta.url),'utf8');
let retrievals=0,generations=0,handler=async()=>({status:'success',outputText:'Selected model answer'}),onRetrieve=null;
const encyclopedia={classifyKnowledgeQuestion:()=>({eligible:true}),async buildKnowledgeContext(){retrievals++;await onRetrieve?.();return{sources:[{title:'QA Temperature Reference',passage:'Celsius and Fahrenheit use different reference points.'}],personality:{guide:'Moss'}}}};
const context={console,Date,Math,JSON,Object,Array,String,Number,Boolean,RegExp,Promise,Set,Map,AbortController,DOMException,Error,
  dispatchEvent(){},CustomEvent:class{},__encyclopedia:encyclopedia,
  CivweaveModelRuntime:{async generate(options){generations++;return handler(options)}}
};
context.globalThis=context;vm.createContext(context);
vm.runInContext(source.replace(/import\('\/app\/shared\/knowledge-encyclopedia-v271\.mjs\?v=knowledge-encyclopedia-v271'\)/,'Promise.resolve(globalThis.__encyclopedia)'),context);
await context.CivweaveKnowledgeEncyclopediaBridgeV271.install();
const generate=signal=>context.CivweaveModelRuntime.generate({purpose:'civweave-guide-response-v141',signal,context:{userMessage:'What is temperature?',guide:{system:'living-school'}}});
const aborted=new AbortController();aborted.abort(new DOMException('QA stopped generation','AbortError'));
await assert.rejects(generate(aborted.signal),error=>error.name==='AbortError');
assert.equal(retrievals,0,'A stopped turn must not start retrieval.');
assert.equal(generations,0);

const duringShelf=new AbortController();onRetrieve=()=>duringShelf.abort(new DOMException('QA stop during shelf lookup','AbortError'));
await assert.rejects(generate(duringShelf.signal),error=>error.name==='AbortError');
assert.equal(generations,0,'Cancellation during retrieval must stop before selected-model generation.');
onRetrieve=null;
handler=async()=>{throw new DOMException('QA provider aborted','AbortError')};
await assert.rejects(generate(),error=>error.name==='AbortError');
handler=async()=>({status:'cancelled',error:{code:'CANCELLED',message:'QA request cancelled'}});
await assert.rejects(generate(),error=>error.name==='AbortError');
handler=async()=>({status:'error',error:{name:'AbortError',message:'QA model aborted'}});
await assert.rejects(generate(),error=>error.name==='AbortError');

const duringModel=new AbortController();handler=async()=>{duringModel.abort(new DOMException('QA stopped late model result','AbortError'));return{status:'success',outputText:'Late result'}};
await assert.rejects(generate(duringModel.signal),error=>error.name==='AbortError');
handler=async()=>{throw new Error('QA provider unavailable')};
const fallback=await generate();
assert.equal(fallback.status,'success');
assert.equal(fallback.actual.provider,'local-knowledge-school','A genuine non-abort provider failure retains the intentional local shelf fallback.');
assert.match(fallback.outputJson.answer,/QA Temperature Reference/);
handler=async()=>({status:'success',outputText:'Selected model answer'});
assert.equal((await generate()).outputText,'Selected model answer');
console.log('PASS knowledge cancellation: pre-abort, retrieval/model aborts, thrown/returned cancellation and late results never become local shelf success; genuine provider failure retains fallback.');

import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const settings = await readFile('public/app/settings-gateway-v317.js','utf8');
const runtime = await readFile('public/app/shared/civweave-model-runtime.js','utf8');
new vm.Script(settings,{filename:'settings-gateway-v317.js'});
new vm.Script(runtime,{filename:'civweave-model-runtime.js'});

const chunk=(source,from,to)=> {
  const start=source.indexOf(from),end=source.indexOf(to,start+from.length);
  assert.ok(start>=0&&end>start,'Missing phone GGUF integration section: '+from);
  return source.slice(start,end);
};
const gatewaySection=chunk(settings,'const GGUF_FAMILY=','function selectLocalModel(selected){');
const requests=[];
const context={
  URL,AbortController,setTimeout,clearTimeout,
  fetch:async(url,options)=>{
    requests.push({url,options});
    return {ok:true,async json(){return {data:[{id:'Qwen3.5-4B-Q4_K_M.gguf'},{id:'Qwen3.5-2B-Q4_K_M.gguf'}]}}};
  }
};
vm.createContext(context);
vm.runInContext(gatewaySection+'\nthis.testPhone={checkedPhoneEndpoint,probePhoneGGUF,GGUF_FAMILY};',context);
const {checkedPhoneEndpoint,probePhoneGGUF,GGUF_FAMILY}=context.testPhone;
assert.equal(checkedPhoneEndpoint('http://127.0.0.1:8080/v1/'),'http://127.0.0.1:8080/v1');
assert.equal(checkedPhoneEndpoint('http://localhost:8081/v1/chat/completions'),'http://localhost:8081/v1');
for(const url of ['https://example.com/v1','http://192.168.1.7:8080/v1','http://127.0.0.1:8080/private','http://user:pass@127.0.0.1:8080/v1']){
  assert.throws(()=>checkedPhoneEndpoint(url),'Remote or credential-bearing GGUF endpoint must be rejected: '+url);
}
assert.ok(GGUF_FAMILY.primary.test('Qwen3.5-4B-Q4_K_M.gguf'));
assert.ok(!GGUF_FAMILY.primary.test('Qwen3.5-14B-Q4_K_M.gguf'));
assert.ok(GGUF_FAMILY.helper2b.test('Qwen3.5-2B-Q4_K_M.gguf'));
assert.ok(!GGUF_FAMILY.helper08b.test('Qwen3.5-2B-Q4_K_M.gguf'));
assert.equal(await probePhoneGGUF('http://127.0.0.1:8080/v1','primary'),'Qwen3.5-4B-Q4_K_M.gguf');
assert.ok(requests.length===1&&requests[0].url==='http://127.0.0.1:8080/v1/models');
assert.equal(requests[0].options.credentials,'omit');
context.fetch=async()=>({ok:true,async json(){return{data:[{id:'Qwen3.5-2B-Q4_K_M.gguf'}]}}});
await assert.rejects(()=>probePhoneGGUF('http://127.0.0.1:8080/v1','primary'),/did not advertise/);

const runtimeSection=chunk(runtime,'  // The native phone GGUF lane','  async function invokeOpenAI(config, messages, request, context, signal) {');
const saved={schema:'civweave.mobile.gguf-primary.v1',enabled:true,endpoint:'http://127.0.0.1:8080/v1',model:'Qwen3.5-4B-Q4_K_M.gguf',helpers:[{role:'helper2b',endpoint:'http://127.0.0.1:8081/v1',model:'Qwen3.5-2B-Q4_K_M.gguf'}]};
const rt={URL,global:{localStorage:{getItem:()=>JSON.stringify(saved)}}};
vm.createContext(rt);
vm.runInContext(runtimeSection+'\nthis.phoneRuntime={nativePhoneLineup,nativePhoneHelper};',rt);
const config={provider:'openai-compatible',model:saved.model,endpoint:saved.endpoint};
assert.equal(rt.phoneRuntime.nativePhoneLineup(config).model,saved.model,'Selected native GGUF must remain the execution model.');
assert.equal(rt.phoneRuntime.nativePhoneLineup({...config,model:'Gemma4'}),null,'Never relabel another model as the benchmarked GGUF 4B.');
assert.equal(rt.phoneRuntime.nativePhoneLineup({...config,endpoint:'http://10.0.0.7:8080/v1'}),null,'Native GGUF route must remain loopback-only.');
assert.equal(rt.phoneRuntime.nativePhoneLineup({...config,provider:'gemini'}),null,'A cloud provider must not inherit local GGUF helper configuration.');
assert.match(runtime,/chat_template_kwargs: \{ enable_thinking: false \}/);
assert.match(runtime,/const useStream = Boolean\(config.stream \|\| lineup\)/);
assert.match(runtime,/mobile-helper-unavailable/);
assert.match(settings,/data-mobile-qwen-connect/);
const stableSlot = settings.indexOf('data-mobile-gguf-panel');
const localSlot = settings.indexOf('data-settings-tab-panel="local-models"');
assert.ok(stableSlot > 0 && localSlot > stableSlot, 'Phone GGUF setup must live before the replaceable Local Models tab.');
assert.match(settings,/persist\(\{\.\.\.DEFAULTS,route:'openai-compatible'/);
console.log('Verified native GGUF 4B phone-primary route, strict localhost model identity, optional helper isolation and source syntax.');

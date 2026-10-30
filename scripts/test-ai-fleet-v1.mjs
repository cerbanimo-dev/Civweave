import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';

const source=fs.readFileSync(new URL('../public/app/shared/civweave-ai-fleet-v1.js',import.meta.url),'utf8');
function boot(userAgent,deviceMemory=undefined,webgpu=/iPhone|iPad/.test(userAgent)){
 const data=new Map();
 const storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,String(v))};
 const context={globalThis:null,navigator:{userAgent,deviceMemory,...(webgpu?{gpu:{requestAdapter(){throw Error('GPU probed on display')}}}:{})},localStorage:storage};
 context.globalThis=context;
 vm.runInNewContext(source,context,{filename:'civweave-ai-fleet-v1.js'});
 return{fleet:context.CivweaveAIFleetV1,data};
}
test('iPhone shows browser-compatible ONNX fleet, never GGUF, LiteRT or server-only weights',()=>{
 const {fleet}=boot('Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X)');
 const rows=fleet.catalogue();
 assert.ok(rows.length>0);
 assert.ok(rows.every(x=>x.platform==='ios'&&x.runtime==='ios-webgpu'));
 assert.ok(rows.some(x=>x.modelId==='qwen35-08b-onnx-webgpu'));
 assert.ok(rows.every(x=>x.ramGB<=fleet.detectDevice().budgetGB));
 assert.ok(!rows.some(x=>/litert|gguf|ollama/i.test(x.runtime)));
});
test('iPhone without WebGPU only offers the native ai.local adapter',()=>{
 const {fleet}=boot('Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X)',undefined,false);
 const rows=fleet.catalogue();
 assert.ok(rows.length);
 assert.ok(rows.every(x=>x.platform==='ios'&&x.runtime==='ai-local'));
 assert.ok(rows.every(x=>!x.modelId.includes('onnx-webgpu')));
});
test('Android phone hides iPhone-only model format and large desktop models',()=>{
 const {fleet}=boot('Mozilla/5.0 (Linux; Android 16; A069P) AppleWebKit/537.36',8);
 const rows=fleet.catalogue();
 assert.ok(rows.length>0);
 assert.ok(rows.every(x=>x.platform==='android'&&x.runtime==='browser-gguf'));
 assert.ok(rows.every(x=>x.ramGB<=fleet.detectDevice().budgetGB));
 assert.ok(!rows.some(x=>x.modelId.includes('onnx-webgpu')));
});
test('Desktop shows installed-server-compatible roles, filters memory requirements',()=>{
 const {fleet}=boot('Mozilla/5.0 (Windows NT 10.0; Win64; x64)',8);
 const rows=fleet.catalogue();
 assert.ok(rows.every(x=>x.platform==='desktop'&&x.runtime==='ollama'));
 assert.ok(!rows.some(x=>x.ramGB>fleet.detectDevice().budgetGB));
});
test('User memory override changes filter without altering provider settings',()=>{
 const {fleet,data}=boot('Mozilla/5.0 (Windows NT 10.0; Win64; x64)',8);
 const small=fleet.catalogue().length;
 fleet.setMemoryBudget(32);
 const large=fleet.catalogue();
 assert.ok(large.length>small);
 assert.ok(large.some(x=>x.role==='atlas'));
 assert.equal(data.get('civweave.ai.fleet.memory-gb.v1'),'32');
});
test('Read-only catalog never downloads, probes, selects or starts a model',()=>{
 const {fleet,data}=boot('Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X)');
 fleet.catalogue();fleet.detectDevice();
 assert.equal(data.size,0);
});

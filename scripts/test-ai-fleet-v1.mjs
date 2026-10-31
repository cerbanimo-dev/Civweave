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


test('Existing Qwen 3.5 2B/4B shards fill every compatible Android fleet role',()=>{
 const {fleet}=boot('Mozilla/5.0 (Linux; Android 16; A069P)',8);
 const installed=[
  {family:'2b',importId:'local-2b-q4',model:'qwen35-2b-imported-gguf',label:'Qwen 3.5 2B',quantization:'Q4_K_M',bytes:1_300_000_000,importedAt:'2026-10-30',verified:true},
  {family:'4b',importId:'local-4b-q4',model:'qwen35-4b-imported-gguf',label:'Qwen 3.5 4B',quantization:'Q4_K_M',bytes:2_600_000_000,importedAt:'2026-10-31',verified:true}
 ];
 const assignments=fleet.matchImportedRoles(fleet.catalogue(),installed);
 assert.equal(Object.keys(assignments).length,5);
 assert.equal(assignments.swift.importId,'local-2b-q4');
 for(const role of ['archive','forge','quill','atlas']){
  assert.equal(assignments[role].importId,'local-4b-q4');
  assert.equal(assignments[role].quantization,'Q4_K_M');
 }
 assert.equal(new Set(Object.values(assignments).map(item=>item.importId)).size,2,'Reuse imports across roles; no duplicate weights');
});
test('Missing/damaged shards never bind, and a smaller fleet never binds hidden 4B roles',()=>{
 const {fleet}=boot('Mozilla/5.0 (Linux; Android 16; A069P)',8);
 const rows=fleet.catalogue();
 const installed=[
  {family:'2b',importId:'valid-2b',model:'qwen35-2b-imported-gguf',verified:true},
  {family:'4b',importId:'bad-4b',model:'qwen35-4b-imported-gguf',verified:false}
 ];
 const assigned=fleet.matchImportedRoles(rows,installed);
 assert.deepEqual(Object.keys(assigned),['swift']);
 fleet.setMemoryBudget(4);
 assert.deepEqual(Object.keys(fleet.matchImportedRoles(fleet.catalogue(),[
  ...installed,{family:'4b',importId:'valid-4b',model:'qwen35-4b-imported-gguf',verified:true}
 ])),['swift']);
});
test('Fleet browser runtime keeps role selections transient and blocks unintended remote inference',()=>{
 const runtime=fs.readFileSync(new URL('../public/app/shared/civweave-model-runtime.js',import.meta.url),'utf8');
 const gguf=fs.readFileSync(new URL('../public/app/local-ai/browser-gguf-v1.js',import.meta.url),'utf8');
 assert.match(runtime,/const fleetBinding=fleetBindingFor\(request,config\)/);
 assert.match(runtime,/config\.ggufImportId=fleetBinding\.importId/);
 assert.match(runtime,/selectedGGUF\.source==='file'\?selectedGGUF\.importId:undefined/);
 assert.match(runtime,/if\(!selectedEmbeddedGGUF\(config\)\)return null/);
 assert.match(gguf,/export async function installedImports\(/);
 assert.match(gguf,/if\(verify\)await blobsFor\(record\)/);
 assert.match(gguf,/importId\?selectionForImported\(importId\):current\(\)/);
});

test('Only the three proven local configuration paths are rendered by the fleet',()=>{
 assert.match(source,/const BACKENDS=Object\.freeze\(\{/);
 for(const key of ['browser','termux','android'])assert.match(source,new RegExp(key+':\\{label:'));
 assert.match(source,/data-ai-fleet-backend/);
 assert.match(source,/data-ai-fleet-inventory/);
 assert.match(source,/data-ai-fleet-role-assign/);
 assert.match(source,/data-ai-fleet-open-termux/);
 assert.match(source,/data-ai-fleet-open-starling/);
 assert.doesNotMatch(source,/data-ai-fleet-backend="ollama"/);
});
test('Manually unassigned roles stay unassigned across re-scans of 2B and 4B',()=>{
 const {fleet}=boot('Mozilla/5.0 (Linux; Android 16; A069P)',8);
 const installed=[
  {family:'2b',importId:'saved-2b',model:'qwen35-2b-imported-gguf',verified:true},
  {family:'4b',importId:'saved-4b',model:'qwen35-4b-imported-gguf',verified:true}
 ];
 const auto=fleet.fleetRolesFor(installed);
 assert.equal(auto.swift.importId,'saved-2b');
 assert.equal(auto.atlas.importId,'saved-4b');
 const manual=fleet.fleetRolesFor(installed,{roles:auto,unassigned:['atlas']});
 assert.equal(manual.atlas,undefined);
 assert.equal(manual.forge.importId,'saved-4b');
});

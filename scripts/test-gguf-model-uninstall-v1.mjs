// Contract: uninstalling one Civweave browser import must preserve other GGUF imports.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const [source,opfsSource,fleetSource]=await Promise.all([
  readFile('public/app/local-ai/browser-gguf-v1.js','utf8'),
  readFile('public/app/local-ai/browser-gguf-opfs-v1.js','utf8'),
  readFile('public/app/shared/civweave-ai-fleet-v1.js','utf8')
]);
assert.match(source,/export async function uninstallImported\(/);
assert.match(opfsSource,/export async function deleteGGUFShards\(/);
assert.match(fleetSource,/data-ai-fleet-uninstall/);
assert.match(fleetSource,/gguf\.uninstallImported\(/);

const indexKey='civweave.mobile.gguf.import-index.v1';
const selectionKey='civweave.mobile.gguf-primary.v2';
const rows={
 'file-aaaabbbb':{schema:'civweave.gguf.import.v1',storage:'civweave.gguf.import-opfs.v1',
   importId:'file-aaaabbbb',model:'qwen35-4b-imported-gguf',label:'Qwen 3.5 4B',
   bytes:2741000000,sourceNames:['Qwen3.5-4B-Q4_K_M.gguf'],files:[{index:0,size:1400000000},{index:1,size:1341000000}]},
 'file-ccccdddd':{schema:'civweave.gguf.import.v1',storage:'civweave.gguf.import-opfs.v1',
   importId:'file-ccccdddd',model:'qwen35-4b-imported-gguf',label:'Qwen 3.5 4B',
   bytes:2741000000,sourceNames:['Qwen3.5-4B-Q4_K_M.gguf'],files:[{index:0,size:1400000000},{index:1,size:1341000000}]}
};
const values=new Map([[indexKey,JSON.stringify(rows)],
 [selectionKey,JSON.stringify({enabled:true,engine:'wllama',model:'qwen35-4b-imported-gguf',
  source:'file',url:'civweave-gguf-import:file-aaaabbbb',importId:'file-aaaabbbb'})]]);
globalThis.localStorage={
 getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),
 removeItem:key=>values.delete(key)
};
globalThis.__ggufDeleteTest={calls:[],fail:false};
const store=`export async function deleteGGUFShards(importId,indexes){
  const s=globalThis.__ggufDeleteTest;
  if(s.fail)throw Error('Simulated storage failure');
  s.calls.push({importId,indexes});
  return indexes.length;
}`;
const mockUri='data:text/javascript;base64,'+Buffer.from(store).toString('base64');
const loaded=source.replace(/const OPFS='[^']+';/,`const OPFS=${JSON.stringify(mockUri)};`);
assert.notEqual(loaded,source,'OPFS mock must be inserted');
const gguf=await import('data:text/javascript;base64,'+Buffer.from(loaded).toString('base64'));

const removed=await gguf.uninstallImported('file-aaaabbbb');
assert.equal(removed.importId,'file-aaaabbbb');
assert.equal(removed.bytes,2741000000);
assert.equal(removed.wasPrimary,true);
assert.equal(gguf.current(),null,'deleted active import must no longer be the primary');
assert.deepEqual(globalThis.__ggufDeleteTest.calls,[{importId:'file-aaaabbbb',indexes:[0,1]}]);
assert.deepEqual((await gguf.installedImports({verify:false})).map(x=>x.importId),['file-ccccdddd'],
  'a second import with the same model family must survive');
await assert.rejects(gguf.uninstallImported('file-aaaabbbb'),/not found|already removed/i);
globalThis.__ggufDeleteTest.fail=true;
await assert.rejects(gguf.uninstallImported('file-ccccdddd'),/Simulated storage failure/);
assert.ok(JSON.parse(values.get(indexKey))['file-ccccdddd'],
  'failed shard deletion must retain the manifest so it can be retried');

console.log('GGUF uninstall: exact import only, primary cleanup, retryable errors, and duplicates preserved.');

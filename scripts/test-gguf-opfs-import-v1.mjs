import assert from 'node:assert/strict';
import {
  GGUF_OPFS_SCHEMA,GGUF_OPFS_CHUNK_BYTES,
  directory,checkCapacity,writeGGUFShard,readGGUFShards,removeGGUFShards
} from '../public/app/local-ai/browser-gguf-opfs-v1.js';

const saved=new Map(),handles=new Map();
const dir={
  async getFileHandle(name,opts={}){
    if(!handles.has(name)){
      if(!opts.create)throw Object.assign(new Error('NotFound'),{name:'NotFoundError'});
      handles.set(name,{
        async createWritable(){
          const parts=[];
          return {
            async write(blob){assert.ok(blob.size<=GGUF_OPFS_CHUNK_BYTES);parts.push(blob)},
            async close(){saved.set(name,new Blob(parts,{type:'application/octet-stream'}))},
            async abort(){parts.length=0}
          };
        },
        async getFile(){
          if(!saved.has(name))throw Error('Uncommitted file');
          return saved.get(name);
        }
      });
    }
    return handles.get(name);
  },
  async removeEntry(name){saved.delete(name);handles.delete(name)}
};
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{
  storage:{
    async getDirectory(){return{async getDirectoryHandle(name,{create}){assert.equal(name,'civweave-gguf-imports-v1');assert.ok(create);return dir}}},
    async estimate(){return{quota:10_000_000_000,usage:200_000_000}}
  }
}});
const opfs=await directory();
assert.equal(opfs,dir);
const pieces=[new Uint8Array([71,71,85,70]),new Uint8Array(GGUF_OPFS_CHUNK_BYTES),
              new Uint8Array(GGUF_OPFS_CHUNK_BYTES),new Uint8Array(18)];
const data=new Blob(pieces);
const total=data.size;
const id='file-test-gguf-opfs-1',updates=[];
const result=await writeGGUFShard(opfs,id,0,data,{onProgress:row=>updates.push(row)});
assert.equal(result.size,total);
assert.equal(updates.length,3);
assert.equal(updates[0].written,GGUF_OPFS_CHUNK_BYTES);
assert.equal(updates.at(-1).written,total);
assert.deepEqual(updates.map(x=>x.part),[1,2,3]);
const record={storage:GGUF_OPFS_SCHEMA,importId:id,files:[result]};
const read=await readGGUFShards(record);
assert.equal(read.length,1);
assert.equal(read[0].size,total);
const original=Buffer.from(await data.arrayBuffer());
const copy=Buffer.from(await read[0].arrayBuffer());
assert.ok(original.equals(copy),'OPFS must preserve every GGUF source byte');
await checkCapacity(total);
const controller=new AbortController(),cancelled='file-test-gguf-opfs-2';
await assert.rejects(writeGGUFShard(opfs,cancelled,0,data,{
  signal:controller.signal,onProgress:()=>controller.abort()
}),/Import cancelled/);
assert.equal(saved.size,1,'Canceled write must not leave an OPFS shard behind.');
const quota=navigator.storage.estimate;
navigator.storage.estimate=async()=>({quota:100_000_000,usage:95_000_000});
await assert.rejects(checkCapacity(total),/Not enough browser storage/);
navigator.storage.estimate=quota;
navigator.storage.estimate=undefined;
const withoutEstimate=await checkCapacity(total);
assert.equal(withoutEstimate.requiredBytes,total);
navigator.storage.estimate=quota;
await removeGGUFShards(id,[0]);
assert.equal(saved.size,0);
console.log('OPFS GGUF streaming regression passed: 8MiB progress, byte-preserving readback, cancel cleanup, and storage quota checks.');

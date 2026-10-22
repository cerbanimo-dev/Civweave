import assert from 'node:assert/strict';
import {planGGUFSplit,shardFromPlan,splitName} from '../public/app/local-ai/gguf-split-browser-v1.js';
const u=(n,bytes)=>{
  const array=new Uint8Array(bytes),view=new DataView(array.buffer);
  if(bytes===4)view.setUint32(0,n,true);else view.setBigUint64(0,BigInt(n),true);
  return array;
};
const encoder=new TextEncoder();
const str=s=>[u(encoder.encode(s).length,8),encoder.encode(s)];
const parts=[encoder.encode('GGUF'),u(3,4),u(6,8),u(2,8),
  ...str('general.alignment'),u(4,4),u(32,4),
  ...str('tokenizer.ggml.tokens'),u(9,4),u(8,4),u(2,8),...str('hello'),...str('world')
];
const individualBytes=18_000_000;
for(let i=0;i<6;i++){
  parts.push(...str('blk.'+i+'.weight'),u(2,4),u(512,8),u(4096,8),u(2,4),u(i*individualBytes,8));
}
const prefix=parts.reduce((a,p)=>a+p.length,0);
parts.push(new Uint8Array((32-prefix%32)%32));
const kilobyte=new Uint8Array(1_000_000);
for(let i=0;i<6;i++){
  kilobyte.fill(i+17);
  for(let block=0;block<18;block++)parts.push(kilobyte.slice());
}
const file=new Blob(parts,{type:'application/octet-stream'});
const originalName='Qwen3.5-4B-Q4_K_M.gguf';
const plan=await planGGUFSplit(file,{maxShardBytes:54_000_000});
assert.equal(plan.nTensors,6);
assert.equal(plan.groups.length,2);
assert.equal(plan.metadata.length,2);
assert.equal(plan.metadataBytes>0,true);
assert.equal(plan.dataStart%32,0);
for(let shardNo=0;shardNo<plan.groups.length;shardNo++){
  const shard=shardFromPlan(plan,shardNo);
  const name=splitName(originalName,shardNo,plan.groups.length);
  assert.match(name,/Qwen3.5-4B-Q4_K_M-0000[12]-of-00002.gguf/);
  assert.ok(shard.size<2_000_000_000);
  assert.deepEqual([...new Uint8Array(await shard.slice(0,4).arrayBuffer())],[71,71,85,70]);
  const view=new DataView(await shard.slice(4,24).arrayBuffer());
  assert.equal(view.getUint32(0,true),3);
  assert.equal(Number(view.getBigUint64(4,true)),3);
  assert.equal(Number(view.getBigUint64(12,true)),shardNo===0?5:3);
  // The last 18MB tensor payload must be an exact byte-for-byte copy;
  // splitting never requantizes or mutates original weights.
  assert.deepEqual(new Uint8Array(await shard.slice(shard.size-64).arrayBuffer()),
    new Uint8Array(await file.slice(plan.dataStart+(shardNo*3+2)*individualBytes+(individualBytes-64)).arrayBuffer()));
}
await assert.rejects(planGGUFSplit(file,{maxShardBytes:10_000_000}),/unsafe GGUF shard size/);
console.log('Lossless on-device GGUF splitter test passed: valid shard headers, split metadata, tensor boundaries and identical Q4 payload bytes.');

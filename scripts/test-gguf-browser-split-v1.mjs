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
    new Uint8Array(await file.slice(plan.dataStart+(shardNo*3+2)*individualBytes+(individualBytes-64),plan.dataStart+(shardNo*3+3)*individualBytes).arrayBuffer()));
}
await assert.rejects(planGGUFSplit(file,{maxShardBytes:10_000_000}),/unsafe GGUF shard size/);
// Reproduce Qwen3.5 4B's Q6_K token embedding without allocating gigabytes:
// 2560 * 248320 Q6_K elements = 521,472,000 bytes (210 bytes / 256 elements).
// This metadata-only virtual file mimics an otherwise valid 2.7GB GGUF.
// The former 480MB cap incorrectly rejected its token_embd.weight tensor.
const qwenParts=[encoder.encode('GGUF'),u(3,4),u(3,8),u(1,8),
  ...str('general.alignment'),u(4,4),u(32,4)];
for(const [name,offset] of [
  ['token_embd.weight',0],
  ['blk.0.attn_qkv.weight',521_472_000],
  ['blk.0.ffn_down.weight',1_600_000_000]
]){
  qwenParts.push(...str(name),u(2,4),u(2560,8),u(248320,8),u(14,4),u(offset,8));
}
const qwenHeaderSize=qwenParts.reduce((size,part)=>size+part.length,0);
const qwenAlignedHeader=Math.ceil(qwenHeaderSize/32)*32;
const qwenHeader=new Blob([...qwenParts,new Uint8Array(1_048_576-qwenHeaderSize)]);
const sparseQwenFile={
  size:qwenAlignedHeader+2_700_000_000,
  slice(start,end){
    if(start!==0||end>1_048_576)throw Error('Large Qwen regression reads only its header');
    return qwenHeader.slice(start,end);
  }
};
const qwenPlan=await planGGUFSplit(sparseQwenFile);
assert.equal(qwenPlan.groups.length,2,'Realistic Qwen 4B embedding should fit in two <= 1.8GB shards.');
assert.equal(qwenPlan.groups[0][0].name,'token_embd.weight');
assert.equal(qwenPlan.groups[0][0].length,521_472_000);
assert.equal(qwenPlan.groups[0].reduce((n,t)=>n+t.length,0),1_600_000_000);
assert.ok(qwenPlan.groups.every(g=>g.reduce((n,t)=>n+t.length,0)<=1_800_000_000));
await assert.rejects(
  planGGUFSplit(sparseQwenFile,{maxShardBytes:480_000_000}),
  /single tensor token_embd\.weight is 521\.5 MB; max safe shard payload is 480\.0 MB/
);

console.log('Lossless on-device GGUF splitter test passed: valid shard headers, split metadata, tensor boundaries and identical Q4 payload bytes.');

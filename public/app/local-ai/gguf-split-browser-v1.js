// Tensor-aligned, lossless GGUF shard creation. Runs on Blob slices, never in LLM memory.
const MAGIC=[71,71,85,70],ENC=new TextEncoder();
const FIXED=Object.freeze({0:1,1:1,2:2,3:2,4:4,5:4,6:4,7:1,10:8,11:8,12:8});
const MAX_METADATA=200_000_000,MAX_TENSORS=100_000,MAX_SPLITS=64;
const fail=message=>{throw new Error('GGUF_SPLIT: '+message)};
const align=(n,to)=>Math.ceil(n/to)*to;
const le=(value,n)=>{const a=new Uint8Array(n),v=new DataView(a.buffer);if(n===2)v.setUint16(0,value,true);if(n===4)v.setUint32(0,value,true);if(n===8)v.setBigUint64(0,BigInt(value),true);return a};
const str=value=>{const bytes=ENC.encode(value);return[le(bytes.length,8),bytes]};
const kv=(name,type,value)=>[...str(name),le(type,4),le(value,type===2?2:4)];
class Cursor{
  constructor(file){this.file=file;this.pos=0;this.base=-1;this.buf=null}
  async bytes(n){
    if(n>16_777_216||this.pos+n>this.file.size)fail('truncated GGUF header');
    if(!this.buf||this.pos<this.base||this.pos+n>this.base+this.buf.length){
      const length=Math.min(this.file.size-this.pos,Math.max(1_048_576,n));
      this.buf=new Uint8Array(await this.file.slice(this.pos,this.pos+length).arrayBuffer());this.base=this.pos;
    }
    const start=this.pos-this.base;this.pos+=n;return this.buf.subarray(start,start+n);
  }
  async uint(n){const b=await this.bytes(n),v=new DataView(b.buffer,b.byteOffset,b.byteLength);return n===1?v.getUint8(0):n===2?v.getUint16(0,true):n===4?v.getUint32(0,true):Number(v.getBigUint64(0,true))}
  async name(){const len=await this.uint(8);if(!Number.isSafeInteger(len)||len>10_000_000)fail('invalid GGUF string length');return new TextDecoder().decode(await this.bytes(len))}
  skip(n){if(!Number.isSafeInteger(n)||n<0||this.pos+n>this.file.size)fail('truncated GGUF value');this.pos+=n}
  async skipValue(type){
    if(Object.hasOwn(FIXED,type)){this.skip(FIXED[type]);return}
    if(type===8){const n=await this.uint(8);this.skip(n);return}
    if(type===9){
      const inner=await this.uint(4),count=await this.uint(8);
      if(!Number.isSafeInteger(count)||count>100_000_000)fail('GGUF array too large');
      if(Object.hasOwn(FIXED,inner)){this.skip(FIXED[inner]*count);return}
      if(inner!==8)fail('invalid nested GGUF array type');
      for(let i=0;i<count;i++){const n=await this.uint(8);this.skip(n)}return;
    }
    fail('unsupported GGUF value type '+type);
  }
}
export async function planGGUFSplit(file,{maxShardBytes=480_000_000}={}){
  if(!file?.slice||!Number.isSafeInteger(file.size)||file.size<40)fail('not a readable GGUF file');
  if(maxShardBytes<50_000_000||maxShardBytes>1_900_000_000)fail('unsafe GGUF shard size');
  const cur=new Cursor(file),magic=await cur.bytes(4);
  if(!MAGIC.every((value,i)=>magic[i]===value))fail('not a GGUF model');
  const version=await cur.uint(4);if(version!==3)fail('only GGUF v3 can be split safely in the browser');
  const nTensors=await cur.uint(8),nMeta=await cur.uint(8);
  if(!Number.isSafeInteger(nTensors)||nTensors<1||nTensors>MAX_TENSORS||!Number.isSafeInteger(nMeta)||nMeta>300_000)fail('invalid GGUF counts');
  const metadata=[];let alignment=32;
  for(let i=0;i<nMeta;i++){
    const start=cur.pos,key=await cur.name(),type=await cur.uint(4);
    if(key==='split.no'||key==='split.count'||key==='split.tensors.count')fail('GGUF is already split; select all existing shards');
    if(key==='general.alignment'){if(type!==4)fail('invalid GGUF alignment type');alignment=await cur.uint(4)}
    else await cur.skipValue(type);
    metadata.push({start,end:cur.pos});
    if(cur.pos>MAX_METADATA)fail('metadata too large for safe phone splitting');
  }
  if(alignment<8||alignment>4096||(alignment&(alignment-1)))fail('invalid tensor alignment');
  const tensorMeta=[];
  for(let i=0;i<nTensors;i++){
    const start=cur.pos,name=await cur.name(),dims=await cur.uint(4);
    if(dims<1||dims>4||!name)fail('invalid GGUF tensor descriptor');
    cur.skip(dims*8);await cur.uint(4);
    const offsetPos=cur.pos,offset=await cur.uint(8);
    tensorMeta.push({name,start,offsetPos,offset});
  }
  const dataStart=align(cur.pos,alignment),totalData=file.size-dataStart;
  if(dataStart>MAX_METADATA||totalData<0)fail('GGUF tensor table is malformed');
  const sorted=[...tensorMeta].sort((a,b)=>a.offset-b.offset);
  if(sorted[0].offset!==0)fail('tensors do not start at offset zero');
  const lengths=new Map();
  for(let i=0;i<sorted.length;i++){
    const end=i+1<sorted.length?sorted[i+1].offset:totalData,n=end-sorted[i].offset;
    if(n<=0||n>maxShardBytes||sorted[i].offset%alignment!==0||n%alignment!==0)fail('tensor offsets are invalid or a tensor is too large to split: '+sorted[i].name);
    lengths.set(sorted[i],n);
  }
  const groups=[];let current=[],size=0;
  for(const entry of tensorMeta){
    const n=lengths.get(entry);if(!n)fail('bad GGUF tensor offset');
    if(current.length&&size+n>maxShardBytes){groups.push(current);current=[];size=0}
    current.push({...entry,length:n});size+=n;
  }
  if(current.length)groups.push(current);
  if(groups.length>MAX_SPLITS||groups.length<2)fail('GGUF shard count is unsuitable');
  const metadataBytes=metadata.reduce((sum,m)=>sum+m.end-m.start,0);
  if(metadataBytes>MAX_METADATA)fail('GGUF metadata too large');
  return{file,version,nTensors,nMeta,metadata,metadataBytes,alignment,dataStart,groups,totalBytes:file.size,maxShardBytes};
}
export function splitName(name,index,count){return String(name).replace(/\.gguf$/i,'')+'-'+String(index+1).padStart(5,'0')+'-of-'+String(count).padStart(5,'0')+'.gguf'}
export function shardFromPlan(plan,index){
  const {file,version,nTensors,nMeta,metadata,alignment,dataStart,groups}=plan,group=groups[index];
  if(!group)fail('invalid shard index');
  const parts=[new Uint8Array(MAGIC),le(version,4),le(group.length,8),le((index===0?nMeta:0)+3,8)];
  if(index===0)for(const m of metadata)parts.push(file.slice(m.start,m.end));
  parts.push(...kv('split.no',2,index),...kv('split.count',2,groups.length),...kv('split.tensors.count',5,nTensors));
  let offset=0;
  for(const tensor of group){parts.push(file.slice(tensor.start,tensor.offsetPos),le(offset,8));offset+=tensor.length}
  const metaSize=parts.reduce((sum,p)=>sum+(p.byteLength??p.size),0);
  parts.push(new Uint8Array(align(metaSize,alignment)-metaSize));
  for(const tensor of group)parts.push(file.slice(dataStart+tensor.offset,dataStart+tensor.offset+tensor.length));
  const shard=new Blob(parts,{type:'application/octet-stream'});
  if(shard.size>2_000_000_000)fail('generated shard exceeds browser engine per-file limit');
  return shard;
}

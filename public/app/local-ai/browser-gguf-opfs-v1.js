// Civweave GGUF origin-private storage. Bounded writes avoid multi-GB Cache.put stalls.
// The FileSystemFileHandle.getFile() result remains a native disk-backed File;
// Wllama receives GGUF shards directly without reconstructing a 2.7 GB Blob in JS.
export const GGUF_OPFS_SCHEMA='civweave.gguf.import-opfs.v1';
export const GGUF_OPFS_CHUNK_BYTES=8*1024*1024;
const ROOT='civweave-gguf-imports-v1';
const MAGIC=[71,71,85,70];
const problem=(code,message)=>Object.assign(new Error(message),{code});
const checkSignal=signal=>{if(signal?.aborted)throw problem('GGUF_IMPORT_CANCELLED','Import cancelled. Original GGUF in Downloads is untouched.')};
const filename=(id,index)=>{
  if(!/^file-[a-z0-9-]{8,72}$/i.test(String(id||''))||
     !Number.isSafeInteger(index)||index<0||index>128)
    throw problem('GGUF_IMPORT_INDEX','Invalid browser GGUF storage identifier.');
  return String(id)+'-'+String(index).padStart(5,'0')+'.gguf';
};
export async function directory(){
  if(!globalThis.navigator?.storage?.getDirectory)
    throw problem('GGUF_OPFS_UNAVAILABLE','This browser does not support origin-private file storage. Try Android Chrome or an updated Chromium browser. No model weights were changed.');
  const root=await navigator.storage.getDirectory();
  return root.getDirectoryHandle(ROOT,{create:true});
}
export async function checkCapacity(total){
  if(!Number.isSafeInteger(total)||total<1)throw problem('GGUF_IMPORT_SIZE','Invalid GGUF import size.');
  const info=await globalThis.navigator?.storage?.estimate?.()?.catch(()=>null);
  const available=Number(info?.quota)-Number(info?.usage);
  if(Number.isFinite(available)&&Number(info?.quota)>0&&available<total+64*1024*1024)
    throw problem('GGUF_STORAGE_FULL','Not enough browser storage for this exact GGUF. About '+(total/1e9).toFixed(2)+' GB is required, but only '+Math.max(0,available/1e9).toFixed(2)+' GB is available. Free browser storage without deleting the original Downloads file.');
  return{availableBytes:Number.isFinite(available)?Math.max(0,available):null,requiredBytes:total};
}
const verifyHeader=async file=>{
  const header=new Uint8Array(await file.slice(0,4).arrayBuffer());
  if(header.length!==4||MAGIC.some((byte,i)=>byte!==header[i]))
    throw problem('GGUF_IMPORT_DAMAGED','An imported shard is missing the GGUF file header.');
};
export async function writeGGUFShard(dir,importId,index,file,{signal,onProgress=()=>{}}={}){
  checkSignal(signal);
  if(!file?.slice||!Number.isSafeInteger(file.size)||file.size<24||file.size>2_000_000_000)
    throw problem('GGUF_SHARD_TOO_LARGE','An imported shard has an invalid size for this browser engine.');
  await verifyHeader(file);
  const name=filename(importId,index);
  const handle=await dir.getFileHandle(name,{create:true});
  let stream=null,committed=false;
  try{
    stream=await handle.createWritable();
    for(let start=0;start<file.size;start+=GGUF_OPFS_CHUNK_BYTES){
      checkSignal(signal);
      const end=Math.min(start+GGUF_OPFS_CHUNK_BYTES,file.size);
      await stream.write(file.slice(start,end));
      checkSignal(signal);
      onProgress({written:end,size:file.size,part:Math.ceil(end/GGUF_OPFS_CHUNK_BYTES),parts:Math.ceil(file.size/GGUF_OPFS_CHUNK_BYTES)});
    }
    checkSignal(signal);
    await stream.close();stream=null;committed=true;
    const result=await handle.getFile();
    if(result.size!==file.size)throw problem('GGUF_OPFS_SIZE_MISMATCH','Written GGUF shard length does not match original input.');
    await verifyHeader(result);
    return{name,index,size:file.size};
  }catch(error){
    if(stream)try{await stream.abort()}catch{}
    if(!committed)try{await dir.removeEntry(name)}catch{}
    if(error?.name==='QuotaExceededError'||error?.code===22)
      throw problem('GGUF_STORAGE_FULL','Browser storage quota was exceeded during the GGUF import. Existing Downloads file remains unchanged.');
    throw error;
  }
}
export async function readGGUFShards(record){
  if(!record||record.storage!==GGUF_OPFS_SCHEMA||
      !Array.isArray(record.files)||record.files.length<1)
    throw problem('GGUF_OPFS_RECORD','The saved browser GGUF model manifest is invalid.');
  const dir=await directory(),blobs=[];
  for(const item of record.files){
    let handle;
    try{handle=await dir.getFileHandle(filename(record.importId,item.index))}
    catch{throw problem('GGUF_OPFS_MISSING','An imported GGUF shard is missing from browser storage. Re-import the original file.')}
    const file=await handle.getFile();
    if(file.size!==item.size)throw problem('GGUF_OPFS_DAMAGED','An imported GGUF shard differs in size from the saved manifest.');
    await verifyHeader(file);
    blobs.push(file);
  }
  return blobs;
}
export async function removeGGUFShards(importId,indexes,{strict=false}={}){
  let dir;
  try{dir=await directory()}catch(error){if(strict)throw error;return}
  for(const index of indexes){
    try{await dir.removeEntry(filename(importId,index))}
    catch(error){if(strict&&error?.name!=='NotFoundError')throw error}
  }
}

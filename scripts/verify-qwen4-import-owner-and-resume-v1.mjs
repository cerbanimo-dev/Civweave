import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(path,'utf8');
const direct=read('public/app/settings-local-models-direct-v325.js');
const full=read('public/app/settings-local-route-v331.js');
const fallback=read('public/app/settings-local-route-v327.js');
const alias=read('public/app/settings-local-route-v323.js');
assert.equal(full,fallback,'working settings route and fallback must be identical');
assert.equal(full,alias,'compatibility route must not clear model picker either');
const func=(source,start,end)=>{const i=source.indexOf(start),j=source.indexOf(end,i+start.length);assert(i>=0&&j>i,'missing real source function '+start);return source.slice(i,j)};
const directFn=func(direct,'async function importPhoneQwenDirect(event){',"document.addEventListener('change',event=>void importPhoneQwenDirect");
const fullFn=func(full,'async function importPhoneQwen(event,panel){','async function localAction(event,panel){');
const selected={name:'Qwen3.5-4B_mixed_int4.litertlm',size:2754070624};
function chooser(owner){
  let value='chosen-file';let files=[selected];
  return {
    dataset:{localPhoneImport:'qwen35-4b-litert-web'},
    get files(){return files},
    set value(next){value=next;if(next==='')files=[]},
    get value(){return value},
    closest(sel){
      if(sel==='input[data-local-phone-import]')return this;
      if(sel==='#cw-local-models-direct-v325')return owner==='direct'?this:null;
      return null;
    }
  };
}
const directMessages=[];
const directCtx={
  console,Date,
  PANEL_ID:'cw-local-models-direct-v325',
  phoneImportInFlight:false,
  status:(layer,msg,err)=>directMessages.push({msg,err}),
  phoneImportRecord:()=>{},
  document:{getElementById:()=>({})},
  ensureScript:async()=>{throw Error('stopped intentionally after picker was accepted')},
  ACTION_FILES:[['registry',()=>true],['manager',()=>true]]
};
vm.createContext(directCtx);vm.runInContext(directFn+'\nthis.runDirect=importPhoneQwenDirect;',directCtx);
const v324Input=chooser('full');
await directCtx.runDirect({target:v324Input});
assert.equal(v324Input.value,'chosen-file','v325 document-capture handler must not clear a v324 picker');
assert.equal(v324Input.files.length,1,'v324 file must survive earlier document-capture listener');
assert.equal(directMessages.length,0,'v325 must not act on another panel');
const messages=[],records=[];
const fullCtx={
  console,Date,
  phoneImportInFlight:false,
  CATALOGUE:[{id:'qwen35-4b-litert-web',artifact:selected.name,estimatedBytes:selected.size,nativeImport:true}],
  writable:()=>true,
  showLocal:(msg,error)=>messages.push({msg,error}),
  recordPhoneImport:(...args)=>records.push(args),
  afterPaint:async()=>{throw Error('stopped intentionally after full picker started')}
};
vm.createContext(fullCtx);vm.runInContext(fullFn+'\nthis.runFull=importPhoneQwen;',fullCtx);
await fullCtx.runFull({target:v324Input},{contains:input=>input===v324Input});
assert.equal(v324Input.files.length,0,'owning full handler consumes the picker exactly once');
assert.ok(messages.some(v=>v.msg.includes('Importing Qwen 4B')),'full handler must enter import after capture listener returns');
assert.equal(records[0][0],'importing','full handler records durable progress');
assert.equal(records.at(-1)[0],'error','import error remains visible and restartable');
assert.equal(fullCtx.phoneImportInFlight,false,'lock released after error');
const v325Input=chooser('direct');
await directCtx.runDirect({target:v325Input});
assert.equal(v325Input.files.length,0,'direct owner still processes its own input');
assert.ok(directMessages.some(m=>m.msg.includes('Importing Qwen 4B')),'direct route must start its own visible progress');
assert.equal(directCtx.phoneImportInFlight,false);
assert.match(full,/ACTION_FILES\.slice\(0,2\)/,'import must not hydrate the seven-file pack stack');
assert.match(direct,/ACTION_FILES\.slice\(0,2\)/,'direct importer must not hydrate pack stack');
assert.match(full,/data-qwen-phone-import-progress/,'full route must display saved/import interrupted status');
assert.match(direct,/data-qwen-phone-import-progress/,'direct route must display saved/import interrupted status');
// Validate that the actual 8 MiB cache importer produces a commit manifest,
// loads fragments sequentially, and can resume without rewriting verified ones.
const {importChunkedFile,chunkedStatus,chunkedResponse,CHUNK_BYTES}=await import('../public/app/local-ai/llama32-chunked-model-storage-v1.js');
const entries=new Map();let writes=0;
const cache={
  async match(url){const data=entries.get(String(url));return data?.clone()||undefined},
  async put(url,response){entries.set(String(url),response.clone());writes++},
  async delete(url){return entries.delete(String(url))}
};
const size=CHUNK_BYTES*2+17;
const blob=new Blob([new Uint8Array(size)]);
const url='https://huggingface.co/litert-community/Qwen3.5-4B/resolve/main/Qwen3.5-4B_mixed_int4.litertlm';
const progress=[];
let result=await importChunkedFile(cache,url,blob,{onProgress:p=>progress.push(p)});
assert.equal(result.available,true);assert.equal(result.chunks,3);
assert.equal(progress.length,3);
assert.equal((await chunkedStatus(cache,url,size)).available,true);
const firstWrites=writes;
await importChunkedFile(cache,url,blob);
assert.equal(writes,firstWrites+1,'second import must reuse all three committed fragments and only refresh manifest');
const rsp=await chunkedResponse(cache,url,size);
assert.equal(Number(rsp.headers.get('content-length')),size);
assert.equal((await rsp.blob()).size,size);
console.log('PASS: direct capture does not consume v324 Qwen picker, full importer runs, errors persist, direct still works; 8MiB fragment import commits and resumes correctly.');

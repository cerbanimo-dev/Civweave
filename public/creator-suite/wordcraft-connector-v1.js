(()=>{
'use strict';
const ENDPOINT='http://127.0.0.1:47871';
const MAX_FILE_BYTES=8*1024*1024;
let connected=false, unregister=null, cadUnregister=null, activeFile=null, cadFile=null, available={}, token='';
function el(id){return document.getElementById(id);}
function status(message,good=false){const node=el('wordcraft-status');if(node){node.textContent=message;node.style.color=good?'#a9e6b4':'#f2ce7e';}}
function revoke(){connected=false;available={};if(unregister){unregister();unregister=null;}if(cadUnregister){cadUnregister();cadUnregister=null;}}
async function bridge(path,options={}){
  if(!token)throw new Error('Enter the token printed by your local bridge.');
  let response;
  try{
    response=await fetch(ENDPOINT+path,{...options,headers:{
      'Authorization':'Bearer '+token,
      ...(options.body?{'Content-Type':'application/json'}:{})
    },cache:'no-store'});
  }catch{
    throw new Error('Local WordCraft bridge unreachable. Open it on this computer and check browser localhost permissions and the allowed origin.');
  }
  let body;
  try{body=await response.json();}catch{throw new Error('WordCraft bridge returned an invalid response.');}
  if(!response.ok||body?.ok!==true)throw new Error(body?.error||('Bridge error: '+(body?.code||response.status)));
  return body;
}
function inputBytesToBase64(arrayBuffer){
  const bytes=new Uint8Array(arrayBuffer),chunk=8192,parts=[];
  for(let i=0;i<bytes.length;i+=chunk)parts.push(String.fromCharCode(...bytes.subarray(i,i+chunk)));
  return btoa(parts.join(''));
}
function decodeBase64(value){
  const str=atob(value),buffer=new Uint8Array(str.length);
  for(let i=0;i<str.length;i++)buffer[i]=str.charCodeAt(i);
  return buffer;
}
function download(name,mime,bytes){
  const url=URL.createObjectURL(new Blob([bytes],{type:mime}));
  const anchor=document.createElement('a');
  anchor.href=url;anchor.download=name;anchor.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function perform(action){
  if(!connected||!available.wordcraft)throw new Error('Connect to an installed WordCraft CLI first.');
  if(!activeFile)throw new Error('Select the document to process.');
  if(activeFile.size>MAX_FILE_BYTES)throw new Error('WordCraft MVP accepts files up to 8 MiB.');
  const {result}=await bridge('/v1/wordcraft',{method:'POST',body:JSON.stringify({
    action,name:activeFile.name,contentBase64:inputBytesToBase64(await activeFile.arrayBuffer())
  })});
  if(action==='pdf'){
    if(!result?.contentBase64||result.mime!=='application/pdf')throw new Error('WordCraft did not return a valid PDF response.');
    download(result.filename||'converted.pdf','application/pdf',decodeBase64(result.contentBase64));
    return {schema:result.schema,action,filename:result.filename,downloaded:true};
  }
  const text=action==='text'?result.text:JSON.stringify(result.structure,null,2);
  if(typeof text!=='string')throw new Error('WordCraft did not return document information.');
  el('wordcraft-output').textContent=text.slice(0,24000);
  return {schema:result.schema,action,text:text.slice(0,100000)};
}
async function performCadcraft(action){
  if(!connected||!available.cadcraft)throw new Error('Connect to an installed CADCraft CLI first.');
  if(!cadFile)throw new Error('Select a DXF or DWG drawing to process.');
  if(cadFile.size>MAX_FILE_BYTES)throw new Error('CADCraft MVP accepts drawings up to 8 MiB.');
  const {result}=await bridge('/v1/cadcraft',{method:'POST',body:JSON.stringify({
    action,name:cadFile.name,contentBase64:inputBytesToBase64(await cadFile.arrayBuffer())
  })});
  if(action==='svg'){
    if(!result?.contentBase64||result.mime!=='image/svg+xml')throw new Error('CADCraft did not return a valid SVG response.');
    download(result.filename||'drawing.svg','image/svg+xml',decodeBase64(result.contentBase64));
    return {schema:result.schema,action,filename:result.filename,downloaded:true};
  }
  if(typeof result?.details!=='string')throw new Error('CADCraft did not return drawing information.');
  el('cadcraft-output').textContent=result.details.slice(0,24000);
  return{schema:result.schema,action,details:result.details.slice(0,100000)};
}
function maybeRegister(){
  if(unregister){unregister();unregister=null;}
  if(cadUnregister){cadUnregister();cadUnregister=null;}
  if(!connected||!globalThis.CivweaveCreatorToolsV1)return;
  if(available.wordcraft&&activeFile){
    unregister=globalThis.CivweaveCreatorToolsV1.registerEditor('wordcraft',{
      actions:[
        {name:'inspect',description:'Inspect the currently selected document with installed WordCraft CLI; requires explicit user approval.'},
        {name:'text',description:'Extract text from the currently selected document; requires explicit user approval.'},
        {name:'pdf',description:'Export a PDF copy of the currently selected document; requires explicit user approval.'}
      ],
      execute:async(action,args,actor)=>{
        const identity=String(actor?.id||'unknown AI').slice(0,120);
        if(!window.confirm(identity+' requests WordCraft '+action+' on your selected file "'+activeFile.name+'". Allow this operation?')){
          throw new Error('WordCraft operation was not approved by the user.');
        }
        return await perform(action);
      }
    });
  }
  if(available.cadcraft&&cadFile){
    cadUnregister=globalThis.CivweaveCreatorToolsV1.registerEditor('cadcraft',{
      actions:[
        {name:'info',description:'Inspect the selected DXF or DWG drawing with CADCraft CLI; requires explicit approval.'},
        {name:'svg',description:'Export the selected DXF or DWG drawing to a new SVG; requires explicit approval.'}
      ],
      execute:async(action,args,actor)=>{
        const identity=String(actor?.id||'unknown AI').slice(0,120);
        if(!window.confirm(identity+' requests CADCraft '+action+' on your selected drawing "'+cadFile.name+'". Allow?')){
          throw new Error('CADCraft operation was not approved by the user.');
        }
        return await performCadcraft(action);
      }
    });
  }
}
async function connect(){
  revoke();
  token=el('wordcraft-token').value.trim();
  const body=await bridge('/v1/capabilities');
  available={wordcraft:Boolean(body.wordcraft?.installed),cadcraft:Boolean(body.cadcraft?.installed)};
  if(!available.wordcraft&&!available.cadcraft)throw new Error('Bridge is running, but neither wordcraft-cli nor cadcraft-cli is available on its PATH.');
  connected=true;maybeRegister();
  status('Local bridge connected. WordCraft '+(available.wordcraft?'available':'not installed')+'; CADCraft '+(available.cadcraft?'available':'not installed')+'.',true);
  if(el('cadcraft-status'))el('cadcraft-status').textContent=available.cadcraft?'CADCraft ready. Select a drawing.':'Install cadcraft-cli to use CAD drawing tools.';
}
function boot(){
  if(!el('wordcraft-connect'))return;
  el('wordcraft-connect').addEventListener('click',()=>connect().catch(e=>{revoke();status(e.message);}));
  el('wordcraft-token').addEventListener('input',()=>{revoke();token='';status('Token changed. Reconnect before processing.');});
  el('wordcraft-file').addEventListener('change',event=>{
    activeFile=event.target.files?.[0]||null;maybeRegister();
    if(activeFile)status('Selected '+activeFile.name+' ('+activeFile.size+' bytes). '+(connected?'Ready.':'Connect the bridge first.'),connected);
  });
  if(el('cadcraft-file'))el('cadcraft-file').addEventListener('change',event=>{
    cadFile=event.target.files?.[0]||null;maybeRegister();
    if(cadFile)el('cadcraft-status').textContent='Selected '+cadFile.name+' ('+cadFile.size+' bytes).';
  });
  if(el('cadcraft-run'))el('cadcraft-run').addEventListener('click',async()=>{
    const action=el('cadcraft-action').value;
    el('cadcraft-run').disabled=true;
    try{await performCadcraft(action);el('cadcraft-status').textContent=action==='svg'?'SVG drawing downloaded.':'Drawing inspected.';}
    catch(error){el('cadcraft-status').textContent=error.message;}
    finally{el('cadcraft-run').disabled=false;}
  });
  el('wordcraft-run').addEventListener('click',async()=>{
    const action=el('wordcraft-action').value;
    el('wordcraft-run').disabled=true;
    try{const output=await perform(action);status(action==='pdf'?'PDF copy exported locally.':'WordCraft '+action+' complete.',true);}
    catch(error){status(error.message);}
    finally{el('wordcraft-run').disabled=false;}
  });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();

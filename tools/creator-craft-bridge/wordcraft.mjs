import {spawn} from 'node:child_process';
import {mkdtemp,readFile,writeFile,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

export const MAX_INPUT_BYTES=8*1024*1024;
export const MAX_OUTPUT_BYTES=12*1024*1024;
const MAX_STDOUT_BYTES=2*1024*1024;
const ACTIONS=new Set(['inspect','text','pdf']);
const EXTENSIONS=new Set(['.docx','.odt','.rtf','.md','.txt']);

export class BridgeError extends Error {
  constructor(message,code='BRIDGE_ERROR',status=400){
    super(message);this.name='BridgeError';this.code=code;this.status=status;
  }
}
function validateRequest(request){
  if(!request||typeof request!=='object'||Array.isArray(request))throw new BridgeError('Invalid document request.','INVALID_REQUEST');
  const {action,name,contentBase64}=request;
  if(!ACTIONS.has(action))throw new BridgeError('Unsupported WordCraft action.','INVALID_ACTION');
  if(typeof name!=='string'||name.length>120||!/^[a-zA-Z0-9][a-zA-Z0-9 ._-]*\.[a-zA-Z0-9]+$/.test(name)||name.includes('..')){
    throw new BridgeError('File name is invalid.','INVALID_FILE');
  }
  const ext=name.slice(name.lastIndexOf('.')).toLowerCase();
  if(!EXTENSIONS.has(ext))throw new BridgeError('Unsupported WordCraft input format.','UNSUPPORTED_FORMAT');
  if(typeof contentBase64!=='string'||contentBase64.length===0||contentBase64.length>Math.ceil(MAX_INPUT_BYTES/3)*4+4||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(contentBase64)){
    throw new BridgeError('Invalid or oversized base64 document.','INVALID_CONTENT',413);
  }
  const bytes=Buffer.from(contentBase64,'base64');
  if(bytes.length===0||bytes.length>MAX_INPUT_BYTES)throw new BridgeError('Document exceeds 8 MiB limit.','FILE_TOO_LARGE',413);
  return{action,ext,bytes};
}
export async function callCli(args,{command=process.env.WORDCRAFT_CLI||'wordcraft-cli',prefixArgs=[],cwd,timeoutMs=60000,maxOutputBytes=MAX_STDOUT_BYTES}={}){
  if(!Array.isArray(args)||!Array.isArray(prefixArgs)||typeof command!=='string'||!command)throw new BridgeError('Invalid CLI configuration.','CLI_CONFIG',500);
  return await new Promise((resolve,reject)=>{
    let stdout=[],stderr=[],outSize=0,errSize=0,settled=false,child;
    const done=(err,out)=>{
      if(settled)return;settled=true;clearTimeout(timer);
      if(err)reject(err);else resolve(out);
    };
    try{child=spawn(command,[...prefixArgs,...args],{
      cwd, shell:false,windowsHide:true,stdio:['ignore','pipe','pipe'],
      env:{...process.env,WORDCRAFT_NO_PREFS:'1'}
    });}catch{reject(new BridgeError('WordCraft CLI could not start.','CLI_UNAVAILABLE',503));return;}
    const timer=setTimeout(()=>{child.kill();done(new BridgeError('WordCraft CLI timed out.','CLI_TIMEOUT',504));},timeoutMs);
    child.stdout.on('data',chunk=>{
      outSize+=chunk.length;
      if(outSize>maxOutputBytes){child.kill();return done(new BridgeError('WordCraft CLI response exceeded the output limit.','CLI_OUTPUT_LIMIT',413));}
      stdout.push(chunk);
    });
    child.stderr.on('data',chunk=>{errSize+=chunk.length;if(errSize<=4096)stderr.push(chunk);});
    child.on('error',()=>done(new BridgeError('WordCraft CLI executable is unavailable. Install wordcraft-cli and start the bridge again.','CLI_UNAVAILABLE',503)));
    child.on('close',code=>{
      if(code!==0)return done(new BridgeError('WordCraft CLI failed to process this document.','CLI_FAILED',422));
      done(null,Buffer.concat(stdout).toString('utf8'));
    });
  });
}
export async function checkInstalled(config={}){
  try{await callCli(['--version'],{...config,timeoutMs:5000,maxOutputBytes:2048});return true;}
  catch{return false;}
}
export async function executeWordcraft(request,cliConfig={}){
  const {action,ext,bytes}=validateRequest(request);
  const dir=await mkdtemp(join(tmpdir(),'civweave-wordcraft-'));
  const input=join(dir,'input'+ext),output=join(dir,'result.pdf');
  try{
    await writeFile(input,bytes,{flag:'wx',mode:0o600});
    if(action==='inspect'){
      const stdout=await callCli(['inspect',input],{...cliConfig,cwd:dir});
      let parsed;
      try{parsed=JSON.parse(stdout);}catch{throw new BridgeError('WordCraft inspection did not return valid JSON.','INVALID_CLI_RESPONSE',502);}
      return{schema:'civweave.craft-result.v1',tool:'wordcraft',action,structure:parsed};
    }
    if(action==='text'){
      const value=await callCli(['text',input],{...cliConfig,cwd:dir});
      return{schema:'civweave.craft-result.v1',tool:'wordcraft',action,text:value};
    }
    await callCli(['convert',input,output],{...cliConfig,cwd:dir});
    const metadata=await stat(output);
    if(!metadata.isFile()||metadata.size===0||metadata.size>MAX_OUTPUT_BYTES)throw new BridgeError('PDF export is missing or exceeds the output limit.','INVALID_EXPORT',502);
    const file=await readFile(output);
    if(file.subarray(0,5).toString('latin1')!=='%PDF-')throw new BridgeError('WordCraft output is not a PDF.','INVALID_EXPORT',502);
    return{schema:'civweave.craft-result.v1',tool:'wordcraft',action:'pdf',filename:request.name.replace(/\.[^.]+$/,'')+'.pdf',mime:'application/pdf',contentBase64:file.toString('base64')};
  }finally{await rm(dir,{recursive:true,force:true});}
}

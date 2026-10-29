import {mkdtemp,writeFile,readFile,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {callCli,BridgeError,MAX_INPUT_BYTES,MAX_OUTPUT_BYTES} from './wordcraft.mjs';
const KINDS=new Set(['.dxf','.dwg']);
function decode(request){
  if(!request||typeof request!=='object'||Array.isArray(request))throw new BridgeError('Invalid CAD request.','INVALID_REQUEST');
  if(!['info','svg'].includes(request.action))throw new BridgeError('Unsupported CADCraft action.','INVALID_ACTION');
  const name=request.name;
  if(typeof name!=='string'||name.length>120||!/^[A-Za-z0-9][A-Za-z0-9 ._-]*\.(dxf|dwg)$/i.test(name)||name.includes('..')){
    throw new BridgeError('Only drawing files with safe DXF or DWG names are accepted.','INVALID_FILE');
  }
  const encoded=request.contentBase64;
  if(typeof encoded!=='string'||!encoded||encoded.length>Math.ceil(MAX_INPUT_BYTES/3)*4+4||encoded.length%4){
    throw new BridgeError('Invalid or oversized CAD document.','INVALID_CONTENT',413);
  }
  for(let i=0,pad=false;i<encoded.length;i++){
    const code=encoded.charCodeAt(i);
    if(code===61){if(i<encoded.length-2)throw new BridgeError('Invalid base64 padding.','INVALID_CONTENT');pad=true;}
    else if(pad||!((code>=65&&code<=90)||(code>=97&&code<=122)||(code>=48&&code<=57)||code===43||code===47)){
      throw new BridgeError('Invalid drawing encoding.','INVALID_CONTENT');
    }
  }
  const bytes=Buffer.from(encoded,'base64');
  if(!bytes.length||bytes.length>MAX_INPUT_BYTES)throw new BridgeError('Drawing exceeds 8 MiB limit.','FILE_TOO_LARGE',413);
  const ext=name.slice(name.lastIndexOf('.')).toLowerCase();
  if(!KINDS.has(ext))throw new BridgeError('Unsupported CAD format.','UNSUPPORTED_FORMAT');
  return{action:request.action,ext,bytes};
}
export async function checkCadcraftInstalled(config={}){
  try{await callCli(['--version'],{command:process.env.CADCRAFT_CLI||'cadcraft-cli',...config,timeoutMs:5000,maxOutputBytes:2048});return true;}
  catch{return false;}
}
export async function executeCadcraft(request,cliConfig={}){
  const {action,ext,bytes}=decode(request);
  const dir=await mkdtemp(join(tmpdir(),'civweave-cadcraft-'));
  const input=join(dir,'input'+ext),output=join(dir,'result.svg');
  const opts={command:process.env.CADCRAFT_CLI||'cadcraft-cli',...cliConfig,cwd:dir};
  try{
    await writeFile(input,bytes,{flag:'wx',mode:0o600});
    if(action==='info'){
      const details=await callCli(['info',input],opts);
      return{schema:'civweave.craft-result.v1',tool:'cadcraft',action,details};
    }
    await callCli(['convert',input,output],opts);
    const metadata=await stat(output);
    if(!metadata.isFile()||metadata.size===0||metadata.size>MAX_OUTPUT_BYTES)throw new BridgeError('SVG output missing or too large.','INVALID_EXPORT',502);
    const file=await readFile(output);
    const beginning=file.subarray(0,1024).toString('utf8').trimStart();
    if(!/^<\?xml\b|^<svg[\s>]/.test(beginning)||!file.includes(Buffer.from('<svg'))){
      throw new BridgeError('CADCraft output is not an SVG document.','INVALID_EXPORT',502);
    }
    return{schema:'civweave.craft-result.v1',tool:'cadcraft',action,filename:request.name.replace(/\.[^.]+$/,'')+'.svg',mime:'image/svg+xml',contentBase64:file.toString('base64')};
  }finally{await rm(dir,{recursive:true,force:true});}
}

import {mkdtemp,writeFile,readFile,stat,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {callCli,BridgeError,MAX_INPUT_BYTES,MAX_OUTPUT_BYTES} from './wordcraft.mjs';

const ACTIONS=new Set(['info','text','combine']);
function inputPdf(file){
  if(!file||typeof file!=='object')throw new BridgeError('PDF input must be an object.','INVALID_FILE');
  if(typeof file.name!=='string'||file.name.length>120||!/^[A-Za-z0-9][A-Za-z0-9 ._-]*\.pdf$/i.test(file.name)||file.name.includes('..')){
    throw new BridgeError('PDF file name is invalid.','INVALID_FILE');
  }
  const base64=file.contentBase64;
  if(typeof base64!=='string'||!base64||base64.length%4!==0||base64.length>Math.ceil(MAX_INPUT_BYTES/3)*4+4){
    throw new BridgeError('PDF content is invalid or too large.','INVALID_CONTENT',413);
  }
  let padding=0;
  for(let i=0;i<base64.length;i++){
    const c=base64.charCodeAt(i);
    if(c===61){padding++;if(i<base64.length-2||padding>2)throw new BridgeError('Invalid PDF base64 padding.','INVALID_CONTENT');continue;}
    if(padding||(c!==43&&c!==47&&!(c>=48&&c<=57)&&!(c>=65&&c<=90)&&!(c>=97&&c<=122))){
      throw new BridgeError('Invalid PDF encoding.','INVALID_CONTENT');
    }
  }
  const bytes=Buffer.from(base64,'base64');
  if(!bytes.length||bytes.length>MAX_INPUT_BYTES)throw new BridgeError('PDF exceeds the input size limit.','FILE_TOO_LARGE',413);
  if(bytes.subarray(0,5).toString('latin1')!=='%PDF-')throw new BridgeError('Input is not a PDF document.','INVALID_PDF');
  return bytes;
}
export async function checkPdfcraftInstalled(config={}){
  try{await callCli(['--version'],{command:process.env.PDFCRAFT_CLI||'pdfcraft-cli',...config,timeoutMs:5000,maxOutputBytes:2048});return true;}
  catch{return false;}
}
export async function executePdfcraft(request,cliConfig={}){
  if(!request||typeof request!=='object'||!ACTIONS.has(request.action))throw new BridgeError('Unsupported PdfCraft action.','INVALID_ACTION');
  const {action}=request;
  if(!Array.isArray(request.files)||request.files.length!==(action==='combine'?2:1)){
    throw new BridgeError('Provide one PDF, or exactly two for combine.','INVALID_FILES');
  }
  const bytes=request.files.map(inputPdf);
  if(bytes.reduce((sum,item)=>sum+item.length,0)>MAX_INPUT_BYTES)throw new BridgeError('Combined files exceed 8 MiB.','FILE_TOO_LARGE',413);
  const dir=await mkdtemp(join(tmpdir(),'civweave-pdfcraft-'));
  const inputs=bytes.map((_,i)=>join(dir,'input-'+i+'.pdf')),output=join(dir,'combined.pdf');
  const opts={command:process.env.PDFCRAFT_CLI||'pdfcraft-cli',...cliConfig,cwd:dir};
  try{
    for(let i=0;i<bytes.length;i++)await writeFile(inputs[i],bytes[i],{flag:'wx',mode:0o600});
    if(action==='info'||action==='text'){
      const stdout=await callCli([action,inputs[0]],opts);
      return{schema:'civweave.craft-result.v1',tool:'pdfcraft',action,content:stdout};
    }
    await callCli(['combine',...inputs,'--out',output],opts);
    const metadata=await stat(output);
    if(!metadata.isFile()||!metadata.size||metadata.size>MAX_OUTPUT_BYTES)throw new BridgeError('PdfCraft combined output is invalid.','INVALID_EXPORT',502);
    const file=await readFile(output);
    if(file.subarray(0,5).toString('latin1')!=='%PDF-')throw new BridgeError('PdfCraft returned a non-PDF file.','INVALID_EXPORT',502);
    return{schema:'civweave.craft-result.v1',tool:'pdfcraft',action,
      filename:'combined.pdf',mime:'application/pdf',contentBase64:file.toString('base64')};
  }finally{await rm(dir,{recursive:true,force:true});}
}

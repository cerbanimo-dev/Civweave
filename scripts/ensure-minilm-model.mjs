import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const modelRoot=path.join(root,'public','app','models','all-minilm-l6-v2');
const base='https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main';
const soft=process.argv.includes('--soft');
const checkOnly=process.argv.includes('--check');
const verifyHashes=checkOnly||process.argv.includes('--verify-hash');
const skip=process.env.COMMONWEAVE_SKIP_MODEL_PULL==='1';
const files=[
  {name:'config.json',min:300},
  {name:'special_tokens_map.json',min:100},
  {name:'tokenizer.json',min:500000},
  {name:'tokenizer_config.json',min:100},
  {name:'vocab.txt',min:200000},
  {name:'onnx/model_q4f16.onnx',size:30018257,sha:'eb08a666c46109637e0b6cb04f6052a68efd59bb0252d4e0438d28fb6b2d853d'},
  {name:'onnx/model_quantized.onnx',size:22972370,sha:'afdb6f1a0e45b715d0bb9b11772f032c399babd23bfc31fed1c170afc848bdb1'}
];
async function hash(file){const h=createHash('sha256');h.update(await readFile(file));return h.digest('hex')}
async function valid(spec){
  try{
    const file=path.join(modelRoot,spec.name),info=await stat(file);
    if(spec.size&&info.size!==spec.size)return false;
    if(spec.min&&info.size<spec.min)return false;
    if(spec.sha&&verifyHashes&&(await hash(file))!==spec.sha)return false;
    return true;
  }catch{return false}
}
async function download(spec){
  const target=path.join(modelRoot,spec.name),temp=`${target}.part`;
  await mkdir(path.dirname(target),{recursive:true});
  await rm(temp,{force:true});
  const response=await fetch(`${base}/${spec.name}?download=true`,{redirect:'follow',headers:{'user-agent':'Commonweave/1.0.37'}});
  if(!response.ok||!response.body)throw new Error(`${spec.name} returned ${response.status}`);
  await pipeline(Readable.fromWeb(response.body),createWriteStream(temp));
  const info=await stat(temp);
  if(spec.size&&info.size!==spec.size)throw new Error(`${spec.name} downloaded ${info.size} bytes, expected ${spec.size}`);
  if(spec.min&&info.size<spec.min)throw new Error(`${spec.name} downloaded only ${info.size} bytes`);
  if(spec.sha&&(await hash(temp))!==spec.sha)throw new Error(`${spec.name} hash mismatch`);
  await rename(temp,target);
  return info.size;
}
async function main(){
  if(skip){console.log('[Commonweave] MiniLM download skipped by COMMONWEAVE_SKIP_MODEL_PULL.');return}
  const missing=[];
  for(const spec of files)if(!await valid(spec))missing.push(spec);
  if(!missing.length){
    console.log(`[Commonweave] MiniLM semantic package is ready${verifyHashes?' and hash-verified':' (fast size check)'}.`);
    return;
  }
  if(checkOnly)throw new Error(`MiniLM package incomplete: ${missing.map(item=>item.name).join(', ')}`);
  console.log(`[Commonweave] Fetching ${missing.length} MiniLM package file(s)…`);
  for(const spec of missing){const bytes=await download(spec);console.log(`[Commonweave] Downloaded ${spec.name} (${bytes} bytes).`)}
  console.log('[Commonweave] MiniLM semantic package is ready.');
}
main().catch(error=>{if(soft){console.warn(`[Commonweave] MiniLM package remains optional: ${error.message}`);return}console.error(error);process.exitCode=1});

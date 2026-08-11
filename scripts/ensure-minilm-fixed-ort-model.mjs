import {createHash} from 'node:crypto';
import {createWriteStream} from 'node:fs';
import {mkdir,readFile,rename,rm,stat} from 'node:fs/promises';
import path from 'node:path';
import {pipeline} from 'node:stream/promises';
import {Readable} from 'node:stream';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const modelRoot=path.join(root,'public','app','models','all-minilm-l6-v2');
const base='https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main';
const soft=process.argv.includes('--soft');
const checkOnly=process.argv.includes('--check');
const verifyHashes=checkOnly||process.argv.includes('--verify-hash');
const skip=process.env.CIVWEAVE_SKIP_MODEL_PULL==='1';
const lifecycle=String(process.env.npm_lifecycle_event||'');
const startupLifecycle=new Set(['prestart','prestart:local','setup:local']);
const explicitStartupPull=process.env.CIVWEAVE_PULL_OPTIONAL_MODEL_ON_START==='1';
const files=[
  {name:'config.json',min:300},
  {name:'tokenizer_config.json',min:100},
  {name:'vocab.txt',min:200000},
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
  await mkdir(path.dirname(target),{recursive:true});await rm(temp,{force:true});
  const response=await fetch(`${base}/${spec.name}?download=true`,{redirect:'follow',headers:{'user-agent':'Civweave/1.0.99-optional-minilm'}});
  if(!response.ok||!response.body)throw new Error(`${spec.name} returned ${response.status}`);
  await pipeline(Readable.fromWeb(response.body),createWriteStream(temp));
  const info=await stat(temp);
  if(spec.size&&info.size!==spec.size)throw new Error(`${spec.name} downloaded ${info.size} bytes, expected ${spec.size}`);
  if(spec.min&&info.size<spec.min)throw new Error(`${spec.name} downloaded only ${info.size} bytes`);
  if(spec.sha&&(await hash(temp))!==spec.sha)throw new Error(`${spec.name} hash mismatch`);
  await rename(temp,target);return info.size;
}
async function main(){
  if(skip){console.log('[Civweave] Fixed MiniLM model pull skipped by CIVWEAVE_SKIP_MODEL_PULL.');return}
  if(startupLifecycle.has(lifecycle)&&!checkOnly&&!explicitStartupPull){
    console.log('[Civweave] Optional MiniLM is not staged during app startup. Install local models explicitly from AI settings.');
    return;
  }
  const missing=[];for(const spec of files)if(!await valid(spec))missing.push(spec);
  if(!missing.length){console.log(`[Civweave] Fixed MiniLM ONNX package is ready${verifyHashes?' and hash-verified':' (fast size check)'}.`);return}
  if(checkOnly)throw new Error(`Fixed MiniLM package incomplete: ${missing.map(item=>item.name).join(', ')}`);
  console.log(`[Civweave] Fetching ${missing.length} explicitly requested MiniLM package file(s)…`);
  for(const spec of missing){const bytes=await download(spec);console.log(`[Civweave] Downloaded ${spec.name} (${bytes} bytes).`)}
  console.log('[Civweave] Fixed MiniLM ONNX package is ready.');
}
main().catch(error=>{if(soft){console.warn(`[Civweave] Fixed MiniLM package remains optional: ${error.message}`);return}console.error(error);process.exitCode=1});

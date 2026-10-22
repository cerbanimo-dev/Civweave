import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const PACKAGE='@wllama/wllama@3.8.1';
const root=process.cwd();
const sandbox=path.join(root,'.wllama-stage');
const src=path.join(sandbox,'node_modules','@wllama','wllama','esm');
const target=path.join(root,'public','app','vendor','wllama','esm');
async function exists(file){try{await fs.access(file);return true}catch{return false}}
async function stage(){
  if(!await exists(path.join(src,'index.js'))||!await exists(path.join(src,'wasm','wllama.wasm'))){
    await fs.mkdir(sandbox,{recursive:true});
    const run=spawnSync('npm',['install','--prefix',sandbox,'--no-save','--package-lock=false','--ignore-scripts','--no-audit','--no-fund',PACKAGE],{stdio:'inherit',cwd:root});
    if(run.status!==0)throw new Error('Unable to install pinned browser GGUF engine '+PACKAGE);
  }
  if(!await exists(path.join(src,'index.js'))||!await exists(path.join(src,'wasm','wllama.wasm')))
    throw new Error('Pinned wllama package does not include expected browser JS/WASM assets.');
  await fs.rm(target,{recursive:true,force:true});
  await fs.mkdir(target,{recursive:true});
  await fs.cp(src,target,{recursive:true,filter:from=>!from.endsWith('.map')&&!from.endsWith('.d.ts')});
  const wasm=await fs.stat(path.join(target,'wasm','wllama.wasm'));
  if(wasm.size<500_000||wasm.size>24*1024*1024)throw new Error('Wllama WASM size violates Cloudflare Pages staging limits: '+wasm.size);
  await fs.writeFile(path.join(target,'civweave-stage.json'),JSON.stringify({schema:'civweave.gguf-browser-stage.v1',package:PACKAGE,entry:'/app/vendor/wllama/esm/index.js',wasm:'/app/vendor/wllama/esm/wasm/wllama.wasm',wasmBytes:wasm.size},null,2)+'\n');
  console.log('Staged self-hosted browser GGUF engine '+PACKAGE+' ('+wasm.size+' WASM bytes).');
}
stage().catch(error=>{console.error(error);process.exitCode=1});

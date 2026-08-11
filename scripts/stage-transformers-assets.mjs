import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=path.join(root,'node_modules','@huggingface','transformers','dist');
const destination=path.join(root,'public','app','vendor','transformers');
const backendDestination=path.join(destination,'wasm');
const soft=process.argv.includes('--soft');
const force=process.argv.includes('--force');
const renderBuild=process.env.RENDER==='true';
const BACKEND_MJS='ort-wasm-simd-threaded.jsep.mjs';
const BACKEND_WASM='ort-wasm-simd-threaded.jsep.wasm';

async function exists(target){try{await fsp.access(target);return true}catch{return false}}
async function staged(){
  const required=[
    path.join(destination,'transformers.min.js'),
    path.join(destination,'stage-manifest.json'),
    path.join(backendDestination,BACKEND_MJS),
    path.join(backendDestination,BACKEND_WASM)
  ];
  return (await Promise.all(required.map(exists))).every(Boolean);
}
async function walk(directory){
  const output=[];
  for(const entry of await fsp.readdir(directory,{withFileTypes:true})){
    const full=path.join(directory,entry.name);
    if(entry.isDirectory())output.push(...await walk(full));
    else output.push(full);
  }
  return output;
}
async function findByBasename(directory,name){
  const files=await walk(directory);
  return files.find(file=>path.basename(file)===name)||null;
}

async function main(){
  if(!force&&await staged()){
    console.log('[Civweave] Transformers.js browser assets are already staged.');
    return;
  }
  if(renderBuild&&!force){
    console.log('[Civweave] Render gateway build: skipping device-side Transformers.js staging; using committed Transformers.js assets.');
    return;
  }
  if(!await exists(source)){
    const message='@huggingface/transformers is not installed. Run npm install before staging the onboard model.';
    if(soft){console.warn(`[Civweave] ${message}`);return}
    throw new Error(message);
  }

  await fsp.rm(destination,{recursive:true,force:true});
  await fsp.mkdir(backendDestination,{recursive:true});

  const entryCandidates=['transformers.min.js','transformers.web.min.js','transformers.js','transformers.web.js','transformers.mjs'];
  let entrySource=null;
  for(const name of entryCandidates){
    const candidate=path.join(source,name);
    if(await exists(candidate)){entrySource=candidate;break}
  }
  if(!entrySource)throw new Error(`Transformers.js installed, but no browser entry was found in ${source}.`);

  const backendMjsSource=await findByBasename(source,BACKEND_MJS);
  const backendWasmSource=await findByBasename(source,BACKEND_WASM);
  if(!backendMjsSource||!backendWasmSource)throw new Error(`Transformers.js backend staging is incomplete. Missing ${[!backendMjsSource&&BACKEND_MJS,!backendWasmSource&&BACKEND_WASM].filter(Boolean).join(', ')}.`);

  await fsp.copyFile(entrySource,path.join(destination,'transformers.min.js'));
  await fsp.copyFile(backendMjsSource,path.join(backendDestination,BACKEND_MJS));
  await fsp.copyFile(backendWasmSource,path.join(backendDestination,BACKEND_WASM));

  const stagedFiles=[
    'transformers.min.js',
    `wasm/${BACKEND_MJS}`,
    `wasm/${BACKEND_WASM}`,
  ];
  await fsp.writeFile(path.join(destination,'stage-manifest.json'),JSON.stringify({
    schema:'civweave.transformers-stage.v3',
    package:'@huggingface/transformers',
    purpose:'browser-runtime-only',
    entry:'/app/vendor/transformers/transformers.min.js',
    backendRoot:'/app/vendor/transformers/wasm/',
    backendFiles:[BACKEND_MJS,BACKEND_WASM],
    stagedFiles,
    copied:stagedFiles.length,
    wasmCount:1,
    loaderCount:1,
    stagedAt:new Date().toISOString()
  },null,2));

  console.log(`[Civweave] Staged minimal Transformers.js browser runtime: ${stagedFiles.length} files (entry + JSEP loader + WASM).`);
}

main().catch(error=>{console.error(error);process.exitCode=1});

import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=path.join(root,'node_modules','@huggingface','transformers','dist');
const destination=path.join(root,'public','app','vendor','transformers');
const backendDestination=path.join(destination,'wasm');
const soft=process.argv.includes('--soft');
const force=process.argv.includes('--force');
const hosted=process.env.RENDER==='true'||process.env.CF_PAGES==='1'||process.env.CLOUDFLARE_PAGES==='1';
const explicitHostedStage=process.env.CIVWEAVE_STAGE_DEVICE_AI_ON_HOST==='1';

async function exists(target){try{await fsp.access(target);return true}catch{return false}}
async function staged(){
  const required=[
    path.join(destination,'transformers.min.js'),
    path.join(destination,'stage-manifest.json'),
    path.join(backendDestination,'ort-wasm-simd-threaded.jsep.mjs'),
    path.join(backendDestination,'ort-wasm-simd-threaded.jsep.wasm')
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

async function main(){
  if(hosted&&!explicitHostedStage){
    console.log('[Civweave] Hosted gateway: skipping device-side Transformers.js staging. Local model runtimes are installed on demand by the device.');
    return;
  }
  if(!force&&await staged()){
    console.log('[Civweave] Transformers.js browser assets are already staged.');
    return;
  }
  if(!await exists(source)){
    const message='@huggingface/transformers is not installed. Run npm install before staging the onboard model.';
    if(soft){console.warn(`[Civweave] ${message}`);return}
    throw new Error(message);
  }

  await fsp.rm(destination,{recursive:true,force:true});
  await fsp.mkdir(destination,{recursive:true});
  await fsp.mkdir(backendDestination,{recursive:true});

  const files=await walk(source);
  const copied=[];
  const backendFiles=[];

  for(const file of files){
    const relative=path.relative(source,file);
    if(!/\.(?:js|mjs|cjs|wasm|map)$/i.test(relative))continue;

    const target=path.join(destination,relative);
    await fsp.mkdir(path.dirname(target),{recursive:true});
    await fsp.copyFile(file,target);
    copied.push(relative);

    const basename=path.basename(relative);
    if(/^ort-wasm.*\.(?:mjs|wasm)$/i.test(basename)){
      const backendTarget=path.join(backendDestination,basename);
      if(path.resolve(backendTarget)!==path.resolve(target))await fsp.copyFile(file,backendTarget);
      backendFiles.push(basename);
    }
  }

  const candidates=['transformers.min.js','transformers.js','transformers.mjs'];
  const entry=candidates.find(name=>copied.includes(name));
  if(!entry)throw new Error(`Transformers.js installed, but no browser entry was found in ${source}.`);
  if(entry!=='transformers.min.js')await fsp.copyFile(path.join(destination,entry),path.join(destination,'transformers.min.js'));

  const requiredBackendFiles=['ort-wasm-simd-threaded.jsep.mjs','ort-wasm-simd-threaded.jsep.wasm'];
  const missingBackend=requiredBackendFiles.filter(name=>!backendFiles.includes(name));
  if(missingBackend.length)throw new Error(`Transformers.js backend staging is incomplete. Missing: ${missingBackend.join(', ')}`);

  const wasmCount=backendFiles.filter(file=>file.endsWith('.wasm')).length;
  const loaderCount=backendFiles.filter(file=>file.endsWith('.mjs')).length;
  await fsp.writeFile(path.join(destination,'stage-manifest.json'),JSON.stringify({
    schema:'civweave.transformers-stage.v2',
    package:'@huggingface/transformers',
    entry:'/app/vendor/transformers/transformers.min.js',
    backendRoot:'/app/vendor/transformers/wasm/',
    backendFiles:[...new Set(backendFiles)].sort(),
    copied:copied.length,
    wasmCount,
    loaderCount,
    stagedAt:new Date().toISOString()
  },null,2));

  console.log(`[Civweave] Staged Transformers.js: ${copied.length} runtime files, ${loaderCount} backend loaders, ${wasmCount} WASM binaries.`);
}

main().catch(error=>{console.error(error);process.exitCode=1});

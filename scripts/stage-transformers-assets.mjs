import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=path.join(root,'node_modules','@huggingface','transformers','dist');
const destination=path.join(root,'public','app','vendor','transformers');
const soft=process.argv.includes('--soft');

async function exists(target){try{await fsp.access(target);return true}catch{return false}}
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
  if(!await exists(source)){
    const message='@huggingface/transformers is not installed. Run npm install before starting the onboard model.';
    if(soft){console.warn(`[Commonweave] ${message}`);return}
    throw new Error(message);
  }
  await fsp.rm(destination,{recursive:true,force:true});
  await fsp.mkdir(destination,{recursive:true});
  const files=await walk(source);
  const copied=[];
  for(const file of files){
    const relative=path.relative(source,file);
    if(!/\.(?:js|mjs|cjs|wasm|map)$/i.test(relative))continue;
    const target=path.join(destination,relative);
    await fsp.mkdir(path.dirname(target),{recursive:true});
    await fsp.copyFile(file,target);
    copied.push(relative);
    if(/\.wasm$/i.test(relative)){
      const flat=path.join(destination,'wasm',path.basename(relative));
      await fsp.mkdir(path.dirname(flat),{recursive:true});
      if(flat!==target)await fsp.copyFile(file,flat);
    }
  }
  const candidates=['transformers.min.js','transformers.js','transformers.mjs'];
  const entry=candidates.find(name=>copied.includes(name));
  if(!entry)throw new Error(`Transformers.js installed, but no browser entry was found in ${source}.`);
  if(entry!=='transformers.min.js')await fsp.copyFile(path.join(destination,entry),path.join(destination,'transformers.min.js'));
  const wasmCount=copied.filter(file=>file.endsWith('.wasm')).length;
  await fsp.writeFile(path.join(destination,'stage-manifest.json'),JSON.stringify({schema:'commonweave.transformers-stage.v1',package:'@huggingface/transformers',entry:'/app/vendor/transformers/transformers.min.js',copied:copied.length,wasmCount,stagedAt:new Date().toISOString()},null,2));
  console.log(`[Commonweave] Staged Transformers.js: ${copied.length} runtime files, ${wasmCount} WASM binaries.`);
}

main().catch(error=>{console.error(error);process.exitCode=1});

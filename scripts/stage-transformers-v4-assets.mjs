import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const PACKAGE='@huggingface/transformers';
const VERSION='4.2.0';
const ORT_PACKAGE='onnxruntime-web';
const ORT_VERSION='1.26.0-dev.20260416-b7804b056c';
const destination=path.join(root,'public','app','vendor','transformers-v4');
const backendDestination=path.join(destination,'wasm');
const manifestPath=path.join(destination,'stage-manifest.json');
const force=process.argv.includes('--force');
const soft=process.argv.includes('--soft');

async function exists(target){try{await fsp.access(target);return true}catch{return false}}
async function staged(){
  if(!await exists(manifestPath))return false;
  try{
    const manifest=JSON.parse(await fsp.readFile(manifestPath,'utf8'));
    if(manifest.package!==PACKAGE||manifest.version!==VERSION||manifest.backendPackage!==ORT_PACKAGE||manifest.backendVersion!==ORT_VERSION)return false;
  }catch{return false}
  const required=[
    path.join(destination,'transformers.min.js'),
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
function run(command,args,options={}){
  const result=spawnSync(command,args,{cwd:root,encoding:'utf8',...options});
  if(result.error)throw result.error;
  if(result.status!==0)throw new Error(`${command} ${args.join(' ')} failed (${result.status}).\n${result.stderr||result.stdout||''}`.trim());
  return result;
}
async function packAndExtract(npm,spec,temp,folder){
  const packDir=path.join(temp,`${folder}-pack`);
  const extractDir=path.join(temp,`${folder}-extract`);
  await fsp.mkdir(packDir,{recursive:true});
  await fsp.mkdir(extractDir,{recursive:true});
  const packed=run(npm,['pack',spec,'--ignore-scripts','--pack-destination',packDir]);
  const archiveName=String(packed.stdout||'').trim().split(/\r?\n/).filter(Boolean).at(-1);
  if(!archiveName)throw new Error(`npm pack did not return an archive name for ${spec}.`);
  const archive=path.resolve(packDir,archiveName);
  if(!await exists(archive))throw new Error(`Packed archive was not found for ${spec}: ${archive}`);
  try{run('tar',['-xzf',archive,'-C',extractDir])}catch(error){throw new Error(`A tar-compatible extractor is required to stage ${spec}. ${error?.message||error}`)}
  const packageRoot=path.join(extractDir,'package');
  if(!await exists(packageRoot))throw new Error(`${spec} archive did not contain package/.`);
  return packageRoot;
}

async function main(){
  if(!force&&await staged()){
    console.log(`[Civweave] Transformers.js ${VERSION} + ONNX Runtime Web ${ORT_VERSION} Gemma 4 runtime is already staged.`);
    return;
  }
  const temp=await fsp.mkdtemp(path.join(os.tmpdir(),'civweave-transformers-v4-'));
  try{
    const npm=process.platform==='win32'?'npm.cmd':'npm';
    const transformersRoot=await packAndExtract(npm,`${PACKAGE}@${VERSION}`,temp,'transformers');
    const ortRoot=await packAndExtract(npm,`${ORT_PACKAGE}@${ORT_VERSION}`,temp,'ort');
    const source=path.join(transformersRoot,'dist');
    const ortSource=path.join(ortRoot,'dist');
    if(!await exists(source))throw new Error(`Transformers.js ${VERSION} package did not contain dist/.`);
    if(!await exists(ortSource))throw new Error(`ONNX Runtime Web ${ORT_VERSION} package did not contain dist/.`);

    await fsp.rm(destination,{recursive:true,force:true});
    await fsp.mkdir(destination,{recursive:true});
    await fsp.mkdir(backendDestination,{recursive:true});
    const files=await walk(source),copied=[];
    for(const file of files){
      const relative=path.relative(source,file);
      if(!/\.(?:js|mjs|cjs|wasm|map)$/i.test(relative))continue;
      const target=path.join(destination,relative);
      await fsp.mkdir(path.dirname(target),{recursive:true});
      await fsp.copyFile(file,target);
      copied.push(relative);
    }
    const candidates=['transformers.min.js','transformers.web.js','transformers.js','transformers.mjs'];
    const entry=candidates.find(name=>copied.includes(name));
    if(!entry)throw new Error(`Transformers.js ${VERSION} was packed, but no browser entry was found in dist/.`);
    if(entry!=='transformers.min.js')await fsp.copyFile(path.join(destination,entry),path.join(destination,'transformers.min.js'));

    const backendFiles=[];
    for(const file of await walk(ortSource)){
      const basename=path.basename(file);
      if(!/^ort-wasm.*\.(?:mjs|wasm)$/i.test(basename))continue;
      await fsp.copyFile(file,path.join(backendDestination,basename));
      backendFiles.push(basename);
    }
    for(const name of ['ort-wasm-simd-threaded.jsep.mjs','ort-wasm-simd-threaded.jsep.wasm']){
      if(!await exists(path.join(backendDestination,name)))throw new Error(`Transformers.js ${VERSION} backend staging is incomplete. ${ORT_PACKAGE}@${ORT_VERSION} did not provide ${name}.`);
    }
    await fsp.writeFile(manifestPath,JSON.stringify({
      schema:'civweave.transformers-stage.v4',
      package:PACKAGE,
      version:VERSION,
      backendPackage:ORT_PACKAGE,
      backendVersion:ORT_VERSION,
      purpose:'gemma4-mobile-runtime',
      entry:'/app/vendor/transformers-v4/transformers.min.js',
      backendRoot:'/app/vendor/transformers-v4/wasm/',
      backendFiles:[...new Set(backendFiles)].sort(),
      copied:copied.length,
      stagedAt:new Date().toISOString()
    },null,2));
    console.log(`[Civweave] Staged Transformers.js ${VERSION} with matching ONNX Runtime Web ${ORT_VERSION}: ${copied.length} runtime files, ${backendFiles.length} backend files.`);
  }finally{
    await fsp.rm(temp,{recursive:true,force:true});
  }
}

main().catch(error=>{
  if(soft){console.warn(`[Civweave] Gemma 4 runtime staging skipped: ${error?.message||error}`);return}
  console.error(error);process.exitCode=1;
});

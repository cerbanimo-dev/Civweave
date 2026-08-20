import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const PACKAGE='@huggingface/transformers';
const VERSION='4.2.0';
const ORT_PACKAGE='onnxruntime-web';
const ORT_VERSION='1.26.0-dev.20260416-b7804b056c';
const ORT_MJS='ort-wasm-simd-threaded.jsep.mjs';
const ORT_WASM='ort-wasm-simd-threaded.jsep.wasm';
const CHUNK_BYTES=16*1024*1024;
const STAGE_SCHEMA='civweave.transformers-stage.v7';
const GEMMA4_LOGITS_BACKPORT='huggingface-transformers-js-pr-1681';
const destination=path.join(root,'public','app','vendor','transformers-v4');
const backendDestination=path.join(destination,'wasm');
const manifestPath=path.join(destination,'stage-manifest.json');
const force=process.argv.includes('--force');
const soft=process.argv.includes('--soft');
const chunkName=index=>`${ORT_WASM}.part${index}`;
const GEMMA4_LOGITS_BUG=/(\.inputNames\.includes\("num_logits_to_keep"\)&&![A-Za-z_$][\w$]*\.num_logits_to_keep&&\([A-Za-z_$][\w$]*\.num_logits_to_keep=new [A-Za-z_$][\w$]*\("int64",)\[0n\](,\[\]\)\))/g;

async function exists(target){try{await fsp.access(target);return true}catch{return false}}
async function staged(){
  if(!await exists(manifestPath))return false;
  try{
    const manifest=JSON.parse(await fsp.readFile(manifestPath,'utf8'));
    if(manifest.schema!==STAGE_SCHEMA||manifest.purpose!=='gemma4-mobile-browser-runtime-only')return false;
    if(manifest.package!==PACKAGE||manifest.version!==VERSION||manifest.backendPackage!==ORT_PACKAGE||manifest.backendVersion!==ORT_VERSION)return false;
    if(manifest.gemma4NumLogitsBackport!==GEMMA4_LOGITS_BACKPORT)return false;
    if(!Array.isArray(manifest.wasmChunks)||manifest.wasmChunks.length<2)return false;
    const required=[path.join(destination,'transformers.min.js'),path.join(backendDestination,ORT_MJS),...manifest.wasmChunks.map(name=>path.join(backendDestination,name))];
    if(!(await Promise.all(required.map(exists))).every(Boolean))return false;
    const bundle=await fsp.readFile(path.join(destination,'transformers.min.js'),'utf8');
    if(bundle.includes('num_logits_to_keep')&&GEMMA4_LOGITS_BUG.test(bundle))return false;
    GEMMA4_LOGITS_BUG.lastIndex=0;
    return bundle.includes('num_logits_to_keep')&&bundle.includes('[1n]');
  }catch{return false}
}
function run(command,args,options={}){
  const result=spawnSync(command,args,{cwd:root,encoding:'utf8',...options});
  if(result.error)throw result.error;
  if(result.status!==0)throw new Error(`${command} ${args.join(' ')} failed (${result.status}).\n${result.stderr||result.stdout||''}`.trim());
  return result;
}
function tarText(buffer,start,length){
  return buffer.subarray(start,start+length).toString('utf8').replace(/\0.*$/s,'').trim();
}
function tarOctal(buffer,start,length){
  const text=tarText(buffer,start,length).replace(/\s/g,'');
  return text?Number.parseInt(text,8):0;
}
function parsePax(data){
  const fields={};
  let offset=0;
  while(offset<data.length){
    const space=data.indexOf(0x20,offset);
    if(space<0)break;
    const length=Number.parseInt(data.subarray(offset,space).toString('ascii'),10);
    if(!Number.isFinite(length)||length<=0||offset+length>data.length)break;
    const record=data.subarray(space+1,offset+length).toString('utf8').replace(/\n$/,'');
    const equal=record.indexOf('=');
    if(equal>0)fields[record.slice(0,equal)]=record.slice(equal+1);
    offset+=length;
  }
  return fields;
}
function safeArchivePath(name){
  const normalized=String(name||'').replace(/\\/g,'/').replace(/^\.\/+/,'');
  if(!normalized.startsWith('package/'))throw new Error(`Archive entry escaped package/: ${name}`);
  const relative=normalized.slice('package/'.length);
  if(!relative)return '';
  if(relative.split('/').some(part=>!part||part==='.'||part==='..'))throw new Error(`Unsafe archive path: ${name}`);
  return relative;
}
async function extractNpmTgz(archive,extractDir){
  const tar=gunzipSync(await fsp.readFile(archive));
  let offset=0,pax={},longPath='';
  while(offset+512<=tar.length){
    const header=tar.subarray(offset,offset+512);
    if(header.every(byte=>byte===0))break;
    const name=tarText(header,0,100);
    const prefix=tarText(header,345,155);
    const size=tarOctal(header,124,12);
    const type=String.fromCharCode(header[156]||48);
    const dataStart=offset+512,dataEnd=dataStart+size;
    if(dataEnd>tar.length)throw new Error(`Truncated tar entry: ${name}`);
    const data=tar.subarray(dataStart,dataEnd);
    if(type==='x'||type==='g'){
      pax={...pax,...parsePax(data)};
    }else if(type==='L'){
      longPath=data.toString('utf8').replace(/\0.*$/s,'').trim();
    }else{
      const archiveName=pax.path||longPath||[prefix,name].filter(Boolean).join('/');
      pax={};longPath='';
      const relative=safeArchivePath(archiveName);
      if(relative){
        const target=path.resolve(extractDir,'package',relative);
        const packageRoot=path.resolve(extractDir,'package');
        if(target!==packageRoot&&!target.startsWith(`${packageRoot}${path.sep}`))throw new Error(`Unsafe archive path: ${archiveName}`);
        if(type==='5'){
          await fsp.mkdir(target,{recursive:true});
        }else if(type==='0'||type==='\0'){
          await fsp.mkdir(path.dirname(target),{recursive:true});
          await fsp.writeFile(target,data);
        }
      }
    }
    offset=dataStart+Math.ceil(size/512)*512;
  }
}
async function packAndExtract(npm,spec,temp,folder){
  const packDir=path.join(temp,`${folder}-pack`),extractDir=path.join(temp,`${folder}-extract`);
  await fsp.mkdir(packDir,{recursive:true});await fsp.mkdir(extractDir,{recursive:true});
  const packed=run(npm,['pack',spec,'--ignore-scripts','--pack-destination',packDir]);
  const archiveName=String(packed.stdout||'').trim().split(/\r?\n/).filter(Boolean).at(-1);
  if(!archiveName)throw new Error(`npm pack did not return an archive name for ${spec}.`);
  const archive=path.resolve(packDir,archiveName);
  if(!await exists(archive))throw new Error(`Packed archive was not found for ${spec}: ${archive}`);
  await extractNpmTgz(archive,extractDir);
  const packageRoot=path.join(extractDir,'package');if(!await exists(packageRoot))throw new Error(`${spec} archive did not contain package/.`);return packageRoot;
}
function backportGemma4NextTokenLogits(source){
  GEMMA4_LOGITS_BUG.lastIndex=0;
  const matches=[...source.matchAll(GEMMA4_LOGITS_BUG)];
  GEMMA4_LOGITS_BUG.lastIndex=0;
  if(matches.length!==1)throw new Error(`Expected exactly one Transformers.js 4.2.0 Gemma num_logits_to_keep=0 decoder site; found ${matches.length}. Refusing an ambiguous runtime patch.`);
  const patched=source.replace(GEMMA4_LOGITS_BUG,'$1[1n]$2');
  GEMMA4_LOGITS_BUG.lastIndex=0;
  if(GEMMA4_LOGITS_BUG.test(patched))throw new Error('Gemma num_logits_to_keep=0 decoder site survived the runtime backport.');
  GEMMA4_LOGITS_BUG.lastIndex=0;
  return patched;
}
async function splitWasm(source){
  const bytes=await fsp.readFile(source),names=[];
  for(let offset=0,index=0;offset<bytes.length;offset+=CHUNK_BYTES,index++){
    const name=chunkName(index);
    await fsp.writeFile(path.join(backendDestination,name),bytes.subarray(offset,Math.min(bytes.length,offset+CHUNK_BYTES)));
    names.push(name);
  }
  if(names.length<2)throw new Error(`${ORT_WASM} unexpectedly fits in one chunk; revisit the split runtime contract.`);
  return{names,bytes:bytes.length};
}

async function main(){
  if(!force&&await staged()){console.log(`[Civweave] Transformers.js ${VERSION} + ONNX Runtime Web ${ORT_VERSION} minimal Gemma 4 runtime is already staged with ${GEMMA4_LOGITS_BACKPORT}.`);return}
  const temp=await fsp.mkdtemp(path.join(os.tmpdir(),'civweave-transformers-v4-'));
  try{
    const npm=process.platform==='win32'?'npm.cmd':'npm';
    const transformersRoot=await packAndExtract(npm,`${PACKAGE}@${VERSION}`,temp,'transformers');
    const ortRoot=await packAndExtract(npm,`${ORT_PACKAGE}@${ORT_VERSION}`,temp,'ort');
    const source=path.join(transformersRoot,'dist'),ortSource=path.join(ortRoot,'dist');
    if(!await exists(source))throw new Error(`Transformers.js ${VERSION} package did not contain dist/.`);
    if(!await exists(ortSource))throw new Error(`ONNX Runtime Web ${ORT_VERSION} package did not contain dist/.`);

    await fsp.rm(destination,{recursive:true,force:true});
    await fsp.mkdir(backendDestination,{recursive:true});

    const candidates=['transformers.min.js','transformers.web.min.js','transformers.web.js','transformers.js','transformers.mjs'];
    let entrySource=null;
    for(const name of candidates){const candidate=path.join(source,name);if(await exists(candidate)){entrySource=candidate;break}}
    if(!entrySource)throw new Error(`Transformers.js ${VERSION} was packed, but no browser entry was found in dist/.`);
    const entryText=await fsp.readFile(entrySource,'utf8');
    await fsp.writeFile(path.join(destination,'transformers.min.js'),backportGemma4NextTokenLogits(entryText),'utf8');

    const mjsSource=path.join(ortSource,ORT_MJS),wasmSource=path.join(ortSource,ORT_WASM);
    if(!await exists(mjsSource)||!await exists(wasmSource))throw new Error(`${ORT_PACKAGE}@${ORT_VERSION} does not contain the required WebGPU JSEP runtime pair.`);
    await fsp.copyFile(mjsSource,path.join(backendDestination,ORT_MJS));
    const split=await splitWasm(wasmSource);

    const stagedFiles=['transformers.min.js',`wasm/${ORT_MJS}`,...split.names.map(name=>`wasm/${name}`)];
    await fsp.writeFile(manifestPath,JSON.stringify({
      schema:STAGE_SCHEMA,package:PACKAGE,version:VERSION,backendPackage:ORT_PACKAGE,backendVersion:ORT_VERSION,purpose:'gemma4-mobile-browser-runtime-only',
      gemma4NumLogitsBackport:GEMMA4_LOGITS_BACKPORT,gemma4NumLogitsToKeep:1,
      entry:'/app/vendor/transformers-v4/transformers.min.js',backendRoot:'/app/vendor/transformers-v4/wasm/',backendFiles:[ORT_MJS,...split.names],wasmSource:ORT_WASM,wasmBytes:split.bytes,wasmChunks:split.names,wasmChunkBytes:CHUNK_BYTES,stagedFiles,copied:stagedFiles.length,stagedAt:new Date().toISOString()
    },null,2));
    console.log(`[Civweave] Staged minimal Transformers.js ${VERSION} browser runtime with ONNX Runtime Web ${ORT_VERSION}: ${stagedFiles.length} files, ${split.names.length} WASM chunks (${split.bytes} bytes total), ${GEMMA4_LOGITS_BACKPORT} applied.`);
  }finally{await fsp.rm(temp,{recursive:true,force:true})}
}

main().catch(error=>{if(soft){console.warn(`[Civweave] Gemma 4 runtime staging skipped: ${error?.message||error}`);return}console.error(error);process.exitCode=1});

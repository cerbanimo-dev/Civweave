#!/usr/bin/env node
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {gunzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const CORE_PACKAGE='@litert-lm/core';
const CORE_VERSION='0.14.0';
const UTILS_PACKAGE='@litertjs/wasm-utils';
const UTILS_VERSION='2.5.3';
const SCHEMA='civweave.litert-lm-web-stage.v1';
const MAX_CLOUDFLARE_ASSET_BYTES=24*1024*1024;
const destination=path.join(root,'public','app','vendor','litert-lm');
const manifestPath=path.join(destination,'stage-manifest.json');
const force=process.argv.includes('--force');
const soft=process.argv.includes('--soft');

async function exists(target){try{await fsp.access(target);return true}catch{return false}}
function run(command,args,options={}){const result=spawnSync(command,args,{cwd:root,encoding:'utf8',...options});if(result.error)throw result.error;if(result.status!==0)throw new Error(`${command} ${args.join(' ')} failed (${result.status}).\n${result.stderr||result.stdout||''}`.trim());return result}
function tarText(buffer,start,length){return buffer.subarray(start,start+length).toString('utf8').replace(/\0.*$/s,'').trim()}
function tarOctal(buffer,start,length){const value=tarText(buffer,start,length).replace(/\s/g,'');return value?Number.parseInt(value,8):0}
function parsePax(data){const fields={};let offset=0;while(offset<data.length){const space=data.indexOf(0x20,offset);if(space<0)break;const length=Number.parseInt(data.subarray(offset,space).toString('ascii'),10);if(!Number.isFinite(length)||length<=0||offset+length>data.length)break;const record=data.subarray(space+1,offset+length).toString('utf8').replace(/\n$/,'');const equal=record.indexOf('=');if(equal>0)fields[record.slice(0,equal)]=record.slice(equal+1);offset+=length}return fields}
function safeArchivePath(name){const normalized=String(name||'').replace(/\\/g,'/').replace(/^\.\/+/,'');if(!normalized.startsWith('package/'))throw new Error(`Archive entry escaped package/: ${name}`);const relative=normalized.slice('package/'.length);if(!relative)return'';if(relative.split('/').some(part=>!part||part==='.'||part==='..'))throw new Error(`Unsafe archive path: ${name}`);return relative}
async function extractNpmTgz(archive,extractDir){const tar=gunzipSync(await fsp.readFile(archive));let offset=0,pax={},longPath='';while(offset+512<=tar.length){const header=tar.subarray(offset,offset+512);if(header.every(byte=>byte===0))break;const name=tarText(header,0,100),prefix=tarText(header,345,155),size=tarOctal(header,124,12),type=String.fromCharCode(header[156]||48),dataStart=offset+512,dataEnd=dataStart+size;if(dataEnd>tar.length)throw new Error(`Truncated tar entry: ${name}`);const data=tar.subarray(dataStart,dataEnd);if(type==='x'||type==='g')pax={...pax,...parsePax(data)};else if(type==='L')longPath=data.toString('utf8').replace(/\0.*$/s,'').trim();else{const archiveName=pax.path||longPath||[prefix,name].filter(Boolean).join('/');pax={};longPath='';const relative=safeArchivePath(archiveName);if(relative){const packageRoot=path.resolve(extractDir,'package'),target=path.resolve(packageRoot,relative);if(target!==packageRoot&&!target.startsWith(`${packageRoot}${path.sep}`))throw new Error(`Unsafe archive path: ${archiveName}`);if(type==='5')await fsp.mkdir(target,{recursive:true});else if(type==='0'||type==='\0'){await fsp.mkdir(path.dirname(target),{recursive:true});await fsp.writeFile(target,data)}}}offset=dataStart+Math.ceil(size/512)*512}}
async function packAndExtract(npm,spec,temp,label){const packDir=path.join(temp,`${label}-pack`),extractDir=path.join(temp,`${label}-extract`);await fsp.mkdir(packDir,{recursive:true});await fsp.mkdir(extractDir,{recursive:true});const packed=run(npm,['pack',spec,'--ignore-scripts','--pack-destination',packDir]);const archiveName=String(packed.stdout||'').trim().split(/\r?\n/).filter(Boolean).at(-1);if(!archiveName)throw new Error(`npm pack did not return an archive name for ${spec}.`);const archive=path.resolve(packDir,archiveName);if(!await exists(archive))throw new Error(`Packed archive was not found: ${archive}`);await extractNpmTgz(archive,extractDir);return path.join(extractDir,'package')}
async function walk(directory){const rows=[];for(const entry of await fsp.readdir(directory,{withFileTypes:true})){const target=path.join(directory,entry.name);if(entry.isDirectory())rows.push(...await walk(target));else if(entry.isFile())rows.push(target)}return rows}
function browserRelative(from,to){let value=path.relative(path.dirname(from),to).split(path.sep).join('/');if(!value.startsWith('.'))value=`./${value}`;return value}
async function rewriteBareImports(coreDist,utilsEntry){let rewrites=0;for(const file of await walk(coreDist)){if(!/\.m?js$/i.test(file))continue;let text=await fsp.readFile(file,'utf8');const relative=browserRelative(file,utilsEntry),before=text;text=text.replace(/(['"])@litertjs\/wasm-utils\1/g,(_,quote)=>`${quote}${relative}${quote}`);if(text!==before){rewrites+=(before.match(/(['"])@litertjs\/wasm-utils\1/g)||[]).length;await fsp.writeFile(file,text,'utf8')}if(/(?:from\s*|import\s*\()(['"])(?:@litertjs\/wasm-utils)\1/.test(text))throw new Error(`Bare wasm-utils import remained in ${path.relative(coreDist,file)}.`)}return rewrites}
async function fileInventory(){const rows=[];for(const file of await walk(destination)){if(file===manifestPath)continue;const stat=await fsp.stat(file);rows.push({path:path.relative(destination,file).split(path.sep).join('/'),bytes:stat.size})}return rows}
async function staged(){if(!await exists(manifestPath))return false;try{const manifest=JSON.parse(await fsp.readFile(manifestPath,'utf8'));if(manifest.schema!==SCHEMA||manifest.corePackage!==CORE_PACKAGE||manifest.coreVersion!==CORE_VERSION||manifest.utilsPackage!==UTILS_PACKAGE||manifest.utilsVersion!==UTILS_VERSION)return false;if(manifest.maxCloudflareAssetBytes!==MAX_CLOUDFLARE_ASSET_BYTES||!Array.isArray(manifest.fileInventory))return false;const required=['dist/index.js','wasm','wasm-utils/dist/index.js'];if(!(await Promise.all(required.map(name=>exists(path.join(destination,name))))).every(Boolean))return false;return !manifest.fileInventory.some(row=>Number(row.bytes)>MAX_CLOUDFLARE_ASSET_BYTES)}catch{return false}}

async function main(){
  if(!force&&await staged()){console.log(`[Civweave] LiteRT-LM Web ${CORE_VERSION} runtime is already staged.`);return}
  const temp=await fsp.mkdtemp(path.join(os.tmpdir(),'civweave-litert-lm-'));
  try{
    const npm=process.platform==='win32'?'npm.cmd':'npm';
    const coreRoot=await packAndExtract(npm,`${CORE_PACKAGE}@${CORE_VERSION}`,temp,'core');
    const utilsRoot=await packAndExtract(npm,`${UTILS_PACKAGE}@${UTILS_VERSION}`,temp,'utils');
    const coreDist=path.join(coreRoot,'dist'),coreWasm=path.join(coreRoot,'wasm'),utilsDist=path.join(utilsRoot,'dist');
    for(const [label,target] of [['LiteRT-LM dist',coreDist],['LiteRT-LM wasm',coreWasm],['LiteRT wasm-utils dist',utilsDist]])if(!await exists(target))throw new Error(`${label} was not present in its npm package.`);
    await fsp.rm(destination,{recursive:true,force:true});
    await fsp.mkdir(destination,{recursive:true});
    await fsp.cp(coreDist,path.join(destination,'dist'),{recursive:true,force:true});
    await fsp.cp(coreWasm,path.join(destination,'wasm'),{recursive:true,force:true});
    await fsp.cp(utilsDist,path.join(destination,'wasm-utils','dist'),{recursive:true,force:true});
    const stagedCoreDist=path.join(destination,'dist'),utilsEntry=path.join(destination,'wasm-utils','dist','index.js');
    if(!await exists(utilsEntry))throw new Error('Staged @litertjs/wasm-utils entry is missing.');
    const rewrittenBareImports=await rewriteBareImports(stagedCoreDist,utilsEntry);
    const inventory=await fileInventory(),oversized=inventory.filter(row=>row.bytes>MAX_CLOUDFLARE_ASSET_BYTES);
    if(oversized.length)throw new Error(`LiteRT-LM Web ${CORE_VERSION} contains ${oversized.length} file(s) above Cloudflare Pages' 24 MiB asset limit:\n${oversized.map(row=>`- ${row.path}: ${row.bytes} bytes`).join('\n')}\nSplit or externalize these runtime assets before enabling this stage.`);
    const wasmFiles=inventory.map(row=>row.path).filter(name=>name.startsWith('wasm/'));
    if(!wasmFiles.some(name=>/\.wasm$/i.test(name))||!wasmFiles.some(name=>/\.m?js$/i.test(name)))throw new Error('LiteRT-LM staged WASM directory is incomplete.');
    const files=inventory.map(row=>row.path);
    await fsp.writeFile(manifestPath,`${JSON.stringify({schema:SCHEMA,corePackage:CORE_PACKAGE,coreVersion:CORE_VERSION,utilsPackage:UTILS_PACKAGE,utilsVersion:UTILS_VERSION,entry:'/app/vendor/litert-lm/dist/index.js',wasmRoot:'/app/vendor/litert-lm/wasm/',backend:'webgpu-gpu-artisan',selfHosted:true,rewrittenBareImports,wasmFiles,files,fileInventory:inventory,maxCloudflareAssetBytes:MAX_CLOUDFLARE_ASSET_BYTES,stagedAt:new Date().toISOString()},null,2)}\n`,'utf8');
    const totalBytes=inventory.reduce((sum,row)=>sum+row.bytes,0);
    console.log(`[Civweave] Staged self-hosted LiteRT-LM Web ${CORE_VERSION}: ${files.length} files, ${wasmFiles.length} WASM runtime files, ${totalBytes} bytes total, max asset ${Math.max(...inventory.map(row=>row.bytes))} bytes, ${rewrittenBareImports} bare import rewrite(s).`);
  }finally{await fsp.rm(temp,{recursive:true,force:true})}
}
main().catch(error=>{if(soft){console.warn(`[Civweave] LiteRT-LM Web staging skipped: ${error?.message||error}`);return}console.error(error);process.exitCode=1});

#!/usr/bin/env node

import {cpSync,existsSync,mkdirSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';

const args=process.argv.slice(2);
const valueFor=flag=>{const index=args.indexOf(flag);return index>=0?args[index+1]||'':''};
const sourceRoot=resolve(valueFor('--source')||'');
const upstreamCommit=valueFor('--commit');
const upstreamTree=valueFor('--tree');
const repoRoot=resolve(process.cwd());
if(!sourceRoot||!existsSync(sourceRoot))throw new Error('A valid --source directory is required.');
if(sourceRoot===repoRoot)throw new Error('The upstream source must be separate from the Guildkeeper repository.');

const readJson=path=>JSON.parse(readFileSync(path,'utf8'));
const sourceConfig=readJson(join(sourceRoot,'civweave-update.json'));
if(sourceConfig?.schema!=='civweave.guild-cloud-auto-update.v1')throw new Error('Upstream auto-update manifest is invalid.');
if(!Array.isArray(sourceConfig.managedPaths)||!sourceConfig.managedPaths.length)throw new Error('Upstream auto-update manifest has no managed paths.');

function safeRelative(value){
  const path=String(value||'').replaceAll('\\','/').replace(/^\/+|\/+$/g,'');
  if(!path||path==='.'||path.split('/').some(part=>part==='..'))throw new Error(`Unsafe managed path: ${value}`);
  return path;
}
function copyManaged(relative){
  const safe=safeRelative(relative),source=join(sourceRoot,safe),target=join(repoRoot,safe);
  if(!existsSync(source))throw new Error(`Managed upstream path is missing: ${safe}`);
  rmSync(target,{recursive:true,force:true});
  mkdirSync(dirname(target),{recursive:true});
  cpSync(source,target,{recursive:true,preserveTimestamps:false});
}
const managedPaths=[...sourceConfig.managedPaths].map(safeRelative).sort((left,right)=>Number(left==='.civweave')-Number(right==='.civweave'));
for(const path of managedPaths)copyManaged(path);

function stripJsonc(text){
  let out='',inString=false,escaped=false;
  for(let i=0;i<text.length;i+=1){
    const char=text[i],next=text[i+1];
    if(inString){out+=char;if(escaped)escaped=false;else if(char==='\\')escaped=true;else if(char==='"')inString=false;continue}
    if(char==='"'){inString=true;out+=char;continue}
    if(char==='/'&&next==='/'){while(i<text.length&&text[i]!=='\n')i+=1;out+='\n';continue}
    if(char==='/'&&next==='*'){i+=2;while(i<text.length-1&&!(text[i]==='*'&&text[i+1]==='/'))i+=1;i+=1;continue}
    out+=char;
  }
  return out;
}
function parseJsonc(path){return JSON.parse(stripJsonc(readFileSync(path,'utf8')))}
function mergeWrangler(){
  const sourcePath=join(sourceRoot,'wrangler.jsonc'),targetPath=join(repoRoot,'wrangler.jsonc');
  if(!existsSync(sourcePath)||!existsSync(targetPath))return;
  const upstream=parseJsonc(sourcePath),current=parseJsonc(targetPath),merged={...current};
  for(const key of sourceConfig.wranglerManagedKeys||[])if(Object.prototype.hasOwnProperty.call(upstream,key))merged[key]=upstream[key];
  if(upstream.vars||current.vars)merged.vars={...(upstream.vars||{}),...(current.vars||{})};
  for(const key of sourceConfig.wranglerPreservedKeys||[])if(Object.prototype.hasOwnProperty.call(current,key))merged[key]=current[key];
  writeFileSync(targetPath,`${JSON.stringify(merged,null,2)}\n`,'utf8');
}
mergeWrangler();

const lock={
  schema:'civweave.guild-cloud-auto-update-lock.v1',
  channel:String(sourceConfig.channel||'main'),
  sourceRepository:String(sourceConfig.sourceRepository||'cerbanimo-dev/Civweave'),
  sourcePath:String(sourceConfig.sourcePath||'cloudflare/mobile-guild-edge'),
  upstreamCommit:upstreamCommit||null,
  upstreamTree:upstreamTree||null,
  appliedAt:new Date().toISOString(),
};
writeFileSync(join(repoRoot,'civweave-update-lock.json'),`${JSON.stringify(lock,null,2)}\n`,'utf8');
console.log(JSON.stringify({ok:true,schema:lock.schema,channel:lock.channel,upstreamCommit:lock.upstreamCommit,upstreamTree:lock.upstreamTree}));

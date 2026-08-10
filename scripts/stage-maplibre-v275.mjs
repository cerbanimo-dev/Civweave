#!/usr/bin/env node

import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE=dirname(fileURLToPath(import.meta.url));
const ROOT=resolve(HERE,'..');
const OUT=resolve(ROOT,'public/app/vendor/maplibre-v5.13.0');
const ASSETS=[
  {name:'maplibre-gl.js',url:'https://unpkg.com/maplibre-gl@5.13.0/dist/maplibre-gl.js',minBytes:500000},
  {name:'maplibre-gl.css',url:'https://unpkg.com/maplibre-gl@5.13.0/dist/maplibre-gl.css',minBytes:20000}
];

async function valid(path,minBytes){
  if(!existsSync(path))return false;
  try{return (await readFile(path)).byteLength>=minBytes}catch{return false}
}
async function fetchAsset(asset){
  const response=await fetch(asset.url,{headers:{'user-agent':'Civweave-MapLibre-Stager/1.0'}});
  if(!response.ok)throw new Error(`${asset.url} → HTTP ${response.status}`);
  const bytes=Buffer.from(await response.arrayBuffer());
  if(bytes.byteLength<asset.minBytes)throw new Error(`${asset.name} unexpectedly small (${bytes.byteLength} bytes)`);
  await writeFile(resolve(OUT,asset.name),bytes);
  return bytes.byteLength;
}

await mkdir(OUT,{recursive:true});
const report=[];
for(const asset of ASSETS){
  const path=resolve(OUT,asset.name);
  if(await valid(path,asset.minBytes)){report.push({asset:asset.name,staged:false,cached:true});continue}
  try{const bytes=await fetchAsset(asset);report.push({asset:asset.name,staged:true,bytes})}
  catch(error){
    report.push({asset:asset.name,staged:false,error:error.message});
    console.warn(`[Civweave map] Could not stage ${asset.name}: ${error.message}. Browser CDN fallback remains available while online.`);
  }
}
console.log(JSON.stringify({ok:report.some(row=>row.staged||row.cached),renderer:'maplibre-gl@5.13.0',assets:report},null,2));

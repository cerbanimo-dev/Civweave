#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createZipArchive} from './portable-zip.mjs';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const ROOT=path.resolve(HERE,'..');
const PUBLIC=path.join(ROOT,'public');
const DOWNLOADS=path.join(PUBLIC,'downloads');
const CONTRACT=path.join(PUBLIC,'app','civweave-map-v1-manifest.json');
const ATLAS=path.join(PUBLIC,'app','federation-finder-data','atlas-v274','manifest.json');
const ARCHIVE=path.join(DOWNLOADS,'Civweave-Map-v1.zip');
const CHECKSUM=`${ARCHIVE}.sha256`;
const CLOUDFLARE_LIMIT=24*1024*1024;

function run(script){const result=spawnSync(process.execPath,[path.join(HERE,script)],{cwd:ROOT,stdio:'inherit'});if(result.error)throw result.error;if(result.status!==0)throw new Error(`${script} failed with exit code ${result.status}.`)}
async function hashFile(file){const bytes=await fs.readFile(file);return{bytes:bytes.byteLength,sha256:crypto.createHash('sha256').update(bytes).digest('hex')}}
async function copyAsset(asset,destination,files){
  const normalized=asset==='/finder'?'/finder/index.html':asset;const relative=normalized.replace(/^\//,'');const source=path.join(PUBLIC,relative),stat=await fs.stat(source).catch(()=>null);if(!stat?.isFile())throw new Error(`Civweave Map v1 asset is missing: ${normalized}`);
  const target=path.join(destination,relative);await fs.mkdir(path.dirname(target),{recursive:true});await fs.copyFile(source,target);files.push({path:`/${relative}`,...await hashFile(target)});
}

run('stage-maplibre-v275.mjs');
run('stage-federation-finder-data-v274.mjs');
const contract=JSON.parse(await fs.readFile(CONTRACT,'utf8'));
if(contract?.name!=='Civweave Map'||contract?.version!=='1.0.0')throw new Error('Civweave Map v1 package contract is invalid.');
const atlas=JSON.parse(await fs.readFile(ATLAS,'utf8'));
await fs.mkdir(DOWNLOADS,{recursive:true});
const work=await fs.mkdtemp(path.join(os.tmpdir(),'civweave-map-v1-'));
try{
  const root=path.join(work,'civweave-map-v1');await fs.mkdir(root,{recursive:true});const files=[];
  for(const asset of contract.assets||[])await copyAsset(asset,root,files);
  await copyAsset('/app/civweave-map-v1-manifest.json',root,files);
  const readme=`# Civweave Map v1\n\nCivweave Map v1 is the portable Federation Finder map runtime. Serve this directory over HTTP and open \`${contract.entry}\`.\n\n## Offline behavior\n\n- MapLibre and PMTiles are packaged locally; no CDN is required for the map runtime.\n- The bundled federation seed keeps coordinate-based discovery available on a clean offline start.\n- A local coordinate-field basemap appears when no downloaded PMTiles region is available.\n- Federated PMTiles regions are streamed into chunked IndexedDB storage, SHA-256 verified, and rendered directly from that local store.\n- The full pinned federation atlas is a deployment-hydrated dataset rather than part of this compact portable ZIP. Its source commit is recorded in package metadata.\n\n## Privacy\n\nDevice geolocation is session-only and is never automatically published to the Civweave mesh. Only explicitly public locality and node metadata federate.\n\n## Node freshness\n\nFederated node-location status is marked stale after six hours and expires after twenty-four hours unless refreshed.\n`;
  await fs.writeFile(path.join(root,'README.md'),readme,'utf8');files.push({path:'/README.md',...await hashFile(path.join(root,'README.md'))});
  const packageManifest={...contract,builtAt:new Date().toISOString(),atlas:{schema:atlas.schema,source:atlas.source,featureCount:atlas.featureCount,edgeCount:atlas.edgeCount,hydration:'deployment/offline-package'},files};
  await fs.writeFile(path.join(root,'manifest.json'),`${JSON.stringify(packageManifest,null,2)}\n`,'utf8');
  await fs.rm(ARCHIVE,{force:true});await fs.rm(CHECKSUM,{force:true});await createZipArchive(ARCHIVE,work,'civweave-map-v1',{level:9});const archiveInfo=await hashFile(ARCHIVE);
  if(archiveInfo.bytes>CLOUDFLARE_LIMIT)throw new Error(`Civweave Map v1 archive is ${(archiveInfo.bytes/1024/1024).toFixed(2)} MiB and exceeds the 24 MiB Cloudflare release boundary.`);
  await fs.writeFile(CHECKSUM,`${archiveInfo.sha256}  ${path.basename(ARCHIVE)}\n`,'utf8');
  console.log(JSON.stringify({ok:true,name:'Civweave Map',version:'1.0.0',archive:path.relative(ROOT,ARCHIVE),bytes:archiveInfo.bytes,sha256:archiveInfo.sha256,assets:files.length,atlasFeatureCount:atlas.featureCount},null,2));
}finally{await fs.rm(work,{recursive:true,force:true})}

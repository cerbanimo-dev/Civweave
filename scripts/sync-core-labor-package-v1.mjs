import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const publicDir=path.join(root,'public');
const rootWorkerPath=path.join(publicDir,'service-worker.js');
const offlineManifestPath=path.join(publicDir,'app','offline-package-v208.json');

export const CORE_LABOR_ASSETS=[
  '/app/learning-pack-seeds-v1.js',
  '/app/shared/learning-pack-runtime-v1.mjs',
  '/app/shared/learning-pack-resolver-v1.mjs',
  '/app/shared/learning-pack-shelf-v1.mjs',
  '/app/shared/learning-pack-shelf-v1.css',
  '/app/shared/core-practice-pack-v1.mjs',
  '/app/shared/expert-pack-library-v1.mjs',
  '/app/shared/skill-crosswalk-v1.mjs',
  '/app/shared/labor-intelligence-core-v1.mjs',
  '/app/cerbanimo-learning-packs-v1.js',
  '/app/living-school-learning-packs-v1.mjs',
  '/app/services/fellowfare/labor-context-v1.mjs',
  '/downloads/learning-packs/catalog.json',
  '/downloads/learning-packs/onet-labor-atlas-30-3.json.gz',
  '/downloads/learning-packs/esco-skill-crosswalk-v1.json.gz'
];
const EXPLICIT_BUDGET_ASSETS=new Set([
  '/downloads/learning-packs/catalog.json',
  '/downloads/learning-packs/onet-labor-atlas-30-3.json.gz',
  '/downloads/learning-packs/esco-skill-crosswalk-v1.json.gz'
]);

const unique=values=>[...new Set(values)];
const localPath=url=>path.join(publicDir,String(url).replace(/^\/+/,''));

async function assertAssets(){
  const rows=[];
  for(const url of CORE_LABOR_ASSETS){
    const stat=await fs.stat(localPath(url)).catch(()=>null);
    if(!stat?.isFile())throw new Error(`Core labor package asset is missing: ${url}`);
    rows.push({url,bytes:stat.size});
  }
  return rows;
}

function patchPortableWorker(source){
  const missing=CORE_LABOR_ASSETS.filter(url=>!source.includes(`'${url}'`));
  if(!missing.length)return source;
  const marker="  '/app/logos/civweave.webp'";
  const index=source.indexOf(marker);
  if(index<0)throw new Error('Could not locate portable-worker CORE insertion point.');
  const insertion=missing.map(url=>`  '${url}',`).join('\n')+'\n';
  return `${source.slice(0,index)}${insertion}${source.slice(index)}`;
}

async function syncPortableWorker(){
  const before=await fs.readFile(rootWorkerPath,'utf8'),after=patchPortableWorker(before);
  if(after!==before)await fs.writeFile(rootWorkerPath,after,'utf8');
  return after!==before;
}

async function syncOfflineManifest(assetRows){
  const manifest=JSON.parse(await fs.readFile(offlineManifestPath,'utf8'));
  manifest.payloadPolicy='core-first-lazy-packs-v302-core-labor-v1';
  manifest.description='Compact Civweave offline core with canonical realm surfaces, deterministic local work, and lazy core O*NET/ESCO labor intelligence. Large media, full federation discovery, decorative visuals, and device-AI model payloads remain optional.';
  manifest.assets=unique([...(manifest.assets||[]),...CORE_LABOR_ASSETS]);
  const explicitBytes=assetRows.filter(row=>EXPLICIT_BUDGET_ASSETS.has(row.url)).reduce((sum,row)=>sum+row.bytes,0);
  manifest.preflight={...(manifest.preflight||{}),explicitCoreLaborBytes:explicitBytes,requiredFreeBytes:Number(manifest.preflight?.requiredFreeBytes||0)+explicitBytes};
  await fs.writeFile(offlineManifestPath,`${JSON.stringify(manifest,null,2)}\n`);
  return{assetCount:manifest.assets.length,explicitBytes};
}

const rows=await assertAssets();
const workerChanged=await syncPortableWorker();
const offline=await syncOfflineManifest(rows);
console.log(JSON.stringify({ok:true,revision:'core-labor-package-v1',workerChanged,coreLaborAssetCount:rows.length,offline},null,2));

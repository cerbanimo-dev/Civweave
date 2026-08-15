#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here=dirname(fileURLToPath(import.meta.url));
const root=resolve(here,'..');
const catalog=JSON.parse(readFileSync(resolve(root,'public/app/asset-lockboard-catalog-v239.json'),'utf8'));
const generatedPrefix='/app/assets/generated/';
const generated=catalog.assets.filter(asset=>asset.path.startsWith(generatedPrefix));
const unusedGenerated=generated.filter(asset=>Number(asset.usageCount||0)===0);
const usedGenerated=generated.filter(asset=>Number(asset.usageCount||0)>0);
const missing=(catalog.slots||[]).filter(slot=>slot.exists===false);
const groups=new Map();
for(const asset of unusedGenerated){
  const group=asset.path.slice(generatedPrefix.length).split('/')[0]||'(root)';
  const row=groups.get(group)||{group,files:0,bytes:0};
  row.files+=1;
  row.bytes+=Number(asset.bytes||0);
  groups.set(group,row);
}
const report={
  schema:'civweave.image-reference-audit.v1',
  catalogGeneratedAt:catalog.generatedAt,
  assetCount:catalog.assetCount,
  slotCount:catalog.slotCount,
  missingReferenceCount:missing.length,
  generatedAssetCount:generated.length,
  usedGeneratedAssetCount:usedGenerated.length,
  unusedGeneratedAssetCount:unusedGenerated.length,
  unusedGeneratedBytes:unusedGenerated.reduce((sum,asset)=>sum+Number(asset.bytes||0),0),
  unusedGeneratedGroups:[...groups.values()].sort((a,b)=>b.bytes-a.bytes||a.group.localeCompare(b.group)),
  missingReferences:missing.map(slot=>({sourcePath:slot.sourcePath,line:slot.line,raw:slot.raw,assetPath:slot.assetPath}))
};
console.log(JSON.stringify(report,null,2));
if(process.argv.includes('--strict')&&missing.length){
  console.error(`Image reference audit found ${missing.length} unresolved static image reference(s).`);
  process.exit(1);
}

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import media,{licenseAllowed} from '../public/app/open-learning-media-cache-v1.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const lookup=JSON.parse(fs.readFileSync(path.join(root,'public/downloads/knowledge-schools/open-learning-media/lookup.json'),'utf8'));
const policy=media.POLICY_PRESETS['learning-path'];
const packs=(lookup.packs||[]).filter(pack=>pack?.available!==false);
const topics=[...new Set(packs.flatMap(pack=>pack?.topics||[]).filter(Boolean))];
let upperBoundBytes=0;
let downloadableTopics=0;
const skipped=[];
for(const slug of topics){
  const sizes=(lookup.topics?.[slug]||[])
    .filter(record=>record?.cache_policy==='MESH_REDISTRIBUTABLE'&&licenseAllowed(record?.license))
    .flatMap(record=>(record.files||[]).map(file=>Number(file?.bytes)||0))
    .filter(bytes=>bytes>0&&bytes<=policy.maxAutomaticItemBytes);
  if(!sizes.length){skipped.push(slug);continue}
  downloadableTopics++;
  upperBoundBytes+=Math.min(...sizes);
}
assert(downloadableTopics>0,'No auto-downloadable topics were found across available packs.');
assert(
  upperBoundBytes<=policy.budgetBytes,
  `All-pack automatic floor ${upperBoundBytes} exceeds Learning Path budget ${policy.budgetBytes}. Increase the budget or reduce automatic selections before claiming every available pack can fill itself.`
);
console.log(JSON.stringify({
  availablePacks:packs.length,
  uniqueTopics:topics.length,
  downloadableTopics,
  noAutomaticSizeDirectFileTopics:skipped,
  automaticFloorBytesUpperBound:upperBoundBytes,
  learningPathBudgetBytes:policy.budgetBytes,
  headroomBytes:policy.budgetBytes-upperBoundBytes,
},null,2));

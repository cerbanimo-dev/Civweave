import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const worker=read('public/service-worker-v156.js');
const loader=read('public/app/family-ai-loader-v105.js');
const rook=read('public/app/rook-request-flow-v160.js');

for(const path of [
  'public/app/fast-interactive-runtime-v192.js',
  'public/app/reward-policy-v198.js',
  'public/app/context-plan-composer-v198.js',
])assert.ok(fs.existsSync(path),`${path} must exist in the repository`);

assert.match(worker,/working-campus-additions-v197-assistant-runtime-package/,'the additive package revision must rotate');
for(const asset of [
  '/app/fast-interactive-runtime-v192.js',
  '/app/reward-policy-v198.js',
  '/app/context-plan-composer-v198.js',
])assert.ok(worker.includes(`'${asset}'`),`${asset} must be guaranteed by the installed package`);

assert.match(loader,/const FAST_RUNTIME=\['\/app\/fast-interactive-runtime-v192\.js/,'the shared loader must request the packaged fast runtime');
assert.match(rook,/await loader\.ensure\(\)/,'Rook must use the shared assistant loader');
assert.match(rook,/The request stayed private and no market record was created/,'Rook must preserve privacy when loading fails');

for(const forbidden of [
  'model-settings-controller-v173.js',
  'unified-ai-settings-v175.js',
  'commonweave-model-profiles-v1',
  'commonweave.universal-ai.v127',
])assert.ok(!worker.includes(forbidden),`assistant package repair must not initialize or rewrite settings through ${forbidden}`);

console.log(JSON.stringify({
  ok:true,
  revision:'rook-assistant-package-v197',
  packagedAssets:3,
  settingsBoundary:'untouched',
  requestFailurePrivacy:'preserved',
},null,2));

import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [policy,settings]=await Promise.all([
  read('public/app/local-ai/download-policy-v278.js'),
  read('public/app/local-ai/settings-panel-v267.js')
]);

for(const source of [policy,settings])new Function(source);

for(const id of ['gemma3-1b-it-q4f16','qwen3-0.6b-q4f16']){
  assert.ok(policy.includes(id),`download policy lost foreground phone model ${id}`);
  assert.ok(settings.includes(id),`settings download path lost foreground phone model ${id}`);
}
assert.match(policy,/const FOREGROUND_PHONE_MODELS=/);
assert.match(policy,/forceForeground/);
assert.match(policy,/base\.start\(id,\{\.\.\.options,preferBackground:false\}\)/);
assert.match(policy,/queueMicrotask\(\(\)=>sync\(\)\.catch/,'stale background jobs must be reconciled as soon as the policy loads');
assert.match(settings,/function foregroundDownload/);
assert.match(settings,/M\(\)\.start\(id,\{preferBackground:!foregroundDownload\(x\)\}\)/,'settings must pass the foreground decision directly so it cannot race policy loading');

console.log(JSON.stringify({
  ok:true,
  revision:'phone-model-download-foreground-v311',
  models:['gemma3-1b-it-q4f16','qwen3-0.6b-q4f16'],
  settingsRaceClosed:true,
  backgroundFetchDisabledForPhoneModels:true,
  staleBackgroundReconciliation:true
},null,2));

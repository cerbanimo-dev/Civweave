import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=path=>fs.readFileSync(path,'utf8');
const installed=read('public/app/installed-entry-v146.js');
const family=read('public/app/fullscreen-family-v104.html');
const campus=read('public/app/working-campus-v156.html');

assert.match(installed,/(?:working-campus-v156|fullscreen-family-v104)\.html/,'installed entry must route to an active Civweave boot path');
assert.match(family,/working-campus-v156\.html/,'current family entry must route Civweave to Working Campus');
const match=campus.match(/<script id="working-campus-planner-v199">([\s\S]*?)<\/script>/);
assert(match,'Working Campus must contain the v199 planner integration');
assert(campus.indexOf('/app/working-campus-v156.js')<campus.indexOf('working-campus-planner-v199'),'planner integration must load after the current Working Campus runtime');
new vm.Script(match[1],{filename:'working-campus-planner-v199.inline.js'});
const source=match[1];
for(const required of [
  "event.target.closest?.('#build-plan')",
  'event.stopImmediatePropagation()',
  "kind:'learning'",
  "kind:'project'",
  "kind:'market'",
  'composer.composePath',
  "miniLMRole:'template-ranking-only'",
  "settingsBoundary:'unchanged'",
  'task.deliverable',
  'CivweaveRewardPolicyV198',
  'civweave:working-campus-plan-built'
])assert(source.includes(required),`missing active planner marker: ${required}`);
for(const forbidden of [
  'model-settings-controller-v173.js',
  'unified-ai-settings-v175.js',
  'minilm-model-settings-v138.js',
  'civweave-model-download-v157.js',
  "localStorage.setItem('civweave.universal-ai.v127'",
  "localStorage.setItem('civweave-model-profiles-v1'",
  '.prewarm('
])assert(!source.includes(forbidden),`Working Campus planner must not initialize or mutate model settings: ${forbidden}`);
assert.deepEqual([...source.matchAll(/\/app\/(?:reward-policy-v198|context-plan-composer-v198)\.js/g)].map(match=>match[0]),['/app/reward-policy-v198.js','/app/context-plan-composer-v198.js'],'only the planner and reward policy may be lazy-loaded by the button integration');
console.log('Working Campus v199 planner is active, substantive, and isolated from the MiniLM settings UI.');

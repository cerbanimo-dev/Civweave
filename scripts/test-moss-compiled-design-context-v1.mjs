import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {sourcePacket,renderedPacket} from './build-moss-context-pack-v1.mjs';
import {MOSS_DESIGN_STAGE_CONTEXT_V1 as compiled} from '../public/app/ai-workflows/compiled/moss-design-context-v1.mjs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('compiled design stage exactly matches approved local source, with correct newlines',()=>{
  const current=sourcePacket();
  assert.deepEqual(compiled,current);
  assert.equal(read('public/app/ai-workflows/compiled/moss-design-context-v1.mjs'),renderedPacket());
  assert.ok(compiled.instructions.includes('## Procedure\n1. Define prerequisites'));
  assert.ok(compiled.instructions.includes('\n\n## Acceptance\n'));
  assert.equal(compiled.owner,'living-school');
  assert.equal(compiled.nextStage,'compile');
  assert.deepEqual(compiled.outputs,['learning-design.md','assessment-plan.json']);
});
test('generated stage instructions inherit canonical boundaries and exclude untrusted research text',()=>{
  assert.match(compiled.constraints.join('\n'),/lower-trust evidence/);
  assert.match(compiled.constraints.join('\n'),/Do not invent SOURCE_IDs/);
  assert.match(compiled.constraints.join('\n'),/cannot approve, persist, or award/);
  assert.doesNotMatch(compiled.instructions,/https?:\/\/|apiKey|tokenSecret|provider\s*:/i);
  assert.ok(compiled.instructions.length<2400);
});
test('Moss loads only the packaged compiled stage after approval, without taking model ownership',()=>{
  const core=read('public/app/cabinets/living-school/living-school-cleanroom-core-v218.mjs');
  const compact=core.slice(core.indexOf('async function generateDesignPacket'),core.indexOf('function moduleIssues('));
  assert.match(compact,/await import\('\.\.\/\.\.\/ai-workflows\/compiled\/moss-design-context-v1\.mjs'\)/);
  assert.match(compact,/source:'offline-stage-context-unavailable'/);
  assert.match(compact,/stagePacket\.instructions/);
  assert.match(compact,/await runtime\.generate\(request\)/);
  assert.doesNotMatch(compact,/localStorage|setItem|fetch\(/);
  const worker=read('public/service-worker.js');
  assert.match(worker,/const CORE=\[[\s\S]*?'\/app\/ai-workflows\/compiled\/moss-design-context-v1\.mjs'/);
  const build=read('scripts/build-install-artifacts.sh');
  assert.match(build,/build-moss-context-pack-v1\.mjs" --check/);
});
test('compiled stage verification exits nonzero on stale or mismatched source',()=>{
  const result=spawnSync(process.execPath,['scripts/build-moss-context-pack-v1.mjs','--check'],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
});

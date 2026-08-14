import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const read = p => fs.readFileSync(p, 'utf8');
const need = (ok, msg) => { if (!ok) throw new Error(msg); };
const director = read('public/app/avatar-expression-director-v343.js');
const router = read('public/app/minilm-context-router-v344.js');
const settings = read('public/app/model-settings-v133.js');
for (const marker of [
  "classifierModel:'Xenova/all-MiniLM-L6-v2'",
  "contextContract:'civweave.emotion-context.v1'",
  'minimumHoldMs:1300',
  'civweave:emotion-context',
  'civweave:chat-model-failed',
  "assetEncoding:'transparent-rle-v315'"
]) need(director.includes(marker), `missing director marker: ${marker}`);
for (const obsolete of ['smollm2-135m-avatar-q8-wasm','SmolLM2 135M Avatar Director','cw-avatar-model-row-v343']) need(!director.includes(obsolete), `obsolete avatar helper remains: ${obsolete}`);
for (const marker of [
  '/app/models/all-minilm-l6-v2/adapter.js',
  'civweave.emotion-context.v1',
  'installIfMissing:false',
  'invisibleInfrastructure:true',
  'settingsAutostart:false',
  'installRuntimeInterceptor',
  'civweave:semantic-route',
  'civweave:minilm-package-needed'
]) need(router.includes(marker), `missing router marker: ${marker}`);
need(!router.includes('installIfMissing:true'), 'semantic routing must not silently install MiniLM');
need(settings.includes('<option value="bundled">Onboard SmolLM2 360M</option>'), 'SmolLM2 must remain the bundled local chat option');
need(settings.includes("const MODEL_ID='HuggingFaceTB/SmolLM2-360M-Instruct'"), 'SmolLM2 360M must remain the bundled local model');
for (const p of ['public/app/minilm-context-router-v344.js','public/app/avatar-expression-director-v343.js']) execFileSync(process.execPath, ['--check', p], { stdio: 'inherit' });
console.log('PASS MiniLM context router migration.');

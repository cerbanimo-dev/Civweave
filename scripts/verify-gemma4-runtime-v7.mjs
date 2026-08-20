import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const stagePath='scripts/stage-transformers-v4-assets.mjs';
const streamPath='public/app/guide-stream-thinking-v249.js';
const loaderPath='public/app/shared-guide-surface-v236.js';
const repairPath='public/app/local-ai/gemma4-inference-repair-v1.js';
const bundlePath='public/app/vendor/transformers-v4/transformers.min.js';

for(const path of [stagePath,streamPath,loaderPath,repairPath])execFileSync(process.execPath,['--check',path],{stdio:'inherit'});
const stage=fs.readFileSync(stagePath,'utf8');
const stream=fs.readFileSync(streamPath,'utf8');
const loader=fs.readFileSync(loaderPath,'utf8');
const repair=fs.readFileSync(repairPath,'utf8');
const bundle=fs.readFileSync(bundlePath,'utf8');

const bug=/(\.inputNames\.includes\("num_logits_to_keep"\)&&![A-Za-z_$][\w$]*\.num_logits_to_keep&&\([A-Za-z_$][\w$]*\.num_logits_to_keep=new [A-Za-z_$][\w$]*\("int64",)\[0n\](,\[\]\)\))/g;
const matches=[...bundle.matchAll(bug)];
bug.lastIndex=0;
assert.ok(matches.length===1||matches.length===0,`unexpected Transformers.js num_logits_to_keep=0 decoder sites: ${matches.length}`);
const simulated=matches.length===1?bundle.replace(bug,'$1[1n]$2'):bundle;
bug.lastIndex=0;
assert.equal(bug.test(simulated),false,'the staging backport does not eliminate the Gemma full-prompt logits path');
assert.ok(simulated.includes('num_logits_to_keep'),'Transformers.js bundle has no num_logits_to_keep contract');

assert.ok(stage.includes("STAGE_SCHEMA='civweave.transformers-stage.v7'"),'Transformers v4 staging schema is not v7');
assert.ok(stage.includes("GEMMA4_LOGITS_BACKPORT='huggingface-transformers-js-pr-1681'"),'upstream Gemma logits backport marker missing');
assert.ok(stage.includes("backportGemma4NextTokenLogits(entryText)"),'stager is not applying the upstream next-token logits backport');
assert.ok(stage.includes("gemma4NumLogitsToKeep:1"),'staged runtime manifest does not record one-logit decode');
assert.ok(stage.includes("matches.length!==1"),'stager does not fail closed on an ambiguous minified patch');

assert.ok(repair.includes("VERSION='1.0.2-gemma4-inference-repair-v1-runtime-v7'"),'Gemma runtime repair revision is stale');
assert.ok(repair.includes("V4_STAGE_SCHEMA='civweave.transformers-stage.v7'"),'runtime repair does not require the v7 bundle');
assert.ok(repair.includes("V4_BUNDLE_PATH='/app/vendor/transformers-v4/transformers.min.js'"),'runtime repair does not evict the cached Transformers v4 bundle');
assert.ok(repair.includes('verifyPatchedV4Runtime'),'runtime repair does not validate the served bundle before generation');
assert.ok(repair.includes('gemma4UpstreamLogitsBackport:true'),'local runtime does not expose the upstream performance repair');

assert.ok(stream.includes("VERSION='1.0.124-guide-stream-thinking-v249-finalization-guard'"),'stream finalization guard revision is stale');
assert.ok(stream.includes('function threadPending(system)'),'stream renderer does not consult canonical pending state');
assert.ok(stream.includes('finalizationGuard:true'),'stream finalization guard diagnostic missing');
assert.ok(stream.includes('stalePaintFinalizationSafe:true'),'stale RAF paint safety diagnostic missing');
assert.ok(stream.includes("if(!state.done&&!threadPending(system)){finalizeIfDone(system);return}"),'stale partial paint can still overwrite the canonical final answer');

assert.ok(loader.includes('/app/local-ai/gemma4-inference-repair-v1.js?v=1.0.2-runtime-v7'),'shared guide loader is not cache-busting the v7 Gemma runtime repair');
assert.ok(loader.includes('/app/guide-stream-thinking-v249.js?v=1.0.124-finalization-guard'),'shared guide loader is not cache-busting the finalization-safe stream renderer');
assert.ok(loader.includes('gemma4UpstreamLogitsBackport:true'),'shared guide diagnostics do not expose the upstream Gemma fix');
assert.ok(loader.includes('streamFinalizationGuard:true'),'shared guide diagnostics do not expose finalization safety');
const authorityIndex=loader.indexOf('/app/local-provider-authority-v1.js');
const controlIndex=loader.indexOf('/app/local-guide-control-bypass-v1.js');
const streamIndex=loader.indexOf('/app/guide-stream-thinking-v249.js');
assert.ok(authorityIndex>=0&&controlIndex>authorityIndex&&streamIndex>controlIndex,'local guide wrapper order is not authority -> control bypass -> stream');

console.log('PASS Gemma 4 runtime v7 backports next-token-only logits and guide streaming cannot blank the canonical final answer.');

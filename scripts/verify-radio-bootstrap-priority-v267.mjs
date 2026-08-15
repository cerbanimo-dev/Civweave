import fs from 'node:fs';
import assert from 'node:assert/strict';

const ROOT=new URL('../',import.meta.url);
const runtime=fs.readFileSync(new URL('public/app/core-interface-runtime-v1.js',ROOT),'utf8');

const match=runtime.match(/const SHARED_BOOT_SCRIPTS=Object\.freeze\(\[([\s\S]*?)\n\]\);/);
assert.ok(match,'core interface runtime shared boot manifest must exist');

const entries=[...match[1].matchAll(/^\s{2}'([^']+)',?\s*$/gm)].map(item=>item[1]);
const orchestratorIndex=entries.indexOf('/app/experience-orchestrator-v232.js');
const radioIndex=entries.indexOf('/app/system-radio-agent-v233.js');
const trackIndex=entries.indexOf('/app/radio-track-suggestions-v240.js');
const meshIndex=entries.indexOf('/app/civweave-systems-mesh-v251.js');

assert.ok(orchestratorIndex>=0,'experience orchestrator must be present');
assert.equal(radioIndex,orchestratorIndex+1,'radio station must bootstrap immediately after the orchestrator');
assert.equal(trackIndex,radioIndex+1,'exact-track suggestions must bootstrap immediately after the radio station');
assert.ok(meshIndex>trackIndex,'radio station and exact-track scripts must bootstrap before slower shared mesh modules');

assert.equal(entries.filter(entry=>entry==='/app/system-radio-agent-v233.js').length,1,'radio agent must be assembled exactly once');
assert.equal(entries.filter(entry=>entry==='/app/radio-track-suggestions-v240.js').length,1,'track decorator must be assembled exactly once');
assert.match(runtime,/const SHARED_BOOT_SCRIPTS=Object\.freeze\(\[/,'shared load order must be owned by the core interface runtime');

console.log('Civweave radio bootstrap priority contract verified.');

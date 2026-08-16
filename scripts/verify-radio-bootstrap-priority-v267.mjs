import fs from 'node:fs';
import assert from 'node:assert/strict';

const ROOT=new URL('../',import.meta.url);
const boundary=fs.readFileSync(new URL('public/app/install-boundary-v146.js',ROOT),'utf8');

const match=boundary.match(/const SYSTEM_EXPERIENCE_SCRIPTS=\[([^\]]+)\];/);
assert.ok(match,'shared system experience script registry must exist');

const entries=match[1].split(',').map(item=>item.trim()).filter(Boolean);
const orchestratorIndex=entries.indexOf('EXPERIENCE_ORCHESTRATOR');
const radioIndex=entries.indexOf('SYSTEM_RADIO_AGENT');
const trackIndex=entries.indexOf('RADIO_TRACK_SUGGESTIONS');
const meshIndex=entries.indexOf('SYSTEMS_MESH_RUNTIME');

assert.ok(orchestratorIndex>=0,'experience orchestrator must be present');
assert.equal(radioIndex,orchestratorIndex+1,'radio station must bootstrap immediately after the orchestrator');
assert.equal(trackIndex,radioIndex+1,'exact-track compatibility helper must bootstrap immediately after the radio station owner');
assert.ok(meshIndex>trackIndex,'radio station scripts must bootstrap before slower shared mesh modules');

assert.equal(entries.filter(entry=>entry==='SYSTEM_RADIO_AGENT').length,1,'radio agent must be injected exactly once');
assert.equal(entries.filter(entry=>entry==='RADIO_TRACK_SUGGESTIONS').length,1,'track compatibility helper must be injected exactly once');
assert.ok(
  boundary.indexOf("const SYSTEM_RADIO_AGENT='/app/system-radio-agent-v233.js'")<boundary.indexOf('const SYSTEM_EXPERIENCE_SCRIPTS=['),
  'radio agent path must be declared before the experience registry'
);
assert.ok(
  boundary.indexOf("const RADIO_TRACK_SUGGESTIONS='/app/radio-track-suggestions-v240.js'")<boundary.indexOf('const SYSTEM_EXPERIENCE_SCRIPTS=['),
  'track helper path must be declared before the experience registry'
);

console.log('Civweave radio bootstrap priority contract verified for compact experience registry.');

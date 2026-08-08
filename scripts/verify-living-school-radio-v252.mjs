import fs from 'node:fs';
import assert from 'node:assert/strict';

const ROOT=new URL('../',import.meta.url);
const entry=fs.readFileSync(new URL('public/app/cabinets/living-school/index.html',ROOT),'utf8');

const agent='/app/system-radio-agent-v233.js';
const tracks='/app/radio-track-suggestions-v240.js';
const boundary='/app/install-boundary-v146.js';

assert.match(entry,/data-civweave-system="living-school"/,'Living School must declare its canonical system ID before shared boot');
assert.match(entry,/<script src="\/app\/system-radio-agent-v233\.js\?[^\"]+" defer><\/script>/,'Living School must load the station recommendation agent directly');
assert.match(entry,/<script src="\/app\/radio-track-suggestions-v240\.js\?[^\"]+" defer><\/script>/,'Living School must load the exact-track decorator directly');
assert.ok(entry.indexOf(agent)<entry.indexOf(tracks),'station agent must be declared before the exact-track decorator');
assert.ok(entry.indexOf(tracks)<entry.indexOf(boundary),'Living School radio scripts must be present in the parsed head before install-boundary dedupe runs');
assert.equal((entry.match(/system-radio-agent-v233\.js/g)||[]).length,1,'Living School entry must declare the station agent once');
assert.equal((entry.match(/radio-track-suggestions-v240\.js/g)||[]).length,1,'Living School entry must declare the track decorator once');

console.log('Living School direct radio bootstrap contract verified.');

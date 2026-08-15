import fs from 'node:fs';
import assert from 'node:assert/strict';

const ROOT=new URL('../',import.meta.url);
const entry=fs.readFileSync(new URL('public/app/cabinets/living-school/index.html',ROOT),'utf8');
const runtime=fs.readFileSync(new URL('public/app/core-interface-runtime-v1.js',ROOT),'utf8');

const agent='/app/system-radio-agent-v233.js';
const tracks='/app/radio-track-suggestions-v240.js';
const boundary='/app/install-boundary-v146.js';

assert.match(entry,/data-civweave-system="living-school"/,'Living School must declare its canonical system ID before shared boot');
assert.match(entry,/<script src="\/app\/install-boundary-v146\.js"><\/script>/,'Living School must enter shared boot through the install boundary');
assert.doesNotMatch(entry,/system-radio-agent-v233\.js/,'Living School must not bypass the core runtime with a direct station-agent preload');
assert.doesNotMatch(entry,/radio-track-suggestions-v240\.js/,'Living School must not bypass the core runtime with a direct track-decorator preload');
assert.doesNotMatch(entry,/themed-system-nav-v178\.js/,'Living School must not bypass the core runtime with direct shared navigation loading');
assert.ok(entry.indexOf(boundary)>=0,'Living School install boundary must remain present');
assert.ok(runtime.indexOf(`'${agent}'`)<runtime.indexOf(`'${tracks}'`),'core runtime must assemble the station agent before the exact-track decorator');
assert.equal((runtime.match(/system-radio-agent-v233\.js/g)||[]).length,1,'core runtime must declare the station agent once');
assert.equal((runtime.match(/radio-track-suggestions-v240\.js/g)||[]).length,1,'core runtime must declare the track decorator once');
assert.match(entry,/japanese-mode-v1\.js/,'Living School realm-specific Japanese mode may remain a direct entry dependency');

console.log('Living School radio bootstrap is owned by the shared core interface runtime.');

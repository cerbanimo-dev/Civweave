import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const gateway=await readFile(new URL('../public/app/settings-gateway-v317.js',import.meta.url),'utf8');
const openBlock=gateway.slice(gateway.indexOf('function open(launcher)'),gateway.indexOf('function ensure()'));
assert.doesNotMatch(openBlock,/ensureManagement\(/,'Opening Settings must not load downloaded-model management automatically.');
assert.doesNotMatch(openBlock,/requestInferenceQuiescence/,'Opening Settings must not tear down inference automatically.');
console.log(JSON.stringify({ok:true,contract:'settings-open-inert-v321'},null,2));

import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [gateway,workingCampus,directEntry,localRoute]=await Promise.all([
  'public/app/settings-gateway-v317.js',
  'public/app/working-campus-v440.html',
  'public/app/settings-direct-entry-v339.js',
  'public/app/settings-local-route-v327.js'
].map(read));

new Function(gateway);
new Function(directEntry);
new Function(localRoute);

const openBlock=gateway.slice(gateway.indexOf('function open(launcher)'),gateway.indexOf('function ensure()'));
assert.ok(openBlock.length>0,'Settings open() contract is missing.');
assert.doesNotMatch(openBlock,/ensureManagement\(/,'Opening Settings must paint before Local Models management work.');
assert.doesNotMatch(openBlock,/requestInferenceQuiescence|local-inference-cancel-requested|new Worker|\.generate\(/,'Opening Settings must not start or tear down inference.');

assert.doesNotMatch(workingCampus,/settings-direct-entry-v339\.js/,'Working Campus must not load the recursive v339 recovery shim.');
assert.match(workingCampus,/settings-local-route-v327\.js/,'Working Campus must load the canonical cache-distinct Local Models route.');

assert.doesNotMatch(directEntry,/new MutationObserver/,'Settings compatibility recovery must not observe its own subtree mutations.');
assert.doesNotMatch(directEntry,/const\s+watchdog\s*=\s*setInterval/,'Settings compatibility recovery must not run a presentation watchdog.');
assert.match(directEntry,/mutationWatch:false/);
assert.match(directEntry,/watchdog:false/);
assert.match(directEntry,/eventDriven:true/);
assert.match(directEntry,/canonicalRouteFirst:true/);
assert.match(localRoute,/renderLocalModels/,'The canonical Local Models route must own saved-state rendering.');

console.log(JSON.stringify({
  ok:true,
  contract:'settings-freeze-v342',
  settingsOpenPaintFirst:true,
  workingCampusCanonicalRouteOnly:true,
  recursiveObserver:false,
  watchdog:false,
  eventDrivenFallback:true
},null,2));

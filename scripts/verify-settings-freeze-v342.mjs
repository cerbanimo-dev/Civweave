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
assert.match(workingCampus,/settings-gateway-v317\.js/,'Working Campus must retain the canonical Settings gateway.');
assert.doesNotMatch(workingCampus,/<script[^>]+settings-local-route-v327\.js/,'Fast Boot must not eagerly load the Local Models route.');
assert.match(gateway,/const SETTINGS_LOCAL_ROUTE='\/app\/settings-local-route-v327\.js/,'The Settings gateway must retain the cache-distinct Local Models route.');
assert.match(gateway,/localModelRouteSelfLoading:true/,'The Settings gateway must self-load the Local Models route.');
const localTabBlock=gateway.slice(gateway.indexOf("if(name==='local-models')"),gateway.indexOf("if(name==='membership')"));
assert.match(localTabBlock,/afterPaint\(\(\)=>void ensureManagement\(layer\)\)/,'Local Models management must start only after the tab paints.');

assert.doesNotMatch(directEntry,/new MutationObserver/,'Settings compatibility recovery must not observe its own subtree mutations.');
assert.doesNotMatch(directEntry,/const\s+watchdog\s*=\s*setInterval/,'Settings compatibility recovery must not run a presentation watchdog.');
assert.match(directEntry,/mutationWatch:false/);
assert.match(directEntry,/watchdog:false/);
assert.match(directEntry,/eventDriven:true/);
assert.match(directEntry,/canonicalRouteFirst:true/);
assert.match(localRoute,/renderLocalModels/,'The canonical Local Models route must own saved-state rendering.');

console.log(JSON.stringify({
  ok:true,
  contract:'settings-freeze-v342-fast-boot-v1',
  settingsOpenPaintFirst:true,
  workingCampusSettingsGatewayOnly:true,
  localModelsRoute:'self-loading-after-tab-paint',
  recursiveObserver:false,
  watchdog:false,
  eventDrivenFallback:true
},null,2));

import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [campus,shell,loader,direct339,generation]=await Promise.all([
  'public/app/working-campus-v440.html',
  'public/app/persistent-system-shell-v1.html',
  'public/app/settings-local-loader-v337.js',
  'public/app/settings-direct-entry-v339.js',
  'public/app/settings-local-route-v331.js'
].map(read));

new Function(loader);
new Function(direct339);
new Function(generation);

// v339 used to be the canonical recovery owner. Its subtree MutationObserver
// could recursively mutate Settings before the browser painted. Keep the file as
// a bounded compatibility fallback, but never anchor the canonical campus to it.
assert.doesNotMatch(campus,/settings-direct-entry-v339\.js/,'Canonical campus must not load the recursive v339 recovery generation.');
assert.doesNotMatch(direct339,/new MutationObserver/,'v339 compatibility fallback must not observe and rewrite the Settings subtree.');
assert.doesNotMatch(direct339,/const\s+watchdog\s*=\s*setInterval/,'v339 compatibility fallback must not run a presentation watchdog.');
assert.match(direct339,/eventDriven:true/,'v339 compatibility fallback must remain event driven.');
assert.match(direct339,/canonicalRouteFirst:true/,'v339 compatibility fallback must defer to the canonical saved-state route.');

// The persistent shell and stage iframe are separate JS realms. Warm the
// genuinely cache-distinct renderer pathname in the parent before the child can
// request it, then let v337 inject that same renderer into the selected child
// Settings realm. This avoids the service-worker query-insensitive stale-path
// trap while preserving a read-only Local Models view.
assert.match(shell,/settings-local-route-v331\.js\?v=1\.1\.7-persistent-shell-cache-generation-v333/,'Persistent shell must warm the v331 renderer pathname.');
assert.match(shell,/settings-local-loader-v337\.js\?v=1\.2\.0-stage-full-route/,'Persistent shell must attach the stage-aware Local Models loader.');
assert.match(loader,/ROUTE_SRC='\/app\/settings-local-route-v331\.js\?cwAction=1&v=1\.2\.0-stage-full-route-v337'/,'Stage loader must inject the same v331 pathname into the child realm.');
assert.match(loader,/savedStateOnlyView===true&&api\?\.viewWritesState===false/,'Stage loader must reject routes that are not saved-state-only.');
assert.match(generation,/savedStateOnlyView:true/,'v331 renderer must remain saved-state-only.');
assert.match(generation,/viewWritesState:false/,'v331 renderer must remain read-only on view.');
assert.match(generation,/managerDependencyOnView:false/,'v331 renderer must not depend on the live model manager on view.');
assert.match(generation,/serviceWorkerReadyOnView:false/,'v331 renderer must not wait for service-worker readiness on view.');
assert.match(generation,/hardwareProbeOnView:false/,'v331 renderer must not probe hardware on view.');

console.log(JSON.stringify({
  ok:true,
  contract:'settings-v343-persistent-v331',
  canonicalCampusV339:false,
  recursiveObserver:false,
  persistentV331Preload:true,
  stageLoader:true,
  savedStateOnly:true
},null,2));

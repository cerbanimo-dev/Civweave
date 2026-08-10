import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [primary,bootstrap,controller,settings]=await Promise.all([
  read('public/app/local-ai/primary-route-v280.js'),
  read('public/app/local-ai/bootstrap-v266.js'),
  read('public/app/model-settings-controller-v173.js'),
  read('public/app/local-ai/settings-panel-v267.js'),
]);

new Function(primary);
new Function(bootstrap);

assert.ok(primary.includes("const ROUTE='downloaded-local'"),'embedded local route id is missing');
assert.ok(primary.includes('Embedded local AI (downloaded model)'),'primary-route option label is missing');
assert.ok(primary.includes('data-panel="downloaded-local"'),'embedded local route panel is missing');
assert.ok(primary.includes('manager()?.selection?.()'),'embedded local primary route is not grounded in the persistent model selection');
assert.ok(primary.includes('event.stopImmediatePropagation()'),'local route submit does not protect the base provider fallback');
assert.ok(primary.includes('Your configured provider remains available only as a capability fallback.'),'fallback semantics are not explained');
assert.ok(primary.includes('civweave:local-model-selection'),'primary route does not follow Use locally / Stop using locally');
assert.ok(primary.includes('civweave:model-settings-saved'),'embedded local selection does not publish settings state');
assert.ok(bootstrap.includes('/app/local-ai/primary-route-v280.js?v=1.0.83-v280'),'local AI bootstrap does not load the primary route bridge');
assert.ok(bootstrap.includes('embeddedLocalPrimary:true'),'local AI ready event does not advertise embedded local primary routing');
assert.ok(controller.includes('Primary route<select name="route"'),'clean-room primary route control is missing');
assert.ok(settings.includes('data-local-use'),'downloaded model Use locally control is missing');

console.log(JSON.stringify({ok:true,revision:'embedded-local-primary-v280',route:'downloaded-local',fallbackPreserved:true,selectionDriven:true},null,2));
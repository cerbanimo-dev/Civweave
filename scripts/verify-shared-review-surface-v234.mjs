import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [review,boundary,coreRuntime,installer,status,versionText,packageSource]=await Promise.all([
  read('public/app/shared-review-surface-v234.js'),
  read('public/app/install-boundary-v146.js'),
  read('public/app/core-interface-runtime-v1.js'),
  read('public/app/index.html'),
  read('public/app/offline-campus-status-v210.js'),
  read('VERSION'),
  read('package.json')
]);
const version=versionText.trim(),pkg=JSON.parse(packageSource);

assert.equal(pkg.version,version,'package.json and VERSION must remain synchronized.');
assert.match(review,/const REVISION='shared-review-surface-v234'/);
assert.match(review,/INTENTIONS_KEY='civweave\.intentions\.v127'/);
assert.match(review,/ACTIONS_KEY='civweave\.realm-actions\.v141'/);
assert.match(review,/REALM_INBOX_KEY='civweave\.realm-inbox\.v1'/);
assert.match(review,/WORKING_KEY='civweave\.working-campus\.v1'/);
assert.match(review,/closest\('\[data-gate\],\[data-cwf-gate\]'\)/,'Review extension must intercept both persistent and inline chat gate formats.');
assert.match(review,/document\.addEventListener\('click',onGateCapture,true\)/,'Review gates must be intercepted in capture phase before legacy page-local handlers.');
for(const gate of ['open-plan','activate-plan','open-action','approve-action']){
  assert.ok(review.includes(`'${gate}'`),`Shared review surface lost ${gate}.`);
}
assert.doesNotMatch(review,/CivweaveIntentionUI|CivweaveActionUI|intention-ui-v138|core-loop-v152/,'New review surface must not revive old review UI/runtime dependencies.');
assert.match(review,/CONTRACT_SCRIPT='\/app\/guide-contracts-v141\.js'/,'Realm approval must use the current action data contract.');
assert.match(review,/WEAVES UNDER REVIEW/,'Main Weaveling surface must expose review-state weaves.');
assert.match(review,/<details><summary>/,'Review-state weaves must be collapsed by default.');
assert.doesNotMatch(review,/<details\s+open/,'Review-state weaves must not auto-expand.');
assert.match(review,/write\(INTENTIONS_KEY/,'Weave activation must update the canonical intention ledger.');
assert.match(review,/write\(REALM_INBOX_KEY/,'Weave activation must create canonical realm handoffs.');
assert.match(review,/write\(WORKING_KEY/,'Weave activation must synchronize Working Campus state.');
assert.match(review,/civweave:review-plan-activated/,'Weave activation must emit a review lifecycle event.');
assert.match(review,/civweave:review-action-approved/,'Realm approval must emit a review lifecycle event.');

assert.match(coreRuntime,/['"]\/app\/shared-review-surface-v234\.js['"]/,'Core interface runtime must assemble the shared review owner.');
assert.match(coreRuntime,/const SHARED_BOOT_SCRIPTS=Object\.freeze\(\[/);
assert.match(boundary,/const CORE_INTERFACE_RUNTIME='\/app\/core-interface-runtime-v1\.js'/);
assert.doesNotMatch(boundary,/SYSTEM_EXPERIENCE_SCRIPTS|SHARED_REVIEW_SURFACE='\/app\/shared-review-surface-v234\.js'/,'Install boundary must not retain a second review-loading manifest.');
assert.match(boundary,/sharedReviewSurfaceRevision:'v234-chat-owned-review-and-weaves-under-review'/);

assert.doesNotMatch(installer,/new MutationObserver\(renderProgress\)/,'Installer progress must not observe and rewrite its own hidden/disabled attributes.');
assert.match(installer,/function progressFromText\(\)/,'Installer progress must remain visible from streamed file-count text.');
assert.match(installer,/civweave:offline-campus-status/,'Installer progress must accept explicit status events.');
assert.doesNotMatch(installer,/setInterval\s*\(\s*renderProgress/,'Installer progress must remain event-driven instead of installing a polling refresh loop.');

assert.doesNotMatch(status,/registration\.update\(\)/,'Offline status reader must not compete with the installer for service-worker updates.');
assert.doesNotMatch(status,/SKIP_WAITING/,'Offline status reader must not change service-worker lifecycle.');
assert.match(status,/function currentWorker\(\)/,'Offline status reader must only discover the current worker.');
assert.match(status,/civweave:offline-campus-status/,'Offline status reader must publish normalized status events.');

console.log(JSON.stringify({
  ok:true,
  version,
  revision:'shared-review-surface-v234',
  reviewKinds:['weave','realm-action'],
  interfaceRuntime:'core-interface-runtime-v1',
  chatGateFormats:2,
  reviewWeavesCollapsedByDefault:true,
  installerMutationFeedbackLoop:false,
  installerProgressPolling:false,
  offlineStatusOwnsWorkerLifecycle:false
},null,2));
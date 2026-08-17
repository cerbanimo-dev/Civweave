import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [review,boundary,installer,status,versionText,packageSource]=await Promise.all([
  read('public/app/shared-review-surface-v234.js'),
  read('public/app/install-boundary-v146.js'),
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
assert.match(review,/QUESTS UNDER REVIEW/,'Main Weaveling surface must expose review-state Quests.');
assert.match(review,/Quest goal:/,'Quest review must label the governing request with current Quest terminology.');
assert.doesNotMatch(review,/Wish:<\/strong>/,'Quest review must not expose the retired Wish label.');
assert.match(review,/<details><summary>/,'Review-state Quests must be collapsed by default.');
assert.doesNotMatch(review,/<details\s+open/,'Review-state Quests must not auto-expand.');
assert.match(review,/write\(INTENTIONS_KEY/,'Quest activation must update the canonical intention ledger.');
assert.match(review,/write\(REALM_INBOX_KEY/,'Quest activation must create canonical realm handoffs.');
assert.match(review,/write\(WORKING_KEY/,'Quest activation must synchronize Working Campus state.');
assert.match(review,/civweave:review-plan-activated/,'Quest activation must emit a review lifecycle event.');
assert.match(review,/civweave:review-action-approved/,'Realm approval must emit a review lifecycle event.');

assert.match(boundary,/SHARED_REVIEW_SURFACE='\/app\/shared-review-surface-v234\.js'/,'Shared boundary must load the review extension.');
const experienceBlock=boundary.match(/const SYSTEM_EXPERIENCE_SCRIPTS=\[([\s\S]*?)\];/)?.[1]||'';
assert.ok(experienceBlock.includes('SHARED_REVIEW_SURFACE'),'Review extension must remain first-class in the approved experience stack on all five system surfaces.');
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
  reviewKinds:['quest','realm-action'],
  chatGateFormats:2,
  reviewQuestsCollapsedByDefault:true,
  installerMutationFeedbackLoop:false,
  installerProgressPolling:false,
  offlineStatusOwnsWorkerLifecycle:false
},null,2));
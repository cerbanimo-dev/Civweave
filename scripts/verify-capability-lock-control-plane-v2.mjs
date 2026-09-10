#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const workflow=readFileSync('.github/workflows/capability-lock-enforced.yml','utf8');
const runner=readFileSync('scripts/capability-lock-enforced-runner.mjs','utf8');
const owners=readFileSync('.github/CODEOWNERS','utf8');

assert.match(workflow,/pull_request_target:/,'enforced lock must be defined on pull_request_target');
assert.doesNotMatch(workflow,/^\s*pull_request:\s*$/m,'enforced lock must not take its PR definition from candidate pull_request context');
assert.match(workflow,/permissions:\s*\n\s*contents:\s*read/m,'enforced lock must use read-only repository permissions');
assert.doesNotMatch(workflow,/contents:\s*write|pull-requests:\s*write|actions:\s*write|secrets\./,'enforced lock must not receive write authority or secrets');
assert.match(workflow,/persist-credentials:\s*false/,'trusted checkout credentials must not persist');
assert.match(workflow,/actions\/checkout@[0-9a-f]{40}/,'checkout action must be pinned to an immutable SHA');
assert.match(workflow,/actions\/setup-node@[0-9a-f]{40}/,'setup-node action must be pinned to an immutable SHA');
assert.match(workflow,/refs\/pull\/\$\{PR_NUMBER\}\/merge/,'enforced lock must test the GitHub synthetic PR merge commit');
assert.match(workflow,/merge\^1/,'enforced lock must verify the merge base parent');
assert.match(workflow,/merge\^2/,'enforced lock must verify the merge head parent');
assert.match(workflow,/capability-lock-enforced-runner\.mjs/,'enforced workflow must invoke the authority runner');

assert.match(runner,/LOCKED_CONTROL_FILES/,'runner must define default-branch locked control-plane files');
assert.match(runner,/CONTROL-PLANE REGRESSION/,'runner must reject candidate control-plane drift');
assert.match(runner,/accepted registry policy changed/,'runner must reject policy mutation');
assert.match(runner,/accepted capabilities removed/,'runner must reject accepted capability removal');
assert.match(runner,/accepted capability definitions changed/,'runner must reject accepted capability mutation');
assert.match(runner,/archiveInto\(candidateRef/,'runner must reconstruct candidate workspaces from an immutable commit');
assert.match(runner,/archiveInto\(baseRef,root/,'runner must overlay trusted base contract roots');
assert.match(runner,/for\(const capability of trustedCapabilities\)/,'runner must prepare a separate workspace for every accepted capability');
assert.match(runner,/function childEnv\(\)/,'runner must construct an explicit child environment');
assert.doesNotMatch(runner,/env:\s*\{\.\.\.process\.env/,'candidate execution must not inherit the complete GitHub Actions environment');
assert.match(runner,/GITHUB_STEP_SUMMARY/,'runner must emit machine-visible evidence');

assert.match(owners,/\/\.github\/workflows\/capability-lock-enforced\.yml\s+@cerbanimo-dev/,'enforced workflow must have a code owner');
assert.match(owners,/\/scripts\/capability-lock-enforced-runner\.mjs\s+@cerbanimo-dev/,'enforced runner must have a code owner');
assert.match(owners,/\/\.github\/CODEOWNERS\s+@cerbanimo-dev/,'CODEOWNERS must own itself');

console.log(JSON.stringify({
  ok:true,
  schema:'civweave.capability-lock.control-plane.v2',
  authority:'default-branch pull_request_target',
  permissions:'contents-read',
  credentialPersistence:false,
  actionPins:'sha',
  candidateExecutionEnvironment:'allowlist',
  perCapabilityWorkspace:'fresh',
  trustedScripts:'base-overlay'
},null,2));

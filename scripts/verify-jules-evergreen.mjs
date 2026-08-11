import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parsePipeline} from './lib/jules-evergreen-core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => readFile(path.join(root, file), 'utf8');

const [
  configText,
  roadmap,
  daemonSource,
  coreSource,
  julesApiSource,
  daemonWorkflow,
  documentation
] = await Promise.all([
  read('.github/jules-evergreen.json'),
  read('docs/roadmap/ten-year-pipeline.md'),
  read('scripts/jules-evergreen-daemon.mjs'),
  read('scripts/lib/jules-evergreen-core.mjs'),
  read('scripts/lib/jules-api-client.mjs'),
  read('.github/workflows/jules-evergreen-daemon.yml'),
  read('docs/JULES-EVERGREEN.md')
]);

const config = JSON.parse(configText);
const bundles = parsePipeline(roadmap);
assert.equal(bundles.length, 120, 'The ten-year pipeline should retain 120 bundle records.');
assert.equal(config.startingBranch, 'main');
assert.ok(config.maxLaunchesPer24Hours > 0 && config.maxLaunchesPer24Hours <= 15,
  'The default launch budget must fit within the published base-plan task limit.');
assert.equal(config.legacyBundlePullRequests['CW-2026Q3-01'], 179);
assert.equal(config.legacyBundlePullRequests['CW-2026Q3-02'], 192);
assert.equal(config.autoMerge.enabled, true);
assert.equal(config.autoMerge.method, 'squash');
assert.ok(config.autoMerge.blockedPaths.includes('.github/workflows/'));
assert.ok(config.autoMerge.blockedPaths.includes('scripts/jules-evergreen-daemon.mjs'));

assert.match(julesApiSource, /AUTO_CREATE_PR/);
assert.match(daemonSource, /evaluateAutoMergePolicy/);
assert.match(daemonSource, /EVERGREEN_GITHUB_TOKEN/);
assert.match(daemonSource, /mergePullRequest/);
assert.match(coreSource, /verifySingleBundleCompletion/);
assert.match(coreSource, /Required check missing: \$\{name\}/);
assert.match(coreSource, /requiredCheckNames = \['local-first'\]/);
assert.doesNotMatch(daemonSource, /bypass_branch_protection|force:\s*true/);

assert.match(daemonWorkflow, /cron: '\*\/5 \* \* \* \*'/);
assert.match(daemonWorkflow, /contents: read/);
assert.match(daemonWorkflow, /pull-requests: write/);
assert.match(daemonWorkflow, /secrets\.EVERGREEN_GITHUB_TOKEN/);
assert.doesNotMatch(daemonWorkflow, /pull_request_target/);
assert.doesNotMatch(daemonWorkflow, /contents: write/);

assert.match(documentation, /EVERGREEN_GITHUB_TOKEN/);
assert.match(documentation, /automatically squash-merges/i);
assert.match(documentation, /does not bypass branch protection/i);
assert.match(documentation, /uses `main` directly as its trusted baseline/i);
assert.match(documentation, /Do not maintain a deployment-watched mirror of `main`/i);

console.log(`Jules evergreen verifier passed: ${bundles.length} bundles, trusted-main baseline, trusted-check, quota, sensitive-path, and auto-merge gates intact.`);

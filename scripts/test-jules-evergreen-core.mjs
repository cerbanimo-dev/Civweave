import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSessionPrompt,
  classifyHealth,
  countRecentManagedSessions,
  evaluateAutoMergePolicy,
  parsePipeline,
  parsePullRequestNumber,
  selectNextBundle,
  verifySingleBundleCompletion
} from './lib/jules-evergreen-core.mjs';

const ROADMAP = `# Queue
- [ ] **CW-2026Q3-01 · First owner** (\`architecture\`): Establish the owner.
- [x] **CW-2026Q3-02 · Bootstrap** (\`agents\`): Install the queue.
- [ ] **CW-2026Q3-03 · Lifeboat** (\`observability\`): Add diagnostics.
`;

test('parses ordered pipeline bundles', () => {
  const bundles = parsePipeline(ROADMAP);
  assert.equal(bundles.length, 3);
  assert.deepEqual(bundles[0], {
    checked: false,
    id: 'CW-2026Q3-01',
    title: 'First owner',
    category: 'architecture',
    description: 'Establish the owner.',
    raw: '- [ ] **CW-2026Q3-01 · First owner** (`architecture`): Establish the owner.'
  });
});

test('honors merged and open legacy pull-request overrides', () => {
  const bundles = parsePipeline(ROADMAP);
  const merged = new Map([['CW-2026Q3-01', {state: 'merged', pullRequest: 179}]]);
  assert.equal(selectNextBundle(bundles, merged).bundle.id, 'CW-2026Q3-03');
  const open = new Map([['CW-2026Q3-01', {state: 'open', pullRequest: 179}]]);
  const selection = selectNextBundle(bundles, open);
  assert.equal(selection.kind, 'claimed');
  assert.equal(selection.override.pullRequest, 179);
});

test('classifies failing, pending, empty, and successful health', () => {
  const options = {requiredCheckNames: []};
  assert.equal(classifyHealth([], {statuses: []}, options).state, 'no-checks');
  assert.equal(classifyHealth([{name: 'build', status: 'in_progress'}], {statuses: []}, options).state, 'pending');
  assert.equal(classifyHealth([{name: 'build', status: 'completed', conclusion: 'failure'}], {statuses: []}, options).state, 'failure');
  assert.equal(classifyHealth([{name: 'build', status: 'completed', conclusion: 'success'}], {state: 'success', statuses: []}, options).state, 'success');
});

test('requires the trusted local-first check by default', () => {
  const cloudflareOnly = classifyHealth([
    {name: 'Cloudflare Pages', status: 'completed', conclusion: 'success'}
  ], {state: 'success', statuses: []});
  assert.equal(cloudflareOnly.state, 'pending');
  assert.deepEqual(cloudflareOnly.missingRequired, ['local-first']);

  const trusted = classifyHealth([
    {name: 'Cloudflare Pages', status: 'completed', conclusion: 'success'},
    {name: 'local-first', status: 'completed', conclusion: 'success'}
  ], {state: 'success', statuses: []});
  assert.equal(trusted.state, 'success');
});

test('counts launches in a rolling window', () => {
  const now = Date.parse('2026-08-06T20:00:00Z');
  const sessions = [
    {title: '[Civweave Evergreen] A', createTime: '2026-08-06T19:00:00Z'},
    {title: '[Civweave Evergreen] B', createTime: '2026-08-05T18:00:00Z'},
    {title: 'Other', createTime: '2026-08-06T19:00:00Z'}
  ];
  assert.equal(countRecentManagedSessions(sessions, '[Civweave Evergreen]', now, 24), 1);
});

test('extracts only pull requests from the intended repository', () => {
  assert.equal(parsePullRequestNumber('https://github.com/cerbanimo-dev/Civweave/pull/42', 'cerbanimo-dev/Civweave'), 42);
  assert.equal(parsePullRequestNumber('https://github.com/other/Civweave/pull/42', 'cerbanimo-dev/Civweave'), null);
});

test('builds a scoped prompt with conditional automatic merge', () => {
  const bundle = parsePipeline(ROADMAP)[2];
  const prompt = buildSessionPrompt({bundle, repository: 'cerbanimo-dev/Civweave', roadmapPath: 'docs/roadmap/ten-year-pipeline.md'});
  assert.match(prompt, /CW-2026Q3-03/);
  assert.match(prompt, /do not merge it yourself/i);
  assert.match(prompt, /squash-merge.*automatically/i);
});

test('requires exactly one roadmap checkbox transition', () => {
  const head = ROADMAP.replace('- [ ] **CW-2026Q3-03', '- [x] **CW-2026Q3-03');
  assert.equal(verifySingleBundleCompletion(ROADMAP, head, 'CW-2026Q3-03'), true);
  assert.equal(verifySingleBundleCompletion(ROADMAP, `${head}\nextra`, 'CW-2026Q3-03'), false);
});

test('allows a completed healthy ordinary PR and blocks control-plane self-modification', () => {
  const headRoadmap = ROADMAP.replace('- [ ] **CW-2026Q3-03', '- [x] **CW-2026Q3-03');
  const base = {
    pr: {
      title: 'CW-2026Q3-03: Add feedback lifeboat',
      body: 'Implements CW-2026Q3-03',
      mergeable: true,
      mergeable_state: 'clean',
      labels: [],
      base: {ref: 'main', repo: {full_name: 'cerbanimo-dev/Civweave'}},
      head: {repo: {full_name: 'cerbanimo-dev/Civweave'}}
    },
    session: {state: 'COMPLETED'},
    health: {state: 'success', checkCount: 2},
    reviews: [],
    baseRoadmap: ROADMAP,
    headRoadmap,
    bundleId: 'CW-2026Q3-03',
    blockedPaths: ['.github/workflows/', 'scripts/jules-evergreen-daemon.mjs'],
    blockedLabels: ['do-not-merge']
  };
  assert.equal(evaluateAutoMergePolicy({...base, changedFiles: [{filename: 'public/app/feedback-lifeboat.js'}, {filename: 'docs/roadmap/ten-year-pipeline.md'}]}).eligible, true);
  const blocked = evaluateAutoMergePolicy({...base, changedFiles: [{filename: 'scripts/jules-evergreen-daemon.mjs'}, {filename: 'docs/roadmap/ten-year-pipeline.md'}]});
  assert.equal(blocked.eligible, false);
  assert.match(blocked.reasons.join(' '), /Sensitive path/);
});

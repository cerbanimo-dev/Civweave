const BUNDLE_PATTERN = /^- \[([ xX])\] \*\*(CW-\d{4}Q[1-4]-\d{2}) · ([^*]+?)\*\* \(`([^`]+)`\): (.+)$/gm;

export const ACTIVE_SESSION_STATES = new Set([
  'QUEUED',
  'PLANNING',
  'AWAITING_PLAN_APPROVAL',
  'AWAITING_USER_FEEDBACK',
  'IN_PROGRESS',
  'PAUSED'
]);

export function parsePipeline(markdown) {
  const bundles = [];
  for (const match of String(markdown).matchAll(BUNDLE_PATTERN)) {
    bundles.push({
      checked: match[1].toLowerCase() === 'x',
      id: match[2],
      title: match[3].trim(),
      category: match[4].trim(),
      description: match[5].trim(),
      raw: match[0]
    });
  }
  if (bundles.length === 0) {
    throw new Error('No pipeline bundles were found. The roadmap format may have changed.');
  }
  return bundles;
}

export function selectNextBundle(bundles, overrideStates = new Map()) {
  for (const bundle of bundles) {
    if (bundle.checked) continue;
    const override = overrideStates.get(bundle.id);
    if (override?.state === 'merged') continue;
    if (override?.state === 'open') {
      return {kind: 'claimed', bundle, override};
    }
    return {kind: 'ready', bundle, override};
  }
  return {kind: 'complete', bundle: null, override: null};
}

export function isManagedSession(session, titlePrefix) {
  return String(session?.title || '').startsWith(String(titlePrefix));
}

export function isActiveSession(session) {
  return ACTIVE_SESSION_STATES.has(String(session?.state || ''));
}

export function bundleIdFromSession(session) {
  const source = `${session?.title || ''}\n${session?.prompt || ''}`;
  return source.match(/CW-\d{4}Q[1-4]-\d{2}/)?.[0] || null;
}

export function countRecentManagedSessions(sessions, titlePrefix, nowMs, windowHours = 24) {
  const floor = nowMs - windowHours * 60 * 60 * 1000;
  return sessions.filter(session => {
    if (!isManagedSession(session, titlePrefix)) return false;
    const created = Date.parse(session?.createTime || '');
    return Number.isFinite(created) && created >= floor;
  }).length;
}

export function minutesSinceNewestManagedSession(sessions, titlePrefix, nowMs) {
  const times = sessions
    .filter(session => isManagedSession(session, titlePrefix))
    .map(session => Date.parse(session?.createTime || ''))
    .filter(Number.isFinite);
  if (times.length === 0) return Infinity;
  return Math.max(0, (nowMs - Math.max(...times)) / 60000);
}

export function parsePullRequestNumber(url, repository) {
  const escaped = String(repository).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = String(url || '').match(new RegExp(`github\\.com/${escaped}/pull/(\\d+)(?:$|[/?#])`, 'i'));
  return match ? Number(match[1]) : null;
}

export function pullRequestUrls(session) {
  return (session?.outputs || [])
    .map(output => output?.pullRequest?.url)
    .filter(Boolean);
}

const SUCCESS_CONCLUSIONS = new Set(['success', 'neutral', 'skipped']);
const FAILURE_CONCLUSIONS = new Set([
  'failure',
  'cancelled',
  'timed_out',
  'action_required',
  'startup_failure',
  'stale'
]);

export function classifyHealth(
  checkRuns = [],
  combinedStatus = {},
  {requiredCheckNames = ['local-first']} = {}
) {
  const failures = [];
  const pending = [];
  const successfulNames = [];
  for (const check of checkRuns) {
    const name = String(check?.name || 'Unnamed check');
    if (check?.status !== 'completed') {
      pending.push(name);
      continue;
    }
    const conclusion = String(check?.conclusion || '').toLowerCase();
    if (FAILURE_CONCLUSIONS.has(conclusion)) failures.push(name);
    else if (SUCCESS_CONCLUSIONS.has(conclusion)) successfulNames.push(name);
    else pending.push(name);
  }

  for (const status of combinedStatus?.statuses || []) {
    const name = String(status?.context || 'Commit status');
    const state = String(status?.state || '').toLowerCase();
    if (state === 'failure' || state === 'error') failures.push(name);
    else if (state === 'pending') pending.push(name);
    else if (state === 'success') successfulNames.push(name);
  }

  const checkCount = checkRuns.length + (combinedStatus?.statuses || []).length;
  const result = (state, extra = {}) => ({
    state,
    failures: unique(failures),
    pending: unique(pending),
    successfulNames: unique(successfulNames),
    checkCount,
    ...extra
  });

  if (failures.length > 0) return result('failure');
  if (checkCount === 0) return result('no-checks');
  if (pending.length > 0 || String(combinedStatus?.state || '').toLowerCase() === 'pending') {
    return result('pending');
  }
  if (String(combinedStatus?.state || '').toLowerCase() === 'failure') {
    failures.push('Combined commit status');
    return result('failure');
  }

  const successfulLower = new Set(successfulNames.map(name => name.toLowerCase()));
  const missingRequired = requiredCheckNames
    .map(name => String(name).trim())
    .filter(Boolean)
    .filter(name => !successfulLower.has(name.toLowerCase()));
  if (missingRequired.length > 0) {
    pending.push(...missingRequired.map(name => `Required check missing: ${name}`));
    return result('pending', {missingRequired});
  }

  return result('success', {missingRequired: []});
}

export function verifySingleBundleCompletion(baseMarkdown, headMarkdown, bundleId) {
  const target = parsePipeline(baseMarkdown).find(bundle => bundle.id === bundleId);
  if (!target || target.checked) return false;
  const completedLine = target.raw.replace('- [ ]', '- [x]');
  const expected = String(baseMarkdown).replace(target.raw, completedLine);
  return String(headMarkdown) === expected;
}

export function evaluateAutoMergePolicy({
  pr,
  session,
  health,
  changedFiles = [],
  reviews = [],
  baseRoadmap,
  headRoadmap,
  bundleId,
  blockedPaths = [],
  blockedLabels = [],
  expectedBase = 'main'
}) {
  const reasons = [];
  const labels = new Set((pr?.labels || []).map(label => String(label?.name || label).toLowerCase()));
  const filenames = changedFiles.map(file => String(file?.filename || file));

  if (!bundleId) reasons.push('No pipeline bundle ID could be tied to the Jules session.');
  if (String(session?.state || '') !== 'COMPLETED') reasons.push(`Jules session is ${session?.state || 'unknown'}, not COMPLETED.`);
  if (health?.state !== 'success' || !health?.checkCount) reasons.push('At least one reported check must complete successfully with no failures or pending checks.');
  if (pr?.base?.ref !== expectedBase) reasons.push(`Pull request base is ${pr?.base?.ref || 'unknown'}, not ${expectedBase}.`);
  if (pr?.head?.repo?.full_name && pr?.base?.repo?.full_name && pr.head.repo.full_name !== pr.base.repo.full_name) {
    reasons.push('Fork-based pull requests are not eligible for unattended merge.');
  }
  if (pr?.mergeable !== true) reasons.push('GitHub has not confirmed the pull request is mergeable.');
  if (['dirty', 'behind', 'blocked', 'unknown'].includes(String(pr?.mergeable_state || '').toLowerCase())) {
    reasons.push(`GitHub merge state is ${pr.mergeable_state}.`);
  }
  if (bundleId && !`${pr?.title || ''}\n${pr?.body || ''}`.includes(bundleId)) {
    reasons.push('Pull request title or body does not name the selected bundle ID.');
  }
  if (filenames.length === 0) reasons.push('Pull request contains no changed files.');

  for (const filename of filenames) {
    const rule = blockedPaths.find(item => pathMatchesRule(filename, item));
    if (rule) reasons.push(`Sensitive path requires human merge: ${filename} (rule ${rule}).`);
  }
  for (const label of blockedLabels.map(value => String(value).toLowerCase())) {
    if (labels.has(label)) reasons.push(`Label ${label} disables unattended merge.`);
  }
  if (reviews.some(review => String(review?.state || '').toUpperCase() === 'CHANGES_REQUESTED')) {
    reasons.push('A review currently requests changes.');
  }
  if (!verifySingleBundleCompletion(baseRoadmap, headRoadmap, bundleId)) {
    reasons.push('TEN-YEAR-PIPELINE.md must differ from main only by checking the selected bundle.');
  }

  return {eligible: reasons.length === 0, reasons: unique(reasons)};
}

export function buildSessionPrompt({bundle, repository, roadmapPath, activePullRequests = []}) {
  const active = activePullRequests.length
    ? `\nOpen pull requests at launch time: ${activePullRequests.join(', ')}. Inspect them and do not duplicate valid work.`
    : '';
  return `You are the Civweave evergreen implementation worker for ${bundle.id}.

Read root AGENTS.md first, then ${roadmapPath}. Implement exactly this bundle and no later bundle:

${bundle.id} · ${bundle.title} (${bundle.category})
${bundle.description}

Required operating rules:
- Trace current executable ownership from the active dispatcher before editing.
- Reconcile the roadmap against fresh main and current pull requests before choosing files.
- Preserve offline-first operation, user data, identifiers, ledgers, credentials, receipts, exports, and compatibility windows.
- Keep one canonical owner per concern and delete duplicate execution paths only with migration evidence.
- Add or update focused verification for the bundle and run the narrowest relevant checks.
- Update only the ${bundle.id} checkbox in ${roadmapPath} after every implementation and verification gate passes.
- Use one branch and one pull request for this bundle.
- Create the pull request, but do not merge it yourself and do not push directly to main.
- The evergreen daemon may squash-merge the pull request automatically only after its full safety policy and GitHub checks pass.
- Include the bundle ID in the pull request title and body.
- In the pull request body, name the retained owner, duplicates removed, data preserved, compatibility window, checks run, and deletions versus additions.
- Stop and request feedback rather than guessing when a destructive migration, paid-service activation, secret, or high-stakes governance/economic decision is required.${active}

Automated merge is conditional, revocable, and never permission to weaken checks or modify the evergreen control plane.`;
}

export function boundedInteger(value, fallback, {min = 0, max = Number.MAX_SAFE_INTEGER} = {}) {
  const number = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

export function booleanValue(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return !['0', 'false', 'no', 'off'].includes(String(value).trim().toLowerCase());
}

export function marker(kind, bundleId, discriminator = '') {
  return `<!-- civweave-jules:${kind}:${bundleId}:${discriminator} -->`;
}

function pathMatchesRule(filename, rule) {
  const normalized = String(rule || '');
  return normalized.endsWith('/') ? filename.startsWith(normalized) : filename === normalized || filename.startsWith(normalized);
}

function unique(values) {
  return [...new Set(values)];
}

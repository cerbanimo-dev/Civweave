import {appendFile, readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {
  booleanValue,
  boundedInteger,
  buildSessionPrompt,
  bundleIdFromSession,
  classifyHealth,
  countRecentManagedSessions,
  evaluateAutoMergePolicy,
  isActiveSession,
  isManagedSession,
  marker,
  minutesSinceNewestManagedSession,
  parsePipeline,
  parsePullRequestNumber,
  pullRequestUrls,
  selectNextBundle
} from './lib/jules-evergreen-core.mjs';
import {JulesApiClient, JulesApiError} from './lib/jules-api-client.mjs';
import {GitHubApiClient} from './lib/github-evergreen-client.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const configPath = path.join(root, '.github', 'jules-evergreen.json');

export async function runEvergreenDaemon({env = process.env, now = new Date()} = {}) {
  const summary = new Summary(env.GITHUB_STEP_SUMMARY);
  const enabled = booleanValue(env.JULES_EVERGREEN_ENABLED, true);
  const dryRun = booleanValue(env.JULES_DRY_RUN, false);
  if (!enabled) return summary.finish('Evergreen automation is paused by JULES_EVERGREEN_ENABLED.');
  if (!env.JULES_API_KEY) return summary.finish('JULES_API_KEY is not configured; no Jules session was launched.');
  if (!env.GITHUB_TOKEN) throw new Error('GITHUB_TOKEN is required.');
  if (!env.GITHUB_REPOSITORY) throw new Error('GITHUB_REPOSITORY is required.');

  const config = JSON.parse(await readFile(configPath, 'utf8'));
  const roadmapPath = config.roadmapPath || 'docs/roadmap/ten-year-pipeline.md';
  const roadmap = await readFile(path.join(root, roadmapPath), 'utf8');
  const bundles = parsePipeline(roadmap);
  const titlePrefix = config.sessionTitlePrefix || '[Civweave Evergreen]';
  const github = new GitHubApiClient({token: env.GITHUB_TOKEN, repository: env.GITHUB_REPOSITORY});
  const mergeGithub = env.EVERGREEN_GITHUB_TOKEN
    ? new GitHubApiClient({token: env.EVERGREEN_GITHUB_TOKEN, repository: env.GITHUB_REPOSITORY})
    : null;
  const jules = new JulesApiClient({apiKey: env.JULES_API_KEY});
  const autoMergeEnabled = booleanValue(env.JULES_AUTOMERGE_ENABLED, config.autoMerge?.enabled ?? true);

  const labelNames = await ensureLabels(github, config.labels || {});
  const overrideStates = await loadOverrideStates(github, config.legacyBundlePullRequests || {});
  const selection = selectNextBundle(bundles, overrideStates);

  const sessionSummaries = await jules.listSessions({pageSize: 100, maxPages: 3});
  const managedSummaries = sessionSummaries.filter(session => isManagedSession(session, titlePrefix));
  const detailedSessions = await hydrateRelevantSessions(jules, managedSummaries, now);
  const monitorResults = await monitorManagedPullRequests({
    github,
    mergeGithub,
    jules,
    sessions: detailedSessions,
    repository: env.GITHUB_REPOSITORY,
    config,
    labels: labelNames,
    now,
    dryRun,
    roadmap,
    roadmapPath,
    autoMergeEnabled,
    summary
  });

  const mergedThisRun = monitorResults.filter(result => result.merged);
  if (mergedThisRun.length > 0) {
    const numbers = mergedThisRun.map(result => `#${result.number}`).join(', ');
    return summary.finish(`Auto-merged ${numbers}. The next scheduled run will re-read fresh main before launching another bundle.`);
  }

  const activeSessions = detailedSessions.filter(isActiveSession);
  const activeManagedPullRequests = monitorResults.filter(result => result.open);
  if (selection.kind === 'complete') return summary.finish('Every roadmap bundle is complete. Follow docs/roadmap/renewal.md.');
  if (selection.kind === 'claimed') {
    return summary.finish(`${selection.bundle.id} is currently claimed by PR #${selection.override.pullRequest}.`);
  }
  if (activeSessions.length > 0) {
    const names = activeSessions.map(session => `${session.title} (${session.state})`).join(', ');
    return summary.finish(`A managed Jules session is already active: ${names}`);
  }
  if (activeManagedPullRequests.length > 0) {
    const numbers = activeManagedPullRequests.map(result => `#${result.number}`).join(', ');
    return summary.finish(`A managed pull request is still open: ${numbers}`);
  }

  const nowMs = now.getTime();
  const dailyBudget = boundedInteger(env.JULES_DAILY_TASK_BUDGET, config.maxLaunchesPer24Hours ?? 10, {min: 1, max: 300});
  const recentLaunches = countRecentManagedSessions(managedSummaries, titlePrefix, nowMs, 24);
  if (recentLaunches >= dailyBudget) {
    return summary.finish(`Daily Jules launch budget reached (${recentLaunches}/${dailyBudget}).`);
  }
  const minimumMinutes = boundedInteger(env.JULES_MINIMUM_MINUTES_BETWEEN_LAUNCHES, config.minimumMinutesBetweenLaunches ?? 30, {min: 5, max: 1440});
  const elapsedMinutes = minutesSinceNewestManagedSession(managedSummaries, titlePrefix, nowMs);
  if (elapsedMinutes < minimumMinutes) {
    return summary.finish(`Launch spacing gate is active (${Math.floor(elapsedMinutes)}/${minimumMinutes} minutes).`);
  }

  const retryCap = boundedInteger(env.JULES_FAILED_RETRY_CAP, config.failedSessionRetriesPer24Hours ?? 2, {min: 0, max: 10});
  const recentFailures = managedSummaries.filter(session => {
    if (session.state !== 'FAILED' || bundleIdFromSession(session) !== selection.bundle.id) return false;
    return nowMs - Date.parse(session.updateTime || session.createTime || 0) <= 24 * 60 * 60 * 1000;
  }).length;
  if (recentFailures >= retryCap) {
    return summary.finish(`${selection.bundle.id} exceeded its automatic retry cap; human attention is required.`);
  }

  const sources = await jules.listSources({pageSize: 100, maxPages: 3});
  const [owner, repo] = env.GITHUB_REPOSITORY.split('/');
  const source = sources.find(item => item?.githubRepo?.owner?.toLowerCase() === owner.toLowerCase()
    && item?.githubRepo?.repo?.toLowerCase() === repo.toLowerCase());
  if (!source) {
    return summary.finish(`Jules has no connected source for ${env.GITHUB_REPOSITORY}. Install or authorize the Jules GitHub app first.`);
  }

  const openPrNumbers = (await github.listOpenPullRequests()).map(pr => `#${pr.number} ${pr.title}`);
  const prompt = buildSessionPrompt({
    bundle: selection.bundle,
    repository: env.GITHUB_REPOSITORY,
    roadmapPath,
    activePullRequests: openPrNumbers
  });
  const title = `${titlePrefix} ${selection.bundle.id} · ${selection.bundle.title}`;
  if (dryRun) return summary.finish(`Dry run: would launch ${title}.`);

  try {
    const session = await jules.createSession({
      prompt,
      title,
      source: source.name,
      startingBranch: config.startingBranch || 'main',
      requirePlanApproval: false
    });
    summary.line(`Launched ${session.title || title}: ${session.url || session.name}`);
    return summary.finish(`Jules accepted ${selection.bundle.id}.`);
  } catch (error) {
    if (error instanceof JulesApiError && error.status === 429) {
      return summary.finish(`Jules rate-limited the launch. The daemon will try again later${error.retryAfter ? ` after ${error.retryAfter}` : ''}.`);
    }
    throw error;
  }
}

async function hydrateRelevantSessions(jules, sessions, now) {
  const cutoff = now.getTime() - 30 * 24 * 60 * 60 * 1000;
  const relevant = sessions.filter(session => isActiveSession(session)
    || Date.parse(session.updateTime || session.createTime || 0) >= cutoff).slice(0, 40);
  const detailed = [];
  for (const session of relevant) {
    try { detailed.push(await jules.getSession(session.name)); }
    catch { detailed.push(session); }
  }
  return detailed;
}

async function loadOverrideStates(github, mapping) {
  const states = new Map();
  for (const [bundleId, pullRequest] of Object.entries(mapping)) {
    try {
      const pr = await github.getPullRequest(pullRequest);
      states.set(bundleId, {
        pullRequest,
        state: pr.merged_at ? 'merged' : pr.state === 'open' ? 'open' : 'closed'
      });
    } catch (error) {
      states.set(bundleId, {pullRequest, state: 'unknown', error: error.message});
    }
  }
  return states;
}

async function ensureLabels(github, labels) {
  const defaults = {
    managed: {name: 'jules-evergreen', color: '8250df', description: 'Managed by the Civweave Jules evergreen daemon'},
    ready: {name: 'jules-auto-merge-ready', color: '1f883d', description: 'All unattended merge gates passed'},
    attention: {name: 'jules-needs-attention', color: 'd1242f', description: 'The Jules task or pull request needs attention'},
    blocked: {name: 'jules-auto-merge-blocked', color: 'bf8700', description: 'Policy requires manual review or an explicit override'}
  };
  const resolved = {};
  for (const [key, fallback] of Object.entries(defaults)) {
    const definition = {...fallback, ...(labels[key] || {})};
    await github.ensureLabel(definition);
    resolved[key] = definition.name;
  }
  return resolved;
}

async function monitorManagedPullRequests({
  github,
  mergeGithub,
  jules,
  sessions,
  repository,
  config,
  labels,
  now,
  dryRun,
  roadmap,
  roadmapPath,
  autoMergeEnabled,
  summary
}) {
  const results = [];
  const seen = new Set();
  for (const session of sessions) {
    const bundleId = bundleIdFromSession(session) || 'unknown';
    for (const url of pullRequestUrls(session)) {
      const number = parsePullRequestNumber(url, repository);
      if (!number || seen.has(number)) continue;
      seen.add(number);
      let pr = await github.getPullRequest(number);
      if (pr.state !== 'open') {
        results.push({number, open: false, state: pr.merged_at ? 'merged' : 'closed'});
        continue;
      }
      if (!dryRun) {
        await github.addLabels(number, [labels.managed]);
        if (!pr.draft && pr.node_id) {
          await github.convertPullRequestToDraft(pr.node_id);
          pr = await github.getPullRequest(number);
        }
      }

      const checks = await github.getCheckRuns(pr.head.sha);
      const combined = await github.getCombinedStatus(pr.head.sha);
      const health = classifyHealth(checks.check_runs || [], combined);
      const mergeConflict = pr.mergeable === false || String(pr.mergeable_state || '').toLowerCase() === 'dirty';
      const comments = await github.listComments(number);

      if (health.state === 'success' && !mergeConflict) {
        const changedFiles = await github.listPullRequestFiles(number);
        const reviews = await github.listPullRequestReviews(number);
        let headRoadmap = '';
        try { headRoadmap = await github.getFileContent(roadmapPath, pr.head.sha); }
        catch { headRoadmap = ''; }
        const policy = evaluateAutoMergePolicy({
          pr,
          session,
          health,
          changedFiles,
          reviews,
          baseRoadmap: roadmap,
          headRoadmap,
          bundleId,
          blockedPaths: config.autoMerge?.blockedPaths || [],
          blockedLabels: config.autoMerge?.blockedLabels || [],
          expectedBase: config.startingBranch || 'main'
        });

        if (policy.eligible && autoMergeEnabled && mergeGithub) {
          const headSha = pr.head.sha;
          if (!dryRun && pr.draft && pr.node_id) {
            await github.markPullRequestReadyForReview(pr.node_id);
            pr = await github.getPullRequest(number);
          }
          if (pr.head.sha !== headSha) {
            summary.line(`PR #${number}: head changed while preparing merge; deferred to the next cycle.`);
            results.push({number, open: true, state: 'changed'});
            continue;
          }
          if (!dryRun) {
            await github.addLabels(number, [labels.ready]);
            await github.removeLabel(number, labels.attention);
            await github.removeLabel(number, labels.blocked);
            const mergeResult = await mergeGithub.mergePullRequest(number, {
              method: config.autoMerge?.method || 'squash',
              sha: headSha,
              commitTitle: `${bundleId}: ${pr.title}`,
              commitMessage: `Automatically merged by the Civweave Jules evergreen daemon after session completion, roadmap integrity, sensitive-path, review, mergeability, and GitHub health gates passed.`
            });
            if (!mergeResult.merged) throw new Error(mergeResult.message || `GitHub declined auto-merge for PR #${number}.`);
            await github.addComment(number, `${marker('merged', bundleId, headSha.slice(0, 12))}\n🧵 Auto-merged after the full evergreen policy and GitHub health gates passed.`);
          }
          summary.line(`PR #${number}: auto-merged ${bundleId}.`);
          results.push({number, open: false, state: 'merged', merged: true, bundleId});
          continue;
        }

        const reasons = policy.eligible
          ? [autoMergeEnabled ? 'EVERGREEN_GITHUB_TOKEN is not configured.' : 'JULES_AUTOMERGE_ENABLED is disabled.']
          : policy.reasons;
        if (!dryRun) {
          await github.addLabels(number, [labels.blocked]);
          await github.removeLabel(number, labels.ready);
          const blockMarker = marker('automerge-blocked', bundleId, `${pr.head.sha.slice(0, 12)}-${session.state}`);
          if (!comments.some(comment => String(comment.body || '').includes(blockMarker))) {
            await github.addComment(number, `${blockMarker}\n🛑 Automatic merge is blocked:\n- ${reasons.join('\n- ')}\n\nThe PR remains open for correction or manual review.`);
          }
        }
        summary.line(`PR #${number}: green but auto-merge blocked (${reasons.join('; ')}).`);
      } else if (health.state === 'failure' || mergeConflict) {
        if (!dryRun) {
          await github.addLabels(number, [labels.attention]);
          await github.removeLabel(number, labels.ready);
        }
        const ageMinutes = (now.getTime() - Date.parse(pr.updated_at || now)) / 60000;
        const feedbackDelay = boundedInteger(process.env.JULES_FAILURE_FEEDBACK_AFTER_MINUTES, config.failureFeedbackAfterMinutes ?? 90, {min: 15, max: 1440});
        const feedbackMarker = marker('feedback', bundleId, pr.head.sha.slice(0, 12));
        if (!dryRun && ageMinutes >= feedbackDelay && !comments.some(comment => String(comment.body || '').includes(feedbackMarker))) {
          const failures = mergeConflict ? ['Merge conflict or blocked merge state'] : health.failures;
          await jules.sendMessage(session.name, `The pull request for ${bundleId} is not healthy. Resolve these current blockers, rerun focused checks, and update the existing PR without widening scope:\n- ${failures.join('\n- ')}`);
          await github.addComment(number, `${feedbackMarker}\n⚠️ The evergreen daemon sent the current failure summary back to the originating Jules session.`);
        }
        summary.line(`PR #${number}: ${mergeConflict ? 'merge conflict' : `failing (${health.failures.join(', ')})`}.`);
      } else {
        if (!dryRun) {
          await github.removeLabel(number, labels.ready);
        }
        summary.line(`PR #${number}: ${health.state === 'no-checks' ? 'waiting for health checks' : 'checks pending'}.`);
      }
      results.push({number, open: true, state: health.state, bundleId});
    }
  }
  return results;
}

class Summary {
  constructor(file) {
    this.file = file;
    this.lines = ['## Civweave Jules Evergreen'];
  }
  line(value) { this.lines.push(`- ${value}`); }
  async finish(message) {
    this.line(message);
    const output = `${this.lines.join('\n')}\n`;
    console.log(output);
    if (this.file) await appendFile(this.file, output);
    return {message, lines: this.lines};
  }
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  runEvergreenDaemon().catch(error => {
    console.error(error?.stack || error);
    process.exitCode = 1;
  });
}

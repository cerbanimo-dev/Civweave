import {appendFile} from 'node:fs/promises';
import {
  AI_VALIDATION_RECEIPT_SCHEMA,
  CODE_AUTOMATION_PLAN_SCHEMA,
  GITHUB_VALIDATION_RECEIPT_SCHEMA,
  evaluateCodeAutomationMergeGate,
  recordAiValidationReceipt,
  recordGithubValidationReceipt
} from './lib/code-automation-core.mjs';
import {JulesApiClient} from './lib/jules-api-client.mjs';
import {GitHubApiClient} from './lib/github-evergreen-client.mjs';
import {parsePullRequestNumber, pullRequestUrls} from './lib/jules-evergreen-core.mjs';

const TITLE_PREFIX = '[Civweave Code Automation]';
const TERMINAL_SUCCESS = new Set(['COMPLETED']);

export async function monitorCodeAutomation({env = process.env} = {}) {
  if (!env.JULES_API_KEY) return finish(env, ['JULES_API_KEY is not configured; no code automation sessions were monitored.']);
  if (!env.GITHUB_TOKEN) throw new Error('GITHUB_TOKEN is required.');
  if (!env.GITHUB_REPOSITORY) throw new Error('GITHUB_REPOSITORY is required.');
  const github = new GitHubApiClient({token: env.GITHUB_TOKEN, repository: env.GITHUB_REPOSITORY});
  const mergeGithub = env.CODE_AUTOMATION_GITHUB_TOKEN ? new GitHubApiClient({token: env.CODE_AUTOMATION_GITHUB_TOKEN, repository: env.GITHUB_REPOSITORY}) : null;
  const jules = new JulesApiClient({apiKey: env.JULES_API_KEY});
  const sessions = (await jules.listSessions({pageSize: 100, maxPages: 4})).filter(session => String(session.title || '').startsWith(TITLE_PREFIX));
  const detailed = [];
  for (const session of sessions.slice(0, 80)) {
    try { detailed.push(await jules.getSession(session.name)); }
    catch { detailed.push(session); }
  }
  const lines = [];
  const seen = new Set();
  for (const session of detailed) {
    const planId = planIdFromSession(session);
    if (!planId) continue;
    for (const url of pullRequestUrls(session)) {
      const number = parsePullRequestNumber(url, env.GITHUB_REPOSITORY);
      if (!number || seen.has(number)) continue;
      seen.add(number);
      const result = await inspectPullRequest({env, github, mergeGithub, session, planId, number});
      lines.push(result);
    }
  }
  if (!lines.length) lines.push(`No pull requests are attached to ${sessions.length} managed code automation session${sessions.length === 1 ? '' : 's'}.`);
  return finish(env, lines);
}

async function inspectPullRequest({env, github, mergeGithub, session, planId, number}) {
  let pr = await github.getPullRequest(number);
  if (pr.state !== 'open') return `PR #${number} · ${planId}: ${pr.merged_at ? 'merged' : 'closed'}.`;
  const manifestPath = `.civweave/automation-plans/${planId}.json`;
  let plan;
  try { plan = JSON.parse(await github.getFileContent(manifestPath, pr.head.sha)); }
  catch (error) { return block(github, number, planId, pr.head.sha, [`Missing or invalid ${manifestPath}: ${error.message}`]); }
  if (plan.schema !== CODE_AUTOMATION_PLAN_SCHEMA || plan.id !== planId || !plan.automationOnly) return block(github, number, planId, pr.head.sha, ['The pull request manifest is not the matching canonical automation-only plan.']);
  if (plan.repository !== env.GITHUB_REPOSITORY || plan.baseBranch !== pr.base.ref || pr.head.repo?.full_name !== env.GITHUB_REPOSITORY) return block(github, number, planId, pr.head.sha, ['Repository, base branch, or head repository does not match the approved plan.']);
  const files = await github.listPullRequestFiles(number);
  if (!files.some(file => file.filename === manifestPath)) return block(github, number, planId, pr.head.sha, ['The pull request does not add or update its canonical plan manifest.']);
  const attestation = await fetchAttestation(env, {plan, pr, number});
  if (!attestation) return block(github, number, planId, pr.head.sha, ['The platform AI validator attestation is unavailable.']);
  if (attestation.schema !== 'civweave.code-automation-attestation.v1' || attestation.planId !== planId || attestation.headSha !== pr.head.sha || attestation.integrity !== 'verified-platform-signature') return block(github, number, planId, pr.head.sha, ['The platform validator attestation does not cover the exact current PR head.']);
  for (const receipt of attestation.aiReceipts || []) {
    if (receipt.schema !== AI_VALIDATION_RECEIPT_SCHEMA) continue;
    plan = recordAiValidationReceipt(plan, receipt);
  }
  for (const step of plan.steps) {
    const commitSha = step.aiValidation?.receipt?.commitSha;
    if (!commitSha) continue;
    const includedInHead = await isAncestor(github, commitSha, pr.head.sha);
    const checks = await checksForCommit(github, commitSha);
    plan = recordGithubValidationReceipt(plan, {
      schema: GITHUB_VALIDATION_RECEIPT_SCHEMA,
      id: `github:${plan.id}:${step.id}:${commitSha}`,
      planId: plan.id,
      stepId: step.id,
      state: checks.some(item => ['failure', 'cancelled', 'timed_out', 'action_required', 'startup_failure', 'stale'].includes(item.conclusion)) ? 'failure' : checks.every(item => item.conclusion && item.conclusion !== 'pending') ? 'success' : 'pending',
      commitSha,
      includedInHead,
      checks,
      observedAt: new Date().toISOString()
    });
  }
  const reviews = await github.listPullRequestReviews(number);
  const latestByReviewer = new Map();
  for (const review of reviews) latestByReviewer.set(review.user?.login || review.id, review.state);
  plan.pullRequest = {
    number,
    url: pr.html_url,
    headSha: pr.head.sha,
    mergeable: pr.mergeable === true && !['dirty', 'blocked', 'behind', 'unknown'].includes(String(pr.mergeable_state || '').toLowerCase()),
    reviewState: [...latestByReviewer.values()].includes('CHANGES_REQUESTED') ? 'changes-requested' : 'clear'
  };
  plan = evaluateCodeAutomationMergeGate(plan, pr.head.sha);
  if (!TERMINAL_SUCCESS.has(String(session.state || ''))) plan.mergeGate = {...plan.mergeGate, state: 'blocked', eligible: false, reasons: [...new Set([...plan.mergeGate.reasons, `Jules session is ${session.state || 'not complete'}.`])]};
  if (!plan.mergeGate.eligible) return block(github, number, planId, pr.head.sha, plan.mergeGate.reasons);
  await ensureLabels(github);
  await github.addLabels(number, ['civweave-code-automation', 'code-automation-ready']);
  await github.removeLabel(number, 'code-automation-blocked');
  const marker = `<!-- civweave-code-automation-ready:${planId}:${pr.head.sha} -->`;
  const comments = await github.listComments(number);
  if (!comments.some(comment => String(comment.body || '').includes(marker))) await github.addComment(number, `${marker}\n🧵 Every Cerbanimo automation step has a trusted platform AI validation receipt and successful required GitHub checks for its matching commit. The final head is unchanged and mergeable.`);
  if (!mergeGithub || env.CODE_AUTOMATION_AUTOMERGE_ENABLED === 'false') return `PR #${number} · ${planId}: dual gate passed; waiting for auto-merge credentials or policy.`;
  if (pr.draft && pr.node_id) { await github.markPullRequestReadyForReview(pr.node_id); pr = await github.getPullRequest(number); }
  if (pr.head.sha !== plan.pullRequest.headSha) return block(github, number, planId, pr.head.sha, ['The PR head changed while preparing the merge.']);
  const merged = await mergeGithub.mergePullRequest(number, {method: plan.settingsSnapshot?.mergeMethod || 'squash', sha: pr.head.sha, commitTitle: `${planId}: ${pr.title}`, commitMessage: `Merged by the Civweave code automation controller after every Cerbanimo plan step passed the platform AI task validator and required GitHub checks for matching commits.`});
  if (!merged.merged) throw new Error(merged.message || `GitHub declined the merge for PR #${number}.`);
  return `PR #${number} · ${planId}: auto-merged after the complete dual gate passed.`;
}

async function fetchAttestation(env, {plan, pr, number}) {
  const base = String(env.CIVWEAVE_AI_VALIDATOR_URL || '').replace(/\/$/, '');
  if (!base || !env.CIVWEAVE_AI_VALIDATOR_TOKEN) return null;
  const query = new URLSearchParams({repository: env.GITHUB_REPOSITORY, pullRequest: String(number), headSha: pr.head.sha});
  const response = await fetch(`${base}/plans/${encodeURIComponent(plan.id)}/attestation?${query}`, {headers: {accept: 'application/json', authorization: `Bearer ${env.CIVWEAVE_AI_VALIDATOR_TOKEN}`}});
  if (!response.ok) return null;
  return response.json();
}

async function checksForCommit(github, sha) {
  const [runs, combined] = await Promise.all([github.getCheckRuns(sha), github.getCombinedStatus(sha)]);
  const checks = [];
  for (const run of runs.check_runs || []) checks.push({name: run.name, conclusion: run.status === 'completed' ? String(run.conclusion || 'failure') : 'pending', url: run.html_url || run.details_url || ''});
  for (const status of combined.statuses || []) checks.push({name: status.context, conclusion: status.state === 'success' ? 'success' : status.state === 'pending' ? 'pending' : 'failure', url: status.target_url || ''});
  return dedupeChecks(checks);
}
function dedupeChecks(checks) {
  const map = new Map();
  for (const check of checks) {
    const key = String(check.name || '').toLowerCase();
    const current = map.get(key);
    if (!current || rank(check.conclusion) > rank(current.conclusion)) map.set(key, check);
  }
  return [...map.values()];
}
function rank(value) { return ({failure: 4, cancelled: 4, timed_out: 4, action_required: 4, pending: 3, success: 2, neutral: 1, skipped: 1})[value] || 0; }
async function isAncestor(github, base, head) {
  if (base === head) return true;
  try { const comparison = await github.request(`/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`); return ['ahead', 'identical'].includes(comparison.status); }
  catch { return false; }
}
async function ensureLabels(github) {
  await github.ensureLabel({name: 'civweave-code-automation', color: '8250df', description: 'Managed by the Civweave Cerbanimo code automation controller'});
  await github.ensureLabel({name: 'code-automation-ready', color: '1f883d', description: 'Platform AI validation and GitHub checks passed for every automation step'});
  await github.ensureLabel({name: 'code-automation-blocked', color: 'd1242f', description: 'The Civweave code automation dual gate is blocked'});
}
async function block(github, number, planId, headSha, reasons) {
  await ensureLabels(github);
  await github.addLabels(number, ['civweave-code-automation', 'code-automation-blocked']);
  await github.removeLabel(number, 'code-automation-ready');
  const marker = `<!-- civweave-code-automation-blocked:${planId}:${headSha} -->`;
  const comments = await github.listComments(number);
  if (!comments.some(comment => String(comment.body || '').includes(marker))) await github.addComment(number, `${marker}\n🛑 Automatic merge is blocked:\n- ${reasons.join('\n- ')}\n\nThe same PR may continue after the failed or stale step is revised and both receipts are refreshed.`);
  return `PR #${number} · ${planId}: blocked (${reasons.join('; ')}).`;
}
function planIdFromSession(session) { return String(session.title || '').match(/\b(cv-code-[a-z0-9-]+)\b/i)?.[1] || ''; }
async function finish(env, lines) {
  const text = Array.isArray(lines) ? lines.join('\n') : String(lines);
  if (env.GITHUB_STEP_SUMMARY) await appendFile(env.GITHUB_STEP_SUMMARY, `## Civweave code automation monitor\n\n${text.split('\n').map(line => `- ${line}`).join('\n')}\n`);
  console.log(text);
  return text;
}

if (import.meta.url === `file://${process.argv[1]}`) monitorCodeAutomation().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });

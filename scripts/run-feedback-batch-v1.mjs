import { createHash } from 'node:crypto';

const API = 'https://api.github.com';
const REPO = process.env.GITHUB_REPOSITORY || 'cerbanimo-dev/Civweave';
const TOKEN = process.env.GITHUB_TOKEN || '';
const MODE = process.env.FEEDBACK_BATCH_MODE || 'discern';
const NOW = new Date(process.env.FEEDBACK_NOW || Date.now());
const VETO_HOURS = Math.max(1, Math.min(168, Number(process.env.FEEDBACK_VETO_HOURS || 12)));
const DEV_BRANCH = process.env.FEEDBACK_DEV_BRANCH || 'dev';
const MAIL_BATCH_URL = process.env.CIVWEAVE_FEEDBACK_BATCH_URL || 'https://mail.civweave.cc/api/feedback/batch';
const MAIL_TOKEN = process.env.CIVWEAVE_FEEDBACK_BATCH_TOKEN || '';
const MODEL_ENDPOINT = process.env.CIVWEAVE_FEEDBACK_DISCERN_ENDPOINT || '';
const LABEL_BATCH = 'feedback-batch';
const LABEL_VETO = 'feedback-veto';
const LABEL_HUMAN = 'feedback-human-review';
const LABEL_READY = 'feedback-ready-for-dev';

const fatal = message => { throw new Error(message); };
const jsonHeaders = () => ({
  accept: 'application/vnd.github+json',
  authorization: `Bearer ${TOKEN}`,
  'content-type': 'application/json',
  'x-github-api-version': '2022-11-28',
});
async function gh(path, init = {}) {
  if (!TOKEN) fatal('GITHUB_TOKEN is required.');
  const response = await fetch(`${API}${path}`, { ...init, headers: { ...jsonHeaders(), ...(init.headers || {}) } });
  const packet = await response.json().catch(() => ({}));
  if (!response.ok) fatal(`GitHub ${response.status}: ${packet?.message || path}`);
  return packet;
}
async function mail(path = MAIL_BATCH_URL) {
  if (!MAIL_TOKEN) return { ok: true, items: [], source: 'mail-token-unconfigured' };
  const response = await fetch(path, { headers: { authorization: `Bearer ${MAIL_TOKEN}`, accept: 'application/json' } });
  const packet = await response.json().catch(() => ({}));
  if (!response.ok || packet?.ok !== true) fatal(`Feedback mail batch failed: ${packet?.error || response.status}`);
  return packet;
}
const text = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
const hash = value => createHash('sha256').update(String(value)).digest('hex');
const slug = value => text(value, 80).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'feedback';
function redact(value) {
  return text(value, 12000)
    .replace(/\b(?:ghp|github_pat|sk|rk|pk)_[A-Za-z0-9_\-]{16,}\b/g, '[redacted-token]')
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[redacted-email]')
    .replace(/\b(?:Bearer\s+)?[A-Za-z0-9_\-]{36,}\b/g, '[redacted-secret]');
}
function deterministicTriage(item) {
  const subject = text(item.subject, 240), body = redact(item.text || item.body || item.preview || '');
  const combined = `${subject}\n${body}`.toLowerCase();
  const flags = [];
  if (/security|vulnerability|exploit|credential|password|token|privacy|dox|leak/.test(combined)) flags.push('security-privacy');
  if (/stripe|payment|money|price|subscription|tax|payout|economic|button|acorn/.test(combined)) flags.push('economic-payment');
  if (/governance|vote|election|legal|terms|policy|law|regulation/.test(combined)) flags.push('governance-legal');
  if (/delete|drop table|wipe|purge|destroy|irreversible|migration/.test(combined)) flags.push('destructive-data');
  const classification = /bug|broken|crash|error|fail|regression|doesn.t work|not working/.test(combined) ? 'bug'
    : /feature|request|please add|would like|wish|support for|could we/.test(combined) ? 'feature'
      : /spam|unsubscribe|marketing/.test(combined) ? 'abuse-spam' : 'question-or-other';
  const evidence = /steps|reproduce|console|error|screenshot|version|expected|actual/.test(combined) ? 0.82 : 0.58;
  const severity = /data loss|security|cannot boot|won.t boot|crash|payment/.test(combined) ? 0.92 : /broken|fail|regression/.test(combined) ? 0.72 : 0.5;
  const bounded = body.length < 5000 && !flags.length;
  const recommendation = ['bug', 'feature'].includes(classification) && bounded ? 'queue-for-dev' : flags.length ? 'needs-human-review' : classification === 'abuse-spam' ? 'reject' : 'investigate';
  return { classification, flags, evidence, severity, bounded, recommendation, subject, summary: body.slice(0, 1600) };
}
async function modelDiscern(items) {
  if (!MODEL_ENDPOINT || !items.length) return null;
  const response = await fetch(MODEL_ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ schema: 'civweave.feedback-discern-request.v1', items }) });
  if (!response.ok) return null;
  return response.json().catch(() => null);
}
function dedupe(items) {
  const groups = new Map();
  for (const item of items) {
    const key = hash(`${slug(item.triage.subject)}\n${item.triage.summary.toLowerCase().replace(/\s+/g, ' ').slice(0, 500)}`).slice(0, 20);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return [...groups.entries()].map(([key, group]) => ({ key, primary: group[0], corroborating: group.slice(1).map(row => row.id) }));
}
function priority(row) {
  const t = row.primary.triage;
  const typeBoost = t.classification === 'bug' ? 0.15 : 0;
  const corroboration = Math.min(0.2, row.corroborating.length * 0.04);
  return Number((t.severity * 0.4 + t.evidence * 0.25 + typeBoost + corroboration + (t.bounded ? 0.2 : 0)).toFixed(3));
}
function issueBody(batch) {
  const lines = [
    `<!-- civweave-feedback-batch:${batch.id} -->`,
    `# Daily feedback discernment ${batch.id}`,
    '',
    `Collection ended: ${batch.createdAt}`,
    `Human veto deadline: ${batch.vetoUntil}`,
    `Automation target after deadline: \`${DEV_BRANCH}\` only`,
    '',
    'Add label `feedback-veto` to veto the whole batch. Add `feedback-human-review` to keep it triage-only. Automation never promotes `dev` to `main`.',
    '',
    '## Ranked candidates',
  ];
  for (const [index, row] of batch.groups.entries()) {
    const t = row.primary.triage;
    lines.push('', `### ${index + 1}. ${t.subject || '(no subject)'}`, `- item: \`${row.primary.id}\``, `- class: **${t.classification}**`, `- recommendation: **${t.recommendation}**`, `- priority: **${row.priority}**`, `- evidence: ${t.evidence}`, `- severity: ${t.severity}`, `- flags: ${t.flags.length ? t.flags.join(', ') : 'none'}`, `- corroborating reports: ${row.corroborating.length}`, '', redact(t.summary));
  }
  lines.push('', '## Machine state', '```json', JSON.stringify({ schema: 'civweave.feedback-batch.v1', id: batch.id, createdAt: batch.createdAt, vetoUntil: batch.vetoUntil, devBranch: DEV_BRANCH, candidateIds: batch.groups.filter(r => r.primary.triage.recommendation === 'queue-for-dev').map(r => r.primary.id) }, null, 2), '```');
  return lines.join('\n');
}
async function ensureLabels() {
  const labels = [
    [LABEL_BATCH, 'Daily mail feedback batch'],
    [LABEL_VETO, 'Human veto blocks automation'],
    [LABEL_HUMAN, 'Requires human review'],
    [LABEL_READY, 'Veto window passed; eligible for dev automation'],
  ];
  for (const [name, description] of labels) {
    const response = await fetch(`${API}/repos/${REPO}/labels/${encodeURIComponent(name)}`, { headers: jsonHeaders() });
    if (response.status === 404) await gh(`/repos/${REPO}/labels`, { method: 'POST', body: JSON.stringify({ name, description }) });
  }
}
async function discern() {
  await ensureLabels();
  const packet = await mail();
  const raw = Array.isArray(packet.items) ? packet.items : [];
  if (!raw.length) { console.log(JSON.stringify({ ok: true, mode: MODE, batch: null, message: 'No new guide-mail feedback.' })); return; }
  const items = raw.slice(0, 200).map((item, index) => ({ id: text(item.id || `mail-${index}`, 120), guide: text(item.guide || item.to, 120), receivedAt: text(item.receivedAt, 64), triage: deterministicTriage(item) }));
  const model = await modelDiscern(items);
  if (model?.items && Array.isArray(model.items)) {
    const byId = new Map(model.items.map(item => [item.id, item]));
    for (const item of items) {
      const suggestion = byId.get(item.id);
      if (!suggestion) continue;
      if (Array.isArray(suggestion.flags) && suggestion.flags.length) item.triage.flags = [...new Set([...item.triage.flags, ...suggestion.flags.map(v => text(v, 80))])];
      if (['reject', 'needs-human-review', 'investigate', 'queue-for-dev', 'duplicate'].includes(suggestion.recommendation)) item.triage.recommendation = suggestion.recommendation;
      if (item.triage.flags.length) item.triage.recommendation = 'needs-human-review';
    }
  }
  const groups = dedupe(items).map(row => ({ ...row, priority: priority(row) })).sort((a, b) => b.priority - a.priority);
  const id = NOW.toISOString().slice(0, 10), vetoUntil = new Date(NOW.getTime() + VETO_HOURS * 60 * 60 * 1000).toISOString();
  const batch = { id, createdAt: NOW.toISOString(), vetoUntil, groups };
  const issue = await gh(`/repos/${REPO}/issues`, { method: 'POST', body: JSON.stringify({ title: `Feedback discernment ${id}`, body: issueBody(batch), labels: [LABEL_BATCH] }) });
  console.log(JSON.stringify({ ok: true, mode: MODE, batch: id, issue: issue.number, vetoUntil, items: items.length, candidates: groups.filter(r => r.primary.triage.recommendation === 'queue-for-dev').length }));
}
async function promote() {
  await ensureLabels();
  const issues = await gh(`/repos/${REPO}/issues?state=open&labels=${encodeURIComponent(LABEL_BATCH)}&per_page=100`);
  const ready = [];
  for (const issue of issues) {
    const labels = new Set((issue.labels || []).map(label => typeof label === 'string' ? label : label.name));
    if (labels.has(LABEL_VETO) || labels.has(LABEL_HUMAN)) continue;
    const marker = String(issue.body || '').match(/"vetoUntil":\s*"([^"]+)"/);
    if (!marker || Date.parse(marker[1]) > NOW.getTime()) continue;
    if (!labels.has(LABEL_READY)) await gh(`/repos/${REPO}/issues/${issue.number}/labels`, { method: 'POST', body: JSON.stringify({ labels: [LABEL_READY] }) });
    ready.push(issue.number);
  }
  console.log(JSON.stringify({ ok: true, mode: MODE, readyIssues: ready, devBranch: DEV_BRANCH, note: 'Ready issues are dispatch-eligible; implementation agents must still satisfy AGENTS.md, testing, validation, and dev-only merge gates.' }));
}

if (!['discern', 'promote'].includes(MODE)) fatal('FEEDBACK_BATCH_MODE must be discern or promote.');
await (MODE === 'discern' ? discern() : promote());

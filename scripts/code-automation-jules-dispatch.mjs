import {appendFile} from 'node:fs/promises';
import {buildCodeAutomationPrompt, CODE_AUTOMATION_PLAN_SCHEMA} from './lib/code-automation-core.mjs';
import {JulesApiClient, JulesApiError} from './lib/jules-api-client.mjs';

const ACTIVE = new Set(['QUEUED', 'PLANNING', 'AWAITING_PLAN_APPROVAL', 'AWAITING_USER_FEEDBACK', 'IN_PROGRESS', 'PAUSED']);
const TITLE_PREFIX = '[Civweave Code Automation]';

export async function dispatchCodeAutomation({env = process.env} = {}) {
  if (!env.JULES_API_KEY) throw new Error('JULES_API_KEY is required.');
  if (!env.GITHUB_REPOSITORY) throw new Error('GITHUB_REPOSITORY is required.');
  const envelope = parsePayload(env.CIVWEAVE_CODE_AUTOMATION_PAYLOAD);
  const plan = envelope?.plan;
  if (plan?.schema !== CODE_AUTOMATION_PLAN_SCHEMA) throw new Error('The repository dispatch did not contain a canonical code automation plan.');
  if (plan.repository !== env.GITHUB_REPOSITORY) throw new Error(`The plan targets ${plan.repository || 'no repository'}, not ${env.GITHUB_REPOSITORY}.`);
  if (!plan.automationOnly) throw new Error('Only automation-only Cerbanimo plans may use this dispatcher.');
  const jules = new JulesApiClient({apiKey: env.JULES_API_KEY});
  const sessions = await jules.listSessions({pageSize: 100, maxPages: 3});
  const duplicate = sessions.find(session => `${session.title || ''}\n${session.prompt || ''}`.includes(plan.id) && ACTIVE.has(String(session.state || '')));
  if (duplicate) return finish(env, `A Jules session is already active for ${plan.id}: ${duplicate.url || duplicate.name}`);
  const sources = await jules.listSources({pageSize: 100, maxPages: 3});
  const [owner, repo] = env.GITHUB_REPOSITORY.split('/');
  const source = sources.find(item => item?.githubRepo?.owner?.toLowerCase() === owner.toLowerCase() && item?.githubRepo?.repo?.toLowerCase() === repo.toLowerCase());
  if (!source) throw new Error(`Jules has no connected source for ${env.GITHUB_REPOSITORY}.`);
  const title = `${TITLE_PREFIX} ${plan.id} · ${plan.title}`;
  try {
    const session = await jules.createSession({prompt: buildCodeAutomationPrompt(plan), title, source: source.name, startingBranch: plan.baseBranch || 'main', requirePlanApproval: false});
    return finish(env, `Launched ${session.title || title}: ${session.url || session.name}`);
  } catch (error) {
    if (error instanceof JulesApiError && error.status === 429) return finish(env, `Jules rate-limited ${plan.id}; retry the repository dispatch later.`);
    throw error;
  }
}

function parsePayload(value) {
  if (!value) throw new Error('CIVWEAVE_CODE_AUTOMATION_PAYLOAD is required.');
  let payload;
  try { payload = JSON.parse(value); }
  catch { throw new Error('CIVWEAVE_CODE_AUTOMATION_PAYLOAD is not valid JSON.'); }
  if (payload?.schema === 'civweave.code-automation-dispatch.v1') return payload;
  if (payload?.client_payload?.schema === 'civweave.code-automation-dispatch.v1') return payload.client_payload;
  throw new Error('Unsupported code automation dispatch envelope.');
}

async function finish(env, message) {
  if (env.GITHUB_STEP_SUMMARY) await appendFile(env.GITHUB_STEP_SUMMARY, `## Civweave code automation\n\n${message}\n`);
  console.log(message);
  return message;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  dispatchCodeAutomation().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
}

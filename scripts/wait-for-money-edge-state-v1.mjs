const args = Object.fromEntries(process.argv.slice(2).map(raw => {
  const match = /^--([^=]+)=(.*)$/.exec(raw);
  if (!match) throw new Error(`Expected --name=value argument, got ${raw}`);
  return [match[1], match[2]];
}));

const origin = String(process.env.CIVWEAVE_LIVE_CORE_ORIGIN || args.origin || 'https://civweave-core.cerbanimo.workers.dev').replace(/\/$/, '');
const timeoutMs = Number(args['timeout-ms'] || 90_000);
const intervalMs = Number(args['interval-ms'] || 2_000);
const expectedProviderMode = args['provider-mode'] || '';
const expectedLiveReady = args['live-ready'] === undefined ? null : args['live-ready'] === 'true';
const expectedIntegrationReady = args['integration-ready'] === undefined ? null : args['integration-ready'] === 'true';
const onlyOperationalBlocker = args['only-operational-blocker'] || '';
const noOperationalBlockers = args['no-operational-blockers'] === 'true';

if (!Number.isFinite(timeoutMs) || timeoutMs < 1_000) throw new Error('timeout-ms must be at least 1000.');
if (!Number.isFinite(intervalMs) || intervalMs < 250) throw new Error('interval-ms must be at least 250.');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const sanitize = edge => ({
  authority: edge?.authority || null,
  providerMode: edge?.providerMode || null,
  integrationDoorReady: edge?.integrationDoorReady === true,
  liveReady: edge?.liveReady === true,
  structuralBlockers: edge?.structuralBlockers || [],
  operationalBlockers: edge?.operationalBlockers || []
});

function matches(edge) {
  if (expectedProviderMode && edge.providerMode !== expectedProviderMode) return false;
  if (expectedLiveReady !== null && (edge.liveReady === true) !== expectedLiveReady) return false;
  if (expectedIntegrationReady !== null && (edge.integrationDoorReady === true) !== expectedIntegrationReady) return false;
  const blockers = edge.operationalBlockers || [];
  if (onlyOperationalBlocker && (blockers.length !== 1 || blockers[0] !== onlyOperationalBlocker)) return false;
  if (noOperationalBlockers && blockers.length !== 0) return false;
  return true;
}

const deadline = Date.now() + timeoutMs;
let attempt = 0;
let last = null;
let lastError = null;
while (Date.now() <= deadline) {
  attempt += 1;
  try {
    const url = `${origin}/api/money-edge/status?promotion_probe=${Date.now()}`;
    const response = await fetch(url, {
      headers: { accept: 'application/json', 'cache-control': 'no-cache' },
      cache: 'no-store'
    });
    if (!response.ok) throw new Error(`status HTTP ${response.status}`);
    const payload = await response.json();
    const edge = payload.moneyEdge || payload;
    last = sanitize(edge);
    console.log(JSON.stringify({ attempt, observed: last }));

    // Fail immediately if a staging/pre-enable probe discovers money already live.
    if (expectedLiveReady === false && edge.liveReady === true) {
      throw new Error(`Money edge became live unexpectedly while waiting for a closed state: ${JSON.stringify(last)}`);
    }
    if (matches(edge)) {
      console.log(JSON.stringify({ ok: true, attempts: attempt, state: last }, null, 2));
      process.exit(0);
    }
    lastError = null;
  } catch (error) {
    lastError = error;
    console.error(`Money-edge propagation probe ${attempt} did not match yet: ${error?.message || error}`);
    if (String(error?.message || '').includes('became live unexpectedly')) throw error;
  }
  await sleep(intervalMs);
}

throw new Error(`Timed out waiting for money-edge propagation after ${attempt} attempts. Last state: ${JSON.stringify(last)}${lastError ? `; last error: ${lastError.message}` : ''}`);

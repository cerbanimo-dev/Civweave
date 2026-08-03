import { spawn } from 'node:child_process';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dataDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'commonweave-federation-'));
const port = 18787;
const appPort = 18788;
const child = spawn(process.execPath, ['server-federated-v152.mjs'], {
  cwd: root,
  env: {
    ...process.env,
    PORT: String(port),
    COMMONWEAVE_APP_PORT: String(appPort),
    PUBLIC_HOST_URL: `http://127.0.0.1:${port}`,
    COMMONWEAVE_NODE_NAME: 'Federation Verification Node',
    DATA_DIR: dataDir
  },
  stdio: ['ignore', 'pipe', 'pipe']
});

let output = '';
child.stdout.on('data', chunk => { output += chunk; });
child.stderr.on('data', chunk => { output += chunk; });

async function waitFor(url, timeout = 20000) {
  const deadline = Date.now() + timeout;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) { lastError = error; }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw lastError || new Error(`Timed out waiting for ${url}`);
}

try {
  const profileResponse = await waitFor(`http://127.0.0.1:${port}/.well-known/commonweave`);
  const profile = await profileResponse.json();
  if (profile.schema !== 'commonweave.node-profile.v1') throw new Error('Discovery schema is missing or incorrect.');
  if (!profile.nodeId?.startsWith('cw:')) throw new Error('Persistent node identity was not generated.');
  if (!profile.publicKey?.includes('BEGIN PUBLIC KEY')) throw new Error('Public signing key was not advertised.');
  if (!profile.inbox?.endsWith('/federation/inbox')) throw new Error('Federation inbox was not advertised.');

  const eventResponse = await fetch(`http://127.0.0.1:${port}/api/federation/events`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ kind: 'commonweave.test', subject: 'Federation verification', payload: { ok: true }, targets: [] })
  });
  if (eventResponse.status !== 201) throw new Error(`Event publication failed with HTTP ${eventResponse.status}`);
  const published = await eventResponse.json();
  if (!published.event?.signature) throw new Error('Published event was not signed.');

  const eventsResponse = await fetch(`http://127.0.0.1:${port}/api/federation/events`);
  const events = await eventsResponse.json();
  if (!events.events?.some(event => event.id === published.event.id)) throw new Error('Published event was not retained.');

  const statusResponse = await fetch(`http://127.0.0.1:${port}/api/federation/status`);
  const status = await statusResponse.json();
  if (status.events < 1) throw new Error('Federation status did not report retained events.');

  console.log(`Federation verification passed for ${profile.nodeId}.`);
} catch (error) {
  console.error(output);
  throw error;
} finally {
  child.kill('SIGTERM');
  await new Promise(resolve => setTimeout(resolve, 500));
  await fsp.rm(dataDir, { recursive: true, force: true });
}

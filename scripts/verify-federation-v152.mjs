import { spawn } from 'node:child_process';
import fsp from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workspace = await fsp.mkdtemp(path.join(os.tmpdir(), 'civweave-federation-'));
const processes = [];

async function freePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}
async function writeStub(file, label) {
  await fsp.writeFile(file, `import http from 'node:http';\nconst server=http.createServer((req,res)=>{const body=JSON.stringify({ok:true,label:${JSON.stringify(label)},path:req.url});res.writeHead(200,{'content-type':'application/json','content-length':Buffer.byteLength(body)});res.end(body);});server.listen(Number(process.env.PORT),'127.0.0.1');process.on('SIGTERM',()=>server.close(()=>process.exit(0)));\n`);
}
async function waitFor(url, init = {}, timeout = 20000) {
  const deadline = Date.now() + timeout;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, init);
      if (response.ok) return response;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) { lastError = error; }
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  throw lastError || new Error(`Timed out waiting for ${url}`);
}
async function startNode(label) {
  const dataDir = path.join(workspace, label.toLowerCase());
  await fsp.mkdir(dataDir, { recursive: true });
  const appEntry = path.join(dataDir, 'app-stub.mjs');
  await writeStub(appEntry, label);
  const port = await freePort();
  const appPort = await freePort();
  const token = `test-token-${label.toLowerCase()}`;
  const child = spawn(process.execPath, ['server/federated.mjs'], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(port),
      CIVWEAVE_APP_PORT: String(appPort),
      CIVWEAVE_APP_ENTRY: appEntry,
      PUBLIC_HOST_URL: `http://127.0.0.1:${port}`,
      CIVWEAVE_NODE_NAME: `Federation Verification ${label}`,
      CIVWEAVE_FEDERATION_ADMIN_TOKEN: token,
      DATA_DIR: dataDir
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const node = { label, dataDir, appEntry, port, appPort, token, child, output: '' };
  child.stdout.on('data', chunk => { node.output += chunk; });
  child.stderr.on('data', chunk => { node.output += chunk; });
  processes.push(node);
  await waitFor(`http://127.0.0.1:${port}/api/federation/health`);
  return node;
}
async function stopNode(node) {
  if (!node || node.child.exitCode != null) return;
  node.child.kill('SIGTERM');
  await Promise.race([
    new Promise(resolve => node.child.once('exit', resolve)),
    new Promise(resolve => setTimeout(resolve, 5000))
  ]);
  if (node.child.exitCode == null) node.child.kill('SIGKILL');
}
function adminHeaders(node, extra = {}) {
  return { authorization: `Bearer ${node.token}`, ...extra };
}
async function adminJson(node, pathname, init = {}) {
  const response = await fetch(`http://127.0.0.1:${node.port}${pathname}`, {
    ...init,
    headers: adminHeaders(node, init.headers || {})
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${node.label} ${pathname} failed with HTTP ${response.status}: ${body.error || 'unknown error'}`);
  return body;
}
async function postAdmin(node, pathname, body) {
  return adminJson(node, pathname, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}

let nodeA;
let nodeB;
try {
  nodeA = await startNode('Node A');
  nodeB = await startNode('Node B');

  const unauthorized = await fetch(`http://127.0.0.1:${nodeA.port}/api/federation/status`);
  assert(unauthorized.status === 401, `Federation admin API should require a token, received ${unauthorized.status}.`);

  const profileA = await (await fetch(`http://127.0.0.1:${nodeA.port}/.well-known/civweave`)).json();
  const profileB = await (await fetch(`http://127.0.0.1:${nodeB.port}/.well-known/civweave`)).json();
  assert(profileA.schema === 'civweave.node-profile.v1', 'Node A discovery schema is missing or incorrect.');
  assert(profileB.schema === 'civweave.node-profile.v1', 'Node B discovery schema is missing or incorrect.');
  assert(profileA.nodeId !== profileB.nodeId, 'Independent nodes must have different identities.');
  assert(profileA.keyFingerprint?.startsWith('sha256:'), 'Node A did not advertise a signing-key fingerprint.');

  const proxied = await (await fetch(`http://127.0.0.1:${nodeA.port}/stub-ping`)).json();
  assert(proxied.ok && proxied.label === 'Node A', 'Federated gateway did not preserve the application proxy surface.');

  const connectedB = await postAdmin(nodeA, '/api/federation/peers/connect', { baseUrl: profileB.baseUrl });
  const connectedA = await postAdmin(nodeB, '/api/federation/peers/connect', { baseUrl: profileA.baseUrl });
  assert(connectedB.peer.status === 'pending' && connectedA.peer.status === 'pending', 'Peers should require explicit approval by default.');

  await postAdmin(nodeA, `/api/federation/peers/${encodeURIComponent(profileB.nodeId)}/trust`, {});
  await postAdmin(nodeB, `/api/federation/peers/${encodeURIComponent(profileA.nodeId)}/trust`, {});

  const publication = await postAdmin(nodeA, '/api/federation/events', {
    kind: 'civweave.test',
    subject: 'Two-node federation verification',
    payload: { ok: true },
    targets: [profileB.nodeId]
  });
  assert(publication.ok, `Federated delivery failed: ${JSON.stringify(publication.deliveries)}`);
  assert(publication.event?.signature, 'Published event was not signed.');
  assert(publication.deliveries?.[0]?.accepted, 'Remote node did not acknowledge the event.');

  const eventsB = await adminJson(nodeB, '/api/federation/events');
  assert(eventsB.events?.some(event => event.id === publication.event.id), 'Node B did not retain Node A event.');
  const countBeforeDuplicate = eventsB.events.length;

  const duplicateResponse = await fetch(`http://127.0.0.1:${nodeB.port}/federation/inbox`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-civweave-sender': profileA.nodeId },
    body: JSON.stringify({ sender: profileA, event: publication.event })
  });
  const duplicate = await duplicateResponse.json();
  assert(duplicateResponse.status === 202 && duplicate.accepted && duplicate.duplicate, 'Duplicate event was not acknowledged idempotently.');
  const eventsAfterDuplicate = await adminJson(nodeB, '/api/federation/events');
  assert(eventsAfterDuplicate.events.length === countBeforeDuplicate, 'Duplicate event was stored more than once.');

  const tampered = structuredClone(publication.event);
  tampered.payload = { ok: false };
  const tamperedResponse = await fetch(`http://127.0.0.1:${nodeB.port}/federation/inbox`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-civweave-sender': profileA.nodeId },
    body: JSON.stringify({ sender: profileA, event: tampered })
  });
  assert(tamperedResponse.status === 400, `Tampered event should fail signature verification, received ${tamperedResponse.status}.`);

  await postAdmin(nodeB, `/api/federation/peers/${encodeURIComponent(profileA.nodeId)}/block`, {});
  const blockedPublication = await postAdmin(nodeA, '/api/federation/events', {
    kind: 'civweave.test.blocked',
    subject: 'Blocked delivery verification',
    payload: { blocked: true },
    targets: [profileB.nodeId]
  });
  assert(blockedPublication.ok === false && blockedPublication.deliveries?.[0]?.ok === false, 'Blocked peer delivery should be reported as failed.');

  const retainedNodeId = profileA.nodeId;
  const retainedFingerprint = profileA.keyFingerprint;
  const retainedPort = nodeA.port;
  const retainedAppPort = nodeA.appPort;
  await stopNode(nodeA);
  const restarted = spawn(process.execPath, ['server/federated.mjs'], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(retainedPort),
      CIVWEAVE_APP_PORT: String(retainedAppPort),
      CIVWEAVE_APP_ENTRY: nodeA.appEntry,
      PUBLIC_HOST_URL: `http://127.0.0.1:${retainedPort}`,
      CIVWEAVE_NODE_NAME: 'Federation Verification Node A Restarted',
      CIVWEAVE_FEDERATION_ADMIN_TOKEN: nodeA.token,
      DATA_DIR: nodeA.dataDir
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  nodeA = { ...nodeA, child: restarted, output: '' };
  restarted.stdout.on('data', chunk => { nodeA.output += chunk; });
  restarted.stderr.on('data', chunk => { nodeA.output += chunk; });
  processes[0] = nodeA;
  await waitFor(`http://127.0.0.1:${retainedPort}/api/federation/health`);
  const restartedProfile = await (await fetch(`http://127.0.0.1:${retainedPort}/.well-known/civweave`)).json();
  assert(restartedProfile.nodeId === retainedNodeId, 'Node identity did not survive restart.');
  assert(restartedProfile.keyFingerprint === retainedFingerprint, 'Node signing key did not survive restart.');

  console.log(`Federation verification passed between ${profileA.nodeId} and ${profileB.nodeId}.`);
} catch (error) {
  for (const node of processes) {
    if (node?.output) console.error(`\n--- ${node.label} output ---\n${node.output}`);
  }
  throw error;
} finally {
  await Promise.all(processes.map(stopNode));
  await fsp.rm(workspace, { recursive: true, force: true });
}

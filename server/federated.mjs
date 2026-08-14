import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const version = (await fsp.readFile(path.join(root, 'VERSION'), 'utf8')).trim();
const release = path.join(root, 'releases', version, 'server');
const runtimePath = path.join(root, '.civweave-canonical-federated.entry.mjs');
process.env.DATA_DIR ||= path.join(root, 'data');
process.env.CIVWEAVE_APP_ENTRY ||= path.join(root, 'server', 'gateway.mjs');
let source = await fsp.readFile(path.join(release, 'server-federated-v152.mjs'), 'utf8');
function replaceRequired(before, after, label) {
  if (!source.includes(before)) throw new Error(`Civweave federated account patch could not find ${label}`);
  source = source.replace(before, after);
}
replaceRequired(
  "import { createLocalHostCapacityStore } from './lib/local-host-capacity-v1.mjs';",
  "import { createLocalHostCapacityStore } from './lib/local-host-capacity-v2.mjs';\nimport { createLocalHubAccountStore } from './lib/local-hub-account-v2.mjs';",
  'local capacity import'
);
replaceRequired(
  "const localCapacity = createLocalHostCapacityStore({ dataDir: DATA_DIR, nodeId: identity.nodeId });",
  "const localCapacity = createLocalHostCapacityStore({ dataDir: DATA_DIR, nodeId: identity.nodeId });\nconst localHubAccounts = createLocalHubAccountStore({ dataDir: DATA_DIR, nodeId: identity.nodeId });",
  'local account store initialization'
);
replaceRequired(
`    if (pathname === '/api/federation/capacity' && req.method === 'GET') {
      return json(res, 200, { ok: true, capacity: await localCapacity.snapshot() });
    }
    if (pathname === '/api/federation/residents/admit' && req.method === 'POST') {
      if (!localNetworkClient(req)) return json(res, 403, { error: 'Local Host Node community admission is limited to localhost and private-LAN clients until authenticated public admission is available.' });
      const input = await readBody(req, 64 * 1024);
      if (input.seatClass && clean(input.seatClass, 40).toLowerCase() !== 'community') return json(res, 400, { error: 'Public local admission may only claim a community seat.' });
      const result = await localCapacity.admit({ residentId: input.residentId, userId: input.userId, seatClass: 'community', billingStatus: 'free' });
      return json(res, result.idempotent ? 200 : 201, { ok: true, ...result });
    }
    if (pathname.startsWith('/api/federation/')) {
      if (req.method === 'OPTIONS') return json(res, 405, { error: 'Cross-origin federation administration is not enabled.' });
      if (!requireAdmin(req, res)) return;
    }
    if (pathname === '/api/federation/residents/billing' && req.method === 'POST') {
      const input = await readBody(req, 64 * 1024);
      const result = await localCapacity.setBilling(input);
      return json(res, 200, { ok: true, ...result });
    }`,
`    if (pathname === '/api/federation/capacity' && req.method === 'GET') {
      return json(res, 200, { ok: true, capacity: await localCapacity.snapshot() });
    }
    if (pathname.startsWith('/api/federation/account/') && !localNetworkClient(req)) {
      return json(res, 403, { error: 'Local Hub account setup is limited to localhost and private-LAN clients.' });
    }
    if (pathname === '/api/federation/account/create' && req.method === 'POST') {
      return json(res, 201, await localHubAccounts.create(await readBody(req, 64 * 1024)));
    }
    if (pathname === '/api/federation/account/totp/verify' && req.method === 'POST') {
      return json(res, 200, await localHubAccounts.verifyTotpSetup(await readBody(req, 64 * 1024)));
    }
    if (pathname === '/api/federation/account/recovery/ack' && req.method === 'POST') {
      return json(res, 200, await localHubAccounts.acknowledgeRecoveryKit(await readBody(req, 64 * 1024)));
    }
    if (pathname === '/api/federation/account/recovery/regenerate' && req.method === 'POST') {
      return json(res, 200, await localHubAccounts.regenerateRecoveryKit(await readBody(req, 64 * 1024)));
    }
    if (pathname === '/api/federation/account/readiness' && req.method === 'POST') {
      return json(res, 200, await localHubAccounts.readiness(await readBody(req, 64 * 1024)));
    }
    if (pathname === '/api/federation/account/recover' && req.method === 'POST') {
      return json(res, 200, await localHubAccounts.recover(await readBody(req, 64 * 1024)));
    }
    if (pathname === '/api/federation/account/device/deactivate' && req.method === 'POST') {
      return json(res, 200, await localHubAccounts.deactivateDevice(await readBody(req, 64 * 1024)));
    }
    if (pathname === '/api/federation/account/device/remove' && req.method === 'POST') {
      return json(res, 200, await localHubAccounts.removeDevice(await readBody(req, 64 * 1024)));
    }
    if (pathname === '/api/federation/residents/admit' && req.method === 'POST') {
      if (!localNetworkClient(req)) return json(res, 403, { error: 'Local Host Node community admission is limited to localhost and private-LAN clients.' });
      const input = await readBody(req, 64 * 1024);
      if (input.seatClass && clean(input.seatClass, 40).toLowerCase() !== 'community') return json(res, 400, { error: 'Public local admission may only claim a community seat.' });
      const authorized = await localHubAccounts.authorize(input);
      const result = await localCapacity.admit({ residentId: authorized.accountId, userId: authorized.accountId, seatClass: 'community', billingStatus: 'free' });
      await localCapacity.annotateResident({ residentId: authorized.accountId, userId: authorized.accountId, accountId: authorized.accountId, accountName: authorized.account.accountName, passportIds: authorized.account.passportIds });
      return json(res, result.idempotent ? 200 : 201, { ok: true, ...result, account: authorized.account });
    }
    if (pathname.startsWith('/api/federation/')) {
      if (req.method === 'OPTIONS') return json(res, 405, { error: 'Cross-origin federation administration is not enabled.' });
      if (!requireAdmin(req, res)) return;
    }
    if (pathname === '/api/federation/residents' && req.method === 'GET') {
      return json(res, 200, { ok: true, members: await localCapacity.listResidents(), capacity: await localCapacity.snapshot() });
    }
    if (pathname === '/api/federation/residents/remove' && req.method === 'POST') {
      const result = await localCapacity.removeResident(await readBody(req, 64 * 1024));
      return json(res, 200, { ...result, capacity: await localCapacity.snapshot() });
    }
    if (pathname === '/api/federation/residents/unblock' && req.method === 'POST') {
      return json(res, 200, await localCapacity.unblockResident(await readBody(req, 64 * 1024)));
    }
    if (pathname === '/api/federation/residents/billing' && req.method === 'POST') {
      const input = await readBody(req, 64 * 1024);
      const result = await localCapacity.setBilling(input);
      return json(res, 200, { ok: true, ...result });
    }`,
  'local capacity routes'
);
replaceRequired(
  "return json(res, error.status || 500, { error: error.message || 'Federation server error' });",
  "return json(res, error.status || 500, { error: error.message || 'Federation server error', ...(error.code ? { code: error.code } : {}), ...(Array.isArray(error.activeDevices) ? { activeDevices: error.activeDevices } : {}) });",
  'federation error envelope'
);
await fsp.writeFile(runtimePath, source, 'utf8');
try {
  await import(`${pathToFileURL(runtimePath).href}?canonical=${encodeURIComponent(version)}-federated-account-v1`);
} finally {
  setTimeout(() => fsp.unlink(runtimePath).catch(() => {}), 1000).unref?.();
}

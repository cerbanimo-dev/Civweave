import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const script = new URL('./resolve-cloudflare-recovery-zone-v1.mjs', import.meta.url);
function run(env = {}) {
  const result = spawnSync(process.execPath, [script.pathname], {
    encoding: 'utf8',
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      ...env,
      GITHUB_ENV: '',
      CLOUDFLARE_API_TOKEN: '',
      CLOUDFLARE_ACCOUNT_ID: '',
    },
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout.trim().split('\n').at(-1));
}

const noCredentials = run();
assert.equal(noCredentials.status, 'pending');
assert.equal(noCredentials.reason, 'cloudflare-credentials-unavailable');
assert.equal(noCredentials.mailbox, null);

const zones = JSON.stringify([
  { id: 'unrelated', name: 'commonweave.earth', status: 'active' },
  { id: 'owned', name: 'cerbanimo.dev', status: 'active' },
  { id: 'inactive', name: 'civweave.example', status: 'pending' },
]);
const selected = run({ CIVWEAVE_RECOVERY_ZONES_JSON: zones });
assert.equal(selected.status, 'ready');
assert.equal(selected.zoneId, 'owned');
assert.equal(selected.zone, 'cerbanimo.dev');
assert.equal(selected.routingDomain, 'recovery.cerbanimo.dev');
assert.equal(selected.mailbox, 'recover@recovery.cerbanimo.dev');

const forbidden = run({
  CIVWEAVE_RECOVERY_ZONES_JSON: zones,
  CIVWEAVE_RECOVERY_ZONE: 'commonweave.earth',
});
assert.equal(forbidden.status, 'blocked');
assert.equal(forbidden.reason, 'forbidden-recovery-zone');
assert.equal(forbidden.mailbox, null);

const ambiguous = run({ CIVWEAVE_RECOVERY_ZONES_JSON: JSON.stringify([
  { id: 'a', name: 'cerbanimo.dev', status: 'active' },
  { id: 'b', name: 'civweave.dev', status: 'active' },
]) });
assert.equal(ambiguous.status, 'pending');
assert.equal(ambiguous.reason, 'recovery-zone-ambiguous');
assert.deepEqual(ambiguous.candidates, ['cerbanimo.dev', 'civweave.dev']);

console.log(JSON.stringify({
  ok: true,
  schema: 'civweave.cloudflare-recovery-zone-test.v1',
  ownedZoneOnly: true,
  forbiddenCollision: 'commonweave.earth',
}));

import assert from 'node:assert/strict';
import test from 'node:test';
import { localStagingSpawnSpec, localStagingWranglerArgs } from '../lib/local-staging-spawn.mjs';

test('local staging Pages args avoid unsupported custom config paths', () => {
  const args = localStagingWranglerArgs({ host: '127.0.0.1', port: 8788 });
  assert.deepEqual(args.slice(0, 5), ['--yes', 'wrangler@4', 'pages', 'dev', 'public']);
  assert(!args.includes('-c'));
  assert(!args.includes('--config'));
  assert(args.includes('--compatibility-date'));
  assert(args.includes('2026-08-04'));
  assert(args.includes('--compatibility-flag'));
  assert(args.includes('nodejs_compat'));
  assert(args.includes('CIVWEAVE_ENVIRONMENT=staging'));
  assert(args.includes('CIVWEAVE_LOCAL_STAGING=1'));
  assert(args.includes('CIVWEAVE_PRODUCTION_ISOLATION=true'));
  assert.deepEqual(args.slice(-4), ['--ip', '127.0.0.1', '--port', '8788']);
});

test('Windows local staging routes npx through ComSpec', () => {
  const npxArgs = localStagingWranglerArgs({ host: '127.0.0.1', port: 8788 });
  const spec = localStagingSpawnSpec({
    platform: 'win32',
    env: { ComSpec: 'C:\\Windows\\System32\\cmd.exe' },
    npxArgs,
  });
  assert.equal(spec.command, 'C:\\Windows\\System32\\cmd.exe');
  assert.deepEqual(spec.args.slice(0, 4), ['/d', '/s', '/c', 'npx']);
  assert.deepEqual(spec.args.slice(4), npxArgs);
});

test('non-Windows local staging launches npx directly', () => {
  const npxArgs = localStagingWranglerArgs({ host: '127.0.0.1', port: 8788 });
  const spec = localStagingSpawnSpec({ platform: 'linux', npxArgs });
  assert.equal(spec.command, 'npx');
  assert.deepEqual(spec.args, npxArgs);
});

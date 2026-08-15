import assert from 'node:assert/strict';
import test from 'node:test';
import { localStagingSpawnSpec } from '../lib/local-staging-spawn.mjs';

test('Windows local staging routes npx through ComSpec', () => {
  const spec = localStagingSpawnSpec({
    platform: 'win32',
    env: { ComSpec: 'C:\\Windows\\System32\\cmd.exe' },
    npxArgs: ['--yes', 'wrangler@4', 'pages', 'dev', 'public', '-c', 'C:\\repo with spaces\\wrangler.jsonc'],
  });
  assert.equal(spec.command, 'C:\\Windows\\System32\\cmd.exe');
  assert.deepEqual(spec.args.slice(0, 4), ['/d', '/s', '/c', 'npx']);
  assert.deepEqual(spec.args.slice(4), ['--yes', 'wrangler@4', 'pages', 'dev', 'public', '-c', 'C:\\repo with spaces\\wrangler.jsonc']);
});

test('non-Windows local staging launches npx directly', () => {
  const spec = localStagingSpawnSpec({ platform: 'linux', npxArgs: ['--yes', 'wrangler@4'] });
  assert.equal(spec.command, 'npx');
  assert.deepEqual(spec.args, ['--yes', 'wrangler@4']);
});

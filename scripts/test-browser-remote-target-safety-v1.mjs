import test from 'node:test';
import assert from 'node:assert/strict';
import { safeUrl, handleBrowserToolRequest } from '../cloudflare/node-cloud/src/browser-tool-entry-v1.mjs';

test('remote Browser Run accepts ordinary public HTTPS and strips fragment', () => {
  assert.equal(safeUrl('https://example.org/path?a=1#private'), 'https://example.org/path?a=1');
});

test('remote Browser Run refuses IP literals, private DNS aliases, and non-web protocols', () => {
  for (const url of [
    'http://127.0.0.1/', 'https://127.1/', 'https://2130706433/', 'https://192.168.1.2/',
    'https://169.254.169.254/latest/meta-data/', 'https://[::1]/', 'https://[::ffff:7f00:1]/',
    'https://[fc00::1]/', 'https://127.0.0.1.nip.io/', 'https://192-168-1-1.sslip.io/',
    'https://localhost/', 'https://metadata.internal/', 'https://admin.local/', 'file:///etc/passwd',
    'javascript:alert(1)', 'https://someone:secret@example.org/',
  ]) {
    assert.throws(() => safeUrl(url), { status: 403 }, url);
  }
});

test('browser tool endpoint never executes an unauthenticated action', async () => {
  let invoked = 0;
  const env = { BROWSER: { async quickAction() { invoked++; throw new Error('This must not run'); } } };
  const request = new Request('https://guild.example.org/api/browser/tool?nodeId=guild-one', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'open', url: 'https://example.org/' }),
  });
  const response = await handleBrowserToolRequest(request, env);
  assert.equal(response.status, 401);
  assert.equal(invoked, 0);
});

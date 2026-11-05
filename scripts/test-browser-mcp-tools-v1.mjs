import assert from 'node:assert/strict';
import { test } from 'node:test';
import { handleBrowserToolRequest, handleBrowserMcpRequest } from '../cloudflare/node-cloud/src/browser-tool-entry-v1.mjs';

const secret = 'browser-mcp-tests-super-secret-credential-2026';
const domain = 'civweave.capacity-session.v1';
const encoder = new TextEncoder();

function base64url(bytes) {
  return Buffer.from(bytes).toString('base64url');
}
async function memberToken({ nodeId = 'guild-one', userId = 'test-resident', exp = Math.floor(Date.now() / 1000) + 3600 } = {}) {
  const encoded = base64url(encoder.encode(JSON.stringify({ v: 1, nodeId, userId, exp })));
  const material = await crypto.subtle.digest('SHA-256', encoder.encode(`${domain}\0${secret}`));
  const key = await crypto.subtle.importKey('raw', material, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(`${domain}\n${encoded}`));
  return `${encoded}.${base64url(sig)}`;
}
const request = async (path, body, { token = null, nodeId = 'guild-one' } = {}) => new Request(
  `https://guild.example.test${path}?nodeId=${nodeId}`,
  { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), 'x-civweave-node-id': nodeId }, body: JSON.stringify(body) },
);
function fixture() {
  const calls = [];
  return {
    calls,
    env: {
      NODE_FABRIC_SESSION_SECRET: secret,
      BROWSER: {
        quickAction: async (kind, options) => {
          calls.push({ kind, options });
          if (kind === 'snapshot') return Response.json({ success: true, result: { screenshot: 'aGVsbG8=', markdown: '# Example', accessibilityTree: { role: 'RootWebArea' } }, meta: { title: 'Example' } });
          if (kind === 'scrape') return Response.json({ success: true, result: [{ selector: 'h1', results: [{ text: 'Example Domain', html: '<h1>Example Domain</h1>', attributes: [] }] }], meta: { title: 'Example Domain' } });
          if (kind === 'links') return Response.json({ success: true, result: ['https://example.org/info'] });
          return Response.json({ success: true, result: '# Example Domain\n\nA public page.', meta: { title: 'Example Domain' } });
        },
      },
    },
  };
}
const rpc = (id, method, params = {}) => ({ jsonrpc: '2.0', id, method, params });

test('MCP discovery rejects anonymous clients and binds to the member session', async () => {
  const f = fixture();
  const unauth = await handleBrowserMcpRequest(await request('/api/browser/mcp', rpc(1, 'tools/list')), f.env);
  assert.equal(unauth.status, 401);
  const token = await memberToken();
  const res = await handleBrowserMcpRequest(await request('/api/browser/mcp', rpc(2, 'tools/list'), { token }), f.env);
  assert.equal(res.status, 200);
  const output = await res.json();
  assert.deepEqual(output.result.tools.map(tool => tool.name), ['browser.search', 'browser.navigate', 'browser.read', 'browser.extract', 'browser.capture']);
  assert.equal(f.calls.length, 0);
  const otherNode = await handleBrowserMcpRequest(await request('/api/browser/mcp', rpc(3, 'tools/list'), { token, nodeId: 'guild-two' }), f.env);
  assert.equal(otherNode.status, 403);
});

test('MCP search uses the existing Browser Run binding and marks search pages as unverified sources', async () => {
  const f = fixture(), token = await memberToken();
  const req = await request('/api/browser/mcp', rpc('search-1', 'tools/call', { name: 'browser.search', arguments: { query: 'community gardens' } }), { token });
  const response = await handleBrowserMcpRequest(req, f.env), out = await response.json();
  assert.equal(response.status, 200);
  assert.equal(out.id, 'search-1');
  assert.equal(out.result.structuredContent.action, 'search');
  assert.equal(out.result.structuredContent.source.kind, 'search-results');
  assert.equal(out.result.structuredContent.source.verifiedPage, false);
  assert.match(out.result.structuredContent.source.url, /duckduckgo.com/);
  assert.equal(f.calls[0].kind, 'markdown');
  assert.equal(f.calls[0].options.url.includes('community%20gardens'), true);
  assert.equal(out.result.structuredContent.userId, undefined);
});

test('extract is selector-scoped, bounded, and never executes injected scripts', async () => {
  const f = fixture(), token = await memberToken();
  const result = await handleBrowserMcpRequest(await request('/api/browser/mcp', rpc(4, 'tools/call', { name: 'browser.extract', arguments: { url: 'https://example.org/page', selectors: ['h1'] } }), { token }), f.env);
  assert.equal(result.status, 200);
  const out = await result.json();
  assert.equal(f.calls[0].kind, 'scrape');
  assert.deepEqual(f.calls[0].options.elements, [{ selector: 'h1' }]);
  assert.equal(out.result.structuredContent.result[0].results[0].text, 'Example Domain');
  assert.equal(out.result.structuredContent.source.url, 'https://example.org/page');
  const hostile = await handleBrowserMcpRequest(await request('/api/browser/mcp', rpc(5, 'tools/call', { name: 'browser.read', arguments: { url: 'http://127.0.0.1/secrets' } }), { token }), f.env);
  assert.equal((await hostile.json()).result.isError, true);
  assert.equal(f.calls.length, 1);
});

test('capture returns a bounded image result without logging or forwarding browser credentials', async () => {
  const f = fixture(), token = await memberToken();
  const r = await handleBrowserMcpRequest(await request('/api/browser/mcp', rpc(6, 'tools/call', { name: 'browser.capture', arguments: { url: 'https://example.org' } }), { token }), f.env);
  const data = (await r.json()).result;
  assert.equal(data.content.find(x => x.type === 'image').mimeType, 'image/png');
  assert.equal(data.content.find(x => x.type === 'image').data, 'aGVsbG8=');
  assert.equal(data.structuredContent.imageIncluded, true);
  assert.equal(data.structuredContent.screenshot, undefined);
  assert.deepEqual(f.calls[0].options.formats, ['screenshot', 'markdown']);
  assert.equal(f.calls[0].options.cookies, undefined);
  assert.equal(f.calls[0].options.setExtraHTTPHeaders, undefined);
});

test('legacy tool route still returns existing response schema', async () => {
  const f = fixture(), token = await memberToken();
  const r = await handleBrowserToolRequest(await request('/api/browser/tool', { action: 'open', url: 'https://example.org/' }, { token }), f.env);
  const data = await r.json();
  assert.equal(r.status, 200);
  assert.equal(data.schema, 'civweave.browser-tool-result.v1');
  assert.equal(data.action, 'open');
  assert.equal(data.result.startsWith('# Example Domain'), true);
});

test('MCP reports malformed input and does not invoke network actions', async () => {
  const f = fixture(), token = await memberToken();
  const r = await handleBrowserMcpRequest(await request('/api/browser/mcp', rpc(7, 'tools/call', { name: 'browser.extract', arguments: { url: 'https://example.org', selectors: [] } }), { token }), f.env);
  assert.equal((await r.json()).result.isError, true);
  assert.equal(f.calls.length, 0);
});

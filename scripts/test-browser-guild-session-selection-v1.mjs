import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../public/app/browser-tool-v1.js', import.meta.url), 'utf8');
const A = { nodeId: 'guild-A', userId: 'u-A', origin: 'https://guild.example.org', token: 'token-A' };
const B = { nodeId: 'guild-B', userId: 'u-B', origin: 'https://guild.example.org', token: 'token-B' };

function runtime({ selected = null, preferred = '', rows = [A, B] } = {}) {
  const localStorage = { getItem(key) {
    if (key === 'civweave.host-node.selection.v1') return selected ? JSON.stringify(selected) : null;
    if (key === 'civweave.node-ai-marketplace.preferences.v1') return JSON.stringify({ preferredNodeId: preferred });
    return null;
  } };
  const sessionStorage = { getItem() { return JSON.stringify(Object.fromEntries(rows.map(r => [r.nodeId, r]))); } };
  const env = { URL, Date, Map, Object, navigator: { onLine: true }, localStorage, sessionStorage,
    dispatchEvent() {}, CustomEvent: class { constructor(type, { detail }) { this.type = type; this.detail = detail; } },
    CivweaveHostNodeSessionV1: {
      selectionKey: 'civweave.host-node.selection.v1',
      sessionFor(selector = '') { return rows.find(r => r.nodeId === selector || r.origin === selector) || (!selector ? rows[0] : null); },
    },
  };
  vm.runInNewContext(source, env, { filename: 'browser-tool-v1.js' });
  return env.CivweaveBrowserToolV1.status();
}

test('browser tools use exact selected Guild node, not another stored account or marketplace preference', () => {
  const status = runtime({ selected: { nodeId: B.nodeId, origin: B.origin }, preferred: A.nodeId });
  assert.equal(status.liveNodeId, B.nodeId);
});

test('missing selected Guild session fails closed even when another signed-in Guild is available', () => {
  const status = runtime({ selected: { nodeId: B.nodeId, origin: B.origin }, preferred: A.nodeId, rows: [A] });
  assert.equal(status.liveBrowser, false);
  assert.equal(status.liveNodeId, '');
});

test('when no Guild is selected, an explicit matching marketplace preference may provide live tools', () => {
  assert.equal(runtime({ preferred: B.nodeId }).liveNodeId, B.nodeId);
  assert.equal(runtime().liveBrowser, false);
});

test('selected origin must match selected Guild session origin', () => {
  const status = runtime({ selected: { nodeId: B.nodeId, origin: 'https://another.example.org' }, preferred: A.nodeId });
  assert.equal(status.liveBrowser, false);
});

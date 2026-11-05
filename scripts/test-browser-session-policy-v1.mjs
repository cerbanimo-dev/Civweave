import test from 'node:test';
import assert from 'node:assert/strict';
import { createBrowserSessionPolicy } from '../public/app/shared/browser-session-policy-v1.mjs';

function fixture() {
  let time = 1_800_000_000_000, serial = 0;
  const policy = createBrowserSessionPolicy({ now: () => time, newId: () => 'id-' + ++serial });
  const owner = { nodeId: 'guild-one', userId: 'member-one' };
  const session = policy.human.open({ ...owner, url: 'https://example.org/first' });
  return { policy, owner, session, advance: delta => { time += delta; } };
}

test('browser sessions are closed to model tools by default, including ordinary search', () => {
  const { policy, owner, session } = fixture();
  const proposed = policy.agent.propose({ ...owner, sessionId: session.sessionId, action: 'search', query: 'ordinary query' });
  assert.equal(proposed.approvalRequired, true);
  assert.throws(() => policy.agent.consume({ ...owner, sessionId: session.sessionId, requestId: proposed.requestId }), { code: 'BROWSER_APPROVAL_REQUIRED' });
  policy.human.setReadOnly({ ...owner, sessionId: session.sessionId, enabled: true });
  const allowed = policy.agent.propose({ ...owner, sessionId: session.sessionId, action: 'search', query: 'ordinary query' });
  assert.equal(allowed.approvalRequired, false);
  assert.deepEqual(policy.agent.consume({ ...owner, sessionId: session.sessionId, requestId: allowed.requestId }), { action: 'search', query: 'ordinary query' });
  assert.throws(() => policy.agent.consume({ ...owner, sessionId: session.sessionId, requestId: allowed.requestId }), { code: 'BROWSER_APPROVAL_EXPIRED' });
});

test('read-only grants are origin scoped and never authorize capture, extract or navigation', () => {
  const { policy, owner, session } = fixture();
  policy.human.setReadOnly({ ...owner, sessionId: session.sessionId, enabled: true });
  for (const action of ['navigate', 'extract', 'capture']) {
    const p = policy.agent.propose({ ...owner, sessionId: session.sessionId, action, url: 'https://example.org/other' });
    assert.equal(p.approvalRequired, true, action);
  }
  const same = policy.agent.propose({ ...owner, sessionId: session.sessionId, action: 'read', url: 'https://example.org/docs' });
  assert.equal(same.approvalRequired, false);
  const other = policy.agent.propose({ ...owner, sessionId: session.sessionId, action: 'read', url: 'https://other.example.org/docs' });
  assert.equal(other.approvalRequired, true);
});

test('explicit human approvals are one-use and cannot be forged by model arguments', () => {
  const { policy, owner, session } = fixture();
  const p = policy.agent.propose({ ...owner, sessionId: session.sessionId, action: 'capture', url: 'https://example.org/first' });
  assert.throws(() => policy.human.approve({ ...owner, sessionId: session.sessionId, requestId: 'arbitrary' }), { code: 'BROWSER_APPROVAL_EXPIRED' });
  assert.throws(() => policy.human.approve({ nodeId: 'other', userId: owner.userId, sessionId: session.sessionId, requestId: p.requestId }), { code: 'BROWSER_SESSION_SCOPE' });
  policy.human.approve({ ...owner, sessionId: session.sessionId, requestId: p.requestId });
  const approved = policy.agent.consume({ ...owner, sessionId: session.sessionId, requestId: p.requestId });
  assert.deepEqual(approved, { action: 'capture', url: 'https://example.org/first' });
  assert.throws(() => policy.agent.consume({ ...owner, sessionId: session.sessionId, requestId: p.requestId }), { code: 'BROWSER_APPROVAL_EXPIRED' });
});

test('different Guild members and nodes cannot share a browser session', () => {
  const { policy, owner, session } = fixture();
  assert.throws(() => policy.agent.propose({ nodeId: 'other', userId: owner.userId, sessionId: session.sessionId, action: 'search', query: 'x' }), { code: 'BROWSER_SESSION_SCOPE' });
  assert.throws(() => policy.agent.propose({ nodeId: owner.nodeId, userId: 'other', sessionId: session.sessionId, action: 'search', query: 'x' }), { code: 'BROWSER_SESSION_SCOPE' });
  assert.equal('approve' in policy.agent, false);
  assert.equal('setReadOnly' in policy.agent, false);
});

test('human navigation revokes queued approvals and read-only scope', () => {
  const { policy, owner, session } = fixture();
  policy.human.setReadOnly({ ...owner, sessionId: session.sessionId, enabled: true });
  const proposed = policy.agent.propose({ ...owner, sessionId: session.sessionId, action: 'capture', url: 'https://example.org/first' });
  policy.human.approve({ ...owner, sessionId: session.sessionId, requestId: proposed.requestId });
  policy.human.navigate({ ...owner, sessionId: session.sessionId, url: 'https://another.example.org/' });
  assert.throws(() => policy.agent.consume({ ...owner, sessionId: session.sessionId, requestId: proposed.requestId }), { code: 'BROWSER_APPROVAL_EXPIRED' });
  const search = policy.agent.propose({ ...owner, sessionId: session.sessionId, action: 'search', query: 'hello' });
  assert.equal(search.approvalRequired, true);
});

test('approvals expire, session close revokes, and unsafe actions and URLs fail closed', () => {
  const { policy, owner, session, advance } = fixture();
  const p = policy.agent.propose({ ...owner, sessionId: session.sessionId, action: 'navigate', url: 'https://example.org/next' });
  policy.human.approve({ ...owner, sessionId: session.sessionId, requestId: p.requestId });
  advance(61_000);
  assert.throws(() => policy.agent.consume({ ...owner, sessionId: session.sessionId, requestId: p.requestId }), { code: 'BROWSER_APPROVAL_EXPIRED' });
  for (const action of ['click', 'submit', 'post', 'download', 'evaluate']) {
    assert.throws(() => policy.agent.propose({ ...owner, sessionId: session.sessionId, action, url: 'https://example.org/' }), { code: 'BROWSER_ACTION_DENIED' });
  }
  for (const url of ['javascript:alert(1)', 'http://example.org/', 'https://127.0.0.1/', 'https://[::ffff:7f00:1]/', 'https://user:pw@example.org/', 'https://localhost/']) {
    assert.throws(() => policy.agent.propose({ ...owner, sessionId: session.sessionId, action: 'read', url }), { code: 'BROWSER_TARGET_DENIED' });
  }
  policy.human.close({ ...owner, sessionId: session.sessionId });
  assert.throws(() => policy.agent.propose({ ...owner, sessionId: session.sessionId, action: 'search', query: 'x' }), { code: 'BROWSER_SESSION_CLOSED' });
});

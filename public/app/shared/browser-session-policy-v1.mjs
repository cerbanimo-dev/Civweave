/**
 * Civweave Web & Chat: shared browser session approval helper.
 * The trusted browser UI owns human; the AI tool adapter receives ONLY agent.
 * nodeId/userId come from verified Guild access, never from model JSON.
 * Approval is a genuine human UI gesture, not a text claim from a model.
 */
const ACTIONS = new Set(['search', 'navigate', 'read', 'extract', 'capture']);
const MAX_PENDING = 32;
const APPROVAL_MS = 60_000;
const SESSION_IDLE_MS = 30 * 60_000;
const MAX_SESSIONS = 8;
const clean = (value, max) => String(value ?? '').trim().slice(0, max);
function denied(code, message) { throw Object.assign(new Error(message), { code }); }
function safeTarget(raw) {
  let url;
  try { url = new URL(clean(raw, 4000)); }
  catch { denied('BROWSER_TARGET_DENIED', 'Provide an HTTPS website URL.'); }
  if (url.protocol !== 'https:' || url.username || url.password)
    denied('BROWSER_TARGET_DENIED', 'Only HTTPS public websites without URL credentials are permitted.');
  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  // Refuse IP literals (including IPv4 shortcuts and IPv4-mapped IPv6).
  // The backend must also defend against DNS rebinding and redirects.
  if (!hostname.includes('.') || hostname.includes(':') || /^\d/.test(hostname) ||
      /(?:^|\.)(?:localhost|local|internal|invalid|test|onion|arpa)$/.test(hostname) ||
      !/^[a-z0-9.-]+$/.test(hostname) || hostname.includes('..'))
    denied('BROWSER_TARGET_DENIED', 'Local, numeric or non-public browser targets are unavailable.');
  url.hash = '';
  return url.href;
}
function validIdentity({ nodeId, userId }) {
  const node = clean(nodeId, 180), user = clean(userId, 180);
  if (!node || !user) denied('BROWSER_SESSION_SCOPE', 'A verified Guild session is required.');
  return { nodeId: node, userId: user };
}

/**
 * The browser UI must retain the human interface privately, and never
 * expose it to the model or MCP tool registry. This is a consent policy,
 * not an authentication system or substitute for the server session check.
 */
export function createBrowserSessionPolicy({
  now = () => Date.now(),
  newId = () => globalThis.crypto.randomUUID(),
} = {}) {
  const sessions = new Map(), proposals = new Map();
  function requestId() { return clean(newId(), 200); }
  function invalidate(sessionId) {
    for (const [id, request] of proposals) if (request.sessionId === sessionId) proposals.delete(id);
  }
  function sessionFor(input) {
    const identity = validIdentity(input);
    const session = sessions.get(clean(input.sessionId, 200));
    if (!session) denied('BROWSER_SESSION_CLOSED', 'This browser session is closed or missing.');
    if (session.nodeId !== identity.nodeId || session.userId !== identity.userId)
      denied('BROWSER_SESSION_SCOPE', 'The browser session belongs to another Guild member.');
    if (now() - session.lastActiveAt > SESSION_IDLE_MS) {
      invalidate(session.id); sessions.delete(session.id);
      denied('BROWSER_SESSION_CLOSED', 'This browser session expired from inactivity.');
    }
    session.lastActiveAt = now();
    return session;
  }
  function pendingFor(input) {
    const session = sessionFor(input);
    const id = clean(input.requestId, 200), proposal = proposals.get(id);
    if (!proposal || proposal.sessionId !== session.id || proposal.revision !== session.revision ||
        now() - proposal.createdAt > APPROVAL_MS) {
      proposals.delete(id);
      denied('BROWSER_APPROVAL_EXPIRED', 'This browser action approval expired or was revoked.');
    }
    return { session, proposal, id };
  }
  const human = Object.freeze({
    open(input) {
      const { nodeId, userId } = validIdentity(input);
      const url = safeTarget(input.url);
      if (sessions.size >= MAX_SESSIONS)
        denied('BROWSER_SESSION_LIMIT', 'Close another browser session before starting a new one.');
      const id = requestId();
      if (!id || sessions.has(id)) denied('BROWSER_SESSION_LIMIT', 'Unable to allocate a unique browser session.');
      sessions.set(id, { id, nodeId, userId, url, revision: 1, readOnly: false, lastActiveAt: now() });
      return Object.freeze({ sessionId: id, nodeId, url, revision: 1, readOnly: false });
    },
    setReadOnly(input) {
      const session = sessionFor(input);
      if (typeof input.enabled !== 'boolean')
        denied('BROWSER_APPROVAL_REQUIRED', 'Read-only permission requires an explicit human choice.');
      session.readOnly = input.enabled;
      session.revision++;
      invalidate(session.id);
      return Object.freeze({ sessionId: session.id, readOnly: session.readOnly, revision: session.revision });
    },
    navigate(input) {
      const session = sessionFor(input);
      session.url = safeTarget(input.url);
      session.revision++;
      session.readOnly = false;
      invalidate(session.id);
      return Object.freeze({ sessionId: session.id, url: session.url, revision: session.revision, readOnly: false });
    },
    approve(input) {
      const { proposal } = pendingFor(input);
      proposal.approved = true;
      return Object.freeze({ requestId: proposal.id, approved: true, expiresAt: proposal.createdAt + APPROVAL_MS });
    },
    close(input) {
      const session = sessionFor(input);
      invalidate(session.id); sessions.delete(session.id);
      return true;
    },
  });
  const agent = Object.freeze({
    propose(input) {
      const session = sessionFor(input);
      const action = clean(input.action, 40).toLowerCase();
      if (!ACTIONS.has(action))
        denied('BROWSER_ACTION_DENIED', 'Only read-only browser tools are available; no click, form submission, script or download.');
      let payload;
      if (action === 'search') {
        const query = clean(input.query, 1200);
        if (!query) denied('BROWSER_ACTION_DENIED', 'Browser search requires a query.');
        payload = { action, query };
      } else payload = { action, url: safeTarget(input.url) };
      const autoApproved = session.readOnly && (action === 'search' ||
        (action === 'read' && new URL(payload.url).origin === new URL(session.url).origin));
      if (proposals.size >= MAX_PENDING)
        denied('BROWSER_APPROVAL_LIMIT', 'Too many outstanding browser requests.');
      const id = requestId();
      if (!id || proposals.has(id)) denied('BROWSER_APPROVAL_LIMIT', 'Unable to allocate an action request.');
      const proposal = { ...payload, id, sessionId: session.id, revision: session.revision,
        createdAt: now(), approved: autoApproved };
      proposals.set(id, proposal);
      return Object.freeze({ requestId: id, sessionId: session.id, action, approvalRequired: !autoApproved,
        expiresAt: proposal.createdAt + APPROVAL_MS });
    },
    consume(input) {
      const { proposal, id } = pendingFor(input);
      if (!proposal.approved) denied('BROWSER_APPROVAL_REQUIRED', 'A person must approve this browser action.');
      proposals.delete(id); // One-use capability, even if the network call fails.
      return Object.freeze(proposal.action === 'search'
        ? { action: proposal.action, query: proposal.query }
        : { action: proposal.action, url: proposal.url });
    },
  });
  return Object.freeze({ human, agent });
}
export const browserSessionPolicyVersion = '1.0.0-browser-session-policy-v1';

import test from 'node:test';
import assert from 'node:assert/strict';
import { issueNodeOperatorSession, verifyNodeOperatorSession, requireNodeOperatorAuth, isLoopbackOperatorRequest } from '../lib/node-ai-operator-session-v1.mjs';

const secret='0123456789abcdef0123456789abcdef0123456789abcdef';

test('local operator session is scoped, expiring, and accepted without revealing the node secret',()=>{
  const now=()=>1_700_000_000_000;
  const token=issueNodeOperatorSession({nodeId:'node-alpha',secret,ttlSeconds:3600,now});
  assert.match(token,/^cwop1\./);
  assert.equal(token.includes(secret),false);
  const verified=verifyNodeOperatorSession(token,{nodeId:'node-alpha',secret,now});
  assert.equal(verified.sub,'node-alpha');
  assert.equal(verified.role,'node:operator');
  assert.throws(()=>verifyNodeOperatorSession(token,{nodeId:'node-beta',secret,now}),/different node/i);
  assert.throws(()=>verifyNodeOperatorSession(token,{nodeId:'node-alpha',secret,now:()=>1_700_004_000_000}),/expired/i);

  const viaScopedHeader=requireNodeOperatorAuth({headers:{'x-civweave-operator-session':token}},{nodeId:'node-alpha',secret,now});
  assert.equal(viaScopedHeader.sub,'node-alpha');
  const viaLegacyConsoleHeader=requireNodeOperatorAuth({headers:{'x-civweave-internal-secret':token}},{nodeId:'node-alpha',secret,now});
  assert.equal(viaLegacyConsoleHeader.sub,'node-alpha');
  const viaExplicitFallback=requireNodeOperatorAuth({headers:{'x-civweave-internal-secret':secret}},{nodeId:'node-alpha',secret,now});
  assert.equal(viaExplicitFallback.legacy,true);
});

test('automatic local operator unlock accepts loopback only and ignores forwarded-address claims',()=>{
  assert.equal(isLoopbackOperatorRequest({socket:{remoteAddress:'127.0.0.1'},headers:{}}),true);
  assert.equal(isLoopbackOperatorRequest({socket:{remoteAddress:'127.10.20.30'},headers:{}}),true);
  assert.equal(isLoopbackOperatorRequest({socket:{remoteAddress:'::1'},headers:{}}),true);
  assert.equal(isLoopbackOperatorRequest({socket:{remoteAddress:'::ffff:127.0.0.1'},headers:{}}),true);
  assert.equal(isLoopbackOperatorRequest({socket:{remoteAddress:'203.0.113.7'},headers:{'x-forwarded-for':'127.0.0.1'}}),false);
  assert.equal(isLoopbackOperatorRequest({socket:{remoteAddress:'192.168.1.2'},headers:{}}),false);
});

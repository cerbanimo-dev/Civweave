import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const mesh = await fs.readFile(new URL('../public/app/local-object-mesh-v146.js', import.meta.url), 'utf8');
const start = mesh.indexOf('async function syncGateway');
assert.ok(start >= 0, 'canonical mesh gateway sync owner is missing');
const body = mesh.slice(start, mesh.indexOf('async function requestBackgroundSync', start));
assert.match(body, /endpoint\.searchParams\.set\(['"]nodeId['"],\s*localId\)/, 'gateway pull must identify the current mesh device so the server can filter direct envelopes');
assert.match(body, /gatewayEligible\(object\)/, 'gateway ingestion must use the explicit privacy eligibility predicate');
assert.match(mesh, /function gatewayEligible\(object\).*direct.*group/s, 'direct and group objects addressed to this device must be eligible for gateway ingress without becoming relayable');
assert.match(mesh, /mayRelay\(object\)/, 'public and federated relay semantics must remain distinct from directed gateway ingress');

console.log('Directed canonical mesh gateway contract passed');

import {
  TERRITORY_HOST_ADMISSION_SCHEMA,
  probePublicHostNode
} from './territory-host-authority-v1.mjs';

export const ROOT_HOST_ADMISSION_SCHEMA = 'civweave.root-host-admission.v1';
export const HOST_NODE_TERRITORY_ASSIGNMENT_SCHEMA = 'civweave.host-node-territory-assignment.v1';

export const ROOT_HOST_ADMISSION_POLICY = Object.freeze({
  rootMayIssueOrdinaryHostsToAnyActiveTerritory: true,
  candidateProofOfKeyRequired: true,
  ordinaryHostsReceiveTerritoryAuthority: false,
  rootFabricTokenRequired: true,
  territoryStewardScopeUnaffected: true
});

const enc = new TextEncoder();
const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
const slug = (value, max = 120) => clean(value, max).toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
const iso = value => new Date(value).toISOString();

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(String(value)));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
async function secretEqual(left, right) {
  if (!left || !right) return false;
  const [a, b] = await Promise.all([sha256Hex(left), sha256Hex(right)]);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.min(a.length, b.length); i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
async function requireRootFabric(edge, suppliedFabricToken) {
  if (!await secretEqual(suppliedFabricToken, edge.env?.NODE_FABRIC_BINDING_TOKEN || '')) {
    throw Object.assign(new Error('Root Host admission requires the private Civweave root fabric binding.'), { status: 403 });
  }
}
async function activeTerritory(edge, territoryId) {
  const id = clean(territoryId, 120).toLowerCase();
  if (!id) throw Object.assign(new TypeError('territoryId is required.'), { status: 400 });
  const row = await edge.db.prepare(`SELECT territory_id,parent_territory_id,name,country_code,subdivision_code,locality,depth,active
    FROM money_edge_territories WHERE territory_id=?1`).bind(id).first();
  if (!row || Number(row.active) !== 1) throw Object.assign(new Error('Root Host admission requires an active Civweave territory.'), { status: 404 });
  return row;
}

export async function recordHostTerritoryAssignment(edge, { nodeId, territoryId, sourceKind, sourceId = null } = {}) {
  const node = slug(nodeId, 180), territory = await activeTerritory(edge, territoryId);
  if (!node) throw Object.assign(new TypeError('nodeId is required.'), { status: 400 });
  if (!['civweave-root', 'territory-steward'].includes(sourceKind)) throw Object.assign(new RangeError('Host territory assignment source is invalid.'), { status: 400 });
  const at = iso(edge.now());
  await edge.db.prepare(`INSERT INTO host_node_territories(node_id,territory_id,source_kind,source_id,assigned_at,updated_at)
    VALUES(?1,?2,?3,?4,?5,?5)
    ON CONFLICT(node_id) DO UPDATE SET territory_id=excluded.territory_id,source_kind=excluded.source_kind,
      source_id=excluded.source_id,updated_at=excluded.updated_at`)
    .bind(node, territory.territory_id, sourceKind, clean(sourceId, 220) || null, at).run();
  await edge.db.prepare('UPDATE money_edge_nodes SET territory_id=?1,updated_at=?2 WHERE node_id=?3')
    .bind(territory.territory_id, at, node).run();
  return Object.freeze({
    schema: HOST_NODE_TERRITORY_ASSIGNMENT_SCHEMA,
    nodeId: node,
    territoryId: territory.territory_id,
    sourceKind,
    sourceId: clean(sourceId, 220) || null,
    assignedAt: at
  });
}

export async function admitRootOrdinaryHost(edge, input = {}, suppliedFabricToken = '') {
  await requireRootFabric(edge, suppliedFabricToken);
  const territory = await activeTerritory(edge, input.territoryId);
  const hostId = slug(input.hostId, 120), nodeId = slug(input.nodeId, 180), operatorId = clean(input.operatorId, 180);
  if (!hostId || !nodeId || !operatorId) throw Object.assign(new TypeError('hostId, nodeId, and operatorId are required.'), { status: 400 });
  const proof = await probePublicHostNode(edge, { nodeId, operatorId, callbackUrl: input.callbackUrl });
  const manifest = proof.manifest || {};
  const displayName = clean(manifest.displayName || hostId, 180) || hostId;
  const runtime = clean(manifest.runtime || 'civweave-host', 80) || 'civweave-host';
  const capabilities = Array.isArray(manifest.capabilities) ? [...new Set(manifest.capabilities.map(value => clean(value, 120)).filter(Boolean))] : [];
  const at = iso(edge.now());

  await edge.db.prepare(`INSERT INTO nodes(node_id,operator_id,display_name,runtime,public_origin,capabilities_json,location_json,status,updated_at)
    VALUES(?1,?2,?3,?4,?5,?6,NULL,'active',?7)
    ON CONFLICT(node_id) DO UPDATE SET operator_id=excluded.operator_id,display_name=excluded.display_name,runtime=excluded.runtime,
      public_origin=excluded.public_origin,capabilities_json=excluded.capabilities_json,status='active',updated_at=excluded.updated_at`)
    .bind(nodeId, operatorId, displayName, runtime, proof.callbackBase, JSON.stringify(capabilities), at).run();

  const assignment = await recordHostTerritoryAssignment(edge, {
    nodeId,
    territoryId: territory.territory_id,
    sourceKind: 'civweave-root',
    sourceId: 'civweave-core'
  });

  await edge.db.prepare(`INSERT INTO launch_audit(audit_id,event_type,subject_id,payload_json,created_at)
    VALUES(?1,'root-host-admitted',?2,?3,?4)`)
    .bind(`root-host:${crypto.randomUUID()}`, nodeId, JSON.stringify({
      schema: ROOT_HOST_ADMISSION_SCHEMA,
      hostId,
      territoryId: territory.territory_id,
      ordinaryHost: true,
      grantsTerritoryAuthority: false,
      keyFingerprint: proof.keyFingerprint
    }), at).run();

  return Object.freeze({
    schema: ROOT_HOST_ADMISSION_SCHEMA,
    admitted: true,
    ordinaryHost: true,
    grantsTerritoryAuthority: false,
    hostId,
    nodeId,
    operatorId,
    callbackBase: proof.callbackBase,
    territoryId: territory.territory_id,
    nodeKeyFingerprint: proof.keyFingerprint,
    assignment,
    trustChain: Object.freeze(['civweave-core', `territory:${territory.territory_id}`, `node:${nodeId}`]),
    admittedAt: at,
    compatibleAdmissionSchema: TERRITORY_HOST_ADMISSION_SCHEMA
  });
}

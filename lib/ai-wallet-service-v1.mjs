import path from 'node:path';
import { createNodeServiceManifest } from './node-ai-marketplace-v1.mjs';
import { NodeAiLedger } from './node-ai-ledger-sqlite-v1.mjs';

function required(value, label) {
  const text = String(value ?? '').trim();
  if (!text) throw new TypeError(`${label} is required.`);
  return text;
}
function platformFeeBps(value) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > 10_000) throw new RangeError('NODE_AI_PLATFORM_FEE_BPS must be an integer from 0 through 10000.');
  return parsed;
}
function parseServices(value) {
  let parsed;
  try { parsed = JSON.parse(String(value || '[]')); }
  catch { throw new TypeError('NODE_AI_SERVICES_JSON must be valid JSON.'); }
  if (!Array.isArray(parsed) || !parsed.length) throw new TypeError('NODE_AI_SERVICES_JSON must contain at least one service.');
  return parsed;
}

// Compatibility export name retained so existing gateway imports do not create a
// second storage owner. The implementation is node-local SQLite only.
export class AiWalletService extends NodeAiLedger {
  constructor({
    databasePath = process.env.NODE_AI_LEDGER_PATH || path.join(process.env.DATA_DIR || './data', 'node-ai-ledger-v1.sqlite'),
    nodeId = process.env.NODE_AI_NODE_ID,
    operatorId = process.env.NODE_AI_OPERATOR_ID,
    platformFeeBps: feeBps = process.env.NODE_AI_PLATFORM_FEE_BPS,
    services = null,
    displayName = process.env.NODE_AI_DISPLAY_NAME || process.env.HUB_NAME || 'Civweave Node',
    publicKey = process.env.NODE_AI_RECEIPT_PUBLIC_KEY || null
  } = {}) {
    const normalizedNodeId = required(nodeId, 'NODE_AI_NODE_ID');
    const normalizedOperatorId = required(operatorId, 'NODE_AI_OPERATOR_ID');
    const normalizedFee = platformFeeBps(feeBps);
    super({ databasePath, nodeId: normalizedNodeId, operatorId: normalizedOperatorId, platformFeeBps: normalizedFee });
    this.manifest = createNodeServiceManifest({
      nodeId: normalizedNodeId,
      operatorId: normalizedOperatorId,
      displayName,
      platformFeeBps: normalizedFee,
      services: services || parseServices(process.env.NODE_AI_SERVICES_JSON),
      publicKey,
      privacy: { retention: process.env.NODE_AI_RETENTION_POLICY || 'operator-declared', thirdPartyInference: process.env.NODE_AI_THIRD_PARTY_INFERENCE === '1' },
      settlement: { cadence: process.env.NODE_AI_SETTLEMENT_CADENCE || 'periodic', meshPublication: process.env.NODE_AI_MESH_SETTLEMENT_PUBLICATION !== '0' }
    });
  }
  async load() { return this; }
  async flush() { return undefined; }
  async persist() { return undefined; }
}

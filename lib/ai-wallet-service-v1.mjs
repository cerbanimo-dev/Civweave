import path from 'node:path';
import { createNodeServiceManifest } from './node-ai-marketplace-v1.mjs';
import { NodeAiLedger } from './node-ai-ledger-sqlite-v1.mjs';
import { NodeAiInferenceGate } from './node-ai-inference-gate-v1.mjs';
import { loadNodeAiServicePackage } from './node-ai-service-package-v1.mjs';
import { loadOrCreateNodeAiBootstrap } from './node-ai-bootstrap-v1.mjs';

function platformFeeBps(value) {
  const parsed = value == null || value === '' ? 0 : Number(value);
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
function parseBaseUrls(value) {
  const values = Array.isArray(value) ? value : String(value || '').split(',');
  return [...new Set(values.map(item => String(item || '').trim().replace(/\/$/, '')).filter(Boolean).map(item => {
    const url = new URL(item);
    if (!['http:', 'https:'].includes(url.protocol)) throw new RangeError('Node AI public base URLs must use HTTP or HTTPS.');
    return url.origin + url.pathname.replace(/\/$/, '');
  }))];
}
function parsePublicLocation(latitude, longitude) {
  const lat = Number(latitude), lon = Number(longitude);
  if (!Number.isFinite(lat) && !Number.isFinite(lon)) return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) throw new RangeError('NODE_AI_PUBLIC_LATITUDE/LONGITUDE must be valid public coordinates.');
  return { lat, lon };
}

// Compatibility export name retained so existing gateway imports do not create a
// second storage owner. Identity and operational secrets self-bootstrap locally;
// environment variables remain optional migration overrides, not provisioning requirements.
export class AiWalletService extends NodeAiLedger {
  constructor({
    databasePath = process.env.NODE_AI_LEDGER_PATH || path.join(process.env.DATA_DIR || './data', 'node-ai-ledger-v1.sqlite'),
    nodeId = process.env.NODE_AI_NODE_ID,
    operatorId = process.env.NODE_AI_OPERATOR_ID,
    platformFeeBps: feeBps = process.env.NODE_AI_PLATFORM_FEE_BPS,
    services = null,
    displayName = process.env.NODE_AI_DISPLAY_NAME || process.env.HUB_NAME || 'Civweave Node',
    publicKey = process.env.NODE_AI_RECEIPT_PUBLIC_KEY || null,
    servicePackageModule = process.env.NODE_AI_SERVICE_PACKAGE_MODULE || '',
    publicBaseUrls = process.env.NODE_AI_PUBLIC_BASE_URLS || process.env.PUBLIC_HOST_URL || '',
    publicLatitude = process.env.NODE_AI_PUBLIC_LATITUDE,
    publicLongitude = process.env.NODE_AI_PUBLIC_LONGITUDE,
    bootstrapStore = null
  } = {}) {
    const store = bootstrapStore || loadOrCreateNodeAiBootstrap({ dataDir: process.env.DATA_DIR || path.dirname(databasePath) });
    const bootstrap = store.state;
    const normalizedNodeId = String(nodeId || bootstrap.nodeId).trim();
    const normalizedOperatorId = String(operatorId || bootstrap.operatorId).trim();
    const normalizedFee = platformFeeBps(feeBps);
    const baseUrls = parseBaseUrls(publicBaseUrls);
    const publicLocation = parsePublicLocation(publicLatitude, publicLongitude);
    const trialCommerceEnabled = process.env.NODE_AI_TRIAL_COMMERCE_ENABLED === '1';
    super({ databasePath, nodeId: normalizedNodeId, operatorId: normalizedOperatorId, platformFeeBps: normalizedFee });
    this.bootstrapStore = store;
    this.bootstrap = Object.freeze({
      ...bootstrap,
      nodeId: normalizedNodeId,
      operatorId: normalizedOperatorId,
      receiptPublicKey: publicKey || bootstrap.receiptPublicKey
    });
    this.manifest = createNodeServiceManifest({
      nodeId: normalizedNodeId,
      operatorId: normalizedOperatorId,
      displayName,
      platformFeeBps: normalizedFee,
      services: services || parseServices(process.env.NODE_AI_SERVICES_JSON),
      publicKey: publicKey || bootstrap.receiptPublicKey,
      privacy: { retention: process.env.NODE_AI_RETENTION_POLICY || 'operator-declared', thirdPartyInference: process.env.NODE_AI_THIRD_PARTY_INFERENCE === '1' },
      settlement: { cadence: process.env.NODE_AI_SETTLEMENT_CADENCE || 'periodic', meshPublication: process.env.NODE_AI_MESH_SETTLEMENT_PUBLICATION !== '0' },
      metadata: {
        ...(publicLocation ? { publicLocation } : {}),
        identity: { bootstrap: 'local-persistent-v1', secretsGeneratedLocally: true },
        platformFee: { paymentAuthority: 'cerbanimo-money-edge', localDeclarationAuthoritative: false },
        trialCommerce: { enabled: trialCommerceEnabled, sandboxOnly: true, livePayments: false },
        endpoints: {
          transports: baseUrls.length ? ['mesh', 'https'] : ['mesh'],
          baseUrls,
          manifestPath: '/api/ai/node/manifest',
          capabilityPath: '/api/ai/node/wallet/capability',
          inferencePath: '/api/ai/node/inference',
          inferenceStatusPath: '/api/ai/node/inference/status',
          trialStatusPath: '/api/ai/node/trial/status',
          trialPairPath: '/api/ai/node/trial/pair',
          trialTopUpPath: '/api/ai/node/trial/topups',
          trialHistoryPath: '/api/ai/node/trial/history'
        }
      }
    });
    this.servicePackageModule = String(servicePackageModule || '').trim();
    this.servicePackage = null;
    this.inferenceGate = null;
  }
  async load() {
    if (!this.servicePackageModule) return this;
    this.servicePackage = await loadNodeAiServicePackage({ modulePath: this.servicePackageModule, manifest: this.manifest, ledger: this });
    this.inferenceGate = new NodeAiInferenceGate({
      ledger: this,
      manifest: this.manifest,
      serviceHandlers: this.servicePackage.services,
      receiptPrivateKey: this.bootstrap.receiptPrivateKey,
      receiptKeyId: this.bootstrap.receiptKeyId
    });
    return this;
  }
  async flush() { return undefined; }
  async persist() { return undefined; }
}

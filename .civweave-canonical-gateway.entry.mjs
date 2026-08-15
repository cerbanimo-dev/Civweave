import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.join(rootDir, 'releases', '1.0.132', 'server', 'server-gateway-v131-base.mjs');
const runtimePath = path.join(rootDir, '.civweave-gateway-v132.loader.mjs');
const VERSION = '1.0.132-render-installed-runtime-v132';
const before = "if (gatewayRequest && applicationSurface && !installerSurface && !packageInstall) {";
const after = "if (gatewayRequest && applicationSurface && !installerSurface && !packageInstall && pathname !== '/app' && !pathname.startsWith('/app/')) {";
const advertisedProxy = "features: ['install-only-pwa','device-package-distribution','fullscreen-software-family','node-registration','heartbeat','relay-envelopes','presence','sse-events','release-broadcasts','gemini-agent-proxy','release-advertising','node-ai-marketplace-v1']";
const deviceFirstFeatures = "features: ['install-only-pwa','device-package-distribution','fullscreen-software-family','node-registration','heartbeat','relay-envelopes','presence','sse-events','release-broadcasts','release-advertising','node-ai-marketplace-v1','federation-finder','node-ai-operator-status']";
const marketplaceBoundary = "if (await aiWalletHttp.handle(req, res, url)) return;\\n      if (!authorized(req)";
const finderBoundary = `if (pathname === '/api/finder-status' && req.method === 'GET') {\\n        const manifest = aiWalletService?.manifest || null;\\n        const sanitizeLocation = value => { const lat = Number(value?.lat ?? value?.latitude), lon = Number(value?.lon ?? value?.longitude); return Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180 ? { lat, lon } : null; };\\n        const ownLocation = sanitizeLocation(manifest?.metadata?.publicLocation);\\n        const peers = Object.values(state.nodes).map(node => { const publicRecord = publicNode(node); const publicLocation = sanitizeLocation(node?.metadata?.publicLocation); return publicLocation ? { ...publicRecord, publicLocation } : publicRecord; });\\n        const capabilities = [...new Set(['node-ai-marketplace', ...(manifest?.services || []).flatMap(service => Array.isArray(service.capabilities) ? service.capabilities : [])])];\\n        return json(res, 200, { schema:'civweave.finder-status.v1', observedAt:now(), node:{ nodeId:manifest?.nodeId || 'host-node', label:manifest?.displayName || HUB_NAME, system:'civweave', capabilities, endpoint:requestOrigin(req,url), ...(ownLocation ? { publicLocation:ownLocation } : {}), online:true, firstSeenAt:STARTED_AT, lastSeenAt:now() }, peers });\\n      }\\n      if (await aiWalletHttp.handle(req, res, url)) return;\\n      if (!authorized(req)`;

let source = (await fsp.readFile(sourcePath, 'utf8')).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
const canonicalInstallOrigin='https://civweave.pages.dev';
const releaseUrlNeedle="\\nconst CIVWEAVE_RELEASE_URL = process.env.CIVWEAVE_RELEASE_URL || 'https://github.com/cerbanimo-dev/Civweave/archive/refs/heads/main.zip';";
if(!source.includes(releaseUrlNeedle))throw new Error('Canonical install origin patch could not find gateway release URL.');
source=source.replace(releaseUrlNeedle,releaseUrlNeedle+"\\nconst CIVWEAVE_INSTALL_ORIGIN = process.env.CIVWEAVE_INSTALL_ORIGIN || '"+canonicalInstallOrigin+"';");
const releasePacketNeedle='appUrl: `${root}/`, installUrl: `${root}/`';
if(!source.includes(releasePacketNeedle))throw new Error('Canonical install origin patch could not find release packet install URL.');
source=source.replace(releasePacketNeedle,'appUrl: CIVWEAVE_INSTALL_ORIGIN, installUrl: CIVWEAVE_INSTALL_ORIGIN');
const runtimeGateNeedle="installUrl:requestOrigin(req,url)+'/'";
if(!source.includes(runtimeGateNeedle))throw new Error('Canonical install origin patch could not find installed-runtime install URL.');
source=source.replace(runtimeGateNeedle,'installUrl:CIVWEAVE_INSTALL_ORIGIN');
const configNeedle='appUrl: null, installUrl: `${requestOrigin(req, url)}/`';
if(!source.includes(configNeedle))throw new Error('Canonical install origin patch could not find public config install URL.');
source=source.replace(configNeedle,'appUrl: CIVWEAVE_INSTALL_ORIGIN, installUrl: CIVWEAVE_INSTALL_ORIGIN');
source = source.replace("const sourcePath = path.join(rootDir, 'server.mjs');", "const sourcePath = path.join(rootDir, 'releases', '1.0.132', 'server', 'server.mjs');");
if (!source.includes(before)) {
  throw new Error('Civweave gateway v132 could not find the legacy installed-runtime boundary.');
}
source = source.replace(before, after);
if (!source.includes(advertisedProxy)) {
  throw new Error('Civweave gateway v132 could not find the obsolete Gemini proxy advertisement.');
}
source = source.replace(advertisedProxy, deviceFirstFeatures);
if (!source.includes(marketplaceBoundary)) {
  throw new Error('Civweave gateway v132 could not find the node AI marketplace public API boundary.');
}
source = source.replace(marketplaceBoundary, finderBoundary);
await fsp.writeFile(runtimePath, source, 'utf8');
try {
  await import(`${pathToFileURL(runtimePath).href}?build=${encodeURIComponent(VERSION)}`);
} finally {
  setTimeout(() => fsp.unlink(runtimePath).catch(() => {}), 1000).unref?.();
}

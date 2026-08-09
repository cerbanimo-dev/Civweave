import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.join(rootDir, 'server-gateway-v131-base.mjs');
const runtimePath = path.join(rootDir, '.civweave-gateway-v132.loader.mjs');
const VERSION = '1.0.58-render-installed-runtime-v132';
const requiredBoundary = "if (gatewayRequest && applicationSurface && !installerSurface && !packageInstall) {";
const forbiddenLiveAppRelaxation = "pathname !== '/app' && !pathname.startsWith('/app/')";
const advertisedProxy = "features: ['install-only-pwa','device-package-distribution','fullscreen-software-family','node-registration','heartbeat','relay-envelopes','presence','sse-events','release-broadcasts','gemini-agent-proxy','release-advertising','hosted-ai-wallet-foundation']";
const deviceFirstFeatures = "features: ['install-only-pwa','device-package-distribution','fullscreen-software-family','node-registration','heartbeat','relay-envelopes','presence','sse-events','release-broadcasts','release-advertising','hosted-ai-wallet-foundation']";
const packageAssetBoundary = `if (gatewayRequest && packageInstall && applicationSurface) {
    if (await serveFile(req,res,pathname)) return;
    return json(res,404,{error:'Requested Civweave device-package asset was not found.',packageInstall:true,pathname});
  }
  ${requiredBoundary}`;

let source = (await fsp.readFile(sourcePath, 'utf8')).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
if (!source.includes(requiredBoundary)) {
  throw new Error('Civweave gateway v132 could not find the package-only installed-runtime boundary.');
}
if (source.includes(forbiddenLiveAppRelaxation)) {
  throw new Error('Civweave gateway v132 refused to start because /app runtime was relaxed into a live hosted surface.');
}
if (!source.includes("'/app/index.html'")) {
  throw new Error('Civweave gateway v132 requires the installer page to be explicitly allowlisted.');
}
if (!source.includes("const installerSurface = installerAssets.has(pathname);")) {
  throw new Error('Civweave gateway v132 requires an explicit installer dependency graph.');
}
if (!source.includes(advertisedProxy)) {
  throw new Error('Civweave gateway v132 could not find the obsolete Gemini proxy advertisement.');
}
source = source.replace(requiredBoundary, packageAssetBoundary);
source = source.replace(advertisedProxy, deviceFirstFeatures);
if (!source.includes("if (gatewayRequest && packageInstall && applicationSurface)")) {
  throw new Error('Civweave gateway v132 failed to install the explicit device-package asset path.');
}
await fsp.writeFile(runtimePath, source, 'utf8');
try {
  await import(`${pathToFileURL(runtimePath).href}?build=${encodeURIComponent(VERSION)}`);
} finally {
  setTimeout(() => fsp.unlink(runtimePath).catch(() => {}), 1000).unref?.();
}

import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.join(rootDir, 'server.mjs');
const runtimePath = path.join(rootDir, '.commonweave-gateway-v131.runtime.mjs');
const VERSION = '1.0.4';
const BUILD = '1.0.4-install-only-fullscreen-family-gateway';
let source = (await fsp.readFile(sourcePath, 'utf8')).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');

function replaceRequired(before, after, label) {
  if (!source.includes(before)) throw new Error(`Commonweave gateway patch could not find ${label}`);
  source = source.replace(before, after);
}

replaceRequired(
  "import { fileURLToPath } from 'node:url';",
  "import { fileURLToPath } from 'node:url';\nimport { AiWalletService } from './lib/ai-wallet-service-v1.mjs';\nimport { createAiWalletHttpHandler } from './lib/ai-wallet-http-v1.mjs';",
  'hosted AI wallet imports'
);
replaceRequired("const BUILD_VERSION = '1.0.21-ai-uplift';", `const BUILD_VERSION = '${BUILD}';`, 'host build marker');
replaceRequired("const APP_VERSION = 'rc22.3.20-ai-checkpoint';", `const APP_VERSION = '${VERSION}';`, 'app version marker');
replaceRequired(
  "const DEFAULT_PUBLIC_HOST = process.env.PUBLIC_HOST_URL || 'https://commonweave-host-node.onrender.com';",
  "const DEFAULT_PUBLIC_HOST = process.env.PUBLIC_HOST_URL || 'https://commonweave-host-node.onrender.com';\nconst COMMONWEAVE_SOURCE_URL = process.env.COMMONWEAVE_SOURCE_URL || 'https://github.com/cerbanimo-dev/Commonweave';\nconst COMMONWEAVE_RELEASE_URL = process.env.COMMONWEAVE_RELEASE_URL || 'https://github.com/cerbanimo-dev/Commonweave/archive/refs/heads/main.zip';",
  'gateway release URLs'
);
replaceRequired(
  "let installKitSha256 = '';\nlet installKitSize = 0;\ntry {\n  const kit = await fsp.readFile(INSTALL_KIT_PATH);\n  installKitSha256 = crypto.createHash('sha256').update(kit).digest('hex');\n  installKitSize = kit.length;\n} catch (error) {\n  console.warn('Install kit metadata unavailable:', error.message);\n}",
  "const installKitSha256 = '';\nconst installKitSize = 0;",
  'install kit startup hashing'
);
replaceRequired(
  "    releasedAt: STARTED_AT, appUrl: `${root}/app/?setup=1&host=${encodeURIComponent(root)}`,\n    downloadUrl: `${root}/downloads/Commonweave-Mobile-Install-Kit.zip`, sha256: installKitSha256,\n    bytes: installKitSize, mandatory: false, notes: 'Current stable Commonweave host-node and offline PWA release.'",
  "    releasedAt: STARTED_AT, appUrl: `${root}/`, installUrl: `${root}/`, sourceUrl: COMMONWEAVE_SOURCE_URL,\n    downloadUrl: COMMONWEAVE_RELEASE_URL, sha256: '', bytes: 0, mandatory: false, localInstallRequired: true,\n    notes: 'The public origin distributes the lean v1.0.4 software package. Commonweave runs from the installed full-screen family.'",
  'release packet hosting fields'
);
replaceRequired(
  "} catch (error) {\n  if (error.code !== 'ENOENT') console.warn('State restore skipped:', error.message);\n}",
  String.raw`} catch (error) {
  if (error.code !== 'ENOENT') console.warn('State restore skipped:', error.message);
}

const AI_WALLET_REQUESTED = process.env.AI_WALLET_ENABLED === '1';
const AI_WALLET_CAPABILITY_SECRET = String(process.env.AI_WALLET_CAPABILITY_SECRET || '').trim();
const AI_WALLET_AUTH_SECRET = String(process.env.AI_WALLET_AUTH_SECRET || '').trim();
const AI_WALLET_PAYMENT_SECRET = String(process.env.AI_WALLET_PAYMENT_SECRET || '').trim();
const AI_WALLET_INTERNAL_SECRET = String(process.env.AI_WALLET_INTERNAL_SECRET || '').trim();
let aiWalletService = null;
if (AI_WALLET_REQUESTED) {
  try {
    aiWalletService = await new AiWalletService({
      filePath: path.join(DATA_DIR, 'ai-wallet-ledger-v1.json'),
      capabilitySecret: AI_WALLET_CAPABILITY_SECRET
    }).load();
  } catch (error) {
    console.error('[Commonweave] Hosted AI wallet stayed disabled:', error.message);
  }
}
const aiWalletHttp = createAiWalletHttpHandler({
  walletService: aiWalletService,
  requested: AI_WALLET_REQUESTED,
  authSecret: AI_WALLET_AUTH_SECRET,
  paymentSecret: AI_WALLET_PAYMENT_SECRET,
  internalSecret: AI_WALLET_INTERNAL_SECRET,
  capabilitySecret: AI_WALLET_CAPABILITY_SECRET
});`,
  'host state restore and AI wallet setup'
);
replaceRequired(
  "  const pathname = decodeURIComponent(url.pathname);",
  String.raw`  const pathname = decodeURIComponent(url.pathname);
  const gatewayRequest = req.method === 'GET' || req.method === 'HEAD';
  const packageInstall = req.headers['x-commonweave-package'] === 'install';
  const installerSurface = pathname === '/'
    || pathname === '/index.html'
    || pathname === '/install-v130.js'
    || pathname === '/install-v130.css'
    || pathname === '/service-worker.js'
    || pathname === '/app/manifest.webmanifest'
    || pathname === '/app/logos/commonweave.webp'
    || pathname === '/app/logos/commonweave-icon-192.png'
    || pathname === '/app/logos/commonweave-icon-512.png'
    || pathname === '/app/logos/commonweave-icon-maskable-192.png'
    || pathname === '/app/logos/commonweave-icon-maskable-512.png'
    || pathname === '/app/assets/world/host-wave2.webp';
  const applicationSurface = pathname === '/offline.html'
    || pathname === '/app'
    || pathname.startsWith('/app/')
    || pathname === '/loom'
    || pathname.startsWith('/loom/')
    || pathname === '/lite'
    || pathname.startsWith('/lite/')
    || pathname === '/cabinetonly'
    || pathname.startsWith('/cabinetonly/')
    || pathname === '/campus'
    || pathname.startsWith('/campus/');
  if (gatewayRequest && packageInstall && pathname === '/app/shared/commonweave-parity-ledger.json') {
    try {
      const { gunzipSync } = await import('node:zlib');
      const sharedDir = path.join(PUBLIC_DIR, 'app', 'shared');
      const encoded = (await Promise.all([1, 2, 3, 4].map(part => fsp.readFile(path.join(sharedDir, 'commonweave-parity-ledger.part' + part + '.b64'), 'utf8')))).join('').replace(/\s+/g, '');
      const ledger = JSON.parse(gunzipSync(Buffer.from(encoded, 'base64')).toString('utf8'));
      const payload = Buffer.from(JSON.stringify(ledger));
      res.writeHead(200, {
        'content-type': 'application/json; charset=utf-8',
        'content-length': payload.length,
        'cache-control': 'public, max-age=31536000, immutable',
        'x-commonweave-device-package': 'parity-ledger',
        'x-commonweave-software-family': '1.0.4'
      });
      return res.end(req.method === 'HEAD' ? undefined : payload);
    } catch (error) {
      console.error('[Commonweave] Unable to reconstruct parity ledger:', error);
      return json(res, 500, { error: 'The Commonweave capability ledger could not be reconstructed for this device package.' });
    }
  }
  if (gatewayRequest && packageInstall && (
    pathname === '/loom' || pathname === '/loom/' || pathname === '/loom/index.html'
    || pathname === '/lite' || pathname === '/lite/' || pathname === '/lite/index.html'
    || pathname === '/cabinetonly' || pathname === '/cabinetonly/' || pathname === '/cabinetonly/index.html'
  )) {
    if (await serveFile(req, res, '/app/fullscreen-family-v104.html')) return;
    return json(res, 404, { error: 'The full-screen Commonweave family entry is missing from this device package.' });
  }
  if (gatewayRequest && (pathname === '/field/commonweave/seed' || pathname === '/downloads' || pathname.startsWith('/downloads/'))) {
    res.writeHead(302, {location: COMMONWEAVE_RELEASE_URL, 'cache-control':'no-store'});
    return res.end();
  }
  if (gatewayRequest && applicationSurface && !installerSurface && !packageInstall) {
    return json(res, 410, {
      error: 'Installed runtime required',
      localInstallRequired: true,
      installUrl: requestOrigin(req, url) + '/',
      sourceUrl: COMMONWEAVE_SOURCE_URL,
      releaseUrl: COMMONWEAVE_RELEASE_URL,
      message: 'This public origin distributes the complete device package but does not run the Commonweave software family in browser mode.'
    });
  }
  if (pathname === '/api/boot-log' || pathname === '/api/boot-logs') {
    res.writeHead(204, {'cache-control':'no-store'});
    return res.end();
  }`,
  'request pathname declaration'
);
replaceRequired(
  "        res.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type, authorization, x-commonweave-hub-token', 'access-control-allow-methods': 'GET,POST,OPTIONS' });",
  "        res.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type, authorization, x-commonweave-hub-token, x-commonweave-ai-capability, x-commonweave-internal-secret, x-commonweave-payment-signature', 'access-control-allow-methods': 'GET,POST,OPTIONS' });",
  'AI wallet CORS headers'
);
replaceRequired(
  "      res.setHeader('access-control-allow-origin', '*');\n      if (!authorized(req)",
  "      res.setHeader('access-control-allow-origin', '*');\n      if (await aiWalletHttp.handle(req, res, url)) return;\n      if (!authorized(req)",
  'AI wallet route boundary'
);
replaceRequired(
  "appUrl: `${requestOrigin(req, url)}/app/`, downloadUrl: `${requestOrigin(req, url)}/downloads/Commonweave-Mobile-Install-Kit.zip`, seedUrl: `${requestOrigin(req, url)}/downloads/commonweave-pocket-campus.cwseed`, release: releasePacket(requestOrigin(req, url)), tokenRequired: Boolean(HUB_TOKEN), features: ['node-registration','heartbeat','relay-envelopes','presence','sse-events','release-broadcasts','pwa-hosting','offline-installer','gemini-agent-proxy','campus-seed-download']",
  "appUrl: null, installUrl: `${requestOrigin(req, url)}/`, sourceUrl: COMMONWEAVE_SOURCE_URL, downloadUrl: COMMONWEAVE_RELEASE_URL, seedUrl: null, release: releasePacket(requestOrigin(req, url)), tokenRequired: Boolean(HUB_TOKEN), features: ['install-only-pwa','device-package-distribution','fullscreen-software-family','node-registration','heartbeat','relay-envelopes','presence','sse-events','release-broadcasts','gemini-agent-proxy','release-advertising']",
  'public config hosting fields'
);
replaceRequired(
  "features: ['install-only-pwa','device-package-distribution','fullscreen-software-family','node-registration','heartbeat','relay-envelopes','presence','sse-events','release-broadcasts','gemini-agent-proxy','release-advertising'] });",
  "features: ['install-only-pwa','device-package-distribution','fullscreen-software-family','node-registration','heartbeat','relay-envelopes','presence','sse-events','release-broadcasts','gemini-agent-proxy','release-advertising','hosted-ai-wallet-foundation'], aiWallet: aiWalletHttp.status() });",
  'public AI wallet status'
);
replaceRequired(
  "persistence: STATE_FILE });",
  "persistence: STATE_FILE, aiWallet: aiWalletHttp.status() });",
  'health AI wallet status'
);
replaceRequired(
  "    if (pathname === '/favicon.ico') { res.writeHead(302, { location: '/app/logos/commonweave-icon-32.png', 'cache-control': 'public, max-age=86400' }); return res.end(); }",
  "    if (pathname === '/favicon.ico') { res.writeHead(302, { location: '/app/logos/commonweave-icon-192.png', 'cache-control': 'public, max-age=86400' }); return res.end(); }",
  'favicon route'
);
replaceRequired(
  "  try { await fsp.writeFile(STATE_FILE, JSON.stringify(state, null, 2)); } catch {}\n  process.exit(0);",
  "  try { await fsp.writeFile(STATE_FILE, JSON.stringify(state, null, 2)); } catch {}\n  try { await aiWalletService?.flush?.(); } catch {}\n  process.exit(0);",
  'AI wallet shutdown flush'
);

await fsp.writeFile(runtimePath, source, 'utf8');
try {
  await import(pathToFileURL(runtimePath).href + `?build=${VERSION}`);
} finally {
  setTimeout(() => fsp.unlink(runtimePath).catch(() => {}), 1000).unref?.();
}

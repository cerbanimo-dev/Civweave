import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.join(rootDir, 'server.mjs');
const runtimePath = path.join(rootDir, '.civweave-gateway-v131.runtime.mjs');
const VERSION = '1.0.103';
const BUILD = '1.0.103-install-only-fullscreen-family-gateway';
let source = (await fsp.readFile(sourcePath, 'utf8')).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
function replaceRequired(before, after, label) { if (!source.includes(before)) throw new Error(`Civweave gateway patch could not find ${label}`); source = source.replace(before, after); }
replaceRequired("import { fileURLToPath } from 'node:url';","import { fileURLToPath } from 'node:url';\nimport { AiWalletService } from './lib/ai-wallet-service-v1.mjs';\nimport { createAiWalletHttpHandler } from './lib/ai-wallet-http-v1.mjs';",'node AI marketplace imports');
replaceRequired("const BUILD_VERSION = '1.0.21-ai-uplift';",`const BUILD_VERSION = '${BUILD}';`,'host build marker');
replaceRequired("const APP_VERSION = 'rc22.3.20-ai-checkpoint';",`const APP_VERSION = '${VERSION}';`,'app version marker');
replaceRequired("const DEFAULT_PUBLIC_HOST = process.env.PUBLIC_HOST_URL || 'https://civweave-host-node.onrender.com';","const DEFAULT_PUBLIC_HOST = process.env.PUBLIC_HOST_URL || 'https://civweave-host-node.onrender.com';\nconst CIVWEAVE_SOURCE_URL = process.env.CIVWEAVE_SOURCE_URL || 'https://github.com/cerbanimo-dev/Civweave';\nconst CIVWEAVE_RELEASE_URL = process.env.CIVWEAVE_RELEASE_URL || 'https://github.com/cerbanimo-dev/Civweave/archive/refs/heads/main.zip';",'gateway release URLs');
replaceRequired("let installKitSha256 = '';\nlet installKitSize = 0;\ntry {\n  const kit = await fsp.readFile(INSTALL_KIT_PATH);\n  installKitSha256 = crypto.createHash('sha256').update(kit).digest('hex');\n  installKitSize = kit.length;\n} catch (error) {\n  console.warn('Install kit metadata unavailable:', error.message);\n}","const installKitSha256 = '';\nconst installKitSize = 0;",'install kit startup hashing');
replaceRequired("    releasedAt: STARTED_AT, appUrl: `${root}/app/?setup=1&host=${encodeURIComponent(root)}`,\n    downloadUrl: `${root}/downloads/Civweave-Mobile-Install-Kit.zip`, sha256: installKitSha256,\n    bytes: installKitSize, mandatory: false, notes: 'Current stable Civweave host-node and offline PWA release.'","    releasedAt: STARTED_AT, appUrl: `${root}/`, installUrl: `${root}/`, sourceUrl: CIVWEAVE_SOURCE_URL,\n    downloadUrl: CIVWEAVE_RELEASE_URL, sha256: '', bytes: 0, mandatory: false, localInstallRequired: true,\n    notes: 'The public origin distributes the Civweave v1.0.103 fixed-settings-layer device package.'",'release packet hosting fields');
replaceRequired("} catch (error) {\n  if (error.code !== 'ENOENT') console.warn('State restore skipped:', error.message);\n}",String.raw`} catch (error) {
  if (error.code !== 'ENOENT') console.warn('State restore skipped:', error.message);
}

const AI_WALLET_REQUESTED = process.env.NODE_AI_MARKETPLACE_ENABLED === '1' || process.env.AI_WALLET_ENABLED === '1';
const AI_WALLET_CAPABILITY_SECRET = String(process.env.NODE_AI_CAPABILITY_SECRET || process.env.AI_WALLET_CAPABILITY_SECRET || '').trim();
const AI_WALLET_AUTH_SECRET = String(process.env.NODE_AI_AUTH_SECRET || process.env.AI_WALLET_AUTH_SECRET || '').trim();
const AI_WALLET_PAYMENT_SECRET = String(process.env.NODE_AI_PAYMENT_WEBHOOK_SECRET || process.env.AI_WALLET_PAYMENT_SECRET || '').trim();
const AI_WALLET_INTERNAL_SECRET = String(process.env.NODE_AI_INTERNAL_SECRET || process.env.AI_WALLET_INTERNAL_SECRET || '').trim();
let aiWalletService = null;
if (AI_WALLET_REQUESTED) {
  try {
    aiWalletService = await new AiWalletService({
      databasePath: process.env.NODE_AI_LEDGER_PATH || path.join(DATA_DIR, 'node-ai-ledger-v1.sqlite'),
      nodeId: process.env.NODE_AI_NODE_ID,
      operatorId: process.env.NODE_AI_OPERATOR_ID,
      platformFeeBps: process.env.NODE_AI_PLATFORM_FEE_BPS
    }).load();
  } catch (error) {
    console.error('[Civweave] Node AI marketplace stayed disabled:', error.message);
  }
}
const aiWalletHttp = createAiWalletHttpHandler({
  walletService: aiWalletService,
  requested: AI_WALLET_REQUESTED,
  authSecret: AI_WALLET_AUTH_SECRET,
  paymentSecret: AI_WALLET_PAYMENT_SECRET,
  internalSecret: AI_WALLET_INTERNAL_SECRET,
  capabilitySecret: AI_WALLET_CAPABILITY_SECRET
});`,'host state restore and node AI marketplace setup');
replaceRequired("  const pathname = decodeURIComponent(url.pathname);",String.raw`  const pathname = decodeURIComponent(url.pathname);
  const gatewayRequest = req.method === 'GET' || req.method === 'HEAD';
  const packageInstall = Boolean(String(req.headers['x-civweave-package'] || '').trim());
  const installerSurface = pathname === '/'
    || pathname === '/index.html'
    || pathname === '/install-v130.js'
    || pathname === '/install-v130.css'
    || pathname === '/service-worker.js'
    || pathname === '/service-worker-v156.js'
    || pathname === '/service-worker-v203.js'
    || pathname === '/app/manifest.webmanifest'
    || pathname === '/app/logos/civweave.webp'
    || pathname === '/app/logos/civweave-app-icon.png'
    || pathname === '/app/logos/civweave-icon-192.png'
    || pathname === '/app/logos/civweave-icon-512.png'
    || pathname === '/app/logos/civweave-icon-maskable-192.png'
    || pathname === '/app/logos/civweave-icon-maskable-512.png'
    || pathname === '/app/knowledge-school-seeds-v1.js'
    || pathname === '/app/knowledge-school-installer-v1.js'
    || pathname === '/app/knowledge-school-installer-v1.css'
    || pathname === '/app/offline-package-v208.json'
    || pathname === '/app/offline-campus-status-v210.js'
    || pathname === '/app/pwa-update-controller-v204.js';
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
  if (gatewayRequest && packageInstall && pathname === '/app/shared/civweave-parity-ledger.json') {
    try {
      const { gunzipSync } = await import('node:zlib');
      const sharedDir = path.join(PUBLIC_DIR, 'app', 'shared');
      const encoded = (await Promise.all([1,2,3,4].map(part => fsp.readFile(path.join(sharedDir,'civweave-parity-ledger.part'+part+'.b64'),'utf8')))).join('').replace(/\s+/g,'');
      const ledger = JSON.parse(gunzipSync(Buffer.from(encoded,'base64')).toString('utf8'));
      const payload = Buffer.from(JSON.stringify(ledger));
      res.writeHead(200,{'content-type':'application/json; charset=utf-8','content-length':payload.length,'cache-control':'public, max-age=31536000, immutable','x-civweave-device-package':'parity-ledger','x-civweave-software-family':'1.0.7'});
      return res.end(req.method === 'HEAD' ? undefined : payload);
    } catch (error) { console.error('[Civweave] Unable to reconstruct parity ledger:',error); return json(res,500,{error:'The Civweave capability ledger could not be reconstructed for this device package.'}); }
  }
  if (gatewayRequest && packageInstall && (pathname === '/loom' || pathname === '/loom/' || pathname === '/loom/index.html' || pathname === '/lite' || pathname === '/lite/' || pathname === '/lite/index.html' || pathname === '/cabinetonly' || pathname === '/cabinetonly/' || pathname === '/cabinetonly/index.html')) {
    if (await serveFile(req,res,'/app/fullscreen-family-v104.html')) return;
    return json(res,404,{error:'The full-screen Civweave family entry is missing from this device package.'});
  }
  const knowledgeSchoolDownload = pathname === '/downloads/knowledge-schools' || pathname.startsWith('/downloads/knowledge-schools/');
  if (gatewayRequest && !knowledgeSchoolDownload && (pathname === '/field/civweave/seed' || pathname === '/downloads' || pathname.startsWith('/downloads/'))) { res.writeHead(302,{location:CIVWEAVE_RELEASE_URL,'cache-control':'no-store'}); return res.end(); }
  if (gatewayRequest && applicationSurface && !installerSurface && !packageInstall) { return json(res,410,{error:'Installed runtime required',localInstallRequired:true,installUrl:requestOrigin(req,url)+'/',sourceUrl:CIVWEAVE_SOURCE_URL,releaseUrl:CIVWEAVE_RELEASE_URL,message:'This public origin distributes the complete device package but does not run the Civweave software family in browser mode.'}); }
  if (pathname === '/api/boot-log' || pathname === '/api/boot-logs') { res.writeHead(204,{'cache-control':'no-store'}); return res.end(); }`,'request pathname declaration');
replaceRequired("        res.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type, authorization, x-civweave-hub-token', 'access-control-allow-methods': 'GET,POST,OPTIONS' });","        res.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type, authorization, x-civweave-hub-token, x-civweave-ai-capability, x-civweave-internal-secret, x-civweave-payment-signature', 'access-control-allow-methods': 'GET,POST,OPTIONS' });",'node AI marketplace CORS headers');
replaceRequired("      res.setHeader('access-control-allow-origin', '*');\n      if (!authorized(req)","      res.setHeader('access-control-allow-origin', '*');\n      if (await aiWalletHttp.handle(req, res, url)) return;\n      if (!authorized(req)",'node AI marketplace route boundary');
replaceRequired("appUrl: `${requestOrigin(req, url)}/app/`, downloadUrl: `${requestOrigin(req, url)}/downloads/Civweave-Mobile-Install-Kit.zip`, seedUrl: `${requestOrigin(req, url)}/downloads/civweave-pocket-campus.cwseed`, release: releasePacket(requestOrigin(req, url)), tokenRequired: Boolean(HUB_TOKEN), features: ['node-registration','heartbeat','relay-envelopes','presence','sse-events','release-broadcasts','pwa-hosting','offline-installer','gemini-agent-proxy','campus-seed-download']","appUrl: null, installUrl: `${requestOrigin(req, url)}/`, sourceUrl: CIVWEAVE_SOURCE_URL, downloadUrl: CIVWEAVE_RELEASE_URL, seedUrl: null, release: releasePacket(requestOrigin(req, url)), tokenRequired: Boolean(HUB_TOKEN), features: ['install-only-pwa','device-package-distribution','fullscreen-software-family','node-registration','heartbeat','relay-envelopes','presence','sse-events','release-broadcasts','gemini-agent-proxy','release-advertising','node-ai-marketplace-v1'], aiWallet: aiWalletHttp.status()",'public config hosting fields');
replaceRequired("persistence: STATE_FILE });","persistence: STATE_FILE, aiWallet: aiWalletHttp.status() });",'health node AI marketplace status');
replaceRequired("    if (pathname === '/favicon.ico') { res.writeHead(302, { location: '/app/logos/civweave-icon-32.png', 'cache-control': 'public, max-age=86400' }); return res.end(); }","    if (pathname === '/favicon.ico') { res.writeHead(302, { location: '/app/logos/civweave-icon-192.png', 'cache-control': 'public, max-age=86400' }); return res.end(); }",'favicon route');
replaceRequired("  try { await fsp.writeFile(STATE_FILE, JSON.stringify(state, null, 2)); } catch {}\n  process.exit(0);","  try { await fsp.writeFile(STATE_FILE, JSON.stringify(state, null, 2)); } catch {}\n  try { await aiWalletService?.flush?.(); } catch {}\n  process.exit(0);",'node AI marketplace shutdown flush');
await fsp.writeFile(runtimePath,source,'utf8');
try { await import(pathToFileURL(runtimePath).href+`?build=${VERSION}`); } finally { setTimeout(()=>fsp.unlink(runtimePath).catch(()=>{}),1000).unref?.(); }

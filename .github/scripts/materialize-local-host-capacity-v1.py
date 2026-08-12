from pathlib import Path
import hashlib
import json
import subprocess

VERSION = '1.0.120'


def replace_once(path, old, new, label):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'{label} target not found in {path}')
    p.write_text(text.replace(old, new, 1))


lobby = Path('public/app/host-node-installer-lobby-v1.js')
text = lobby.read_text()
if 'host-node-local-capacity-v1.js' not in text:
    marker = '\n})();\n'
    loader = (
        "\n\nfunction installLocalCapacityBridge() {\n"
        "  if (document.querySelector('script[data-civweave-local-host-capacity]')) return false;\n"
        "  const script = document.createElement('script');\n"
        "  script.src = '/app/host-node-local-capacity-v1.js?v=local-host-capacity-v1';\n"
        "  script.async = true;\n"
        "  script.dataset.civweaveLocalHostCapacity = 'v1';\n"
        "  document.head.append(script);\n"
        "  return true;\n"
        "}\n"
        "if (document.readyState === 'loading') addEventListener('DOMContentLoaded', installLocalCapacityBridge, { once: true });\n"
        "else installLocalCapacityBridge();\n"
    )
    if marker not in text:
        raise SystemExit('Host lobby IIFE terminator not found')
    lobby.write_text(text.rsplit(marker, 1)[0] + loader + marker)

replace_once(
    'lib/ai-wallet-http-v1.mjs',
    "import { createNodeMoneyEdgeHttpHandler } from './node-money-edge-http-v1.mjs';\n",
    "import { createNodeMoneyEdgeHttpHandler } from './node-money-edge-http-v1.mjs';\nimport { createLocalHostCapacityStore } from './local-host-capacity-v1.mjs';\n",
    'AI wallet local capacity import',
)
replace_once(
    'lib/ai-wallet-http-v1.mjs',
    "  const moneyEdgePublicKey = String(process.env.CIVWEAVE_MONEY_EDGE_PUBLIC_KEY || bootstrap.moneyEdgePublicKey || '').trim();\n",
    "  const moneyEdgePublicKey = String(process.env.CIVWEAVE_MONEY_EDGE_PUBLIC_KEY || bootstrap.moneyEdgePublicKey || '').trim();\n  const localCapacityStore = process.env.CIVWEAVE_FEDERATED_HOST === '1'\n    ? createLocalHostCapacityStore({ dataDir: process.env.DATA_DIR || './data', nodeId: process.env.CIVWEAVE_FEDERATION_NODE_ID || walletService?.manifest?.nodeId || '' })\n    : null;\n",
    'AI wallet local capacity store',
)
replace_once(
    'lib/ai-wallet-http-v1.mjs',
    "    bootstrapStore: walletService?.bootstrapStore || null,\n    maxTopUpCents:",
    "    bootstrapStore: walletService?.bootstrapStore || null,\n    capacityStore: localCapacityStore,\n    maxTopUpCents:",
    'AI wallet live capacity injection',
)

replace_once(
    'lib/node-ai-live-commerce-v1.mjs',
    "  bootstrapStore = null,\n  maxTopUpCents =",
    "  bootstrapStore = null,\n  capacityStore = null,\n  maxTopUpCents =",
    'live commerce capacity parameter',
)
replace_once(
    'lib/node-ai-live-commerce-v1.mjs',
    "        const applied = applyLivePaymentEvent(ledger, parseJson(raw));\n        sendJson(res, 200, { ok: true, schema: NODE_AI_LIVE_COMMERCE_SCHEMA, applied }); return true;",
    "        const event = parseJson(raw);\n        let applied;\n        if (event.type === 'membership.paid' || event.type === 'membership.ended') {\n          if (!capacityStore) throw new Error('Local Host Node membership capacity store is unavailable.');\n          applied = await capacityStore.applyPaymentEvent(event);\n        } else {\n          applied = applyLivePaymentEvent(ledger, event);\n        }\n        sendJson(res, 200, { ok: true, schema: NODE_AI_LIVE_COMMERCE_SCHEMA, applied }); return true;",
    'live commerce membership capacity application',
)

compose = Path('docker-compose.federated.yml')
ctext = compose.read_text()
if 'CIVWEAVE_COMMUNITY_SEAT_LIMIT:' not in ctext:
    needle = '      DATA_DIR: /app/data\n'
    replacement = needle + '      CIVWEAVE_COMMUNITY_SEAT_LIMIT: ${CIVWEAVE_COMMUNITY_SEAT_LIMIT:-6}\n      CIVWEAVE_PAID_EXPANSION_SEAT_LIMIT: ${CIVWEAVE_PAID_EXPANSION_SEAT_LIMIT:-9}\n'
    if needle not in ctext:
        raise SystemExit('Docker DATA_DIR environment target not found')
    compose.write_text(ctext.replace(needle, replacement, 1))

pkg_path = Path('package.json')
pkg = json.loads(pkg_path.read_text())
pkg['version'] = VERSION
scripts = pkg.setdefault('scripts', {})
scripts['test:local-host-capacity'] = 'node scripts/test-local-host-capacity-v1.mjs'
for bit in [
    'node --check lib/local-host-capacity-v1.mjs',
    'node --check public/app/host-node-local-capacity-v1.js',
    'node --check scripts/test-local-host-capacity-v1.mjs',
]:
    if bit not in scripts.get('check:syntax', ''):
        scripts['check:syntax'] = scripts.get('check:syntax', '') + ' && ' + bit
if 'npm run test:local-host-capacity' not in scripts.get('check', ''):
    scripts['check'] = scripts.get('check', '') + ' && npm run test:local-host-capacity'
pkg_path.write_text(json.dumps(pkg, indent=2) + '\n')
Path('VERSION').write_text(VERSION + '\n')

subprocess.run(['node', 'scripts/materialize-canonical-release.mjs'], check=True)

runtime = Path(f'releases/{VERSION}/server/server-federated-v152.mjs')
rtext = runtime.read_text()

def runtime_replace(old, new, label):
    global rtext
    if old not in rtext:
        raise SystemExit(f'{label} target not found')
    rtext = rtext.replace(old, new, 1)

runtime_replace(
    "import { fileURLToPath } from 'node:url';\n",
    "import { fileURLToPath } from 'node:url';\nimport { createLocalHostCapacityStore } from './lib/local-host-capacity-v1.mjs';\n",
    'federated capacity import',
)
runtime_replace(
    'const identity = await loadIdentity();\n',
    'const identity = await loadIdentity();\nconst localCapacity = createLocalHostCapacityStore({ dataDir: DATA_DIR, nodeId: identity.nodeId });\n',
    'federated capacity store',
)
runtime_replace(
    "function requireAdmin(req, res) {\n  if (adminAuthorized(req)) return true;",
    "function localNetworkAddress(value) {\n  let address = clean(value, 120).toLowerCase();\n  if (address.startsWith('::ffff:')) address = address.slice(7);\n  if (address === '::1' || address === '0:0:0:0:0:0:0:1') return true;\n  if (address.startsWith('fc') || address.startsWith('fd') || address.startsWith('fe8') || address.startsWith('fe9') || address.startsWith('fea') || address.startsWith('feb')) return true;\n  if (/^127(?:\\.\\d{1,3}){3}$/.test(address) || /^10(?:\\.\\d{1,3}){3}$/.test(address) || /^192\\.168(?:\\.\\d{1,3}){2}$/.test(address)) return true;\n  const match = address.match(/^172\\.(\\d{1,3})\\./);\n  return Boolean(match && Number(match[1]) >= 16 && Number(match[1]) <= 31);\n}\nfunction localNetworkClient(req) { return localNetworkAddress(req.socket?.remoteAddress || ''); }\nfunction requireAdmin(req, res) {\n  if (adminAuthorized(req)) return true;",
    'local network admission guard',
)
runtime_replace(
    "    env: { ...process.env, PORT: String(APP_PORT), HOST: '127.0.0.1', PUBLIC_HOST_URL: PUBLIC_URL },",
    "    env: { ...process.env, PORT: String(APP_PORT), HOST: '127.0.0.1', PUBLIC_HOST_URL: PUBLIC_URL, CIVWEAVE_FEDERATED_HOST: '1', CIVWEAVE_FEDERATION_NODE_ID: identity.nodeId },",
    'federated child capacity environment',
)
runtime_replace(
    "    if (pathname === '/api/federation/health' && req.method === 'GET') {\n      return json(res, 200, { ok: true, nodeId: identity.nodeId, build: BUILD, appAvailable: Boolean(app && !appExited) });\n    }\n    if (pathname.startsWith('/api/federation/')) {",
    "    if (pathname === '/api/federation/health' && req.method === 'GET') {\n      return json(res, 200, { ok: true, nodeId: identity.nodeId, build: BUILD, appAvailable: Boolean(app && !appExited) });\n    }\n    if (pathname === '/api/federation/capacity' && req.method === 'GET') {\n      return json(res, 200, { ok: true, capacity: await localCapacity.snapshot() });\n    }\n    if (pathname === '/api/federation/residents/admit' && req.method === 'POST') {\n      if (!localNetworkClient(req)) return json(res, 403, { error: 'Local Host Node community admission is limited to localhost and private-LAN clients until authenticated public admission is available.' });\n      const input = await readBody(req, 64 * 1024);\n      if (input.seatClass && clean(input.seatClass, 40).toLowerCase() !== 'community') return json(res, 400, { error: 'Public local admission may only claim a community seat.' });\n      const result = await localCapacity.admit({ residentId: input.residentId, userId: input.userId, seatClass: 'community', billingStatus: 'free' });\n      return json(res, result.idempotent ? 200 : 201, { ok: true, ...result });\n    }\n    if (pathname.startsWith('/api/federation/')) {",
    'public local capacity routes',
)
runtime_replace(
    "    if (pathname === '/api/federation/status' && req.method === 'GET') {",
    "    if (pathname === '/api/federation/residents/billing' && req.method === 'POST') {\n      const input = await readBody(req, 64 * 1024);\n      const result = await localCapacity.setBilling(input);\n      return json(res, 200, { ok: true, ...result });\n    }\n    if (pathname === '/api/federation/status' && req.method === 'GET') {",
    'admin billing route',
)
runtime.write_text(rtext)

manifest_path = Path(f'releases/{VERSION}/release.json')
manifest = json.loads(manifest_path.read_text())
manifest.setdefault('sha256', {})['server/server-federated-v152.mjs'] = hashlib.sha256(runtime.read_bytes()).hexdigest()
manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')

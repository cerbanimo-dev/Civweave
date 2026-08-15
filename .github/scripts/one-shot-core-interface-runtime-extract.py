from pathlib import Path
import subprocess

ROOT = Path('.')
OLD = 'origin/agent/core-interface-runtime-v1'


def show(path: str) -> str:
    return subprocess.check_output(['git', 'show', f'{OLD}:{path}'], text=True)


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'missing expected source for {label}')
    return text.replace(old, new, 1)


# Copy only genuinely new architecture artifacts plus the ownership verifier that
# was already reconciled to V320 on the source branch.
for path in [
    'public/app/core-interface-runtime-v1.js',
    'docs/architecture/core-interface-runtime-v1.md',
    '.github/workflows/verify-core-interface-runtime-v1.yml',
    'scripts/verify-system-ownership-v317.mjs',
]:
    Path(path).write_text(show(path))

# Core runtime: current release default and fail-closed required shared owners.
p = Path('public/app/core-interface-runtime-v1.js')
s = p.read_text()
s = replace_once(s, ":'1.0.160';", ":'1.0.161';", 'runtime release fallback')
old = """function installSharedSupport(){
  if(sharedBootPromise)return sharedBootPromise;
  const scripts=[...SHARED_BOOT_SCRIPTS];
  if(currentSystem==='fellowfare')scripts.push(FELLOWFARE_GUIDE_BRIDGE);
  if(assetCustomizationConfigured())scripts.push(ASSET_CUSTOMIZATION);
  sharedBootPromise=Promise.all(scripts.map(queueScript)).then(results=>{
    emit('civweave:interface-shared-support-ready',{attempted:results.length,failed:results.filter(result=>!result.ok).length});
    return Object.freeze(results);
  });
  return sharedBootPromise;
}"""
new = """function installSharedSupport(){
  if(sharedBootPromise)return sharedBootPromise;
  const requiredScripts=[...SHARED_BOOT_SCRIPTS];
  if(currentSystem==='fellowfare')requiredScripts.push(FELLOWFARE_GUIDE_BRIDGE);
  const optionalScripts=assetCustomizationConfigured()?[ASSET_CUSTOMIZATION]:[];
  sharedBootPromise=Promise.all([
    ...requiredScripts.map(src=>queueScript(src).then(result=>Object.freeze({...result,required:true}))),
    ...optionalScripts.map(src=>queueScript(src).then(result=>Object.freeze({...result,required:false})))
  ]).then(results=>{
    const failed=results.filter(result=>!result.ok);
    const failedRequired=failed.filter(result=>result.required);
    emit('civweave:interface-shared-support-ready',{attempted:results.length,failed:failed.length,failedRequired:failedRequired.length});
    if(failedRequired.length){
      const error=new Error(`Core interface runtime failed to load ${failedRequired.length} required shared dependencies.`);
      error.code='CIVWEAVE_INTERFACE_SHARED_BOOT_FAILED';
      error.failures=Object.freeze(failedRequired.map(result=>Object.freeze({src:result.src,reason:result.reason||'load-error'})));
      throw error;
    }
    return Object.freeze(results);
  });
  return sharedBootPromise;
}"""
s = replace_once(s, old, new, 'required shared boot policy')
p.write_text(s)

p = Path('docs/architecture/core-interface-runtime-v1.md')
p.write_text(p.read_text().replace('1.0.160', '1.0.161'))

# Current install boundary: remove its parallel shared manifests and bootstrap one runtime.
p = Path('public/app/install-boundary-v146.js')
s = p.read_text()
for token in [
    "const WORKING_CAMPUS_TOPBAR='/app/working-campus-topbar-v243.js';\n",
    "const CAMPUS_BACKGROUND_DOWNLOAD='/app/campus-background-download-v241.js';\n",
    "const FELLOWFARE_GUIDE_BRIDGE='/app/fellowfare-shared-guide-bridge-v236.js';\n",
    "const EXPERIENCE_ORCHESTRATOR='/app/experience-orchestrator-v232.js';\n",
    "const SYSTEMS_MESH_RUNTIME='/app/civweave-systems-mesh-v251.js';\n",
    "const NODE_AI_MESH_RUNTIME='/app/node-ai-mesh-v1.js';\n",
    "const QUEST_VEIL='/app/quest-veil-v1.js';\n",
    "const QUEST_VEIL_MESH='/app/quest-veil-mesh-v1.js';\n",
    "const QUEST_VEIL_LEDGER_GATE='/app/quest-veil-ledger-gate-v1.js';\n",
    "const SYSTEM_RADIO_AGENT='/app/system-radio-agent-v233.js';\n",
    "const RADIO_TRACK_SUGGESTIONS='/app/radio-track-suggestions-v240.js';\n",
    "const CANONICAL_PLAYLISTS='/app/canonical-playlists-v1.js';\n",
    "const RADIO_PLAYLIST_GOVERNANCE='/app/radio-playlist-governance-v1.js';\n",
    "const SHARED_REVIEW_SURFACE='/app/shared-review-surface-v234.js';\n",
]:
    s = replace_once(s, token, '', f'boundary constant {token.strip()}')
anchor = "const RELEASE_VERSION='/app/release-version-v1.js';\n"
s = replace_once(s, anchor, anchor + "const CORE_INTERFACE_RUNTIME='/app/core-interface-runtime-v1.js';\n", 'core runtime boundary constant')
start = s.index('const CANONICAL_SYSTEM_SCRIPTS=[')
end = s.index('const COMPATIBILITY_SCRIPTS=[', start)
s = s[:start] + s[end:]
old = """function installSystemExperienceSupport(){
  const system=systemSurface();
  if(!system||!liveHead())return false;
  SYSTEM_EXPERIENCE_SCRIPTS.forEach(addScript);
  if(system==='fellowfare')addScript(FELLOWFARE_GUIDE_BRIDGE);
  installAssetCustomizationIfConfigured();
  return true;
}
function installCanonicalSystemSupport(){
  if(canonicalAppSurface()||!systemSurface()||!liveHead())return false;
  CANONICAL_SYSTEM_SCRIPTS.forEach(addScript);
  return true;
}
function installCanonicalSystemSupportWhenReady(){
  if(document.body)return installCanonicalSystemSupport();
  addEventListener('DOMContentLoaded',installCanonicalSystemSupport,{once:true});
  return true;
}"""
new = """function installSystemExperienceSupport(){
  const system=systemSurface();
  if(!system||!liveHead())return false;
  return addScript(CORE_INTERFACE_RUNTIME);
}
function installCanonicalSystemSupport(){return installSystemExperienceSupport()}
function installCanonicalSystemSupportWhenReady(){return installSystemExperienceSupport()}"""
s = replace_once(s, old, new, 'boundary shared loader')
s = s.replace("    if(system!=='civweave')installCanonicalSystemSupportWhenReady();\n", '', 1)
s = s.replace("    installCanonicalSystemSupportWhenReady();\n", '', 1)
old = """  canonicalSubsystemSupportScripts:CANONICAL_SYSTEM_SCRIPTS.length,
  canonicalExperienceScripts:SYSTEM_EXPERIENCE_SCRIPTS.length,
  canonicalSubsystemCompatibility:'route-version-settings-only-no-legacy-additions',"""
new = """  canonicalRuntimeScripts:1,
  canonicalSubsystemCompatibility:'core-interface-runtime-owned-shared-loading',
  coreInterfaceRuntimeRevision:'v1-five-system-shared-loader-adapter-lifecycle',
  sharedLoadingOwner:'core-interface-runtime-v1',"""
s = replace_once(s, old, new, 'boundary ownership metadata')
p.write_text(s)

# Critical offline cache.
p = Path('public/service-worker-critical-v199.js')
s = p.read_text()
anchor = "  '/app/install-boundary-v146.js',\n"
if "'/app/core-interface-runtime-v1.js'" not in s:
    s = replace_once(s, anchor, anchor + "  '/app/core-interface-runtime-v1.js',\n", 'critical cache runtime')
p.write_text(s)

# Current ownership registry: preserve everything added since the old draft.
p = Path('config/system-ownership.json')
s = p.read_text()
if '"interface-runtime"' not in s:
    anchor = '    "family-navigation": {'
    block = '''    "interface-runtime": {
      "capability": "Five-system interface boot lifecycle, shared structural slots, and realm adapter contract",
      "owner": "public/app/core-interface-runtime-v1.js",
      "bootstrapCaller": "public/app/install-boundary-v146.js",
      "routeContract": "public/app/system-routes-v227.js",
      "navigationSubscriber": "public/app/family-shell-v104.js",
      "canonicalApi": "globalThis.CivweaveCoreInterfaceRuntimeV1",
      "canonicalEvents": [
        "civweave:interface-runtime-phase",
        "civweave:interface-runtime-ready",
        "civweave:interface-system-ready",
        "civweave:interface-shared-support-ready",
        "civweave:interface-system-changed",
        "civweave:interface-adapter-registered",
        "civweave:interface-adapter-unmounted",
        "civweave:interface-feature-ready",
        "civweave:interface-feature-error",
        "civweave:interface-runtime-error"
      ],
      "activeEntryRoutes": [
        "public/app/working-campus-v156.html",
        "public/app/cabinets/living-school/index.html",
        "public/app/realm-console-v140.html",
        "public/app/fellowfare-cabinet-v144.html",
        "public/app/anarchadia-console-v139.html"
      ],
      "rules": [
        "The install boundary may decide whether a canonical surface can boot and may request the runtime, but it does not own realm UI lifecycle.",
        "All five systems boot the same interface runtime before realm-specific shared capabilities.",
        "The install boundary boots the runtime but never iterates or executes the shared system dependency manifest; shared loading belongs to core-interface-runtime-v1.js.",
        "Required shared capability owners fail boot closed; optional configured asset customization may fail without fabricating an interactive half-app.",
        "Realm-specific features register adapters or subscribe to lifecycle events; they do not fork the core loader.",
        "Family navigation remains owned by family-shell-v104.js and Settings input remains owned by settings-gateway-v317.js.",
        "The runtime must be idempotent and safe across pageshow/BFCache resume."
      ]
    },
'''
    s = replace_once(s, anchor, block + anchor, 'interface runtime ownership')
p.write_text(s)

# Release materializer: preserve the new source of truth instead of recreating boundary manifests.
p = Path('scripts/sync-release-coherence-v220.mjs')
s = p.read_text()
s = replace_once(s, '    "root.dataset.civweaveCanonicalCore=\'only\'",\n', '    "const CORE_INTERFACE_RUNTIME=\'/app/core-interface-runtime-v1.js\'",\n    "root.dataset.civweaveCanonicalCore=\'only\'",\n', 'release runtime token')
s = replace_once(s, '    "browserRuntimePolicy:\'installed-display-only\'",\n', '    "browserRuntimePolicy:\'installed-display-only\'",\n    "sharedLoadingOwner:\'core-interface-runtime-v1\'",\n', 'release shared owner token')
s = replace_once(s, "    'canonicalAutoScripts:0'\n", "    'canonicalAutoScripts:0',\n    'canonicalRuntimeScripts:1'\n", 'release runtime count')
old = """  const start=source.indexOf('const SYSTEM_EXPERIENCE_SCRIPTS=['),end=source.indexOf('];',start),experience=source.slice(start,end);
  if(!experience.includes('GUIDE_WORKSPACE'))throw new Error('Canonical system experience must boot the v242 workspace.');"""
new = """  if(source.includes('SYSTEM_EXPERIENCE_SCRIPTS')||source.includes('CANONICAL_SYSTEM_SCRIPTS'))throw new Error('Install boundary must not retain superseded canonical dependency manifests.');
  const boot=source.match(/function installSystemExperienceSupport\\(\\)\\{([\\s\\S]*?)\\n\\}/)?.[1]||'';
  if(!boot.includes('addScript(CORE_INTERFACE_RUNTIME)'))throw new Error('Install boundary must bootstrap the core interface runtime.');
  if(/\\.forEach\\(|SETTINGS_GATEWAY|GUIDE_WORKSPACE|SYSTEM_RADIO_AGENT/.test(boot))throw new Error('Install boundary regained shared-system loading ownership.');"""
s = replace_once(s, old, new, 'release boundary ownership assertion')
marker = "\nawait patch('public/app/system-routes-v227.js',source=>{"
core = """

const coreInterfaceRuntime=await readFile(path.join(root,'public/app/core-interface-runtime-v1.js'),'utf8');
for(const token of[
  "const SYSTEM_ORDER=Object.freeze(['civweave','living-school','cerbanimo','fellowfare','anarchadia'])",
  'const SHARED_BOOT_SCRIPTS=Object.freeze([',
  "'/app/settings-gateway-v317.js'",
  "'/app/mobile-ai-hardening-v302.js'",
  "'/app/realm-session-integrity-v237.js'",
  "'/app/guide-workspace-v242.js'",
  "'/app/themed-system-nav-v178.js'",
  "'/app/shared-review-surface-v234.js'",
  "'/app/shared-guide-surface-v236.js'",
  "const FELLOWFARE_GUIDE_BRIDGE='/app/fellowfare-shared-guide-bridge-v236.js'",
  "settingsInputOwner:'settings-gateway-v317'",
  "familyNavigationOwner:'family-shell-v104'",
  "error.code='CIVWEAVE_INTERFACE_SHARED_BOOT_FAILED'"
])if(!coreInterfaceRuntime.includes(token))throw new Error(`Core interface runtime is missing ${token}.`);
if(/data-open-unified-ai-settings|addEventListener[^\\n]*\\('click'/.test(coreInterfaceRuntime))throw new Error('Core interface runtime may assemble shared owners but may not become a second Settings input owner.');
if(!/const failedRequired=failed\\.filter\\(result=>result\\.required\\)/.test(coreInterfaceRuntime))throw new Error('Core interface runtime must classify required shared-load failures.');
"""
if 'const coreInterfaceRuntime=await readFile' not in s:
    s = replace_once(s, marker, core + marker, 'release core runtime verifier')
p.write_text(s)

# Dedicated CI workflow: modern Actions versions and explicit fail-closed invariant.
p = Path('.github/workflows/verify-core-interface-runtime-v1.yml')
s = p.read_text().replace('actions/checkout@v4', 'actions/checkout@v5').replace('actions/setup-node@v4', 'actions/setup-node@v5')
anchor = "          assert.match(runtime,/settingsInputOwner:'settings-gateway-v317'/);\n"
addition = """          assert.match(runtime,/settingsInputOwner:'settings-gateway-v317'/);
          assert.match(runtime,/error\\.code='CIVWEAVE_INTERFACE_SHARED_BOOT_FAILED'/);
          assert.match(runtime,/const failedRequired=failed\\.filter\\(result=>result\\.required\\)/);
          assert.match(runtime,/if\\(failedRequired\\.length\\)\\{/);
"""
s = replace_once(s, anchor, addition, 'core verifier fail-closed assertions')
p.write_text(s)

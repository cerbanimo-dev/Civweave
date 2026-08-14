import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const ROOT=path.resolve(HERE,'..');
const pkg=JSON.parse(await fs.readFile(path.join(ROOT,'package.json'),'utf8'));
const version=String(pkg.version||'').trim();
if(!/^\d+\.\d+\.\d+$/.test(version))throw new Error(`Invalid package version ${version}`);

const revision=`${version}-chat-convergence-v250-navigation-lifecycle-v424-install-only-pwa-v1`;
const installedEntryRevision='boot-recovery-v426-install-only-pwa-v1';
const boundaryRuntimeRevision='browser-install-boundary-v228-chat-escape-install-only-pwa-v1';
const routeRevision='five-system-routes-v227-install-only-pwa-v1';

async function read(relative){return fs.readFile(path.join(ROOT,relative),'utf8')}
async function write(relative,source){await fs.writeFile(path.join(ROOT,relative),source,'utf8')}
function replaceRequired(source,pattern,replacement,label){if(!pattern.test(source))throw new Error(`Could not find ${label}.`);return source.replace(pattern,replacement)}
async function patch(relative,mutate){const before=await read(relative),after=mutate(before);if(after!==before)await write(relative,after);return after!==before}

await patch('public/app/index.html',source=>{
  source=replaceRequired(source,/<title>Install Civweave v\d+\.\d+\.\d+<\/title>/,`<title>Install Civweave v${version}</title>`,'installer title version');
  source=replaceRequired(source,/<span class="version">v\d+\.\d+\.\d+<\/span>/,`<span class="version">v${version}</span>`,'installer visible version');
  source=replaceRequired(source,/manifest\.webmanifest\?v=\d+\.\d+\.\d+/,`manifest.webmanifest?v=${version}`,'installer manifest version');
  source=replaceRequired(source,/civweave-brand\.js\?v=\d+\.\d+\.\d+/,`civweave-brand.js?v=${version}`,'installer brand version');
  source=replaceRequired(source,/install-v130\.js\?v=\d+\.\d+\.\d+/,`install-v130.js?v=${version}`,'installer runtime version');
  return source;
});

await patch('public/install-v130.js',source=>replaceRequired(source,/const WORKER_SCRIPT_REVISION = '[^']+';/,`const WORKER_SCRIPT_REVISION = '${revision}';`,'installer worker revision constant'));
await patch('public/app/installed-entry-v146.js',source=>{
  source=replaceRequired(source,/const FALLBACK_VERSION='\d+\.\d+\.\d+';/,`const FALLBACK_VERSION='${version}';`,'installed entry fallback release version');
  source=replaceRequired(source,/version:'\d+\.\d+\.\d+(-[^']+)'/,`version:'${version}$1'`,'installed entry exported release version');
  if(!source.includes("updateViaCache:'none'"))throw new Error('Installed entry must bypass HTTP cache when checking the active worker.');
  if(!/await\s+(?:bounded\()?registration\.update\(\)/.test(source))throw new Error('Installed entry must explicitly request a worker update before routing.');
  if(!source.includes("candidate.postMessage({type:'SKIP_WAITING'})"))throw new Error('Installed entry must activate a waiting worker before routing.');
  if(!source.includes(`revision=${installedEntryRevision}`))throw new Error('Installed entry does not register the current install-only boot-recovery worker revision.');
  if(!source.includes("browserRuntimePolicy:'installed-display-only'"))throw new Error('Installed entry must keep browser runtime disabled.');
  return source;
});

await patch('public/app/install-boundary-v146.js',source=>{
  source=replaceRequired(source,/const VERSION='[^']+';/,`const VERSION='${version}';`,'install-boundary version');
  if(!source.includes(`const REVISION='${boundaryRuntimeRevision}';`))throw new Error('Install boundary must retain the install-only browser boundary revision.');
  if(!source.includes('const ADDITIONS_VERSION=`${requestedRelease}-chat-convergence-v250-navigation-lifecycle-v424-browser-boundary-v228-install-only-pwa-v1`;'))throw new Error('Install boundary must derive the install-only browser-safe experience cache identity from the requested release.');
  for(const token of [
    "['/app/working-campus-v156.html','civweave']",
    "['/app/cabinets/living-school/index.html','living-school']",
    "['/app/realm-console-v140.html','cerbanimo']",
    "['/app/fellowfare-cabinet-v144.html','fellowfare']",
    "['/app/anarchadia-console-v139.html','anarchadia']",
    "root.dataset.civweaveCanonicalCore='only'",
    "canonicalPolicy:'five-system-first-class-routes-v242-canonical-chat-owner'",
    "guideWorkspaceRevision:'v250-v242-canonical-owner'",
    "guideSurfaceOwnershipPolicy:'v250-single-v242-runtime-five-local-window-ledgers-handover-only-cross-realm'",
    "navigationLifecycleRevision:'v424-head-capture-bfcache-resume'",
    "browserRuntimePolicy:'installed-display-only'",
    'installedQueryIsAuthorization:false',
    'canonicalSystemCount:5',
    'canonicalAutoScripts:0'
  ])if(!source.includes(token))throw new Error(`Five-system install boundary is missing ${token}.`);
  if(source.includes('function allowed(){return installedDisplay()||developer()||embedded()}'))throw new Error('Embedded browser documents must not authorize Civweave runtime.');
  const start=source.indexOf('const SYSTEM_EXPERIENCE_SCRIPTS=['),end=source.indexOf('];',start),experience=source.slice(start,end);
  if(!experience.includes('GUIDE_WORKSPACE'))throw new Error('Canonical system experience must boot the v242 workspace.');
  for(const retired of ['PERSISTENT_GUIDE_CHAT_SCRIPT','PERSISTENT_GUIDE_VIEWPORT_SCRIPT','/app/persistent-guide-chat-v215.js','/app/persistent-guide-viewport-v216.js'])if(source.includes(retired))throw new Error(`Release coherence must not resurrect ${retired}.`);
  if(source.includes('function startAdditions()'))throw new Error('Canonical boundary still contains delayed automatic additions.');
  return source;
});

await patch('public/app/system-routes-v227.js',source=>{
  source=replaceRequired(source,/const VERSION='[^']+';/,`const VERSION='${version}';`,'five-system route version');
  if(!source.includes(`const REVISION='${routeRevision}';`))throw new Error('Five-system route contract revision drifted.');
  return source;
});

console.log(JSON.stringify({ok:true,version,revision,installedEntryRevision,boundaryRuntimeRevision,routeRevision},null,2));

import {readFile,writeFile} from 'node:fs/promises';

const path='public/app/install-boundary-v146.js';
let source=await readFile(path,'utf8');

source=source.replace(
  "const REVISION='browser-install-boundary-v228-chat-escape';",
  "const REVISION='browser-install-boundary-v228-chat-escape-install-only-pwa-v1';"
);
source=source.replace(
  'const ADDITIONS_VERSION=`${requestedRelease}-chat-convergence-v250-navigation-lifecycle-v424-browser-boundary-v228`;',
  'const ADDITIONS_VERSION=`${requestedRelease}-chat-convergence-v250-navigation-lifecycle-v424-browser-boundary-v228-install-only-pwa-v1`;'
);
source=source.replace(
  'function allowed(){return installedDisplay()||developer()||embedded()}',
  'function allowed(){return installedDisplay()||developer()}'
);
source=source.replace(
  "}else if(root)root.dataset.installBoundary=installedDisplay()?'installed':developer()?'developer':'embedded';",
  "}else if(root)root.dataset.installBoundary=installedDisplay()?'installed':'developer';"
);
if(!source.includes("browserRuntimePolicy:'installed-display-only-v1'")){
  source=source.replace(
    "  browserBoundaryRevision:'v228-installed-only-stale-session-chat-escape',",
    "  browserBoundaryRevision:'v228-installed-only-stale-session-chat-escape',\n  browserRuntimePolicy:'installed-display-only-v1',\n  installedQueryIsAuthorization:false,"
  );
}
source=source.replace('  onlineSelfHeal:true,','  onlineSelfHeal:false,');

for(const required of [
  "function allowed(){return installedDisplay()||developer()}",
  "browserRuntimePolicy:'installed-display-only-v1'",
  'installedQueryIsAuthorization:false',
  'onlineSelfHeal:false'
]){
  if(!source.includes(required))throw new Error(`Install-only boundary normalization missing: ${required}`);
}
if(source.includes('function allowed(){return installedDisplay()||developer()||embedded()}')){
  throw new Error('Embedded browser runtime authorization survived normalization.');
}
await writeFile(path,source);

const repairVerifierPath='scripts/verify-shell-self-repair-v225.mjs';
let repairVerifier=await readFile(repairVerifierPath,'utf8');
repairVerifier=repairVerifier.replace(
  "assert(indexHtml.includes('/app/installer-repair-only-v1.js?v=1.0.141-install-only-pwa-boundary'),'Installer does not load repair-only recovery.');",
  "assert(indexHtml.includes(`/app/installer-repair-only-v1.js?v=${version}-install-only-pwa-boundary`),'Installer does not load repair-only recovery.');"
);
if(repairVerifier.includes('1.0.141-install-only-pwa-boundary')){
  throw new Error('Shell self-repair verifier still hard-codes the retired 1.0.141 release.');
}
await writeFile(repairVerifierPath,repairVerifier);

console.log(JSON.stringify({
  ok:true,
  path,
  policy:'installed-display-only-v1',
  embeddedRuntime:false,
  repairVerifier:'release-dynamic'
},null,2));

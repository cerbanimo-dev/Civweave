import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const version=(await readFile(path.join(root,'VERSION'),'utf8')).trim();
const pkg=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
if(!/^\d+\.\d+\.\d+$/.test(version))throw new Error('VERSION must contain a semantic release version.');
if(pkg.version!==version)throw new Error(`package.json ${pkg.version} does not match VERSION ${version}.`);

const changed=[];
async function patch(relative,transform){
  const file=path.join(root,relative),before=await readFile(file,'utf8'),after=transform(before);
  if(after===before)return;
  await writeFile(file,after,'utf8');
  changed.push(relative);
}
function replaceRequired(source,pattern,replacement,label){
  if(!pattern.test(source))throw new Error(`${label} was not found while synchronizing Civweave ${version}.`);
  return source.replace(pattern,replacement);
}

await patch('public/index.html',source=>{
  source=replaceRequired(source,/<title>Civweave<\/title>/,'<title>Civweave</title>','launcher title');
  source=replaceRequired(source,/civweave-brand\.js\?v=\d+\.\d+\.\d+/,`civweave-brand.js?v=${version}`,'branding layer revision');
  source=replaceRequired(source,/installed-entry-v146\.js\?v=\d+\.\d+\.\d+/,`installed-entry-v146.js?v=${version}`,'launcher entry revision');
  return source;
});

await patch('public/app/index.html',source=>{
  source=replaceRequired(source,/<title>Install Civweave v\d+\.\d+\.\d+<\/title>/,`<title>Install Civweave v${version}</title>`,'installer title');
  source=replaceRequired(source,/<span class="version">v\d+\.\d+\.\d+<\/span>/,`<span class="version">v${version}</span>`,'installer version badge');
  source=replaceRequired(source,/(?:Install Civweave v\d+\.\d+\.\d+\. The campus downloads automatically\.|Install the shell\. Open Civweave immediately\. Download offline files only when you choose\.)/,`Install the shell. Open Civweave immediately. Download offline files only when you choose.`,'installer headline');
  source=source.replace(/manifest\.webmanifest\?v=\d+\.\d+\.\d+/g,`manifest.webmanifest?v=${version}`);
  source=source.replace(/civweave-brand\.js\?v=\d+\.\d+\.\d+/g,`civweave-brand.js?v=${version}`);
  source=source.replace(/\d+\.\d+\.\d+-lightweight-shell-v208/g,`${version}-lightweight-shell-v208`);
  source=source.replace(/\d+\.\d+\.\d+-offline-retry-loop-v211/g,`${version}-offline-retry-loop-v211`);
  source=source.replace(/\d+\.\d+\.\d+-required-campus-v1/g,`${version}-required-campus-v1`);
  return source;
});

await patch('public/app/manifest.webmanifest',source=>{
  const manifest=JSON.parse(source);
  manifest.name=`Civweave v${version}`;
  manifest.start_url='/app/installed-entry-v146?installed=1';
  if(Array.isArray(manifest.shortcuts))for(const shortcut of manifest.shortcuts){
    const target=new URL(shortcut.url||'/app/installed-entry-v146','https://civweave.invalid');
    const system=target.searchParams.get('system');
    target.pathname='/app/installed-entry-v146';
    target.search='?installed=1';
    if(system)target.searchParams.set('system',system);
    shortcut.url=`${target.pathname}${target.search}`;
  }
  return `${JSON.stringify(manifest,null,2)}\n`;
});

await patch('public/install-v130.js',source=>replaceRequired(source,/const VERSION = '\d+\.\d+\.\d+';/,`const VERSION = '${version}';`,'installer runtime version'));
await patch('public/app/installed-entry-v146.html',source=>replaceRequired(source,/installed-entry-v146\.js\?v=\d+\.\d+\.\d+/,`installed-entry-v146.js?v=${version}`,'installed entry revision'));
await patch('public/app/installed-entry-v146.js',source=>{
  source=replaceRequired(source,/const FALLBACK_VERSION='\d+\.\d+\.\d+';/,`const FALLBACK_VERSION='${version}';`,'installed-entry fallback version');
  source=replaceRequired(source,/version:'\d+\.\d+\.\d+-chat-convergence-v250'/,`version:'${version}-chat-convergence-v250'`,'installed-entry exported version');
  return source;
});
await patch('public/app/system-routes-v227.js',source=>replaceRequired(source,/const VERSION='\d+\.\d+\.\d+';/,`const VERSION='${version}';`,'five-system route version'));
await patch('public/app/themed-system-nav-v178.js',source=>{
  source=replaceRequired(source,/const VERSION='\d+\.\d+\.\d+-five-system-navigation-v227';/,`const VERSION='${version}-five-system-navigation-v227';`,'themed navigation version');
  source=source.replace(/version:'\d+\.\d+\.\d+'/g,`version:'${version}'`);
  return source;
});
await patch('public/app/working-campus-v156.js',source=>source.replace(/system-routes-v227\.js\?v=\d+\.\d+\.\d+-five-system-route-contract-v227/,`system-routes-v227.js?v=${version}-five-system-route-contract-v227`));
await patch('public/app/working-campus-v156.part4.txt',source=>source.replace(/version:'\d+\.\d+\.\d+'/g,`version:'${version}'`));
await patch('public/service-worker-core-v208.js',source=>replaceRequired(source,/const VERSION = '\d+\.\d+\.\d+';/,`const VERSION = '${version}';`,'service-worker core version'));
await patch('public/service-worker-v203.js',source=>{
  source=replaceRequired(source,/system-routes-v227\.js\?v=\d+\.\d+\.\d+-five-system-route-contract-v227/,`system-routes-v227.js?v=${version}-five-system-route-contract-v227`,'worker route contract revision');
  source=replaceRequired(source,/service-worker-core-v208\.js\?v=\d+\.\d+\.\d+(?:-[^'\n]+)?/,`service-worker-core-v208.js?v=${version}-chat-convergence-v250`,'service-worker wrapper revision');
  return source;
});
await patch('public/service-worker-v156.js',source=>replaceRequired(source,/service-worker-v203\.js\?v=\d+\.\d+\.\d+(?:-code-coherence-v288)?-lightweight-shell-v208-legacy-v156-bridge-v209/,`service-worker-v203.js?v=${version}-code-coherence-v288-lightweight-shell-v208-legacy-v156-bridge-v209`,'legacy worker bridge revision'));
await patch('public/app/install-boundary-v146.js',source=>{
  source=replaceRequired(source,/const VERSION='\d+\.\d+\.\d+';/,`const VERSION='${version}';`,'install-boundary runtime version');
  if(!source.includes('const ADDITIONS_VERSION=`${requestedRelease}-chat-convergence-v250`;'))throw new Error(`install-boundary release-aware additions revision was not found while synchronizing Civweave ${version}.`);
  return source;
});

await patch('public/app/working-campus-v156.html',source=>{
  source=replaceRequired(source,/Civweave Working Campus · v\d+\.\d+\.\d+/,`Civweave Working Campus · v${version}`,'working-campus title');
  source=replaceRequired(source,/<b class="version-chip">v\d+\.\d+\.\d+<\/b>/,`<b class="version-chip">v${version}</b>`,'working-campus version chip');
  source=source.replace(/install-boundary-v146\.js\?v=\d+\.\d+\.\d+-v184/,`install-boundary-v146.js?v=${version}-v184`);
  source=source.replace(/const VERSION='\d+\.\d+\.\d+-working-campus-planner-v199';/,`const VERSION='${version}-working-campus-planner-v199';`);
  return source;
});

await patch(`releases/${version}/server/server-gateway-v131-base.mjs`,source=>{
  source=replaceRequired(source,/const VERSION = '\d+\.\d+\.\d+';/,`const VERSION = '${version}';`,'gateway base version');
  source=replaceRequired(source,/const BUILD = '\d+\.\d+\.\d+-install-only-fullscreen-family-gateway';/,`const BUILD = '${version}-install-only-fullscreen-family-gateway';`,'gateway build version');
  source=source.replace(/Civweave v\d+\.\d+\.\d+ fixed-settings-layer device package/g,`Civweave v${version} fixed-settings-layer device package`);
  return source;
});

await patch(`releases/${version}/server/server-gateway-v131.mjs`,source=>source.replace(/const VERSION = '\d+\.\d+\.\d+-render-installed-runtime-v132';/,`const VERSION = '${version}-render-installed-runtime-v132';`));
await patch(`releases/${version}/server/server-local-v131.mjs`,source=>{
  source=source.replace(/Civweave local v\d+\.\d+\.\d+ patch/g,`Civweave local v${version} patch`);
  source=source.replace(/,"const VERSION = '\d+\.\d+\.\d+';",'local version marker'/,`,"const VERSION = '${version}';",'local version marker'`);
  source=source.replace(/,"const BUILD = '\d+\.\d+\.\d+-settings-layer-local-runtime';",'local build marker'/,`,"const BUILD = '${version}-settings-layer-local-runtime';",'local build marker'`);
  source=source.replace(/,"const CW_VERSION = '\d+\.\d+\.\d+';",'generated runtime version marker'/,`,"const CW_VERSION = '${version}';",'generated runtime version marker'`);
  source=source.replace(/,"const CW_BUILD = '\d+\.\d+\.\d+-settings-layer-local-runtime';",'generated runtime build marker'/,`,"const CW_BUILD = '${version}-settings-layer-local-runtime';",'generated runtime build marker'`);
  source=source.replace(/\?build=\d+\.\d+\.\d+'/g,`?build=${version}'`);
  return source;
});

await patch('scripts/smoke-gateway-v131-base.mjs',source=>{
  source=replaceRequired(source,/VERSION='\d+\.\d+\.\d+',BUILD='\d+\.\d+\.\d+-install-only-fullscreen-family-gateway'/,`VERSION='${version}',BUILD='${version}-install-only-fullscreen-family-gateway'`,'gateway smoke release constants');
  source=source.replace(/Install Civweave v\d+\.\d+\.\d+\./g,`Install Civweave v${version}.`);
  source=source.replace(/gateway root is not the v\d+\.\d+\.\d+ installer/g,`gateway root is not the v${version} installer`);
  source=source.replace(/v1\.0\.7 package still includes/g,`v${version} package still includes`);
  source=source.replace(/campus\.includes\('v\d+\.\d+\.\d+'\)/,`campus.includes('${version}')`);
  return source;
});

await patch('scripts/verify-device-package-self-heal-v184.mjs',source=>source.replace(/v1\.0\.7/g,`v${version}`).replace(/1\.0\.7/g,version));

console.log(JSON.stringify({ok:true,version,serverTargets:`releases/${version}/server`,changed},null,2));

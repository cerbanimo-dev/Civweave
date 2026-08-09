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
  await writeFile(file,after,'utf8');changed.push(relative);
}
function required(source,pattern,replacement,label){
  if(!pattern.test(source))throw new Error(`${label} was not found while synchronizing Civweave ${version}.`);
  return source.replace(pattern,replacement);
}

await patch('public/index.html',source=>{
  source=required(source,/<title>Civweave<\/title>/,'<title>Civweave</title>','host bootstrap title');
  source=required(source,/civweave-brand\.js\?v=\d+\.\d+\.\d+/,`civweave-brand.js?v=${version}`,'branding layer revision');
  source=required(source,/installed-entry-v146\.js\?v=\d+\.\d+\.\d+/,`installed-entry-v146.js?v=${version}`,'release sync marker');
  if(!source.includes("new URL('/app/index.html',location.origin)"))throw new Error('Hosted root must remain installer-only.');
  if(source.includes("new URL('/app/working-campus-v156.html',location.origin)"))throw new Error('Hosted root must never launch Working Campus directly.');
  return source;
});

await patch('public/app/index.html',source=>{
  source=required(source,/<title>Install Civweave v\d+\.\d+\.\d+<\/title>/,`<title>Install Civweave v${version}</title>`,'installer title');
  source=required(source,/<span class="version">v\d+\.\d+\.\d+<\/span>/,`<span class="version">v${version}</span>`,'installer version badge');
  source=required(source,/Install Civweave v\d+\.\d+\.\d+\./,`Install Civweave v${version}.`,'installer headline version');
  source=source.replace(/manifest\.webmanifest\?v=\d+\.\d+\.\d+/g,`manifest.webmanifest?v=${version}`);
  source=source.replace(/civweave-brand\.js\?v=\d+\.\d+\.\d+/g,`civweave-brand.js?v=${version}`);
  source=source.replace(/\d+\.\d+\.\d+-lightweight-shell-v208/g,`${version}-lightweight-shell-v208`);
  source=source.replace(/\d+\.\d+\.\d+-offline-retry-loop-v211/g,`${version}-offline-retry-loop-v211`);
  source=source.replace(/\d+\.\d+\.\d+-(?:required-campus-v1|downloaded-runtime-v266)/g,match=>match.endsWith('required-campus-v1')?`${version}-required-campus-v1`:`${version}-downloaded-runtime-v266`);
  if(/Open online campus|launch=online|Open Civweave online/i.test(source))throw new Error('Installer resurrected a live campus runtime fallback.');
  if(!source.includes('canonical Civweave, Living School, Cerbanimo, FellowFare, and Anarchadia pages are package-only at runtime'))throw new Error('Installer lost the downloaded-runtime boundary contract.');
  return source;
});

await patch('public/app/manifest.webmanifest',source=>{
  const manifest=JSON.parse(source);manifest.name=`Civweave v${version}`;manifest.start_url='/app/installed-entry-v146.html?installed=1';
  if(Array.isArray(manifest.shortcuts))for(const shortcut of manifest.shortcuts){
    const target=new URL(shortcut.url||'/app/installed-entry-v146.html','https://civweave.invalid'),system=target.searchParams.get('system');
    target.pathname='/app/installed-entry-v146.html';target.search='?installed=1';if(system)target.searchParams.set('system',system);shortcut.url=`${target.pathname}${target.search}`;
  }
  return `${JSON.stringify(manifest,null,2)}\n`;
});

await patch('public/install-v130.js',source=>required(source,/const VERSION = '\d+\.\d+\.\d+';/,`const VERSION = '${version}';`,'installer runtime version'));
await patch('public/app/installed-entry-v146.html',source=>required(source,/installed-entry-v146\.js\?v=\d+\.\d+\.\d+/,`installed-entry-v146.js?v=${version}`,'installed entry revision'));
await patch('public/app/installed-entry-v146.js',source=>{
  source=source.replace(/const FALLBACK_VERSION='\d+\.\d+\.\d+';/,`const FALLBACK_VERSION='${version}';`);
  source=source.replace(/version:'\d+\.\d+\.\d+-chat-convergence-v250'/,`version:'${version}-chat-convergence-v250'`);
  return source;
});
await patch('public/app/system-routes-v227.js',source=>required(source,/const VERSION='\d+\.\d+\.\d+';/,`const VERSION='${version}';`,'five-system route version'));
await patch('public/app/themed-system-nav-v178.js',source=>{
  source=required(source,/const VERSION='\d+\.\d+\.\d+-five-system-navigation-v227';/,`const VERSION='${version}-five-system-navigation-v227';`,'themed navigation version');
  return source.replace(/version:'\d+\.\d+\.\d+'/g,`version:'${version}'`);
});
await patch('public/app/working-campus-v156.js',source=>source.replace(/system-routes-v227\.js\?v=\d+\.\d+\.\d+-five-system-route-contract-v227/,`system-routes-v227.js?v=${version}-five-system-route-contract-v227`));
await patch('public/app/working-campus-v156.part4.txt',source=>source.replace(/version:'\d+\.\d+\.\d+'/g,`version:'${version}'`));
await patch('public/service-worker-core-v208.js',source=>required(source,/const VERSION = '\d+\.\d+\.\d+';/,`const VERSION = '${version}';`,'service-worker core version'));
await patch('public/service-worker-v203.js',source=>{
  source=required(source,/system-routes-v227\.js\?v=\d+\.\d+\.\d+-five-system-route-contract-v227/,`system-routes-v227.js?v=${version}-five-system-route-contract-v227`,'worker route contract revision');
  source=required(source,/service-worker-core-v208\.js\?v=\d+\.\d+\.\d+(?:-[^'\n]+)?/,`service-worker-core-v208.js?v=${version}-chat-convergence-v250`,'service-worker core revision');
  source=source.replace(/service-worker-offline-runtime-boundary-v266\.js\?v=\d+\.\d+\.\d+-downloaded-runtime-v266/,`service-worker-offline-runtime-boundary-v266.js?v=${version}-downloaded-runtime-v266`);
  if(source.indexOf('service-worker-offline-runtime-boundary-v266.js')>source.indexOf('service-worker-core-v208.js'))throw new Error('Downloaded runtime boundary must load before the general service-worker core.');
  return source;
});
await patch('public/service-worker-v156.js',source=>required(source,/service-worker-v203\.js\?v=\d+\.\d+\.\d+-lightweight-shell-v208-legacy-v156-bridge-v209/,`service-worker-v203.js?v=${version}-lightweight-shell-v208-legacy-v156-bridge-v209`,'legacy worker bridge revision'));
await patch('public/app/install-boundary-v146.js',source=>{
  source=required(source,/const VERSION='\d+\.\d+\.\d+';/,`const VERSION='${version}';`,'install-boundary runtime version');
  if(!source.includes("runtimeAuthorizationPolicy:'standalone-or-preauthorized-session-never-route-intrinsic'"))throw new Error('Install boundary lost explicit runtime authorization.');
  if(!source.includes("runtimeSourcePolicy:'current-downloaded-package-never-live-site-fallback'"))throw new Error('Install boundary lost downloaded-package runtime policy.');
  return source;
});
await patch('public/service-worker-offline-runtime-boundary-v266.js',source=>source.replace(/\|\|'\d+\.\d+\.\d+';/,`||'${version}';`));

await patch('public/app/working-campus-v156.html',source=>{
  source=required(source,/Civweave Working Campus · v\d+\.\d+\.\d+/,`Civweave Working Campus · v${version}`,'working-campus title');
  source=required(source,/<b class="version-chip">v\d+\.\d+\.\d+<\/b>/,`<b class="version-chip">v${version}</b>`,'working-campus version chip');
  source=source.replace(/install-boundary-v146\.js\?v=\d+\.\d+\.\d+-v184/,`install-boundary-v146.js?v=${version}-v184`);
  source=source.replace(/const VERSION='\d+\.\d+\.\d+-working-campus-planner-v199';/,`const VERSION='${version}-working-campus-planner-v199';`);
  return source;
});

await patch('server-gateway-v131-base.mjs',source=>{
  source=required(source,/const VERSION = '\d+\.\d+\.\d+';/,`const VERSION = '${version}';`,'gateway base version');
  source=required(source,/const BUILD = '\d+\.\d+\.\d+-install-only-fullscreen-family-gateway';/,`const BUILD = '${version}-install-only-fullscreen-family-gateway';`,'gateway build version');
  return source.replace(/Civweave v\d+\.\d+\.\d+ fixed-settings-layer device package/g,`Civweave v${version} fixed-settings-layer device package`);
});
await patch('server-gateway-v131.mjs',source=>source.replace(/const VERSION = '\d+\.\d+\.\d+-render-installed-runtime-v132';/,`const VERSION = '${version}-render-installed-runtime-v132';`));
await patch('server-local-v131.mjs',source=>{
  source=source.replace(/Civweave local v\d+\.\d+\.\d+ patch/g,`Civweave local v${version} patch`);
  source=source.replace(/,"const VERSION = '\d+\.\d+\.\d+';",'local version marker'/,`,"const VERSION = '${version}';",'local version marker'`);
  source=source.replace(/,"const BUILD = '\d+\.\d+\.\d+-settings-layer-local-runtime';",'local build marker'/,`,"const BUILD = '${version}-settings-layer-local-runtime';",'local build marker'`);
  source=source.replace(/,"const CW_VERSION = '\d+\.\d+\.\d+';",'generated runtime version marker'/,`,"const CW_VERSION = '${version}';",'generated runtime version marker'`);
  source=source.replace(/,"const CW_BUILD = '\d+\.\d+\.\d+-settings-layer-local-runtime';",'generated runtime build marker'/,`,"const CW_BUILD = '${version}-settings-layer-local-runtime';",'generated runtime build marker'`);
  return source.replace(/\?build=\d+\.\d+\.\d+'/g,`?build=${version}'`);
});
await patch('scripts/smoke-gateway-v131-base.mjs',source=>{
  source=required(source,/VERSION='\d+\.\d+\.\d+',BUILD='\d+\.\d+\.\d+-install-only-fullscreen-family-gateway'/,`VERSION='${version}',BUILD='${version}-install-only-fullscreen-family-gateway'`,'gateway smoke release constants');
  source=source.replace(/Install Civweave v\d+\.\d+\.\d+\./g,`Install Civweave v${version}.`);
  source=source.replace(/gateway root is not the v\d+\.\d+\.\d+ installer/g,`gateway root is not the v${version} installer`);
  source=source.replace(/v\d+\.\d+\.\d+ package still includes/g,`v${version} package still includes`);
  return source.replace(/campus\.includes\('\d+\.\d+\.\d+'\)/,`campus.includes('${version}')`);
});
await patch('scripts/verify-device-package-self-heal-v184.mjs',source=>source.replace(/v\d+\.\d+\.\d+/g,`v${version}`).replace(/\b\d+\.\d+\.\d+\b/g,match=>match===version?match:version));

console.log(JSON.stringify({ok:true,version,changed,hostedRoot:'installer-only',canonicalRuntime:'downloaded-package-only'},null,2));

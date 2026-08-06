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
  if(!pattern.test(source))throw new Error(`${label} was not found while synchronizing Commonweave ${version}.`);
  return source.replace(pattern,replacement);
}

await patch('public/index.html',source=>{
  source=replaceRequired(source,/<title>Install Commonweave v\d+\.\d+\.\d+<\/title>/,`<title>Install Commonweave v${version}</title>`,'installer title');
  source=replaceRequired(source,/<span class="version">v\d+\.\d+\.\d+<\/span>/,`<span class="version">v${version}</span>`,'installer version badge');
  source=replaceRequired(source,/Install Commonweave v\d+\.\d+\.\d+\. The campus downloads automatically\./,`Install Commonweave v${version}. The campus downloads automatically.`,'installer headline');
  source=source.replace(/manifest\.webmanifest\?v=\d+\.\d+\.\d+/g,`manifest.webmanifest?v=${version}`);
  source=source.replace(/\d+\.\d+\.\d+-lightweight-shell-v208/g,`${version}-lightweight-shell-v208`);
  source=source.replace(/\d+\.\d+\.\d+-offline-retry-loop-v211/g,`${version}-offline-retry-loop-v211`);
  source=source.replace(/\d+\.\d+\.\d+-required-campus-v1/g,`${version}-required-campus-v1`);
  return source;
});

await patch('public/app/manifest.webmanifest',source=>{
  const manifest=JSON.parse(source);
  manifest.name=`Commonweave v${version}`;
  const start=new URL(manifest.start_url||'/app/', 'https://commonweave.invalid');
  start.searchParams.set('version',version);
  manifest.start_url=`${start.pathname}${start.search}${start.hash}`;
  return `${JSON.stringify(manifest,null,2)}\n`;
});

await patch('public/install-v130.js',source=>replaceRequired(source,/const VERSION = '\d+\.\d+\.\d+';/,`const VERSION = '${version}';`,'installer runtime version'));
await patch('public/app/index.html',source=>replaceRequired(source,/installed-entry-v146\.js\?v=\d+\.\d+\.\d+/,`installed-entry-v146.js?v=${version}`,'stable app entry revision'));
await patch('public/app/installed-entry-v146.html',source=>replaceRequired(source,/installed-entry-v146\.js\?v=\d+\.\d+\.\d+/,`installed-entry-v146.js?v=${version}`,'installed entry revision'));
await patch('public/service-worker-core-v208.js',source=>replaceRequired(source,/const VERSION = '\d+\.\d+\.\d+';/,`const VERSION = '${version}';`,'service-worker core version'));
await patch('public/service-worker-v203.js',source=>replaceRequired(source,/service-worker-core-v208\.js\?v=\d+\.\d+\.\d+-lightweight-shell-v208-retained-v218/,`service-worker-core-v208.js?v=${version}-lightweight-shell-v208-retained-v218`,'service-worker wrapper revision'));
await patch('public/service-worker-v156.js',source=>replaceRequired(source,/service-worker-v203\.js\?v=\d+\.\d+\.\d+-lightweight-shell-v208-legacy-v156-bridge-v209/,`service-worker-v203.js?v=${version}-lightweight-shell-v208-legacy-v156-bridge-v209`,'legacy worker bridge revision'));
await patch('public/app/install-boundary-v146.js',source=>{
  source=replaceRequired(source,/const VERSION='\d+\.\d+\.\d+';/,`const VERSION='${version}';`,'install-boundary runtime version');
  source=replaceRequired(source,/const ADDITIONS_VERSION='v\d+\.\d+\.\d+-canonical-core-only-v226';/,`const ADDITIONS_VERSION='v${version}-canonical-core-only-v226';`,'install-boundary legacy additions revision');
  source=replaceRequired(source,/version:'\d+\.\d+\.\d+',allowed/,`version:'${version}',allowed`,'install-boundary release version');
  return source;
});

await patch('public/app/working-campus-v156.html',source=>{
  source=replaceRequired(source,/Commonweave Working Campus · v\d+\.\d+\.\d+/,`Commonweave Working Campus · v${version}`,'working-campus title');
  source=replaceRequired(source,/<b class="version-chip">v\d+\.\d+\.\d+<\/b>/,`<b class="version-chip">v${version}</b>`,'working-campus version chip');
  source=source.replace(/install-boundary-v146\.js\?v=\d+\.\d+\.\d+-v184/,`install-boundary-v146.js?v=${version}-v184`);
  source=source.replace(/const VERSION='\d+\.\d+\.\d+-working-campus-planner-v199';/,`const VERSION='${version}-working-campus-planner-v199';`);
  return source;
});

await patch('server-gateway-v131-base.mjs',source=>{
  source=replaceRequired(source,/const VERSION = '\d+\.\d+\.\d+';/,`const VERSION = '${version}';`,'gateway base version');
  source=replaceRequired(source,/const BUILD = '\d+\.\d+\.\d+-install-only-fullscreen-family-gateway';/,`const BUILD = '${version}-install-only-fullscreen-family-gateway';`,'gateway build version');
  source=source.replace(/Commonweave v\d+\.\d+\.\d+ fixed-settings-layer device package/g,`Commonweave v${version} fixed-settings-layer device package`);
  return source;
});

await patch('server-gateway-v131.mjs',source=>source.replace(/const VERSION = '\d+\.\d+\.\d+-render-installed-runtime-v132';/,`const VERSION = '${version}-render-installed-runtime-v132';`));
await patch('server-local-v131.mjs',source=>{
  source=source.replace(/Commonweave local v\d+\.\d+\.\d+ patch/g,`Commonweave local v${version} patch`);
  source=source.replace(/,"const VERSION = '\d+\.\d+\.\d+';",'local version marker'/,`,"const VERSION = '${version}';",'local version marker'`);
  source=source.replace(/,"const BUILD = '\d+\.\d+\.\d+-settings-layer-local-runtime';",'local build marker'/,`,"const BUILD = '${version}-settings-layer-local-runtime';",'local build marker'`);
  source=source.replace(/,"const CW_VERSION = '\d+\.\d+\.\d+';",'generated runtime version marker'/,`,"const CW_VERSION = '${version}';",'generated runtime version marker'`);
  source=source.replace(/,"const CW_BUILD = '\d+\.\d+\.\d+-settings-layer-local-runtime';",'generated runtime build marker'/,`,"const CW_BUILD = '${version}-settings-layer-local-runtime';",'generated runtime build marker'`);
  source=source.replace(/\?build=\d+\.\d+\.\d+'/g,`?build=${version}'`);
  return source;
});

await patch('scripts/smoke-gateway-v131-base.mjs',source=>{
  source=replaceRequired(source,/VERSION='\d+\.\d+\.\d+',BUILD='\d+\.\d+\.\d+-install-only-fullscreen-family-gateway'/,`VERSION='${version}',BUILD='${version}-install-only-fullscreen-family-gateway'`,'gateway smoke release constants');
  source=source.replace(/Install Commonweave v\d+\.\d+\.\d+\./g,`Install Commonweave v${version}.`);
  source=source.replace(/gateway root is not the v\d+\.\d+\.\d+ installer/g,`gateway root is not the v${version} installer`);
  source=source.replace(/v1\.0\.7 package still includes/g,`v${version} package still includes`);
  source=source.replace(/campus\.includes\('v\d+\.\d+\.\d+'\)/,`campus.includes('${version}')`);
  return source;
});

await patch('scripts/verify-device-package-self-heal-v184.mjs',source=>source.replace(/v1\.0\.7/g,`v${version}`).replace(/1\.0\.7/g,version));

console.log(JSON.stringify({ok:true,version,changed},null,2));

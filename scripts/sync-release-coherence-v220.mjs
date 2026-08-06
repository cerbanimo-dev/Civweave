import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const version=(await readFile(path.join(root,'VERSION'),'utf8')).trim();
const revision='release-coherence-v220';
const lifecycleRevision='document-lifecycle-v222';
const campusRevision='canonical-campus-startup-v223';
const boundaryRevision='canonical-campus-boundary-v223';
if(!/^\d+\.\d+\.\d+$/.test(version))throw new Error('VERSION must contain a semantic release version.');

const changed=[];
async function patch(relative,transform){
  const file=path.join(root,relative);
  const before=await readFile(file,'utf8');
  const after=transform(before);
  if(after===before)return;
  await writeFile(file,after,'utf8');
  changed.push(relative);
}
function replaceRequired(source,pattern,replacement,label){
  if(!pattern.test(source))throw new Error(`${label} was not found while applying ${revision}.`);
  return source.replace(pattern,replacement);
}
function replaceTextRequired(source,needle,replacement,label){
  if(!source.includes(needle))throw new Error(`${label} was not found while applying ${revision}.`);
  return source.replace(needle,replacement);
}

await patch('public/index.html',source=>replaceRequired(
  source,
  /revision=[A-Za-z0-9._-]+(?=['"])/,
  `revision=${revision}`,
  'installer worker registration revision'
));

await patch('public/install-v130.js',source=>replaceRequired(
  source,
  /const WORKER_SCRIPT_REVISION = '[^']+';/,
  `const WORKER_SCRIPT_REVISION = '${revision}';`,
  'installer worker revision constant'
));

await patch('public/app/installed-entry-v146.js',source=>{
  source=replaceRequired(
    source,
    /params\.get\('version'\)\|\|'\d+\.\d+\.\d+';/,
    `params.get('version')||'${version}';`,
    'installed entry fallback release version'
  );
  if(!source.includes(`revision=${revision}`))throw new Error('Installed entry does not register the release-coherent worker.');
  return source;
});

await patch('public/app/install-boundary-v146.js',source=>{
  if(!source.includes('function canonicalAppSurface()')){
    source=replaceTextRequired(
      source,
      'function allowed(){return installedDisplay()||explicitInstalled()||developer()||embedded()}',
      "function canonicalAppSurface(){const canonical=location.pathname==='/app/working-campus-v156.html';if(canonical){try{sessionStorage.setItem(BOOT_KEY,'1')}catch{}}return canonical}\nfunction allowed(){return canonicalAppSurface()||installedDisplay()||explicitInstalled()||developer()||embedded()}",
      'canonical Working Campus boundary allowance'
    );
  }
  if(!source.includes('function startAdditions()')){
    source=replaceTextRequired(
      source,
      "if(!allowed()){document.documentElement.dataset.installBoundary='blocked';location.replace(installerUrl())}else{document.documentElement.dataset.installBoundary=installedDisplay()?'installed':developer()?'developer':'embedded';installAdditions()}",
      "function startAdditions(){if(!canonicalAppSurface()){installAdditions();return}const launch=()=>installAdditions();if(document.documentElement.dataset.commonweaveCampusRuntime==='ready'){queueMicrotask(launch);return}addEventListener('commonweave:working-campus-runtime-ready',launch,{once:true})}\nif(!allowed()){document.documentElement.dataset.installBoundary='blocked';location.replace(installerUrl())}else{document.documentElement.dataset.installBoundary=canonicalAppSurface()?'canonical':installedDisplay()?'installed':developer()?'developer':'embedded';startAdditions()}",
      'canonical Working Campus delayed additions boundary'
    );
  }
  if(!source.includes(`boundaryRevision:'${boundaryRevision}'`)){
    source=replaceRequired(source,/version:'\d+\.\d+\.\d+',allowed,/,`version:'${version}',allowed,canonicalAppSurface,boundaryRevision:'${boundaryRevision}',`,'install-boundary canonical release metadata');
  }
  for(const token of ['function canonicalAppSurface()','function startAdditions()','commonweave:working-campus-runtime-ready',`boundaryRevision:'${boundaryRevision}'`])if(!source.includes(token))throw new Error(`Install boundary is missing ${token}.`);
  return source;
});

await patch('public/app/working-campus-v156.html',source=>{
  const lifecycleScript=`<script src="/app/document-lifecycle-v221.js?v=${lifecycleRevision}"></script>`;
  if(source.includes('/app/document-lifecycle-v221.js'))source=source.replace(/<script src="\/app\/document-lifecycle-v221\.js\?v=[^"]+"><\/script>/,lifecycleScript);
  else source=replaceTextRequired(source,'<script src="/app/install-boundary-v146.js',`${lifecycleScript}\n<script src="/app/install-boundary-v146.js`,'Working Campus install-boundary script');
  source=replaceRequired(source,/\/app\/working-campus-v156\.js\?v=[^"]+/,`/app/working-campus-v156.js?v=${campusRevision}`,'Working Campus runtime revision');
  return source;
});

await patch('public/service-worker-core-v208.js',source=>{
  if(!source.includes("'/app/document-lifecycle-v221.js'")){
    source=replaceTextRequired(source,"  '/app/installed-entry-v146.js',\n","  '/app/installed-entry-v146.js',\n  '/app/document-lifecycle-v221.js',\n",'service-worker required shell entry list');
  }
  if(!source.includes("event.waitUntil(cacheShell());")){
    source=replaceRequired(
      source,
      /self\.addEventListener\('install', event => \{\n  event\.waitUntil\(\(async \(\) => \{\n    await cacheShell\(\);\n    await self\.skipWaiting\(\);\n  \}\)\(\)\);\n\}\);/,
      "self.addEventListener('install', event => {\n  event.waitUntil(cacheShell());\n});",
      'service-worker non-interrupting install policy'
    );
  }
  return source;
});

await patch('public/app/pwa-update-controller-v204.js',source=>{
  for(const token of ['v222-atomic-campus-update-handoff','commonweave:working-campus-runtime-ready','activateWaiting','setTimeout(queueAutomaticCheck,45000)'])if(!source.includes(token))throw new Error(`PWA update controller is missing ${token}.`);
  return source;
});

await patch('public/app/persistent-guide-viewport-v216.js',source=>{
  if(!source.includes('document-lifecycle-v221'))source=replaceTextRequired(source,"const VERSION='1.0.8-persistent-guide-viewport-v216';","const VERSION='1.0.8-persistent-guide-viewport-v216-document-lifecycle-v221';",'persistent guide lifecycle version');
  if(!source.includes("addEventListener('pagehide',destroy,{once:true});"))source=replaceTextRequired(source,"document.readyState==='loading'?addEventListener('DOMContentLoaded',boot,{once:true}):boot();","addEventListener('pagehide',destroy,{once:true});\ndocument.readyState==='loading'?addEventListener('DOMContentLoaded',boot,{once:true}):boot();",'persistent guide teardown hook');
  source=source.replace('  document.head.append(style);','  const head=document.head;if(!head)return false;head.append(style);return true;');
  return source;
});

await patch('public/app/persistent-guide-chat-v215.js',source=>{
  source=source.replace('.cwp215-legacy-retired{display:none!important}.cwp215-working-campus-retired>.main{grid-template-columns:minmax(0,1fr)!important}.cwp215-working-campus-retired .main>.guide{display:none!important}','.cwp215-legacy-retired{display:none!important}');
  source=source.replace("  document.querySelectorAll(LEGACY_FORM_SELECTOR).forEach(form=>form.dataset.commonweaveLegacyChatRetired='v215');","  document.querySelectorAll(LEGACY_FORM_SELECTOR).forEach(form=>{if(form.id==='weaveling-chat-form'&&form.closest('.app')){delete form.dataset.commonweaveLegacyChatRetired;return}form.dataset.commonweaveLegacyChatRetired='v215'});");
  source=source.replace("  const working=document.querySelector('.main>.guide #weaveling-chat-form')?.closest('.app');\n  if(working)working.classList.add('cwp215-working-campus-retired');","  const working=document.querySelector('.main>.guide #weaveling-chat-form')?.closest('.app');\n  if(working)working.classList.remove('cwp215-working-campus-retired');");
  source=source.replace("  if(!(form instanceof HTMLFormElement)||form.closest(`#${ROOT_ID}`)||!form.matches(LEGACY_FORM_SELECTOR))return;","  if(!(form instanceof HTMLFormElement)||form.closest(`#${ROOT_ID}`)||!form.matches(LEGACY_FORM_SELECTOR)||(form.id==='weaveling-chat-form'&&form.closest('.app')))return;");
  for(const token of ["classList.remove('cwp215-working-campus-retired')","form.id==='weaveling-chat-form'&&form.closest('.app')"])if(!source.includes(token))throw new Error(`Persistent guide coexistence patch is missing ${token}.`);
  return source;
});

await patch('public/extensions/commonweave-additions-v156.js',source=>{
  source=source.replace('document.head.append(script)',"(()=>{const head=document.head;if(!head){reject(new Error('Document navigation interrupted script loading.'));return}head.append(script)})()");
  source=source.replace('document.body.append(tools)','document.body?.append(tools)');
  source=source.replace('document.body.append(dialog)','document.body?.append(dialog)');
  return source;
});

const wrapper=await readFile(path.join(root,'public/service-worker-v203.js'),'utf8');
if(!wrapper.includes(`/service-worker-release-coherence-v220.js?v=${revision}`))throw new Error('The active worker wrapper does not import the release-coherence override.');
const override=await readFile(path.join(root,'public/service-worker-release-coherence-v220.js'),'utf8');
for(const token of ['version-pinned-text-network-first-cached-fallback','V220_BOOT_PATHS','v220CachedFirst'])if(!override.includes(token))throw new Error(`Release-coherence worker is missing ${token}.`);
const lifecycle=await readFile(path.join(root,'public/app/document-lifecycle-v221.js'),'utf8');
for(const token of [lifecycleRevision,'pagehide','CommonweaveLifecycleMutationObserver'])if(!lifecycle.includes(token))throw new Error(`Document lifecycle guard is missing ${token}.`);
if(lifecycle.includes("Object.defineProperty(document,'head'")||lifecycle.includes("Object.defineProperty(document,'body'"))throw new Error('Document lifecycle guard still overrides native document structure.');
const campus=await readFile(path.join(root,'public/app/working-campus-v156.js'),'utf8');
for(const token of [campusRevision,'Promise.all(parts.map(fetchPart))','commonweave:working-campus-runtime-ready','document.documentElement===bootDocument'])if(!campus.includes(token))throw new Error(`Working Campus canonical loader is missing ${token}.`);

console.log(JSON.stringify({ok:true,version,revision,lifecycleRevision,campusRevision,boundaryRevision,changed},null,2));

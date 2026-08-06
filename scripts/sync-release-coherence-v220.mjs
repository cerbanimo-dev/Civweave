import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const version=(await readFile(path.join(root,'VERSION'),'utf8')).trim();
const revision='release-coherence-v226';
const lifecycleRevision='document-lifecycle-v222';
const campusRevision='canonical-campus-startup-v226';
const boundaryRevision='canonical-core-only-v226';
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
  source=replaceRequired(source,/params\.get\('version'\)\|\|'\d+\.\d+\.\d+';/,`params.get('version')||'${version}';`,'installed entry fallback release version');
  source=source.replace(/revision=[A-Za-z0-9._-]+(?=`;)/,`revision=${revision}`);
  if(!source.includes(`revision=${revision}`))throw new Error('Installed entry does not register the v226 release-coherent worker.');
  return source;
});

await patch('public/app/install-boundary-v146.js',source=>{
  source=replaceRequired(source,/const VERSION='[^']+';/,`const VERSION='${version}';`,'install-boundary version');
  source=replaceRequired(source,/const REVISION='[^']+';/,`const REVISION='${boundaryRevision}';`,'install-boundary revision');
  source=replaceRequired(source,/const ADDITIONS_VERSION='[^']+';/,`const ADDITIONS_VERSION='v${version}-${boundaryRevision}';`,'install-boundary additions revision');
  for(const token of [
    "location.pathname==='/app/working-campus-v156.html'",
    "root.dataset.commonweaveCanonicalCore='only'",
    "canonicalPolicy:'core-only-no-global-additions-no-redirect'",
    'canonicalAutoScripts:0'
  ])if(!source.includes(token))throw new Error(`Canonical install boundary is missing ${token}.`);
  if(source.includes('function startAdditions()'))throw new Error('Canonical boundary still contains delayed automatic additions.');
  return source;
});

await patch('public/app/working-campus-v156.html',source=>{
  const lifecycleScript=`<script src="/app/document-lifecycle-v221.js?v=${lifecycleRevision}"></script>`;
  if(source.includes('/app/document-lifecycle-v221.js'))source=source.replace(/<script src="\/app\/document-lifecycle-v221\.js\?v=[^"]+"><\/script>/,lifecycleScript);
  else source=source.replace('<script src="/app/install-boundary-v146.js',`${lifecycleScript}\n<script src="/app/install-boundary-v146.js`);
  source=replaceRequired(source,/\/app\/install-boundary-v146\.js\?v=[^"]+/,`/app/install-boundary-v146.js?v=${boundaryRevision}`,'Working Campus boundary revision');
  source=replaceRequired(source,/\/app\/working-campus-v156\.js\?v=[^"]+/,`/app/working-campus-v156.js?v=${campusRevision}`,'Working Campus loader revision');
  return source;
});

await patch('public/service-worker-core-v208.js',source=>{
  if(!source.includes("'/app/document-lifecycle-v221.js'"))source=source.replace("  '/app/installed-entry-v146.js',\n","  '/app/installed-entry-v146.js',\n  '/app/document-lifecycle-v221.js',\n");
  if(!source.includes("event.waitUntil(cacheShell());"))source=replaceRequired(
    source,
    /self\.addEventListener\('install', event => \{\n  event\.waitUntil\(\(async \(\) => \{\n    await cacheShell\(\);\n    await self\.skipWaiting\(\);\n  \}\)\(\)\);\n\}\);/,
    "self.addEventListener('install', event => {\n  event.waitUntil(cacheShell());\n});",
    'service-worker non-interrupting install policy'
  );
  return source;
});

await patch('public/app/persistent-guide-viewport-v216.js',source=>{
  if(!source.includes("addEventListener('pagehide',destroy,{once:true});"))source=source.replace("document.readyState==='loading'?addEventListener('DOMContentLoaded',boot,{once:true}):boot();","addEventListener('pagehide',destroy,{once:true});\ndocument.readyState==='loading'?addEventListener('DOMContentLoaded',boot,{once:true}):boot();");
  source=source.replace('  document.head.append(style);','  const head=document.head;if(!head)return false;head.append(style);return true;');
  return source;
});

await patch('public/app/persistent-guide-chat-v215.js',source=>{
  source=source.replace('.cwp215-legacy-retired{display:none!important}.cwp215-working-campus-retired>.main{grid-template-columns:minmax(0,1fr)!important}.cwp215-working-campus-retired .main>.guide{display:none!important}','.cwp215-legacy-retired{display:none!important}');
  source=source.replace("  document.querySelectorAll(LEGACY_FORM_SELECTOR).forEach(form=>form.dataset.commonweaveLegacyChatRetired='v215');","  document.querySelectorAll(LEGACY_FORM_SELECTOR).forEach(form=>{if(form.id==='weaveling-chat-form'&&form.closest('.app')){delete form.dataset.commonweaveLegacyChatRetired;return}form.dataset.commonweaveLegacyChatRetired='v215'});");
  source=source.replace("  const working=document.querySelector('.main>.guide #weaveling-chat-form')?.closest('.app');\n  if(working)working.classList.add('cwp215-working-campus-retired');","  const working=document.querySelector('.main>.guide #weaveling-chat-form')?.closest('.app');\n  if(working)working.classList.remove('cwp215-working-campus-retired');");
  source=source.replace("  if(!(form instanceof HTMLFormElement)||form.closest(`#${ROOT_ID}`)||!form.matches(LEGACY_FORM_SELECTOR))return;","  if(!(form instanceof HTMLFormElement)||form.closest(`#${ROOT_ID}`)||!form.matches(LEGACY_FORM_SELECTOR)||(form.id==='weaveling-chat-form'&&form.closest('.app')))return;");
  return source;
});

await patch('public/extensions/commonweave-additions-v156.js',source=>{
  if(!source.includes('let commonweaveAdditionsNavigating=false;'))source=source.replace("let readyPromise=null,activeTab='mesh',noticeTimer=null;","let readyPromise=null,activeTab='mesh',noticeTimer=null;\nlet commonweaveAdditionsNavigating=false;\naddEventListener('pagehide',()=>{commonweaveAdditionsNavigating=true},{once:true});\naddEventListener('beforeunload',()=>{commonweaveAdditionsNavigating=true},{once:true});");
  source=source.replace('document.head.append(script)',"(()=>{const head=document.head;if(commonweaveAdditionsNavigating||!head){resolve(false);return}head.append(script)})()");
  source=source.replace('document.body.append(tools)','document.body?.append(tools)');
  source=source.replace('document.body.append(dialog)','document.body?.append(dialog)');
  source=source.replace("}catch(error){console.error('[Commonweave additions]',error)}","}catch(error){if(commonweaveAdditionsNavigating||document.hidden||!document.documentElement?.isConnected)return;console.error('[Commonweave additions]',error)}");
  return source;
});

const wrapper=await readFile(path.join(root,'public/service-worker-v203.js'),'utf8');
if(!wrapper.includes(`/service-worker-release-coherence-v220.js?v=${revision}`))throw new Error('The active worker wrapper does not import release coherence v226.');
const override=await readFile(path.join(root,'public/service-worker-release-coherence-v220.js'),'utf8');
for(const token of [revision,'|txt','working-campus-v156.part5.txt','version-pinned-html-js-css-json-txt-network-first-cached-fallback'])if(!override.includes(token))throw new Error(`Release-coherence worker is missing ${token}.`);
const campus=await readFile(path.join(root,'public/app/working-campus-v156.js'),'utf8');
for(const token of [campusRevision,'Promise.all(parts.map(fetchPart))','commonweave:working-campus-runtime-ready',"policy:'canonical-core-only'"])if(!campus.includes(token))throw new Error(`Working Campus canonical loader is missing ${token}.`);

console.log(JSON.stringify({ok:true,version,revision,lifecycleRevision,campusRevision,boundaryRevision,changed},null,2));

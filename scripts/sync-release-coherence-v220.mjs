import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const version=(await readFile(path.join(root,'VERSION'),'utf8')).trim();
const revision='release-coherence-v220';
const lifecycleRevision='document-lifecycle-v221';
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

await patch('public/install-v130.js',source=>{
  source=replaceRequired(
    source,
    /const WORKER_SCRIPT_REVISION = '[^']+';/,
    `const WORKER_SCRIPT_REVISION = '${revision}';`,
    'installer worker revision constant'
  );
  return source;
});

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

await patch('public/app/working-campus-v156.html',source=>{
  const script=`<script src="/app/document-lifecycle-v221.js?v=${lifecycleRevision}"></script>\n`;
  if(!source.includes('/app/document-lifecycle-v221.js')){
    source=replaceTextRequired(source,'<script src="/app/install-boundary-v146.js',`${script}<script src="/app/install-boundary-v146.js`,'Working Campus install-boundary script');
  }
  return source;
});

await patch('public/service-worker-core-v208.js',source=>{
  if(source.includes("'/app/document-lifecycle-v221.js'"))return source;
  return replaceTextRequired(
    source,
    "  '/app/installed-entry-v146.js',\n",
    "  '/app/installed-entry-v146.js',\n  '/app/document-lifecycle-v221.js',\n",
    'service-worker required shell entry list'
  );
});

await patch('public/app/pwa-update-controller-v204.js',source=>{
  if(!source.includes('campus-document-lifecycle-v221')){
    source=replaceTextRequired(source,"const VERSION='v207-registration-watchdog';", "const VERSION='v207-registration-watchdog-campus-document-lifecycle-v221';",'PWA update lifecycle version');
  }
  if(!source.includes('if(!document.documentElement?.isConnected||!document.head||!document.body)return null;')){
    source=replaceTextRequired(source,'function mount(){\n  installStyles();','function mount(){\n  if(!document.documentElement?.isConnected||!document.head||!document.body)return null;\n  installStyles();','PWA update mount guard');
  }
  if(!source.includes("addEventListener('pagehide',()=>{observer?.disconnect();button=null;},{once:true});")){
    source=replaceTextRequired(source,"if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();", "addEventListener('pagehide',()=>{observer?.disconnect();button=null;},{once:true});\nif(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();",'PWA update teardown hook');
  }
  return source;
});

await patch('public/app/persistent-guide-viewport-v216.js',source=>{
  if(!source.includes('document-lifecycle-v221')){
    source=replaceTextRequired(source,"const VERSION='1.0.8-persistent-guide-viewport-v216';", "const VERSION='1.0.8-persistent-guide-viewport-v216-document-lifecycle-v221';",'persistent guide lifecycle version');
  }
  if(!source.includes("addEventListener('pagehide',destroy,{once:true});")){
    source=replaceTextRequired(source,"document.readyState==='loading'?addEventListener('DOMContentLoaded',boot,{once:true}):boot();", "addEventListener('pagehide',destroy,{once:true});\ndocument.readyState==='loading'?addEventListener('DOMContentLoaded',boot,{once:true}):boot();",'persistent guide teardown hook');
  }
  source=source.replace('  document.head.append(style);','  const head=document.head;if(!head)return false;head.append(style);return true;');
  return source;
});

await patch('public/extensions/commonweave-additions-v156.js',source=>{
  source=source.replace('document.head.append(script)',"(()=>{const head=document.head;if(!head){reject(new Error('Document navigation interrupted script loading.'));return}head.append(script)})()");
  source=source.replace('document.body.append(tools)','document.body?.append(tools)');
  source=source.replace('document.body.append(dialog)','document.body?.append(dialog)');
  return source;
});

const wrapper=await readFile(path.join(root,'public/service-worker-v203.js'),'utf8');
if(!wrapper.includes(`/service-worker-release-coherence-v220.js?v=${revision}`)){
  throw new Error('The active worker wrapper does not import the release-coherence override.');
}
const override=await readFile(path.join(root,'public/service-worker-release-coherence-v220.js'),'utf8');
for(const token of ['version-pinned-text-network-first-cached-fallback','V220_BOOT_PATHS','v220CachedFirst']){
  if(!override.includes(token))throw new Error(`Release-coherence worker is missing ${token}.`);
}
const lifecycle=await readFile(path.join(root,'public/app/document-lifecycle-v221.js'),'utf8');
for(const token of ['document-lifecycle-v221','pagehide','CommonweaveLifecycleMutationObserver']){
  if(!lifecycle.includes(token))throw new Error(`Document lifecycle guard is missing ${token}.`);
}

console.log(JSON.stringify({ok:true,version,revision,lifecycleRevision,changed},null,2));

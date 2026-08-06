import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const version=(await readFile(path.join(root,'VERSION'),'utf8')).trim();
const revision='release-coherence-v220';
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

const wrapper=await readFile(path.join(root,'public/service-worker-v203.js'),'utf8');
if(!wrapper.includes(`/service-worker-release-coherence-v220.js?v=${revision}`)){
  throw new Error('The active worker wrapper does not import the release-coherence override.');
}
const override=await readFile(path.join(root,'public/service-worker-release-coherence-v220.js'),'utf8');
for(const token of ['version-pinned-text-network-first-cached-fallback','V220_BOOT_PATHS','v220CachedFirst']){
  if(!override.includes(token))throw new Error(`Release-coherence worker is missing ${token}.`);
}

console.log(JSON.stringify({ok:true,version,revision,changed},null,2));

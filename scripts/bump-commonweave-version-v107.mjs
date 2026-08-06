import {execFileSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';

const OLD_VERSION='1.0.6';
const NEW_VERSION='1.0.7';
const SELF=new Set([
  'scripts/bump-commonweave-version-v107.mjs',
  '.github/workflows/bump-commonweave-version-v107.yml'
]);

const output=execFileSync('git',['grep','-Ilz','--fixed-strings',OLD_VERSION,'--','.'],{encoding:'utf8'});
const files=output.split('\0').map(value=>value.trim()).filter(Boolean).filter(file=>!SELF.has(file));
if(!files.length)throw new Error(`No tracked ${OLD_VERSION} references were found.`);

let replacements=0;
for(const file of files){
  const before=await readFile(file,'utf8');
  const count=before.split(OLD_VERSION).length-1;
  if(!count)continue;
  await writeFile(file,before.split(OLD_VERSION).join(NEW_VERSION),'utf8');
  replacements+=count;
}
await writeFile('VERSION',`${NEW_VERSION}\n`,'utf8');

const packageJson=JSON.parse(await readFile('package.json','utf8'));
if(packageJson.version!==NEW_VERSION)throw new Error(`package.json stayed at ${packageJson.version}.`);
const manifest=JSON.parse(await readFile('public/app/manifest.webmanifest','utf8'));
if(!manifest.name.includes(`v${NEW_VERSION}`)||!manifest.start_url.includes(`version=${NEW_VERSION}`))throw new Error('PWA manifest version markers did not advance.');
const offline=JSON.parse(await readFile('public/app/offline-package-v208.json','utf8'));
if(offline.version!==NEW_VERSION)throw new Error('Offline package version did not advance.');
const worker=await readFile('public/service-worker-core-v208.js','utf8');
if(!worker.includes(`const VERSION = '${NEW_VERSION}'`))throw new Error('Service-worker cache version did not advance.');
const installer=await readFile('public/install-v130.js','utf8');
if(!installer.includes(`const VERSION = '${NEW_VERSION}'`))throw new Error('Installer version did not advance.');

console.log(JSON.stringify({ok:true,from:OLD_VERSION,to:NEW_VERSION,files:files.length,replacements},null,2));

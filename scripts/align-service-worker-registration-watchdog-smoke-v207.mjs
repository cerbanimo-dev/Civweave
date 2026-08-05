import fs from 'node:fs/promises';

const path='scripts/smoke-service-worker-registration-watchdog-v207.mjs';
let source=await fs.readFile(path,'utf8');
const replacements=[
  ["  'withTimeout(navigator.serviceWorker.register(',","  'navigator.serviceWorker.register(WORKER_URL',",'registration'],
  ["  'withTimeout(registration.update()',","  'registration.update()',",'update'],
  ["  'withTimeout(navigator.serviceWorker.ready',","  'navigator.serviceWorker.ready',",'readiness'],
];
let changed=false;
for(const [before,after,label] of replacements){
  if(source.includes(after))continue;
  if(!source.includes(before))throw new Error(`Could not find the multiline ${label} assertion.`);
  source=source.replace(before,after);
  changed=true;
}
if(changed){
  await fs.writeFile(path,source,'utf8');
  console.log('Aligned watchdog smoke assertions with multiline browser operations.');
}else{
  console.log('Watchdog smoke assertions already aligned.');
}

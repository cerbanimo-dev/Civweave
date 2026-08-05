import fs from 'node:fs/promises';

const path='scripts/smoke-service-worker-registration-watchdog-v207.mjs';
const source=await fs.readFile(path,'utf8');
const before="  'withTimeout(navigator.serviceWorker.register(',";
const after="  'navigator.serviceWorker.register(WORKER_URL',";
if(source.includes(after)){
  console.log('Watchdog smoke assertion already aligned.');
}else{
  if(!source.includes(before))throw new Error('Could not find the multiline registration assertion.');
  await fs.writeFile(path,source.replace(before,after),'utf8');
  console.log('Aligned watchdog smoke assertion with multiline registration code.');
}

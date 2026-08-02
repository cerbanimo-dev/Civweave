import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const encoded=(await Promise.all([1,2,3,4].map(part=>fs.readFile(path.join(root,`public/app/shared/commonweave-parity-ledger.part${part}.b64`),'utf8')))).join('').replace(/\s+/g,'');
const ledger=JSON.parse(gunzipSync(Buffer.from(encoded.trim(),'base64')).toString('utf8'));
const errors=[];const systemIds=new Set();const roomIds=new Set();const capabilityIds=new Set();
for(const system of ledger.systems||[]){
  if(systemIds.has(system.id))errors.push(`duplicate system: ${system.id}`);systemIds.add(system.id);
  if(!system.visualEntry||!system.liteEntry)errors.push(`renderer entry missing: ${system.id}`);
  for(const room of system.rooms||[]){
    const key=`${system.id}:${room.id}`;if(roomIds.has(key))errors.push(`duplicate room: ${key}`);roomIds.add(key);
    if(!room.visualAsset)errors.push(`visual asset missing: ${key}`);
    else {const local=path.join(root,'public',room.visualAsset.replace(/^\/app\//,'app/'));try{await fs.access(local)}catch{errors.push(`visual asset not found: ${room.visualAsset}`)}}
    if(!room.liteRoute)errors.push(`lite route missing: ${key}`);
  }
}
for(const capability of ledger.capabilities||[]){
  if(capabilityIds.has(capability.id))errors.push(`duplicate capability: ${capability.id}`);capabilityIds.add(capability.id);
  if(!systemIds.has(capability.system))errors.push(`unknown system: ${capability.id}`);
  if(!roomIds.has(`${capability.system}:${capability.room}`))errors.push(`unknown room: ${capability.id}`);
  if(!capability.visual?.status||!capability.visual?.surface)errors.push(`visual mapping incomplete: ${capability.id}`);
  if(!capability.lite?.status||!capability.lite?.route)errors.push(`lite mapping incomplete: ${capability.id}`);
  if(!['automatic','review','explicit'].includes(capability.consent))errors.push(`invalid consent: ${capability.id}`);
}
for(const id of ledger.journey||[])if(!capabilityIds.has(id))errors.push(`journey capability missing: ${id}`);
if(errors.length){console.error(errors.join('\n'));process.exit(1)}
console.log(JSON.stringify({ok:true,schema:ledger.schema,version:ledger.version,systems:systemIds.size,rooms:roomIds.size,capabilities:capabilityIds.size,journeySteps:ledger.journey.length},null,2));

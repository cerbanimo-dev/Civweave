import fs from 'node:fs/promises';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const shared=path.join(root,'public/app/shared');
const encoded=(await Promise.all([1,2,3,4].map(part=>fs.readFile(path.join(shared,`civweave-parity-ledger.part${part}.b64`),'utf8')))).join('').replace(/\s+/g,'');
const ledger=JSON.parse(gunzipSync(Buffer.from(encoded,'base64')).toString('utf8'));
const shells=JSON.parse(await fs.readFile(path.join(shared,'cabinet-shells-v129.json'),'utf8'));
ledger.version=shells.version;
for(const system of ledger.systems||[])if(shells.systems?.[system.id])system.interfaceShell=shells.systems[system.id];
const errors=[];const systemIds=new Set();const roomIds=new Set();const capabilityIds=new Set();
const localPath=url=>path.join(root,'public',String(url||'').replace(/^\//,''));
async function exists(url,label){try{await fs.access(localPath(url));return true}catch{errors.push(`${label} not found ${url}`);return false}}
for(const system of ledger.systems||[]){
  if(systemIds.has(system.id))errors.push(`duplicate system ${system.id}`);
  systemIds.add(system.id);
  const shell=system.interfaceShell||{};
  if(!shell.asset)errors.push(`missing direct cabinet asset ${system.id}`);
  else if(await exists(shell.asset,'cabinet asset')){
    const header=await fs.readFile(localPath(shell.asset)).then(buffer=>buffer.subarray(0,12));
    if(header.toString('ascii',0,4)!=='RIFF'||header.toString('ascii',8,12)!=='WEBP')errors.push(`invalid cabinet WebP ${system.id}`);
  }
  if(shell.assetParts?.length)errors.push(`legacy cabinet assetParts still active ${system.id}`);
  if(!shell.screen)errors.push(`missing cabinet screen ${system.id}`);
  for(const room of system.rooms||[]){
    const key=`${system.id}:${room.id}`;
    if(roomIds.has(key))errors.push(`duplicate room ${key}`);
    roomIds.add(key);
    if(!room.visualAsset)errors.push(`missing visual asset ${key}`);else await exists(room.visualAsset,'room asset');
    if(!room.liteRoute)errors.push(`missing lite route ${key}`);
  }
}
for(const capability of ledger.capabilities||[]){
  if(capabilityIds.has(capability.id))errors.push(`duplicate capability ${capability.id}`);
  capabilityIds.add(capability.id);
  if(!systemIds.has(capability.system))errors.push(`unknown system ${capability.id}`);
  if(!roomIds.has(`${capability.system}:${capability.room}`))errors.push(`unknown room ${capability.id}`);
  if(!capability.visual?.status||!capability.lite?.status)errors.push(`renderer mapping missing ${capability.id}`);
  if(!['automatic','review','explicit'].includes(capability.consent))errors.push(`invalid consent ${capability.id}`);
}
for(const id of ledger.journey||[])if(!capabilityIds.has(id))errors.push(`journey capability missing ${id}`);
if(errors.length){console.error(JSON.stringify({ok:false,errors},null,2));process.exit(1)}
console.log(JSON.stringify({ok:true,schema:ledger.schema,version:ledger.version,systems:systemIds.size,rooms:roomIds.size,capabilities:capabilityIds.size,journeySteps:(ledger.journey||[]).length,cabinetAssets:Object.keys(shells.systems||{}).length},null,2));

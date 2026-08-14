import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};

const [mesh,architecture]=await Promise.all([
  read('public/app/local-object-mesh-v146.js'),
  read('docs/contracts/install-only-local-mesh-architecture.md')
]);

for(const token of [
  "const PROTOCOL='civweave.foreground-phone-mesh.v1'",
  'const DB_VERSION=2',
  "db.createObjectStore('incoming'",
  "db.createObjectStore('acks'",
  "db.createObjectStore('transit'",
  "db.createObjectStore('priorities'",
  "type:'manifest'",
  "type:'want'",
  "type:'chunk'",
  'serializedHash',
  'bufferedAmountLowThreshold',
  'resumableChunks:true',
  'priorities:true',
  'storeForwardPublic:true',
  'directRelay:false',
  'sleepingPhones:false',
  'nativeCompanion:false',
  'wifiDirect:false',
  'object is outside this device audience',
  "session.peerProtocol=message.protocol||'legacy'",
  "type:'objects',items"
])assert(mesh.includes(token),`Foreground mesh missing ${token}.`);

assert(!mesh.includes('hopLimit:object.hopLimit-1'),'Foreground mesh mutates signed hopLimit.');
assert(!mesh.includes('object.hopLimit--'),'Foreground mesh mutates signed hopLimit.');
assert(mesh.includes("const mayRelay=object=>object.consent==='public'||object.consent==='federated'"),'Relay policy must be public/federated only.');

for(const phrase of [
  'no Android core, native companion, Wi-Fi Direct dependency, or always-on daemon in v1',
  'Sleeping-phone/background delivery is a later transport problem',
  'Signed object fields are immutable in transit',
  'Direct and group payloads are endpoint-only in v1',
  'Sleeping phones later'
])assert(architecture.includes(phrase),`Architecture contract missing ${phrase}.`);

console.log(JSON.stringify({
  ok:true,
  protocol:'civweave.foreground-phone-mesh.v1',
  foregroundOnly:true,
  nativeCompanion:false,
  wifiDirect:false,
  sleepingPhones:false
},null,2));

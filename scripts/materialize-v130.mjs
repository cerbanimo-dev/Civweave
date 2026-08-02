import fs from 'node:fs/promises';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const partDir=path.join(root,'.commonweave','v130-bundle');
const names=Array.from({length:6},(_,index)=>`v130-bundle.part${index+1}.b64`);
const encoded=(await Promise.all(names.map(name=>fs.readFile(path.join(partDir,name),'utf8')))).join('').replace(/\s+/g,'');
const payload=JSON.parse(gunzipSync(Buffer.from(encoded,'base64')).toString('utf8'));
let count=0;
for(const [relative,record] of Object.entries(payload)){
  const target=path.join(root,relative);
  await fs.mkdir(path.dirname(target),{recursive:true});
  const content=record.encoding==='base64'?Buffer.from(record.content,'base64'):record.content;
  await fs.writeFile(target,content);
  count+=1;
}
console.log(JSON.stringify({ok:true,materialized:count,version:'1.0.30'},null,2));

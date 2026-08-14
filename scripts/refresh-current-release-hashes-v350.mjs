import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const version=(await fs.readFile(path.join(root,'VERSION'),'utf8')).trim();
const releaseRoot=path.join(root,'releases',version);
const manifestPath=path.join(releaseRoot,'release.json');
const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
if(manifest.version!==version||manifest.schema!=='civweave.canonical-release.v1')throw new Error('Current release manifest mismatch.');
const serverRoot=path.join(releaseRoot,'server');
const sha256={};
for(const name of (await fs.readdir(serverRoot)).filter(name=>name.endsWith('.mjs')).sort()){
  const bytes=await fs.readFile(path.join(serverRoot,name));
  sha256[`server/${name}`]=crypto.createHash('sha256').update(bytes).digest('hex');
}
manifest.sha256=sha256;
await fs.writeFile(manifestPath,`${JSON.stringify(manifest,null,2)}\n`,'utf8');
console.log(JSON.stringify({ok:true,version,hashes:Object.keys(sha256).length,revision:'refresh-current-release-hashes-v350'},null,2));

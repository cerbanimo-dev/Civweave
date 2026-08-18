import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const publicDir=path.join(root,'public');
const manifestPath=path.join(publicDir,'app','manifest.webmanifest');
const installManifestPath=path.join(publicDir,'app','manifest-v436.webmanifest');
const integrityPath=path.join(publicDir,'app','shell-integrity-v281.json');
const startPath='/app/pwa-start-v436.html';
const startUrl=`${startPath}?installed=1`;

const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
manifest.start_url=startUrl;
if(Array.isArray(manifest.shortcuts)){
  for(const shortcut of manifest.shortcuts){
    let system='';
    try{system=new URL(shortcut.url||'', 'https://civweave.invalid').searchParams.get('system')||''}catch{}
    const target=new URL(startPath,'https://civweave.invalid');
    target.searchParams.set('installed','1');
    if(system)target.searchParams.set('system',system);
    shortcut.url=`${target.pathname}${target.search}`;
  }
}
if(Array.isArray(manifest.related_applications)){
  for(const related of manifest.related_applications){
    if(related?.platform!=='webapp'||typeof related.url!=='string')continue;
    try{
      const url=new URL(related.url);
      if(url.pathname==='/app/manifest.webmanifest')url.pathname='/app/manifest-v436.webmanifest';
      related.url=url.href;
    }catch{}
  }
}
const manifestBytes=Buffer.from(`${JSON.stringify(manifest,null,2)}\n`,'utf8');
// Keep the canonical path correct for existing installations, but give new
// Android/WebAPK installs a cache-distinct manifest URL so an old browser/CDN
// response cannot silently preserve the retired launch target across reinstall.
await Promise.all([
  fs.writeFile(manifestPath,manifestBytes),
  fs.writeFile(installManifestPath,manifestBytes)
]);

const integrity=JSON.parse(await fs.readFile(integrityPath,'utf8'));
integrity.assets=integrity.assets&&typeof integrity.assets==='object'?integrity.assets:{};
integrity.assets['/app/manifest.webmanifest']=crypto.createHash('sha256').update(manifestBytes).digest('hex');
const startBytes=await fs.readFile(path.join(publicDir,startPath.replace(/^\/+/,'')));
integrity.assets[startPath]=crypto.createHash('sha256').update(startBytes).digest('hex');
integrity.requiredAssetCount=Object.keys(integrity.assets).length;
await fs.writeFile(integrityPath,`${JSON.stringify(integrity,null,2)}\n`,'utf8');

console.log(JSON.stringify({
  ok:true,
  revision:'pwa-start-v436-cache-distinct-manifest',
  startUrl:manifest.start_url,
  installManifest:'/app/manifest-v436.webmanifest',
  shortcuts:(manifest.shortcuts||[]).map(shortcut=>shortcut.url),
  integrityManifestHash:integrity.assets['/app/manifest.webmanifest'],
  integrityStartHash:integrity.assets[startPath]
},null,2));

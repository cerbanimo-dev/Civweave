import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const version=(await read('VERSION')).trim();
if(!/^\d+\.\d+\.\d+$/.test(version))throw new Error(`Invalid VERSION: ${version}`);

const [pkgText,manifestText,campusHtml,routes,core]=await Promise.all([
  read('package.json'),
  read('public/app/manifest.webmanifest'),
  read('public/app/working-campus-v156.html'),
  read('public/app/system-routes-v227.js'),
  read('public/service-worker-core-v208.js')
]);
const pkg=JSON.parse(pkgText),manifest=JSON.parse(manifestText);
const requireToken=(source,token,label)=>{if(!source.includes(token))throw new Error(`${label} is not synchronized to ${version}: missing ${token}`)};
if(pkg.version!==version)throw new Error(`package.json version ${pkg.version} != VERSION ${version}`);
if(!String(manifest.name||'').includes(version))throw new Error(`manifest name is not synchronized to ${version}`);
requireToken(campusHtml,`Civweave Working Campus · v${version}`,'Working Campus title');
requireToken(campusHtml,`<b class="version-chip">v${version}</b>`,'Working Campus version chip');
requireToken(routes,`const VERSION='${version}';`,'Five-system route contract');
requireToken(core,`const VERSION='${version}';`,'Service-worker core');

console.log(JSON.stringify({ok:true,version,mode:'assert-only',mutatesCheckout:false},null,2));

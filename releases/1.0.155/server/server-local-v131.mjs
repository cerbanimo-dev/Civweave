import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const rootDir=path.dirname(fileURLToPath(import.meta.url));
const sourcePath=path.join(rootDir,'server-v130.mjs');
const runtimePath=path.join(rootDir,'.civweave-server-local-v131.entry.mjs');
let source=(await fsp.readFile(sourcePath,'utf8')).replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');
function replaceRequired(before,after,label){if(!source.includes(before))throw new Error(`Civweave local v1.0.155 patch could not find ${label}`);source=source.replace(before,after)}
replaceRequired("const VERSION = '1.0.30';","const VERSION = '1.0.155';",'local version marker');
replaceRequired("const BUILD = '1.0.30-offline-mesh-cabinet-runtime';","const BUILD = '1.0.155-settings-layer-local-runtime';",'local build marker');
replaceRequired("const CW_VERSION = '1.0.30';","const CW_VERSION = '1.0.155';",'generated runtime version marker');
replaceRequired("const CW_BUILD = '1.0.30-offline-mesh-cabinet-runtime';","const CW_BUILD = '1.0.155-settings-layer-local-runtime';",'generated runtime build marker');
replaceRequired("const citizenConsoleAssets = new Set([\n      '/app/anarchadia-console-v139.html',","const citizenConsoleAssets = new Set([\n      '/app/installed-entry-v146.html',\n      '/app/fullscreen-family-v104.html',\n      '/app/realm-console-v140.html',\n      '/app/cabinets/living-school/index.html',\n      '/app/fellowfare-cabinet-v144.html',\n      '/app/anarchadia-console-v139.html',\n      '/app/cabinet-mode-v142.html',\n      '/app/cabinet-only-v144.html',\n      '/app/cabinet-calibrator-v144.html',\n      '/app/cabinet-visual-v141.html',",'software family HTML allowlist');
replaceRequired("      if (!isAsset) { cwLog('legacy-route-redirected', {requestId,from:originalPathname,to:'/loom/'}, req); res.writeHead(302,{location:'/loom/','cache-control':'no-store','x-civweave-version':CW_VERSION,'x-civweave-build':CW_BUILD}); return res.end(); }","      const isInstallerSurface = originalPathname === '/app/index.html';\n      if (!isAsset && !isInstallerSurface) { cwLog('legacy-route-redirected', {requestId,from:originalPathname,to:'/loom/'}, req); res.writeHead(302,{location:'/loom/','cache-control':'no-store','x-civweave-version':CW_VERSION,'x-civweave-build':CW_BUILD}); return res.end(); }",'installer server exception');
await fsp.writeFile(runtimePath,source,'utf8');
try{await import(pathToFileURL(runtimePath).href+'?build=1.0.155')}finally{setTimeout(()=>fsp.unlink(runtimePath).catch(()=>{}),1000).unref?.()}

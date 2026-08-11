import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.join(scriptsDir, 'smoke-gateway-v131-base.mjs');
const runtimePath = path.join(scriptsDir, '.smoke-gateway-v132.runtime.mjs');
const VERSION = 'render-installed-runtime-v132';
const rootStart = "  const rootResponse=await fetch(`${origin}/`,{cache:'no-store'}),rootHtml=await rootResponse.text();";
const routeStart = "  for(const route of ['/loom/'";
const rootReplacement = `  const rootResponse=await fetch(\`${'${origin}'}/\`,{cache:'no-store'}),rootHtml=await rootResponse.text();
  assert(rootResponse.ok,'gateway launcher root failed');
  assert(rootHtml.includes('<title>Civweave</title>'),'gateway root is not the Civweave launcher');
  assert(rootHtml.includes('/app/installed-entry-v146.js?v='),'gateway root does not load the installed-entry router');
  assert(rootHtml.includes("new URL('/app/index.html'"),'gateway root does not route install-required sessions to the installer');
  const installerResponse=await fetch(\`${'${origin}'}/app/index.html\`,{cache:'no-store'}),installerHtml=await installerResponse.text();
  assert(installerResponse.ok,'gateway installer route failed');
  assert(installerHtml.includes(\`<title>Install Civweave v${'${VERSION}'}</title>\`),\`gateway installer is not Civweave v${'${VERSION}'}\`);
  assert(installerHtml.includes('Download offline files only when you choose.'),'gateway installer does not preserve the manual-first campus boundary');
  assert(installerHtml.includes('No native modal'),'gateway installer does not describe the fixed settings layer');
  assert(installerHtml.includes('/app/logos/civweave.svg'),'gateway installer does not use the Civweave logo');`;
const before = "  for(const route of ['/loom/','/lite/','/app/realm-console-v140.html','/app/fullscreen-family-v104.html','/app/cabinet-mode-v142.html']){const response=await fetch(origin+route,{cache:'no-store'}),body=await response.json();assert(response.status===410,`${route} returned ${response.status}, expected 410`);assert(body.localInstallRequired===true,`${route} does not explain installation`)}";
const after = "  for(const route of ['/loom/','/lite/']){const response=await fetch(origin+route,{cache:'no-store'}),body=await response.json();assert(response.status===410,`${route} returned ${response.status}, expected 410`);assert(body.localInstallRequired===true,`${route} does not explain installation`)}\n  for(const route of ['/app/','/app/index.html','/app/working-campus-v156.html','/app/realm-console-v140.html','/app/fullscreen-family-v104.html','/app/cabinet-mode-v142.html']){const response=await fetch(origin+route,{cache:'no-store'});assert(response.ok,`${route} returned ${response.status}, expected a public installed-runtime asset`);const type=String(response.headers.get('content-type')||'');assert(/text\\/html/i.test(type),`${route} returned unexpected content type ${type}`)}";

let source = (await fsp.readFile(sourcePath, 'utf8')).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
const rootIndex = source.indexOf(rootStart);
const routeIndex = source.indexOf(routeStart, rootIndex + rootStart.length);
if (rootIndex < 0 || routeIndex < 0) {
  throw new Error('Civweave gateway smoke v132 could not find the base root assertion.');
}
source = `${source.slice(0, rootIndex)}${rootReplacement}\n${source.slice(routeIndex)}`;
if (!source.includes(before)) {
  throw new Error('Civweave gateway smoke v132 could not find the legacy 410 assertion.');
}
source = source.replace(before, after);
source = source.replace(/campus\.includes\('\d+\.\d+\.\d+'\)/,"campus.includes(VERSION)");
await fsp.writeFile(runtimePath, source, 'utf8');
try {
  await import(`${pathToFileURL(runtimePath).href}?build=${encodeURIComponent(VERSION)}`);
} finally {
  await fsp.unlink(runtimePath).catch(() => {});
}

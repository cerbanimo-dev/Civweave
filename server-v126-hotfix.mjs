import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.join(root, 'server-v126.mjs');
const runtimePath = path.join(root, '.commonweave-server-v126-hotfix.runtime.mjs');
const HOTFIX_BUILD = '1.0.26-loop-diagnostics-hotfix-1';
let source = await fsp.readFile(sourcePath, 'utf8');
source = source.replaceAll('1.0.26-loop-diagnostics', HOTFIX_BUILD);

function replaceRequired(before, after, label) {
  if (!source.includes(before)) throw new Error(`Commonweave v1.0.26 hotfix could not find ${label}`);
  source = source.replace(before, after);
}

replaceRequired(
  "function cwBootLog(kind, detail = {}, req = null) {",
  "function cwBootLog(kind, detail = {}, req = null) {\n  if (kind === 'http-request') {\n    const pathname = String(detail?.originalPathname || '');\n    const critical = pathname === '/campus/' || pathname === '/campus/index.html' || pathname === '/app/' || pathname === '/app/index.html' || pathname === '/recover.html' || pathname === '/diagnostics.html' || pathname.startsWith('/api/boot-log') || /(?:service-worker|host-node-setup|host-node-v126|boot-diagnostics|version\\.json)/.test(pathname);\n    if (!critical) return null;\n  }",
  'the boot-log function'
);

replaceRequired(
  "text = text.replace('setTimeout(()=>location.reload(),900)', 'window.CommonweaveBootLog?.log(\"legacy-reload-suppressed\",{reason:\"manual-update-candidate\"})');",
  "text = text.replace('setTimeout(()=>location.reload(),900)', 'window.CommonweaveBootLog?.log(\"legacy-reload-suppressed\",{reason:\"manual-update-candidate\"})');\n    text = text.replace(\"navigator.serviceWorker?.addEventListener('controllerchange',()=>location.reload());\", \"navigator.serviceWorker?.addEventListener('controllerchange',()=>window.CommonweaveBootLog?.log('controllerchange-observed-no-reload',{controller:navigator.serviceWorker.controller?.scriptURL||null}));\");",
  'the runtime reload suppression point'
);

await fsp.writeFile(runtimePath, source, 'utf8');
try {
  await import(pathToFileURL(runtimePath).href + '?hotfix=1');
} finally {
  setTimeout(() => fsp.unlink(runtimePath).catch(() => {}), 1000).unref?.();
}

import fs from 'node:fs/promises';

const path = 'public/index.html';
let source = await fs.readFile(path, 'utf8');
const marker = '<script src="/app/knowledge-school-seeds-v1.js?v=knowledge-schools-v2"></script>';
const bootstrap = `<script>\n(() => {\n  if (!('serviceWorker' in navigator)) return;\n  navigator.serviceWorker.register(\n    '/service-worker-v203.js?v=1.0.6-lightweight-shell-v208&revision=stable-entry-v216',\n    { scope: '/', updateViaCache: 'none' }\n  ).catch(() => {});\n})();\n</script>\n`;
if (!source.includes(marker)) throw new Error('Installer script marker is missing.');
if (!source.includes('revision=stable-entry-v216')) source = source.replace(marker, bootstrap + marker);
await fs.writeFile(path, source);
console.log('Added the stable worker bootstrap to the network-loaded installer page.');

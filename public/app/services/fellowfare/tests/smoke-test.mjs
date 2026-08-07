import { access, readFile, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const required = ['index.html','styles.css','app.js','ai.js','ledger.js','sw.js','CIVWEAVE_BRIDGE.md','schemas/civweave-exchange-bundle.schema.json','manifest.webmanifest','../../logos/fellowfare-wordmark.png','../../logos/fellowfare.png','assets/icons/icon-192.png','assets/icons/icon-512.png','assets/icons/icon-maskable-512.png'];
for (const file of required) await access(join(root, file));

const bridgeSchema = JSON.parse(await readFile(join(root,'schemas/civweave-exchange-bundle.schema.json'),'utf8'));
if (bridgeSchema.properties?.format?.const !== 'civweave.exchange-bundle') throw new Error('Bridge schema format marker missing');

const manifest = JSON.parse(await readFile(join(root,'manifest.webmanifest'),'utf8'));
if (manifest.display !== 'standalone') throw new Error('Manifest must use standalone display');
if (!manifest.icons.some((icon) => icon.sizes === '512x512' && icon.purpose?.includes('maskable'))) throw new Error('Missing 512px maskable icon');
for (const icon of manifest.icons) await access(join(root, icon.src));

const html = await readFile(join(root,'index.html'),'utf8');
for (const id of ['main','composerDialog','detailDialog','proposalDialog','messageDialog','importDialog','aiSettingsDialog','ledgerActionDialog']) {
  if (!html.includes(`id="${id}"`)) throw new Error(`Missing required UI element: ${id}`);
}
const app = await readFile(join(root,'app.js'),'utf8');
for (const feature of ['submitThread','submitProposal','renderAssemblies','renderInbox','openAgreement','submitLedgerAction','exportCivweaveBundle','renderLoom','runLoomAction','exportPack','importPack','registerServiceWorker']) {
  if (!app.includes(`function ${feature}`)) throw new Error(`Missing product flow: ${feature}`);
}
if (!app.includes('delete ai.apiKey')) throw new Error('Exported packs must strip remembered AI secrets');
const sw = await readFile(join(root,'sw.js'),'utf8');
if (!sw.includes('./ai.js')) throw new Error('AI module missing from offline shell');
if (!sw.includes('./ledger.js')) throw new Error('Ledger module missing from offline shell');
if (!sw.includes("self.addEventListener('fetch'")) throw new Error('Service worker fetch handler missing');

const logo = await stat(join(root,'../../logos/fellowfare-wordmark.png'));
if (logo.size < 10000) throw new Error('Brand asset appears incomplete');
console.log('Fellowfare static smoke test passed.');

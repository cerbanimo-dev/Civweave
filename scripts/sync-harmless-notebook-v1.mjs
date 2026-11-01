/** Materialize the HARMLESS.md story seed into the served PWA.
 * The repository-root Markdown is the only authored source. Device posts
 * live in separate append-only local records and are never merged by builds.
 */
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=new URL('../HARMLESS.md',import.meta.url);
const mirror=new URL('../public/HARMLESS.md',import.meta.url);
const content=await readFile(root,'utf8');
if(!content.startsWith('# HARMLESS.md'))throw new Error('Canonical HARMLESS.md is invalid.');
await writeFile(mirror,content,'utf8');
console.log('HARMLESS.md PWA mirror synchronized from canonical source.');

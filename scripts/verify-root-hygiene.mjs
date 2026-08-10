import {readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const entries=await readdir(root,{withFileTypes:true});

// Root Markdown is opt-in. Two versioned documents remain grandfathered because
// executable verifiers/runtime packaging currently consume their exact root paths.
const allowedRootMarkdown=new Set([
  'AGENTS.md',
  'CIVWEAVE-BRAND-MIGRATION.md',
  'CIVWEAVE-PARITY-LEDGER.md',
  'CIVWEAVE-SYSTEMS-MESH-v251.md',
  'CIVWEAVE-TOTAL-RENAME.md',
  'CLOUDFLARE-SETUP.md',
  'HOST-NODE-SETUP-GUIDE.md',
  'INSTALL-ONLY-LOCAL-MESH-ARCHITECTURE-v1.0.33.md',
  'README.md',
  'RELEASE-NOTES.md',
  'TEN-YEAR-PIPELINE.md',
  'VISUAL-CONTRACT.md',
  'rebase.md',
  'renewal.md'
]);

const rootFiles=entries.filter(entry=>entry.isFile()).map(entry=>entry.name);
const unexpectedMarkdown=rootFiles.filter(name=>/\.md$/i.test(name)&&!allowedRootMarkdown.has(name));
const rootSentinels=rootFiles.filter(name=>/^\..*(?:trigger|materialize|watchdog)/i.test(name));

const failures=[];
if(unexpectedMarkdown.length){
  failures.push(`Unexpected root Markdown: ${unexpectedMarkdown.sort().join(', ')}. Put general docs in docs/ and versioned records in docs/history/.`);
}
if(rootSentinels.length){
  failures.push(`Root workflow sentinels are forbidden: ${rootSentinels.sort().join(', ')}. Put sentinels in ops/triggers/.`);
}

if(failures.length){
  console.error('Root hygiene check failed.');
  for(const failure of failures)console.error(`- ${failure}`);
  process.exit(1);
}

console.log(JSON.stringify({ok:true,allowedRootMarkdown:[...allowedRootMarkdown].sort(),sentinelDirectory:'ops/triggers'},null,2));

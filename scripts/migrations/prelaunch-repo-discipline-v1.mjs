import {access,mkdir,readFile,readdir,rename,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const exists=async relative=>access(path.join(root,relative)).then(()=>true,()=>false);
const read=relative=>readFile(path.join(root,relative),'utf8');
const write=async(relative,content)=>{await mkdir(path.dirname(path.join(root,relative)),{recursive:true});await writeFile(path.join(root,relative),content,'utf8')};

const moves={
  'CIVWEAVE-BRAND-MIGRATION.md':'docs/migrations/civweave-brand-migration.md',
  'CIVWEAVE-PARITY-LEDGER.md':'docs/contracts/civweave-parity-ledger.md',
  'CIVWEAVE-SYSTEMS-MESH-v251.md':'docs/contracts/civweave-systems-mesh.md',
  'CIVWEAVE-TOTAL-RENAME.md':'docs/migrations/civweave-total-rename.md',
  'CLOUDFLARE-SETUP.md':'docs/operations/cloudflare-setup.md',
  'HOST-NODE-SETUP-GUIDE.md':'docs/operations/host-node-setup.md',
  'INSTALL-ONLY-LOCAL-MESH-ARCHITECTURE-v1.0.33.md':'docs/contracts/install-only-local-mesh-architecture.md',
  'README-INSTALL.txt':'docs/operations/install-readme.txt',
  'TEN-YEAR-PIPELINE.md':'docs/roadmap/ten-year-pipeline.md',
  'VISUAL-CONTRACT.md':'docs/contracts/visual-contract.md',
  'rebase.md':'docs/roadmap/rebase.md',
  'renewal.md':'docs/roadmap/renewal.md',
  'FILE-INVENTORY.json':'docs/history/inventories/file-inventory-v127.json',
  'server-v130.mjs':'server/compat/server-v130.mjs',
  'server-local-v131.mjs':'server/compat/server-local-v131.mjs',
  'server-gateway-v131-base.mjs':'server/compat/server-gateway-v131-base.mjs',
  'server-gateway-v131.mjs':'server/compat/server-gateway-v131.mjs',
  'server-federated-v152.mjs':'server/compat/server-federated-v152.mjs'
};
for(const target of Object.values(moves))await mkdir(path.dirname(path.join(root,target)),{recursive:true});
for(const [from,to] of Object.entries(moves))if(await exists(from)&&!(await exists(to)))await rename(path.join(root,from),path.join(root,to));

const replacements=new Map([
  ...Object.entries(moves),
  ['offline-campus-current-graph-v238','offline-campus-current-graph-v280'],
  ['fast-background-v241','resumable-pause-v280'],
  ['server-gateway-v131-base.mjs','server/compat/server-gateway-v131-base.mjs'],
  ['server-gateway-v131.mjs','server/gateway.mjs'],
  ['server-local-v131.mjs','server/local.mjs'],
  ['server-federated-v152.mjs','server/federated.mjs'],
  ['server-v130.mjs','server/dev.mjs']
]);
const textExt=new Set(['.md','.txt','.json','.mjs','.js','.yml','.yaml','.sh','.html','.css','.webmanifest']);
const excludedPrefixes=['.git/','node_modules/','archive/','docs/history/','public/downloads/','public/app/models/'];
async function walk(relative=''){
  const dir=path.join(root,relative);
  for(const entry of await readdir(dir,{withFileTypes:true})){
    const child=relative?`${relative}/${entry.name}`:entry.name;
    if(excludedPrefixes.some(prefix=>child===prefix.slice(0,-1)||child.startsWith(prefix)))continue;
    if(entry.isDirectory()){await walk(child);continue}
    if(!entry.isFile()||!textExt.has(path.extname(entry.name)))continue;
    let source;
    try{source=await read(child)}catch{continue}
    let next=source;
    for(const [from,to] of replacements)next=next.split(from).join(to);
    if(child.startsWith('.github/workflows/')){
      next=next.replace(/actions\/checkout@v4/g,'actions/checkout@v5').replace(/actions\/setup-node@v4/g,'actions/setup-node@v5');
      next=next.replace(/node-version:\s*['"]?24(?:\.x)?['"]?/g,"node-version: '22'");
    }
    if(next!==source)await write(child,next);
  }
}
await walk();

async function patch(relative,transform){const before=await read(relative),after=transform(before);if(after!==before)await write(relative,after)}
const rootDirLine="const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');";
await patch('server/compat/server-v130.mjs',source=>source.replace(/const rootDir\s*=\s*path\.dirname\(fileURLToPath\(import\.meta\.url\)\);/,rootDirLine));
await patch('server/compat/server-gateway-v131-base.mjs',source=>source.replace(/const rootDir\s*=\s*path\.dirname\(fileURLToPath\(import\.meta\.url\)\);/,rootDirLine));
await patch('server/compat/server-local-v131.mjs',source=>source
  .replace(/const rootDir\s*=\s*path\.dirname\(fileURLToPath\(import\.meta\.url\)\);/,"const rootDir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');")
  .replace(/const sourcePath=.*?;\n/,"const sourcePath=path.join(rootDir,'server','compat','server-v130.mjs');\n"));
await patch('server/compat/server-gateway-v131.mjs',source=>source
  .replace(/const rootDir\s*=\s*path\.dirname\(fileURLToPath\(import\.meta\.url\)\);/,rootDirLine)
  .replace(/const sourcePath\s*=.*?;\n/,"const sourcePath = path.join(rootDir, 'server', 'compat', 'server-gateway-v131-base.mjs');\n"));
await patch('server/compat/server-federated-v152.mjs',source=>source
  .replace(/const ROOT\s*=\s*path\.dirname\(fileURLToPath\(import\.meta\.url\)\);/,"const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');")
  .replace(/const APP_ENTRY = process\.env\.CIVWEAVE_APP_ENTRY \|\| '[^']+';/,"const APP_ENTRY = process.env.CIVWEAVE_APP_ENTRY || 'server/gateway.mjs';"));

await write('server/dev.mjs',"// Stable development entrypoint. Versioned compatibility implementation lives under server/compat/.\nawait import('./compat/server-v130.mjs');\n");
await write('server/local.mjs',"// Stable local-node entrypoint. Versioned compatibility implementation lives under server/compat/.\nawait import('./compat/server-local-v131.mjs');\n");
await write('server/gateway.mjs',"// Stable hosted gateway entrypoint. Versioned compatibility implementation lives under server/compat/.\nawait import('./compat/server-gateway-v131.mjs');\n");
await write('server/federated.mjs',"// Stable federated-node entrypoint. Versioned compatibility implementation lives under server/compat/.\nawait import('./compat/server-federated-v152.mjs');\n");

await write('VERSION','1.0.76\n');
const pkg=JSON.parse(await read('package.json'));
pkg.version='1.0.76';
pkg.engines={node:'22.x'};
pkg.scripts['start:local']='node server/local.mjs';
pkg.scripts.dev='node --watch server/dev.mjs';
pkg.scripts['check:release-discipline']='node scripts/verify-release-contract.mjs && node scripts/verify-root-hygiene.mjs && node scripts/verify-version-policy.mjs --self-test';
pkg.scripts['audit:production']='npm audit --omit=dev --audit-level=high';
pkg.scripts['check:syntax']=pkg.scripts['check:syntax']
  .replaceAll('server/compat/server/gateway.mjs','server/compat/server-gateway-v131.mjs')
  .replaceAll('server/gateway.mjs-base','server/compat/server-gateway-v131-base.mjs')
  .replaceAll('server/gateway.mjs','server/gateway.mjs')
  .replaceAll('server/local.mjs','server/local.mjs')
  .replaceAll('server/dev.mjs','server/dev.mjs')
  .replaceAll('server/federated.mjs','server/federated.mjs');
if(!pkg.scripts.check.startsWith('npm run check:release-discipline'))pkg.scripts.check=`npm run check:release-discipline && ${pkg.scripts.check}`;
await write('package.json',JSON.stringify(pkg,null,2)+'\n');

await write('scripts/verify-root-hygiene.mjs',`import {readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const entries=await readdir(root,{withFileTypes:true});
const rootFiles=entries.filter(entry=>entry.isFile()).map(entry=>entry.name);
const allowedRootMarkdown=new Set(['AGENTS.md','README.md','RELEASE-NOTES.md']);
const unexpectedMarkdown=rootFiles.filter(name=>/\\.md$/i.test(name)&&!allowedRootMarkdown.has(name));
const rootSentinels=rootFiles.filter(name=>/^\\..*(?:trigger|materialize|watchdog)/i.test(name));
const displacedArtifacts=rootFiles.filter(name=>name==='README-INSTALL.txt'||name==='FILE-INVENTORY.json');
const versionedServers=rootFiles.filter(name=>/^server(?:-[a-z-]+)?-v\\d+\\.mjs$/i.test(name));
const failures=[];
if(unexpectedMarkdown.length)failures.push(\`Unexpected root Markdown: \${unexpectedMarkdown.sort().join(', ')}. Put documentation under docs/.\`);
if(rootSentinels.length)failures.push(\`Root workflow sentinels are forbidden: \${rootSentinels.sort().join(', ')}. Put sentinels in ops/triggers/.\`);
if(displacedArtifacts.length)failures.push(\`Root inventory/install artifacts are forbidden: \${displacedArtifacts.sort().join(', ')}. Put them under docs/.\`);
if(versionedServers.length)failures.push(\`Versioned server implementations are forbidden at root: \${versionedServers.sort().join(', ')}. Use stable server/*.mjs entrypoints and server/compat/.\`);
if(failures.length){console.error('Root hygiene check failed.');for(const failure of failures)console.error(\`- \${failure}\`);process.exit(1)}
console.log(JSON.stringify({ok:true,allowedRootMarkdown:[...allowedRootMarkdown].sort(),sentinelDirectory:'ops/triggers',serverEntryDirectory:'server',docsDirectory:'docs'},null,2));
`);

await write('docs/README.md',`# Civweave documentation

The repository root is a control surface, not a document archive. Current knowledge lives here behind stable folders and indexes.

## Contracts

[\`contracts/\`](./contracts/) contains architecture and behavior contracts consumed by people, verifiers, and packaging.

## Operations

[\`operations/\`](./operations/) contains installation, hosting, deployment, and operator guidance.

## Migrations

[\`migrations/\`](./migrations/) contains naming and structural migration records.

## Roadmap

[\`roadmap/\`](./roadmap/) contains the long-horizon pipeline plus its rebase and renewal procedures.

## History

[\`history/\`](./history/) contains release notes, audits, design snapshots, and inventories that describe a point in time rather than the current system.

Workflow sentinels live in [\`../ops/triggers/\`](../ops/triggers/). Before adding any root document, run \`node scripts/verify-root-hygiene.mjs\`.
`);
await write('docs/contracts/README.md','# Contracts\n\nStable architecture and behavior contracts. Executable verifiers should point here rather than pinning versioned documents at repository root.\n');
await write('docs/operations/README.md','# Operations\n\nInstallation, host-node, deployment, and operator documentation.\n');
await write('docs/migrations/README.md','# Migrations\n\nRepository and product migration records.\n');
await write('docs/roadmap/README.md','# Roadmap\n\nLong-horizon agentic pipeline, rebase, and renewal procedures.\n');
await write('docs/history/inventories/README.md','# Historical inventories\n\nPoint-in-time file inventories retained for provenance, not as current source-of-truth maps.\n');

await write('.github/workflows/verify-version-bump.yml',`name: Verify Version Policy

on:
  pull_request:
    branches: [main]

permissions:
  contents: read

jobs:
  verify-version-policy:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v5
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v5
        with:
          node-version: '22'
      - name: Classify shipping versus housekeeping changes
        shell: bash
        run: |
          set -euo pipefail
          git fetch origin "\${{ github.base_ref }}" --depth=1
          base_version="$(git show "origin/\${{ github.base_ref }}:VERSION" | tr -d '[:space:]')"
          proposed_version="$(tr -d '[:space:]' < VERSION)"
          export CHANGED_FILES="$(git diff --name-only "origin/\${{ github.base_ref }}...HEAD")"
          node scripts/verify-version-policy.mjs "$base_version" "$proposed_version"
          node scripts/verify-version-policy.mjs --self-test
`);
await write('.github/workflows/verify-dependency-audit.yml',`name: Verify Production Dependency Audit

on:
  pull_request:
    branches: [main]
    paths:
      - package.json
      - package-lock.json
      - .github/workflows/verify-dependency-audit.yml
  workflow_dispatch:

permissions:
  contents: read

jobs:
  audit:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: '22'
          cache: npm
      - run: npm ci --ignore-scripts
      - run: npm audit --omit=dev --audit-level=high
`);

console.log(JSON.stringify({ok:true,version:'1.0.76',moved:Object.entries(moves),stableServerEntries:['server/dev.mjs','server/local.mjs','server/gateway.mjs','server/federated.mjs'],releaseContract:'config/release-contract.json'},null,2));

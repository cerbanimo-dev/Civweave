#!/usr/bin/env node

import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..', '..');

function parseArgs(argv) {
  const options = {
    output: '',
    base: '/',
    role: 'flagship',
    hostId: '',
    publicOrigin: '',
    canonicalOrigin: 'https://cerbanimo.cc',
    pagesOrigin: '',
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--output') options.output = argv[++i] || '';
    else if (arg === '--base') options.base = argv[++i] || '/';
    else if (arg === '--role') options.role = argv[++i] || 'flagship';
    else if (arg === '--host-id') options.hostId = argv[++i] || '';
    else if (arg === '--public-origin') options.publicOrigin = argv[++i] || '';
    else if (arg === '--canonical-origin') options.canonicalOrigin = argv[++i] || options.canonicalOrigin;
    else if (arg === '--pages-origin') options.pagesOrigin = argv[++i] || '';
    else if (arg === '--help' || arg === '-h') {
      console.log('Build the Cerbanimo public site for the flagship origin or a community-host subpath.\n\nUsage:\n  node site/cerbanimo-cc/build.mjs --output .cerbanimo-pages --base / --role flagship\n  node site/cerbanimo-cc/build.mjs --output .cloudflare-pages/cerbanimo --base /cerbanimo/ --role community --host-id garden --public-origin https://civweave-garden.pages.dev');
      process.exit(0);
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!options.output) throw new Error('--output is required.');
  options.role = options.role === 'community' ? 'community' : 'flagship';
  options.base = `/${String(options.base || '/').replace(/^\/+|\/+$/g, '')}/`.replace(/^\/\/$/, '/');
  options.publicOrigin = String(options.publicOrigin || '').replace(/\/+$/g, '');
  options.canonicalOrigin = String(options.canonicalOrigin || '').replace(/\/+$/g, '');
  options.pagesOrigin = String(options.pagesOrigin || '').replace(/\/+$/g, '');
  return options;
}

function git(...args) {
  return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).trim();
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function sitePath(base, path) {
  return `${base}${String(path || '').replace(/^\/+/, '')}`;
}

const options = parseArgs(process.argv.slice(2));
const output = resolve(repoRoot, options.output);
const source = scriptDir;
const assets = resolve(output, 'assets');
rmSync(output, { recursive: true, force: true });
mkdirSync(assets, { recursive: true });

let html = readFileSync(resolve(source, 'index.html'), 'utf8');
let css = readFileSync(resolve(source, 'styles.css'), 'utf8');
let app = readFileSync(resolve(source, 'app.js'), 'utf8');

const replacements = [
  ['/styles.css', sitePath(options.base, 'styles.css')],
  ['/app.js', sitePath(options.base, 'app.js')],
  ['/assets/', sitePath(options.base, 'assets/')],
];
for (const [from, to] of replacements) {
  html = html.replaceAll(from, to);
  css = css.replaceAll(from, to);
  app = app.replaceAll(from, to);
}
app = app.replaceAll('/history.json', sitePath(options.base, 'history.json'));

if (!html.includes('<link rel="canonical"')) {
  const canonical = options.role === 'flagship' ? `${options.canonicalOrigin}/` : `${options.publicOrigin}${options.base}`;
  if (canonical) html = html.replace('</head>', `  <link rel="canonical" href="${escapeHtml(canonical)}">\n</head>`);
}

if (options.role === 'community') {
  if (!options.hostId) throw new Error('--host-id is required for a community surface.');
  if (!options.publicOrigin) throw new Error('--public-origin is required for a community surface.');
  const hostId = escapeHtml(options.hostId);
  const localRoot = escapeHtml(`${options.publicOrigin}/`);
  const stewardSetup = escapeHtml(`${options.publicOrigin}/host-setup.html`);
  html = html.replace('href="https://civweave.cc">Open Civweave</a>', `href="${localRoot}">Open this node</a>`);
  html = html.replace('href="https://civweave.cc/host-setup.html">Explore host setup</a>', `href="${stewardSetup}">Explore host setup</a>`);
  const banner = `<aside class="host-surface" aria-label="Community host page"><span>Community Cerbanimo</span><strong>${hostId}</strong><a href="${localRoot}">Open this Civweave node ↗</a></aside>`;
  html = html.replace('<body>', `<body>\n  ${banner}`);
  css += `\n.host-surface{position:relative;z-index:30;display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap;padding:9px 18px;background:linear-gradient(90deg,rgba(255,49,210,.16),rgba(32,215,255,.12));border-bottom:1px solid rgba(255,255,255,.14);font-size:.82rem;letter-spacing:.02em}.host-surface span{color:var(--muted)}.host-surface strong{color:#fff}.host-surface a{color:#8fe8ff;font-weight:750;text-decoration:none}.host-surface a:hover,.host-surface a:focus-visible{text-decoration:underline}@media(max-width:640px){.host-surface{justify-content:flex-start;padding:9px 14px}}\n`;
}

writeFileSync(resolve(output, 'index.html'), html, 'utf8');
writeFileSync(resolve(output, 'styles.css'), css, 'utf8');
writeFileSync(resolve(output, 'app.js'), app, 'utf8');
cpSync(resolve(source, 'assets'), assets, { recursive: true });

const rootAssets = new Map([
  ['Civweave-on-logo.png', 'civweave-on.png'],
  ['Civweave-off-logo.png', 'civweave-off.png'],
  ['Civweave-weaveling-sprites.png', 'weaveling.png'],
  ['Living-School-moss-sprites.png', 'moss.png'],
  ['Cerbanimo-kamiya-sprites.png', 'kamiya.png'],
  ['FellowFare-rook-sprites.png', 'rook.png'],
  ['Anarchadia-merlin-sprites.png', 'merlin.png'],
]);
for (const [sourceName, targetName] of rootAssets) {
  cpSync(resolve(repoRoot, sourceName), resolve(assets, targetName));
}

const initialCommitDate = git('log', '--reverse', '--format=%cI').split(/\r?\n/)[0];
const history = {
  schema: 'cerbanimo.civweave-history.v2',
  repository: 'cerbanimo-dev/Civweave',
  branch: 'main',
  commitCount: Number(git('rev-list', '--count', 'HEAD')),
  initialCommitDate,
  latestCommit: git('rev-parse', 'HEAD'),
  generatedAt: new Date().toISOString(),
  surface: {
    role: options.role,
    hostId: options.hostId || undefined,
    basePath: options.base,
    publicOrigin: options.publicOrigin || undefined,
    pagesOrigin: options.pagesOrigin || undefined,
    canonicalOrigin: options.canonicalOrigin,
  },
};
if (!Number.isSafeInteger(history.commitCount) || history.commitCount < 1 || !history.initialCommitDate) {
  throw new Error(`Invalid Git history marker: ${JSON.stringify(history)}`);
}
writeFileSync(resolve(output, 'history.json'), `${JSON.stringify(history, null, 2)}\n`, 'utf8');
writeFileSync(resolve(output, 'surface.json'), `${JSON.stringify(history.surface, null, 2)}\n`, 'utf8');

if (options.base !== '/') {
  const forbidden = [
    ['index.html', html, /(?:href|src)=["']\/(?:styles\.css|app\.js|assets\/)/],
    ['app.js', app, /["'`]\/(?:history\.json|assets\/)/],
  ];
  for (const [name, content, pattern] of forbidden) {
    if (pattern.test(content)) throw new Error(`${name} still contains a root-relative Cerbanimo asset reference after base-path packaging.`);
  }
}

console.log(JSON.stringify({
  ok: true,
  output,
  basePath: options.base,
  role: options.role,
  hostId: options.hostId || null,
  publicOrigin: options.publicOrigin || null,
  sourceCommit: history.latestCommit,
  commitCount: history.commitCount,
}, null, 2));

#!/usr/bin/env node

import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..', '..');
const GUIDE_SHEETS = [
  '/assets/weaveling.png',
  '/assets/moss.png',
  '/assets/kamiya.png',
  '/assets/rook.png',
  '/assets/merlin.png',
];
const GUIDE_CSS = `
.cast .guide-avatar-shell{width:82px;height:82px;margin-bottom:20px;padding:3px;border:1px solid color-mix(in srgb,var(--accent) 72%,white);border-radius:22px;background:linear-gradient(145deg,color-mix(in srgb,var(--accent) 18%,#190b2f),rgba(7,3,14,.94));box-shadow:inset 0 0 24px color-mix(in srgb,var(--accent) 12%,transparent),0 9px 28px rgba(0,0,0,.25);overflow:hidden}
.cast .guide-avatar-frame{display:block;width:100%;height:100%;border-radius:18px;background-image:var(--guide-sheet);background-size:500% 400%;background-position:calc(var(--sprite-col) * 25%) calc(var(--sprite-row) * 33.333333%);background-repeat:no-repeat;background-color:#05030c;filter:saturate(.98) brightness(1.02);transition:background-position 140ms steps(1),transform 180ms ease,filter 180ms ease}
.cast article:hover .guide-avatar-frame,.cast article:focus-within .guide-avatar-frame{transform:scale(1.045);filter:saturate(1.08) brightness(1.06)}
@media(prefers-reduced-motion:reduce){.cast .guide-avatar-frame{transition:none}}
`;

function parseArgs(argv) {
  const options = { output: '', base: '/', role: 'flagship', hostId: '', publicOrigin: '', canonicalOrigin: 'https://cerbanimo.cc', pagesOrigin: '' };
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
function git(...args) { return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).trim(); }
function escapeHtml(value) { return String(value || '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;'); }
function sitePath(base, path) { return `${base}${String(path || '').replace(/^\/+/, '')}`; }
function addLanguageLinks(html, englishUrl, japaneseUrl, language) {
  if (html.includes('<link rel="canonical"')) return html;
  const canonical = language === 'ja' ? japaneseUrl : englishUrl;
  return html.replace('</head>', `  <link rel="canonical" href="${escapeHtml(canonical)}">\n  <link rel="alternate" hreflang="en" href="${escapeHtml(englishUrl)}">\n  <link rel="alternate" hreflang="ja" href="${escapeHtml(japaneseUrl)}">\n  <link rel="alternate" hreflang="x-default" href="${escapeHtml(englishUrl)}">\n</head>`);
}
function materializeGuideAvatars(html) {
  let index = 0;
  return html.replace(/<div class="sigil">[\s\S]*?<\/div>/g, match => {
    if (index >= GUIDE_SHEETS.length) return match;
    const sheet = GUIDE_SHEETS[index];
    const materialized = `<div class="guide-avatar-shell" aria-hidden="true"><span class="guide-avatar-frame" data-guide-avatar-index="${index}" style="--guide-sheet:url(&quot;${sheet}&quot;);--sprite-col:0;--sprite-row:0"></span></div>`;
    index += 1;
    return materialized;
  });
}
function materializeEnglishLanguageSwitch(html) {
  if (html.includes('lang="ja"')) return html;
  return html.replace('<a class="nav-cta"', '<a href="ja/" lang="ja">日本語</a><a class="nav-cta"');
}

const options = parseArgs(process.argv.slice(2));
const output = resolve(repoRoot, options.output);
const source = scriptDir;
const assets = resolve(output, 'assets');
const japaneseOutput = resolve(output, 'ja');
rmSync(output, { recursive: true, force: true });
mkdirSync(assets, { recursive: true });
mkdirSync(japaneseOutput, { recursive: true });

let html = materializeEnglishLanguageSwitch(materializeGuideAvatars(readFileSync(resolve(source, 'index.html'), 'utf8')));
let htmlJa = materializeGuideAvatars(readFileSync(resolve(source, 'index.ja.html'), 'utf8'));
let css = `${readFileSync(resolve(source, 'styles.css'), 'utf8')}\n${GUIDE_CSS}`;
let app = readFileSync(resolve(source, 'app.js'), 'utf8');

const replacements = [
  ['/styles.css', sitePath(options.base, 'styles.css')],
  ['/app.js', sitePath(options.base, 'app.js')],
  ['/assets/', sitePath(options.base, 'assets/')],
];
for (const [from, to] of replacements) {
  html = html.replaceAll(from, to);
  htmlJa = htmlJa.replaceAll(from, to);
  css = css.replaceAll(from, to);
  app = app.replaceAll(from, to);
}
app = app.replaceAll('/history.json', sitePath(options.base, 'history.json'));

const englishCanonical = options.role === 'flagship' ? `${options.canonicalOrigin}/` : `${options.publicOrigin}${options.base}`;
const japaneseCanonical = `${englishCanonical}ja/`;
if (englishCanonical) {
  html = addLanguageLinks(html, englishCanonical, japaneseCanonical, 'en');
  htmlJa = addLanguageLinks(htmlJa, englishCanonical, japaneseCanonical, 'ja');
}

if (options.role === 'community') {
  if (!options.hostId) throw new Error('--host-id is required for a community surface.');
  if (!options.publicOrigin) throw new Error('--public-origin is required for a community surface.');
  const hostId = escapeHtml(options.hostId);
  const localRoot = escapeHtml(`${options.publicOrigin}/`);
  const localJapaneseRoot = escapeHtml(`${options.publicOrigin}/ja/`);
  const stewardSetup = escapeHtml(`${options.publicOrigin}/host-setup.html`);
  html = html.replace('href="https://civweave.cc">Open Civweave</a>', `href="${localRoot}">Open this node</a>`);
  html = html.replace('href="https://civweave.cc/host-setup.html">Explore host setup</a>', `href="${stewardSetup}">Explore host setup</a>`);
  htmlJa = htmlJa.replaceAll('href="https://civweave.cc/ja/">民織を開く</a>', `href="${localJapaneseRoot}">この民織ノードを開く</a>`);
  htmlJa = htmlJa.replace('href="https://civweave.cc/host-setup.html">ホスト設定を見る</a>', `href="${stewardSetup}">ホスト設定を見る</a>`);
  const banner = `<aside class="host-surface" aria-label="Community host page"><span>Community Cerbanimo</span><strong>${hostId}</strong><a href="${localRoot}">Open this Civweave node ↗</a></aside>`;
  const bannerJa = `<aside class="host-surface" aria-label="コミュニティ・ホストページ"><span>コミュニティ 神織</span><strong>${hostId}</strong><a href="${localJapaneseRoot}">この民織ノードを開く ↗</a></aside>`;
  html = html.replace('<body>', `<body>\n  ${banner}`);
  htmlJa = htmlJa.replace('<body>', `<body>\n  ${bannerJa}`);
  css += `\n.host-surface{position:relative;z-index:30;display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap;padding:9px 18px;background:linear-gradient(90deg,rgba(255,49,210,.16),rgba(32,215,255,.12));border-bottom:1px solid rgba(255,255,255,.14);font-size:.82rem;letter-spacing:.02em}.host-surface span{color:var(--muted)}.host-surface strong{color:#fff}.host-surface a{color:#8fe8ff;font-weight:750;text-decoration:none}.host-surface a:hover,.host-surface a:focus-visible{text-decoration:underline}@media(max-width:640px){.host-surface{justify-content:flex-start;padding:9px 14px}}\n`;
}

writeFileSync(resolve(output, 'index.html'), html, 'utf8');
writeFileSync(resolve(japaneseOutput, 'index.html'), htmlJa, 'utf8');
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
for (const [sourceName, targetName] of rootAssets) cpSync(resolve(repoRoot, sourceName), resolve(assets, targetName));

const initialCommitDate = git('log', '--reverse', '--format=%cI').split(/\r?\n/)[0];
const history = {
  schema: 'cerbanimo.civweave-history.v2', repository: 'cerbanimo-dev/Civweave', branch: 'main',
  commitCount: Number(git('rev-list', '--count', 'HEAD')), initialCommitDate, latestCommit: git('rev-parse', 'HEAD'), generatedAt: new Date().toISOString(),
  surface: { role: options.role, hostId: options.hostId || undefined, basePath: options.base, publicOrigin: options.publicOrigin || undefined, pagesOrigin: options.pagesOrigin || undefined, canonicalOrigin: options.canonicalOrigin, languages: ['en', 'ja'] },
};
if (!Number.isSafeInteger(history.commitCount) || history.commitCount < 1 || !history.initialCommitDate) throw new Error(`Invalid Git history marker: ${JSON.stringify(history)}`);
writeFileSync(resolve(output, 'history.json'), `${JSON.stringify(history, null, 2)}\n`, 'utf8');
writeFileSync(resolve(output, 'surface.json'), `${JSON.stringify(history.surface, null, 2)}\n`, 'utf8');

if (options.base !== '/') {
  const forbidden = [
    ['index.html', html, /(?:href|src)=["']\/(?:styles\.css|app\.js|assets\/)/],
    ['ja/index.html', htmlJa, /(?:href|src)=["']\/(?:styles\.css|app\.js|assets\/)/],
    ['app.js', app, /["'`]\/(?:history\.json|assets\/)/],
  ];
  for (const [name, content, pattern] of forbidden) if (pattern.test(content)) throw new Error(`${name} still contains a root-relative Cerbanimo asset reference after base-path packaging.`);
}

if (/<div class="sigil">/.test(html) || /<div class="sigil">/.test(htmlJa)) throw new Error('Cerbanimo build emitted guide placeholders instead of materialized guide artwork.');
if (!GUIDE_SHEETS.every(path => html.includes(sitePath(options.base, path))) || !GUIDE_SHEETS.every(path => htmlJa.includes(sitePath(options.base, path)))) throw new Error('Cerbanimo build is missing materialized guide sprite sources.');

console.log(JSON.stringify({ ok: true, output, basePath: options.base, role: options.role, hostId: options.hostId || null, publicOrigin: options.publicOrigin || null, sourceCommit: history.latestCommit, commitCount: history.commitCount, languages: ['en', 'ja'], presentationSourceTruth: true }, null, 2));

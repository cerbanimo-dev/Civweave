#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');
const publicRoot = resolve(repoRoot, 'public');
const outputPath = resolve(publicRoot, 'app/asset-lockboard-catalog-v239.json');
const IMAGE_EXTENSIONS = new Set(['.png','.jpg','.jpeg','.webp','.gif','.svg','.avif','.ico']);
const SOURCE_EXTENSIONS = new Set(['.html','.htm','.css','.js','.mjs','.json','.txt','.md','.webmanifest']);
const SKIP_PREFIXES = ['downloads/knowledge-schools/'];
const SKIP_FILES = new Set(['app/asset-lockboard-catalog-v239.json']);

// Production Pages builds install dependencies before this catalog is generated,
// so launcher art is materialized from the approved daytime source before the
// publish tree is copied. Dependency-free verification jobs may intentionally
// skip the raster refresh and inspect source contracts only.
try {
  await import('./generate-civweave-icons.mjs');
} catch (error) {
  const missingSharp=error?.code==='ERR_MODULE_NOT_FOUND'&&String(error?.message||'').includes("package 'sharp'");
  if (!missingSharp) throw error;
  console.warn('[Civweave] sharp is unavailable in this dependency-free verifier; launcher raster regeneration is deferred to the build/package path.');
}

function walk(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(absolute));
    else if (entry.isFile()) files.push(absolute);
  }
  return files;
}

function webPath(absolute) {
  return `/${relative(publicRoot, absolute).split(sep).join('/')}`;
}

function relPath(absolute) {
  return relative(publicRoot, absolute).split(sep).join('/');
}

function skipped(absolute) {
  const rel = relPath(absolute);
  return SKIP_FILES.has(rel) || SKIP_PREFIXES.some(prefix => rel.startsWith(prefix));
}

function normalizeReference(raw, sourceWebPath) {
  const value = String(raw || '').trim().replace(/&amp;/g, '&');
  if (!value || /^(?:data:|blob:|https?:|mailto:|tel:|javascript:|#)/i.test(value)) return null;
  let url;
  try { url = new URL(value, `https://civweave.local${sourceWebPath}`); } catch { return null; }
  const extension = extname(url.pathname).toLowerCase();
  if (!IMAGE_EXTENSIONS.has(extension)) return null;
  return decodeURI(url.pathname);
}

function lineColumn(text, index) {
  const before = text.slice(0, index);
  const line = before.split('\n').length;
  const lastBreak = before.lastIndexOf('\n');
  return { line, column: index - lastBreak };
}

function slotId(sourcePath, line, column, raw) {
  return `slot-${createHash('sha1').update(`${sourcePath}:${line}:${column}:${raw}`).digest('hex').slice(0, 14)}`;
}

function scanReferences(absolute) {
  if (skipped(absolute) || !SOURCE_EXTENSIONS.has(extname(absolute).toLowerCase())) return [];
  const sourcePath = webPath(absolute);
  let text;
  try { text = readFileSync(absolute, 'utf8'); } catch { return []; }
  const references = [];
  const patterns = [
    { kind: 'markup', re: /(?:src|href|poster|content)\s*=\s*["']([^"']+)["']/gi },
    { kind: 'css-url', re: /url\(\s*["']?([^"')]+)["']?\s*\)/gi },
    { kind: 'string', re: /["'`]((?:\/|\.\.?\/)[^"'`\s<>?#)]+\.(?:png|jpe?g|webp|gif|svg|avif|ico)(?:\?[^"'`\s<>#)]*)?)["'`]/gi }
  ];
  const seen = new Set();
  for (const { kind, re } of patterns) {
    let match;
    while ((match = re.exec(text))) {
      const raw = match[1];
      const assetPath = normalizeReference(raw, sourcePath);
      if (!assetPath) continue;
      const location = lineColumn(text, match.index);
      const key = `${location.line}:${location.column}:${assetPath}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const lineText = text.split('\n')[location.line - 1] || '';
      references.push({
        id: slotId(sourcePath, location.line, location.column, raw),
        sourcePath,
        line: location.line,
        column: location.column,
        kind,
        raw,
        assetPath,
        context: lineText.trim().slice(0, 360)
      });
    }
  }
  return references;
}

if (!existsSync(publicRoot)) throw new Error(`Public directory not found: ${publicRoot}`);

const files = walk(publicRoot).filter(file => !skipped(file));
const assets = files
  .filter(file => IMAGE_EXTENSIONS.has(extname(file).toLowerCase()))
  .map(file => ({
    path: webPath(file),
    extension: extname(file).toLowerCase().slice(1),
    bytes: statSync(file).size,
    filename: file.split(sep).at(-1)
  }))
  .sort((a,b) => a.path.localeCompare(b.path));

const assetPaths = new Set(assets.map(asset => asset.path));
const slots = files.flatMap(scanReferences).map(slot => ({
  ...slot,
  exists: assetPaths.has(slot.assetPath)
})).sort((a,b) => a.sourcePath.localeCompare(b.sourcePath) || a.line - b.line || a.column - b.column);

const usageCount = new Map();
for (const slot of slots) usageCount.set(slot.assetPath, (usageCount.get(slot.assetPath) || 0) + 1);
for (const asset of assets) asset.usageCount = usageCount.get(asset.path) || 0;

const catalog = {
  schema: 'civweave.asset-lockboard.catalog.v239',
  generatedAt: new Date().toISOString(),
  publicRoot: '/',
  assetCount: assets.length,
  slotCount: slots.length,
  missingReferenceCount: slots.filter(slot => !slot.exists).length,
  assets,
  slots
};

writeFileSync(outputPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
console.log(`Asset lockboard catalog: ${assets.length} image files, ${slots.length} image slots, ${catalog.missingReferenceCount} missing references.`);

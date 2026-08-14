#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';

const root = resolve(process.cwd());
const scanRoots = ['public/app', 'site/cerbanimo-cc'];
const extensions = new Set(['.js', '.mjs', '.html']);
const explicitExemptions = new Map([
  ['public/app/asset-customization-v239.js', 'Explicit user-selected local skin overrides; canonical source is not repaired.'],
]);

function walk(path) {
  const out = [];
  for (const name of readdirSync(path)) {
    const full = resolve(path, name);
    const stat = statSync(full);
    if (stat.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function extension(path) {
  const match = path.match(/\.[^.\/]+$/);
  return match?.[0]?.toLowerCase() || '';
}

const patterns = Object.freeze({
  observer: /\bnew\s+MutationObserver\s*\(/,
  treeWalker: /\bcreateTreeWalker\s*\(/,
  sourceRewrite: /(?:\.src\s*=|setAttribute\s*\(\s*['"](?:src|srcset|poster)['"])/,
  nodeReplacement: /\.replaceWith\s*\(/,
  broadRemoval: /(?:querySelectorAll?\([^\n]{0,140}\)\.forEach\([^\n]{0,140}\.remove\(|getElementById\([^\n]{0,100}\)\?\.remove\s*\()/,
  brandRewrite: /replaceAll\(\s*['"](?:COMMONWEAVE|Commonweave)['"]|brandTree\s*\(/,
  staticControlInjection: /createElement\s*\(\s*['"](?:button|img|div|span|style|link)['"]\s*\)/,
  repairIntent: /(?:repair|regression[-_ ]?fix|decorateTextNode|removeEmbeddedGuideCards|upgradeSymbols|brandTree)/i,
});

const suspects = [];
for (const scanRoot of scanRoots) {
  const absolute = resolve(root, scanRoot);
  for (const file of walk(absolute)) {
    if (!extensions.has(extension(file))) continue;
    const path = relative(root, file).replaceAll('\\', '/');
    const source = readFileSync(file, 'utf8');
    const signals = Object.fromEntries(Object.entries(patterns).map(([name, pattern]) => [name, pattern.test(source)]));
    const dangerous =
      (signals.observer && (signals.treeWalker || signals.sourceRewrite || signals.nodeReplacement || signals.broadRemoval || signals.brandRewrite)) ||
      (signals.repairIntent && (signals.sourceRewrite || signals.nodeReplacement || signals.broadRemoval || signals.brandRewrite || signals.staticControlInjection));
    if (!dangerous) continue;
    suspects.push({ path, exempt: explicitExemptions.get(path) || null, signals: Object.keys(signals).filter(key => signals[key]) });
  }
}

const blocked = suspects.filter(row => !row.exempt);
console.log(JSON.stringify({
  schema: 'civweave.presentation-repair-audit.v1',
  scannedRoots: scanRoots,
  suspects,
  blockedCount: blocked.length,
}, null, 2));

if (blocked.length) {
  console.error(`\nPresentation repair shims remain in ${blocked.length} file(s):`);
  for (const row of blocked) console.error(` - ${row.path}: ${row.signals.join(', ')}`);
  process.exit(1);
}

console.log('\nNo unapproved post-paint static presentation repair shims detected.');

#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';

const root = resolve(process.cwd());
const read = path => readFileSync(resolve(root, path), 'utf8');

const rules = [
  {
    path: 'public/app/civweave-brand.js',
    forbid: [
      [/\bnew\s+MutationObserver\s*\(/, 'brand runtime must not observe and rewrite the DOM'],
      [/\bcreateTreeWalker\s*\(/, 'brand runtime must not crawl text nodes'],
      [/\bbrandTree\s*\(/, 'brand runtime must not run a tree-wide brand migration'],
      [/replaceAll\(\s*['"](?:COMMONWEAVE|Commonweave)['"]/, 'brand runtime must not rewrite legacy names after paint'],
    ],
    require: [[/runtimeBrandRewrite:false/, 'brand runtime declares source-truth branding']],
  },
  {
    path: 'public/app/regression-fixes-v243.js',
    forbid: [
      [/\bnew\s+MutationObserver\s*\(/, 'regression compatibility must not watch presentation'],
      [/isOldKamiya|kamiya-welcoming-v243|\/app\/assets\/ai\/kamiya\.png/, 'no old-Kamiya image substitution remains'],
      [/\bimage\.src\s*=/, 'regression compatibility must not replace canonical images'],
    ],
    require: [[/runtimeImageRepair:false/, 'image-repair compatibility explicitly disabled']],
  },
  {
    path: 'public/app/services/fellowfare/marketplace-v2-symbols.js',
    forbid: [
      [/decorateTextNode|\bcreateTreeWalker\s*\(/, 'currency symbols must be emitted by renderers, not text crawlers'],
      [/\.replaceWith\s*\(/, 'currency runtime must not replace rendered text nodes'],
      [/\bnew\s+MutationObserver\s*\(/, 'currency runtime must not re-decorate later DOM mutations'],
    ],
    require: [[/postPaintDecoration:false/, 'currency runtime declares source-truth output']],
  },
  {
    path: 'public/app/shared-chat-face-icons-v255.js',
    forbid: [
      [/OLD_SRC_TO_SYSTEM/, 'neutral chat faces must come from the producer'],
      [/\bnew\s+MutationObserver\s*\(/, 'neutral face runtime must not watch and rewrite image sources'],
      [/function\s+apply\s*\(\s*scope\s*=\s*document/, 'neutral face source rewrite is retired'],
    ],
    require: [[/neutralSourceRewrite:false/, 'only explicit expression changes may replace avatar sources']],
  },
  {
    path: 'public/app/shared-guide-surface-v236-core-v244.js',
    forbid: [
      [/\bnew\s+MutationObserver\s*\(/, 'bubble-only guide runtime must not repeatedly delete embedded UI'],
      [/removeEmbeddedGuideCards\s*\([^)]*\)\s*\{[^}]*\.remove\s*\(/s, 'guide card removal must not happen after paint'],
    ],
    require: [
      [/sourceTruth:true/, 'guide surface declares source truth'],
      [/chat\/weaveling-face-v255\.webp/, 'neutral guide artwork is canonical at render time'],
    ],
  },
  {
    path: 'public/app/platform-stability-v159.js',
    forbid: [
      [/\bnew\s+MutationObserver\s*\(/, 'stability runtime must not inject controls into later dialogs'],
      [/cw159-dialog-return[\s\S]{0,300}createElement\s*\(/, 'dialog return controls must be owned by their renderer'],
    ],
    require: [[/injectedDialogControls:false/, 'dialog injection explicitly retired']],
  },
  {
    path: 'public/app/shared/visual-assets-v124.js',
    forbid: [
      [/\bnew\s+MutationObserver\s*\(/, 'visual asset helpers must not repair every later DOM mutation'],
      [/function\s+repair\s*\([^)]*\)\s*\{[^}]*querySelector/s, 'visual asset repair must not rewrite rendered canonical artwork'],
      [/dataset\.cwFixed/, 'runtime fixed-asset markers are retired'],
    ],
    require: [[/runtimeCanonicalRepair:false/, 'canonical visual repair explicitly disabled']],
  },
  {
    path: 'public/app/working-campus-topbar-v243.js',
    forbid: [
      [/\brepairBrand\s*\(/, 'topbar must not replace the source page brand image'],
      [/cw243ValidBrand/, 'brand-error source replacement hook is retired'],
    ],
    require: [[/sourceTruthBrand:true/, 'topbar respects source-declared branding']],
  },
  {
    path: 'site/cerbanimo-cc/app.js',
    forbid: [
      [/\.replaceWith\s*\(/, 'Cerbanimo runtime must not swap placeholder artwork after paint'],
      [/installRealmPosters|installGuideAvatars|installLanguageSwitch/, 'Cerbanimo static presentation must be materialized before delivery'],
      [/\bimage\.src\s*=/, 'Cerbanimo realm artwork must not be rewritten at runtime'],
    ],
  },
  {
    path: 'site/cerbanimo-cc/build.mjs',
    require: [
      [/materializeGuideAvatars/, 'Cerbanimo guide artwork is materialized at build time'],
      [/materializeEnglishLanguageSwitch/, 'Cerbanimo language navigation is materialized at build time'],
      [/presentationSourceTruth:\s*true/, 'Cerbanimo build reports source-truth presentation'],
      [/guide placeholders instead of materialized guide artwork/, 'build fails if guide placeholders escape into deployed HTML'],
    ],
  },
];

const failures = [];
for (const rule of rules) {
  const source = read(rule.path);
  for (const [pattern, message] of rule.forbid || []) if (pattern.test(source)) failures.push(`${rule.path}: ${message}`);
  for (const [pattern, message] of rule.require || []) if (!pattern.test(source)) failures.push(`${rule.path}: missing invariant: ${message}`);
}

function walk(path) {
  const out = [];
  for (const name of readdirSync(path)) {
    const full = resolve(path, name);
    const stat = statSync(full);
    if (stat.isDirectory()) out.push(...walk(full)); else out.push(full);
  }
  return out;
}

// Discovery pass: report, but do not automatically condemn, files that use the same
// primitives for legitimate live state. This keeps the audit useful without banning
// chat, maps, install progress, AI expression changes, localization, or opt-in skins.
const discovery = [];
for (const scanRoot of ['public/app', 'site/cerbanimo-cc']) {
  for (const file of walk(resolve(root, scanRoot))) {
    if (!/\.(?:js|mjs|html)$/.test(file)) continue;
    const path = relative(root, file).replaceAll('\\', '/');
    const source = readFileSync(file, 'utf8');
    const observer = /\bnew\s+MutationObserver\s*\(/.test(source);
    const rewrite = /(?:\.replaceWith\s*\(|setAttribute\s*\(\s*['"](?:src|srcset|poster)['"]|\.src\s*=)/.test(source);
    const legacyIntent = /(?:old|legacy|repair|fix|cleanup|decorate|brand)/i.test(source);
    if (observer && rewrite && legacyIntent) discovery.push(path);
  }
}

console.log(JSON.stringify({
  schema: 'civweave.presentation-source-truth.v2',
  enforcedFiles: rules.map(rule => rule.path),
  discoveryCandidates: [...new Set(discovery)].sort(),
  failures,
}, null, 2));

if (failures.length) {
  console.error(`\n${failures.length} source-truth presentation invariant(s) failed:`);
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log('\nCanonical static presentation repair shims are retired; live-state discovery remains informational.');

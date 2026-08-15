#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';

const root = resolve(process.cwd());
const read = path => readFileSync(resolve(root, path), 'utf8');
const retiredRepairPaths = [
  'public/app/installer-repair-only-v1.js',
  'public/app/installer-online-fallback-v225.js',
  'public/service-worker-shell-repair-v225.js',
];

const rules = [
  {
    path: 'public/app/civweave-brand.js',
    forbid: [
      [/\bnew\s+MutationObserver\s*\(/, 'brand runtime must not observe and rewrite the DOM'],
      [/\bcreateTreeWalker\s*\(/, 'brand runtime must not crawl text nodes'],
      [/\bbrandTree\s*\(/, 'brand runtime must not run a tree-wide brand migration'],
      [/replaceAll\(\s*['"](?:COMMONWEAVE|Commonweave)['"]/, 'brand runtime must not rewrite legacy names after paint'],
      [/createElement\s*\(\s*['"]button['"]\s*\)/, 'brand runtime must not create the language control after paint'],
    ],
    require: [[/runtimeBrandRewrite:false/, 'brand runtime declares source-truth branding']],
  },
  {
    path: 'public/app/index.html',
    forbid: [
      [/installer-repair-only-v1|installer-online-fallback-v225/, 'installer source must not load retired repair sidecars'],
    ],
    require: [
      [/data-cw-en-language-control/, 'English installer owns its Japanese language control in source markup'],
      [/>JP<\/button>/, 'English installer source labels the Japanese control before paint'],
      [/host-node-installer-lobby-v1\.js/, 'installer source owns the Hub lobby directly'],
      [/hub-recovery-ui-v1\.js/, 'installer source owns Hub recovery UI directly'],
    ],
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

const reviewedDynamic = new Map([
  ['public/app/anarchadia-local-sovereignty-v146.js', 'Explicit user-authored local sovereignty profiles intentionally alter selected DOM/assets and must follow later matching nodes.'],
  ['public/app/assistant-runtime-v141.js', 'Attaches the live assistant controller to dialogs that are genuinely created later; it renders conversation state rather than repairing static presentation.'],
  ['public/app/avatar-expression-director-v343.js', 'Live avatar-expression state deliberately changes visible expressions after model/chat events.'],
  ['public/app/avatar-expression-director-v345.js', 'Current live avatar-expression director; sprite changes are semantic expression state, not neutral-art repair.'],
  ['public/app/cerbanimo-proof-attachments-v165.js', 'User proof attachments and previews are created/updated from live submission state.'],
  ['public/app/civweave-world.js', 'Visual-world renderer owns scene changes and live world imagery; it is a renderer, not a patch over pre-rendered canonical markup.'],
  ['public/app/cw-reward-legacy-bridge-v2.js', 'Data/runtime compatibility bridge patches reward APIs and injects itself into dynamically loaded legacy iframes; it does not repair static page presentation.'],
  ['public/app/cw-reward-surfaces-v2.js', 'Live reward balances and ledger surfaces update as reward state changes.'],
  ['public/app/guide-workspace-v242.js', 'Canonical live chat workspace renders messages, persona state, and model activity.'],
  ['public/app/host-node-v124.js', 'Host-node connection/status UI changes with actual network and node state.'],
  ['public/app/hub-mail-claim-v1.js', 'Mail-claim UI is created/updated from asynchronous account recovery state.'],
  ['public/app/hub-recovery-ui-v1.js', 'Recovery UI reflects genuine recovery workflow state and dynamically discovered account data.'],
  ['public/app/pwa-install-prompt-v246.js', 'Legacy install-prompt runtime reflects browser beforeinstallprompt/appinstalled state.'],
  ['public/app/pwa-install-prompt-v247.js', 'Legacy install-prompt runtime reflects browser beforeinstallprompt/appinstalled state.'],
  ['public/app/pwa-install-prompt-v248.js', 'Legacy install-prompt runtime reflects browser beforeinstallprompt/appinstalled state.'],
  ['public/app/pwa-install-prompt-v249.js', 'Current install-prompt runtime updates controls from real browser install availability and install completion.'],
  ['public/app/shared-intention-party-chat-v1.js', 'Party chat renders newly arriving messages and participant state.'],
  ['public/app/shared-review-surface-v234.js', 'Review surface renders live pending/approved/rejected action state.'],
  ['public/app/shared/visual-shell-cleanup.js', 'Realm visual-shell renderer mounts the actual illustrated shell into intentionally empty render hosts; source pages do not contain fake classic UI to replace.'],
]);

const failures = [];
for (const path of retiredRepairPaths) if (existsSync(resolve(root, path))) failures.push(`${path}: retired runtime repair/tombstone file must be absent`);
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

const candidates = [...new Set(discovery)].sort();
const unclassified = candidates.filter(path => !reviewedDynamic.has(path));
for (const path of unclassified) failures.push(`${path}: observer+rewrite runtime is not classified as legitimate live state or explicit customization`);
const classifiedDynamic = candidates.map(path => ({ path, rationale: reviewedDynamic.get(path) || null }));

console.log(JSON.stringify({
  schema: 'civweave.presentation-source-truth.v5',
  enforcedFiles: rules.map(rule => rule.path),
  retiredRepairPaths,
  classifiedDynamic,
  unclassifiedCandidates: unclassified,
  failures,
}, null, 2));

if (failures.length) {
  console.error(`\n${failures.length} source-truth presentation invariant(s) failed:`);
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log('\nCanonical static presentation repair shims are retired. Every remaining observer+rewrite candidate is explicitly classified as live state, a renderer, compatibility data plumbing, or user-authored customization.');
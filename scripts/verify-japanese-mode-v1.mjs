import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
await import('./verify-settings-freeze-recovery-v296.mjs');

const root=process.cwd();
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};

const runtime=read('public/app/japanese-mode-v1.js');
const shellCopy=read('public/app/japanese-shell-copy-v1.js');
const languageSettings=read('public/app/language-settings-v1.js');
const settingsGateway=read('public/app/settings-gateway-v317.js');
const brand=read('public/app/civweave-brand.js');
const installedEntry=read('public/app/installed-entry-v146.html');
const codeCache=read('public/service-worker-code-coherence-v288.js');
const worker=read('public/service-worker-v203.js');
const guard=read('public/app/working-campus-return-guard-v425.js');
const cerbanimo=read('public/app/services/cerbanimo/index.html');
const fellowfare=read('public/app/services/fellowfare/index.html');
const anarchadia=read('public/app/services/anarchadia/index.html');
const livingSchool=read('public/app/cabinets/living-school/index.html');
const japaneseEntry=read('public/ja/index.html');

for(const [name,source] of [['Japanese runtime',runtime],['Japanese shell copy',shellCopy],['Language settings',languageSettings],['Settings gateway',settingsGateway],['Brand runtime',brand]]){
  try{new Function(source)}catch(error){throw new Error(`${name} does not compile: ${error.message}`)}
}

assert(runtime.includes("kanji:'民織'"),'Civweave Japanese kanji branding is missing.');
assert(runtime.includes("katakana:'シヴウィーヴ'"),'Civweave katakana branding is missing.');
assert(runtime.includes("kanji:'神織'"),'Cerbanimo Japanese kanji branding is missing.');
assert(runtime.includes("katakana:'セルバニモ'"),'Cerbanimo katakana branding is missing.');
assert(runtime.includes("trimmed.includes('Cerbanimo')")&&runtime.includes("神織（セルバニモ / Cerbanimo）"),'Cerbanimo references in Japanese prose are not localized.');
assert(runtime.includes("data-cw-ja-name=\"cerbanimo\"")||runtime.includes("data-cw-ja-name=\\\"cerbanimo\\\""),'Cerbanimo logo-adjacent branding hook is missing.');
assert(runtime.includes("LANGUAGE_KEY='civweave.language.v1'"),'Japanese mode persistence key is missing.');
assert(runtime.includes("params.get('lang')")||runtime.includes("searchParams.get('lang')"),'Japanese mode does not accept a shareable lang query.');

assert(japaneseEntry.includes("localStorage.setItem('civweave.language.v1','ja')"),'Shareable Japanese entrypoint does not persist Japanese mode.');
assert(japaneseEntry.includes("installed?'/app/installed-entry-v146.html':'/app/index.html'"),'Japanese share route does not respect the install-only PWA boundary.');
assert(japaneseEntry.includes("target.searchParams.set('lang','ja')"),'Shareable Japanese entrypoint does not activate lang=ja.');
assert(!japaneseEntry.includes("new URL('/app/working-campus-v156.html'"),'Japanese browser share route still falls into the Working Campus install redirect.');

assert(brand.includes("JAPANESE_RUNTIME='/app/japanese-mode-v1.js"),'Installer branding does not load Japanese mode from the persisted preference.');
assert(brand.includes("JAPANESE_SHELL_COPY='/app/japanese-shell-copy-v1.js"),'Installer branding does not load Japanese installer copy.');
assert(brand.includes("localStorage.getItem(LANGUAGE_KEY)==='ja'"),'Installer locale bootstrap does not honor the saved language.');
assert(installedEntry.includes('/app/japanese-mode-v1.js'),'Installed PWA entry does not load Japanese mode.');
assert(installedEntry.includes('/app/japanese-shell-copy-v1.js'),'Installed PWA boot does not localize Japanese shell copy.');
assert(installedEntry.includes("if(params.get('lang'))installer.searchParams.set('lang',params.get('lang'))"),'Installed-entry browser fallback loses the requested language.');
assert(shellCopy.includes("['Installed campus','インストール済みキャンパス']"),'Installed PWA boot translation is missing.');
assert(shellCopy.includes("['Install Civweave','Civweave をインストール']"),'Japanese installer install action is missing.');
assert(shellCopy.includes("jp.textContent='神織 · セルバニモ'"),'Japanese installer does not place Cerbanimo Japanese branding beside the steward mark.');
assert(shellCopy.includes("if(strong.textContent!=='Cerbanimo')strong.textContent='Cerbanimo'"),'Japanese installer steward branding must be idempotent so its MutationObserver cannot feed itself.');
assert(shellCopy.includes("if(!strong.hasAttribute('data-cw-ja-skip'))strong.dataset.cwJaSkip=''"),'Japanese installer steward skip marker must not be rewritten on every observer pass.');

assert(languageSettings.includes("LANGUAGE_KEY='civweave.language.v1'"),'Language setting does not use the canonical language preference.');
assert(languageSettings.includes('Language / 言語'),'Settings language row is missing.');
assert(languageSettings.includes('data-cw-language-option="en"')&&languageSettings.includes('data-cw-language-option="ja"'),'Settings does not expose both English and Japanese.');
assert(languageSettings.includes("inputOwnership:false")&&languageSettings.includes("settingsLauncherOwnership:false"),'Language controls incorrectly claim Settings input ownership.');
assert(languageSettings.includes("inferenceWork:'none'"),'Language controls do not explicitly preserve inference dormancy.');
assert(!languageSettings.includes("document.addEventListener('click'"),'Language settings added a parallel document click owner.');
assert(!/prototype\s*[.\[]/.test(languageSettings),'Language settings patch a browser prototype.');
assert(!languageSettings.includes('MutationObserver'),'Language settings add a global observer to the freeze-sensitive Settings path.');
assert(settingsGateway.includes("const LANGUAGE_SETTINGS='/app/language-settings-v1.js'"),'Canonical Settings gateway does not lazy-load language controls.');
assert(settingsGateway.includes('afterPaint(()=>void ensureLanguageSettings(layer))'),'Language controls are not mounted after Settings paints.');
assert(settingsGateway.includes('afterPaint(()=>void ensureManagement(layer))'),'Settings management lost its existing after-paint boundary.');
assert(settingsGateway.includes("launchWork:'none'")&&settingsGateway.includes('inputOwner:true'),'Canonical Settings gateway ownership changed.');

for(const asset of ['/app/language-settings-v1.js','/app/japanese-mode-v1.js','/app/japanese-shell-copy-v1.js'])assert(codeCache.includes(`'${asset}'`),`${asset} is not pinned for offline first-launch use.`);
assert(worker.includes('code-coherence-v288-language-v1'),'Top-level service worker does not refresh the language-aware code cache.');

assert(guard.includes('/app/japanese-mode-v1.js'),'Working Campus does not load Japanese mode.');
assert(guard.includes("target.searchParams.set('lang','ja')"),'Working Campus recovery does not preserve Japanese mode.');
assert(guard.includes('activateLanguageMode()'),'Working Campus does not activate language mode at boot.');
for(const [label,source] of [['Cerbanimo',cerbanimo],['FellowFare',fellowfare],['Anarchadia',anarchadia],['Living School',livingSchool]])assert(source.includes('japanese-mode-v1.js'),`${label} does not preserve Japanese mode.`);
assert(cerbanimo.includes('data-civweave-system="cerbanimo"'),'Cerbanimo realm entry is missing its system identity for Japanese branding.');

console.log('Japanese mode v1 verification passed.');
console.log('Branding: 民織 / シヴウィーヴ / Civweave; 神織 / セルバニモ / Cerbanimo');
console.log('Cerbanimo prose references: 神織（セルバニモ / Cerbanimo）');
console.log('Share route: /ja/ -> Japanese installer in browser -> Japanese installed PWA');
console.log('Settings: one canonical launcher owner; language controls mount after paint with no inference work.');

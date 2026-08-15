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
const releaseVersion=read('public/app/release-version-v1.js');
const installedEntry=read('public/app/installed-entry-v146.html');
const codeCache=read('public/service-worker-code-coherence-v288.js');
const worker=read('public/service-worker-v203.js');
const guard=read('public/app/working-campus-return-guard-v425.js');
const cerbanimo=read('public/app/services/cerbanimo/index.html');
const fellowfare=read('public/app/services/fellowfare/index.html');
const anarchadia=read('public/app/services/anarchadia/index.html');
const livingSchool=read('public/app/cabinets/living-school/index.html');
const japaneseEntry=read('public/ja/index.html');

for(const [name,source] of [['Japanese runtime',runtime],['Japanese shell copy',shellCopy],['Language settings facade',languageSettings],['Settings gateway',settingsGateway],['Brand runtime',brand],['Release/version realm locale bootstrap',releaseVersion]]){
  try{new Function(source)}catch(error){throw new Error(`${name} does not compile: ${error.message}`)}
}

assert(runtime.includes("const VERSION='japanese-mode-v3'"),'Japanese localization v3 runtime marker is missing.');
assert(shellCopy.includes("const VERSION='japanese-shell-copy-v4-guild-terminology'"),'Japanese installer/boot shell Guild terminology marker is missing.');
assert(runtime.includes("kanji:'民織'")&&runtime.includes("katakana:'シヴウィーヴ'"),'Civweave Japanese branding is missing.');
assert(runtime.includes("kanji:'生学舎'")&&runtime.includes("katakana:'リビング・スクール'"),'Living School Japanese branding is missing.');
assert(runtime.includes("kanji:'神織'")&&runtime.includes("katakana:'セルバニモ'"),'Cerbanimo Japanese branding is missing.');
assert(runtime.includes("kanji:'共市'")&&runtime.includes("katakana:'フェローフェア'"),'FellowFare Japanese branding is missing.');
assert(runtime.includes("kanji:'自治郷'")&&runtime.includes("katakana:'アナーケイディア'"),'Anarchadia Japanese branding is missing.');
assert(runtime.includes("LANGUAGE_KEY='civweave.language.v1'"),'Japanese mode persistence key is missing.');
assert(runtime.includes("params.get('lang')")||runtime.includes("searchParams.get('lang')"),'Japanese mode does not accept a shareable lang query.');

for(const [english,japanese,label] of [
  ['What is your wish?','あなたの願いは？','Working Campus'],
  ['Living School did not finish opening','生学舎の起動が完了しませんでした','Living School'],
  ['New Quest','新しいクエスト','Cerbanimo'],
  ['FELLOWFARE MARKET','共市マーケット','FellowFare'],
  ['CIVIC PULSE','市民パルス','Anarchadia'],
  ['Build reviewable weave','レビューできる織りを作る','planner'],
  ['Search actual listings','実際の出品を検索','marketplace'],
  ['OPEN PROPOSALS','公開中の提案','governance'],
  ['Account, Passports & recovery','アカウント、パスポート、復旧','Passport account'],
  ['Use passkey','パスキーを使用','Passport passkey'],
  ['Offline map','オフライン地図','legacy Hub map terminology'],
  ['Auto coverage on','自動カバレッジ：オン','offline map'],
  ['UNIVERSAL AI SETTINGS','共通AI設定','AI settings'],
  ['Choose the Compass mind','コンパスの頭脳を選ぶ','AI settings'],
  ['Join a Civweave Hub Node','民織のハブノードに参加','legacy cached Hub installer'],
  ['Nearest Hubs with open slots','空き枠のある最寄りのハブ','legacy cached Hub finder'],
  ['Read Terms of Service','利用規約を読む','legal consent'],
  ['Agree and continue','同意して続ける','legal consent']
])assert(runtime.includes(`[${JSON.stringify(english)},${JSON.stringify(japanese)}]`)||runtime.includes(`['${english}','${japanese}']`),`${label} representative Japanese copy is missing.`);

for(const [english,japanese,label] of [
  ['Join a Civweave Guild','民織のギルドに参加','Guild installer shell'],
  ['Nearest Guilds with open slots','空き枠のある最寄りのギルド','Guild finder shell'],
  ['Guildkeeper tools','ギルドキーパー用ツール','Guildkeeper tools shell'],
  ['Use this Guild','このギルドを使用','Guild selection shell'],
  ['Use my approximate location','おおよその位置情報を使う','Guild finder shell'],
  ['Offline campus download','オフラインキャンパスのダウンロード','installer shell']
])assert(shellCopy.includes(`[${JSON.stringify(english)},${JSON.stringify(japanese)}]`)||shellCopy.includes(`['${english}','${japanese}']`),`${label} representative Japanese copy is missing.`);
for(const retired of ['Join a Civweave Hub Node','Nearest Hubs with open slots','Hub steward tools','Use this Hub Node','Find an open Hub'])assert(!shellCopy.includes(`['${retired}'`)&&!shellCopy.includes(`[${JSON.stringify(retired)},`),`Japanese installer shell still contains retired Hub copy: ${retired}`);

assert(runtime.includes('Add \\$([0-9]+(?:\\.[0-9]{1,2})?) live credit'),'Japanese v3 does not translate dynamic live-credit amounts.');
assert(runtime.includes('Map v1 check failed'),'Japanese v3 does not translate dynamic map-check failures.');
assert(runtime.includes('Hub returned HTTP'),'Japanese v3 does not translate dynamic legacy Hub HTTP status copy.');
assert(runtime.includes("const SKIP_TEXT_SELECTOR='script,style,noscript,textarea,input,pre,code"),'Japanese mode no longer protects entered textarea/input text.');
assert(runtime.includes("const SKIP_ELEMENT_SELECTOR='script,style,noscript,pre,code")&&!runtime.includes("const SKIP_ELEMENT_SELECTOR='script,style,noscript,textarea,input,select,option"),'Japanese mode still skips form labels/options and cannot localize them.');
assert(runtime.includes("['aria-label','title','placeholder']"),'Japanese mode does not localize accessible labels/placeholders.');
assert(runtime.includes('characterData:true'),'Japanese mode does not translate live-updating static UI copy.');
assert(runtime.includes('translationCount:EXACT_TRANSLATIONS.size'),'Japanese mode does not expose exact translation coverage metadata.');
assert(runtime.includes('patternCount:PATTERN_TRANSLATIONS.length'),'Japanese mode does not expose dynamic pattern translation coverage.');
assert(runtime.includes('phraseCount:STATIC_PHRASE_TRANSLATIONS.length'),'Japanese mode does not expose safe phrase translation coverage.');
assert(runtime.includes(".message.user"),'Japanese mode does not explicitly protect user-authored chat messages.');

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

// Language state helpers are a facade. The one visible language row belongs to the canonical Settings menu.
assert(languageSettings.includes("LANGUAGE_KEY='civweave.language.v1'"),'Language settings facade does not use the canonical language preference.');
assert(languageSettings.includes("canonical:'CivweaveSettingsV320'"),'Language settings facade does not identify the canonical Settings owner.');
assert(languageSettings.includes("inputOwnership:false")&&languageSettings.includes("presentationOwnership:false")&&languageSettings.includes("settingsLauncherOwnership:false"),'Language compatibility facade incorrectly claims Settings ownership.');
assert(languageSettings.includes("inferenceWork:'none'"),'Language compatibility facade does not explicitly preserve inference dormancy.');
assert(!languageSettings.includes("document.addEventListener('click'"),'Language settings added a parallel document click owner.');
assert(!/prototype\s*[.\[]/.test(languageSettings),'Language settings patch a browser prototype.');
assert(!languageSettings.includes('MutationObserver'),'Language settings add a global observer to the freeze-sensitive Settings path.');
assert(!languageSettings.includes('document.createElement'),'Language compatibility facade regained presentation DOM creation.');
assert(settingsGateway.includes('Language / 言語'),'Canonical Settings language row is missing.');
assert(settingsGateway.includes('data-cw-language-option="en"')&&settingsGateway.includes('data-cw-language-option="ja"'),'Canonical Settings does not expose both English and Japanese.');
assert(settingsGateway.includes('data-cw-language-settings="v320"'),'Canonical Settings language section marker is missing.');
assert(settingsGateway.includes('languageBuiltIn:true'),'Canonical Settings no longer declares built-in language ownership.');
assert(!settingsGateway.includes("const LANGUAGE_SETTINGS='/app/language-settings-v1.js'"),'Canonical Settings reintroduced language as an after-the-fact panel module.');
assert(settingsGateway.includes('afterPaint(()=>void ensureManagement(layer))'),'Settings management lost its existing after-paint boundary.');
assert(settingsGateway.includes("launchWork:'none'")&&settingsGateway.includes('inputOwner:true,presentationOwner:true,credentialOwner:true'),'Canonical Settings ownership changed.');

assert(releaseVersion.includes("const JAPANESE_RUNTIME='/app/japanese-mode-v1.js'"),'Canonical realm bootstrap does not know the Japanese runtime.');
assert(releaseVersion.includes('function wantsJapanese()'),'Canonical realm bootstrap does not honor the language preference.');
assert(releaseVersion.includes('void ensureLanguageRuntime();'),'Canonical realm bootstrap does not activate Japanese before skipping realm release mutation.');
assert(releaseVersion.includes("japaneseBootstrap:'preference-only'"),'Canonical realm Japanese bootstrap contract is missing.');
for(const asset of ['/app/language-settings-v1.js','/app/japanese-mode-v1.js','/app/japanese-shell-copy-v1.js'])assert(codeCache.includes(`'${asset}'`),`${asset} is not pinned for offline first-launch use.`);
assert(codeCache.includes('code-coherence-v288-language-v2'),'Code-coherence cache no longer includes the established Japanese localization cache boundary.');
assert(worker.includes('code-coherence-v288-language-v2'),'Top-level service worker no longer includes the established Japanese localization cache boundary.');
assert(guard.includes('/app/japanese-mode-v1.js'),'Working Campus does not load Japanese mode.');
assert(guard.includes("target.searchParams.set('lang','ja')"),'Working Campus recovery does not preserve Japanese mode.');
assert(guard.includes('activateLanguageMode()'),'Working Campus does not activate language mode at boot.');
for(const [label,source] of [['Cerbanimo',cerbanimo],['FellowFare',fellowfare],['Anarchadia',anarchadia],['Living School',livingSchool]])assert(source.includes('japanese-mode-v1.js'),`${label} pocket/entry surface does not preserve Japanese mode.`);
assert(cerbanimo.includes('data-civweave-system="cerbanimo"'),'Cerbanimo realm entry is missing its system identity for Japanese branding.');

console.log('Japanese mode v3 verification passed.');
console.log('Branding: 民織 / シヴウィーヴ; 生学舎 / リビング・スクール; 神織 / セルバニモ; 共市 / フェローフェア; 自治郷 / アナーケイディア');
console.log('Coverage: Working Campus + realms + Guild installer + Passport/passkeys + maps + AI settings + legal/permission surfaces.');
console.log('Dynamic copy: exact + pattern + safe static phrase translation; user-authored text remains untouched.');
console.log('Share route: /ja/ -> Japanese installer in browser -> Japanese installed PWA');
console.log('Settings: one canonical menu owns language controls directly; compatibility facade has no presentation/input ownership.');

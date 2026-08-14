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
const japaneseEntry=read('public/ja/index.html');
const codeCache=read('public/service-worker-code-coherence-v288.js');
const worker=read('public/service-worker-v203.js');
const guard=read('public/app/working-campus-return-guard-v425.js');
const canonicalRealms={
  civweave:read('public/app/working-campus-v156.html'),
  'living-school':read('public/app/cabinets/living-school/index.html'),
  cerbanimo:read('public/app/realm-console-v140.html'),
  fellowfare:read('public/app/fellowfare-cabinet-v144.html'),
  anarchadia:read('public/app/anarchadia-console-v139.html')
};

for(const [name,source] of [['Japanese runtime',runtime],['Japanese shell copy',shellCopy],['Language settings',languageSettings],['Settings gateway',settingsGateway],['Brand runtime',brand],['Release/version locale bootstrap',releaseVersion]]){
  try{new Function(source)}catch(error){throw new Error(`${name} does not compile: ${error.message}`)}
}
for(const [kanji,katakana,label] of [['民織','シヴウィーヴ','Civweave'],['生学舎','リビング・スクール','Living School'],['神織','セルバニモ','Cerbanimo'],['共市','フェローフェア','FellowFare'],['自治郷','アナーケイディア','Anarchadia']]){
  assert(runtime.includes(`kanji:'${kanji}'`)&&runtime.includes(`katakana:'${katakana}'`),`${label} Japanese branding is missing.`);
}
assert(runtime.includes("const VERSION='japanese-mode-v3'"),'Japanese localization v3 marker is missing.');
assert(runtime.includes("LANGUAGE_KEY='civweave.language.v1'"),'Japanese language persistence key is missing.');
assert(runtime.includes("['aria-label','title','placeholder']"),'Japanese mode must localize accessible labels and placeholders.');
assert(runtime.includes('characterData:true'),'Japanese mode must translate live-updating static UI copy.');
assert(runtime.includes('.message.user'),'Japanese mode must protect user-authored chat text.');
for(const [english,japanese,label] of [
  ['What is your wish?','あなたの願いは？','Civweave'],['Living School did not finish opening','生学舎の起動が完了しませんでした','Living School'],
  ['New Quest','新しいクエスト','Cerbanimo'],['FELLOWFARE MARKET','共市マーケット','FellowFare'],['CIVIC PULSE','市民パルス','Anarchadia'],
  ['UNIVERSAL AI SETTINGS','共通AI設定','Settings'],['Join a Civweave Hub Node','民織のハブノードに参加','Hub installer']
])assert(runtime.includes(`[${JSON.stringify(english)},${JSON.stringify(japanese)}]`)||runtime.includes(`['${english}','${japanese}']`),`${label} representative Japanese copy is missing.`);

assert(japaneseEntry.includes("localStorage.setItem('civweave.language.v1','ja')"),'Japanese share entry must persist Japanese mode.');
assert(japaneseEntry.includes("target.searchParams.set('lang','ja')"),'Japanese share entry must activate lang=ja.');
assert(installedEntry.includes('/app/japanese-mode-v1.js'),'Installed entry must load Japanese mode.');
assert(installedEntry.includes('/app/japanese-shell-copy-v1.js'),'Installed entry must load Japanese shell copy.');
assert(brand.includes("JAPANESE_RUNTIME='/app/japanese-mode-v1.js"),'Installer branding must know the Japanese runtime.');
assert(shellCopy.includes("jp.textContent='神織 · セルバニモ'"),'Japanese installer must show Cerbanimo Japanese branding.');
assert(languageSettings.includes('Language / 言語'),'Settings language row is missing.');
assert(languageSettings.includes('data-cw-language-option="en"')&&languageSettings.includes('data-cw-language-option="ja"'),'Settings must expose English and Japanese.');
assert(languageSettings.includes("inferenceWork:'none'"),'Changing language must not start inference.');
assert(!languageSettings.includes("document.addEventListener('click'"),'Language settings must not create a parallel document input owner.');
assert(!languageSettings.includes('MutationObserver'),'Language settings must not add a global observer.');
assert(settingsGateway.includes("const LANGUAGE_SETTINGS='/app/language-settings-v1.js'"),'Canonical Settings gateway must lazy-load language controls.');
assert(releaseVersion.includes("const JAPANESE_RUNTIME='/app/japanese-mode-v1.js'"),'Canonical realm bootstrap must know the Japanese runtime.');
assert(releaseVersion.includes('function wantsJapanese()'),'Canonical realm bootstrap must honor the language preference.');
for(const asset of ['/app/language-settings-v1.js','/app/japanese-mode-v1.js','/app/japanese-shell-copy-v1.js'])assert(codeCache.includes(`'${asset}'`),`${asset} is not pinned for offline first-launch use.`);
assert(worker.includes('code-coherence-v288-language-v2'),'Top-level service worker lost Japanese localization cache coherence.');
assert(guard.includes('/app/japanese-mode-v1.js')&&guard.includes('activateLanguageMode()'),'Working Campus recovery must preserve Japanese mode.');

for(const [system,source] of Object.entries(canonicalRealms)){
  assert(/<!doctype html>/i.test(source),`${system} canonical realm is not an HTML entry.`);
  assert(source.includes('/app/install-boundary-v146.js')||system==='civweave',`${system} canonical realm lost the shared install/locale boundary.`);
}
assert(canonicalRealms.cerbanimo.includes('/app/realm-console-v140.js'),'Cerbanimo Japanese verification must target the canonical realm console, not a retired service index.');
assert(canonicalRealms.fellowfare.includes('/app/fellowfare-cabinet-v144.js'),'FellowFare Japanese verification must target the canonical cabinet, not a retired service index.');
assert(canonicalRealms.anarchadia.includes('/app/anarchadia-console-v139.js'),'Anarchadia Japanese verification must target the canonical console, not a retired service index.');
for(const retired of ['public/app/services/cerbanimo/index.html','public/app/services/living-school/index.html','public/app/services/fellowfare/index.html','public/app/services/anarchadia/index.html'])assert(!fs.existsSync(path.join(root,retired)),`Japanese verification must not resurrect retired realm entry ${retired}.`);

console.log('Japanese mode v3 verification passed on the canonical five realm screens.');

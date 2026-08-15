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
const campus=read('public/app/working-campus-v156.js');
const campusHtml=read('public/app/working-campus-v156.html');
const installedEntry=read('public/app/installed-entry-v146.html');
const workerCore=read('public/service-worker-core-v208.js');
const japaneseEntry=read('public/ja/index.html');

for(const [name,source] of [['Japanese runtime',runtime],['Japanese shell copy',shellCopy],['Language settings',languageSettings],['Settings gateway',settingsGateway],['Working Campus',campus]]) {
  try{new Function(source)}catch(error){throw new Error(`${name} does not compile: ${error.message}`)}
}

assert(runtime.includes("const VERSION='japanese-mode-v3'"),'Japanese localization v3 marker is missing.');
for(const [kanji,katakana] of [['民織','シヴウィーヴ'],['生学舎','リビング・スクール'],['神織','セルバニモ'],['共市','フェローフェア'],['自治郷','アナーケイディア']])
  assert(runtime.includes(`kanji:'${kanji}'`)&&runtime.includes(`katakana:'${katakana}'`),`Japanese brand pair ${kanji}/${katakana} is missing.`);

assert(runtime.includes("LANGUAGE_KEY='civweave.language.v1'"),'Japanese mode persistence key is missing.');
assert(runtime.includes("params.get('lang')")||runtime.includes("searchParams.get('lang')"),'Japanese mode does not accept lang query.');
assert(runtime.includes('.message.user'),'Japanese mode does not protect user-authored messages.');

assert(languageSettings.includes('Language / 言語'),'Settings language row is missing.');
assert(languageSettings.includes('data-cw-language-option="en"')&&languageSettings.includes('data-cw-language-option="ja"'),'Settings does not expose both languages.');
assert(languageSettings.includes("inferenceWork:'none'"),'Language settings do not preserve inference dormancy.');
assert(!languageSettings.includes("document.addEventListener('click'"),'Language settings added a parallel Settings owner.');

assert(campus.includes("load('/app/japanese-mode-v1.js?v=interface-rebase-v1'"),'Working Campus does not activate Japanese mode from the static runtime.');
assert(campus.includes("q.get('lang')")&&campus.includes("localStorage.setItem(LANG,raw)"),'Working Campus does not persist shareable Japanese mode.');
assert(!/working-campus-return-guard-v425|document-lifecycle-v221/.test(campusHtml),'Japanese Working Campus still depends on retired recovery layers.');

assert(campusHtml.includes('/app/language-settings-v1.js'),'Working Campus does not statically load language settings.');
assert(settingsGateway.includes('CivweaveLanguageSettingsV1?.mount'),'Settings gateway does not mount the static language controls.');
assert(settingsGateway.includes("managementActivation:'explicit-secondary-action'"),'Local AI management is no longer explicit.');
assert(settingsGateway.includes("launchWork:'none'")&&settingsGateway.includes('inputOwner:true'),'Settings gateway ownership changed.');

assert(japaneseEntry.includes("localStorage.setItem('civweave.language.v1','ja')"),'Japanese entrypoint does not persist language.');
assert(japaneseEntry.includes("target.searchParams.set('lang','ja')"),'Japanese entrypoint does not preserve lang=ja.');
assert(installedEntry.includes('/app/japanese-mode-v1.js'),'Installed entry does not load Japanese mode.');

for(const asset of ['/app/working-campus-v156.html','/app/working-campus-v156.js','/app/settings-gateway-v317.js','/app/model-settings-controller-v173.js'])
  assert(workerCore.includes(`'${asset}'`),`${asset} is not in the offline shell.`);

console.log(JSON.stringify({
  ok:true,
  revision:'japanese-mode-v3-interface-rebase-v1',
  brands:['民織','生学舎','神織','共市','自治郷'],
  workingCampusStaticRuntime:true,
  languageShareRoute:true,
  settingsInputOwner:'settings-gateway-v317',
  inferenceOnSettingsOpen:false
},null,2));

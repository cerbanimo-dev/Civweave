import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root=process.cwd();
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};

const runtime=read('public/app/japanese-mode-v1.js');
const guard=read('public/app/working-campus-return-guard-v425.js');
const cerbanimo=read('public/app/services/cerbanimo/index.html');
const fellowfare=read('public/app/services/fellowfare/index.html');
const anarchadia=read('public/app/services/anarchadia/index.html');
const livingSchool=read('public/app/cabinets/living-school/index.html');
const japaneseEntry=read('public/ja/index.html');

assert(runtime.includes("kanji:'民織'"),'Civweave Japanese kanji branding is missing.');
assert(runtime.includes("katakana:'シヴウィーヴ'"),'Civweave katakana branding is missing.');
assert(runtime.includes("kanji:'神織'"),'Cerbanimo Japanese kanji branding is missing.');
assert(runtime.includes("katakana:'セルバニモ'"),'Cerbanimo katakana branding is missing.');
assert(runtime.includes("trimmed.includes('Cerbanimo')")&&runtime.includes("神織（セルバニモ / Cerbanimo）"),'Cerbanimo references in Japanese prose are not localized.');
assert(runtime.includes("data-cw-ja-name=\"cerbanimo\"")||runtime.includes("data-cw-ja-name=\\\"cerbanimo\\\""),'Cerbanimo logo-adjacent branding hook is missing.');
assert(runtime.includes("LANGUAGE_KEY='civweave.language.v1'"),'Japanese mode persistence key is missing.');
assert(runtime.includes("params.get('lang')")||runtime.includes("searchParams.get('lang')"),'Japanese mode does not accept a shareable lang query.');

assert(guard.includes('/app/japanese-mode-v1.js'),'Working Campus does not load Japanese mode.');
assert(guard.includes("target.searchParams.set('lang','ja')"),'Working Campus recovery does not preserve Japanese mode.');
assert(guard.includes('activateLanguageMode()'),'Working Campus does not activate language mode at boot.');

for(const [label,source] of [['Cerbanimo',cerbanimo],['FellowFare',fellowfare],['Anarchadia',anarchadia],['Living School',livingSchool]]){
  assert(source.includes('japanese-mode-v1.js'),`${label} does not preserve Japanese mode.`);
}
assert(cerbanimo.includes('data-civweave-system="cerbanimo"'),'Cerbanimo realm entry is missing its system identity for Japanese branding.');
assert(japaneseEntry.includes("localStorage.setItem('civweave.language.v1','ja')"),'Shareable Japanese entrypoint does not persist Japanese mode.');
assert(japaneseEntry.includes("target.searchParams.set('lang','ja')"),'Shareable Japanese entrypoint does not activate lang=ja.');

console.log('Japanese mode v1 verification passed.');
console.log('Branding: 民織 / シヴウィーヴ / Civweave; 神織 / セルバニモ / Cerbanimo');
console.log('Cerbanimo prose references: 神織（セルバニモ / Cerbanimo）');
console.log('Share route: /ja/');

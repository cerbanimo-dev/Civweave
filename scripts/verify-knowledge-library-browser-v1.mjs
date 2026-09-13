import fs from 'node:fs/promises';

const read=path=>fs.readFile(path,'utf8');
const [html,css,browser,panel,launcher,learningPacks,offline]=await Promise.all([
  read('public/app/knowledge-library-browser-v1.html'),
  read('public/app/knowledge-library-browser-v1.css'),
  read('public/app/knowledge-library-browser-v1.mjs'),
  read('public/app/cabinets/living-school/living-library-panel-v1.js'),
  read('public/app/knowledge-library-launcher-v1.js'),
  read('public/app/living-school-learning-packs-v1.mjs'),
  read('public/app/offline-package-v208.json'),
]);
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
const includes=(source,tokens,label)=>{for(const token of tokens)assert(source.includes(token),`${label} is missing ${token}`)};

includes(html,['id="library-search-form"','id="library-school-filter"','id="library-tier-filter"','id="library-results"','id="library-reader"','Manage downloads','No AI call is required.'],'library browser HTML');
includes(css,['.library-workspace','.library-results','.library-reader','@media(max-width:760px)'],'library responsive CSS');
includes(browser,["import {searchDownloadedKnowledge}","searchDownloadedKnowledge(activeQuery,{limit:100,maxSchools:11})","knowledgeLayer","loadTierIndex(layer)","openSchoolPacks(layer,school.school_slug,{tokens:[],maxPacks:9999})"],'library browser runtime');
includes(panel,['living-library-button','Living Library','knowledge-library-browser-v1.html?embed=living-school','aria-expanded','role','dialog','iframe','No AI call is required.'],'Living Library panel');
includes(learningPacks,["import './cabinets/living-school/living-library-panel-v1.js?v=living-library-v1'",'living-school-learning-packs-v1-living-library'],'Living School library integration');
includes(launcher,["/app/cabinets/living-school/index.html",'livingLibrary','owner:\'living-school\''],'compatibility launcher');
assert(!launcher.includes('MENU_ID'),'Compatibility launcher must not create a Civweave menu library entry.');
assert(!launcher.includes('NAV_ACTIONS_ID'),'Compatibility launcher must not create a Civweave nav library entry.');
assert(!launcher.includes('installButton'),'Compatibility launcher must not create a standalone Library button.');
const offlineManifest=JSON.parse(offline);
for(const path of ['/app/knowledge-library-browser-v1.html','/app/knowledge-library-browser-v1.css','/app/knowledge-library-browser-v1.mjs','/app/knowledge-library-tiers-v1.mjs','/app/cabinets/living-school/living-library-panel-v1.js'])assert(offlineManifest.seeds?.includes(path)||offlineManifest.assets?.includes(path),`Offline campus omits ${path}`);
new Function(panel);new Function(launcher);
console.log(JSON.stringify({livingLibrary:true,owner:'living-school',expandablePanel:true,directBrowse:true,directSearch:true,schoolFilter:true,tierFilter:true,offlineCampus:true,standaloneCivweaveEntry:false},null,2));

import fs from 'node:fs/promises';

const read=path=>fs.readFile(path,'utf8');
const [html,css,browser,panel,launcher,learningPacks,campus,offline,runtime,tiers]=await Promise.all([
  read('public/app/knowledge-library-browser-v1.html'),
  read('public/app/knowledge-library-browser-v1.css'),
  read('public/app/knowledge-library-browser-v1.mjs'),
  read('public/app/cabinets/living-school/living-library-panel-v1.js'),
  read('public/app/knowledge-library-launcher-v1.js'),
  read('public/app/living-school-learning-packs-v1.mjs'),
  read('public/app/working-campus-v156.html'),
  read('public/app/offline-package-v208.json'),
  read('public/app/knowledge-school-runtime-v243.mjs'),
  read('public/app/knowledge-library-tiers-v1.mjs'),
]);
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
const includes=(source,tokens,label)=>{for(const token of tokens)assert(source.includes(token),`${label} is missing ${token}`)};

includes(html,['id="library-search-form"','id="library-school-filter"','id="library-tier-filter"','id="library-results"','id="library-reader"','Manage downloads','No AI call is required.'],'library browser HTML');
includes(css,['.library-workspace','.library-results','.library-reader','@media(max-width:760px)'],'library responsive CSS');
includes(browser,[
  "import {searchDownloadedKnowledge}",
  "import * as tierRuntime",
  "searchDownloadedKnowledge(activeQuery,{limit:100,maxSchools:11})",
  "knowledgeLayer",
  "loadFoundationSchoolIndex",
  "loadTierIndex(layer,filters.school)",
  "api.loadCatalog()",
  "metadataFromResponse",
  "openSchoolPacks(layer,school.school_slug,{tokens:[],maxPacks:9999})",
],'library browser runtime');
assert(browser.includes("activeMode='browse'"),'Library browser must support direct browse mode.');
assert(browser.includes("activeMode='search'"),'Library browser must support direct search mode.');
assert(browser.includes("row.schoolSlug&&matchesFilters"),'Library search must remain scoped to Knowledge School results.');
assert(browser.includes("installed[0]?.school_slug||'all'"),'Library browse must default to one installed school instead of eagerly unpacking every school.');
assert(!browser.includes('const foundationIndex=await loadFoundationIndex()'),'Library status must not unpack every Foundation ZIP on startup.');
assert(browser.includes("foundationCatalogBySlug.get(row.school_slug)?.counts?.articles"),'Library status must use catalog counts without scanning article archives.');

includes(panel,[
  'living-library-button',
  'Living Library',
  'knowledge-library-browser-v1.html?embed=living-school',
  "panel.setAttribute('role','dialog')",
  "button.setAttribute('aria-expanded','false')",
  'No AI call is required.',
  "document.documentElement.dataset.civweaveSystem!=='living-school'",
],'Living Library panel');
includes(learningPacks,[
  "import './cabinets/living-school/living-library-panel-v1.js?v=living-library-v1'",
  'living-school-learning-packs-v1-living-library',
],'Living School library integration');

includes(launcher,["/app/cabinets/living-school/index.html",'livingLibrary',"owner:'living-school'"],'compatibility launcher');
assert(!launcher.includes('MENU_ID'),'Compatibility launcher must not create a Civweave menu library entry.');
assert(!launcher.includes('NAV_ACTIONS_ID'),'Compatibility launcher must not create a Civweave nav library entry.');
assert(!launcher.includes('installButton'),'Compatibility launcher must not create a standalone Library button.');
assert(campus.includes('/app/knowledge-library-launcher-v1.js?v=knowledge-library-browser-v1'),'Working Campus compatibility hook is missing.');

const offlineManifest=JSON.parse(offline);
for(const path of [
  '/app/knowledge-library-browser-v1.html',
  '/app/knowledge-library-browser-v1.css',
  '/app/knowledge-library-browser-v1.mjs',
  '/app/knowledge-library-launcher-v1.js',
  '/app/knowledge-library-tiers-v1.mjs',
  '/app/cabinets/living-school/living-library-panel-v1.js',
])assert(offlineManifest.seeds?.includes(path)||offlineManifest.assets?.includes(path),`Offline campus omits ${path}`);
includes(runtime,['knowledgeLayer:bundle.layer','tierBundles(slug,tokens)'],'Knowledge School runtime');
includes(tiers,['openSchoolPacks','layerStatus','allLayerStatus'],'tier runtime');
new Function(panel);
new Function(launcher);
console.log(JSON.stringify({
  livingLibrary:true,
  owner:'living-school',
  expandablePanel:true,
  directBrowse:true,
  directSearch:true,
  schoolFilter:true,
  tierFilter:true,
  lazySchoolIndex:true,
  offlineCampus:true,
  standaloneCivweaveEntry:false,
  compatibilityRedirect:true,
},null,2));

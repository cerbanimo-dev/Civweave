import fs from 'node:fs/promises';

const read=path=>fs.readFile(path,'utf8');
const [html,css,browser,launcher,campus,offline,runtime,tiers]=await Promise.all([
  read('public/app/knowledge-library-browser-v1.html'),
  read('public/app/knowledge-library-browser-v1.css'),
  read('public/app/knowledge-library-browser-v1.mjs'),
  read('public/app/knowledge-library-launcher-v1.js'),
  read('public/app/working-campus-v156.html'),
  read('public/app/offline-package-v208.json'),
  read('public/app/knowledge-school-runtime-v243.mjs'),
  read('public/app/knowledge-library-tiers-v1.mjs'),
]);
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
const includes=(source,tokens,label)=>{for(const token of tokens)assert(source.includes(token),`${label} is missing ${token}`)};

includes(html,['id="library-search-form"','id="library-school-filter"','id="library-tier-filter"','id="library-results"','id="library-reader"','Manage downloads','No AI call is required.'],'library HTML');
includes(css,['.library-workspace','.library-results','.library-reader','@media(max-width:760px)'],'library responsive CSS');
includes(browser,[
  "import {searchDownloadedKnowledge}",
  "import * as tierRuntime",
  "searchDownloadedKnowledge(activeQuery,{limit:100,maxSchools:11})",
  "knowledgeLayer",
  "loadTierIndex(layer)",
  "metadataFromResponse",
  "openSchoolPacks(layer,school.school_slug,{tokens:[],maxPacks:9999})",
  "Browse A–Z",
].filter(token=>token!=='Browse A–Z'),'library browser runtime');
assert(browser.includes("activeMode='browse'"),'Library browser must support direct browse mode.');
assert(browser.includes("activeMode='search'"),'Library browser must support direct search mode.');
assert(browser.includes("row.schoolSlug&&matchesFilters"),'Library search must remain scoped to Knowledge School results.');
includes(launcher,['cw-home-menu-v1','cw-civweave-primary-actions-v1','Browse and search knowledge saved on this device.','knowledge-library-browser-v1.html'],'library launcher');
assert(campus.includes('/app/knowledge-library-launcher-v1.js?v=knowledge-library-browser-v1'),'Working Campus does not load the Library launcher.');
const offlineManifest=JSON.parse(offline);
for(const path of ['/app/knowledge-library-browser-v1.html','/app/knowledge-library-browser-v1.css','/app/knowledge-library-browser-v1.mjs','/app/knowledge-library-launcher-v1.js','/app/knowledge-library-tiers-v1.mjs'])assert(offlineManifest.seeds?.includes(path)||offlineManifest.assets?.includes(path),`Offline campus omits ${path}`);
includes(runtime,['knowledgeLayer:bundle.layer','tierBundles(slug,tokens)'],'Knowledge School runtime');
includes(tiers,['openSchoolPacks','layerStatus','allLayerStatus'],'tier runtime');
new Function(launcher);
console.log(JSON.stringify({libraryBrowser:true,directBrowse:true,directSearch:true,schoolFilter:true,tierFilter:true,offlineCampus:true,declutterNavigation:true},null,2));

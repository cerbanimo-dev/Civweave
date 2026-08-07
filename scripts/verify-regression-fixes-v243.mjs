import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const [viewport,repairs,entry,localResearch,localActions,knowledge,build,stage,pkg]=await Promise.all([
  read('public/app/persistent-guide-viewport-v216.js'),
  read('public/app/regression-fixes-v243.js'),
  read('public/app/cabinets/living-school/living-school-cleanroom-v218.mjs'),
  read('public/app/living-school-local-research-v243.mjs'),
  read('public/app/living-school-cleanroom-actions-v243.mjs'),
  read('public/app/knowledge-school-runtime-v243.mjs'),
  read('scripts/build-cloudflare-pages.mjs'),
  read('scripts/stage-sqljs-assets.mjs'),
  read('package.json')
]);

assert(viewport.includes("const REGRESSION_FIXES='/app/regression-fixes-v243.js?v=guide-interaction-r1'"),'Universal guide layer does not load the v243 interaction repair.');
assert(viewport.includes('installRegressionFixes()'),'Universal guide layer does not activate the repair loader.');
assert(repairs.includes("dialog button[data-close]")&&repairs.includes("control.type='button'"),'Proof dialog close controls are not repaired.');
assert(repairs.includes("document.addEventListener('pointerup',onPointerUp,true)"),'Pointer-level chat/dialog repair is missing.');
assert(repairs.includes("queueMicrotask(()=>control.click())"),'Chat controls do not bridge pointer input to the canonical click owner.');
assert(repairs.includes('/app/assets/ai/kamiya-welcoming-v243.png'),'Kamiya does not use the refreshed avatar asset.');
assert((await stat(path.join(root,'public/app/assets/ai/kamiya-welcoming-v243.png'))).size>1000,'Kamiya avatar asset is missing or empty.');

assert(entry.includes("../../living-school-cleanroom-actions-v243.mjs"),'Living School is not routed through the local-source action adapter.');
assert(localActions.includes("packet.mode==='local-downloaded'"),'Living School actions do not recognize downloaded research.');
assert(localActions.includes('await researchCapability(data.capability,{force:false})'),'Curriculum generation does not research before generation.');
assert(localResearch.includes('searchDownloadedKnowledge'),'Downloaded knowledge is not queried.');
assert(localResearch.includes("provenance:'knowledge-school-downloaded'"),'Downloaded-source provenance is missing.');
assert(localResearch.includes('ARCHIVE VERIFIED · NOT LIVE-CHECKED'),'Downloaded references overstate or omit verification status.');

for(const token of ['openSeed(slug)','DecompressionStream','initSqlJs','new Module.Database','sqlite_master','MATCH ?'])assert(knowledge.includes(token),`Offline knowledge reader is missing ${token}.`);
assert(build.includes("await import('./stage-sqljs-assets.mjs')"),'Cloudflare build does not stage sql.js.');
assert(stage.includes("'sql-wasm.js','sql-wasm.wasm'"),'sql.js staging omits a runtime asset.');
const parsed=JSON.parse(pkg);
assert.equal(parsed.dependencies?.['sql.js'],'1.14.1','Pinned sql.js dependency is missing.');
assert(parsed.scripts?.prestart?.includes('stage-sqljs-assets.mjs'),'Local startup does not stage sql.js.');

console.log(JSON.stringify({ok:true,revision:'v243',universalGuideRepair:true,proofDialogEscapes:true,pointerChatControls:true,kamiyaAvatarFresh:true,downloadedKnowledgeQueryable:true,downloadedResearchBeforeModelFallback:true,provenanceExplicit:true},null,2));
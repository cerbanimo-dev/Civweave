import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(path,'utf8');
const includes=(source,needle,label)=>assert(source.includes(needle),`${label} is missing ${needle}`);
const before=(source,a,b,label)=>{
  const left=source.indexOf(a),right=source.indexOf(b);
  assert(left>=0,`${label} is missing ${a}`);
  assert(right>=0,`${label} is missing ${b}`);
  assert(left<right,`${label} must place ${a} before ${b}`);
};

const settingsPath='public/app/model-settings-controller-v173.js';
const retirementPath='public/app/local-ai/gemma4-q2-retirement-v1.js';
const browserPackPath='public/app/local-ai/gemma4-browser-pack-coherence-v1.js';
for(const path of [settingsPath,retirementPath,browserPackPath])new vm.Script(read(path),{filename:path});

const settings=read(settingsPath);
includes(settings,"VERSION='1.0.18-model-settings-controller-v173-gemma4-browser-status-sync'",'model settings controller');
includes(settings,"const GEMMA4_FAST_VERSION='1.1.0-gemma4-litert-fast-extension-v1-dual-phone'",'model settings controller');
includes(settings,"const GEMMA4_PHONE_VERSION='1.2.0-gemma4-phone-performance-core-v1-resume-authority'",'model settings controller');
includes(settings,"const GEMMA4_Q2_RETIRE_VERSION='1.0.0-gemma4-q2-retirement-v1'",'model settings controller');
includes(settings,"const GEMMA4_BROWSER_PACK_VERSION='1.0.1-gemma4-browser-pack-coherence-v1-status-sync'",'model settings controller');
includes(settings,"const GEMMA4_BROWSER_PACK_SRC='/app/local-ai/gemma4-browser-pack-coherence-v1.js?v=1.0.1-status-sync'",'model settings controller');
includes(settings,"gemma4PackCore:'litert-current+q4-compatibility'",'model settings controller');
includes(settings,"gemma4FastModel:'gemma4-e2b-it-litert-web'",'model settings controller');
includes(settings,"gemma4DeepModel:'gemma4-e4b-it-litert-web'",'model settings controller');
includes(settings,"gemma4CompatibilityModels:Object.freeze(['gemma4-e2b-it-q4f16','gemma4-e4b-it-q4f16'])",'model settings controller');
includes(settings,"gemma4RetiredModels:Object.freeze(['gemma4-e2b-it-q2f16-mobile','gemma4-e4b-it-q2f16-mobile'])",'model settings controller');
includes(settings,'gemma4Q2OptionalExtension:false','model settings controller');
includes(settings,'gemma4Q2Retired:true','model settings controller');
includes(settings,'gemma4ObsoleteDeleteAction:true','model settings controller');
includes(settings,'gemma4MaxVariantsPerSize:2','model settings controller');
includes(settings,'gemma4BrowserManagedLiteRT:true','model settings controller');
includes(settings,'gemma4MidrangeUsesLiteRT:true','model settings controller');
includes(settings,'gemma4PostImportStatusSync:true','model settings controller');
before(settings,"loadScript(GEMMA4_PACK_SRC", "loadScript(GEMMA4_DEEP_SRC",'settings model boot order');
before(settings,"loadScript(GEMMA4_DEEP_SRC", "loadScript(GEMMA4_ACTIONS_SRC",'settings model boot order');
before(settings,"loadScript(GEMMA4_ACTIONS_SRC", "loadScript(GEMMA4_FAST_SRC",'settings model boot order');
before(settings,"loadScript(GEMMA4_FAST_SRC", "loadScript(GEMMA4_PHONE_SRC",'settings model boot order');
before(settings,"loadScript(GEMMA4_PHONE_SRC", "loadScript(GEMMA4_Q2_RETIRE_SRC",'settings model boot order');
before(settings,"loadScript(GEMMA4_Q2_RETIRE_SRC", "loadScript(GEMMA4_BROWSER_PACK_SRC",'settings model boot order');

const retirement=read(retirementPath);
includes(retirement,"data-gemma4-obsolete-delete>Delete obsolete models",'obsolete-model cleanup UI');
includes(retirement,'data-gemma4-obsolete-replace>Install current phone models','obsolete-model replacement UI');
includes(retirement,'m.select?.(replacement)','safe obsolete-model cleanup');
includes(retirement,'await m.remove(id)','explicit obsolete-model cleanup');
includes(retirement,'q4Preserved:true','obsolete-model cleanup contract');
includes(retirement,'explicitDelete:true','obsolete-model cleanup contract');
includes(retirement,'maxSupportedVariantsPerGemmaSize:2','obsolete-model cleanup contract');
includes(retirement,'function activate(){scheduleDecorate();return true}','obsolete models must not auto-delete');

const browserPack=read(browserPackPath);
includes(browserPack,"VERSION='1.0.1-gemma4-browser-pack-coherence-v1-status-sync'",'Gemma browser handoff');
includes(browserPack,"const FAST_E2='gemma4-e2b-it-litert-web'",'Gemma browser handoff');
includes(browserPack,"const FAST_E4='gemma4-e4b-it-litert-web'",'Gemma browser handoff');
includes(browserPack,"const BRIDGE_SRC='/app/local-ai/browser-pack-download-v1.js?v=1.3.0-progress-and-final-match'",'Gemma browser handoff');
includes(browserPack,'async function syncFastStatus()','Gemma browser handoff post-import sync');
includes(browserPack,'states.push(await m.status(id))','Gemma browser handoff post-import sync');
includes(browserPack,'async function startModelDownload(id,button)','Gemma browser handoff');
includes(browserPack,'async function startPair(button)','Gemma browser handoff');
includes(browserPack,'current.prepare(PREMIER','Gemma browser handoff');
includes(browserPack,'current.markStarted(PREMIER,record.key)','Gemma browser handoff');
includes(browserPack,'current.pickAndImport(PREMIER','Gemma browser handoff');
includes(browserPack,'await syncFastStatus();','Gemma browser handoff post-import sync');
includes(browserPack,"event.stopImmediatePropagation()",'Gemma browser handoff must block legacy direct download listener');
includes(browserPack,"addEventListener('civweave:local-model-pack-installed'",'Gemma browser handoff install event sync');
includes(browserPack,"old Q2F16 files can be deleted after migration",'Premier Phone Pack migration copy');
includes(browserPack,"Gemma 4 E2B LiteRT 2.0 GB · Gemma 4 E4B LiteRT 3.0 GB",'Premier Phone Pack current models');
includes(browserPack,"legacyCacheDownloadDisabled:true",'Gemma browser handoff contract');
includes(browserPack,"midrangeUsesLiteRT:true",'Gemma browser handoff contract');
includes(browserPack,"q4CompatibilityPreserved:true",'Gemma browser handoff contract');
includes(browserPack,"postImportStatusSync:true",'Gemma browser handoff contract');

console.log('PASS Local Models boots LiteRT + Q4, retires Q2, updates the Premier Phone mid-range pack to LiteRT E2B/E4B, routes multi-gigabyte LiteRT downloads through the browser-managed download/import flow instead of the failing legacy Cache Storage path, and immediately synchronizes imported LiteRT models to READY state.');

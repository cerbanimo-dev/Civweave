import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');
const [livingSchool,shell,shellAssets,reportUi,bubble,standalone]=await Promise.all([
  read('public/app/cabinets/living-school/index.html'),
  read('public/app/persistent-system-shell-v1.html'),
  read('public/service-worker-shell-assets-v1.js'),
  read('public/app/living-school-generation-report-ui-v1.js'),
  read('public/app/human-message-bubble-v1.js'),
  read('public/app/human-chat-standalone-v2.js')
]);

const checks=[];
const check=(name,condition)=>{assert.ok(condition,name);checks.push(name)};

const workbenchImport="await import('/app/cabinets/living-school/living-school-cleanroom-v218.mjs?v=structured-single-v221-boot-first-v2')";
const supportWarm='const supportReady=ensureSupportRuntime()';
const importAt=livingSchool.indexOf(workbenchImport);
const warmAt=livingSchool.indexOf(supportWarm);
check('Living School identifies the workbench-first boot revision',livingSchool.includes('data-living-school-revision="structured-single-v221-boot-first-v2"'));
check('workbench renderer starts before generation support warming',importAt>=0&&warmAt>importAt);
check('generation support is no longer a blocking pre-workbench defer chain',!livingSchool.includes('<script src="/app/living-school-generation-budget-v3.js')&&!livingSchool.includes('<script src="/app/living-school-active-run-ui-v2.js')&&!livingSchool.includes('<script src="/app/living-school-generation-report-ui-v1.js'));
for(const path of [
  '/app/minilm-response-router-v347.js',
  '/app/family-ai-loader-v105.js',
  '/app/gemini-task-tier-router-v213.js',
  '/app/living-school-route-lock-v1.js',
  '/app/living-school-grounded-design-v337.js',
  '/app/living-school-grounded-compiler-v336.js',
  '/app/living-school-assessment-curator-v337.js',
  '/app/living-school-runtime-route-v2.js',
  '/app/living-school-generation-budget-v3.js',
  '/app/living-school-active-run-ui-v2.js',
  '/app/living-school-generation-report-ui-v1.js',
  '/app/living-school-pack-offer-authority-v1.js'
])check(`post-boot support list retains ${path}`,livingSchool.includes(`'${path}`));
check('support runtime reports ready only after sequential support loads',livingSchool.includes('for(const src of supportScripts)await loadSupportScript(src)')&&livingSchool.includes("dataset.livingSchoolSupportRuntime='ready'"));
check('support runtime failures cannot return the workbench to the startup card',livingSchool.includes("supportReady.catch(error=>console.warn('[Living School support runtime]',error))"));

check('persistent shell directly owns the human message launcher',shell.includes('/app/human-message-bubble-v1.js?v=1.1.1-human-message-chat-icon'));
check('persistent shell directly owns human chat transport',shell.includes('/app/human-chat-network-v1.js?v=1.0.0-human-chat-network-v1'));
check('persistent shell directly owns guild chat context',shell.includes('/app/human-chat-guild-context-v1.js?v=1.0.2-human-chat-standalone-v2'));
check('human launcher revision matches the directly loaded shell revision',bubble.includes("const VERSION='1.1.1-human-message-chat-icon'"));
check('standalone human chat runtime remains available',standalone.includes("const VERSION='1.0.0-human-chat-standalone-v2'"));

for(const path of [
  '/app/human-message-bubble-v1.js',
  '/app/human-chat-network-v1.js',
  '/app/human-chat-guild-context-v1.js',
  '/app/human-chat-standalone-v2.js'
])check(`installed shell requires ${path}`,shellAssets.includes(`'${path}'`)&&shellAssets.includes('requiredHumanChat:[...REQUIRED_HUMAN_CHAT]'));
check('human chat launcher is no longer classified as optional shell chrome',!shellAssets.match(/const OPTIONAL_HUMAN_CHAT=\[[\s\S]*?'\/app\/human-message-bubble-v1\.js'/));

check('generation report observer is idempotent',reportUi.includes('if(strong.textContent!==next)strong.textContent=next'));
check('generation report dataset write is idempotent',reportUi.includes("if(panel.dataset.providerNeutralReport!=='true')panel.dataset.providerNeutralReport='true'"));

console.log(JSON.stringify({
  ok:true,
  checks:checks.length,
  livingSchoolStartup:'workbench-first',
  generationSupport:'post-ready-warm',
  humanChatLauncher:'persistent-shell-direct',
  offlineHumanChatCore:'required',
  reportObserver:'idempotent'
},null,2));

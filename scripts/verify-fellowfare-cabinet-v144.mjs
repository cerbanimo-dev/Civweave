import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root=process.cwd();
const read=file=>fs.readFile(path.join(root,file),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};

const [cabinetMode,outerHtml,outerJs,innerHtml,innerJs,innerCss,app,ledger,ai,worker,packageRaw]=await Promise.all([
  read('public/app/cabinet-mode-v142.js'),
  read('public/app/fellowfare-cabinet-v144.html'),
  read('public/app/fellowfare-cabinet-v144.js'),
  read('public/app/services/fellowfare/cabinet.html'),
  read('public/app/services/fellowfare/cabinet-bridge.js'),
  read('public/app/services/fellowfare/cabinet-embed.css'),
  read('public/app/services/fellowfare/app.js'),
  read('public/app/services/fellowfare/ledger.js'),
  read('public/app/services/fellowfare/ai.js'),
  read('public/service-worker.js'),
  read('package.json')
]);
const pkg=JSON.parse(packageRaw);

assert(cabinetMode.includes("system?.id==='fellowfare'")&&cabinetMode.includes('/app/fellowfare-cabinet-v144.html'),'Cabinet Mode does not route FellowFare to its dedicated workbench.');
assert(outerHtml.includes('cabinet-home-v142.js')&&outerHtml.includes('fellowfare-cabinet-v144.js'),'Dedicated FellowFare cabinet does not preserve Rook chat and capability routing.');
assert(outerHtml.includes('/app/services/fellowfare/cabinet.html?commonweave=1&cabinet=1#market'),'Dedicated cabinet does not load the pre-visual market engine.');
assert(outerJs.includes('data-ch142-capability')&&outerJs.includes('fellowfare:cabinet-command'),'Rook capability controls are not bridged into the mature market app.');
for(const token of ['styles.css','app.js','cabinet-bridge.js','composerDialog','proposalDialog','messageDialog','ledgerActionDialog'])assert(innerHtml.includes(token),`Pre-visual cabinet surface is missing ${token}.`);
assert(!innerHtml.includes('visual-shell-cleanup.js')&&!innerHtml.includes('commonweave-merlin-chat.js'),'Retired visual shell or duplicate global guide was reintroduced inside FellowFare.');
assert(innerJs.includes("location.hash='market'")&&innerJs.includes('syntheticComposer')&&innerJs.includes('fellowfare:cabinet-ready'),'Cabinet bridge does not boot the market and expose composer commands.');
assert(innerCss.includes('.ff-route-scene-art')&&innerCss.includes('display:none!important'),'Cabinet CSS does not suppress archived mall scene art.');
for(const token of ['function openComposer','function submitThread','function openMessage','function createOrOpenAssembly','function setProposalStatus','function openAgreement','function submitLedgerAction','function exportPack','function mergeExchangeBundle'])assert(app.includes(token),`Mature FellowFare app lost ${token}.`);
for(const token of ['createAgreementFromProposal','addMilestone','addEvidence','recordSettlement','openRepair','resolveRepair','addReview','advanceRecurringAgreement','buildCommonweaveBundle'])assert(ledger.includes(token),`Exchange ledger lost ${token}.`);
for(const token of ['deterministicDraft','deterministicMatches','deterministicReview','deterministicAssembly','deterministicProposal','deterministicProviderProfile','deterministicMarketSignals'])assert(ai.includes(token),`FellowFare Loom lost ${token}.`);
for(const asset of ['/app/fellowfare-cabinet-v144.html','/app/fellowfare-cabinet-v144.css','/app/fellowfare-cabinet-v144.js','/app/services/fellowfare/cabinet.html','/app/services/fellowfare/cabinet-embed.css','/app/services/fellowfare/cabinet-bridge.js','/app/services/fellowfare/styles.css','/app/services/fellowfare/app.js','/app/services/fellowfare/ai.js','/app/services/fellowfare/ledger.js','/app/services/fellowfare/shared/commonweave-model-runtime.js','/app/services/fellowfare/commonweave-handoff-consumer.js'])assert(worker.includes(`'${asset}'`),`Installed device package omits ${asset}.`);
assert(worker.includes("DEVICE_REVISION='device-package-r27-local-sovereignty'"),'Current shared device package revision is not active for the restored realm workbenches.');
assert(pkg.scripts['check:syntax'].includes('fellowfare-cabinet-v144.js')&&pkg.scripts['check:syntax'].includes('cabinet-bridge.js'),'Syntax suite omits FellowFare cabinet scripts.');
assert(pkg.scripts.check.includes('verify-fellowfare-cabinet-v144.mjs'),'Main verification suite omits FellowFare featurefulness.');
console.log(JSON.stringify({ok:true,renderer:'Cabinet Mode',devicePackage:'r27-local-sovereignty',fellowfare:{guide:'Rook',surface:'pre-visual exchange application',restored:['threads','matching','proposals','messages','assemblies','agreements','milestones','evidence','settlement','repair','trust','recurrence','portable bundles'],archivedMallScenesReintroduced:false}},null,2));

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
const root=process.cwd();
const read=file=>fs.readFile(path.join(root,file),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
const [html,css,runtime,loader,consoleHtml,worker,pkgRaw,sourceApp]=await Promise.all([
  read('public/app/services/anarchadia/workbench.html'),
  read('public/app/services/anarchadia/cabinet-workbench-v144.css'),
  read('public/app/anarchadia-cabinet-workbench-v144.js'),
  read('public/app/services/anarchadia/cabinet-workbench-loader-v144.js'),
  read('public/app/anarchadia-console-v139.html'),
  read('public/service-worker.js'),
  read('package.json'),
  read('public/app/services/anarchadia/src/app.js')
]);
const pkg=JSON.parse(pkgRaw),deviceRevision=worker.match(/const DEVICE_REVISION='([^']+)'/)?.[1]||'';
for(const token of ['src/domain.js','src/store.js','cabinet-workbench-loader-v144.js','commonweave-handoff-consumer.js','commonweave-presence.js','Citizen Console'])assert(html.includes(token),`Workbench entry is missing ${token}`);
for(const route of ['overview','charter','proposals','safeguards','exchange','ai','readiness','constitution'])assert(html.includes(`#${route}`)&&runtime.includes(`'${route}'`),`Workbench route ${route} is not wired end to end`);
assert(html.includes('loadWorkspace')&&html.includes('syntheticFixture')&&html.includes("mode:'candidate'")&&html.includes("location.hash='#exchange'"),'Cabinet workbench does not preserve existing, blank, synthetic, and restore paths.');
assert(html.includes("worker.register=async()=>await rootRegistration?.('/')"),'Legacy Anarchadia worker registration is not contained by the root device package.');
assert(css.includes('.cabinet-workbench-return')&&css.includes('.cabinet-workbench-nav')&&css.includes('.visual-main'),'Cabinet workbench styling or navigation is incomplete.');
assert(sourceApp.includes("const visualRequested = true")&&sourceApp.includes("const route = () => VISUAL_ROUTES.has(rawRoute())"),'Verifier no longer recognizes the visual-only source boundary it is meant to adapt.');
assert(loader.includes('VISUAL_ROUTE_BLOCK')&&loader.includes('CABINET_ROUTE_BLOCK')&&loader.includes("CLASSIC_ROUTES.has(rawRoute())")&&loader.includes("new Blob([source]"),'Cabinet compatibility loader does not restore classic route execution safely.');
assert(loader.includes('VISUAL_MODAL_BLOCK')&&loader.includes('CABINET_MODAL_BLOCK')&&loader.includes('cabinet-workbench-modal'),'Cabinet compatibility loader still depends on archived room art for working forms.');
for(const specifier of ['domain.js','store.js','ai.js','export.js'])assert(loader.includes(`/app/services/anarchadia/src/${specifier}`),`Cabinet loader does not absolutize ${specifier}`);
for(const label of ['Charter editor','Proposal deliberation','Rights & safeguards','Exchange, restore & fork','Constitutional AI','Readiness & emergency brake'])assert(runtime.includes(label),`Cabinet feature menu is missing ${label}`);
assert(runtime.includes("[data-action=\"vote-hub\"]")&&runtime.includes("open('proposals')"),'Vote controls do not enter the real proposal workbench.');
assert(consoleHtml.includes('anarchadia-cabinet-workbench-v144.js'),'Citizen Console does not load the workbench bridge.');
for(const asset of ['workbench.html','cabinet-workbench-v144.css','cabinet-workbench-loader-v144.js','anarchadia-cabinet-workbench-v144.js','services/anarchadia/src/app.js','services/anarchadia/src/domain.js','services/anarchadia/src/store.js','services/anarchadia/src/export.js','services/anarchadia/src/ai.js','services/anarchadia/styles.css','logos/anarchadia.webp','anarchadia-governance-kernel-v145.js','anarchadia-sovereignty-kernel-v146.js','install-boundary-v146.js','local-object-mesh-v146.js'])assert(worker.includes(asset),`Device package omits ${asset}`);
assert(!worker.includes('/app/services/anarchadia/assets/screens/home-portrait.webp'),'Cabinet device package must not revive archived Anarchadia location scenes.');
assert(/^device-package-r\d+(?:-[a-z0-9-]+)?$/i.test(deviceRevision),'Device package does not expose a versioned revision.');
assert(worker.includes("INSTALL_REVISION='install-only-r26'")&&worker.includes('anarchadia-sovereignty-kernel-v146.js'),'Local sovereignty and install-only package contracts are not active together.');
assert(pkg.scripts['check:syntax'].includes('anarchadia-cabinet-workbench-v144.js')&&pkg.scripts['check:syntax'].includes('cabinet-workbench-loader-v144.js'),'Syntax suite omits a Cabinet Mode workbench runtime.');
assert(pkg.scripts.check.includes('verify-anarchadia-cabinet-workbench-v144.mjs'),'Main check suite omits the Anarchadia cabinet workbench verifier.');
console.log(JSON.stringify({ok:true,cabinet:'anarchadia',surfaces:['citizen-console','governance-workbench','local-sovereignty'],classicRoutes:8,devicePackage:deviceRevision,serviceWorkerAuthority:'root-only',sourceBoundary:'cabinet-only compatibility loader',archivedSceneRequests:false},null,2));

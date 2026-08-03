import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
const root=process.cwd();
const read=file=>fs.readFile(path.join(root,file),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
const [html,css,runtime,consoleHtml,worker,pkgRaw]=await Promise.all([
  read('public/app/services/anarchadia/workbench.html'),
  read('public/app/services/anarchadia/cabinet-workbench-v144.css'),
  read('public/app/anarchadia-cabinet-workbench-v144.js'),
  read('public/app/anarchadia-console-v139.html'),
  read('public/service-worker.js'),
  read('package.json')
]);
const pkg=JSON.parse(pkgRaw);
for(const token of ['src/app.js','src/domain.js','src/store.js','commonweave-handoff-consumer.js','commonweave-presence.js','Citizen Console'])assert(html.includes(token),`Workbench entry is missing ${token}`);
for(const route of ['overview','charter','proposals','safeguards','exchange','ai','readiness','constitution','workbench'])assert(html.includes(`'${route}'`)||runtime.includes(`'${route}'`),`Workbench route ${route} is not wired`);
assert(html.includes('loadWorkspace')&&html.includes('syntheticFixture')&&html.includes("mode:'candidate'"),'Cabinet workbench does not preserve existing, blank, and synthetic workspace paths.');
assert(html.includes("worker.register=async()=>await rootRegistration?.('/')"),'Legacy Anarchadia worker registration is not contained by the root device package.');
assert(css.includes('.cabinet-workbench-return')&&css.includes('.onboarding-art')&&css.includes('data-cabinet-workbench'),'Cabinet workbench styling is incomplete.');
for(const label of ['Charter editor','Proposal deliberation','Rights & safeguards','Exchange, restore & fork','Constitutional AI','Readiness & emergency brake'])assert(runtime.includes(label),`Cabinet feature menu is missing ${label}`);
assert(runtime.includes("[data-action=\"vote-hub\"]")&&runtime.includes("open('proposals')"),'Vote controls do not enter the real proposal workbench.');
assert(consoleHtml.includes('anarchadia-cabinet-workbench-v144.js'),'Citizen Console does not load the workbench bridge.');
for(const asset of ['workbench.html','cabinet-workbench-v144.css','anarchadia-cabinet-workbench-v144.js','services/anarchadia/src/app.js','services/anarchadia/src/domain.js','services/anarchadia/src/store.js','services/anarchadia/src/export.js','services/anarchadia/src/ai.js','services/anarchadia/styles.css','logos/anarchadia.webp'])assert(worker.includes(asset),`Device package omits ${asset}`);
assert(worker.includes("DEVICE_REVISION='device-package-r24-anarchadia-workbench'"),'Device package revision was not rotated.');
assert(pkg.scripts['check:syntax'].includes('anarchadia-cabinet-workbench-v144.js'),'Syntax suite omits the Anarchadia workbench bridge.');
assert(pkg.scripts.check.includes('verify-anarchadia-cabinet-workbench-v144.mjs'),'Main check suite omits the Anarchadia cabinet workbench verifier.');
console.log(JSON.stringify({ok:true,cabinet:'anarchadia',surfaces:['citizen-console','governance-workbench'],classicRoutes:9,devicePackage:'r24',serviceWorkerAuthority:'root-only'},null,2));

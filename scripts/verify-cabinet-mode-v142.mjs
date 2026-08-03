import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};

const [html,css,runtime,legacyHtml,realmRedirect,parity,liteHtml,liteCore,liteApp,launcher,loom,loomHtml,shellText,worker,buildScript,archiveReadme,localHost]=await Promise.all([
  read('public/app/cabinet-mode-v142.html'),
  read('public/app/cabinet-mode-v142.css'),
  read('public/app/cabinet-mode-v142.js'),
  read('public/app/cabinet-visual-v141.html'),
  read('public/app/realm-v128.html'),
  read('public/app/shared/commonweave-parity-runtime.js'),
  read('public/app/lite-v129.html'),
  read('public/app/lite-v129-core.js'),
  read('public/app/lite-v129-app.js'),
  read('public/app/v130-cabinet-launcher.js'),
  read('public/app/loom-v141.js'),
  read('public/app/loom-v128.html'),
  read('public/app/shared/cabinet-shells-v129.json'),
  read('public/service-worker.js'),
  read('scripts/build-install-artifacts.sh'),
  read('archive/visual-mode-location-images/README.md'),
  read('server-local-v131.mjs')
]);
const shells=JSON.parse(shellText);

for(const token of ['CABINET MODE','cabinet-mode-v142.css','cabinet-mode-v142.js','Close Cabinet Mode and return to the Commonweave hub'])assert(html.includes(token),`Cabinet Mode HTML missing ${token}`);
for(const token of ['left:var(--x)','top:var(--y)','height:var(--size)','transform:translate(-50%,-50%)'])assert(css.includes(token),`Cabinet control CSS missing ${token}`);
for(const token of ['/app/realm-console-v140.html','/app/anarchadia-console-v139.html','/app/living-school-cabinet-v150.html','cabinet-shells-v129.json','Cabinet mode could not open'])assert(runtime.includes(token),`Cabinet Mode runtime missing ${token}`);
assert(runtime.includes("function closeCabinet(){location.assign('/loom/')}"),'Cabinet × does not close directly to the hub');
assert(!runtime.includes('history.back()'),'Cabinet × still behaves like browser Back');
assert(!runtime.includes("from==='lite'"),'Cabinet × still changes destination based on entry route');

assert(legacyHtml.includes("location.replace(target.href)")&&legacyHtml.includes('/app/cabinet-mode-v142.html'),'Legacy visual route does not redirect to Cabinet Mode');
assert(!legacyHtml.includes('cabinet-visual-v141.css')&&!legacyHtml.includes('cabinet-visual-v141.js'),'Legacy visual route still loads the retired renderer');
assert(realmRedirect.includes("location.replace(target.href)")&&realmRedirect.includes('/app/cabinet-mode-v142.html'),'Legacy realm route does not redirect to Cabinet Mode');
assert(!realmRedirect.includes('realm-v141.js')&&!realmRedirect.includes('cw127-realm-scene'),'Legacy realm route still loads a location scene');

assert(parity.includes('function cabinetUrl')&&parity.includes('/app/cabinet-mode-v142.html'),'Parity runtime has no canonical Cabinet Mode URL');
assert(parity.includes('function visualUrl(options={}){return cabinetUrl(options)}'),'Legacy visual URL is not a compatibility alias');
assert(liteHtml.includes('id="cabinet-link"')&&liteHtml.includes('Cabinet mode'),'Lite header does not name Cabinet Mode');
assert(!liteHtml.includes('id="visual-link"'),'Lite still exposes the retired visual link ID');
assert(!liteCore.includes('room.visualAsset'),'Lite still downloads room-location art');
for(const token of ['Cabinet Mode and Lite','room-preview-cabinet'])assert(liteCore.includes(token),`Lite cabinet copy missing ${token}`);
assert(liteApp.includes('CommonweaveParity.cabinetUrl'),'Lite does not link to Cabinet Mode');
assert(!liteApp.includes("$('#visual-link')"),'Lite app still targets the old visual link');

assert(launcher.includes('Cabinet mode'),'Hub launcher still uses the visual-mode name');
assert(launcher.includes("action==='realms'"),'Hub realm chooser is not intercepted by the cabinet picker');
assert(launcher.includes('CommonweaveParity.cabinetUrl'),'Hub launcher does not use Cabinet Mode');
assert(loom.includes('/app/assets/cabinets/living-school.webp'),'Hub chooser does not use cabinet art');
for(const prefix of ['/app/services/living-school/visual-assets/','/app/services/cerbanimo/assets/visual/','/app/services/fellowfare/assets/mall/','/app/services/anarchadia/assets/screens/'])assert(!loom.includes(prefix),`Hub runtime still references archived location path ${prefix}`);
assert(loomHtml.includes('/app/assets/world/town-square-home.webp'),'Main Commonweave hub image was removed');

const expected={
  cerbanimo:{reference:[489,122],x:[26.48,37.73,50.61,62.88,74.13]},
  'living-school':{reference:[479,134],x:[24.32,35.59,52.09,68.37,80.27]},
  commonweave:{reference:[504,165],x:[25.10,35.02,49.70,63.59,74.50]},
  fellowfare:{reference:[490,110],x:[22.76,34.18,50.10,65.82,79.22]},
  anarchadia:{reference:[524,191],x:[23.28,39.50,54.96,71.18,87.02]}
};
const controlOrder=['anarchadia','fellowfare','commonweave','living-school','cerbanimo'];
assert(JSON.stringify(shells.controlCalibration?.referencePanels)===JSON.stringify(['cerbanimo','living-school','commonweave','fellowfare','anarchadia']),'Supplied control-panel order was not recorded');
for(const [id,calibration] of Object.entries(expected)){
  const shell=shells.systems?.[id];
  assert(shell,`Missing shell ${id}`);
  assert(shell.controlPanel?.referenceWidth===calibration.reference[0]&&shell.controlPanel?.referenceHeight===calibration.reference[1],`${id} reference panel dimensions changed`);
  assert(JSON.stringify(shell.controlOrder)===JSON.stringify(controlOrder),`${id} control order changed`);
  assert(shell.controls.length===5,`${id} must expose five cabinet controls`);
  shell.controls.forEach((control,index)=>{
    assert(control.system===controlOrder[index],`${id} control ${index+1} targets the wrong realm`);
    assert(Math.abs(Number(control.x)-calibration.x[index])<0.001,`${id} control ${index+1} x shifted to ${control.x}`);
  });
}

const archivedPrefixes=[
  'services/living-school/visual-assets/',
  'services/cerbanimo/assets/visual/',
  'services/fellowfare/assets/mall/',
  'services/anarchadia/assets/screens/'
];
for(const prefix of archivedPrefixes){
  assert(buildScript.includes(prefix),`Release build does not exclude ${prefix}`);
  assert(archiveReadme.includes(`public/app/${prefix}`),`Archive documentation omits ${prefix}`);
  assert(worker.includes(`/app/${prefix}`),`Service worker does not quarantine ${prefix}`);
}
assert(buildScript.includes('assets/world/town-square-home.webp'),'Release guard does not preserve the main hub image');
assert(buildScript.includes('assets/cabinets/${cabinet}.webp'),'Release guard does not preserve cabinet shells');
assert(worker.includes("CACHE_REVISION='cabinet-mode-r23-living-school'"),'Service worker cache revision was not advanced for the Living School Cabinet Mode rebuild');
assert(worker.includes('/app/cabinet-mode-v142.html'),'Service worker does not precache Cabinet Mode');
assert(worker.includes('/app/living-school-cabinet-v150.html'),'Service worker does not precache the Living School cabinet runtime');
assert(!worker.includes("'/loom/realm/living-school/'"),'Service worker still precaches legacy realm scenes');
assert(localHost.includes('/app/cabinet-mode-v142.html'),'Local server does not allow the Cabinet Mode document');

console.log(JSON.stringify({ok:true,mode:'Cabinet Mode',calibratedPanels:Object.keys(expected),controls:25,closeTarget:'/loom/',hubImage:'retained',locationScenes:'excluded from release payload',livingSchool:'dedicated-cabinet-runtime'},null,2));

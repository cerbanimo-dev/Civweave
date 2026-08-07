import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [topbar,boundary,workspace,campus,release,workflow]=await Promise.all([
  read('public/app/working-campus-topbar-v243.js'),
  read('public/app/install-boundary-v146.js'),
  read('public/app/guide-workspace-v242.js'),
  read('public/app/working-campus-v156.js'),
  read('VERSION'),
  read('.github/workflows/verify-working-campus-topbar-v243.yml')
]);
new Function(topbar);new Function(boundary);
const version=release.trim();
const checks=[];
const check=(name,condition)=>{assert.ok(condition,name);checks.push(name)};
check('release is v1.0.35',version==='1.0.35');
check('topbar runtime is syntax checked',workflow.includes('node --check public/app/working-campus-topbar-v243.js'));
check('v243 is approved experience support',boundary.includes("const WORKING_CAMPUS_TOPBAR='/app/working-campus-topbar-v243.js'")&&boundary.includes('WORKING_CAMPUS_TOPBAR,')&&boundary.includes("workingCampusTopbarRevision:'v243-sticky-top-map-launch-contract'"));
check('old hit safety remains lower-specificity compatibility only',campus.includes("main.app>.top{position:relative!important")&&topbar.includes('main.app>header.top{position:sticky!important'));
check('topbar is sticky to safe top edge',topbar.includes('position:sticky!important;top:max(6px,env(safe-area-inset-top))!important'));
check('topbar stays above chat without sharing its paint layer',topbar.includes('z-index:2147483646!important')&&workspace.includes('z-index:2147483644!important'));
check('chat workspace reserves measured topbar height',topbar.includes('--cw-working-campus-topbar-height')&&topbar.includes('#cw-persistent-guide-chat-v215{top:calc(var(--cw-working-campus-topbar-height'));
check('topbar height uses targeted ResizeObserver',topbar.includes("'ResizeObserver'in globalThis")&&topbar.includes('resizeObserver.observe(header)')&&!topbar.includes('MutationObserver'));
check('map button is a first-class header grid area',topbar.includes("MAP_BUTTON_ID='cw-working-campus-map-v243'")&&topbar.includes('grid-area:map')&&topbar.includes('<span>Map</span>'));
check('map launch accepts direct runtime API',topbar.includes('globalThis.CivweaveMapSystem||globalThis.CivweaveMapV1||globalThis.CivweaveMap'));
check('map launch accepts registration handshake',topbar.includes("MAP_READY_EVENT='civweave:map-ready'")&&topbar.includes('registerMap'));
check('map launch accepts cancellable open request',topbar.includes("MAP_EVENT='civweave:map-open-request'")&&topbar.includes('cancelable:true'));
check('map route is same-origin constrained',topbar.includes("url.origin===location.origin"));
check('missing map runtime degrades visibly instead of dead-clicking',topbar.includes('Map button is ready. The incoming map runtime has not registered itself yet.'));
console.log(JSON.stringify({ok:true,version,revision:'working-campus-topbar-v243',checks:checks.length,stickyTop:true,chatSafe:true,mapHandshake:['direct-api','register','event','same-origin-route']},null,2));

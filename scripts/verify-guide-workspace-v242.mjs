import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [workspace,viewport,boundary,campusCss,release]=await Promise.all([
  read('public/app/guide-workspace-v242.js'),
  read('public/app/persistent-guide-viewport-v216.js'),
  read('public/app/install-boundary-v146.js'),
  read('public/app/working-campus-v156.css'),
  read('VERSION')
]);
new Function(workspace);new Function(viewport);new Function(boundary);
const version=release.trim();
const checks=[];
const check=(name,condition)=>{assert.ok(condition,name);checks.push(name)};
check('repository release is semantic',/^\d+\.\d+\.\d+$/.test(version));
check('workspace runtime remains v242',workspace.includes('guide-workspace-v242'));
check('workspace has five canonical windows',workspace.includes("const SYSTEMS=['civweave','living-school','cerbanimo','fellowfare','anarchadia']"));
check('realm ledgers stay isolated',workspace.includes('readThread(activeWindow)')&&workspace.includes('Switching windows never mixes histories'));
check('page launcher opens page realm directly',workspace.includes('openWindow(pageSystem)'));
check('switchGuide maps to switchWindow',workspace.includes('switchGuide:(system,options={})=>switchWindow'));
check('ordinary guide selection stays closed until explicitly opened',workspace.includes('open:options.open===true'));
check('cross-context model turns explicitly select their guide',workspace.includes('handoffSystem:system!==pageSystem?system:undefined'));
check('only explicit handoff fields create cross-realm packets',workspace.includes('explicitHandoffTarget')&&!workspace.includes('choice?.system,80'));
check('workspace submission captures before retired page listener',workspace.includes("document.addEventListener('submit',onSubmitCapture,true)"));
check('workspace does not lock document overflow',!/document\.(?:body|documentElement)\.style\.overflow/.test(workspace));
check('mobile workspace leaves page visible',workspace.includes('height:min(62dvh,560px)!important'));
check('floating chat outranks Working Campus base header',workspace.includes('z-index:2147483644!important')&&campusCss.includes('.top{position:relative;z-index:2'));
check('chat log releases edge scrolling',workspace.includes('overscroll-behavior:auto!important'));
check('viewport has no mutation observer',!viewport.includes('MutationObserver'));
check('viewport has no scrollIntoView',!viewport.includes('scrollIntoView'));
check('viewport loads the v243 interaction repair',viewport.includes("const REGRESSION_FIXES='/app/regression-fixes-v243.js?v=guide-interaction-r2'"));
check('floating launcher focus is opt-in only',workspace.includes('if(options.focus===true)queueMicrotask(()=>input?.focus({preventScroll:true}))'));
check('workspace reports real open state to embedded surface',workspace.includes('open:workspaceOpen,minimized'));
const realmIndex=boundary.indexOf('REALM_SESSION_INTEGRITY,'),workspaceIndex=boundary.indexOf('GUIDE_WORKSPACE,');
check('workspace loads after realm session integrity',realmIndex>=0&&workspaceIndex>realmIndex);
check('boundary exposes v242 policy',boundary.includes("guideWorkspaceRevision:'v242-five-window-local-ledgers-no-scroll-trap'"));
console.log(JSON.stringify({ok:true,version,checks:checks.length,workspace:'v242-five-window-local-ledgers',scrollTrap:false,launcherFirst:true,interactionRepair:'v243.1'},null,2));
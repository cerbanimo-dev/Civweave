import fs from 'node:fs';
import assert from 'node:assert/strict';

const boundary=fs.readFileSync(new URL('../public/app/install-boundary-v146.js',import.meta.url),'utf8');
const guide=fs.readFileSync(new URL('../public/app/shared-guide-surface-v236.js',import.meta.url),'utf8');
const realmIntegrity=fs.readFileSync(new URL('../public/app/realm-session-integrity-v237.js',import.meta.url),'utf8');
const workspace=fs.readFileSync(new URL('../public/app/guide-workspace-v242.js',import.meta.url),'utf8');
const viewport=fs.readFileSync(new URL('../public/app/persistent-guide-viewport-v216.js',import.meta.url),'utf8');
const rookBridge=fs.readFileSync(new URL('../public/app/fellowfare-shared-guide-bridge-v236.js',import.meta.url),'utf8');
const nav=fs.readFileSync(new URL('../public/app/themed-system-nav-v178.js',import.meta.url),'utf8');
const radio=fs.readFileSync(new URL('../public/app/system-radio-agent-v233.js',import.meta.url),'utf8');
const pkg=JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url),'utf8'));
const release=fs.readFileSync(new URL('../VERSION',import.meta.url),'utf8').trim();

const checks=[
  ['all canonical systems load realm isolation followed by the five-window workspace',()=>{
    for(const token of [
      "PERSISTENT_GUIDE_CHAT_SCRIPT='/app/persistent-guide-chat-v215.js'",
      "PERSISTENT_GUIDE_VIEWPORT_SCRIPT='/app/persistent-guide-viewport-v216.js'",
      "REALM_SESSION_INTEGRITY='/app/realm-session-integrity-v237.js'",
      "GUIDE_WORKSPACE='/app/guide-workspace-v242.js'",
      "THEMED_SYSTEM_NAV='/app/themed-system-nav-v178.js'",
      "SHARED_GUIDE_SURFACE='/app/shared-guide-surface-v236.js'"
    ])assert.ok(boundary.includes(token),`missing boundary token ${token}`);
    assert.match(boundary,/realmSessionIntegrityRevision:'v237-realm-local-memory-handover-state-repair'/);
    assert.match(boundary,/guideWorkspaceRevision:'v242-five-window-local-ledgers-no-scroll-trap'/);
    assert.ok(boundary.indexOf('REALM_SESSION_INTEGRITY,')<boundary.indexOf('GUIDE_WORKSPACE,'),'workspace must load after local-ledger ownership');
  }],
  ['five guide identities remain explicit and switchable without merging ledgers',()=>{
    for(const pair of [["civweave",'Weaveling'],["living-school",'Moss'],['cerbanimo','Kamiya'],['fellowfare','Rook'],['anarchadia','Merlin']])assert.ok(workspace.includes(pair[0])&&workspace.includes(`name:'${pair[1]}'`),`missing ${pair[1]} workspace contract`);
    assert.match(workspace,/const SYSTEMS=\['civweave','living-school','cerbanimo','fellowfare','anarchadia'\]/);
    assert.match(workspace,/function switchWindow\(system/);
    assert.match(workspace,/readThread\(activeWindow\)/);
    assert.match(workspace,/five-realm-local-ledgers-plus-explicit-handover|Switching windows never mixes histories/);
    assert.doesNotMatch(workspace,/messages\s*=\s*SYSTEMS\.flatMap/,'workspace must never flatten realm histories');
  }],
  ['launcher-first open owns the current realm without requiring inline chat priming',()=>{
    assert.match(workspace,/event\.target\.closest\?\.\(`#\$\{LAUNCHER_ID\}`\)/);
    assert.match(workspace,/openWindow\(pageSystem\)/);
    assert.match(workspace,/switchGuide:\(system,options=\{\}\)=>switchWindow/);
    assert.doesNotMatch(workspace,/function switchGuide\(system\)\{return system===pageSystem\}/);
  }],
  ['inline chat and floating workspace still use one AI submission pipeline per selected realm',()=>{
    assert.match(guide,/function submitInline\(text\)/);
    assert.match(guide,/form\.requestSubmit\(\)/);
    assert.match(workspace,/function onSubmitCapture\(event\)/);
    assert.match(workspace,/assistant\.respond\(\{text:value,systemId:system/);
    assert.match(workspace,/handoffSystem:system!==pageSystem\?system:undefined/);
    assert.match(realmIntegrity,/civweave\.guide-thread\.\$\{system\}\.v237/);
  }],
  ['chat viewport cannot trap document scroll or force scrollIntoView',()=>{
    assert.doesNotMatch(viewport,/MutationObserver/);
    assert.doesNotMatch(viewport,/scrollIntoView/);
    assert.match(viewport,/overscroll-behavior:auto!important/);
    assert.match(workspace,/height:min\(62dvh,560px\)!important/);
    assert.match(workspace,/z-index:2147483644!important/);
    assert.doesNotMatch(workspace,/document\.body\.style\.overflow|document\.documentElement\.style\.overflow/);
  }],
  ['Rook keeps the native workbench while workspace owns switchable windows',()=>{
    assert.match(guide,/if\(system==='fellowfare'\)return document\.querySelector\('\.ffc144-rook'\)/);
    assert.match(boundary,/FELLOWFARE_GUIDE_BRIDGE='\/app\/fellowfare-shared-guide-bridge-v236\.js'/);
    assert.match(rookBridge,/CivweaveSharedGuideSurfaceV236/);
    assert.match(realmIntegrity,/exchangeMethod:'Buttons'/);
  }],
  ['radio launcher and ornate nav keep their floating-layer contract',()=>{
    assert.match(guide,/#cw-radio-suggestion-v233\{z-index:2147483610!important/);
    assert.match(workspace,/#\$\{LAUNCHER_ID\}\{z-index:2147483643!important/);
    assert.match(radio,/left:max\(14px,env\(safe-area-inset-left\)\)/);
    assert.match(nav,/--cw-themed-nav-height:clamp\(52px,7vw,72px\)/);
    for(const id of ['civweave','living-school','cerbanimo','fellowfare','anarchadia'])assert.ok(nav.includes(`/app/assets/navigation/200-${id}-nav.webp?v=image-nav-r2`),`${id} lost the canonical ornate face-button artwork`);
  }],
  ['release syntax gate includes v236 v237 and v242',()=>{
    assert.equal(pkg.version,release);
    assert.match(pkg.scripts['check:syntax'],/public\/app\/shared-guide-surface-v236\.js/);
    assert.match(pkg.scripts['check:syntax'],/public\/app\/realm-session-integrity-v237\.js/);
    assert.match(pkg.scripts['check:syntax'],/public\/app\/guide-workspace-v242\.js/);
  }]
];
for(const [name,run] of checks){run();console.log(`✓ ${name}`)}
console.log(`Shared guide workspace verified under ${release}: ${checks.length}/${checks.length} checks passed.`);

import fs from 'node:fs';
import assert from 'node:assert/strict';

const boundary=fs.readFileSync(new URL('../public/app/install-boundary-v146.js',import.meta.url),'utf8');
const guideLoader=fs.readFileSync(new URL('../public/app/shared-guide-surface-v236.js',import.meta.url),'utf8');
const guideCore=fs.readFileSync(new URL('../public/app/shared-guide-surface-v236-core-v244.js',import.meta.url),'utf8');
const guide=`${guideLoader}\n${guideCore}`;
const realmIntegrity=fs.readFileSync(new URL('../public/app/realm-session-integrity-v237.js',import.meta.url),'utf8');
const workspace=fs.readFileSync(new URL('../public/app/guide-workspace-v242.js',import.meta.url),'utf8');
const viewport=fs.readFileSync(new URL('../public/app/persistent-guide-viewport-v216.js',import.meta.url),'utf8');
const rookBridge=fs.readFileSync(new URL('../public/app/fellowfare-shared-guide-bridge-v236.js',import.meta.url),'utf8');
const nav=fs.readFileSync(new URL('../public/app/themed-system-nav-v178.js',import.meta.url),'utf8');
const radio=fs.readFileSync(new URL('../public/app/system-radio-agent-v233.js',import.meta.url),'utf8');
const pkg=JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url),'utf8'));
const release=fs.readFileSync(new URL('../VERSION',import.meta.url),'utf8').trim();

const checks=[
  ['all canonical systems load realm isolation followed by the one five-window workspace',()=>{
    for(const token of [
      "PERSISTENT_GUIDE_CHAT_SCRIPT='/app/persistent-guide-chat-v215.js'",
      "PERSISTENT_GUIDE_VIEWPORT_SCRIPT='/app/persistent-guide-viewport-v216.js'",
      "REALM_SESSION_INTEGRITY='/app/realm-session-integrity-v237.js'",
      "GUIDE_WORKSPACE='/app/guide-workspace-v242.js'",
      "THEMED_SYSTEM_NAV='/app/themed-system-nav-v178.js'",
      "SHARED_GUIDE_SURFACE='/app/shared-guide-surface-v236.js'"
    ])assert.ok(boundary.includes(token),`missing boundary token ${token}`);
    assert.match(boundary,/realmSessionIntegrityRevision:'v237-realm-local-memory-handover-state-repair'/);
    assert.match(boundary,/guideWorkspaceRevision:'v250-v242-canonical-owner'/);
    const start=boundary.indexOf('const SYSTEM_EXPERIENCE_SCRIPTS=['),end=boundary.indexOf('];',start),experience=boundary.slice(start,end);
    assert.match(experience,/REALM_SESSION_INTEGRITY/);
    assert.match(experience,/GUIDE_WORKSPACE/);
    assert.doesNotMatch(experience,/PERSISTENT_GUIDE_CHAT_SCRIPT/,'canonical experience must not boot retained v215');
    assert.doesNotMatch(experience,/PERSISTENT_GUIDE_VIEWPORT_SCRIPT/,'canonical experience must not boot retained v216');
    assert.ok(experience.indexOf('REALM_SESSION_INTEGRITY,')<experience.indexOf('GUIDE_WORKSPACE,'),'workspace must load after local-ledger ownership');
  }],
  ['five guide identities remain explicit and switchable without merging ledgers',()=>{
    for(const pair of [["civweave",'Weaveling'],["living-school",'Moss'],['cerbanimo','Kamiya'],['fellowfare','Rook'],['anarchadia','Merlin']])assert.ok(workspace.includes(pair[0])&&workspace.includes(`name:'${pair[1]}'`),`missing ${pair[1]} workspace contract`);
    assert.match(workspace,/const SYSTEMS=\['civweave','living-school','cerbanimo','fellowfare','anarchadia'\]/);
    assert.match(workspace,/function switchWindow\(system/);
    assert.match(workspace,/readThread\(activeWindow\)/);
    assert.match(workspace,/Switching windows never mixes histories/);
    assert.match(workspace,/canonicalOwner:true/);
    assert.doesNotMatch(workspace,/messages\s*=\s*SYSTEMS\.flatMap/,'workspace must never flatten realm histories');
  }],
  ['launcher-first open owns the current realm without requiring inline chat priming',()=>{
    assert.match(workspace,/event\.target\.closest\?\.\(`#\$\{LAUNCHER_ID\}`\)/);
    assert.match(workspace,/openWindow\(pageSystem\)/);
    assert.match(workspace,/switchGuide:\(system,options=\{\}\)=>switchWindow/);
    assert.doesNotMatch(workspace,/function switchGuide\(system\)\{return system===pageSystem\}/);
  }],
  ['inline chat and floating workspace use one direct AI submission pipeline per selected realm',()=>{
    assert.match(guideLoader,/shared-guide-surface-v236-core-v244\.js/);
    assert.match(guide,/function submitInline\(text\)/);
    assert.match(guide,/await api\.submitText\(value,currentSystem\)/);
    assert.doesNotMatch(guide,/form\.requestSubmit\(\)/);
    assert.doesNotMatch(guide,/api\.open\?\.\(\{guide:currentSystem,prefill:value\}\)/);
    assert.match(workspace,/submitText:async\(text,system=activeWindow\)/);
    assert.match(workspace,/assistant\.respond\(\{text:value,systemId:system/);
    assert.match(workspace,/handoffSystem:system!==pageSystem\?system:undefined/);
    assert.match(workspace,/fallbackReply/);
    assert.match(realmIntegrity,/civweave\.guide-thread\.\$\{system\}\.v237/);
  }],
  ['inline and full composers cannot both receive taps',()=>{
    assert.match(guide,/function syncInlineVisibility\(/);
    assert.match(guide,/setInlineInteractive\(false\)/);
    assert.match(guide,/civweave:guide-workspace-state/);
    assert.match(workspace,/civweave:guide-workspace-state/);
    assert.doesNotMatch(guide,/input\.focus\(\)/);
  }],
  ['chat viewport cannot trap document scroll or install a second owner',()=>{
    assert.doesNotMatch(viewport,/MutationObserver/);
    assert.doesNotMatch(viewport,/scrollIntoView/);
    assert.doesNotMatch(viewport,/CHAT_OWNER_REPAIR|chat-single-owner-v245\.js/);
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
    assert.match(nav,/--cw-themed-nav-height:clamp\(46\.8px,6\.3vw,64\.8px\)/);
    assert.match(nav,/@media\(max-width:680px\)\{:root\{--cw-themed-nav-height:clamp\(45px,12\.6vw,59\.4px\)/);
    assert.match(nav,/\.cw-themed-system-link:not\(\.is-current\)\{background:var\(--system-shade\)\}/);
    for(const [id,shade] of [['civweave','#264646'],['living-school','#2d3e27'],['cerbanimo','#4a1d43'],['fellowfare','#182c37'],['anarchadia','#4a122e']]){
      assert.ok(nav.includes(`/app/assets/navigation/200-${id}-nav.webp?v=image-nav-r2`),`${id} lost the canonical ornate face-button artwork`);
      assert.ok(nav.includes(`shade:'${shade}'`),`${id} lost its dark inactive navigation tint`);
    }
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

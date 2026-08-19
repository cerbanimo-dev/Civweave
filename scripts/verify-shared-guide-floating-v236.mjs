import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const boundary=read('public/app/install-boundary-v146.js');
const guideLoader=read('public/app/shared-guide-surface-v236.js');
const guideCore=read('public/app/shared-guide-surface-v236-core-v244.js');
const guide=`${guideLoader}\n${guideCore}`;
const realmIntegrity=read('public/app/realm-session-integrity-v237.js');
const workspace=read('public/app/guide-workspace-v242.js');
const rookBridge=read('public/app/fellowfare-shared-guide-bridge-v236.js');
const fellowfare=read('public/app/fellowfare-cabinet-v144.html');
const nav=read('public/app/themed-system-nav-v178.js');
const platformCss=read('public/app/platform-experience-v160.css');
const radio=read('public/app/system-radio-agent-v233.js');
const familyLoader=read('public/app/family-ai-loader-v105.js');
const pkg=JSON.parse(read('package.json'));
const release=read('VERSION').trim();

const checks=[
  ['all canonical systems load realm isolation followed by the one five-window workspace',()=>{
    for(const token of ["REALM_SESSION_INTEGRITY='/app/realm-session-integrity-v237.js'","GUIDE_WORKSPACE='/app/guide-workspace-v242.js'","THEMED_SYSTEM_NAV='/app/themed-system-nav-v178.js'","SHARED_GUIDE_SURFACE='/app/shared-guide-surface-v236.js'"])assert.ok(boundary.includes(token),`missing boundary token ${token}`);
    assert.doesNotMatch(boundary,/PERSISTENT_GUIDE_CHAT_SCRIPT|PERSISTENT_GUIDE_VIEWPORT_SCRIPT/,'deleted chat runtimes must not remain in boundary');
    const start=boundary.indexOf('const SYSTEM_EXPERIENCE_SCRIPTS=['),end=boundary.indexOf('];',start),experience=boundary.slice(start,end);
    assert.match(experience,/REALM_SESSION_INTEGRITY/);assert.match(experience,/GUIDE_WORKSPACE/);
    assert.ok(experience.indexOf('REALM_SESSION_INTEGRITY,')<experience.indexOf('GUIDE_WORKSPACE,'),'workspace must load after local-ledger ownership');
  }],
  ['five guide identities remain explicit and switchable without merging ledgers',()=>{
    for(const pair of [['civweave','Weaveling'],['living-school','Moss'],['cerbanimo','Kamiya'],['fellowfare','Rook'],['anarchadia','Merlin']])assert.ok(workspace.includes(pair[0])&&workspace.includes(`name:'${pair[1]}'`),`missing ${pair[1]} workspace contract`);
    assert.match(workspace,/const SYSTEMS=\['civweave','living-school','cerbanimo','fellowfare','anarchadia'\]/);
    assert.match(workspace,/function switchWindow\(system/);assert.match(workspace,/readThread\(activeWindow\)/);assert.match(workspace,/canonicalOwner:true/);
    assert.doesNotMatch(workspace,/messages\s*=\s*SYSTEMS\.flatMap/,'workspace must never flatten realm histories');
  }],
  ['launcher-first open owns the current realm without inline priming',()=>{
    assert.match(workspace,/event\.target\.closest\?\.\(`#\$\{LAUNCHER_ID\}`\)/);assert.match(workspace,/openWindow\(pageSystem\)/);assert.match(workspace,/switchGuide:\(system,options=\{\}\)=>switchWindow/);
  }],
  ['bubble-only guide surface keeps one submission pipeline without embedded composers',()=>{
    assert.match(guideLoader,/shared-guide-surface-v236-core-v244\.js/);assert.match(guideLoader,/surfaceMode:'bubble-only'/);assert.match(guideCore,/mode:'bubble-only'/);
    assert.match(guideCore,/function submitInline\(text\)/);assert.match(guideCore,/api\.submitText\(value,currentSystem\)/);assert.match(guideCore,/function removeEmbeddedGuideCards\(\)/);
    assert.doesNotMatch(guideCore,/section\.innerHTML|cwsg236-form|Open full chat|Chat with \$\{guide\.name\}/,'embedded guide card must not be rebuilt');
    assert.match(workspace,/submitText:async\(text,system=activeWindow\)/);assert.match(workspace,/assistant\.respond\(\{text:value,systemId:system/);assert.match(workspace,/fallbackReply/);assert.match(realmIntegrity,/civweave\.guide-thread\.\$\{system\}\.v237/);
  }],
  ['full workspace owns mobile viewport and scroll behavior',()=>{
    assert.match(workspace,/globalThis\.visualViewport\?\.addEventListener/);assert.match(workspace,/height:min\(62dvh,560px\)!important/);assert.match(workspace,/z-index:2147483644!important/);assert.match(workspace,/touch-action:pan-y!important/);
    assert.doesNotMatch(workspace,/document\.body\.style\.overflow|document\.documentElement\.style\.overflow/);
    assert.doesNotMatch(familyLoader,/MutationObserver|persistent-guide-viewport-v216|chat-single-owner-v245/,'headless loader must not recreate deleted owners');
  }],
  ['FellowFare uses the floating Rook bubble without a duplicate top-level exchange desk',()=>{
    assert.doesNotMatch(fellowfare,/class="ffc144-rook"|data-ffc-rook-form|Chat with Rook/,'FellowFare must not reserve page space for a second Rook chat');
    assert.match(boundary,/FELLOWFARE_GUIDE_BRIDGE='\/app\/fellowfare-shared-guide-bridge-v236\.js'/);assert.match(rookBridge,/mode:'bubble-only'/);assert.match(realmIntegrity,/exchangeMethod:'Buttons'/);
  }],
  ['radio launcher and expressive avatar nav keep one geometry owner',()=>{
    assert.match(guide,/#cw-radio-suggestion-v233\{z-index:2147483610!important/);assert.match(workspace,/#\$\{LAUNCHER_ID\}\{z-index:2147483643!important/);assert.match(radio,/left:max\(14px,env\(safe-area-inset-left\)\)/);
    assert.ok(nav.includes(':root{--cw-themed-nav-height:clamp(92px,10vw,100px);--cw-themed-nav-bottom-gap:0px}'),'canonical tall nav geometry missing');
    assert.ok(nav.includes('@media(max-width:680px){:root{--cw-themed-nav-height:clamp(88px,22vw,96px);--cw-themed-nav-bottom-gap:0px}'),'canonical phone nav geometry missing');
    assert.ok(nav.includes('@media(max-width:430px){:root{--cw-themed-nav-height:clamp(80px,22vw,88px);--cw-themed-nav-bottom-gap:0px}'),'canonical narrow-phone nav geometry missing');
    assert.ok(nav.includes("geometryOwner:'canonical-tall-v1'"),'themed nav must declare sole geometry ownership');
    assert.ok(guideCore.includes("navigationGeometryOwner:false"),'shared guide surface must disclaim navbar geometry ownership');
    assert.ok(guideCore.includes('--cw-guide-nav-offset'),'floating guide controls must use a read-only measured nav offset');
    assert.ok(!guideCore.includes("setProperty('--cw-themed-nav-height'"),'shared guide surface must not rewrite navbar height');
    assert.doesNotMatch(guideCore,/--cw-themed-nav-height\s*:/,'shared guide surface must not declare navbar height');
    assert.doesNotMatch(platformCss,/cw-themed-system-nav|cw-themed-nav-height|cw-themed-system-avatar-wrap/,'platform CSS must not own navbar geometry');
    for(const retired of ['clamp(56px,7vw,68px)','clamp(58px,14vw,64px)','clamp(52px,7vw,72px)','clamp(50px,14vw,66px)'])assert.ok(!nav.includes(retired)&&!guideCore.includes(retired),`retired compact nav geometry returned: ${retired}`);
    for(const [id,asset] of [['civweave','Civweave-weaveling-sprites.png'],['living-school','Living-School-moss-sprites.png'],['cerbanimo','Cerbanimo-kamiya-sprites.png'],['fellowfare','FellowFare-rook-sprites.png'],['anarchadia','Anarchadia-merlin-sprites.png']])assert.ok(nav.includes(asset),`${id} lost expressive avatar atlas`);
    for(const [id,shade] of [['civweave','#dad7ff'],['living-school','#28412f'],['cerbanimo','#4f265f'],['fellowfare','#5a3618'],['anarchadia','#621f43']])assert.ok(nav.includes(`id:'${id}'`)&&nav.includes(`shade:'${shade}'`),`${id} lost corrected navigation tint`);
    assert.match(nav,/background-size:500% 400%/);assert.match(nav,/civweave:subsystem-avatar-state/);assert.match(nav,/civweave:avatar-expression/);
  }],
  ['release syntax gate includes canonical shared guide runtimes',()=>{
    assert.equal(pkg.version,release);assert.match(pkg.scripts['check:syntax'],/public\/app\/shared-guide-surface-v236\.js/);assert.match(pkg.scripts['check:syntax'],/public\/app\/realm-session-integrity-v237\.js/);assert.match(pkg.scripts['check:syntax'],/public\/app\/guide-workspace-v242\.js/);assert.doesNotMatch(pkg.scripts['check:syntax'],/persistent-guide-viewport-v216|chat-single-owner-v245/);
  }]
];
for(const [name,run] of checks){run();console.log(`✓ ${name}`)}
console.log(`Shared guide workspace verified under ${release}: ${checks.length}/${checks.length} checks passed.`);
import fs from 'node:fs';
import assert from 'node:assert/strict';

const boundary=fs.readFileSync(new URL('../public/app/install-boundary-v146.js',import.meta.url),'utf8');
const guide=fs.readFileSync(new URL('../public/app/shared-guide-surface-v236.js',import.meta.url),'utf8');
const rookBridge=fs.readFileSync(new URL('../public/app/fellowfare-shared-guide-bridge-v236.js',import.meta.url),'utf8');
const nav=fs.readFileSync(new URL('../public/app/themed-system-nav-v178.js',import.meta.url),'utf8');
const radio=fs.readFileSync(new URL('../public/app/system-radio-agent-v233.js',import.meta.url),'utf8');
const pkg=JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url),'utf8'));

const checks=[
  ['all canonical systems load one shared guide stack',()=>{
    for(const token of [
      "PERSISTENT_GUIDE_CHAT_SCRIPT='/app/persistent-guide-chat-v215.js'",
      "PERSISTENT_GUIDE_VIEWPORT_SCRIPT='/app/persistent-guide-viewport-v216.js'",
      "THEMED_SYSTEM_NAV='/app/themed-system-nav-v178.js'",
      "SHARED_GUIDE_SURFACE='/app/shared-guide-surface-v236.js'"
    ])assert.ok(boundary.includes(token),`missing boundary token ${token}`);
    assert.match(boundary,/sharedGuideSurfaceRevision:'v236-inline-plus-bottom-right-shared-thread'/);
  }],
  ['five page-owned guide identities are explicit',()=>{
    for(const pair of [
      ["civweave",'Weaveling'],["living-school",'Moss'],['cerbanimo','Kamiya'],['fellowfare','Rook'],['anarchadia','Merlin']
    ]){
      assert.ok(guide.includes(pair[0])&&guide.includes(`name:'${pair[1]}'`),`missing ${pair[1]} guide contract`);
    }
    assert.match(guide,/api\.switchGuide\?\.\(currentSystem\)/);
  }],
  ['inline chat and floating launcher share one persistent thread',()=>{
    assert.match(guide,/STORAGE_KEY='civweave\.persistent-guide-chat\.v214'/);
    assert.match(guide,/function submitInline\(text\)/);
    assert.match(guide,/\[data-persistent-form\]/);
    assert.match(guide,/form\.requestSubmit\(\)/);
    assert.match(guide,/One shared thread, two surfaces/);
    assert.equal((boundary.match(/PERSISTENT_GUIDE_CHAT_SCRIPT/g)||[]).length>=2,true);
  }],
  ['late realm renders cannot erase the inline guide surface',()=>{
    assert.match(guide,/function repairSurface\(\)/);
    assert.match(guide,/surfaceObserver=new MutationObserver/);
    assert.match(guide,/if\(!document\.getElementById\(ROOT_ID\)&&!canonicalNativeChat\(currentSystem\)\)buildInline\(\)/);
    const repairBody=guide.match(/function repairSurface\(\)\{([\s\S]*?)\n\}/)?.[1]||'';
    assert.doesNotMatch(repairBody,/renderTranscript\(\)/,'repair observer must not mutate the transcript and trigger itself recursively');
  }],
  ['Rook keeps the native workbench but shares the persistent thread',()=>{
    assert.match(guide,/if\(system==='fellowfare'\)return document\.querySelector\('\.ffc144-rook'\)/);
    assert.match(boundary,/FELLOWFARE_GUIDE_BRIDGE='\/app\/fellowfare-shared-guide-bridge-v236\.js'/);
    assert.match(boundary,/if\(system==='fellowfare'\)addScript\(FELLOWFARE_GUIDE_BRIDGE\)/);
    assert.match(rookBridge,/SHARED_KEY='civweave\.persistent-guide-chat\.v214'/);
    assert.match(rookBridge,/document\.addEventListener\('submit',onSubmit,true\)/);
    assert.match(rookBridge,/CivweaveSharedGuideSurfaceV236/);
    assert.match(rookBridge,/shared conversation/);
  }],
  ['radio and launcher sit above the bottom navigation',()=>{
    assert.match(guide,/#cw-radio-suggestion-v233\{z-index:2147483610!important/);
    assert.match(guide,/#\$\{LAUNCHER_ID\}\{z-index:2147483611!important/);
    assert.match(guide,/bottom:calc\(var\(--cw-themed-nav-height,64px\) \+ env\(safe-area-inset-bottom\) \+ var\(--cw-floating-gap\)\)!important/);
    assert.match(radio,/left:max\(14px,env\(safe-area-inset-left\)\)/);
  }],
  ['bottom navigation uses the ornate face-button strip everywhere',()=>{
    assert.match(nav,/--cw-themed-nav-height:clamp\(52px,7vw,72px\)/);
    assert.match(nav,/--cw-themed-nav-button-width:156px/);
    for(const id of ['civweave','living-school','cerbanimo','fellowfare','anarchadia']){
      assert.ok(nav.includes(`/app/assets/navigation/200-${id}-nav.webp?v=image-nav-r2`),`${id} lost the canonical ornate face-button artwork`);
    }
    assert.match(nav,/width="200" height="100"/,'face-button assets must preserve their 2:1 source geometry');
    assert.match(nav,/is-current/,'selected realm must retain its glow state');
    const order=['civweave','living-school','cerbanimo','fellowfare','anarchadia'].map(id=>nav.indexOf(`id:'${id}'`));
    assert.ok(order.every(index=>index>=0),'a canonical system is missing from nav');
    assert.deepEqual([...order].sort((a,b)=>a-b),order,'canonical nav order regressed');
  }],
  ['release syntax gate includes the v236 runtime',()=>{
    assert.equal(pkg.version,'1.0.30');
    assert.match(pkg.scripts['check:syntax'],/public\/app\/shared-guide-surface-v236\.js/);
  }]
];

for(const [name,run] of checks){run();console.log(`✓ ${name}`)}
console.log(`Shared guide + floating UI v236 verified: ${checks.length}/${checks.length} checks passed.`);

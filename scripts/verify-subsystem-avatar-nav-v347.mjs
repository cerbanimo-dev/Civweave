import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [nav,mapper,release,fellowfareVerifier,platformCss,sharedGuide]=await Promise.all([
  read('public/app/themed-system-nav-v178.js'),
  read('public/app/subsystem-avatar-state-v347.js'),
  read('VERSION'),
  read('scripts/verify-fellowfare-active-v203.mjs'),
  read('public/app/platform-experience-v160.css'),
  read('public/app/shared-guide-surface-v236-core-v244.js')
]);
const version=release.trim();
new Function(nav);
new Function(mapper);
new Function(sharedGuide);

const match=version.match(/^(\d+)\.(\d+)\.(\d+)$/);
assert.ok(match,'Avatar navigation requires a semantic Civweave release version.');
const releaseNumber=Number(match[1])*1_000_000+Number(match[2])*1_000+Number(match[3]);
assert.ok(releaseNumber>=1_000_144,'Avatar navigation must remain materialized at Civweave 1.0.144 or newer.');
assert.ok(nav.includes(`const VERSION='${version}-five-system-navigation-v232-canonical-rail';`),'Themed navigation must stay synchronized with the canonical tall-rail revision.');

for(const asset of ['Civweave-weaveling-sprites.png','Living-School-moss-sprites.png','Cerbanimo-kamiya-sprites.png','FellowFare-rook-sprites.png','Anarchadia-merlin-sprites.png'])assert.ok(nav.includes(asset),`Missing avatar atlas ${asset}`);
assert.match(nav,/fellowfare'.*glow:'#f5b446'.*shade:'#5a3618'/s,'Rook button must be amber.');
assert.ok(fellowfareVerifier.includes("glow:'#f5b446'")&&fellowfareVerifier.includes("shade:'#5a3618'"),'FellowFare regression verifier must enforce the corrected amber navigation.');
assert.doesNotMatch(fellowfareVerifier,/selected navigation accent is not ink blue/,'Retired FellowFare ink-blue navigation expectation must not return.');
assert.match(nav,/cerbanimo'.*glow:'#bb79ff'.*shade:'#4f265f'/s,'Kamiya button must be purple.');
assert.match(nav,/anarchadia'.*glow:'#ff3d96'.*shade:'#621f43'/s,'Merlin button must be magenta\/pink.');
assert.match(nav,/civweave'.*panel:'linear-gradient\(135deg,#fbf8ff/s,'Weaveling button must be pearl\/rainbow.');

// Updates are signaled by a bright platform-colored backlight behind the sprite, never by notification bubbles.
for(const [system,color] of Object.entries({civweave:'#fff8ff','living-school':'#9cff73',cerbanimo:'#c77dff',fellowfare:'#ffc04d',anarchadia:'#ff4ba3'}))assert.match(nav,new RegExp(`${system.replaceAll('-','\\-')}'.*update:'${color}'`,'s'),`${system} must keep its update backlight color.`);
assert.doesNotMatch(nav,/cw-themed-unread/,'Notification bubbles must not return to the five-guide rail.');
assert.match(nav,/data-has-update=\\?"true\\?"/,'Unread guide state must drive a platform update state on the guide control.');
assert.match(nav,/--system-update/,'Guide update backlights must use the platform-specific update color.');
assert.match(nav,/cw-themed-system-avatar-wrap::after/,'The update indicator must live directly behind the guide sprite.');
assert.ok(nav.includes("updateSignalRevision='sprite-backlight-v1'"),'The rail must declare the sprite-backlight update signal revision.');

// Scorched-earth geometry contract: the desired tall five-guide rail is the only navbar geometry left.
assert.ok(nav.includes(':root{--cw-themed-nav-height:clamp(92px,10vw,100px);--cw-themed-nav-bottom-gap:0px}'),'Canonical desktop rail height must live in the navigation owner.');
assert.ok(nav.includes('width:84px;height:84px;border-radius:20px'),'Canonical desktop avatar geometry must live in the navigation owner.');
assert.ok(nav.includes('@media(max-width:680px){:root{--cw-themed-nav-height:clamp(88px,22vw,96px);--cw-themed-nav-bottom-gap:0px}'),'Canonical phone rail height must live in the navigation owner.');
assert.ok(nav.includes('width:76px;height:76px'),'Canonical phone avatar geometry must remain 76px.');
assert.ok(nav.includes('@media(max-width:430px){:root{--cw-themed-nav-height:clamp(80px,22vw,88px);--cw-themed-nav-bottom-gap:0px}'),'Canonical narrow-phone rail height must live in the navigation owner.');
assert.ok(nav.includes('width:68px;height:68px'),'Canonical narrow-phone avatar geometry must remain 68px.');
assert.match(nav,/bottom:calc\(env\(safe-area-inset-bottom\) \+ var\(--cw-themed-nav-bottom-gap\)\)/,'Canonical rail must retain a safe-area-aware base anchor.');
assert.ok(nav.includes('height:calc(var(--cw-themed-nav-height) + env(safe-area-inset-bottom))'),'Phone rail shell must extend through the safe area.');
assert.ok(nav.includes("geometryOwner:'canonical-tall-v1'"),'Navigation API must declare the canonical geometry owner.');

for(const retired of [
  '--cw-themed-nav-height:clamp(56px,7vw,68px)',
  '--cw-themed-nav-height:clamp(58px,14vw,64px)',
  '--cw-themed-nav-height:clamp(52px,7vw,72px)',
  '--cw-themed-nav-height:clamp(50px,14vw,66px)',
  'width:40px;height:40px;border-radius:12px',
  'width:36px;height:36px',
  'width:33px;height:33px'
])assert.ok(!nav.includes(retired),`Retired compact navbar geometry returned: ${retired}`);
assert.doesNotMatch(platformCss,/cw-themed-system-nav|cw-themed-nav-height|cw-themed-system-avatar-wrap/,'Platform CSS must not own or override five-guide navbar geometry.');
assert.ok(sharedGuide.includes("navigationGeometryOwner:false"),'Shared guide surface must explicitly disclaim navbar geometry ownership.');
assert.ok(sharedGuide.includes('--cw-guide-nav-offset'),'Shared guide floating controls must use their own measured navbar offset variable.');
assert.ok(!sharedGuide.includes("setProperty('--cw-themed-nav-height'"),'Shared guide surface must never rewrite the canonical navbar height.');
assert.doesNotMatch(sharedGuide,/--cw-themed-nav-height\s*:/,'Shared guide surface must never declare the canonical navbar height variable.');
assert.doesNotMatch(sharedGuide,/#cw-themed-system-nav \.cw-themed-system-link\{height:/,'Shared guide surface must never impose navbar link height.');

assert.match(nav,/background-size:500% 400%,cover|background-size:500% 400%/,'Nav must crop the 5x4 avatar atlases.');
assert.match(nav,/civweave:subsystem-avatar-state/);
assert.match(nav,/civweave:avatar-expression/);
assert.match(nav,/subsystemActive\(system\)/,'Subsystem state must override chat mood while active.');

const listeners=new Map(),storage=new Map(),localStorage={getItem:key=>storage.has(key)?storage.get(key):null,setItem:(key,value)=>storage.set(key,String(value)),removeItem:key=>storage.delete(key)};
const context={console,Date,Math,Object,Array,Map,Set,String,Number,Boolean,JSON,Promise,structuredClone,localStorage,location:{pathname:'/app/working-campus-v156.html'},document:{readyState:'complete',documentElement:{dataset:{civweaveSystemRoute:'civweave'}}},CustomEvent:class{constructor(type,init={}){this.type=type;this.detail=init.detail}},addEventListener:(name,fn)=>{const rows=listeners.get(name)||[];rows.push(fn);listeners.set(name,rows)},dispatchEvent:event=>{for(const fn of listeners.get(event.type)||[])fn(event);return true},setInterval:()=>1,clearInterval:()=>{},setTimeout:()=>1,clearTimeout:()=>{}};
context.globalThis=context;
vm.runInNewContext(mapper,context,{filename:'subsystem-avatar-state-v347.js'});
const api=context.CivweaveSubsystemAvatarStateV347;
assert.ok(api,'State mapper did not boot.');
assert.equal(api.expressionFor('civweave','healthy'),'hopeful');
assert.equal(api.expressionFor('living-school','healthy'),'encouraging');
assert.equal(api.expressionFor('cerbanimo','healthy'),'helpful');
assert.equal(api.expressionFor('fellowfare','healthy'),'approving');
assert.equal(api.expressionFor('anarchadia','healthy'),'happy');
assert.equal(api.expressionFor('living-school','quiet'),'sleepy');
assert.equal(api.expressionFor('anarchadia','lonely'),'shy');
assert.equal(api.expressionFor('cerbanimo','needs-attention'),'worried');
assert.equal(api.expressionFor('fellowfare','unread'),'curious');
api.set('cerbanimo','needs-attention',{sticky:true,source:'test',reason:'needs you'});
assert.equal(api.status('cerbanimo').expression,'worried');
api.clear('cerbanimo');
assert.equal(api.status('cerbanimo'),null);
context.dispatchEvent(new context.CustomEvent('civweave:systems-mesh:projection-candidate',{detail:{projection:{targetSystem:'fellowfare',projectionId:'p1',projectionType:'offer'}}}));
assert.equal(api.status('fellowfare').state,'needs-attention');
assert.equal(api.status('fellowfare').expression,'worried');
context.dispatchEvent(new context.CustomEvent('civweave:capacity-session-ready',{detail:{}}));
assert.equal(api.status('civweave').expression,'hopeful');

console.log(JSON.stringify({
  ok:true,
  version,
  revision:'subsystem-avatar-nav-v347-canonical-tall-rail-single-geometry-owner',
  atlasCount:5,
  stateContract:'civweave.subsystem-avatar-state/v1',
  updateSignal:'sprite-backlight-v1',
  quiet:'sleepy',
  lonely:'shy',
  attention:'worried',
  mobileRail:{geometryOwner:'themed-system-nav-v178',platformOverrides:false,sharedGuideOverrides:false,bottomGuardPx:0,safeAreaInsideTray:true}
},null,2));

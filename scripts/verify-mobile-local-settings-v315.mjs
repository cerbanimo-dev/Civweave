import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [orchestrator,parity,livingSchool,boundary]=await Promise.all([
  read('public/app/experience-orchestrator-v232.js'),
  read('public/app/settings-parity-v295.js'),
  read('public/app/cabinets/living-school/index.html'),
  read('public/app/install-boundary-v146.js')
]);

new Function(orchestrator);
new Function(parity);

assert.match(orchestrator,/experience-orchestrator-v315-mobile-settings-first-open/,'mobile settings first-open revision is missing');
assert.match(orchestrator,/globalThis\.addEventListener\('click',earlySettings,true\)/,'settings tap must be captured at window level before document-level legacy owners');
assert.doesNotMatch(orchestrator,/document\.addEventListener\('click',earlySettings,true\)/,'document-level settings capture reintroduces the mobile ownership race');

const openIndependent=orchestrator.match(/async function openSettingsIndependent\(target\)\{([\s\S]*?)\}\nfunction earlyLocalSubmit/)?.[1]||'';
assert.ok(openIndependent,'openSettingsIndependent must remain inspectable');
assert.ok(openIndependent.indexOf('direct.open(target)')>=0,'the already-loaded canonical controller must be used directly');
assert.ok(openIndependent.indexOf('direct.open(target)')<openIndependent.indexOf('await ensureSettingsModule()'),'the visible settings surface must open before lazy settings-module loading');
assert.match(openIndependent,/finishSettingsOpen\(layer\)/,'direct opens must still finish canonical settings setup');

const finishOpen=orchestrator.match(/function finishSettingsOpen\(layer\)\{([\s\S]*?)\}\nasync function openSettingsIndependent/)?.[1]||'';
assert.ok(finishOpen,'finishSettingsOpen must remain inspectable');
assert.match(finishOpen,/ensureMobileSettingsStack\(\)/,'mobile stacking repair must run on every settings open');
assert.match(finishOpen,/CivweaveSettingsParityV295\?\.ensureManagement\?\.\(\)/,'downloaded local-model management must mount after the panel is visible');

assert.match(orchestrator,/#cw-ai-settings-cleanroom-v188\{z-index:2147483647!important\}/,'settings must stay above the mobile guide surface');
assert.match(orchestrator,/#cw-persistent-guide-chat-v215:not\(\[hidden\]\):not\(\.is-minimized\)\{z-index:2147483646!important\}/,'mobile full-screen chat must sit below settings');
assert.match(orchestrator,/settingsCaptureOwner:'window-first-v315'/);
assert.match(orchestrator,/settingsVisibleBeforeManagement:true/);
assert.match(orchestrator,/mobileSettingsStack:true/);

assert.match(parity,/1\.0\.126-settings-parity-v315-mobile-first-open/);
assert.match(parity,/visiblePanelRepairsManagement:true/,'already-visible settings panels must still receive downloaded-local controls');
const parityOpen=parity.match(/async function open\(launcher\)\{([\s\S]*?)\}\nfunction legacyBypass/)?.[1]||'';
assert.ok(parityOpen,'settings parity open must remain inspectable');
assert.match(parityOpen,/visible&&!visible\.hidden\)\{scheduleManagement\(\);return visible\}/,'an already-visible panel must repair local-model management instead of returning bare legacy settings');
assert.ok(parityOpen.indexOf('owner?.open?.(launcher)')<parityOpen.indexOf('ensureManagement()'),'new settings panels must become visible before downloaded-local management starts');

const settingsButton=livingSchool.match(/<button[^>]*>Settings<\/button>/)?.[0]||'';
assert.ok(settingsButton,'Living School Settings button is missing');
assert.match(settingsButton,/data-open-unified-ai-settings/,'Living School must use the canonical settings marker');
assert.match(settingsButton,/data-living-school-settings-owner="canonical"/,'Living School canonical ownership marker is missing');
assert.doesNotMatch(settingsButton,/data-ls-action="open-ai-settings"/,'Living School must not fall back to its retired local settings action');

for(const route of ['/app/working-campus-v156.html','/app/cabinets/living-school/index.html','/app/realm-console-v140.html','/app/fellowfare-cabinet-v144.html','/app/anarchadia-console-v139.html'])assert.ok(boundary.includes(route),`mobile settings coverage lost ${route}`);
assert.ok(boundary.indexOf('MOBILE_AI_HARDENING')<boundary.indexOf('EXPERIENCE_ORCHESTRATOR'),'mobile hardening must continue loading before the shared experience orchestrator');

console.log(JSON.stringify({
  ok:true,
  revision:'mobile-local-settings-v315',
  systems:5,
  windowFirstSettingsCapture:true,
  visibleBeforeManagement:true,
  livingSchoolCanonicalSettings:true,
  visiblePanelLocalModelRepair:true,
  mobileSettingsAboveChat:true
},null,2));

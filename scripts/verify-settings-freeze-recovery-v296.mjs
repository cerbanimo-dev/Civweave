import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [orchestrator,parity,lifecycle,boundary]=await Promise.all([
  'public/app/experience-orchestrator-v232.js',
  'public/app/settings-parity-v295.js',
  'public/app/document-lifecycle-v221.js',
  'public/app/install-boundary-v146.js'
].map(read));
for(const source of [orchestrator,parity,lifecycle,boundary])new Function(source);

for(const path of ['/app/working-campus-v156.html','/app/cabinets/living-school/index.html','/app/realm-console-v140.html','/app/fellowfare-cabinet-v144.html','/app/anarchadia-console-v139.html'])assert.ok(boundary.includes(path),`five-system loader lost ${path}`);
assert.match(boundary,/const EXPERIENCE_ORCHESTRATOR='\/app\/experience-orchestrator-v232\.js'/);
assert.match(boundary,/SYSTEM_EXPERIENCE_SCRIPTS=\[/);

assert.match(orchestrator,/experience-orchestrator-v299-chat-boot-runtime-fallback/);
assert.match(orchestrator,/const SETTINGS_MODULE=/);
assert.match(orchestrator,/const CHAT_MODULES=/);
assert.match(orchestrator,/function ensureSettingsModule\(/);
assert.match(orchestrator,/function ensureChatModules\(/);
assert.match(orchestrator,/function releaseLegacySettingsClick\(/);
const settingsClick=orchestrator.match(/function earlySettings\(event\)\{([\s\S]*?)\}\n\nglobalThis\.addEventListener/)?.[1]||'';
assert.ok(settingsClick,'earlySettings must remain inspectable');
assert.match(settingsClick,/openSettingsIndependent/);
assert.doesNotMatch(settingsClick,/ensureChatModules|ensureLaunchModules/,'settings must not be gated by chat readiness');
const submit=orchestrator.match(/function earlyLocalSubmit\(event\)\{([\s\S]*?)\}\nfunction earlySettings/)?.[1]||'';
assert.match(submit,/ensureChatModules/,'downloaded-local chat still needs its chat-only launch lane');
assert.match(submit,/CivweaveLocalChatOwnerV295\?\.enqueue/,'downloaded-local chat must queue through the local owner');
assert.match(orchestrator,/globalThis\.addEventListener\('submit',earlyLocalSubmit,true\)/,'local preflight must run before canonical document submit capture');
assert.doesNotMatch(orchestrator,/document\.addEventListener\('submit'/,'settings/chat orchestrator must not compete at document submit capture');

for(const selector of ['[data-action="settings"]','[data-ls-action="open-ai-settings"]','#settings-button','#model-chip']){assert.ok(orchestrator.includes(selector),`orchestrator settings selector lost ${selector}`);assert.ok(parity.includes(selector),`settings parity selector lost ${selector}`);assert.ok(lifecycle.includes(selector),`document lifecycle selector lost ${selector}`)}

assert.match(parity,/1\.0\.99-settings-parity-v296/);
assert.match(parity,/settingsIndependentOfChat:true/);
assert.match(parity,/inferenceDormantOnOpen:true/);
assert.match(parity,/function releaseLegacy\(/);
const parityOpen=parity.match(/async function open\(launcher\)\{([\s\S]*?)\}\nfunction legacyBypass/)?.[1]||'';
assert.ok(parityOpen,'settings parity open must remain inspectable');
assert.ok(parityOpen.indexOf('owner?.open?.(launcher)')<parityOpen.indexOf('ensureManagement()'),'settings UI must open before local model management loads');
assert.doesNotMatch(parityOpen,/ensureChat|LocalChat|runtime-v266|bootstrap-v266/,'settings open must not activate chat or inference');

assert.match(lifecycle,/document-lifecycle-v296-management-only-settings/);
assert.match(lifecycle,/management-only-no-inference-bootstrap-v296/);
assert.doesNotMatch(lifecycle,/bootstrap-v266\.js/,'settings lifecycle must not contain an inference-bootstrap request');
const managementList=lifecycle.match(/const LOCAL_AI_MANAGEMENT_FILES=\[([\s\S]*?)\n\];/)?.[1]||'';
assert.ok(managementList,'management file list must remain inspectable');
for(const forbidden of ['runtime-v266','runtime-bridge-v266','bootstrap-v266','test-pulse-v269','fast-interactive-runtime'])assert.ok(!managementList.includes(forbidden),`settings management lane includes inference asset ${forbidden}`);

console.log(JSON.stringify({ok:true,revision:'settings-freeze-recovery-v299-chat-runtime-fallback',canonicalSystems:5,settingsIndependentOfChat:true,legacyClickFallback:true,settingsOpenBeforeManagement:true,inferenceDormantOnSettingsOpen:true,localSubmitWindowPreflight:true},null,2));

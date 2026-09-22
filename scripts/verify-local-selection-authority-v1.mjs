import fs from 'node:fs';
import assert from 'node:assert/strict';

const bridge=fs.readFileSync('public/app/settings-local-route-v325.js','utf8');
const phone=fs.readFileSync('public/app/local-ai/gemma4-dual-actions-v2.js','utf8');

for(const [name,source] of [['settings local route',bridge],['Premier Phone actions',phone]]){
  assert.doesNotThrow(()=>new Function(source),`${name} must parse`);
}

assert.match(bridge,/function persistLocalRoute\(current=selection\(\)\)/,'parent Local models bridge must own canonical local-route persistence');
assert.doesNotMatch(bridge,/function persistLocalRoute\(\)\{return null\}/,'local-route persistence must not be a no-op');
assert.match(bridge,/CivweaveSettingsV320\?\.selectLocalModel/,'bridge must use the shared Settings owner');
assert.match(bridge,/selectLocalModel\?\.\(current\)/,'selection must delegate persistence to the Settings owner');
assert.doesNotMatch(bridge,/localStorage\.setItem\(SETTINGS_KEY|localStorage\.setItem\(PROFILES_KEY/,'bridge must not compete with Settings persistence');
const gateway=fs.readFileSync('public/app/settings-gateway-v317.js','utf8');
assert.match(gateway,/function selectLocalModel\(/);
assert.match(gateway,/civweave:model-config-changed/);
assert.match(gateway,/civweave:model-settings-saved/);

assert.match(phone,/const route=globalThis\.CivweaveSettingsLocalRouteV323\?\.persistLocalRoute\?\.\(/,'fast/deep phone buttons must persist the downloaded-local route');
assert.match(phone,/if\(!route\)throw new Error\('The local model was selected, but Civweave could not make downloaded local AI the active provider route\.'/,'a failed route handoff must be visible rather than silently falling back');
assert.match(phone,/selectedModel:modelId/,'Premier Phone state must remember the selected fast/deep lane');
assert.match(phone,/Using fast phone model/,'fast lane selection must be visible in the button state');
assert.match(phone,/Using deep phone model/,'deep lane selection must be visible in the button state');
assert.match(phone,/localSelectionPersistsProviderRoute:true/,'phone controller must declare route persistence');

console.log('PASS downloaded local model selection remains the canonical provider route and cannot silently revert to cloud AI');

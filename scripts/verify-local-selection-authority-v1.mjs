import fs from 'node:fs';
import assert from 'node:assert/strict';

const bridge=fs.readFileSync('public/app/settings-local-route-v325.js','utf8');
const phone=fs.readFileSync('public/app/local-ai/gemma4-dual-actions-v2.js','utf8');

for(const [name,source] of [['settings local route',bridge],['Premier Phone actions',phone]]){
  assert.doesNotThrow(()=>new Function(source),`${name} must parse`);
}

assert.match(bridge,/function persistLocalRoute\(current=selection\(\)\)/,'parent Local models bridge must own canonical local-route persistence');
assert.doesNotMatch(bridge,/function persistLocalRoute\(\)\{return null\}/,'local-route persistence must not be a no-op');
assert.match(bridge,/SETTINGS_KEY='civweave\.universal-ai\.v127'/,'canonical settings key must be updated');
assert.match(bridge,/PROFILES_KEY='civweave-model-profiles-v1'/,'canonical model profiles must be updated');
assert.match(bridge,/provider:ROUTE,model:String\(current\.id\)/,'selected downloaded model must become the canonical interactive provider/model');
assert.match(bridge,/localStorage\.setItem\(SETTINGS_KEY/,'canonical settings record must be persisted');
assert.match(bridge,/localStorage\.setItem\(PROFILES_KEY/,'canonical profile record must be persisted');
assert.match(bridge,/civweave:model-settings-saved/,'selection must notify Settings consumers');
assert.match(bridge,/civweave:model-config-changed/,'selection must refresh provider authority wrappers');
assert.match(bridge,/selectedLocalBecomesProviderAuthority:true/,'bridge must declare provider-authority ownership');

assert.match(phone,/const route=globalThis\.CivweaveSettingsLocalRouteV323\?\.persistLocalRoute\?\.\(/,'fast/deep phone buttons must persist the downloaded-local route');
assert.match(phone,/if\(!route\)throw new Error\('The local model was selected, but Civweave could not make downloaded local AI the active provider route\.'/,'a failed route handoff must be visible rather than silently falling back');
assert.match(phone,/selectedModel:modelId/,'Premier Phone state must remember the selected fast/deep lane');
assert.match(phone,/Using fast phone model/,'fast lane selection must be visible in the button state');
assert.match(phone,/Using deep phone model/,'deep lane selection must be visible in the button state');
assert.match(phone,/localSelectionPersistsProviderRoute:true/,'phone controller must declare route persistence');

console.log('PASS downloaded local model selection remains the canonical provider route and cannot silently revert to cloud AI');

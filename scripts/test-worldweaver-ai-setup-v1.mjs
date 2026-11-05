import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const settings=readFileSync(new URL('../public/app/settings-gateway-v317.js',import.meta.url),'utf8');
const onboarding=readFileSync(new URL('../public/app/new-user-onboarding-v1.js',import.meta.url),'utf8');
const entry=readFileSync(new URL('../public/app/working-campus-v156.html',import.meta.url),'utf8');

test('the canonical settings owner presents the mode choice and controls provider setup',()=>{
  assert.match(settings,/name="worldMode"/);
  assert.match(settings,/function readWorldMode\(/);
  assert.match(settings,/function saveWorldMode\(/);
  assert.match(settings,/function openForProvider\(/);
  assert.match(settings,/function chooseLocalOnly\(/);
  assert.match(settings,/worldMode:readWorldMode/);
  assert.match(settings,/provider-not-configured|requires both providers/i);
});

test('startup guide offers local only and a single cloud key through the canonical owner',()=>{
  assert.match(onboarding,/function needsAISetup\(/);
  assert.match(onboarding,/data-cw-ai-setup-local/);
  assert.match(onboarding,/data-cw-ai-setup-openai/);
  assert.match(onboarding,/data-cw-ai-setup-gemini/);
  assert.match(onboarding,/CivweaveSettingsV320/);
  assert.match(entry,/new-user-onboarding-v1\.js/);
});

test('existing settings remain the single input and credential owner',()=>{
  assert.match(settings,/inputOwner:true,presentationOwner:true,credentialOwner:true/);
  assert.doesNotMatch(onboarding,/localStorage\.setItem\(['"]civweave-model-session/);
  assert.doesNotMatch(onboarding,/fetch\(['"]https:\/\/(api\.openai\.com|generativelanguage)/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {publishedPlaytestRates,resolvePlaytestPricing,allowedPlaytestHostname} from '../public/app/shared/worldweaver-ai-pricing-v1.mjs';
const file=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const configs={
 openai:{provider:'openai-compatible',endpoint:'https://api.openai.com/v1',model:'gpt-6-luna',apiKey:'test-key',externalConsent:true},
 gemini:{provider:'gemini',endpoint:'https://generativelanguage.googleapis.com/v1beta',model:'gemini-3.1-flash-lite',apiKey:'test-key',externalConsent:true}
};
const settings=(mode='binary',primary='gemini',override={})=>({
 readWorldMode:()=>mode, readState:()=>({route:primary==='openai'?'openai-compatible':'gemini'}),
 readWorldweaverProviderConfig:p=>override[p]??configs[p]
});
test('supported API model prices are explicit versioned text-tier rates',()=>{
 assert.deepEqual(publishedPlaytestRates('openai','gpt-6-luna'),{input:0.1,output:0.5});
 assert.deepEqual(publishedPlaytestRates('gemini','gemini-3.1-flash-lite'),{input:0.25,output:1.5});
 assert.deepEqual(publishedPlaytestRates('gemini','gemini-3.7-flash'),{input:0.75,output:3.75});
 assert.equal(publishedPlaytestRates('gemini','surprise-model'),null);
});
test('system uses only chosen provider, binary requires both, and experimental modes block',()=>{
 assert.deepEqual(resolvePlaytestPricing(settings('system','gemini')), {gemini:{input:0.25,output:1.5}});
 assert.deepEqual(resolvePlaytestPricing(settings('system','openai')), {openai:{input:0.1,output:0.5}});
 assert.deepEqual(resolvePlaytestPricing(settings('binary')), {openai:{input:0.1,output:0.5},gemini:{input:0.25,output:1.5}});
 assert.throws(()=>resolvePlaytestPricing(settings('multiverse')),/not live|experimental/i);
 assert.throws(()=>resolvePlaytestPricing(settings('local-only')),/local-only/i);
});
test('unknown models and missing consent fail before spending, with no guesswork',()=>{
 assert.throws(()=>resolvePlaytestPricing(settings('binary','gemini',{gemini:{...configs.gemini,model:'gemini-other'}})),/unverified model/i);
 assert.throws(()=>resolvePlaytestPricing(settings('binary','gemini',{gemini:{...configs.gemini,externalConsent:false}})),/consent/i);
 assert.throws(()=>resolvePlaytestPricing(settings('binary','gemini',{gemini:{...configs.gemini,apiKey:''}})),/key/i);
});
test('playtest is explicitly user-driven, has visible caps, and does not persist story transcripts',()=>{
 const html=file('public/app/tools/worldweaver-ai-playtest.html');
 const js=file('public/app/tools/worldweaver-ai-playtest-v1.mjs');
 assert.match(html,/data-ww-ai-role/);
 assert.match(html,/data-ww-ai-send/);
 assert.match(html,/data-ww-ai-consent/);
 assert.match(html,/data-ww-ai-budget/);
 assert.match(html,/API key/i);
 assert.match(js,/createConfiguredWorldweaverAISession/);
 assert.match(js,/userInitiated:true/);
 assert.match(js,/form\.addEventListener\('submit'/);
 assert.match(js,/activeController\?\.abort/);
 assert.match(js,/await import\('\/app\/shared\/civweave-model-runtime\.js'\)/);
 assert.doesNotMatch(js,/localStorage\.setItem|sessionStorage\.setItem|setInterval|setTimeout\(.*propose/);
});
test('Commons Between links only to optional shared-runtime story proposal lab',()=>{
 const html=file('public/app/commons-between.html');
 assert.match(html,/worldweaver-ai-playtest\.html/);
 assert.match(html,/optional/i);
});

test('paid playtest host gate never accepts production or lookalike hosts',()=>{
  for(const hostname of ['civweave.cc','www.civweave.cc','civweave.pages.dev',
    'civweave-staging.pages.dev.attacker.com','civweave-staging.pages.dev.evil',
    'some-other.pages.dev',''])assert.equal(allowedPlaytestHostname(hostname),false,hostname);
  for(const hostname of ['civweave-staging.pages.dev','localhost','127.0.0.1'])
    assert.equal(allowedPlaytestHostname(hostname),true,hostname);
});
test('playtest checks current host before loading runtime or reading provider keys',()=>{
  const src=file('public/app/tools/worldweaver-ai-playtest-v1.mjs');
  assert.match(src,/allowedPlaytestHostname\(location\.hostname\)/);
  assert.match(src,/if\(!hostAllowed\)/);
});

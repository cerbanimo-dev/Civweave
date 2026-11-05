import test from 'node:test';
import assert from 'node:assert/strict';
import {WORLDWEAVER_AI_MODES,resolveWorldweaverAIRoles} from '../public/app/shared/worldweaver-ai-roles-v1.mjs';

test('all operating modes have stable identities',()=>{
  assert.deepEqual(WORLDWEAVER_AI_MODES,['system','binary','multiverse','local-only']);
});

test('one system model drives the entire cast, including the foil',()=>{
  const result=resolveWorldweaverAIRoles({mode:'system',primary:'gemini',connected:['gemini']});
  assert.equal(result.ready,true);
  assert.equal(result.roles.loom.provider,'gemini');
  assert.equal(result.roles.actors.provider,'gemini');
  assert.equal(result.roles.lari.provider,'gemini');
});

test('binary always splits ChatGPT Loom from Gemini characters and Lari',()=>{
  const result=resolveWorldweaverAIRoles({mode:'binary',primary:'gemini',connected:['openai','gemini']});
  assert.equal(result.ready,true);
  assert.equal(result.roles.loom.provider,'openai');
  assert.equal(result.roles.actors.provider,'gemini');
  assert.equal(result.roles.lari.provider,'gemini');
  assert.equal(result.roles.architect.enabled,false);
});

test('binary does not silently substitute the single configured cloud key',()=>{
  const result=resolveWorldweaverAIRoles({mode:'binary',connected:['gemini']});
  assert.equal(result.ready,false);
  assert.deepEqual(result.missing,['openai']);
  assert.equal(result.roles.loom.enabled,false);
  assert.equal(result.roles.actors.enabled,true);
});

test('multiverse gates experimental DeepSeek and Grok until approved',()=>{
  const pending=resolveWorldweaverAIRoles({mode:'multiverse',connected:['openai','gemini','grok','deepseek']});
  assert.equal(pending.ready,false);
  assert.equal(pending.roles.lari.provider,'grok');
  assert.equal(pending.roles.lari.reason,'provider-testing');
  assert.equal(pending.roles.architect.reason,'provider-testing');
  const tested=resolveWorldweaverAIRoles({mode:'multiverse',connected:['openai','gemini','grok','deepseek'],tested:['grok','deepseek']});
  assert.equal(tested.ready,true);
  assert.equal(tested.roles.architect.enabled,true);
});

test('local only requires no remote provider and offers offline manual fallback',()=>{
  const noModel=resolveWorldweaverAIRoles({mode:'local-only'});
  assert.equal(noModel.ready,true);
  assert.equal(noModel.roles.loom.provider,'local-rules');
  const model=resolveWorldweaverAIRoles({mode:'local-only',localModelAvailable:true});
  assert.equal(model.roles.lari.provider,'local');
});

test('unknown providers cannot become active through a malformed selection',()=>{
  assert.throws(()=>resolveWorldweaverAIRoles({mode:'arbitrary'}),/Unsupported Worldweaver AI mode/);
  assert.throws(()=>resolveWorldweaverAIRoles({mode:'system',primary:'grok',connected:['grok']}),/system provider/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('same canonical chat composer presents opt-in campaign controls without alternate transcript',()=>{
 const s=read('../public/app/guide-chat-surface-v350.js');
 for(const name of ['data-persona-toggle','data-persona-panel','data-persona-pack','data-persona-save','data-persona-speaker','data-persona-director-model','data-persona-actor-model']){
   assert.match(s,new RegExp(name));
 }
 assert.match(s,/personaChatAdapter\.respond/);
 assert.match(s,/persona-chat-controls-v1\.mjs/);
 assert.match(s,/personaChatAdapter\?\.active\(\)/);
 assert.match(s,/CivweavePersistentGuideChatV215/);
});
test('persona import is deliberately user-selected and excludes automatic cloud or hidden memory merging',()=>{
 const c=read('../public/app/shared/persona-chat-controls-v1.mjs');
 assert.match(c,/importCampaignSnapshot/);
 assert.match(c,/validatePersonaPack/);
 assert.match(c,/endpointLeavesDevice/);
 assert.match(c,/consent/);
 assert.doesNotMatch(c,/localStorage\.setItem\(/);
 assert.doesNotMatch(c,/addEventListener\(['"]submit['"]/);
});

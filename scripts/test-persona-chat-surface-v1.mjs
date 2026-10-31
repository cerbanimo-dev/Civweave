import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('same canonical chat composer presents opt-in campaign controls without alternate transcript',()=>{
 const s=read('../public/app/guide-chat-surface-v350.js');
 for(const name of ['data-persona-toggle','data-persona-panel','data-persona-pack','data-persona-inspect','data-persona-cast-list','data-persona-stage','data-persona-scenario','data-persona-new','data-persona-save' ,'data-persona-speaker','data-persona-control','data-persona-willpower','data-persona-deviation','data-persona-guild-host','data-persona-guild-join','data-persona-guild-refresh','data-persona-guild-assign','data-persona-guild-seat-user','data-persona-guild-seat-role','data-persona-guild-timeline','data-persona-director-model','data-persona-actor-model']){
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
 assert.match(c,/createPersonaCampaign/);
 assert.match(c,/createGuildPersonaClient/);
 assert.match(c,/guildClient\.dispatch/);
 assert.match(c,/showGuildRoom/);
 assert.match(c,/function showWillpower/);
 assert.match(c,/option\.value==='both'/);
 assert.match(c,/validatePersonaPack/);
 assert.match(c,/endpointLeavesDevice/);
 assert.match(c,/consent/);
 assert.doesNotMatch(c,/localStorage\.setItem\(/);
 assert.doesNotMatch(c,/addEventListener\(['"]submit['"]/);
});

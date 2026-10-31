import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('same canonical chat composer presents opt-in campaign controls without alternate transcript',()=>{
 const s=read('../public/app/guide-chat-surface-v350.js');
 for(const name of ['data-persona-toggle','data-persona-panel','data-persona-pack','data-persona-inspect','data-persona-cast-list','data-persona-stage','data-persona-scenario','data-persona-new','data-persona-save' ,'data-persona-speaker','data-persona-control','data-persona-willpower','data-persona-deviation','data-persona-guild-host','data-persona-guild-join','data-persona-guild-refresh','data-persona-guild-assign','data-persona-guild-seat-user','data-persona-guild-seat-role','data-persona-guild-timeline','data-persona-guild-generate','data-persona-guild-draft','data-persona-guild-draft-text','data-persona-guild-approve','data-persona-guild-approve-both','data-persona-guild-world','data-persona-guild-3d','data-persona-guild-motion-status','data-persona-guild-move-x','data-persona-guild-move-y','data-persona-guild-move-list','data-persona-guild-move-draft','data-persona-guild-move-approve','data-persona-director-model','data-persona-actor-model']){
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

test('authenticated Guild NPC simulation uses existing composer, model route and 4-second active-room synchronization',()=>{
 const s=read('../public/app/shared/persona-chat-controls-v1.mjs');
 assert.match(s,/runPersonaChatTurn/);
 assert.match(s,/guildClient\.draft/);
 assert.match(s,/guildClient\.approveBoth/);
 assert.match(s,/guildClient\.approve/);
 assert.match(s,/setInterval\(async/);
 assert.match(s,/document\.visibilityState==='hidden'/);
 assert.match(s,/clearInterval\(syncTimer\)/);
 assert.match(s,/startGuildSync\(\)/);
 assert.match(s,/if\(guildRoom\)/);
 assert.doesNotMatch(s,/new WebSocket\(/);
});
test('Persona modules are optional installed-PWA assets, not required boot blockers',()=>{
 const shell=read('../public/service-worker-shell-assets-v1.js');
 for(const name of ['persona-library-v1.mjs','persona-scene-bridge-v1.mjs','persona-campaign-v1.mjs',
  'persona-chat-turn-v1.mjs','persona-chat-controls-v1.mjs','guild-persona-client-v1.mjs']){
   assert.match(shell,new RegExp(name.replace(/[.]/g,'\\.')));
 }
 assert.match(shell,/OPTIONAL_PERSONA/);
 assert.match(shell,/\.\.\.OPTIONAL_PERSONA/);
});

test('authenticated 3D Cast surface renders the authoritative OpenSim-compatible body geometry and never reports a browser movement as committed',()=>{
 const ui=read('../public/app/shared/persona-chat-controls-v1.mjs');
 const client=read('../public/app/shared/guild-persona-client-v1.mjs');
 assert.match(ui,/createOpenSim3DPreview/);
 assert.match(ui,/buildOpenSimGeometry\(guildMotion\.region\)/);
 assert.match(ui,/guildClient\.draftMove/);
 assert.match(ui,/guildClient\.approveMove/);
 assert.match(ui,/sceneViewer\?\.close/);
 assert.match(ui,/guildMotion\.revision/);
 assert.match(client,/move-draft/);
 assert.match(client,/move-approve/);
 assert.doesNotMatch(ui,/world\.dispatch\(/);
});

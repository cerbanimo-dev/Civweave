import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [shell,page]=await Promise.all([
  read('public/app/persistent-system-shell-v1.js'),
  read('public/app/persistent-system-shell-v1.html')
]);

new Function(shell);
assert.ok(shell.includes("const VERSION='1.1.0-persistent-five-system-stage-chrome-owner';"),'Persistent shell chrome owner revision is missing.');
for(const [system,color] of Object.entries({civweave:'#fff8ff','living-school':'#9cff73',cerbanimo:'#c77dff',fellowfare:'#ffc04d',anarchadia:'#ff4ba3'})){
  assert.ok(shell.includes(`${system.includes('-')?`'${system}'`:system}:'${color}'`),`${system} update backlight color is missing.`);
}
assert.ok(shell.includes("const SUBSYSTEM_STATE_KEY='civweave.subsystem-avatar-state.v347';"),'Platform state must feed parent-shell update backlights.');
assert.ok(shell.includes("const GUIDE_THREAD_PREFIX='civweave.guide-thread.v350.';"),'Guide unread state must feed parent-shell update backlights.');
assert.match(shell,/data-has-update="true"/,'Update state must light the guide background instead of adding notification bubbles.');
assert.ok(shell.includes("if(feature==='settings'){openSettings();return}"),'Settings must open in the persistent parent shell rather than navigate to Civweave.');
assert.ok(shell.includes("if(feature==='chat'){openGuide(system);return}"),'Guide chat shortcuts must open the parent-owned chat rather than navigate realms.');
assert.ok(shell.includes("/app/settings-gateway-v317.js"),'Persistent Settings must lazy-load the canonical settings owner when needed.');
assert.ok(shell.includes("/app/settings-local-route-v323.js"),'Persistent Settings must retain the local-model view.');
for(const id of ['cw-human-message-launcher-v1','cwp215-launcher','cw-persistent-guide-chat-v215'])assert.ok(shell.includes(id),`Child chrome suppression is missing ${id}.`);
assert.ok(shell.includes('chromeObserver.observe(doc.documentElement,{childList:true,subtree:true})'),'Child realm launchers must remain suppressed after asynchronous iframe boot.');
assert.ok(page.includes('/app/persistent-system-shell-v1.js?v=1.1.0-persistent-five-system-stage-chrome-owner'),'Persistent shell HTML must cache-bust the chrome owner revision.');
assert.ok(page.includes('child launchers are suppressed by the shell owner'),'Persistent shell ownership comment must match runtime behavior.');

console.log(JSON.stringify({ok:true,revision:'persistent-shell-chrome-owner-v1',updateSignal:'platform-backlight-v2',sharedQuickFeatures:['settings','chat'],childChatLauncherPolicy:'parent-only'},null,2));
